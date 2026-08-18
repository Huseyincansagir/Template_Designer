# DEEPSEEK LEAD — CONSOLIDATED REMEDIATION PLAN

**Repository:** `Huseyincansagir/Template_Designer` · branch `manus2`
**Plan base:** `67ac96c` (merge of the three audit commits onto `manus2`)
**Inputs (authoritative):**

| Audit | Commit | Report | Severity rollup |
|---|---|---|---|
| Workflow A — Functional | `79eb2d5` | `DEEPSEEK_FUNCTIONAL_AUDIT.md` (520 lines) | 2 CRITICAL · 7 HIGH · 13 MEDIUM · 20 LOW · 5 UNVERIFIED |
| Workflow B — UI/UX | `929ad48` | `DEEPSEEK_UI_UX_AUDIT.md` (892 lines) | 1 P0 · 30 P1 · ~75 P2/P3 |
| Workflow C — E2E Integration | `e38123f` | `DEEPSEEK_E2E_INTEGRATION_AUDIT.md` (515 lines) + `qa-workflow-c/findings/` (14 reports) | 0 CRITICAL · 19 HIGH · 39 MEDIUM · 16 LOW · 2 INFO |

**Canonical documents:** `AGENTS.md`, `Template Designer — Ana Proje Geliştirme Promptu.md`, `docs/DOMAIN_MODEL_V1.md`, `docs/UI_DESIGN_SYSTEM_V2.md` (+`_CANONICAL_CORRECTIONS.md`), `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md`, `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md`, `docs/BINDING_PARAMETRIC_SYSTEM_V1.md`, `docs/TEMPLATE_SCHEMA_V1.md`, `docs/DEPLOYMENT_FORMAT.md`.

---

## 1. Consolidated defect matrix (deduplicated)

Cross-audit IDs merged. Every row lists canonical source, classification, and the execution phase that owns it.

### CRITICAL

| # | Merged IDs | Defect | Canonical | Classification | Phase |
|---|---|---|---|---|---|
| D-001 | C-01 · INT-49 · WC-11-01 · WC-05-09 | No widget creation path — the editing loop is unexercisable | UI §7/§9; ARCH_V2:480 | required functionality | 1 |
| D-002 | C-02 · INT-01/02/13 · WC-01-02 · WC-07-02 · WC-09-04 · WC-12-001/002 | Save/Open/persistence fiction + settings persistence + close-with-unsaved | AGENTS.md; UI §5; corrections §2 | required functionality + persistence | 1, 4 |

### HIGH (functional / state / integration)

