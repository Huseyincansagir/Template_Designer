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

### UI-D-0012 — The canvas workspace flexible row belongs to the device stage
- **Topic:** CSS grid assignment of the Design Studio center column.
- **Context:** Live measurement at 1920×1080 showed `.canvas-navigator` occupying 719px (`1fr`) while `.canvas-stage` was 32px. The navigator had been inserted as a fourth child of a three-row `grid-template-rows: 40px minmax(0, 1fr) 32px` template.
- **Decision:** `.canvas-workspace` has exactly three children — fused editor chrome, device stage, context bar — with `grid-template-rows: auto minmax(0, 1fr) auto`. A unit test forbids `renderCanvasNavigator()` and requires the `1fr` row to sit on the stage.
- **Reason:** Canvas dominance (UI spec §6; ui-ux-system skill). A 32px stage fails the primary workflow regardless of token polish.
- **Alternatives:** (a) four-row template keeping a separate navigator — rejected: two chrome bands still steal vertical space; (b) stretching the navigator as a “workspace” — rejected: the measured P0.
- **Status:** CONFIRMED
- **Canonical source:** UI spec §6; this log
- **Date:** 2026-08-19

### UI-D-0013 — One compact editor chrome strip
- **Topic:** Fusion of studio toolbar, rotation switcher and scene tabs.
- **Context:** Separate 40px toolbar + two-row navigator consumed ~100px before the device, with Design/Preview duplicated as app-bar chips.
- **Decision:** One `.editor-chrome` row (≈32px, wrapping at 1280) holds Select/Pan/Grid/Snap, Theme (when present), R0–R270, scene tabs + add/reorder, Design/Preview and zoom. App bar is 32px with Save/Undo/Redo/Deploy/Settings. Panel headings are 28px with no kickers; panel footnotes are hidden.
- **Reason:** Compact CAD density; scene/rotation navigation must be obvious without a second band.
- **Alternatives:** (a) keep two navigator rows — rejected (measured waste); (b) icon rail copied from the visual mockup — rejected: mockup is style reference only, Explorer remains the hierarchy.
- **Status:** SUPERSEDED by UI-D-0015 / UI-D-0016
- **Canonical source:** UI spec §5–§6; this log
- **Date:** 2026-08-19

### UI-D-0014 — SD deployment is a dedicated dialog, not Console chrome
- **Topic:** Surface for the SD-card pipeline.
- **Context:** Deploy lived in a 156px Console tab. The pipeline is a destructive, staged operation (detect → select → preflight → write → verify → eject).
- **Decision:** `Project ▸ Deploy to SD Card…` and the toolbar Deploy button open a blocking `.deploy-dialog`. Console still logs traces and keeps a Deployment tab as a secondary inspector. Detection is not attempted in the browser build; the dialog states that the transport is absent rather than reporting a failed detection.
- **Reason:** UI spec §26 and the Settings dialog pattern; never claim a write the build cannot perform.
- **Alternatives:** (a) keep Console-only — rejected (undiscoverable, cramped); (b) a permanent Deploy panel — rejected (not a continuous editor surface).
- **Status:** CONFIRMED
- **Canonical source:** UI spec §26; media-publish skill; this log
- **Date:** 2026-08-19

### UI-D-0015 — Two-row editor chrome
- **Topic:** Editor chrome vertical structure.
- **Context:** UI-D-0013 fused tools, Theme, rotations and scene tabs into one wrapping row. At 1280 the scene tabs shared a wrap line with tools/zoom and stopped being a reliable jump surface.
- **Decision:** `.editor-chrome` is two rows (`grid-template-rows: 32px auto`): row 1 = Select/Pan/Grid/Snap, Theme, R0–R270, Design/Preview, zoom; row 2 = exclusive scene strip. Canvas workspace stays `auto minmax(0, 1fr) auto` (UI-D-0012). App bar remains 32px.
- **Reason:** Scene switching is a primary canvas control and must keep a dedicated band. One wrapping row failed that at compact viewports.
- **Alternatives:** (a) keep UI-D-0013 one-row wrap — rejected: scene tabs lost; (b) restore `.canvas-navigator` as a 4th workspace child — rejected: UI-D-0012 P0.
- **Status:** CONFIRMED (source landed). Rendered visual P2 not re-run against this chrome.
- **Canonical source:** This log; UI spec §5–§6; supersedes UI-D-0013 layout
- **Date:** 2026-08-19

