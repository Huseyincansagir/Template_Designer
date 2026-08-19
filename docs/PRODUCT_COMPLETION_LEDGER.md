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
| D5-04 | NOT-A-DEFECT | Re-tested against the running app with an instrumented probe. The premise does not hold: an uncommitted field edit is **not** lost. Every selection change goes through a pointer interaction that blurs the input first, so `commit()` runs with the pre-change closure and writes the pending text to the object it was typed for; the field then rebinds to the newly selected object. Verified with stable IDs on both sides. The keyboard paths that could change selection without a blur are excluded while an input has focus. | Recorded as verified behaviour, not a gap. Two defensive changes were kept on their own merits and labelled as such in the source: commit handlers now name their target instead of reading ambient selection, and each draft carries the identity it was typed for. A/B testing showed the latter makes no observable difference today. | **NOT-A-DEFECT** |
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
### Correction to my own reporting (D5 re-delivery)

While re-checking D5-04 I stated in the session that an uncommitted edit committed to the **wrong object**, and wrote that claim into three source comments. **That was wrong.** The probe that produced it clicked a canvas widget whose coordinates were occluded by an overlapping widget, so the selection never moved and the rename correctly hit the already-selected object. An instrumented probe reading stable IDs on both sides of the interaction showed no mis-target, and an A/B of the display logic showed no behavioural difference.

What I did about it: replaced the unsupported claims in the source comments with what the evidence supports, re-classified D5-04 as NOT-A-DEFECT with the reasoning above, and kept the two changes only because they are defensible independently — a command that names its target is better than one that reads ambient state, and both are now labelled "defensive, no reproduced defect" rather than presented as bug fixes.

Method note for anyone re-running this: coordinate-based clicks on the canvas are unreliable when widgets overlap, because Add Widget cascades by one grid step. Assert that the selection actually changed (stable ID before vs after) before drawing any conclusion from a canvas click.
### Post-report correction (D4 re-delivery)

D4's re-delivered inventory was measured against the pre-fix baseline, so its orphan list and its missing-shortcut findings were already closed. Four items were genuinely open, and one was a defect nobody had caught:

| ID | Sev | Class | Observed | Decision | Status |
|----|-----|-------|----------|----------|--------|
| D4-17 | P3 | BUG | The visibility toggle logged the **inverse** of what it did: `allSet` means every selected widget is already visible, so the command hides them — and the log said "Show". Confirmed live, then fixed and asserted in both directions. `locked` and `enabled` were correct. | Label reads the action, not the prior state. | **FIXED** |
| D4-21 | P2 | MISSING FEATURE | No align or distribute. For a layout tool this is the last missing geometry operation — a row of floor indicators could only be lined up by typing coordinates. | `calculateAlignUpdates` (6 operations) and `calculateDistributeUpdates` (2) added to `canvas-interaction.ts` as pure functions, wired to the Widget menu, committed as one undoable geometry command through the existing scene-bounds path. Sizes never change; the outermost widgets keep their position when distributing; an already-aligned selection is refused rather than recorded; a distribution that cannot preserve the outer widgets is refused with the reason. 6 unit tests + 4 live checks. | **FIXED** |
| D4-19 / D4-22 / D4-31 | P2/P3 | MISSING FEATURE | No Zoom to Fit, no Deselect All, and `enabled` was reachable only as an inspector checkbox. | All three added as commands with disabled reasons. | **FIXED** |
| D4-25 / D4-29 / D4-13 | P3 | UX DISCOVERABILITY | Three bound keys were undocumented: Backspace (delete), the Alt navigation family, and the deliberate Shift+Arrow no-op; the Select All scope was also unstated. The Shortcuts page actively filtered Backspace out. | The page now lists every registry entry and states the nudge ladder, the Select All scope, the Delete/Backspace equivalence and that Alt+Arrow never moves geometry. | **FIXED** |

Deliberately not acted on: `D4-27` (Reset Layout in three places) and `D4-28` (Delete Selection in three menus) are intentional multi-surface access, now with consistent reasons from the shared refusal policy. `D4-24` (profile management UI) stays out of scope — profiles are firmware-supplied capability data, not user-authored content.
### Post-report correction (D6 re-delivery, integrity batch)

D6 re-delivered its matrix pinned to base HEAD `11cc2c6`, so its ranked F1–F7/F10/F11/F21/F25 were already closed. Eight findings were genuinely open. One was a deployment-honesty violation and one was a contract violation against `AGENTS.md`.

