# UI Design Intelligence Skill — Template Designer

## Use this skill for

Designing, changing, implementing, reviewing, auditing, or visually validating the Template Designer UI — any task that answers "what should the UI be, why, and how do we know it is right?".

Load this skill together with `.agents/skills/ui-ux-system/SKILL.md` for any UI task.

## Division of labor with other skills (no duplicate systems)

| Skill | Owns | Does not own |
|---|---|---|
| `ui-ux-system` | The product's visual and interaction language: what the product should look like and how it should behave per surface | Agent process, evaluation, decision memory |
| **`ui-design` (this skill)** | The design **intelligence process**: how to reason, decide, implement, audit, and QA UI work; where decisions are recorded | Product-language specifics (delegates to `ui-ux-system` + canonical docs) |
| `template-designer` | Product-level implementation rules and V1 boundary | UI-specific reasoning |

When a question is about product language ("what should the Deployment screen look like?"), the canonical answer lives in `ui-ux-system`, `docs/UI_REFERENCE.md`, and the reference screens. When the question is about process ("how do I decide, and how do I prove it is right?"), this skill applies.

## Source hierarchy (canonical reading order)

1. `AGENTS.md` — coding-agent contract (always first).
2. `Template Designer — Ana Proje Geliştirme Promptu.md` — authoritative V1 specification.
3. `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`, `docs/DOMAIN_MODEL_V1.md` — domain truth.
4. `docs/UI_DESIGN_SYSTEM_V2.md` — canonical UI specification. On conflict, `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` wins (its §13).
5. `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` — Canvas interaction contract (§4, §7.2 locked, §11).
6. `docs/BINDING_PARAMETRIC_SYSTEM_V1.md` — bindings.
7. `docs/UI_UX_ARCHITECTURE.md`, `docs/UI_UX_DECISIONS_V1.md` — UX architecture/early decisions.
8. `docs/UI_REFERENCE.md` + screenshots in `docs/*.png` — visual direction (reference, never pixel spec).
9. This skill's governance layers in `docs/design/`:
   - `UI_DESIGN_PRINCIPLES_V1.md` — principles, precedence, state honesty, token governance.
   - `UI_DESIGN_EVALUATION_V1.md` — rubric, gates, verdicts.
   - `UI_DESIGN_DECISION_LOG.md` — settled decisions (check before proposing anything).
   - `UI_DESIGN_ANTIPATTERNS_V1.md` — defect catalog (cite `AP-*` IDs in findings).
   - `UI_DESIGN_WORKFLOWS_V1.md` — Workflows A–G operating procedures.
10. Audit history (`DEEPSEEK_*`, `AGENT3_*`, `AGENT4_*`) — evidence of failure modes, not prescriptions.

## The reasoning pipeline (every UI task)

```text
1. Understand the workflow     Who, when, why, before/after; not "make a screen"
2. Map to domain truth         Which canonical entities/states are read/written?
3. Check the decision log      Is this already decided? (UI-D-* entries + canonical tables)
4. Architect                   Where does it live in the shell? Which panels/docks?
5. Design                      Spatial + visual treatment against the north star
6. Record the decision         UI-D- ID in docs/design/UI_DESIGN_DECISION_LOG.md
7. Implement                   Tokens only, canonical commands only, all states
8. Functional QA               Behavior first (empty/populated/dirty/error/disabled)
9. Audit                       Source-level: contract, tokens, state honesty
10. Visual QA                  Rendered: rubric D1–D16, gates G1–G5, verdict
```

Skipping steps is allowed only for trivial fixes; skipping the decision check (step 3) or the state-honesty discipline (steps 2/7) is never allowed.

## Decision hierarchy (binding)

1. Product requirements → 2. Domain/runtime contract → 3. Interaction contract → 4. Accessibility → 5. Information architecture → 6. Canonical design system → 7. Spatial consistency → 8. Visual hierarchy → 9. Aesthetic preference → 10. Decorative polish.

Aesthetic preference NEVER overrides correctness. A conflict with a canonical document is reported as `DOMAIN CONTRADICTION FOUND` — never silently resolved (corrections §13).

## State honesty (first-class rule)

Every visible control must truthfully represent the canonical state (availability, active, selected, disabled, saved, dirty, running, error, loading). Rules:

