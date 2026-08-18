# D6 — Domain↔UI Reachability Matrix (purely static)

**Repo:** `C:\Users\b1601\Template_Designer` · branch `manus2`
**Method:** static reading of every listed source and spec file. No browser, no dev server, no repo writes. `npx.cmd tsc --noEmit` run twice (read-only) → exit 0 both times.

## BASELINE AND A VOLATILITY WARNING (read this first)

**The audit target was being edited by another agent while this audit ran.**

| Observation | Evidence |
|---|---|
| HEAD commit | `11cc2c6 fix(core): menu-added Theme Projects get the canonical four rotations` |
| Dirty worktree | `git status --porcelain` → ` M src/App/App.tsx`, ` M src/Core/editor-application.ts`, ` M src/Domain/factories.ts`, ` M src/main.tsx`, ` M tests/editor-pipeline.test.ts`, `?? docs/PRODUCT_COMPLETION_LEDGER.md` |
| `editor-application.ts` grew mid-audit | 30,490 B → 44,108 B (551 → 797 lines) between two reads in one session; `LastWriteTime 2026-08-19T00:33:48` observed at `00:34:15` |
| `App.tsx` changed mid-audit | `LastWriteTime 2026-08-19T00:34:58` |
| `git diff --stat` | `App.tsx 16-`, `editor-application.ts +300`, `factories.ts +51`, `main.tsx ±4`, `editor-pipeline.test.ts ±49` |

**Therefore every `file:line` in Deliverables 1–5 below is pinned to commit `11cc2c6`**, which anyone can reproduce with `git show 11cc2c6:<path>`. This is the only reproducible baseline. Two byte-verified snapshots were taken outside the repo:

- `C:\Users\b1601\AppData\Local\Temp\td-completion\HEAD-editor-application.ts` (SHA1 `816E6A6F6245BE247678E4A50B323EAE999666A8`, 551 lines)
- `C:\Users\b1601\AppData\Local\Temp\td-completion\WT-editor-application.ts` (SHA1 `5056D4093B118A1A4C700E255470F14B9E68C34C`, 797 lines)
- `C:\Users\b1601\AppData\Local\Temp\td-completion\WT-App.tsx` (SHA1 `D249B664293A11412CBBDDB4EE789F65D3B20CD4`)

`App.tsx` at HEAD == `App.tsx` at the time of my full read (2026-08-18 23:52), because at that moment `git status` reported only `editor-application.ts` as modified. **In the current working tree, App.tsx line numbers after 644 shift by −16** (the dead `addRotation` block at HEAD 645–660 was deleted).

**Appendix A** records the in-flight delta, because it already invalidates several verdicts below at the *Core* layer (never yet at the UI layer).

**Global facts used throughout, stated once:**

- **persists?** `LocalStorageProjectStorage.save` writes `JSON.stringify(project)` wholesale (`src/Infrastructure/project-storage.ts:73`), and `InMemoryDocumentStore.save` delegates to it (`src/Core/document-store.ts:81`). So **every** field of the project document persists once it exists — persistence is never the blocker. `Y` below means "persists if present", not "reachable".
- **undoable?** Every `EditorApplication` mutation routes through `execute()` which pushes a before/after snapshot command (`src/Core/editor-application.ts:151-165`), so any field a method can write is undoable. `Y` = "an undoable command exists that can write it".
- **Load gate:** `isLoadableProject` (`project-storage.ts:32-62`) only validates id/name/schemaVersion/deviceProfileId/groups/themes/rotations/scenes/widget geometry+zIndex+bindings. Every optional field below is accepted unvalidated on load.
- **VERDICT key:** `REACHABLE` = a user can set it from the UI · `READ-ONLY` = visible, not editable · `ORPHAN` = exists and some layer consumes it, but no user can ever set it · `DEAD` = nothing consumes it and no user can set it.

---

# DELIVERABLE 1 — FIELD-LEVEL REACHABILITY MATRIX

## 1.1 `Project` (`src/Domain/models.ts:206-216`)

| Field | created by | EditorApplication method | UI entry point (App.tsx) | persists | undoable | validated | runtime.ts | export.ts | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `Project.id` | `createEmptyProject` factories.ts:96 | — (never mutated) | none | Y | n/a | no | no | Y `export.ts:142,144,174` | Y foundation.test.ts:48 | READ-ONLY (by design; stable ID) |
| `Project.schemaVersion` | factories.ts:97 | — | none | Y | n/a | Y `validation.ts:315` | no | Y `export.ts:141,143` | Y domain-runtime.test.ts:194 | ORPHAN — consumed by **export.ts** (drives `packageId`/`packageVersion`) and validation; no migration or UI writer exists |
| `Project.name` | factories.ts:98 | `renameNode` :252-277 | `DraftTextField` → `renameSelectedNode` :867-877, rendered :1901 | Y | Y | Y `validation.ts:312` | no | Y `export.ts:145` | Y editor-widgets.test.ts:168 | **REACHABLE** |
| `Project.deviceProfileId` | factories.ts:99 | `setProjectDeviceProfile` :339-342 | Project menu :1782; Properties `<select>` :1902 | Y | Y | Y `validation.ts:318,357` | no | no (export uses `profile.id`) | Y editor-widgets.test.ts:239 | **REACHABLE** — but the `<select>` is `disabled` when `availableProfiles.length < 2` (:1902) and at HEAD `main.tsx:8` registers exactly one profile, so it is *inert at runtime* |
| `Project.themeProjectGroups` | factories.ts:100 | `addThemeProject`, `deleteSelection`, `duplicateSelection` | Theme menu :1786; Delete :1769/1792/1801; Duplicate :1799 | Y | Y | Y `validation.ts:331-351` | no | Y `export.ts:138` | Y editor-pipeline.test.ts:74 | **REACHABLE** |
| `Project.assets` | factories.ts:101 (always `[]`) | **none at HEAD** | **none** | Y | — | Y `validation.ts:322-327,363-368` | no | Y `export.ts:137,162` | Y (hand-built fixtures only) domain-runtime.test.ts:97 | **ORPHAN — highest-value finding.** Consumed by **validation.ts and export.ts**; no import command exists anywhere at HEAD, so `assets` is permanently `[]` in any real project |
| `Project.defaultAssetIds` | never | none | none | Y | — | Y `validation.ts:371` | no | Y `export.ts:60,150` | no | **ORPHAN** — consumed by **export.ts** (`manifest.defaultAssetIds`) + validation |
| `Project.projectSettings` | never | none | none | Y | — | no | no | no | no | **DEAD** — declared at models.ts:214 and in `DOMAIN_MODEL_V1.md:12`; **no layer reads it** |
| `Project.metadata` | factories.ts:102 (`{}`) | none | none | Y | — | no | no | no | referenced only as a fixture literal (core-integrity.test.ts:12) | **DEAD** — `DOMAIN_MODEL_V1.md:52` requires it; no consumer anywhere (export builds its own manifest, `export.ts:140-152`, and does not carry `metadata`) |

## 1.2 `ThemeProjectGroup` (`models.ts:192-196`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | `createEmptyThemeProjectGroup` factories.ts:83 | — | none | Y | n/a | Y `validation.ts:341` (DUPLICATE_GROUP_ID) | no | no | Y editor-pipeline.test.ts:351 | READ-ONLY |
| `name` | factories.ts:84 (`"Untitled Theme Group"`) | `renameNode` :261 | Properties DraftTextField :1901 | Y | Y | no (no empty-name check for groups) | no | no | no | **REACHABLE** |
| `themeProjects` | factories.ts:85 | `addThemeProject` :167-180, `deleteSelection` :428, `duplicateSelection` :512-513 | Theme menu :1786; Delete; Duplicate :1799 | Y | Y | Y `validation.ts:331,343-345` | no | Y `export.ts:138` | Y editor-pipeline.test.ts:77 | **REACHABLE** |

