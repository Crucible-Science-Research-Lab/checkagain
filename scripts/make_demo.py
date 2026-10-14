#!/usr/bin/env python3
"""Build CheckAgain's demo file from note two's public runs.

Reads each trial's result.json for two submissions (Claude Opus 4.6 and DeepSeek V3.2,
both on Terminus2), keeps the 61 tasks Terminal-Bench 2.1 did not revise, and writes one
row per run exactly as recorded. Before writing, it recomputes note two's published
figures from the same rows and stops on any difference. Standard library only; it changes
nothing outside the output file.

Usage:
  python3 scripts/make_demo.py --note path/to/divergence/experiments/002-terminal-bench
"""
import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

VERSION = "0.1.0"
BASE = "submissions/terminal-bench/2.0"
SETUPS = [("Terminus2__Claude-Opus-4.6", "Claude Opus 4.6"),
          ("Terminus2__DeepSeek-V3.2", "DeepSeek V3.2")]
REF, OTHER = SETUPS[0][1], SETUPS[1][1]
NOTE_URL = ("https://github.com/Crucible-Science-Research-Lab/divergence/blob/main/"
            "experiments/002-terminal-bench/NOTE.md")

# Published figures. Source: experiments/002-terminal-bench/reports/
# harbor_import_models_confirmation.txt (sections 1, 2 and 9) and dollars.txt (model axis).
EXPECTED = {
    "primary (61 tasks)": {
        "runs": (305, 305), "passed": (230, 143),
        "ref every-time tasks": 33, "held every time": 12, "not held but sometimes": (13, 21),
        "stopped by itself, but failed": ((37, 260), (119, 259)),
        "recorded dollars per run": ("0.605", "0.033"),
        "recorded dollars per pass": ("0.802", "0.069"),
    },
    "all 89 tasks": {
        "runs": (445, 445), "passed": (280, 176),
        "ref every-time tasks": 39, "held every time": 12, "not held but sometimes": (17, 27),
        "stopped by itself, but failed": ((92, 364), (183, 354)),
    },
}


def as_float(x):
    try:
        return float(x) if x is not None else None
    except (TypeError, ValueError):
        return None


def read_trial(path):
    """One trial's result.json -> one row, or None for a job-level result.json."""
    try:
        r = json.loads(path.read_text(errors="replace"))
    except Exception:
        return None
    if not (isinstance(r, dict) and r.get("task_name") and r.get("trial_name")):
        return None
    vr = r.get("verifier_result") or {}
    rewards = vr.get("rewards") if isinstance(vr.get("rewards"), dict) else {}
    # the published importer's rule (harbor.py read_result) ...
    reward = as_float(rewards.get("reward", vr.get("reward")))
    # ... and outcomes.py's rule; the two must agree on every run
    alt = as_float(rewards.get("reward", next(iter(rewards.values())))) if rewards else None
    exc = r.get("exception_info") or None
    if isinstance(exc, dict):
        ended = exc.get("exception_type") or exc.get("type") or "Exception"
    elif exc:
        ended = str(exc)[:60]
    else:
        ended = "completed"
    ar = r.get("agent_result") or {}
    ai = r.get("agent_info") or {}
    mi = ai.get("model_info") or {}
    return {
        "task": r["task_name"],
        "passed": reward is not None and reward >= 1.0,
        "reward": reward,
        "ended": ended,
        "cost_usd": as_float(ar.get("cost_usd")),
        "input_tokens": ar.get("n_input_tokens"),
        "cached_tokens": ar.get("n_cache_tokens"),
        "output_tokens": ar.get("n_output_tokens"),
        "started_at": r.get("started_at"),
        "finished_at": r.get("finished_at"),
        "trial": r["trial_name"],
        "agent": " ".join(str(x) for x in (ai.get("name"), ai.get("version")) if x),
        "model": "/".join(str(x) for x in (mi.get("provider"), mi.get("name")) if x),
        "_alt_passed": alt is not None and alt >= 0.999,
    }


def figures(rows):
    """Note two's measures for one scope, computed from the rows."""
    by = {label: [x for x in rows if x["setup"] == label] for _, label in SETUPS}
    grade = {}
    for label, rs in by.items():
        tasks = defaultdict(list)
        for x in rs:
            tasks[x["task"]].append(x["passed"])
        grade[label] = {t: ("every" if all(v) else "never" if not any(v) else "some")
                        for t, v in tasks.items()}
    every = [t for t, g in grade[REF].items() if g == "every"]
    held = [t for t in every if grade[OTHER].get(t) == "every"]
    lost = [t for t in every if t not in held]
    out = {
        "runs": tuple(len(by[l]) for _, l in SETUPS),
        "passed": tuple(sum(x["passed"] for x in by[l]) for _, l in SETUPS),
        "ref every-time tasks": len(every),
        "held every time": len(held),
        "not held but sometimes": (sum(grade[OTHER].get(t) == "some" for t in lost), len(lost)),
        "stopped by itself, but failed": tuple(
            (sum(not x["passed"] for x in by[l] if x["ended"] == "completed"),
             sum(x["ended"] == "completed" for x in by[l])) for _, l in SETUPS),
    }
    per_run, per_pass = [], []
    for _, l in SETUPS:
        dc = [x for x in by[l] if x["cost_usd"] is not None]
        p = sum(x["passed"] for x in dc)
        total = sum(x["cost_usd"] for x in dc)
        per_run.append(f"{total / len(dc):.3f}" if dc else "-")
        per_pass.append(f"{total / p:.3f}" if p else "-")
    out["recorded dollars per run"] = tuple(per_run)
    out["recorded dollars per pass"] = tuple(per_pass)
    return out


