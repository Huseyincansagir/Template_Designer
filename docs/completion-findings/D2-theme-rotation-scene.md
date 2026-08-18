# D2 Findings — Theme Projects / Rotations / Scenes (lifecycle + navigation/switching)

**Auditor:** DISCOVERY SPECIALIST D2 (read-only)
**Method:** Live driving of the running app at `http://127.0.0.1:1420/` via headless Edge (CDP, port 9224) + source root-causation in `src/`.
**Note on concurrency:** the repository was observed changing during this audit (an independent remediation pass added Core guards and Core methods while I was testing). Every finding below states what was **verified live** (authoritative) versus **source** root cause, and line numbers are the latest observed. Core canonical-invariant guards for rotation delete/duplicate (`containsRotationId`) were added mid-audit and are reflected in the final state below.

---

## Findings

| ID | Severity | Class | Title |
|----|----------|-------|-------|
| D2-01 | P1 | MISSING FEATURE | Scene `activationConditions` / `activationConditionMode` are not editable anywhere in the UI (the runtime scene-selection rule is unwritable) |
| D2-02 | P1 | MISSING FEATURE | No scene switcher; the Explorer tree is the only way to switch scenes and the active scene is not named on the canvas |
| D2-03 | P2 | MISSING FEATURE | No rotation switcher / keyboard route / active-rotation highlight; rotation state is only a small header text |
| D2-04 | P2 | MISSING ENTRY POINT | `moveScene` exists in Core but is unreachable from the UI (scenes cannot be reordered) |
| D2-05 | P2 | VALIDATION BUG | Rotation delete is now refused in Core, but the UI shows a misleading refusal message and a confirm dialog before the refusal |
| D2-06 | P2 | VALIDATION BUG | Rotation duplicate is now refused in Core, but the refusal is silent and the "Duplicate Selection" menu item stays enabled for a rotation |
| D2-07 | P2 | MISSING ENTRY POINT | No way to create a Theme Project Group (only the scaffold group exists) |
| D2-08 | P3 | INCOMPLETE WORKFLOW | Deleting the last Theme Project leaves an empty group with no explanation; only the last-GROUP delete is guarded |
| D2-09 | P3 | UX | Deleting the last group shows an "undoable" confirm dialog but then silently refuses (console-only) |
| D2-10 | P3 | UX DISCOVERABILITY | Duplicate/Rename of scenes and themes are only reachable through the Widget menu / Properties panel, not context menus |
| D2-11 | P3 | UX DISCOVERABILITY | No onboarding: "Theme Project / Group / Rotation / Scene" jargon is never explained |
| D2-12 | P3 | POLISH | Scene default naming skips "New Scene 1" (first is "New Scene", then "New Scene 2") |
| D2-13 | P3 | UX | Empty rotation (no scenes) shows guidance text but no "Add Scene" CTA |
| D2-14 | — | WORKS (negative) | Canvas dimensions swap correctly per rotation (R0 720×1280 vs R90 1280×720) |
| D2-15 | — | WORKS (negative) | Scenes/widgets are correctly per-rotation (a scene under R0 does not appear under R90) |
| D2-16 | — | WORKS (negative) | Undo/redo and save/reload work for theme + scene lifecycle operations |
| D2-17 | — | WORKS (negative) | Menu-created and duplicated Theme Projects both receive the canonical four rotations |
| D2-18 | P3 | STATE (note) | Selection is pruned (not stale) across scene/rotation switches, but is never restored on return |
| D2-19 | P2 | UX DISCOVERABILITY | Active scene is not obvious when a widget is selected (context bar shows the widget name, not the scene) |
| D2-20 | P3 | MISSING ENTRY POINT | No keyboard shortcuts for scene/rotation switching |
| D2-21 | P3 | UX | Many scenes (verified 8; 12 behaves the same) force tree scrolling with no filter/search |
| D2-22 | P3 | POLISH | A disabled Scene is indistinguishable from an enabled one in the Explorer tree |
| D2-23 | P3 | POLISH | "Test Scene" (Scene menu) only opens the Simulator panel; it does not target the selected scene |

---

## D2-01 — Scene activation conditions are not editable (P1 · MISSING FEATURE)

**Repro:**
1. Fresh load → select R0 → Scene → Add Scene.
2. Select the scene → Properties panel → "Scene Runtime" section.
3. "Activation Conditions" shows `0 · all`; there is no input, dropdown, or button (verified: `hasInput: false`).

**Observed:** `Scene.priority` (number field) and `Scene.enabled` (checkbox) ARE editable; `Scene.activationConditions` and `Scene.activationConditionMode` are displayed as a read-only count and can never be authored. There is no other surface (menu, context menu, modal) that edits them.

**Expected:** `activationConditions` is the rule that decides which scene the device shows at runtime (consumed by `selectActiveScene`). It must be authorable.

