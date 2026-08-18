# Agent 05 — Properties / Canvas Integration

Baseline verified at analysis start: `& npm.cmd run typecheck` exit 0; `& npm.cmd test` → 6 files, 51/51 passed.

> Read-only audit. No code was modified. Confidence per finding is `CONFIRMED` (statically proven from source) or `UNVERIFIED` (needs a live run; no live UI was available — nothing here claims a UI was clicked).

## Scope & scenarios traced (table)

| # | Scenario | Code path | Reachable in live UI? | Finding |
|---|----------|-----------|------------------------|---------|
| S1 | Edit X/Y/W/H via inputs → canvas | `renderProperties` inputs (App.tsx:910) → `commitSelectionGeometryField` (867-886) → `setWidgetGeometriesInScene` (editor-application.ts:197-205) → store → `useSyncExternalStore` (App.tsx:144-147) → `renderCanvasWidget` (770-776) | **No** — no widget can be created (WC-05-09) | WC-05-01, 02, 03, 04 |
| S2 | Undo/redo a property edit | `undo()`/`redo()` (222-228) → `documentStore.undo/redo` (document-store.ts:95-109) → `CommandHistory` (commands.ts:40-59) | No (needs a widget) | WC-05-04 |
| S3 | Clear the field (empty string) | `Number(event.target.value)` → `Number("") === 0` (App.tsx:910→878) | No | WC-05-01 |
| S4 | Type `abc` (non-numeric) | `Number("abc")` → NaN → `isValidGeometry` rejects (editor-application.ts:11-18) | No; `type="number"` coerces bad input to `""` | WC-05-01 |
| S5 | Multi-select geometry edit | inputs `disabled={... || multi || widget.locked}` (App.tsx:910) | Blocked by design | WC-05-05 |
| S6 | Locked widget edit | `disabled={... widget.locked}` (910); commit skip (877); core lock (214-215) | No (no Lock UI) | WC-05-07, 08 |
| S7 | Cross-scene edit | `commitSelectionGeometryField` scope guard (868-872) vs nudge/delete/duplicate (739-746, 272-293) | Guard unreachable; silent paths reachable | WC-05-06 |
| S8 | Property edit during drag | `disabled={canvasPointer.mode !== "idle" ...}` (910) | Blocked by design | (confirmed, no finding) |
| S9 | Delete widget while Binding Editor open | `handleCanvasKeyDown` (715-738) → `deleteSelectionCommand` (272-283) → `bindingWidget` (204) → modal (988) | Yes (needs a widget) | WC-05-11 |

---

## Findings

### WC-05-01 Geometry input parsing: empty string commits `0` (or `10`), non-numeric is silently rejected
**Severity: Medium** · **Failure types: command mismatch, history pollution, UI misleading state** · **Confidence: CONFIRMED (empty→0) / UNVERIFIED (browser `badInput` rendering)** · **Scenario: S1, S3, S4**

- **Evidence** — App.tsx:910 (input) and 867-886 (commit):
  - `onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))}` (App.tsx:910)
  - `updates[id] = { ...canonicalGeometry(widget), [field]: Math.max(field === "width" || field === "height" ? 10 : 0, value) };` (App.tsx:878)
- **Repro (static)** — With a single unlocked widget selected, select-all + Backspace in the X field. For `<input type="number">`, an emptied/bad field yields `event.target.value === ""`, so `Number("") === 0`. `Math.max(0, 0) = 0` → a valid geometry → `setWidgetGeometriesInScene` commits `x = 0` and records a `Set widget x` history entry. Clearing W/H commits `10` via `Math.max(10, 0) = 10`. The field does **not** revert to the prior value.
- **Non-numeric path** — `Number("abc") === NaN`. `Math.max(10|0, NaN) === NaN`. `isValidGeometry` rejects NaN because `Number.isFinite(candidate[key])` is false (editor-application.ts:15), and `setWidgetGeometriesInScene` returns `{ changed: false }` (editor-application.ts:200). Nothing is logged and, because no command executed, the store does not notify and React does not re-render — so the DOM does **not** snap back to the canonical value. (For a `type="number"` input the browser coerces non-numeric text to `""` before `onChange`, so the realistic path is the empty→0 case above; the NaN branch is only reachable via `type="text"`/devtools.)
- **Expected vs Actual** — Expected: clearing a field reverts/ignores, and non-numeric input is rejected with feedback. Actual: clearing commits `0`/`10` as a real command; NaN is swallowed silently with no visual correction.
- **Recommended fix** — Parse with an explicit numeric validator (`const n = Number(v); if (!Number.isFinite(n)) return;` or treat `""` as "no change"), and add a `logAction`/error feedback branch when the core returns `changed:false`.

