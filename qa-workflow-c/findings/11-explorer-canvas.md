# Agent 11 — Explorer / Canvas Integration

**Repo:** `C:\Users\b1601\Template_Designer` (Windows) · **Baseline:** typecheck passes; vitest 51/51 (6 test files). All findings below are **static (CONFIRMED)** from source; no live UI run is available, so nothing is claimed as click-verified.

## Scope & scenarios traced

| # | Scenario | Executable in UI? | Verdict |
|---|---|---|---|
| S1 | Hide → canvas hit test → explorer select → show → interact | **No** | No visible/enabled toggle UI exists; no widget-creation path exists in a fresh project (WC-11-01, WC-11-02) |
| S2 | Lock → drag → resize → keyboard | **No** | Lock button permanently disabled; no path sets `locked` from UI (WC-11-02). Underlying guards traced (WC-11-03) |
| S3 | Select → duplicate → move duplicate → undo → redo | **Partial** | Duplicate works via context bar/menu if widgets exist, but copy is not selected and stacks overlaps (WC-11-05) |
| S4 | Delete → undo → redo | **Partial** | Works single-scene; cross-scene selection silently partial (WC-11-04) |
| S5 | Duplicate ×3 overlap | **Yes (statically proven)** | Each copy is +10/+10 from the *original*, not the prior copy (WC-11-05) |
| S6 | Explorer-select widget in non-active scene → context bar / z-order / delete | **Partial** | Selection switches active scene; cross-scene multi-select silently dropped (WC-11-04) |

**Root precondition:** `createEmptyProject()` (factories.ts:26-35) returns a project with `themeProjects: []` (factories.ts:22) — zero themes/rotations/scenes/widgets. `EditorApplication` exposes **no `addWidget`** (methods at editor-application.ts:141/148/157/207/253 only). The only UI mutation commands are Add Theme Project / Add Rotation / Add Scene (App.tsx:802-811). "Open Project" is permanently disabled (App.tsx:781). A fresh session therefore can never materialise a single widget through the UI, so every widget-level scenario below (S1–S6) is unreachable in the shipped shell. (Widget-creation ownership likely belongs to the editor-core agent; this is recorded here because it is the enabling precondition for this audit.)

## Findings

### WC-11-01 — No UI path exists to create a widget, so the entire widget canvas surface is unreachable  (High · functional gap · CONFIRMED)

- **Scenario:** S1–S6 (precondition).
- **Repro:** New Project → observe empty Explorer (project → group → Resources/Unsupported only) → no command adds a Widget; Widget menu offers only Duplicate/Delete/Binding Editor.
- **Evidence:**
  - `src/Core/editor-application.ts:141/148/157/207/253` — public mutators are `addThemeProject`, `addRotation`, `addScene`, `editWidgetProperties`, `setWidgetZIndicesInScene`; grep for `addWidget|createWidget|Add Widget` across `src/` returns only `widgets: []` inside `addScene` (editor-application.ts:160).
  - `src/Domain/factories.ts:22` — `themeProjects: []`; `factories.ts:26-35` — `createEmptyProject` builds no widgets.
  - `src/App/App.tsx:781` — `{ label: "Open Project", disabled: true }`.
- **Expected vs Actual:** Expected a widget-insertion command (or import path) so duplicate/delete/lock/hide/z-order/hit-test have objects to act on. Actual: no creation path; widget interactions are only exercised by tests that hand-build `Widget[]` fixtures (tests/editor-pipeline.test.ts:12-25).
- **Recommended fix:** Add a canonical `addWidget(sceneId, ...)` mutation + a Widget-menu/context-menu command and a palette/drag source; wire a real Open Project (or seed fixtures) so widgets can exist at runtime.

### WC-11-02 — Visibility / Enabled / Locked have NO UI control; Lock button is permanently disabled with a misleading title  (High · functional gap + UI misleading state · CONFIRMED)