| # | Merged IDs | Defect | Canonical | Classification | Phase |
|---|---|---|---|---|---|
| D-003 | H-01 · INT-62 | SD-card deployment unimplemented; UI claims "Verified package" | AGENTS.md Reliability; prompt §19/§25 | required functionality (platform-gated) | 2 (honesty) / deferred transport |
| D-004 | H-02 · M-06 · INT-07 · INT-10 | New Project non-canonical (no Theme Project / 4 rotations); R0-only add | DOMAIN_MODEL_V1:107-115 | required functionality | 1 |
| D-005 | H-03 · PR-01(P0) · INT-52/53/54 · WC-05-01/03/04 | Geometry fields commit per keystroke, clamp mid-typing, empty→0, no max/feedback | UI §8; Agent 1 pipeline | required bug fix | 4 |
| D-006 | H-04 · INT-50/51 · PR-02 · ST-04 · WC-11-02 · WC-05-08 | Non-geometry properties read-only; multi `*` not appliable; Lock/Visibility unreachable; Binding viewer-only | UI §8-13; corrections §4/§5/§9 | required functionality | 5 |
| D-007 | H-05 · INT-30 · AX-01 · ST-05 · WC-08-03 · WC-09-06 | Confirmed shortcuts unbound; no registry; "R" advertised without rotation | UI §19; AGENT2 §4.12 | required bug fix | 4 |
| D-008 | H-06 · M-03/M-04 · INT-55/56/57/58 · SF-02/SF-03 · WC-10-* | Bindings never applied to render; simulator strings; duplicate clones bindings; preview/transport cosmetic | BINDING_V1; UI §6/§15 | required functionality | 4 |
| D-009 | H-07 · INT-69 · WC-13-6 | Package: no asset bytes, `verified:true` pre-verification, unversioned manifest, empty project builds | DEPLOYMENT_FORMAT.md; AGENTS.md | required bug fix | 2 |
| D-010 | INT-03 · ST-02 · WC-01-01 · WC-09-01 | New Project silently discards dirty work; confirmDestructive dead | corrections §2; UI §25 | state correctness | 4 |
| D-011 | INT-04/05/06 · WC-01-03/04/05 · WC-07-03/05 | Document tabs decorative; dirty dot not dirty-derived; label-keyed identity | UI §20; ARCH_V2:84-107 | state correctness | 4 |
| D-012 | INT-18/19 · M-07 · WC-03-01/03 · WC-06-09 | Cross-scene selection silently subset; mixed-kind bulk mutations | AGENT2 §4.6.2; UI §7 | state correctness | 4 |
| D-013 | INT-20/21/22/23 · WC-02-01 · WC-10-02/03 | Active-scene divergence (Explorer vs simulator vs canvas); `sceneActivationOrder` hard-coded | UI §6/§10 | state correctness | 4 |
| D-014 | INT-31/32/34 · WC-08-01/02/07 | Keyboard hostage to focus; delete kills focus; mutation keys fire from buttons | UI §24; AGENT2 §4.12 | required bug fix | 4 |
| D-015 | INT-38/39/40 · WC-04-01/02 · WC-06-02/04 | Mid-drag keyboard/toolbar mutations; spurious/lost history | AGENT2 §4.3/§4.13 | state correctness | 4 |
| D-016 | INT-68 · L-13 · WC-13-5 | Deleting the last Theme Project Group bricks the editor | UI §4 | state correctness | 1 |
| D-017 | INT-11 · M-05 · WC-09-03 | `showGrid` settings field is a pure no-op | corrections §2 | state correctness | 4 |
| D-018 | INT-41 · WC-04-06 (UNVERIFIED) | `lostpointercapture` can revert a just-committed pan | AGENT2 §4.3 | bug fix (verify in browser) | 3 |
| D-019 | INT-24/25/26/27 · WC-03-02/05/06 · WC-06-05 | Selection label snapshots stale; undo/duplicate don't reconcile selection; asset/root silent no-ops | UI §7 | state correctness | 4 |
| D-020 | INT-28 · D9 · WC-03-07 · WC-11-07 | Context menu reads stale selection; canonical `hitTest` dead in app | AGENT2 §4.4/§4.5 | required bug fix | 3 |

### MEDIUM / LOW (canvas contract, robustness, UI state)

