/* CheckAgain: the reader. Turns whatever the user has (pasted cells, CSV, TSV, JSON) into
 * rows for stats.js: { task, setup, run, passed, reward, ended, cost_usd }.
 * No page code here; the page asks, the reader answers. Nothing leaves the browser.
 * MIT licence. Part of CheckAgain, by Crucible Science.
 */
(function (root) {
  "use strict";

  // ── 1. text -> records ──
  function parseDelimited(text, delim) {
    var rows = [], row = [], field = "", i = 0, q = false, c;
    while (i < text.length) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"' && field === "") { q = true; i++; continue; }
      if (c === delim) { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
  }
  function sniffDelim(text) {
    var first = text.split("\n").slice(0, 5).join("\n");
    var counts = { "\t": 0, ",": 0, ";": 0, "|": 0 };
    Object.keys(counts).forEach(function (d) { counts[d] = first.split(d).length - 1; });
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
  }
  function flatten(obj, prefix, out, depth) {   // scalars only, two levels deep; arrays skipped
    out = out || {};
    Object.keys(obj).forEach(function (k) {
      var v = obj[k], key = prefix ? prefix + "." + k : k;
      if (v === null || typeof v !== "object") out[key] = v;
      else if (!Array.isArray(v) && depth < 2) flatten(v, key, out, depth + 1);
    });
    return out;
  }
  function arraysIn(json) {
    var found = [];
    if (Array.isArray(json)) found.push({ path: "", list: json });
    else if (json && typeof json === "object") {
      Object.keys(json).forEach(function (k) {
        if (Array.isArray(json[k])) found.push({ path: k, list: json[k] });
        else if (json[k] && typeof json[k] === "object")
          Object.keys(json[k]).forEach(function (k2) {
            if (Array.isArray(json[k][k2])) found.push({ path: k + "." + k2, list: json[k][k2] });
          });
      });
    }
    return found.filter(function (a) {
      return a.list.length && a.list.every(function (x) { return x && typeof x === "object" && !Array.isArray(x); });
    });
  }
  // CI test reports (JUnit XML: pytest --junitxml, Jest, Vitest, Go and most CI tools)
  function parseJUnit(text, name) {
    if (typeof DOMParser === "undefined") return { error: "Test reports can only be read in a browser." };
    var doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) return { error: "This XML could not be read." };
    var tcs = doc.getElementsByTagName("testcase");
    if (!tcs.length) return { error: "This XML has no test cases, so it is not a test report." };
    var cases = [];
    for (var i = 0; i < tcs.length; i++) {
      var tc = tcs[i], nm = tc.getAttribute("name") || "", cls = tc.getAttribute("classname") || "";
      var rep = /\[(\d+)-(\d+)\]$/.exec(nm);                      // pytest-repeat: test_x[2-5]
      var kids = Array.prototype.map.call(tc.children || [], function (k) { return (k.localName || k.nodeName).toLowerCase(); });
      var passed = kids.indexOf("skipped") >= 0 ? null : (kids.indexOf("failure") >= 0 || kids.indexOf("error") >= 0) ? false : true;
      cases.push({ cls: cls, base: rep ? nm.slice(0, nm.length - rep[0].length) : nm, repeat: rep ? +rep[1] : 0, passed: passed });
    }
    return { kind: "junit", name: name || "", cases: cases };
  }

  function parse(text, name) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var t = text.trim();
    if (!t) return { error: "The file or paste is empty." };
    if (t[0] === "<") return parseJUnit(t, name);
    if (t[0] === "{" || t[0] === "[") {
      var json;
      try { json = JSON.parse(t); } catch (e) {
        // JSON Lines: one object per line
        var lines = t.split(/\r?\n/).filter(function (l) { return l.trim(); });
        try { json = lines.map(function (l) { return JSON.parse(l); }); }
        catch (e2) { return { error: "This looks like JSON but could not be read: " + e.message }; }
      }
      var pf = promptfooRecords(json);
      if (pf) return { kind: "promptfoo", name: name || "", path: "results", headers: pf.headers, records: pf.records, known: pf.map };
      var cands = arraysIn(json).map(function (a) {
        var recs = a.list.map(function (x) { return flatten(x, "", {}, 0); });
        var heads = headersOf(recs);
        var g = guess(heads, recs);
        return { path: a.path, records: recs, headers: heads, score: (g.task ? 2 : 0) + (g.passed ? 2 : 0) + (g.run ? 1 : 0), n: recs.length };
      }).sort(function (a, b) { return b.score - a.score || b.n - a.n; });
      if (!cands.length) return { error: "No list of runs was found in this JSON." };
      return { kind: "json", name: name || "", path: cands[0].path, headers: cands[0].headers, records: cands[0].records };
    }
    var delim = sniffDelim(t), grid = parseDelimited(t, delim);
    if (grid.length < 2) return { error: "Need a header row and at least one row of results." };
    var head = grid[0].map(function (h, i) { return h.trim() || "column " + (i + 1); });
    var recs = grid.slice(1).map(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = r[i] === undefined ? "" : r[i].trim(); }); return o;
    });
    return { kind: delim === "\t" ? "tsv" : "csv", name: name || "", headers: head, records: recs };
  }
  // Promptfoo's JSON output (promptfoo eval -o results.json). One row per test, prompt and provider.
  // With --repeat N each repeat is its own row with a new testIdx, tied together by repeatGroupId
  // (read from Promptfoo's src/evaluator.ts, 13 Oct 2026). Without it, the test's description and
  // inputs identify the task, which also covers older versions.
  function promptfooRecords(json) {
    if (!json || typeof json !== "object") return null;
    var rows = json.results && Array.isArray(json.results.results) ? json.results.results : Array.isArray(json.results) ? json.results : null;
    if (!rows || !rows.length || !rows.every(function (r) { return r && typeof r === "object" && "testIdx" in r && "promptIdx" in r && "success" in r; })) return null;
    var prompts = {};
    rows.forEach(function (r) { prompts[r.promptIdx] = 1; });
    var manyPrompts = Object.keys(prompts).length > 1;
    function varsOf(r) { return (r.testCase && r.testCase.vars) || r.vars || {}; }
    function keyOf(r) {
      var v = varsOf(r), ks = Object.keys(v).sort();
      return (r.testCase && r.testCase.description ? "d:" + r.testCase.description : "") + "|" +
             JSON.stringify(ks.map(function (k) { return [k, v[k]]; }));
    }
    function labelOf(r) {
      if (r.testCase && r.testCase.description) return String(r.testCase.description);
      var v = varsOf(r), s = Object.keys(v).map(function (k) { return String(v[k]); }).join(" · ");
      return s ? (s.length > 60 ? s.slice(0, 57) + "…" : s) : "test " + (r.testIdx + 1);
    }
    var labelFor = {}, used = {};
    var records = rows.map(function (r) {
      var k = keyOf(r);
      if (!labelFor[k]) {
        var l = labelOf(r), base = l, n = 2;
        while (used[l]) l = base + " (" + n++ + ")";
        used[l] = 1; labelFor[k] = l;
      }
      var prov = r.provider || {};
      var setup = (prov.label || prov.id || "provider") + (manyPrompts ? " · prompt " + (r.promptIdx + 1) : "");
      var error = r.failureReason === 2 || (r.error && !r.gradingResult);
      return { task: labelFor[k], setup: setup, success: r.success ? "pass" : "fail",
               ended: error ? "error" : "completed", cost: typeof r.cost === "number" ? r.cost : "" };
    });
    return { records: records, headers: ["task", "setup", "success", "ended", "cost"],
             map: { task: "task", setup: "setup", passed: "success", ended: "ended", cost: "cost" } };
  }

  function headersOf(recs) {
    var seen = {}, out = [];
    recs.slice(0, 200).forEach(function (r) { Object.keys(r).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } }); });
    return out;
  }

  // ── 2. values ──
  var TRUE = ["true", "yes", "y", "pass", "passed", "success", "succeeded", "successful", "ok", "correct", "resolved",
              "✓", "✔", "✅", "t"];
  var FALSE = ["false", "no", "n", "fail", "failed", "failure", "error", "errored", "incorrect", "unresolved",
               "✗", "✘", "❌", "x", "f"];
  var EMPTY = ["", "na", "n/a", "null", "none", "nan", "-", "—", "skipped", "skip", "unscored"];
  function norm(v) { return v === null || v === undefined ? "" : String(v).trim().toLowerCase(); }
  function asNumber(v) {
    if (typeof v === "number") return isFinite(v) ? v : null;
    var s = String(v === null || v === undefined ? "" : v).trim().replace(/[$₹€£,\s]/g, "").replace(/%$/, "");
    if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    return parseFloat(s);
  }
  // what kind of values a passed-column holds
  function passKind(values) {
    var bools = 0, nums = [], empty = 0, other = 0;
    values.forEach(function (v) {
      if (typeof v === "boolean") { bools++; return; }
      var n = norm(v);
      if (EMPTY.indexOf(n) >= 0) { empty++; return; }
      var x = asNumber(v);
      if (x !== null) { nums.push(x); return; }
      if (TRUE.indexOf(n) >= 0 || FALSE.indexOf(n) >= 0) { bools++; return; }
      other++;
    });
    var filled = values.length - empty;
    if (!filled) return { type: "empty" };
    if (other / filled > 0.05) return { type: "unknown" };
    if (nums.length && !bools && nums.every(function (x) { return x === 0 || x === 1; })) return { type: "binary" };
    if (nums.length && !bools) {
      var max = Math.max.apply(null, nums), min = Math.min.apply(null, nums);
      return { type: "score", min: min, max: max, threshold: max <= 1 ? 1 : max };
    }
    return { type: "words" };
  }
  function readPass(v, kind, threshold) {   // -> true / false / null (no score)
    if (typeof v === "boolean") return v;
    var n = norm(v);
    if (EMPTY.indexOf(n) >= 0) return null;
    var x = asNumber(v);
    if (x !== null) return kind && kind.type === "score" ? x >= threshold : x >= 1;
    if (TRUE.indexOf(n) >= 0) return true;
    if (FALSE.indexOf(n) >= 0) return false;
    return null;
  }

  // ── 3. which column is which ──
  var ROLES = {
    task:   [/^(task|taskid|taskname|case|caseid|casename|testcase|testcaseid|test|testid|testname|example|exampleid|scenario|scenarioid|instance|instanceid|item|itemid|question|questionid|sample|sampleid|promptid|problem|problemid|name)$/,
             /task|case|scenario|instance|example|problem|question/],
    run:    [/^(run|runid|runno|runnumber|runindex|trial|trialno|trialindex|attempt|attemptno|attemptnumber|repeat|repetition|rep|epoch|iteration|iter|try|tryno)$/,
             /trial|attempt|repeat|repetition|epoch|iteration|runindex|runno/],
    passed: [/^(passed|pass|result|outcome|success|succeeded|status|verdict|correct|resolved|score|reward|grade|ok|ispass|ispassed|issuccess)$/,
             /passed|success|verdict|outcome|reward|score|result|correct|resolved/],
    setup:  [/^(setup|model|modelname|variant|version|config|configuration|arm|agent|agentname|condition|group|experiment|system|branch|provider|before|after|beforeafter|label)$/,
             /model|variant|setup|version|config|arm|agent|condition/],
    ended:  [/^(ended|ending|endedby|termination|terminationreason|exit|exitreason|stopreason|finishreason|exception|exceptiontype|error|errortype|endreason|outcomereason|status|state)$/,
             /termination|exception|exit|stop|finish|ending|ended/],
    cost:   [/^(cost|costusd|usd|dollars|price|spend|totalcost|agentcost|cost\$|costinusd)$/,
             /cost|usd|dollar|spend|price/]
  };
  function key(h) { return String(h).toLowerCase().replace(/[^a-z0-9$]/g, ""); }
  function guess(headers, records) {
    var used = {}, map = {};
    var sample = records.slice(0, 500);
    function col(h) { return sample.map(function (r) { return r[h]; }); }
    function fits(role, h) {
      var vals = col(h);
      if (role === "passed") { var k = passKind(vals); return k.type === "binary" || k.type === "words" || k.type === "score"; }
      if (role === "cost") return vals.filter(function (v) { return norm(v) !== ""; }).every(function (v) { return asNumber(v) !== null; });
      if (role === "setup") {   // a handful of names, not a column of measurements
        var seen = {}, nums = 0, filled = 0;
        vals.forEach(function (v) { var s = norm(v); if (s) { filled++; seen[s] = 1; if (asNumber(v) !== null) nums++; } });
        var n = Object.keys(seen).length;
        return filled > 0 && n <= 50 && n < filled && !(nums === filled && n > 10);
      }
      return true;
    }
    ["passed", "task", "run", "cost", "ended", "setup"].forEach(function (role) {
      for (var pass = 0; pass < 2 && !map[role]; pass++) {
        for (var i = 0; i < headers.length; i++) {
          var h = headers[i];
          if (used[h]) continue;
          if (ROLES[role][pass].test(key(h)) && fits(role, h)) { map[role] = h; used[h] = 1; break; }
        }
      }
    });
    // last resort for passed: any column whose values read as pass/fail words
    if (!map.passed) headers.some(function (h) {
      if (used[h]) return false;
      var k = passKind(col(h));
      if (k.type === "binary" || k.type === "words") { map.passed = h; used[h] = 1; return true; }
      return false;
    });
    // a setup column with one value is not a comparison
    return map;
  }
  var ABNORMAL = /timeout|timed.?out|error|exception|fail|crash|abort|cancel|killed|limit|max.?(steps|turns|tokens|errors)|interrupt|oom|panic/i;
  function guessNormalEndings(values) {
    var seen = {};
    values.forEach(function (v) { var s = v === null || v === undefined ? "" : String(v).trim(); if (s) seen[s] = 1; });
    return Object.keys(seen).filter(function (v) { return !ABNORMAL.test(v); });
  }
  function distinct(records, h) {
    var seen = {}, out = [];
    records.forEach(function (r) { var v = r[h]; var s = v === null || v === undefined ? "" : String(v).trim(); if (s && !seen[s]) { seen[s] = 1; out.push(s); } });
    return out;
  }
  function shortName(fileName) {
    var base = String(fileName || "").replace(/\.[a-z0-9]+$/i, "");
    var cut = base.split(/_{1,2}/)[0];
    return cut || base || "your agent";
  }

  // ── 4. one or more inputs -> a plan the person can confirm ──
  // inputs: [{ text, name }] (several files: each without a setup column becomes one setup)
  // inputs: [{ text, name, batch }]. A file without a setup column becomes one setup, named after
  // the file. Test reports dropped together (one batch) are the runs of one setup; a second batch
  // is the second setup ("before", "after").
  function read(inputs) {
    var parts = [], junit = [], harbor = [], errors = [];
    inputs.forEach(function (inp) {
      if (inp.harbor) { harbor.push(inp); return; }
      var p = parse(inp.text, inp.name);
      if (p.error) errors.push((inp.name ? inp.name + ": " : "") + p.error);
      else if (p.kind === "junit") { p.batch = inp.batch || 0; junit.push(p); }
      else parts.push(p);
    });
    var plans = parts.map(function (p) {
      var map = p.known || guess(p.headers, p.records);
      var kind = map.passed ? passKind(p.records.map(function (r) { return r[map.passed]; })) : null;
      return { name: p.name, kind: p.kind, path: p.path, headers: p.headers, records: p.records, map: map, passKind: kind,
               threshold: kind && kind.type === "score" ? kind.threshold : 1,
               normal: map.ended ? guessNormalEndings(p.records.map(function (r) { return r[map.ended]; })) : [],
               setupName: !map.setup && p.name ? shortName(p.name) : null };
    });
    if (junit.length) plans.push(junitPlan(junit));
    if (harbor.length) { var hp = harborPlan(harbor); if (hp.error) errors.push(hp.error); else plans.push(hp); }
    if (!plans.length) return { error: errors.join(" ") || "Nothing could be read." };
    return { plans: plans, errors: errors };
  }
  // Harbor job folders: one result.json per run. Read as note two's importer reads them:
  // pass = reward >= 1; no exception recorded = stopped by itself; cost as recorded.
  // Each job folder (and, inside a job, each model) is one setup, named after its model, so a drop
  // that holds several jobs is never pooled into one reading. Within a drop, older jobs come first.
  function harborPlan(files) {
    var byKey = {}, order = [], bad = 0;
    files.forEach(function (f) {
      var r; try { r = JSON.parse(f.text); } catch (e) { bad++; return; }
      if (!r || !r.task_name || !r.trial_name) return;          // the job's own result.json
      var mi = ((r.agent_info || {}).model_info) || {}, model = mi.name ? String(mi.name) : "";
      var job = f.job || f.top || "job", key = (f.batch || 0) + "\u0000" + job + "\u0000" + model;
      if (!byKey[key]) { byKey[key] = { batch: f.batch || 0, job: job, model: model, top: f.top || "job", first: "", trials: [] }; order.push(key); }
      var B = byKey[key], s = String(r.started_at || "");
      if (s && (!B.first || s < B.first)) B.first = s;
      B.trials.push(r);
    });
    if (!order.length) return { error: "No runs found in this folder: it has no result.json files with a task and a trial." };
    order.sort(function (x, y) {
      var a = byKey[x], b = byKey[y];
      if (a.batch !== b.batch) return a.batch - b.batch;
      if (a.first !== b.first) return a.first < b.first ? -1 : 1;
      return a.job < b.job ? -1 : a.job > b.job ? 1 : 0;
    });
    var byModel = {};
    order.forEach(function (k) { var m = byKey[k].model || byKey[k].job.split("/").pop(); byModel[m] = (byModel[m] || 0) + 1; });
    var used = {}, records = [];
    order.forEach(function (k, n) {
      var B = byKey[k], jobName = B.job.split("/").pop();
      var label = B.model || jobName;
      if (byModel[label] > 1) label += " · " + jobName;           // two jobs with one model: add the job's name
      if (used[label]) label += " (" + (n + 1) + ")";
      used[label] = 1;
      var byTask = {};
      B.trials.forEach(function (r) { (byTask[r.task_name] = byTask[r.task_name] || []).push(r); });
      Object.keys(byTask).forEach(function (t) {
        byTask[t].sort(function (x, y) {
          var a = String(x.started_at || ""), c = String(y.started_at || "");
          return a < c ? -1 : a > c ? 1 : (x.trial_name < y.trial_name ? -1 : 1);
        }).forEach(function (r, i) {
          var vr = r.verifier_result || {}, rw = vr.rewards && typeof vr.rewards === "object" ? vr.rewards : {};
          var reward = rw.reward !== undefined ? rw.reward : vr.reward;
          reward = reward === null || reward === undefined || isNaN(parseFloat(reward)) ? null : parseFloat(reward);
          var exc = r.exception_info, ended = "completed";
          if (exc && typeof exc === "object") ended = exc.exception_type || exc.type || "Exception";
          else if (exc) ended = String(exc).slice(0, 60);
          var ar = r.agent_result || {};
          records.push({ task: t, run: String(i + 1), passed: reward === null ? "" : (reward >= 1 ? "pass" : "fail"),
                         setup: label, ended: ended, cost: ar.cost_usd === null || ar.cost_usd === undefined ? "" : ar.cost_usd });
        });
      });
    });
    var headers = ["task", "run", "passed", "setup", "ended", "cost"];
    var tops = []; order.forEach(function (k) { if (tops.indexOf(byKey[k].top) < 0) tops.push(byKey[k].top); });
    return { name: tops.join(", "), kind: "harbor", headers: headers, records: records,
             map: { task: "task", run: "run", passed: "passed", setup: "setup", ended: "ended", cost: "cost" },
             passKind: { type: "words" }, threshold: 1, normal: ["completed"], setupName: null, unreadable: bad };
  }

  function junitPlan(reports) {
    var batches = [];
    reports.forEach(function (r) { if (batches.indexOf(r.batch) < 0) batches.push(r.batch); });
    function setupOf(b) {
      var k = batches.indexOf(b);
      return batches.length === 1 ? "your tests" : (["before", "after"][k] || "set " + (k + 1));
    }
    // a test is named by its name alone, unless two classes share that name
    var clsOf = {}, clash = {};
    reports.forEach(function (r) { r.cases.forEach(function (c) {
      if (clsOf[c.base] !== undefined && clsOf[c.base] !== c.cls) clash[c.base] = 1; clsOf[c.base] = c.cls; }); });
    var records = [], fileNo = {}, skipped = 0;
    reports.forEach(function (r) {
      fileNo[r.batch] = (fileNo[r.batch] || 0) + 1;
      r.cases.forEach(function (c) {
        if (c.passed === null) { skipped++; return; }          // a skipped test did not run
        records.push({ task: clash[c.base] && c.cls ? c.cls + "::" + c.base : c.base,
                       run: fileNo[r.batch] + (c.repeat ? "." + c.repeat : ""),
                       passed: c.passed, setup: setupOf(r.batch) });
      });
    });
    var headers = ["task", "run", "passed", "setup"];
    return { name: reports.map(function (r) { return r.name; }).join(", "), kind: "junit", headers: headers, records: records,
             map: { task: "task", run: "run", passed: "passed", setup: "setup" },
             passKind: { type: "words" }, threshold: 1, normal: [], setupName: null, skipped: skipped };
  }

  // ── 5. a confirmed plan -> rows ──
  function toRows(state) {
    var rows = [], problems = { noTask: 0, noScore: 0 };
    state.plans.forEach(function (pl) {
      var m = pl.map, counter = {};
      if (!m.task || !m.passed) return;
      var normal = {}; (pl.normal || []).forEach(function (v) { normal[v] = 1; });
      pl.records.forEach(function (r) {
        var task = r[m.task]; task = task === null || task === undefined ? "" : String(task).trim();
        if (!task) { problems.noTask++; return; }
        var setup = m.setup ? String(r[m.setup] === null || r[m.setup] === undefined ? "" : r[m.setup]).trim() || "(blank)"
                            : pl.setupName || "your agent";
        var k = task + "\u0000" + setup;
        counter[k] = (counter[k] || 0) + 1;
        var p = readPass(r[m.passed], pl.passKind, pl.threshold);
        if (p === null) problems.noScore++;
        var endedRaw = m.ended ? r[m.ended] : undefined;
        var ended;
        if (m.ended) {
          var s = endedRaw === null || endedRaw === undefined ? "" : String(endedRaw).trim();
          ended = !s ? (pl.blankIsNormal ? "completed" : null) : normal[s] ? "completed" : s;
        }
        var cost = m.cost ? asNumber(r[m.cost]) : null;
        var row = { task: task, setup: setup, run: m.run ? String(r[m.run]) : String(counter[k]),
                    passed: p === true, reward: p === null ? null : (p ? 1 : 0) };
        if (m.ended) row.ended = ended;
        if (m.cost) row.cost_usd = cost;
        rows.push(row);
      });
    });
    return { rows: rows, problems: problems };
  }

  // ── 6. the confirm sentence ──
  function describe(state, rows) {
    var setups = [], tasks = {}, per = {};
    rows.forEach(function (r) {
      if (setups.indexOf(r.setup) < 0) setups.push(r.setup);
      tasks[r.task] = 1;
      var k = r.task + "\u0000" + r.setup; per[k] = (per[k] || 0) + 1;
    });
    var counts = Object.keys(per).map(function (k) { return per[k]; });
    var min = Math.min.apply(null, counts), max = Math.max.apply(null, counts);
    var pl = state.plans[0], m = pl.map;
    var runsText = !counts.length ? "no runs" : min === max ? min + " run" + (min === 1 ? "" : "s") + " each" : min + " to " + max + " runs each";
    var passText = "passed taken from “" + m.passed + "”" +
      (pl.passKind && pl.passKind.type === "score" ? " (a score from " + pl.passKind.min + " to " + pl.passKind.max + "; " + pl.threshold + " or more counts as a pass)" : "");
    return {
      tasks: Object.keys(tasks).length, setups: setups, minRuns: min, maxRuns: max,
      text: "We read " + Object.keys(tasks).length + " tasks, " + runsText + ", " +
            (setups.length === 1 ? "one setup" : setups.length + " setups (" + setups.join(", ") + ")") + ", " + passText + "."
    };
  }

  var api = { parse: parse, read: read, toRows: toRows, describe: describe, guess: guess, passKind: passKind,
              readPass: readPass, distinct: distinct, version: "0.2.0" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CheckAgainReader = api;
})(this);