- **Scenario:** S1 (hide/show), S2 (lock).
- **Repro:** Select a widget (if one exists) → open context bar → Lock is disabled and reads "Requires a selected widget" even with a widget selected; Properties shows "Visible"/"Enabled"/"Geometry Lock"/"Locked"/"Visible" as plain text with no inputs.
- **Evidence:**
  - `src/App/App.tsx:975` — `<button ... className="context-action" disabled title="Requires a selected widget">Lock</button>` (no `onClick`, `disabled` unconditional). Align is the same shape (`disabled title="Requires a selected widget">Align`).
  - `src/App/App.tsx:909-910` — `PropertyRow label="Visible"/"Enabled"/"Geometry Lock"/"Locked"` render `<strong>` text only (PropertyRow at 109-116 has no input); the only editable Geometry/Layer inputs are X/Y/W/H, all `disabled={... || widget.locked}`.
  - `src/Core/editor-application.ts:207-218` — `editWidgetProperties` is the *only* mutation able to change `visible/enabled/locked`; grep shows it is called **only from tests** (`tests/editor-pipeline.test.ts:170,323`), never from `App.tsx`.
  - `src/Domain/models.ts:139-141` — `enabled/visible/locked` exist on `Widget` but are factory defaults `true/true/false` (tests/editor-pipeline.test.ts:16-20) and never mutated in app code (grep for `.visible =`, `.enabled =`, `.locked =`, `setVisible/…` in `src/` → no matches).
- **Expected vs Actual:** Expected visible/enabled/locked toggles (checkbox/switch or a working Lock/Show-Hide command). Actual: all three flags are frozen at their factory defaults for any widget; the Lock button's tooltip is hardcoded and misleads even when a widget is selected.
- **Recommended fix:** Surface `editWidgetProperties` (or dedicated `setWidgetVisible/setWidgetEnabled/setWidgetLocked` commands) through Properties toggles and a context-bar Lock button whose `disabled`/title reflects `selectedWidgetIds.length`; add a "Show/Hide" action.

### WC-11-03 — Locked guard is asymmetric: geometry mutations are blocked but z-order (presented under "Geometry / Layer") bypasses the lock  (Medium · UI misleading state / command mismatch · CONFIRMED)

- **Scenario:** S2 (lock), S6 (z-order on locked widget).
- **Repro (once a lock path exists):** Lock a widget → drag/resize/nudge/geometry fields blocked → right-click "Bring Forward" → succeeds, moving the locked widget's zIndex.
- **Evidence:**
  - Locked is respected by: `setWidgetGeometries` (`editor-application.ts:193`) and `setWidgetGeometriesInScene` (`:203`) `return geometry && !widget.locked ? { ...widget, geometry: clone(geometry) } : widget;`; `editWidgetProperties` drops geometry for locked (`:214-215` `const { geometry, ...editablePatch } = clone(patch); return { ...widget, ...editablePatch, ...(widget.locked || geometry === undefined ? {} : { geometry }) };`); drag warn `App.tsx:583-588`; resize warn `App.tsx:599-602`; nudge excludes locked via `selectedEditableWidgets` (`App.tsx:485,744`); resize handles hidden (`App.tsx:775` `!widget.locked && handles.map(...)`); properties inputs disabled (`App.tsx:910`).
  - Locked is **NOT** respected by z-order: `calculateZOrderUpdates` (`canvas-interaction.ts:52-71`) has no `locked` check; `changeWidgetZOrder` (`App.tsx:295-303`) has no `locked` check; `setWidgetZIndicesInScene` (`editor-application.ts:253-258`) applies `zIndex` to any widget with no `locked` guard.
  - Z-order is rendered under the "Geometry / Layer" section (`App.tsx:910` `PropertyRow label="Z-order"`), i.e. the same grouping the lock is meant to protect.