### WC-05-02 Geometry clamp lives in the UI, not the domain; domain permits values the UI forbids
**Severity: Low** · **Failure types: command mismatch, persistence mismatch** · **Confidence: CONFIRMED** · **Scenario: S1**

- **Evidence**:
  - UI clamp: `Math.max(field === "width" || field === "height" ? 10 : 0, value)` (App.tsx:878)
  - Domain validation: `isValidGeometry` only requires `width > 0` and `height > 0` and `Number.isFinite` on all four keys (editor-application.ts:14-17). There is **no** `x/y >= 0` check and **no** `>= 10` minimum.
- **Repro (static)** — Type `-5` into X: UI stores `0` (clamped). Type `5` into W: UI stores `10` (clamped). But `editor.setWidgetGeometriesInScene(sceneId, { w: { x:-5, y:0, width:5, height:10 } })` would be accepted by the domain (width 5 > 0, x -5 finite). The 10-px floor is a UI-only policy duplicated in the canvas resize path (`Math.max(10, next.width)` App.tsx:654 and 695) and `MIN_WIDGET_SIZE = 10` (canvas-interaction.ts:76), but it is not enforced by the single core validator.
- **Expected vs Actual** — Expected: one authoritative geometry policy. Actual: UI and core disagree on the legal range (x/y sign, min size), so the "same" geometry edit has different legality depending on entry surface.
- **Recommended fix** — Centralize the minimum-size and non-negative-position policy in the domain (or a shared constant consumed by both `isValidGeometry` and the UI clamp), so validation and clamping cannot drift.

### WC-05-03 Huge geometry values accepted; widget renders off-canvas and is unrecoverable via canvas
**Severity: Medium** · **Failure types: stale preview, UI misleading state** · **Confidence: CONFIRMED** · **Scenario: S1**

- **Evidence**:
  - No upper bound in commit: `updates[id] = { ...canonicalGeometry(widget), [field]: Math.max(...) }` (App.tsx:878) — only a lower bound.
  - `isValidGeometry` accepts any finite positive width/height and any finite x/y (editor-application.ts:14-17).
  - Render is percentage-based with no clamp: `left: ${(geometry.x / canvasWidth) * 100}%` (App.tsx:773).
- **Repro (static)** — Type `1e12` into X (or W). `Number("1e12")` is finite, so the command commits. The widget is rendered at `(1e12 / canvasWidth) * 100%` — astronomically far off the visible canvas. It cannot be selected/dragged back on canvas (no hit target within the viewport) and can only be recovered by retyping a sane value in Properties.
- **Expected vs Actual** — Expected: a canvas-bound clamp or a validation warning. Actual: the value is silently persisted and the widget becomes visually unreachable.
- **Recommended fix** — Clamp x/y/width/height to the active Rotation/display bounds (or at minimum `logAction` a warning) before committing, mirroring the existing lower-bound clamp.

### WC-05-04 Each keystroke in a geometry input is a separate history command (no debounce / commit-on-blur)
**Severity: Medium** · **Failure types: history pollution** · **Confidence: CONFIRMED** · **Scenario: S1, S2**