def main():
    here = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser(description="Build CheckAgain's demo file from note two's runs.")
    ap.add_argument("--note", type=Path, required=True,
                    help="note two's folder in a clone of the divergence repository, with its raw/ files fetched "
                         "(holds inputs.json, manifest.tsv and raw/)")
    ap.add_argument("--out", type=Path, default=here / "demo" / "note2-opus-deepseek.json")
    args = ap.parse_args()
    note = args.note.expanduser().resolve()

    for name in ("inputs.json", "manifest.tsv", "raw"):
        if not (note / name).exists():
            sys.exit(f"FAIL: not found: {note / name}")
    revised = set(json.loads((note / "inputs.json").read_text())["tasks_revised_in_tb21"]["tasks"])
    first = (note / "manifest.tsv").open().readline()
    m = re.match(r"^# inputs of note \S+: (\S+) @ ([0-9a-f]{40})\s*$", first)
    if not m or len(revised) != 28:
        sys.exit("FAIL: manifest.tsv's first line or the list of 28 revised tasks is not as expected")
    dataset, revision = m.groups()

    rows, disagree = [], 0
    for folder, label in SETUPS:
        sub = note / "raw" / BASE / folder
        found = [t for t in (read_trial(p) for p in sorted(sub.rglob("result.json"))) if t]
        if not found:
            sys.exit(f"FAIL: no trial result.json under {sub}")
        by_task = defaultdict(list)
        for t in found:
            by_task[t["task"]].append(t)
        for task, ts in sorted(by_task.items()):
            ts.sort(key=lambda t: (str(t["started_at"] or ""), t["trial"]))  # as the importer
            for i, t in enumerate(ts, 1):
                disagree += t.pop("_alt_passed") != t["passed"]
                rows.append({"task": task, "setup": label, "run": i, **t,
                             "_revised": task in revised})
    print(f"read {len(rows)} runs from {len(SETUPS)} submissions; "
          f"pass rule of the importer and of outcomes.py disagree on {disagree} runs")

    failures = int(disagree != 0)
    scopes = {"primary (61 tasks)": [x for x in rows if not x["_revised"]],
              "all 89 tasks": rows}
    for scope, keep in scopes.items():
        got = figures(keep)
        print(f"-- {scope}")
        for key, want in EXPECTED[scope].items():
            ok = got[key] == want
            failures += not ok
            print(f"   {'ok  ' if ok else 'FAIL'} {key:<32} {got[key]}"
                  + ("" if ok else f"   expected {want}"))

    demo = [x for x in scopes["primary (61 tasks)"]]
    counts = defaultdict(int)
    for x in demo:
        counts[(x["task"], x["setup"])] += 1
    tasks = {t for t, _ in counts}
    shape_ok = len(tasks) == 61 and len(counts) == 122 and set(counts.values()) == {5}
    failures += not shape_ok
    print(f"   {'ok  ' if shape_ok else 'FAIL'} demo shape: {len(tasks)} tasks, "
          f"runs per task and setup {sorted(set(counts.values()))}")

    if failures:
        sys.exit(f"FAIL: {failures} check(s) did not match note two; nothing was written")

    for x in demo:
        x.pop("_revised")
    source = {
        "title": "Same agent, two models: Claude Opus 4.6 against DeepSeek V3.2",
        "what": "Public Terminal-Bench 2.0 leaderboard runs of one coding agent (Terminus2), "
                "five runs per task per model, as recorded by their submitters.",
        "dataset": dataset, "revision": revision, "licence": "Apache-2.0",
        "submissions": [f for f, _ in SETUPS],
        "scope": "61 tasks: the 28 tasks revised in Terminal-Bench 2.1 are left out "
                 "(list from https://www.tbench.ai/news/terminal-bench-2-1)",
        "analysed_in": NOTE_URL,
        "fields": {
            "passed": "reward >= 1.0",
            "ended": "'completed' when no exception was recorded (the run stopped by itself), "
                     "otherwise the exception type as recorded",
            "cost_usd": "dollars recorded by the submitter, not estimated",
        },
        "made_by": f"CheckAgain scripts/make_demo.py {VERSION}",
    }
    text = ('{"source": ' + json.dumps(source, indent=1) + ',\n"runs": [\n'
            + ",\n".join(json.dumps(x) for x in demo) + "\n]}\n")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text)
    digest = hashlib.sha256(text.encode().rstrip(b"\n")).hexdigest()
    print(f"wrote {args.out} ({len(demo)} runs, {len(text.encode()) // 1024} KB)")
    print(f"check value (sha256, final newlines stripped): {digest}")
    print("DONE make_demo: every figure matches note two")


if __name__ == "__main__":
    main()
