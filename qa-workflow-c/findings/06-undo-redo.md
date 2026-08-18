# Agent 06 — Undo/Redo Lifecycle Integration

Read-only static audit. No code modified. Baseline verified live: `typecheck` exit 0; `vitest` **51/51 pass** (6 files). The existing `editor-pipeline.test.ts` covers store-level add/move/delete/duplicate undo↔redo transitions, redo-branch clearing, and dirty-state return-to-clean; this report goes beyond those into the UI layer (App.tsx) and interaction-timing edge cases that the store tests cannot exercise.

Confidence legend: **CONFIRMED** = statically proven from source; **UNVERIFIED** = requires a live browser/pointer run that is not available here (never asserted as a clicked-UI result).

---

## Scope & scenarios traced

| # | Scenario | Commands involved | Result |
|---|----------|-------------------|--------|
| S1 | drag → undo → redo | drag commit (`commitGeometryCommand` 544–548) | Deterministic redo (see WC-06-04 for mid-drag undo) |
| S2 | nudge ×5 → undo ×5 → redo ×5 | `handleCanvasKeyDown` 739–746 | Granularity spam; each keydown = 1 command (WC-06-08) |
| S3 | type "350" in X field → undo ×3 | `commitSelectionGeometryField` 867–886 | One command per keystroke; undo steps through partials (WC-06-07) |
| S4 | delete 3 widgets → undo → redo | `deleteSelectionInScene` (editor-app 246–251) | Single command, correct (verified) |
| S5 | duplicate → move → undo → redo | `duplicateSelectionInScene` + move | Ids stable on redo (verified); copy not selected (WC-06-06) |
| S6 | add scene → undo → redo (id stability) | `addScene` (editor-app 157–162) | Ids stable (verified); stale selection if node was selected (WC-06-05) |
| S7 | undo to clean → Save enabled state | `save`/`undo` (document-store 75–101, 121–129) | Snapshot-driven, correct (verified) |
| S8 | redo branch (new cmd after undo) | `CommandHistory.execute` commands.ts:36 | Redo cleared, correct (verified) |
| S9 | New Project → undo disabled | `create`→`open`→`clear` document-store 59–66 | Correct (verified) |
| S10 | delete last group → zero groups | `deleteSelection` (editor-app 220–244) | No crash (optional chaining); Add Theme Project no-ops (see WC-06-09 note) |
| S11 | document tab switch / close | `openDocument`/`closeDocument` 383–395 | History NOT cleared (correct, single document) — see WC-06-10 |
| S12 | settings / simulator / zoom / pan / grid | various `setState` | None enter history (verified) |
| S13 | nudge / delete **during** drag | 739–746 / 734–737 with no idle guard | History/geometry divergence (WC-06-02, WC-06-03) |
| S14 | drag active → toolbar Undo | 963 (no idle guard) | Stale-initial divergence (WC-06-04) |

---

## Findings

### WC-06-01 Undo/Redo (and Save) keyboard shortcuts are advertised but never bound — **Medium** · UI misleading state · **CONFIRMED**

**Scenario:** press Ctrl+Z / Ctrl+Y / Ctrl+S anywhere in the app.

**Evidence:** The Edit menu and the Shortcuts settings page declare the shortcuts:
- `src/App/App.tsx:785-786`
  ```tsx
  { label: "Undo", shortcut: "Ctrl+Z", disabled: !commandHistory.canUndo, onClick: undo },
  { label: "Redo", shortcut: "Ctrl+Y", disabled: !commandHistory.canRedo, onClick: redo },
  ```
- `src/App/App.tsx:955`
  ```tsx
  <span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span>
  ```

The only keyboard listener is the shell-level `onKeyDown`:
- `src/App/App.tsx:959`
  ```tsx
  <div className="app-shell" onClick={...} onKeyDown={handleCanvasKeyDown}>
  ```
`handleCanvasKeyDown` (715–746) handles **Escape**, **Ctrl/Cmd+A**, **Delete/Backspace**, and **arrow keys** only. A repo-wide grep for `Ctrl+Z|Ctrl+Y|key === "z"|key === "y"|metaKey|ctrlKey` returns only the two menu labels, the settings line, and `isCanonicalModifier` (canvas-interaction.ts:91) used for select-all/nudge — **no binding for Z/Y/S**. There is no `window.addEventListener("keydown")` anywhere (`grep onKeyDown|addEventListener("keydown")` → only the widget `onKeyDown` Enter/Space and app-shell).