**Root cause:** Core now exposes `setSceneActivation` (`src/Core/editor-application.ts:503`) and `setSceneProperties` accepts `activationConditions` (`:484`), but **no UI caller exists** — `grep setSceneActivation src/App/App.tsx` returns nothing, and the only `activationConditions` reference in the UI is the read-only `PropertyRow` at `src/App/App.tsx:1895`.

**Class:** MISSING FEATURE. **Severity:** P1.

---

## D2-02 — No scene switcher; tree is the only mechanism (P1 · MISSING FEATURE)

**Repro:** Create 8 scenes under R0, then try to switch between two of them without touching the left tree.

**Observed (measured):**
- DOM search for a scene switcher returned only the four panel tabs (`Explorer/Assets/Properties/Simulator`); no scene dropdown, tabs, breadcrumb, or next/prev buttons. `aria-label` containing "scene" only matches the two property inputs.
- The canvas header (`device-frame-header`) shows only `DISPLAY  R0 · 720 × 1280` — it does **not** name the active scene.
- **Interaction cost: 1 click per switch (click the scene in the tree), and only if the target is visible.** With 8 scenes the tree overflows (`scrollHeight 628px vs clientHeight 410px`), so a target near the bottom costs a scroll + click (2 interactions). There is no keyboard route. A round-trip between two arbitrary scenes is therefore 2–4 interactions, all through the tree.

**Root cause:** Scene selection is resolved from the Explorer selection only: `activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0]` (`src/App/App.tsx:1105`). No dedicated scene-navigation UI is rendered anywhere; the tree (`renderTreeNode`) is the sole scene selector.

**Class:** MISSING FEATURE. **Severity:** P1 (the core editing loop of a multi-scene elevator display is tree-only, and the active scene is not shown on the canvas).

---

## D2-03 — No rotation switcher / keyboard / active highlight (P2 · MISSING FEATURE)

**Repro:** Fresh load; switch R0→R90; note how the active rotation is indicated.

**Observed:**
- Switching rotation = 1 click on the rotation node in the Explorer (all four are auto-expanded, `depth < 4`). No keyboard shortcut, no persistent switcher/tabs/dropdown, no breadcrumb.
- On a fresh load **no tree row is selected** (`aria-current` is absent), yet R0 is the "active" rotation; the only indication is the small frame-header text `R0 · 720 × 1280`. There is no `aria-pressed`/`aria-current`/`aria-selected` on the active rotation anywhere.

**Root cause:** `activeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0]` (`src/App/App.tsx:1104`) silently defaults to R0. The frame header is the only active-rotation render (`device-frame-header`, `:1976`). `shortcut-registry.ts` contains no rotation/scene navigation shortcuts.

**Class:** MISSING FEATURE. **Severity:** P2.

---

## D2-04 — `moveScene` unreachable; scenes cannot be reordered (P2 · MISSING ENTRY POINT)

**Repro:** Select a rotation with several scenes and look for any reorder affordance (drag, up/down buttons, menu).

**Observed:** None. Tree nodes are not draggable (`renderTreeNode` has no `draggable`/drop handlers). No menu or context-menu entry moves a scene. `grep moveScene src/App` returns no UI caller.

**Root cause:** `moveScene` exists in Core (`src/Core/editor-application.ts:447`) and is a proper undoable command, but is never wired to a UI entry point.

**Class:** MISSING ENTRY POINT. **Severity:** P2.

---

## D2-05 — Rotation delete: guarded but misleading feedback (P2 · VALIDATION BUG)

**Repro:** Select R0 in the tree → press `Delete` → observe the confirm dialog → click **Delete**.

**Observed:** A confirm dialog appears ("Delete the selected item? This is undoable."), then nothing is deleted and the console logs **"Delete refused: a project must keep at least one Theme Project Group"** — a message about groups, not rotations. The Edit/Scene/Widget menus and the rotation context menu ("Delete Selection") all remain **enabled** for a rotation selection.

**Root cause:** Core now refuses rotation deletion via `containsRotationId` (`src/Core/editor-application.ts:655`), but the UI's single refusal path hard-codes the wrong reason (`src/App/App.tsx:723`) and shows the confirm dialog *before* the mutation is attempted (`:734-746`).

**Class:** VALIDATION BUG (feedback). **Severity:** P2. (The data-integrity part of the canonical rule is now protected — verified live.)

---

## D2-06 — Rotation duplicate: guarded but silent (P2 · VALIDATION BUG)

**Repro:** Select R90 → Widget menu → **Duplicate Selection**.

**Observed:** Nothing happens and **no feedback of any kind** is logged. The "Duplicate Selection" item (`src/App/App.tsx:1783`) is `disabled: !selectedIds.length`, so it is enabled for a rotation selection, and it lives in the **Widget** menu (a rotation is not a widget).

