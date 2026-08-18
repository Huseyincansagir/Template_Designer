# Product Completion Ledger — Template Designer V2

Living ledger for the FINAL PRODUCT COMPLETION PASS (branch `manus2`, base HEAD `11cc2c6`).

Severity: **P0** data loss / corruption / impossible core workflow · **P1** major workflow blocked or misleading · **P2** important usability / product gap · **P3** polish.

Classification: `BUG` · `MISSING FEATURE` · `MISSING ENTRY POINT` · `INCOMPLETE WORKFLOW` · `STATE BUG` · `PERSISTENCE BUG` · `UNDO/REDO BUG` · `VALIDATION BUG` · `UX DISCOVERABILITY` · `DEFERRED`.

A *missing feature* is never recorded as a *bug*.

## How the findings were produced

| Source | Method | Findings |
|--------|--------|----------|
| LEAD static (`L-*`) | Full read of `src/**`, `tests/**`, domain/validation/export contracts before touching code | 25 |
| D1 | Live CDP browser pass on widget configuration + asset system | 22 |
| D2 | Live CDP browser pass on theme / rotation / scene lifecycle + navigation | 23 |
| D3 | Live CDP browser pass on project lifecycle, persistence, settings, stress, recovery | 16 |
| D4 | Live command-surface inventory (~96 commands) across every UI surface | 32 |
| D5 | Live pass on properties, bindings, simulator/preview, validation, build | 25 |
| D6 | Static domain↔UI reachability matrix + spec-vs-implementation gap list | 28 |
| LEAD live (`LL-*`) | Four scripted acceptance runs I drove personally against the running app | 6 |

Specialists were read-only; every fix in this pass was made by the lead. Overlapping findings are consolidated below under the lowest ID that reported them, with the corroborating IDs listed.

---

## Ledger

Status: **FIXED** (implemented + covered) · **FIXED-UNTESTED** (implemented, no automated coverage) · **DEFERRED** (recorded, not in this pass) · **WONTFIX** (deliberate product decision) · **NOT-A-DEFECT** (verified working).

### P0 — data loss, corruption or impossible core workflow

| ID | Class | User expectation | Observed | Root cause | Decision | Status |
|----|-------|------------------|----------|------------|----------|--------|
| L-01 (D1-01, D5-24, D6) | MISSING FEATURE | "I can add an image to my project." | Nothing anywhere could create an `Asset`. `project.assets` was permanently `[]`, so the whole asset system, the manifest asset sets and 8 validation rules were unreachable. | No asset command existed in `EditorApplication`; `renderAssets` had no import control. | Added `addAssets`/`addAsset`/`setAssetProperties`/`removeAssets` + `AssetImportSource` adapter + Asset Browser Import/Delete. | **FIXED** |
| L-18 (D3-04, D5-22) | STATE BUG | "Changing device re-sizes my template." | Only `deviceProfileId` changed. Every `Rotation.width/height` kept the old device's numbers, silently invalidating every scene-unit coordinate; widgets were not clamped. | `setProjectDeviceProfile` wrote one field; the UI never passed a display. | `setProjectDeviceProfile(profileId, display)` re-derives all four rotations (R90/R270 swapped) and clamps widgets, in one undoable command; the UI confirms and explains. | **FIXED** |
| D3-02 | PERSISTENCE BUG | "It says Saved, so a reload keeps it." | New Project reported *Saved* but never wrote; a reload silently resurrected the previous project. | `DocumentStore.create` delegated to `open`, which only re-pointed `savedProject`. | `create()` persists through the storage adapter; `adopt()` marks an imported document dirty. | **FIXED** |

### P1 — major workflow blocked or misleading

