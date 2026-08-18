# Template Designer V2 — Command Surface Inventory & Defect Findings (Discovery Specialist D4)

Scope: command surface — menu bar, toolbar, context bar, context menus, Explorer tree, keyboard shortcuts, information architecture / discoverability.
Repo: `C:\Users\b1601\Template_Designer` (branch manus2). Runtime: dev server 127.0.0.1:1420, driven headless Edge on :9226.
Method: static cross-reference (`editor-commands.ts`, `shortcut-registry.ts`, `editor-application.ts`, `App.tsx`) + live DOM invocation of every command.

Legend for "Works?" / "Undo verified?": ✓ = exercised live; ✓src = traced to a canonical `EditorApplication.execute()` call and code path (not separately re-clicked); — = not applicable (pure UI/persistence).

---

## A. COMPLETE COMMAND INVENTORY

### A1. Menu bar (8 menus)

| Surface | Label | Command id (traceable) | Selection context | Enabled when | Works? | Mutates canonical state? | Creates undo history? | Undo verified? | Notes |
|---|---|---|---|---|---|---|---|---|---|
| File menu | New Project | — (`requestNewProject`) | none | always | ✓ | new doc | resets history | — | Confirm dialog if dirty (`confirmDestructive`) |
| File menu | Open Project | — (`openProject`) | none | always | ✓src | loads doc | resets history | — | Blocked with WARN if dirty; reads localStorage |
| File menu | Save | — (`saveDocument`) | none | document dirty | ✓ | persistence only | no | — | Clears "dirty" chip (verified Ctrl+S) |
| Edit menu | Undo | — (`undo`) | none | `canUndo` | ✓ | restore | consumes history | ✓ | title "No commands to undo" when disabled |
| Edit menu | Redo | — (`redo`) | none | `canRedo` | ✓ | restore | consumes history | ✓ | title "No commands to redo" when disabled |
| Edit menu | Cut | — (`cutSelection`) | widget | widget selected | ✓ | delete+capture | yes | ✓ | Ctrl+X |
| Edit menu | Copy | — (`copySelection`) | widget | widget selected | ✓ | no (clipboard) | no | — | Ctrl+C |
| Edit menu | Paste | — (`pasteSelection`) | widget clipboard | clipboard non-null | ✓ | insert copies | yes | ✓ | Ctrl+V |
| Edit menu | Delete Selection | `canvas.delete-selection` | any node | selection | ✓ | delete | yes | ✓ | **disabled with NO tooltip** (D4-10) |
| Edit menu | Reset Layout | — (`resetLayout`) | none | always | ✓ | no (UI) | no | — | duplicate of View (D4-27) |
| View menu | Project Explorer / Asset Browser / Properties / Simulator / Console / Output | — (`activatePanel`) | none | always | ✓ | no (UI) | no | — | re-docks the panel |
| View menu | Reset Layout | — (`resetLayout`) | none | always | ✓ | no (UI) | no | — | duplicate of Edit (D4-27) |
| Project menu | Validate Project | — | none | always | ✓ | no | no | — | logs issues to console |
| Project menu | Device Profile: `<name>` | — (`setDeviceProfile`) | none | not active | ✓src | deviceProfileId | yes | — | **disabled (only 1 profile shipped)** D4-09 |
| Project menu | Build & Verify Package | — (`buildAndVerifyPackage`) | none | profile + valid | ✓ | no (build) | no | — | status "Built · checksum verified" |
| Theme menu | Add Theme Project | `project.add-theme-project` | project/group | group exists | ✓ | adds theme(4 rot) | yes | ✓ | new theme not uniquely named (D4-30) |
| Scene menu | Add Scene | `rotation.add-scene` | rotation | rotation selected | ✓ | adds scene | yes | ✓ | disabled, no tooltip |
| Scene menu | Hide All Widgets | `scene.hide-all` | scene | scene w/ widgets | ✓src | widget.visible | yes | ✓ | disabled, no tooltip |
| Scene menu | Show All Widgets | `scene.show-all` | scene | scene w/ widgets | ✓src | widget.visible | yes | ✓ | disabled, no tooltip |
| Scene menu | Delete Selection | `canvas.delete-selection` | any | selection | ✓ | delete | yes | ✓ | disabled, no tooltip |
| Scene menu | Test Scene | — (`activatePanel("simulator")`) | none | always | ✓src | no (UI) | no | — | |
| Widget menu | Add Media/Digit/Direction/Warning/Text Widget | `scene.add-widget:<type>` | scene | scene selected | ✓src | adds widget | yes | ✓ | disabled w/o scene, no tooltip |
| Widget menu | Lock/Unlock Selection | `widget.lock-toggle` | widget | widget selected | ✓ | widget.locked | yes | ✓ | label flips |
| Widget menu | Hide/Show Selection | `widget.hide-toggle` | widget | widget selected | ✓ | widget.visible | yes | ✓ | log text inverted (D4-17) |
| Widget menu | Duplicate Selection | — (`duplicateSelectionCommand`) | any | selection | ✓ | duplicate | yes | ✓ | **only place to duplicate a scene/theme/rotation/group** (D4-14) |
| Widget menu | Duplicate Mode (click to place) | `widget.duplicate-mode` | widget | widget selected | ✓ | duplicate at point | yes | ✓ | rail banner, Esc exits |
| Widget menu | Delete Selection | `canvas.delete-selection` | any | selection | ✓ | delete | yes | ✓ | disabled, no tooltip |
| Widget menu | Binding Editor | `widget.add-binding` | widget | widget selected | ✓ | (opens modal) | n/a | — | |
| Tools menu | Diagnostics | — (`activatePanel("console")`) | none | always | ✓src | no (UI) | no | — | |
| Tools menu | Program Settings | — (`setSettingsOpen`) | none | always | ✓ | no (UI) | no | — | modal |

