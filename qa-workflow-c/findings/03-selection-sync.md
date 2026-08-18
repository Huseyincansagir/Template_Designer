# Agent 03 — Selection Synchronization Integration

**Repo:** `C:\Users\b1601\Template_Designer` (Windows) · **Mode:** read-only static analysis (no UI run available)
**Baseline:** `tsc --noEmit` passes (exit 0) · `vitest run` 51/51 pass (6 files).

Primary selection source of truth is two React states in `src/App/App.tsx`:

```ts
152:  const [selection, setSelection] = useState<Selection | null>(null);      // primary (single) Selection snapshot
153:  const [selectedIds, setSelectedIds] = useState<string[]>([]);            // full multi-select id list
```

`selection` is a *snapshot* (`{ id, label, kind, nodeType, detail }`), captured at select time; `selectedIds` is the authoritative id list. Every downstream consumer derives from one of these two, and this report audits the divergence between them and between the surfaces that read them.

---

## Scope & scenarios traced (table)

| # | Scenario | Path exercised | Result class |
|---|----------|----------------|--------------|
| S1 | Select → move → resize → snap → undo → redo | `beginWidgetMove` 578-593, `beginWidgetResize` 595-608, `commitGeometryCommand` 544-548, `undo`/`redo` 222-228 | Selection persists correctly (ids still valid); undo/redo do **not** restore selection after delete (see WC-03-05) |
| S2 | Additive select/deselect in explorer | `selectNode` 397-416, `selectIds` 248-251, `orderSelectionIds` 253-258 | Deselect-primary bug when remainder is non-widget (WC-03-02) |
| S3 | Multi-kind selection (widget + scene + theme) | `deleteSelectionCommand` 272-283, `duplicateSelectionCommand` 285-293, properties 888-925, context bar 975 | Global whole-project delete/duplicate (WC-03-03); properties primary-only widget sections |
| S4 | Cross-scene widget selection (W1 in A, W2 in B) | `selectedWidgetIds` 484, delete/duplicate/nudge 739-746, z-order 295-303, geometry 867-886 | Silent drop of out-of-scene widget (WC-03-01); geometry warns but delete/duplicate/nudge don't |
| S5 | Marquee vs explorer selection | marquee commit 668-674, `marqueeSelection` 275-281, `selectNode` 397-416 | Marquee bypasses `selectNode` (no `openDocument`, no `logAction`, additive base ordering differs) |
| S6 | Ctrl+A | 726-733 | Selects hidden/disabled/locked widgets (WC-03-08) |
| S7 | Selection after delete / undo / duplicate | delete 279-280, undo 222-228, duplicate 285-293 | Delete clears; undo doesn't restore (WC-03-05); duplicate keeps original selected |
| S8 | Context menu kind source | tree 432, canvas stage 974 | Canvas menu uses stale primary, ignores cursor widget (WC-03-07) |
| S9 | Locked/hidden widgets in selection | `marqueeSelection` 279, `hitTest` 287, widget div 775, app.css 296 | Locked included in marquee; hidden keyboard-selectable (WC-03-08/09) |
| S10 | Asset / project / group selection | asset row 861, `deleteSelection` 220-244, `duplicateSelection` 267-305 | Silent no-op delete/duplicate (WC-03-04) |

---

## Findings

### WC-03-01  Cross-scene widget selection silently drops out-of-scene widgets from delete/duplicate/nudge

**Severity:** High · **Failure types:** lost selection, UI misleading state, command mismatch · **Confidence:** CONFIRMED

**Scenario:** Shift-select widget W1 in Scene A, then shift-click W2 (a widget in Scene B) in the explorer. `activeScene` follows the primary selection's scene, so the canvas switches to Scene B while `selectedIds` still contains both W1 and W2.

**Repro steps:**
1. Click W1 on canvas → `selectedIds=[w1]`, `selection={w1}`, active scene = A.
2. In explorer, shift-click W2 (widget in Scene B) → `selectNode(W2, additive=true)` → `selectIds([w1], w2, true)` = `[w1, w2]`; `selection={w2}`; `resolvedSelection.scene` = B → `activeScene` = B.
3. Press Delete (or Duplicate, or arrow-nudge).

**Evidence:**
```ts
// App.tsx:484 — scope filter to active scene only
const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));

// App.tsx:485 — editable subset also active-scene scoped
const selectedEditableWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id) && !widget.locked);

// App.tsx:272-277 — delete acts ONLY on selectedWidgetIds when "all widgets"
const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
const result = widgetSelection
  ? activeScene?.id ? editorApplication.deleteSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
  : editorApplication.deleteSelection(selectedIds);

// App.tsx:739-746 — nudge iterates selectedEditableWidgets (active scene only)
const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
```

