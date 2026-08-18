# Agent 2 — Canvas Interaction Foundation Implementation Plan

## Document status

This document records the implementation plan for Agent 2. It is intentionally a planning commit only: **no application code is changed by this commit**. Implementation must begin only after the plan and the open product decisions below have been reviewed.

| Item | Value |
|---|---|
| Repository | `Huseyincansagir/Template_Designer` |
| Target branch | `manus2` |
| Baseline commit | `c76442826c02ad54fd37850c5742c1263c2fccf3` — `fix(editor): complete final hardening pass` |
| Plan commit | `docs(canvas): add Agent 2 interaction implementation plan` |
| Implementation commit | `feat(canvas): implement canvas interaction foundation` |
| Owner | Agent 2 — Canvas Interaction Foundation |
| Current phase | Planning and contract clarification |

The plan is based on the repository’s existing [development plan](TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md), [UI design system](UI_DESIGN_SYSTEM_V2.md), [application architecture](ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md), [domain model](DOMAIN_MODEL_V1.md), and the current implementation on `manus2`.

## 1. Mission and architectural boundary

Agent 2 will implement the Canvas as a deterministic interaction layer over the canonical Project document. The Canvas is not a second document store and does not own Project, ThemeProjectGroup, ThemeProject, Rotation, Scene, or Widget state.

All persistent changes must cross the existing application boundary:

```text
UI interaction
    -> Canvas interaction layer
    -> EditorApplication
    -> DocumentStore
    -> CommandHistory
    -> canonical Domain
    -> DocumentStore snapshot
    -> React UI
```

Transient interaction state may live in React state or a dedicated interaction controller, provided that it contains only interaction data such as pointer position, hover, selection, marquee geometry, drag/resize preview, zoom, pan, snapping guides, and the active interaction mode. The implementation must not copy the entire Project into Canvas-local state.

The implementation must preserve Agent 1’s mutation semantics. It must not redesign the canonical mutation pipeline, introduce a second state-management system, or modify the Domain model unless a repository-proven blocker is demonstrated and documented.

## 2. Repository audit findings

The baseline already contains a useful Canvas prototype and a working canonical mutation layer. Agent 2 should extend this implementation incrementally rather than replace it wholesale.

| Area | Current baseline | Plan implication |
|---|---|---|
| Document ownership | `App.tsx` creates an `InMemoryDocumentStore`, subscribes through `useSyncExternalStore`, and creates one `EditorApplication` instance | Preserve this ownership model and keep Canvas rendering derived from the store snapshot |
| Transient Canvas state | `App.tsx` already holds `selectedIds`, `zoom`, `geometryOverrides`, and a `canvasPointer` union for idle/marquee/drag/resize | Consolidate and strengthen this state model rather than adding another Project store |
| Existing pure helpers | `canvas-interaction.ts` contains `snapValue`, `snapGeometry`, `normalizeRect`, and `intersects` | Extend or split pure primitives as needed, preserving existing behavior and expanding tests |
| Current coordinate conversion | `toCanvasPoint()` directly maps pointer coordinates to the active rotation dimensions | Centralize screen/canvas/scene conversion and make pan, zoom, origin, and viewport behavior explicit |
| Current drag/resize | Preview uses `geometryOverrides`; pointer-up calls `editorApplication.setWidgetGeometries()` | Preserve preview/commit separation and guarantee one logical mutation per completed gesture |
| Locked geometry | `EditorApplication.setWidgetGeometries()` excludes locked widgets and returns `changed: false` for a no-op | Canvas must filter locked widgets for predictable UX but Core remains the final authority |
| Selection | Selection is transient React state and is also synchronized from Explorer interactions | Keep selection transient, deterministic, unique, and shared by Explorer and Canvas |
| Context commands | `editor-commands.ts` contains descriptors for delete and property navigation, but not every requested Canvas command | Map only real capabilities; unavailable commands must be disabled or omitted rather than faked |
| Tests | `tests/ui-phase2.test.ts` covers basic Canvas helper behavior; `tests/editor-pipeline.test.ts` covers Agent 1 mutations | Add focused Canvas unit/integration tests and rerun the full Agent 1 regression suite |