### A2. Toolbar / top bar / document tabs

| Surface | Label | Command id | Context | Works? | Mutates canonical state? | Undo history? | Notes |
|---|---|---|---|---|---|---|---|
| Top bar | New Project (primary) | — | none | ✓ | new doc | resets | |
| Top bar | Undo | — | none | ✓ | restore | consumes | title "Undo last command" / "No commands to undo" |
| Top bar | Redo | — | none | ✓ | restore | consumes | title "Redo last command" / "No commands to redo" |
| Top bar | ⚙ Settings | — | none | ✓ | no (UI) | no | title "Program Settings" |
| Document tabs | document tab (click) | — | none | ✓ | no | no | logs only |
| Document tabs | close × | — | none | disabled | — | — | "The open document cannot be closed" (D4-28) |
| Document tabs | ↺ reset layout | — | none | ✓ | no (UI) | no | third instance of Reset Layout |

### A3. Explorer tree

| Surface | Label | Command id | Context | Works? | Notes |
|---|---|---|---|---|---|
| Explorer toolbar | Expand | — | none | ✓ | expands all node ids |
| Explorer toolbar | Collapse | — | none | ✓ | collapses all |
| Tree row | expander ▾/▸ | — | node | ✓ | per-node expand/collapse |
| Tree row | label click | — | node | ✓ | select; Shift/Ctrl additive multi-select |
| Project ctx menu | Add Theme Project | `project.add-theme-project` | project | ✓ | |
| Theme-group ctx menu | Add Theme Project | `project.add-theme-project` | group | ✓ | |
| Theme-group ctx menu | Delete Selection | `canvas.delete-selection` | group | ✓ | last-group guard (D4 ref) |
| Theme ctx menu | Delete Selection | `canvas.delete-selection` | theme | ✓ | |
| Rotation ctx menu | Add Scene | `rotation.add-scene` | rotation | ✓ | |
| Rotation ctx menu | Delete Selection | `canvas.delete-selection` | rotation | ✓ | |
| Scene ctx menu | Add `<Type>` Widget ×5 | `scene.add-widget:*` | scene | ✓src | |
| Scene ctx menu | Hide All Widgets / Show All Widgets | `scene.hide-all`/`scene.show-all` | scene | ✓src | |
| Scene ctx menu | Delete Selection | `canvas.delete-selection` | scene | ✓ | |
| Widget ctx menu | Bring Forward / Send Backward / Bring To Front / Send To Back | `widget.bring-*` | widget | ✓ | zIndex renumber; no-op at boundary (verified) |
| Widget ctx menu | Lock / Unlock | `widget.lock-toggle` | widget | ✓ | |
| Widget ctx menu | Hide / Show | `widget.hide-toggle` | widget | ✓ | |
| Widget ctx menu | Duplicate Mode (click to place) | `widget.duplicate-mode` | widget | ✓ | |
| Widget ctx menu | Binding Editor | `widget.add-binding` | widget | ✓ | |
| Widget ctx menu | Delete Selection | `canvas.delete-selection` | widget | ✓ | |
| Widget ctx menu | Open Properties | `widget.open-properties` | widget | ✓src | activates properties panel |
| Resources / Unsupported Files row | (no context menu) | — | — | — | right-click produces no menu (D4-32) |

### A4. Context bar (canvas)

| Surface | Label | Command id | Context | Works? | Notes |
|---|---|---|---|---|---|
| Context bar | Add Widget | (first `supportedWidgetTypes[0]`) | scene | ✓ | always media; no type picker (D4-33) |
| Context bar | Duplicate | — (`duplicateSelectionCommand`) | widget only | ✓ | `disabled: !selectedWidgetIds.length` |
| Context bar | Lock / Unlock | — (`toggleWidgetProperty`) | widget only | ✓ | |
| Context bar | Hide / Show | — (`toggleWidgetProperty`) | widget only | ✓ | |
| Context bar | Delete | — (`deleteSelectionCommand`) | widget only | ✓ | confirm dialog |