- **Evidence**:
  - `onChange={(event) => commitSelectionGeometryField(...)}` fires on every input event (App.tsx:910); there is no debounce, no `onBlur` commit, and no `onKeyDown` commit.
  - Each call reaches `editorApplication.setWidgetGeometriesInScene(...)` → `execute(...)` → `this.documents.execute({ label, ... })` (editor-application.ts:133-138) → `history.execute` pushes one `Command` (commands.ts:33-38).
- **Repro (static)** — With the field focused, typing `350` into X produces three `Set widget x` commands: `x=3`, then `x=35`, then `x=350`. Undo therefore steps `350 → 35 → 3 → previous` (three undo presses), not `350 → previous`. Same for the other fields. (Settings are not part of document history — they use local `setSavedSettings` at App.tsx:988-989, outside the store.)
- **Expected vs Actual** — Expected: one logical edit per field commitment (typically commit-on-blur/Enter, or a debounce). Actual: keystroke-level command granularity pollutes undo/redo and makes undoing a typed value require N presses.
- **Recommended fix** — Debounce or commit-on-blur/Enter; keep a draft value locally and dispatch a single command per logical edit.

### WC-05-05 Multi-selection disables geometry inputs while nudge edits multi-selection; UI note is inaccurate
**Severity: Low** · **Failure types: command mismatch, UI misleading state** · **Confidence: CONFIRMED** · **Scenario: S5**

- **Evidence**:
  - Geometry inputs disabled for multi: `disabled={canvasPointer.mode !== "idle" || multi || widget.locked}` (App.tsx:910).
  - Nudge edits all selected editable widgets: `const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));` (App.tsx:744).
  - The explanatory note is narrower than reality: `Geometry fields remain read-only when a selected widget is locked.` (App.tsx:920) — it omits the `multi` and `canvasPointer.mode !== "idle"` (during drag) disable conditions.
- **Repro (static)** — Select two unlocked widgets; arrow-key nudge moves both (multi supported). The X/Y/W/H inputs are disabled for the same selection (multi unsupported), so exact-coordinate multi-edit is impossible. The note tells the user fields are read-only "when a selected widget is locked," which is only one of three disable conditions.
- **Expected vs Actual** — Expected: consistent multi-selection edit policy (nudge and numeric fields both multi-capable, or both single-only) and accurate helper text. Actual: policy is inconsistent and the helper text is misleading.
- **Recommended fix** — Either implement multi geometry commit (applying deltas or absolute anchors) or update the note to state all disable conditions; align nudge and numeric editing.

### WC-05-06 Cross-scene selection: geometry guard is unreachable; nudge/delete/duplicate silently drop cross-scene widgets
**Severity: High** · **Failure types: cross-scene leakage, lost selection, wrong Scene mutation** · **Confidence: CONFIRMED** · **Scenario: S7**

- **Evidence**:
  - Geometry guard: `const selectedScenes = selectedIds.map((id) => resolveCanonicalNode(project, id)?.scene?.id); const sceneId = selectedScenes[0]; if (!sceneId || selectedScenes.some((candidate) => candidate !== sceneId) || sceneId !== activeScene?.id) { logAction("Geometry edit blocked: selection is not scoped to active Scene", "WARN"); return; }` (App.tsx:868-872).
  - `activeScene` derives from the single selection: `const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];` (App.tsx:465) and `resolvedSelection` is `selection.id`-scoped (App.tsx:199).
  - Nudge/delete/duplicate filter to the active scene only: `const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));` (App.tsx:484), then `deleteSelectionCommand` (272-283) / `duplicateSelectionCommand` (285-293) / `handleCanvasKeyDown` (739-746) operate on `selectedWidgetIds` and `activeScene?.id`.
  - `orderSelectionIds` preserves ids not present in the active scene at the end of the list (canvas-interaction.ts:253-258), so cross-scene ids persist in `selectedIds` after explorer shift-click.
