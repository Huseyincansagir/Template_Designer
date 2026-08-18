# Agent 2 — Canvas Interaction Foundation Implementation Plan

> **Reconciliation note.** This revision reconciles the red-team review [`CANVAS_INTERACTION_REDTEAM_REVIEW.md`](CANVAS_INTERACTION_REDTEAM_REVIEW.md) (findings F1–F13) against the canonical project documents. Where a previous revision of this plan contradicted a canonical specification, the canonical specification wins and is adopted verbatim. Contradictions are documented explicitly rather than silently resolved. This is a **planning/documentation-only reconciliation**: no application code is changed by this commit.

## Document status

| Item | Value |
|---|---|
| Repository | `Huseyincansagir/Template_Designer` |
| Target branch | `manus2` |
| Baseline commit | `c76442826c02ad54fd37850c5742c1263c2fccf3` — `fix(editor): complete final hardening pass` |
| Plan commit | `741baa1` — `docs(canvas): add Agent 2 interaction implementation plan` |
| Contract finalization | `a8bc378` — `docs(canvas): finalize interaction contract decisions` |
| Red-team review | `c8487f4` — `docs(canvas): add canvas interaction red-team review` |
| Implementation commit | `f1306ac` — `feat(canvas): implement canvas interaction foundation` |
| Reconciliation commit | `docs(canvas): reconcile red-team interaction contract` (this commit) |
| Owner | Agent 2 — Canvas Interaction Foundation |
| Current phase | Contract reconciled; implementation-ready |

The plan is based on the repository’s existing [development plan](TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md), [UI design system](UI_DESIGN_SYSTEM_V2.md), [UI canonical corrections](UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md), [application architecture](ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md), [domain model](DOMAIN_MODEL_V1.md), [domain/runtime contract](DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md), the red-team review above, and the current implementation on `manus2`.

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

The interaction layer is **rotation-compatible in architectural boundary, but not rotation-capable in geometry semantics**: its pure-function seams are designed so each geometry primitive can be replaced when a canonical rotation/transform contract lands, while every V1 geometry rule is axis-aligned-rectangle (AABB) only. See Section 5.

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

### 2.1 Application-code defects identified (NOT fixed by this reconciliation)

This commit is documentation-only. The following defects were observed in the current implementation and are recorded here as the mandatory remediation list for Agent 2/Core. They are **not** modified by this commit.

| ID | Location | Defect | Canonical expectation |
|---|---|---|---|
| D1 | `src/App/App.tsx:667` | Nudge step is inverted: plain Arrow = 1 Scene unit, `Ctrl/Cmd+Arrow` = grid, and `Shift+Arrow` falls through to the 1-unit step | Arrow = snap-grid unit; `Ctrl/Cmd+Arrow` = grid ÷ 10; `Shift+Ctrl/Cmd+Arrow` = grid × 5; `Shift+Arrow` = no movement (F1, §4.12) |
| D2 | `src/App/App.tsx:655` | `Ctrl/Cmd+D` is bound to duplication | `Ctrl+D` is PROPOSED in the canonical spec; it must not be bound in V1 (F8, §4.12) |
| D3 | `src/Core/editor-application.ts:99` | `addRotation()` hard-codes `720 × 1280` | Rotation dimensions must be sourced from `DeviceProfile.display`; no device size may be hard-coded (F11, §4.1) |
| D4 | `src/App/App.tsx:459` | `toCanvasPoint()` uses `zoom: 1, pan: {0,0}` while rendering applies CSS `scale`/`translate` | Coordinate conversion must use the actual view transform at the current zoom/pan (F12, §4.2) |
| D5 | `src/App/App.tsx:620` | Pointer-up commits the last-rendered `geometryOverrides` React state | The commit must be recomputed from initial geometry + final pointer delta/bounds (F10, §4.13) |
| D6 | `src/App/App.tsx:181,490` | `geometryOverrides` is cleared only on commit/cancel; Scene/Rotation switch or unmount mid-gesture leaks overrides onto different content | Every exit path must clear transient state (F10, §4.13) |
| D7 | `src/Core/editor-application.ts` (`setWidgetGeometries`/`deleteSelection`/`duplicateSelection`) | Commands apply by widget ID across the whole project | Canvas-initiated gestures must be scoped to widgets of the active Scene (F6, §4.6) |
| D8 | `src/Core/editor-application.ts:36,178` | `duplicateWidget` uses a fixed `+10/+10` offset and `duplicateSelection` does not select the copies | The current capability is capability-only; the canonical Duplicate mode (click-center placement, select copy) is a future feature (F8, §4.12) |
| D9 | `src/App/App.tsx:294-296` | `scene.reorder`/`widget.reorder` execute with `toIndex = 0` | Z-order commands must implement stacking-total-order semantics (F5/F9, §4.5) |
| D10 | `src/App/App.tsx:679` | Multi-selection bounds include only unlocked widgets while single-selection bounds include locked ones | Bounds membership must follow the F3/F7 contract exactly (§4.6, §4.7, §4.10) |

## 3. Scope

### In scope

Agent 2 owns the following capabilities:

1. A centralized Canvas coordinate model including the canonical Scene-unit definition and the view transform.
2. Deterministic hit testing with geometry and the canonical stacking (z-)order.
3. Single selection, additive selection, toggle selection, and multi-selection, including the primary/anchor widget.
4. Marquee selection with an explicit predicate primitive (inclusive intersection default).
5. Single- and multi-widget movement with transient preview and one commit.
6. Locked-widget behavior during selection, movement, and resize.
7. The deterministic multi-resize contract (reference frame, pivot, per-handle scaling law, minimum size, negative-size prevention).
8. Grid, edge, and center snapping primitives with deterministic pass-priority evaluation and guide calculation.
9. Keyboard movement, deletion, duplication via command surfaces, select-all, and Escape cancellation per the canonical shortcut table.
10. Z-order operations (Bring Forward / Send Backward / Bring To Front / Send To Back) as required by the development plan §4.C.
11. Selection visualization, hover state, marquee feedback, resize handles, drag state, and snap guides.
12. A mutually exclusive interaction state machine.
13. Canvas-to-`EditorApplication` command dispatch.
14. Unit and integration tests for the above behavior.

### Explicitly out of scope

The implementation must not redesign the Properties Panel, Docking System, Asset Browser, Simulator, Deployment, SD Card, Wi-Fi, ESP32 communication, firmware, full template import/export, or the advanced animation timeline.

Explicitly out of scope for Canvas Interaction Foundation V1 (each is a documented future dependency in Section 11):

- Rotation implementation (`R` key, free rotation, 5° snap) — confirmed product feature, requires the future Geometry/Transform contract (Section 5).
- Uniform / aspect-locked resize and the aspect-ratio lock setting.
- Content-aware text/media resize behavior and per-type minimum sizes.
- Zoom/pan user gestures (the coordinate/view-transform contract itself is in scope and locked; the gestures are not).
- Alternate marquee modes beyond the inclusive default (the predicate parameter is reserved only).
- Alignment and distribution (the primary-widget hook is prepared only).
- `Ctrl/Cmd+D` shortcut binding (PROPOSED in the canonical spec).
- Continuous history coalescing for Properties Panel editing.

