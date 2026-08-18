# Product Completion Ledger — Template Designer V2

Living ledger for the FINAL PRODUCT COMPLETION PASS (branch `manus2`, base HEAD `11cc2c6`).

Severity: **P0** data loss / corruption / impossible core workflow · **P1** major workflow blocked or misleading · **P2** important usability / product gap · **P3** polish.

Classification: `BUG` · `MISSING FEATURE` · `MISSING ENTRY POINT` · `INCOMPLETE WORKFLOW` · `STATE BUG` · `PERSISTENCE BUG` · `UNDO/REDO BUG` · `VALIDATION BUG` · `UX DISCOVERABILITY` · `DEFERRED`.

A *missing feature* is never recorded as a *bug*.

---

## Phase 1 — LEAD static findings (confirmed by source reading before any live pass)

| ID | Sev | Class | Area | One-line |
|----|-----|-------|------|----------|
| L-01 | P0 | MISSING FEATURE | Assets | No capability anywhere can add an Asset to a Project — `EditorApplication` has no asset command and `addAsset` does not exist in the repository. |
| L-02 | P1 | MISSING FEATURE | Assets | A Widget's `assetIds` / `mediaType` / `audioAssetId` / `mediaSlide` can never be set: the inspector renders them as read-only `PropertyRow`s (`App.tsx:1906,1909`) and no command accepts them. |
| L-03 | P1 | MISSING FEATURE | Assets | `ThemeProject.resources` (the field that decides `manifest.resourceAssetIds` in `export.ts:69`) has no editor; it is a read-only count (`App.tsx:1913`). |
| L-04 | P2 | BUG | Assets | Asset Browser "Asset Depot" and "Unsupported Files" categories are hardcoded empty (`App.tsx:1839` returns `[]`, `App.tsx:1846` prints literal `0`) — two of four categories can never show content. |
| L-05 | P2 | STATE BUG | Explorer | Tree nodes `resources` and `unsupported` (`App.tsx:1115-1116`) are synthetic ids that `resolveCanonicalNode` cannot resolve; selecting one sets `selection` but leaves `resolvedSelection` undefined, so Properties shows its *empty* state while the tree shows a selected row. |
| L-06 | P1 | MISSING FEATURE | Widgets | No widget-specific configuration exists after creation. `text` and `warning` widgets have **no** inspector section at all; `digit` / `direction` / `media` sections are read-only (`App.tsx:1907-1909`). A `text` widget can never be given text. |
| L-07 | P1 | MISSING ENTRY POINT | Widgets | `EditorApplication.editWidgetProperties` — the only command that can write `content` / `style` — is never called from `App.tsx` (call sites: `editor-application.ts:375` + tests only). |
| L-08 | P2 | MISSING FEATURE | Widgets | A Widget's `widgetType` cannot be changed after creation; the only recovery is delete + recreate, losing geometry, z-order and bindings. |
| L-09 | P1 | MISSING ENTRY POINT | Scenes | No scene switcher exists. `activeScene` is derived from Explorer selection (`App.tsx:1121`); the Explorer tree is the only navigation mechanism and degrades badly with many scenes. |
| L-10 | P1 | MISSING ENTRY POINT | Rotations | No rotation switcher exists. `activeRotation` is derived from selection (`App.tsx:1120`); reaching R90 requires expanding and clicking the tree. |
| L-11 | P1 | STATE BUG | Themes | `activeRotation` and `runtimeRotation` fall back to `group?.themeProjects[0]?.rotations[0]` (`App.tsx:496,1120`). Selecting the **second** Theme Project (whose `resolvedSelection.rotation` is undefined) therefore renders the **first** theme's canvas — the editor silently shows the wrong theme. |
| L-12 | P1 | MISSING FEATURE | Scenes | `Scene.activationConditions` — the field that decides which Scene the device shows at runtime (`runtime.ts:105`) — has no editor. `setSceneProperties` does not even accept it (`editor-application.ts:279`); the inspector shows a count (`App.tsx:1911`). The product cannot express "show this Scene when that state holds". |
| L-13 | P2 | MISSING ENTRY POINT | Scenes | `EditorApplication.moveScene` is unreachable from the UI (call sites: `editor-application.ts:236` + tests). Scene document order is the simulator's activation-order tie-break (`App.tsx:500-504`), so ordering has real semantics and no control. |
| L-14 | P3 | DEFERRED | Widgets | `EditorApplication.moveWidget` is unreachable and semantically inert — `zIndex` is the canonical stacking source, so widget document order carries no product meaning. Dead abstraction. |
| L-15 | P1 | BUG | Rotations | Canonical rule violation: with a Rotation selected, `Widget ▸ Duplicate Selection` reaches `duplicateSelection` (`editor-application.ts:519-521`) and produces a **fifth** rotation; `Delete Selection` accepts kind `rotation` (`editor-commands.ts:53`) and produces a **three**-rotation theme. Neither is recoverable from the UI because there is deliberately no Add Rotation command. |
| L-16 | P3 | DEFERRED | Rotations | `EditorApplication.addRotation` and the dead `addRotation` helper (`App.tsx:645`) still exist as a latent path to a fifth rotation. |
| L-17 | P1 | MISSING FEATURE | Project | Only one DeviceProfile is registered (`main.tsx:8`), so the Device Profile control is permanently disabled (`App.tsx:1902`) and the Project menu entry is permanently disabled (`App.tsx:1782`). "How do I choose a device?" has no answer. |
| L-18 | P0 | STATE BUG | Project | `setProjectDeviceProfile` writes only `deviceProfileId` (`editor-application.ts:339-342`). Every `Rotation.width/height` keeps the **old** device's dimensions, so switching profile silently corrupts the geometry contract, and widgets can be stranded outside the new display. |
| L-19 | P2 | INCOMPLETE WORKFLOW | Project | "Open Project" only re-reads the single localStorage slot (`App.tsx:599-627`). There is no project file open/save-as/import/export, so a project cannot leave the machine or be backed up, and the menu label overstates what happens. |
| L-20 | P2 | MISSING FEATURE | Project | New Project takes no name and no device profile (`App.tsx:562`); every project is born "Untitled Project" on the single profile. |
| L-21 | P2 | INCOMPLETE WORKFLOW | Preview | Every widget renders as a labelled rectangle regardless of type (`App.tsx:1749`). Preview cannot represent what the designer built, so it cannot be used to check a template. |
| L-22 | P2 | UX DISCOVERABILITY | Menus | Container-level commands live in the wrong menu: `Duplicate Selection` for a Scene/Theme is only in the **Widget** menu (`App.tsx:1799`); the Scene menu has no duplicate/reorder and the Theme menu has only Add. |
| L-23 | P2 | MISSING ENTRY POINT | Explorer | The tree context menu is the only per-node action surface and it offers nothing for `project` / `theme-group` / `theme` / `rotation` beyond delete (`editor-commands.ts:41-54`): no rename, no add-child, no duplicate. |
| L-24 | P3 | MISSING FEATURE | Keyboard | No `F2` rename, no zoom-to-fit / zoom-100%, no scene or rotation navigation shortcut. |
| L-25 | P2 | INCOMPLETE WORKFLOW | Simulator | `Run` / `Pause` / `Step` all collapse to the same one-shot trace (`App.tsx:1922-1944`); `simulationStatus` has no effect beyond enabling the Pause button. The controls imply a stepping runtime that does not exist. |

Evidence for every row above is a direct source citation; nothing in Phase 1 required the browser.

---

## Phase 2 — Discovery specialist findings

Recorded per specialist after each report lands. See `## Consolidated decisions` for what was implemented.

---

## Consolidated decisions

Filled in as work completes.
