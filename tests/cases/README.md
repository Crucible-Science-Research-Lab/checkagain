# Case tests

Files that `check.html` reads through the same door a user's file goes through. Every
release must pass all of them.

| File | What it tests | Source |
|---|---|---|
| `tau2-retail-3models.csv` | Real data of a different kind: a customer-service agent, 3 models, 4 runs, 114 tasks; column names as the tool wrote them; runs numbered from 0; scores 0/1 | Sierra's τ²-bench retail results at commit 5bfa7e37 (MIT licence), the files note one analysed; six fields copied as recorded by `scripts/make_tau2_case.py` |
| `odd-names.csv` | Column names nobody planned for; ✓ and ✗; a cost column with a $ in its name | made by hand |
| `one-run.csv` | One run per task, one setup | made by hand |
| `uneven.tsv` | Tab-separated (as pasted from a spreadsheet); 2, 3 and 5 runs per task; no run column | made by hand |
| `scores.csv` | Scores between 0 and 1 instead of pass or fail; moving the pass line | made by hand |
| `missing.csv` | Blank and n/a results; a row with no task | made by hand |
| `broken.txt` | Not a results file | made by hand |
| `rows.json` | A JSON list with true/false and an ending column called "status" | made by hand |
| `junit-before.xml`, `junit-after.xml` | CI test reports with repeats inside one report (`test_x[2-5]`, as pytest-repeat writes them), dropped one after the other: before and after | made by hand |
| `junit-run1.xml` to `junit-run3.xml` | Three plain reports dropped together: three runs of one setup; a skipped test, an error, two classes with the same test name | made by hand |
| `promptfoo-output.json` | A real Promptfoo output file: 4 tests, 2 prompts, one run each | Promptfoo's own example, `examples/simple-cli/output.json` (MIT licence), copied unchanged from its repository at 6174c10 (13 Oct 2026) |
| `promptfoo-repeat5.json` | The same four tests as written by `--repeat 5`: each repeat its own row, tied by `repeatGroupId` | derived from `promptfoo-output.json`, following Promptfoo's `src/evaluator.ts` at 6174c10; pass/fail per repeat set by hand; responses removed |

Private test data is never stored here (`tests/private/` is ignored).
