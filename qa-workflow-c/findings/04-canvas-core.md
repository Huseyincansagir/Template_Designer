# Agent 04 — Canvas / Core Integration

## Scope & scenarios traced

| # | Scenario | State machine path traced | Result |
|---|---|---|---|
| S1 | select → drag → resize → snap → undo → redo | `beginWidgetMove`→`handleCanvasPointerMove`→`handleCanvasPointerUp`→`commitGeometryCommand`→`documentStore`→`undo/redo` | Commit path sound for single/multi editable; see WC-04-03 (resize snap) and WC-04-06 (pointer release) |
| S2 | A+B move/resize/snap | `beginWidgetMove`/`beginSelectionResize` → `getBounds(Object.values(initial))` → `snapGeometryWithTargets` | Move = uniform translation (relative layout preserved). Resize = bounds-scale map-back; see WC-04-04 |
| S3 | locked drag/resize/nudge | `beginWidgetMove` 583-587, `beginWidgetResize` 599-602, `selectedEditableWidgets` 485 | Single locked: warn+select. Mixed locked: silent drop (WC-04-05) |
| S4 | hidden hit test | `.canvas-widget.is-invisible` `pointer-events:none` (app.css:296); `marqueeSelection`/`hitTest` filter `visible && enabled` | Pointer/marquee exclude hidden; keyboard still reaches them (WC-04-08) |
| S5 | drag→Escape / drag→blur / drag→pointercancel | `cancelCanvasInteraction` 550-561 via 719-724 / 748-752 / 974 | No history, no dirty, preview cleared, pan restored (CONFIRMED) |
| S6 | sub-threshold drag | `handleCanvasPointerUp` 698-700 (`exceedsPointerDragThreshold` false) | `clearGeometryPreview()`, no commit — clean (CONFIRMED) |
| S7 | nudge during drag | `handleCanvasKeyDown` 739-746 (no `mode !== "idle"` guard) | **WC-04-01** — nudge delta lost, spurious history entry |
| S8 | delete during drag | `handleCanvasKeyDown` 734-738 (no guard) → `deleteSelectionCommand` | **WC-04-02** — silent pointerup no-op |
| S9 | undo during drag | toolbar/menu `undo()` 963 / 785, no `mode` guard | Unreachable with single pointer (capture); see WC-04-06 / discussion |
| S10 | zoom/pan during drag | zoom buttons 973, `canvasTransform` 486 | Unreachable with same pointer (capture); no keyboard zoom — LOW/informational |
| S11 | StrictMode double-effect | main.tsx 11-13; effects 748-752 (no deps), 760-763 (mount) | Benign; re-subscribe churn only (WC-04-09) |

Baseline confirmed in this session: `npm.cmd run typecheck` (tsc --noEmit) passes with no diagnostics. Vitest baseline is stated as 51/51 (incl. 20 canvas-interaction tests); not re-run here (read-only scope).

---

## Findings

### WC-04-01 Mid-drag arrow-key nudge commits canonical geometry and is then overwritten on pointerup (HIGH · state divergence, command mismatch, stale preview · CONFIRMED · Scenario S7)

**Repro steps**
1. Select a widget, press pointer down and drag it (hold the button; `canvasPointer.mode === "drag"`).
2. While still holding, press an arrow key.

**Evidence**
`handleCanvasKeyDown` (src/App/App.tsx:739-746) has no guard against an active pointer interaction:

```ts
739:    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || !selectedWidgetIds.length) return;
740:    const step = calculateNudgeStep(snapGridSize, { shift: event.shiftKey, modifier, alt: event.altKey });
741:    if (step === null) return;
742:    event.preventDefault();
743:    const delta = { x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0 };
744:    const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
745:    if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");
```

The only `mode` check in the handler is the Escape branch (719-724); the properties geometry inputs are disabled during a drag (910) but the keyboard path is not. Nudge reads **canonical** `widget.geometry` (not `previewGeometry`), commits it, and `commitGeometryCommand` (544-548) clears the live preview:

```ts
544:  const commitGeometryCommand = (sceneId: string | undefined, updates: Readonly<Record<string, Geometry>>, label: string) => {
545:    const result = sceneId ? editorApplication.setWidgetGeometriesInScene(sceneId, updates, label) : { changed: false };
546:    if (result.changed) logAction(`${label} committed`, "EVENT");
547:    clearGeometryPreview();
548:  };
```