- **Repro (static)** — Explorer shift-click a widget in Scene A, then shift-click a widget in Scene B. `selectedIds = [A, B]`, `selection.id = B`, `activeScene = B`. (1) The geometry guard **cannot** fire: the inputs are disabled whenever `selectedIds.length > 1` (App.tsx:910), and for a single selection `sceneId === activeScene?.id` always holds because both resolve to the same widget's scene. (2) Nudge/delete/duplicate proceed with `selectedWidgetIds = [B]` only — the Scene A widget is silently untouched, and `deleteSelectionCommand` then runs `setSelection(null); setSelectedIds([])` (App.tsx:279-280), clearing the Scene A selection without any warning. This contradicts the explicit warning style of `commitSelectionGeometryField`.
- **Expected vs Actual** — Expected: cross-scene selection is either blocked with feedback everywhere, or consistently applied everywhere. Actual: the one explicit cross-scene guard is dead code, while the mutation paths that can actually hit cross-scene selection silently ignore part of the selection and then clear it.
- **Recommended fix** — Add the same scope check (or a union of per-scene commands) to `deleteSelectionCommand`/`duplicateSelectionCommand`/nudge; scope `selectedWidgetIds` derivation to match `selectedIds`, and remove or repair the unreachable guard.

### WC-05-07 Locked-widget policy is consistent at the boundary, but nudge skips locked widgets silently
**Severity: Low (informational)** · **Failure types: UI misleading state (minor)** · **Confidence: CONFIRMED** · **Scenario: S6**

- **Evidence**:
  - Input disabled: `disabled={... || widget.locked}` (App.tsx:910); commit skip: `if (!widget || widget.locked) return;` (App.tsx:877).
  - Core lock enforcement: `editWidgetProperties` ignores geometry when locked — `...(widget.locked || geometry === undefined ? {} : { geometry })` (editor-application.ts:215); `setWidgetGeometries` — `return geometry && !widget.locked ? { ...widget, geometry: clone(geometry) } : widget;` (editor-application.ts:193); `setWidgetGeometriesInScene` same (202-203). Tests assert this (editor-pipeline.test.ts:301-327).
  - Nudge uses `selectedEditableWidgets` (filters `!widget.locked`, App.tsx:485) with no log/warn, unlike drag (`logAction(`${widget.name} is locked; geometry command blocked`, "WARN")` App.tsx:586).
- **Expected vs Actual** — Consistent (locked geometry is immutable across inputs, commit, and core). The only gap is that nudge silently drops locked widgets with no console feedback while drag warns.
- **Recommended fix** — Optionally emit the same `WARN` when nudge filters out a locked widget, for parity with drag/resize.

### WC-05-08 The entire widget-properties patch API (`editWidgetProperties`) is dead code; Lock/Visibility/Enabled/Rename/Z-order are not executable, and the context-bar Lock button is permanently disabled
**Severity: High** · **Failure types: functional gap, UI misleading state** · **Confidence: CONFIRMED** · **Scenario: S6, S8, S9**

- **Evidence**:
  - `grep editWidgetProperties` across the repo returns call sites only in `tests/editor-pipeline.test.ts` (lines 170, 323) and its definition (editor-application.ts:207). **No call in `src/App/App.tsx` or anywhere in `src/`.**
  - `Visible`, `Enabled`, `Geometry Lock`, `Z-order`, `Bindings`, `Asset References` are all rendered via `PropertyRow` (read-only `<span>…</span><strong>…</strong>`, App.tsx:109-116) — e.g. `PropertyRow label="Visible" value={...}` (App.tsx:909), `PropertyRow label="Z-order" value={String(widget.zIndex)}` (App.tsx:910).
  - Context bar Lock button is unconditionally disabled: `<button type="button" className="context-action" disabled title="Requires a selected widget">Lock</button>` (App.tsx:975) — `disabled` with no expression, so it stays disabled even when a widget is selected. The `Align` button is the same.