## 1.3 `ThemeProject` (`models.ts:182-190`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | factories.ts:69 / :168 | — | none | Y | n/a | Y `validation.ts:344` | no | Y `export.ts:96,99,108,147` | Y editor-pipeline.test.ts:107 | READ-ONLY |
| `name` | factories.ts:70 | `renameNode` :263 | Properties DraftTextField :1901 | Y | Y | no | no | Y `export.ts:100` | Y editor-widgets.test.ts (via rename) | **REACHABLE** (no uniqueness: `addThemeProject` is called with `undefined` name at App.tsx:632 → every theme is literally "New Theme Project"; contrast the `uniqueDefaultName` helper :171-176 used only for scenes/widgets) |
| `rotations` | factories.ts:71-76 (exactly 4) | `addRotation` :182-191, `deleteSelection` :431-432, `duplicateSelection` :519-520 | **none for add** (App's `addRotation` :645-659 is defined and never referenced); Delete + Duplicate ARE reachable | Y | Y | Y `validation.ts:277-281` (REQUIRED_ROTATIONS_MISSING) | Y `runtime.ts` via `rotation.scenes` | Y `export.ts:107-111` | Y foundation.test.ts:38 | **REACHABLE but rule-violating** — see F1/F2 in Deliverable 5 |
| `resources` | factories.ts:77 / :177 (always `[]`) | **none** | **none** (read-only count :1913; Explorer count :1115; Asset Browser filter :1837) | Y | — | Y `validation.ts:302` | no | Y `export.ts:69,101,148` (`manifest.resourceAssetIds`) | Y (fixture literal) domain-runtime.test.ts:87 | **ORPHAN** — consumed by **export.ts + validation.ts**; no writer at HEAD |
| `defaultAssetIds` | never | none | none | Y | — | Y `validation.ts:303` | no | Y `export.ts:63,102,150` | Y (fixture) domain-runtime.test.ts:88 | **ORPHAN** — consumed by **export.ts + validation.ts** |
| `floorMappings` | never | none | read-only count :1913 | Y | — | Y `validation.ts:304,247-268` | no | Y `export.ts:103` | no | **ORPHAN** — consumed by **export.ts + validation.ts**; `BINDING_PARAMETRIC_SYSTEM_V1.md:95` demands a dedicated Floor Mapping Editor |
| `themeDefaults` | never | none | none | Y | — | no | no | Y `export.ts:104` | no | **ORPHAN** — consumed by **export.ts only**; `DOMAIN_MODEL_V1.md:19` lists it |

## 1.4 `Rotation` (`models.ts:163-169`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | factories.ts:72 | — | none | Y | n/a | Y `validation.ts:285-288` | no | Y `export.ts:108` | Y editor-pipeline.test.ts:38 | READ-ONLY |
| `angle` | factories.ts:73 | `addRotation(themeId, angle)` :182 (default 0) | none (App `addRotation` :648 hardcodes `0` and is itself unreachable) | Y | Y | Y `validation.ts:277-281,289-291` | no | Y (whole rotation serialized `export.ts:110`) | Y foundation.test.ts:38-40 | **READ-ONLY by design** (canonical R0/R90/R180/R270) |
| `width` / `height` | factories.ts:74 via `rotationDimensions` :51-55 | derived only, never patched | none; displayed :1104, :1912, device frame :1992 | Y | Y (as part of add) | Y `project-storage.ts:48` load gate requires numeric | no | Y `export.ts:110` | Y foundation.test.ts:39-40 | **READ-ONLY** — derived from `DeviceProfile.display`; a profile switch does **not** re-derive them at HEAD (`setProjectDeviceProfile` :339-342 only swaps the id) → see F7 |
| `scenes` | factories.ts:75 (`[]`) | `addScene` :193-200, `moveScene` :236-246, `deleteSelection`, `duplicateSelection` | Add Scene :1789/:947; Delete; Duplicate. **No reorder UI** for `moveScene` | Y | Y | Y `validation.ts:292-299` | Y `runtime.ts:94-119` `selectActiveScene` | Y `export.ts:110` | Y editor-pipeline.test.ts:120,153 | **REACHABLE** (order is not user-controllable → F11) |

## 1.5 `Scene` (`models.ts:153-161`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | :197 | — | none | Y | n/a | Y `validation.ts:294-296` | Y `runtime.ts:100,102,115` | Y | Y | READ-ONLY |
| `name` | :197 (`uniqueDefaultName` App :665) | `renameNode` :269; `setSceneProperties({name})` :279 | DraftTextField :1901 (via `renameNode`). The `setSceneProperties` name path has **no UI caller** | Y | Y | no (no SCENE_NAME_REQUIRED rule) | no | Y | Y editor-widgets.test.ts:168,185 | **REACHABLE** |
| `priority` | :197 (`0`) | `setSceneProperties({priority})` :279-285 | `DraftNumberField` min 0 max 10 :1911 | Y | Y | Y `validation.ts:225-227` | Y `runtime.ts:101,110-112` | Y | Y editor-widgets.test.ts:182-184 | **REACHABLE** |
| `enabled` | never set (undefined) | `setSceneProperties({enabled})` :279 | checkbox :1911 | Y | Y | no | Y `runtime.ts:104` (`enabled !== false`) | Y | Y editor-widgets.test.ts:182 | **REACHABLE** |
| `activationConditions` | :197 (always `[]`) | **none at HEAD** (`setSceneProperties` Pick omits it, :279) | read-only count :1911 | Y | — | Y `validation.ts:229` | **Y `runtime.ts:105`** — decides the active Scene | Y | Y (fixture literals only) | **ORPHAN — the single highest-value finding.** Consumed by **runtime.ts and validation.ts**. No user can author a Scene activation rule, so `conditionsMatch([])` returns `true` (`runtime.ts:88`) and *every* Scene always matches; active-Scene selection collapses to pure priority. `SCENE_DESIGNER_QUESTIONNAIRE_V1.md:44-52,71-88` requires a Condition Editor |
| `activationConditionMode` | never | `setSceneProperties` accepts it :279 — **no UI caller** | read-only :1911 | Y | Y | no | **Y `runtime.ts:105`** | Y | no | **ORPHAN** — consumed by **runtime.ts** |
| `widgets` | :197 (`[]`) | `addWidget` :208, `deleteSelectionInScene` :444, `duplicateSelectionInScene` :464, `insertWidgetCopies` :486, `duplicateWidgetsAt` :295, `moveWidget` :344 | Add Widget :1796/:2007/:2006; Delete; Duplicate; Paste :825. **No reorder UI** for `moveWidget` | Y | Y | Y `validation.ts:230,346-349` | Y `runtime.ts:141` | Y | Y editor-widgets.test.ts:51-98 | **REACHABLE** |

## 1.6 `Widget` (`models.ts:135-151`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | :214 | — | none | Y | n/a | Y `validation.ts:346-349` | Y `runtime.ts:142` | Y | Y editor-widgets.test.ts:64 | READ-ONLY |
| `name` | :215/:221 (`defaultWidgetName` :26, `uniqueDefaultName` App :697) | `renameNode` :271; `editWidgetProperties` :375; `setWidgetsPropertiesInScene` :393 | DraftTextField :1901 | Y | Y | no | no | Y | Y editor-widgets.test.ts:169 | **REACHABLE** |
| `widgetType` | :222 | only at create (`addWidget` :208). No change method at HEAD | Widget menu :1796, context menu `scene.add-widget:*` :948, empty-state button :2006, context bar :2007 | Y | Y | Y `validation.ts:149` | no | no | Y editor-widgets.test.ts:66 | **REACHABLE at create only** (no post-create type change; read-only row :1901,:1904) |
| `enabled` | :223 (`true`) | `setWidgetsPropertiesInScene` :393; `editWidgetProperties` :375 | checkbox :1904 → `toggleWidgetProperty("enabled")` :843 | Y | Y | no | no | Y | Y editor-widgets.test.ts:197 | **REACHABLE** (but `enabled:false` widgets are still *rendered* — `renderCanvasWidget` :1743 only tests `visible` — while `hitTest`/`marqueeSelection` exclude them (`canvas-interaction.ts:319,327`) → F13) |
| `visible` | :224 (`true`) | `setWidgetsVisibilityInScene` :287; `setWidgetsPropertiesInScene`; `editWidgetProperties` | checkbox :1904; Hide/Show All :1790-1791; context bar :2007; `widget.hide-toggle` :951 | Y | Y | no | no | Y | Y editor-widgets.test.ts:196 | **REACHABLE** |
| `locked` | :225 (`false`) | `setWidgetsPropertiesInScene`; `editWidgetProperties` | checkbox :1904; Lock/Unlock :1797; context bar :2007; `widget.lock-toggle` :950 | Y | Y | no | no | Y | Y editor-widgets.test.ts:197 | **REACHABLE** |
| `geometry` | :226 | `setWidgetGeometriesInScene` :365; `setWidgetGeometries` :356; `editWidgetProperties` :375 | 4× `GeometryField` :1905; canvas drag :1309/:1395; resize :1336/:1352/:1402; nudge :1606-1613 | Y | Y | Y `validation.ts:155-162` | no | Y | Y canvas-interaction.test.ts:313-331 | **REACHABLE** |
| `zIndex` | :227 (`maxZ+1`) | `setWidgetZIndicesInScene` :451; `setWidgetsPropertiesInScene` | `DraftNumberField` :1905; z-order commands :931-942 / :949 | Y | Y | Y `validation.ts:164-166` | no | Y | Y canvas-interaction.test.ts:280-311 | **REACHABLE** |
| `bindings` | :228 (`[]`) | `replaceWidgetBindings` :332-337 | Binding Editor modal :2020 → `addBinding` :889-919 / `removeBinding` :921-929 | Y | Y | Y `validation.ts:215,106-127` | Y `runtime.ts:142` | Y `export.ts:41-43` | Y editor-widgets.test.ts:218-234 | **REACHABLE** (one condition per binding only → F5) |
| `assetIds` | :229 (`[]`) | **none at HEAD** | read-only count :1906; drives Asset Browser "Scene Content" :1838 | Y | — | Y `validation.ts:172` | no | **Y `export.ts:35`** | Y (fixture) editor-widgets.test.ts:25 | **ORPHAN** — consumed by **export.ts + validation.ts** |
| `mediaType` | never | **none at HEAD** | read-only :1906, :1909 | Y | — | Y `validation.ts:168-170,234` (VIDEO_SLOT_LIMIT_EXCEEDED) | no | no | Y domain-runtime.test.ts:266 | **ORPHAN** — consumed by **validation.ts** (incl. the profile decode-slot limit) |
| `audioAssetId` | never | **none at HEAD** | read-only :1909 | Y | — | Y `validation.ts:174-183` | no | **Y `export.ts:36`** | no | **ORPHAN** — consumed by **export.ts + validation.ts** |
| `mediaSlide` | never | **none at HEAD** | read-only "Configured/None" :1906 | Y | — | Y `validation.ts:185-213,234` | no | **Y `export.ts:37-40`** | Y (fixture) domain-runtime.test.ts:55-61 | **ORPHAN** — consumed by **export.ts + validation.ts** |
| `content` | never | `editWidgetProperties` :375 — **no UI caller** | read-only `content?.floorMappingId` :1907, `content?.variant` :1908 | Y | Y | no | no | **Y `export.ts:44`** (`collectNestedAssetIds`) | Y editor-pipeline.test.ts:23,173,203 | **ORPHAN** — consumed by **export.ts**; the only writer (`editWidgetProperties`) is TEST-ONLY. This is what makes text content, digit floor mapping and direction variant unreachable |
| `style` | never | `editWidgetProperties` :375 — **no UI caller** | read-only `style?.digitStyleId` :1907, `style?.directionStyleId` :1908 | Y | Y | no | no | **Y `export.ts:45`** | no | **ORPHAN** — consumed by **export.ts**; makes digit/direction style selection unreachable |

## 1.7 `Binding` (`models.ts:106-122`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `id` | App `addBinding` :908 | `replaceWidgetBindings` :332 | implicit | Y | Y | Y `validation.ts:335` (non-empty, in editor) | Y `runtime.ts:127` | no | Y editor-widgets.test.ts:222 | **REACHABLE** (auto) |
| `widgetId` | :909 | `replaceWidgetBindings` (enforces match :335) | implicit | Y | Y | Y `validation.ts:114-116` | Y `runtime.ts:128` | no | Y editor-widgets.test.ts:229 | **REACHABLE** (auto) |
| `conditions` | :910 — **exactly one, always** | `replaceWidgetBindings` | Binding Editor authoring block :2020 | Y | Y | Y `validation.ts:118-122` | Y `runtime.ts:129` | no | Y editor-widgets.test.ts:228 | **REACHABLE but capped at 1** — no "add condition" control exists → F5 |
| `conditionMode` | never | `replaceWidgetBindings` could carry it; nothing constructs it | none | Y | Y | no | **Y `runtime.ts:129`** | no | no | **ORPHAN** — consumed by **runtime.ts**; `BINDING_PARAMETRIC_SYSTEM_V1.md:58` requires AND/OR |
| `action` | :911 | `replaceWidgetBindings` | `<select>` with all 9 actions :2020 | Y | Y | no (no action/type compatibility rule) | Y `runtime.ts:130` | no | Y editor-widgets.test.ts:232 | **REACHABLE** — but `select-content`/`select-style` are selectable and can never do anything → F4 |
| `contentId` | never | `replaceWidgetBindings` could carry it; `addBinding` :907-912 never sets it | none (read-only in the binding card :2020) | Y | Y | Y `validation.ts:124-126` | **Y `runtime.ts:131`** | **Y `export.ts:42`** | Y (fixture) domain-runtime.test.ts:53 | **ORPHAN** — consumed by **runtime.ts + export.ts + validation.ts** |

## 1.8 `Condition` (`models.ts:98-104`)

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `source` | never | none | none | Y | — | **Y `validation.ts:51-52`** | **Y `runtime.ts:15-16`** | no | no | **ORPHAN + root cause of F3.** `addBinding` :910 omits `source`, yet the state `<select>` :2020 offers `[...profileStates, ...profileSettings]`. Selecting a *setting* yields `source === undefined` → defaults to `"state"` → `UNKNOWN_RUNTIME_REFERENCE` → export blocked |
| `stateId` | App :910 | `replaceWidgetBindings` | state `<select>` :2020 | Y | Y | Y `validation.ts:53-64` | Y `runtime.ts:17` | no | Y editor-widgets.test.ts:12 | **REACHABLE** |
| `operator` | App :910 | `replaceWidgetBindings` | operator `<select>`, 5 hardcoded values :2020 | Y | Y | Y `validation.ts:66-74` | Y `runtime.ts:61-77` | no | Y shortcut-registry.test.ts:47 | **REACHABLE** — not filtered by `definition.operators` → F14 |
| `value` | App :910 via `coerceBindingDraftValue` :269-272 | `replaceWidgetBindings` | value input, type-aware :2020 | Y | Y | Y `validation.ts:76-103` | Y `runtime.ts:58,63-76` | no | Y editor-widgets.test.ts:12 | **REACHABLE** |
| `negated` | App :910 | `replaceWidgetBindings` | "Negate" checkbox :2020 | Y | Y | no | Y `runtime.ts:57,79` | no | Y shortcut-registry.test.ts:56-57 | **REACHABLE** |

## 1.9 `Asset` (`models.ts:198-204`) — the whole interface is unreachable at HEAD

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `Asset.id` | **nothing** | **none at HEAD** | none | Y | — | Y `validation.ts:322-323` | no | Y `export.ts:80,84,162` | fixtures only | **ORPHAN** — consumed by **export.ts + validation.ts** |
| `Asset.name` | nothing | `renameNode` :257-259 (can rename an asset that can never exist) | Asset Browser row is select-only :1848 | Y | Y | Y `validation.ts:325` | no | Y `export.ts:85` | fixtures | **ORPHAN** |
| `Asset.sourcePath` | nothing | none | read-only :1914 | Y | — | Y `validation.ts:326,364-367` (ASSET_FORMAT_UNSUPPORTED) | no | Y `export.ts:87` | fixtures | **ORPHAN** |
| `Asset.mediaType` | nothing | none | read-only :1914 | Y | — | Y `validation.ts:180,203,209` | no | Y `export.ts:86` | fixtures | **ORPHAN** |
| `Asset.metadata` | nothing | none | none | Y | — | no | no | **Y `export.ts:88`** | no | **ORPHAN** — consumed by **export.ts only** |

> `DOMAIN_MODEL_V1.md:215` also specifies `Asset.variants?` for language variants. **`models.ts:198-204` has no `variants` field** — a doc-vs-implementation mismatch (F20).

## 1.10 `MediaSlideContent` (`models.ts:124-133`) — no constructor anywhere

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `mediaType` | nothing | none | none | Y | — | Y `validation.ts:189-191,234` | no | no | fixture domain-runtime.test.ts:56 | **ORPHAN** (validation) |
| `assetId` | nothing | none | none | Y | — | Y `validation.ts:201-205` | no | **Y `export.ts:38`** | fixture | **ORPHAN** (export + validation) |
| `duration` | nothing | none | none | Y | — | Y `validation.ts:192-197` | no | no | fixture | **ORPHAN** (validation) |
| `loop` | nothing | none | none | Y | — | no | no | transported only (whole rotation serialized `export.ts:110`) | no | **ORPHAN** — no logic consumes it; `MEDIA_LAYERING…:78` requires "video loop enable" |
| `repeatCount` | nothing | none | none | Y | — | Y `validation.ts:198-200` | no | transported | no | **ORPHAN** (validation) |
| `audioAssetId` | nothing | none | none | Y | — | Y `validation.ts:206-212` | no | **Y `export.ts:39`** | fixture | **ORPHAN** (export + validation) |
| `volume` | nothing | none | none | Y | — | no | no | transported | no | **ORPHAN** — no logic consumes it |
| `continuePlayback` | nothing | none | none | Y | — | no | no | transported | fixture domain-runtime.test.ts:60 | **ORPHAN** — `BINDING_PARAMETRIC_SYSTEM_V1.md:191` specifies Continue/Retain Playback; no runtime logic implements it |

## 1.11 `FloorMapping` / `FloorMappingEntry` (`models.ts:171-180`) — no constructor anywhere

| Field | created by | EditorApplication method | UI entry point | persists | undoable | validated | runtime | export | test | VERDICT |
|---|---|---|---|---|---|---|---|---|---|---|
| `FloorMapping.id` | nothing | none | none | Y | — | no (never checked for uniqueness) | no | **Y `export.ts:103`** | no | **ORPHAN** — export only |
| `FloorMapping.entries` | nothing | none | count only :1913 | Y | — | Y `validation.ts:255-267` | no | **Y `export.ts:103`** | no | **ORPHAN** (export + validation) |
| `entry.firmwareValue` | nothing | none | none | Y | — | Y `validation.ts:256-259` (DUPLICATE_FLOOR_MAPPING) | no | Y `export.ts:103` | no | **ORPHAN** (export + validation) |
| `entry.displayValue` | nothing | none | none | Y | — | no | no | Y `export.ts:103` | no | **ORPHAN** — export only. This is the *entire point* of floor mapping per `BINDING_PARAMETRIC_SYSTEM_V1.md:100-110`, and nothing validates it |
| `entry.digitStyleId` | nothing | none | none | Y | — | Y `validation.ts:261-266` | no | Y `export.ts:103` | no | **ORPHAN** (export + validation); the second rule at :264 is unreachable-in-isolation → F19 |

## 1.12 Supplementary — `DeviceProfile` sub-fields with no consumer

Not part of the editable project document, but they are the capability contract the spec leans on, and their deadness explains several ABSENT capabilities.

| Field | declared | populated | consumed by | VERDICT |
|---|---|---|---|---|
| `RuntimeStateDefinition.simulator` | models.ts:43 | factories.ts:18-21 (all `true`) | **nothing** — Simulator renders every state unfiltered (App.tsx:1946) | **DEAD** (spec-relevant: the flag exists precisely to gate Simulator exposure) |
| `RuntimeStateDefinition.category` | models.ts:39 | factories.ts:18-21 | **nothing** — no grouping in the Simulator | **DEAD** (`SCENE_DESIGNER_QUESTIONNAIRE_V1.md:94` wants profile-defined categories) |
| `RuntimeStateDefinition.description` | models.ts:40 | never | nothing | **DEAD** |
| `RuntimeSettingDefinition.options` | models.ts:52 | domain-runtime.test.ts:21 only | nothing (UI uses `enumValues` :282) | **DEAD** |
| `RuntimeSettingDefinition.persistence` | models.ts:54 | factories.ts:24 | nothing | **DEAD** |
| `RuntimeSettingDefinition.affectedCapabilities` | models.ts:55 | never | nothing | **DEAD** |
| `AudioCapabilities.*` (all 7 fields) | models.ts:58-66 | factories.ts:31-38 | **nothing** — validation reads only `videoCapabilities.maxConcurrentDecode` (:232) | **DEAD** — `MEDIA_LAYERING…:149-155` requires three modelled audio channels |
| `VideoCapabilities.maxWidth/maxHeight/supportedCodecs` | models.ts:70-72 | factories.ts:41-43 | nothing | **DEAD** |
| `DeviceProfile.languages` | models.ts:88 | factories.ts:26 | nothing | **DEAD** — `MULTILINGUAL_CONTENT_SYSTEM.md:30-43` requires a profile language registry |
| `DeviceProfile.fonts` | models.ts:89 | factories.ts:27 | nothing | **DEAD** — `PRODUCT_CONTRACT_V2:544` requires font selection from firmware fonts |
| `DeviceProfile.directionStyles` | models.ts:92 | factories.ts:30 | nothing (validation checks only `digitStyles` :261) | **DEAD** |
| `DeviceProfile.defaultDigitStyleId` | models.ts:91 | factories.ts:29 | only a test assertion (editor-widgets.test.ts:250) | **DEAD in product** |
| `DeviceProfile.defaultAssetIds` | models.ts:93 | never | validation.ts:372, export.ts:61 | **ORPHAN** (no profile populates it) |
| `DeviceProfile.supportedRotations` | models.ts:82 | factories.ts:13 | validation.ts:289 | USED |
| `DeviceProfile.supportedFormats` | models.ts:85 | factories.ts:16 | validation.ts:361-368 | USED |

---

# DELIVERABLE 2 — CAPABILITY REACHABILITY MATRIX

`reachable by a real user?` = there is a chain from a rendered control to this symbol.

## 2.1 `src/Core/editor-application.ts` (HEAD, 551 lines)

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `defaultWidgetName` | :26 | App.tsx:697, :1796 | yes | USED |
| `EditorApplication` (class) | :144 | `createEditorApplication` :549 | yes | USED |
| `executeCommand` | :147 | **nothing, not even tests** | no | **DEAD** |
| `execute` | :151 | every method in the class; App never calls it directly | yes (indirect) | USED |
| `addThemeProject` | :167 | App.tsx:632; editor-pipeline.test.ts:74,90,235,277-281,290-306; project-storage.test.ts:27,53 | yes (Theme menu :1786) | USED |
| `addRotation` | :182 | App.tsx:648 (inside App's `addRotation` :645, **which nothing references**); editor-pipeline.test.ts:104 | **no** | **UNREACHABLE** — and it is a code path that can violate the canonical four-rotation rule (F2) |
| `addScene` | :193 | App.tsx:666; editor-pipeline.test.ts:120,220; project-storage.test.ts:73 | yes | USED |
| `addWidget` | :208 | App.tsx:698; editor-widgets.test.ts:55-95; project-storage.test.ts:75 | yes | USED |
| `moveScene` | :236 | editor-pipeline.test.ts:153,221,222 **only** | **no** | **TEST-ONLY** — no reorder UI exists (F11) |
| `renameNode` | :252 | App.tsx:869; editor-widgets.test.ts:168-170 | yes | USED |
| `setSceneProperties` | :279 | App.tsx:1911 (priority, enabled); editor-widgets.test.ts:182-185 | yes, **partially** | USED — the `name` and `activationConditionMode` keys of its `Pick` have no UI caller |
| `setWidgetsVisibilityInScene` | :287 | App.tsx:862; editor-widgets.test.ts:196,201 | yes | USED |
| `duplicateWidgetsAt` | :295 | App.tsx:1495; editor-widgets.test.ts:209 | yes (Duplicate Mode) | USED |
| `replaceWidgetBindings` | :332 | App.tsx:913,926; editor-widgets.test.ts:227-229 | yes | USED |
| `setProjectDeviceProfile` | :339 | App.tsx:838; editor-widgets.test.ts:239 | yes, but inert with one profile registered | USED |
| `moveWidget` | :344 | editor-pipeline.test.ts:169,223 **only** | **no** | **TEST-ONLY** |
| `setWidgetGeometries` | :356 | canvas-interaction.test.ts:326,354; editor-pipeline.test.ts:335 **only** | **no** | **TEST-ONLY** — App always uses the scene-scoped variant |
| `setWidgetGeometriesInScene` | :365 | App.tsx:1272,1878; canvas-interaction.test.ts:327-355 | yes | USED |
| `editWidgetProperties` | :375 | editor-pipeline.test.ts:184,337 **only** | **no** | **TEST-ONLY — the highest-value one.** It is the *only* writer of `Widget.content` and `Widget.style`, so digit style, direction style/variant and text content are unreachable purely because this method has no UI caller |
| `setWidgetsPropertiesInScene` | :393 | App.tsx:851,1905; editor-widgets.test.ts:197,200 | yes | USED |
| `deleteSelection` | :409 | App.tsx:737; editor-pipeline.test.ts:210,224,347,354 | yes | USED — permits deleting a Rotation (F1) |
| `deleteSelectionInScene` | :444 | App.tsx:734 | yes | USED |
| `setWidgetZIndicesInScene` | :451 | App.tsx:939 | yes | USED |
| `duplicateSelectionInScene` | :464 | App.tsx:777; editor-widgets.test.ts:105,124 | yes | USED |
| `insertWidgetCopies` | :486 | App.tsx:825; editor-widgets.test.ts:139,156-158 | yes (Paste) | USED |
| `duplicateSelection` | :503 | App.tsx:779; editor-pipeline.test.ts:197,225 | yes | USED — permits duplicating a Rotation (F1) |
| `createEditorApplication` | :549 | App.tsx:469; 4 test files | yes | USED |

## 2.2 `src/Core/validation.ts`

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `validateProject` | :307 | App.tsx:488 (`useMemo`, every project change); export.ts:130; foundation.test.ts:54-55; domain-runtime.test.ts:144,163,214,236,251,266 | yes | USED |
| `ValidationSeverity`/`ValidationIssue`/`ValidationResult` (types) | :15-28 | App.tsx, export.ts | yes | USED |
| *(all other functions in this file are module-private)* | | | | — |

Validation rules that exist but can **never fire from user action** because their input field is unreachable (these are the validation half of the ORPHAN findings): `BROKEN_BINDING_CONTENT_REFERENCE` :125, `MISSING_REFERENCED_ASSET` :136, `AUDIO_BINDING_SCOPE_INVALID` :177, `AUDIO_ASSET_TYPE_INVALID` :181, `MEDIA_SLIDE_*` :187-210, `MEDIA_DURATION_*` :193-196, `MEDIA_REPEAT_COUNT_INVALID` :199, `UNSUPPORTED_MEDIA_TYPE` :169, `VIDEO_SLOT_LIMIT_EXCEEDED` :238, `DUPLICATE_FLOOR_MAPPING` :258, `UNKNOWN_DIGIT_STYLE` :262, `BROKEN_FLOOR_STYLE_REFERENCE` :265, `ASSET_NAME_REQUIRED` :325, `ASSET_SOURCE_REQUIRED` :326, `ASSET_FORMAT_UNSUPPORTED` :366, `DUPLICATE_STABLE_ID` (assets) :323.

## 2.3 `src/Core/runtime.ts`

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `coerceToDefinitionType` | :34 | runtime.ts:58 (internal); shortcut-registry.test.ts:36-41 | yes (indirect) | USED |
| `conditionMatches` | :44 | runtime.ts:90,91 (internal); shortcut-registry.test.ts:46-57 | yes (indirect) | USED |
| `conditionsMatch` | :82 | runtime.ts:105,129 (internal only) | yes (indirect) | USED — no external caller; exported unnecessarily |
| `selectActiveScene` | :94 | App.tsx:506; domain-runtime.test.ts:107,110,116 | yes | USED — but its `activationConditions` input is always `[]` (see 1.5), so it can only ever rank by priority |
| `evaluateBinding` | :121 | App.tsx:512,1132; runtime.ts:142 | yes | USED |
| `evaluateActiveSceneBindings` | :135 | App.tsx:507; domain-runtime.test.ts:117 | yes | USED |

## 2.4 `src/Core/export.ts`

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `ExportBlockedError` | :13 | thrown at :131; caught generically at App.tsx:985-988 (`error instanceof Error`) | yes | USED — but its `validation` payload (:14) is **never read**; App re-derives issues from its own `validation` memo |
| `buildDeploymentPackage` | :126 | App.tsx:980; application.ts:67; domain-runtime.test.ts:188,217 | yes (Project ▸ Build & Verify Package :1783) | USED |
| `verifyDeploymentPackage` | :184 | App.tsx:982; application.ts:68; domain-runtime.test.ts:197,201 | yes | USED |

## 2.5 `src/App/canvas-interaction.ts`

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `calculateZOrderUpdates` | :52 | App.tsx:937; canvas-interaction.test.ts:288-310 | yes | USED |
| `DEFAULT_GRID_SIZE` | :96 | App.tsx:12,1150,1968 | yes | USED |
| `DEFAULT_SNAP_THRESHOLD` | :97 | App.tsx:1392,1442 | yes | USED |
| `POINTER_DRAG_THRESHOLD` | :98 | internal :102 | yes | USED |
| `MIN_WIDGET_SIZE` | :99 | internal :267,:396,:400 | yes | USED |
| `exceedsPointerDragThreshold` | :101 | App.tsx:1369,1380,1386,1418,1441; tests | yes | USED |
| `detectKeyboardPlatform` | :107 | shortcut-registry.ts:50,65; tests | yes | USED |
| `isCanonicalModifier` | :114 | shortcut-registry.ts:51; App.tsx:1092,1306,1607,1749; tests | yes | USED |
| `isCanvasKeyboardExcludedTarget` | :118 | App.tsx:1578; tests | yes | USED |
| `calculateNudgeStep` | :132 | App.tsx:1608; tests | yes | USED |
| `getCanvasViewFrame` | :168 | App.tsx:1169; internal :187,196; tests | yes | USED |
| `screenToCanvas` | :186 | App.tsx:1192; tests | yes | USED |
| `canvasToScreen` | :195 | canvas-interaction.test.ts:49,58,73 **only** | **no** | **TEST-ONLY** |
| `canvasToScene` | :203 | **nothing** | no | **DEAD** |
| `sceneToCanvas` | :207 | **nothing** | no | **DEAD** |
| `clampCanvasPoint` | :211 | **nothing** | no | **DEAD** — App implements its own clamp inline (`clampGeometryToScene` App.tsx:1255) |
| `snapValue` | :218 | internal only (:229-232, :352) | yes (indirect) | USED (exported unnecessarily) |
| `snapGeometry` | :227 | ui-phase2.test.ts:26; canvas-interaction.test.ts:213 **only** | **no** | **TEST-ONLY** — App uses `snapGeometryWithTargets` |
| `normalizeRect` | :236 | App.tsx:1381,1420; tests | yes | USED |
| `intersects` | :246 | internal :319; tests | yes | USED |
| `containsPoint` | :250 | internal :327; tests | yes | USED |
| `getBounds` | :254 | App.tsx:1333,1349,1359,1390,1440,1735; tests | yes | USED |
| `moveGeometry` | :263 | App.tsx:1396,1399,1444,1449,1612 | yes | USED |
| `resizeGeometry` | :267 | App.tsx:1402,1444; tests | yes | USED |
| `transformGeometryWithinBounds` | :283 | App.tsx:1405,1451; tests | yes | USED |
| `selectIds` | :294 | App.tsx:1048 | yes | USED |
| `orderSelectionIds` | :299 | App.tsx:1048,1546; internal :320; tests | yes | USED |
| `marqueeSelection` | :314 | App.tsx:1420; tests | yes | USED |
| `hitTest` | :324 | App.tsx:1996 (context menu only) | yes | USED |
| `snapGeometryWithTargets` | :390 | App.tsx:1397,1403,1446,1447; internal :410; tests | yes | USED |
| `calculateSnapGuides` | :409 | **nothing** | no | **DEAD** — App reads `.guides` off `snapGeometryWithTargets` directly (:1400,:1408) |
| `MarqueeSelectionMode = "contains"` | :306,:315-318 | App always passes `"intersect"` (:1420) | no | **UNREACHABLE branch** — throws `RangeError` by design; only tests exercise it (canvas-interaction.test.ts:124-125) |

## 2.6 `src/Infrastructure/*`

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `ProjectStorage` (interface) | project-storage.ts:8 | document-store.ts:2,40 | yes | USED |
| `PROJECT_STORAGE_KEY` | project-storage.ts:14 | internal; project-storage.test.ts:32,60,62,91,95 | yes | USED |
| `LocalStorageProjectStorage` | project-storage.ts:69 | App.tsx:423; project-storage.test.ts:16,50,61,63,68 | yes | USED |
| `LocalStorageProjectStorage.save` | :72 | document-store.ts:81 ← App.tsx:592 | yes | USED |
| `LocalStorageProjectStorage.load` | :76 | App.tsx:426, :608; tests | yes | USED |
| `LocalStorageProjectStorage.clear` | :88 | project-storage.test.ts:105 **only** | **no** | **TEST-ONLY** — no "forget saved project" command exists |
| `ProgramSettings` (type) | program-settings-storage.ts:1 | App.tsx:10,450,451 | yes | USED |
| `PROGRAM_SETTINGS_STORAGE_KEY` | :8 | internal; program-settings.test.ts:18,25,27 | yes | USED |
| `defaultProgramSettings` | :10 | App.tsx:450,451,452; tests | yes | USED |
| `LocalStorageProgramSettings` | :36 | App.tsx:449; tests | yes | USED |
| `…ProgramSettings.load` | :39 | App.tsx:450,451,452 | yes | USED |
| `…ProgramSettings.save` | :50 | App.tsx:1516 | yes | USED |
| `…ProgramSettings.clear` | :54 | program-settings.test.ts:36 **only** | **no** | **TEST-ONLY** |
| `SDCardTarget` | sd-card-target.ts:4 | **nothing — not imported by any file, including tests** | no | **DEAD** |

## 2.7 Adjacent files needed to complete the picture

| symbol | file:line | called from | user-reachable | VERDICT |
|---|---|---|---|---|
| `Logger` (interface) | Core/application.ts:4 | only `ConsoleLogger` | no | **DEAD** |
| `ConsoleLogger` | Core/application.ts:30 | **nothing** | no | **DEAD** |
| `DeploymentTargetAdapter` | Core/application.ts:10 | sd-card-target.ts:2 (itself dead); domain-runtime.test.ts:173 shape | no | **DEAD/TEST-ONLY** |
| `DeploymentManager` (interface) | Core/application.ts:15 | two impls below | no | **DEAD** |
| `ApplicationError` | Core/application.ts:19 | application.ts:46,61,70; sd-card-target.ts:12 — all unreached from UI | no | **UNREACHABLE** |
| `UnsupportedDeploymentManager` | Core/application.ts:44 | **nothing** | no | **DEAD** |
| `PackageDeploymentManager` | Core/application.ts:53 | domain-runtime.test.ts:2,179 **only** | **no** | **TEST-ONLY** |
| `InMemoryDocumentStore.close` | document-store.ts:70 | **nothing** | no | **DEAD** |
| `InMemoryDocumentStore.create` | :68 | App.tsx:563; editor-pipeline.test.ts:239 | yes | USED |
| `InMemoryDocumentStore.replaceCurrent` | :86 | editor-application.ts:161,162; core-integrity.test.ts:52 | yes (indirect) | USED |
| `CommandHistory.clear` | commands.ts:69 | document-store.ts:64,73; editor-pipeline.test.ts:262 | yes | USED |
| `createThemeProject` | factories.ts:63 | factories.ts:85 only | yes (indirect) | USED (no external caller) |
| `createEmptyThemeProjectGroup` | factories.ts:81 | factories.ts:100 only | yes (indirect) | USED (no external caller) |
| `setPanelLayoutMode` | panel-manager.ts:11 | App.tsx:992 | yes | USED |
| `activateDockedPanel` | panel-manager.ts:20 | App.tsx:997; ui-phase2.test.ts:16 | yes | USED |
| `floatingPanels` | panel-manager.ts:24 | App.tsx:524; ui-phase2.test.ts:19 | yes | USED |
| `buildShortcutRegistry` | shortcut-registry.ts:34 | :86; shortcut-registry.test.ts:25 | yes | USED |
| `matchShortcut` | :49 | App.tsx:1558; tests | yes | USED |
| `shortcutDisplay` | :62 | App.tsx:1754,1973; tests | yes | USED |
| `commandsForSelection` | editor-commands.ts:57 | App.tsx:2016 (twice) | yes | USED |
| `editorCommandDescriptors` | editor-commands.ts:40 | internal :62-63 | yes (indirect) | USED |
| `App.addRotation` (local fn) | App.tsx:645-659 | **nothing** | no | **DEAD** (removed in the working tree; `tsconfig.json` sets no `noUnusedLocals`, so it compiled silently) |

**Summary — code the product cannot use:** `executeCommand`, `moveScene`, `moveWidget`, `setWidgetGeometries`, `editWidgetProperties`, `EditorApplication.addRotation`, `canvasToScreen`, `canvasToScene`, `sceneToCanvas`, `clampCanvasPoint`, `snapGeometry`, `calculateSnapGuides`, `marqueeSelection("contains")`, `LocalStorageProjectStorage.clear`, `LocalStorageProgramSettings.clear`, `SDCardTarget`, `ConsoleLogger`, `Logger`, `UnsupportedDeploymentManager`, `PackageDeploymentManager`, `ApplicationError`, `DeploymentManager`, `DeploymentTargetAdapter`, `InMemoryDocumentStore.close`, `App.addRotation`.

---

# DELIVERABLE 3 — SPEC-vs-IMPLEMENTATION GAP LIST

Legend: `domain?` = a type exists in `models.ts` · `core?` = a Core function can produce/consume it · `UI?` = a user can reach it.

| Spec capability | doc:line (cited) | domain? | core? | UI? | VERDICT | V1 scope per spec? |
|---|---|---|---|---|---|---|
| Asset/media **import** into the project | `PRODUCT_CONTRACT_V2:1310` "4. Media/asset system" in the V1 priority list; `PRODUCT_CONTRACT_V2:99` "…**import seçenekleri**… profile göre belirlenmelidir". The only *concrete* V1 entry point named anywhere is drag-and-drop: `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:36` "Windows Explorer'dan dosya sürükleme yalnızca Project Explorer/resource hedeflerine yapılır" | Y `Asset` models.ts:198 | **N at HEAD** | **N** — and **no drag-and-drop exists at all**: `onDrop`/`onDragOver`/`onDragEnter`/`dataTransfer`/`draggable` return **zero matches** across `src/**/*.tsx` | **DOMAIN-ONLY** | **Yes, V1** |
| Asset Depot vs Project Resources vs Scene Content vs Unsupported Files as separate surfaces | `WIDGETS_AND_MEDIA:237` "Media Library'de kaynak/preview/conversion durumu"; App implements the four tabs | Y | N | **partial** — four tabs render (App.tsx:88-93,1846) but Depot and Unsupported are hardcoded `0` (:1846) and every list is empty because `assets` is always `[]` | **PARTIAL (shell only)** | Yes, V1 |
| Per-type widget config: **digit style** selection | `PRODUCT_CONTRACT_V2:493-513` "Digit style… Default digit styles programla gelir. Kullanıcı custom digit style ekleyebilir" | Y (`Widget.style`) | Y `editWidgetProperties` :375 (TEST-ONLY) | **N** — read-only "Profile default / unresolved" App.tsx:1907 | **DOMAIN-ONLY** | **Yes, V1** |
| Per-type widget config: **direction style + independent Up/Down variants** | `PRODUCT_CONTRACT_V2:460` "Up ve Down seçimleri… **bağımsızdır**"; :485 "Custom Up seçildiğinde Down otomatik doldurulmaz" | partial (`Widget.style`/`content` are untyped records; no Up/Down variant type) | Y (TEST-ONLY writer) | **N** — read-only App.tsx:1908 | **DOMAIN-ONLY** (variant pair not modelled at all) | **Yes, V1** |
| **Text widget** content + Font/Size/Bold/Italic/Alignment | `PRODUCT_CONTRACT_V2:546-556` "Designer şu özellikleri taşıyabilir: Text Font Size Bold Italic Alignment" | N (no typed text model; only untyped `Widget.content`) | Y (TEST-ONLY writer) | **N** — no `widgetType === "text"` Properties section exists at all (App.tsx:1907-1909 covers only digit/direction/media) | **ABSENT** | **Yes, V1** |
| **Event-driven text** (per-condition text) | `PRODUCT_CONTRACT_V2:600` "Properties panelinde kullanıcı condition ekleyip her condition için text tanımlayabilmelidir" | N | N | **N** | **ABSENT** | **Yes, V1** |
| **Warning** widget content binding per alarm source | `PRODUCT_CONTRACT_V2:654` "Kullanıcı ayrı widgetlar ekleyebilir ve her birini farklı event condition'a bağlayabilir" | Y (`warning` is a profile widget type, factories.ts:14) | Y (bindings) | **partial** — a `warning` widget can be added and bound, but has **no** Properties section and no content/asset assignment | **PARTIAL** | Yes, V1 |
| Media widget: **mediaType selection + asset assignment** | `PRODUCT_CONTRACT_V2:341-359` "Widget Type ≠ Media Type… Bir widgetın içeriği profile izin verdiği ölçüde image/video/media sequence olabilir" | Y `Widget.mediaType`, `assetIds` | **N at HEAD** | **N** — read-only App.tsx:1906,1909 | **DOMAIN-ONLY** | **Yes, V1** |
| **Media Slide** authoring (duration, loop, loop count, audio, audio repeat, layer) | `MEDIA_LAYERING…:73-83`; `SCENE_DESIGNER_QUESTIONNAIRE_V1:223` "Media Slide seçildiğinde süre, video loop, loop count ve audio repeat gibi değerler Properties üzerinden düzenlenir" | Y `MediaSlideContent` models.ts:124 | **N** | **N** — read-only "Configured/None" App.tsx:1906 | **DOMAIN-ONLY** | **Yes, V1** |
| Media Slide: **video loop count independent of audio repeat count** | `MEDIA_LAYERING…:87` "Video loop count ile audio repeat count birbirinden bağımsızdır" | **N** — one `repeatCount` field only (models.ts:129) | N | N | **ABSENT (domain defect)** | Yes, V1 |
| **Media Sequence** / sequential media inside a slide | `PRODUCT_CONTRACT_V2:658-682` "Media Sequence, birden fazla media içeriğini zaman sırasına göre çalıştıran gerçek bir widgettır"; `WIDGETS_AND_MEDIA:125` per-item `media_id/duration_ms/repeat_mode/repeat_count/audio_binding/audio_policy/fit`; `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:247,270` "Aynı Media Slide içindeki **ardışık medya** yapısı… kendi timeline/order kuralları geçerlidir" | **N** — one `mediaSlide` with one `assetId` (models.ts:124-133); no sequence array anywhere | N | N | **ABSENT** — three independent docs require sequential media (as a widget and/or inside a slide); the domain can express only a single asset. See **C10** | **Yes, V1** |
| **Floor Mapping Editor** (firmware value → display value, per-entry digit style) | `BINDING_PARAMETRIC_SYSTEM_V1:95` "The Designer therefore needs a dedicated **Floor Mapping Editor**"; :100-110 the exact table | Y `FloorMapping` models.ts:171-180 | **N** (no method constructs one) | **N** — read-only count App.tsx:1913 | **DOMAIN-ONLY** | **Yes, V1** |
| Widget→floor-mapping reference is validated | `BINDING_PARAMETRIC_SYSTEM_V1:220` "invalid floor mapping reference" must be detected | N | N | N | **ABSENT** — App.tsx:1907 reads `widget.content?.floorMappingId` but `validation.ts` never resolves it against `theme.floorMappings` | Yes, V1 |
| **Multilingual content** (per-language text/audio/media/digit variants) | `MULTILINGUAL_CONTENT_SYSTEM:7-12` "Dil desteği en az şu içerik türlerinde bulunmalıdır: metin, ses, kat numarası/digit içerikleri, medya varyantları" | **N** — no localized-content type; `Asset.variants` promised by `DOMAIN_MODEL_V1:215` is absent from models.ts:198-204 | N | N | **ABSENT** | Yes, V1 |
| Theme language selection (which languages a theme ships) | `MULTILINGUAL_CONTENT_SYSTEM:252-262` "Kullanıcı tema oluştururken kullanılacak dilleri seçebilir" + checkbox mock | N | N | N | **ABSENT** | Yes, V1 |
| Simulator can change **runtime language** | `MULTILINGUAL_CONTENT_SYSTEM:268` "Simulator runtime language'ı değiştirebilmelidir" | Y (`language` runtime **setting**, factories.ts:24) | Y | **Y** — Simulator settings block App.tsx:1947 | **IMPLEMENTED** (the switch exists; nothing localizes in response) | Yes, V1 |
| Localization **fallback** + validation of missing language content | `MULTILINGUAL_CONTENT_SYSTEM:222,240,330-331` | N | N | N | **ABSENT** | Yes, V1 |
| **Audio channels** modelled separately (announcement / background music / video audio) | `MEDIA_LAYERING…:149-155` "En az üç ses kanalı ayrı modellenmelidir" | partial — `AudioCapabilities.channels?` models.ts:59 exists but **no profile populates it and nothing reads it** | N | N | **ABSENT** | Yes, V1 |
| Template **default volumes** per channel | `MEDIA_LAYERING…:157-165` "Designer bunların template defaultlarını ayarlayabilir. Announcement Default: 80%…" | N (only `MediaSlideContent.volume`, unreachable) | N | N | **ABSENT** | Yes, V1 |
| **Background music** asset on the template | `MEDIA_LAYERING…:171` "Template bir background music asset tanımlayabilir" | N | N | N | **ABSENT** | Yes, V1 |
| Per-floor **announcement** (language-aware) | `MEDIA_LAYERING…:103-121` | N | N | N | **ABSENT** | Yes, V1 |
| Video + **external audio** binding | `PRODUCT_CONTRACT_V2:781` "Video widget/content seçildiğinde harici audio binding desteklenmelidir" | Y `Widget.audioAssetId`, `mediaSlide.audioAssetId` | N | **N** — read-only App.tsx:1909 | **DOMAIN-ONLY** | Yes, V1 |
| **Test sequences / test blocks** (floor/scene/wait program) | `WIDGETS_AND_MEDIA:187-193` "Test blokları `floor`, `scene`, `wait` türlerindedir" + the `-1 → 16 → yangin → …` flow; `AGENTS.md` UI rules "test sequence/block workflow" | **N** | N | N | **ABSENT** — Simulator has Run/Pause/Step/Reset (App.tsx:1944) but no sequence/timeline; "Run" only calls `traceRuntime()` once (:1944) and `simulationStatus` is cosmetic | Yes, V1 |
| Simulator Play / Pause / **Step** / Reset with real temporal stepping | `PRODUCT_CONTRACT_V2:850-858`; `CONTRACT_V2:249` "Play/Pause/Step/Reset desteklenmelidir" | N (no clock/timeline state) | N | **partial** — four buttons exist; Step is identical to Run (both call `traceRuntime` :1944) and nothing advances time | **PARTIAL** | Yes, V1 |
| Simulator uses the **real renderer/binding engine** | `PRODUCT_CONTRACT_V2:862-878`; `CONTRACT_V2:249` | Y | Y | **Y** — `selectActiveScene`/`evaluateBinding` drive Preview Mode (App.tsx:506-507,1125-1144) | **IMPLEMENTED** | Yes, V1 |
| **Scene activation Condition Editor** (`...` advanced editor) | `SCENE_DESIGNER_QUESTIONNAIRE_V1:44-52` "Scene Properties Name Priority Activation Rotation Enabled" + ":52 Activation için gelişmiş Condition Editor `...` ile açılabilir" | Y `Scene.activationConditions` | **N at HEAD** | **N** | **DOMAIN-ONLY** | **Yes, V1** |
| Scene conditions with **multiple conditions AND/OR** | `SCENE_DESIGNER_QUESTIONNAIRE_V1:107` "Bir Scene birden fazla state ile koşullandırılabilir. AND/OR/advanced expression" | Y (`activationConditionMode`) | N | N | **DOMAIN-ONLY** | Yes, V1 |
| **Binding** with multiple conditions AND/OR | `BINDING_PARAMETRIC_SYSTEM_V1:58` "Multiple conditions can be combined with AND/OR"; :63-66 examples | Y (`Binding.conditionMode`) | Y `replaceWidgetBindings` accepts any list | **N** — `addBinding` App.tsx:910 always builds exactly one condition; no add-condition control | **DOMAIN-ONLY** | **Yes, V1** |
| Binding **condition source = state OR setting** | `SCENE_DESIGNER_QUESTIONNAIRE_V1:92` registry source; `validation.ts:52` distinguishes them | Y `Condition.source` models.ts:99 | Y | **N, and actively broken** — the picker mixes settings into a state-only condition (App.tsx:910 vs :2020) | **BUG, see F3** | Yes, V1 |
| Binding **type-aware operators** filtered by profile | `SCENE_DESIGNER_QUESTIONNAIRE_V1:96-104` "State veri tipine göre condition editor uygun operator/editor üretir" | Y `…Definition.operators` models.ts:42,51 | Y `validation.ts:66` | **N** — operator `<select>` hardcodes all 5 (App.tsx:2020) | **PARTIAL (validation-only)** | Yes, V1 |
| Binding actions incl. **select-content / select-style** | `BINDING_PARAMETRIC_SYSTEM_V1:156-168`; `:168` "Digit/Direction actions are semantic… style/variant/content selection" | Y `Binding.action`, `contentId` | Y | **partial/broken** — both actions selectable (App.tsx:2020) but `contentId` has no input and `bindingEffects` ignores them (App.tsx:1135-1140) | **PARTIAL** → F4 | Yes, V1 |
| **Parametric text** `{FloorNumber}` | `BINDING_PARAMETRIC_SYSTEM_V1:135-146` | N | N | N | **ABSENT** | "not required in the first binding iteration" is said only of CSV (:152); parametric text itself reads as V1 |
| Per-condition/binding **priority 0–10** | `PRODUCT_CONTRACT_V2:221` "Her event/condition için **0–10 arasında ayarlanabilir priority** bulunmalıdır"; :828 "Binding seviyesinde uygulanabilmelidir"; `CONTRACT_V2:64` `Condition … priority 0..10` | **N** — priority exists only on `Scene` (models.ts:157) | N | N | **ABSENT** | Yes, V1 — **but see contradiction C6** |
| Deterministic tie-break at equal priority | `PRODUCT_CONTRACT_V2:240`; `CONTRACT_V2:80`; `SCENE_DESIGNER_QUESTIONNAIRE_V1:117-119` | Y `RuntimeContext.sceneActivationOrder` models.ts:222 | Y `runtime.ts:110-112` | Y (document order supplied App.tsx:500-504) | **IMPLEMENTED** | Yes, V1 |
| Scene **order drag/drop** in Project Explorer (the user-visible tie-break) | `SCENE_DESIGNER_QUESTIONNAIRE_V1:125` "Project Explorer'daki Scene sırası kullanıcı tarafından drag/drop ile değiştirilebilir" | Y | Y `moveScene` :236 | **N** — TEST-ONLY | **DOMAIN-ONLY / MISSING ENTRY POINT** | Yes, V1 |
| Per-Scene validation status incl. "No activation condition" and "Priority conflict" | `SCENE_DESIGNER_QUESTIONNAIRE_V1:277-283` | N | N | N | **ABSENT** — neither rule exists in `validation.ts` | Yes, V1 |
| `Test Scene` command that builds the runtime context | `SCENE_DESIGNER_QUESTIONNAIRE_V1:233-242` "Scene'in activation conditions'ları incelenir… Gerekli runtime state context otomatik oluşturulabilir" | Y | N | **partial** — Scene menu "Test Scene" (App.tsx:1793) only calls `activatePanel("simulator")`; no context is built, and it is absent from the Scene context menu (`editor-commands.ts:40-55`) | **PARTIAL (label only)** | Yes, V1 |
| `Explain Scene` / Scene thumbnails / `Apply to Other Scenes` | `SCENE_DESIGNER_QUESTIONNAIRE_V1:246`, `:229`, `:165` | N | N | N | **ABSENT** | "bulunabilir" → optional/ambiguous |
| **Bounding Group / Alignment Group** layout | `DOMAIN_MODEL_V1:168-183` full `BoundingGroup` shape + the 1/2/3/4/5-child centring rules; `PRODUCT_CONTRACT_V2:618-624` "Dynamic Runtime Layout / Alignment Group mekanizması tasarlanacaktır" | **N** — no `BoundingGroup` type in models.ts | N | N | **ABSENT** | **Explicitly DEFERRED** by `PRODUCT_CONTRACT_V2:618-626` ("daha sonra… tasarlanacaktır", "Şimdilik klasik anchor… yapılmayacaktır") and `CONTRACT_V2:200-202`. `DOMAIN_MODEL_V1:183` calls it "V1 geometry/layout davranışı" → **contradiction C5** |
| **Firmware presentation settings** authored in the template | `DOMAIN_MODEL_V1:103` example runtime settings (`arrow_style`, `digit_style`, `voice_pack`, `announcement_volume`, `background_music_volume`, `video_audio_volume`); `MEDIA_LAYERING…:167` "Firmware bunları sahada runtime setting olarak değiştirebilir" | partial — `RuntimeSettingDefinition` exists; the shipped profile declares only `language` (factories.ts:23-25) | Y (evaluator reads settings `runtime.ts:16`) | **partial** — the Simulator can set declared settings (App.tsx:1947); no template-side defaults | **PARTIAL** | Yes, V1 |
| Theme catalog / **Theme Library with four orientation variants** | `AGENTS.md` UI rules "theme library with physical orientation variants"; `PRODUCT_CONTRACT_V2:1229` "Theme Library"; `WIDGETS_AND_MEDIA:237` "Theme Library içinde tema kartları ve dört orientation" | Y (`ThemeProject.rotations[4]`) | Y | **partial** — the Explorer tree exposes theme → R0/R90/R180/R270 (App.tsx:100-104); there is **no** Theme Library surface, no theme cards, no orientation thumbnails, and no rotation switcher outside tree selection | **PARTIAL** | Yes, V1 |
| Four-form completeness enforced for publish | `CONTRACT_V2:46` "Publish için dört formun tamamı geçerli olmalıdır"; `WIDGETS_AND_MEDIA:35` "Publish için dört formun tamamında çözülmüş widget geometrisi bulunmalıdır" | Y | Y `validation.ts:277-281` checks *existence* of 4 angles | **partial** — existence is validated; **non-emptiness/resolved geometry per form is not**, and no copy-to-other-forms mechanism exists (`CONTRACT_V2:46` "başlangıç geometri değerleri diğer formlara kopyalanabilir") | **PARTIAL** | Yes, V1 |
| **Publish readiness** surface | `AGENTS.md` UI rules "publish readiness feedback"; `PRODUCT_CONTRACT_V2:1234` "Publish"; `:1200-1220` Prepare→Validate→Build→Write→Verify→Safe eject | Y (`DeploymentPackage`, `verified`) | Y `buildDeploymentPackage`/`verifyDeploymentPackage` | **partial** — one menu item (App.tsx:1783) + a status string (`deploymentStatus` :474) + Validation console tab (:1958). No Publish screen, no readiness checklist, no Prepare/Writing/Verifying/Completed state machine | **PARTIAL** | Yes, V1 |
| Deployment package: manifest + theme/layout + assets + checksum + verification | `DEPLOYMENT_FORMAT:44-55`, `:57-69`; `PRODUCT_CONTRACT_V2:1220` | Y `PackageManifest` models.ts:244 | Y `export.ts:126-192` | Y (Build & Verify) | **IMPLEMENTED** | Yes, V1 |
| Package carries **required asset bytes** | `DEPLOYMENT_FORMAT:51` "required assets"; `PRODUCT_CONTRACT_V2:753-757` Image→ARGB8888 / Video→MJPEG AVI / Audio→WAV | Y | Y but deliberately logical-only: `export.ts:80-90` writes `assets/<id>.asset.json` with `binary: false` | Y | **PARTIAL by design** (documented at export.ts:75-79) — and moot while `assets` is always `[]` | Yes, V1 |
| Media resize/fit/crop/target-format preparation | `PRODUCT_CONTRACT_V2:765-771`; `CONTRACT_V2:206` | N | N | N | **ABSENT** | Yes, V1 (`CONTRACT_V2:216` "Dönüşüm tamamlanmadan publish yapılmamalıdır") — but contradicted, see C1 |
| Designer **Console** showing command/validation/runtime traces | `PRODUCT_CONTRACT_V2:1016-1042`; `CONTRACT_V2:283-294` | n/a | n/a | **Y** — `logAction` :528, console panel :1955-1960, runtime trace :1922-1931 | **IMPLEMENTED** | Yes, V1 |
| Designer **API/CLI** surface for external AI | `PRODUCT_CONTRACT_V2:985-1010` `create_project() … export_package()`; `CONTRACT_V2:259-279` | N | N (no command bus; `EditorApplication` is only reachable from React state) | N | **ABSENT** | Yes, V1 — `PRODUCT_CONTRACT_V2:1321` "AI API yüzeyi… sonradan eklenen bir eklenti gibi tasarlanmamalıdır"; ranked 13th at :1319 |
| Render/screenshot per rotation + per simulated state | `PRODUCT_CONTRACT_V2:1093,1144-1164` | N | N | N | **ABSENT** | Yes, V1 (AI verification) |
| Overlay widget with explicit publish rejection when unsupported | `PRODUCT_CONTRACT_V2:712-725`; `WIDGETS_AND_MEDIA:137` "sessizce yok sayılamaz" | N (`overlay` is not in the shipped profile, factories.ts:14) | N | N | **ABSENT** | `PRODUCT_CONTRACT_V2:725` "Overlay V1'in ana widgetlarından biri olmak zorunda değildir" → **DEFERRED/optional** |
| Palette concepts Background / Clock / Floor List / Logo / Door Animation | `PRODUCT_CONTRACT_V2:287-300`; `WIDGETS_AND_MEDIA:55-68` table | N — the shipped profile offers only `media/digit/direction/warning/text` (factories.ts:14) | N | N | **ABSENT** | Yes, V1 (widget palette) |
| Widget palette filtered by profile capability | `PRODUCT_CONTRACT_V2:99-103` "Kullanıcı desteklenmeyen bir widgetı normal şekilde eklemeye çalışmamalıdır" | Y `supportedWidgetTypes` | Y | **Y** — menu built from the profile (App.tsx:1796); `addWidget` refuses unsupported types (:685-688); context menu likewise (`editor-commands.ts:64-70`) | **IMPLEMENTED** | Yes, V1 |
| **Change a widget's semantic type** after creation, gated by profile compatibility | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:30` "Widget Type değişimi yalnız DeviceProfile tarafından uyumlu görülen semantic type'lar arasında yapılabilir" | Y `Widget.widgetType` | **N at HEAD** (no method patches it; `addWidget` sets it once at `:222`) | **N** — read-only rows App.tsx:1901,1904 | **DOMAIN-ONLY** — the in-flight `setWidgetConfiguration` (WT:409-445) implements exactly this, including clearing `content`/`style` on type change; still no UI ⟳ | Yes, V1 |
| **Unassigned-type resource state** — a dropped file arrives as a Resource with `Type: None`, the user then assigns a semantic type if the profile supports the format, otherwise it stays `Unsupported` | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:225` "Dışarıdan sürüklenen dosya önce Resource olarak gelir", `:228` "Type: None", `:231`, `:233`; routing `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:40-43` | **N — not representable.** `Asset.mediaType` is **required** (models.ts:202) and `MediaType` has no unassigned member (models.ts:17) | N | N | **ABSENT (domain defect)** — see F7c | Yes, V1 |
| Duration edited at 0.1-second resolution | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:211` "Duration her yerde **0.1 saniye çözünürlükte** düzenlenir" | Y `mediaSlide.duration` | Y | N (no editor) | **PARTIAL — the rule itself is correctly implemented** in `validation.ts:195-196` (`MEDIA_DURATION_PRECISION_INVALID`); only the editor is missing | Yes, V1 |
| Loop (infinite) and Repeat (counted) as **separate** options | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:225-237` "Loop = sonsuz tekrar. Repeat = sayılı tekrar … ayrı seçeneklerdir" | **Y — correctly modelled** as distinct `loop?: boolean` + `repeatCount?: number` (models.ts:128-129) | Y (`repeatCount` validated `:198-200`) | N | **DOMAIN-ONLY** (the shape is right; no editor) | Yes, V1 |
| Undo/redo across every mutation | `AGENTS.md` completion rule; `PRODUCT_CONTRACT_V2:1314` | Y | Y `commands.ts:16-81`, bounded at 100 (:14) | Y (:1764-1765, Ctrl+Z/Y :1592-1593) | **IMPLEMENTED** | Yes, V1 |
| Offline-first, no cloud/account | `Ana Proje…Promptu:283-294` | n/a | n/a | Y (localStorage only) | **IMPLEMENTED** | Yes, V1 |
| Platform isolation: UI → Service → Adapter | `AGENTS.md` platform isolation; `Ana Proje…Promptu:633-657` | Y | Y (`ProjectStorage` boundary) | **partial** — persistence is behind an adapter, but the **DeploymentManager plane has no caller**: App.tsx calls `buildDeploymentPackage` directly (:980) and never constructs `PackageDeploymentManager`/`SDCardTarget` | **PARTIAL** | Yes, V1 |

## 3.1 Documented contradictions between specs

| # | Contradiction | Citations |
|---|---|---|
| C1 | **Who converts media.** Designer must produce MJPEG AVI/WAV targets and block publish until conversion completes — vs — V1 Designer does no full conversion; it belongs to a separate Format Tool. | `WIDGETS_AND_MEDIA:174,179` and `CONTRACT_V2:216` **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:162` "V1 Designer tam media format conversion yapmaz", `:494-496` "V1'de tam format conversion yapılmaz… MP4→AVI vb. dönüşümler ayrı **Format Tool** kapsamındadır", and `PRODUCT_CONTRACT_V2:773-775` |
| C2 | **Anchor system.** A full anchor model (target type/point/offset/fallback) is specified — vs — the classic anchor graph is explicitly removed. | `WIDGETS_AND_MEDIA:143-157` **vs** `PRODUCT_CONTRACT_V2:606` "Klasik anchor sistemi **kullanılmayacaktır**" and `:1277-1279`; `CONTRACT_V2:190,202` |
| C3 | **Glyph atlas for text.** Glyph sets/atlases are required for text and digits — vs — normal Text must not use a glyph atlas. | `WIDGETS_AND_MEDIA:133,177` **vs** `PRODUCT_CONTRACT_V2:542` "Normal Text widgetı glyph atlası kullanmaz" and `:1281-1283`; `CONTRACT_V2:163` |
| C4 | **`firmware_selectable` style flag.** Required, with export semantics — vs — not needed. | `WIDGETS_AND_MEDIA:161-163` **vs** `PRODUCT_CONTRACT_V2:536` "Şimdilik `firmware_selectable` gibi bir style alanı gerekmemektedir" and `:1289-1291`; `CONTRACT_V2:186` |
| C5 | **Bounding Group scope — three-way.** Called V1 geometry/layout behaviour with concrete child-centring maths — vs — explicitly deferred and "will not be implemented now" — vs — self-labelled **optional**. | `DOMAIN_MODEL_V1:183` "Bu **V1** geometry/layout davranışıdır" **vs** `PRODUCT_CONTRACT_V2:618-626` "daha sonra… tasarlanacaktır. Şimdilik… yapılmayacaktır" **vs** `BOUNDING_GROUP_LAYOUT:5` "Bu sistem… **opsiyonel** bir layout özelliğidir" |
| C6 | **Where priority lives — now 3 docs vs 1.** Priority 0–10 must be settable per event/condition and applied at binding level — vs — widgets get no Scene priority; priority selects the Scene and Z-order orders widgets. The weight of evidence favours binding-level priority, which the domain lacks entirely. | `PRODUCT_CONTRACT_V2:221,828`; `CONTRACT_V2:64`; **`MEDIA_LAYERING…:30-32`** "### Event / Binding Priority … Template'te **0–10** aralığındadır" **vs** `SCENE_DESIGNER_QUESTIONNAIRE_V1:185-191` "Widget'lara Scene priority verilmez… Bu iki kavram kesinlikle ayrıdır" |
| C7 | **Fixed canonical scene list.** Nine fixed canonical scenes with fixed default widget matrices — vs — Scene is a freely authored presentation selected by conditions+priority, and alarm names are runtime states not scene classes. | `WIDGETS_AND_MEDIA:37-51` **vs** `DOMAIN_MODEL_V1:119` and `PRODUCT_CONTRACT_V2:152-154`, `:1293-1295` |
| C8 | **Hardcoded resolutions.** 720×1280 / 1280×720 tabulated as the form resolutions — vs — those values must not be hardcoded and must come from the profile. | `WIDGETS_AND_MEDIA:28-33` and `CONTRACT_V2:39-44` **vs** `PRODUCT_CONTRACT_V2:142` "Eski sözleşmedeki 720×1280 / 1280×720 değerleri profile sabit kodlanmamalıdır" (the implementation follows the newer rule, factories.ts:51-55) |
| C9 | **Doc vs implementation.** `DOMAIN_MODEL_V1:215` specifies `Asset.variants?`; `models.ts:198-204` has no such field. `DOMAIN_MODEL_V1:12` specifies `ProjectSettings`; `Project.projectSettings` exists but nothing reads it. | `DOMAIN_MODEL_V1:12,215` vs `models.ts:198-204,214` |
| C10 | **Media Slide cardinality — three-way, and one doc contradicts itself.** A Media Sequence is "a real widget that plays several media in time order" — vs — "a Media Slide plays a **single** media content" — vs — the same doc twice describing **sequential content inside one Media Slide** with its own timeline/order. The domain's single `mediaSlide.assetId` satisfies only the middle reading. | `PRODUCT_CONTRACT_V2:660` and `WIDGETS_AND_MEDIA:125` **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:203` **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:247` "Aynı Media Slide içindeki ardışık medya yapısı varsa kendi timeline/order kuralları geçerlidir" and `:270` "Bir Media Slide'ın kendi içindeki ardışık içerikler ise timeline/order ile oynatılır" |
| C10a | **Stable-ID composition, and the implementation follows neither.** IDs should encode Project/Theme identity **and rotation** (`T01R03M0042`) — vs — "an Asset is not inherently rotation-specific", so V1 should prefer Theme/package namespace + asset ID (`T01-A0042`) and keep rotation in the Scene/widget reference. `editor-application.ts:8` emits `<prefix>-<crypto.randomUUID()>` with **no** theme/package namespace and no rotation, so neither scheme is implemented; `factories.ts:47-49` likewise. `WIDGET_SYSTEM_QUESTIONNAIRE_V1:219` additionally requires ID generation to be **deterministic**, which `crypto.randomUUID()` is not. | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:191-193,199-203` **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:113,115,121` |
| C10b | **Where background-music override rules live.** Configurable per state/scene/media-audio arrival — vs — "Scene-level override is not used" and the values belong in Theme/Audio Settings, explicitly "not a Scene override". | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:163-170` "hangi state/scene/media audio geldiğinde… background music volume düşürülecek…" **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:339` "Scene-level override kullanılmaz" and `:355` "Theme/Audio Settings'te tanımlanabilir; **Scene override değildir**" |
| C10c | **Self-contradiction on export-time ID renaming.** A "firmware-safe file name" form of the stable ID is offered — vs — the same document forbidding transformation into firmware-usable names at export. | `WIDGET_SYSTEM_QUESTIONNAIRE_V1:205` "veya firmware-safe dosya adı:" **vs** `:219` "export sırasında firmware'in güvenle kullanabileceği isimlere **dönüştürülmemelidir**" |
| C10d | **How many audio volume channels.** "At least **three** audio channels must be modelled separately" (Announcement / Background Music / Video Audio) — vs — **five** separate volumes (Background Music / Media / Announcement / Video / External Audio). Neither is implemented (F18), so whoever builds it must pick. | `MEDIA_LAYERING…:149-155,179` **vs** `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:381-389` |
| C10e | **Door modelling — and the implementation matches neither doc.** Four discrete states `door_opening`/`door_open`/`door_closing`/`door_closed` — vs — a `Door` enum compared against `Closed`/`Open`/`Opening` in condition examples; the registry's own available-state list omits two of its four declared states. **`factories.ts:20` ships `door_state` as an enum `["closed","opening","opening-completed"]`**, and `opening-completed` appears in no document at all. | `RUNTIME_STATE_REGISTRY:82-85` **vs** `SCENE_DESIGNER_QUESTIONNAIRE_V1:78,86` and `BINDING_PARAMETRIC_SYSTEM_V1:63`; intra-doc list `RUNTIME_STATE_REGISTRY:164,166` |
| C10f | **Runtime-setting defaults disagree on values *and* keys, including inside one document.** Announcement 70% / BGM **25%** — vs — Announcement 70% / BGM **20%** in the same doc — vs — `announcement_volume: 80`, `background_music_volume: 20`, `video_audio_volume: 60` in the schema. Key coverage also diverges: the settings doc lists Language, Voice Pack and BGM Enable, none of which exist in the schema block, while the schema invents `video_audio_volume`, which the settings doc never lists. | `FIRMWARE_PRESENTATION_SETTINGS:28-29` **vs** `:268-269` (same doc) **vs** `TEMPLATE_SCHEMA_V1:362-364`; key lists `FIRMWARE_PRESENTATION_SETTINGS:15-19` vs `TEMPLATE_SCHEMA_V1:361-366` |
| C10g | **A binding example uses a state the same document forbids inventing.** "Floor == 6 AND **Waiting** == true" — while `Waiting` appears nowhere in the runtime-state registry — against "The Designer must not invent runtime states." | `BINDING_PARAMETRIC_SYSTEM_V1:64` **vs** `:68` and `RUNTIME_STATE_REGISTRY:59-105` |
| C10h | **Profile/registry versioning is required but has no domain field.** `deviceProfileVersion` is a schema field and the state-registry version "must be recorded" when a template is created — but `Project` carries only `schemaVersion` and `deviceProfileId`, so the required "removed or retyped state raises a validation warning" rule is unimplementable. | `TEMPLATE_SCHEMA_V1:58` and `RUNTIME_STATE_REGISTRY:371,381` **vs** `models.ts:206-216` — see F9b |
| C10i | **Rotation's place in the hierarchy.** `Rotation` is a Scene *property* — vs — `orientation` is a *theme-canvas* property — vs — the implementation makes `Rotation` a **container that owns Scenes**, so neither doc's placement exists. | `SCENE_DESIGNER_QUESTIONNAIRE_V1:48` **vs** `TEMPLATE_SCHEMA_V1:73` **vs** `models.ts:163-169` |
| C11 | **`floor` datatype — three-way, and the implementation picks the forbidden option.** `floor: integer` — vs — "`floor` must **not** be accepted as `integer` only" — vs — serialized as the string `"11"`. `factories.ts:19` ships `type: "integer"`. | `RUNTIME_STATE_REGISTRY:301` (`floor: integer`) **vs** `FIRMWARE_PRESENTATION_SETTINGS:190` "Dolayısıyla `floor` değeri yalnız `integer` kabul edilmemelidir" **vs** `TEMPLATE_SCHEMA_V1:429` `"floor": "11"`; symbolic values required by `DOMAIN_MODEL_V1:187` and `MEDIA_LAYERING…:125-141` |
| C12 | **Direction representation.** Two boolean states `up` / `down` — vs — a single `direction` state compared against `Up`. | `RUNTIME_STATE_REGISTRY:66-67` **vs** `TEMPLATE_SCHEMA_V1:126` and `BINDING_PARAMETRIC_SYSTEM_V1:26` |
| C13 | **Warning registry membership.** `estop` is listed as a runtime state — vs — "the current elevator warning registry has **three** warnings: service_out, overload, fire" (estop absent). `factories.ts:21` ships `service_state` enum `normal/service_out/overload` and no `estop` at all. | `RUNTIME_STATE_REGISTRY:95` **vs** `TEMPLATE_SCHEMA_V1:155-160` |
| C14 | **Binding object shape.** Seven binding actions plus content/style selection — vs — a schema binding with only `id` / `sourceType` / `sourceId` (no action, no conditions, no contentId). `models.ts:106-122` follows neither exactly. | `BINDING_PARAMETRIC_SYSTEM_V1:159-165` **vs** `TEMPLATE_SCHEMA_V1:114-116` |
| C15 | **Scene has no schema entity.** Scenes drive the whole activation model — vs — `TEMPLATE_SCHEMA_V1` defines `themes`/`widgets` and a validator list with no Scene entity, field or invariant. | `SCENE_DESIGNER_QUESTIONNAIRE_V1:14` **vs** `TEMPLATE_SCHEMA_V1:28,76,403-405` |
| C16 | **Runtime-setting capability field name.** `affectedCapabilities` — vs — `bindingCapabilities`. `models.ts:55` implements the former (and nothing reads it). | `DOMAIN_MODEL_V1:100` **vs** `RUNTIME_STATE_REGISTRY:124` |

Where C1–C8 conflict, `TEMPLATE_DESIGNER_PRODUCT_CONTRACT_V2.md` self-declares precedence (`:3` "Canonical product specification", `:5` "Eski sözleşmede bulunan ancak burada açıkça kaldırılan kavramlar yeni uygulamaya taşınmamalıdır"), so `WIDGETS_AND_MEDIA.md` and `CONTRACT_V2.md` should be treated as superseded on those eight points. I have scored the matrix accordingly. **C9–C16 (19 conflicts in total, counting C10a–C10c) are not resolved by that precedence rule and remain genuinely open** — C10, C10a and C10b are conflicts *between the two questionnaire docs*, which no document ranks against the other, and C10c is internal to a single document.

**Three documents weaken their own authority, which matters when scoring "is it V1 scope":**
- `SCENE_DESIGNER_QUESTIONNAIRE_V1.md:3` self-labels the entire document as "yapılan soru-cevap turunun **arşivlenmiş** UX karar seti" — an archived Q&A record, not a commitment. Its many `bulunabilir` ("may exist") verbs are therefore optional, though its §2/§5 Activation Editor and §11 drag/drop reorder are stated as plain requirements.
- `BINDING_PARAMETRIC_SYSTEM_V1.md:234` disclaims only its own "Future extension" list (`:224-233`) — "These are architectural extension points, not all mandatory first-release features". The document's condition model (`:58`), Floor Mapping Editor (`:95`) and action list (`:159-165`) sit **outside** that disclaimer and read as V1.
- `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:504` records that **two of its own questions were never answered** — "kullanıcı 14 ve 15 numaralı önceki sorular için henüz seçim belirtmedi… mevcut kararlar bu iki maddeyi varsayarak ilerletilmemiştir" — and `:95`, `:125`, `:456` defer colour coding and the package/ID model to a future firmware contract. Parts of the asset-browser spec are therefore explicitly undecided, not merely unimplemented.

**Four domain identifiers are implementation coinages that appear in no specification**, which matters for anyone trying to align the code with a doc:

| implemented name | where | what the docs actually say |
|---|---|---|
| `Binding.contentId` | `models.ts:121` | No `contentId` token exists in any of the 17 docs. The nearest claims are prose: "select corresponding digit style/content reference" (`BINDING_PARAMETRIC_SYSTEM_V1:124`) and an empty `"content": {}` (`TEMPLATE_SCHEMA_V1:102`) |
| `conditionMode: "all" \| "any"` | `models.ts:26,110,160` | No `all`/`any` mode is named anywhere; the docs say only `AND/OR` prose (`BINDING_PARAMETRIC_SYSTEM_V1:58`, `SCENE_DESIGNER_QUESTIONNAIRE_V1:107`) and an unspecified "expression ağacı" (`TEMPLATE_SCHEMA_V1:151`) |
| `RuntimeStateDefinition.simulator` | `models.ts:43` | The registry field is **`simulatorSupport`** (`RUNTIME_STATE_REGISTRY:123`) |
| `RuntimeSettingDefinition.affectedCapabilities` | `models.ts:55` | The registry field is **`bindingCapabilities`** (`RUNTIME_STATE_REGISTRY:124`); `affectedCapabilities` comes only from `DOMAIN_MODEL_V1:100` — see C16 |

**One place where the implementation is *ahead* of the schema doc:** `FloorMapping`/`FloorMappingEntry` exist in the domain (`models.ts:171-180`), are validated (`validation.ts:247-268`) and are exported (`export.ts:103`), whereas `TEMPLATE_SCHEMA_V1` defines **no** floor-mapping structure at all — even though `BINDING_PARAMETRIC_SYSTEM_V1:112` requires the mapping to be "exportable in a deterministic firmware-readable form" and `:220` requires validating an "invalid floor mapping reference". The domain shape is the only concrete definition that exists; the gap is the missing editor (F7), not the model.

---

# DELIVERABLE 4 — TEST-COVERAGE HONESTY

11 test files, 0 UI-interaction tests (no `@testing-library`, no `jsdom` event simulation). The only test that touches `App.tsx` renders it to a string once.

| file | what it actually PROVES about product behaviour | what it merely asserts about internals / does not prove |
|---|---|---|
| `tests/architecture.test.ts` (33 lines) | Nothing about behaviour. Proves `src/Domain` and `src/Core` contain no `react` / `@tauri-apps` import strings (:19-21,:29-31) | A regex over concatenated file text. Would pass on completely broken code |
| `tests/foundation.test.ts` (88 lines) | Real: a new project has 1 group / 1 theme / exactly R0,R90,R180,R270 with the R90 swap (:38-40) — **the canonical-rotation invariant, at creation only**; fresh IDs per project (:45-51); `validateProject` returns structured issues (:53-64); `CommandHistory` execute/undo/redo/redo-invalidation (:66-87) | The undo test uses a local `SetValueCommand` on `{value:number}`, not the project document. Nothing about UI |
| `tests/core-integrity.test.ts` (55 lines) | Real: undo stack is bounded and evicts oldest (:23-36); default limit is honoured (:38-44); dirty comparison is key-order-insensitive (:46-54) | Uses `store.replaceCurrent` directly, bypassing `EditorApplication`. No user path |
| `tests/ui-phase2.test.ts` (33 lines) | Real: profile registry lookup (:8-13); docking a panel does not undock its sibling (:15-20); the shipped profile has non-empty runtime registries (:29-32) | `snapGeometry`/`intersects`/`normalizeRect` are pure-helper assertions (:22-27) for a function the app **never calls** (TEST-ONLY). Zero rendering |
| `tests/shortcut-registry.test.ts` (58 lines) | Real and valuable: platform-exact Ctrl vs Cmd matching, Ctrl+Meta rejected, Shift+Ctrl+Z unbound, Delete matched (:9-17); conflict detection throws (:25); `coerceToDefinitionType` string→number coercion (:36-41); negated-condition-on-unset semantics (:56-57) | Tests the registry's *table*, not that `App`'s handler routes to the right command. Nothing proves Ctrl+S actually saves |
| `tests/canvas-interaction.test.ts` (357 lines) | Real: drag threshold boundary 3.99/4/4.01 (:198-202); nudge steps + ambiguous/wrong-platform modifier rejection (:204-225); `pan × fitScale` view frame (:227-233); screen↔canvas round-trip (:49-75); hit-test z/doc-order/ID tie-break and invisible exclusion (:84-94,:262-270); marquee intersect-only + `"contains"` throwing (:108-125); resize per handle + minimum size (:130-139); snap threshold and grid-pass priority (:272-278); all four z-order ops with equal-z and lock handling (:280-311); **geometry mutation boundary rejects NaN/Infinity/≤0 and wrong-scene/duplicate-ID scopes (:313-356)** | All pure functions + `EditorApplication` calls. **No pointer-event sequence is ever simulated**, so nothing proves that drag/resize/marquee wiring in `App.tsx:1290-1465` (lazy capture, click suppression, capture-loss recovery) behaves as commented. Its fixture theme has **one** rotation (:186), silently violating the canonical rule |
| `tests/editor-widgets.test.ts` (253 lines) | Real: `addWidget` shape/z-order/undo/redo (:51-78), refusal cases without history (:80-90), default geometry (:92-98); duplicate re-parents bindings with new IDs (:101-130); paste inserts above max z and undoes (:133-161); rename any node without touching IDs (:165-177); Scene priority validation 0..10 + integer (:179-190); bulk visibility/lock without touching geometry (:192-203); duplicate-at-point centring maths (:205-216); atomic binding replacement with validation (:218-234); profile switch undo (:236-243) | Every call is a direct Core call. Nothing proves the Properties panel, Binding Editor modal or context menu reach these. `setSceneProperties({activationConditionMode})` and the `name` key are never exercised |
| `tests/editor-pipeline.test.ts` (359 lines) | Real: `App` renders to a string containing "Template Designer" (:62-69) — **the only App coverage that exists**; add-theme undo/redo exactness (:71-85); menu-added theme gets the canonical four rotations (:87-98); add/move Scene and move Widget preserving children (:116-178); `editWidgetProperties` immutability (:180-191); duplicate/delete identity (:193-213); no-op mutations record no history (:215-231); New Project resets history (:233-244); **failed undo/redo commands stay available (:246-272)**; redo invalidation on new branch (:274-285); dirty→save→undo→clean→redo→dirty (:287-299); exactly one notification per mutation (:301-313); locked geometry blocked while other props apply (:315-341); last-group deletion refused (:343-358) | `renderToString` proves only that the tree does not throw on first paint: no state, no effects, no events. **:100-114 actively codifies `addRotation` adding a 2nd rotation to a 1-rotation theme** — i.e. the suite blesses a method that can violate the canonical exactly-four rule |
| `tests/project-storage.test.ts` (108 lines) | Real and valuable: save writes and load restores round-trip (:23-42); **a failing adapter keeps the dirty flag and rethrows (:44-56)**; corrupt/foreign payloads treated as absent (:58-64); deep shape gate rejects missing geometry / missing widgets / non-numeric rotation dims (:66-98); `clear` works (:100-107) | Uses an in-memory `MemoryStorage` double, never real `window.localStorage`. Nothing proves App's boot path (`App.tsx:426-427`) or the Open Project guard (:604-607) |
| `tests/program-settings.test.ts` (39 lines) | Real: settings round-trip (:12-20); corrupt and out-of-range payloads fall back to defaults (:22-29); `clear` restores defaults (:31-38) | Nothing proves that a saved setting reaches its consumer (grid visibility, density class, snap grid size) |
| `tests/domain-runtime.test.ts` (268 lines) | Real: one active Scene by priority then later activation order (:104-111); bindings evaluated only inside the active Scene (:113-121); unknown runtime reference + bad priority rejected (:125-148); unsupported widget type + broken media reference rejected (:150-167); **only a verified package reaches the adapter (:171-184)**; export scope = Resources ∪ Used ∪ Default, unused excluded, tamper detected, fresh package not pre-verified (:187-202); empty project blocks build (:204-218); duplicate widget IDs / non-finite zIndex / decode-slot limit (:220-267) | **Every asset, media slide, binding `contentId`, theme `resources` and `defaultAssetIds` in this file is a hand-written fixture literal (:30-101).** The suite therefore proves the export/validation *algorithms* against data the product cannot produce. `PackageDeploymentManager` is exercised with a local stub adapter (:173-178), never `SDCardTarget` |

## Top 10 product behaviours with ZERO test coverage

1. **Every pointer interaction on the canvas** — click-select, drag, resize, marquee, pan, duplicate-mode placement, lazy pointer capture, click suppression, capture-loss re-acquire (`App.tsx:1290-1507`). The helpers are tested; the 200-line state machine that uses them is not.
2. **Every keyboard command actually firing** — `handleGlobalKeyDown` (`App.tsx:1556-1615`): Ctrl+Z/Y/S/N/C/X/V/A, Delete/Backspace, Escape precedence over modals, arrow nudge, mid-gesture mutation blocking, text-input exclusion.
3. **The Binding Editor end-to-end** — `addBinding`/`removeBinding` (`App.tsx:889-929`) and the modal at `:2020`. Nothing catches the missing `Condition.source` (F3) or the inert `select-content`/`select-style` actions (F4).
4. **Undo/redo interaction with selection state** — the reconciliation effects at `App.tsx:546-558` and `:1646-1659` (stale selection pruning, label re-derivation after an undone rename).
5. **Dirty-state and Save UX** — that a brand-new never-persisted project reports "Saved" and disables File ▸ Save (`App.tsx:1761,1981` + `document-store.ts:61-66`) is untested and wrong (F8).
6. **Open Project** — `openProject` (`App.tsx:599-627`): the dirty-block path, the "no saved project" path, and the fact that it can only ever reopen one autosaved slot.
7. **Build & Verify from the UI** — `buildAndVerifyPackage` (`App.tsx:967-989`): the validation-blocked branch, the `deploymentStatus` transitions, and the fact that the status is never invalidated by later edits (F9).
8. **Canonical-invariant enforcement under user commands** — no test asserts that deleting or duplicating a Rotation is refused; `editor-pipeline.test.ts:100-114` asserts the opposite for `addRotation`.
9. **Preview Mode** — `previewActive`/`bindingEffects`/`displayedWidgets` (`App.tsx:1125-1144`): binding-driven hide/show and playback annotation, and the divergence between the edited Scene and the runtime-active Scene.
10. **Panel/layout and Settings application** — floating/collapsed/closed modes and reset (`App.tsx:991-1010`), and that saved settings reach `gridVisible`, `relaxed-density` and `snapGridSize` (`App.tsx:1663-1667,1150`).

Runner-up with zero coverage: the Tauri close-request guard (`App.tsx:1691-1719`) and `beforeunload` (`:1682-1689`).

---

# DELIVERABLE 5 — TOP FINDINGS (ranked)

28 rows: the requested top 25, plus three late-verified insertions (**F7b**, **F7c**, **F9b**) added after cross-checking the runtime-state, firmware-settings, widget-system and template-schema specs. Each insertion carries its true rank in its own cell; the `F7b`/`F7c` labels were fixed in earlier reporting, so they appear out of positional order — read the stated rank, not the row position.

All line numbers at HEAD `11cc2c6`. Findings marked ⟳ are already being changed by the in-flight edit (Appendix A) — at the Core layer only.

**Where the implementation is demonstrably right** (recorded so the gap list is not read as "nothing works"): the four-rotation scaffold and the R90/R270 dimension swap (`factories.ts:51-55,67-76`); profile-gated widget palette (`App.tsx:685-688,1796`); deterministic equal-priority tie-break (`runtime.ts:110-112`); 0.1-second duration precision exactly as specified (`validation.ts:195-196` vs `MAB:211`); Loop and Repeat correctly modelled as *separate* concepts (`models.ts:128-129` vs `MAB:225-237`); negated-condition-on-unset symmetry (`runtime.ts:57`); bounded undo history with snapshot commands (`commands.ts:14,37-45`); key-order-insensitive dirty comparison (`serialize.ts:7-11`); a package never pre-declared verified (`export.ts:180`); persistence failure never reported as saved (`document-store.ts:79-83`); and a deep load-time shape gate that refuses malformed projects instead of crashing (`project-storage.ts:32-62`).

| # | Sev | Class | Finding | Evidence |
|---|---|---|---|---|
| F1 | **P0** | BUG | **A reachable UI command creates a permanently invalid project by breaking the canonical four-rotation rule.** Select a Rotation in the Explorer, then Widget ▸ Duplicate Selection → the theme gets a 5th rotation with a duplicate angle; Delete Selection → it drops to 3. Both then fail `REQUIRED_ROTATIONS_MISSING` forever, and there is no Add Rotation command to repair it. The context menu explicitly offers Delete for `rotation`. ⟳ | `editor-application.ts:519-520` (dup) and `:431-432` (delete); reachable via `App.tsx:1799,1769,1792,1801`; context menu `editor-commands.ts:53`; selection kind resolves at `App.tsx:138`; validation `validation.ts:277-281` |
| F2 | **P0** | BUG | **`EditorApplication.addRotation` exists and can add a 5th rotation**, violating the canonical rule; its only caller `App.addRotation` is dead code that no control invokes, so the hazard is dormant but shipped — and the test suite *codifies* it. ⟳ | `editor-application.ts:182-191`; dead caller `App.tsx:645-659`; test asserting 2 rotations `editor-pipeline.test.ts:100-114` |
| F3 | **P0** | VALIDATION BUG | **Binding on a runtime *setting* always produces an invalid project — and setting-sourced bindings are explicitly mandated.** The state picker offers `[...profileStates, ...profileSettings]`, but the constructed condition omits `source`, which defaults to `"state"` → `UNKNOWN_RUNTIME_REFERENCE` → Build & Verify blocked, with no way to fix it in the UI. With the shipped profile, binding on `language` is a one-click trap. `Condition.source` exists precisely to carry this and is never written. | picker `App.tsx:2020`; condition built without `source` `App.tsx:910`; default `validation.ts:51` / `runtime.ts:15`; error `validation.ts:55-63`; export gate `export.ts:130-131`. **Spec mandates it:** `TEMPLATE_SCHEMA_V1:110` "Binding firmware-owned runtime state **veya runtime setting**'e referans verir", `:410` "Runtime setting references exist in profile", `FIRMWARE_PRESENTATION_SETTINGS:324` "Template Binding = **state/setting** sonucunda…" |
| F4 | **P0** | INCOMPLETE WORKFLOW | **`select-content` and `select-style` binding actions are offered but can never do anything.** There is no `contentId` input, `addBinding` never sets it, and `bindingEffects` handles only hide/show/play/pause/stop/restart/continue. The two actions the spec names for Digit/Direction semantics are decorative. | action `<select>` `App.tsx:2020`; no contentId `App.tsx:907-912`; effects switch `App.tsx:1135-1140`; spec `BINDING_PARAMETRIC_SYSTEM_V1:168` |
| F5 | **P0** | MISSING FEATURE | **A binding can only ever hold one condition, and `conditionMode` is unreachable.** `addBinding` hardcodes a single-element array; no add-condition control exists. `Binding.conditionMode` is consumed by `runtime.ts` and can never be set, so AND/OR bindings are impossible. | `App.tsx:910`; `models.ts:110`; consumer `runtime.ts:129`; spec `BINDING_PARAMETRIC_SYSTEM_V1:58,63-66` |
| F6 | **P0** | MISSING ENTRY POINT | **Scene activation conditions cannot be authored at all**, so the product's central mechanism is inert: `conditionsMatch([])` returns `true`, every Scene always matches, and active-Scene selection degenerates to "highest priority wins". `Scene.activationConditions` is consumed by `runtime.ts` and `validation.ts`; the Properties panel shows only a count. ⟳ | field `models.ts:159`; always `[]` `editor-application.ts:197`; omitted from the mutation `Pick` `:279`; read-only UI `App.tsx:1911`; consumers `runtime.ts:105`, `validation.ts:229`; empty⇒true `runtime.ts:88`; spec `SCENE_DESIGNER_QUESTIONNAIRE_V1:52,71-88` |
| F7 | **P0** | MISSING FEATURE | **No asset can ever enter a project**, so 17 domain fields and a large part of `export.ts`/`validation.ts` are unreachable: `Project.assets`, `Project.defaultAssetIds`, `ThemeProject.resources`/`defaultAssetIds`, `Widget.assetIds`/`mediaType`/`audioAssetId`/`mediaSlide` (+8 sub-fields), `Binding.contentId`. The Asset Browser is a permanently empty four-tab shell with hardcoded `0` counts. The spec's only stated V1 import entry point is a drop onto Project Explorer/resource targets, and **no `onDrop`/`onDragOver`/`onDragEnter`/`dataTransfer`/`draggable` exists anywhere in `src/**/*.tsx`** (zero matches); note the spec *forbids* canvas drop, so the missing surface is specifically Explorer/Resources. ⟳ | no writer at HEAD (`editor-application.ts` has no asset method); `factories.ts:101` `assets: []`; Asset Browser `App.tsx:1837-1851`, hardcoded zeros `:1846`; export consumers `export.ts:35-45,60-69,137,162`; validation consumers `validation.ts:172-213,302-304,322-327,371-372`; import spec `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1:36,40-43`, canvas drop forbidden `:38` |
| F7c | **P2** | BUG | **The spec's unassigned-resource state is unrepresentable in the domain.** A dropped file must first exist as a Resource with `Type: None` and only later receive a semantic type (or stay `Unsupported`), but `Asset.mediaType` is a **required** field whose union has no unassigned member. Any import implementation must therefore invent a sentinel or guess a media type at drop time; `Unsupported Files` likewise has no domain representation (its tab is hardcoded to `0`). *(Late-verified insertion; true rank ~21st.)* | required field `models.ts:202`; closed union `models.ts:17`; spec `WIDGET_SYSTEM_QUESTIONNAIRE_V1:225,228,231,233`; hardcoded tab `App.tsx:1846` |
| F7b | **P1** | BUG | **Symbolic floor values are unrepresentable, so the floor feature the specs describe cannot be built.** The shipped profile declares `floor` as `type: "integer"`, which `FIRMWARE_PRESENTATION_SETTINGS:190` explicitly forbids and which `DOMAIN_MODEL_V1:187` contradicts (`R`,`Z`,`K`,`T`,`P` must be supported). In code, a condition `floor == "R"` is rejected by validation's integer branch, and `coerceToDefinitionType` only converts `/^-?\d+$/`, so the value can never match at runtime either. `FloorMapping` exists to solve exactly this and is itself an ORPHAN (F7). *(Late-verified insertion; true rank is 8th.)* | profile `factories.ts:19`; integer type gate `validation.ts:79-81`; coercion `runtime.ts:36`; specs `FIRMWARE_PRESENTATION_SETTINGS:190`, `DOMAIN_MODEL_V1:187`, `MEDIA_LAYERING…:125-141`, `RUNTIME_STATE_REGISTRY:301`, `TEMPLATE_SCHEMA_V1:429` (see C11) |
| F8 | **P1** | PERSISTENCE BUG | **A brand-new, never-persisted project reports "Saved" and File ▸ Save is disabled.** `open()` sets `savedProject = currentProject`, so `isDirty` is false on first boot with empty storage; the chip says "Saved" and the menu item is disabled, while nothing is on disk. Ctrl+S still works, so the menu and the shortcut disagree. | `document-store.ts:61-66`; boot `App.tsx:427`; `create`→`open` `document-store.ts:68` + `App.tsx:563`; disabled Save `App.tsx:1761`; chip `App.tsx:1981`; ungated shortcut `App.tsx:1594` |
| F9 | **P1** | STATE BUG | **`deploymentStatus` is never invalidated by editing.** After a successful Build & Verify the status bar keeps claiming "Built · checksum verified" while the user mutates the project; it is only reset by New Project / Open Project. This is exactly the "never claim success before verification" rule inverted. | set `App.tsx:983`; resets only at `:571,:622`; displayed `:2018,:1957`; rule `AGENTS.md` Reliability |
| F9b | **P2** | MISSING FEATURE | **The project records no profile or state-registry version, so profile-drift validation is unimplementable.** `TEMPLATE_SCHEMA_V1:58` requires `deviceProfileVersion` and `RUNTIME_STATE_REGISTRY:371` requires recording which state-registry version a template was built against; `Project` carries only `schemaVersion` and `deviceProfileId`. Consequently `RUNTIME_STATE_REGISTRY:381` — "a removed or retyped state must raise a validation warning/error" — cannot be implemented: `validateProject` can only detect that a reference is unresolvable *now*, never that the registry changed underneath the template. *(Late-verified insertion; true rank ~19th.)* | `models.ts:206-216` (no version fields; `deviceProfileId` at `:210`); specs `TEMPLATE_SCHEMA_V1:58`, `RUNTIME_STATE_REGISTRY:371,381`; current check `validation.ts:357-359` compares ids only |
| F10 | **P1** | MISSING FEATURE | **Widget type-specific configuration is entirely unreachable**, because its only writer `editWidgetProperties` (which alone can set `content`/`style`) has no UI caller. Digit style, digit floor mapping, direction style, direction variant are all rendered as read-only "Profile default / unresolved" / "Not selected"; `text` and `warning` have no Properties section at all. ⟳ | writer `editor-application.ts:375` (TEST-ONLY, only callers `editor-pipeline.test.ts:184,337`); read-only rows `App.tsx:1907-1909`; missing sections — `:1907-1909` covers only digit/direction/media; spec `PRODUCT_CONTRACT_V2:493-513,546-556,600` |
| F11 | **P1** | MISSING ENTRY POINT | **Scene and widget order cannot be changed.** `moveScene`/`moveWidget` are TEST-ONLY; there is no drag-and-drop and no Move Up/Down command. Scene document order is the *only* tie-break the runtime uses at equal priority, so the user cannot influence a documented runtime behaviour. | `editor-application.ts:236,344`; only callers `editor-pipeline.test.ts:153,169`; tie-break supplied from document order `App.tsx:500-504`, consumed `runtime.ts:102,111`; spec `SCENE_DESIGNER_QUESTIONNAIRE_V1:119,125` |
| F12 | **P1** | MISSING FEATURE | **No mechanism to author or propagate across the four rotations.** Each rotation has an independent scene list; validation only checks that four angles *exist*, never that any is non-empty. A publishable theme therefore requires four times the manual work with zero assistance, and an all-but-one-empty theme validates clean. | independent scenes `models.ts:168`; existence-only check `validation.ts:277-281`; spec `CONTRACT_V2:46`, `WIDGETS_AND_MEDIA:35` |
| F13 | **P1** | STATE BUG | **A disabled widget is still drawn but cannot be clicked or marquee-selected**, with no visual indication. `renderCanvasWidget` gates only on `visible`; `hitTest` and `marqueeSelection` additionally require `enabled`. The result is an apparently-present widget that ignores the mouse. | render `App.tsx:1743-1749` (class list has only `is-selected`/`is-locked`); `canvas-interaction.ts:319,327`; toggle `App.tsx:1904` |
| F14 | **P1** | VALIDATION BUG | **The binding operator picker is not filtered by the profile.** All five operators are hardcoded, so `contains` can be chosen for the integer `floor` (which declares only 4 operators) → `UNSUPPORTED_CONDITION_OPERATOR`. Worse, `fire` declares no `operators` at all, so validation skips the check and `contains` on a boolean is accepted and silently never matches. | hardcoded list `App.tsx:2020`; profile operators `factories.ts:19` (floor) vs `:18` (fire, none); check `validation.ts:66-74`; runtime `runtime.ts:74-76` |
| F15 | **P1** | INCOMPLETE WORKFLOW | **The Simulator has no time.** Run/Pause/Step/Reset exist, but Run and Step both just call `traceRuntime()` once and `simulationStatus` drives nothing except a label and Pause's disabled state. There is no test sequence/block workflow, which the spec and `AGENTS.md` both require. | `App.tsx:1944`, `traceRuntime` `:1922-1931`, status state `:473`; spec `CONTRACT_V2:249`, `WIDGETS_AND_MEDIA:187-193`, `AGENTS.md` UI rules |
| F16 | **P1** | MISSING ENTRY POINT | **The Deployment Manager plane has no caller.** `SDCardTarget` is imported by nothing at all; `PackageDeploymentManager` is TEST-ONLY; `UnsupportedDeploymentManager`, `ConsoleLogger` and `Logger` are dead. `App.tsx` calls `buildDeploymentPackage` directly, bypassing the `DeploymentService → Adapter` chain `AGENTS.md` mandates. *(Distinct from the accepted "native SD transport not implemented" exclusion: the issue is that the existing abstraction is wired to nothing.)* | `sd-card-target.ts:4` (no importer); `application.ts:30,44,53`; direct call `App.tsx:980`; rule `AGENTS.md` Platform isolation, `Ana Proje…Promptu:633-657` |
| F17 | **P1** | MISSING FEATURE | **Multilingual content is absent from the domain.** No localized-content type exists, `Asset.variants` promised by `DOMAIN_MODEL_V1:215` is missing from `models.ts`, and `DeviceProfile.languages` is dead. The Simulator can switch the `language` setting, but nothing anywhere resolves content by language. | `models.ts:198-204` (no `variants`); `languages` `models.ts:88` populated `factories.ts:26`, read by nothing; switch `App.tsx:1947`; spec `MULTILINGUAL_CONTENT_SYSTEM:7-12,252-262` |
| F18 | **P1** | MISSING FEATURE | **Audio is unmodelled beyond a single asset id.** `AudioCapabilities` (7 fields) is populated by the profile and read by nothing; there are no three audio channels, no template default volumes, no background-music asset, no per-floor announcement. `MediaSlideContent` even collapses video loop count and audio repeat count into one `repeatCount`, which the spec says must be independent. | `models.ts:58-66` vs no reader (validation reads only `videoCapabilities` `validation.ts:232`); `models.ts:129`; spec `MEDIA_LAYERING…:87,149-165,171,103-121` |
| F19 | **P2** | VALIDATION BUG | **`BROKEN_FLOOR_STYLE_REFERENCE` can never fire on its own.** Its guard `profile.digitStyles?.includes(id) === false` is only true when `digitStyles` exists and excludes the id — precisely when the preceding `UNKNOWN_DIGIT_STYLE` already fired; and when `digitStyles` is undefined the comparison is `undefined === false` → false. The rule is a permanent duplicate. | `validation.ts:261-266` |
| F20 | **P2** | BUG | **Duplicated and pasted widgets can be stranded outside the rotation with no clamp and no validation.** `duplicateWidget` adds a fixed +10/+10; `duplicateSelectionInScene` and `insertWidgetCopies` never clamp (unlike the canvas commit path, which does), and `validateWidget` has no bounds rule — only finiteness and positivity. Duplicating a widget at the right/bottom edge silently leaves it partly off-screen and validation stays green. | offset `editor-application.ts:93`; unclamped `:464-478,:486-501`; clamp only in the UI `App.tsx:1255-1275`; no bounds rule `validation.ts:155-166` |
| F21 | **P2** | INCOMPLETE WORKFLOW | **Open Project is a single autosave slot with a dead-end guard.** It reads the same key Save writes, so there is no file picker and no second project; when the document is dirty it refuses with a console WARN and offers no discard option, unlike New Project which shows a confirm dialog. | `App.tsx:599-627`, dirty block `:604-607`; confirm-dialog precedent `:577-588`; single key `project-storage.ts:14` |
| F22 | **P2** | UX DISCOVERABILITY | **`RuntimeStateDefinition.simulator` and `.category` are ignored.** The Simulator renders every declared state unfiltered and ungrouped, so the flag that exists to gate Simulator exposure and the profile-defined categories the spec asks for have no effect. | fields `models.ts:39,43`; unfiltered render `App.tsx:1946`; spec `SCENE_DESIGNER_QUESTIONNAIRE_V1:94` |
| F23 | **P2** | UNDO-REDO BUG | **Duplicating a container gives no selection and no identity feedback.** `duplicateSelection` builds `createdIds` from a widget-only ID map, so duplicating a Scene/Theme returns `createdIds: []`; `App` then leaves the selection on the original while logging "Selection duplicated". The user cannot tell which node was created. | ID map is widget-only `editor-application.ts:102-116`; `createdIds` derived from it `:508`; selection skipped `App.tsx:782-793` |
| F24 | **P3** | STATE BUG | **A destructive command reports success before the user confirms.** With `confirmDestructive` on, `deleteSelectionCommand` returns `true` as soon as the dialog opens, so `executeEditorDescriptor` logs "canvas.delete-selection executed" for a deletion that may be cancelled. | `App.tsx:750-762` (returns `true` at `:759`); logging `:963` |
| F25 | **P3** | UX DISCOVERABILITY | **Default theme names are never de-duplicated.** `uniqueDefaultName` exists and is used for scenes and widgets, but `addThemeProject` is called with `undefined`, so every menu-created theme is literally "New Theme Project", and the selection label is hardcoded to that string. | helper `App.tsx:171-176`; used `:665,:697`; not used `:632`; hardcoded label `:638`; default `editor-application.ts:167` |

Deliberately **not** reported, per instructions: unimplemented native SD-card transport; empty `bundle.icon`; edge/center snap unreachable at grid=10/threshold=6; resize-handle overlap at ≤50% zoom.

---

# APPENDIX A — IN-FLIGHT UNCOMMITTED DELTA (as of 2026-08-19 00:34)

Captured because it changes several verdicts above **at the Core layer only**. `App.tsx` still calls none of the new methods, so every "no UI entry point" verdict stands.

`git diff --stat`: `App.tsx 16-` · `editor-application.ts +300` · `factories.ts +51` · `main.tsx ±4` · `editor-pipeline.test.ts ±49`. New untracked file `docs/PRODUCT_COMPLETION_LEDGER.md`.

**Added to `editor-application.ts` (working-tree line numbers, snapshot SHA1 `5056D409…`):**

| new symbol | WT line | callers | effect on this audit |
|---|---|---|---|
| `AssetDraft` type | 8 | — | — |
| `WidgetConfigurationPatch` type | 16 | — | — |
| `addAssets` / `addAsset` | 309 / 321 | **none** | F7's Core half addressed; still no UI, so `Project.assets` remains unreachable |
| `setAssetProperties` | 325 | **none** | as above |
| `removeAssets` (reference-complete purge) | 350 | **none** | as above. **Note:** it silently rewrites `contentId`/`audioAssetId`/`mediaSlide` to `undefined` (WT:373-379), which contradicts `BINDING_PARAMETRIC_SYSTEM_V1:222` "Invalid references must not be silently deleted… They remain explicitly marked as unresolved" |
| `setThemeResources` | 391 | **none** | F7 |
| `setWidgetConfiguration` (writes `widgetType`/`mediaType`/`assetIds`/`audioAssetId`/`mediaSlide`/`content`/`style`) | 409 | **none** | F10's Core half addressed; still no UI |
| `setSceneProperties` now accepts `activationConditions` | 490 | App.tsx:1911 passes only priority/enabled | F6's Core half addressed; still no UI |
| `setSceneActivation` | 503 | **none** | F6 |
| `containsRotationId` guard in `deleteSelection` | 655 | — | **F1 (delete half) fixed in Core** |
| `containsRotationId` guard in `duplicateSelection` | 752 | — | **F1 (duplicate half) fixed in Core** |
| `addRotation` **removed entirely** | — | — | **F2 fixed** (App's dead caller also deleted) |
| `setProjectDeviceProfile(profileId, display?)` re-derives rotation dimensions and clamps widgets | 566 | App.tsx:838 still passes only `profileId` | F7-rotation-dimension concern addressed in Core; **App does not pass `display`, so the reshape never runs** |
| `clampGeometry` helper | 145 | 585 | partially addresses F20 for profile switches, not for duplicate/paste |

**`factories.ts`:** adds `compactDeviceProfile` (480×800, `supportedMediaTypes: ["image","audio"]`, `digitStyles: ["digit-compact"]`); `createEmptyProject(name, profile)` and `createEmptyThemeProjectGroup(display)` become profile-parameterised. **`main.tsx`:** registers both profiles, which makes the previously-inert Device Profile `<select>` (`App.tsx:1902`, disabled when `< 2` profiles) actually usable.

`npx.cmd tsc --noEmit` → exit 0 against this working tree (verified 00:35).

**Consequence for the audit programme:** whoever is editing `src/Core/editor-application.ts` is remediating F1, F2, F6, F7 and F10 in Core while specialists audit. Either freeze the tree (tag or stash) before further specialist runs, or require every specialist to re-pin line numbers to a named commit.

## A.1 Second observation, taken at the end of this audit

`git status --porcelain` had grown again by the time D6 was written out:

```
 M src/App/App.tsx
 M src/App/shortcut-registry.ts
 M src/Core/editor-application.ts
 M src/Domain/factories.ts
 M src/Infrastructure/project-storage.ts
 M src/main.tsx
 M tests/editor-pipeline.test.ts
?? docs/PRODUCT_COMPLETION_LEDGER.md
?? src/Infrastructure/asset-import.ts
?? src/Infrastructure/project-file.ts
```

Two **new Infrastructure adapters** appeared that did not exist when Deliverables 1–5 were computed: `src/Infrastructure/asset-import.ts` (F7) and `src/Infrastructure/project-file.ts` (F21 — a real project-file adapter rather than the single localStorage autosave slot). `shortcut-registry.ts` and `project-storage.ts` are now modified too.

**This audit does not cover those two new files.** Deliverables 1–5 remain valid as a statement about commit `11cc2c6`, and remain useful because the UI layer had not been rewired at either observation. They should be re-run against a frozen commit once the remediation lands.

**Nothing in this audit modified the repository.** All output is confined to `C:\Users\b1601\AppData\Local\Temp\td-completion\`. The only commands executed against the repo were read-only (`read`/`grep`/`glob`, `git show`/`status`/`diff`/`log`, `Get-ChildItem`, `Get-FileHash`, and `npx.cmd tsc --noEmit`).
