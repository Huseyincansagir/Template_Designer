# D5 Findings — Property Editing, Bindings, Simulator/Preview, Validation, Build/Export

**Auditor:** DISCOVERY SPECIALIST D5 (read-only)
**Repo:** `C:\Users\b1601\Template_Designer` (branch manus2)
**Method:** source review (`src/Domain/models.ts`, `src/Core/*`, `src/App/App.tsx`, `src/Domain/factories.ts`) + live headless-Edge (port 9227) driving the running dev server at http://127.0.0.1:1420/. UI interactions were driven by DOM/CDP; local `localStorage` was seeded for validation/export probes that the UI cannot construct. All DOM results verified by text/computed-style only.

> ⚠️ **Concurrency note:** the repo is being modified *while this audit runs* (e.g. `src/Domain/factories.ts` grew from 104→141 lines mid-session, adding `compactDeviceProfile` and a `createEmptyProject(name, profile)` overload; early runs reported "1 profile registered" and a disabled Device Profile `<select>`, later runs reported "2 profiles registered" and an enabled select). Findings below state the file:line against the source version I read; where the live behavior changed mid-audit I note it.

---

## Table 1 — Properties/Inspector field enumeration per selection kind

"Commit" = applies the edit to the canonical model (undoable command). "Revert" = Escape abandons the draft. All editable text/number fields use a draft-per-field input (commit once on blur/Enter, Escape reverts).

