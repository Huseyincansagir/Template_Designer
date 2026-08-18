# Template Designer — UI Design Evaluation V1

**Status:** Canonical evaluation layer of the UI Design Intelligence System (Layer 5).
**Purpose:** A formal, reusable rubric for judging Template Designer UI work — usable by the UI Auditor Agent, the UI Visual QA Agent, reviewers, and any future agent asked "is this UI good enough?".
**Scope:** Evaluation only. This document defines no product features and no application code.

## 1. Two kinds of correctness

Every evaluation must state which kind of evidence it used:

| Kind | Definition | Typical evidence |
|---|---|---|
| **Source-level correctness** | The code expresses canonical behavior: real state flow, real commands, no fake handlers, token usage, a11y attributes | Static inspection, tests, `npm run typecheck`, command traces |
| **Rendered visual correctness** | The running application actually looks and behaves correctly at realistic Windows sizes | Browser/dev-server run, screenshots, measured geometry, pointer/keyboard exercises |

Source-level correctness does **not** imply rendered correctness, and rendered correctness does **not** prove source-level correctness (a fake control can be rendered beautifully). **A verdict of PASS requires both kinds of evidence**; if only one kind is available, the verdict is at most `PASS WITH WARNINGS` or `BLOCKED` (see §5).

## 2. Severity levels

Align with the repository's audit convention (`DEEPSEEK_UI_UX_AUDIT.md`):

| Level | Meaning | Gate effect |
|---|---|---|
| **P0 — Critical** | Breaks a primary task, canonical interaction behavior, or state honesty; data loss; deployment/validation lies | Any P0 → `FAIL` (hard gate G1–G5) |
| **P1 — High** | Violates a confirmed canonical rule or makes a main task significantly harder | Blocks `PASS`; typically blocks `PASS WITH WARNINGS` when unremedied at review time |
| **P2 — Medium** | Consistency, hierarchy, accessibility, or usability defect with real but limited impact | Allowed only in `PASS WITH WARNINGS`, with a recorded remediation |
| **P3 — Low** | Polish, micro-spacing, non-blocking refinement | Never blocks `PASS` by itself |

Every finding must carry an evidence label, copied from the audit discipline of this repository:

| Label | Meaning |
|---|---|
| `CONFIRMED` | Reproduced by execution, measurement, or a passing failing test |
| `UNVERIFIED` | Static signal or single-observation evidence; needs runtime confirmation |
| `NOT APPLICABLE` | The dimension cannot be evaluated in the current state (record why) |

A finding without an evidence label is not a finding — it is an opinion.

## 3. Evaluation dimensions (16)

Score each dimension 0–5 using the anchors below. A dimension scored **0 or 1** is a blocking defect; **2** is a documented warning; **3–4** is acceptable with noted weaknesses; **5** is exemplary and rare.

### D1. Information Architecture
Does the surface hierarchy match the canonical model (Project → Theme Project Group → Theme Project → R0–R270 → Scene → Widget) and the product workspaces? Can the user answer "where am I / what am I editing" immediately?
- 0–1: Wrong or invented hierarchy; canonical concepts merged (State vs Scene, Bounding Group vs grouping) or replaced; navigation leads nowhere.
- 3: Correct hierarchy, minor discoverability issues.
- 5: Canonical hierarchy is obvious, consistent with Explorer, tabs, and Inspector.

### D2. Spatial Architecture
Shell stability, panel roles (Explorer / Canvas / Inspector / Console / Status), docking grammar, workspace persistence.
- 0–1: Shell layout invents a new structure; docking destroys content; resize distorts the device preview.
- 3: Canonical shell present with minor proportion issues.
- 5: Stable IDE/CAD shell; docking, tabs, splits behave per canonical §3.

### D3. Visual Hierarchy
One focal point per surface; weight proportional to importance; the six questions answerable by hierarchy alone.
- 0–1: Competing accents, decoration dominates content, no focal point.
- 3: Hierarchy correct but weak in one region.
- 5: Hierarchy works across all states and surfaces.

### D4. Alignment
Grid/edge/baseline alignment across panels, rows, labels, controls.
- 0–1: Rows/headers/tabs misalign across surfaces; ad hoc offsets everywhere.
- 3: Mostly aligned; isolated misalignments.
- 5: Every row family sits on the shared rhythm.

### D5. Spacing
4/8 rhythm; one value per recurring row type; consistent gaps, padding, insets.
- 0–1: Arbitrary spacing; multiple row heights for the same row type.
- 3: Token-driven with a few outliers.
- 5: Fully tokenized rhythm, no outliers found.

### D6. Density
Engineering-application density: compact, breathable, readable; no wasted space; no cramping.
- 0–1: Sparse marketing layout or unreadably cramped; content pushed below the fold.
- 3: Appropriate density with local imbalances.
- 5: Professional density preserved at realistic window sizes.