**Root cause:** Core refuses rotation duplication via `containsRotationId` (`src/Core/editor-application.ts:752`), but the UI's `duplicateSelectionCommand` simply returns `false` with no log when the mutation is refused (`src/App/App.tsx:765`).

**Class:** VALIDATION BUG (silent). **Severity:** P2. (Verified live: the tree stays at exactly 4 rotations.)

---

## D2-07 — Theme Project Group cannot be created (P2 · MISSING ENTRY POINT)

**Observed:** Only the scaffold group (`createEmptyProject` → `createEmptyThemeProjectGroup`) exists. There is no "Add Theme Project Group" menu/context item, and no Core method to add a group. A designer who wants to organize themes into multiple groups cannot.

**Root cause:** `src/Domain/factories.ts:81` creates the group, but `EditorApplication` has no group-creation method and `App.tsx` has no entry point.

**Class:** MISSING ENTRY POINT. **Severity:** P2 (product gap; acceptable only if V1 assumes one group).

---

## D2-08 — Deleting the last Theme Project leaves an empty group (P3 · INCOMPLETE WORKFLOW)

**Repro:** Delete the only Theme Project.

**Observed:** Confirm dialog ("This is undoable"), then the tree shows `Untitled Theme Group — 0 theme projects`. Statusbar flips to "Foundation validation requires attention" (THEME_PROJECT_REQUIRED). Recoverable via Theme → Add Theme Project.

**Root cause:** `deleteSelection` guards only the last **group** (`src/Core/editor-application.ts:661`); the last **theme** within a group is deletable. The confirm dialog does not explain the resulting empty/invalid state.

**Class:** INCOMPLETE WORKFLOW. **Severity:** P3.

---

## D2-09 — Last-group delete: misleading confirm then silent refusal (P3 · UX)

**Repro:** Delete the only Theme Project Group.

**Observed:** The confirm dialog appears ("Delete the selected item? This is undoable."); after confirming, nothing is deleted and the refusal is only a console `WARN`. There is no dialog explaining why.

**Root cause:** `deleteSelectionCommand` shows the confirm dialog before running the mutation (`src/App/App.tsx:734-746`); the actual refusal happens later in `performDeleteSelection` with a console-only log (`:723`).

**Class:** UX. **Severity:** P3.

---

## D2-10 — Duplicate/Rename not in context menus; Duplicate lives in Widget menu (P3 · UX DISCOVERABILITY)

**Observed:**
- Scene context menu offers only Add Widget / Hide All / Show All / Delete Selection — no **Duplicate**, no **Rename**.
- Rotation context menu offers only "Add Scene" and "Delete Selection".
- Duplicating a **scene** or **theme** requires the **Widget** menu → "Duplicate Selection".
- Renaming any node requires selecting it and editing the Properties panel "Name" field (no F2, no context-menu rename).

**Root cause:** `editorCommandDescriptors` (`src/App/editor-commands.ts:40-55`) contains no duplicate/rename descriptors; "Duplicate Selection" is only in the Widget menu (`src/App/App.tsx:1783`).

**Class:** UX DISCOVERABILITY. **Severity:** P3.

---

## D2-11 — No onboarding for domain jargon (P3 · UX DISCOVERABILITY)

**Observed:** The Explorer labels nodes "Theme Project Group", "Theme Project", "Rotation / Form", "Scene", with no tooltip, help, or intro text. The only footnote is "Canonical Project Model is the source of truth. Explorer is a navigation view." A first-time user cannot learn what a "Theme Project" IS from the UI alone.

**Class:** UX DISCOVERABILITY. **Severity:** P3.

---

## D2-12 — Scene default naming inconsistency (P3 · POLISH)

**Observed:** Adding scenes produces `New Scene`, `New Scene 2`, `New Scene 3`, … — there is no `New Scene 1`.

**Root cause:** `uniqueDefaultName` (`src/App/App.tsx:171`) returns the base name un-suffixed when it is unused, then starts numbering at 2.

**Class:** POLISH. **Severity:** P3.

---

## D2-13 — Empty rotation has no "Add Scene" CTA (P3 · UX)

**Observed:** With R90 selected (no scenes), the canvas empty state reads "Select a Scene or Widget / Create or select a canonical Rotation and Scene to begin canvas editing." — with **no button**. The user must discover Scene → Add Scene or the rotation's context menu. By contrast, an empty scene correctly shows a "Add Widget" button.

**Root cause:** The empty-state CTA is gated on `activeScene?.id` (`src/App/App.tsx:1990`); a rotation with no scenes has no scene id, so no button renders.

**Class:** UX. **Severity:** P3.

---

## D2-14 — Canvas dimensions swap per rotation (WORKS)