| # | Merged IDs | Defect | Classification | Phase |
|---|---|---|---|---|
| D-021 | L-01 · WC-04 (resize) | Resize handles skip primary-button guard | canvas contract | 3 |
| D-022 | L-02 | Marquee `contains` implemented despite locked rejection | canvas contract | 3 |
| D-023 | L-03 | Wrong-platform Mod+Arrow degrades to plain Arrow | canvas contract | 3 |
| D-024 | L-06 | Pan added unscaled vs §4.2 `pan × fitScale` | canvas contract | 3 |
| D-025 | L-07 | `updateWidgetGeometries` dead history-bypassing helper | architecture (remove) | 3 |
| D-026 | M-01 · CV-06 | Invisible widgets ghost-rendered instead of not rendered | canvas contract | 3 |
| D-027 | CV-01 | Pan tool moves widgets over content | canvas contract | 3 |
| D-028 | CV-12 | Canvas header fabricates "R0" | UI state honesty | 3 |
| D-029 | INT-42 · WC-04-03 | Resize snap only adjusts x/y; east/south edges never snap | canvas contract | 3 |
| D-030 | INT-46 · WC-11-03 | Z-order bypasses lock | canvas contract | 3 |
| D-031 | INT-47 · WC-11-12 | Z-order tie-break leapfrogs ≥3 equal-z siblings | canvas contract | 3 |
| D-032 | INT-70 · WC-13-8 | Failed pointer capture strands drag; no window-level fallback | robustness | 3 |
| D-033 | INT-48 · WC-08-10 · WC-12-007 · WC-14-04 | Splitter leaks listeners; logs resize without movement | robustness | 4 |
| D-034 | M-02 · TB-01/02/09/12 · SF-10 | Dead controls (Align, Lock, Open, Project Settings, Theme Defaults, Command Palette, Import) + live-dot | state honesty | 5 |
| D-035 | M-09 · EX-01 · INT-75 | Expand/Collapse-All wrong ids; expansion survives New Project | UI state | 4 |
| D-036 | M-10 · INT-61 | Foundation profile registries empty → runtime surfaces inert | functional gap | 1 |
| D-037 | M-11 · INT-22 | Scene priority/conditions display-only; activation order hard-coded | functional gap | 5 |
| D-038 | M-12 · INT-63/64/65 · WC-12-004/005/006 | Tauri: no close guard, no installer, devUrl mismatch, no capabilities, unused API | platform | 4 (JS/config half) |
| D-039 | M-13 · WC-14 (tests) | Zero DOM/browser tests; UI-called mutators untested | test debt | 7 |
| D-040 | INT-72 · WC-07-06 | Order/undefined-sensitive `JSON.stringify` dirty compare | robustness | 2 |
| D-041 | INT-73 · WC-14-08 | Unbounded history stacks | robustness | 2 |
| D-042 | INT-74 · WC-14-16 | O(n) snap per pointermove | scalability (documented, accepted at V1 scale) | 7 note |
| D-043 | INT-14/15/16/17 · ST-01/03/06 · WC-09-05/07/08/09 | Settings backdrop keeps draft; no Escape/trap; shortcuts page lies; grid decoupled from snap size | UI state | 4, 6 |
| D-044 | INT-59/60 · WC-10-07/08 | Binding modal outlives widget; false "inside active Scene" copy | UI state | 4 |
| D-045 | M-08 | Validation missing canonical rule families | required bug fix (tractable subset) | 2 |
| D-046 | L-14 | Empty project validates clean | required bug fix | 2 |
| D-047 | GL-03/GL-04/SF-02/03/04/07/08 · TB-08 · DK-09 · CV-13 | State feedback honesty (LED, chips, console timestamps/scrollback, zoom bounds, dead context menu) | UI state | 4, 6 |
| D-048 | GL-01/02/05 · SP-01..07 · TY-01..09 · VC-01..07 · IC-02 · EX-02..11 · PR-03..07 · TB-03..07/11 · AX-02..07 · DK-01/03/05/07 · CV-02/04/05/08/10/11 · RS-06/07 · GL-07..10 · SF-05/09 | Design-system tokenization, spacing/typography scale, contrast, ARIA, docking honesty | design-system consistency + visual polish | 6, 7 |

---

## 2. Conflicts between findings — canonical resolution

1. **CV-09 vs INT-29 (marquee vs Ctrl+A selectable set).** UI audit wants marquee aligned with Ctrl+A; E2E audit wants Ctrl+A filtered. **Canonical resolution (AGENT2 §4.7/§4.8, corrections §8):** marquee is hit acquisition → visible+enabled only (unchanged); Ctrl+A is keyboard selection → full active-Scene document order including hidden (unchanged); hidden-but-selected widgets show selection bounds so geometry gestures stay visible. **No code change beyond bounds rendering; both audit suggestions rejected as written.**
2. **INT-19 (reject mixed-kind) vs deleting containers by selection.** E2E recommends rejecting mixed-kind bulk mutations. Adopted: mixed-kind Delete/Duplicate blocked with a console warning. Container-only selections remain deletable.
3. **H-02 seed vs existing test suite.** `foundation.test.ts:35-37` encodes the empty hierarchy. The canonical scaffold supersedes the test; the test is updated to assert the canonical shape (the audit itself demands this).
4. **L-13/INT-68 last-group.** Delete of the last group is refused at Core with a UI warning; alternative (auto-create group in `addThemeProject`) would invent domain behavior and is rejected.
5. **ST-04 binding editor vs effort.** Row-based binding authoring is canonical; a minimal real editor (add binding with one condition row, delete binding, live evaluation) is implemented; full condition reordering/multi-condition editing is deferred and the surface stays labelled Binding Editor (truthful: it does edit).
6. **CV-14 duplicate mode.** Canonical duplicate mode (click-center placement, Esc exits) is CONFIRMED (UI §27). Implemented as a canvas mode in Phase 5; fixed-offset Duplicate remains the menu/toolbar command until the mode exists.
7. **H-01 SD deployment vs missing cargo.** Rust cannot be compiled/verified in this environment. Resolution: TS deployment pipeline (detect→validate→write→verify→eject states) wired through `PackageDeploymentManager`; browser build reports "unavailable in browser build" truthfully; Tauri adapter code provided and marked UNVERIFIED. "Verified package" claim removed until a real transport verifies.
8. **ST-05 "R" row.** Free rotation is a future transform contract (AGENT2 §4.10). The R row is removed from Settings; the shortcut stays unbound (no fake affordance).

