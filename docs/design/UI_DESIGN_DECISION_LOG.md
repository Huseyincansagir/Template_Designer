# Template Designer — UI Design Decision Log

**Status:** Canonical decision-memory layer of the UI Design Intelligence System (Layer 6).
**Purpose:** Prevent future agents from repeatedly reconsidering settled decisions. Every design decision that costs reasoning effort gets one indexed entry; agents consume the log before proposing, implementing, or auditing UI work.
**Rule:** This log *indexes and records* decisions. It never re-decides what a canonical document already decided, and it never silently changes history. Canonical documents remain the authority; this log is the memory of where the decisions live and what was settled.

## 1. Entry format

Every entry MUST contain:

| Field | Meaning |
|---|---|
| `ID` | `UI-D-NNNN`, sequential, never reused |
| `Topic` | Short label |
| `Context` | What prompted the decision (2–6 sentences; reference the task/review that raised it) |
| `Decision` | The settled outcome, in imperative, testable wording |
| `Reason` | Why this outcome (correctness, canonical source, measured evidence) |
| `Alternatives` | Rejected options and why each was rejected |
| `Status` | One of: `PROPOSED` → `CONFIRMED` → `SUPERSEDED`; or `OPEN` (explicitly undecided, with owner and blocker) |
| `Canonical source` | The document(s)/section(s) that make the decision binding, or "this log" for new decisions |
| `Date` | `YYYY-MM-DD` |

### Maintenance protocol

1. **Append-only.** New entries are appended; old entries are never edited. A changed decision gets a new entry and the old entry's `Status` is updated to `SUPERSEDED` with a pointer to the new ID. The `Decision` and `Reason` text of history entries are never rewritten.
2. **One decision per entry.** Do not bundle multiple topics into one ID.
3. **A decision is confirmed only when it is testable.** Vague entries ("make it nicer") are rejected.
4. **OPEN entries must name the blocker** and the canonical owner (product owner, DeviceProfile contract, firmware contract). Agents do not close OPEN entries themselves.
5. **Contradictions:** if a new decision contradicts a canonical document, it is not a decision — it is a `DOMAIN CONTRADICTION FOUND` report (corrections §13). Escalate; do not log it as settled.
6. **Consumption rule:** before proposing a change, agents check this log and the canonical decision tables referenced in §2. Re-proposing a CONFIRMED decision without new evidence is a process violation.

## 2. Index of canonical confirmed decisions (do not re-decide)

These decisions are canonical and live in their source documents. They are listed here so agents find them; the sources, not this log, are the authority.

