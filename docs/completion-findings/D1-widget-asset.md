# D1 Findings — Widget System & Asset / Resource System

**Specialist:** DISCOVERY SPECIALIST D1 (read-only, live app + source).
**Repo:** `C:\Users\b1601\Template_Designer` (branch `manus2`).
**Method:** headless Edge (CDP port 9223) against the running Vite app at `http://127.0.0.1:1420/`; every claim below was reproduced live by DOM measurement / text extraction, then root-caused in source. No screenshot interpretation.

> **⚠ Working-tree drift (important to the coordinator).** During this audit the working tree changed under me: `git status` shows `M src/Core/editor-application.ts` and a new untracked `docs/PRODUCT_COMPLETION_LEDGER.md`. `editor-application.ts` was edited at 00:32–00:33 (uncommitted) while I was testing, adding asset + widget-configuration commands to the **Core** layer only. `App.tsx` (mtime 23:52) is unchanged and wires **none** of them. All findings below reflect the state as observed; where the new Core command now exists but has no UI, I say so explicitly, because "the command exists" is not "the workflow exists".

---

## Direct answers to the 15 mission questions

### Widget system (media, digit, direction, warning, text)

1. **Create?** YES for all 5 types. Entry points: (a) `Widget ▸ Add <Type> Widget` menu (5 items, `App.tsx:1796`); (b) canvas right-click context menu on a Scene (5 items, `editor-commands.ts:64-70`); (c) canvas empty-state **Add Widget** button — **media only** (`App.tsx:2006`, `supportedWidgetTypes[0]`); (d) canvas context-bar **Add Widget** button — **media only** (`App.tsx:2007`). All require an active Scene.
2. **Select / move / resize / rename / delete / duplicate / hide / lock?** ALL WORK (verified live). Move changes geometry `300,600 → 390,660`; resize SE handle `120×80 → 230×170`; rename via Identity>Name field; duplicate appends "Copy"; hide removes from canvas + tree shows "Hidden"; lock removes the 8 resize handles and blocks drag; delete requires confirmation (default `confirmDestructive: true`). Undo/redo and Save→reload all correct for these operations.
3. **Widget-specific config after creation?** **NO — this is the core gap.** No type-specific property of any widget is editable. `text` and `warning` have **no inspector section at all**; `digit`/`direction`/`media` sections are read-only `PropertyRow`s (`App.tsx:1907-1909`).
4. **Change `widgetType` / replace widget type?** **NO.** Only delete + recreate (losing geometry/z-order/bindings). Core now has `setWidgetConfiguration` with a `widgetType` patch (`editor-application.ts:401,414-418`), but the UI never calls it.
5. **Set/clear `assetIds`, `mediaType`, `audioAssetId`, `mediaSlide` from UI?** **NO.** All four are read-only/absent in the inspector.
6. **Edit `content` / `style` records from UI?** **NO.** `editWidgetProperties` accepts them (`editor-application.ts:606`) but has zero call sites in `App.tsx`; the new `setWidgetConfiguration` (`editor-application.ts:401`) also accepts them and also has no call site.
7. **Persist + undo/redo?** Persistence and undo/redo are correct for everything the UI *can* change (verified save/reload and undo/redo of add/rename/duplicate/hide/lock/geometry). Irrelevant for the un-editable fields above because they can never be changed.
8. **Inspector fields that look editable but do nothing?** YES: `Media Type: None`, `Asset References: 0`, `Media Slide: None`, `Bindings: 0`, and the `Digit`/`Direction`/`Media` sections render as values with no affordance. The `Enabled` checkbox "works" (state flips) but has **no observable effect** (see D1-13).

### Asset / resource system

