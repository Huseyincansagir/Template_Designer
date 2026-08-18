# D3 Findings — Project Lifecycle, Persistence, Device Profiles, Settings, Error/Recovery/Stress

**Specialist:** DISCOVERY D3 · **App:** Template Designer V2 · **Branch:** `manus2`
**Method:** Live CDP-driven Edge (port 9225, `lib-9225.mjs`) against `http://127.0.0.1:1420/` + source root-cause (read/grep). Read-only on the repo.

> **⚠ Environment integrity caveat (read first).** This repo is a **moving target**: multiple parallel agents were editing the working tree *during* this audit. `git status` grew from 1 modified file (session start) to 8 modified + 2 new files by session end (`App.tsx`, `factories.ts`, `main.tsx`, `editor-application.ts`, `project-storage.ts`, `shortcut-registry.ts`, new `Infrastructure/asset-import.ts` and `Infrastructure/project-file.ts`). The running Vite server briefly returned **HTTP 500 on `editor-application.ts`** mid-edit (observed live), and the served bundle registered **1 device profile at session start, then 2** after the compact profile landed via uncommitted edits. Line numbers below are as observed; a fresh `npm run build` must be re-audited once the tree stabilizes. Findings marked **LIVE** were reproduced in the running app; **SOURCE** findings are code-traced only.

---

## Findings

| ID | Sev | Class | One-line title |
|----|-----|-------|----------------|
| D3-01 | P1 | MISSING FEATURE | New Project has no dialog — cannot name it or choose a device profile |
| D3-02 | P1 | PERSISTENCE BUG | New Project shows "Saved" but is not persisted; reload silently restores the previous project |
| D3-03 | P2 | UX DISCOVERABILITY | First launch has no coherent "get started" path (no scene scaffold, Add Scene gated on tree selection) |
| D3-04 | P0 | STATE BUG | Device-profile switch does NOT re-dimension canvas/rotations — stale geometry (silent corruption) |
| D3-05 | P2 | INCOMPLETE WORKFLOW | Open/Import/Export are localStorage-only in the UI; file gateways exist but are not in any menu |
| D3-06 | P2 | STATE BUG | Reload loses selection, zoom, dock/panel layout, expansion, active scene/rotation |
| D3-07 | P2 | PERSISTENCE BUG | Save menu item disabled when clean → a fresh project cannot be saved until mutated |
| D3-08 | P2 | BUG | Settings dialog: Enter does not commit (only Cancel has focus; no form submit) |
| D3-09 | P3 | UX DISCOVERABILITY | 6 of 9 Settings categories contain no settings (informational text only) |
| D3-10 | P1 | STATE BUG | Corrupt/truncated/invalid persisted project → **silent** fallback to scaffold, no user notice |
| D3-11 | P2 | VALIDATION BUG | `isLoadableProject` gate under-validates: unknown widgetType, 5th rotation, negative geometry, duplicate IDs all load |
| D3-12 | P2 | STATE BUG | Duplicate widget id renders two children → React "same key" console errors + scoped commands refuse silently |
| D3-13 | P2 | STATE BUG | Unknown `deviceProfileId` → "DeviceProfile unavailable" canvas, no recovery hint |
| D3-14 | P3 | PERFORMANCE | Every command deep-clones + stringifies the whole project (O(n)); fine at 200 widgets, degrades linearly |
| D3-15 | P2 | UNDO-REDO BUG | History cap 100 means >100 edits after a save can never undo back to the clean state |
| D3-16 | P1 | ENVIRONMENT | Working tree actively edited during audit; committed HEAD / acceptance report disagree with served app |

Also verified **OK** (negative results): dirty flag correct after mutation/save/undo; `beforeunload` + Tauri close guard work; all 4 program settings are actually read (no stored-but-ignored setting); 30× rapid undo/redo clean; 200-widget project stays usable (40 KB snapshot, 23 ms shell mount, 84 tree rows, zero console errors).

---

## D3-01 — New Project: no dialog, no name, no device-profile choice (P1, MISSING FEATURE)

