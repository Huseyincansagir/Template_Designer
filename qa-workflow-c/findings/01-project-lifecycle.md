# Agent 01 — Project Lifecycle Integration

**Repo:** `C:\Users\b1601\Template_Designer` (Windows)
**Audited HEAD:** `55bf0f4` (`Add Agent 4 integration regression audit`)
**Mode:** Read-only static QA. No source, test, or config files modified. No live browser/Tauri run was available, so every UI-behavior conclusion that depends on runtime rendering is labeled UNVERIFIED; all other findings are statically proven (CONFIRMED).
**Baseline:** `typecheck` passes; Vitest 51/51 passes (per task brief; not re-run in this read-only pass).

Prior cleared items (not re-reported): the Agent 1 findings FND-01 (uncached `useSyncExternalStore` snapshot), FND-02 (`addScene`/`moveScene` hierarchy corruption), FND-03 (widget-duplicate no-op), FND-04 (New Project history/dirty leak) and FND-05 (failed-redo stack loss) were all addressed by the current HEAD and confirmed clean by `AGENT4_INTEGRATION_REGRESSION_REPORT.md`. Dirty-state accuracy of the raw `DocumentStore` create→edit→save→edit→undo→redo sequence is also already cleared there and is reproduced below only as a consistency baseline.

---

## Scope & scenarios traced

| # | Scenario | Path traced |
|---|---|---|
| S1 | Create → edit → save → edit → undo → redo | `App.createProject` (230-241) → `EditorApplication.execute` (editor-application.ts:125-139) → `DocumentStore.execute/undo/redo/save` (document-store.ts:75-108) → `refreshSnapshot` serialize compare (121-129) |
| S2 | New Project while document dirty | `createProject` (230-241) vs `savedSettings.confirmDestructive` (171-172) and `documentSnapshot.isDirty` |
| S3 | Save while clean (menu disabled) | File menu `Save` (782) gated by `!documentSnapshot.isDirty`; `saveDocument` (243-246) |
| S4 | Tab switch while dirty | `openDocuments`/`activeDocument` (165-166), tab `onClick` (966), `openDocument`/`closeDocument` (383-395), effect (754-758) |
| S5 | Close a tab | `closeDocument` (389-395) |
| S6 | Open a second document | `DocumentStore` single `currentProject` (document-store.ts:31-33) vs `openDocuments` string array |
| S7 | Select a Theme/Rotation node (scene-level "document" tabs) | `selectNode` (397-416), `openDocument(node.label)` (414), `activeRotation` fallback (464) |
| S8 | New Project during active canvas drag / with modal open | `createProject` (230-241) → `cancelCanvasInteraction` (550-561), `clearGeometryPreview` (538-542); modal states (169, 173) |
| S9 | New Project leaves simulator/deployment state | `createProject` (230-241) vs `runtimeValues`/`runtimeSettings`/`simulationStatus`/`deploymentStatus` (176-179) |
| S10 | Advertised menu shortcuts | Menu labels (780, 782, 785, 786) vs `handleCanvasKeyDown` (715-746) |

---

## Findings

### WC-01-01 — `confirmDestructive` setting is dead; New Project silently discards a dirty document (Severity: High · Failure types: UI misleading state, dirty-state corruption, lost selection · Confidence: CONFIRMED · Scenario: S2)

**Repro steps**
1. Open the app; mutate the document (e.g. add a Theme Project) so `documentSnapshot.isDirty === true`.
2. Ensure Settings → General → "Confirm destructive commands" is checked (it is checked by default).
3. Click **New Project** in the toolbar (963) or **File → New Project** (780).

**Evidence**
- The setting is created and defaulted but only ever written/rendered; it is read nowhere else:
  - `App.tsx:171` — `const [settingsDraft, setSettingsDraft] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });`
  - `App.tsx:947` — `<input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={...} /> Confirm destructive commands`
  - A repo-wide grep for `confirmDestructive` returns **only** lines 171, 172, 947 — no guard in `createProject`, `closeDocument`, or any command.
- `createProject` never consults dirty state or the setting, and resets the document unconditionally:
  - `App.tsx:230-241` — `const createProject = () => { cancelCanvasInteraction(); const nextProject = createEmptyProject("Untitled Project"); documentStore.create(nextProject); setSelection(null); setSelectedIds([]); ... }`