### D7. Typography
Token type scale; ≤ ~5–6 sizes per surface family; ≥10 px minimum; AA contrast; legible system font; distinguishable numerics.
- 0–1: Ad hoc sizes; <10 px text; failing contrast pairs; decorative letter-spacing/caps.
- 3: Mostly tokenized; one or two contrast or size outliers.
- 5: Scale, contrast, and legibility verified by measurement.

### D8. Surface System
Named surface levels; 1 px subtle borders; ≤3 elevation tokens; low consistent radii.
- 0–1: Raw colors, raw shadows, mixed radii, decorative borders/glows.
- 3: Token families present with minor drift.
- 5: Semantic surface/border/elevation/radius tokens fully applied.

### D9. Component Consistency
One base recipe per control family; consistent variants, heights, focus treatment, disabled treatment.
- 0–1: Multiple recipes per concept (e.g., several button styles); per-surface one-offs.
- 3: Consistent with isolated exceptions.
- 5: Every recurring control shares its base; variants are deliberate.

### D10. Interaction
Selection, marquee, drag/resize, snapping, z-order, keyboard, cancel semantics, hit targets, affordances.
- 0–1: Violates the canonical interaction contract (AGENT2 §4) or §19 shortcuts; fake shortcuts; dead menu items.
- 3: Contract honored; minor affordance or focus gaps.
- 5: Canonical interaction behavior fully verifiable by exercise.

### D11. State Honesty
Every visible control truthfully reflects availability, active/selected/disabled/saved/dirty/running/error/loading state; no fake controls; disabled with reason; `Unresolved` kept visible; single source of truth; cross-surface synchronization.
- 0–1: Any fake control, misleading status (e.g., "Saved" without persistence, success before verification), dead setting, or cross-surface divergence.
- 3: Honest states with one or two presentation weaknesses.
- 5: State honesty verified against the canonical state registry in every surface.

### D12. Accessibility
Keyboard operability, visible focus (distinct from selection), accessible labels/tooltips, contrast, non-color-only state, focus containment in modals, ARIA roles where applicable.
- 0–1: Focus traps broken, no focus visibility, icon-only controls without labels, color-only status, modal focus escapes.
- 3: Core a11y present; a few labels/roles missing.
- 5: Canonical §24 fully implemented and exercised by keyboard.

### D13. Discoverability
Main task obvious without explanation; progressive disclosure; empty states point to the next action; tooltips where needed.
- 0–1: Primary task requires documentation to find; empty states are marketing text.
- 3: Task discoverable; some controls buried.
- 5: First-time user can complete the primary loop without help.

### D14. Responsive Behavior
Realistic Windows window sizes; panels collapse/tab before content breaks; Canvas keeps aspect ratio and priority; no silent runtime-context changes on resize.
- 0–1: Layout breaks at normal sizes; device preview distorts; resize changes context.
- 3: Works at target sizes; narrow sizes degrade poorly.
- 5: Graceful across the realistic range, verified by measurement.

### D15. Canvas Dominance
The device preview is visually central and dominant; chrome is subordinate; grid/guides/selection are restrained and non-competing.
- 0–1: Panels dominate; canvas small or cluttered; overlay chrome louder than content.
- 3: Canvas dominant with one chrome issue.
- 5: Editor chrome reads as scaffolding around a dominant, real device preview.

### D16. Visual Polish
Micro-details: truncation with tooltips, consistent microcopy, no dead CSS/classes, no stray debug visuals, professional finish.
- 0–1: Debug remnants, dead classes, inconsistent microcopy, stray markers.
- 3: Polished with minor blemishes.
- 5: Production-grade finish.

## 4. Hard gates (non-negotiable)

A UI **cannot pass** visual QA when any of the following is true — regardless of scores:

| Gate | Condition | Rationale |
|---|---|---|
| **G1** | Primary functionality of the surface is broken (the core task cannot be completed) | A UI whose primary loop is impossible is not a UI |
| **G2** | Fake controls exist: any visible affordance with no real behavior behind it | State honesty is the product's trust contract |
| **G3** | Canonical interaction/domain behavior is violated (AGENT2 §4, corrections §8, canonical §19 shortcuts, domain model boundaries) | Canonical contracts outrank visual preference |
| **G4** | State dishonesty: UI claims state the canonical state does not have (e.g., "Saved" without persistence, "Verified" before verification, status LEDs not derived from real state) | Derived from AGENTS.md "never claim success before verification" |
| **G5** | Any P0 finding remains unfixed at review time | P0 is defined as blocking |

Gates are evaluated first. If a gate fails, the verdict is `FAIL` even if all 16 dimensions score 5: a beautiful fake is still a fake.

## 5. Verdicts