**Expected vs Actual:** Expected: Ctrl+Z/Ctrl+Y/Ctrl+S trigger undo/redo/save as their visible `<kbd>` labels promise. Actual: those keys do nothing; undo/redo/save are reachable only by mouse click on the toolbar/menu. The UI presents a "Confirmed shortcuts" registry (955) and per-item `<kbd>` hints that are non-functional.

**Recommended fix (design-level):** bind Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and/or Ctrl/Cmd+Y, and Ctrl/Cmd+S in `handleCanvasKeyDown` (or a dedicated global keydown effect), respecting `isCanvasKeyboardExcludedTarget` so text inputs keep native editing; either wire them or remove the `<kbd>` labels/shortcut list entries.

---

### WC-06-02 Nudge during an active drag commits a command against current geometry, then pointerup overwrites it from a stale `initial` snapshot — **High** · stale state + history corruption + command mismatch · **CONFIRMED**

**Scenario:** start dragging a widget, keep the pointer held, press an arrow key (nudge), then release.

**Evidence:** The nudge branch has no guard for `canvasPointer.mode !== "idle"`:
- `src/App/App.tsx:739-746`
  ```tsx
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || !selectedWidgetIds.length) return;
  const step = calculateNudgeStep(...);
  ...
  const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
  if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");
  ```
`commitGeometryCommand` (544–548) immediately pushes a command via `setWidgetGeometriesInScene` using the **current canonical** `widget.geometry` (still the pre-drag value, because drag only writes `geometryOverrides` preview, never the model).

Drag start captured a snapshot into `canvasPointer.initial`:
- `src/App/App.tsx:591-592`
  ```tsx
  const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
  setCanvasPointer({ mode: "drag", pointerId: event.pointerId, widgetIds: ..., initial, ... });
  ```

On release, the commit recomputes `finalGeometry` **from that stale `initial`**, ignoring the nudge:
- `src/App/App.tsx:683-697`
  ```tsx
  const finalGeometry = canvasPointer.mode === "drag"
    ? Object.fromEntries(canvasPointer.widgetIds.map((widgetId) => [widgetId, moveGeometry(canvasPointer.initial[widgetId], {...})]))
    ...
  if (Object.keys(finalGeometry).length) commitGeometryCommand(activeScene?.id, finalGeometry, ...);
  ```

**Trace (S13):** widget at G0 → drag begins (`initial={w:G0}`) → nudge commits N: G0→G0+step (canonical now G1) → pointerup commits M with `before=G1, after=moveGeometry(G0, delta)=G2`. Final visible geometry G2 contains **no** nudge step, yet history = [N, M]. Undo M → G1 (nudge "reappears"), undo N → G0. The visible final state never reflects the nudge, but undo resurrects it.

**Expected vs Actual:** Expected: nudge and drag are serialized (nudge ignored while dragging, or the interaction is cancelled/committed first). Actual: two overlapping mutations produce a divergent history whose top command overwrites the prior one, and undo exposes an intermediate state the user never saw.

**Recommended fix (design-level):** in `handleCanvasKeyDown`, early-return when `canvasPointer.mode !== "idle"` (or call `cancelCanvasInteraction()` before committing), so a drag and a nudge cannot interleave on the same widget.

---

### WC-06-03 Delete during an active drag deletes the widget mid-gesture, then pointerup silently no-ops against stale ids — **Low** · stale state (benign, but inconsistent) · **CONFIRMED**

**Scenario:** drag a widget, press Delete/Backspace before releasing.

**Evidence:**
- `src/App/App.tsx:734-737`
  ```tsx
  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelectionCommand();
    return;
  }
  ```
No `canvasPointer.mode` guard. `deleteSelectionCommand` (272–283) deletes the selected widget and clears selection. The subsequent `pointerup` (683–697) still runs and calls `commitGeometryCommand(activeScene?.id, finalGeometry, ...)`, but `setWidgetGeometriesInScene` rejects it because the ids no longer exist (`validScopedWidgetIds` fails via `countWidgetOccurrences`, editor-application.ts:44–52), so it returns `{changed:false}` — a silent no-op.