- No `window.confirm`/`alert` exists anywhere in `src` (grep for `window.confirm|alert\(` → no matches).

**Expected vs Actual**
- Expected: a destructive "New Project" while unsaved changes exist asks for confirmation when `confirmDestructive` is enabled.
- Actual: the in-memory document (and all unsaved edits) is silently replaced with a fresh empty project; the advertised safeguard is a no-op.

**Recommended fix (design-level)**
Consume `savedSettings.confirmDestructive` as a guard before `documentStore.create()` in `createProject` (and before any other destructive action), using a confirmation primitive. Until persistence exists, the warning should still fire when `isDirty` is true.

---

### WC-01-02 — "Save" / "Saved" UI claims a persistence that does not exist (Severity: Medium · Failure types: persistence mismatch · Confidence: CONFIRMED · Scenario: S1, S3)

**Repro steps**
1. Start the app. The footer shows `Document: clean`, the chip shows `Saved`, and `File → Save` is disabled — before any file was ever written.
2. Mutate, then `File → Save`. A "Saved" chip and console "Project saved" appear.

**Evidence**
- `saveDocument` only copies the reference in memory:
  - `App.tsx:243-246` — `const saveDocument = () => { documentStore.save(); logAction("Project saved", "EVENT"); };`
  - `document-store.ts:75-78` — `save(): void { this.savedProject = this.currentProject; this.refreshSnapshot(); }`
- No backend exists anywhere in `src`: grep for `localStorage|sessionStorage|indexedDB|fetch(|invoke(|FileReader|Blob|showOpenFilePicker|showSaveFilePicker|createObjectURL|JSON.parse` → **no matches** (the only `JSON.parse`-family hit is absent; `JSON.stringify` is used only for the in-memory dirty compare).
- The Tauri shell exposes only a version command, no persistence:
  - `src-tauri/src/lib.rs:3-12` — `fn app_version() ... .invoke_handler(tauri::generate_handler![app_version])`
- UI that implies persistence:
  - `App.tsx:782` — `{ label: "Save", shortcut: "Ctrl+S", disabled: !documentSnapshot.isDirty, onClick: saveDocument }`
  - `App.tsx:963` — `{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}`
  - `App.tsx:986` (footer) hedges with `Browser core · Tauri shell reserved`, but the chip/menu do not.

**Expected vs Actual**
- Expected: a new, never-persisted document is unsaved and "Save" is actionable; "Saved" appears only after a real write succeeds.
- Actual: a brand-new document is immediately "Saved"/clean and Save is disabled; "Save" performs no I/O. Reloading loses everything.

**Recommended fix (design-level)**
Represent an explicit `neverPersisted`/`persisted` lifecycle flag distinct from in-memory dirty; disable "Save" only when already persisted-and-clean, and label the chip "In memory" (or similar) until a persistence adapter exists.

---

### WC-01-03 — Document tabs imply N documents but the store holds exactly one; switching tabs changes nothing but a label (Severity: High · Failure types: UI misleading state, cross-document leakage · Confidence: CONFIRMED · Scenario: S4, S6)

**Repro steps**
1. With a dirty document, select a Theme and a Rotation so 2-3 tabs appear.
2. Click a different tab. Observe selection, history, dirty chip, canvas, and active Scene.

**Evidence**
- Tabs are a plain string list with no backing document:
  - `App.tsx:165-166` — `const [openDocuments, setOpenDocuments] = useState<string[]>(["Project Overview"]); const [activeDocument, setActiveDocument] = useState("Project Overview");`
- Tab click changes only `activeDocument`:
  - `App.tsx:966` — `onClick={() => { setActiveDocument(document); logAction(...) }}`
- `openDocument` only appends a label:
  - `App.tsx:383-387` — `setOpenDocuments((current) => current.includes(label) ? current : [...current, label]); setActiveDocument(label);`
- The store is single-document:
  - `document-store.ts:31-33` — `private currentProject: Project | undefined; private savedProject: Project | undefined;` (one current project; `open`/`create` replace it, lines 59-66).
- The only effect of a tab switch on the model is clearing transient geometry preview:
  - `App.tsx:754-758` — `useEffect(... [activeDocument, activeRotation?.id, activeScene?.id])` → `cancelCanvasInteraction()` / `clearGeometryPreview()`.