## 4. Canonical interaction contract

The following rules are the implementation contract for Agent 2. They supersede any earlier wording in the previous revisions of this plan; where an earlier revision contradicted a canonical document, the contradiction is recorded in Section 7.1 and the canonical behavior is adopted.

### 4.1 Coordinate model and Scene unit (F11)

**Scene coordinates** are the logical coordinate space of the active Rotation. The Scene content origin is the top-left of the active display surface, with positive `x` to the right and positive `y` downward.

**A Scene unit is exactly 1 logical pixel of the active Rotation’s logical coordinate space.** Scene units are therefore tied to the active Scene/Rotation, not to the device preview on screen and not to CSS pixels.

The Rotation’s logical space is defined by `rotation.width × rotation.height`. Rotation dimensions are sourced from the active `DeviceProfile.display` resolution for the rotation’s orientation:

```text
R0 / R180  ->  (display.width,  display.height)
R90 / R270 ->  (display.height, display.width)
```

A Rotation whose dimensions do not match its profile’s orientation is a validation issue, not a new coordinate space. **No device size (e.g. `720 × 1280`) may be hard-coded in the interaction layer, in Core, or in documentation.** The current `addRotation()` hard-code is recorded as defect D3 for Agent 2/Core remediation.

Relationship of the coordinate spaces:

```text
Scene coordinates   = logical pixels of the active Rotation space (source of truth)
Rotation dimensions = rotation.width × height, sourced from DeviceProfile.display
DeviceProfile.display = the profile's physical display resolution (the R0 reference)
snap-grid unit      = an editor preference expressed in Scene units (default 10, §4.11)
zoom                = a percentage multiplier of the Scene→Screen fit scale (§4.2)
screen pixels       = CSS pixels of the Canvas viewport (§4.2)
```

### 4.2 View transform (F12)

The coordinate contract is fixed now, even though the zoom/pan *gestures* remain deferred:

```text
Scene space --(fit + zoom + pan + letterbox)--> Canvas space --(viewport offset)--> Screen space
```

With `viewport` = the Canvas viewport rect in CSS pixels, `sceneW/sceneH` = the active Rotation logical resolution in Scene units, `zoom` = zoom percentage, and `pan` = a Canvas-space offset in CSS pixels:

```text
fitScale      = min(viewport.width / sceneW, viewport.height / sceneH) × (zoom / 100)
contentWidth  = sceneW × fitScale
contentHeight = sceneH × fitScale
contentOrigin = viewport.top-left + ((viewport − content) / 2) + pan × fitScale   (letterbox centering + pan)

sceneToScreen(p) = contentOrigin + p × fitScale
screenToScene(p) = (p − contentOrigin) / fitScale
```

Properties of the contract:

- The device preview always preserves the active Rotation/Form aspect ratio; panel resize changes the viewport and letterboxing but never Widget geometry.
- Screen coordinates are CSS pixels. Scene coordinates are Scene units. The **drag threshold is screen-space (4 CSS px)**; **snap thresholds and keyboard steps are Scene-space (Scene units)**; conversion between the two always flows through the view transform at the current zoom.
- The current baseline implements this transform in `canvas-interaction.ts` (`sceneViewportRect`) but wires `zoom: 1`/`pan: {0,0}` into `toCanvasPoint()` while the renderer applies CSS `scale`/`translate` (defect D4). The interaction layer must convert and render with one and the same transform instance.
- Zoom/pan gesture implementation remains deferred; the transform contract is in scope, locked, and unit-tested.

### 4.3 Pointer lifecycle

Only the primary pointer button starts selection, drag, resize, or marquee. A drag/marquee begins only after movement exceeds **4 CSS pixels**. Movement at or below that threshold is treated as a click.

Canvas captures the active pointer when an interaction begins and releases capture on commit, cancel, `pointercancel`, lost pointer capture, or window blur.

`Escape`, `pointercancel`, lost pointer capture, and window blur cancel the active drag or resize without committing a mutation and without adding a history entry. A canceled interaction restores the exact initial preview state.

**Additionally:** switching the active Scene/Rotation or the open document mid-gesture cancels the active gesture with the same semantics (restore exact initial preview, zero history). Unmounting the Canvas cancels the active gesture and clears all transient interaction state (§4.13).

### 4.4 Hit testing

Hit testing is a pure function. It receives a Canvas/Scene point and the renderable widget set and returns a Widget ID or `null`.

The function must respect geometry, visibility/interactivity semantics, and the canonical stacking order (§4.5). For overlapping widgets, the topmost widget wins.

**Stacking order** is the total order defined by:

```text
(zIndex ascending, Scene.widgets array index ascending, stable Widget ID ascending)
```

The **topmost widget is the greatest element** of this order: highest `zIndex`; among equal `zIndex`, the later array index is on top; among those, the lexicographically greater stable ID is on top.

A point on a widget boundary is considered inside the widget for hit testing.

Invisible widgets are not hit-testable directly from the Canvas (§4.7). They remain selectable through Explorer and selection-bounds interactions. This behavior must be tested explicitly.

### 4.5 Z-order contract (F5, F9)

The Domain currently carries two candidate sources — `Widget.zIndex` and `Scene.widgets` array order — and the canonical UI spec leaves the equal-z ordering open (`UI_DESIGN_SYSTEM_V2.md` §28). This contract resolves the ambiguity for the interaction layer:

- **Canonical stacking source: `Widget.zIndex`.** `DOMAIN_MODEL_V1.md` defines `zIndex` on `Widget` (and on `MediaSlide`) and states z-order determines which content is drawn on top. Higher `zIndex` = drawn on top.
- **`Scene.widgets` array order is navigation/Explorer order only.** It is not the stacking source; it is used exclusively as the equal-`zIndex` tie-break.
- **Rendering order:** draw the active Scene’s widgets in ascending stacking order (topmost drawn last).
- **Hit-test order:** evaluate from the topmost widget downward (§4.4).
- **Explorer order:** always `Scene.widgets` array order; z-order operations do not reorder the Explorer.
- **Equal-z tie-break:** later array index on top, then lexicographically greater stable ID on top.

Z-order operations are **in Agent 2 scope** (development plan §4.C) with the following deterministic semantics, all expressed as assignments of `zIndex`:

| Operation | Deterministic rule |
|---|---|
| Bring To Front | `zIndex := max(zIndex in Scene) + 1` |
| Send To Back | `zIndex := min(zIndex in Scene) − 1` |
| Bring Forward | Let `N` be the next widget above in the stacking total order. If `N.zIndex > widget.zIndex`, swap the two `zIndex` values; if `N.zIndex == widget.zIndex`, set `widget.zIndex := widget.zIndex + 1`. No-op if the widget is already topmost. |
| Send Backward | Mirror of Bring Forward against the next widget below: swap if strictly lower, else `widget.zIndex := widget.zIndex − 1`. No-op if already bottommost. |