9. **Any UI to add/import an asset?** **NO.** No Import/Add/Upload button, no `<input type=file>` (DOM count = 0), no drag-drop. The Asset Browser is a read-only derived view.
10. **List / name / preview / delete / rename assets?** List: only via the two derived categories (`resources`, `scene`), both permanently empty. Name/rename: technically reachable only if an asset could be selected (Identity>Name), but no asset ever exists. Preview/delete: **no**.
11. **Assign / replace / remove / reuse an asset on a widget?** **NO** — no asset exists and no assignment control exists.
12. **See assets in use vs unused?** **NO.** "Asset Depot" (would-be unused) is hardcoded empty; "Scene Content"/"Project Resources" are derived from references that can never be populated.
13. **`ThemeProject.resources` / `ThemeProject.defaultAssetIds` / `Project.defaultAssetIds` reachable?** **NO.** `resources` is a read-only count (`App.tsx:1913`); the two `defaultAssetIds` surfaces are not referenced by the UI at all.
14. **Invalid/missing/unsupported asset reference — understandable validation?** Validation rules exist and are user-readable in the Console/Validation tab (`validation.ts:129-138,302-326,364-368`), but **none can ever fire through the UI** because the UI can neither create assets nor create references. The validation is dead code in the UI.
15. **Asset list survives save/reload? Does add/remove create undo history?** Persistence machinery is sound (localStorage). The question is vacuous via UI because no asset can be created or removed; the *Core* `addAssets`/`removeAssets` (`editor-application.ts:301,342`) are undoable, but the UI never reaches them.

### export.ts / validation.ts cross-check (top severity)

`buildDeploymentPackage` (`export.ts:133-163`) is built **entirely** around assets: `collectResourceAssetIds`, `collectUsedAssetIds`, `collectDefaultAssetIds`, `assetFile`. `validateProject` enforces `ASSET_NAME_REQUIRED`, `ASSET_SOURCE_REQUIRED` (`validation.ts:325-326`), `ASSET_FORMAT_UNSUPPORTED` (`validation.ts:364-368`), `MISSING_REFERENCED_ASSET` (`validation.ts:129-138`), and media-capability rules (`validation.ts:168-213`). A project produced entirely through the UI always has `project.assets: []`, so `manifest.assetIds` is always `[]` and any template containing media is impossible to author. **The build/validation layers demand assets the UI cannot produce.**

---

## Findings

| ID | Sev | Class | Area | One-line |
|----|-----|-------|------|----------|
| D1-01 | P0 | MISSING FEATURE | Assets | No UI can add/import an Asset; the entire Asset/Resource system is unreachable, so no media-bearing template can be authored or built. |
| D1-02 | P0 | MISSING FEATURE | Widgets | A `media` widget can never reference an asset: `assetIds`/`mediaType`/`audioAssetId`/`mediaSlide` are read-only/absent, making the default widget type non-functional. |
| D1-03 | P1 | MISSING FEATURE | Widgets | No widget-specific configuration exists post-creation; `text` and `warning` have **no** inspector section, `digit`/`direction`/`media` are read-only. |
| D1-04 | P1 | MISSING ENTRY POINT | Widgets | The only commands that write `content`/`style` (`editWidgetProperties`, `setWidgetConfiguration`) are never called from the UI. |
| D1-05 | P2 | MISSING FEATURE | Widgets | `widgetType` cannot be changed after creation and a widget cannot be replaced by another type. |
| D1-06 | P2 | BUG | Assets | Asset Browser "Asset Depot" (default tab) and "Unsupported Files" are hardcoded empty, so even imported assets would be invisible in the default view. |
| D1-07 | P1 | MISSING FEATURE | Assets | `ThemeProject.resources` has no editor (read-only count); `ThemeProject.defaultAssetIds` and `Project.defaultAssetIds` have no UI at all. |
| D1-08 | P2 | MISSING ENTRY POINT | Assets | No import source exists (no file picker/drag-drop), so even the new `addAssets(sourcePath)` has no way to obtain a real path in the browser build. |
| D1-09 | P2 | MISSING FEATURE | Assets | No asset preview, no delete-asset UI, no way to distinguish in-use vs unused assets. |
| D1-10 | P2 | INCOMPLETE WORKFLOW | Widgets | Binding Editor offers `select-content`/`select-style` actions but has no `contentId` field and no content/style records to select. |
| D1-11 | P2 | UX DISCOVERABILITY | Widgets | Inspector "Media Type / Asset References / Media Slide / Bindings" look like editable properties but have no affordance and do nothing. |
| D1-12 | P3 | STATE BUG | Widgets | The `Enabled` checkbox has no observable effect in Design mode: the widget stays rendered when `enabled=false`. |
| D1-13 | P3 | UX DISCOVERABILITY | Widgets | Two of four "Add Widget" entry points silently add `media` only (`supportedWidgetTypes[0]`), inconsistent with the menu/context-menu which offer all types. |
| D1-14 | P2 | VALIDATION BUG | Assets | Asset validation rules (`ASSET_SOURCE_REQUIRED`, `MISSING_REFERENCED_ASSET`, …) can never fire through the UI; the rules the export layer relies on are unsatisfiable. |
| D1-15 | P2 | STATE BUG | Explorer/Assets | Synthetic `Resources`/`Unsupported Files` tree nodes select but resolve to nothing → Properties shows empty state with a selected row. |
| D1-16 | P3 | BUG | Widgets | `digit`/`direction` inspector shows "Profile default / unresolved" for style even though the profile defines `digit-default`/`direction-default` styles. |
| D1-17 | P2 | MISSING FEATURE | Assets | No asset reuse/replace/remove workflow; one asset cannot be attached to multiple widgets (unreachable end-to-end). |
| D1-18 | P3 | INCOMPLETE WORKFLOW | Assets | Asset add/remove undo history exists only in Core (`addAssets`/`removeAssets`); no UI reaches it, so the undoable asset workflow is untestable. |
| D1-19 | P2 | MISSING ENTRY POINT | Assets | The two data-backed Asset Browser categories (`resources`, `scene`) are permanently empty because their reference sources can't be populated. |
| D1-20 | P2 | MISSING FEATURE | Preview | Canvas renders every widget as an identical labelled rectangle regardless of type, so Preview cannot represent what was built (media/digit/direction/warning/text indistinguishable). |
| D1-21 | P3 | BUG | Assets | Asset search + category filters operate on an always-empty set; the whole Asset Browser is a dead surface in the current build. |
| D1-22 | P2 | MISSING ENTRY POINT | Widgets | No Scene activation-condition editor: `Scene.activationConditions` is a read-only count, though it is the field that decides runtime Scene selection. |

