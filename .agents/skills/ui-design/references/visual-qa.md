# Reference — Visual QA (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_EVALUATION_V1.md` (the full rubric — this reference is the field manual). Executed by the UI Visual QA Agent per `.agents/agents/ui/UI_VISUAL_QA_AGENT.md`.

## 1. Two kinds of correctness (never conflate)

| Kind | Question | Evidence |
|---|---|---|
| Source-level | Does the code express canonical behavior? | Static inspection, tests, typecheck, command traces |
| Rendered | Does the running app look/behave right? | Run + screenshots + measurements + pointer/keyboard exercises |

- Source-pass ≠ rendered-pass (the AGENT3 renderer/transform mismatch was invisible statically).
- Rendered-beautiful ≠ correct (fake Save renders beautifully).
- **PASS requires both.** One kind alone caps at `PASS WITH WARNINGS`; no render target → `BLOCKED` (never PASS).

## 2. Running the 17-step review

```text
1 Render → 2 Capture states → 3 Compare north star → 4 Global composition
→ 5 Panel proportions → 6 Alignment → 7 Spacing → 8 Typography → 9 Surfaces
→ 10 Controls → 11 States → 12 Canvas → 13 Responsive → 14 Rank defects
→ 15 Fix → 16 Re-render → 17 Re-audit
```

Capture matrix (representative states, same window size for comparability):

```text
Empty project        Populated scene      Single selection     Multi selection
Dirty document       Clean document       Loading state        Error state
Unsupported profile field   Deployment: preparing/writing/verifying/completed
Window sizes: default (e.g. 1440×900), wide, narrow (~1024×768), console open/closed
```

Quantitative dimensions are **measured** (DOM rects/computed styles or screenshots at known scale): panel widths vs Canvas, row/header/tab heights, font sizes, contrast ratios, hit-target sizes, alignment offsets. Qualitative judgement is reserved for hierarchy, character, and polish.

## 3. Gates first (G1–G5), always

1. G1: primary task completable? (run the real loop — e.g., create → add widget → edit → validate)
2. G2: fake-control sweep: trace every visible control to a real command and canonical state.
3. G3: canonical interaction spot-checks (AGENT2 §4: keyboard table, threshold/cancel, z-order, snapping).
4. G4: state-honesty sweep: every status label vs canonical state (saved/dirty/valid/verified).
5. G5: any P0 outstanding?

A gate failure = `FAIL` even if all 16 dimensions look perfect. Gates before aesthetics, every time.

## 4. The 16 dimensions (score 0–5)

D1 Information Architecture · D2 Spatial Architecture · D3 Visual Hierarchy · D4 Alignment · D5 Spacing · D6 Density · D7 Typography · D8 Surface System · D9 Component Consistency · D10 Interaction · D11 State Honesty · D12 Accessibility · D13 Discoverability · D14 Responsive Behavior · D15 Canvas Dominance · D16 Visual Polish.

Anchors: 0–1 blocking defect · 2 documented warning · 3–4 acceptable with noted weaknesses · 5 exemplary. Score from evidence, not impression.

## 5. Findings discipline

Every finding: `ID | severity (P0–P3) | dimension | evidence label | problem | expected | actual | fix direction`.

- Evidence labels: `CONFIRMED` (reproduced/measured), `UNVERIFIED` (static signal), `NOT APPLICABLE` (state why).
- Deduplicate: the same defect seen from four surfaces is one finding (audit convention, e.g. TB-01/02 absorbing GL-06/CV-07).
- Cite anti-pattern IDs (`AP-*`) where a catalog entry matches.
- Historical audit findings are re-verified against the audited commit — cited as background, never copied as live findings.

## 6. Browser/verification discipline

```bash
npm run typecheck
npm test            # repo uses npm (no pnpm lockfile)
npm run build
npm run tauri:check # report BLOCKED if cargo is unavailable; never fake
```

- Canvas interaction QA requires a **populated fixture**; an empty shell proves nothing (AGENT3 §Final Gate).
- If the render target is unavailable: source-level audit + `BLOCKED`, listing exactly which gates/dimensions remain unverified. Never upgrade to PASS by reasoning.
- Do not invent a fixture, a screenshot, or a test result.

## 7. Verdict

Exactly one of:

- **PASS** — gates pass; all dimensions ≥3; source + rendered evidence.
- **PASS WITH WARNINGS** — gates pass; dimensions ≥2; remaining P2/P3 findings recorded with IDs; shipping is the human's call.
- **FAIL** — any gate failed, any P0/P1 unremedied, or any dimension ≤1. Remediate + re-audit; never downgrade silently.
- **BLOCKED** — environment prevented a verdict; report the exact blocking condition.

## 8. Report skeleton

```text
1. Scope & baseline (commits, branch, surfaces)
2. Environment (browser/shell, window sizes, fixtures)
3. Gates G1–G5 (PASS/FAIL/NOT EVALUATED + why)
4. Dimension table D1–D16 (scores + one-line justification)
5. Findings (ID | severity | dimension | label | problem | expected | actual | fix)
6. Verdict (one)
7. Unverified items (honest list)
8. Canonical sources cited per decision
```

## 9. Quick self-check (QA)

```text
□ Both evidence kinds collected? (else verdict capped/BLOCKED)
□ Gates evaluated before aesthetics?
□ Quantitative dimensions measured, not eyeballed?
□ Every finding has severity + evidence label + canonical reference?
□ Populated fixture used for Canvas work?
□ Verification commands executed and outputs recorded?
□ Exactly one verdict, consistent with the gates?
```