- The tab note literally asserts document semantics: `App.tsx:966` — `Theme Project / Rotation documents · {isDirty ? "Dirty" : "Clean"}`.

**Expected vs Actual**
- Expected: each tab is an independent document with its own selection, history, dirty flag, and canvas, or the UI does not present "documents"/"tabs" with dirty indicators and close buttons.
- Actual: all tabs are views over the one project; switching tabs leaves document/selection/history/dirty/canvas/activeScene untouched. The tab strip is cosmetic while presenting document semantics.

**Recommended fix (design-level)**
Either (a) promote `openDocuments` to a real multi-document map keyed by document id with per-document store/history/selection state, or (b) rename the strip to a non-document concept (e.g. "views"/"navigation") and remove per-tab dirty/close affordances until multi-document support exists.

---

### WC-01-04 — Active-tab "dirty indicator" dot renders unconditionally, even when clean (Severity: Low · Failure types: UI misleading state · Confidence: CONFIRMED · Scenario: S4, S3)

**Repro steps**
1. With a clean document (fresh New Project), look at the active tab.
2. The warning-colored dot is present on the active tab.

**Evidence**
- The span is rendered purely on `activeDocument === document`, with no dirty condition:
  - `App.tsx:966` — `{activeDocument === document && <span className="dirty-indicator" title="Foundation project has local state" />}`
- The class is styled as an alert dot:
  - `app.css:65` — `.dirty-indicator { width: 5px; height: 5px; ... background: var(--warning); }` with `app.css:21` — `--warning: #a67627;`
- The true dirty state is carried only by the text note (`Dirty`/`Clean`) and the header chip (`Unsaved changes`/`Saved`), both keyed to `documentSnapshot.isDirty` (966, 963).

**Expected vs Actual**
- Expected: a "dirty" indicator appears only when the document is dirty.
- Actual: the dot is a permanent "you are here" marker styled and classed as dirty, contradicting the neighboring "Clean" note.

**Recommended fix (design-level)**
Gate the span on `documentSnapshot.isDirty` (or rename/reclass it to an active-tab marker, e.g. `active-indicator`).

---

### WC-01-05 — Scene/Theme "document" tabs are keyed by label, not id, so duplicate labels collide (Severity: Medium · Failure types: cross-Scene leakage, UI misleading state · Confidence: CONFIRMED · Scenario: S7)

**Repro steps**
1. Add two Rotations to the same Theme — the UI always adds angle 0 (`addRotation` passes `0`, App.tsx:259), so both are labeled `R0` (`getThemeNodes`, App.tsx:89: `label: \`R${rotation.angle}\``).
2. Select both rotations in turn. Only one `R0` tab exists; both selections target the same tab label.
3. Optionally name a Theme `R0` and add an `R0` rotation — the theme tab and rotation tab collide too.

**Evidence**
- Tab identity is the label, and dedupe/close/React-key all use the label:
  - `App.tsx:414` — `if (kind === "theme" || kind === "rotation") openDocument(node.label);`
  - `App.tsx:384` — `current.includes(label) ? current : [...current, label]`
  - `App.tsx:391` — `const remaining = openDocuments.filter((document) => document !== label);`
  - `App.tsx:966` — `key={document}` (React key = label string).
- Rotation labels are not unique by construction:
  - `App.tsx:89` — `label: \`R${rotation.angle}\``
  - `App.tsx:256-259` — `addRotation` always calls `editorApplication.addRotation(themeId, 0, ...)`.

**Expected vs Actual**
- Expected: tabs identify stable canonical nodes by id, so two distinct rotations/themes produce distinct, independently closable tabs.
- Actual: two `R0` rotations (or a theme named `R0` and a rotation `R0`) collapse to one tab; `closeDocument` cannot distinguish them, and duplicate React keys cause incorrect reconciliation.

**Recommended fix (design-level)**
Key document tabs by canonical node id (`theme.id`/`rotation.id`) rather than display label, and carry a display label alongside.

---

### WC-01-06 — Selecting a Theme opens a tab but the canvas still shows the FIRST theme's first rotation (Severity: Medium · Failure types: cross-Scene leakage, wrong Scene mutation, UI misleading state · Confidence: CONFIRMED · Scenario: S7)