---

## D1-01 — No UI can add/import an Asset (P0 · MISSING FEATURE)

- **Repro:** Open the app (fresh scaffold). Click the **Assets** dock tab. Observe `Asset Depot is empty`, `Project Resources 0`, `Scene Content 0`, `Unsupported Files 0`. Search the entire DOM for import/add/upload controls: no button, no `<input type="file">` (count 0), no drag-drop. Inspect every menu (File/Edit/View/Project/Theme/Scene/Widget/Tools) — none references assets.
- **Observed:** `project.assets` is always `[]`. The Asset Browser renders only two derived categories that read `project.assets`, so it is permanently empty.
- **Expected:** An "Import Asset" / "Add Asset" entry point (file picker or drag-drop) that creates `Asset {id,name,sourcePath,mediaType,metadata}` records, visible in the depot.
- **Root cause:** `renderAssets` (`App.tsx:1841-1852`) has no create/import control; the original `EditorApplication` had no asset command. (The working tree now adds `addAssets`/`addAsset` at `editor-application.ts:301-315`, but `App.tsx` still never calls them — `grep` for `addAssets|addAsset|importAsset` in `App.tsx` returns nothing.)
- **Impact:** The product cannot author a project that contains any real media; `buildDeploymentPackage` yields `manifest.assetIds: []` and no asset files (`export.ts:133-163`). This is the highest-severity finding in this area.

## D1-02 — A `media` widget can never reference an asset (P0 · MISSING FEATURE)

- **Repro:** Add a Scene, add a `media` widget (the default). Select it; open Properties. The `Presentation` section shows `Asset References: 0`, `Media Type: None`, `Media Slide: None`; the `Media` section shows `Visual: Not selected`, `Attached Audio: None`. None are editable.
- **Observed:** No control sets `widget.assetIds`, `widget.mediaType`, `widget.audioAssetId` or `widget.mediaSlide`.
- **Expected:** A media-type picker (`image|video|audio`) and an asset picker that writes `assetIds`/`mediaType`, plus an audio picker for `audioAssetId` and a media-slide editor.
- **Root cause:** `App.tsx:1906` renders all four as read-only `PropertyRow`s; `App.tsx:1909` renders the media section read-only. The new Core `setWidgetConfiguration` (`editor-application.ts:401`) accepts exactly these fields but has no UI call site.
- **Impact:** The default widget type is fundamentally non-functional; an elevator display template cannot show media content.