Every z-order operation is **one canonical mutation with one history entry** through the existing `EditorApplication.execute` pipeline; it must never mutate the Scene locally. **Implementation dependency:** Core currently has no command with these stacking semantics (`moveWidget` is an array reorder and is stubbed with `toIndex = 0` at the UI layer, defect D9). Agent 2 must add the minimal canonical Core z-order command(s) — this is within its development-plan §4.C scope — while the pure "next/previous in total order → target zIndex" computation lives in Canvas interaction primitives.

> The canonical UI spec leaves the exact same-z-order ordering open (§28). The deterministic tie-break above is the V1 interaction-layer rule pending canonical closure; the open item is reported in the reconciliation report, not silently decided here.

### 4.6 Selection model (F6)

Selection has two distinct, transient concepts; both live only in UI state and are never written to the Domain:

1. **Selection set/order** — the ordered list `selectedIds` of unique widget IDs, always serialized in **active Scene document order** (`Scene.widgets` array order). Additive selection preserves this order and never records click-arrival order. Duplicates are impossible.
2. **Primary/anchor widget** — the transient `primaryWidgetId`:
   - A direct click (single or additive) sets the primary to the clicked widget.
   - Marquee selection sets the primary to the first hit in Scene document order.
   - Toggling the primary out of the selection falls back to the first widget of the ordered set.
   - Empty selection clears the primary.
   - If the primary does not belong to the active Scene, it falls back to the first active-Scene widget of the ordered set.

Behaviors:

- **Click:** a plain click selects one widget and makes it primary; clicking empty Canvas clears the selection. `Ctrl`/`Cmd` and `Shift` clicks toggle/add (canonical UI §19).
- **Additive selection:** toggles membership; ordering remains Scene document order.
- **Marquee:** per §4.8; additive when `Ctrl`/`Cmd`/`Shift` is held.
- **Scene scoping:** the Canvas editing context is the active Scene (the Explorer-selected Scene; otherwise the runtime-active Scene; otherwise the first Scene of the active Rotation — matching the canonical Design Mode rule). Every Canvas geometry gesture derives its widget set from `selectedIds ∩ activeScene.widgets`; an empty intersection makes the gesture a no-op. Selection of nodes outside the active Scene remains possible through Explorer but is excluded from Canvas geometry gestures. Core commands that apply by ID across the whole project (D7) must never be reached with cross-Scene IDs from a Canvas gesture.
- **Alignment/distribution anchor compatibility:** the future alignment/distribution features use `primaryWidgetId` as their anchor. Only the hook is reserved; alignment itself is not implemented in V1.
- Selection changes never mutate the Project or create a history entry. Locked widgets remain selectable and visible in selection; only unlocked widgets are eligible for geometry mutation.

### 4.7 Invisible widgets (F7)

The canonical rule (UI corrections §8): invisible widgets are not rendered, but remain selectable and can show selection bounds. The interaction-layer rules:

- **Canvas hit-test:** invisible widgets are not hit-testable (§4.4).
- **Marquee:** invisible widgets are excluded from marquee acquisition (§4.8).
- **Selection bounds:** a selected invisible widget shows its selection bounds. In a multi-selection, invisible selected widgets contribute their geometry to the selection bounds exactly like visible ones.
- **Geometry participation:** an already-selected invisible widget participates in movement, multi-resize and the gesture reference geometry exactly like a visible unlocked widget. Invisibility affects rendering and hit acquisition only; it never freezes geometry. Only locked widgets are excluded from mutation.
- **Snap target pool:** invisible widgets are excluded as snap targets (snapping is a visual alignment aid over visible content; §4.11).
- **Explorer selection:** invisible widgets are selectable through Project Explorer (canonical).
- **Keyboard selection:** the keyboard path to an invisible widget is (a) Project Explorer keyboard navigation (canonical accessibility escape hatch, UI §24) and (b) Canvas focus order = active Scene document order, which includes invisible widgets; a focused/selected invisible widget shows its bounds so the focus is visible.
- **Hide/Show interaction:** hiding a currently selected widget retains the selection and its bounds display. `Hide All`/`Show All` are single undoable commands that preserve previous user intent (canonical UI §7); the interaction layer only reflects the canonical visibility state and must not clear or fabricate selection.

### 4.8 Marquee selection (F13)

A pointer down on empty Canvas followed by movement beyond the **4 CSS pixel** drag threshold starts marquee selection. The marquee rectangle is normalized and remains transient.

**Default predicate:** a widget is selected when its bounds **intersect** the marquee rectangle; edge-touch counts as intersection (inclusive boundaries).

**Predicate primitive (extensibility):**

```text
marqueeSelection(widgets, marqueeRect, options: {
  mode: "intersect" | "contains",   // V1 implements "intersect" only
  baseSelection, additive
})
```

`mode` is part of the public contract now. Only `"intersect"` is implemented in V1; requesting `"contains"` must be rejected explicitly (documented unsupported mode), never silently treated as intersection. This reserves future window/contains selection modes without rewriting the interaction architecture. No alternate mode is implemented now.

Additive marquee selection uses `Ctrl`/`Cmd`/`Shift`. Empty non-additive marquee selection clears the previous selection. Marquee hits are the active Scene’s **visible and enabled** widgets (§4.7). Marquee selection never mutates the Project or creates a history entry.

### 4.9 Movement

At pointer down, capture the initial geometry of all eligible selected widgets (unlocked widgets of the active Scene). During pointer movement, calculate a delta in Scene coordinates and produce transient preview geometry. Every eligible widget receives the same delta, preserving relative spacing.

On pointer up, the final geometry is **recomputed from initial geometry + final pointer delta** (never from the last-rendered preview override, §4.13). A changed gesture dispatches exactly one `EditorApplication.setWidgetGeometries()` call and therefore one logical history entry. A no-op gesture dispatches no mutation and creates no history entry. A canceled gesture restores the exact initial preview and creates no history entry.

Locked widgets are excluded from geometry mutation. If a selection contains both locked and unlocked widgets, locked widgets remain in place while unlocked widgets receive the common delta. If all selected widgets are locked, the gesture is a no-op.

Snapping during movement uses the selection bounding box as the reference geometry (§4.11).

### 4.10 Resize — deterministic contract (F3)

Resize calculations are pure functions and operate on **initial geometry plus pointer delta**. The complete deterministic contract:

- **Eligible set:** the unlocked selected widgets of the active Scene. If the set is empty, the gesture is a no-op (no history entry).
- **Reference frame:** `B0` = the AABB bounds of the initial geometries of the eligible set. For a single-widget resize, `B0` is that widget’s geometry. The pointer delta defines the next bounds `B1`.
- **Pivot/anchor:** the pivot is the opposite handle feature of `B0`:

  | Handle | Pivot (fixed) | Scaling axes |
  |---|---|---|
  | `n` | bottom edge | height only |
  | `s` | top edge | height only |
  | `w` | right edge | width only |
  | `e` | left edge | width only |
  | `nw` | bottom-right corner | width and height |
  | `ne` | bottom-left corner | width and height |
  | `sw` | top-right corner | width and height |
  | `se` | top-left corner | width and height |