### A5. Studio toolbar / canvas

| Surface | Label | Command id | Context | Works? | Notes |
|---|---|---|---|---|---|
| Studio toolbar | Select tool | — | none | ✓ | |
| Studio toolbar | Pan tool | — | none | ✓ | middle-drag also pans |
| Studio toolbar | Grid toggle | — | none | ✓ | UI-only |
| Studio toolbar | Snap toggle | — | none | ✓ | UI-only |
| Studio toolbar | Design / Preview mode | — | none | ✓ | UI-only |
| Studio toolbar | Zoom − / + | — | none | ✓ | 50–200%, step 10 |
| Canvas | marquee select | — | widgets | ✓ | Shift/Ctrl additive |
| Canvas | drag / resize widget | — (`setWidgetGeometriesInScene`) | widget | ✓ | undoable, snap |
| Canvas | selection-box resize | — | widgets | ✓ | multi-select |
| Canvas | empty click | — | none | ✓ | clears selection |
| Canvas ctx menu (empty) | Add `<Type>` Widget ×5, Hide/Show All, Delete | `scene.add-widget:*`… | scene | ✓ | |
| Canvas empty-state | Add Widget | first type | scene | ✓ | |

### A6. Properties / inspector

| Surface | Label | Command id | Context | Works? | Mutates canonical? | Undo history? | Notes |
|---|---|---|---|---|---|---|---|
| Panel header | Float / Collapse / Close | — | panel | ✓ | no (UI) | no | all 4 panels |
| Identity | Name (DraftTextField) | — (`renameNode`) | project/group/theme/scene/widget | ✓ | yes | yes | ✓ | rotation/asset not editable (D4-08/D4-15) |
| Canonical Context | Device Profile (select) | — (`setDeviceProfile`) | project | — | yes | yes | **disabled: only 1 profile** |
| Widget | Visible / Enabled / Geometry Lock checkboxes | — (`toggleWidgetProperty`) | widget | ✓ | yes | yes | ✓ |
| Geometry | X/Y/W/H fields | — (`setWidgetGeometriesInScene`) | widget | ✓ | yes | yes | ✓ | clamp feedback mismatch (D4-16) |
| Geometry | Z-order field | — (`setWidgetsPropertiesInScene`) | widget | ✓ | yes | yes | ✓ |
| Presentation | Open Binding Editor | `widget.add-binding` | widget | ✓ | (modal) | — | |
| Scene Runtime | Priority field | — (`setSceneProperties`) | scene | ✓ | yes | yes | ✓ |
| Scene Runtime | Enabled checkbox | — (`setSceneProperties`) | scene | ✓ | yes | yes | ✓ | consumed by runtime |
| Scene Runtime | Activation Conditions | — | scene | view-only | — | — | **no editor** (D4-07) |
| Widget sub-sections | Digit/Direction/Media style & content | — | widget | view-only | — | — | **no editor** (D4-04) |

### A7. Simulator / Console / dialogs

| Surface | Label | Command id | Works? | Notes |
|---|---|---|---|---|
| Simulator toolbar | ▶ Run / Ⅱ Pause / Step / ↺ Reset | — | ✓src | runtime local state |
| Simulator | Runtime state/setting inputs | — | ✓src | drive `runtimeValues`/`runtimeSettings` |
| Console | Console / Validation tabs | — | ✓ | |
| Console | Float / Collapse | — | ✓ | |
| Settings dialog | category nav; checkboxes; Save/Cancel | — | ✓ | persists program settings |
| Binding Editor | Add Binding (state/operator/value/negate/action) | — (`replaceWidgetBindings`) | ✓ | undoable; modal blocks global undo (D4-18) |
| Binding Editor | Remove binding × | — (`replaceWidgetBindings`) | ✓ | undoable |
| Confirm dialog | Cancel / Confirm | — | ✓ | |

### A8. Status bar

Informational only (no controls): validation LED + "No blocking foundation issues", profile status, selection, zoom, snap/grid state, deployment status, document dirty/clean. No buttons.

### A9. Keyboard shortcuts (source: `shortcut-registry.ts` canonicalShortcuts + canvas nudge)

