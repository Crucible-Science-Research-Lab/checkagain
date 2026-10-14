#!/usr/bin/env python3
"""Check that a results file is ready for CheckAgain. Reads the file; changes nothing.

Usage: python3 check_results.py results.csv
Standard library only. Part of the CheckAgain skill (MIT licence, Crucible Science).
"""
import csv
import sys
from collections import defaultdict

PASS = {"pass", "passed", "true", "yes", "1", "1.0", "ok", "success"}
FAIL = {"fail", "failed", "false", "no", "0", "0.0", "error", "failure"}
REQUIRED = ["task", "run", "passed"]
LONG_TEXT = 200          # a cell longer than this may be content that should not be in the file


def main(path):
    problems, warnings = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit("FAIL: the file has no rows")
    cols = [c.strip().lower() for c in rows[0].keys()]
    rows = [{k.strip().lower(): (v or "").strip() for k, v in r.items() if k} for r in rows]
    for c in REQUIRED:
        if c not in cols:
            problems.append(f"missing column '{c}'")
    if problems:
        print("\n".join("FAIL " + p for p in problems))
        sys.exit("FAIL: not ready for CheckAgain")
    print(f"ok   columns: {', '.join(cols)}")

    bad = [r["passed"] for r in rows if r["passed"].lower() not in PASS | FAIL]
    if bad:
        problems.append(f"{len(bad)} rows have a 'passed' value that is not pass or fail (e.g. {bad[0]!r})")
    else:
        print(f"ok   passed: every row is pass or fail")
    if any(not r["task"] for r in rows):
        problems.append("some rows have no task name")

    long_cells = [(c, len(v)) for r in rows for c, v in r.items() if len(v) > LONG_TEXT]
    if long_cells:
        problems.append(f"{len(long_cells)} cells are longer than {LONG_TEXT} characters (column '{long_cells[0][0]}'): "
                        "the file should hold labels and outcomes only, never prompts, outputs or conversation text")
    extra = [c for c in cols if c not in {"task", "setup", "run", "passed", "ended", "cost_usd"}]
    if extra:
        warnings.append(f"extra columns {extra}: CheckAgain ignores them; make sure none holds private text")

    runs = defaultdict(int)
    for r in rows:
        runs[(r["task"], r.get("setup", ""))] += 1
    setups = sorted({s for _, s in runs})
    tasks = sorted({t for t, _ in runs})
    low, high = min(runs.values()), max(runs.values())
    print(f"ok   {len(tasks)} tasks, {len(setups)} setup(s){': ' + ', '.join(setups) if setups != [''] else ''}, "
          f"{low}{'' if low == high else ' to ' + str(high)} runs each")
    if low < 5:
        warnings.append(f"some tasks have only {low} run(s): five runs per task and setup is the minimum that can show a clear change")
    if len(setups) > 1:
        for s in setups:
            missing = [t for t in tasks if (t, s) not in runs]
            if missing:
                warnings.append(f"setup '{s}' is missing {len(missing)} task(s), e.g. {missing[0]!r}; those are left out of the comparison")
    if "cost_usd" in cols:
        nums = [r["cost_usd"] for r in rows if r["cost_usd"]]
        try:
            [float(x) for x in nums]
            print(f"ok   cost_usd recorded on {len(nums)} of {len(rows)} runs")
        except ValueError:
            problems.append("cost_usd has values that are not numbers")

    for w in warnings:
        print("WARN " + w)
    for p in problems:
        print("FAIL " + p)
    if problems:
        sys.exit("FAIL: not ready for CheckAgain")
    print(f"READY for CheckAgain: drop {path} on the box at https://checkagain.cruciblescience.com")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