| ID | Sev | Class | Observed | Decision | Status |
|----|-----|-------|----------|----------|--------|
| F9 | P1 | STATE BUG | `deploymentStatus` was never invalidated by edits, so the status bar kept reading **"Built · checksum verified"** after the document changed. `AGENTS.md` forbids claiming success before verification completes; claiming it for a document the package no longer describes is the same violation. | The identity of the built document is recorded; any change withdraws the claim, resets the status to "Not built · project changed since the last package", drops the retained package and logs the withdrawal. | **FIXED** |
| F16 | P1 | MISSING ENTRY POINT | `AGENTS.md` mandates `UI → Application Service → Platform/Deployment Adapter`, but the editor called `buildDeploymentPackage` directly. The whole adapter plane had no caller and `SDCardTarget` was imported by nothing — the seam existed on paper only. | New `Core/deployment-service.ts` owns build-plus-verify and the adapter registry; the UI calls it and never learns the transport. `SDCardTarget` is registered, and its refusal ("reserved for a later phase") now reaches the user through the sanctioned chain via a new **Write Package to Target…** command, instead of the transport being invisible. A package that is not verified is refused before any write. 4 tests. | **FIXED** |
| F13 | P1 | STATE BUG | `enabled: false` widgets were rendered but **unclickable and un-marquee-selectable** — `hitTest` and `marqueeSelection` both filtered on `enabled`. `enabled` is a runtime presentation flag; `locked` is the design-time guard. A widget you can see, that is labelled "disabled", that you cannot select, is not repairable on the canvas. | Both filters now use `visible` only. The test that claimed to cover this was **vacuous** — its disabled fixture sat outside the marquee, so geometry excluded it and the flag was never exercised. Replaced with one that places all three inside the marquee and asserts the corrected contract. | **FIXED** |
| F20 | P2 | BUG | Duplicate, duplicate-at-point and paste all applied a +10/+10 offset with no bounds check, stranding copies outside the Rotation. | All three copy paths clamp to the owning Rotation in Core, where the rotation is already in hand. | **FIXED** |
| F23 | P2 | UNDO/REDO BUG | Duplicating a Theme or Scene returned `createdIds: []` — the id map only covered widgets — so the UI logged success while leaving the selection on the original and never revealing the copy. | Container copies collect their allocated ids; Duplicate Scene now selects the copy it made. | **FIXED** |
| F14 | P1 | VALIDATION BUG | The operator list fell back to all five when a profile declared none, so `contains` could be chosen for a boolean: a condition that passes validation and can never match. | `operatorsForType` derives the operators a type can actually match; a declared list still wins. Verified live: boolean offers `equals, not-equals`; integer offers the comparisons. | **FIXED** |
| F22 | P2 | UX DISCOVERABILITY | `RuntimeStateDefinition.simulator`, `.category` and `.description` were ignored — the Simulator dumped every state unordered, including ones the device supplies. | Only `simulator: true` states are offered, grouped by `category`, with `description` as the tooltip, and the count of device-supplied states is stated. Three DEAD domain fields became live. | **FIXED** |
| F19 / F24 | P2/P3 | VALIDATION BUG / BUG | `BROKEN_FLOOR_STYLE_REFERENCE` could never fire — its `=== false` guard is only true once `UNKNOWN_DIGIT_STYLE` has already reported the same style. Separately, `deleteSelectionCommand` returned `true` when the confirmation merely **opened**, so "executed" was logged for deletes the user could still cancel. | Unreachable rule deleted; the command-executed log now waits for the confirmation to resolve. | **FIXED** |

Still open from D6, recorded rather than silently dropped: `F7b` symbolic floor values (`floor` is declared `integer`, but the firmware spec wants `R/Z/K/T/P` — three specification documents contradict each other, so this needs a spec decision, not code); `F12` cross-rotation authoring/propagation; `F17` multilingual content beyond per-language text (`Asset.variants` is promised by the docs and absent from the domain); `F18` audio channels (all seven `AudioCapabilities` fields remain dead, blocked on the same contradictory spec); `F15` real simulator time and test sequences. `D6`'s spec-contradiction list C1–C16 is a genuine product-owner input, not an implementation defect.