`clearGeometryPreview` (538-542) resets `geometryOverrides`, killing the live drag preview. The drag continues because `canvasPointer` still holds `{ mode:"drag", initial:<g0> }`; pointerup recomputes from that stale initial:

```ts
683:    const finalPoint = toCanvasPoint(event);
684:    const finalDelta = { x: finalPoint.x - canvasPointer.start.x, y: finalPoint.y - canvasPointer.start.y };
...
697:      if (Object.keys(finalGeometry).length) commitGeometryCommand(activeScene?.id, finalGeometry, canvasPointer.mode === "drag" ? "Move widget" : "Resize widget");
```

**Expected vs Actual**
- Expected: nudge ignored while dragging, or the drag/nudge reconciled into one command.
- Actual: two history entries ("Nudge widget" then "Move widget"); the "Move widget" command writes `initial + pointerDelta` over the nudged geometry, so the **nudge delta is lost**; the preview visibly snaps back to canonical then to the drag position. Mid-drag nudge is silently swallowed.

**Recommended fix (design-level):** early-return at the top of `handleCanvasKeyDown` when `canvasPointer.mode !== "idle"` (route only Escape/cancel), and/or make nudge operate on `previewGeometry` + a single deferred commit. Add a unit test that drives the key handler while `mode === "drag"`.

---

### WC-04-02 Mid-drag Delete/Backspace deletes widgets while pointer state references them; pointerup commit silently no-ops (MEDIUM · command mismatch, stale state · CONFIRMED · Scenario S8)

**Repro steps**
1. Drag a widget (hold pointer).
2. Press Delete (or Backspace) mid-drag.

**Evidence**
`handleCanvasKeyDown` (src/App/App.tsx:734-738) has no `mode` guard:

```ts
734:    if (event.key === "Delete" || event.key === "Backspace") {
735:      event.preventDefault();
736:      deleteSelectionCommand();
737:      return;
738:    }
```

`deleteSelectionCommand` (272-283) routes through `deleteSelectionInScene(activeScene.id, selectedWidgetIds)`, mutating the store, clearing selection, and logging — but does **not** touch `canvasPointer`. The drag continues with `canvasPointer.initial`/`widgetIds` referencing now-deleted ids. On pointerup, the commit runs against a scene where those ids no longer exist; `validScopedWidgetIds` rejects it and the result is `{changed:false}`:

```ts
48: function validScopedWidgetIds(project: Project, sceneId: string, ids: readonly string[]): boolean {
49:   const scene = findUniqueScene(project, sceneId);
50:   if (!scene || !ids.length || new Set(ids).size !== ids.length) return false;
51:   return ids.every((id) => countWidgetOccurrences(project, id) === 1 && scene.widgets.filter((widget) => widget.id === id).length === 1);
52: }
```

```ts
197:  setWidgetGeometriesInScene(sceneId: string, updates: Readonly<Record<string, Geometry>>, label = "Edit Widget Geometry"): MutationResult {
198:    const current = this.documents.getCurrent();
199:    const ids = Object.keys(updates);
200:    if (!current || !validScopedWidgetIds(current, sceneId, ids) || !ids.every((id) => isValidGeometry(updates[id]))) return { changed: false };
```

**Expected vs Actual**
- Expected: deleting mid-drag ends the drag cleanly, or the pointerup move is skipped with feedback.
- Actual: delete succeeds (correct), but the trailing pointerup "Move widget" is a **silent no-op** (`changed:false`, no log because 546 only logs on `changed`); `clearGeometryPreview()` still runs (547). No crash, no corruption — but the user gets no indication the move was dropped, and the pointer state machine briefly references deleted ids.

**Recommended fix (design-level):** guard Delete/Backspace the same way as Escape (cancel interaction first), or have `deleteSelectionCommand` call `cancelCanvasInteraction()` when `canvasPointer.mode !== "idle"`. Add a test asserting a mid-drag delete leaves `canvasPointer.mode === "idle"`.

---

### WC-04-03 Resize snap adjusts only the anchored x/y edge; right/bottom handles never snap and can displace the anchor (MEDIUM · state divergence, UI misleading state · CONFIRMED · Scenario S2)

**Repro steps**
1. Resize a widget by the `se`, `e`, or `s` handle near another widget's edge or a grid line.

