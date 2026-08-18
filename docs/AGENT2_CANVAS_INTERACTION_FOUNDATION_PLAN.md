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

The following rules are treated as the baseline contract unless a more specific repository specification or an approved product decision supersedes them. The decisions in Section 6A are now approved for Agent 2 implementation.

### 4.1 Coordinate model

Widget geometry is expressed in Scene coordinates as `{ x, y, width, height }`. The active Scene and Rotation dimensions are read from canonical state; the implementation must not hard-code a device size or widget whitelist. The Scene content origin is the top-left of the active display surface, with positive `x` to the right and positive `y` downward.

The implementation must centralize pure conversion functions with explicit inputs and outputs:

```text
screenToCanvas(screenPoint, viewport, viewTransform)
canvasToScreen(canvasPoint, viewport, viewTransform)
canvasToScene(canvasPoint, sceneFrame)
sceneToCanvas(scenePoint, sceneFrame)
```

Screen coordinates are CSS pixels. Geometry calculations may use floating-point values. Commit normalization/precision must follow the existing Domain convention and must not introduce an unrelated rounding policy.

Canvas display must preserve the active Rotation/Form aspect ratio. Panel resize may change the viewport and letterboxing, but it must not change Widget geometry.

### 4.2 Pointer lifecycle

Only the primary pointer button starts selection, drag, resize, or marquee. A drag/marquee begins only after movement exceeds **4 CSS pixels**. Movement at or below that threshold is treated as a click.

Canvas captures the active pointer when an interaction begins and releases capture on commit, cancel, `pointercancel`, lost pointer capture, or window blur.

`Escape`, `pointercancel`, lost pointer capture, and window blur cancel the active drag or resize without committing a mutation and without adding a history entry. A canceled interaction restores the exact initial preview state.

### 4.3 Hit testing

Hit testing is a pure function. It receives a Canvas/Scene point and the renderable widget set and returns a Widget ID or `null`.

The function must respect geometry, visibility/interactivity semantics, and effective z-order. For overlapping widgets, the topmost widget wins. If two widgets have equal effective z-order, **active Scene document order is the deterministic tie-break**; stable Widget ID is used only as a final deterministic tie-break if document order cannot distinguish the candidates.

A point on a widget boundary is considered inside the widget for hit testing.

Invisible widgets are not hit-testable directly from the Canvas. They remain selectable through Explorer and selection-bounds interactions. This behavior must be tested explicitly.

### 4.4 Selection

Selection is transient UI state and must contain unique IDs. A normal click selects one widget; an empty Canvas click clears selection. `Ctrl`/`Cmd` toggles/adds selection.

**Selection ordering is active Scene document/widget order.** Additive selection must preserve deterministic Scene order rather than click-arrival order. Selection arrays must never contain duplicate IDs.

Selection state must be shared coherently by Canvas and Explorer. A selection change must not mutate the Project document or create a history entry.

Locked widgets remain selectable and visible in selection. Only unlocked widgets are eligible for geometry mutation.

### 4.5 Marquee

A pointer down on empty Canvas followed by movement beyond the **4 CSS pixel** drag threshold starts marquee selection. The marquee rectangle is normalized and remains transient.

A widget is selected when its bounds intersect the marquee rectangle. **Edge-touch counts as intersection**; intersection tests are inclusive at boundaries.

Additive marquee selection uses `Ctrl`/`Cmd`. Empty non-additive marquee selection clears the previous selection.

Marquee selection never mutates the Project or creates a history entry.

### 4.6 Movement

At pointer down, capture the initial geometry of all eligible selected widgets. During pointer movement, calculate a delta in Scene coordinates and produce transient preview geometry. Every eligible widget receives the same delta, preserving relative spacing.

On pointer up, compare preview against initial geometry. A changed gesture dispatches exactly one `EditorApplication.setWidgetGeometries()` call and therefore one logical history entry. A no-op gesture dispatches no mutation and creates no history entry. A canceled gesture restores the exact initial preview and creates no history entry.

Locked widgets are excluded from geometry mutation. If a selection contains both locked and unlocked widgets, locked widgets remain in place while unlocked widgets receive the common delta. If all selected widgets are locked, the gesture is a no-op.

### 4.7 Resize

Resize calculations are pure functions and operate on initial geometry plus pointer delta. Left, right, top, bottom, and corner handles support width/height changes, minimum dimensions, and negative-size prevention.

**Multi-widget resize uses the selection bounding box as the reference frame.** The active resize handle transforms the mutable selected widgets relative to that bounding box; relative positions and proportions inside the selection are preserved. Locked widgets retain their original geometry and are excluded from the transform. If no mutable widget remains, resize is a no-op.

The resize operation must remain one logical history entry per completed gesture. Cancellation restores the exact initial geometry and creates no history entry.

### 4.8 Snapping

Snapping calculations are pure and separated from mutation. The planned primitives are:

```text
snapValue(value, configuration)
snapPoint(point, configuration)
snapGeometry(candidate, configuration, otherGeometries)
calculateSnapGuides(candidate, configuration, otherGeometries)
```

The snap threshold is **6 Scene units**.

All eligible snap candidates within threshold are evaluated. The **nearest candidate wins** rather than using an unconditional snap-type priority. When candidates are at equal distance, the deterministic tie-break priority is:

1. Grid
2. Widget edge alignment
3. Widget center alignment
4. Stable candidate/Widget ID ordering

Snapping is evaluated independently per axis when applicable. The active selection is excluded from self-snapping. For multi-selection, the **selection bounding box** is the snap reference geometry.

Snap guides are transient visualization only. Grid visibility remains separate from snap enablement.

### 4.9 Keyboard

Keyboard handlers dispatch through application capabilities and never mutate Project directly. The canonical keyboard contract is:

| Input | Behavior |
|---|---|
| Arrow | Move selection by **1 Scene unit** |
| `Ctrl`/`Cmd` + Arrow | Move selection by the configured **snap-grid unit** |
| `Shift` + `Ctrl`/`Cmd` + Arrow | Move selection by **5 × snap-grid unit** |
| Delete / Backspace | `EditorApplication.deleteSelection()` when supported |
| `Ctrl`/`Cmd` + A | Select all widgets in active Scene |
| Escape | Cancel active interaction |
| `Ctrl`/`Cmd` + D | `EditorApplication.duplicateSelection()` |

The previous Agent 2 prompt wording that implied `Shift + Arrow` is superseded by this canonical shortcut table. `Ctrl/Cmd + Arrow` is the fine/grid movement modifier and `Shift + Ctrl/Cmd + Arrow` is the large movement modifier. The implementation must not add a separate `Shift + Arrow` movement mode.

`Ctrl/Cmd + D` is approved because `EditorApplication.duplicateSelection()` exists in the Agent 1 canonical mutation layer. It must be implemented through that capability, not by Canvas-local duplication.

Keyboard shortcuts must respect text-input/focus boundaries.

### 4.10 Context menu

Canvas and Widget context menus expose only real capabilities. Delete, duplicate, geometry movement, and property navigation map to existing application commands or clearly defined application methods. Unsupported commands are disabled or omitted. No fake command handlers or fake success logs are allowed.

## 5. Implementation phases after approval

### Phase A — Contract and audit lock

Re-read the applicable repository documents and inspect the complete current Canvas surface, including `App.tsx`, `canvas-interaction.ts`, `editor-commands.ts`, `editor-types.ts`, the Core mutation files, Domain models/factories, and all relevant tests. Apply the approved Section 6A decisions before changing behavior. Record dependencies on another Agent’s scope instead of implementing them implicitly.

### Phase B — Pure interaction primitives

Create or refine small, pure, testable functions for coordinate conversion, rectangle normalization/intersection, hit testing, selection transitions, drag geometry, resize geometry, snapping, and guide calculation. These functions must not read from or mutate React state, `Project`, `DocumentStore`, or `CommandHistory`.

### Phase C — Interaction state machine

Replace conflicting boolean flags with a clear interaction model. At minimum, interaction modes should cover `idle`, `marquee`, `dragging`, `resizing`, and `panning`; hover may remain an orthogonal transient state. State transitions define pointer down, threshold crossing, pointer move, pointer up, Escape, pointer cancellation, lost capture, and focus loss.

### Phase D — React integration and rendering

Connect pure primitives to the existing store snapshot and transient preview state. Render canonical geometry when idle and preview geometry only during active interaction. Add deterministic selection outlines, multi-selection bounds, resize handles, marquee feedback, hover feedback, active drag state, and snap guides without copying the entire Project into local state.

### Phase E — Canonical command dispatch

At each logical commit boundary, dispatch one application mutation for one completed drag or resize gesture. Use existing `EditorApplication.setWidgetGeometries()`, `deleteSelection()`, and `duplicateSelection()` capabilities where available. Add an application command only when the existing API is an actual blocker; do not move mutation logic into Canvas helpers.

### Phase F — Keyboard and context commands

Wire keyboard and context-menu behavior through the repository’s command/application layer. Respect focus and text-input boundaries. Use the canonical shortcut table in Section 4.9.

### Phase G — Verification and regression

Run focused Canvas tests, the full Agent 1 test suite, type checking, production build, and Tauri validation. If browser/dev-server execution is available, perform the browser smoke test against a real populated fixture. Record exact commands and results in the final Agent 2 report.

## 6. Decisions required before implementation

The following decisions were initially open. They are now resolved by the approved contract in Section 6A.