The current prototype’s `updateWidgetGeometries()` helper is a pure Project transformation. It must not become a bypass for persistent interaction commits. Persistent movement and resize must continue through `EditorApplication.setWidgetGeometries()`.

## 3. Scope

### In scope

Agent 2 owns the following capabilities:

1. A centralized Canvas coordinate model.
2. Deterministic hit testing with geometry and effective z-order.
3. Single selection, additive selection, toggle selection, and multi-selection.
4. Marquee selection with explicit intersection semantics.
5. Single- and multi-widget movement with transient preview and one commit.
6. Locked-widget behavior during selection, movement, and resize.
7. Resize foundations for edge and corner handles, minimum dimensions, and negative-size prevention.
8. Grid, edge, and center snapping primitives with guide calculation.
9. Keyboard movement, deletion, duplication, select-all, and Escape cancellation where the corresponding application capability exists.
10. Selection visualization, hover state, marquee feedback, resize handles, drag state, and snap guides.
11. A mutually exclusive interaction state machine.
12. Canvas-to-`EditorApplication` command dispatch.
13. Unit and integration tests for the above behavior.

### Explicitly out of scope

The implementation must not redesign the Properties Panel, Docking System, Asset Browser, Simulator, Deployment, SD Card, Wi-Fi, ESP32 communication, firmware, full template import/export, or the advanced animation timeline. Future hooks such as rotation, aspect-ratio lock, Bounding Group, alignment, and distribution may be prepared only if doing so does not add behavior or bypass the canonical mutation pipeline.

## 4. Canonical interaction contract

The following rules are treated as the baseline contract unless a more specific repository specification or an approved product decision supersedes them.

### 4.1 Coordinate model

Widget geometry is expressed in Scene coordinates as `{ x, y, width, height }`. The active Scene and Rotation dimensions are read from canonical state; the implementation must not hard-code a device size or widget whitelist. The Scene content origin is intended to be the top-left of the active display surface, with positive `x` to the right and positive `y` downward.

The implementation must centralize pure conversion functions with explicit inputs and outputs:

```text
screenToCanvas(screenPoint, viewport, viewTransform)
canvasToScreen(canvasPoint, viewport, viewTransform)
canvasToScene(canvasPoint, sceneFrame)
sceneToCanvas(scenePoint, sceneFrame)
```

The exact transform type should be small and serializable, for example viewport origin, pan offset, zoom scale, and scene dimensions. Screen coordinates are CSS pixels. Geometry calculations may use floating-point values; normalization and commit precision must follow the existing Domain convention rather than silently introducing a new rounding policy.

Canvas display must preserve the active Rotation/Form aspect ratio. Panel resize may change the viewport and letterboxing, but it must not change Widget geometry.

### 4.2 Pointer lifecycle

Only the primary pointer button starts selection, drag, resize, or marquee. A click and a drag must be distinguished by a defined movement threshold. Pointer capture must be acquired for an active gesture and released on commit, cancellation, `pointercancel`, lost pointer capture, or window focus loss.

`Escape`, `pointercancel`, lost pointer capture, and window blur cancel the active drag or resize without committing a mutation and without adding a history entry. If the movement remains below the click threshold, the gesture behaves as a selection click rather than a move.

### 4.3 Hit testing

Hit testing is a pure function. It receives a Canvas/Scene point and the renderable widget set and returns a Widget ID or `null`.

The function must respect geometry, visibility/interactivity semantics, and effective z-order. For overlapping widgets, the topmost widget wins. The implementation must define the tie-break rule for equal z-order and whether a boundary point is considered inside; these decisions must not be scattered through React event handlers.

Invisible widgets are not rendered but remain selectable through Explorer and selection bounds, in accordance with the repository UI specification. If direct Canvas hit testing for invisible widgets is intentionally excluded, that behavior must be stated and tested rather than implied.

### 4.4 Selection