- **Edge handles:** single-axis scaling. Only the axis perpendicular to the handle scales; the parallel axis is unchanged (`sx` or `sy` = 1).
- **Corner handles:** **non-uniform per-axis scaling in V1** — both axes scale independently with `sx = B1.width / B0.width` and `sy = B1.height / B0.height`. Rationale: canonical corrections §8 defines size lock and aspect-ratio lock as independent settings, and the aspect-ratio lock is not implemented; therefore V1’s default must be non-uniform. **Uniform scaling is not implemented in V1** and arrives with the future aspect-ratio lock.
- **Per-widget transform:** for each eligible widget: `x' = B1.x + (x − B0.x) · sx`, `y' = B1.y + (y − B0.y) · sy`, `w' = w · sx`, `h' = h · sy` (the existing `transformGeometryWithinBounds` semantics). Relative positions and sizes inside the selection are preserved under the chosen scaling law.
- **Minimum size:** `10 Scene units` per axis (the interaction-layer floor, `MIN_WIDGET_SIZE`). It is applied after the transform per widget (`w' = max(10, w')`, `h' = max(10, h')`, anchored at the transformed top-left), and `B1` itself is clamped to prevent negative sizes. Per-type minimum sizes sourced from DeviceProfile/content are a **future dependency**; V1 does not invent them.
- **Locked widgets:** excluded from the transform; they retain their original geometry.
- **Mixed widget types:** the transform is geometry-only. V1 makes **no widget-type-specific promise**: text is not reflowed, media is not refit/cropped, Digit/Direction content is untouched. Content-aware resize is a future dependency on the content/aspect-lock contract and must not be faked.
- **Rounding/normalization:** all values remain floating-point Scene units through the gesture; no new rounding policy is introduced (the Domain has none). The commit writes exactly the computed geometry; undo restores the exact initial state.
- **Commit:** exactly one `EditorApplication.setWidgetGeometries()` per completed gesture = one history entry, computed from initial geometry + final `B1` (§4.13). Snapping applies to `B1` per §4.11.
- **Cancel:** Escape/`pointercancel`/lost capture/window blur/Scene switch/unmount restore the exact initial preview state and create no history entry.

### 4.11 Snapping (F4)

Snapping calculations are pure and separated from mutation. The planned primitives are:

```text
snapValue(value, configuration)
snapPoint(point, configuration)
snapGeometry(candidate, configuration, otherGeometries)
snapGeometryWithTargets(candidate, configuration, others)
calculateSnapGuides(candidate, configuration, otherGeometries)
```

**Deterministic pass-priority strategy.** Grid, widget-edge and widget-center snapping are evaluated as **distinct passes per axis**, never as one nearest-distance race across kinds:

1. **Grid pass:** the nearest multiple of the snap-grid unit for the reference geometry’s leading coordinate (top-left): `x` on the x-axis, `y` on the y-axis.
2. **Widget edge pass:** candidates from other widgets’ left/right edges (x-axis) or top/bottom edges (y-axis), evaluated for both the leading edge (`value = target`) and the trailing edge (`value = target − sourceSize`).
3. **Widget center pass:** the other widget’s center; alignment value `= targetCenter − sourceSize / 2`.

**Pass selection:** the first pass in the priority order above that has at least one candidate within threshold wins that axis. Within the winning pass, the **nearest candidate wins**. This replaces the superseded “nearest candidate across all kinds” model, which raced qualitatively different targets.

- **Threshold:** **6 Scene units** per axis (§4.1 defines the Scene unit).
- **Per-axis behavior:** x and y are evaluated fully independently. Each axis commits to exactly one winning candidate or none, so mixed-axis snapping is well defined: e.g. x may snap to grid while y snaps to a widget edge, and the composite geometry matches both axis commitments independently.
- **Tie-breaking:** within a pass, equal distance → ascending stable widget ID. Grid pass ties (the exact midpoint case, distances equal within `1e-9` Scene units) → the larger coordinate wins. Cross-kind ties cannot occur by construction.
- **Candidate filtering:** snap candidates are widgets of the active Scene that are **visible and enabled**, excluding the gesture’s own widget set (**self-snap exclusion**). Locked widgets remain valid snap targets (their geometry is real).
- **Multi-selection reference:** for a multi-widget gesture the reference geometry is the **selection bounding box** (movement: `B0` moved by delta; resize: `B1`), never individual widgets.
- **Guides:** transient visualization only — exactly one guide per axis (the winning candidate), tagged `grid` / `edge` / `center`. Grid visibility remains separate from snap enablement.
- **Zoom relationship:** the threshold is evaluated in Scene space, so its screen-space affordance scales with zoom. A zoom-normalized (screen-pixel) threshold is future work tied to the zoom-gesture contract (§4.2, §11).
- **Snap-grid unit ownership:** the snap-grid unit is an **editor preference** expressed in Scene units, owned by Program Settings → Canvas/Editor (canonical UI §17/§19 surfaces). The baseline default is **10 Scene units**; the interaction layer reads it from the settings/registry and never hard-codes it. The canonical documents do not fix a numeric default; the default `10` is an interim baseline value pending the Settings surface, and this gap is reported in the reconciliation report.
- **Performance expectations:** the contract expresses candidate lookup as a **per-axis candidate provider** (range query over the active Scene’s widget set). V1 may implement a linear scan over the active Scene’s visible widgets — acceptable at hundreds of widgets — and must **not** scan the whole Project per pointermove. A spatial index (e.g. per-axis sorted intervals) is a documented **future optimization** required before thousand-widget scenes; the provider interface must admit index-backed implementations without semantic change. Per-commit O(project) clone/serialize cost in Core is acceptable per completed gesture (it bounds future continuous editing, see §4.13/§11).

### 4.12 Keyboard (F1, F8)

Keyboard handlers dispatch through application capabilities and never mutate Project directly. **The canonical keyboard contract is the UI design system’s confirmed table** (`UI_DESIGN_SYSTEM_V2.md` §19, `UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` §8), adopted verbatim:

| Input | Behavior | Status |
|---|---|---|
| Arrow | Move selection by the **snap-grid unit** | CONFIRMED (canonical) |
| `Ctrl`/`Cmd` + Arrow | Move selection by **snap-grid ÷ 10** (fine movement) | CONFIRMED (canonical) |
| `Shift` + `Ctrl`/`Cmd` + Arrow | Move selection by **snap-grid × 5** | CONFIRMED (canonical) |
| `Shift` + Arrow alone | **No movement shortcut** | CONFIRMED (no binding) |
| Delete | Delete selection (dependency dialog may apply) | CONFIRMED (canonical) |
| `Ctrl`/`Cmd` + A | Select all widgets in the active Scene | CONFIRMED (canonical) |
| Escape | Cancel the active interaction/tool | CONFIRMED (canonical) |
| `Ctrl`/`Cmd` + D | Duplicate | **PROPOSED — not bound in V1** |