- **Expected vs Actual:** "Geometry Lock" (labelled at `App.tsx:909`) should freeze the entire "Geometry / Layer" section. Actual: `zIndex` (a layer property) mutates freely on a locked widget while x/y/w/h are blocked — an inconsistent interpretation of the lock. (Selection box still draws for locked widgets: `App.tsx:765-766` filters only by `selectedWidgetIds`, not `locked`; the box's resize handles correctly disappear because `selectedEditableWidgets.length` excludes locked.)
- **Recommended fix:** Decide whether "Lock" means geometry-only or geometry+layer; if geometry+layer, add a `locked` guard to `calculateZOrderUpdates`/`changeWidgetZOrder` and `setWidgetZIndicesInScene`, mirroring `setWidgetGeometriesInScene`.

### WC-11-04 — Cross-scene widget selection is silently dropped by delete/duplicate/z-order, while the geometry field warns; UI still reports "N items selected"  (High · state divergence / lost selection / cross-Scene leakage · CONFIRMED)

- **Scenario:** S4, S6.
- **Repro:** Shift-click a widget in Scene A, then Shift-click a widget in Scene B (both become `selectedIds`). Status bar reads "2 items selected" (`App.tsx:197`). Press Delete or Duplicate → only the Scene-B widget is affected; the Scene-A widget silently survives and selection is cleared.
- **Evidence:**
  - `src/App/App.tsx:484` — `selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((w) => w.id === id))` where `canvasWidgets = activeScene?.widgets` (`:466`); cross-scene ids are therefore excluded.
  - `src/App/App.tsx:274-277` — delete: `widgetSelection = selectedIds.every(...kind === "widget")` → true for two widgets, so it routes to `deleteSelectionInScene(activeScene.id, selectedWidgetIds)` (active-scene subset only). `:279-280` then `setSelection(null); setSelectedIds([])`.
  - `src/App/App.tsx:287-290` — duplicate: same `widgetSelection` gate → `duplicateSelectionInScene(activeScene.id, selectedWidgetIds)`.
  - `src/App/App.tsx:295-303` — z-order: `const node = resolvedSelection; if (!node?.widget || !node.scene || activeScene?.id !== node.scene.id) return false;` — operates on the single `resolvedSelection` widget, silently ignoring other selected widgets from other scenes (no log/warn).
  - Contrast with the geometry field, which *does* warn: `App.tsx:867-873` — `selectedScenes.some(c => c !== sceneId) || sceneId !== activeScene?.id` → `logAction("Geometry edit blocked: selection is not scoped to active Scene", "WARN")`.
  - Asymmetry: mixed-kind selection (widget + scene) routes to global `deleteSelection(selectedIds)` (App.tsx:277) which deletes across all scenes (editor-application.ts:220-244), so all-widget-cross-scene is scoped but mixed-kind is global — inconsistent behavior for the same "N items selected".
- **Expected vs Actual:** Expected delete/duplicate to affect the whole selection or block with a warning like the geometry field. Actual: silent partial mutation (single active-scene subset), with the "2 items selected" label contradicting the result; after delete the survivor is unselected and the canvas flips back to it (because `activeScene` derives from `resolvedSelection ?? runtime.activeScene`, `App.tsx:465`).
- **Recommended fix:** Reject multi-scene destructive/duplicate/z-order commands with a warning (mirroring `commitSelectionGeometryField`), or make the commands operate on every selected scene explicitly; never let `selectedIds.length` disagree with the ids actually being mutated.

### WC-11-05 — Duplicate keeps selection on the original and stacks every copy at the SAME +10/+10 offset → N exact overlaps  (High · lost selection / stale preview · CONFIRMED)

- **Scenario:** S3, S5.
- **Repro:** Select widget at (x,y) → Duplicate → copy appears at (x+10,y+10) but the original stays selected → Duplicate again → a second copy lands at the *same* (x+10,y+10), stacked under the first. Move one copy and the rest are revealed underneath.
- **Evidence:**
  - `src/Core/editor-application.ts:83-90` — `duplicateWidget` computes `geometry: { ...widget.geometry, x: widget.geometry.x + 10, y: widget.geometry.y + 10 }` from the passed (original) widget; it also `clone`s the widget, so `locked/visible/enabled` flags are copied.
  - `src/Core/editor-application.ts:260-265` — `duplicateSelectionInScene` appends `[widget, duplicateWidget(widget)]` for each selected id — the original geometry is always the source.
  - `src/App/App.tsx:285-293` — `duplicateSelectionCommand` calls the editor but never calls `setSelection`/`setSelectedIds`, so selection remains on the original; every subsequent Duplicate re-duplicates the original.
  - Test confirms the +10-from-original geometry: `tests/editor-pipeline.test.ts:190` expects `{ x: 20, y: 20, ... }` for an original at `x:10,y:10`, and the duplicate is **not** re-selected (no selection assertion, and selection is React state outside the document).
- **Expected vs Actual:** Expected each duplicate to offset from the previous copy (or to select the new copy for iterative duplication). Actual: N duplicates overlap exactly at original+10; the copy is never selected, so the user can't nudge the new copy without first re-selecting it.
- **Recommended fix:** After duplicating, move selection to the new ids and/or cascade the offset (original + 10·k); at minimum select the copies so the user sees which object is the fresh copy.

### WC-11-06 — Hidden widgets remain keyboard-selectable (tabIndex/Enter) and Ctrl+A selects hidden/disabled widgets, contradicting pointer/hit-test exclusion  (Medium · UI misleading state / stale preview · CONFIRMED)

- **Scenario:** S1 (hide → interaction).
- **Repro:** A `visible=false` widget is excluded from click (CSS `pointer-events:none`), marquee and hit-test, yet Tab focuses it and Enter/Space selects it; Ctrl+A selects it too.
- **Evidence:**
  - `src/App/App.tsx:775` — `renderCanvasWidget` renders every widget with `role="button" tabIndex={0}` and `onKeyDown` (`Enter`/`Space` → `selectNode(...)`), with **no** `visible`/`enabled` filter and no `aria-hidden`.
  - `src/App/app.css:296` — `.canvas-widget.is-invisible { ... pointer-events: none; }` blocks pointer, not keyboard focus.
  - `src/App/canvas-interaction.ts:279` — `marqueeSelection` filters `widget.visible && widget.enabled`; `:287` — `hitTest` filters `widget.visible && widget.enabled`.
  - `src/App/App.tsx:728` — Ctrl+A `setSelectedIds(orderSelectionIds(canvasWidgets, canvasWidgets.map(w => w.id)))` with **no** `visible && enabled` filter, so hidden/disabled widgets enter the selection.
- **Expected vs Actual:** Expected a hidden widget to be unreachable by every selection mechanism (pointer, keyboard, select-all, marquee). Actual: three of four mechanisms exclude it, but keyboard focus/Enter and Ctrl+A still select it, so a "hidden" widget can silently re-enter the active selection and be nudge/drag targets (drag uses `selectedWidgetIds` + editable filter at 583/599 which does not check `visible`).
- **Recommended fix:** Render hidden widgets as `aria-hidden` + `tabIndex={-1}` (or skip them entirely in design mode, optionally showing a ghost layer), and make Ctrl+A/marquee/nudge share one `visible && enabled` predicate.

### WC-11-07 — `hitTest` is dead code; the "canvas hit test" path does not exist  (Low · command mismatch · CONFIRMED)

- **Scenario:** S1 (hit-test step).
- **Evidence:**
  - `src/App/canvas-interaction.ts:284-290` — `hitTest` is exported; grep across `src/` shows only its definition, no import. `App.tsx`'s import list (`App.tsx:9`) includes `marqueeSelection` but not `hitTest`.
  - Actual canvas selection is DOM-event driven: `beginWidgetMove` (`App.tsx:578`) on widget `onPointerDown`, and `marqueeSelection` for rubber-band (`App.tsx:668`).
- **Expected vs Actual:** The mission's "hide → canvas hit test" assumes a hit-test-based acquisition step; actual acquisition is direct DOM events, so `hitTest` (and its `visible && enabled` filter) is only exercised by unit tests (canvas-interaction.test.ts:85-94,231-238), not by the app.
- **Recommended fix:** Either wire `hitTest` into a pointer-down hit-acquisition path (so hidden/disabled exclusion is enforced at the single choke point) or remove it and document that exclusion lives in DOM/CSS + marquee only.

### WC-11-08 — Explorer pseudo-nodes "Resources"/"Unsupported Files" are selectable but resolve to nothing → tree highlights while Properties shows the empty state; no `disabled` node ever exists  (Medium · UI misleading state · CONFIRMED)

- **Scenario:** Explorer selection (S6 context).
- **Repro:** Click "Resources" (or "Unsupported Files") → tree row gets `.is-selected` highlight and the status bar shows it as the selection, but the Properties panel shows "Select a canonical item to inspect".
- **Evidence:**
  - `src/App/App.tsx:459-460` — pseudo-nodes `{ id: "resources", ... }` and `{ id: "unsupported", ... }` have **no** `disabled` property, so they are selectable.
  - `src/App/App.tsx:398` — `if (node.disabled) return;` early-return is dead code: `getThemeNodes` (`:82-108`) and `projectTree` (`:446-462`) never set `disabled` on any node.
  - `src/App/App.tsx:399-401` — `resolveCanonicalNode(project, "resources")` returns `undefined` (no matching asset, `resolveCanonicalNode` `:134-135`); `kind` is then mapped to `"asset"` via `normalizedKind.includes("resource") || ...includes("unsupported")` (`:401`) with no backing node.
  - `src/App/App.tsx:905` — `{selection && node ? ... : <div className="properties-empty">...}` — since `node` is `undefined`, the panel renders the empty state (`:921`) despite `selection` being non-null; the row highlight comes from `:428` `selectedIds.includes(node.id)`.
- **Expected vs Actual:** Expected these summary nodes to be non-selectable (or resolve to a real project-scope view). Actual: selectable with a highlighted row, a fake `"asset"` kind, an empty inspector, and (on right-click) a `"canvas"`-fallback context menu (`App.tsx:432`) that yields "No commands for this selection" — a triple inconsistency.
- **Recommended fix:** Mark pseudo-nodes `disabled` (so `:398`/`:436` actually fire) or make them expand-only grouping rows that never enter `selectedIds`/`selection`.

### WC-11-09 — Rotation document-tab identity collapses: label is `R{angle}` and every added rotation is angle 0 → all "R0" merge into one tab; close removes by label  (Medium · UI misleading state / lost selection · CONFIRMED)

- **Scenario:** Explorer selection (S6 context).
- **Repro:** Add Rotation twice (both `angle: 0`) → select each → both activate the single "R0" tab; closing "R0" closes the only tab and loses the association for both rotations.
- **Evidence:**
  - `src/App/App.tsx:89` — rotation node `label: \`R${rotation.angle}\`` (not the unique rotation id); `addRotation` always passes `0` (`App.tsx:259` `editorApplication.addRotation(themeId, 0, activeProfile.display)`), and `addRotation` defaults to `0` (`editor-application.ts:148`).
  - `src/App/App.tsx:414` — `if (kind === "theme" || kind === "rotation") openDocument(node.label)`; `openDocument` dedupes by label (`:383-387` `current.includes(label) ? current : [...]`), and `closeDocument` removes **all** entries with that label (`:389-395` `filter((document) => document !== label)`).
  - Theme nodes share the same flaw: label = `theme.name` (`App.tsx:85`), default `"New Theme Project"` (`editor-application.ts:141`).
- **Expected vs Actual:** Expected tabs keyed by stable node id with a unique label. Actual: document tabs are label-keyed, and two distinct rotations/scenes with identical labels collapse into one tab; closing it affects both.
- **Recommended fix:** Key document tabs by node id (and use a disambiguated label), and have `openDocument`/`closeDocument` operate on ids rather than `label`.

### WC-11-10 — Explorer "Expand" button is a no-op (worse: collapses deeper nodes) because it writes stale keys "project"/"theme-group" that never match real ids  (Medium · UI misleading state · CONFIRMED)

- **Scenario:** Explorer expand state (S6 context).
- **Repro:** Expand some themes/rotations manually via the caret, then click "Expand" → all deeper nodes collapse; "Expand" never expands anything.
- **Evidence:**
  - `src/App/App.tsx:844` — `Expand` sets `setExpandedNodes({ project: true, "theme-group": true })`; `Collapse` sets `{}`.
  - `src/App/App.tsx:164` — initial state is also `{ project: true, "theme-group": true }`.
  - Actual node ids are `"project-foundation"` / `"theme-group-foundation"` (`src/Domain/factories.ts:20,28`); `renderTreeNode` reads `expandedNodes[node.id] ?? depth < 2` (`App.tsx:427`), so the top two levels are always expanded via the `depth < 2` fallback regardless of the stale keys.
- **Expected vs Actual:** Expected "Expand" to expand the tree and "Collapse" to collapse it. Actual: "Expand" writes keys that match no node, so it is a no-op for the top levels and collapses every depth≥2 node (identical to "Collapse").
- **Recommended fix:** Use the real node ids (project/group) or implement "Expand" as expanding all descendants, and drive both buttons off `expandedNodes` keyed by actual node id.

### WC-11-11 — New Project does not reset `expandedNodes`, and fixed foundation ids make expansion state persist across projects  (Low · stale state · CONFIRMED)

- **Scenario:** Explorer expand state (S6 context).
- **Repro:** Collapse the group, then New Project → the new (empty) project's group is still collapsed.
- **Evidence:**
  - `src/App/App.tsx:230-241` — `createProject` resets `selection/selectedIds/viewMode/openDocuments/activeDocument` and geometry preview but **not** `expandedNodes`.
  - `src/Domain/factories.ts:20,28` — `createEmptyProject`/`createEmptyThemeProjectGroup` reuse constant ids `"theme-group-foundation"` and `"project-foundation"`, so the persisted `expandedNodes` keys collide across projects (deeper theme/rotation/scene ids are uuid-per-`add*`, so only the top two levels are affected).
- **Expected vs Actual:** Expected New Project to present a fully expanded default tree. Actual: top-level expansion state leaks across documents.
- **Recommended fix:** Reset `expandedNodes` to `{ project: true, "theme-group": true }` (or the real ids) inside `createProject`.

### WC-11-12 — Z-order tie-break leapfrogs siblings: with ≥3 equal zIndex, `bring-forward`/`send-backward` jump past all tied siblings, not just the adjacent one  (Low · command mismatch · CONFIRMED)

- **Scenario:** S6 (z-order on equal zIndex).
- **Repro:** Three widgets with equal `zIndex` in one scene → Bring Forward on the first → it jumps above both tied siblings (zIndex+1) rather than swapping with the single adjacent sibling.
- **Evidence:**
  - `src/App/canvas-interaction.ts:52-71` — for equal zIndex the function returns `{ [widgetId]: target.zIndex + (bring-forward ? 1 : -1) }` (`:69`) without touching the neighbor; distinct-zIndex case correctly swaps (`:70`). For a 3-way tie, +1 places the target strictly above *both* remaining tied siblings.
  - Distinct-zIndex correctness is test-covered (`tests/canvas-interaction.test.ts:249-259`), but the 3-way-tie case is not.
- **Expected vs Actual:** Expected "bring forward" to advance exactly one document-order position. Actual: with ties it advances above all tied siblings at once.
- **Recommended fix:** Compute the new zIndex by swapping with the adjacent entry (reindex the tie group) or assign fractional/tie-broken zIndices so each operation moves exactly one position.

## Invariant check table

Legend: ✅ consistent · ⚠️ diverges · ➖ not applicable (scenario not executable).

| Scenario | Document | Selection | Canvas preview | History (undo/redo) | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 hide→hit→select→show→interact | ➖ (no toggle) | ➖ | ⚠️ ghost renders (WC-11-06) | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| S2 lock→drag→resize→keyboard | ➖ (no lock path) | ➖ | ✅ box drawn, handles hidden (WC-11-03) | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| S3 select→duplicate→move→undo→redo | ✅ (single-scene) | ⚠️ copy not selected (WC-11-05) | ⚠️ overlap, copy hidden under original | ✅ | ✅ | ✅ | ➖ | ⚠️ stays on original | ⚠️ shows original |
| S4 delete→undo→redo (cross-scene) | ⚠️ partial delete (WC-11-04) | ⚠️ cleared, survivor lost | ⚠️ flips back to survivor's scene | ✅ (single partial cmd) | ✅ | ⚠️ re-derives after clear | ➖ | ⚠️ cleared | ⚠️ cleared |
| S5 duplicate×3 overlap | ⚠️ 3 identical-position copies | ⚠️ original only | ⚠️ exact overlap | ✅ | ✅ | ✅ | ➖ | ⚠️ | ⚠️ |
| S6 explorer-select widget in non-active scene → bar/z-order/delete | ⚠️ cross-scene subset only (WC-11-04) | ⚠️ "N items" ≠ mutated (WC-11-04) | ⚠️ shows active-scene subset | ✅ | ✅ | ✅ switches to selected scene | ⚠️ rotation tabs collapse (WC-11-09) | ⚠️ highlight vs empty props (WC-11-08) | ⚠️ empty panel (WC-11-08) |

## Summary

**Counts by severity:** High 4 · Medium 5 · Low 3 (12 findings).

**Top findings (one-liners):**
- **WC-11-01 (High):** No widget-creation path (no `addWidget`, "Open Project" disabled) — the entire widget canvas surface is unreachable in a fresh project.
- **WC-11-02 (High):** No UI exists to change `visible/enabled/locked`; the context-bar Lock button is hardcoded `disabled` with a misleading title, and `editWidgetProperties` is never called from the UI.
- **WC-11-04 (High):** Cross-scene widget selection is silently dropped by Delete/Duplicate/z-order (status shows "N items" but only the active-scene subset mutates) while the geometry field correctly warns.
- **WC-11-05 (High):** Duplicate keeps selection on the original and offsets every copy +10/+10 from the original, so repeated duplicates stack in exact overlap.
- **WC-11-03 (Medium):** Locked guards block geometry (drag/resize/nudge/fields) but z-order ("Geometry / Layer") bypasses the lock — a lock-semantics inconsistency.