Selection is transient UI state and must contain unique IDs. A normal click selects one widget; an empty Canvas click clears selection. `Ctrl`/`Cmd` and the repository-confirmed multi-select modifiers toggle or add selection. Selection ordering must be deterministic and must use one explicit rule, such as active Scene document order or effective z-order.

Selection state must be shared coherently by Canvas and Explorer. A selection change must not mutate the Project document or create a history entry. When a selection contains locked and unlocked widgets, locked widgets remain selectable and visible in the selection, but only unlocked widgets are eligible for geometry mutation.

### 4.5 Marquee

A pointer down on empty Canvas followed by movement beyond the drag threshold starts marquee selection. The marquee rectangle is normalized and remains transient. A widget is selected when its bounds intersect the marquee rectangle, with edge-touch behavior explicitly defined and tested. Additive marquee selection uses `Ctrl`/`Cmd` or the repository-confirmed modifier. Empty non-additive marquee selection clears the previous selection.

Marquee selection must never mutate the Project or create a history entry.

### 4.6 Movement

At pointer down, capture the initial geometry of all eligible selected widgets. During pointer movement, calculate a delta in Scene coordinates and produce transient preview geometry. Every eligible widget receives the same delta, so relative spacing is preserved.

On pointer up, compare the preview against the initial geometry. A changed gesture dispatches exactly one `EditorApplication.setWidgetGeometries()` call and therefore one logical history entry. A no-op gesture dispatches no mutation and creates no history entry. A canceled gesture restores the exact initial preview and creates no history entry.

Locked widgets must not be moved. If a selection contains both locked and unlocked widgets, the locked widgets stay in place while unlocked widgets receive the common delta. If all selected widgets are locked, the interaction is a no-op and must not create a history entry.

### 4.7 Resize

Resize calculations are pure functions and operate on initial geometry plus a pointer delta. Left, right, top, bottom, and corner handles must support width/height changes, minimum dimensions, and negative-size prevention. When resizing from a left or top edge would cross the minimum dimension, the opposite edge must remain stable according to the chosen handle contract.

Multi-widget resize is a product decision that must be resolved before implementation. The plan must not silently choose between independent resize and selection-bounding-box resize. Whichever behavior is approved must have explicit geometry and history tests.

Locked widgets cannot be resized. A canceled resize must restore the exact initial geometry and create no history entry.

### 4.8 Snapping

Snapping calculations are pure and must be separated from mutation. The planned primitives are:

```text
snapValue(value, configuration)
snapPoint(point, configuration)
snapGeometry(candidate, configuration, otherGeometries)
calculateSnapGuides(candidate, configuration, otherGeometries)
```

Grid snapping, nearby edge snapping, and nearby center snapping must be deterministic. Thresholds, priority between grid/edge/center snapping, axis independence, self-snap exclusion, equal-distance tie-breaks, and multi-selection reference geometry must be explicit before implementation. Snap guides are transient visualization only.

Grid visibility must remain separate from snap enablement, as required by the UI design system.

### 4.9 Keyboard

Keyboard handlers must dispatch through application capabilities and must not mutate the Project directly. The repository-confirmed keyboard rules are:

| Input | Planned behavior | Status to resolve |
|---|---|---|
| Arrow | Move selection by the normal snap-grid unit | Confirmed by UI specification |
| `Ctrl`/`Cmd` + Arrow | Fine movement by the repository-defined grid/10 amount | Confirmed by UI specification |
| `Shift` + `Ctrl`/`Cmd` + Arrow | Move by snap-grid × 5 | Confirmed by UI specification |
| Delete / Backspace | `EditorApplication.deleteSelection()` | Required by Agent 2 prompt; application capability must be verified |
| `Ctrl`/`Cmd` + A | Select all widgets in active Scene | Confirmed by UI specification |
| Escape | Cancel active interaction | Confirmed |
| `Ctrl`/`Cmd` + D | `EditorApplication.duplicateSelection()` | Required by Agent 2 prompt, but marked Proposed in the UI specification; resolve before implementation |