| Selection kind | Field | Domain path | Editable? | Commits Enter? | Reverts Esc? | Commits blur? | Tab moves on? | Invalid input | Undoable? | Persists? |
|---|---|---|---|---|---|---|---|---|---|---|
| *(nothing selected)* | — (header + "Select a canonical item" empty state only) | — | no fields at all | — | — | — | — | — | — | — |
| **Project** | Name | `Project.name` | ✅ DraftTextField | ✅ | ✅ | ✅ | ✅ (commits) | empty→"name cannot be empty — reverted" | ✅ | ✅ |
| Project | Type (read-only) | — | ❌ | — | — | — | — | — | — | — |
| Project | Stable ID | `Project.id` | ❌ | — | — | — | — | — | — | — |
| Project | Device Profile | `Project.deviceProfileId` | ✅ `<select>` (enabled only with ≥2 profiles) | n/a | n/a | n/a (change event) | n/a | n/a | ✅ | ✅ |
| Project | Validation (count) | — | ❌ | — | — | — | — | — | — | — |
| **Theme group** | Name | `ThemeProjectGroup.name` | ✅ | ✅ | ✅ | ✅ | ✅ | empty→reverted | ✅ | ✅ |
| Theme group | Type / Stable ID / Device Profile / Validation | — | ❌ (no `themeProjects` count shown) | — | — | — | — | — | — | — |
| **Theme** | Name | `ThemeProject.name` | ✅ | ✅ | ✅ | ✅ | ✅ | empty→reverted | ✅ | ✅ |
| Theme | Rotations / Resources / Floor Mappings (counts) | `.rotations.length` / `.resources.length` / `.floorMappings.length` | ❌ read-only | — | — | — | — | — | — | — |
| **Rotation** | Name | (none in model) | ❌ muted (`R{angle}` label) | — | — | — | — | — | — | — |
| Rotation | Angle / Display (W×H) / Scenes | `.angle` / `.width×height` / `.scenes.length` | ❌ read-only (dimensions not editable) | — | — | — | — | — | — | — |
| **Scene** | Name | `Scene.name` | ✅ | ✅ | ✅ | ✅ | ✅ | empty→reverted | ✅ | ✅ |
| Scene | Priority | `Scene.priority` | ✅ DraftNumberField (0..10) | ✅ | ✅ | ✅ | ✅ | non-int **silently reverts** (D5-01) | ✅ | ✅ |
| Scene | Enabled | `Scene.enabled` | ✅ checkbox | n/a | n/a | n/a | n/a | n/a | ✅ | ✅ |
| Scene | Activation Conditions | `Scene.activationConditions` / `.activationConditionMode` | ❌ read-only count "0 · all" — **no authoring UI** (D5-07) | — | — | — | — | — | — | — |
| Scene | Widgets (count) | `.widgets.length` | ❌ | — | — | — | — | — | — | — |
| **Widget** | Name | `Widget.name` | ✅ | ✅ | ✅ | ✅ | ✅ | empty→reverted | ✅ | ✅ |
| Widget | Widget Type | `Widget.widgetType` | ❌ read-only | — | — | — | — | — | — | — |
| Widget | Visible | `Widget.visible` | ✅ checkbox | n/a | n/a | n/a | n/a | n/a | ✅ | ✅ |
| Widget | Enabled | `Widget.enabled` | ✅ checkbox | n/a | n/a | n/a | n/a | n/a | ✅ | ✅ (no runtime effect, D5-03) |
| Widget | Geometry Lock | `Widget.locked` | ✅ checkbox | n/a | n/a | n/a | n/a | n/a | ✅ | ✅ |
| Widget | X / Y | `Widget.geometry.x/.y` | ✅ GeometryField (min 0, max rotation W/H) | ✅ | ✅ | ✅ | ✅ | non-numeric→"invalid value — reverted"; clamp with feedback (D5-02) | ✅ | ✅ |
| Widget | W / H | `Widget.geometry.width/.height` | ✅ (min 10, max rotation W/H) | ✅ | ✅ | ✅ | ✅ | same | ✅ | ✅ |
| Widget | Z-order | `Widget.zIndex` | ✅ DraftNumberField (−100000..100000) | ✅ | ✅ | ✅ | ✅ | non-numeric→reverted; clamp | ✅ | ✅ |
| Widget | Bindings / Asset References / Media Type / Media Slide | `.bindings.length` / `.assetIds.length` / `.mediaType` / `.mediaSlide` | ❌ read-only (D5-08) | — | — | — | — | — | — | — |
| Widget | Open Binding Editor | (opens modal) | ✅ button | — | — | — | — | — | — | — |
| Widget (digit) | Style / Floor Mapping | `Widget.style.digitStyleId` / `Widget.content.floorMappingId` | ❌ read-only (D5-08) | — | — | — | — | — | — | — |
| Widget (direction) | Style / Variant | `Widget.style.directionStyleId` / `Widget.content.variant` | ❌ read-only (D5-08) | — | — | — | — | — | — | — |
| Widget (media) | Visual / Attached Audio | `Widget.mediaType` / `Widget.audioAssetId` | ❌ read-only (D5-08) | — | — | — | — | — | — | — |
| **Multi-widget** | Name / Type / Stable ID | — | ❌ (Name shows `*`, Type/ID via `valueFor`) | — | — | — | — | — | — | — |
| Multi-widget | Visible / Enabled / Lock | apply-to-all | ✅ checkboxes (all-set logic) | n/a | n/a | n/a | n/a | n/a | ✅ | ✅ |
| Multi-widget | X/Y/W/H | apply-to-all | ✅ (`*` placeholder; read-only if any locked) | ✅ | ✅ | ✅ | ✅ | clamp/revert | ✅ | ✅ |
| Multi-widget | Z-order | apply-to-all | ✅ | ✅ | ✅ | ✅ | ✅ | clamp/revert | ✅ | ✅ |
| Multi-widget | Presentation | (shows **last** selected widget's values, not `*`) | ❌ | — | — | — | — | — | — | — |
| **Asset** | Name | `Asset.name` | ✅ | ✅ | ✅ | ✅ | ✅ | empty→reverted | ✅ | ✅ |
| Asset | Media Type / Source / Stable ID | `.mediaType` / `.sourcePath` / `.id` | ❌ read-only | — | — | — | — | — | — | — |

Notes:
- `Tab` never moves between fields as a navigator — every field is a draft input that **commits on blur**, so Tab commits the current field and focus moves to the next tabbable element. There is no multi-field "form submit"; each field is one undoable command.
- The "Type" label is inconsistent: Project→"Project", Theme→"Theme Project", Theme group→"Theme Project Group", Rotation→"Rotation / Form", but **Scene→"scene"** (lowercase) and Widget→its `widgetType`.
- Theme selection shows the subtitle **"Nothing selected · Project context"** because `selection.detail` is undefined for themes (D5-06).

---

## Table 2 — Numeric field edge-case results (live)

| Field (min/max) | empty | 0 | negative | decimal | huge (1e9) | non-numeric | leading zeros |
|---|---|---|---|---|---|---|---|
| X (0..720) | stays, "invalid value — reverted" | 0 | 0 ("clamped to 0") | 12.5 accepted | **600** but feedback "clamped to 720" (D5-02) | stays, "invalid value — reverted" | 7 |
| W (10..720) | stays, reverted | 10 ("clamped to 10") | 10 ("clamped to 10") | 12.5 accepted | 720 ("clamped to 720") | stays, reverted | 10 ("clamped to 10") |
| Z-order (−100000..100000) | stays, reverted | 0 | −5 accepted (no clamp) | 12.5 accepted | 100000 ("clamped to 100000") | stays, reverted | 7 |
| Scene priority (0..10) | stays, reverted | 0 | 0 ("clamped to 0") | **5.5 silently reverts, no feedback** (D5-01) | 10 ("clamped to 10") | stays, "invalid — reverted" | 7 |

Empty is never treated as 0 (draft-empty is "pending" and reverts). Clamping always emits feedback **except** the two cases flagged: (a) scene-priority non-integer is dropped by the core with no feedback, and (b) X/Y report a clamp bound (`rotation.width/height`) that the commit path then tightens further (see D5-01/D5-02).

---

## Table 3 — Domain field vs UI coverage (question 4)

| Domain field | UI? | Evidence | V1 needs it? |
|---|---|---|---|
| `Widget.name` | ✅ has UI | DraftTextField | yes |
| `Widget.widgetType` | read-only | PropertyRow "Widget Type" | yes (must be editable or at least a chooser) |
| `Widget.enabled` | ✅ checkbox | "Enabled" | yes (but no-op in preview — D5-03) |
| `Widget.visible` | ✅ checkbox | "Visible" | yes |
| `Widget.locked` | ✅ checkbox | "Geometry Lock" | yes |
| `Widget.geometry` | ✅ | X/Y/W/H fields + canvas drag/resize | yes |
| `Widget.zIndex` | ✅ | "Z-order" field + bring/send commands | yes |
| `Widget.bindings` | partial | count + Binding Editor (single-condition add/remove only) | yes |
| `Widget.assetIds` | **no UI** | read-only count only, no add/remove | yes — required for media/digit content |
| `Widget.mediaType` | **no UI** | read-only "Media Type: None" | yes — required for media widget |
| `Widget.audioAssetId` | **no UI** | read-only "Attached Audio: None" | yes |
| `Widget.mediaSlide` | **no UI** | read-only "Configured/None" | yes — media slide workflow |
| `Widget.content` | **no UI** (partial read-only) | only `content.floorMappingId` (digit) / `content.variant` (direction) shown | yes — text content, digit value, direction variant |
| `Widget.style` | **no UI** (partial read-only) | only `style.digitStyleId` / `style.directionStyleId` shown | yes — digit/direction style selection |
| `Scene.name` | ✅ | DraftTextField | yes |
| `Scene.priority` | ✅ | DraftNumberField | yes |
| `Scene.enabled` | ✅ | checkbox | yes |
| `Scene.activationConditions` | **no UI** | read-only "0 · all" | **yes — core scene-activation feature is unreachable** (D5-07) |
| `Scene.activationConditionMode` | **no UI** | only shown in the read-only count | yes |
| `Rotation.angle` | read-only | "Angle: R0" | yes (canonical four) |
| `Rotation.width/.height` | read-only | "Display: W×H" | yes (but see D5-22) |
| `ThemeProject.name` | ✅ | DraftTextField | yes |
| `ThemeProject.rotations` | read-only count | "Rotations: 4" | yes |
| `ThemeProject.resources` | **no UI** | read-only count, no add/remove | yes |
| `ThemeProject.defaultAssetIds` | **no UI** | — | yes |
| `ThemeProject.floorMappings` | **no UI** | read-only count | yes |
| `ThemeProject.themeDefaults` | **no UI** | — | yes |
| `ThemeProjectGroup.name` | ✅ | DraftTextField | yes |
| `Project.name` | ✅ | DraftTextField (project node selected) | yes |
| `Project.schemaVersion` | read-only | tree detail | no (internal) |
| `Project.deviceProfileId` | ✅ | `<select>` | yes |
| `Project.themeProjectGroups` | via explorer | add/delete/rename nodes | yes |
| `Project.assets` | **no import/add UI** | Asset Browser shows derived categories only | yes |
| `Project.defaultAssetIds` | **no UI** | — | yes |
| `Project.projectSettings` | **no UI** | — | yes |
| `Project.metadata` | **no UI** | — | no (internal) |
| `Asset.name` | ✅ | DraftTextField | yes |
| `Asset.sourcePath` | **no UI** (read-only) | "Source" row | yes |
| `Asset.mediaType` | **no UI** (read-only) | "Media Type" row | yes |
| `Asset.metadata` | **no UI** | — | no |

Summary: of the fields a designer needs to author a real template, **everything content-related is missing from the UI**: asset import/reference, `mediaType`, `assetIds`, `audioAssetId`, `mediaSlide`, `content`, `style`, scene `activationConditions`, theme `resources`/`floorMappings`/`defaultAssetIds`/`themeDefaults`, project `defaultAssetIds`/`projectSettings`. Only geometry/layer/flags/names/priority are editable.

---

## Table 4 — Validation rules verdict (question 16)

42 rule codes exist in `src/Core/validation.ts`. Messages ARE surfaced in the console **Validation tab** (code + path + message + one-line remediation), plus a status-bar LED and a per-selection count in Properties. **None are navigable** (no click-to-jump; `path` is inert text) and the remediation is a single generic sentence (no step-by-step). "UI?" = reachable by normal UI interaction (vs only via seeded localStorage).

| Code | UI? | Message shown | Navigable? | Explains fix? |
|---|---|---|---|---|
| PROJECT_NAME_REQUIRED | ❌ (rename refuses empty) | ✅ | ❌ | partial |
| PROJECT_SCHEMA_UNSUPPORTED | ❌ | ✅ | ❌ | partial |
| DEVICE_PROFILE_REQUIRED | ❌ | ✅ | ❌ | partial |
| DUPLICATE_STABLE_ID (asset) | ❌ | ✅ | ❌ | partial |
| ASSET_NAME_REQUIRED | ❌ (no asset add UI) | ✅ | ❌ | partial |
| ASSET_SOURCE_REQUIRED | ❌ | ✅ | ❌ | partial |
| THEME_PROJECT_REQUIRED | ✅ (delete theme) | ✅ | ❌ | partial |
| DUPLICATE_GROUP_ID | ❌ | ✅ | ❌ | partial |
| DUPLICATE_THEME_ID | ❌ | ✅ | ❌ | partial |
| DUPLICATE_WIDGET_ID | ❌ | ✅ | ❌ | partial |
| DEVICE_PROFILE_MISMATCH | ❌ | ✅ | ❌ | partial |
| ASSET_FORMAT_UNSUPPORTED | ❌ | ✅ | ❌ | partial |
| MISSING_REFERENCED_ASSET | ❌ | ✅ | ❌ | partial |
| UNKNOWN_RUNTIME_REFERENCE | ✅ **via setting-binding bug (D5-10)** and profile switch (D5-15) | ✅ | ❌ | partial |
| UNSUPPORTED_CONDITION_OPERATOR | ❌ (operator dropdown offers everything) | ✅ | ❌ | partial |
| INVALID_CONDITION_DATATYPE | ❌ (coercion prevents) | ✅ | ❌ | partial |
| INVALID_CONDITION_VALUE | ❌ (enum dropdown) | ✅ | ❌ | partial |
| BINDING_WIDGET_MISMATCH | ❌ | ✅ | ❌ | partial |
| BINDING_CONDITION_REQUIRED | ❌ (add requires a state) | ✅ | ❌ | partial |
| BROKEN_BINDING_CONTENT_REFERENCE | ❌ (no contentId UI) | ✅ | ❌ | partial |
| UNSUPPORTED_WIDGET_TYPE | ❌ (menu filters) | ✅ | ❌ | partial |
| INVALID_WIDGET_GEOMETRY | ❌ (fields clamp) | ✅ | ❌ | partial |
| WIDGET_Z_INDEX_INVALID | ❌ | ✅ | ❌ | partial |
| UNSUPPORTED_MEDIA_TYPE | ❌ | ✅ | ❌ | partial |
| AUDIO_BINDING_SCOPE_INVALID | ❌ | ✅ | ❌ | partial |
| AUDIO_ASSET_TYPE_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_SLIDE_WIDGET_TYPE_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_SLIDE_MEDIA_UNSUPPORTED | ❌ | ✅ | ❌ | partial |
| MEDIA_DURATION_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_DURATION_PRECISION_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_REPEAT_COUNT_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_ASSET_TYPE_INVALID | ❌ | ✅ | ❌ | partial |
| MEDIA_SLIDE_AUDIO_TYPE_INVALID | ❌ | ✅ | ❌ | partial |
| SCENE_PRIORITY_INVALID | ❌ (field clamps) | ✅ | ❌ | partial |
| VIDEO_SLOT_LIMIT_EXCEEDED | ❌ | ✅ | ❌ | partial |
| DUPLICATE_FLOOR_MAPPING | ❌ | ✅ | ❌ | partial |
| UNKNOWN_DIGIT_STYLE | ❌ | ✅ | ❌ | partial |
| BROKEN_FLOOR_STYLE_REFERENCE | ❌ | ✅ | ❌ | partial |
| REQUIRED_ROTATIONS_MISSING | ❌ (Add Theme creates all 4) | ✅ | ❌ | partial |
| DUPLICATE_ROTATION_ID | ❌ | ✅ | ❌ | partial |
| UNSUPPORTED_ROTATION | ❌ | ✅ | ❌ | partial |
| DUPLICATE_SCENE_ID | ❌ | ✅ | ❌ | partial |

**Verdict:** the validation engine is correct and honest, but it is almost entirely **unreachable from the UI** — the UI pre-validates at command boundaries (empty-name refusal, priority/geometry clamping) and offers no UI for the features the rules target (assets, media slides, floor mappings, scene activation). Only `THEME_PROJECT_REQUIRED` and `UNKNOWN_RUNTIME_REFERENCE` are UI-triggerable, and the latter only through the setting-binding bug (D5-10). Messages explain WHAT+WHERE (as a raw path string) but not HOW in actionable form, and you cannot jump to the object.

---

## Detailed findings

### D5-01 — Scene priority non-integer silently reverted (P2 · BUG)
- **Repro:** select a scene → Priority field → type `5.5` → Enter.
- **Observed:** field snaps back to the previous value (`0`), **no feedback, no console message**.
- **Expected:** "must be an integer" feedback or clamp to 5/6.
- **Root cause:** `DraftNumberField` (App.tsx:311) clamps to [0,10] — `5.5` is in-range so no clamp feedback — then `setSceneProperties` (`src/Core/editor-application.ts:281`) rejects `!Number.isInteger(priority)` → `{changed:false}`; the onCommit handler logs nothing. The canonical value never changes, so the field re-renders to the old value with zero explanation.
- **Severity:** P2 — silent rejection is a UX bug; the user believes the value applied.

### D5-02 — Geometry X/Y clamp feedback is wrong (P2 · BUG)
- **Repro:** select a widget, type `1000000000` into X.
- **Observed:** feedback reads **"clamped to 720"** but the committed value is **600**.
- **Expected:** feedback should report the effective bound (or the field's max should already be `rotation.width − widget.width`).
- **Root cause:** `GeometryField` max = `activeRotation.width` (App.tsx:1905), but `commitSelectionGeometryField` → `clampGeometryToScene` (App.tsx:1255-1266) re-clamps `x` to `min(x, width − widgetWidth)` so the right edge stays on-canvas. Two different clamp bounds; the user is told 720 and gets 600. (Same for Y: 1280 vs 1200.)
- **Severity:** P2 — misleading feedback on a core editing surface.

### D5-03 — `Widget.enabled` has no runtime/preview effect (P2 · MISSING FEATURE)
- **Repro:** disable a widget via the "Enabled" checkbox → enter Preview.
- **Observed:** widget still renders.
- **Expected:** a disabled widget should not participate in the runtime display.
- **Root cause:** `renderCanvasWidget` (App.tsx:1743) only checks `widget.visible`, never `widget.enabled`; `runtime.ts` never reads `enabled` (only `Scene.enabled`). `enabled` is only consulted for snap-target filtering (App.tsx:1393).
- **Severity:** P2 — an exposed flag that does nothing is misleading.

### D5-04 — Uncommitted field edit silently lost on selection change (P3 · STATE BUG)
- **Repro:** type `555` into X (don't blur) → click a tree node → re-select the widget.
- **Observed:** X is the previous committed value (e.g. `444`); `555` is gone with no warning.
- **Expected:** the edit should either commit on blur before the selection change, or be visibly discarded.
- **Root cause:** `GeometryField`/`DraftNumberField`/`DraftTextField` commit only in `onBlur`. Changing selection unmounts the field without firing blur (the panel re-renders to a different node), so the draft is dropped.
- **Severity:** P3 — no misapplication/corruption (it is *discarded*, not applied to the wrong object), but it is silent.

### D5-05 — Nothing-selected state hides project/device-profile fields (P3 · UX)
- **Repro:** clear the selection (empty canvas click) → inspect Properties.
- **Observed:** only "Select a canonical item to inspect"; no project name or Device Profile select.
- **Expected:** a "Document Properties" context should expose `Project.name` / `deviceProfileId`.
- **Root cause:** all fields are inside `selection && node ? … : <properties-empty>` (App.tsx:1900,1916). Project name/profile are only reachable by selecting the Project node. (Profile is still switchable via Project menu.)
- **Severity:** P3.

### D5-06 — Theme selection shows misleading "Nothing selected · Project context" (P3 · UX)
- **Repro:** select a Theme Project node.
- **Observed:** inspector header reads `New Theme Project` **+ "Nothing selected · Project context"**.
- **Root cause:** `selection?.detail ?? "Nothing selected · Project context"` (App.tsx:1899); themes have no `detail`.
- **Severity:** P3.

### D5-07 — Scene activation conditions / mode have no authoring UI (P1 · MISSING FEATURE / MISSING ENTRY POINT)
- **Repro:** select a scene → try to add an activation condition.
- **Observed:** only a read-only row `Activation Conditions: 0 · all`; no button, no editor.
- **Expected:** a condition editor like the binding editor (source/state/operator/value, and an all/any mode).
- **Root cause:** App.tsx:1911 renders `node.scene.activationConditions.length` and `activationConditionMode` as text only; `editor-application.ts` has no `setSceneActivationConditions` method.
- **Severity:** P1 — the entire **scene-activation** capability (priority + conditions → which scene is shown) is only half-implemented: priority is editable, conditions are not. Only scenes with zero conditions (always-active) can ever be authored.

### D5-08 — Widget content/media/style/asset fields have no editing UI (P1 · MISSING FEATURE)
- **Repro:** create a media/text/digit widget and try to set its media, asset, content, or style.
- **Observed:** all read-only or absent (`Media Type: None`, `Asset References: 0`, `Media Slide: None`, `Style`/`Floor Mapping`/`Variant` read-only). The only actionable control is "Open Binding Editor".
- **Root cause:** App.tsx:1906-1909 renders counts and `?? "None"` values; there is no command to set `mediaType`/`assetIds`/`audioAssetId`/`mediaSlide`/`content`/`style` (the only property patch is `editWidgetProperties` over name/enabled/visible/locked/geometry/zIndex/content/style, but the UI never calls it with content/style).
- **Severity:** P1 — a designer cannot give a widget any actual content; combined with D5-16 the preview can never show real content.

### D5-09 — Theme/project/asset resource & metadata fields have no UI (P2 · MISSING FEATURE)
- **Repro:** select a theme/project/asset and try to edit resources, floor mappings, defaults, settings, or asset source/media.
- **Observed:** read-only counts or absent entirely.
- **Root cause:** App.tsx:1913-1914; no commands exist for `ThemeProject.resources`, `floorMappings`, `themeDefaults`, `defaultAssetIds`, `Project.projectSettings`, `defaultAssetIds`, `Asset.sourcePath`/`mediaType`/`metadata`.
- **Severity:** P2 — no asset-import path, so `Project.assets` is always empty and every asset-reference rule (Table 4) is dead in normal use.

### D5-10 — Binding against `source:'setting'` is broken (P1 · BUG)
- **Repro:** open Binding Editor → "When" = **Language (enum)** (a *setting*) → value `en` → action show → Add Binding.
- **Observed:** binding is created, but the console Validation tab immediately reports `UNKNOWN_RUNTIME_REFERENCE — Runtime state 'language' is not defined by the active DeviceProfile`, and the binding never matches at runtime.
- **Expected:** either settings are excluded from the "When" dropdown, or `source:'setting'` is set and honored.
- **Root cause:** the dropdown mixes `runtimeStates` and `runtimeSettings` (App.tsx:2020), but `addBinding` (App.tsx:910) never writes `condition.source`, so `getDefinition` (runtime.ts:15) and `validateCondition` (validation.ts:51) both default to `'state'` and resolve against `runtimeStates`, where `language` does not exist.
- **Severity:** P1 — a normal UI path produces an invalid, silently-dead binding.

### D5-11 — No multi-condition bindings; `conditionMode:'any'` unreachable (P1 · MISSING FEATURE)
- **Repro:** try to add a second condition to an existing binding, or set "any".
- **Observed:** each "Add Binding" creates a **new single-condition binding**; there is no condition-list editor and no all/any toggle.
- **Root cause:** `addBinding` (App.tsx:907-912) always builds `conditions: [ {…one condition…} ]`; `replaceWidgetBindings` replaces the whole list; no `conditionMode` control exists.
- **Severity:** P1 — the domain supports `conditions[]` + `conditionMode`, but the UI cannot author them.

### D5-12 — `select-content` / `select-style` actions are no-ops (P1 · INCOMPLETE WORKFLOW)
- **Repro:** add a binding with action `select-content` (or `select-style`).
- **Observed:** the binding is created, the card footer reads `content/style: presentation`, and nothing changes in preview.
- **Expected:** a contentId/styleId picker and a runtime content switch.
- **Root cause:** `bindingDraft` (App.tsx:468) has no `contentId`; the action list (App.tsx:2020) offers `select-content`/`select-style`, but there is no field to supply the target, and the runtime's `bindingEffects` only applies `contentId` when present (App.tsx:1140).
- **Severity:** P1 — an exposed action that can never do anything.

### D5-13 — No edit-in-place for existing bindings (P2 · UX DISCOVERABILITY)
- **Repro:** add a binding, then try to change its operator/value/action.
- **Observed:** bindings can only be **removed** (`×`) and re-added; no edit controls per condition.
- **Root cause:** App.tsx:2020 renders each binding card with only a remove button; `removeBinding` + `addBinding` are the only mutators.
- **Severity:** P2.

### D5-14 — Operator dropdown ignores the profile's `operators` restriction (P3 · MISSING FEATURE)
- **Repro:** open Binding Editor and inspect the Operator select.
- **Observed:** all five operators (`equals, not-equals, greater-than, less-than, contains`) are offered for **every** state, including `Fire (boolean)` (no operators declared) and `Floor (integer)` (declared operators exclude `contains`).
- **Expected:** operators constrained by `definition.operators`.
- **Root cause:** App.tsx:2020 hardcodes `["equals",…,"contains"]`; `RuntimeStateDefinition.operators` is only consumed by validation, not the UI.
- **Severity:** P3 — lets users author conditions that can never match (e.g. `greater-than` on a boolean).

### D5-15 — No proactive warning when a profile switch orphans conditions (P3 · UX)
- **Repro:** on the Foundation profile add a binding on `service_state`; switch Device Profile → Compact Display Profile.
- **Observed:** the switch succeeds silently; the binding becomes `UNKNOWN_RUNTIME_REFERENCE` (`service_state` is Foundation-only) and is only surfaced via the status LED / Validation tab. No crash; no confirmation.
- **Expected:** a warning at switch time listing newly-orphaned references.
- **Root cause:** `setProjectDeviceProfile` (editor-application.ts:339) only swaps `deviceProfileId`; nothing re-checks conditions until validation runs.
- **Severity:** P3 — correct end-state (validation catches it), poor discoverability.

### D5-16 — Preview draws only a labeled rectangle for every widget type (P1 · MISSING FEATURE)
- **Repro:** create media/text/digit widgets and enter Preview.
- **Observed:** every widget renders as `<div class="canvas-widget"><span>Name</span><small>type</small></div>` — e.g. `Media / media`, `Text / text`, `Digit / digit`. No text content, no digit glyph, no direction arrow, no image/video. Design mode renders the identical representation.
- **Expected:** the preview should faithfully render widget content (text value, digits, direction glyph, media).
- **Root cause:** `renderCanvasWidget` (App.tsx:1739-1750) renders only `widget.name` + `widget.widgetType`; `content`/`style`/`mediaType`/`assetIds` are never read for display.
- **Severity:** P1 (arguably P0) — preview is a core V1 workflow (AGENTS.md: Edit → Preview → Validate → Build) and it does not show what the device will show.

### D5-17 — Step / Run / Pause are nominal; no real simulation (P2 · INCOMPLETE WORKFLOW)
- **Repro:** use the Simulator ▶ Run / Ⅱ Pause / Step buttons.
- **Observed:** Run sets status `RUNNING` + logs a one-line trace; Pause sets `PAUSED`; Step = `traceRuntime()` (just logs the active scene/bindings). There is **no time-based stepping, no sequence, no playback**. The runtime is a static input→evaluation map.
- **Root cause:** App.tsx:1922-1944 (`traceRuntime`, `resetSimulator`, toolbar handlers). `simulationStatus` only drives the Pause disabled state and the status text.
- **Severity:** P2 — misleading controls for a "simulator".

### D5-18 — "Why is this scene active" is only partially shown (P3 · UX)
- **Repro:** inspect the Simulator with multiple scenes.
- **Observed:** Active Scene card shows name + priority; candidates show `MATCH`/`skip`. No per-condition breakdown explaining *why* a scene matched (and no condition UI exists to produce conditions anyway).
- **Root cause:** `runtime.candidates` (runtime.ts:99-118) carries only `matched`/priority/order; App.tsx:1948 renders `MATCH`/`skip` without condition detail.
- **Severity:** P3.

### D5-19 — Document can be mutated from Preview (P2 · STATE BUG)
- **Repro:** enter Preview with a widget selected, press Delete (or use the context-bar Delete/Duplicate/Lock/Hide, or edit properties).
- **Observed:** geometry drag/resize/marquee are blocked with a warning, but **Delete, Duplicate, Lock, Hide/Show, zIndex, priority, rename are all still active** in preview.
- **Root cause:** only `beginWidgetMove` (App.tsx:1311), `beginWidgetResize` (App.tsx:1338), `beginCanvasMarquee` (App.tsx:1292) check `viewMode==="preview"`; `handleGlobalKeyDown` (delete/undo/etc.) and the context bar (App.tsx:2007) do not.
- **Severity:** P2 — "Preview" is not a read-only mode; accidental mutation is possible.

### D5-20 — Validation messages are not navigable (P2 · UX DISCOVERABILITY)
- **Repro:** trigger any validation error and look at the Validation tab.
- **Observed:** each issue shows code + `path` (a raw string) + message + remediation, but the path is inert text — there is **no click-to-jump** to the offending object. The status-bar LED and the per-selection count are the only other surface.
- **Root cause:** App.tsx:1958 renders `issue.path` inside `<code>` with no handler; there is no select-and-focus-from-path mechanism.
- **Severity:** P2 — for a designer with many errors, "where is it" is not actionable.

### D5-21 — Invalid states the domain permits that no rule catches (P2 · VALIDATION BUG)
- **Repro (seeded localStorage):** two scenes both named "Scene A" in the same rotation; a scene with zero widgets; a digit widget with no `style.digitStyleId`; a widget with `geometry.x` far outside the rotation bounds; a theme with zero scenes.
- **Observed:** validation passes (no issue) for all of these.
- **Expected:** rules for duplicate scene *names*, empty scenes, missing digit style, out-of-bounds geometry, zero-scene themes (or at least explicit warnings).
- **Root cause:** `validation.ts` validates IDs (not names), geometry only for finite/positive, and has no digit-style, bounds, or scene-emptiness checks. (Confirmed duplicate scene names and empty scene are unflagged; digit-style/bounds/zero-scene confirmed by source absence.)
- **Severity:** P2.

### D5-22 — Device profile switch does not re-dimension existing rotations (P2 · STATE BUG)
- **Repro:** on Foundation (720×1280) add a scene/widget; switch Project → Device Profile → Compact Display Profile (480×800).
- **Observed:** the canvas frame header stays `R0 · 720 × 1280`; rotation dimensions are unchanged. Only *newly created* themes use the new profile's display.
- **Expected:** the code comment claims switching "re-dimensions" (`factories.ts:48-53`), so dimensions should follow the profile.
- **Root cause:** `setProjectDeviceProfile` (editor-application.ts:339-342) only sets `deviceProfileId`; no re-dimension pass exists. `Rotation.width/height` are persisted per-rotation and drive the canvas (App.tsx:1145-1146).
- **Severity:** P2 — a profile switch leaves the canvas geometry out of sync with the selected device.

### D5-23 — Exported package contains no binary media (P1 · INCOMPLETE WORKFLOW)
- **Repro:** build a project that references an asset; inspect the package files.
- **Observed:** each asset becomes `assets/<id>.asset.json` — a metadata record with `binary: false`; **no image/video/audio bytes** are included.
- **Expected:** a deployable package must carry the actual media, or the build must refuse to claim it produced a deployable artifact.
- **Root cause:** `assetFile` (export.ts:73-92) deliberately writes only a "normalized logical asset record"; the comment says binary materialization belongs to the adapter — but no adapter exists in V1 (`UnsupportedDeploymentManager`, application.ts:44). "Built · checksum verified" therefore does **not** mean "deployable to a device".
- **Severity:** P1 — misleading completion state for the SD-card workflow.

### D5-24 — UI cannot produce a project with non-empty manifest asset ids (P2 · MISSING FEATURE)
- **Repro:** build any UI-authored project; note the build log.
- **Observed:** `Package verified · 0 asset record(s)`; `usedAssetIds`/`resourceAssetIds`/`defaultAssetIds`/`assetIds` are always empty.
- **Root cause:** there is no asset-import or asset-reference UI (D5-08/D5-09), so `collectUsedAssetIds`/`collectResourceAssetIds`/`collectDefaultAssetIds` (export.ts:48-71) always return empty sets. The manifest machinery is correct but inert.
- **Severity:** P2.

### D5-25 — Advertised shortcuts F2 / Alt+Arrow / Ctrl+0 are not implemented (P2 · MISSING FEATURE)
- **Repro:** Settings → Shortcuts lists "Rename Selection (F2)", "Next Scene (Alt+→)", "Previous Scene (Alt+←)", "Next/Previous Rotation (Alt+↓/↑)", "Zoom to 100% (Ctrl+0)". Press them.
- **Observed:** F2 does nothing (focus stays on body, no rename editor); Alt+Arrow does nothing; Ctrl+0 does nothing.
- **Root cause:** `canonicalShortcuts` (shortcut-registry.ts:82-100) declares `rename`, `scene-next/previous`, `rotation-next/previous`, `zoom-reset`, but `handleGlobalKeyDown` (App.tsx:1556-1615) has no cases for them (only undo/redo/save/new/copy/cut/paste/select-all/delete).
- **Severity:** P2 — advertised behavior that silently does nothing.

---

## Preview-fidelity verdict (question 14)

**Not faithful.** The preview renders every widget as a name+type labeled rectangle; it does not render widget content (text, digits, direction glyphs, media). It *does* honor: scene activation result (`selectActiveScene`), binding `show`/`hide` (verified: floor=6 → hide binding hides the widget), widget `visible` flag, z-order (inline `zIndex`), geometry (percentage positioning), and rotation canvas aspect-ratio (R90/R270 swap width/height). It does **not** honor: widget `enabled`, binding `play/pause/stop/restart/continue` (only a text suffix `· play`), `select-content`/`select-style`, or any content. Because `Scene.activationConditions` and widget content have no authoring UI (D5-07, D5-08), the preview can never demonstrate the core scene-activation or content-rendering behavior the domain model describes.

## Build/export verdict (question 18-20)

Honest states observed live: `Not built` → `Built · checksum verified` for a valid scaffold; `Blocked · validation failed` for a zero-theme project (with the specific `THEME_PROJECT_REQUIRED` code logged). `buildDeploymentPackage` throws `ExportBlockedError` on invalid, and `verified` starts `false` (export.ts:180) until `verifyDeploymentPackage` recomputes the sha256 (export.ts:184-192). The checksum is real and the "verify" step is honest. The two real gaps are D5-23 (no binary media) and D5-24 (asset ids always empty from UI). There is no explicit "reset build status" control; status changes only via rebuild or New Project (which resets to `Not built`).

---

## Positive / negative results (not findings, with evidence)

- **Undo/redo** works for geometry edits, renames, deletions, and binding edits (verified: Ctrl+Z removed a just-added binding; each field commit is one undoable command via `EditorApplication.execute`).
- **Persistence** works: projects persist to `localStorage` and are restored on boot; `save()` only marks clean after the storage write succeeds (document-store.ts:77-84).
- **Duplicate / copy / paste re-parent bindings correctly**: `duplicateWidget` (editor-application.ts:88-99) and `insertWidgetCopies` regenerate binding ids and set `widgetId` to the copy, so no `BINDING_WIDGET_MISMATCH` on duplicate/paste.
- **Orphan references after profile switch are caught, not crashed**: switching Foundation→Compact flagged the Foundation-only `service_state` condition (`UNKNOWN_RUNTIME_REFERENCE`), the Foundation-only `digit-default` floor style (`UNKNOWN_DIGIT_STYLE`/`BROKEN_FLOOR_STYLE_REFERENCE`), and `video` media slide (`MEDIA_SLIDE_MEDIA_UNSUPPORTED`) — all surfaced, no runtime crash.
- **Delete of a widget deletes its bindings** (bindings are embedded in the widget, not separate references), so "delete the widget a binding points at" cannot orphan a binding — correct by construction.
- **Empty numeric fields are never treated as 0** — they revert with "invalid value — reverted".

---

## Top 5 root causes

1. **`App.tsx:1739-1750` (`renderCanvasWidget`)** — the preview renders only name+type; widget `content`, `style`, `mediaType`, `assetIds`, and `enabled` are never read for display. This is the single biggest product gap (D5-16, D5-03).
2. **`App.tsx:907-912` + `runtime.ts:15` + `validation.ts:51`** — binding authoring never sets `condition.source`, so settings offered in the dropdown are validated/evaluated as states → invalid, dead bindings (D5-10).
3. **`App.tsx:1906-1914`** — the Properties panel exposes only geometry/layer/flags/name; there is no UI (and in places no command) for `mediaType`, `assetIds`, `audioAssetId`, `mediaSlide`, `content`, `style`, scene `activationConditions`/`activationConditionMode`, theme `resources`/`floorMappings`/`themeDefaults`/`defaultAssetIds`, project `defaultAssetIds`/`projectSettings`, or asset import (D5-07, D5-08, D5-09, D5-24).
4. **`App.tsx:1556-1615` (`handleGlobalKeyDown`) vs `shortcut-registry.ts:82-100`** — the key handler implements only a subset of the advertised shortcut table, so F2/Alt+Arrow/Ctrl+0 are dead (D5-25); the same handler (plus the context bar, App.tsx:2007) never checks `viewMode`, so Preview is not read-only (D5-19).
5. **`export.ts:73-92` (`assetFile`) + `application.ts:44` (`UnsupportedDeploymentManager`)** — the package builder emits metadata-only asset records (`binary:false`) and there is no adapter to materialize binaries, so "Built · checksum verified" does not imply a deployable package (D5-23).

---
*(End of D5 findings — 25 findings, ids D5-01 … D5-25.)*