## D1-03 — No widget-specific configuration UI (P1 · MISSING FEATURE)

- **Repro:** Create each of media/digit/direction/warning/text. Select each and inspect Properties.
  - `media` → "Media" section (read-only Visual / Attached Audio).
  - `digit` → "Digit" section (read-only Style / Floor Mapping).
  - `direction` → "Direction" section (read-only Style / Variant).
  - `warning` → **no section at all**.
  - `text` → **no section at all**.
- **Observed:** A `text` widget can never be given text; a `warning` widget can never be given warning content; a `digit` can never choose `digit-default`; a `direction` can never choose among `direction-default/direction-up/direction-down` (`factories.ts:28-30`).
- **Expected:** A type-specific editor per widget type, writing `content`/`style` records.
- **Root cause:** `App.tsx:1907-1909` renders only three conditional read-only sections; there is no `text` or `warning` branch and no editable field. `editWidgetProperties`/`setWidgetConfiguration` (both accept `content`/`style`) are never called from `App.tsx`.

## D1-04 — `content`/`style` write commands are dead code (P1 · MISSING ENTRY POINT)

- **Repro:** There is no UI surface that reaches `content` or `style`. `grep` of `App.tsx` for `editWidgetProperties|setWidgetConfiguration|setAssetProperties|setThemeResources` returns no call sites.
- **Root cause:** `editWidgetProperties(sceneId, widgetId, patch)` accepts `content`/`style` (`editor-application.ts:606`) but is only referenced by tests; the new `setWidgetConfiguration` (`editor-application.ts:401`) likewise. The UI layer (`App.tsx`) performs only geometry/name/enabled/visible/locked/zIndex mutations via `setWidgetsPropertiesInScene`.
- **Impact:** The domain model's `content`/`style` records (used by `export.ts:44-45`, `runtime.ts`, `validation.ts`) are permanently un-editable.

## D1-05 — `widgetType` cannot be changed after creation (P2 · MISSING FEATURE)

- **Repro:** Select any widget; Properties `Widget Type` is a read-only value (`App.tsx:1904`). No menu/context action changes it.
- **Expected:** A "Convert to…" or type dropdown (profile-filtered) that re-types the widget, clearing incompatible `content`/`style`/media fields.
- **Root cause:** No UI calls the type-change path. The new `setWidgetConfiguration` does implement the clearing semantics (`editor-application.ts:414-418`: `typeChanged` clears `content/style/mediaType/audioAssetId/mediaSlide`), but it is unreachable.

## D1-06 — "Asset Depot" and "Unsupported Files" hardcoded empty (P2 · BUG)

- **Repro:** Open Asset Browser. Default tab is "Asset Depot" → always `Asset Depot is empty`; "Unsupported Files" → always `Unsupported Files is empty`. Counts show literal `0` (`App.tsx:1846`).
- **Root cause:** `assetsForCategory` returns `[]` for every category except `resources`/`scene` (`App.tsx:1839`). The depot should list `project.assets` (at minimum unreferenced assets), but it is hardcoded to nothing. `filteredAssets` then always yields `[]` (`App.tsx:1840`).
- **Impact:** Even after assets can be imported (Core `addAssets`), they would still be invisible in the default depot tab — a latent P1 the moment import lands.

## D1-07 — `ThemeProject.resources` / `defaultAssetIds` unreachable (P1 · MISSING FEATURE)

- **Repro:** Select a Theme Project in the tree. Properties shows `Resources: 0` (read-only), `Floor Mappings: 0` (read-only) (`App.tsx:1913`). No UI references `theme.defaultAssetIds` or `project.defaultAssetIds`.
- **Root cause:** `theme.resources` (the field that drives `manifest.resourceAssetIds`, `export.ts:67-71`) has no editor; the working tree adds `setThemeResources` (`editor-application.ts:383`) but no UI. `ThemeProject.defaultAssetIds` and `Project.defaultAssetIds` have **no command at all**, even in the new Core.
- **Impact:** The "ship these assets with the theme" declaration can never be authored.

