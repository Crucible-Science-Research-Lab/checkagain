---
name: checkagain
description: Use when someone wants to know whether their AI agent's results hold up when run again, whether a change (model, prompt, harness) really made it better or worse, or wants their eval results ready for CheckAgain. Finds results they already have, or writes a small script that runs their own cases five times before and after a change, and produces one CSV that CheckAgain reads.
---

# CheckAgain: get an agent's results ready to check

CheckAgain (https://checkagain.cruciblescience.com, by Crucible Science) is a free page that
shows which tasks pass every time, sometimes or never, and whether a change really moved
anything or is not clear yet. It runs in the person's browser; the file never leaves it.
Your job is to produce the file it reads. You do not upload anything yourself.

## What the file must contain

One CSV, one row per run, with these columns:

| column | required | what goes in it |
|---|---|---|
| `task` | yes | a short, stable name or id for the case (the same name every time it runs) |
| `setup` | for a comparison | which version ran: e.g. `before` / `after`, or the model name |
| `run` | yes | 1, 2, 3… for each repeat of the same task and setup |
| `passed` | yes | `pass` or `fail` (or true/false, 1/0) |
| `ended` | optional | `completed` if the run stopped by itself; otherwise what stopped it (`timeout`, `error`…) |
| `cost_usd` | optional | the cost of that run as recorded by the provider; leave empty if not recorded, never estimate |

Five runs of each task for each setup is the minimum that can show a clear change. Three
runs can never show one. Ten to twenty tasks is a good start.

## Rules you must keep

1. **Only labels and outcomes go in the file.** Task names or ids, setup labels, run numbers,
   pass or fail, how the run ended, cost. Never prompts, model outputs, conversation text,
   tool results, customer data, file contents, keys or tokens.
2. **Nothing is sent anywhere.** Write the CSV to the person's machine and tell them where it
   is. They open CheckAgain and drop it in themselves.
3. **Never invent or tidy results.** Every row is a run that really happened, with the result
   it really had. If a run crashed, it failed; record how it ended.
4. **Ask before spending money or time.** Before running anything, say how many agent calls it
   will make (tasks × runs × setups) and roughly what that costs, and wait for a yes. For a local or
   free model the cost is time: say roughly how long the runs will take, from one timed case or a
   time the person already knows.
5. **Pass or fail comes from a check the person already trusts**: their existing test, assertion
   or grader. If there is none, agree a plain rule with them first. Do not use a model as the
   judge unless they ask for it.

## Steps

### 1. Look for results they already have

Search the project for existing eval or test output: CSV, JSON or JSONL result files, CI test
reports (JUnit XML), eval tool output folders, notebooks that log results. Ask the person
where their results live if nothing obvious turns up.

- **Already repeated runs?** (several results per case, e.g. a repeat, epochs or trials
  setting): convert them to the CSV above. Done; go to step 4.
- **Test reports from CI?** CheckAgain reads JUnit XML directly. Run the suite five times
  (`pytest --junitxml=run1.xml`, `run2.xml`, …) or with a repeat plugin; no CSV needed.
- **Only one run per case, or nothing written down?** Go to step 2.

### 2. Write a small runner, in their project

Write one short script (in the project's own language) that:

- holds the list of cases: reuse their existing test cases or eval set; if they check by hand,
  ask for the 10 to 20 cases they try after a change;
- calls their agent the way their code already does, for each case, five times: import and call
  their own function, so every prompt, retry and fallback stays in. Never rebuild the model call or
  copy the prompt into the runner; that tests a copy, not their agent;
- decides pass or fail with their existing check (rule 5);
- takes the setup label from a flag or environment variable (`--setup before`), so the same
  script runs before and after the change;
- appends each run to the CSV as soon as it finishes, so a stopped script can resume;
- records `ended` (completed, timeout, error) and `cost_usd` when the client returns it.

Keep it small and readable. Show it to the person before running it (rule 4).

### 3. Run it, before and after

Run it once with the current setup (`--setup before`). After the person makes their change
(model, prompt, harness, settings), run it again with `--setup after`, writing to the same CSV.
If the runs will take more than a few minutes, give the person the exact command to start it in
their own terminal, and run it yourself only if they prefer.

### 4. Check the file, then hand it over

Run the checker that comes with this skill:

```
python3 scripts/check_results.py results.csv
```

It prints `ok` lines and warnings, and ends with `READY for CheckAgain` when the file is good.
Fix anything it flags. Then tell the person: "Open https://checkagain.cruciblescience.com and
drop `results.csv` on the box." Do not summarise the result for them before they see it; the
page does the counting and the tests.