**Evidence**
`snapGeometryWithTargets` (src/App/canvas-interaction.ts:339-347) mutates only `x`/`y`:

```ts
339: export function snapGeometryWithTargets(candidate: Geometry, configuration: SnapConfiguration, others: readonly Widget[] = []): SnapResult {
340:   if (!configuration.enabled) return { geometry: candidate, guides: [] };
341:   const x = candidateForAxis("x", candidate, others, configuration);
342:   const y = candidateForAxis("y", candidate, others, configuration);
343:   return {
344:     geometry: { ...candidate, x: x?.value ?? candidate.x, y: y?.value ?? candidate.y },
345:     guides: [x?.guide, y?.guide].filter((guide): guide is SnapGuide => Boolean(guide)),
346:   };
347: }
```

`candidateForAxis` (292-337) computes candidates against `sourceStart = candidate.x` (the left edge) and `sourceSize`, including `target - sourceSize` (right-edge alignment), but only ever emits a **position** value that becomes `x`. In `handleCanvasPointerMove` the snap result replaces the bounds' x/y before `transformGeometryWithinBounds` (App.tsx:650-654):

```ts
650:      const resizedBounds = resizeGeometry(initialBounds, canvasPointer.handle ?? "se", delta);
651:      const snapped = snapGeometryWithTargets(resizedBounds, snapConfiguration, otherWidgets);
652:      updates = Object.fromEntries(canvasPointer.widgetIds.map((widgetId) => {
653:        const next = transformGeometryWithinBounds(canvasPointer.initial[widgetId], initialBounds, snapped.geometry);
```

For `se`/`e`/`s` handles, `resizeGeometry` keeps `x`/`y` fixed (left/top is the anchor). If the moving right/bottom edge lands within `DEFAULT_SNAP_THRESHOLD` (6) of a target, the snap candidate for the left edge becomes `target - sourceSize` (a value ≠ the fixed `x`), so `snapped.geometry.x` moves the **anchored** edge. Example: bounds `{x:10,width:56}` (right=66) dragged so right→65 (target left edge at 65): candidate value `65-56=9`, so `x` jumps 10→9 and the widget creeps left while its right edge snaps. Conversely, a right-edge resize whose left edge is already on-grid never gets any right/bottom snap at all.

**Expected vs Actual**
- Expected: `se`/`e`/`s` resize snaps the moving right/bottom edge; the left/top anchor stays fixed.
- Actual: right/bottom edges never snap to grid/edge/center; when they come near a target the **anchor edge displaces** (creep), and the snap guide position may not equal any rendered edge.

**Recommended fix (design-level):** snap per-edge based on the active handle (snap `x+width`/`y+height` for east/south handles) rather than always snapping `x`/`y`, and clamp the anchor edge to remain unchanged for its handle family. Add resize+snap tests for all 8 handles near a target.

---

### WC-04-04 Multi-selection resize applies a per-widget min-size clamp after the relative transform, breaking relative alignment (LOW · state divergence, UI misleading state · CONFIRMED · Scenario S2)

**Repro steps**
1. Multi-select a large widget and a small (≤10px) widget.
2. Resize the selection bounds down until the small widget's scaled size would drop below 10.

**Evidence**
`transformGeometryWithinBounds` (src/App/canvas-interaction.ts:237-246) scales position and size uniformly:

```ts
237: export function transformGeometryWithinBounds(geometry: Geometry, initialBounds: CanvasRect, nextBounds: CanvasRect): Geometry {
238:   const widthRatio = initialBounds.width > 0 ? nextBounds.width / initialBounds.width : 1;
239:   const heightRatio = initialBounds.height > 0 ? nextBounds.height / initialBounds.height : 1;
240:   return {
241:     x: nextBounds.x + (geometry.x - initialBounds.x) * widthRatio,
242:     y: nextBounds.y + (geometry.y - initialBounds.y) * heightRatio,
243:     width: geometry.width * widthRatio,
244:     height: geometry.height * heightRatio,
245:   };
246: }
```

The clamp is applied per-widget, position-untouched, after the transform (App.tsx:653-655 move handler; 693-696 pointerup):

```ts
653:        const next = transformGeometryWithinBounds(canvasPointer.initial[widgetId], initialBounds, snapped.geometry);
654:        return [widgetId, { ...next, width: Math.max(10, next.width), height: Math.max(10, next.height) }];
```