The prompt’s “Shift + Arrow” wording and the UI specification’s `Ctrl+Arrow` / `Shift+Ctrl+Arrow` wording are not identical. The repository’s canonical shortcut registry and product decision must settle this conflict before keyboard tests are finalized.

### 4.10 Context menu

Canvas and Widget context menus must expose only real capabilities. Delete, duplicate, geometry movement, and property navigation must map to existing application commands or clearly defined new application methods. A command that is not implemented must be disabled or omitted; no fake command handlers or fake success logs are allowed.

## 5. Implementation phases after approval

### Phase A — Contract and audit lock

Re-read the applicable repository documents and inspect the complete current Canvas surface, including `App.tsx`, `canvas-interaction.ts`, `editor-commands.ts`, `editor-types.ts`, the Core mutation files, Domain models/factories, and all relevant tests. Resolve the open decisions in Section 6 before changing behavior. Record any dependency on another Agent’s scope instead of implementing it implicitly.

### Phase B — Pure interaction primitives

Create or refine small, pure, testable functions for coordinate conversion, rectangle normalization/intersection, hit testing, selection transitions, drag geometry, resize geometry, snapping, and guide calculation. These functions must not read from or mutate React state, `Project`, `DocumentStore`, or `CommandHistory`.

### Phase C — Interaction state machine

Replace conflicting boolean flags with a clear interaction model. At minimum, interaction modes should cover `idle`, `marquee`, `dragging`, `resizing`, and `panning`; hover may remain an orthogonal transient state. State transitions must define pointer down, threshold crossing, pointer move, pointer up, Escape, pointer cancellation, lost capture, and focus loss.

### Phase D — React integration and rendering

Connect the pure primitives to the existing store snapshot and transient preview state. Render canonical geometry when idle and preview geometry only during the active interaction. Add deterministic selection outlines, multi-selection bounds, resize handles, marquee feedback, hover feedback, active drag state, and snap guides without copying the entire Project into local state.

### Phase E — Canonical command dispatch

At each logical commit boundary, dispatch one application mutation for one completed drag or resize gesture. Use the existing `EditorApplication.setWidgetGeometries()`, `deleteSelection()`, and `duplicateSelection()` capabilities where available. Add an application command only when the existing API is an actual blocker; do not move mutation logic into Canvas helpers.

### Phase F — Keyboard and context commands

Wire keyboard and context-menu behavior through the repository’s command/application layer. Respect focus and text-input boundaries so shortcuts do not interfere with editable fields. Resolve the `Ctrl+D` and arrow-modifier contract before adding tests.

### Phase G — Verification and regression

Run focused Canvas tests, the full Agent 1 test suite, type checking, production build, and Tauri validation. If browser/dev-server execution is available, perform the browser smoke test against a real populated fixture. Record exact commands and results in the final Agent 2 report.

## 6. Decisions required before implementation

The following items are intentionally not guessed in this plan. They require confirmation from the repository’s canonical product/UI contract or explicit approval before implementation:

| Decision | Why it matters | Required output |
|---|---|---|
| Equal z-order tie-break | Determines deterministic hit testing | Exact ordering rule and a unit test |
| Selection ordering | Determines stable selection arrays and multi-edit behavior | Document order, z-order, or another named rule |
| Rectangle edge-touch | Determines marquee and hit-test boundary behavior | Inclusive/exclusive rule and tests |
| Drag threshold | Separates click from move/marquee | Numeric CSS-pixel threshold |
| Pointer cancellation | Prevents partial gestures from committing | Behavior for `pointercancel`, lost capture, and blur |
| Multi-widget resize | Defines the actual UX and geometry algorithm | Bounding-box or independent-resize contract |
| Snap threshold and priority | Prevents jitter and inconsistent guides | Numeric threshold, priority, axis/tie-break rules |
| Multi-selection snapping | Defines the reference geometry for a group | Group bounds, active widget, or another explicit rule |
| Keyboard step sizes | Makes keyboard movement testable | Exact normal, fine, and large step values |
| Arrow modifier conflict | Prompt and UI spec currently differ | Canonical shortcut table |
| `Ctrl/Cmd+D` status | Prompt requires it; UI spec marks it Proposed | Approved shortcut or documented deferral |
| Zoom/pan gesture | Wheel/pinch and pan modifier are still Proposed in UI spec | Approved gesture and min/max/anchor behavior |
| Invisible widget Canvas hit test | UI spec allows Explorer/selection-bounds selection | Exact Canvas behavior and test coverage |