## D1-08 — No import source for `sourcePath` (P2 · MISSING ENTRY POINT)

- **Repro:** There is no `<input type=file>`, no drag-drop, no path entry. In the browser build there is no way to obtain a real `sourcePath`.
- **Root cause:** The new Core `addAssets` consumes `AssetDraft.sourcePath` (`editor-application.ts:8-13`) but the UI never produces a draft; the file-selection step does not exist.
- **Impact:** Even wiring `addAssets` to a button would still need a file-picker/Tauri fs adapter; the "Asset" record is a logical path string with no producer.

## D1-09 — No preview / delete / used-vs-unused (P2 · MISSING FEATURE)

- **Repro:** Asset Browser rows (if any ever existed) show only a type glyph + name + mediaType + id (`App.tsx:1848`). No thumbnail, no delete control, no "unused" filter.
- **Root cause:** No preview rendering; `removeAssets` (`editor-application.ts:342`) has no UI; "Asset Depot" (the would-be unused list) is hardcoded empty (D1-06).

## D1-10 — `select-content`/`select-style` binding actions are non-functional (P2 · INCOMPLETE WORKFLOW)

- **Repro:** Open Binding Editor on any widget; the Action dropdown offers `select-content` and `select-style` (`App.tsx:2020`). Add one. Observe the binding is created with no `contentId`; the card shows `content/style: presentation`.
- **Root cause:** `addBinding` builds the binding with `action` only and never sets `contentId` (`App.tsx:907-913`); there is no `contentId` field in the authoring form. There are also no `content`/`style` records to select (D1-03/D1-04). The runtime's `select-content`/`select-style` path depends on `binding.contentId` (`runtime.ts`), which is never populated.
- **Impact:** Two of nine offered actions are dead ends — misleading to the user.

## D1-11 — Read-only-looking inspector properties (P2 · UX DISCOVERABILITY)

- **Repro:** Select any widget. `Media Type`, `Asset References`, `Media Slide`, `Bindings` appear as property rows but have no input, no button, no affordance (`App.tsx:1906`).
- **Impact:** These read as "not configured yet" rather than "not supported", inviting a dead-end. Users searching for the media/asset workflow will find only inert rows.

## D1-12 — `Enabled` toggle has no observable effect (P3 · STATE BUG)

- **Repro (verified live):** Select a widget, uncheck `Enabled` in Properties. The canvas still renders the widget (`canvas-widget` count unchanged, `aria-label` unchanged).
- **Root cause:** `renderCanvasWidget` renders any widget whose `visible` is true, ignoring `enabled` (`App.tsx:1743-1749`). `enabled` only filters marquee/hit-test/snap-target (`canvas-interaction.ts:319,324`, `App.tsx:1393`).
- **Impact:** "Enabled" next to "Visible" implies the widget stops appearing; it does not. Misleading.

## D1-13 — Two "Add Widget" buttons silently add only `media` (P3 · UX DISCOVERABILITY)

- **Repro:** Use the canvas empty-state "Add Widget" or the context-bar "Add Widget" → a `media` widget is always created, with no type choice.
- **Root cause:** Both call `addWidget(activeProfile.supportedWidgetTypes[0])` (`App.tsx:2006` and `App.tsx:2007`).
- **Impact:** Inconsistent with the Widget menu / Scene context menu, which offer all five types.

## D1-14 — Asset validation rules are unsatisfiable via UI (P2 · VALIDATION BUG)

- **Repro:** Cannot create a broken or valid asset reference through the UI, so none of `ASSET_NAME_REQUIRED`, `ASSET_SOURCE_REQUIRED`, `ASSET_FORMAT_UNSUPPORTED`, `MISSING_REFERENCED_ASSET`, `AUDIO_ASSET_TYPE_INVALID`, `MEDIA_ASSET_TYPE_INVALID` (`validation.ts:129-138,302-326,364-368`) can ever fire or be resolved.
- **Impact:** The validation/export layers enforce an asset contract the UI cannot produce or repair; combined with D1-01 this is the cross-cutting block the mission flags as top severity.