**Expected vs Actual:**
- Expected: both W1 and W2 are deleted/duplicated/nudged, or the user is warned that one widget is outside the active scene.
- Actual: `selectedWidgetIds` = `[w2]` only. Delete removes **only W2**; W1 is silently skipped with **no feedback**. The status bar / context bar still report "2 items selected" (`activeSelectionLabel`, App.tsx:197). This is the exact **command mismatch** the geometry path avoids:

```ts
// App.tsx:867-872 — geometry commit DOES detect and warn
const selectedScenes = selectedIds.map((id) => resolveCanonicalNode(project, id)?.scene?.id);
const sceneId = selectedScenes[0];
if (!sceneId || selectedScenes.some((candidate) => candidate !== sceneId) || sceneId !== activeScene?.id) {
  logAction("Geometry edit blocked: selection is not scoped to active Scene", "WARN");
  return;
}
```

`changeWidgetZOrder` (App.tsx:295-303) likewise fails silently (`return false`) when `activeScene?.id !== node.scene.id`, with no log.

**Recommended fix (design-level):** Centralize "selection → scoped widget ids" so delete/duplicate/nudge/z-order and geometry all share one guard. Either (a) reject the cross-scene selection at `selectNode` time (drop or warn), or (b) partition `selectedIds` by scene and log a WARN listing the skipped ids before proceeding — mirroring `commitSelectionGeometryField`.

---

### WC-03-02  Additive-deselecting the primary node leaves `selection === null` while `selectedIds` stays non-empty (non-widget remainder)

**Severity:** Medium · **Failure types:** state divergence, UI misleading state, lost selection · **Confidence:** CONFIRMED

**Scenario:** In additive mode, toggling the primary node off reassigns the primary to `nextIds[0]` — but only if that id resolves to a **widget**.

**Evidence:**
```ts
// App.tsx:407-410
} else if (additive && selectedIds.includes(node.id)) {
  const firstId = nextIds[0];
  const first = resolveCanonicalNode(project, firstId)?.widget;   // <-- ONLY widgets re-promoted
  setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
}
```

**Repro:** Select Scene B (single). Shift-click Theme T (adds) → `selection={themeT}`. Shift-click Theme T again (deselect) → `selectIds` removes it, `nextIds=[sceneB]`; `resolveCanonicalNode(sceneB)?.widget` is `undefined` → `setSelection(null)`. Result: `selectedIds=["sceneB"]` but `selection === null`.

**Expected vs Actual:**
- Expected: a consistent primary (Scene B) and consistent surfaces.
- Actual: state divergence. Downstream:
  - `resolvedSelection` (App.tsx:199) is `undefined` → `activeScene`/`activeRotation` fall back to runtime/first-scene (App.tsx:464-465), silently changing the canvas context.
  - Explorer tree row for Scene B still shows `is-selected` (App.tsx:428 reads `selectedIds`), but the properties header falls to "Document Properties" and body to the empty state (App.tsx:904-921), and the context/status bar shows "Nothing selected" (App.tsx:197).
  - Toggling off the **last** id correctly yields `selection=null` + `selectedIds=[]` (App.tsx:405-406), so the inconsistency is specific to the non-widget remainder case.

**Recommended fix:** In the deselect branch, resolve the new primary generically (any `ResolvedNode`, not just `widget`) and build the `Selection` from its kind/label/detail — or fall back to clearing `selectedIds` when no valid primary can be established.

---

### WC-03-03  Mixed-kind selection routes delete/duplicate through the whole-project path, deleting/duplicating container nodes beyond user intent

**Severity:** High · **Failure types:** wrong Scene mutation, cross-Scene leakage, UI misleading state · **Confidence:** CONFIRMED

**Scenario:** A selection that mixes widget + scene (or theme/rotation) is not "all widgets", so it falls to the global `deleteSelection`/`duplicateSelection`.

**Evidence:**
```ts
// App.tsx:274-277
const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
const result = widgetSelection
  ? activeScene?.id ? editorApplication.deleteSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
  : editorApplication.deleteSelection(selectedIds);     // <-- whole project, set-membership delete

// src/Core/editor-application.ts:220-244 — deletes by id at EVERY level
...themeProjectGroups: project.themeProjectGroups
  .filter((group) => !selected.has(group.id))
  .map((group) => ({ ...group, themeProjects: group.themeProjects
    .filter((theme) => !selected.has(theme.id))
    .map((theme) => ({ ...theme, rotations: theme.rotations
      .filter((rotation) => !selected.has(rotation.id))
      .map((rotation) => ({ ...rotation, scenes: rotation.scenes
        .filter((scene) => !selected.has(scene.id))
        .map((scene) => ({ ...scene, widgets: scene.widgets.filter((widget) => !selected.has(widget.id)) })),
      })),
    })),
  })),
```