- **Repro (static)** — Select any widget. Properties shows read-only rows for Visible/Enabled/Geometry Lock/Z-order/Bindings/Asset refs; the context-bar Lock button is disabled with title "Requires a selected widget" despite a selected widget. No control anywhere can change `widget.visible`, `widget.enabled`, `widget.locked`, `widget.name`, or `widget.zIndex` (other than canvas z-order commands bring-forward/send-backward, which are a separate path).
- **Expected vs Actual** — Expected: the properties panel (or context bar) exposes the editing the patch API was built for, and disabled controls either enable when valid or don't claim a selection is required. Actual: the only general patch API is unreachable from the UI, "Locking" and "Visibility" mission scenarios are not executable, and the Lock button misleads by blaming missing selection.
- **Recommended fix** — Wire `editWidgetProperties` into editable controls (Visible/Enabled/Lock/rename/Z-order) or remove the misleading controls and explicitly mark these properties as read-only foundation placeholders; fix the context-bar `Lock` button's `disabled`/`title` logic.

### WC-05-09 No widget-creation path exists in the UI; the empty project has zero widgets, so all widget-scoped scenarios are non-executable
**Severity: High** · **Failure types: functional gap** · **Confidence: CONFIRMED** · **Scenario: all widget scenarios**

- **Evidence**:
  - Empty project has no widgets/scenes: `createEmptyProject` returns `themeProjectGroups: [createEmptyThemeProjectGroup()]` with `themeProjects: []` (factories.ts:26-35, 18-24); `createEmptyThemeProjectGroup` has `themeProjects: []`.
  - Widget creation only occurs inside `duplicateWidget` (editor-application.ts:83-90, `id: newId("widget")`), reachable solely via `duplicateSelectionInScene`/`duplicateSelection` (editor-application.ts:260-305) — both require an existing widget.
  - No add-widget descriptor: `editorCommandDescriptors` lists only add-theme/rotation/scene, z-order, delete, open-properties (editor-commands.ts:29-39); the Widget menu offers only Duplicate/Delete/Binding Editor (App.tsx:812-816); no `addWidget` exists anywhere in `src/` (grep for `addWidget|createWidget|newId("widget")` returns only `duplicateWidget`).
- **Repro (static)** — Launch the app: the canvas has no widgets and there is no menu/context/toolbar entry to add one. The only additive commands (Add Theme Project → Add Rotation → Add Scene) build empty scenes. Therefore `commitSelectionGeometryField`, the Binding Editor, and all geometry/lock/visibility scenarios (S1-S9) cannot be exercised in the live UI.
- **Expected vs Actual** — Expected: a way to create a widget so the properties/geometry surface is reachable. Actual: widget creation is impossible outside tests, rendering the audited integration surface latent.
- **Recommended fix** — Add a widget-creation command (e.g. `addWidget(sceneId, widgetType)` in `EditorApplication` + a menu/context/toolbar entry) before shipping the properties/geometry features.

### WC-05-10 Scene Priority is rendered as `priority / 10` with no domain constant; Scene `enabled` is read-only and effectively always true
**Severity: Low** · **Failure types: UI misleading state** · **Confidence: CONFIRMED** · **Scenario: scene properties**

- **Evidence**:
  - `PropertyRow label="Priority" value={`${node.scene.priority} / 10`}` (App.tsx:916).
  - Domain `Scene.priority: number` (models.ts:157) has no maximum constant; the only `maxPriority` in the model is `AudioCapabilities.maxPriority?: number` (models.ts:65), unrelated to scene priority. `selectActiveScene` compares priorities by subtraction with no upper bound (runtime.ts:89-90).
  - `PropertyRow label="Enabled" value={String(node.scene.enabled !== false)}` (App.tsx:916); `Scene.enabled?: boolean` (models.ts:158). No UI writes `scene.enabled`, so it is always `undefined !== false` → `true`.
- **Expected vs Actual** — Expected: `"/ 10"` is backed by a domain max, and `enabled` is changeable or not shown as an editable-looking field. Actual: the `/10` denominator is invented UI semantics (priority is an unbounded number), and `Enabled` always reads `true` with no way to change it.
- **Recommended fix** — Remove the invented `/10`, or introduce a domain `SCENE_PRIORITY_MAX` constant and enforce it; either add a scene-enabled toggle or render it as an explicitly read-only derived status.

