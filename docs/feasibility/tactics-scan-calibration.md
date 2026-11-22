# Tactic scan calibration (2026-11-23)

The source scan (`scripts/ingest_tactics_ranges.py`) was run on Mathlib at `fc4f59e`, the commit the `mathlib-initiative/mathlib-tactics` dataset is for, and compared with what Lean recorded when it compiled Mathlib.

- Declaration line ranges: `scripts/extract_env.lean` (807,065 constants, the same count as the old store), 451,562 with ranges.
- Ground truth: every dataset row (module, start line, elaborator) mapped to a label and attributed to every declaration whose Lean range contains the row's line (`scripts/calibrate_tactics_ranges.py`). The elaborator names are normalised first: the dataset writes some as `«_aux_Init_ByCases___macroRules_tacticBy_cases_:__2»`, which the old suffix match in `ingest_tactics.py` missed, so the old `tactics.u16` under-reports `by_cases` (427 declarations against 4,400 here).
- Compared: 347,049 Mathlib declarations covered by the scan (Init, Std, Lean, Batteries and Aesop are not in the dataset and are excluded).

| label | true pos | false pos | false neg | precision | recall |
|---|---|---|---|---|---|
| induction | 4402 | 9 | 8 | 0.9980 | 0.9982 |
| cases | 3494 | 3 | 3 | 0.9991 | 0.9991 |
| rcases | 6391 | 0 | 0 | 1.0000 | 1.0000 |
| obtain | 12708 | 0 | 2 | 1.0000 | 0.9998 |
| by_cases | 4400 | 1 | 1 | 0.9998 | 0.9998 |
| by_contra | 1032 | 0 | 0 | 1.0000 | 1.0000 |
| contrapose | 1293 | 0 | 0 | 1.0000 | 1.0000 |
| exfalso | 107 | 0 | 0 | 1.0000 | 1.0000 |
| fin_cases | 262 | 0 | 0 | 1.0000 | 1.0000 |
| split_ifs | 1269 | 0 | 0 | 1.0000 | 1.0000 |
| rintro | 6802 | 0 | 0 | 1.0000 | 1.0000 |
| match | 192 | 30 | 0 | 0.8649 | 1.0000 |

`match` is not published: its false positives are term-mode `match` expressions inside tactic blocks. The scan had two further rules added after a first calibration run showed the false positives: a term-mode `by_contra fun h => ...` / `by_cases (fun h => ...) fun ...` is the library function, not the tactic, and a keyword followed by `:=` (a named argument) or, for `exfalso`, by `:` (a structure field) is a name. They took by_contra from precision 0.976 to 1.000, by_cases from 0.995 to 0.9998 and exfalso from 0.973 to 1.000, and removed no true positive (recall unchanged).

Of the remaining induction false positives, the ones inspected were real uses the dataset did not record (`(by induction · <;> simp)`, where the tactic runs inside an anonymous function) or term-mode applications of a declaration named `induction`; not all nine were inspected.

The TypeScript port in `cli/tactics.ts` (used for your own library) agreed with the Python scan on all 14,243 sampled declarations.
