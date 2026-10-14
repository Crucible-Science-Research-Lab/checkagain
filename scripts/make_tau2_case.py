#!/usr/bin/env python3
"""Build a real test case for CheckAgain from note one's public τ²-bench runs.

Reads Sierra's three retail results files (tau2-bench, commit 5bfa7e37, MIT licence; the same
files note one analysed, sha256-checked) and writes one row per run, copying six fields as
recorded: task_id, model, trial, reward, termination_reason, agent_cost. Nothing is cleaned,
rounded or added. Standard library only.

Usage: python3 scripts/make_tau2_case.py <folder holding the three *_4trials.json files>
"""
import csv
import hashlib
import json
import sys
from pathlib import Path

FILES = {   # name -> sha256, from note one's manifest (experiments/001-tau-retail/fetch_raw.sh)
    "claude-3-7-sonnet-20250219_retail_default_gpt-4.1-2025-04-14_4trials.json":
        "ed41dbd18c080154156484e3a0122c095e324a11367a640d88e15956daed7b9d",
    "gpt-4.1-2025-04-14_retail_default_gpt-4.1-2025-04-14_4trials.json":
        "5fc5b96ada0fe46a463eaed98d1bfed9947fe073bac052290162dae18d71394e",
    "o4-mini-2025-04-16_retail_default_gpt-4.1-2025-04-14_4trials.json":
        "7135f38bbbbd46d6babe830574c8623bb276d8fd6da316580b905cf513853f98",
}
src = Path(sys.argv[1]).expanduser()
out = Path(__file__).resolve().parents[1] / "tests" / "cases" / "tau2-retail-3models.csv"
rows = []
for name, want in FILES.items():
    data = (src / name).read_bytes()
    if hashlib.sha256(data).hexdigest() != want:
        sys.exit(f"FAIL: {name} is not the published file")
    model = name.split("_retail_")[0]
    for s in json.loads(data)["simulations"]:
        rows.append([s["task_id"], model, s["trial"], (s.get("reward_info") or {}).get("reward"),
                     s.get("termination_reason"), s.get("agent_cost")])
out.parent.mkdir(parents=True, exist_ok=True)
with out.open("w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["task_id", "model", "trial", "reward", "termination_reason", "agent_cost"])
    w.writerows(rows)
print(f"wrote {out} ({len(rows)} runs)")