**Expected vs Actual:** Expected: a destructive keypress during a drag either cancels the drag then deletes, or is deferred. Actual: delete applies immediately while the drag state is still live; the subsequent pointerup runs stale geometry math that is silently discarded. No corruption (the rejected command is not recorded), but the interaction lifecycle is incoherent and shares the same missing idle-guard root cause as WC-06-02.

**Recommended fix (design-level):** same guard as WC-06-02 — defer/cancel destructive and mutating keyboard actions while `canvasPointer.mode !== "idle"`.

---

### WC-06-04 Undo/Redo toolbar buttons have no drag/idle guard; if undo fires mid-drag the pointerup commit is applied to the post-undo document from a stale `initial` — **Medium** · stale state + wrong Scene mutation · **CONFIRMED (guard absence; live multi-pointer repro UNVERIFIED)**

**Scenario:** widget at G0 (produced by prior command C). Drag it; while held, trigger Undo (history pops C → widget returns to Gprev); release.

**Evidence:**
- `src/App/App.tsx:963` — buttons enabled purely by history depth, no mode guard:
  ```tsx
  <button type="button" className="toolbar-button" disabled={!commandHistory.canUndo} onClick={undo} ...>Undo</button>
  ```
- `undo` wrapper does not reconcile the canvas interaction: `src/App/App.tsx:222-224`
  ```tsx
  const undo = () => { if (documentStore.undo()) logAction("> undo()", "EVENT"); };
  ```
- Pointer capture is held on the canvas element throughout the drag (`captureCanvasPointer` 517–520), so a single-primary-button click on the toolbar during a drag is retargeted to the capture target and will **not** reach the Undo button. However, a second pointer (touch/pen, or a future keyboard binding from WC-06-01) is not captured by that pointerId and would deliver `click` to the button normally. The code has no defense either way.

**Trace (S14):** `canvasPointer.initial={w:G0}` → Undo pops C → canonical becomes Gprev → pointerup computes `finalGeometry=moveGeometry(G0, delta)` and `execute` records `before=Gprev, after=G0+delta`. The widget lands at G0+delta — offset from the user's intent (which was G0→G0+delta) by (G0−Gprev).

**Expected vs Actual:** Expected: Undo/Redo are no-ops (or cancel the drag) while a pointer interaction is in flight. Actual: no guard exists; a mid-drag undo produces a geometry command anchored to a pre-undo snapshot and applied to the post-undo document. Single-mouse users are shielded only incidentally by pointer capture.

**Recommended fix (design-level):** disable Undo/Redo (and menu equivalents) while `canvasPointer.mode !== "idle"`, or have `undo()`/`redo()` call `cancelCanvasInteraction()` first; make the capture of `initial` in the drag commit re-read the canonical geometry at commit time instead of trusting a stale snapshot.

---

### WC-06-05 Undo does not reconcile selection: delete loses selection, and undo of an add leaves a stale selection pointing at a missing node — **Medium** · lost selection + stale selection (UI misleading state) · **CONFIRMED**

**Scenario A:** select a widget, delete it, then Undo. **Scenario B:** add a Scene, select it in the explorer, then Undo the add.

**Evidence:**
- Delete clears selection: `src/App/App.tsx:279-280`
  ```tsx
  setSelection(null);
  setSelectedIds([]);
  ```
- Undo only mutates the store; it never restores/revalidates selection: `src/App/App.tsx:222-224` (quoted above). The add methods (`addThemeProject` 248–254, `addRotation` 256–262, `addScene` 264–270) also do **not** call `setSelection` — so the new node is not auto-selected; a stale reference only arises if the user selects it afterward and then undoes.
- The stale reference flows into the status label: `src/App/App.tsx:197`
  ```tsx
  const activeSelectionLabel = selectedIds.length > 1 ? `${selectedIds.length} items selected` : selection?.label ?? "Nothing selected";
  ```
  and `resolvedSelection = selection ? resolveCanonicalNode(project, selection.id) : undefined` (199) becomes `undefined` once the node is gone, so Properties falls back to the empty state and the explorer shows no highlight — but `activeSelectionLabel` still renders the deleted node's name.

