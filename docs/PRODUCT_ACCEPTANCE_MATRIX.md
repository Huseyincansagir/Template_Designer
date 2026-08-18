# PRODUCT ACCEPTANCE MATRIX — Template Designer V2

**Pass:** Zero-trust / real-user acceptance (Lead + 5 specialists: canvas, workflow/state, properties/inputs, visual QA, Tauri/validation/errors)
**Method:** live CDP-driven browser exercise (each specialist on an isolated Edge profile) + static contract checks + automated gates.
**Status legend:** PASS = workflow actually exercised successfully · PARTIAL = works with friction or gaps · FAIL = broken · UNVERIFIED = could not be exercised here · N/A = not applicable.

> Rules: PASS requires the workflow to have been run in the real application (not inferred from code). Evidence column names the script/check that produced the result.

| Area | Scenario | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| First launch | boot from clean storage | app renders shell + scaffold hierarchy, no errors | scaffold theme + 4 rotations visible; zero console errors | PASS | lead-pass.mjs / specialists |
| First launch | understand what to do first | canvas empty state names the next action | "Select a Scene or Widget · Create or select a canonical Rotation and Scene…" | PASS | lead-pass.mjs |
| New Project | create + dirty guard | confirm dialog on dirty; fresh canonical project; statuses reset | confirm dialog appears; scaffold created; runtime/deployment reset | PASS | S2 checks / lead-pass |
| Hierarchy | theme has exactly R0/R90/R180/R270 | all four render and are selectable | PASS (live) | PASS | lead-pass / S2 |
| Rotations | select rotation → device shows correct resolution | header R0 · 720×1280 | PASS | PASS | lead-pass.mjs |
| Scenes | add scene → auto-select + expand | new scene selected, canvas shows empty state | PASS | PASS | lead-pass.mjs |
| Widgets | add widget → visible immediately everywhere | canvas renders; Explorer row visible (parent expanded); selected; Properties shows it | PASS (fixed in 164d215: parent expansion) | PASS | lead-pass.mjs |
| Canvas: drag | move + snap + one history entry + click does not clear selection | X changed per transform; Ctrl+Z reverts exactly; trailing click suppressed | PASS (X 300→610 at tiny CDP scale, exact revert) | PASS | remediation-smoke / S1 |
| Canvas: resize | all 8 handles, anchor fixed, min size | per-handle geometry semantics | PASS (live, S1) | PASS | S1 checks |
| Canvas: multi-resize | marquee 2+ widgets, bbox handles | relative layout preserved, one entry, undo exact | widths 45→86→undo 45 px, zero errors | PASS | lead-pass4.mjs |
| Canvas: marquee | intersect selection; additive; sub-threshold = click | canonical predicate | PASS (S1) | PASS | S1 checks |
| Canvas: snap | grid > edge > center, 6-unit threshold, guides | snaps + guide rendered; Snap toggle off = no snap | PASS (S1) | PASS | S1 checks |
| Canvas: zoom/pan | 50–200%, bounds disable, pointer conversion matches | drag follows cursor at 50/200%; pan works over widgets and stage | PASS (S1); bounds disable verified | PASS | lead-pass2 / S1 |
| Canvas: keyboard nudge | Arrow/Mod/Shift+Mod exact sets | grid, grid÷10, grid×5; Shift alone nothing | PASS (S1) | PASS | S1 checks |
| Canvas: locked widgets | selectable; geometry blocked; other props editable | drag/resize/nudge blocked with warning; name/visible editable | PASS (S3) | PASS | S3 checks |
| Canvas: hidden widgets | not rendered; selectable via Explorer; bounds shown | hide removes render; Explorer select shows bounds; Show restores | PASS | remediation-smoke / S1 |
| Canvas: z-order | four ops deterministic, no leapfrog, lock respected | stacking changes correctly | PASS (S1) | PASS | S1 checks |
| Selection | Explorer ↔ Canvas ↔ Properties agree | one canonical selection everywhere incl. context bar/status | PASS (fixed stale label + reconciliation in 164d215) | PASS | lead-pass / S2 |
| Selection | multi-select + `*` apply-to-all | typing applies to all unlocked, one undo entry | PASS (S3) | PASS | S3 checks |
| Selection | scene switch prunes cross-scene widgets | no silent subset; warning when dropped | PASS (S2) | PASS | S2 checks |
| Selection | delete → next logical selection; undo restores sanely | selection cleared on delete; undo returns widget; stale ids pruned | PASS (164d215) | PASS | lead-pass / S2 |
| Properties | name/x/y/w/h/zIndex/priority/profile edits | commit-on-blur/Enter, one entry each, invalid input reverts with feedback | PASS (S3) | PASS | S3 checks |
| Properties | invalid/NaN/huge/negative values | revert + visible feedback, no silent acceptance, no unrecoverable widgets | PASS (S3) | PASS | S3 checks |
| Properties | Enter/Escape/Tab/blur/switch-selection-while-editing | predictable; no phantom commits | PASS (S3) | PASS | S3 checks |
| Rename | widget/scene/theme rename | all surfaces update immediately | PASS (164d215) | PASS | lead-pass.mjs |
| Visibility | hide/show + Hide All/Show All | single undoable commands | PASS | remediation-smoke / S2 |
| Lock | lock/unlock via context bar + properties | geometry locked, other props editable, z-order blocked | PASS (S1/S3) | PASS | S1/S3 checks |
| Duplicate | fixed offset + duplicate mode (click-to-place) | copies selected, bindings re-parented, Esc exits mode | PASS | remediation-smoke / S2 |
| Undo/redo | every mutation + long sequences + branch clearing | exact reverse/forward, history capped, redo cleared on new branch | PASS (S2 sequences) | PASS | S2 checks |
| Save | persists canonical state (names, geometry, zIndex, visible, locked, bindings, priority, profile) | localStorage JSON matches visible project; chip honest | PASS | lead-pass / S2 |
| Open | reload restores everything | tree + canvas + properties reconstruct | PASS (1172-byte payload restored, 0 errors) | PASS | reload-check.mjs |
| Dirty state | chip across edit/save/undo/redo | exact | PASS (S2) | PASS | S2 checks |
| Simulator | typed profile-driven inputs, defaults seeded, traces | integers are numbers, enums are selects, Run/Step trace [Runtime]/[Binding] | PASS (S3) | PASS | S3 checks |
| Preview | runtime scene + binding application; blocks editing | hide/show actions change rendering; drag blocked with warning; clear semantics vs Design | PASS (S3) | PASS | S3 checks |
| Bindings | add/remove with typed values + live evaluation | modal reflects TRUE/FALSE; deletion-safe | PASS (S3) | PASS | S3 checks |
| Validation | actionable messages (what/where/why/how) | message + remediation surfaced to the user | see S5 | see S5 | S5 checks |
| Build | honest states Building→verifying→checksum verified; blocked with reasons | PASS | PASS | S5 checks |
| Deployment | honest browser status; no fake "deployed" | status truthful; transport requires Tauri shell | PASS (honesty) | PASS | S5 checks |
| Settings | persisted; every field wired; blocking modal semantics | backdrop inert, Escape cancels, Cancel discards | PARTIAL — see S4/S5 | see S4/S5 | lead-pass2 / S4 |
| Keyboard | registry-driven shortcuts incl. from input focus | Ctrl+S/N global; C/X/V/A/Z/Y native in inputs | PASS (164d215) | PASS | reload-check.mjs |
| Accessibility | labels, focus rings, aria, modal trap, keyboard splitters | see S4 | see S4 | see S4 | S4 checks |
| Errors/recovery | corrupt storage, save failure, modal crash paths | boot to scaffold; ERROR console entry; no white screen | see S5 | see S5 | S5 checks |
| Responsive | 1280×720 / 1440×900 / 1920×1080 usable | device frame dominates; no clipping | PASS at all three (frame 203/405 px wide; fixed in 164d215) | PASS | lead-720 / S4 |
| Tauri | config/capabilities/CSP/close guard/package | see S5 (cargo absent → UNVERIFIED items) | see S5 | see S5 | S5 checks |