**Expected vs Actual**
- Expected: relative layout preserved, or the whole bounds clamped so every widget scales consistently.
- Actual: when a widget's scaled width/height falls under 10, it is pinned to 10 while its `x`/`y` keep the scaled position — its far edge overflows the scaled bounds and the widget no longer tracks its siblings proportionally. The selection-bounds box (which uses the unclamped transform) no longer matches the rendered widget.

**Recommended fix (design-level):** clamp the bounds first (in `resizeGeometry`, already min 10 for the bounds) and avoid re-clamping individual transformed sizes, or skip widgets whose transformed size would clamp below the minimum and indicate the limit. Add a test asserting uniform scaling down to the min.

---

### WC-04-05 Mixed locked/unlocked multi-selection silently drops locked widgets; the selection box includes them but the drag/resize set excludes them (MEDIUM · UI misleading state, lost-selection ambiguity · CONFIRMED · Scenario S3)

**Repro steps**
1. Select an unlocked widget, shift-click a locked widget (multi-selection).
2. Drag or resize the selection bounds.

**Evidence**
`beginWidgetMove` (App.tsx:582-592) and `beginSelectionResize`/`beginWidgetResize` (598-618) filter to editable and only warn when **all** are locked:

```ts
582:    const selected = selectedWidgetIds.includes(widget.id) ? selectedWidgetIds : [widget.id];
583:    const editable = selected.map((id) => canvasWidgets.find((candidate) => candidate.id === id)).filter((candidate): candidate is Widget => Boolean(candidate && !candidate.locked));
584:    if (!editable.length) {
585:      selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: "Locked" });
586:      logAction(`${widget.name} is locked; geometry command blocked`, "WARN");
587:      return;
588:    }
...
591:    const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
592:    setCanvasPointer({ mode: "drag", pointerId: event.pointerId, widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), screenStart: { x: event.clientX, y: event.clientY }, initial, initialBounds: getBounds(Object.values(initial)) ?? undefined });
```

The selection box, however, is computed from **all** selected widgets (App.tsx:765-766) and drives the multi-selection resize handles (974):

```ts
765:  const selectionGeometryWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id));
766:  const selectionBounds = getBounds(selectionGeometryWidgets.map(previewGeometry));
```

**Expected vs Actual**
- Expected: the drag preview and the selection box describe the same set, with feedback when locked widgets are excluded.
- Actual: `initialBounds` covers only the editable subset, while `selectionBounds` covers locked widgets too — the dashed selection box is larger than the widgets actually moved/resized, with no warning. Locked widgets are also left in `canvasWidgets` and therefore become `otherWidgets` snap targets during the drag (App.tsx:641 excludes only `canvasPointer.widgetIds`, i.e. the editable ids), so the selected-but-locked widget snaps the editable ones it was grouped with.

**Recommended fix (design-level):** compute `selectionBounds`/resize handles from `selectedEditableWidgets` when a drag/resize is active (or exclude locked from the visual box), and log a WARN when a mixed selection drops locked widgets. Add a test covering mixed locked/unlocked drag and resize.

---

### WC-04-06 `lostpointercapture` routes to `cancelCanvasInteraction`, which can re-enter during normal pointerup and undo a completed pan (HIGH · state divergence, stale state · UNVERIFIED — browser event timing · Scenarios S5/S9/S10)

**Repro steps**
1. Use the Pan tool (or middle-drag) to pan the canvas, then release.
2. (To be confirmed in a live run) observe whether the pan snaps back to `initialPan`.

**Evidence**
The stage binds both cancel triggers to the same handler (App.tsx:974):

```tsx
onPointerCancel={handleCanvasPointerCancel} onLostPointerCapture={handleCanvasPointerCancel}
```

```ts
705:  const handleCanvasPointerCancel = () => cancelCanvasInteraction();
```

`handleCanvasPointerUp` releases capture at its top, before committing (App.tsx:664):

```ts
662:  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
663:    if (canvasPointer.mode === "idle" || event.pointerId !== canvasPointer.pointerId) return;
664:    releaseCanvasPointer(event.pointerId);
```

`cancelCanvasInteraction` restores pan when the mode is panning (App.tsx:556):