**Measured live:** R0 frame `288.6 × 513px` (aspect `720/1280`); R90 frame `912 × 513px` (aspect `1280/720`); back to R0 `288.6 × 513px`. The swap is sourced from `rotationDimensions` (`src/Core/editor-application.ts:31`) and applied to `device-frame` aspect-ratio (`src/App/App.tsx:1976`). **No bug.**

---

## D2-15 — Scenes/widgets are per-rotation (WORKS)

**Measured live:** A scene + widget created under R0 appears under R0 only; R90/R180/R270 remain empty. `getThemeNodes` nests scenes under their rotation (`src/App/App.tsx:95-120`), and `addScene`/`addWidget` scope by rotation/scene id. **No bug.**

---

## D2-16 — Undo/redo + save/reload work (WORKS)

**Measured live:** Add theme → add scene → rename → priority change → duplicate → delete, then Ctrl+Z/Ctrl+Y each step correctly revert/reapply; Ctrl+S → reload restores the exact tree and shows "Document: clean". Backed by `CommandHistory` (`src/Core/commands.ts`) and `LocalStorageProjectStorage` (`src/Infrastructure/project-storage.ts`). **No bug.**

---

## D2-17 — Canonical four rotations for menu-created and duplicated themes (WORKS)

**Measured live:** Theme → Add Theme Project produces R0/R90/R180/R270 (720×1280 / 1280×720 swapped); Widget → Duplicate Selection on a theme produces a copy with the same four rotations. `addThemeProject` (`src/Core/editor-application.ts:237`) and `duplicateThemeProject` both preserve the canonical set. **No bug.**

---

## D2-18 — Selection is pruned, not stale, across switches (P3 · note)

**Observed:** Select a widget → switch rotation → the widget selection is dropped and the container (rotation) becomes the selection; switch back → selection is the container, never a stale/wrong widget, and the Properties panel never shows a widget from another scene.

**Root cause:** the cross-scene pruning effect drops widget ids outside the active scene (`src/App/App.tsx:1628-1641`). Behavior is safe; the only nit is that the prior widget selection is not restored on return (expected for tree navigation).

**Class:** note (safe behavior). **Severity:** P3 (polish at most).

---

## D2-19 — Active scene not obvious while editing a widget (P2 · UX DISCOVERABILITY)

**Observed:** With a widget selected, the canvas context bar shows the **widget** name ("Media"), not the scene; the frame header shows only rotation. The only scene signal is the tree (selected row) and, in design mode, the small "Runtime would activate: X" note.

**Root cause:** `activeSelectionLabel` is the selection label (`src/App/App.tsx:493`); the canvas header renders rotation only (`:1976`). No persistent "current scene" name is rendered on the canvas.

**Class:** UX DISCOVERABILITY. **Severity:** P2 (ties directly into D2-02).

---

## D2-20 — No keyboard shortcuts for scene/rotation switching (P3 · MISSING ENTRY POINT)

**Observed:** `shortcut-registry.ts` defines only undo/redo/save/new/copy/cut/paste/select-all/delete/escape. No next/prev scene, no rotation hotkey.

**Class:** MISSING ENTRY POINT. **Severity:** P3.

---

## D2-21 — Many scenes force tree scrolling (P3 · UX)

**Observed:** With 8 scenes the tree scroll container overflows (17 rows, `scrollHeight 628 > clientHeight 410`) and scrolling + visually scanning near-identical "New Scene N" names is required; 12 scenes behaves the same (no crash/degradation, but no search/filter either).

**Root cause:** `.tree-scroll { overflow: auto }` (`src/App/app.css:242`) with no tree filter/search control.

**Class:** UX. **Severity:** P3.

---

## D2-22 — Disabled scene not indicated in the Explorer (P3 · POLISH)

**Observed:** Toggling a scene's "Enabled" off (Properties) does not change its tree label/detail (still "Priority N"); there is no disabled visual. Only the runtime (`selectActiveScene`, `src/Core/runtime.ts:104`) and the Properties checkbox reflect it.

**Class:** POLISH. **Severity:** P3.

---

## D2-23 — "Test Scene" label is misleading (P3 · POLISH)

**Observed:** Scene → "Test Scene" merely calls `activatePanel("simulator")` (`src/App/App.tsx:1777`); it does not target or "test" the selected scene (the Simulator shows the runtime-active scene, which is resolved independently). The label over-promises.

**Class:** POLISH. **Severity:** P3.

---

## Summary of measured interaction costs

- **Rotation switch (fresh load):** 1 click (Explorer tree). All four rotations visible by default. No keyboard, no persistent switcher, no active-rotation highlight in the tree (only small frame-header text).
- **Scene switch (8 scenes, one rotation):** 1 click via the tree when the target is visible; 2 interactions (scroll + click) when it is not. The tree is the **only** mechanism — no tabs, dropdown, breadcrumb, or next/prev shortcut. Round-trip between two arbitrary scenes = 2–4 interactions.
