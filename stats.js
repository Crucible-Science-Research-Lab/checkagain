/* CheckAgain: the arithmetic, and nothing else (no page code).
 *
 * Input: rows, one per run: { task, setup, run, passed, reward?, ended?, cost_usd? }
 *   passed   true / false (a run with no score: passed false and reward null)
 *   ended    "completed" when the run stopped by itself; otherwise how it ended
 *   cost_usd recorded cost of the run; estimated figures are never mixed in
 * Output: analyse(rows) -> overview, bands, moves, per-task tests (Fisher), the whole
 *   change (sign test over the tasks that moved), endings, cost, verdict.
 * Works in the browser (window.CheckAgainStats) and in Node (require).
 * MIT licence. Part of CheckAgain, by Crucible Science.
 */
(function (root) {
  "use strict";

  var CLEAR_BELOW = 0.05;            // two-sided Fisher's exact test
  var BANDS = ["every", "sometimes", "never"];

  // ── Fisher's exact test, two-sided, for passes a of n1 against b of n2 ──
  var logFactCache = [0];
  function logFact(n) {
    for (var i = logFactCache.length; i <= n; i++) logFactCache[i] = logFactCache[i - 1] + Math.log(i);
    return logFactCache[n];
  }
  function logChoose(n, k) { return logFact(n) - logFact(k) - logFact(n - k); }

  function fisher(a, n1, b, n2) {
    var K = a + b, N = n1 + n2;
    var lo = Math.max(0, K - n2), hi = Math.min(K, n1);
    var denom = logChoose(N, n1);
    function prob(x) { return Math.exp(logChoose(K, x) + logChoose(N - K, n1 - x) - denom); }
    var observed = prob(a), p = 0;
    for (var x = lo; x <= hi; x++) {
      var px = prob(x);
      if (px <= observed * (1 + 1e-7)) p += px;   // same tolerance as SciPy
    }
    return Math.min(1, p);
  }

  // ── sign test, two-sided: of n tasks that moved, k moved the less common way ──
  // One test for the whole change, so testing many tasks at once does not inflate it.
  function signTest(down, up) {
    var n = down + up, k = Math.min(down, up), p = 0;
    if (n === 0) return 1;
    for (var x = 0; x <= k; x++) p += Math.exp(logChoose(n, x) - n * Math.LN2);
    return Math.min(1, 2 * p);
  }

  // natural order for task names: "2" before "10", "task-9" before "task-10"
  var collator = (typeof Intl !== "undefined" && Intl.Collator) ? new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }) : null;
  function cmp(a, b) { return collator ? collator.compare(String(a), String(b)) : (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0); }

  function band(passes, runs) {
    return passes === runs ? "every" : passes === 0 ? "never" : "sometimes";
  }

  function isScored(r) {
    if (r.passed === null || r.passed === undefined) return false;
    return !(Object.prototype.hasOwnProperty.call(r, "reward") && r.reward === null);
  }

  // ── one setup ──
  function summarise(rows) {
    var tasks = {}, runs = rows.length, scored = 0, passed = 0;
    var withEnding = 0, stopped = 0, stoppedFailed = 0;
    var costRuns = 0, costTotal = 0, costPasses = 0;
    rows.forEach(function (r) {
      var ok = r.passed === true;
      if (!tasks[r.task]) tasks[r.task] = { passes: 0, runs: 0, passCosts: [], failCost: 0 };
      tasks[r.task].runs += 1;
      if (ok) { tasks[r.task].passes += 1; passed += 1; }
      if (isScored(r)) scored += 1;
      if (r.ended !== undefined && r.ended !== null && r.ended !== "") {
        withEnding += 1;
        if (r.ended === "completed") { stopped += 1; if (!ok) stoppedFailed += 1; }
      }
      if (typeof r.cost_usd === "number" && isFinite(r.cost_usd)) {
        costRuns += 1; costTotal += r.cost_usd; if (ok) costPasses += 1;
        if (ok) tasks[r.task].passCosts.push(r.cost_usd); else tasks[r.task].failCost += r.cost_usd;
      }
    });
    var bands = { every: [], sometimes: [], never: [] };
    Object.keys(tasks).sort(cmp).forEach(function (t) {
      tasks[t].band = band(tasks[t].passes, tasks[t].runs);
      bands[tasks[t].band].push(t);
    });
    // path of least tokens, from recorded cost: per task, the cheapest, typical (median) and
    // dearest passing run; a task "could cost half" when its typical pass costs at least twice its cheapest
    var paths = [], failSpend = 0;
    Object.keys(tasks).sort(cmp).forEach(function (t) {
      var T = tasks[t], c = T.passCosts.slice().sort(function (a, b) { return a - b; });
      failSpend += T.failCost;
      if (c.length >= 2 && c[0] > 0) {
        var mid = c.length % 2 ? c[(c.length - 1) / 2] : (c[c.length / 2 - 1] + c[c.length / 2]) / 2;
        paths.push({ task: t, passes: c.length, runs: T.runs, band: T.band, cheapest: c[0], typical: mid,
                     dearest: c[c.length - 1], ratio: mid / c[0] });
      }
    });
    paths.sort(function (a, b) { return b.ratio - a.ratio || cmp(a.task, b.task); });
    var perTask = {};
    Object.keys(tasks).forEach(function (t) { perTask[tasks[t].runs] = (perTask[tasks[t].runs] || 0) + 1; });
    return {
      runs: runs, scored: scored, passed: passed,
      rateAll: runs ? passed / runs : null,
      rateScored: scored ? passed / scored : null,
      tasks: tasks, taskCount: Object.keys(tasks).length, runsPerTask: perTask,
      bands: bands,
      endings: withEnding ? { known: withEnding, stopped: stopped, stoppedFailed: stoppedFailed,
                              rate: stopped ? stoppedFailed / stopped : null } : null,
      cost: costRuns ? { runs: costRuns, total: costTotal, perRun: costTotal / costRuns,
                         passes: costPasses, perPass: costPasses ? costTotal / costPasses : null,
                         complete: costRuns === runs } : null,
      paths: costRuns ? { tasks: paths, compared: paths.length,
                          couldHalve: paths.filter(function (p) { return p.ratio >= 2; }).length,
                          couldHalveDependable: paths.filter(function (p) { return p.ratio >= 2 && p.band === "every"; }).length,
                          failSpend: failSpend, failShare: costTotal ? failSpend / costTotal : null } : null
    };
  }

  // ── before and after ──
  function analyse(rows, opts) {
    opts = opts || {};
    var order = [];
    rows.forEach(function (r) { if (order.indexOf(r.setup) < 0) order.push(r.setup); });
    var before = opts.before || order[0], after = opts.after || order[1];
    var bySetup = {};
    order.forEach(function (s) {
      bySetup[s] = summarise(rows.filter(function (r) { return r.setup === s; }));
    });
    var out = { setups: order, before: before, after: after, bySetup: bySetup, compare: null };
    if (after === undefined) return out;            // one setup: no comparison

    var A = bySetup[before].tasks, B = bySetup[after].tasks;
    var both = Object.keys(A).filter(function (t) { return B[t]; }).sort(cmp);
    var matrix = {};
    BANDS.forEach(function (x) { matrix[x] = {}; BANDS.forEach(function (y) { matrix[x][y] = []; }); });
    var tasks = both.map(function (t) {
      var a = A[t], b = B[t];
      var p = fisher(a.passes, a.runs, b.passes, b.runs);
      var ra = a.passes / a.runs, rb = b.passes / b.runs;
      matrix[a.band][b.band].push(t);
      return {
        task: t, before: { passes: a.passes, runs: a.runs, band: a.band },
        after: { passes: b.passes, runs: b.runs, band: b.band },
        p: p, direction: rb < ra ? "worse" : rb > ra ? "better" : "same",
        reading: ra === rb ? "same" : p < CLEAR_BELOW ? "clear change" : "not clear yet"
      };
    });
    function pick(dir, reading) {
      return tasks.filter(function (x) { return x.direction === dir && x.reading === reading; });
    }
    var clearWorse = pick("worse", "clear change"), clearBetter = pick("better", "clear change");
    var unclearWorse = pick("worse", "not clear yet"), unclearBetter = pick("better", "not clear yet");
    var everyBefore = matrix.every.every.length + matrix.every.sometimes.length + matrix.every.never.length;
    var down = tasks.filter(function (x) { return x.direction === "worse"; }).length;
    var up = tasks.filter(function (x) { return x.direction === "better"; }).length;
    var pAll = signTest(down, up);
    var overall = {
      moved: down + up, down: down, up: up, p: pAll,
      reading: down + up === 0 ? "no change" : pAll >= CLEAR_BELOW ? "not clear yet"
             : down > up ? "clearly worse" : "clearly better"
    };
    out.compare = {
      tasksInBoth: both.length,
      onlyBefore: Object.keys(A).filter(function (t) { return !B[t]; }).sort(cmp),
      onlyAfter: Object.keys(B).filter(function (t) { return !A[t]; }).sort(cmp),
      matrix: matrix, tasks: tasks, overall: overall,
      verdict: {
        clearWorse: clearWorse.length, clearBetter: clearBetter.length,
        notClearYet: unclearWorse.length + unclearBetter.length,
        notClearWorse: unclearWorse.length, notClearBetter: unclearBetter.length,
        same: tasks.filter(function (x) { return x.reading === "same"; }).length,
        everyBefore: everyBefore, heldEvery: matrix.every.every.length,
        dependableLost: matrix.every.never.slice()
      }
    };
    return out;
  }

  var api = { analyse: analyse, summarise: summarise, fisher: fisher, signTest: signTest,
              band: band, cmp: cmp, CLEAR_BELOW: CLEAR_BELOW, version: "0.3.0" };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CheckAgainStats = api;
})(this);