```ts
550:  const cancelCanvasInteraction = () => {
...
556:    if (canvasPointer.mode === "panning") setPan(canvasPointer.initialPan);
557:    clearGeometryPreview();
558:    setCanvasPointer({ mode: "idle" });
```

**Expected vs Actual**
- Expected: `lostpointercapture` is a cancellation signal, and a completed pan should persist.
- Actual (if `releasePointerCapture()` dispatches `lostpointercapture` synchronously inside the pointerup handler — the documented behavior when capture is still active during `pointerup`): `releaseCanvasPointer` at 664 synchronously fires `lostpointercapture` → `cancelCanvasInteraction` → line 556 restores `initialPan`, undoing the pan the user just finished. The pointerup handler then continues with its stale closure and re-sets `mode:"idle"`, so the pan is silently reverted. For drag/resize the re-entry is benign (the commit still runs from closure state), but for panning it is destructive. `releaseCanvasPointer` nulls `activePointerIdRef` before releasing (523) so there is no infinite release loop.

This is flagged **UNVERIFIED** because the harm depends on the browser dispatching `lostpointercapture` synchronously on the explicit release; the code path and logic are statically deterministic given that timing.

**Recommended fix (design-level):** separate the two signals — use a dedicated `lostpointercapture` handler that does not restore pan (or guard `cancelCanvasInteraction` with a `committing` flag / only restore pan on `pointercancel`), and/or do not `releasePointerCapture` inside `handleCanvasPointerUp` (let the implicit release fire after the commit). Verify the pan tool in a live browser.

---

### WC-04-07 Selection is not reconciled when the active Scene changes via runtime; Explorer/Properties keep a stale cross-scene selection while canvas commands no-op (MEDIUM · stale selection, cross-scene leakage, UI misleading state · CONFIRMED · invariant table)

**Repro steps**
1. With a widget selected in Scene A, change simulator runtime inputs so `runtime.activeScene` resolves to Scene B (or otherwise change `activeScene` without clicking a node).

**Evidence**
The scene-change effect clears preview/interaction but **not** selection (App.tsx:754-758):

```ts
754:  useEffect(() => {
755:    if (canvasPointer.mode !== "idle") cancelCanvasInteraction();
756:    else clearGeometryPreview();
757:    return () => { geometryOverridesRef.current = {}; };
758:  }, [activeDocument, activeRotation?.id, activeScene?.id]);
```

`activeScene` is derived (App.tsx:465), and canvas-scoped selection is filtered against the *current* scene (App.tsx:484):

```ts
465:  const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];
...
484:  const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));
```

**Expected vs Actual**
- Expected: switching the active scene clears or re-scopes the selection so Explorer, Properties, and canvas agree.
- Actual: `selectedIds`/`selection` keep the old widget id, so Explorer still shows it selected and Properties still resolves it (`resolvedSelection` 199); the canvas shows no selection (`selectionGeometryWidgets`/`selectionBounds` empty) and canvas-scoped commands (`deleteSelectionCommand` 276, `selectedEditableWidgets` 485) silently no-op against the new scene.

**Recommended fix (design-level):** clear or re-resolve `selectedIds`/`selection` when `activeScene?.id` changes (in the 754-758 effect), or derive the Properties/Explorer selection from `selectedWidgetIds` rather than raw `selectedIds`. Add a test for scene-switch selection reconciliation.

---

### WC-04-08 Hidden widgets remain keyboard-focusable/selectable, and every single selection renders a redundant selection-bounds box (LOW · UI misleading state · CONFIRMED · Scenario S4/S3)

**Repro steps**
1. Make a widget hidden (`visible:false`), then Tab to it and press Enter.
2. Select any single widget and observe the selection-bounds box behind it.

**Evidence**
Hidden widgets get `pointer-events:none` (app.css:296) but keep `tabIndex={0}` and a keyboard select handler (App.tsx:775):

```tsx
775: return <div key={widget.id} className={`canvas-widget ... ${widget.visible ? "" : "is-invisible"}`} ... role="button" tabIndex={0} ... onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({...}); }}>
```

```css
296: .canvas-widget.is-invisible { border-style: dotted; background: rgba(70, 96, 101, .12); color: #89a4a7; opacity: .65; pointer-events: none; }
```

`selectionBounds` is rendered for **any** non-empty selection (App.tsx:766 + 974), including a single widget, and is layered at `z-index:1` behind the widget (`z-index:2`/`4`, app.css:293-294, 345).