**Repro:** Reach the mixed state `selectedIds=[w1, sceneB]` (select W1, shift-click Scene B). Press Delete. `widgetSelection` is `false` → `deleteSelection(["w1","sceneB"])` removes W1 **and** the entire Scene B (including any other widgets it contains). Duplicate analogously: `duplicateSelection` (editor-application.ts:267-305) sees `sceneB` and duplicates the **whole scene subtree** (a full scene copy), not just the two selected items.

**Expected vs Actual:**
- Expected: mixed-kind selection is either rejected, or each selected item is treated by its own kind with clear scoping.
- Actual: container nodes are silently destroyed/duplicated. The context bar and status bar give no indication ("N items selected" is the only label). This is the same silent-`continue`/`scenes.push(scene, duplicateScene(scene))` behavior that makes mixed selections dangerous.

**Recommended fix:** When a selection mixes widget and non-widget kinds, require an explicit command decision — block destructive ops with a WARN (like `commitSelectionGeometryField`), or disallow building mixed-kind selections in the first place.

---

### WC-03-04  Selecting an Asset (or project/theme-group root) makes Delete/Duplicate silently no-op

**Severity:** Medium · **Failure types:** command mismatch, UI misleading state · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:861 — asset rows are selectable
onClick={() => selectNode({ id: asset.id, label: asset.name, kind: "Asset", detail: asset.mediaType })}

// editor-application.ts:220-244 — deleteSelection filters ONLY themeProjectGroups; never project.assets or project.id
// editor-application.ts:267-305 — duplicateSelection iterates groups/themes/rotations/scenes/widgets; ignores group.id, project.id, asset ids
```

**Repro:** In the Asset Browser, select an asset → press Delete (or use the Scene/Widget menu "Delete Selection", enabled because `selectedIds.length` > 0). `deleteSelectionCommand` runs, `widgetSelection` is `false`, `deleteSelection([assetId])` produces no change → `equalProject` is true → `changed:false` → the command returns `false` and logs **nothing**; the asset remains and stays selected. Same for `duplicateSelection` on an asset. The project root and theme-group root behave the same for duplicate (group delete does work — covered by `tests/editor-pipeline.test.ts:329`).

**Expected vs Actual:** The Delete keybinding and menu offer a delete that never fires, with zero feedback. Either assets/roots must be deletable/duplicable through the canonical mutation, or those actions must be disabled when the primary kind is unsupported (`commandsForSelection("asset")` already returns `[]`, editor-commands.ts:41-44 — but the keyboard/menu path doesn't check it).

---

### WC-03-05  Undo of a delete does not restore selection; duplicate keeps the original selected

**Severity:** Medium · **Failure types:** lost selection · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:272-283 — delete clears selection
if (!result.changed) return false;
setSelection(null);
setSelectedIds([]);

// App.tsx:222-224 — undo/redo are selection-agnostic
const undo = () => { if (documentStore.undo()) logAction("> undo()", "EVENT"); };
const redo = () => { if (documentStore.redo()) logAction("> redo()", "EVENT"); };

// App.tsx:285-293 — duplicate does not reselect the copy
const result = widgetSelection ? ...duplicateSelectionInScene(...) : ...duplicateSelection(...);
if (result.changed) logAction("Selection duplicated", "EVENT");  // no setSelection
```

**Expected vs Actual:** After deleting W1 and pressing Undo, W1 reappears in the document and canvas but is **not** selected (selection was cleared at delete time and `undo()` never restores it). After duplicating, the copy (new id, `duplicateWidget` appends " Copy", editor-application.ts:83-90) exists but is **not** selected — the original stays selected. Both are silent; the user must reselect manually.

**Recommended fix:** Undo/redo should reconcile selection against the restored project (drop ids that no longer resolve, or restore a remembered selection). Duplicate should optionally move selection to the new copy, or at least report the copy id in the console.

---

### WC-03-06  `selection.label`/`detail` are snapshots never recomputed — stale name/detail after any rename/hide/lock

**Severity:** Medium · **Failure types:** stale state · **Confidence:** CONFIRMED (reachability currently latent)