| ID | Class | User expectation | Observed | Root cause | Decision | Status |
|----|-------|------------------|----------|------------|----------|--------|
| L-02 (D1-02, D5-08) | MISSING FEATURE | "I can point this media widget at my image." | `assetIds`/`mediaType`/`audioAssetId`/`mediaSlide` were read-only rows. The default widget type was non-functional. | Inspector rendered `PropertyRow`s; no command accepted those fields. | `setWidgetConfiguration` + a real Media / Assets section (visual type, slide asset, duration, loop, repeat, slide audio, attached audio, reference list). | **FIXED** |
| L-03 (D1-07) | MISSING FEATURE | "I decide which assets ship with the theme." | `ThemeProject.resources` was a read-only count, so `manifest.resourceAssetIds` could never be non-empty. | No command; no editor. | `setThemeResources` + a checkbox list in the Theme inspector. | **FIXED** |
| L-06 (D1-03, D5-08) | MISSING FEATURE | "I can type the text this text widget shows." | `text` and `warning` widgets had **no** inspector section at all; `digit`/`direction`/`media` were read-only. | No type-specific editors existed. | Per-type editors: text (+ per-language overrides from `profile.languages`), warning message, digit style + value source + floor mapping, direction style + value source, media capability + slide. | **FIXED** |
| L-07 (D1-04, D4) | MISSING ENTRY POINT | — | `editWidgetProperties`, the only writer of `content`/`style`, had zero UI call sites. | Orphan capability. | Superseded by `setWidgetConfiguration`, which the inspector calls; the orphan itself was then deleted (see D6-RACE). | **FIXED** |
| L-09 (D2-02) | MISSING ENTRY POINT | "Let me jump between scenes." | The Explorer tree was the only mechanism; it overflowed at 8 scenes (measured 628px vs 410px viewport). The canvas never named the active scene. | `activeScene` was derived from tree selection. | Scene tab strip with widget counts, live/disabled markers, add / reorder / duplicate, plus Alt+←/→. | **FIXED** |
| L-10 (D2-03) | MISSING ENTRY POINT | "Let me switch to the R90 layout." | Reaching R90 required expanding and clicking the tree; the active rotation had no indicator. | `activeRotation` derived from selection. | Four-button rotation switcher keyed by **angle** (so R90 stays R90 across theme switches), `aria-pressed`, live dimensions, plus Alt+↑/↓. | **FIXED** |
| L-11 | STATE BUG | "Selecting theme 2 shows theme 2." | Selecting the second Theme Project rendered the **first** theme's canvas. | `activeRotation`/`runtimeRotation` fell back to `themeProjects[0].rotations[0]` whenever the selection did not resolve to a rotation. | Explicit navigation state (`activeThemeId`/angle/`activeSceneId`) with a theme switcher and reconciliation. | **FIXED** |
| L-12 (D2-01, D1-22, D5-07) | MISSING FEATURE | "Show this scene when the alarm is on." | `Scene.activationConditions` — the field `runtime.ts` uses to pick the active scene — had no editor. The product could not express a conditional scene. | `setSceneProperties` did not accept it; the inspector showed a count. | `setSceneActivation` + a Scene Activation editor (mode all/any, add/remove conditions, profile-typed values, NOT). | **FIXED** |
| L-15 (D2-05, D2-06) | BUG | "The four rotations are fixed." | `Duplicate Selection` on a Rotation produced a **fifth** rotation; `Delete Selection` produced a **three**-rotation theme. Neither was repairable — there is deliberately no Add Rotation. | `duplicateSelection`/`deleteSelection` accepted rotation ids; `editor-commands` listed `rotation` under delete. | Core refuses rotation ids; the UI refuses **before** prompting and says why; the rotation context menu offers only Add Scene. A follow-up re-check (D2-FEEDBACK) found the *menu affordance* still wrong and fixed it. | **FIXED** |
| L-17 | MISSING FEATURE | "How do I choose a device?" | One profile was registered, so the control was permanently disabled and the menu entry permanently greyed. | `main.tsx` registered a single profile. | Added `compactDeviceProfile` (480×800, image+audio only, all four canonical rotations) and profile choice at New Project. | **FIXED** |
| D5-10 (D6-F3) | BUG | "I can condition on a runtime setting." | The picker offered runtime **settings**, but the condition was written without `source`, so validation reported `UNKNOWN_RUNTIME_REFERENCE` and it could never match — an export-blocking project produced by using the UI as offered. Spec mandates settings (`TEMPLATE_SCHEMA_V1:110`, `:410`). | `addBinding` never set `condition.source`. | `source: "setting"` recorded in both the Binding editor and the Scene Activation editor; setting conditions are labelled in the UI. | **FIXED** |
| D5-11 | MISSING FEATURE | "One rule, two conditions." | Every binding held exactly one condition; `conditionMode: "any"` was unreachable. | Authoring form always created a new single-condition binding. | "Add to" selector extends an existing binding; per-binding Match all/any control; per-condition remove. | **FIXED** |
| D5-12 | INCOMPLETE WORKFLOW | "select-content picks which asset shows." | The actions existed with no `contentId` field, so they were no-ops. | No control; no assets to select. | Content Asset selector appears for `select-content`/`select-style`; the binding card resolves the asset name. | **FIXED** |
| D5-16 (L-21, D1-20) | INCOMPLETE WORKFLOW | "Preview shows what I built." | Every widget type rendered as the same labelled rectangle, so Preview could not be used to check a template. | `renderCanvasWidget` printed name + type only. | Type-aware bodies: text/warning render their text (language-aware), digit renders its bound source or mapped floor value, direction renders a glyph from its style, media renders its asset and slide timing. | **FIXED** |
| D3-01 | MISSING FEATURE | "Name my project and pick its device." | New Project took no input; every project was born "Untitled Project" on the only profile. | `createEmptyProject(name)` had no profile parameter and no dialog. | New Project dialog (name + profile) wired to `createEmptyProject(name, profile)`. | **FIXED** |
| D3-10 | STATE BUG | "Tell me if my project could not be loaded." | A corrupt or incomplete stored project produced a **silent** blank scaffold; the stored data was then overwritten by the next Save. | `load()` returned `null` for every failure; the boot path could not distinguish empty from broken. | `ProjectStorage.read()` reports the reason and preserves the payload under `…v1.rejected`; the boot path logs an ERROR and the Console opens. | **FIXED** |
| D2-07 | MISSING ENTRY POINT | "Add another theme group." | Impossible — the scaffold's single group was permanent and delete refused to remove the last one. | No command. | `addThemeProjectGroup` + Project menu + project context menu. | **FIXED** |
| D4-01 (L-13, D2-04) | MISSING ENTRY POINT | "Reorder my scenes." | `moveScene` existed with zero UI call sites, although scene order is the simulator's activation-order tie-break. | Orphan capability. | Reorder buttons in the scene switcher, Scene menu entries and scene context menu. | **FIXED** |
| D4-23 (L-19, D3-05) | INCOMPLETE WORKFLOW | "Save my project to a file." | Only a single localStorage slot existed. "Open Project" refused whenever the document was dirty — exactly when it is wanted. | No file gateway; `openProject` guarded instead of confirming. | `ProjectFileGateway` (portable `.tdproj.json`) + Import/Export in the File menu; "Revert to Saved" confirms and reports. | **FIXED** |