**Step math:** with `G` = snap-grid unit in Scene units (default 10), the steps are `G`, `G ÷ 10`, and `5 × G`, computed exactly — `G ÷ 10` may be fractional (e.g. `G = 12` → `1.2`). With the default `G = 10` the fine step is numerically `1` Scene unit, but it is **defined as `G ÷ 10`** and must track the configured grid unit; it must never be re-derived as a constant “1 Scene unit”. This prevents regression into the superseded model.

**Contradiction record (documented, not silent):** the previous revision of this plan asserted `Arrow = 1 Scene unit` and `Ctrl/Cmd+Arrow = snap-grid`, inverting the canonical modifier roles. That contradicted the canonical confirmed table (`UI_DESIGN_SYSTEM_V2.md` §19 and corrections §8). The canonical UI design system is the canonical source and wins; this plan adopts it verbatim, and the inversion currently present in code (`App.tsx:667`) is recorded as defect D1 for remediation.

**Text-input focus exclusion:** canvas keyboard shortcuts must not fire while focus is in any text-editing surface — `input`, `textarea`, `select`, `contentEditable`, search fields, Properties numeric fields, the Binding editor. Escape inside such a surface cancels that surface’s own editing state, not the canvas gesture.

**Shortcut registry ownership:** the canonical shortcut registry is the single source with conflict detection (`UI_DESIGN_SYSTEM_V2.md` §19). The Canvas consumes registry-resolved commands and must not own a competing per-handler shortcut table. The baseline registry is a stub (`Foundation`); Agent 2 implements the single registry-owned Canvas binding table — conflict detection and focus exclusion live in the registry, not in per-handler discipline. Future Settings→Shortcuts editing and the command palette extend the registry (future dependency).

**`Ctrl`/`Cmd` platform handling:** the `Mod` modifier normalizes to **Meta on macOS** and **Control on Windows/Linux**. A binding matches only the platform-appropriate key; macOS Meta must not be triggered by Control, and vice versa.

**No accidental movement from unsupported modifier combinations:** movement triggers only for the **exact** modifier sets — none, `Mod`, `Mod+Shift`. Any other combination (`Alt+Arrow`, `Shift+Arrow`, `Alt+Mod+Arrow`, …) must not move the selection. Matching is “exactly this set”, never “at least these modifiers”.

**Duplication capability vs shortcut:** `EditorApplication.duplicateSelection()` remains an application capability reachable through the toolbar/context-menu Duplicate command. It is **not bound to `Ctrl/Cmd+D`** until product confirmation. The canonical **Duplicate mode** (click-center placement, repeated click duplicates, Esc exits — UI §27) is a distinct confirmed future feature; the current fixed-offset capability (D8) is not presented as Duplicate mode. The existing `Ctrl/Cmd+D` binding in code is defect D2 and must be removed.

### 4.13 Transient state, commit and history (F10)

- **One gesture = one history entry.** Every completed drag, resize, nudge, z-order, delete or duplicate gesture produces exactly one logical mutation and one history entry; canceled and no-op gestures produce zero.
- **Commit derives from initial state + final interaction state.** The pointer-up handler recomputes the final geometry synchronously from the gesture’s stored initial geometries and the final pointer position (delta for movement; final bounds for resize). **The last-rendered `geometryOverrides` React value is never the commit source** — the gesture record must be held outside React render state (ref) or recomputed from the event position so no stale React closure can become the commit input (defect D5).
- **Transient `geometryOverrides` are preview-only**, keyed by widget ID, and are cleared on **every** exit path: commit, cancel (Escape/`pointercancel`/lost capture/window blur), active Scene/Rotation switch, document switch, and Canvas unmount (defect D6).
- **Scene/Rotation switch cancels the active gesture** (cancel-with-restore, zero history).
- **Unmount cancels the active gesture** and clears all transient interaction state.
- `updateWidgetGeometries()` in `canvas-interaction.ts` remains a **preview-only** pure helper; a test must assert it produces no history entry and no `DocumentStore` mutation.
- **History coalescing for continuous Properties Panel editing** (numeric scrubbers, sliders) remains a future Core capability (a `CommandHistory` transaction/coalesce primitive). `CommandHistory` is not redesigned now; the canonical documents do not require it for canvas gestures.

### 4.14 Context menu

Canvas and Widget context menus expose only real capabilities. Per the canonical widget context menu (UI §18): Duplicate, Delete, Lock, Hide, **Bring Forward, Send Backward**, Properties, Binding. Bring Forward/Send Backward map to the z-order commands of §4.5 through the canonical pipeline. Delete, duplicate, geometry movement, and property navigation map to existing application commands or clearly defined application methods. Unsupported commands are disabled or omitted. No fake command handlers or fake success logs are allowed.

## 5. Rotation boundary (F2)

**Canvas Interaction Foundation V1 is AABB-only.** The current canonical Domain `Geometry` is `{x, y, width, height}` and defines no rotation or anchor field. This reconciliation does **not** add rotation fields to the Domain and does **not** implement rotation.

**Canonical product status:** free rotation with 5° snap and `R` = 90° clockwise rotation are CONFIRMED product features (`UI_DESIGN_SYSTEM_V2.md` §27, corrections §8). They remain confirmed but are **not implemented by Canvas Interaction Foundation V1**.

**Boundary statement:** the interaction layer is

> **rotation-compatible in architectural boundary, but not rotation-capable in geometry semantics.**

In practice:

- All V1 geometry primitives operate on axis-aligned rectangles and make no claim of correctness for rotated content.
- The architectural boundary is the pure-function seams of §4: hit-testing, marquee, bounds, resize and snapping take geometry as explicit inputs and have no AABB assumptions embedded in the controller or renderer.

**When rotation lands, a canonical Geometry/Transform contract (rotation angle + anchor/origin + transform ordering) must first be defined in the Domain.** The following primitives must then be re-derived against oriented geometry, and are documented as rotation-redefinition points now:

- hit-test (oriented point-in-rect),
- marquee (oriented intersection),
- selection bounds (oriented bounds),
- resize (handle math in the rotated frame),
- snapping (rotated edges/centers),
- guides (rotated guide rendering).

No V1 decision claims these primitives are final for rotated content.

## 6. Implementation phases after approval

### Phase A — Contract and audit lock

Re-read the applicable repository documents and inspect the complete current Canvas surface, including `App.tsx`, `canvas-interaction.ts`, `editor-commands.ts`, `editor-types.ts`, the Core mutation files, Domain models/factories, and all relevant tests. Apply the reconciled Section 4 contract, the Section 7 locked decisions, and the defect remediation list (§2.1) before changing behavior. Record dependencies on another Agent’s scope instead of implementing them implicitly.

### Phase B — Pure interaction primitives

Create or refine small, pure, testable functions for coordinate conversion (including the §4.2 view transform), Scene-unit conversion, rectangle normalization/intersection, the marquee predicate (`intersect`/`contains` signature, `intersect` implemented), hit testing against the stacking total order, selection transitions (ordered set + primary), drag geometry, the §4.10 resize math, the §4.11 pass-priority snapping, guide calculation, and the z-order target computation. These functions must not read from or mutate React state, `Project`, `DocumentStore`, or `CommandHistory`.

