# Agent 02 — Scene Lifecycle Integration

- **Repo:** `C:\Users\b1601\Template_Designer` (Windows)
- **Audit mode:** read-only; static inspection of `src/App/App.tsx`, `src/Core/editor-application.ts`, `src/Core/runtime.ts`, `src/Core/document-store.ts`, `src/Core/commands.ts`, `src/Domain/models.ts`, `src/Domain/factories.ts`, `src/App/canvas-interaction.ts`, `src/App/editor-commands.ts`, `src/App/editor-types.ts`.
- **Baseline verified:** `& npm.cmd run typecheck` → no diagnostics (PASS). `& npm.cmd test` → 6 files, **51/51** tests PASS. (The `[exit code: 1]` on the test run is PowerShell `NativeCommandError` noise from npm's stderr `notice` lines, not a test failure — the vitest summary reports 51 passed.)
- **No browser/Tauri run available:** every UI-behavior statement below is statically proven from code; items that require a live click are explicitly marked UNVERIFIED.

## Scope & scenarios traced

| # | Scenario | Trace result |
|---|---|---|
| S1 | Scene A select → modify → Scene B → select → Scene A | Identical (immutable doc replacement + cleared preview). PASS |
| S2 | Select scene A, then simulator activates scene B | Divergence: canvas pinned to A, simulator shows B. **WC-02-01** |
| S3 | Add scene → undo → redo | Deterministic ids; new scene becomes runtime-active. **WC-02-03** |
| S4 | Duplicate scene → edit copy → undo → redo | Deterministic (copy ids captured once). PASS |
| S5 | Delete active scene | Selection cleared, canvas context jumps. **WC-02-04** |
| S6 | Move scene order (Core `moveScene`) | Core-only, not wired to UI; index affects tie-break. **WC-02-03** |
| S7 | Runtime values changed in scene A persist into scene B | By design (device-global `RuntimeContext`); see note. |
| S8 | Additive cross-scene selection → delete/duplicate | Cross-scene mutation. **WC-02-02** / **WC-02-05** |

## Active-scene derivation (single source of truth for this audit)

```ts
// App.tsx:464-465
const activeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];
// App.tsx:466
const canvasWidgets = activeScene?.widgets ?? [];
```

Priority order: **explorer/canvas-selected scene** → **simulator runtime-active scene** → **first scene of active rotation**. The simulator scene itself is computed at `App.tsx:202` via `selectActiveScene(runtimeRotation?.scenes ?? [], runtimeContext, activeProfile)` with `runtimeContext = { values: runtimeValues, settings: runtimeSettings, sceneActivationOrder: {} }` (`App.tsx:201`).

**Consumers of the `activeScene` variable** (enumerated): canvas widgets `466`; delete `276`; duplicate `289`; z-order guard `297`; explorer selection ordering `403`; geometry commit (pointer-up) `697`; nudge commit `745`; interaction-reset effect `758`; properties geometry scoping `870`. **Consumers of `runtime.activeScene`**: simulator Active-Scene card `932`; the `activeScene` fallback `465`; the (unused) `activeBindings` memo `203`.

---

## Findings

### WC-02-01 Preview canvas diverges from the simulator's active scene while any scene/widget is selected
**Severity:** High · **Failure types:** state divergence, stale preview, UI misleading state
**Confidence:** CONFIRMED (statically proven)
**Scenario:** S2 (select scene A, then simulator activates scene B)

**Repro steps:**
1. Select scene A (or any widget) in the Explorer → `selection` = A → `resolvedSelection.scene` = A.
2. Change runtime states/settings in the Simulator so `selectActiveScene` resolves scene B as active.
3. Switch view mode to **Preview** (canvas label becomes `RUNTIME PREVIEW` at `App.tsx:974`).

**Evidence:**
```ts
// App.tsx:465
const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];
// App.tsx:466
const canvasWidgets = activeScene?.widgets ?? [];
// App.tsx:932 (Simulator panel) shows runtime.activeScene, NOT activeScene
<strong>{runtime.activeScene?.name ?? "No active Scene"}</strong>
```
Because `resolvedSelection.scene` has top priority, the moment a scene/widget is selected the canvas is **pinned** to that scene and ignores `runtime.activeScene`. The Simulator panel reads `runtime.activeScene` directly, so the two surfaces can show **two different scenes simultaneously**.

**Expected vs Actual:**
- Expected: in Preview mode the canvas renders the runtime-active scene (`runtime.activeScene`), matching the Simulator card.
- Actual: canvas renders `resolvedSelection.scene` (editor selection), while the Simulator card shows `runtime.activeScene`; and edits to runtime inputs stop moving the canvas entirely once a selection exists.

**Recommended fix (design-level):** Make `viewMode` part of the derivation — in `preview` mode the canvas widget source should be `runtime.activeScene ?? activeScene`, or derive a distinct `canvasScene = viewMode === "preview" ? runtime.activeScene : (resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0])`. At minimum, the Simulator card and canvas must read the same scene identifier so "RUNTIME PREVIEW" cannot contradict the Active Scene card.

---

### WC-02-02 Mixed-kind additive selection (widget + scene/rotation/theme) routes to global delete/duplicate and mutates widgets outside the active scene
**Severity:** High · **Failure types:** cross-Scene mutation, lost selection, stale state
**Confidence:** CONFIRMED (statically proven)
**Scenario:** S8 (Ctrl/Shift-click a widget in scene A + a scene in scene B, then Delete/Duplicate)

**Repro steps:**
1. In scene A, select widget `A1` (selectedIds = `["A1"]`).
2. Ctrl/Shift-click scene B node in the Explorer → additive `selectNode` produces `selectedIds = ["A1", "B"]` (`App.tsx:403` via `selectIds` from `canvas-interaction.ts:248-251`).
3. Press Delete.

**Evidence:**
```ts
// App.tsx:272-283
const deleteSelectionCommand = (): boolean => {
  if (!selectedIds.length) return false;
  const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
  const result = widgetSelection
    ? activeScene?.id ? editorApplication.deleteSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
    : editorApplication.deleteSelection(selectedIds);   // ← global, unfiltered
  ...
};
```
```ts
// editor-application.ts:220-244 (deleteSelection) filters ANY matching id at every level
themeProjectGroups: project.themeProjectGroups
  .filter((group) => !selected.has(group.id)) ...
  scenes: rotation.scenes
    .filter((scene) => !selected.has(scene.id))
    .map((scene) => ({ ...scene, widgets: scene.widgets.filter((widget) => !selected.has(widget.id)) })),
```
`widgetSelection` is `false` for the mixed list `["A1","B"]`, so the command calls the **global** `deleteSelection(selectedIds)`, which deletes **both** widget `A1` (in scene A) **and** scene B. The same pattern exists in `duplicateSelectionCommand` (`App.tsx:285-293`) → `duplicateSelection(selectedIds)` (`editor-application.ts:267-305`) which duplicates both. The widget-only branch correctly uses the scene-scoped `selectedWidgetIds` (filtered at `App.tsx:484`), but the non-widget branch uses the **unfiltered** `selectedIds`, so any lingering widget id from another scene is mutated in its own scene.

**Expected vs Actual:**
- Expected: delete/duplicate affects only the active scene's selection, or refuses mixed-kind/mixed-scene selections.
- Actual: a mixed-kind selection deletes/duplicates entities across multiple scenes — silent cross-scene data loss/duplication.

**Recommended fix (design-level):** Reject or normalize mixed-kind selection before routing. Route the widget branch only when `selectedIds` contains *only* widgets and *only* widgets of `activeScene`; otherwise block with a warning (mirror the guard already used by `commitSelectionGeometryField` at `App.tsx:870`). Never pass unfiltered `selectedIds` to the global `deleteSelection`/`duplicateSelection` from a scene-scoped UI command.

---

### WC-02-03 `sceneActivationOrder` is hardcoded `{}`; equal-priority scenes resolve by array index (last wins), not by real activation order
**Severity:** Medium · **Failure types:** state divergence, UI misleading state, command mismatch
**Confidence:** CONFIRMED (statically proven)
**Scenario:** S3, S6

**Evidence:**
```ts
// App.tsx:201
const runtimeContext: RuntimeContext = { values: runtimeValues, settings: runtimeSettings, sceneActivationOrder: {} };
// runtime.ts:81 (activationOrder falls back to array index)
activationOrder: context.sceneActivationOrder?.[scene.id] ?? index,
// runtime.ts:89-90 (descending: higher index wins ties)
.sort((left, right) => right.priority - left.priority || right.activationOrder - left.activationOrder),
// models.ts:221 documents the intended semantic
/** Larger sequence means the Scene became active later at runtime. */
sceneActivationOrder?: Readonly<Record<Id, number>>;
```
`addScene` creates scenes with `priority: 0` (`editor-application.ts:160`), and `conditionsMatch` returns `true` for empty conditions (`runtime.ts:67`). With no selection, `activeScene` falls back to `runtime.activeScene`, and ties are broken by descending index → **the last scene in the rotation is always "active"**, and every newly added scene silently becomes runtime-active. The documented "activated later" semantic is never implemented (the map is always empty), and nothing records user activation.

**Expected vs Actual:**
- Expected: active scene reflects priority then the most-recently-activated scene (per `models.ts:221`).
- Actual: active scene reflects priority then document index (last wins); adding a scene reorders/activates runtime preview with no user action.

**Recommended fix (design-level):** Either (a) populate `sceneActivationOrder` from actual activation events (explorer select / runtime transition), or (b) change the fallback to ascending index (first-scene-first) and document index-order as the Phase-0 tie-break until activation tracking exists.

---

### WC-02-04 Deleting the active scene clears selection and jumps the canvas context to the first rotation's first scene
**Severity:** Medium · **Failure types:** lost selection, lost context, UI misleading state
**Confidence:** CONFIRMED (statically proven)
**Scenario:** S5

**Evidence:**
```ts
// App.tsx:279-280 (deleteSelectionCommand clears selection after delete)
setSelection(null);
setSelectedIds([]);
// App.tsx:199-200 + 464-465 (after selection is null, resolvedSelection is undefined)
const resolvedSelection = useMemo(() => selection ? resolveCanonicalNode(project, selection.id) : undefined, [project, selection]);
const runtimeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
const activeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];
```
Deleting a scene that is inside a non-first rotation/theme (or the last scene of its rotation) leaves `activeRotation`/`runtimeRotation` resolving to `group?.themeProjects[0]?.rotations[0]`, so the canvas, canvas dimensions, and simulator scene set all jump to the first rotation of the first theme (or empty when no scenes remain). This is a hard context switch unrelated to the deleted scene's own rotation.

**Expected vs Actual:**
- Expected: after deleting the active scene, the canvas falls back to a sibling scene in the *same* rotation, or a stable documented fallback.
- Actual: fallback recomputes from the root (first rotation/first scene), potentially switching rotation/theme and changing canvas dimensions (`canvasWidth/canvasHeight` at `App.tsx:467-468`).

**Recommended fix (design-level):** Preserve the deleted scene's rotation/theme as the fallback target (e.g., remember `activeRotation` before clearing selection), and select a sibling scene explicitly after delete rather than relying on the root-fallback chain.

---

### WC-02-05 Ghost selection: additive cross-scene selection leaves stale widget ids in `selectedIds`, inflating the "N items selected" and multi-count while `selectedWidgetIds` silently drops them
**Severity:** Low · **Failure types:** stale state, lost selection, UI misleading state
**Confidence:** CONFIRMED (statically proven)
**Scenario:** S8

**Evidence:**
```ts
// App.tsx:403 (additive select accumulates ids; orderSelectionIds only reorders, never prunes)
const nextIds = orderSelectionIds(activeScene?.widgets ?? [], selectIds(selectedIds, node.id, additive));
// App.tsx:484 (filters to current scene for canvas operations only)
const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));
// App.tsx:197 (label counts the unfiltered list)
const activeSelectionLabel = selectedIds.length > 1 ? `${selectedIds.length} items selected` : selection?.label ?? "Nothing selected";
```
When a widget from scene A and a node from scene B are additive-selected, `selectedIds` holds both, but `selectedWidgetIds` (used by canvas move/resize/nudge/delete/duplicate widget branches) silently drops the scene-A widget. The UI label (`App.tsx:197`) and properties multi-count (`selectedIds.length` at `App.tsx:889, 904`) still count the stale id, so the header/inspector report a selection the canvas does not operate on. This is the mechanism that feeds **WC-02-02**.

**Expected vs Actual:**
- Expected: selection count and canvas operations agree; switching scenes prunes or visually marks out-of-scene selected ids.
- Actual: `selectedIds` is never pruned to the active scene, producing a misleading count and an invisible "ghost" selection.

**Recommended fix (design-level):** Prune `selectedIds` to `selectedWidgetIds` (or to ids resolvable within the active scene) on scene switch, and base the selection-count label on the same pruned list used by canvas operations.

---

### WC-02-06 `activeBindings` is computed from `runtime.activeScene` but never rendered — the simulator's binding consumer is unwired (dead code)
**Severity:** Low · **Failure types:** command mismatch, stale preview (latent)
**Confidence:** CONFIRMED (statically proven)
**Scenario:** any runtime-bindings flow

**Evidence:**
```ts
// App.tsx:203 (computed, but no JSX reference anywhere in App.tsx)
const activeBindings = useMemo(() => activeProfile && runtime.activeScene
  ? evaluateActiveSceneBindings(runtime.activeScene, runtimeContext, activeProfile) : [],
  [runtime.activeScene, activeProfile, runtimeValues, runtimeSettings]);
```
`evaluateActiveSceneBindings` (`runtime.ts:114-123`) evaluates bindings against `runtime.activeScene`, but `activeBindings` is never consumed in the render tree (the binding editor at `App.tsx:988` uses `evaluateBinding` on `bindingWidget` instead). No functional bug today, but the "active scene → bindings" link is silently disconnected.

**Expected vs Actual:**
- Expected: active-scene bindings drive some visible surface (simulator/preview).
- Actual: the evaluation result is discarded.

**Recommended fix (design-level):** Wire `activeBindings` into the Simulator/preview surface or delete the memo until a consumer exists; document which scene source it is evaluated against.

---

## Verified-clean (no finding)

- **Undo/redo determinism (S3/S4).** `EditorApplication.execute` (`editor-application.ts:125-139`) clones `before` and `after` **once**, captures `newId()` ids inside `after`, and both `execute`/`undo` replays the captured clones. Redo therefore restores the *same* generated ids (scene + widget copies), not new random ones.
- **Cross-scene geometry preview leakage.** `geometryOverrides` (`App.tsx:180, 533-542`) is cleared on `activeScene?.id` change by the effect at `App.tsx:754-758` (`clearGeometryPreview` clears both `geometryOverrides` and `snapGuides`; `cancelCanvasInteraction` covers drag/resize/marquee/pan + pan restore). No preview survives a scene switch.
- **Non-active-scene mutation guard.** The App only uses scene-scoped setters (`setWidgetGeometriesInScene` `545`, `setWidgetZIndicesInScene` `300`, `deleteSelectionInScene` `276`, `duplicateSelectionInScene` `289`, `editWidgetProperties` unused), all gated by `validScopedWidgetIds` (`editor-application.ts:48-52`). The global `setWidgetGeometries` (`188`) and `updateWidgetGeometries` (`canvas-interaction.ts:353`) are not referenced from `App.tsx`. The only global multi-entity paths are `deleteSelection`/`duplicateSelection`, captured in **WC-02-02**.
- **Runtime values/settings persist across scene switch (S7).** `runtimeValues`/`runtimeSettings` (`App.tsx:176-178`) are device-global `RuntimeContext`, intentionally shared across scenes; the only reset is the Simulator Reset button (`App.tsx:931`). This is by design, not leakage — but it means scene A's runtime inputs continue to drive scene B's activation/bindings.

## Invariant check table

Legend: ✅ consistent · ⚠ divergence/bug · ➖ not applicable/unwired

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 A→modify→B→A | ✅ identical | ✅ replaced | ✅ cleared+correct | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S2 select A, sim→B | ✅ | ✅ (A) | ⚠ pinned A (WC-02-01) | ✅ | ✅ | ⚠ sim=B vs canvas=A | ✅ | ✅ (A) | ✅ (A) |
| S3 add→undo→redo | ✅ deterministic | ➖ | ⚠ new scene active (WC-02-03) | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| S4 dup scene→edit→undo→redo | ✅ deterministic | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S5 delete active scene | ✅ | ⚠ cleared (by design) | ⚠ jumps (WC-02-04) | ✅ | ✅ | ⚠ root fallback | ✅ | ✅ cleared | ✅ cleared |
| S6 move scene order | ✅ (core only) | ➖ | ➖ | ✅ | ✅ | ⚠ tie-break (WC-02-03) | ➖ | ➖ | ➖ |
| S7 runtime values A→B | ✅ | ➖ | ⚠ shared context (by design) | ✅ | ✅ | ⚠ see WC-02-01/03 | ✅ | ➖ | ➖ |
| S8 additive cross-scene + delete/dup | ⚠ cross-scene mutation (WC-02-02) | ⚠ ghost (WC-02-05) | ⚠ filtered silently | ✅ | ✅ | ✅ | ✅ | ⚠ stale id | ⚠ inflated multi-count |

## Summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | WC-02-01, WC-02-02 |
| Medium | 2 | WC-02-03, WC-02-04 |
| Low | 2 | WC-02-05, WC-02-06 |

**Top findings (one-liners):**
1. **WC-02-01 (High)** — Preview canvas is pinned to the explorer-selected scene via `resolvedSelection?.scene ?? runtime.activeScene` (`App.tsx:465`), so it renders a different scene than the Simulator's Active-Scene card (`App.tsx:932`).
2. **WC-02-02 (High)** — Mixed-kind additive selection (widget + scene across scenes) makes `deleteSelectionCommand`/`duplicateSelectionCommand` (`App.tsx:272-293`) route to the global `deleteSelection`/`duplicateSelection`, mutating widgets in non-active scenes.
3. **WC-02-03 (Medium)** — `sceneActivationOrder` is hardcoded `{}` (`App.tsx:201`), so equal-priority scenes tie-break by array index (last wins) instead of real activation order; `addScene` silently becomes runtime-active.
4. **WC-02-04 (Medium)** — Deleting the active scene clears selection and the `resolvedSelection`-root fallback (`App.tsx:200, 464-465`) jumps the canvas to the first rotation's first scene.