### P2 — important usability / product gap

| ID | Class | Observed | Decision | Status |
|----|-------|----------|----------|--------|
| L-04 (D1-06, D1-19, D1-21) | BUG | Asset Depot and Unsupported Files were hardcoded empty (`[]` and a literal `0`); two of four categories could never show content. | Depot lists every asset; Unsupported is derived from `profile.supportedFormats`; counts and search are real. | **FIXED** |
| L-05 (D1-15) | STATE BUG | Synthetic `resources`/`unsupported` tree rows selected but resolved to nothing, so the tree showed a selection while the inspector showed its empty state. | Replaced by a real Assets subtree of canonical asset nodes; synthetic container rows are non-selectable, and `selectNode` refuses any unresolvable id. | **FIXED** |
| L-08 (D1-05) | MISSING FEATURE | A widget's type could not be changed; recovery meant delete + recreate, losing geometry, z-order and bindings. | Widget Type select + `setWidgetConfiguration`; the type change clears the old type's config (with a warning) and keeps identity, geometry, z-order and bindings. | **FIXED** |
| L-22 / L-23 (D2-10, D4-09) | UX DISCOVERABILITY | Container commands lived in the wrong menu (duplicating a Scene was in the **Widget** menu); context menus offered container nodes nothing but Delete. | Per-node context menus (rename/add child/duplicate/delete/import asset), a dedicated Asset menu, and Theme/Scene menus that own their own operations. | **FIXED** |
| L-25 (D5-17) | INCOMPLETE WORKFLOW | Run / Pause / Step all collapsed to the same one-shot trace, implying a stepping runtime that does not exist. | Evaluate + Reset, an explicit boundary note, and per-candidate explanations of why each Scene matched or was skipped. | **FIXED** |
| D5-01 | BUG | A non-integer Scene priority (5.5) silently reverted with no feedback. | `DraftNumberField` gained `integer`/`decimals`; it reports "whole numbers only" instead of reverting silently. | **FIXED** |
| D5-02 | BUG | Geometry feedback claimed "clamped to 720" and then committed 600. | The advertised maximum is now the value the scene-bounds clamp will not alter, per field and per selection. | **FIXED** |
| D5-03 (D1-12) | MISSING FEATURE | `enabled: false` had no visible or runtime effect. | Preview omits disabled widgets; Design Mode marks them (dotted border + "disabled" tag). | **FIXED** |
| D5-19 | STATE BUG | Preview Mode could mutate the document (Delete, toggles, add). | Every mutating command refuses in Preview and says so; the confirmation path is guarded too. | **FIXED** |
| D5-20 | UX DISCOVERABILITY | Validation issues named `themeProjectGroups[0]…widgets[3].geometry` and were not navigable. | Paths resolve to stable IDs; each issue renders a button that selects the object, expands its ancestors and opens Properties. | **FIXED** |
| D5-21 | VALIDATION BUG | No rule covered out-of-bounds geometry, empty scenes, scene-less rotations, duplicate scene/widget names or unresolvable styles. | Seven new **warning**-severity rules, so they inform without blocking a build. | **FIXED** |
| D5-05 / D5-06 | UX DISCOVERABILITY | With nothing selected the inspector was empty; project name and device were only reachable by finding the right tree node. | Document properties (name, profile, display, counts, validation) plus a Next Step line; the subtitle describes the actual selection. | **FIXED** |
| D3-06 | STATE BUG | A reload lost the active theme/rotation/scene, zoom, panel tabs and tree expansion. | `WorkspaceSession` persistence keyed by project id, governed by a real Editor setting that clears the store when switched off. | **FIXED** |
| D3-07 | PERSISTENCE BUG | Save was disabled while clean, so a fresh project could not be written until it was mutated. | Save is always enabled and states what it will do. | **FIXED** |
| D3-08 | BUG | Enter did not commit the Settings dialog. | Enter commits, Escape cancels, Cancel reverts. | **FIXED** |
| D3-11 / D3-12 | VALIDATION BUG | The load gate accepted duplicated widget/scene IDs; the document rendered but every scoped command refused it and React reported duplicate keys. | The gate rejects duplicated stable IDs, so the boot path reports it instead of half-loading. | **FIXED** |
| D3-13 | STATE BUG | An unregistered `deviceProfileId` produced a dead canvas with no recovery hint. | The canvas names the problem and offers one button per registered profile. | **FIXED** |
| D2-13 | UX DISCOVERABILITY | An empty rotation offered no way forward. | Empty states offer the action that unblocks them (Add Theme Project / Add Scene / Add Widget). | **FIXED** |
| D2-19 | UX DISCOVERABILITY | The active scene was not obvious while a widget was selected. | The scene tab strip always marks the active scene; the rail label names it in Preview. | **FIXED** |
| D2-23 | UX | "Test Scene" only opened the Simulator without targeting the scene. | "Test Scene in Simulator" opens the panel and writes the runtime trace. | **FIXED** |
| D1-09 / D1-17 | MISSING FEATURE | No asset preview, delete, or used-vs-unused distinction; no assign/replace/remove/reuse. | Per-asset usage counts, delete-with-reference-purge, and assign/replace/remove from the widget inspector. Thumbnail preview stays deferred (see below). | **FIXED** (preview deferred) |
| D1-16 | BUG | Digit/direction style read "Profile default / unresolved" even though the profile declared styles. | Selects list the profile's styles and name the default explicitly. | **FIXED** |
| D1-13 | UX DISCOVERABILITY | Two Add Widget entry points silently added `media` (`supportedWidgetTypes[0]`). | Their tooltips name the type and point at the Widget menu for the others. | **FIXED** |
| D5-14 | MISSING FEATURE | The binding operator list ignored the profile's declared `operators`. | Operators come from the selected reference's declaration. | **FIXED** |
| D5-13 | UX | Bindings could not be edited, only removed and recreated. | Per-binding Match control, per-condition removal, and condition extension. | **FIXED** |
| D6 | STATE BUG | A selected **widget** also rendered its parent Scene's activation editor, the Rotation panel and the Theme resource list. | Ancestor sections follow the selection kind. | **FIXED** (found by lead during live run) |
| LL-01 | BUG | A second Theme Project was created with the same name and did not become the active theme, so the canvas kept showing theme 1. | Unique default names; navigation follows creation. | **FIXED** |
| LL-02 | BUG | Picking a boolean runtime reference for a Scene condition silently committed `false`. | An empty boolean draft commits `true` — picking "Fire" means "when fire holds". | **FIXED** |
| LL-03 | UX | Preview Mode silently showed the Design layout when no Scene activated. | An explicit notice names the situation, the number of scenes evaluated and what to do. | **FIXED** |