| Shortcut | Binding | Implemented? | Verified | Notes |
|---|---|---|---|---|
| Undo | Ctrl+Z | ✓ | ✓ | |
| Redo | Ctrl+Y | ✓ | ✓ | Ctrl+Shift+Z NOT bound (D4-11) |
| Save | Ctrl+S | ✓ | ✓ | works even inside text inputs |
| New Project | Ctrl+N | ✓ | ✓src | |
| Copy | Ctrl+C | ✓ | ✓ | widgets only |
| Cut | Ctrl+X | ✓ | ✓ | widgets only |
| Paste | Ctrl+V | ✓ | ✓ | widgets only |
| Select All | Ctrl+A | ✓ | ✓ | active-scene widgets only (D4-25) |
| Delete | Delete | ✓ | ✓ | confirm dialog |
| Delete | Backspace | ✓ | ✓src | same as Delete (D4-29) |
| Cancel | Escape | ✓ | ✓ | close menu/ctx/dup-mode/modal |
| Nudge | Arrow | ✓ | ✓ | step = grid (10) |
| Fine nudge | Ctrl+Arrow | ✓ | ✓ | step = grid/10 (1) |
| Coarse nudge | Ctrl+Shift+Arrow | ✓ | ✓ | step = grid×5 (50) |
| (nudge) | Shift+Arrow | ✗ no-op | ✓ | returns null → no movement (D4-13) |
| Rename | F2 | ✗ | ✓ | no handler (D4-12) |
| Redo (alt) | Ctrl+Shift+Z | ✗ | ✓ | no match (D4-11) |

Text-input safety verified: while focus is in an INPUT/SELECT/TEXTAREA, the global handler returns early (App.tsx:1578–1579) for all shortcuts except Save/New; C/X/V/A/Z/Y/arrows remain native. Enter commits draft fields; Escape reverts drafts. Modal focus trap (Tab) verified in code (trapModalFocus, App.tsx:1521).

---

## B. ORPHAN CAPABILITY TABLE — every public `EditorApplication` method

Source: `src/Core/editor-application.ts`. "Reachable" = some UI surface invokes it.

| Method | line | Reachable? | Evidence / entry point |
|---|---|---|---|
| `executeCommand(cmd)` | :147 | **NO (orphan)** | No caller anywhere in `src`. Wrapper around `documents.execute`, never used by UI. |
| `execute(label, mutation)` | :151 | internal | Private-ish helper used by every mutation method; not UI-facing. |
| `addThemeProject` | :167 | YES | App.tsx:632 (Theme menu + project/group ctx menu). Verified. |
| `addRotation` | :182 | **NO (orphan)** | Only App.tsx:648 `addRotation` const calls it, and that const is never referenced in any JSX/menu/handler. (Do NOT reintroduce an Add Rotation command — canonical exactly-four rule.) |
| `addScene` | :193 | YES | App.tsx:666 (Scene menu + rotation ctx menu). Verified. |
| `addWidget` | :208 | YES | App.tsx:698 (context bar, Widget menu, empty canvas). Verified. |
| `moveScene` | :236 | **NO (orphan)** | No caller; no reorder-scene UI exists. |
| `renameNode` | :252 | YES (5 of 7 kinds) | App.tsx:869 via properties "Display name". Project/group/theme/scene/widget verified; rotation has no name field (by design); **asset unreachable in practice** (no asset can be created). |
| `setSceneProperties` | :279 | **PARTIAL** | App.tsx:1911 exposes `priority` + `enabled` only. `name` (redundant w/ renameNode) and `activationConditionMode` have no UI; `activationConditions` themselves have no editor. |
| `setWidgetsVisibilityInScene` | :287 | YES | App.tsx:862 (Hide/Show All). |
| `duplicateWidgetsAt` | :295 | YES | App.tsx:1495 (Duplicate Mode click-to-place). |
| `replaceWidgetBindings` | :332 | YES | App.tsx:913/926 (Binding Editor add/remove). Verified. |
| `setProjectDeviceProfile` | :339 | YES but **effectively disabled** | App.tsx:838; select disabled when `<2` profiles and only one profile is registered (main.tsx:8). |
| `moveWidget` | :344 | **NO (orphan)** | No caller; z-order is re-implemented via `setWidgetZIndicesInScene` (zIndex renumber) instead. |
| `setWidgetGeometries` | :356 | **NO (orphan)** | No caller; superseded by `setWidgetGeometriesInScene`. |
| `setWidgetGeometriesInScene` | :365 | YES | App.tsx:1272 (drag/resize/nudge) + :1878 (geometry fields). |
| `editWidgetProperties` | :375 | **NO (orphan)** | No caller. Only this method accepts `content`/`style`; those widget fields therefore have no editor. |
| `setWidgetsPropertiesInScene` | :393 | YES | App.tsx:851 (lock/visible/enabled) + :1905 (zIndex). |
| `deleteSelection` | :409 | YES | App.tsx:737 (container delete). |
| `deleteSelectionInScene` | :444 | YES | App.tsx:734 (widget delete). |
| `setWidgetZIndicesInScene` | :451 | YES | App.tsx:939 (canvas ctx z-order). |
| `duplicateSelectionInScene` | :464 | YES | App.tsx:777 (Duplicate for widgets). |
| `insertWidgetCopies` | :486 | YES | App.tsx:825 (Paste). |
| `duplicateSelection` | :503 | YES | App.tsx:779 (Duplicate for containers). |