### Phase C — Interaction state machine

Replace conflicting boolean flags with a clear interaction model. At minimum, interaction modes should cover `idle`, `marquee`, `dragging`, `resizing`, and `panning`; hover may remain an orthogonal transient state. State transitions define pointer down, threshold crossing, pointer move, pointer up, Escape, pointer cancellation, lost capture, focus loss, **active Scene/Rotation switch, and Canvas unmount**.

### Phase D — React integration and rendering

Connect pure primitives to the existing store snapshot and transient preview state. Render canonical geometry when idle and preview geometry only during active interaction, using the same view-transform instance for rendering and conversion (D4). Add deterministic selection outlines, multi-selection bounds (per the §4.6/§4.7 membership rules), resize handles, marquee feedback, hover feedback, active drag state, and snap guides without copying the entire Project into local state.

### Phase E — Canonical command dispatch

At each logical commit boundary, dispatch one application mutation for one completed drag, resize, nudge, z-order, delete or duplicate gesture. Use existing `EditorApplication.setWidgetGeometries()`, `deleteSelection()`, and `duplicateSelection()` capabilities where available; add the minimal canonical Core z-order command per §4.5. Scope every Canvas-initiated mutation to active-Scene widget IDs (D7). Add an application command only when the existing API is an actual blocker; do not move mutation logic into Canvas helpers.

### Phase F — Keyboard and context commands

Wire keyboard and context-menu behavior through the repository’s command/application layer per §4.12 and §4.14: the canonical shortcut table verbatim, registry-owned bindings with conflict detection, text-input focus exclusion, `Mod` platform normalization, exact-modifier matching, `Shift+Arrow` with no binding, and `Ctrl/Cmd+D` unbound (D1, D2).

### Phase G — Verification and regression

Run focused Canvas tests, the full Agent 1 test suite, type checking, production build, and Tauri validation. If browser/dev-server execution is available, perform the browser smoke test against a real populated fixture. Record exact commands and results in the final Agent 2 report.

## 7. Decisions and reconciliation record

### 7.1 Findings resolved by this reconciliation

| Finding | Previous contract (superseded where marked) | Resolution in this plan | Canonical source |
|---|---|---|---|
| F1 — Keyboard (CRITICAL) | `Arrow = 1 Scene unit`; `Ctrl/Cmd+Arrow = snap-grid`; `Shift+Ctrl/Cmd+Arrow = 5×` | Adopted verbatim: `Arrow = snap-grid`, `Ctrl/Cmd+Arrow = grid ÷ 10`, `Shift+Ctrl/Cmd+Arrow = grid × 5`, `Shift+Arrow = none`; plus focus exclusion, registry ownership, platform `Mod` normalization, exact-modifier matching (§4.12) | `UI_DESIGN_SYSTEM_V2.md` §19; corrections §8 |
| F2 — Rotation/AABB (HIGH) | AABB decisions presented as stable foundations for all future content | V1 declared AABB-only; rotation-compatible boundary, not rotation-capable; six primitives named as redefinition points; no Domain changes (§5) | `UI_DESIGN_SYSTEM_V2.md` §27; `DOMAIN_MODEL_V1.md` |
| F3 — Multi-resize (HIGH) | “bounding-box transform, preserve proportions” | Full deterministic contract: reference frame, pivot per handle, corner = non-uniform, edge = single-axis, min 10 Scene units, locked excluded, geometry-only (no type promise), float precision, one command, cancel semantics (§4.10) | corrections §8 (size/aspect locks independent) |
| F4 — Snapping (HIGH) | 6-unit threshold; nearest candidate across all kinds; tie-break only at equal distance | Pass-priority model: Grid > Edge > Center passes per axis; nearest within the winning pass; per-axis independence; deterministic ties; threshold 6 Scene units (defined); candidate filtering; bbox reference; guides per axis; provider abstraction + spatial-index future optimization (§4.11) | This plan (deterministic strategy; canonical UI defines only the Snap Grid feature) |
| F5 — Z-order (MEDIUM) | “effective z-order” never defined | `zIndex` = stacking source; array order = Explorer order + equal-z tie-break; stable ID final tie-break; render/hit/Explorer orders defined; four z-ops with deterministic zIndex assignment (§4.5) | `DOMAIN_MODEL_V1.md` (`Widget.zIndex`, Z-order); UI §28 open item reported |
| F6 — Selection order/primary (MEDIUM) | Document order only | Deterministic document-order set **plus** transient primary/anchor widget; click/marquee/additive behaviors; Scene scoping of gestures; alignment hook reserved (§4.6) | UI §7/§19; dev plan §4.B |
| F7 — Invisible widgets (MEDIUM) | Partial rules | Complete rules: no hit-test/marquee acquisition; bounds shown; geometry participation in selection; excluded from snap targets; Explorer + keyboard paths; Hide/Show retains selection (§4.7) | UI §7; corrections §8; UI §24 |
| F8 — Ctrl/Cmd+D (MEDIUM) | `Ctrl/Cmd+D` “approved” because `duplicateSelection()` exists | Kept **PROPOSED**; unbound in V1; capability stays reachable via command surfaces; Duplicate mode is a future feature; code binding recorded as D2 (§4.12) | `UI_DESIGN_SYSTEM_V2.md` §19, §27 |
| F9 — Z-order scope (MEDIUM) | Z-order ops omitted from scope | Restored to Agent 2 scope per dev plan §4.C; contract + Core dependency defined (§4.5) | Dev plan §4.C; UI §18 |
| F10 — History/transient (MEDIUM) | Commit from preview override; cleanup gaps | Commit from initial + final interaction state; overrides cleared on every exit path; Scene/Rotation switch and unmount cancel; no stale closures; coalescing remains future (§4.13) | Dev plan §2 target loop; review recommendations |
| F11 — Scene unit (MEDIUM) | “Scene unit” and snap-grid source undefined | Scene unit = 1 logical pixel of the active Rotation space; dimensions from DeviceProfile.display; R90/R270 swap; no hard-coded sizes; 720×1280 hard-code = defect D3 (§4.1) | `DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md` §4; UI §4 |
| F12 — View transform (MEDIUM) | Zoom/pan deferred; transform unspecified | Full Scene↔Canvas↔Screen contract (fit scale, letterbox, pan, zoom) locked now; gestures deferred; conversion/render must share one transform (D4) (§4.2) | UI §6/§21; baseline `canvas-interaction.ts` |
| F13 — Marquee extensibility (LOW) | Inclusive behavior with no mode reserved | Inclusive `intersect` stays the V1 default; `mode: "intersect" | "contains"` predicate primitive reserved; `contains` rejected explicitly until implemented (§4.8) | UI §19 (marquee PROPOSED marker noted in report) |

### 7.2 Canonical Agent 2 decisions (locked)

These are the canonical Agent 2 product/architecture decisions for implementation. They must not be silently changed during coding.