### P3 — polish / convenience

| ID | Class | Observed | Decision | Status |
|----|-------|----------|----------|--------|
| L-14 | DEFERRED | `moveWidget` was unreachable and semantically inert (`zIndex` is the canonical stacking source). | Removed as a dead abstraction. | **FIXED** |
| L-16 | DEFERRED | `addRotation` was a latent path to a fifth rotation. | Removed from Core and UI. | **FIXED** |
| L-24 / D5-25 | MISSING FEATURE | No F2, no zoom reset, no scene/rotation shortcuts, no Ctrl+Shift+Z. | Added and wired: `F2`, `Ctrl+0`, `Ctrl+Shift+Z`, and the Alt+Arrow navigation family (Alt is refused by `calculateNudgeStep`, so it can never be confused with a nudge). | **FIXED** |
| D2-12 | POLISH | Scene naming skipped "New Scene 1". | Kept: `New Scene`, `New Scene 2`, … is the conventional sequence. | **WONTFIX** |
| D2-22 | POLISH | A disabled Scene was indistinguishable in the Explorer. | The scene tab strikes through disabled scenes and marks them "off"; the Explorer row is unchanged. | **FIXED-UNTESTED** |
| D3-09 | UX DISCOVERABILITY | Six of nine Settings categories held no settings. | Editor gained a real wired setting; the rest remain informational. Adding settings for their own sake was rejected. | **DEFERRED** |
| D3-14 | PERFORMANCE | Every command deep-clones and stringifies the whole project. | Measured acceptable at 200 widgets (40 KB snapshot, 23 ms mount). Not optimised. | **DEFERRED** |
| D3-15 | UNDO/REDO BUG | With the 100-command cap, >100 edits after a save can never undo back to clean. | Documented; the cap is a deliberate memory bound. | **DEFERRED** |
| D5-04 | STATE BUG | An uncommitted field edit is silently discarded when the selection changes. | Correct-but-quiet. Discarding is the safe behaviour; announcing it is deferred. | **DEFERRED** |
| D2-08 / D2-11 / D2-21 / D5-15 / D5-18 / D1-10 | Various | Empty group after deleting the last theme; no onboarding for the domain vocabulary; no tree filter at 12+ scenes; no warning when a profile switch orphans conditions; partial "why" for scene activation. | Recorded. The activation "why" is now shown per candidate in the Simulator; the rest are deferred. | **DEFERRED** |
| D1-09 (preview) | MISSING FEATURE | No asset thumbnail preview. | Deferred: the browser transport holds no bytes and the V1 package carries logical records only. It belongs with the native adapter. | **DEFERRED** |