**Repro steps**
1. Add two Theme Projects (A, B); add a rotation+scene to each.
2. Select Theme B in the Explorer. A `B` tab opens.
3. The canvas shows Theme A's rotation (the first theme's first rotation), not Theme B's content.

**Evidence**
- Theme selection never sets `resolvedSelection.rotation`, so `activeRotation` falls back to the first theme:
  - `App.tsx:464` — `const activeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];`
  - Same fallback for runtime selection at `App.tsx:200` — `const runtimeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];`
- `group` is the first group (`App.tsx:194` — `const group = groups[0];`), and `themeProjects[0]` is the first theme regardless of the selected theme.

**Expected vs Actual**
- Expected: opening a Theme "document" displays that theme's canvas (its first rotation/scene), and subsequent geometry edits target that theme.
- Actual: the tab label says Theme B while the canvas (and therefore any committed geometry edit routed through `activeScene`) belongs to Theme A's rotation — a silent wrong-scene target.

**Recommended fix (design-level)**
Derive the active rotation for a `theme` selection from the selected theme (e.g. `resolvedSelection.theme?.rotations[0] ?? ...`), and keep `activeDocument`/canvas/selection in sync with the same resolved node.

---

### WC-01-07 — New Project leaves simulator runtime state, simulation status, and deployment status stale across documents (Severity: Medium · Failure types: cross-document leakage, stale state · Confidence: CONFIRMED · Scenario: S9)

**Repro steps**
1. Set simulator inputs, click **Run**, then **Build & Verify Package** (deployment status becomes "Verified package").
2. Click **New Project**. Observe the simulator panel and footer/console.

**Evidence**
- `createProject` resets selection, view, tabs, and geometry preview, but never touches these states:
  - `App.tsx:230-241` (no `setRuntimeValues`, `setRuntimeSettings`, `setSimulationStatus`, or `setDeploymentStatus` calls).
- The states persist as independent `useState`:
  - `App.tsx:176-179` — `runtimeValues`, `runtimeSettings`, `simulationStatus`, `deploymentStatus`.
- They are rendered from those states, not from the document:
  - `App.tsx:939` — `<span className="console-scope">Package: {deploymentStatus}</span>`
  - `App.tsx:986` — footer `{deploymentStatus} · Document: ...`

**Expected vs Actual**
- Expected: a new document starts with idle simulation, empty runtime inputs, and "Not built".
- Actual: a fresh `Untitled Project` can report "Verified package" and retain previous simulator inputs/run state, contradicting the empty canvas.

**Recommended fix (design-level)**
Extend `createProject` (and any real open path) to reset simulator/deployment/export ephemeral state alongside selection and tabs.

---

### WC-01-08 — Menu shortcuts (Ctrl+N/S/Z/Y) are advertised but not wired to any keyboard handler (Severity: Low · Failure types: command mismatch, UI misleading state · Confidence: CONFIRMED · Scenario: S10)

**Repro steps**
1. Focus the canvas and press `Ctrl+N`, `Ctrl+S`, `Ctrl+Z`, or `Ctrl+Y`.

**Evidence**
- Menu items declare shortcuts:
  - `App.tsx:780` — `{ label: "New Project", shortcut: "Ctrl+N", ... }`
  - `App.tsx:782` — `{ label: "Save", shortcut: "Ctrl+S", ... }`
  - `App.tsx:785-786` — Undo `Ctrl+Z`, Redo `Ctrl+Y`.
- The only key handler is `handleCanvasKeyDown`, which handles Escape, Ctrl+A, Delete/Backspace, and arrows — no Ctrl+N/S/Z/Y:
  - `App.tsx:715-746` (see `event.key === "Escape"`, `event.key.toLowerCase() === "a"`, Delete/Backspace, arrow keys only).
- No `window.addEventListener("keydown")` exists (grep `addEventListener(.keydown|keydown` → only the widget `onKeyDown` and `handleCanvasKeyDown`).

**Expected vs Actual**
- Expected: displayed shortcuts trigger the named command.
- Actual: the shortcuts are display-only. (This also means the "New Project while a modal is open" and "during an active drag" paths are not reachable by keyboard.)

