# Template Designer — Agent 1 Editor/Application Core QA & Verification

**Branch:** `manus2`  
**Audited HEAD:** `fe9b1fbdc49b8dff2ef8423675ec245abe304943`  
**Commit:** `feat: establish canonical editor mutation pipeline`  
**Parent:** `a4109daefba220700f5ab7928ca019ed188ea0a6`  
**Audit mode:** Independent QA / code review; no source-code changes and no commit created.

## 1. Commit and diff verification

The target commit exists on `manus2`, is an ancestor of the pulled HEAD, and has parent `a4109daefba220700f5ab7928ca019ed188ea0a6`. Its complete file set is:

| Status | File | Commit scope |
|---|---|---|
| M | `src/App/App.tsx` | Store subscription, UI command wiring, canvas/property mutation entrypoints |
| M | `src/App/editor-commands.ts` | Editor command descriptors and selection filtering |
| M | `src/Core/commands.ts` | History snapshots, listeners, clear, execute/undo/redo |
| M | `src/Core/document-store.ts` | Document snapshot, subscription, save/create/open/replace and history delegation |
| A | `src/Core/editor-application.ts` | Editor mutation use cases and snapshot-based commands |
| A | `tests/editor-pipeline.test.ts` | Initial editor pipeline tests |

The pulled branch was clean before and after the audit. Independent repro scripts and logs were created outside the repository only.

## 2. Verification commands

| Command | Result | Evidence |
|---|---:|---|
| `npm run typecheck` | **PASS** | Exit status `0` |
| `npm test` | **PASS** | 5 test files, 18 tests passed |
| `npm run build` | **PASS** | Vite production build passed; 40 modules transformed |
| `npm run tauri:check` | **PASS** | Cargo check exit status `0` |

A green test/build result does not clear the runtime and semantic findings below. The browser check is especially important because the application did not render a usable UI.

## 3. Runtime verification

The Vite development server started successfully at `http://127.0.0.1:1420/`, but the page rendered a blank root. Browser console output reported:

> `The result of getSnapshot should be cached to avoid an infinite loop`

React then reported an error in `<App>`. The direct source path is `src/App/App.tsx:136`, where `useSyncExternalStore` receives `() => documentStore.getSnapshot()`. `InMemoryDocumentStore.getSnapshot()` constructs and returns a new object on every call (`src/Core/document-store.ts:43-50`), so React cannot observe a stable snapshot identity. The `documentStore.subscribe.bind(documentStore)` expression at the same App line also creates a new subscribe function on each render.

## 4. Mutation matrix

| Operation | Implemented | Canonical pipeline | Correct domain node | Undo | Redo | Dirty state | Tested adequately |
|---|---:|---:|---:|---:|---:|---:|---:|
| Add Theme Project | Yes | Yes | Yes | Yes | Yes | Yes | Partially |
| Add Rotation | Yes | Yes | Yes | Available | Available | Yes | No exact transition test |
| Add Scene | Yes, but corrupting | Yes | **No** | Snapshot restores | Redo re-corrupts | Yes | **False positive** |
| Move Scene | Yes, but corrupting | Yes | **No** | Snapshot restores | Redo re-corrupts | Yes | **No** |
| Move Widget | Yes | Yes | Yes on valid hierarchy | Yes | Yes | Yes | Partially |
| Edit Widget Properties | Yes | Yes | Yes on valid hierarchy | Available | Available | Yes | No undo/redo assertion |
| Delete Selection | Partial | Yes | Theme/widget filtering exists | Available | Available | Yes | Theme only |
| Duplicate Theme Project | Yes | Yes | Yes | Available | Available | Yes | Theme only |
| Duplicate Widget/Scene/Rotation | **No-op** | Command is recorded | No mutation | False-success history | N/A | Remains clean | **No** |
| Save | Yes | DocumentStore | Saved baseline | Not a history command | N/A | Works in direct store test | No UI test |
| Replace Current | Yes | Store method | Yes | Depends on caller | Depends on caller | Computed | No direct contract test |
| New Project | Yes, wrong lifecycle | **No** | New Project inserted | Old history retained | Old history retained | **Incorrectly dirty** | No |

## 5. Findings

### FND-01 — `useSyncExternalStore` snapshot is not cached; application fails to render

**SEVERITY:** CRITICAL  
**FILE:** `src/App/App.tsx:130-137`; `src/Core/document-store.ts:41-50` — [App.tsx][1] [document-store.ts][2]  
**CURRENT:** `App` creates a `DocumentStore` with `useMemo`, but passes `() => documentStore.getSnapshot()` as the snapshot reader. `getSnapshot()` allocates a new `{ project, isOpen, isDirty, history }` object on every call. The subscribe argument is also `documentStore.subscribe.bind(documentStore)`, which creates a new function identity per render.  
**EXPECTED/CANONICAL:** `useSyncExternalStore` must receive a cached, referentially stable snapshot until the external store changes. The subscribe function should remain stable as well. Notifications must invalidate the cached snapshot and then notify subscribers.  
**PROBLEM:** The actual browser runtime showed a blank application and React’s `The result of getSnapshot should be cached to avoid an infinite loop` error. This is not merely a performance warning; it prevents the App from establishing a valid external-store subscription/render cycle.  
**RECOMMENDATION:** Make `DocumentStore` cache its `DocumentSnapshot` and replace that cache only when document/history state changes. Expose stable subscribe/snapshot references from the App, for example through memoized callbacks or stable store methods. Add a render-level regression test that mounts `App` and asserts that the initial Project surface appears without console errors.

