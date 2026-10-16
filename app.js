/* CheckAgain: the page. Slide 1 plays the illustration; slide 2 reads the visitor's results;
 * slide 3 shows the reading (the real example until a file is read).
 * Every number in a reading comes from stats.js; nothing here is typed by hand.
 * Text from a user's file is always set with textContent, so nothing in it can run as code.
 * Nothing is sent anywhere, except the email typed into the ask form, and only when its button is pressed.
 * The browser may remember column choices (localStorage), nothing else.
 * MIT licence. Part of CheckAgain, by Crucible Science.
 */

// ════ Slide 1: the illustration. Four everyday agents, one task each, five runs each. ════
(function () {
  "use strict";
  var svg = document.getElementById("tree");
  if (!svg) return;
  // Illustrative agents. Steps are columns in order; each run is a path through them.
  var AGENTS = [
    { name: "Refund agent", ask: "Refund my order #4417",
      nodes: { a: [0, 1, "Read request"], b: [1, 1, "Look up order"], c: [2, 0, "Check refund policy"], d: [2, 2, "Ask for a photo"],
               e: [3, 1, "Issue refund"], f: [4, 1, "Confirm to customer"] },
      runs: [["abcef", true], ["abcef", true], ["abef", false, "refunded without checking the policy"], ["abcef", true], ["abdf", false, "never issued the refund"]] },
    { name: "Flight booking agent", ask: "Cheapest flight Pune → Delhi on Friday",
      nodes: { a: [0, 1, "Read request"], b: [1, 1, "Search flights"], c: [2, 0, "Compare fares"], d: [2, 2, "Check baggage rules"],
               e: [3, 1, "Book seat"], f: [4, 1, "Send ticket"] },
      runs: [["abcef", true], ["abef", false, "booked the first result, not the cheapest"], ["abdef", false, "booked without comparing fares"], ["abcef", true], ["abef", false, "booked the first result, not the cheapest"]] },
    { name: "Coding agent", ask: "Fix the failing date test",
      nodes: { a: [0, 1, "Read the test"], b: [1, 1, "Find the bug"], c: [2, 0, "Edit the code"], d: [2, 2, "Edit the test"],
               e: [3, 1, "Run the tests"], f: [4, 1, "Open a pull request"] },
      runs: [["abcef", true], ["abcef", true], ["abcef", true], ["abcef", true], ["abcef", true]] },
    { name: "Appointment booker", ask: "A dentist slot next Tuesday morning",
      nodes: { a: [0, 1, "Read request"], b: [1, 1, "Check calendar"], c: [2, 0, "Find free slot"], d: [2, 2, "Ask a follow-up"],
               e: [3, 1, "Book slot"], f: [4, 1, "Send reminder"] },
      runs: [["abcef", true], ["abdcef", true], ["abef", false, "booked a slot that was already taken"], ["abcef", true], ["abcef", true]] }
  ];
  // The first agent plays slowly so the idea lands; the rest play faster so the board fills in about 35 seconds.
  var SLOW = { travel: 1300, hold: 350, drop: 550, gap: 500, after: 1600 };
  var FAST = { travel: 650, hold: 150, drop: 420, gap: 200, after: 900 };

  var NS = "http://www.w3.org/2000/svg";
  var outcomeEl = document.getElementById("outcome"), boardEl = document.getElementById("board"), ctl = document.getElementById("ctl");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var narrowMQ = window.matchMedia("(max-width: 640px)");
  var L, current = 0, done = [false, false, false, false], mode = "playing", paused = false;

  // one clock for every movement, so Pause freezes everything and a new choice cancels the old one
  var gen = 0, anims = [], lastTs = null, flyers = [];
  function loop(ts) {
    var dt = lastTs == null ? 0 : Math.min(50, ts - lastTs); lastTs = ts;
    anims.slice().forEach(function (a) {
      if (a.g !== gen) { anims.splice(anims.indexOf(a), 1); a.res(false); return; }
      if (paused) return;
      a.el += dt; var t = Math.min(1, a.el / a.d);
      if (a.fn) a.fn(t);
      if (t >= 1) { anims.splice(anims.indexOf(a), 1); a.res(true); }
    });
    requestAnimationFrame(loop);
  }
  function anim(d, fn) { var g = gen; return new Promise(function (res) { anims.push({ g: g, d: Math.max(1, d), el: 0, fn: fn, res: res }); }); }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function layout() {
    L = narrowMQ.matches
      ? { box: "0 0 360 376", step: [36, 112, 188, 264, 340], lane: [92, 180, 268], vertical: true }
      : { box: "0 0 760 210", step: [75, 225, 385, 540, 678], lane: [40, 105, 170], vertical: false };
    svg.setAttribute("viewBox", L.box);
  }
  function pos(A, id) { var n = A.nodes[id]; return L.vertical ? [L.lane[n[1]], L.step[n[0]]] : [L.step[n[0]], L.lane[n[1]]]; }
  function pathD(A, ids) {
    return ids.split("").map(function (id, i) { var p = pos(A, id); return (i ? "L" : "M") + p[0] + " " + p[1]; }).join(" ");
  }
  function bandOf(p, n) {
    return p === n ? ["every", "Every time", "You can count on this one."] :
           p === 0 ? ["never", "Never", "It fails every time."] :
                     ["some", "Sometimes", "It passed once; it won’t always pass again."];
  }

  // the board
  AGENTS.forEach(function (A, i) {
    var row = document.createElement("button");
    row.type = "button"; row.className = "row todo"; row.style.setProperty("--ac", "var(--w" + (i + 1) + ")"); row.setAttribute("aria-label", A.name + ": watch it again");
    row.innerHTML = '<span class="who"><b></b><span></span></span><span class="slots"></span><span class="band"></span>';
    row.querySelector("b").textContent = A.name;
    row.querySelector(".who span").textContent = A.ask;
    for (var k = 0; k < A.runs.length; k++) row.querySelector(".slots").appendChild(document.createElement("i")).className = "slot";
    row.onclick = function () { reduce ? showStatic(i) : play(i, false); };
    boardEl.appendChild(row);
  });
  function rowEl(i) { return boardEl.children[i]; }
  function slots(i) { return rowEl(i).querySelectorAll(".slot"); }
  function resetRow(i) {
    done[i] = false;
    var r = rowEl(i); r.classList.add("todo"); r.querySelector(".band").textContent = "";
    Array.prototype.forEach.call(slots(i), function (s) { s.className = "slot"; });
  }
  function markPlaying(i) {
    Array.prototype.forEach.call(boardEl.children, function (r, k) { r.classList.toggle("playing", k === i); });
    if (i >= 0) rowEl(i).classList.remove("todo");
  }
  function finishRow(i) {
    var A = AGENTS[i], p = A.runs.filter(function (r) { return r[1]; }).length, b = bandOf(p, A.runs.length);
    rowEl(i).querySelector(".band").innerHTML = p + " of " + A.runs.length + ' · <span class="' + b[0] + '">' + b[1] + "</span>";
    done[i] = true;
    return [p, b];
  }

  // the tree
  function drawAgent(i) {
    var A = AGENTS[i];
    document.getElementById("agent").textContent = A.name;
    document.getElementById("agent").style.setProperty("--ac", "var(--w" + (i + 1) + ")");
    document.getElementById("ask").textContent = "“" + A.ask + "”";
    svg.textContent = "";
    var seen = {};
    A.runs.forEach(function (r) {
      for (var k = 1; k < r[0].length; k++) {
        var key = r[0][k - 1] + r[0][k]; if (seen[key]) continue; seen[key] = 1;
        var p = pos(A, r[0][k - 1]), q = pos(A, r[0][k]);
        mk("line", { x1: p[0], y1: p[1], x2: q[0], y2: q[1], "class": "edge" }, svg);
      }
    });
    mk("g", { id: "trails" }, svg);
    mk("g", { id: "livelayer" }, svg);
    Object.keys(A.nodes).forEach(function (id) {
      var p = pos(A, id), label = A.nodes[id][2], w = label.length * 7.2 + 18;
      var g = mk("g", { "class": "node", id: "n-" + id }, svg);
      mk("rect", { x: p[0] - w / 2, y: p[1] - 14, width: w, height: 28, rx: 14 }, g);
      var t = mk("text", { x: p[0], y: p[1] + 4, "text-anchor": "middle" }, g); t.textContent = label;
    });
    var dg = mk("g", { id: "dotlayer", opacity: 0 }, svg);   // the nav dot rides above everything
    mk("circle", { id: "ring", r: 9, "class": "navring" }, dg);
    mk("circle", { id: "dot", r: 3.8, "class": "navdot" }, dg);
  }
  function addTrail(A, r) {
    mk("path", { d: pathD(A, r[0]), "class": "trail", stroke: r[1] ? "var(--pass)" : "var(--fail)" }, document.getElementById("trails"));
  }
  function placeDot(x, y, show) {
    var dg = document.getElementById("dotlayer");
    document.getElementById("dot").setAttribute("cx", x); document.getElementById("dot").setAttribute("cy", y);
    document.getElementById("ring").setAttribute("cx", x); document.getElementById("ring").setAttribute("cy", y);
    dg.setAttribute("opacity", show ? 1 : 0);
  }

  // one run: the dot travels, the run ends, the dot drops into its slot
  async function playRun(i, k, pace) {
    var A = AGENTS[i], r = A.runs[k], ids = r[0].split("");
    Array.prototype.forEach.call(svg.querySelectorAll(".node"), function (n) { n.classList.remove("on", "ok", "bad"); });
    var sl = slots(i); sl[k].classList.add("now");
    outcomeEl.textContent = "Run " + (k + 1) + " of " + A.runs.length;
    var layer = document.getElementById("livelayer"); layer.textContent = "";
    var live = mk("path", { d: pathD(A, r[0]), "class": "live" }, layer);
    var len = live.getTotalLength(); live.style.strokeDasharray = len; live.style.strokeDashoffset = len;
    var at = [0];   // distance along the path at which each step is reached
    for (var j = 1; j < ids.length; j++) { var p = pos(A, ids[j - 1]), q = pos(A, ids[j]); at.push(at[j - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    var start = pos(A, ids[0]); placeDot(start[0], start[1], true);
    var ok = await anim(pace.travel, function (t) {
      var d = ease(t) * len, pt = live.getPointAtLength(d);
      live.style.strokeDashoffset = len - d; placeDot(pt.x, pt.y, true);
      ids.forEach(function (id, j) { if (at[j] <= d + 1) document.getElementById("n-" + id).classList.add("on"); });
    });
    if (!ok) return false;
    document.getElementById("n-" + ids[ids.length - 1]).classList.add(r[1] ? "ok" : "bad");
    outcomeEl.innerHTML = r[1] ? '<span class="ok">Run ' + (k + 1) + " passed</span>"
                               : '<span class="bad">Run ' + (k + 1) + " failed:</span> " + r[2];
    if (!(await anim(pace.hold))) return false;
    if (!(await drop(document.getElementById("dot"), sl[k], r[1], pace.drop))) return false;
    addTrail(A, r); layer.textContent = "";
    sl[k].classList.remove("now"); sl[k].classList.add(r[1] ? "pass" : "fail", "land");
    return anim(pace.gap);
  }
  async function drop(fromEl, slot, passed, d) {
    var a = fromEl.getBoundingClientRect(), b = slot.getBoundingClientRect();
    var x0 = a.left + a.width / 2 + scrollX, y0 = a.top + a.height / 2 + scrollY,
        x1 = b.left + b.width / 2 + scrollX, y1 = b.top + b.height / 2 + scrollY;
    var s0 = Math.max(7, a.width), to = passed ? "var(--pass)" : "var(--fail)";
    var f = document.body.appendChild(document.createElement("div")); f.className = "flyer"; flyers.push(f);
    document.getElementById("dotlayer").setAttribute("opacity", 0);
    var ok = await anim(d, function (t) {
      var e = ease(t), s = s0 + (14 - s0) * t;
      f.style.left = (x0 + (x1 - x0) * e) + "px";
      f.style.top = (y0 + (y1 - y0) * t * t) + "px";   // falls: slow at first, faster as it lands
      f.style.width = f.style.height = s + "px";
      f.style.background = "color-mix(in srgb, var(--orange) " + Math.round(100 - 100 * t) + "%, " + to + ")";
    });
    f.remove(); flyers.splice(flyers.indexOf(f), 1);
    return ok;
  }

  async function playAgent(i, pace) {
    current = i; resetRow(i); markPlaying(i); drawAgent(i);
    for (var k = 0; k < AGENTS[i].runs.length; k++) { if (!(await playRun(i, k, pace))) return false; }
    var res = finishRow(i);
    outcomeEl.innerHTML = res[0] + " of " + AGENTS[i].runs.length + ' passed. <span class="' + res[1][0] + '">' + res[1][1] + ".</span> " + res[1][2];
    return anim(pace.after);
  }

  // Play agent i, then whichever agents are still empty, in order; stop on the finished board.
  async function play(i, intro) {
    gen++; paused = false; mode = "playing"; ctl.textContent = "Pause";
    flyers.forEach(function (f) { f.remove(); }); flyers = [];
    done.forEach(function (d, k) { if (!d) resetRow(k); });
    if (intro) {   // like the site's nav dot: a few quick blinks before it sets off
      drawAgent(i); markPlaying(i); var s = pos(AGENTS[i], AGENTS[i].runs[0][0][0]);
      var ok = await anim(1300, function (t) { placeDot(s[0], s[1], Math.floor(t * 6) % 2 === 0); });
      if (!ok) return;
    }
    var pace = SLOW;
    while (i !== -1) {
      if (!(await playAgent(i, pace))) return;
      pace = FAST; i = done.indexOf(false);
    }
    endState();
  }
  function endState() {
    mode = "ended"; markPlaying(-1); ctl.textContent = "Play again";
    outcomeEl.textContent = "Four agents, five runs each. CheckAgain gives you this reading for every task in your results.";
  }

  ctl.onclick = function () {
    if (mode === "ended") { done = [false, false, false, false]; play(0, false); return; }
    paused = !paused; ctl.textContent = paused ? "Play" : "Pause";
  };

  // no motion: show the finished board; a click shows that agent's five paths at once
  function showStatic(i) {
    current = i; drawAgent(i); markPlaying(i);
    AGENTS.forEach(function (A, k) {
      Array.prototype.forEach.call(slots(k), function (s, j) { s.className = "slot " + (A.runs[j][1] ? "pass" : "fail"); });
      rowEl(k).classList.remove("todo"); finishRow(k);
    });
    AGENTS[i].runs.forEach(function (r) { addTrail(AGENTS[i], r); });
    var res = finishRow(i);
    outcomeEl.innerHTML = res[0] + " of 5 passed. " + res[1][2];
  }

  layout();
  narrowMQ.addEventListener("change", function () {   // screen turned or resized: start this agent again
    layout(); if (reduce) showStatic(current); else if (mode === "ended") { drawAgent(current); AGENTS[current].runs.forEach(function (r) { addTrail(AGENTS[current], r); }); } else play(current, false);
  });
  if (reduce) { ctl.hidden = true; showStatic(0); }
  else { requestAnimationFrame(loop); play(0, true); }
})();

// ════ Slides 2 and 3: the visitor's results, and the reading ════
(function () {
  "use strict";
  var S = window.CheckAgainStats, R = window.CheckAgainReader;
  var DEMO = "demo/note2-opus-deepseek.json";
  // Where the reading request goes (Formspree). Empty: the visitor's own email app opens with the request written.
  var FORM_ENDPOINT = "https://formspree.io/f/mzedjwvo";
  var CONTACT = "ashwin@cruciblescience.com";
  var demoCache = null, lastReading = null, reportMode = false;

  // ── tiny helpers ──
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function add(parent) { for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
  function txt(s) { return document.createTextNode(s); }
  function pct(x) { return Math.round(100 * x) + "%"; }
  function pct1(x) { return (100 * x).toFixed(1) + "%"; }
  function money(x) { return "$" + (x < 0.1 ? x.toFixed(x < 0.01 ? 3 : 2) : x.toFixed(2)); }
  function pval(p) { return p < 0.001 ? "< 0.001" : p.toFixed(3); }
  function words(n) { return ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][n] || String(n); }
  function Cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function odds(p) {   // "about once in 6,000"
    if (p >= 0.5) return "more often than not";
    var n = 1 / p, mag = Math.pow(10, Math.floor(Math.log10(n))), r = Math.round(n / mag) * mag;
    if (r >= 1e6) return "less than once in a million";
    return "about once in " + r.toLocaleString("en-US");
  }
  function runsPerTaskText(sum) {
    var keys = Object.keys(sum.runsPerTask);
    return keys.length === 1 ? words(+keys[0]) + " run" + (keys[0] === "1" ? "" : "s") + " each" : "uneven runs per task";
  }
  function shortName(setup) {   // "Claude Opus 4.6" -> "Opus", "DeepSeek V3.2" -> "DeepSeek"
    var w = String(setup).split(/\s+/);
    if (w.length > 1 && /^(claude|gpt|gemini|meta|llama)$/i.test(w[0])) return w[1];
    return w.length > 1 && /\d/.test(w[w.length - 1]) ? w.slice(0, -1).join(" ") : String(setup);
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function isOneRun(A) { return Object.keys(A.runsPerTask).length === 1 && !!A.runsPerTask[1]; }

  // ── pieces of a reading ──
  function tile(label, from, to, cls, note) {
    var v = el("span", "val");
    if (from != null) add(v, el("span", "from", from), el("span", "arrow", "→"));
    add(v, el("span", cls || "", to));
    return add(el("div", "tile"), el("span", "what", label), v, note ? el("span", "note", note) : null);
  }
  function dir(a, b, higherIsBetter) { return a === b ? "" : (b > a) === higherIsBetter ? "better" : "worse"; }
  function dots(passes, runs, what) {
    var d = el("span", "tdots");
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", what + ": " + passes + " of " + runs + " passed");
    for (var i = 0; i < runs; i++) add(d, el("i", i < passes ? "pass" : "fail"));
    return d;
  }
  function legend() {
    function key(colour, label) { var s = el("span"), i = el("i"); i.style.background = colour; return add(s, i, txt(label)); }
    return add(el("div", "tlegend"), el("span", "", "each dot is one run"), key("var(--pass)", "passed"), key("var(--fail)", "failed"));
  }
  function group(title, k, hint, list, open, firstN, row) {
    if (!list.length) return null;
    var g = el("details", "tgroup " + k); if (open) g.open = true;
    add(g, add(el("summary"), el("span", "gname", title), el("span", "gcount", String(list.length)), el("span", "ghint", hint)));
    var shown = !reportMode && firstN && list.length > firstN + 2 ? firstN : list.length;
    list.slice(0, shown).forEach(function (t) { add(g, row(t)); });
    if (shown < list.length) {
      var b = el("button", "more", "Show all " + list.length); b.type = "button";
      b.onclick = function () { list.slice(shown).forEach(function (t) { g.insertBefore(row(t), b); }); b.remove(); };
      add(g, b);
    }
    return g;
  }
  function tilesOf(list) {
    var t = el("div", "tiles" + (list.length < 4 ? " n" + list.length : ""));
    list.forEach(function (x) { add(t, x); });
    return t;
  }

  // ── a before and after ──
  function readingTwo(res, notes) {
    var c = res.compare, v = c.verdict, o = c.overall;
    var A = res.bySetup[res.before], B = res.bySetup[res.after];
    var plain = res.before === "before" && res.after === "after";   // test reports dropped in two batches
    var nb = plain ? "before" : shortName(res.before), na = plain ? "after" : shortName(res.after);
    var out = [];
    var cls = o.reading === "clearly worse" ? "worse" : o.reading === "clearly better" ? "better" : "";
    var lead = { "clearly worse": "It got clearly worse.", "clearly better": "It got clearly better.",
                 "not clear yet": "Results moved, but these runs can’t tell yet whether it got better or worse.",
                 "no change": "Every task passed as often as before." }[o.reading];
    out.push(el("span", "badge " + cls, o.reading), el("h3", "r-lead", lead));
    if (o.moved) {
      out.push(el("p", "r-sub", (plain ? "After the change" : "After switching from " + res.before + " to " + res.after) +
        ": of " + o.moved + " tasks whose results moved, " + (o.down || "none") + " moved down and " + (o.up || "none") + " up" +
        (o.reading === "not clear yet" ? ", close enough to even that it could be ordinary variation between runs." : ". If nothing had changed, a split like this would turn up " + odds(o.p) + ".")));
    }
    (notes || []).forEach(function (n) { out.push(el("p", "r-note", n)); });

    // four numbers, status-page style
    var t = [tile("Pass rate", pct1(A.rateAll), pct1(B.rateAll), dir(A.rateAll, B.rateAll, true))];
    if (v.everyBefore) t.push(tile("Dependable tasks held", null, v.heldEvery + " of " + v.everyBefore,
        v.heldEvery < v.everyBefore ? "worse" : "", "passed every time " + (plain ? "before; still did after" : "on " + nb + "; still did on " + na)));
    if (A.endings && B.endings && A.endings.stopped && B.endings.stopped)
      t.push(tile("Stopped by itself, but wrong", pct(A.endings.rate), pct(B.endings.rate), dir(A.endings.rate, B.endings.rate, false)));
    if (A.cost && B.cost && A.cost.perPass && B.cost.perPass)
      t.push(tile("Cost per finished task", money(A.cost.perPass), money(B.cost.perPass), dir(A.cost.perPass, B.cost.perPass, false), "as recorded; failed runs count"));
    out.push(tilesOf(t));

    // the board: one row per task, the same five dots as the illustration
    var lost = {}; v.dependableLost.forEach(function (x) { lost[x] = true; });
    function drop(x) { return x.before.passes / x.before.runs - x.after.passes / x.after.runs; }
    function row(x) {
      var name = el("span", "name", x.task); name.title = x.task;
      if (lost[x.task]) add(name, el("span", "flag", "every time → never"));
      return add(el("div", "trow"), name, dots(x.before.passes, x.before.runs, nb), el("span", "arr", "→"),
                 dots(x.after.passes, x.after.runs, na), el("span", "p", x.reading === "same" ? "" : "p " + pval(x.p)));
    }
    function by(f) { return c.tasks.filter(f).sort(function (x, y) { return x.p - y.p || drop(y) - drop(x) || S.cmp(x.task, y.task); }); }
    var clearW = by(function (x) { return x.reading === "clear change" && x.direction === "worse"; });
    var clearB = by(function (x) { return x.reading === "clear change" && x.direction === "better"; });
    var unclear = c.tasks.filter(function (x) { return x.reading === "not clear yet"; })
                         .sort(function (x, y) { return drop(y) - drop(x) || x.p - y.p || S.cmp(x.task, y.task); });
    var same = c.tasks.filter(function (x) { return x.reading === "same"; })
                      .sort(function (x, y) { return y.before.passes / y.before.runs - x.before.passes / x.before.runs || S.cmp(x.task, y.task); });
    var board = el("div", "tboard");
    add(board, legend(), add(el("div", "trow head"), el("span", "", "task"), el("span", "", nb), el("span"), el("span", "", na), el("span")));
    add(board, group("Clearly worse", "worse", "clear on its own: too big to be noise", clearW, true, 0, row),
               group("Clearly better", "better", "clear on its own", clearB, true, 0, row),
               group("Not clear yet", "", "moved, but these runs can’t tell this apart from noise; more runs would", unclear, !clearW.length && !clearB.length, 6, row),
               group("Same", "", "passed as often after as before", same, false, 0, row));
    out.push(board);
    return out;
  }

  // ── one setup: several runs per task, or one run per task ──
  function readingOne(res, notes) {
    var name = res.setups[0], A = res.bySetup[name], n = A.taskCount;
    var every = A.bands.every.length, some = A.bands.sometimes.length, never = A.bands.never.length;
    var one = isOneRun(A), out = [];
    if (one) {
      out.push(el("span", "badge", "one run per task"),
               el("h3", "r-lead", "With one run per task, every task looks as if it passes every time or never."),
               el("p", "r-sub", "Here " + every + " of " + n + " passed and " + never + " failed, a pass rate of " + pct1(A.rateAll) +
                  ". One run can’t show which of them would pass again: a task that passes 3 times in 5 looks the same as one that never fails."),
               el("p", "r-sub", "Run each task five times and read it again. Most eval tools have a setting for this, usually called repeat, repetitions, epochs or attempts."));
    } else {
      var more = [];
      if (some) more.push("The pass rate of " + pct1(A.rateAll) + " hides that " + some + " task" + (some === 1 ? "" : "s") +
                          " can go either way: " + (some === 1 ? "it" : "they") + " passed on some runs and failed on others.");
      if (A.endings && A.endings.stopped) more.push("When a run stopped by itself, it was wrong " + pct(A.endings.rate) + " of the time.");
      if (A.cost && A.cost.complete && A.cost.perPass) more.push("A finished task cost " + money(A.cost.perPass) + "; a single run " + money(A.cost.perRun) + ", as recorded.");
      out.push(el("span", "badge", some + " of " + n + " tasks can go either way"),
               el("h3", "r-lead", every + " of " + n + " tasks passed every time; " + (some ? some + " passed only sometimes" : "none passed only sometimes") +
                  " and " + (never ? never + " never passed" : "none failed every time") + "."));
      if (more.length) out.push(el("p", "r-sub", more.join(" ")));
      out.push(el("p", "r-sub", "To see what a change did, add your results from after it to the box."));
    }
    (notes || []).forEach(function (x) { out.push(el("p", "r-note", x)); });

    function rate(x) { return A.tasks[x].passes / A.tasks[x].runs; }
    function row(x) {
      var T = A.tasks[x], nm = el("span", "name", x); nm.title = x;
      return add(el("div", "trow one"), nm, dots(T.passes, T.runs, "runs"), el("span", "p", T.passes + "/" + T.runs));
    }
    var board = el("div", "tboard");
    add(board, legend(), add(el("div", "trow one head"), el("span", "", "task"), el("span", "", shortName(name)), el("span")));
    if (one) {
      add(board, group("Failed", "worse", "failed its one run", A.bands.never, true, 12, row),
                 group("Passed", "better", "passed its one run", A.bands.every, !never, 12, row));
    } else {
      add(board, group("Sometimes", "", "passed on some runs and failed on others",
                       A.bands.sometimes.slice().sort(function (x, y) { return rate(x) - rate(y) || S.cmp(x, y); }), true, 8, row),
                 group("Never", "worse", "failed every run", A.bands.never, !some, 8, row),
                 group("Every time", "better", "passed every run", A.bands.every, false, 8, row));
    }
    out.push(board);
    return out;
  }

  // ── the details ──
  function table(head, rows) {   // rows: [label, cell, cell...]; a cell is a string or {t, cls}
    var t = el("table"), th = el("thead"), tr = el("tr");
    head.forEach(function (h) { add(tr, el("th", "", h)); });
    add(t, add(th, tr));
    var tb = el("tbody");
    rows.forEach(function (r) {
      var row = el("tr", r.key ? "key" : "");
      (r.cells || r).forEach(function (cell) {
        if (cell && typeof cell === "object") add(row, el("td", cell.cls || "", cell.t));
        else add(row, el("td", "", cell));
      });
      add(tb, row);
    });
    return add(el("div", "scroll"), add(t, tb));
  }
  function key(cells) { return { key: true, cells: cells }; }
  function moved(before, after, higherIsBetter) {   // colour the after-cell by direction
    return before === after ? "" : (after > before) === higherIsBetter ? "better" : "worse";
  }
  function take(label, from, to, cls) {   // "Pass rate  75.4% → 46.9%"
    return add(el("p", "take"), el("span", "what", label), el("span", "from", from), el("span", "arrow", "→"),
               el("span", "to " + (cls || ""), to));
  }
  function panel(title, takeaway, tbl, note) {
    return add(el("div", "panel"), el("h3", "", title), takeaway, tbl, note ? el("p", "note", note) : null);
  }
  function details(res) {
    var c = res.compare, A = res.bySetup[res.before], B = res.bySetup[res.after];
    var a = shortName(res.before), b = shortName(res.after);
    var body = el("div"), grid = el("div", "grid");

    add(grid, panel("Overview",
      take("Pass rate", pct1(A.rateAll), pct1(B.rateAll), moved(A.rateAll, B.rateAll, true)),
      table(["", a, b], [
        ["tasks", String(A.taskCount), String(B.taskCount)],
        ["runs", String(A.runs), String(B.runs)],
        ["runs with a score", String(A.scored), String(B.scored)],
        ["passed", String(A.passed), { t: String(B.passed), cls: moved(A.passed / A.runs, B.passed / B.runs, true) }],
        key(["pass rate, all runs", pct1(A.rateAll), { t: pct1(B.rateAll), cls: moved(A.rateAll, B.rateAll, true) }]),
        ["pass rate, scored runs", A.rateScored === null ? "–" : pct1(A.rateScored),
         B.rateScored === null ? "–" : { t: pct1(B.rateScored), cls: moved(A.rateScored, B.rateScored, true) }]
      ]), "A run with no score counts as a failure in “all runs” and is left out of “scored runs”. Both are shown because tools differ."));

    var ev = A.bands.every.length, eb = B.bands.every.length;
    add(grid, panel("How often each task passed",
      take("Every time", String(ev), String(eb), moved(ev, eb, true)),
      table(["", a, b], [
        key(["every time", String(ev), { t: String(eb), cls: moved(ev, eb, true) }]),
        ["sometimes", String(A.bands.sometimes.length), String(B.bands.sometimes.length)],
        ["never", String(A.bands.never.length), { t: String(B.bands.never.length), cls: moved(A.bands.never.length, B.bands.never.length, false) }]
      ])));

    var m = c.matrix, bands = ["every", "sometimes", "never"], v = c.verdict;
    add(grid, panel("Where each task went",
      v.everyBefore ? add(el("p", "take"), el("span", "what", "Dependable tasks held"),
                          el("span", "to " + (v.heldEvery < v.everyBefore ? "worse" : ""), v.heldEvery + " of " + v.everyBefore)) : null,
      table([a + " ↓ / " + b + " →", "every time", "sometimes", "never"],
        bands.map(function (x, i) {
          return [x === "every" ? "every time" : x].concat(bands.map(function (y, j) {
            var n = m[x][y].length;
            return { t: String(n), cls: !n ? "zero" : j > i ? "worse" : j < i ? "better" : "" };
          }));
        })),
      "Rows: before. Columns: after. Red cells are tasks that dropped a band, green ones rose. A task can also move inside “sometimes” (4 of 5 to 1 of 5); the dots show those moves."));

    if (A.endings && B.endings && A.endings.rate !== null && B.endings.rate !== null) {
      add(grid, panel("Runs that stopped by themselves",
        take("Wrong when stopped", pct(A.endings.rate), pct(B.endings.rate), moved(A.endings.rate, B.endings.rate, false)),
        table(["", a, b], [
          ["stopped by itself", String(A.endings.stopped), String(B.endings.stopped)],
          ["of which failed", String(A.endings.stoppedFailed), String(B.endings.stoppedFailed)],
          key(["share wrong", pct(A.endings.rate), { t: pct(B.endings.rate), cls: moved(A.endings.rate, B.endings.rate, false) }])
        ]), "A run that ends on its own looks finished. These are the failures nobody notices without checking the result."));
    }
    if (A.cost && B.cost && A.cost.perPass && B.cost.perPass) {
      add(grid, panel("Cost, as recorded",
        take("Per finished task", money(A.cost.perPass), money(B.cost.perPass), moved(A.cost.perPass, B.cost.perPass, false)),
        table(["", a, b], [
          ["runs with a cost", A.cost.runs + " of " + A.runs, B.cost.runs + " of " + B.runs],
          ["per run", money(A.cost.perRun), { t: money(B.cost.perRun), cls: moved(A.cost.perRun, B.cost.perRun, false) }],
          key(["per finished task", money(A.cost.perPass), { t: money(B.cost.perPass), cls: moved(A.cost.perPass, B.cost.perPass, false) }])
        ]), "Per finished task = everything spent ÷ runs that passed. The failed runs are paid for too."));
    }
    add(body, grid);
    add(body, pathPanel(res, [res.before, res.after]));
    add(body, why(res));
    return body;
  }
  function detailsOne(res) {
    var A = res.bySetup[res.setups[0]], body = el("div"), grid = el("div", "grid");
    add(grid, panel("Overview", add(el("p", "take"), el("span", "what", "Pass rate"), el("span", "to", pct1(A.rateAll))),
      table(["", res.setups[0]], [
        ["tasks", String(A.taskCount)], ["runs", String(A.runs)], ["runs with a score", String(A.scored)],
        ["passed", String(A.passed)], key(["pass rate, all runs", pct1(A.rateAll)]),
        ["pass rate, scored runs", A.rateScored === null ? "–" : pct1(A.rateScored)]
      ])));
    add(grid, panel("How often each task passed",
      add(el("p", "take"), el("span", "what", "Can go either way"), el("span", "to " + (A.bands.sometimes.length ? "worse" : ""), String(A.bands.sometimes.length))),
      table(["", res.setups[0]], [["every time", String(A.bands.every.length)],
        key(["sometimes", String(A.bands.sometimes.length)]), ["never", String(A.bands.never.length)]])));
    if (A.endings && A.endings.rate !== null) add(grid, panel("Runs that stopped by themselves",
      add(el("p", "take"), el("span", "what", "Wrong when stopped"), el("span", "to", pct(A.endings.rate))),
      table(["", res.setups[0]], [["stopped by itself", String(A.endings.stopped)], ["of which failed", String(A.endings.stoppedFailed)]])));
    if (A.cost && A.cost.perPass) add(grid, panel("Cost, as recorded",
      add(el("p", "take"), el("span", "what", "Per finished task"), el("span", "to", money(A.cost.perPass))),
      table(["", res.setups[0]], [["runs with a cost", A.cost.runs + " of " + A.runs], ["per run", money(A.cost.perRun)],
        key(["per finished task", money(A.cost.perPass)])])));
    add(body, grid);
    add(body, pathPanel(res, [res.setups[0]]));
    return body;
  }
  // path of least tokens (from recorded cost)
  function pathPanel(res, names) {
    var withPaths = names.filter(function (n) { return res.bySetup[n].paths && res.bySetup[n].paths.compared; });
    if (!withPaths.length) return null;
    var main = res.bySetup[withPaths[withPaths.length - 1]], P = main.paths;
    var box = el("div", "panel wide");
    add(box, el("h3", "", "Path of least tokens"));
    if (withPaths.length === 2) {
      var a = res.bySetup[withPaths[0]].paths, b = P;
      add(box, take("Spent on runs that failed", pct(a.failShare), pct(b.failShare), moved(a.failShare, b.failShare, false)));
    } else {
      add(box, add(el("p", "take"), el("span", "what", "Spent on runs that failed"), el("span", "to " + (P.failShare >= 0.2 ? "worse" : ""), pct(P.failShare))));
    }
    var who = withPaths.length === 2 ? shortName(withPaths[1]) + ": " : "";
    add(box, el("p", "", who + "on " + P.couldHalve + " of " + P.compared + " tasks with two or more passing runs, the typical pass cost at least twice the cheapest one" +
      (!P.couldHalve ? "." : !P.couldHalveDependable ? "; none of them passes every time yet, so the cheap passes may not happen again." :
       P.couldHalve === 1 ? "; it passes every time, so the cheaper path is one this agent can already take." :
       "; " + P.couldHalveDependable + " of them pass every time, so the cheaper path is one this agent can already take.")));
    add(box, table(["task", "passes", "cheapest", "typical", "dearest", "typical ÷ cheapest"],
      P.tasks.slice(0, 8).map(function (t) {
        return [t.task, t.passes + "/" + t.runs, money(t.cheapest), money(t.typical), money(t.dearest),
                { t: t.ratio.toFixed(1) + "×", cls: t.ratio >= 2 ? "worse" : "" }];
      })));
    add(box, el("p", "note", "Measured in recorded cost, the closest record of tokens most tools keep. A cheap pass can be a corner cut that happened to work, so trust it only on tasks that pass every time. Which steps the cheap runs skipped needs the step logs; that view comes next."));
    return box;
  }
  function why(res) {
    var o = res.compare.overall, w = el("div", "why-say");
    add(w, el("h3", "", "Why we say this"));
    add(w, el("p", "", "“" + Cap(o.reading) + "” for the whole change comes from one test over the tasks that moved: if the switch changed nothing, tasks would move up as often as down. Here " +
      (o.down || "none") + " moved down and " + (o.up || "none") + " up; " +
      (o.moved ? "if nothing had changed, a split this lopsided would turn up " + odds(o.p) + " (sign test, p " + (o.p < 0.001 ? "< 0.001" : "= " + o.p.toFixed(3)) + ")." : "nothing moved.")));
    add(w, el("p", "", "For each task on its own, we use Fisher’s exact test and call a change clear when ordinary variation between runs would produce it less than 1 time in 20. With five runs a side, that line sits here:"));
    var cases = [[5, 4], [5, 3], [5, 2], [5, 1], [5, 0], [4, 0]];
    add(w, table(["before → after (5 runs each)", "p", "reading"], cases.map(function (x) {
      var p = S.fisher(x[0], 5, x[1], 5), clear = p < S.CLEAR_BELOW;
      return [x[0] + "/5 → " + x[1] + "/5", p.toFixed(3), { t: clear ? "clear change" : "not clear yet", cls: clear ? "worse" : "" }];
    })));
    add(w, el("p", "", "Two honest limits. With three runs a side nothing can ever be called clear (3/3 → 0/3 gives p = 0.100), which is why five is the minimum we suggest. And when many tasks are tested at once, a few single-task “clear” labels can be noise; that is why the headline rests on the one test over the whole change, not on any single task."));
    add(w, el("p", "", "The page says what moved, never why."));
    return w;
  }

  // ── render a reading into slide 3 ──
  function render(res, label, tag, notes) {
    var example = tag === "A real reading", two = !!res.compare;
    $("r-tag").textContent = tag;
    $("r-what").textContent = label;
    $("back").hidden = example;
    $("another").hidden = true;          // shown by readIt when there are more setups to pick from
    $("r-credit").hidden = !example;
    $("r-body").replaceChildren.apply($("r-body"), two ? readingTwo(res, notes) : readingOne(res, notes));
    lastReading = { res: res, label: label, tag: tag, notes: notes || [] };
    var acts = $("r-actions");
    acts.replaceChildren();
    var dl = el("button", "primary", "Download the report"); dl.type = "button"; dl.onclick = downloadReport;
    var pdf = el("button", "plain", "Save as PDF"); pdf.type = "button"; pdf.onclick = savePdf;
    var cp = el("button", "plain", "Copy a summary line"); cp.type = "button";
    cp.onclick = function () { copySummary(cp); };
    add(acts, dl, pdf, cp);
    if (!example && !two && !isOneRun(res.bySetup[res.setups[0]])) {
      var addBtn = el("button", "plain", "Add the other setup to compare"); addBtn.type = "button";
      addBtn.onclick = pointToBox;
      add(acts, addBtn);
    }
    add(acts, el("p", "summary-line", ""));
    acts.hidden = false;
    var det = $("details");
    det.open = false;
    $("details-body").replaceChildren(two ? details(res) : detailsOne(res)); det.hidden = false;
  }

  // ── the one-line summary, ready for Slack or an email ──
  function summaryLine(r) {
    var res = r.res, n;
    if (res.compare) {
      var c = res.compare, o = c.overall, v = c.verdict, A = res.bySetup[res.before], B = res.bySetup[res.after];
      var bits = ["CheckAgain: " + res.before + " → " + res.after + ": " + o.reading + "."];
      if (o.moved) bits.push(o.down + " of " + o.moved + " tasks that moved went down (sign test p " + (o.p < 0.001 ? "< 0.001" : "= " + o.p.toFixed(3)) + ").");
      bits.push(v.clearWorse + " clearly worse, " + v.clearBetter + " clearly better, " + v.notClearYet + " not clear yet.");
      if (v.everyBefore) bits.push("Dependable tasks held: " + v.heldEvery + " of " + v.everyBefore + ".");
      if (A.cost && B.cost && A.cost.perPass && B.cost.perPass) bits.push("Cost per finished task " + money(A.cost.perPass) + " → " + money(B.cost.perPass) +
        "; spent on failed runs " + pct(A.paths.failShare) + " → " + pct(B.paths.failShare) + ".");
      n = c.tasksInBoth + " tasks, " + runsPerTaskText(A) + ".";
      return bits.join(" ") + " " + n;
    }
    var S1 = res.bySetup[res.setups[0]];
    return "CheckAgain: " + res.setups[0] + ": " + S1.bands.every.length + " of " + S1.taskCount + " tasks pass every time, " +
           S1.bands.sometimes.length + " sometimes, " + S1.bands.never.length + " never; pass rate " + pct1(S1.rateAll) +
           " (" + runsPerTaskText(S1) + ").";
  }
  function copyText(text, done) {
    function fallback() {
      var t = el("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      t.remove(); done(ok);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }
  function copySummary(btn) {
    var line = summaryLine(lastReading), shown = $("r-actions").querySelector(".summary-line");
    copyText(line, function (ok) {
      btn.textContent = ok ? "Copied" : "Copy it from below";
      shown.textContent = line;
      setTimeout(function () { btn.textContent = "Copy a summary line"; }, 2500);
    });
  }

  // ── the report: one self-contained HTML file that opens anywhere ──
  var FONTS = ["cormorant-400.woff", "cormorant-500.woff", "cormorant-400-italic.woff", "spacemono-regular.woff", "spacemono-bold.woff"];
  function toBase64(buf) {
    var bytes = new Uint8Array(buf), out = "", step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) out += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    return btoa(out);
  }
  function reportBody(r) {
    var res = r.res, two = !!res.compare;
    reportMode = true;
    try {
      var main = el("main", "report");
      add(main, add(el("p", "r-label"), el("span", "tag", r.tag), el("span", "", r.label)));
      (two ? readingTwo(res, r.notes) : readingOne(res, r.notes)).forEach(function (n) { add(main, n); });
      var det = el("details", "r-details"); det.setAttribute("open", "");
      add(det, el("summary", "", "The details"), two ? details(res) : detailsOne(res));
      add(main, det);
      return main;
    } finally { reportMode = false; }
  }
  function makeReport(r) {   // the report as one HTML string, with its file name
    return Promise.all([fetch("style.css").then(function (x) { return x.text(); })].concat(FONTS.map(function (f) {
      return fetch("fonts/" + f).then(function (x) { return x.arrayBuffer(); }).then(function (b) { return [f, toBase64(b)]; });
    }))).then(function (got) {
      var css = got[0];
      got.slice(1).forEach(function (fb) { css = css.split('url("fonts/' + fb[0] + '")').join('url("data:font/woff;base64,' + fb[1] + '")'); });
      css += "\n.report-head { display: flex; justify-content: space-between; gap: 16px; font: 12px var(--mono); color: var(--muted); padding: 18px 0 10px; border-bottom: 1px solid var(--line); }" +
             "\n.report-title { font: 500 clamp(30px, 4.2vw, 44px)/1.08 var(--serif-d); margin: 28px 0 18px; }" +
             "\n.report { padding-bottom: 24px; }" +
             "\n.report-foot { border-top: 1px solid var(--line); margin-top: 28px; padding: 18px 0 40px; font: 12px/1.6 var(--mono); color: var(--muted); }" +
             "\n.report-foot p { margin: 0 0 6px; }" +
             "\n@media print { .tgroup > summary::before { content: none; } }";
      var now = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };   // local time, not UTC
      var stamp = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
      var clock = pad(now.getHours()) + pad(now.getMinutes());
      var wrap = el("div", "wrap");
      add(wrap, add(el("div", "report-head"), add(el("span"), el("b", "", "CheckAgain"), txt(" by Crucible Science")), el("span", "", "Report made " + stamp)));
      add(wrap, el("h1", "report-title", "Would it pass again?"));
      add(wrap, reportBody(r));
      var foot = el("div", "report-foot");
      add(foot, el("p", "", "Made with CheckAgain, a free reliability check for AI agents that runs in the browser: checkagain.cruciblescience.com. The results were read on the reader’s own computer; nothing was uploaded."));
      add(foot, el("p", "", r.res.compare
        ? "Method: each task’s runs before and after are compared with Fisher’s exact test (clear below p = 0.05); the whole change with a sign test over the tasks that moved. The report says what moved, never why."
        : "Method: each task’s runs are counted as passed or failed. Nothing was compared; add the results from after a change to see what moved."));
      if (r.tag === "A real reading") add(foot, el("p", "", "Example data: Terminal-Bench 2.0 public leaderboard runs, Apache 2.0; analysed in “Same task, cheaper model, five runs” by Crucible Science."));
      add(foot, el("p", "", "Summary: " + summaryLine(r)));
      add(wrap, foot);
      var html = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n" +
                 "<title>CheckAgain report " + stamp + "</title>\n<style>\n" + css + "\n</style>\n</head>\n<body>\n" + wrap.outerHTML + "\n</body>\n</html>\n";
      return { html: html, name: "checkagain-report-" + stamp + "-" + clock };
    });
  }
  function downloadReport() {
    var r = lastReading; if (!r) return;
    var btn = $("r-actions").querySelector("button.primary"); btn.textContent = "Making the report…";
    makeReport(r).then(function (rep) {
      var a = el("a"); a.href = URL.createObjectURL(new Blob([rep.html], { type: "text/html" }));
      a.download = rep.name + ".html";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      btn.textContent = "Download the report";
    }).catch(function () {
      btn.textContent = "Couldn’t make the report";
    });
  }
  // the same report, handed to the browser's own print dialog, where "Save as PDF" lives
  function savePdf() {
    var r = lastReading; if (!r) return;
    var btn = this; btn.textContent = "Opening the print dialog…";
    makeReport(r).then(function (rep) {
      var f = el("iframe"); f.setAttribute("aria-hidden", "true");
      f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      f.onload = function () {
        var w = f.contentWindow; w.document.title = rep.name;
        var gone = false, clean = function () { if (!gone) { gone = true; f.remove(); } };
        w.addEventListener("afterprint", clean);
        setTimeout(clean, 60000);            // in case a browser never says the dialog closed
        w.focus(); w.print();
        btn.textContent = "Save as PDF";
      };
      f.srcdoc = rep.html;
      document.body.appendChild(f);
    }).catch(function () {
      btn.textContent = "Couldn’t make the PDF";
    });
  }

  function showDemo() {
    function go(demo) {
      var res = S.analyse(demo.runs), A = res.bySetup[res.before];
      render(res, "Public runs of one coding agent, switched from " + res.before + " to " + res.after + " · " +
                  A.taskCount + " tasks, " + runsPerTaskText(A), "A real reading");
    }
    if (demoCache) return go(demoCache);
    fetch(DEMO).then(function (r) {
      if (!r.ok) throw new Error("status " + r.status);
      return r.json();
    }).then(function (demo) { demoCache = demo; go(demo); }).catch(function () {
      $("r-body").replaceChildren(el("p", "error", "The example could not be read. If you opened this file straight from disk, start the local server in this folder (python3 -m http.server) and open http://localhost:8000."));
      $("r-what").textContent = "Example not loaded";
    });
  }

  // ── your own results: paste or drop, confirm, read ──
  var state = null, loaded = [], listed = [], batch = 0;
  var ROLE_LABELS = [["task", "Task", true], ["passed", "Passed", true], ["run", "Run", false],
                     ["setup", "Setup (model, prompt…)", false], ["ended", "How it ended", false], ["cost", "Cost", false]];

  function begin(inputs) {
    var got = R.read(inputs);
    if (got.error) return showProblem(got.error);
    state = got;
    var sig = "map:" + state.plans[0].headers.join("|");
    var saved = store(sig);
    if (saved && saved.map) state.plans.forEach(function (pl) {
      if (pl.headers.join("|") === state.plans[0].headers.join("|")) {
        pl.map = saved.map;
        pl.passKind = pl.map.passed ? R.passKind(pl.records.map(function (r) { return r[pl.map.passed]; })) : null;
        if (saved.threshold !== undefined) pl.threshold = saved.threshold;
        if (saved.normal) pl.normal = saved.normal;
      }
    });
    showLoaded();
    confirmPanel();
    $("confirm").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function showProblem(msg) {
    var box = $("confirm");
    box.replaceChildren(el("p", "error", msg), el("p", "small", "Need help? A sheet with three columns, task, run and passed, is enough. Download the blank sheet to start from the right layout."));
    box.hidden = false;
  }
  function applyAll(fn) {   // a change to the first file applies to every file with the same columns
    var h = state.plans[0].headers.join("|");
    state.plans.forEach(function (pl) { if (pl.headers.join("|") === h) fn(pl); });
  }
  function confirmPanel() {
    var box = $("confirm"), pl = state.plans[0];
    var out = R.toRows(state), rows = out.rows;
    box.replaceChildren();
    if (state.errors.length) add(box, el("p", "error", state.errors.join(" ")));
    var ok = pl.map.task && pl.map.passed && rows.length;
    var d = ok ? R.describe(state, rows) : null;
    add(box, el("h3", "", "Check what we read"));
    add(box, el("p", "sentence", ok ? d.text : "We couldn’t tell which column is the task and which says whether it passed. Pick them below."));
    if (ok && out.problems.noScore) add(box, el("p", "small", out.problems.noScore + " run" + (out.problems.noScore === 1 ? " has" : "s have") + " no result; " + (out.problems.noScore === 1 ? "it counts" : "they count") + " as not passed, and the details show the pass rate both ways."));
    if (ok && out.problems.noTask) add(box, el("p", "small", out.problems.noTask + " row" + (out.problems.noTask === 1 ? " has" : "s have") + " no task name and " + (out.problems.noTask === 1 ? "was" : "were") + " left out."));
    state.plans.forEach(function (p) { if (p.skipped) add(box, el("p", "small", p.skipped + " skipped test" + (p.skipped === 1 ? " was" : "s were") + " left out: a skipped test did not run.")); });
    if (listed.length > 1 && loaded.some(function (x) { return !x.harbor; })) add(box, el("p", "small", loaded.length + " files read. Each file without a setup column counts as one setup, named after the file; test reports dropped together are the runs of one setup."));

    var grid = el("div", "mapper");
    ROLE_LABELS.forEach(function (rl) {
      var sel = el("select"); sel.id = "map-" + rl[0];
      add(sel, el("option", "", rl[2] ? "— choose —" : "(none)"));
      sel.options[0].value = "";
      pl.headers.forEach(function (h) { var o = el("option", "", h); o.value = h; if (pl.map[rl[0]] === h) o.selected = true; add(sel, o); });
      sel.onchange = function () {
        applyAll(function (p) {
          if (sel.value) p.map[rl[0]] = sel.value; else delete p.map[rl[0]];
          if (rl[0] === "passed") { p.passKind = sel.value ? R.passKind(p.records.map(function (r) { return r[sel.value]; })) : null; p.threshold = p.passKind && p.passKind.type === "score" ? p.passKind.threshold : 1; }
          if (rl[0] === "ended") p.normal = sel.value ? R.distinct(p.records, sel.value).filter(function (v) { return !/timeout|timed.?out|error|exception|fail|crash|abort|cancel|killed|limit|interrupt/i.test(v); }) : [];
        });
        confirmPanel();
      };
      add(grid, add(el("label"), el("span", "", rl[1]), sel));
    });
    add(box, grid);

    if (pl.passKind && pl.passKind.type === "score") {
      var th = el("input"); th.type = "number"; th.step = "any"; th.value = pl.threshold;
      th.onchange = function () { var x = parseFloat(th.value); if (isFinite(x)) { applyAll(function (p) { p.threshold = x; }); confirmPanel(); } };
      add(box, add(el("label", "inline"), el("span", "", "“" + pl.map.passed + "” is a score from " + pl.passKind.min + " to " + pl.passKind.max + ". Count as a pass from"), th));
    }
    if (pl.map.ended) {
      var vals = R.distinct(pl.records, pl.map.ended);
      if (vals.length && vals.length <= 30) {
        var f = add(el("fieldset", "endings"), el("legend", "", "Which endings mean the run stopped by itself? (The rest are timeouts, errors and the like.)"));
        vals.forEach(function (v) {
          var cb = el("input"); cb.type = "checkbox"; cb.checked = pl.normal.indexOf(v) >= 0;
          cb.onchange = function () {
            applyAll(function (p) { var i = p.normal.indexOf(v); if (cb.checked && i < 0) p.normal.push(v); if (!cb.checked && i >= 0) p.normal.splice(i, 1); });
            confirmPanel();
          };
          add(f, add(el("label", "tick"), cb, txt(" " + v)));
        });
        add(box, f);
      }
    }
    if (ok && d.setups.length > 2) {
      var pick = el("div", "pick");
      ["before", "after"].forEach(function (which, i) {
        var s = el("select"); s.id = "pick-" + which;
        d.setups.forEach(function (name, j) { var o = el("option", "", name); o.value = name; if (j === i) o.selected = true; add(s, o); });
        add(pick, add(el("label"), el("span", "", which === "before" ? "Before" : "After"), s));
      });
      add(box, el("p", "small", "Your results have " + d.setups.length + " setups. Pick the two to compare."), pick);
    }
    var go = el("button", "primary", "Read it"); go.type = "button"; go.disabled = !ok;
    go.onclick = function () { readIt(rows, d); };
    add(box, add(el("div", "actions"), go));
    box.hidden = false;
  }
  function readIt(rows, d) {
    var opts = {};
    if ($("pick-before")) {
      opts.before = $("pick-before").value; opts.after = $("pick-after").value;
      if (opts.before === opts.after) return showProblem("Pick two different setups to compare.");
      rows = rows.filter(function (r) { return r.setup === opts.before || r.setup === opts.after; });
    }
    var pl = state.plans[0];
    store("map:" + pl.headers.join("|"), { map: pl.map, threshold: pl.threshold, normal: pl.normal });
    var res = S.analyse(rows, opts);
    var notes = [];
    if (res.compare) {
      var c = res.compare, k = c.onlyBefore.length + c.onlyAfter.length;
      if (k) notes.push(k + " task" + (k === 1 ? " appears" : "s appear") + " in only one setup and " + (k === 1 ? "is" : "are") + " left out of the comparison.");
    }
    var A = res.bySetup[res.setups[0]];
    var label = res.compare
      ? res.before + " against " + res.after + " · " + res.compare.tasksInBoth + " tasks in both, " + runsPerTaskText(res.bySetup[res.before])
      : res.setups[0] + " · " + A.taskCount + " tasks, " + runsPerTaskText(A);
    render(res, label, "Your results", notes);
    if (d.setups.length > 2) $("another").hidden = false;   // keep the chooser: pick another pair without loading again
    else $("confirm").hidden = true;
    $("reading").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // read many files a few at a time, so a large folder never opens thousands of readers at once
  function inBatches(items, size, fn) {
    var out = new Array(items.length), next = 0;
    function worker() {
      if (next >= items.length) return Promise.resolve();
      var i = next++;
      return fn(items[i]).then(function (x) { out[i] = x; return worker(); });
    }
    var workers = [];
    for (var w = 0; w < Math.min(size, items.length); w++) workers.push(worker());
    return Promise.all(workers).then(function () { return out; });
  }
  // the job folder a run sits in: ".../<job>/<trial>/result.json" -> ".../<job>"
  function jobOf(path, top) {
    var seg = String(path || "").split("/").filter(Boolean);
    return seg.length > 2 ? seg.slice(0, -2).join("/") : top;
  }
  function readOne(f, extra) {
    return new Promise(function (ok) {
      var fr = new FileReader();
      fr.onload = function () { var x = { text: fr.result, name: f.name }; for (var k in extra) x[k] = extra[k]; ok(x); };
      fr.onerror = function () { ok({ text: "", name: f.name }); };
      fr.readAsText(f);
    });
  }
  function readFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    inBatches(files, 8, function (f) { return readOne(f, {}); }).then(addBatch);
  }
  function addBatch(inputs) {
    if (!inputs.length) return showProblem("Nothing to read in what was dropped.");
    var b = batch++;
    inputs.forEach(function (x) { x.batch = b; });
    var shown = inputs.filter(function (x) { return !x.harbor; });
    var folders = {};
    inputs.forEach(function (x) { if (x.harbor) folders[x.top] = (folders[x.top] || 0) + 1; });
    var tops = Object.keys(folders);
    tops.slice(0, 3).forEach(function (t) {
      shown.push({ name: t + "/: " + folders[t].toLocaleString("en-US") + " result file" + (folders[t] === 1 ? "" : "s") + " read, nothing else opened", listOnly: true });
    });
    if (tops.length > 3) shown.push({ name: "and " + (tops.length - 3) + " more folders", listOnly: true });
    loaded = loaded.concat(inputs);
    listed = listed.concat(shown);
    begin(loaded.filter(function (x) { return !x.listOnly; }));
  }
  // a folder: keep only the small result.json of each run; the large step logs are never opened
  function readFolderFiles(list) {
    var files = Array.prototype.slice.call(list || []).filter(function (f) { return f.name === "result.json"; });
    if (!files.length) return showProblem("No result.json files in that folder. Pick a job folder, or drop files instead.");
    inBatches(files, 8, function (f) {
      var path = f.webkitRelativePath || f.name, top = path.split("/")[0];
      return readOne(f, { harbor: true, top: top, job: jobOf(path, top) });
    }).then(addBatch);
  }
  function walkEntry(entry, top, out) {
    return new Promise(function (ok) {
      if (entry.isFile) {
        if (entry.name !== "result.json") return ok();
        entry.file(function (f) { out.push({ file: f, top: top, path: entry.fullPath }); ok(); }, function () { ok(); });
      } else if (entry.isDirectory) {
        var rd = entry.createReader(), all = [];
        (function more() {
          rd.readEntries(function (batchOf) {
            if (!batchOf.length) return inBatches(all, 4, function (e) { return walkEntry(e, top, out); }).then(function () { ok(); });
            all = all.concat(Array.prototype.slice.call(batchOf)); more();
          }, function () { ok(); });
        })();
      } else ok();
    });
  }
  function readDrop(dt) {
    var items = Array.prototype.slice.call(dt.items || []);
    var entries = items.map(function (it) { return it.webkitGetAsEntry ? it.webkitGetAsEntry() : null; }).filter(Boolean);
    if (!entries.some(function (e) { return e.isDirectory; })) return readFiles(dt.files);
    var out = [];
    entries.reduce(function (p, e) {
      return p.then(function () {
        if (e.isDirectory) return walkEntry(e, e.name, out);
        return new Promise(function (ok) { e.file(function (f) { out.push({ file: f, plain: true }); ok(); }, function () { ok(); }); });
      });
    }, Promise.resolve()).then(function () {
      if (!out.length) return showProblem("No result.json files in that folder. Pick a job folder, or drop files instead.");
      return inBatches(out, 8, function (o) { return readOne(o.file, o.plain ? {} : { harbor: true, top: o.top, job: jobOf(o.path, o.top) }); });
    }).then(function (inputs) { if (inputs) addBatch(inputs); });
  }
  function startOver() {
    loaded = []; listed = []; state = null;
    $("confirm").hidden = true;
    showLoaded();
    showDemo();
  }
  function showLoaded() {   // what is loaded, inside the box, with Start over
    var box = $("loaded");
    box.replaceChildren();
    // once files are loaded, the paste box has no job left: hide it so the list and the check sit together
    $("drop").classList.toggle("has-files", listed.length > 0 && listed.every(function (x) { return x.name && x.name !== "pasted results"; }));
    if (!listed.length) { box.hidden = true; $("drop-title").textContent = "Paste your results here, or drop files on this box"; return; }
    var list = el("ul");
    listed.forEach(function (x) { add(list, el("li", "", x.name || "pasted results")); });
    var so = el("button", "plain", "Start over"); so.type = "button"; so.onclick = startOver;
    add(box, add(el("div", "loaded-head"), el("span", "", "Loaded"), so), list);
    box.hidden = false;
    $("drop-title").textContent = "Drop another file here to compare";
  }
  function pointToBox() {
    var d = $("drop");
    d.scrollIntoView({ behavior: "smooth", block: "center" });
    d.classList.remove("pulse"); void d.offsetWidth; d.classList.add("pulse");
  }
  function wireAsk() {
    var f = $("ask-form"), msg = $("ask-msg");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("ask-email").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { msg.textContent = "That email doesn’t look complete."; return; }
      if (!FORM_ENDPOINT) {
        location.href = "mailto:" + CONTACT + "?subject=" + encodeURIComponent("CheckAgain: a reading of my agent") +
          "&body=" + encodeURIComponent("Hi Ashwin,\n\nI’d like a reading of my agent. Reach me at " + email + ".\n\nWhat it does, in one line: \n");
        msg.textContent = "Your email app should open with the request written. Send it and we’ll write back.";
        return;
      }
      var btn = f.querySelector("button"); btn.disabled = true;
      msg.textContent = "Sending…";
      fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
                             body: JSON.stringify({ email: email, _subject: "CheckAgain: a reading request", request: "free reading", from: "checkagain" }) })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          f.reset(); msg.textContent = "Thanks. We’ll write to you at that address.";
        })
        .catch(function () { msg.textContent = "That didn’t go through. Write to " + CONTACT + " instead."; })
        .then(function () { btn.disabled = false; });
    });
  }

  function wire() {
    wireAsk();
    var drop = $("drop");
    ["dragenter", "dragover"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { readDrop(e.dataTransfer); });
    $("folder").addEventListener("change", function (e) { readFolderFiles(e.target.files); e.target.value = ""; });
    $("file").addEventListener("change", function (e) { readFiles(e.target.files); e.target.value = ""; });
    $("read-paste").addEventListener("click", function () {   // a paste starts afresh
      loaded = [{ text: $("paste").value, name: "", batch: batch++ }];
      listed = [{ name: "pasted results" }];
      begin(loaded);
    });
    $("back").addEventListener("click", function (e) { e.preventDefault(); startOver(); });
    $("another").addEventListener("click", function (e) {
      e.preventDefault();
      var c = $("confirm"); c.scrollIntoView({ behavior: "smooth", block: "center" });
      var p = $("pick-before"); if (p) p.focus({ preventScroll: true });
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (b) {
      b.addEventListener("click", function () {
        var pre = $(b.getAttribute("data-copy")), label = b.textContent;
        copyText(pre.textContent, function (ok) {
          if (!ok) pre.closest("details").open = true;   // could not copy: show the prompt so it can be selected by hand
          b.textContent = ok ? "Copied" : "Select it below";
          setTimeout(function () { b.textContent = label; }, 2500);
        });
      });
    });
    var blank = "task,setup,run,passed\nrefund-request,before,1,pass\nrefund-request,before,2,fail\nrefund-request,after,1,pass\n";
    $("blank").href = "data:text/csv;charset=utf-8," + encodeURIComponent(blank);
  }

  wire();
  showDemo();
})();