**Expected vs Actual:** Expected: after undo of delete, the restored widgets are re-selected (or selection is deterministically cleared); after undo of an add, any selection referencing the removed node is cleared. Actual: undo of delete leaves nothing selected (a usability regression from the pre-delete state), and undo of an add leaves `selection`/`selectedIds` referencing a node that no longer exists — no crash, but the context bar displays a phantom label.

**Recommended fix (design-level):** reconcile selection after undo/redo — either snapshot/restore selection in the command layer, or in `undo()`/`redo()` re-resolve `selectedIds` against the post-state and clear ids that no longer resolve.

---

### WC-06-06 Duplicate does not select the copy — **Low** · lost selection (UX) · **CONFIRMED**

**Scenario:** duplicate a widget; the copy appears offset +10/+10 but nothing is selected.

**Evidence:**
- `src/App/App.tsx:285-293`
  ```tsx
  const duplicateSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    ...
    const result = widgetSelection ? ... : editorApplication.duplicateSelection(selectedIds);
    if (result.changed) logAction("Selection duplicated", "EVENT");
    return result.changed;
  };
  ```
No `setSelection`/`setSelectedIds` for the new copy (whose id is generated in the application layer at editor-application.ts:83–90 and is not returned to the caller).

**Expected vs Actual:** Expected: the duplicated copy becomes the selection (common editor convention) or at least the original stays selected. Actual: the copy is created with no selection change, so the user must find and click it to continue editing.

**Recommended fix (design-level):** return the new ids from `duplicateSelection(InScene)` and select them, or leave the original selected (current behavior leaves it selected but not highlighted as the copy — verify exact UX intent).

---

### WC-06-07 Geometry property fields commit one command per keystroke — user-hostile undo granularity — **Low** · history granularity spam · **CONFIRMED**

**Scenario (S3):** select a widget, focus the X field, type "350" (initial "10").

**Evidence:**
- `src/App/App.tsx:910` — `onChange` fires on every change:
  ```tsx
  <label>X<input ... value={...canonicalGeometry(widget).x} ... onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))} /></label>
  ```
- `commitSelectionGeometryField` commits directly each time: `src/App/App.tsx:884`
  ```tsx
  const result = editorApplication.setWidgetGeometriesInScene(sceneId, updates, `Set widget ${field}`);
  ```
Each keystroke that produces a valid number pushes a command: typing "350" = three commands (x=3, x=35, x=350). Undo ×3 steps through partial numbers. Emptying the field yields `Number("")===0`, and intermediate non-numeric values become `NaN` (`Math.max(0, NaN)`), which `isValidGeometry` rejects (editor-application.ts:11–18), so those are silent no-ops — but the valid partials still pollute history.

**Expected vs Actual:** Expected: a field edit coalesces to one command (commit on blur/Enter, or debounce) so undo restores the previous value in one step. Actual: undo walks through intermediate partials, which is user-hostile.

**Recommended fix (design-level):** commit geometry fields on blur/Enter (or debounce), not on every `onChange`; keep the input as an uncontrolled draft until commit.

---

### WC-06-08 Nudge key-repeat creates one command per repeat event — **Low** · history granularity spam · **CONFIRMED**

**Scenario (S2):** select a widget, hold ArrowRight (auto-repeat).

**Evidence:** `src/App/App.tsx:739-746` (quoted in WC-06-02) calls `commitGeometryCommand(..., "Nudge widget")` on **every** keydown, with no repeat suppression or coalescing. OS key auto-repeat fires many keydown events, each pushing a distinct command; a long hold can flood history, and undo must be pressed once per repeat.

**Expected vs Actual:** Expected: repeated nudges coalesce (or at minimum the user can undo a gesture, not N micro-steps). Actual: one command per repeat event.

**Recommended fix (design-level):** debounce/coalesce nudge commits (e.g., ignore `event.repeat`, or merge consecutive nudge commands), or throttle to one command per sustained gesture.

---

### WC-06-09 Delete/duplicate of a multi-scene widget selection silently drops non-active-scene widgets — **Medium** · wrong Scene mutation + stale state · **CONFIRMED (static; requires cross-scene explorer selection)**

**Scenario:** primary-select a widget in Scene A, then shift-select a widget in Scene B in the explorer, then Delete (or Duplicate).