### UI-D-0016 — Exclusive scene strip
- **Topic:** Where Scene tabs live in the editor chrome.
- **Context:** Mixing scene tabs with tools and rotation buttons on one row made the active Scene compete for width and wrap.
- **Decision:** Scene tabs, `+ Scene`, and scene reorder live only on `.editor-chrome-row.is-scenes`. They do not appear on the tools/rotation row.
- **Reason:** One exclusive strip makes the active Scene obvious at every viewport without stealing tool/rotation width.
- **Alternatives:** (a) scene tabs in row 1 with wrap — rejected (UI-D-0013 failure); (b) Explorer-only scene switching — rejected: L-09 required an always-visible strip.
- **Status:** CONFIRMED (source landed). Visual P2 not re-measured.
- **Canonical source:** This log; UI spec §5–§6, §10
- **Date:** 2026-08-19

### UI-D-0017 — Widget cascade uses widget size + snap grid
- **Topic:** Default placement of successive Add Widget.
- **Context:** A 10px / `snapGridSize` cascade stacked 120×80 widgets into one blob (S4-01, FC-07). FC-07 then recorded `max(grid*4, 40)`, which still overlapped the default widget.
- **Decision:** Each new widget steps by `width + snapGridSize` on X and `height + snapGridSize` on Y from scene centre, wrapping after 8. Default size remains 120×80.
- **Reason:** The step must exceed the widget’s own box or the next add is still hit-test-occluded.
- **Alternatives:** (a) grid-only step — rejected (measured occlusion); (b) `max(grid*4, 40)` — rejected: smaller than 120×80.
- **Status:** CONFIRMED (landed in `addWidget`; covered in `tests/editor-widgets.test.ts`)
- **Canonical source:** This log; S4-01 / FC-07
- **Date:** 2026-08-19

### UI-D-0018 — Project inspector section only at document
- **Topic:** When the inspector shows project-level fields.
- **Context:** `renderProperties` emits a Project section (Device Profile + Validation) for every selected node, so a widget/scene/theme inspector also hosts document fields (D5-05/D5-06 over-reach; D6 ancestor-section rule).
- **Decision:** Project/document fields (name, device profile, display, counts, validation, Next Step) appear only when nothing is selected — the document inspector. A selected object shows Identity plus kind-specific sections only.
- **Reason:** Contextual inspector (UI spec §8): selection kind owns the panel. Project fields on a widget bury type-specific editors.
- **Alternatives:** (a) keep Project on every selection — rejected: not contextual; (b) duplicate Document and Project — rejected: two editors for one device profile.
- **Status:** CONFIRMED (landed). Project Device Profile + Validation render only for `node.kind === "project"`; the empty-selection path keeps the Document inspector. Widget/scene/theme/asset inspectors no longer host project fields.
- **Canonical source:** This log; UI spec §8
- **Date:** 2026-08-19

### UI-D-0019 — Profile widget palette and click-to-place
- **Topic:** How a designer adds a widget.
- **Context:** Add Widget always created the first DeviceProfile type at a cascade point. The elevator Design Studio reference shows a type palette and click-to-place.
- **Decision:** Chrome exposes one studio-tool per `supportedWidgetTypes`. Choosing a type enters place mode; the next canvas click adds that widget at the click, clamped. Esc exits. Menu and context `scene.add-widget:*` enter the same place mode.
- **Reason:** Two-step Add → type → place. Profile-driven; no invented widget IDs.
- **Alternatives:** (a) keep first-type cascade — rejected: undiscoverable; (b) new domain types kat_no/ok — rejected: DeviceProfile types are the contract.
- **Status:** CONFIRMED
- **Canonical source:** This log; ui-ux-system widget insertion; DeviceProfile.supportedWidgetTypes
- **Date:** 2026-08-19

### UI-D-0020 — Display kit is a profile-filtered Scene command
- **Topic:** Typical elevator face without a new widget catalog.
- **Context:** Empty scenes force the designer to invent layout. Elevator ref 01 shows Floor + Direction + Warning + captions.
- **Decision:** `addWidgets` places a kit (Background/media, Floor/digit, Direction, Warning, Caption/text) using percent boxes of the active Rotation. Types absent from the profile are skipped. One undo step.
- **Reason:** Elastic across Foundation/Compact. Names are display names, not new types.
- **Alternatives:** (a) 9 canonical scenes / 12 widget IDs — DOMAIN CONTRADICTION, not implemented; (b) no kit — rejected: empty canvas is the main friction.
- **Status:** CONFIRMED
- **Canonical source:** This log; DeviceProfile; elevator ref 01 as layout hint only
- **Date:** 2026-08-19