**Evidence:**
```ts
// App.tsx:412 — snapshot captured at select time
setSelection({ id: node.id, label: node.label, kind, nodeType, detail: node.detail });

// App.tsx:904-906 — properties render the snapshot, not live canonical data
<strong>{multi ? `${selectedIds.length} items selected` : selection?.label ?? "Document Properties"}</strong>
...
<PropertyRow label="Name" value={multi ? valueFor((current) => "name" in current.node ? String(current.node.name) : undefined) : selection.label} />

// App.tsx:197 — status/context bar also use the snapshot
const activeSelectionLabel = selectedIds.length > 1 ? `${selectedIds.length} items selected` : selection?.label ?? "Nothing selected";
```

The explorer tree, by contrast, re-renders from live project data (`getThemeNodes`, App.tsx:82-107, reads `widget.name`). `editWidgetProperties` (editor-application.ts:207-218) supports `name`/`visible`/`locked` patches, but is not wired into any UI surface in this shell (grep confirms only the definition + tests), so no rename/hide/lock path currently reaches it.

**Expected vs Actual:** Once any rename/hide/lock command is wired, the tree would show the new name/detail while the properties "Name" row, header, status bar and context bar keep the old snapshot — a guaranteed divergence because `selection` is never recomputed on `project` change.

**Recommended fix:** Derive the primary label/detail at render time from `resolvedSelection` (live canonical node) instead of trusting the stored snapshot, or add a `useEffect` on `project` that refreshes `selection.label/detail` for the current `selection.id`.

---

### WC-03-07  Canvas context menu ignores the widget under the cursor and uses the stale primary kind

**Severity:** Medium · **Failure types:** UI misleading state · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:974 — canvas-stage context menu reads selection, not the hit target
onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, kind: selection?.kind ?? "canvas" }); }}

// App.tsx:775 — widget div has no onContextMenu; right-click bubbles to the stage
return <div ... role="button" tabIndex={0} onPointerDown={...} onClick={...} onKeyDown={...}>...</div>;

// App.tsx:432 — tree row instead selects the node first
onContextMenu={(event) => { event.preventDefault(); selectNode(node); setContextMenu({ x: event.clientX, y: event.clientY, kind: resolveCanonicalNode(project, node.id)?.kind ?? "canvas" }); }}
```

**Expected vs Actual:** Right-clicking a **non-selected** widget on the canvas shows commands for the *current primary selection* (or the empty "canvas" menu after a stage click cleared selection), not for the widget under the pointer. `hitTest` (canvas-interaction.ts:284-290) exists precisely to resolve the widget under a point but is **never called** from `App.tsx` (grep confirms only definition/tests). The tree context menu is correct (selects the node first); the canvas one is inconsistent with it.

**Recommended fix:** On canvas `onContextMenu`, hit-test the pointer (`screenToCanvas` + `hitTest`) to resolve the widget under the cursor and build the menu from that node, mirroring the tree path.

---

### WC-03-08  Ctrl+A selects hidden/disabled/locked widgets; marquee includes locked but excludes hidden/disabled

**Severity:** Low · **Failure types:** UI misleading state · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:726-729 — Ctrl+A takes every widget, no visibility/enabled/locked filter
const allIds = orderSelectionIds(canvasWidgets, canvasWidgets.map((widget) => widget.id));

// canvas-interaction.ts:279 — marquee filters visible && enabled, but NOT locked
const hits = widgets.filter((widget) => widget.visible && widget.enabled && predicate(widget.geometry)).map((widget) => widget.id);

// canvas-interaction.ts:287 — hitTest filters visible && enabled (also unused in UI)
.filter(({ widget }) => widget.visible && widget.enabled && containsPoint(widget.geometry, point))
```

**Expected vs Actual:** Ctrl+A then Delete/Duplicate will delete/duplicate hidden and disabled widgets (and locked ones), while marquee silently excludes hidden/disabled (but includes locked). The three acquisition paths (`Ctrl+A`, marquee, hitTest) each apply a different filter, so "what is selected" is inconsistent across gestures. Locked widgets in a marquee/Ctrl+A selection are still deletable/duplicable because `deleteSelectionInScene`/`duplicateSelectionInScene` (editor-application.ts:246-265) do not check `locked`.

**Recommended fix:** Define one "selectable widget" predicate (visible && enabled, lock policy explicit) and apply it in all three paths; decide whether locked widgets belong in bulk operations.

---

### WC-03-09  Hidden widgets are keyboard-focusable and selectable despite `pointer-events: none`

**Severity:** Low · **Failure types:** UI misleading state · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:775 — hidden widget keeps tabIndex=0 + Enter/Space select
return <div ... role="button" tabIndex={0} ... onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ id: widget.id, ... }); }}>