Until these decisions are resolved, implementation may proceed only on the unambiguous pure primitives and the existing canonical pipeline; it must not invent product behavior for the unresolved items.

## 7. Test plan

### Pure unit tests

Add or extend `tests/canvas-interaction.test.ts` with deterministic tests for:

| Group | Required coverage |
|---|---|
| Coordinates | Screen↔Canvas, Canvas↔Scene, zoom, pan, origin, aspect-ratio/letterbox handling |
| Hit testing | Empty Canvas, one widget, overlap, z-order, equal-z tie-break, boundary behavior |
| Selection | Single, clear, additive, toggle, unique IDs, deterministic ordering |
| Marquee | Normalization, intersect, non-intersect, edge-touch, additive mode |
| Drag | Single widget, multi-widget, common delta, locked-only no-op, mixed locked/unlocked, no-op, cancel |
| Resize | Every edge, corners, minimum size, negative-size prevention, multi-resize contract, locked widget, cancel |
| Snapping | Grid, edge, center, threshold, tie-break, no snap, guides, self-snap exclusion |
| Keyboard | Arrow variants, Delete/Backspace, Escape, Ctrl/Cmd+A, approved duplicate shortcut |

### Integration and history tests

For every persistent interaction, assert the complete lifecycle:

```text
before
  -> interaction
  -> after
  -> undo
  -> exact before
  -> redo
  -> exact after
```

The history matrix must include one entry for single drag, multi-drag, resize, approved duplicate, and delete; zero entries for canceled drag, canceled resize, and no-op drag/resize. It must also verify that locked geometry creates no fake history entry and that the Canvas never bypasses `EditorApplication`.

### Regression suite

Before declaring completion, rerun the entire Agent 1 pipeline suite and verify DocumentStore snapshot stability, command history, undo, redo, dirty state, duplicate, delete, locked geometry, no-op mutation handling, and New Project lifecycle.

## 8. Verification commands

Use the repository’s actual scripts and record exact results. The expected checks are:

```bash
npm run typecheck
npm test
npm run build
npm run tauri:check
```

If a script name differs, use the equivalent script from `package.json` and document the substitution. Do not claim `COMPLETE` without executing the applicable checks.

The browser smoke test, when available, must use an existing populated fixture. It must cover opening a Scene, selecting a Widget, dragging, undo/redo, multi-selection, multi-drag, resize, duplicate, delete, and Escape cancellation. If no populated fixture exists, report that the browser smoke test is unavailable and rely on the integration suite; do not invent a fake UI result.

## 9. Implementation commit and final gate

After approval, implementation should remain in one focused commit:

```text
feat(canvas): implement canvas interaction foundation
```

The implementation commit must not mix unrelated cleanup, firmware changes, Properties Panel redesign, or other Agent scopes. The final report must include the actual commit SHA, implementation status table, canonical mutation pipeline verification, history verification, exact test results, Agent 1 regression status, genuine limitations, and exactly one final gate: `COMPLETE`, `IMPLEMENTED BUT REQUIRES QA`, `PARTIALLY COMPLETE`, or `FAILED`.

The intended acceptance criterion is:

> Canvas is a deterministic interaction layer over canonical Project state, with centralized coordinate conversion, selection, hit testing, movement, resize and snapping foundations, correct cancellation and undo/redo semantics, and zero direct document-mutation bypasses.

## 10. Review checkpoint

The next action after this planning commit is external review of this document and the unresolved decisions in Section 6. No Canvas implementation should be started until that review is complete or the remaining decisions are explicitly accepted as repository-defined behavior.
