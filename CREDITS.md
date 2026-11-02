# Credits

CheckAgain's own code is under the MIT licence (see `LICENSE`). It includes or is derived
from the following, each under its own licence.

| What | Where it is used | Source | Licence |
|---|---|---|---|
| Terminal-Bench 2.0 leaderboard runs | `demo/note2-opus-deepseek.json`, the example reading: one row per run for two submissions (`Terminus2__Claude-Opus-4.6`, `Terminus2__DeepSeek-V3.2`), 61 tasks, fields copied as recorded by `scripts/make_demo.py` | Harbor's leaderboard repository `harborframework/terminal-bench-2-leaderboard`, revision 572b2614be2c0cb2527e14f5b1e4026f1072e6c1 | Apache License 2.0, `licenses/Apache-2.0.txt` |
| Terminal-Bench 4.0 runs on Harbor Hub | `trees/003/`, five trajectory-tree pages for note three, each embedding its runs' step labels, counts, costs and short text excerpts, drawn by the divergence viewer v0.12 (MIT) | Two public Harbor Hub jobs behind the Terminal-Bench 4.0.0 leaderboard, a1ac63a1-8a9b-4bc7-9906-2b63657ee1c2 and 96ad98a5-70e6-5e7b-bd1e-67eecfbc644c | No licence stated by Harbor Hub (terms of 10 July 2026); licence requested from the Terminal-Bench maintainers on 2 November 2026; removed at the owners' request |
| τ²-bench retail results | `tests/cases/tau2-retail-3models.csv`, a test case: six fields per run, copied as recorded by `scripts/make_tau2_case.py` | Sierra Research, `sierra-research/tau2-bench` at commit 5bfa7e37 | MIT, `licenses/tau2-bench-MIT.txt` |
| Promptfoo example output | `tests/cases/promptfoo-output.json` (copied unchanged) and `tests/cases/promptfoo-repeat5.json` (derived from it) | Promptfoo, `promptfoo/promptfoo` at 6174c10, `examples/simple-cli/output.json` | MIT, `licenses/promptfoo-MIT.txt` |
| Cormorant Garamond | `fonts/cormorant-*.woff`: weights 400 and 500 and italic 400, taken from the variable font and cut to Latin | the Cormorant Project Authors (github.com/CatharsisFonts/Cormorant), from Google Fonts' repository `google/fonts`, `ofl/cormorantgaramond` | SIL Open Font License 1.1, `fonts/OFL-CormorantGaramond.txt` |
| Space Mono | `fonts/spacemono-*.woff`: regular and bold, cut to Latin | The Space Mono Project Authors (github.com/googlefonts/spacemono), from `google/fonts`, `ofl/spacemono` | SIL Open Font License 1.1, `fonts/OFL-SpaceMono.txt` |

Changes made to third-party material: the runs were reduced to the fields CheckAgain reads
(the values are as recorded, nothing rounded or cleaned); the fonts were cut to Latin
characters; the derived Promptfoo file follows the layout Promptfoo writes with `--repeat`,
with pass or fail set by hand and responses removed. The example reading's counts are
CheckAgain's own reading of the public runs, not a statement by the benchmark's makers.