**On D6's process warning:** it was right twice. It told me to freeze a baseline before running read-only specialists against a tree I was editing, and I did not, so every specialist's line numbers decayed. Its second warning — that a Core capability with no UI caller is still unreachable — is the finding that eventually produced the enforced architecture invariant.
### Specification conflicts that block implementation (D6 update)

D6 re-verified its matrix against a late peer table, retracted one of its own softened verdicts, and surfaced three ID-model conflicts. I checked every citation first-hand before acting; all of them hold. These are **product-owner decisions, not implementation defects**, and are recorded here so nobody spends effort inventing an answer.

| ID | Conflict | Verified citations | Consequence | Decision |
|----|----------|--------------------|-------------|----------|
| C10a | Whether a stable ID must embed Rotation identity, and whether generation must be deterministic. | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:191-203` may carry Project/Theme **and Rotation** (`T01R03M0042`); `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:113-121` says an asset is *not* inherently rotation-specific and prefers `T01-A0042`; `WIDGET_SYSTEM_QUESTIONNAIRE_V1:219` requires generation to be **deterministic and collision-free**. | The implementation is collision-free but **not deterministic** — a real gap against an uncontradicted sentence. Rebuilding the same logical project therefore yields a different package checksum. | **PARTIALLY ACTED ON.** Identity now comes from one Domain generator with one shape and no hard dependency on `crypto.randomUUID` (see below). Determinism is **not** implemented: the composition it would serve is contradictory, and `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:456,504` records the package/ID model as *explicitly undecided*, so choosing a scheme would invent a product decision and very likely force a second id migration. Recommendation when the firmware contract lands: document-scoped sequential ids per prefix, allocated up front so undo/redo stays deterministic. |
| C10b | Where background-music override rules live. | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:163-170` (per state/**scene**/media audio) vs `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:339,355` ("Scene override değildir", Theme/Audio Settings). | Blocks anyone implementing audio (F18) from knowing where the setting belongs. | **BLOCKED** on a product decision. All audio modelling is absent anyway. |
| C10c | One document contradicts itself on export naming. | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:205` offers "firmware-safe dosya adı" as an ID form; `:219` forbids transforming IDs into firmware-usable names at export. | The export naming rule is unresolvable as written. | **BLOCKED.** `export.ts` currently uses `assets/<id>.asset.json`, which transforms nothing — the conservative reading. |
| Media Sequence | Whether one Media Slide can hold sequential media. | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:203` "bir Media Slide **tek bir** medya içeriği oynatır" vs `:247` and `:270` "aynı Media Slide içindeki **ardışık medya** … timeline/order ile oynatılır" — the **same document**, both claims. Also `PRODUCT_CONTRACT_V2:658-682`, `WIDGETS_AND_MEDIA:125`. | `MediaSlideContent` can express exactly one `assetId` (`models.ts:124-133`). D6 initially softened this verdict on the strength of `:203` alone, then retracted after reading further — correctly. | **BLOCKED.** Three documents say V1, one line of one of them says otherwise, and the same file contradicts itself. This is the largest remaining V1 *domain* gap and it needs one sentence from the product owner before a timeline model is designed. |
| C1 | Media format conversion / resize / crop. | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:494-496` puts conversion in a separate **Format Tool**, outside V1, contradicting `WIDGETS_AND_MEDIA:179` / `PRODUCT_CONTRACT_V2:216`. | Previously listed as a V1 gap. | **RE-CLASSIFIED** as legitimately deferred, not a V1 gap. Do not raise it before C1 is resolved. |

**Acted on immediately — the one part with no specification risk.** There were **three** inline ID generators: `Core/editor-application.ts` called `crypto.randomUUID()` bare, which **throws** wherever it is unavailable (non-secure contexts, older engines); `Domain/factories.ts` guarded it and fell back to `Math.random().toString(36)`; `App.tsx` did the same thing a third way for binding ids. So a single document could carry ids in three different shapes, and one layer could hard-crash where the others degraded quietly. Identity now comes from `src/Domain/identity.ts` alone: one shape everywhere, a proper 128-bit RFC-4122 fallback, and no hard dependency on `crypto.randomUUID`. An architecture test forbids inline generation anywhere else and was verified to fail when it is reintroduced; two unit tests cover the shape, uniqueness and the missing-`randomUUID` path.

**Also recorded:** parts of the asset-browser specification are *explicitly undecided*, not merely unimplemented — `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:504` states two of its own questions were never answered and that decisions were deliberately not advanced assuming them. Asset remediation therefore has no settled ID, colour-coding or folder contract to build against, which is why the asset system shipped in this pass models only what every document agrees on.
### Post-report correction (D6 final — a defect in my own asset importer)

D6's last delivery named F7c, and it landed on code I had written earlier in this pass. It was right, and the defect was mine.

| ID | Sev | Class | Observed | Decision | Status |
|----|-----|-------|----------|----------|--------|
| F7c | P2 | BUG (mine) | `Asset.mediaType` was **required** over a closed union with no unassigned member, so my importer had nowhere to put a file whose type it could not infer — it returned `undefined` and the file was **silently discarded**. Picking three files gave two assets and no mention of the third. `WIDGET_SYSTEM_QUESTIONNAIRE_V1:225-233` (uncontradicted) requires the opposite: the dropped file exists first as a Resource with `Type: None`, receives a semantic type if the profile supports the format, and otherwise stays `Unsupported`. My own live test had *asserted the silence as correct* ("unsupported files ignored"). | `Asset.mediaType` is now optional — an explicit resting state. Every picked file is imported; un-inferable ones arrive untyped, are reported by name, and the Asset Browser switches to Unsupported Files so they are visible. The existing media-type select gained a "Not assigned" option, so a type can be assigned *and* cleared. | **FIXED** |
| F7c-follow-on | P2 | VALIDATION BUG | Making untyped assets representable exposed a second problem: `ASSET_FORMAT_UNSUPPORTED` was an unconditional **error**, so one unused `.txt` resting in the depot blocked the entire build. That makes the spec's "stays Unsupported" state unusable. | Both asset rules are now scoped by reference: an **unused** untyped or unsupported-format resource is a **warning** (it rests, and says why it cannot be assigned); the **same asset referenced** by a theme or widget is an **error**, because the package would carry it. Removing the reference returns it to the resting state. | **FIXED** |

**A crash that only a live run could catch.** Hoisting the new label helpers put `assetTypeLabel` in a temporal dead zone relative to the Explorer tree that uses it, and the whole `App` fell to the error boundary:

```
ReferenceError: Cannot access 'assetTypeLabel' before initialization
The above error occurred in the <App> component.
```

`tsc` does not flag TDZ across statement order in the same scope, all 143 unit tests passed, and the build succeeded — because nothing in the suite renders `App`. It surfaced within one minute of a browser probe. This is the concrete cost of D6's "zero UI-interaction tests" finding, and the reason every batch in this pass ended with a live run rather than a green test summary.

**Also folded in from D6's final delivery:** `C10d` three (`MEDIA_LAYERING:149-155`) vs five (`MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:381-389`) audio channels — flag before any audio work begins. `C6` is now **resolved against the implementation** at three documents to one (`MEDIA_LAYERING:30-32`, `PRODUCT_CONTRACT_V2:221,828`, `CONTRACT_V2:64` vs `SCENE_DESIGNER_QUESTIONNAIRE_V1:185-191`): per-binding priority 0–10 is a real V1 gap, and the domain carries priority only on `Scene`. Recorded, not implemented — conflicting bindings currently resolve by document order, which is deterministic but not the specified rule. `F7`'s missing surface is specifically a drop target on Project Explorer / Theme Resources, **not** the canvas: `MAB:38` forbids canvas drop outright.

**Widget type change** was listed by D6 as DOMAIN-ONLY against base HEAD; it is wired and covered (live run 2, E7/E8).
### Post-report correction (D6 round 3 — firmware-contract fidelity)

D6's third pass promoted F3 (already fixed and live-verified in run 2) and added one new finding plus five contradictions. Three of its claims were about shipped code and all three were correct.

| ID | Sev | Class | Observed | Decision | Status |
|----|-----|-------|----------|----------|--------|
| F9b | P2 | MISSING FEATURE | `Project` recorded only `schemaVersion` and `deviceProfileId`, so profile drift was undetectable. `TEMPLATE_SCHEMA_V1:58` requires `deviceProfileVersion`; `RUNTIME_STATE_REGISTRY:371` requires recording the registry version a template was built against, and `:381` requires validation to warn when a state is removed or retyped. Comparing ids can never reveal that the registry moved. | `DeviceProfile.version` + `Project.deviceProfileVersion`, recorded at creation and carried by a profile switch. Two warnings — `DEVICE_PROFILE_VERSION_DRIFT` (authored against a different version) and `DEVICE_PROFILE_VERSION_UNRECORDED` (documents written before versioning) — plus a deliberate **Project ▸ Adopt Active Profile Version** command, because adopting asserts the bindings were reviewed. The manifest now carries the version so the firmware can check its own side. Both are warnings, so an existing template still builds while it is reviewed. | **FIXED** |
| C10e | P2 | BUG | The shipped profiles declared `door_state` with `enumValues: ["closed", "opening", "opening-completed"]`. **`opening-completed` appears in no specification document at all** — it was an implementation invention in demo data that a designer would have bound conditions to. | Replaced with values drawn from the registry's canonical names (`RUNTIME_STATE_REGISTRY:82-85`): `closed`, `opening`, `open`, `closing`. The *shape* (four discrete states vs one enum) is genuinely contradictory across documents and was left alone; only the invented value was removed. A test now asserts no shipped enum value lacks documentary backing. | **FIXED** |
| Naming | P3 | BUG | `RuntimeStateDefinition.simulator` and `.affectedCapabilities` diverged from the registry's actual field names, `simulatorSupport` and `bindingCapabilities` (`RUNTIME_STATE_REGISTRY:123-124`) — and `simulator` had just become load-bearing in the Simulator (F22). | Renamed `simulator` → `simulatorSupport`. Safe because a `DeviceProfile` lives in code and is never persisted inside a `Project`, so no saved document is invalidated. `affectedCapabilities` is still consumed by nothing and was left for the audio work that will define it (C10f). | **FIXED** |

**A test that failed for the right reason and had to be fixed properly.** Adding `deviceProfileVersion` broke the key-order dirty-comparison test — because its fixture rebuilt the project by listing keys *by hand*, so it silently dropped the new field and the "reordered" copy genuinely differed in content. The dirty flag was correct. The fixture now derives itself (`Object.fromEntries(Object.entries(project).reverse())`), so it stays honest as the domain grows instead of failing every time a field is added.

**Recorded, not implemented** — five more verified contradictions: `C10f` runtime-setting defaults disagree on values *and keys*, including inside one document (`FIRMWARE_PRESENTATION_SETTINGS:28-29` vs `:268-269`), which blocks audio outright; `C10g` `BINDING:64` uses a `Waiting` state absent from the registry while `:68` forbids inventing states; `C10i` `Rotation` is a Scene property in one doc, a theme-canvas `orientation` in another, and a Scene-owning container in the implementation — **no document describes the placement actually shipped**; and four domain names are implementation coinages found in no spec (`Binding.contentId`, `conditionMode: "all"|"any"`, plus the two renamed above).

**Where the implementation is ahead of the spec:** `FloorMapping`/`FloorMappingEntry` are modelled, validated and exported while `TEMPLATE_SCHEMA_V1` defines no floor-mapping structure at all. The domain shape is the only concrete definition that exists, so that gap is a missing **editor**, not a missing model — materially cheaper than the ORPHAN classification alone suggests.
## Phase 3 — Product decision closure and SD-card deployment

Four decisions were handed down. Applying them changed the domain, so the entries below record what the decision made possible and what it broke on the way.

| ID | Sev | Class | Observed before | Decision applied | Status |
|----|-----|-------|-----------------|------------------|--------|
| PD-01 | — | DEFERRED | Audio channel count contradicted across four documents, one of which disagrees with itself. | **Kept OPEN.** `Settings ▸ Audio` states "firmware specification confirmation required" and names the conflict. No channel count assumed, no mixing UI shipped. The seven `AudioCapabilities` fields stay declared and unread. | **BLOCKED ON PRODUCT** |
| PD-02 | P1 | MISSING FEATURE | `MediaSlideContent` held exactly one `assetId`, so the sequence three documents describe was unrepresentable. | Ordered `items: MediaSlideItem[]` mixing image/video, each with its own dwell time. Per-entry validation, an empty-sequence rule, reference-complete asset deletion, and an append/reorder/duration/remove editor. | **FIXED** |
| PD-03 | P1 | MISSING FEATURE | Priority existed only on `Scene`; conflicting bindings on one widget were resolved by whichever came last in document order. | `Binding.priority` integer 0–15 with named bounds, validated, selectable in the editor and on each card, and **resolved by the runtime** — priority descending, document order as tie-break. Absent = lowest, so it never outranks an explicit level. | **FIXED** |
| PD-04 | P1 | MISSING FEATURE | `floor` was declared `integer`, so `G`, `B2` and `Restaurant` were literally invalid input, and `FloorMappingEntry.firmwareValue` was an arbitrary primitive. | `FloorIdentifier` string type; `floor` is a `string` state with text operators; NFC-normalized comparison and de-duplication; a Floor Mapping editor with free-text identifiers. Verified live with `Restaurant` and `الطابق`. | **FIXED** |
| PD-05 | P1 | BUG | Found while applying PD-04: only the **runtime input** was coerced against the declared type, so an authored `value: 6` could never match a symbolic state spelled `"6"` — a silent non-match, not an error. | Both sides of a condition are coerced against the declared type. | **FIXED** |
| PD-06 | P1 | PERSISTENCE BUG | The two shape changes would have made every existing saved project either fail the load gate or load into a shape the new code misreads. | `src/Domain/migration.ts` upgrades on load in **both** paths (autosave slot and project file): a single-asset slide becomes a one-entry sequence preserving duration/loop/repeat/audio; a numeric floor value becomes its string spelling. | **FIXED** |

### SD-card deployment

| ID | Sev | Class | Observed | Decision | Status |
|----|-----|-------|----------|----------|--------|
| SD-01 | P1 | MISSING FEATURE | Nothing wrote to a card. The adapter refused with "reserved for a later phase", which was honest but not a product. | Full pipeline: detect → probe → pre-flight → write → flush → read-back verify → eject, along `UI → DeploymentService → RemovableStorageAdapter → Tauri command → Rust → filesystem`. Six Rust commands, 440 lines. | **CODE COMPLETE, HARDWARE-BLOCKED** |
| SD-02 | P0 | — | A write that reports success while the bytes never reach the device is the worst failure this feature could have. | `sync_all` on every file, and its error is propagated rather than swallowed. Verification is a separate read-back the **caller** compares — the component that wrote the bytes does not certify them. | **FIXED** |
| SD-03 | P0 | — | An automatic or mistaken write to a fixed disk would destroy unrelated data. | Refused in two independent places: the pure pre-flight validator, and `sd_write_package` itself, which re-checks the drive type while holding the handle. Auto-selection happens only when exactly one writable removable volume exists. | **FIXED** |
| SD-04 | P1 | — | A crafted package path could escape the target directory. | `safe_relative` rejects absolute paths, `..`, drive prefixes and colons before any handle opens; pre-flight rejects the same shapes earlier with a user-facing reason. | **FIXED** |
| SD-05 | P2 | — | Windows offers no reliable eject without privileges this build does not request. | `sd_eject_volume` returns `EJECT_UNSUPPORTED` and the UI reports it as a platform limitation, not a failed attempt. Files were already flushed, so the card is safe to remove via the OS. **Not simulated.** | **HONEST LIMITATION** |
| SD-06 | P2 | — | Every hardware failure mode was untestable without a card. | `InMemoryRemovableStorage` is a filesystem abstraction with fault injection, used **only** by tests and never wired into the app. 14 cases cover card-pulled-mid-write, read-only, permission denied, out of space, silent corruption, truncation, unreadable read-back, fixed-disk refusal, path escape, unsupported eject and the no-transport state. Tests assert bytes on the target, not booleans. | **FIXED** |
| SD-07 | P2 | UX DISCOVERABILITY | A deployment button that cannot deploy is worse than none. | In a browser the adapter is `undefined`, the service reports "no transport configured", and the panel says so with every action disabled and a reason on each. Verified live. | **FIXED** |
| SD-08 | P1 | BUG (mine) | The panel cast a fabricated empty package into pre-flight so it could show findings before a build, producing `PACKAGE_NOT_VERIFIED`/`PACKAGE_EMPTY` about a package the user had not built. | Pre-flight runs only when a real package exists. | **FIXED** |

### Two boundary risks cleared by documentation, not by execution

Neither could be settled by running anything, because `cargo` is absent. Both were verified against Tauri's own sources and are recorded as documentation-verified:

1. **Argument naming.** The TypeScript side invokes `volumeId`/`rootDirectory`; the Rust parameters are `volume_id`/`root_directory`. Tauri converts command arguments to camelCase on the JS side ([tauri-apps/tauri#1753](https://github.com/tauri-apps/tauri/pull/1753)), so the two halves agree. Had this been wrong, every SD command would have failed at runtime with the feature appearing complete.
2. **Permissions.** The capability file grants only `core:default`. Tauri 2's ACL gates **plugin** commands; commands the application registers itself through `invoke_handler` are callable from its own frontend without a capability entry ([Capabilities](https://v2.tauri.app/es/security/capabilities/)).
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

---

## Final closure pass (HEAD `dc33b10` + this work)

Independent live measurement on 2026-08-19 against the running Vite app at `127.0.0.1:1420`. Previous P0/P1 design-scope items remain **FIXED**. New findings from this pass:

| ID | Sev | Class | Expected | Observed | Root cause | Decision | Fix | Test | Status |
|----|-----|-------|----------|----------|------------|----------|-----|------|--------|
| FC-01 | P0 | BUG | Canvas is the dominant surface | At 1920×1080 `.canvas-stage` was **32px**; navigator was **719px**. Device frame 148×263, clipped. | Navigator inserted as a 4th grid child of a 3-row template; `1fr` landed on chrome. | Three children; `auto minmax(0,1fr) auto`. | `app.css` `.canvas-workspace`; fused `.editor-chrome`. | `tests/ui-phase2.test.ts`; live 821px stage / 453×805 frame. | **FIXED** |
| FC-02 | P0 | BUG | New Theme Project always has R0–R270 | `addThemeProject` without display created `rotations: []`. Profile switch mapped existing angles only. | Optional display path; no Add Rotation command. | Infer display from a sibling R0, else refuse. Profile switch seeds missing angles. | `editor-application.ts` | `product-completion.test.ts` (3 cases); `editor-pipeline.test.ts` | **FIXED** |
| FC-03 | P1 | STATE BUG | Theme/rotation/Alt+Arrow navigation selects the node the canvas shows | Switchers updated nav state only; Properties could still edit the previous scene. | `navigateTo*` did not `setSelection`. | Navigation sets selection to the landing Theme/Rotation/Scene. | `App.tsx` | Live: scene tabs + rotation cycle. | **FIXED** |
| FC-04 | P1 | STATE BUG | Preview is read-only | Hide All, z-order, multi-resize, widget toggles, undo/redo still mutated. | `blockedInPreview` not applied to every mutating helper. | Guard those helpers; multi-resize ignored in Preview. | `App.tsx` | Unit suite green; Preview path live-exercised for Design/Preview toggle. | **FIXED** |
| FC-05 | P1 | UX DISCOVERABILITY | Duplicate on a Theme Project Group is either real or refused | Menu enabled; Core no-op with no log. | Policy permitted group duplicate; Core never copied groups. | Policy refuses with a reason. | `editor-commands.ts` | `product-completion.test.ts` | **FIXED** |
| FC-06 | P2 | UX DISCOVERABILITY | SD deploy is a dedicated workflow | Buried in Console tab; opening it in the browser also showed a red "Detection failed". | Console was the only surface; detect always ran. | Blocking Deploy dialog; no detect unless `native-tauri`. | `App.tsx` + `.deploy-dialog` | Live screenshot `docs/visual-qa/deploy-dialog.png` | **FIXED** |
| FC-07 | P2 | UX | New widgets are separately selectable | Cascade of 10px on 120×80 widgets stacked into one blob. | `cascade * snapGridSize`. | Cascade step `max(grid*4, 40)`. | `App.tsx` | Placement formula; live 3-widget create. | **FIXED** |
| FC-08 | P3 | UX | Chrome is CAD-dense | 48px app bar, 52–79px panel headings, kickers, footnotes, "ASPECT LOCKED". | Token defaults + AI chrome copy. | 32/26/28/22 shell; kickers hidden; Save in toolbar. | `app.css`, `App.tsx` | Live: heading 28px, chrome strip 33px. | **FIXED** |

**Still CODE COMPLETE, HARDWARE/TAURI UNVERIFIED:** SD write/flush/verify/eject (`cargo` absent; no physical card). Binary media copy via `sd_copy_file` is implemented in Rust and unused from TS because browser import has no real path — recorded, not faked.

**Stale ledger note:** Floor Mapping authoring **was** added in PD-04; the "Out of scope" row above is historical.