**Evidence:** the command routes through the scene-scoped subset `selectedWidgetIds`, not the full `selectedIds`:
- `src/App/App.tsx:272-277`
  ```tsx
  const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
  const result = widgetSelection
    ? activeScene?.id ? editorApplication.deleteSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
    : editorApplication.deleteSelection(selectedIds);
  ```
- `selectedWidgetIds` is filtered to the active scene only: `src/App/App.tsx:484`
  ```tsx
  const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));
  ```
`activeScene` follows the last-selected node (`activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0]`, 465), so a widget selected in the other scene is excluded from `selectedWidgetIds` and is neither deleted nor duplicated, while `deleteSelectionCommand` then clears **all** selection (279–280). The resulting single undo command restores only the active-scene subset.

**Expected vs Actual:** Expected: multi-selection delete/duplicate affects every selected widget (or the UI prevents cross-scene selection). Actual: only the active-scene subset is mutated, and the full selection is cleared — a partial, silent operation.

**Recommended fix (design-level):** either restrict widget selection to a single scene at `selectNode` time, or make `deleteSelectionCommand`/`duplicateSelectionCommand` operate per-scene over the full `selectedIds` (group by scene and issue the corresponding scoped command per scene, or fall back to a cross-scene command that handles each scene's subset).

**Related note (S10):** deleting the last Theme Project Group leaves `group === groups[0] === undefined`; all downstream uses are optional-chained (`group?.themeProjects[0]?.rotations[0]` at 200/464, `group?.id` at 249), so nothing crashes, but `addThemeProject` returns `false` (no group to add into, 250) and the only recovery is Undo. No "Add Theme Project Group" command exists.

---

### WC-06-10 Document tabs are views of a single shared document; switching/closing tabs never clears history, while the tab UI implies independent documents — **Low** · UI misleading state (no data leak) · **CONFIRMED**

**Scenario (S11):** add several "documents" via explorer navigation (theme/rotation opens a tab, `openDocument` 383–387), switch among them, undo.

**Evidence:**
- `openDocument`/`closeDocument` (383–395) only mutate `openDocuments`/`activeDocument` React state — no `documentStore` call, so history persists across tab switches. This is **consistent** because there is exactly one `InMemoryDocumentStore` holding one project (139–143), so no cross-document leakage is possible.
- But the chrome presents these as separate open documents: `src/App/App.tsx:966`
  ```tsx
  <span className="document-tab-note">Theme Project / Rotation documents · {documentSnapshot.isDirty ? "Dirty" : "Clean"}</span>
  ```
  and closing a tab merely drops its label (390–394) without affecting the model.

**Expected vs Actual:** Expected: a single-document app should not present tabs as independent documents (or, if multi-document is intended, each must carry its own history/dirty state). Actual: tabs are labels over one document; undo/redo/dirty state are global to the one project, which is internally consistent but misleading given the "documents" metaphor and per-tab close affordance.

**Recommended fix (design-level):** clarify the tab metaphor (rename to "views" or "navigation") until a real multi-document store exists; do not treat tab close as document close.

---

### Verified-correct notes (no finding)

- **Redo determinism:** `EditorApplication.execute` captures `before`/`after` eagerly (editor-application.ts:129–130) and the stored closures replay `clone(after)`/`clone(before)` (135–136). `newId`/`crypto.randomUUID` is only invoked during the initial `mutation(clone(before))`, never during redo, so redo restores the **exact** entity ids and repeated undo↔redo cycles are stable. Confirmed by tests 71–118.
- **Single command construction path:** repo grep for `execute:`/`undo:` closures finds only editor-application.ts:135–136; App.tsx calls `documentStore.undo()/redo()`/`editorApplication.*` only. No inline command with divergent semantics exists.
- **Multi-widget ops single command:** `setWidgetGeometriesInScene` (197–205), `deleteSelectionInScene` (246–251), `duplicateSelectionInScene` (260–265) each produce one command for all ids — undo restores all at once.
- **Z-order swap single command:** `setWidgetZIndicesInScene` (253–258) records the pair swap from `calculateZOrderUpdates` (canvas-interaction.ts:52–71) as one command; undo restores both widgets' z-indices.
- **Non-widget delete subtree restore:** `deleteSelection` (220–244) filters subtrees without regenerating ids; undo replays `clone(before)`, preserving ids.
- **Dirty state snapshot-driven:** `isDirty` = `serialize(current) !== serialize(saved)` (document-store.ts:125); the toolbar chip (963), tab note (966), footer (986), and Save `disabled` (782) all read `documentSnapshot.isDirty` via `useSyncExternalStore`, so undo-to-clean → Save enabled and redo → dirty are consistent (test 273–285).
- **History clear on lifecycle:** `create`→`open` clears history (document-store.ts:59–64, 66); `close` clears (68–73); empty undo/redo returns `false` (commands.ts:41–42) without touching a closed document.
- **No history for view-only toggles:** settings/simulator/zoom/pan/grid/layout all call `setState` directly; grep confirms no `editorApplication`/`documentStore` calls in those handlers.

---

## Invariant check table

Legend: ✔ correct, ✖ divergent, ⚠ conditional/edge, — not applicable.

| Scenario | Document (model) | Selection | Canvas preview | History depth | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 drag→undo→redo | ✔ deterministic | ✔ (unchanged) | ✔ cleared on commit | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| S2 nudge×5→undo×5→redo×5 | ⚠ correct but flooded | ✔ | ✔ | ⚠ 5 cmds (WC-06-08) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S3 type "350"→undo×3 | ⚠ correct but partial steps | ✔ | ✔ | ⚠ 3 cmds (WC-06-07) | ✔ | ✔ | ✔ | ✔ | ✔ |
| S4 delete 3→undo→redo | ✔ | ✖ lost (WC-06-05) | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ cleared | ✖ cleared |
| S5 duplicate→move→undo→redo | ✔ ids stable | ✖ copy unselected (WC-06-06) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| S6 add scene→undo→redo | ✔ ids stable | ⚠ stale if selected (WC-06-05) | ✔ | ✔ | ✔ | ⚠ falls back | ✔ | ✖ phantom label | ✖ empty fallback |
| S7 undo to clean | ✔ | ✔ | ✔ | ✔ | ✔ (Save re-enables) | ✔ | ✔ | ✔ | ✔ |
| S8 redo branch | ✔ | ✔ | ✔ | ✔ redo cleared | ✔ | ✔ | ✔ | ✔ | ✔ |
| S9 New Project | ✔ | ✔ cleared (234–235) | ✔ cleared | ✔ empty | ✔ clean | ✔ | ✔ reset | ✔ cleared | ✔ cleared |
| S10 delete last group | ✔ no crash | ✔ cleared | ⚠ canvas unavailable | ✔ | ✔ | — | ✔ | ✔ | ⚠ empty |
| S11 tab switch/close | ✔ unchanged | ✔ | ✔ | ✔ persists (correct) | ✔ | ✔ | ⚠ tab label only | ✔ | ✔ |
| S12 view-only toggles | ✔ untouched | ✔ | ✔ | ✔ no entries | ✔ | ✔ | ✔ | ✔ | ✔ |
| S13 nudge during drag | ✖ overwritten (WC-06-02) | ✔ | ⚠ stale preview | ✖ 2 cmds, mismatch | ✔ | ✔ | ✔ | ✔ | ✔ |
| S13b delete during drag | ✔ delete applies | ✔ cleared | ✔ | ✔ 1 cmd | ✔ | ✔ | ✔ | ✔ | ✔ |
| S14 undo during drag | ✖ wrong geometry (WC-06-04) | ✔ | ⚠ stale preview | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

---

## Summary (counts by severity)

- **High: 1** — WC-06-02 (nudge-during-drag corrupts geometry/history)
- **Medium: 4** — WC-06-01 (no Ctrl+Z/Ctrl+Y/Ctrl+S binding), WC-06-04 (undo/redo no idle guard → stale-initial divergence), WC-06-05 (selection not reconciled on undo → lost/stale selection), WC-06-09 (multi-scene delete/duplicate drops non-active-scene widgets)
- **Low: 5** — WC-06-03 (delete-during-drag stale no-op), WC-06-06 (duplicate doesn't select copy), WC-06-07 (per-keystroke geometry commits), WC-06-08 (nudge key-repeat spam), WC-06-10 (tabs imply multi-document; single shared history)
- **Total: 10 findings** (plus 7 verified-correct notes confirming redo determinism, single-command construction, multi-widget/z-order single commands, subtree id restore, snapshot-driven dirty state, lifecycle clears, and no-history view toggles)