**Recommended fix (design-level)**
Either implement a global key-binding layer dispatching to `undo`/`redo`/`saveDocument`/`createProject` (honoring modal-open state), or remove the `shortcut` hints until wired.

---

### WC-01-09 — Every project shares the hard-coded id `project-foundation` (Severity: Low · Failure types: state divergence, persistence mismatch · Confidence: CONFIRMED · Scenario: S1, S2)

**Repro steps**
1. Create a project, note its id.
2. Click New Project; note the id is identical.

**Evidence**
- `factories.ts:26-35` — `createEmptyProject` returns `id: "project-foundation"` unconditionally:
  - `factories.ts:28` — `id: "project-foundation",`
- `createProject` calls this factory each time:
  - `App.tsx:232` — `const nextProject = createEmptyProject("Untitled Project");`

**Expected vs Actual**
- Expected: project identity is unique per project so it can be compared, persisted, and later loaded without collision.
- Actual: all projects share one id; `expandedNodes` keyed by `project.id` (App.tsx:164) works only by coincidence, and any future multi-project store or persistence keyed on `project.id` would collide.

**Recommended fix (design-level)**
Generate a unique project id in `createEmptyProject` (e.g. UUID, mirroring the `newId` helper in editor-application.ts:8).

---

## Invariant check table

Legend: **C** = consistent, **D** = divergent, **n/a** = not applicable (nothing to check).

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 Create | C (empty, clean) | C (reset) | C (cleared) | C (empty) | C (clean) | C (none) | C ("Project Overview") | C (none) | C (none) | consistent |
| S1 Edit | C (mutated) | C | C | C (1 entry) | C (dirty) | C | C | C | C | consistent |
| S1 Save | C | C | C | C | C (clean) | C | C | C | C | consistent |
| S1 Edit again | C | C | C | C | C (dirty) | C | C | C | C | consistent |
| S1 Undo (to saved) | C | C | C | C | C (clean) | C | C | C | C | consistent |
| S1 Redo (away) | C | C | C | C | C (dirty) | C | C | C | C | consistent |
| S2 New Project while dirty | C (replaced empty) | C (reset) | C (cleared) | C (cleared) | C (clean) | C (none) | C | C | C | **D — no confirm; `confirmDestructive` ignored (WC-01-01)** |
| S3 Save while clean | C | C | C | C | C | C | C | C | C | **D — new project shown "Saved"/clean with Save disabled though never persisted (WC-01-02)** |
| S4 Tab switch while dirty | C (unchanged) | C (unchanged) | C (cleared transiently) | C (unchanged) | C (unchanged) | C (unchanged) | D (label changes) | C (unchanged) | C (unchanged) | **D — only label changes; tabs ≠ documents (WC-01-03); active-tab dot shown even clean (WC-01-04)** |
| S5 Close a tab | C (unchanged) | C | C | C | C | C | D (label removed) | C | C | **D — closes a label, not a document; no data/warn semantics (WC-01-03)** |
| S6 Open second document | C (single store) | C | C | C | C | C | D (label added) | C | C | **D — no second document exists; only a label is added (WC-01-03)** |
| S7 Select Theme/Rotation | C | C (node selected) | C | C | C | **D (theme → first theme's rotation, WC-01-06)** | D (label tab) | C | C | **D — tab label vs canvas scene diverge (WC-01-06); duplicate labels collide (WC-01-05)** |
| S8 New Project during drag / modal | C (cancel path present) | C | C (cleared) | C | C | C | C | C | C | **UNVERIFIED — pointer capture/modality prevents pointer trigger; no keyboard path (WC-01-08); modal state not reset if ever triggered** |
| S9 New Project after simulate/build | C (doc replaced) | C | C | C | C | C | C | C | C | **D — simulator/deployment state leaks into new doc (WC-01-07)** |

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| Critical | 0 | — |
| High | 2 | WC-01-01, WC-01-03 |
| Medium | 4 | WC-01-02, WC-01-05, WC-01-06, WC-01-07 |
| Low | 3 | WC-01-04, WC-01-08, WC-01-09 |
| Info | 0 | — |

Confidence: 9 of 9 findings are CONFIRMED by static evidence; S8 (modal/drag during New Project) is noted UNVERIFIED because it cannot be triggered via pointer or keyboard in the current wiring and no live run was available.