- **Keyboard:** `Arrow = snap-grid`; `Ctrl/Cmd+Arrow = grid ÷ 10`; `Shift+Ctrl/Cmd+Arrow = grid × 5`; `Shift+Arrow` = no movement. Registry-owned; text-input focus exclusion; `Mod` platform normalization; exact-modifier matching; `Ctrl/Cmd+D` PROPOSED and unbound.
- **Geometry:** AABB-only `{x, y, width, height}`; no rotation/anchor fields added; rotation-compatible boundary, rotation-capable semantics only after a future Geometry/Transform contract.
- **Scene unit:** 1 logical pixel of the active Rotation space; dimensions from `DeviceProfile.display` (R90/R270 swapped); no hard-coded device sizes.
- **View transform:** Scene↔Canvas↔Screen contract locked (fit + letterbox + pan + zoom); zoom/pan gestures deferred; one transform instance for rendering and conversion.
- **Hit-test:** boundary points inside; invisible widgets excluded; topmost per the stacking total order.
- **Z-order:** `zIndex` = stacking source; array order = Explorer order + equal-z tie-break; stable ID final tie-break; Bring Forward/Send Backward/Bring To Front/Send To Back per §4.5; z-order in Agent 2 scope with a minimal canonical Core command.
- **Selection:** unique IDs in active Scene document order; transient primary/anchor widget (last clicked; marquee → first hit; fallbacks defined); Canvas gestures scoped to active-Scene widgets; selection never mutates the document.
- **Invisible widgets:** no Canvas hit-test/marquee acquisition; bounds shown; participate in selected-set geometry; excluded from snap targets; Explorer and keyboard paths defined; Hide/Show retains selection.
- **Marquee:** inclusive intersection default; `mode` predicate primitive with `contains` reserved and rejected until implemented.
- **Movement/resize:** preview/commit separation; one command and one history entry per completed gesture; commit from initial + final interaction state; locked widgets excluded; all-locked = no-op; minimum size 10 Scene units; corner resize non-uniform, edge resize single-axis; uniform scaling reserved for the aspect-ratio lock.
- **Snapping:** pass-priority Grid > Edge > Center per axis; nearest within the winning pass; threshold 6 Scene units; deterministic ties; self-snap exclusion; selection-bbox reference for multi-selection; visible/enabled candidate pool; one guide per axis; snap-grid unit is a settings-owned editor preference (interim default 10).
- **Pointer cancellation:** `pointercancel`/lost capture/window blur/Escape/Scene-Rotation switch/unmount cancel with zero history and exact initial-preview restore.
- **Transient state:** `geometryOverrides` preview-only and cleared on every exit path; `updateWidgetGeometries()` preview-only with a no-history-entry test.
- **Thresholds:** drag threshold 4 CSS px (screen space); snap threshold 6 Scene units (Scene space).
- **No fake commands:** only real application capabilities are exposed; unsupported commands disabled or omitted.

### 7.3 Interaction contract precedence

When implementing Agent 2, precedence is:

1. Domain/runtime contract and canonical mutation semantics (`DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`, `DOMAIN_MODEL_V1.md`).
2. UI Design System (`UI_DESIGN_SYSTEM_V2.md`; on conflict between the main UI spec and `UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`, the corrections win per corrections §13).
3. This finalized Agent 2 interaction contract — it may specify deterministic behavior only where the canonical documents are silent, and it must never contradict (1) or (2). This plan itself may not override the canonical UI design system.
4. Existing prototype behavior only where it does not contradict the above; the prototype is updated to match the contract (including the §2.1 remediation list).

If an existing prototype conflicts with this contract, update the prototype to match the contract rather than preserving the old behavior.

## 8. Test plan

### Pure unit tests

Add or extend `tests/canvas-interaction.test.ts` with deterministic tests for:

| Group | Required coverage |
|---|---|
| Coordinates | Screen↔Canvas, Canvas↔Scene, the full view transform (zoom, pan, origin, letterbox, aspect preservation), Scene-unit conversion, R90/R270 dimension swap |
| Hit testing | Empty Canvas, one widget, overlap, stacking order (zIndex > array index > stable ID), equal-z tie-breaks, boundary behavior, invisible widget exclusion |
| Z-order | Stacking total order; Bring Forward / Send Backward / Bring To Front / Send To Back targets incl. equal-z runs; topmost/bottommost no-ops; Explorer order unchanged |
| Selection | Single, clear, additive, toggle, unique IDs, deterministic Scene-document ordering, primary widget transitions (click, marquee first hit, toggle-off fallback, cross-Scene fallback) |
| Marquee | Normalization, intersect, non-intersect, inclusive edge-touch, additive mode, invisible exclusion, explicit rejection of `contains` mode |
| Drag | Single widget, multi-widget, common delta, locked-only no-op, mixed locked/unlocked, no-op, cancel, 4px threshold |
| Resize | Every edge and corner handle, pivot correctness, corner non-uniform and edge single-axis scaling, minimum 10-unit size, negative-size prevention, bounding-box multi-resize, locked widget, cancel |
| Snapping | Grid, edge, center passes; pass priority (grid beats edge beats center regardless of distance); nearest-within-pass; 6-unit threshold; equal-distance ties; per-axis independence incl. mixed-axis kinds; no snap; guides (one per axis); self-snap exclusion; selection-bounds reference; invisible target exclusion |
| Keyboard | Arrow = grid, Ctrl/Cmd+Arrow = grid ÷ 10, Shift+Ctrl/Cmd+Arrow = grid × 5, Shift+Arrow = no movement, Alt/unsupported combinations = no movement, platform `Mod` normalization, Delete, Escape, Ctrl/Cmd+A, Ctrl/Cmd+D unbound, text-input focus exclusion |

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

The history matrix must include one entry for single drag, multi-drag, resize, duplicate, delete, and each z-order operation; zero entries for canceled drag, canceled resize, no-op drag/resize, Scene/Rotation switch mid-gesture, and unmount mid-gesture. It must also verify that locked geometry creates no fake history entry, that `updateWidgetGeometries()` produces no history entry, that the commit equals the recomputed initial+delta result even when the render override is stale (no stale-closure commit), and that the Canvas never bypasses `EditorApplication`.

### Regression suite

Before declaring completion, rerun the entire Agent 1 pipeline suite and verify DocumentStore snapshot stability, command history, undo, redo, dirty state, duplicate, delete, locked geometry, no-op mutation handling, and New Project lifecycle.

## 9. Verification commands

Use the repository’s actual scripts and record exact results. The expected checks are:

```bash
npm run typecheck
npm test
npm run build
npm run tauri:check
```

If a script name differs, use the equivalent script from `package.json` and document the substitution. Do not claim `COMPLETE` without executing the applicable checks.

The browser smoke test, when available, must use an existing populated fixture. It must cover opening a Scene, selecting a Widget, dragging, undo/redo, multi-selection, multi-drag, resize, duplicate, delete, z-order changes, keyboard nudges per the canonical table, and Escape cancellation. If no populated fixture exists, report that the browser smoke test is unavailable and rely on the integration suite; do not invent a fake UI result.