### WC-05-11 Delete while the Binding Editor modal is open deletes the selected widget and leaves the modal dangling on "Widget/Unknown"
**Severity: Medium** · **Failure types: stale state, lost selection, dangling modal** · **Confidence: CONFIRMED** · **Scenario: S9**

- **Evidence**:
  - The app-shell key handler processes Delete globally: `onKeyDown={handleCanvasKeyDown}` on `.app-shell` (App.tsx:959), and `handleCanvasKeyDown` handles `Delete`/`Backspace` → `deleteSelectionCommand()` (App.tsx:734-737).
  - `isCanvasKeyboardExcludedTarget` excludes only `INPUT`, `TEXTAREA`, `SELECT`, and `contentEditable` (canvas-interaction.ts:95-97) — **buttons are not excluded**. The modal's controls are `<button>`s (App.tsx:988) and the `Open Binding Editor` trigger is also a `<button>` (App.tsx:911).
  - `bindingWidget` recomputes live: `const bindingWidget = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId)?.widget : undefined;` (App.tsx:204), rendered as `{bindingWidget?.name ?? "Widget"}` / `{bindingWidget?.widgetType ?? "Unknown"}` (App.tsx:988). `deleteSelectionCommand` clears selection but not the modal (App.tsx:279-280; no `setBindingModal(null)`).