| Verdict | Definition | When used |
|---|---|---|
| **PASS** | All gates pass; all dimensions ≥ 3; both source-level and rendered evidence present | Complete, shippable UI work |
| **PASS WITH WARNINGS** | All gates pass; all dimensions ≥ 2; remaining findings are P2/P3 and are recorded with IDs in the decision log/issue tracking | Shipping decision is the human's, not the evaluator's |
| **FAIL** | Any gate fails, any P0/P1 unremedied, or any dimension ≤ 1 | Must remediate and re-audit; never silently downgrade to warnings |
| **BLOCKED** | Evaluation could not reach a verdict for environmental reasons (no render target, no browser, cargo unavailable, no populated fixture) | An honest non-verdict; explicitly NOT a PASS. Report the exact blocking condition |

**Rule:** `BLOCKED` may never be upgraded to `PASS` by static reasoning. If the environment cannot render, say so and report which gates remain unverified.

## 6. Visual review workflow (the 17 steps)

The canonical sequence for rendered-visual validation:

```text
 1. Render the application                (dev server / built app / Tauri shell, as available)
 2. Capture representative states         (empty, populated, selected, dirty, loading, error, deployment)
 3. Compare against the visual north star (docs/design/UI_DESIGN_PRINCIPLES_V1.md §2 + reference screens)
 4. Inspect global composition
 5. Inspect panel proportions
 6. Inspect alignment
 7. Inspect spacing
 8. Inspect typography
 9. Inspect surfaces                      (borders, elevation, radius, background layers)
10. Inspect controls                      (heights, variants, focus, disabled, hover/active)
11. Inspect states                        (selection, empty, loading, error, unsupported, unavailable)
12. Inspect the Canvas                    (dominance, aspect ratio, grid/snap, guides, selection)
13. Inspect responsive states             (resize window; collapse/tab behavior; aspect preserved)
14. Rank defects                          (severity + evidence label per §2)
15. Fix                                   (through the approved agent path; see workflows)
16. Re-render
17. Re-audit                              (until gates pass; record before/after evidence)
```

Measure, do not eyeball, where a dimension is quantitative: panel widths vs Canvas, row heights, font sizes, contrast ratios, hit-target sizes, and alignment offsets should be read from the rendered DOM/styles or from screenshots with known scale. Qualitative judgement is reserved for hierarchy, character, and polish.

Verification command set (record exact outputs; a substituted script name must be documented):

```bash
npm run typecheck     # source-level correctness
npm test              # deterministic behavior (this repo uses npm, not pnpm)
npm run build         # production build
npm run tauri:check   # may be BLOCKED when cargo is unavailable — report, do not fake
```

A browser smoke against a **populated fixture** (widgets present) is required for rendered correctness of Canvas work; an empty shell proves nothing about interaction (AGENT3_FINAL_CANVAS_QA_REPORT.md, §Final Gate). If no populated fixture exists, that is an evidence gap to report, not a result to invent.

## 7. Reporting format

Every evaluation report must contain:

1. Scope and baseline (commit SHAs, branch, what was evaluated).
2. Evidence environment (browser/shell versions, window sizes, fixtures).
3. Gate results (G1–G5, each PASS/FAIL/NOT EVALUATED + why).
4. Dimension table (D1–D16 with scores and one-line justification).
5. Findings list: `ID | severity | dimension | evidence label | problem | expected | actual | fix direction`.
6. Verdict (§5) — exactly one.
7. Unverified items (honest list; do not convert into findings or dismiss them).
8. References to canonical sources used for each gate/dimension decision.

## 8. Reuse and automation

- Future audits must reuse dimension IDs (D1–D16), severity levels, evidence labels, and gates verbatim so results stay comparable across audits.
- Prior audit evidence may be cited (`DEEPSEEK_UI_UX_AUDIT.md`, `DEEPSEEK_FUNCTIONAL_AUDIT.md`, `DEEPSEEK_E2E_INTEGRATION_AUDIT.md`, `AGENT4_INTEGRATION_REGRESSION_REPORT.md`, `AGENT3_FINAL_CANVAS_QA_REPORT.md`) but must be re-verified for the audited commit — historical findings are principles input, not live findings.

## References

- [`UI_DESIGN_PRINCIPLES_V1.md`](UI_DESIGN_PRINCIPLES_V1.md) — north star, precedence, state honesty (gates derive from it)
- [`UI_DESIGN_ANTIPATTERNS_V1.md`](UI_DESIGN_ANTIPATTERNS_V1.md) — detection catalog used when classifying findings
- [`UI_DESIGN_WORKFLOWS_V1.md`](UI_DESIGN_WORKFLOWS_V1.md) — Workflows B/D/F formalize audit/QA runs
- [`../UI_DESIGN_SYSTEM_V2.md`](../UI_DESIGN_SYSTEM_V2.md) §22–§26 — canonical visual/state/validation rules
- [`../AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md`](../AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md) §4 — canonical interaction contract
- [`../../DEEPSEEK_UI_UX_AUDIT.md`](../../DEEPSEEK_UI_UX_AUDIT.md) — severity/evidence-label convention origin
- [`../../.agents/agents/ui/UI_VISUAL_QA_AGENT.md`](../../.agents/agents/ui/UI_VISUAL_QA_AGENT.md) — operating procedure using this rubric