- Never create a visual affordance for functionality that does not exist. Unavailable feature: disable honestly (with reason) or hide.
- Never announce success before verification (Save, validation, deployment: `Preparing → Writing → Verifying → Completed`).
- UI state derives from canonical state only (single source of truth); transient editor state is preview-only and never a commit source.
- Empty states are single next-action commands (`Add Widget`, `Validate to check readiness`), not marketing text.
- Errors use problem + reason + location + action.

A surface containing a fake control fails evaluation regardless of its visual quality (gates G2/G4).

## Token governance (quick rules)

- Components consume semantic tokens only; raw values live exclusively in the token definition layer.
- No scattered constants: colors, spacing, radii, heights, shadows, font sizes.
- No hard-coded device values anywhere (no `720 × 1280`, no decode limits in components/docs).
- One recipe per control family (one button base, one input base, one focus treatment).
- New token/role = documented reason, recorded in the decision log.

## Before proposing any visual change (the redesign test)

Ask: does it improve **usability, hierarchy, consistency, discoverability, accessibility, information density, or interaction clarity**? If NO to all seven, reject it as decorative — regardless of how it looks.

## Anti-pattern quick gate

Before/while designing, check the proposal against `docs/design/UI_DESIGN_ANTIPATTERNS_V1.md`. The most common AI failures to self-check:

```text
AP-COMPONENT-03 fake controls      AP-STATE-01/02 state dishonesty/duplication
AP-CARD-01 cardification           AP-SPACE-01 arbitrary spacing
AP-COLOR-01 arbitrary colors       AP-TYPE-02 arbitrary typography
AP-ICON-02 glyph soup              AP-SHADOW-01/GLOW-01/GRADIENT-01/GLASS-01 decoration
AP-ARCH-02 unnecessary redesign
```

## Workflow selection

| Task | Workflow (docs/design/UI_DESIGN_WORKFLOWS_V1.md) |
|---|---|
| New UI feature | Workflow A |
| UI redesign | Workflow B |
| Visual bug fix | Workflow C |
| Full application UI audit | Workflow D |
| Component system refactor | Workflow E |
| Visual regression review | Workflow F |
| Accessibility review | Workflow G |

## Agent roles

When the task is large enough to warrant role separation, follow the agent organization in `.agents/agents/ui/`:

- `UI_ARCHITECT_AGENT.md` — workspace structure (shell, docking, panels).
- `UI_DESIGNER_AGENT.md` — what the UI should be (decisions + documentation).
- `UI_IMPLEMENTER_AGENT.md` — translating approved decisions into code.
- `UI_AUDITOR_AGENT.md` — source-level + usability problem finding.
- `UI_VISUAL_QA_AGENT.md` — rendered visual validation.

Handoff: PRODUCT REQUIREMENTS → UI ARCHITECT → UI DESIGNER → APPROVED DESIGN DECISION → UI IMPLEMENTER → FUNCTIONAL QA → UI AUDITOR → VISUAL QA → FINAL REVIEW. The implementer never silently redefines architecture or design; changes escalate to a recorded decision first.

## Evaluation summary (use the full rubric)

- Evidence: source-level AND rendered; a PASS needs both. Rendered-only/source-only caps at `PASS WITH WARNINGS`; no render target → `BLOCKED` (never PASS).
- Verdicts: PASS / PASS WITH WARNINGS / FAIL / BLOCKED.
- Hard gates (fail = FAIL regardless of looks): broken primary functionality (G1), fake controls (G2), canonical interaction violation (G3), state dishonesty (G4), any P0 unfixed (G5).
- Verification commands: `npm run typecheck`, `npm test`, `npm run build`, `npm run tauri:check` (this repo uses npm, not pnpm; blocked commands are reported, not faked).

## Reference library

Deep-dive references in `references/` next to this file:

- `spatial-design.md` — shell, docking, density, rhythm, Canvas dominance.
- `visual-hierarchy.md` — surfaces, borders, elevation, radius, type, color, icons.
- `component-design.md` — anatomy, variants, tokens, all state designs.
- `interaction-design.md` — selection, keyboard, focus, motion, synchronization.
- `accessibility.md` — the concrete accessibility bar.
- `visual-qa.md` — how to run the rendered validation.

## Hard stops (never do these)

- Never modify application code while producing design documentation (this system is docs-only by charter).
- Never invent product functionality to make a UI look complete.
- Never fake verification output (tests, builds, screenshots, fixtures).
- Never resolve a canonical contradiction silently.
- Never restyle a working surface without passing the redesign test.