- **Repro (static)** — Select a widget, click "Open Binding Editor", then press Delete while focus is on a button (the modal's ×, or the trigger button still in the DOM). `deleteSelectionCommand` deletes the selected widget; `bindingModal` remains set, `bindingWidget` becomes `undefined`, and the open modal renders "Widget · Unknown". The modal is not excluded from canvas key handling.
- **Expected vs Actual** — Expected: modal inputs are excluded from canvas key handling, or deletion closes/detaches the modal. Actual: Delete reaches the canvas command while the modal is open, leaving a dangling modal referencing a deleted widget.
- **Recommended fix** — Close `bindingModal` in `deleteSelectionCommand` (or guard Delete when a modal is open); extend `isCanvasKeyboardExcludedTarget` to treat `.settings-backdrop`/dialog content as excluded.

### WC-05-12 Properties header label/detail are captured at select time and can go stale vs canonical
**Severity: Low** · **Failure types: stale state (latent)** · **Confidence: CONFIRMED (latent — no rename/lock UI exists today)** · **Scenario: header**

- **Evidence**:
  - Selection stores `label`/`detail` at select time: `setSelection({ id: node.id, label: node.label, kind, nodeType, detail: node.detail });` (App.tsx:412); detail for widgets is `widget.locked ? "Locked" : widget.visible ? "Visible" : "Hidden"` (App.tsx:102, 410).
  - Header renders the captured snapshot: `<strong>{multi ? ... : selection?.label ?? "Document Properties"}</strong><small>{selection?.detail ?? ...}</small>` (App.tsx:904), and the "Name" row also uses `selection.label` (App.tsx:906) while the `Type` row uses canonical `widget?.widgetType` (App.tsx:906).
- **Repro (static)** — Because there is currently no rename/lock/visibility command (WC-05-08/09), `selection.label`/`detail` cannot diverge from canonical in practice. If a rename/lock command is later wired (e.g. via `editWidgetProperties`), the header and Name row would keep the stale captured name while other rows (which read `widget` canonical) update.
- **Expected vs Actual** — Expected: header/Name reflect canonical `widget.name` live like the other rows. Actual: they reflect a select-time snapshot, which is currently harmless but becomes stale the moment any property-mutating command is added.
- **Recommended fix** — Derive the header/Name from `resolvedSelection`/`widget` (canonical) instead of the `selection` snapshot, or refresh `selection` on every store change.

### WC-05-13 Multi-select `valueFor` is safe for real nodes, but the "Resources"/"Unsupported Files" pseudo-nodes select into an empty properties state
**Severity: Low** · **Failure types: UI misleading state** · **Confidence: CONFIRMED** · **Scenario: multi/asset selection**

- **Evidence**:
  - `valueFor` maps `selectedCanonical = selectedIds.map((id) => resolveCanonicalNode(project, id)).filter(Boolean)` (App.tsx:892) and filters `undefined` getters (App.tsx:894). All `ResolvedNode` variants carry a node with `.id`: `Project` (models.ts:207), `ThemeProjectGroup` (192), `ThemeProject` (182), `Rotation` (163), `Scene` (153), `Widget` (135), `Asset` (198). So `current.node.id` (App.tsx:906) and `"name" in current.node` (App.tsx:906) are safe; asset selection does not crash.
  - The pseudo-nodes `{ id: "resources", ... }` and `{ id: "unsupported", ... }` (App.tsx:459-460) are not canonical nodes: `resolveCanonicalNode(project, "resources")` returns `undefined` (App.tsx:118-136). Selecting one sets `selection` but `resolvedSelection` (App.tsx:199) is `undefined`, so Properties renders the empty state `"Select a canonical item to inspect"` (App.tsx:921) even though a tree row is highlighted.
- **Expected vs Actual** — Expected: selecting a non-canonical aggregate either selects nothing or shows a coherent aggregate view. Actual: the row highlights as selected while Properties claims nothing is selected.
- **Recommended fix** — Make `Resources`/`Unsupported Files` rows non-selectable (`disabled`) or render an aggregate properties view for them.

---

## Invariant check table

Legend: PASS (consistent), FAIL (violates), N/A (not applicable/unreachable). "Reachable?" reflects whether the scenario can occur in the shipped UI (all widget scenarios require WC-05-09 to be fixed first).

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| Edit X/Y/W/H via inputs (reachable?) | PASS (single command via store) | PASS | PASS (`useSyncExternalStore` 144-147 → render 770-776) | FAIL (per-keystroke, WC-05-04) | PASS (isDirty via serialize, document-store.ts:125) | PASS | PASS | PASS | PASS |
| Undo → redo property edit | PASS (commands.ts:40-59) | PASS | PASS (re-render from store) | PASS | PASS | PASS | PASS | PASS | PASS |
| Clear field (empty string) | FAIL (commits 0/10, WC-05-01) | PASS | PASS (reflects 0/10) | FAIL (spurious entry) | PASS | PASS | PASS | PASS | FAIL (input shows 0/10 not prior) |
| Type `abc` (non-numeric) | PASS (rejected) | PASS | FAIL (no snap-back, WC-05-01) | PASS (no entry) | PASS | PASS | PASS | PASS | FAIL (field shows raw/bad input) |
| Multi-select geometry edit | N/A (blocked) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | N/A (inputs disabled, WC-05-05) |
| Locked widget edit | PASS (blocked at input/commit/core) | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS (WC-05-07) |
| Cross-scene edit | PASS (guard blocks) | FAIL (guard unreachable; silent paths clear selection, WC-05-06) | FAIL (cross-scene widget not shown) | FAIL (silent partial mutation) | PASS | PASS (follows primary) | PASS | FAIL (cross-scene id highlighted) | FAIL |
| Property edit during drag | N/A (inputs disabled `mode !== "idle"`) | PASS | PASS | N/A | N/A | N/A | N/A | N/A | N/A |
| Delete while Binding Editor open | PASS (widget deleted) | FAIL (cleared but modal stays, WC-05-11) | PASS | PASS | PASS | PASS | PASS | FAIL | FAIL (modal "Widget/Unknown") |
| Scene Priority/Enabled view | PASS (read-only) | PASS | N/A | N/A | N/A | PASS | PASS | PASS | FAIL (`/10` invented; Enabled always true, WC-05-10) |

---

## Summary (counts by severity)

- **High: 3** — WC-05-06, WC-05-08, WC-05-09
- **Medium: 4** — WC-05-01, WC-05-03, WC-05-04, WC-05-11
- **Low: 6** — WC-05-02, WC-05-05, WC-05-07, WC-05-10, WC-05-12, WC-05-13
- **Total: 13 findings** (all CONFIRMED statically except the browser `badInput` rendering detail of WC-05-01, noted UNVERIFIED)