## Open specialist findings

Filled from specialist reports during integration; each row gets a fix commit or an explicit defer/reject decision.

| ID | Severity | Area | Finding | Decision |
|---|---|---|---|---|
| S3-01 | P1 | properties | Escape COMMITTED every draft (Name/X/Y/W/H/zIndex/priority) via blur()/state race | FIXED 0743bf2 (discardRef); live-verified: Escape reverts, no command pushed |
| S3-02 | P2 | keyboard | Ctrl+Z dead immediately after Enter commit (focus stayed in input) | FIXED 0743bf2 (blur on successful commit); live-verified |
| S3-03 | P2 | selection | undo of rename left a stale inspector label | FIXED 0743bf2 (label re-derivation on [project]); live-verified |
| S3-04 | P3 | properties | Name field rejected invalid input silently | FIXED 0743bf2 (feedback state + status message) |
| S3-05 | P3 | binding editor | dead duplicate footer "Add Binding" with stale title | FIXED 0743bf2 (removed) |
| S3 lead | P2 | runtime | negated condition on unset input returned FALSE | FIXED 0743bf2 (symmetric NOT semantics + regression test) |
| S4-01 | P1 | canvas | Add Widget stacked identical boxes (100% occlusion, only top widget reachable) | FIXED 0743bf2 (snap-grid cascade); live-verified boxes at distinct coords |
| S4-02 | P1 | properties | inspector overflow 379–616 px with no scroll affordance | FIXED 0743bf2 (scrollbar-gutter + scroll shadows + tighter padding) |
| S4-03 | P2 | contrast | 25 failing text pairs; --text-muted ≤4.26:1 on all surfaces | FIXED 0743bf2 (muted #5c6a70, primary buttons on --accent-hover, dark-surface text raised) |
| S4-04 | P2 | disabled state | opacity .43 → 1.71:1 effective contrast | FIXED 0743bf2 (explicit token disabled recipe) |
| S4-05 | P2 | alignment | zoom controls 24/14px inside a 28px toolbar | FIXED 0743bf2 (28px zoom + readout) |
| S4-06 | P2 | alignment | tree rows 32 vs 37 px | FIXED 0743bf2 (fixed 36px rows) |
| S4-07 | P2 | targets | 7×7 handles, 14×14 checkboxes | FIXED 0743bf2 (19px hit area, 16px checkboxes) |
| S4-08 | P2 | layout | panels 3.65× device frame at 1280×720 | FIXED 0743bf2 (viewport-clamped panel widths) |
| S4-09 | P2 | disabled honesty | disabled controls/menu items without reason | FIXED 0743bf2 (titles/disabledReason) |
| S4-10 | P2 | truncation | widget ID unreadable, no tooltip | FIXED 0743bf2 (PropertyRow title) |
| S4-11 | P3 | spacing | 8/13 containers off the 4-scale | FIXED 0743bf2 (normalized) |
| S4-12 | P3 | sizing | panel actions 27px accidental | FIXED 0743bf2 (24px token) |
| S4 a11y lead | P2 | a11y | splitter focus-visible removed the outline | FIXED 0743bf2 (focus ring kept) |
| S4 §6 | P2 | empty states | empty states prose-only, no click target | FIXED 0743bf2 (Add Widget action inside canvas empty state) |

## Acceptance blockers after lead pass (fixed)

| ID | Severity | Problem | Fix commit |
|---|---|---|---|
| L1 | P0 | device frame collapsed to ~129 px at every window size | 164d215 |
| L2 | P1 | created/canvas-selected widgets invisible in Explorer (parent not expanded) | 164d215 |
| L3 | P1 | selection label stale after rename (INT-24) | 164d215 |
| L4 | P1 | undo/redo leaves selection pointing at deleted nodes (INT-25) | 164d215 |
| L5 | P1 | Ctrl+S silently swallowed while a text field had focus | 164d215 |
| L6 | P2 | reopened project hid scenes/widgets behind collapsed rotations | 164d215 |