| Decision | Status |
|---|---|
| Equal z-order tie-break | Resolved: active Scene document order, stable ID final tie-break |
| Selection ordering | Resolved: active Scene document/widget order |
| Rectangle edge-touch | Resolved: inclusive |
| Drag threshold | Resolved: 4 CSS pixels |
| Pointer cancellation | Resolved: pointercancel/lost capture/window blur/Escape cancel with zero history |
| Multi-widget resize | Resolved: selection bounding-box transform |
| Snap threshold and priority | Resolved: 6 Scene units; nearest candidate; Grid > Edge > Center > stable ID on equal distance |
| Multi-selection snapping | Resolved: selection bounding box |
| Keyboard step sizes | Resolved: Arrow 1 Scene unit; Ctrl/Cmd+Arrow snap-grid; Shift+Ctrl/Cmd+Arrow 5× snap-grid |
| Arrow modifier conflict | Resolved: Section 4.9 supersedes prior Shift+Arrow wording |
| `Ctrl/Cmd+D` status | Resolved: approved |
| Zoom/pan gesture | Deferred: no new product behavior is invented in Agent 2; preserve existing repository behavior and prepare only testable hooks if required |
| Invisible widget Canvas hit test | Resolved: not Canvas-hit-testable; selectable through Explorer/selection bounds |

### 6A. Approved interaction decisions

These are canonical Agent 2 product decisions for implementation. They must not be silently changed during coding.

- **Drag threshold:** 4 CSS pixels.
- **Selection ordering:** active Scene document/widget order; unique IDs only.
- **Equal z-order tie-break:** active Scene document order, then stable Widget ID as final deterministic tie-break.
- **Hit-test boundary:** widget boundary points are inside.
- **Marquee edge-touch:** inclusive; touching an edge counts as intersection.
- **Pointer cancellation:** `pointercancel`, lost pointer capture, window blur, and Escape cancel the active interaction; no mutation and zero history entry.
- **Locked widgets:** selectable, but excluded from geometry mutation. If no mutable widget remains, the gesture is a no-op.
- **Multi-widget resize:** selection bounding-box transform; preserve relative positions/proportions of mutable selected widgets; locked widgets remain unchanged.
- **Snap threshold:** 6 Scene units.
- **Snap candidate selection:** evaluate all eligible candidates within threshold; nearest candidate wins.
- **Snap tie-break:** Grid, then Widget Edge, then Widget Center, then stable candidate/Widget ID ordering when distances are equal.
- **Multi-selection snapping reference:** selection bounding box.
- **Arrow movement:** 1 Scene unit.
- **Ctrl/Cmd + Arrow:** configured snap-grid unit.
- **Shift + Ctrl/Cmd + Arrow:** 5 × configured snap-grid unit.
- **Shift + Arrow alone:** not a movement shortcut.
- **Ctrl/Cmd + D:** approved duplicate shortcut through `EditorApplication.duplicateSelection()`.
- **Invisible widgets:** not Canvas-hit-testable; remain selectable via Explorer and selection-bounds interactions.
- **Zoom/pan:** no new product gesture is invented in this phase; use the repository’s already-defined behavior where present and do not block the core interaction foundation on a new gesture contract.

### 6B. Interaction contract precedence

When implementing Agent 2, precedence is:

1. Domain/runtime contract and canonical mutation semantics.
2. This finalized Agent 2 interaction contract, especially Section 6A.
3. UI Design System behavior that does not conflict with Section 6A.
4. Existing prototype behavior only where it does not contradict the above.

If an existing prototype conflicts with Section 6A, update the prototype to match the contract rather than preserving the old behavior.

## 7. Test plan

### Pure unit tests

Add or extend `tests/canvas-interaction.test.ts` with deterministic tests for:

| Group | Required coverage |
|---|---|
| Coordinates | Screen↔Canvas, Canvas↔Scene, zoom, pan, origin, aspect-ratio/letterbox handling |
| Hit testing | Empty Canvas, one widget, overlap, z-order, equal-z tie-break, boundary behavior, invisible widget exclusion |
| Selection | Single, clear, additive, toggle, unique IDs, deterministic Scene-document ordering |
| Marquee | Normalization, intersect, non-intersect, inclusive edge-touch, additive mode |
| Drag | Single widget, multi-widget, common delta, locked-only no-op, mixed locked/unlocked, no-op, cancel, 4px threshold |
| Resize | Every edge, corners, minimum size, negative-size prevention, bounding-box multi-resize, locked widget, cancel |
| Snapping | Grid, edge, center, 6-unit threshold, nearest-candidate selection, equal-distance tie-break, axis behavior, no snap, guides, self-snap exclusion, selection-bounds reference |
| Keyboard | Arrow, Ctrl/Cmd+Arrow, Shift+Ctrl/Cmd+Arrow, Delete/Backspace, Escape, Ctrl/Cmd+A, Ctrl/Cmd+D |

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

The history matrix must include one entry for single drag, multi-drag, resize, duplicate, and delete; zero entries for canceled drag, canceled resize, and no-op drag/resize. It must also verify that locked geometry creates no fake history entry and that the Canvas never bypasses `EditorApplication`.

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

The interaction contract has now been finalized in this planning document. No Canvas implementation should start outside the scope defined here. The next action is Agent 2 implementation against the finalized contract, followed by focused Canvas QA and full Agent 1 regression verification.