// app.css:296 — hidden widgets are click-transparent but still in tab order
.canvas-widget.is-invisible { ... opacity: .65; pointer-events: none; }
```

**Expected vs Actual:** A hidden widget cannot be clicked (pointer-events none) but can be reached by Tab and selected with Enter/Space. Once selected, `selectedEditableWidgets` (App.tsx:485) does not filter `visible`, so arrow-nudge and geometry moves still apply to the hidden widget — an operation the pointer path forbids. Marquee/hitTest exclude it. Inconsistent and surprising.

**Recommended fix:** Exclude hidden (or non-enabled) widgets from the tab order (`tabIndex={widget.visible ? 0 : -1}`) and/or add `visible` to the editable-nudge guard.

---

### WC-03-10  Pointer-down drag/resize has selection side-effects that collapse multi-selection

**Severity:** Low · **Failure types:** lost selection · **Confidence:** CONFIRMED

**Evidence:**
```ts
// App.tsx:578-589 — beginWidgetMove
const selected = selectedWidgetIds.includes(widget.id) ? selectedWidgetIds : [widget.id];
const editable = selected.map(...).filter((candidate): candidate is Widget => Boolean(candidate && !candidate.locked));
if (!editable.length) {
  selectNode({ id: widget.id, ..., detail: "Locked" });          // <-- replaces multi-selection with this single widget
  logAction(`${widget.name} is locked; geometry command blocked`, "WARN");
  return;
}
if (!selectedWidgetIds.includes(widget.id)) selectNode({ id: widget.id, ... });   // <-- replaces selection
```

**Expected vs Actual:** Attempting to drag a locked widget (or a widget outside the current selection) collapses the current multi-selection to that single widget before the block/drag resolves — a destructive side-effect of a gesture that may end up blocked. `beginWidgetResize` (595-608) is asymmetric: the locked case only logs and does **not** reselect. A locked+hidden widget gets `detail: "Locked"` (lock overrides the hidden hint).

**Recommended fix:** Do not mutate selection on the lock-block path; only reselect on a *successful* drag of an unselected widget, and reconcile the two begin-* handlers.

---

## Invariant check table

Legend: ✅ consistent · ⚠️ divergent (see finding) · ➖ not applicable

| Scenario | Document | Selection | Canvas preview | History | Dirty | Active Scene | Active document | Explorer sel | Properties sel |
|---|---|---|---|---|---|---|---|---|---|
| S1 move→resize→snap→undo→redo | ✅ | ✅ (ids persist) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S2 deselect primary (non-widget remainder) | ✅ | ⚠️ null vs ids (WC-03-02) | ➖ | ✅ | ✅ | ⚠️ falls back (465) | ✅ | ⚠️ row still selected | ⚠️ "Document Properties" |
| S3 mixed-kind delete/duplicate | ⚠️ whole subtree mutated (WC-03-03) | ✅ (cleared on delete) | ⚠️ scene vanishes | ✅ | ✅ | ⚠️ deleted scene | ✅ | ✅ | ✅ |
| S4 cross-scene widget delete/duplicate/nudge | ⚠️ only active-scene ids (WC-03-01) | ⚠️ "2 items" label, 1 acts | ⚠️ only active scene | ✅ | ✅ | ✅ | ✅ | ⚠️ both rows selected | ⚠️ primary only |
| S5 marquee vs explorer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ (no openDocument) | ✅ | ✅ |
| S6 Ctrl+A | ✅ | ⚠️ hidden/disabled/locked (WC-03-08) | ⚠️ hidden widgets shown | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S7 delete→undo; duplicate | ✅ | ⚠️ not restored / copy not selected (WC-03-05) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ cleared | ⚠️ empty |
| S8 context menu (canvas) | ✅ | ⚠️ stale primary (WC-03-07) | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S9 locked/hidden in selection | ✅ | ⚠️ (WC-03-08/09) | ⚠️ hidden focusable | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S10 asset/project/group delete/duplicate | ✅ (no-op) | ⚠️ still selected, no feedback (WC-03-04) | ➖ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ asset shown |

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| High | 2 | WC-03-01, WC-03-03 |
| Medium | 5 | WC-03-02, WC-03-04, WC-03-05, WC-03-06, WC-03-07 |
| Low | 3 | WC-03-08, WC-03-09, WC-03-10 |
| **Total** | **10** | |

All findings are **CONFIRMED** by static analysis (no live UI run available; none claimed). The single cross-cutting root cause is that `selection` (primary snapshot) and `selectedIds` (id list) are maintained as independent React states, and the command layer re-derives scope (`selectedWidgetIds` → active scene) inconsistently per command: geometry warns, delete/duplicate/nudge/z-order stay silent.
