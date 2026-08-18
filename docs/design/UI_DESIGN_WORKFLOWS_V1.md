# Template Designer — UI Design Workflows V1

**Status:** Canonical workflow layer of the UI Design Intelligence System (Layer 8).
**Purpose:** Reusable, copy-paste-ready operating procedures for the recurring kinds of UI work. Each workflow names its inputs, required reading, steps, outputs, validation, and stop conditions so any future agent (or the agent organization in `.agents/agents/ui/`) can execute it deterministically.
**Rule:** A workflow is a procedure, not a license. Every workflow inherits the decision hierarchy and state-honesty rules of `UI_DESIGN_PRINCIPLES_V1.md`; no workflow may override a canonical document.

Common definitions used by all workflows:

- **Verification set:** `npm run typecheck`, `npm test`, `npm run build`, `npm run tauri:check` (record exact outputs; `tauri:check` may be BLOCKED when cargo is absent — report, do not fake).
- **Rendered evidence:** a running dev server or built app at realistic Windows sizes, with a populated fixture (widgets present) whenever Canvas behavior is in scope.
- **Decision gate:** any decision that changes canonical-adjacent behavior must be recorded in `docs/design/UI_DESIGN_DECISION_LOG.md` before it is implemented.
- **Conflict stop:** discovering a contradiction with a canonical document stops the workflow and produces a `DOMAIN CONTRADICTION FOUND` report (corrections §13). Never silently resolve.

---

## WORKFLOW A — New UI feature

**Inputs:**
- Feature request/requirement (who, what, why).
- Affected canonical concepts (device profile, widget, scene, binding, deployment state…).
- Current commit SHA on the working branch.

**Required reading (in order):**
1. `AGENTS.md`
2. `Template Designer — Ana Proje Geliştirme Promptu.md` (the relevant sections)
3. `docs/DOMAIN_MODEL_V1.md`, `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`
4. `docs/UI_DESIGN_SYSTEM_V2.md` + `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` (relevant sections)
5. `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` if the feature touches Canvas
6. `.agents/skills/ui-design/SKILL.md` + `.agents/skills/ui-ux-system/SKILL.md`
7. `docs/design/UI_DESIGN_DECISION_LOG.md` (settled decisions touching the feature)

**Steps:**
1. **Understand the workflow** the feature serves (who, when, why, what happens before/after).
2. **Map to domain truth:** which canonical entities/states the feature reads and writes; confirm the DeviceProfile capability really exists (no invented states/widgets).
3. **Architect** the surface placement (shell, panel, or existing surface) and workspace interaction — UI Architect Agent.
4. **Design** the spatial/visual treatment against the north star — UI Designer Agent; produce an **Approved Design Decision** (recorded with a `UI-D-` ID).
5. **Implement** through canonical commands/use cases only — UI Implementer Agent; tokens only, no one-off styles; implement all required states (§14 of PRINCIPLES), not just the happy path.
6. **Functional QA:** exercise the behavior (empty, populated, dirty, error, disabled, keyboard, cancel).
7. **Audit + Visual QA** against the evaluation rubric.
8. **Record** the design decision and any deviations in the decision log.

**Outputs:**
- Approved design decision (decision log entry).
- Implementation limited to the feature's scope.
- Evaluation report with verdict (PASS / PASS WITH WARNINGS / FAIL / BLOCKED).

**Validation:**
- Feature completes its real task through canonical state (no local duplicate state, no fake handlers).
- Verification set passes; rendered evidence collected.
- All gates G1–G5 pass (`UI_DESIGN_EVALUATION_V1.md` §4).

**Stop conditions:**
- The feature requires domain capability that does not exist in the DeviceProfile/domain contract → STOP, escalate (do not invent it).
- A canonical contradiction is found → `DOMAIN CONTRADICTION FOUND`, STOP.
- A gate fails → FAIL, remediate, re-run; never ship.
- Scope creep into unrelated surfaces → STOP, split the work.

---

## WORKFLOW B — UI redesign

**Inputs:**
- The surface(s) to redesign and the measured problem (usability, hierarchy, consistency, discoverability, accessibility, density, interaction clarity — at least one, with evidence).
- Current-state screenshots/measurements and the relevant audit findings (with IDs).
- Decision-log check for prior decisions about the surface.

**Required reading:** as in Workflow A, plus:
- `docs/design/UI_DESIGN_ANTIPATTERNS_V1.md` (what the surface must not become)
- The audit reports that motivated the redesign (`DEEPSEEK_*`, `AGENT3_/AGENT4_` reports)

**Steps:**
1. **Apply the redesign test first** (PRINCIPLES §18): if the change improves none of the seven qualities, STOP — no redesign.
2. **Document the baseline:** measurements, screenshots, and the defect IDs being fixed.
3. **Architect → Design → Approved Design Decision** (same as Workflow A, but explicitly enumerate what stays unchanged).
4. **Implement in the smallest coherent slice**; never restyle the whole shell to change one surface.
5. **Before/after evidence:** capture the same states before and after; diff against the north star and the reference screens.
6. **Audit + Visual QA**; re-run the full workflow's evaluation.