## D1-15 — Synthetic `Resources`/`Unsupported Files` nodes select to empty Properties (P2 · STATE BUG)

- **Repro:** Click `Resources` or `Unsupported Files` in the tree. The row highlights, but Properties shows `Document Properties · Nothing selected`.
- **Root cause:** These are synthetic ids (`App.tsx:1115-1116`) that `resolveCanonicalNode` cannot resolve (`App.tsx:131-149`), so `resolvedSelection` is `undefined` while `selection` is set.

## D1-16 — "Profile default / unresolved" style label is misleading (P3 · BUG)

- **Repro:** Select a `digit`/`direction` widget. Style shows `Profile default / unresolved` even though the profile defines `digitStyles: ["digit-default"]`, `defaultDigitStyleId: "digit-default"`, and three direction styles (`factories.ts:28-30`).
- **Root cause:** `App.tsx:1907-1908` prints `widget.style?.digitStyleId ?? "Profile default / unresolved"`; the "unresolved" wording implies an error where there is none (the default is actually defined).

## D1-17 — No asset reuse/replace/remove workflow (P2 · MISSING FEATURE)

- **Repro:** No control attaches an asset to a widget, detaches it, replaces it, or shares it across widgets.
- **Root cause:** No asset exists (D1-01) and no assignment control exists (D1-02). The model supports reuse (`assetIds` arrays), but the UI cannot express it.

## D1-18 — Asset add/remove undo history exists only in Core (P3 · INCOMPLETE WORKFLOW)

- **Repro:** Cannot exercise asset add/remove undo through the UI.
- **Root cause:** `addAssets`/`removeAssets` are undoable (both use `execute`, `editor-application.ts:301-375`), but no UI reaches them. `removeAssets` correctly purges references (widgets/themes/bindings) in one command.

## D1-19 — Data-backed Asset Browser categories permanently empty (P2 · MISSING ENTRY POINT)

- **Repro:** `Project Resources` and `Scene Content` both show `No assets in this scope`.
- **Root cause:** They derive from `theme.resources` and `widget.assetIds` (`App.tsx:1837-1838`), neither of which can be populated.

## D1-20 — Preview cannot represent any widget's content (P2 · MISSING FEATURE)

- **Repro:** Switch to Preview. Every widget is the same labelled rectangle (`App.tsx:1749`); media/digit/direction/warning/text are visually identical.
- **Impact:** The designer cannot verify what a template will show, which defeats the Preview workflow (see also LEAD L-21).

## D1-21 — Asset search/filter operates on an always-empty set (P3 · BUG)

- **Repro:** Type anything in Asset search; no result ever appears.
- **Root cause:** `filteredAssets` filters `assetsForCategory` (`App.tsx:1840`), which is `[]` for depot/unsupported and empty for the derived categories (no references).

## D1-22 — No Scene activation-condition editor (P2 · MISSING ENTRY POINT)

- **Repro:** Select a Scene; Properties shows `Activation Conditions: 0 · all` (read-only, `App.tsx:1911`). No control edits them.
- **Root cause:** `Scene.activationConditions` decides runtime Scene selection (`runtime.ts:105`) but is only a count in the UI. The working tree adds `setSceneActivation` (`editor-application.ts:495`) but no UI. (Also in LEAD L-12.)

---

## Positive results (things that DO work — for honest completeness)

- Widget creation for all 5 profile types via menu + Scene context menu.
- Select (click/tree/marquee), move (drag), resize (8 handles), rename, delete (with confirm), duplicate, duplicate-mode, hide, lock.
- Geometry X/Y/W/H fields edit with clamping (`GeometryField`), Z-order field edits.
- Undo/redo for every reachable mutation; Save + reload persists the project (localStorage key `template-designer.project.v1`).
- `removeAssets` (Core, new) is reference-complete — purges widget/themes/binding references atomically and undoably, which is the correct design for when a UI lands.