### Post-report correction

| ID | Class | Observed | Decision | Status |
|----|-------|----------|----------|--------|
| D6-RACE | UX DISCOVERABILITY | D6 audited the tree while I was editing it and reported the new asset/widget-configuration layer as Core-only dead code. That was accurate at the moment it looked (working tree, 00:33) and was superseded once the UI was wired — but acting on it rather than dismissing it exposed a real inconsistency: I had removed `addRotation` and `moveWidget` as dead abstractions while leaving four more in place. A byte-level re-check of every public `EditorApplication` method found `executeCommand` unreachable and `setWidgetGeometries` (unscoped), `editWidgetProperties` and `addAsset` test-only. | All four deleted; their tests rewritten against the surfaces the product actually uses, preserving the guarantees they covered (locked-widget geometry refusal, malformed-geometry rejection, immutable property edits). A new architecture test enforces the invariant — every published command must have a UI caller, `execute` excepted — and a second one asserts no code path can add or delete a Rotation. Both were verified to fail when deliberately broken. | **FIXED** |
### Post-report correction (second D2 delivery)

D2 re-delivered its report after the fixes had landed. Its headline items were already closed, but two of its findings were about *feedback quality* and I probed them live rather than assuming. All three below were real and unfixed.

| ID | Class | Observed (live probe) | Decision | Status |
|----|-------|----------------------|----------|--------|
| D2-FEEDBACK-1 (D2-05, D2-06) | UX DISCOVERABILITY | With a Rotation selected, `Edit ▸ Delete Selection` and `Widget ▸ Delete/Duplicate Selection` were **enabled with no tooltip**. Clicking logged a warning — better than silent, but the affordance still offered an action the Core always refuses. | Extracted `describeSelectionRefusal(kinds, operation, groupCount)` into `editor-commands.ts` as pure policy. The menu reads it for `disabled` + `title`; the runtime guards stay as defense in depth, so affordance and enforcement cannot drift. | **FIXED** |
| D2-FEEDBACK-2 (D2-09) | UX DISCOVERABILITY | Deleting the only Theme Project Group no longer confirmed-then-refused (already fixed), but the menu entry was still enabled with no reason. | Same policy: disabled, with "A project must keep at least one Theme Project Group". | **FIXED** |
| D2-22 | POLISH | Re-classified from P3-polish to a real gap: the scene tab showed a disabled scene as "off" while the **Explorer row showed only "Priority 0"** — the two surfaces disagreed about the same object. | The Explorer scene row now carries `· disabled` and its activation-condition count. | **FIXED** |