**Outputs:** baseline evidence, decision entry, changed surface only, before/after comparison, evaluation verdict.

**Validation:** every motivating defect is demonstrably fixed; no new anti-pattern introduced; unchanged surfaces are untouched (git diff proves it); gates pass.

**Stop conditions:**
- Redesign test fails (seven NOs) → STOP with a written rejection.
- No measurable defect can be named → STOP (aesthetic preference is not a redesign reason).
- The change would ripple into surfaces outside approval → STOP and re-scope.

---

## WORKFLOW C — Visual bug fix

**Inputs:** the visual defect (finding ID + severity + evidence label), the affected surface(s), the expected canonical behavior.

**Required reading:** the canonical section that defines the expected behavior; `UI_DESIGN_ANTIPATTERNS_V1.md` entry for the defect family.

**Steps:**
1. **Classify:** source-level (wrong state/command) vs rendered (wrong styling/layout) — see EVALUATION §1. Fix the true cause, not the symptom.
2. **Locate the divergence** from the canonical rule (cite section).
3. **Fix via the system:** token change for token defects; component-base change for component defects; command/state wiring for state defects. No local overrides.
4. **Check for siblings:** grep for the same defect pattern in other surfaces; fix or file them (do not silently expand scope).
5. **Verify:** verification set + rendered before/after at the affected window sizes.
6. **Record** the fix against the finding ID; if the fix required a decision, log it.

**Outputs:** minimal diff, before/after evidence, verification results, finding closed with evidence.

**Validation:** defect no longer reproducible (CONFIRMED); no regression in sibling surfaces; gates still pass.

**Stop conditions:**
- The "visual bug" is actually a missing feature → STOP, reroute to Workflow A (never fake the visual to hide the gap).
- The fix would violate a canonical rule → STOP, escalate.
- The defect can't be reproduced → mark UNVERIFIED and report; do not "fix" a phantom.

---

## WORKFLOW D — Full application UI audit

**Inputs:** target commit/branch, environment availability (browser/shell), populated fixture availability, prior audit reports.

**Required reading:** all canonical sources (Workflow A list), the full evaluation rubric (`UI_DESIGN_EVALUATION_V1.md`), the anti-pattern library, and prior audits for comparability.