### FND-02 — `addScene` and `moveScene` corrupt `Rotation.scenes` into `Rotation` objects

**SEVERITY:** HIGH  
**FILE:** `src/Core/editor-application.ts:49-65, 111-124` — [editor-application.ts][3] [models.ts][4]  
**CURRENT:** `mapProject()` calls `mapRotation()`, which computes `direct` as a `Rotation` and then returns `scenes: direct.scenes.map((scene) => map(theme, rotation, scene))`. The `addScene` and `moveScene` callbacks return a `Rotation` object regardless of whether the callback is handling a rotation or a scene. `mapRotation` uses `any`, so TypeScript does not catch the resulting `Rotation[]` in a `Scene[]` field.  
**EXPECTED/CANONICAL:** The hierarchy must remain `Project → ThemeProjectGroup → ThemeProject → Rotation → Scene → Widget`, and `Rotation.scenes` must contain `Scene` objects with stable Scene IDs and Widget arrays. [Domain Model][4] [Editor pipeline contract][8]  
**PROBLEM:** An independent repro after `addScene(rotationId, "Scene A")` produced one entry with the Rotation ID, `angle: 0`, `hasNestedScenes: true` and no Widget array. A mutation matrix on `moveScene` changed scene IDs from `["scene-1", "scene-2"]` to `["rotation-1", "rotation-1"]`. Redo reproduces the corrupted state. An invalid rotation ID also records a successful command and produces the same corruption pattern through the generic mapper.  
**RECOMMENDATION:** Separate rotation-level and scene-level traversal helpers and remove `any` from `mapProject/mapRotation`. Every callback must return the declared node type. Add exact structural tests for Add Scene and Move Scene before and after undo/redo, including Scene IDs, names, activation conditions and Widget arrays.