**Repro (LIVE):** File ▸ New Project (or topbar "New Project"). No dialog appears; a project named "Untitled Project" replaces the document instantly.
**Observed:** `createProject` (`src/App/App.tsx:605-620`) calls `createEmptyProject("Untitled Project")` with a hard-coded name and **no profile argument**, even though `createEmptyProject(name, profile)` now accepts a profile (`src/Domain/factories.ts:131`). Defaults produced: Foundation profile, one group "Untitled Theme Group", one theme "New Theme Project", four rotations R0/R90/R180/R270 at 720×1280, **zero scenes**, zero assets.
**Expected:** a create dialog offering a name and a device profile (the mission's "choose a device profile at creation time" is unmet).
**Root cause:** `src/App/App.tsx:607` hard-codes the scaffold; the profile parameter added to `factories.ts:131` is unused by the UI.
**Impact:** users cannot name a project at creation or pick a device; they must rename afterward and switch profile afterward (and D3-04 shows the switch is broken).

## D3-02 — New Project marked "Saved" but not persisted (P1, PERSISTENCE BUG)

**Repro (LIVE):** With project "SavedBase" persisted, hit New Project (clean state → no warning). Topbar chip reads **"Saved"**, tab reads "Untitled Project", but `localStorage["template-designer.project.v1"]` still contains **"SavedBase"**. Reload → "SavedBase" returns; the new project is silently gone.
**Observed:** `documentStore.create()` → `open()` sets `currentProject = savedProject = project` without calling `storage.save` (`src/Core/document-store.ts:61-68`), so `isDirty` is `false` ("Saved") even though nothing was written.
**Expected:** a brand-new project should be dirty-until-saved, or auto-saved; the "Saved" indicator must not lie.
**Root cause:** `src/Core/document-store.ts:61-68` (create/open set baseline = current without persistence) + `src/App/App.tsx:605-620` (createProject never calls `saveDocument`).
**Impact:** user believes work is saved; a reload/close (no beforeunload warning because `isDirty` is false) discards the new project and resurrects the old one.

## D3-03 — No coherent "get started" path on first launch (P2, UX DISCOVERABILITY)

**Repro (LIVE):** Empty localStorage + reload. Canvas empty state: **"Select a Scene or Widget — Create or select a canonical Rotation and Scene to begin canvas editing."** There is **no** inline "Add Scene"/"Add Widget" action (the empty-state "Add Widget" button only appears after a scene exists). File/Scene menus: **Add Scene is disabled** until a Rotation is manually selected in the tree.
**Observed:** `addScene` requires `resolvedSelection?.rotation?.id` (`src/App/App.tsx` `addScene`), and the scaffold is born with 0 scenes (`src/Domain/factories.ts:98-114`).
**Expected:** a visible first action (e.g., "Create first Scene" button, or a pre-created scene, or auto-select the first rotation).
**Root cause:** scaffold has no scene + no auto-selection of R0 + menu commands gated on a rotation selection.

## D3-04 — Device-profile switch does NOT re-dimension (P0, STATE BUG, silent corruption)

**Repro (LIVE):** With 2 profiles registered, select R0, add a scene + widget (720×1280). In Properties ▸ "Device Profile" select, choose **"Compact Display Profile"** (480×800). 
**Observed:** status bar changes to "Compact Display Profile", but the device frame still reads **"R0 · 720 × 1280"**, R0/R90 tree details still **720×1280 / 1280×720**, and the Properties "Display" row still **720 × 1280**. The canvas does **not** resize; widget geometry is **not** clamped.
**Root cause:** `src/App/App.tsx:1014-1018` (`setDeviceProfile`) calls `editorApplication.setProjectDeviceProfile(profileId)` **without** the new profile's `display`. The Core method now *does* re-derive rotation dimensions and clamp widgets (`src/Core/editor-application.ts:566-593`) — but only when a `display` argument is passed; the UI never passes it, so `usableDisplay` is `undefined` and the method degrades to `{ ...project, deviceProfileId }` (a label-only change). The re-dimension/clamp code is therefore **dead**.
**Expected:** switching profile re-derives the four rotations' width/height from the new display (R90/R270 swap), clamps every widget back inside bounds, and (ideally) warns about capability losses. All in one undoable command.
**Impact:** the exact "stale geometry = silent corruption" hazard from the mission. A widget placed at x=600 stays at x=600 on a 480-wide display (off-canvas); the project's geometry contract contradicts its declared profile. **Undo works** (the switch is one command), but the intermediate state is corrupt and there is **no warning**.

*Note on the mission premise:* the actual compact profile is **480×800 with all four rotations [0,90,180,270]** and drops **video** media support + the **`service_state`** runtime state (`src/Domain/factories.ts:54-80`) — **not** 540×960 with rotations [0,180]. No widget *types* are dropped (both profiles support the same 5), so the "unsupported widget type" question is moot; the real losses are video media and `service_state`, which surface only as validation issues (`UNSUPPORTED_MEDIA_TYPE`, `UNKNOWN_RUNTIME_REFERENCE`) with no proactive warning.

## D3-05 — Open/Import/Export are localStorage-only in the UI (P2, INCOMPLETE WORKFLOW)

**Repro (LIVE + SOURCE):** File menu contains exactly **New Project / Open Project / Save** (`src/App/App.tsx:2175-2178`). "Open Project" (`src/App/App.tsx:646-674`) only re-reads the single localStorage slot (`projectStorage.load()`). No `<input type=file>` / download / file dialog is reachable.
**Observed:** `ProjectFileGateway` + `BrowserProjectFileGateway` (`src/Infrastructure/project-file.ts`) and `AssetImportSource` (`src/Infrastructure/asset-import.ts`) **exist**, and `exportProjectFile`/`importProjectFile`/`importAssets` functions exist in `App.tsx` (lines 744/778/678) — but **none are bound to a menu item or button** (no `onClick` call sites). The label "Open Project" therefore overstates what it does (it opens the autosave slot, not a file).
**Expected:** File ▸ Export Project (download `.tdproj.json`) and File ▸ Import Project (file input), plus an Asset import entry point, once the in-flight wiring lands.
**Impact:** a project cannot leave the machine, be backed up, or be shared through the shipped UI today; the menu is misleading.

## D3-06 — Reload loses UI session state (P2, STATE BUG)

**Repro (LIVE):** Rename project, zoom to 80%, select a widget, expand nodes, Save, reload.
**Observed:** project name + widget count persist; **zoom resets to 100%, selection clears, expansion resets, dock/panel layout + splitter widths reset** (all are React `useState` with no persistence). Active scene/rotation are selection-derived, so they reset to R0 of the first theme.
**Root cause:** `zoom`, `pan`, `selection`, `selectedIds`, `panelModes`, `leftWidth/rightWidth`, `expandedNodes`, `viewMode`, `canvasTool`, `snapEnabled` are all component state (`src/App/App.tsx`), never persisted. Only `project` is saved via `ProjectStorage`.
**Impact:** closing/reopening loses the designer's working context (zoom/selection/layout) — a real usability gap for a desktop editor, though not data loss.

## D3-07 — Save disabled when clean; a fresh project can't be saved until mutated (P2, PERSISTENCE BUG)

**Repro (SOURCE):** File ▸ Save is `disabled: !documentSnapshot.isDirty` (`src/App/App.tsx:2178`). Combined with D3-02, a brand-new project is "clean" and its Save is disabled, so the only way to persist it is to first make a change (Ctrl+S still works regardless, but the menu entry is inert).
**Expected:** Save should be available for an unsaved new document (the store should track "never persisted" distinctly from "unchanged since last save").
**Impact:** confusing dead-end for a fresh document; menu Save does nothing until the doc is dirtied.

## D3-08 — Settings: Enter does not commit (P2, BUG)

**Repro (LIVE):** Open Settings, toggle "Confirm destructive commands" off, press Enter. The dialog **stays open** and the change is **not committed**; only the explicit "Save / Apply & Close" button commits. Escape cancels+reverts correctly; Cancel reverts+closes correctly.
**Root cause:** the dialog is a `<section>`, not a `<form>`; `onKeyDown` only traps Tab (`trapModalFocus`); the **Cancel** button carries `autoFocus` (`src/App/App.tsx` settings footer). There is no Enter/submit handler.
**Expected:** Enter (or the focused primary button) commits; Escape cancels. Minor, but the keyboard contract is inconsistent (draft text/number fields commit on Enter, the dialog itself does not).

## D3-09 — Six Settings categories contain no settings (P3, UX DISCOVERABILITY)

**Observed (LIVE):** Settings lists 9 categories (General, Appearance, Editor, Canvas, Assets, Simulator, Validation, Export, Shortcuts). Only **General** (confirmDestructive), **Appearance** (compactDensity), and **Canvas** (showGrid, snapGridSize) contain real controls. The other six render informational paragraphs/values only ("Shortcut registry Foundation", "Format conversion Not in V1", shortcut list, etc.).
**Impact:** the dialog implies a richer preferences surface than exists; not a bug, but the six read-only categories should be clearly marked informational (or collapsed).

## D3-10 — Corrupt/invalid persisted project → silent scaffold fallback (P1, STATE BUG, silent data loss)

**Repro (LIVE):** Seed `localStorage["template-designer.project.v1"]` with (a) truncated JSON, (b) a valid-shaped object missing `name`, (c) a widget geometry with `x:"NaN"`. Reload.
**Observed:** all three boot to a clean **"Untitled Project"** scaffold. There is **no** banner, dialog, or console entry telling the user their project was discarded/reset (the only initial console entry is "Foundation shell initialized").
**Root cause:** `LocalStorageProjectStorage.load()` returns `null` on parse/shape failure (`src/Infrastructure/project-storage.ts:76-86`), and `App` opens `restored ?? createEmptyProject()` (`src/App/App.tsx:427`) with no user notification. The S5-04 gate prevents the crash but **silently** discards the document.
**Expected:** an honest recovery message ("Your saved project could not be read; it has been reset. It remains in … until overwritten") and, ideally, preserve the corrupt payload.
**Impact:** user data appears silently lost with no explanation; the corrupt payload stays in localStorage until the next Save overwrites it (no backup).

## D3-11 — `isLoadableProject` gate under-validates (P2, VALIDATION BUG)

**Repro (LIVE):** Seed valid-shaped projects with (a) `widgetType:"foobar"`, (b) a 5th rotation `angle:45`, (c) negative geometry `{x:-500,y:-500,width:-50,height:-20}`, (d) duplicate widget id across two scenes. Reload.
**Observed:** all **load and render** (no scaffold fallback). Unknown widget type renders a labelled "foobar" rectangle; R45 renders as a 5th rotation; negative geometry renders a collapsed widget. The load gate checks only `typeof` / `isNumeric` (`src/Infrastructure/project-storage.ts:32-62`) — it does **not** validate widgetType against the profile, rotation angle/`supportedRotations`, geometry sign (`width/height > 0`), or id uniqueness. The validation service (`src/Core/validation.ts`) *does* flag most of these (`UNSUPPORTED_WIDGET_TYPE`, `UNSUPPORTED_ROTATION`, `INVALID_WIDGET_GEOMETRY`, `DUPLICATE_WIDGET_ID`), but only reactively in the Validation tab — the user is not proactively told.
**Expected:** either hard-reject at load (like the missing-field cases) or surface a visible "loaded with N problems" notice.
**Impact:** malformed-but-shaped data renders broken UI instead of being caught at the boundary.

## D3-12 — Duplicate widget id → React key-collision errors + dead commands (P2, STATE BUG)

**Repro (LIVE):** Seed a scene whose two widgets share id `w1`. Reload.
**Observed:** two canvas widgets render; console emits **"Encountered two children with the same key, `w1`"** (twice). `validScopedWidgetIds`/`countWidgetOccurrences` (`src/Core/editor-application.ts`) then see 2 occurrences, so every scoped command (move/resize/delete/edit) on `w1` returns `changed:false` silently — the widget is effectively uneditable.
**Root cause:** no load-time uniqueness gate (`isLoadableProject` ignores id collisions); the render layer uses `widget.id` as the React `key` (`src/App/App.tsx` `renderCanvasWidget`).
**Expected:** unique-id enforcement at load (or dedupe with a notice).
**Impact:** phantom duplicated rendering + a widget that cannot be operated on.

## D3-13 — Unknown `deviceProfileId` → "DeviceProfile unavailable", no recovery hint (P2, STATE BUG)

**Repro (LIVE/SOURCE):** Seed a valid project with `deviceProfileId:"bogus-profile"`. Reload.
**Observed:** canvas empty state shows **"DeviceProfile unavailable — Register the canonical DeviceProfile before editing this display."**, canvas editing is disabled (`canvasAvailable = Boolean(activeProfile && activeRotation)` is false). There is no message explaining *why* or how to fix it. With >1 registered profile the Properties select can recover; with only 1 registered profile the select is disabled (`disabled: availableProfiles.length < 2`) → **unrecoverable**.
**Root cause:** `activeProfile = profileRegistry.get(project.deviceProfileId)` can be `undefined` (`src/App/App.tsx:487`); `isLoadableProject` does not verify the profile id against the registry, and there is no recovery path/notice.
**Expected:** a load-time check that the profile id resolves, with a clear remediation.

## D3-14 — O(project-size) mutation cost (P3, PERFORMANCE, observation)

**Measured (LIVE):** 8 themes / 40 scenes / 200 widgets → snapshot **41,127 chars (~40 KB)**; shell mount after reload **23 ms**; **84** tree rows rendered; add-scene+add-widget round-trip **~1.2 s** (mostly automation sleeps); zero console errors. The app stays usable.
**Root cause:** `EditorApplication.execute` deep-clones the project twice (`clone(before)`, `clone(after)`) and `equalProject` runs two full `JSON.stringify`s per command (`src/Core/editor-application.ts` `execute`/`equalProject`). This is O(n) per command; at 200 widgets it is fast, but it scales linearly and there is no incremental/patch model.
**Impact:** not a defect at the tested scale; a scaling risk worth noting for very large templates.

## D3-15 — History cap 100 blocks "undo back to saved" beyond 100 edits (P2, UNDO-REDO BUG edge)

**Evidence (SOURCE + partial LIVE):** `CommandHistory` evicts the oldest command when the stack exceeds `DEFAULT_HISTORY_LIMIT = 100` (`src/Core/commands.ts:14,42`). Consequence: after a Save at state S0 followed by >100 edits, the undo stack only retains the last 100, so undo can return only to S5 — never to the clean S0. `isDirty` (stableSerialize compare, `src/Core/document-store.ts:131`) stays true with **no indication** that the saved state is unreachable. 30× rapid undo/redo was verified clean (widget count consistent, no phantom state, no console errors). The +105 live probe was contaminated by a concurrent-edit Vite 500, so the cap behavior is source-traced.
**Expected:** when the oldest undo step is evicted past the saved baseline, the app should either preserve the save-point command or tell the user "saved state no longer reachable by Undo".
**Impact:** a designer who saves, makes a burst of small edits, then wants to revert to saved cannot, with no explanation.

## D3-16 — Working tree / running app divergence during audit (P1, ENVIRONMENT/INTEGRITY)

**Evidence:** At session start `git status` = 1 modified file and `src/main.tsx:8` registered **one** profile (`[foundationDeviceProfile]`); the served bundle registered **1 profile**. By session end `git status` = 8 modified + 2 new files, `src/main.tsx:8` registers **two** profiles, and the served `factories.ts` defines `compactDeviceProfile` (480×800). A transient **HTTP 500 on `editor-application.ts`** was captured live mid-edit. The committed `FINAL_PRODUCT_ACCEPTANCE_REPORT.md` ("second shipped profile added; switch is undoable + validated") is **not** reflected in the committed HEAD `11cc2c6` — the second profile exists only in uncommitted edits.
**Impact:** findings are timestamped against a moving tree. Before release, the tree must stabilize and every finding here (especially D3-04 and D3-05) re-verified against a clean build, because the served dev bundle does not equal `git HEAD`.

---

## Settings PASS/FAIL table

Four real settings exist (`ProgramSettings`, `src/Infrastructure/program-settings-storage.ts`). All four are actually read (no stored-but-ignored setting found).

| Setting | Real effect? | Persists? | Cancel reverts? | Escape cancels? | Enter commits? | Verdict |
|---|---|---|---|---|---|---|
| Confirm destructive commands (General) | ✅ gates New-Project dirty warning + delete confirm (App.tsx:622-633, `deleteSelectionCommand`) — live: OFF → delete without confirm | ✅ localStorage on Save | ✅ | ✅ | ❌ | **PASS** (Enter ❌) |
| Use compact panel density (Appearance) | ✅ toggles `body.relaxed-density` class (App.tsx `useEffect`) — live verified | ✅ | ✅ | ✅ | ❌ | **PASS** (Enter ❌) |
| Show grid by default (Canvas) | ✅ drives `gridVisible` → grid background (`backgroundSize` 1.38889% / 0.78125% = 10/720, 10/1280) — live verified | ✅ (but toolbar Grid toggle is session-only, not persisted) | ✅ | ✅ | ❌ | **PASS** (Enter ❌) |
| Snap grid size (Canvas) | ✅ grid size + snap + cascade + nudge (`snapGridSize`, App.tsx) — live verified grid size | ✅ | ✅ | ✅ | ❌ | **PASS** (Enter ❌) |

**Additional settings findings:** `Editor`, `Assets`, `Simulator`, `Validation`, `Export`, `Shortcuts` categories contain **no controls** (informational only) → D3-09. **Enter does not commit** the dialog → D3-08. **Escape** cancels and reverts correctly (LIVE: toggle → Escape → reopen shows reverted value). **Cancel** reverts and closes correctly (LIVE). **No stored-but-ignored settings exist** — a positive result.

---

## Device-profile-switch verdict

**BROKEN (P0).** Two profiles are now registered (Foundation 720×1280; Compact **480×800**, all four rotations) and the control is enabled, but switching via the UI changes **only** `deviceProfileId`:
- Canvas and all four rotation records **keep the old 720×1280 / 1280×720 geometry** (stale, live-verified).
- Widgets are **not clamped** to the new display — a widget at x=600 is stranded off a 480-wide canvas.
- The Core re-dimension+clamp logic exists (`editor-application.ts:566-593`) but is **dead** because `App.tsx:1014-1018` never passes the `display` argument.
- The switch **is undoable** (single command) and there is **no warning** about geometry or about the dropped video-media / `service_state` capabilities.
- No widget *types* are dropped by the compact profile; the mission's "540×960 / rotations [0,180]" premise does not match the shipped profile (480×800 / all four).

**Fix:** `setDeviceProfile` must pass `profileRegistry.get(profileId)?.display` to `editorApplication.setProjectDeviceProfile(profileId, display)`, and should surface a capability-loss confirmation.

---

## Top 5 root causes

1. **`src/App/App.tsx` `setDeviceProfile` (~1014-1018) calls `setProjectDeviceProfile(profileId)` without the profile `display`** → the Core re-dimension/clamp (`editor-application.ts:566-593`) never runs → stale 720×1280 geometry after a profile switch (D3-04, P0).
2. **`src/Core/document-store.ts:61-68` `create`/`open` set `savedProject = currentProject` without persisting**, and `src/App/App.tsx` `createProject` never saves → new project reads "Saved" while localStorage still holds the old project (D3-02, P1).
3. **`src/Infrastructure/project-storage.ts:32-62` `isLoadableProject` validates only shape, not semantics** (no widgetType/rotation/geometry-sign/id-uniqueness checks) and `load()` returns `null` on failure with **no user notification** at `src/App/App.tsx:427` (`restored ?? createEmptyProject()`) → silent scaffold fallback + broken-but-rendered data (D3-10/D3-11/D3-12, P1/P2).
4. **Project-file/asset infrastructure is not wired to the UI**: `project-file.ts`, `asset-import.ts`, and the `exportProjectFile`/`importProjectFile`/`importAssets` functions exist but the File menu still has only New/Open/Save (`App.tsx:2175-2178`) → no real file import/export/open path (D3-05, P2).
5. **UI session state (zoom, selection, dock/panel layout, expansion, active scene/rotation) is un-persisted React state** (`src/App/App.tsx`) → all of it is lost on reload (D3-06, P2).

---

*D3 reporting complete. All measurements are real (CDP-driven), never estimated. Re-audit against a clean build once the parallel edits land.*