Five unit tests cover the policy, including one that asserts the policy and the Core reach the same verdict for every case — a refusal reason is only honest if the Core actually refuses.
### Verified working — reported and confirmed, no change needed

`D2-14` rotation dimension swap · `D2-15` per-rotation scene/widget isolation · `D2-16` theme/scene undo-redo + save/reload · `D2-17` canonical four rotations on menu-created and duplicated themes · `D2-18` selection pruning · `D4` all 14 command descriptors render and every rendered control resolves to a working handler · `D3` dirty-flag correctness, `beforeunload` + Tauri close guard, 30× undo/redo, 200-widget project usable, all four program settings genuinely consumed.

---

## Out of scope for this pass

| Item | Why |
|------|-----|
| SD-card write / verify / safe-eject | Needs the Tauri fs/dialog plugins, a Rust toolchain (`cargo` is not installed) and real hardware. `SDCardTarget` remains the isolated adapter seam. Never simulated. |
| Binary media in the deployment package (`D5-23`) | The V1 package deliberately carries logical `*.asset.json` records with `binary: false`; materialization belongs to the deployment adapter (`AGENTS.md` package boundary). |
| `bundle.icon` | Needs icon tooling. |
| Floor Mapping **editor** | `FloorMapping` is validated and exported, and the digit inspector selects among existing mappings, but no authoring UI exists. `TEMPLATE_SCHEMA_V1` defines no such structure, so the domain shape is the only definition (D6). |
| `ThemeProject.themeDefaults`, `Project.projectSettings`, `Project.metadata` | Domain-only. Nothing in `runtime.ts` or `export.ts` requires user-authored values. |
| Audio channel / priority authoring | Blocked upstream: the specification contradicts itself on runtime-setting defaults and channel counts (D6 C10d/C10f). Deciding it here would be invention. |
| Multi-document editing | The shell is single-document by design and says so. |