**Expected vs Actual**
- Expected: hidden widgets are unreachable and a single selection shows exactly one selection affordance.
- Actual: a hidden widget can still be selected via keyboard (Tab→Enter), diverging from pointer/marquee/hit-test which all exclude `visible === false`. A single selected widget also shows a dashed selection-bounds box behind its own border (and, for a single locked widget, no handles at all since `!widget.locked` at 775 and the multi-only handle condition at 974), which is visually redundant but harmless.

**Recommended fix (design-level):** remove `tabIndex`/keyboard select from hidden widgets (or exclude hidden from tab order), and render `selectionBounds` only for multi-selection. Minor a11y/consistency cleanup.

---

### WC-04-09 Blur effect re-subscribes every render and `geometryOverridesRef` is write-only; StrictMode double-mount is benign (LOW · robustness · CONFIRMED · Scenario S11)

**Repro steps** — n/a (static).

**Evidence**
The blur effect has no dependency array (App.tsx:748-752), so it tears down and re-adds the window listener on every render:

```ts
748:  useEffect(() => {
749:    const cancelOnBlur = () => cancelCanvasInteraction();
750:    window.addEventListener("blur", cancelOnBlur);
751:    return () => window.removeEventListener("blur", cancelOnBlur);
752:  });
```

`geometryOverridesRef` is written (534, 539) and cleared (757, 761) but never read for logic — rendering uses `geometryOverrides` state via `previewGeometry` (471/771):

```ts
534:    geometryOverridesRef.current = updates;
...
539:    geometryOverridesRef.current = {};
```

`main.tsx` wraps `App` in `<StrictMode>` (11-13). The mount effect (760-763) returns a cleanup that clears the ref and releases pointer capture; in StrictMode dev this runs mount→cleanup→mount, which is a no-op against an empty ref.

**Expected vs Actual**
- Expected: single subscription, no dead state.
- Actual: the no-deps effect re-subscribes each render (functional but wasteful; no double-invoke harm confirmed — cleanup always mirrors setup). The ref is dead weight with no reader; no current bug, but a future consumer could read a stale value.

**Recommended fix (design-level):** add `[]` to the blur effect; remove `geometryOverridesRef` unless a synchronous reader is intended. Informational.

---

### WC-04-10 `commitGeometryCommand` clears preview even when `sceneId` is undefined / `changed` is false; mid-drag zoom/pan is unreachable (LOW · command mismatch (defensive) · CONFIRMED · Scenarios S6/S10)

**Repro steps** — n/a (defensive path; widget ops require an active scene).

**Evidence**
`commitGeometryCommand` (App.tsx:544-548) clears preview unconditionally, including the no-scene and no-change branches:

```ts
544:  const commitGeometryCommand = (sceneId: string | undefined, updates: Readonly<Record<string, Geometry>>, label: string) => {
545:    const result = sceneId ? editorApplication.setWidgetGeometriesInScene(sceneId, updates, label) : { changed: false };
546:    if (result.changed) logAction(`${label} committed`, "EVENT");
547:    clearGeometryPreview();
548:  };
```

Widget drag/resize/nudge only run when `activeScene` yields `canvasWidgets` (466, 484), so the `sceneId === undefined` branch is effectively unreachable for those paths; it is a safe defensive no-op, and clearing preview there is the correct invariant (preview never survives). Mid-drag zoom/pan is likewise unreachable: zoom buttons (973) and pan tool are pointer targets, but `captureCanvasPointer` (517-520) retargets the captured pointer to the canvas, and there is no keyboard zoom/pan handler.

**Expected vs Actual**
- Expected/Actual: consistent — no stale preview survives any commit or cancel path; no mid-drag view-transform change is reachable with a single pointer. Recorded as a verified non-issue (defensive behavior), with the caveat that `toCanvasPoint` (494-498) stores drag `start` in transform space with no re-projection guard, so it would skew if a future input (wheel zoom, second pointer) changed `canvasTransform` mid-drag.

**Recommended fix (design-level):** none required now; if wheel-zoom or multi-pointer is added later, store the drag start in screen space (or re-project on move) and cancel on `canvasTransform` change.

---

## Invariant check table