**Steps:**
1. **Declare scope and method** (static + rendered; which fixtures; window sizes) — honest about what is unavailable.
2. **Run gates first** (G1–G5): primary loops, fake-control sweep, canonical interaction spot-checks, state-honesty sweep. A gate failure dominates the report.
3. **Score the 16 dimensions** (D1–D16) with evidence labels per finding.
4. **Cross-surface synchronization pass:** Explorer ↔ Canvas ↔ Properties ↔ Tabs ↔ Status Bar ↔ Console.
5. **Anti-pattern sweep** using the `AP-*` catalog; cite IDs.
6. **Severity-rank** all findings (P0–P3), deduplicate (same defect reported from multiple surfaces = one finding).
7. **Write the report** in the EVALUATION §7 format; one verdict.
8. **File remediations** as tracked findings; do not fix during the audit run itself (audit is read-only, matching the repository's audit discipline).

**Outputs:** the audit report (gates, dimension table, findings with IDs/severity/evidence labels, verdict, unverified list).

**Validation:** every finding cites a canonical rule or measurable defect; every finding has an evidence label; the verdict follows from the gates, not from intuition.

**Stop conditions:**
- Render target unavailable → deliver a source-level audit with verdict capped at `PASS WITH WARNINGS`/`BLOCKED`; state exactly what remains unverified. Never claim a rendered PASS.
- Audit scope would include application-code changes → STOP (audits do not fix; remediation is separate work).

---

## WORKFLOW E — Component system refactor

**Inputs:** the component inventory defect (e.g., "six button recipes", "three focus treatments"), affected surfaces, usage map.

**Required reading:** PRINCIPLES §11 (token governance), ANTIPATTERNS `AP-COMPONENT-*`, the canonical token table (`UI_DESIGN_SYSTEM_V2.md` §23), and the current component code.

**Steps:**
1. **Inventory:** list every variant/recipe of the component family with usage counts.
2. **Define the canonical anatomy** (base + named variants + states + sizes) as an **Approved Design Decision** (decision-log entry).
3. **Build the base and variants in the shared primitive layer.**
4. **Migrate surface by surface**, replacing one-offs; verify rendered equality (no pixel drift that matters) per surface.
5. **Delete dead CSS/classes** after migration (with `git grep` proof of zero usages).
6. **Audit:** confirm exactly one recipe per family remains; tokens only; states complete.
7. **Record** before/after counts in the decision entry.

**Outputs:** shared component base(s), migrated surfaces, removed one-offs, updated decision entry, audit verdict.

**Validation:** component inventory = 1 per family; verification set passes; rendered spot-checks across surfaces match the approved anatomy.

**Stop conditions:**
- A surface genuinely needs a different anatomy → that is a new variant decision, logged first, not a silent exception.
- Refactor touches behavior (not just presentation) → STOP, split into a functional workstream.

---

## WORKFLOW F — Visual regression review

**Inputs:** the change set (commit range), the surfaces it touches, baseline evidence (screenshots/measurements at the pre-change commit), the canonical sections governing those surfaces.

**Required reading:** EVALUATION rubric; the change's own decision entry if one exists; ANTIPATTERNS for the affected families.

**Steps:**
1. **Identify affected surfaces** from the diff (not from guesswork).
2. **Capture baseline vs current** evidence for identical states and window sizes (same fixture, same size, same state).
3. **Diff deliberately:** geometry → proportions → alignment → spacing → typography → surfaces → controls → states → Canvas → responsive behavior (the EVALUATION §6 sequence).
4. **Classify every delta:** intended (decision-log covered) vs unintended (finding). Unintended deltas get findings with severity + evidence labels.
5. **Behavioral spot-check:** interaction contract quick pass (selection, drag, keyboard, cancel) — visual changes must not break interaction.
6. **Verdict** with gates; recommend revert-or-fix for unintended regressions.

**Outputs:** regression review report with before/after evidence and findings.

**Validation:** every unintended delta is either fixed or filed with an ID; intended deltas are traceable to decisions.

**Stop conditions:**
- No baseline evidence exists → collect current state as the new baseline, mark the review BLOCKED-for-baseline, and report.
- A P0 regression is found → FAIL; do not proceed.

---

## WORKFLOW G — Accessibility review

**Inputs:** target surface(s) or the whole application, keyboard/mouse availability, prior a11y findings.

**Required reading:** `docs/UI_DESIGN_SYSTEM_V2.md` §24 (canonical accessibility), EVALUATION D12, ANTIPATTERNS `AP-ICON-*`/`AP-STATE-*`, `.agents/skills/ui-design/references/accessibility.md`.

**Steps:**
1. **Keyboard pass:** every surface focusable in order; visible focus ring distinct from selection; no dead keyboard zones (audit INT-31/32 are the failure archetypes: focus-hostage Delete/Arrows, focus dropped to body after delete).
2. **Focus containment:** modal Settings traps focus; Escape = Cancel documented and working.
3. **Label pass:** every icon-only control has accessible label + tooltip; every form field has label/unit/validation relation.
4. **Contrast pass:** measured contrast (not estimated) on all text and component pairs; ≥4.5:1 normal, ≥3:1 large/UI.
5. **Non-color pass:** selected/disabled/error/warning readable without color (structure/icon/text present).
6. **Pointer pass:** hit targets ≥24×24 for icon/tree/expander controls; Canvas precision editing still works.
7. **ARIA pass:** roles only where the real pattern exists; no fake tablist/tree roles (audit AX-03).
8. **Report** findings with severity + evidence labels; file remediations.

**Outputs:** accessibility review report; findings ranked and cited to canonical §24.

**Validation:** keyboard-only completion of a primary task demonstrated; all findings have evidence labels.

**Stop conditions:**
- The canonical widget pattern is absent from the stack → implement the real pattern or drop the roles; do not half-apply ARIA.
- A11y fix would conflict with canonical interaction → STOP, escalate (accessibility is tier 4; interaction is tier 3 — escalate, do not decide locally).

---

## Cross-workflow rules

1. Every workflow that produces a design decision writes it to the decision log with a `UI-D-` ID.
2. Every workflow that evaluates produces a verdict from `UI_DESIGN_EVALUATION_V1.md` — never an informal "looks good".
3. Every workflow that finds a fake control stops and reports; no workflow may ship or pass a surface containing one (gates G2/G4).
4. Verification commands are executed, not assumed; blocked commands are reported as BLOCKED with the exact reason.

## References

- [`UI_DESIGN_PRINCIPLES_V1.md`](UI_DESIGN_PRINCIPLES_V1.md), [`UI_DESIGN_EVALUATION_V1.md`](UI_DESIGN_EVALUATION_V1.md), [`UI_DESIGN_DECISION_LOG.md`](UI_DESIGN_DECISION_LOG.md), [`UI_DESIGN_ANTIPATTERNS_V1.md`](UI_DESIGN_ANTIPATTERNS_V1.md)
- [`../../.agents/agents/ui/UI_AGENT_ORGANIZATION.md`](../../.agents/agents/ui/UI_AGENT_ORGANIZATION.md) — which agent executes which workflow step
- [`../../.agents/skills/ui-design/SKILL.md`](../../.agents/skills/ui-design/SKILL.md) — the skill that loads for UI work
- [`../UI_DESIGN_SYSTEM_V2.md`](../UI_DESIGN_SYSTEM_V2.md) + [`../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`](../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md) — canonical behavior rules