| Area | Where the decisions live |
|---|---|
| Application shell, docking, panels, tabs | `docs/UI_DESIGN_SYSTEM_V2.md` §2–§3, §20–§21, §27 |
| Project Explorer hierarchy & drag/drop | `docs/UI_DESIGN_SYSTEM_V2.md` §4; corrections §3, §7; `docs/UI_UX_DECISIONS_V1.md` §"Drag/drop within Explorer" |
| Canvas, selection, multi-select `*` | `docs/UI_DESIGN_SYSTEM_V2.md` §6–§8; corrections §9 |
| Properties / Inspector categories | `docs/UI_DESIGN_SYSTEM_V2.md` §8 |
| Widget semantics (Digit/Direction/Text) | `docs/UI_DESIGN_SYSTEM_V2.md` §9; corrections §1 |
| Scene model & selection algorithm | `docs/UI_DESIGN_SYSTEM_V2.md` §10; `docs/DOMAIN_MODEL_V1.md` §"Condition / Priority" |
| Binding editor | `docs/UI_DESIGN_SYSTEM_V2.md` §11; `docs/BINDING_PARAMETRIC_SYSTEM_V1.md`; corrections §4 |
| Floor mapping | `docs/UI_DESIGN_SYSTEM_V2.md` §12; corrections §12 |
| Media / Media Slide / Audio | `docs/UI_DESIGN_SYSTEM_V2.md` §13; corrections §11; `docs/PRODUCT_DECISIONS_2026-08.md` |
| Asset Browser / Resources / Unsupported Files | `docs/UI_DESIGN_SYSTEM_V2.md` §14; corrections §10; `docs/UI_UX_DECISIONS_V1.md` §"Resources and Asset Depot" |
| Simulator | `docs/UI_DESIGN_SYSTEM_V2.md` §15 |
| Console | `docs/UI_DESIGN_SYSTEM_V2.md` §16 |
| Settings = blocking modal | `docs/UI_DESIGN_SYSTEM_V2.md` §17; corrections §2 |
| Context menus | `docs/UI_DESIGN_SYSTEM_V2.md` §18 |
| Keyboard shortcuts | `docs/UI_DESIGN_SYSTEM_V2.md` §19; corrections §8; `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §4.12 |
| Canvas interaction contract (locked) | `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §7.2, §11 |
| Design tokens | `docs/UI_DESIGN_SYSTEM_V2.md` §23 |
| Accessibility | `docs/UI_DESIGN_SYSTEM_V2.md` §24 |
| UI states & validation | `docs/UI_DESIGN_SYSTEM_V2.md` §25–§26 |
| Open (not-yet-decided) items | `docs/UI_DESIGN_SYSTEM_V2.md` §28; `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §11 "Explicit V1 Limitations"/"Future Dependencies" |

**Corrections precedence:** on any conflict between the main UI spec and `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`, the corrections win (corrections §13).

## 3. Decisions established by this system

### UI-D-0001 — Application chrome tone: light neutral workspace (dark chrome draft rejected)
- **Topic:** Application chrome tone of the visual north star.
- **Context:** The brief that commissioned this system listed "dark neutral chrome" among the north-star attributes. The canonical repository documents and the supplied reference screens consistently describe a different direction.
- **Decision:** The canonical chrome tone is a **light neutral workspace with a dark device/display preview and a restrained teal/cyan accent**. Dark application chrome is NOT part of the Template Designer visual north star.
- **Reason:** `docs/UI_REFERENCE.md` (written against the supplied screens) and `docs/UI_DESIGN_SYSTEM_V2.md` §22 both establish the light-workspace/dark-preview language, and `.agents/skills/ui-ux-system/SKILL.md` repeats it as the source-of-truth direction. Canonical sources outrank the brief's summary.
- **Alternatives:** (a) Dark chrome — rejected: contradicts canonical sources and the reference screens; would force a redesign of surfaces already built toward the light language. (b) Follow-the-OS dark mode — not canonical today; if a dark theme is ever wanted it must arrive as a documented product decision, not as a restyle.
- **Status:** CONFIRMED
- **Canonical source:** `docs/UI_REFERENCE.md`; `docs/UI_DESIGN_SYSTEM_V2.md` §22; `.agents/skills/ui-ux-system/SKILL.md`; AGENTS.md "UI rules"
- **Date:** 2026-08-18

### UI-D-0002 — System location: repository conventions override the brief's folder sketch
- **Topic:** Where the UI Design Intelligence System files live.
- **Context:** The brief proposed a conceptual structure (`docs/design/`, `skills/`, `agents/`). Repository discovery showed skills already live under `.agents/skills/<name>/SKILL.md` and docs live flat in `docs/`.
- **Decision:** Docs live in `docs/design/` (a new subfolder of the existing docs tree). The skill lives at `.agents/skills/ui-design/` (SKILL.md + `references/`). Agent definitions live at `.agents/agents/ui/`. No top-level `skills/` or `agents/` folders are created.
- **Reason:** Follow existing project conventions (`AGENTS.md` directs agents to `.agents/skills/*/SKILL.md`); avoids a parallel convention.
- **Alternatives:** (a) Top-level `skills/`/`agents/` per the brief's sketch — rejected: would split agent-facing assets across two conventions. (b) Flattening everything into existing docs — rejected: the layered system needs a discoverable, self-contained subtree.
- **Status:** CONFIRMED
- **Canonical source:** This log; `AGENTS.md`; existing `.agents/skills/` layout
- **Date:** 2026-08-18

### UI-D-0003 — `ui-design` skill complements, and does not replace, `ui-ux-system`
- **Topic:** Relationship between the two UI skills.
- **Context:** A comprehensive product-design skill (`.agents/skills/ui-ux-system/SKILL.md`) already exists and is canonical. The brief asked for a `ui-design` skill.
- **Decision:** `ui-ux-system` remains the canonical skill for the product's visual and interaction language ("what the product should look like"). The new `ui-design` skill owns the design *intelligence process* ("how to reason, decide, implement, audit, and QA UI work") and delegates all product-language questions to `ui-ux-system` and the canonical docs. Both skills cross-reference each other; there is exactly one design-system truth.
- **Reason:** Prevents a duplicate skill system (brief validation rule 5) while still adding the missing process layer.
- **Alternatives:** (a) Extend `ui-ux-system` with all new content — rejected: it would blur "product language" and "agent process" into one unmanageable skill. (b) A self-contained `ui-design` skill duplicating the design system — rejected: two authorities for the same truths.
- **Status:** CONFIRMED
- **Canonical source:** This log; `.agents/skills/ui-ux-system/SKILL.md`; `.agents/skills/ui-design/SKILL.md`
- **Date:** 2026-08-18

### UI-D-0004 — Design decision hierarchy (10 tiers)
- **Topic:** Precedence among competing design considerations.
- **Context:** Agents need one stable precedence to stop debating "nice" vs "correct".
- **Decision:** The 10-tier hierarchy in `UI_DESIGN_PRINCIPLES_V1.md` §3 is binding: product requirements → domain/runtime contract → interaction contract → accessibility → information architecture → canonical design system → spatial consistency → visual hierarchy → aesthetic preference → decorative polish. Aesthetic preference NEVER overrides correctness.
- **Reason:** Mirrors the precedence the repository already practices (`docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §7.3) and AGENTS.md's correctness-first rules.
- **Alternatives:** (a) Design-system-first — rejected: the design system itself is subordinate to the domain contract. (b) Aesthetics-first — rejected outright (violates AGENTS.md and the canonical spec).
- **Status:** CONFIRMED
- **Canonical source:** This log; `UI_DESIGN_PRINCIPLES_V1.md` §3; AGENT2 plan §7.3
- **Date:** 2026-08-18

### UI-D-0005 — Two kinds of correctness are both required for PASS
- **Topic:** Evidence model for UI evaluation.
- **Context:** Audit history repeatedly showed source-pass/rendered-unknown gaps (e.g., `AGENT3_FINAL_CANVAS_QA_REPORT.md` "no populated fixture", `AGENT4_INTEGRATION_REGRESSION_REPORT.md` A4-002) and rendered-beautiful-but-fake surfaces (e.g., fake Save).
- **Decision:** Evaluation always distinguishes source-level correctness from rendered visual correctness. A verdict of PASS requires evidence of both; a rendered-only or source-only review caps at `PASS WITH WARNINGS`, and an environment without a render target yields `BLOCKED`, never `PASS`.
- **Reason:** Each evidence kind catches defects the other cannot.
- **Alternatives:** (a) Static-only verdicts — rejected: the Canvas transform mismatch (AGENT3 D4/F12) was visible only by measuring the rendered shell. (b) Screenshot-only verdicts — rejected: fake controls render beautifully.
- **Status:** CONFIRMED
- **Canonical source:** This log; `UI_DESIGN_EVALUATION_V1.md` §1, §5
- **Date:** 2026-08-18

### UI-D-0006 — Agent handoff order and implementer discipline
- **Topic:** UI agent organization and handoff model.
- **Context:** The brief defines five UI agents and a handoff pipeline.
- **Decision:** The handoff model is: PRODUCT REQUIREMENTS → UI ARCHITECT → UI DESIGNER → APPROVED DESIGN DECISION → UI IMPLEMENTER → FUNCTIONAL QA → UI AUDITOR → VISUAL QA → FINAL REVIEW (details in `.agents/agents/ui/UI_AGENT_ORGANIZATION.md`). The Implementer consumes approved decisions and may NOT silently redefine architectural or design decisions; changes are escalated, decided, and logged before implementation.
- **Reason:** Prevents the most common agent failure observed in this repository's history: implementation-time silent redesign (anti-pattern `AP-ARCH-01`).
- **Alternatives:** (a) Designer→Architect order — rejected: structural architecture (shell/docking/workspace) must precede surface design decisions that depend on it. (b) Implementer autonomy — rejected: audit history shows drift.
- **Status:** CONFIRMED
- **Canonical source:** This log; `.agents/agents/ui/UI_AGENT_ORGANIZATION.md`
- **Date:** 2026-08-18

### UI-D-0007 — This system is documentation-only and ships as one commit
- **Topic:** Delivery boundary of the UI Design Intelligence System.
- **Context:** The commissioning brief requires no application-code changes and one documentation-only commit.
- **Decision:** The system (docs, skill, agents) lands in exactly one commit, `docs(ui): establish UI design intelligence system`, containing only the new files. Pre-existing working-tree changes to `src/` or `tests/` are not part of this system and are never bundled into its commit.
- **Reason:** Keeps the foundation auditable and preserves the "no application code changed" guarantee.
- **Alternatives:** (a) Multiple topical commits — rejected: the brief requires one commit. (b) Bundling unrelated work — rejected: contaminates the documentation-only guarantee.
- **Status:** CONFIRMED
- **Canonical source:** This log
- **Date:** 2026-08-18

## 4. Open items (escalated, not decided here)

| Topic | Blocker | Owner | Canonical reference |
|---|---|---|---|
| Exact DeviceProfile JSON/schema | DeviceProfile contract not finalized | Domain/product owner | `docs/UI_DESIGN_SYSTEM_V2.md` §28 |
| Exact equal-z stacking order for rendering (interaction layer uses zIndex → array order → stable ID) | Canonical closure pending | Product owner | AGENT2 §4.5, §11; UI spec §28 |
| Rotation geometry/transform contract | Future Geometry/Transform contract | Domain owner | AGENT2 §5, §11 |
| Duplicate mode & `Ctrl+D` binding | Product confirmation | Product owner | UI spec §19/§27; AGENT2 §4.12 |
| Dark theme / OS theme following | No canonical decision exists | Product owner | UI-D-0001 |

## 5. Decisions established by the remediation pass (audit-driven)

### UI-D-0008 — Single-document foundation: one honest document tab
- **Topic:** Document tabs while only one document exists.
- **Context:** Audits INT-04/05/06 (E2E) found N label-keyed tabs over one store — switching changed nothing but a label and the dirty dot followed activation. Real multi-document is deferred.
- **Decision:** V1 renders exactly one document tab labelled with the project name, a dirty-derived dot, and an honest close refusal; multi-document tabs arrive with the real document manager.
- **Reason:** State honesty (AP-STATE-02): a surface must not imply N documents when the store holds one.
- **Alternatives:** (a) keep fake label tabs — rejected (audit FAIL); (b) full multi-document manager now — rejected (out of remediation scope).
- **Status:** CONFIRMED
- **Canonical source:** UI §20; this log
- **Date:** 2026-08-18

### UI-D-0009 — Z-order operations normalize the whole stack deterministically
- **Topic:** Equal-z stacking operations.
- **Context:** INT-47/WC-11-12: bring-forward over ≥3 equal-z siblings leapfrogged. The interaction contract fixes the total order but not the mutation semantics.
- **Decision:** Every z-order operation renumbers the Scene's unlocked widgets to sequential zIndex values in stacking order, applies the requested swap, and emits one undoable command with the changed assignments; locked widgets keep their zIndex and cannot be targets.
- **Reason:** Deterministic, tie-free, one history entry; satisfies AGENT2 §4.5's "assignments of zIndex" rule without inventing new domain state.
- **Alternatives:** (a) array reorder (moveWidget) — rejected: contradicts the zIndex stacking source; (b) z+1 leapfrog — rejected: the audited defect.
- **Status:** CONFIRMED
- **Canonical source:** AGENT2 §4.5; this log
- **Date:** 2026-08-18

### UI-D-0010 — Post-gesture click suppression is timestamp-based
- **Topic:** Suppressing the click that terminates a drag/marquee.
- **Context:** Live CDP verification showed the legacy `setTimeout(0)` boolean flag could clear before the terminating click arrived (the drag's click then cleared the selection). Timer-vs-click ordering is browser-dependent.
- **Decision:** A gesture arms a 600 ms suppression window; the first click inside the window is consumed by whichever canvas handler receives it.
- **Reason:** Ordering-independent; removes a class of flaky-selection bugs that static review cannot reach.
- **Alternatives:** (a) timer flag — rejected (observed failure); (b) ignoring clicks after pointerup only when the pointer moved — rejected (same ordering problem).
- **Status:** CONFIRMED
- **Canonical source:** AGENT2 §4.3/§4.13; this log
- **Date:** 2026-08-18

### UI-D-0011 — Dock tabs are a real tab stack; close is distinct from collapse
- **Topic:** Docking honesty (DK-01/05).
- **Context:** Docking a panel silently collapsed its sibling, and the panel `×` performed the same collapse as `−`.
- **Decision:** Left/right dock tabs keep both panels docked and switch the visible tab; `−` collapses, `×` closes into a `closed` mode reopened from the View menu; floating keeps fixed offsets and says so.
- **Reason:** UI §3 defines close/reopen and tab stacks as distinct behaviours; mapping two labels to one handler is a false affordance.
- **Alternatives:** (a) full drag/drop docking — rejected for V1 (deferred); (b) removing `×` — rejected: close/reopen is canonical.
- **Status:** CONFIRMED
- **Canonical source:** UI §3; this log
- **Date:** 2026-08-18