## 10. Implementation commit and final gate

After approval, implementation should remain in one focused commit:

```text
feat(canvas): implement canvas interaction foundation
```

The implementation commit must not mix unrelated cleanup, firmware changes, Properties Panel redesign, or other Agent scopes. Implementation must begin by applying the defect remediation list (§2.1: D1–D10). The final report must include the actual commit SHA, implementation status table, canonical mutation pipeline verification, history verification, exact test results, Agent 1 regression status, genuine limitations, and exactly one final gate: `COMPLETE`, `IMPLEMENTED BUT REQUIRES QA`, `PARTIALLY COMPLETE`, or `FAILED`.

The intended acceptance criterion is:

> Canvas is a deterministic interaction layer over canonical Project state, with centralized coordinate conversion and view transform, the canonical keyboard table, stacking-order hit testing, deterministic selection with a primary widget, movement, the deterministic multi-resize contract, pass-priority snapping, z-order operations, correct cancellation and undo/redo semantics, and zero direct document-mutation bypasses.

## 11. CANONICAL INTERACTION CONTRACT STATUS

### Locked V1 Decisions

- Canonical keyboard contract verbatim: `Arrow = snap-grid`; `Ctrl/Cmd+Arrow = grid ÷ 10`; `Shift+Ctrl/Cmd+Arrow = grid × 5`; `Shift+Arrow` = no movement; Delete, Ctrl/Cmd+A, Escape per canonical; `Ctrl/Cmd+D` remains PROPOSED and unbound.
- Shortcut registry ownership with conflict detection and text-input focus exclusion; `Mod` = Meta (macOS) / Control (Windows/Linux); exact-modifier matching so unsupported combinations never move the selection.
- AABB-only geometry for Canvas Interaction Foundation V1; no rotation/anchor fields in the Domain; rotation-compatible boundary, not rotation-capable semantics.
- Deterministic multi-resize contract: selection-bbox reference frame; pivot = opposite handle feature; corner = non-uniform per-axis, edge = single-axis; minimum 10 Scene units per axis; locked widgets excluded; geometry-only (no widget-type promise); one command and one history entry; exact cancel semantics.
- Deterministic pass-priority snapping (Grid > Edge > Center) with nearest-within-pass selection, 6 Scene-unit threshold, independent per-axis evaluation, self-snap exclusion, selection-bbox reference for multi-selection, one guide per axis, and the per-axis candidate-provider abstraction (spatial index deferred).
- Scene unit = 1 logical pixel of the active Rotation space; rotation dimensions from `DeviceProfile.display` (R90/R270 swapped); no hard-coded device sizes.
- View transform contract (Scene↔Canvas↔Screen: fit, letterbox, pan, zoom) locked even though zoom/pan gestures are deferred; one transform instance for conversion and rendering.
- Z-order: `Widget.zIndex` is the stacking source; `Scene.widgets` array order is Explorer order plus the equal-z tie-break (stable ID final); the four z-order operations have deterministic zIndex-assignment semantics; z-order is in Agent 2 scope with a minimal canonical Core command.
- Selection: deterministic active-Scene document order plus a transient primary/anchor widget; Canvas gestures scoped to active-Scene widgets; selection never mutates the document.
- Invisible widgets: excluded from Canvas hit-test and marquee acquisition; show selection bounds; participate in selected-set geometry; excluded from snap targets; reachable via Explorer and keyboard; Hide/Show retains selection.
- Marquee: inclusive intersection default; `mode` predicate primitive reserving `contains` (rejected until implemented).
- Pointer contract: 4 CSS px drag threshold; capture/cancel lifecycle; Escape/`pointercancel`/lost capture/blur/Scene-Rotation switch/unmount all cancel with zero history and exact restore.
- One gesture = one history entry; commits computed from initial + final interaction state; `geometryOverrides` preview-only and cleared on every exit path.

### Explicit V1 Limitations

- Rotation is not implemented (`R`, free rotation, 5° snap remain confirmed product features awaiting the future Geometry/Transform contract).
- Uniform/aspect-locked resize and the aspect-ratio lock are not implemented.
- Content-aware text/media resize and per-type minimum sizes are not implemented or promised.
- Zoom/pan user gestures are deferred (only the coordinate contract is locked).
- Alternate marquee modes (`contains`/window) are not implemented.
- `Ctrl/Cmd+D` is not bound; the canonical Duplicate mode is not implemented (the fixed-offset duplication capability remains a capability only).
- Alignment and distribution are not implemented (the primary-widget hook is reserved).
- No shortcut registry extensions (Settings→Shortcuts editing, command palette) are implemented.
- History coalescing for continuous property editing is not implemented (`CommandHistory` unchanged).
- Snap/hit candidate lookup may be a linear scan over the active Scene (acceptable at hundreds of widgets); no spatial index.
- Equal-z stacking ordering is defined by this plan as the V1 interaction rule while the canonical UI spec keeps it open (§28).

### Future Dependencies

- **Rotation geometry contract** — a canonical Geometry/Transform contract (rotation + anchor/origin) in the Domain must precede any rotation UI; redefinition points: hit-test, marquee, selection bounds, resize, snapping, guides.
- **Advanced marquee modes** — `contains`/window selection via the reserved predicate parameter.
- **Continuous history coalescing** — a `CommandHistory` transaction/coalesce primitive for Properties Panel continuous edits.
- **Spatial indexing** — index-backed per-axis candidate providers required before thousand-widget scenes.
- **Future shortcut registry extensions** — Settings→Shortcuts editing and the command palette.
- **Aspect-ratio lock and size lock settings** — enabling uniform corner scaling and per-axis locking.
- **Per-type minimum sizes / content-fit contract** — sourced from DeviceProfile and the content contract.
- **Zoom/pan gesture contract** — including zoom-normalized (screen-pixel) snap thresholds.
- **Alignment/distribution** — anchored on the primary widget.
- **Duplicate mode + `Ctrl/Cmd+D` product confirmation** — click-center placement, repeated click, Esc exits, copy selection.
- **Canonical closure of the equal-z stacking order** — currently open in `UI_DESIGN_SYSTEM_V2.md` §28.

### Implementation Gate

**GO WITH DOCUMENTED LIMITATIONS.**

Agent 2 may proceed against this reconciled contract. The gate is conditioned on the implementation applying, first, the recorded defect remediations (§2.1: D1–D10) and then implementing the locked decisions above without silently re-opening any of them. Future capabilities listed above must not be implemented or presented as present in this phase.

## 12. Review checkpoint

The interaction contract has now been reconciled against the canonical documents in this planning document, and the red-team findings F1–F13 are resolved. No Canvas implementation may start outside the scope defined here, and no decision marked Locked may be changed during coding without a `DOMAIN CONTRADICTION FOUND` report. The next action is Agent 2 implementation against the reconciled contract — beginning with the §2.1 remediations — followed by focused Canvas QA and full Agent 1 regression verification.