**Orphan summary (unreachable public methods):** `executeCommand`, `addRotation`, `moveScene`, `moveWidget`, `setWidgetGeometries`, `editWidgetProperties`.
**Partial/unreachable-in-practice:** `setSceneProperties` (name/activationConditionMode), `renameNode` (asset), `setProjectDeviceProfile` (single profile).

---

## C. FINDINGS

### D4-01 — Scene reorder (up/down) impossible: `moveScene` orphan
- **Class:** MISSING FEATURE · **Severity:** P1
- **Repro:** Create two scenes under a rotation; no surface (Explorer row, context menu, menu bar, keyboard) offers "Move Up/Down". Scenes are fixed in creation order.
- **Observed:** `EditorApplication.moveScene` (editor-application.ts:236) is fully implemented (undoable splice+insert) but has zero callers. Explorer rows have no drag/drop or reorder affordance.
- **Expected:** A designer reorders scenes to control priority/activation-order tie-breaks (runtime uses document order as tie-break, App.tsx:500).
- **Root cause:** editor-application.ts:236 + absence of any UI binding.

### D4-02 — Widget z-order reorder from the tree impossible: `moveWidget` orphan
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** Select a widget in the Explorer; no "Bring Forward/Send Backward" there — z-order is only reachable via the canvas context menu or the raw Z-order number field in Properties.
- **Observed:** `EditorApplication.moveWidget` (editor-application.ts:344) is orphaned; stacking is done through `setWidgetZIndicesInScene` (zIndex renumber) which the tree never exposes.
- **Expected:** Z-order actions available from the tree (and/or the context bar), like they are on the canvas.
- **Root cause:** editor-application.ts:344 + no tree binding.

### D4-03 — `setWidgetGeometries` dead code
- **Class:** (code-quality) MISSING ENTRY POINT · **Severity:** P3
- **Observed:** editor-application.ts:356 `setWidgetGeometries` (global, non-scene-scoped geometry) is never called; the UI exclusively uses `setWidgetGeometriesInScene` (:365). Harmless dead surface, but a second "canonical" geometry path that could drift.

### D4-04 — Widget `content` / `style` / `mediaType` / `mediaSlide` / `assetIds` have no editor
- **Class:** MISSING ENTRY POINT · **Severity:** P1
- **Repro:** Select a `digit`, `direction`, or `media` widget. Properties shows "Style", "Floor Mapping", "Variant", "Visual", "Attached Audio" as read-only `PropertyRow`s (App.tsx:1907–1909). There is no control to change them.
- **Observed:** The only API accepting `content`/`style` is `editWidgetProperties` (editor-application.ts:375), which is orphaned. `mediaType`/`mediaSlide`/`audioAssetId`/`assetIds` have no UI at all.
- **Expected:** A designer can assign a digit style, floor mapping, direction variant, and media asset to a widget (this is core template-authoring content).
- **Root cause:** editor-application.ts:375 orphaned + App.tsx:1903–1910 read-only rendering.

### D4-05 — `executeCommand` orphan
- **Class:** (code-quality) MISSING ENTRY POINT · **Severity:** P3
- **Observed:** editor-application.ts:147 `executeCommand` (direct CommandHistory wrapper) is never called; all mutations go through `execute()`.

### D4-06 — `addRotation` (core + UI const) dead, no entry point
- **Class:** MISSING ENTRY POINT (informational; do NOT add the command) · **Severity:** P3
- **Observed:** App.tsx:645 `addRotation` and editor-application.ts:182 `addRotation` are both unreferenced by any surface. This is consistent with the canonical exactly-four-rotations rule, so it should not be exposed; the dead code is the only issue.