## 3. Rejected suggestions (documented, not silently skipped)

| Suggestion | Reason for rejection |
|---|---|
| CV-09 (align marquee with Ctrl+A) | Contradicts canonical hit-acquisition vs keyboard-selection distinction (§2.1) |
| INT-29 (filter Ctrl+A) | Same as above |
| DK-02 full floating drag/re-dock | Multi-panel window management is disproportionate for V1; floating panels keep fixed offsets and are labelled "float (fixed)" — deferred, not faked |
| DK-06 workspace persistence to file | Deferred; layout persistence is a workspace-file feature |
| IC-01 full SVG icon layer | Rejected for V1 scope; IC-02 (unique glyph per concept) is implemented instead |
| GL-09 CSS-only min-size removal | Browser cannot enforce window minimums; Tauri `minWidth/minHeight` added; CSS floor kept for browser builds |
| AX-03 full tablist roving focus | Single-document V1: roles corrected to a plain labelled list until multi-document exists |
| SF-06 loading progress for build | Build is synchronous/in-memory in V1; a status transition (Building→Built) is shown; spinner deferred |
| INT-74 spatial index for snapping | Accepted linear scan at V1 scale; documented as future optimization |

## 4. Category separation

- **Required functionality:** D-001, D-002, D-004, D-006, D-008, D-036, D-037, D-003 (TS pipeline, transport deferred)
- **Required bug fixes:** D-005, D-007, D-009, D-014, D-015, D-018, D-020, D-045, D-046
- **Architectural fixes:** D-025, D-040, D-041, D-042 (note)
- **Canvas contract fixes:** D-021…D-032
- **UI state correctness:** D-010, D-011, D-012, D-013, D-017, D-019, D-028, D-033, D-034, D-035, D-043, D-044, D-047
- **Design-system consistency:** D-048 token/typography/spacing/contrast/ARIA subset
- **Visual polish:** remaining P2/P3 from D-048
- **Intentionally deferred (honest labelling only):** SD-card hardware transport (platform), Wi-Fi (V2), asset ingestion/preview, Floor Mapping editor, audio policy surface, parametric `{FloorNumber}`/multilingual content, Media Slide editor beyond basic fields, Bounding Group, free rotation/5° snap/R, Command Palette, Project Settings/Theme Defaults surfaces, multi-document model, media continuation, format conversion.

## 5. Execution order (phases → commits)

Each phase lands as a focused commit; typecheck + tests + build run after every phase.

| Phase | Commit (planned) | Scope (matrix rows) |
|---|---|---|
| 1 | `fix(core): widget creation, canonical scaffold, persistence` | D-001, D-002 (core+adapter+boot), D-004, D-016, D-036, INT-56/INT-09 duplicate-binding remap + id hygiene |
| 2 | `fix(core): publish validation and honest package verification` | D-009, D-040, D-041, D-045 (tractable rules), D-046 |
| 3 | `fix(canvas): resolve interaction contract gaps` | D-018, D-020…D-032 |
| 4 | `fix(ui): keyboard, selection and runtime state integrity` | D-005, D-007, D-008, D-010…D-015, D-017, D-019, D-033, D-035, D-043, D-044, D-047, D-038 (JS/config) |
| 5 | `feat(ui): complete property, scene and command surfaces` | D-006, D-034, D-037, clipboard C/X/V, duplicate mode, minimal Binding Editor, honest dead-control removal |
| 6 | `refactor(ui): normalize design system usage` | D-048 tokens/typography/spacing/ARIA/docking honesty |
| 7 | `test: expand regression coverage` + `docs(remediation): final report` | D-039, D-042 note, full gate |

**Final gate:** `npm run typecheck` · `npm test` · `npm run build` · `npm run tauri:check` (environment-blocked, recorded) · dev-server browser smoke. Deliverable: `DEEPSEEK_FINAL_REMEDIATION_REPORT.md` with Fixed / Remaining / Intentionally Deferred / Unverified / Tests / Architecture Changes / UI Changes / Functional Completeness / Final Status.

**Rule of thumb for every touched control:** affordance → command → mutation → persistence → snapshot → visible result → undo/redo. No polish on dead controls; dead controls are removed or made real first.