### FND-03 — Duplicate Selection advertises Widget support but only duplicates Theme Projects

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:270-274, 573-576`; `src/Core/editor-application.ts:101-107`; `src/App/editor-commands.ts:26-35` — [App.tsx][1] [editor-application.ts][3] [editor-commands.ts][5]  
**CURRENT:** The Widget menu exposes `Duplicate Selection`, and the command path calls `editorApplication.duplicateSelection(selectedIds)`. The implementation only checks `ids.includes(theme.id)` and duplicates Theme Projects. Widget, Scene and Rotation IDs are ignored.  
**EXPECTED/CANONICAL:** A command must either mutate the selected canonical node and preserve its parent/descendant invariants, or remain disabled/explicitly unsupported. Duplicate Widget must create a unique ID, preserve content and parent Scene, keep the original unchanged, and support independent later edits. [Editor pipeline contract][8]  
**PROBLEM:** Independent repro with a canonical Scene containing `w1` returned `before: 1`, `after: 1`, while `canUndo: true` and `isDirty: false`. The UI can therefore log `Selection duplicated` and add a history entry even though no document mutation occurred. This violates the failed/no-op mutation rule and makes Undo appear available for a command that did nothing.  
**RECOMMENDATION:** Implement duplication per supported canonical node type, or remove/disable the Widget duplicate surface until it is implemented. A no-op must not be recorded as a successful document command.

### FND-04 — New Project bypasses document lifecycle and keeps old history/saved baseline

**SEVERITY:** MEDIUM  
**FILE:** `src/App/App.tsx:224-233`; `src/Core/document-store.ts:57-87` — [App.tsx][1] [document-store.ts][2]  
**CURRENT:** `createProject()` builds a new Project and sends `replaceCurrent(nextProject)` through a normal command. It does not call `documentStore.create()`/`open()`, so the old history and `savedProject` baseline remain in place.  
**EXPECTED/CANONICAL:** Creating/opening a new document must establish the new Project as the authoritative document, reset document history, and start with `isDirty === false`. Undo history for a previous document must not leak into the new document. [DocumentStore][2]  
**PROBLEM:** Independent repro using the same replace-current pattern returned `undoCount: 2` and `dirty: true` immediately after creating `Untitled Project`. The new Project is incorrectly considered unsaved, and Undo can traverse back into the prior document’s mutation history.  
**RECOMMENDATION:** Route New Project through the existing document lifecycle method, not a normal editor mutation command. If product behavior requires undoing project creation, define that as an explicit document replacement transaction with a new saved baseline and isolated history; do not reuse ordinary in-document history implicitly.

### FND-05 — Failed redo destroys the redo stack entry

**SEVERITY:** MEDIUM  
**FILE:** `src/Core/commands.ts:35-50` — [commands.ts][6]  
**CURRENT:** `redo()` pops the command from `redoStack` before calling `command.execute()`. `undo()` similarly pops from `undoStack` before calling `command.undo()`.  
**EXPECTED/CANONICAL:** If a mutation or inverse mutation throws, the Project must remain unchanged and the failed command must not silently disappear from history. The history state must remain consistent and retryable or be explicitly invalidated with a documented policy.  
**PROBLEM:** Independent repro executed a command, undid it, then forced the redo to throw. The resulting snapshot was `value: 0`, `error: "redo failure"`, `canUndo: false`, `canRedo: false`, `undoCount: 0`, `redoCount: 0`. The failed redo command was lost.  
**RECOMMENDATION:** Execute against a retained stack entry and move it only after success; on failure restore the original stack state. Apply the same transactional rule to failed undo.

### FND-06 — Executable context commands can log success without performing the named mutation

**SEVERITY:** MEDIUM  
**FILE:** `src/App/editor-commands.ts:26-35`; `src/App/App.tsx:276-290` — [editor-commands.ts][5] [App.tsx][1]  
**CURRENT:** `widget.move` and `widget.edit-properties` are advertised as executable descriptors. In `executeEditorDescriptor`, `widget.move` only calls `activatePanel("properties")`, and `widget.edit-properties` also only activates the Properties panel. The handler then logs `${commandId} executed`.  
**EXPECTED/CANONICAL:** A command that is exposed as an editor mutation must call the relevant Application/Core use case and change the canonical document, or it must be a clearly non-mutating navigation action / disabled unsupported command. [Editor pipeline contract][8]  
**PROBLEM:** The context menu can report successful execution while no Move or Edit mutation occurs. This is especially misleading for `widget.move`, whose actual canvas drag path is separate from the descriptor command.  
**RECOMMENDATION:** Separate navigation descriptors from document mutation commands. Keep unsupported mutation commands disabled until they invoke the canonical editor application; do not log a mutation success for a panel activation.

### FND-07 — Tests pass while missing the critical render and mutation failures

**SEVERITY:** HIGH  
**FILE:** `tests/editor-pipeline.test.ts:17-63`; `tests/ui-phase2.test.ts:7-35`; no App render test — [editor-pipeline.test.ts][7] [ui-phase2.test.ts][9]  
**CURRENT:** `npm test` reports 5 files and 18 passing tests. `editor-pipeline.test.ts` asserts only selected IDs/names and does not assert that `Rotation.scenes` entries are actually Scene objects. Its Add Scene path creates the same corrupted shape and then subsequent test mutations operate on that corrupted shape, allowing the test to pass. `ui-phase2.test.ts` covers registry, panel helpers and pure canvas math but does not mount `App` or exercise `useSyncExternalStore`, UI command wiring, DocumentStore refresh, dirty state, or UI Undo/Redo.  
**EXPECTED/CANONICAL:** Tests must compare complete relevant domain structures before/after mutation, undo and redo, and must include a render-level test for the external-store subscription. Failure cases, invalid IDs, duplicate Widget, New Project lifecycle, branching history and failed commands must be covered. [QA test criteria][10]  
**PROBLEM:** The green suite is not evidence that the canonical editor pipeline works. It misses the blank-screen runtime failure, the structural Scene corruption, no-op Widget duplication, failed redo stack loss and New Project history leakage.  
**RECOMMENDATION:** Add focused regression tests for each missing transition before treating the commit as verified. Do not weaken the test to accommodate the current corrupted structure.

## 6. Positive findings

The implementation does make several correct architectural moves. `App` no longer keeps a separate `useState<Project>` authority; the primary Project reference comes from the DocumentStore snapshot. Normal Add Theme Project, Add Rotation, Move Widget, Property and Delete paths use `EditorApplication` or a command that replaces the current Project through the store. The Domain model remains the source of Project/Theme/Rotation/Scene/Widget types, and the UI does not introduce a second domain hierarchy. Canvas geometry helpers are immutable and preserve unrelated nodes for valid unique IDs. The direct `DocumentStore` dirty lifecycle and the valid Move Widget undo/redo path behave correctly in the independent matrix.

## 7. Final result

**FAIL**

The target commit builds and its tests pass, but the actual application cannot render because the external-store snapshot contract is invalid. Independently exercised Add Scene and Move Scene mutations corrupt the canonical hierarchy, Widget duplication records a false-success no-op, New Project leaks prior document history and dirty baseline, and failed redo loses history. The current test suite does not detect these failures.

## References

[1]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/App/App.tsx "Agent 1 App integration"
[2]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/Core/document-store.ts "DocumentStore implementation"
[3]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/Core/editor-application.ts "EditorApplication mutation use cases"
[4]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/Domain/models.ts "Canonical Project hierarchy"
[5]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/App/editor-commands.ts "Editor command descriptors"
[6]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/src/Core/commands.ts "CommandHistory implementation"
[7]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/tests/editor-pipeline.test.ts "Editor pipeline tests"
[8]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md "Editor/Application mutation pipeline contract"
[9]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/tests/ui-phase2.test.ts "UI Phase 2 tests"
[10]: https://github.com/Huseyincansagir/Template_Designer/blob/fe9b1fbdc49b8dff2ef8423675ec245abe304943/tests/editor-pipeline.test.ts "QA-required editor transition coverage"
