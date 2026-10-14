# CheckAgain

**It passed once. Would it pass again?**

A reliability check for your AI agent, from the results you already have. Run each task
several times, before and after a change, and CheckAgain shows which tasks pass every time,
sometimes or never, and whether the change really moved anything or is not clear yet.

**Use it at [checkagain.cruciblescience.com](https://checkagain.cruciblescience.com).**
It runs in your browser. Your file never leaves it: nothing is uploaded and there is no
account.

## Why this exists

Agents don't do the same thing twice. Run one task five times and it may pass three. A single
pass rate hides that: it can't tell you which tasks you can count on and which just happened to
pass on the day you tested.

That matters most when you change something. You switch to a cheaper model, edit a prompt or
try a new harness, and the score moves a point or two. Did it get worse, or is that noise?
Which tasks broke? And did the cheaper model save money once you count the runs that fail?

## What you get

- which tasks pass every time, sometimes or never
- for a before and after, which changes are clear and which are not clear yet, with the test
  behind each
- how often a run stopped by itself and was wrong, if your file says how runs ended
- what a finished task costs, not just a run
- a report you can forward (one HTML file, no scripts) and a summary line to paste anywhere

With one run per task, the page says what one run can and can't show, and asks for five.

## How to use it

1. Take the 10 cases you already try by hand after a change.
2. Run each one five times, before and after your change, and mark pass or fail.
3. Paste the results into the box, straight from your spreadsheet, or drop the files.

Too many to run by hand? The page has two prompts to copy into your coding assistant, and a
skill (`skill/checkagain-skill.zip`, under the open Agent Skills standard) that writes a small
script to run your own cases five times and checks that the file is ready.

## What it reads

Any CSV, TSV, JSON or JSON Lines file with one row per run (task, run, passed; optionally
setup, how the run ended, cost). Columns are guessed and can be corrected before anything is
read. It also recognises, without being told:

- CI test reports in JUnit XML (pytest `--junitxml`, Jest, Vitest, Go and most CI tools); reports
  dropped together are runs of one setup, a second batch is "after"
- Promptfoo JSON output, including `--repeat`
- Harbor job folders (only each run's `result.json` is read; the step logs are never opened)

A blank sheet with the right columns can be downloaded from the page.

## How it decides

- **Each task:** [Fisher's exact test](https://en.wikipedia.org/wiki/Fisher%27s_exact_test)
  (two-sided), a standard test for small counts: it asks how often a gap as big as the one
  between passes before and passes after would turn up if nothing had changed and runs simply
  varied. A change is "clear" below p = 0.05 (less than 1 time in 20); otherwise it is "not
  clear yet". With five runs a side, 5 of 5 to 1 of 5 is clear (p = 0.048); 5 of 5 to 2 of 5
  is not (p = 0.167).
- **The whole change:** a [sign test](https://en.wikipedia.org/wiki/Sign_test) over the tasks
  that moved: if the change did nothing, tasks would move up as often as down, so a lopsided
  split is the signal. When many tasks are tested at once, a few single-task "clear" labels can
  be noise, so the headline rests on this one test.
- **Five runs per setup is the minimum we suggest.** With three, nothing can ever be called
  clear (3 of 3 to 0 of 3 gives p = 0.100).
- **Cost per finished task** is everything spent divided by the runs that passed; the failed
  runs are paid for too. Recorded cost only, never estimated.

It says what moved, never why. It doesn't run your agent or grade answers with a model.

## Privacy

Everything is computed in your browser. The page loads nothing from any other site (fonts
included). The only thing it ever sends is the email typed into "Get a reading of your own
agent", and only when that button is pressed (it goes to the form service Formspree, which
emails it to us). Column choices may be remembered in your browser's local storage, nothing
else.

## Run it yourself

It is a static site in plain JavaScript, with no build step and no dependencies.

```
git clone https://github.com/Crucible-Science-Research-Lab/checkagain.git
cd checkagain
python3 -m http.server 8000
```

Then open http://localhost:8000. Opening `index.html` straight from disk won't load the example.

**Checks.** `check.html` (http://localhost:8000/check.html) runs 64 checks before every release:
fixed cases for both tests against SciPy, the example against the published report it comes
from, note one's τ²-bench runs read through the same door as a user's file, and a set of
awkward files in `tests/cases/` (see its README). Every line must say ok.

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | the page |
| `stats.js` | the arithmetic only (works in the browser and in Node) |
| `reader.js` | every input format, turned into rows |
| `check.html` | the checks |
| `demo/` | the example: public Terminal-Bench 2.0 runs of one coding agent, Claude Opus 4.6 against DeepSeek V3.2, 61 tasks, five runs each, every run as recorded |
| `scripts/` | how the example and the τ²-bench test case were built from the public data |
| `skill/` | the skill and its checker |
| `tests/cases/` | the case tests |
| `fonts/` | Cormorant Garamond and Space Mono, as on the Crucible Science site (SIL Open Font License) |

## Where it comes from

The method was first used in two public analyses of published agent runs by Crucible Science:
[note one](https://github.com/Crucible-Science-Research-Lab/divergence/blob/main/experiments/001-tau-retail/NOTE.md)
on a customer-service agent, and
[note two](https://github.com/Crucible-Science-Research-Lab/divergence/blob/main/experiments/002-terminal-bench/NOTE.md)
on a coding agent run five times per task with Claude Opus 4.6 and four cheaper models. Of 33
tasks Opus passed on all five runs, the cheaper models passed 11 to 20 on all five. The example
on the page is drawn from that data; its counts are CheckAgain's own reading of the public runs.

## Who made it

Crucible Science, an independent research lab in Pune, India, working on how AI agents hold up in
production. CheckAgain is free. We also sell the same reading applied to a team's own agent,
together with the fix. If that's useful, write to ashwin@cruciblescience.com, or use the form on
the page (the first five agents are free).

## Licence

MIT (see `LICENSE`). Third-party data, test files and fonts are listed with their licences in
`CREDITS.md`.