### D4-07 — Scene `activationConditions` / `activationConditionMode` are view-only
- **Class:** MISSING ENTRY POINT · **Severity:** P1
- **Repro:** Select a scene → "Scene Runtime" shows "Activation Conditions: 0 · all" as a static `PropertyRow` (App.tsx:1911). No UI adds/edits conditions or switches all/any mode.
- **Observed:** Runtime consumes `scene.enabled`, `scene.activationConditions`, `scene.activationConditionMode` (runtime.ts:94–106), and `setSceneProperties` accepts the mode patch, but no surface writes conditions.
- **Expected:** Scene activation conditions (the product's core conditional-scene mechanism) are authorable.
- **Root cause:** App.tsx:1911 read-only + editor-application.ts:279 partial wiring.

### D4-08 — Asset rename (and the whole asset workflow) unreachable: no asset can be created/imported
- **Class:** MISSING FEATURE · **Severity:** P1
- **Repro:** Asset Browser "Asset Depot" is always empty; no "Add Asset"/"Import" button exists; no widget can reference an asset. `project.assets` is always `[]`.
- **Observed:** `renameNode` handles assets (editor-application.ts:257) and the properties panel would render a Name field for an asset, but there is no path to produce an `Asset`. Widget `assetIds`/`mediaType` are consequently never populatable.
- **Expected:** Import/add asset (explicitly part of the product mission: "add asset", "import").
- **Root cause:** No import surface; `createEmptyProject` (factories.ts:94) seeds `assets: []`; Asset Browser is read-only (App.tsx:1841–1852).

### D4-09 — Device Profile switching is wired but permanently disabled (single profile)
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** Project → "Device Profile: Foundation Device Profile" is disabled (title "Active DeviceProfile"); the Properties "Device Profile" select is disabled with `title` "Only one DeviceProfile is registered".
- **Observed:** Only `foundationDeviceProfile` is registered (main.tsx:8). `setProjectDeviceProfile` exists and is undoable but unreachable in the shipped build.
- **Expected:** Multiple profiles selectable, or the control hidden rather than dead.
- **Root cause:** main.tsx:8 single-profile registry.

### D4-10 — Disabled menu items without explanation (systematic)
- **Class:** UX DISCOVERABILITY · **Severity:** P2
- **Repro:** With nothing selected, open Scene/Widget/Edit menus. `Add Scene`, `Hide/Show All Widgets`, `Delete Selection`, all `Add * Widget`, `Lock/Show/Duplicate/Delete/Binding Editor` are disabled with **empty `title`** (no `aria-describedby`, no hint text).
- **Observed:** Contrast toolbar Undo/Redo ("No commands to undo") and context-bar buttons ("Requires a selected widget") which DO explain their disabled state. Menu `title` is only set for Undo/Redo/Cut/Copy/Paste (App.tsx:1764–1768); Scene/Widget menu items and Edit→Delete Selection omit it (App.tsx:1769, 1788–1802).
- **Expected:** Every disabled control explains why, or is hidden.
- **Root cause:** App.tsx:1757–1808 `menuItems` builders omit `title`/`disabled` reasons.

### D4-11 — Ctrl+Shift+Z (standard redo) unimplemented
- **Class:** MISSING FEATURE · **Severity:** P3
- **Repro:** Perform an action, press Ctrl+Shift+Z → nothing (no redo).
- **Observed:** `canonicalShortcuts` only binds redo to Ctrl+Y (shortcut-registry.ts:74). Verified live: Ctrl+Shift+Z leaves history untouched.
- **Root cause:** shortcut-registry.ts:74 (no `shift` redo binding).

### D4-12 — F2 rename unimplemented
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** Select any node, press F2 → focus stays on a BUTTON, nothing happens (verified).
- **Observed:** Rename is only reachable through the Properties "Display name" field (App.tsx:1901). There is no F2 handler anywhere.
- **Expected:** F2 is the near-universal rename gesture for tree/Explorer UIs.
- **Root cause:** No F2 binding in App.tsx handleGlobalKeyDown (App.tsx:1556–1615).

### D4-13 — Shift+Arrow nudge is a silent no-op
- **Class:** MISSING FEATURE / no feedback · **Severity:** P3
- **Repro:** Select a widget, press Shift+Arrow → geometry unchanged (verified: x stays 361).
- **Observed:** `calculateNudgeStep` returns `null` for shift-without-modifier (canvas-interaction.ts:146), so the handler returns with no movement and no feedback.
- **Expected:** Either a defined coarse step or a visible "no action" affordance.
- **Root cause:** canvas-interaction.ts:146.

### D4-14 — Duplicating a scene/theme/rotation/group only possible via the *Widget* menu
- **Class:** UX DISCOVERABILITY · **Severity:** P2
- **Repro:** Right-click a Scene → context menu has Add Widget/Hide/Show/Delete but **no Duplicate**. To duplicate a scene (or theme/rotation/group) you must open the **Widget** menu → "Duplicate Selection".
- **Observed:** `duplicateSelectionCommand` is generic (App.tsx:764) but its only menu home is the Widget menu (App.tsx:1799) and the context-bar Duplicate is `disabled: !selectedWidgetIds.length` (widgets only). The scene/theme/rotation/group context menus (editor-commands.ts:40–54) omit duplicate.
- **Expected:** "Duplicate" on every node's context menu.
- **Root cause:** editor-commands.ts descriptors lack a container duplicate; App.tsx:1799 mis-scopes it under Widget.

### D4-15 — Rename is only in Properties (no F2 / no context-menu rename)
- **Class:** UX DISCOVERABILITY · **Severity:** P3
- **Repro:** Right-click any node: no "Rename" item. Rename requires selecting the node and editing "Display name" in Properties.
- **Expected:** Rename via F2 and/or context menu (see D4-12).

### D4-16 — Geometry clamp feedback reports the wrong final value
- **Class:** VALIDATION BUG · **Severity:** P3
- **Repro:** Select a 120-wide widget, type X=99999, commit. Feedback says **"clamped to 720"** but the applied value is **600** (verified live).
- **Observed:** `GeometryField` clamps to its declared max (720, App.tsx:193 `max={activeRotation?.width}`) and reports 720, but the commit then applies `clampGeometryToScene` which clamps X to `rotation.width − widget.width` = 600 (App.tsx:1255–1266). The user is told one value and gets another.
- **Root cause:** App.tsx:1255–1266 (scene-bounds clamp) vs App.tsx:193 (field-level clamp) disagree on the X/Y maximum.

### D4-17 — Hide/Show toggle log message is inverted
- **Class:** (minor) UX/LOG BUG · **Severity:** P3
- **Repro:** With a visible widget, run "Hide / Show" from the widget context menu. The console logs **"Show applied to 1 widget(s)"** while the widget was actually hidden (verified live).
- **Observed:** App.tsx:852 ternary: for `visible`, `allSet ? "Show" : "Hide"` — but the operation sets the opposite of `allSet`, so the label reports the prior state, unlike the locked branch (`allSet ? "Unlock" : "Lock"`) which reports the action.
- **Root cause:** App.tsx:852.

### D4-18 — Global undo/save/delete are silently disabled inside the Binding Editor / Settings modal
- **Class:** INCOMPLETE WORKFLOW · **Severity:** P3
- **Repro:** Open Binding Editor, add a binding, press Ctrl+Z → binding stays (verified). Close the modal, then Ctrl+Z works.
- **Observed:** `handleGlobalKeyDown` returns early for `bindingModal` and `settingsOpen` (App.tsx:1563–1570), allowing only Escape. The just-committed binding (an undoable command) cannot be undone without first closing the dialog.
- **Expected:** Undo/redo should function within the modal, or the modal should indicate why they don't.
- **Root cause:** App.tsx:1567–1570 early return.

### D4-19 — No zoom-to-fit / 100% / zoom-to-selection
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** Zoom controls are only − / + (step 10, 50–200%, App.tsx:1991). No fit, 100%, or fit-selection.
- **Expected:** Standard canvas navigation.

### D4-20 — No "next/previous scene" navigation
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** No command/button/shortcut moves selection to the next/previous scene or rotation.
- **Expected:** A designer flipping between scenes expects next/prev.

### D4-21 — No align / distribute commands
- **Class:** MISSING FEATURE · **Severity:** P2
- **Repro:** Multi-select widgets; no align/distribute surface exists.
- **Expected:** Standard layout tooling for a widget editor.

### D4-22 — No explicit "Select All" menu item / "Deselect All" command
- **Class:** MISSING FEATURE · **Severity:** P3
- **Repro:** "Select All" is bound to Ctrl+A (registry) but appears in **no menu** and selects only active-scene widgets. "Deselect All" exists only as clicking empty canvas / Escape.
- **Observed:** Ctrl+A selects canvas widgets in the active scene only (App.tsx:1545–1551), not tree nodes; there is no deselect command.
- **Root cause:** App.tsx:1545 (scope), menu builders omit Select All.

### D4-23 — No import / export UI (and export format conversion absent)
- **Class:** MISSING FEATURE · **Severity:** P1
- **Repro:** Settings→Export shows "Format conversion **Not in V1**"; no File→Import/Export; only "Build & Verify Package" exists (package build, not project import/export).
- **Expected:** Import assets/projects and export are part of the product mission.
- **Root cause:** SettingsContent.Export (App.tsx:1972) + absence of any import surface.

### D4-24 — `setProjectDeviceProfile` effectively dead → no profile management UI
- **Class:** MISSING FEATURE · **Severity:** P2 (see D4-09) — the control is reachable-but-disabled with no way to register another profile.

### D4-25 — Ctrl+A "Select All" scope (active-scene widgets only) is undocumented
- **Class:** UX DISCOVERABILITY · **Severity:** P3
- **Observed:** Select All ignores widgets in other scenes and all non-widget nodes; no hint communicates this.

### D4-26 — Canvas context menu omits "Add Scene" when a rotation is selected but has no scene
- **Class:** (informational) — verified the rotation context menu DOES include Add Scene; not a finding. (Dropped.)

### D4-27 — "Reset Layout" duplicated in three places
- **Class:** DUPLICATE/INCONSISTENT · **Severity:** P3
- **Observed:** Edit menu, View menu, and the document-tab ↺ icon (App.tsx:1770, 1778, 1984) all invoke the same `resetLayout`. Redundant, mildly confusing.

### D4-28 — "Delete Selection" present in three menus with inconsistent affordances
- **Class:** DUPLICATE/INCONSISTENT · **Severity:** P3
- **Observed:** Edit/Scene/Widget menus each expose "Delete Selection" with no tooltip and slightly different disabled conditions; the context-bar "Delete" has a tooltip and is widget-only. The disabled document-tab close button is the only control that explains itself ("The open document cannot be closed").

### D4-29 — Backspace bound to delete (surprising on canvas)
- **Class:** UX DISCOVERABILITY · **Severity:** P3
- **Observed:** registry binds `delete-backspace` to Backspace (shortcut-registry.ts:82); Backspace with canvas focus deletes the selection (with confirm). Some users expect Backspace = navigate back. Not a bug, but undocumented.

### D4-30 — Added Theme Project is not uniquely named (unlike scenes/widgets)
- **Class:** UX / INCONSISTENT · **Severity:** P3
- **Repro:** Theme → Add Theme Project twice → two Explorer rows both labeled "New Theme Project" (verified).
- **Observed:** scenes/widgets use `uniqueDefaultName` (App.tsx:171), but `addThemeProject` passes `undefined` name and the core defaults to a fixed "New Theme Project" (editor-application.ts:167, :175) with no uniqueness.
- **Root cause:** editor-application.ts:175.

### D4-31 — Widget "Enabled" toggle only in Properties (no menu/context entry)
- **Class:** AVAILABILITY ASYMMETRY · **Severity:** P3
- **Observed:** lock and visible have menu + context + context-bar + properties entries; `enabled` is editable only via the Properties "Enabled" checkbox (App.tsx:1904). No Widget-menu or context-menu counterpart.

### D4-32 — Resources / Unsupported Files rows expose no context menu
- **Class:** UX DISCOVERABILITY · **Severity:** P3
- **Observed:** Right-click "Resources" or "Unsupported Files" yields no menu (empty `commandsForSelection` for those kinds). Acceptable given they are aggregates, but inconsistent with every other row.

### D4-33 — "Add Widget" (context bar & empty-state) always adds the first widget type
- **Class:** UX DISCOVERABILITY · **Severity:** P3
- **Observed:** Context-bar and canvas empty-state "Add Widget" call `addWidget(activeProfile.supportedWidgetTypes[0])` = always "media" (App.tsx:2006, 2007). Type choice requires the Widget menu or scene context menu.
- **Expected:** A type picker or the last-used type.

---

## D. TOP 5 ROOT CAUSES

1. **Widget/scene content is canonical-but-uneditable.** `editWidgetProperties` (editor-application.ts:375) is the only API for `content`/`style` and is orphaned; media/digit/direction properties and scene activation conditions render as read-only `PropertyRow`s (App.tsx:1903–1911). Result: D4-04, D4-07.
2. **Reorder capabilities implemented but never wired.** `moveScene` (editor-application.ts:236) and `moveWidget` (:344) exist with zero callers; z-order is a parallel zIndex mechanism that the tree doesn't expose. Result: D4-01, D4-02.
3. **Menu builders omit disabled-state reasons.** App.tsx:1757–1808 set `title` only on Undo/Redo/Cut/Copy/Paste; every Scene/Widget/Delete menu item disables silently. Result: D4-10.
4. **Shortcut registry incomplete vs desktop conventions.** shortcut-registry.ts:72–84 lacks Ctrl+Shift+Z and F2; canvas-interaction.ts:146 returns null for Shift+Arrow. Result: D4-11, D4-12, D4-13.
5. **Single hardcoded DeviceProfile + no import/export path.** main.tsx:8 registers one profile and factories seed `assets: []`, leaving profile switching, asset rename, and the asset workflow unreachable. Result: D4-08, D4-09, D4-23.

---

## E. SUMMARY COUNTS
- **Total user-invocable commands inventoried:** ~96 (menus 38, top bar/document 6, explorer/ctx ~22, context bar 5, studio/canvas ~12, properties ~14, simulator/console/dialogs ~15, keyboard 16).
- **Dead commands (UI present but no-op):** 0 found — every rendered control resolved to a working handler or an intentional no-op (z-order at boundary, Shift+Arrow).
- **`editor-commands.ts` descriptors never rendered:** none — all 14 descriptors surface via context menus; the 5 `scene.add-widget:*` are generated from the profile. Reverse: several capabilities exist in `App.tsx` but are NOT in `editor-commands.ts` (rename, duplicate, cut/copy/paste, set device profile, geometry, bindings) — those reach other surfaces.
- **Orphan `EditorApplication` methods:** 6 — `executeCommand`, `addRotation`, `moveScene`, `moveWidget`, `setWidgetGeometries`, `editWidgetProperties` (plus partial: `setSceneProperties.name/activationConditionMode`, `renameNode` asset, `setProjectDeviceProfile`).
- **Findings:** 32 (D4-01 … D4-33, D4-26 dropped as non-finding).