Legend: ✔ invariant holds (statically), ✖ divergence, — n/a, (U) unverified timing.

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 select→drag→resize→snap→undo→redo | ✔ | ✔ | ✔ cleared on commit | ✔ one command per commit | ✔ | ✔ | ✔ | ✔ | ✔ |
| S2 A+B move/resize/snap | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (see WC-04-04) |
| S3 locked drag/resize/nudge (single) | ✔ (blocked) | ✔ selects+warns | ✔ (no preview) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| S3 mixed locked/unlocked | ✔ | ✔ (locked kept in `selectedIds`) | ✖ box ≠ dragged set (WC-04-05) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| S4 hidden hit test | ✔ | ✔ (not selectable by pointer) | ✔ | ✔ | ✔ | ✔ | ✔ | — | — (WC-04-08 keyboard) |
| S5 drag→Escape | ✔ | ✔ | ✔ cleared | ✔ (none) | ✔ (clean) | ✔ | ✔ | ✔ | ✔ |
| S5 drag→blur | ✔ | ✔ | ✔ cleared | ✔ (none) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S5 drag→pointercancel | ✔ | ✔ | ✔ cleared | ✔ (none) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S6 sub-threshold drag | ✔ | ✔ unchanged | ✔ cleared | ✔ (none) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S7 nudge during drag | ✔ | ✔ | ✖ killed mid-drag then overwritten | ✖ extra "Nudge" + "Move" (WC-04-01) | ✖ two dirty events | ✔ | ✔ | ✔ | ✔ |
| S8 delete during drag | ✔ (delete commits) | ✖ cleared while pointer active | ✖ transient, then cleared | ✔ (one delete) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S9 undo during drag | ✔ | — | — | ✖ potential re-apply of pre-undo initial (U) | (U) | ✔ | ✔ | — | — |
| S10 zoom/pan during drag | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (unreachable) |
| Cross-scene switch (WC-04-07) | ✔ | ✖ stale cross-scene | ✔ (cleared by 754-758) | ✔ | ✔ | ✔ (new scene) | ✔ | ✖ old widget | ✖ old widget |

**Cancellation completeness (S5, S6):** confirmed. `cancelCanvasInteraction` (550-561) releases pointer, restores `initialPan` for panning, clears preview+guides, sets idle, and suppresses the trailing click. No history entry and no dirty state, because the preview lives in `geometryOverrides` state and never touches the store; `setWidgetGeometriesInScene` is only reached on a committed pointerup. Pan restore uses `initialPan` (556). ✔

---

## Summary

**Counts by severity:** 2 High (1 CONFIRMED, 1 UNVERIFIED) · 4 Medium · 4 Low.

**Top findings (one-liners):**

- **WC-04-01 (HIGH, CONFIRMED):** arrow-key nudge during an active drag has no `mode` guard — it commits canonical geometry, clears the live preview, and pointerup then overwrites it, so the nudge delta is lost and an extra "Nudge widget" history entry is created.
- **WC-04-06 (HIGH, UNVERIFIED):** `lostpointercapture` is wired to `cancelCanvasInteraction`; releasing capture inside pointerup can synchronously re-enter cancel and restore `initialPan`, silently undoing a completed pan (needs a live browser check).
- **WC-04-03 (MEDIUM, CONFIRMED):** resize snapping only ever adjusts `x`/`y`, so right/bottom handles never snap and can displace the anchored edge (creep) near a target.
- **WC-04-05 (MEDIUM, CONFIRMED):** mixed locked/unlocked multi-selection silently drops locked widgets while the selection box still includes them, producing a misleading preview and making locked widgets snap targets.
- **WC-04-02 (MEDIUM, CONFIRMED):** mid-drag Delete deletes the widgets, then the trailing pointerup "Move widget" commit silently no-ops via `validScopedWidgetIds` with no user feedback.
- **WC-04-07 (MEDIUM, CONFIRMED):** selection is not reconciled on a runtime-driven active-Scene change, leaving Explorer/Properties showing a stale cross-scene selection while canvas commands no-op.
- **LOW (4):** per-widget min-size clamp breaks multi-resize relative alignment (WC-04-04); hidden widgets stay keyboard-selectable and single selections render a redundant bounds box (WC-04-08); no-deps blur effect + write-only `geometryOverridesRef` + benign StrictMode double-mount (WC-04-09); unconditional preview-clear on commit and unreachable mid-drag zoom/pan (WC-04-10).
