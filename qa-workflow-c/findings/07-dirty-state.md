# Agent 07 — Dirty-State Integration

**Repo:** `C:\Users\b1601\Template_Designer` (Windows)
**Baseline verified in-session:** `npm run typecheck` exit 0; `vitest run` → 6 files, **51/51 passed**.
**Method:** static read of `src/` + `tests/`, grep for persistence backends and direct-mutation escape hatches. No live UI run was available; anything requiring a browser click is marked UNVERIFIED, never claimed as observed.

## Scope & scenarios traced

Dirty flag is defined in one place — `InMemoryDocumentStore.refreshSnapshot()` compares `JSON.stringify(currentProject) !== JSON.stringify(savedProject)` (`src/Core/document-store.ts:121-129`). `save()` snapshots `savedProject = currentProject` (`:75-78`). All document content mutations flow through `EditorApplication.execute()` which refuses no-ops via `equalProject` (`src/Core/editor-application.ts:125-139`).

| # | Scenario | Core path exercised | Dirty expected |
|---|----------|--------------------|----------------|
| S1 | edit → dirty → save → clean → edit → dirty → undo → clean → redo → dirty | `execute` / `save` / `undo` / `redo` | matches serialize-compare |
| S2 | New Project while dirty | `createProject` → `store.create` → `open` | dirty silently discarded |
| S3 | drag preview only (no pointer-up commit) | `setGeometryPreview` (`:533-536`) | must stay clean |
| S4 | sub-threshold drag (< 4px) | `exceedsPointerDragThreshold` (`:686`) | must stay clean |
| S5 | simulator value/setting changes | `runtimeValues`/`runtimeSettings` (`:176-177`) | must stay clean |
| S6 | program Settings changes | `settingsDraft`/`savedSettings` (`:171-172`) | must stay clean |
| S7 | duplicate → dirty → undo → clean | `duplicateSelectionCommand` → `execute` | matches |
| S8 | tab switch while dirty | `openDocument`/`closeDocument` (`:383-395`) | dirty persists (single store) |
| S9 | Build & Verify / Validate / Simulator Run-Reset | `buildAndVerifyPackage` (`:322-343`), `validateProject` | must stay clean |

Confirmed invariant: **no mutation path bypasses the store.** Grep for `setProject`, `project.` field writes, `.push()`/`.splice()` on live project data found no escape hatch. The only `.push()`/`.splice()` on project-shaped data are inside `EditorApplication` mutations operating on clones (`editor-application.ts:170-183, 274-301`), and `canvas-interaction.updateWidgetGeometries` returns a new object (`:353-370`). `replaceCurrent` is called only from the store's own command callbacks (`document-store.ts:135-136`). Canvas preview (`geometryOverrides`, `:180`), simulator runtime (`:176-178`), and program settings (`:171-172`) are React `useState` held outside the store and never written into it — correct.

## Findings

### WC-07-01 — New Project silently discards dirty work; `confirmDestructive` is a dead setting
**Severity:** High · **Failure type:** dirty-state corruption (user work loss) + UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S2

**Repro steps:**
1. Add a Theme Project (document becomes dirty — chip shows "Unsaved changes").
2. Click "New Project" in the header (`:963`) or File menu (`:780`).
3. Observe: no confirmation, dirty work discarded, history cleared, chip flips to "Saved".

**Evidence:**
`src/App/App.tsx:230-241`
```ts
const createProject = () => {
  cancelCanvasInteraction();
  const nextProject = createEmptyProject("Untitled Project");
  documentStore.create(nextProject);      // unconditionally replaces current + clears history
  setSelection(null);
  setSelectedIds([]);
  setViewMode("design");
  setOpenDocuments(["Project Overview"]);
  setActiveDocument("Project Overview");
  clearGeometryPreview();
  logAction("New document created", "EVENT");
};
```
`src/Core/document-store.ts:59-66`
```ts
open(project: Project): void {
  this.currentProject = project;
  this.savedProject = project;
  this.runWithoutSnapshotRefresh(() => this.history.clear());
  this.refreshSnapshot();
}
create(project: Project): void { this.open(project); }
```
`src/App/App.tsx:171-172` (setting exists) and `:947` (only UI consumer)
```ts
const [settingsDraft, setSettingsDraft] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });
// ...
<input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={...} /> Confirm destructive commands
```
Grep for `confirmDestructive` returns **only** the two `useState` declarations and the settings checkbox — no consumer gates any command.

**Expected vs Actual:** A destructive action that discards unsaved work should consult `confirmDestructive` (or `documentSnapshot.isDirty`) and prompt. Actual: `createProject` never reads `isDirty` or `confirmDestructive`, so the toggle is cosmetic and dirty work is lost with zero warning.

**Recommended fix (design-level):** Gate `createProject` on `documentSnapshot.isDirty` when `savedSettings.confirmDestructive` is true and show a confirm dialog before `documentStore.create()`; otherwise remove the dead setting to avoid implying a guard exists.

---

### WC-07-02 — "Save"/"Saved"/"Clean" implies durable persistence; document is memory-only
**Severity:** Medium · **Failure type:** persistence mismatch + UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S1 (and every Save interaction)

**Repro steps:**
1. Edit → chip shows "Unsaved changes"; click Save → chip shows "Saved", menu Save disabled, footer "clean".
2. Reload the page / restart the app.
3. Observe: all content gone, app reopens a fresh empty project.

**Evidence:**
`src/Core/document-store.ts:75-78`
```ts
save(): void {
  this.savedProject = this.currentProject;   // in-memory reference only
  this.refreshSnapshot();
}
```
`src/App/App.tsx:782` (Save menu), `:963` (chip), `:986` (footer)
```ts
{ label: "Save", shortcut: "Ctrl+S", disabled: !documentSnapshot.isDirty, onClick: saveDocument },
// ...
<span className={`mode-chip ${documentSnapshot.isDirty ? "is-dirty" : "is-clean"}`}>{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}</span>
// ...
<span>{deploymentStatus} · Document: {documentSnapshot.isDirty ? "dirty" : "clean"} · Browser core · Tauri shell reserved</span>
```
Grep across `src/` and `src-tauri/` for `localStorage|sessionStorage|indexedDB|fetch(|FileReader|fs.|invoke(|readFile|writeFile|XMLHttpRequest` → **no matches**. `src-tauri/src/lib.rs` exposes only `app_version`; `tauri.conf.json` has `"bundle": { "active": false }`; `@tauri-apps/api` is a dependency never imported.

**Expected vs Actual:** A "Save"/"Saved"/"clean" state should survive reload or at least be labeled as a session snapshot. Actual: `savedProject` is a transient reference; nothing is written to storage, so "Saved" is UI-misleading (persistence mismatch).

**Recommended fix (design-level):** Either wire a real persistence adapter (browser `localStorage`/IndexedDB or a Tauri `fs` command) behind `save()`, or relabel the state (e.g. "Snapshot saved (session only)") until persistence exists.

---

### WC-07-03 — Tab dirty-indicator dot renders on the active tab regardless of `isDirty`
**Severity:** Low · **Failure type:** UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S8

**Repro steps:**
1. Open a clean project (no edits). The active "Project Overview" tab shows a warning-colored dot.
2. Make an edit, save, observe the dot still present on the (clean) active tab.

**Evidence:**
`src/App/App.tsx:966`
```tsx
{openDocuments.map((document) => <div key={document} className={`document-tab ${activeDocument === document ? "active" : ""}`} ...>
  <button type="button" className="document-tab-main" onClick={...}>
    <span className="document-tab-icon">▧</span><span>{document}</span>
    {activeDocument === document && <span className="dirty-indicator" title="Foundation project has local state" />}
  </button>
  ...
```
The indicator is gated only on `activeDocument === document`, never on `documentSnapshot.isDirty`. The tab note directly beside it (`Theme Project / Rotation documents · {documentSnapshot.isDirty ? "Dirty" : "Clean"}`) correctly reads the dirty flag, so the two UI elements disagree on a clean document.

**Expected vs Actual:** A dirty indicator should appear only when the document is dirty. Actual: it is a permanent "active tab" marker, misleading on a clean document.

**Recommended fix (design-level):** Render the dot only when `documentSnapshot.isDirty && activeDocument === document`, and make its tooltip read "Unsaved changes".

---

### WC-07-04 — "Add Rotation" enabled but silent no-op when display invalid or profile missing
**Severity:** Low · **Failure type:** UI misleading state + command mismatch · **Confidence:** CONFIRMED · **Scenario:** theme selected with invalid/missing DeviceProfile display

**Repro steps:**
1. Select a Theme Project (so `resolvedSelection?.theme` is set → menu enabled).
2. Ensure `activeProfile` is unavailable or `activeProfile.display` has width/height ≤ 0 / non-finite.
3. Click Theme → Add Rotation → nothing happens, no console entry.

**Evidence:**
`src/App/App.tsx:804` (enablement) vs `:256-262` (handler)
```ts
{ label: "Add Rotation", disabled: !resolvedSelection?.theme, onClick: addRotation },
// ...
const addRotation = (): boolean => {
  const themeId = resolvedSelection?.theme?.id;
  if (!themeId || !activeProfile) return false;          // silent early exit
  const result = editorApplication.addRotation(themeId, 0, activeProfile.display);
  if (result.changed) logAction("Rotation added", "EVENT");  // only logs on success
  return result.changed;
};
```
`src/Core/editor-application.ts:148-149`
```ts
addRotation(themeId: string, angle: RotationAngle = 0, display?: DeviceProfile["display"]): MutationResult {
  if (!display || !Number.isFinite(display.width) || !Number.isFinite(display.height) || display.width <= 0 || display.height <= 0) return { changed: false };
```
Menu enablement checks only `!resolvedSelection?.theme`; it does not check `activeProfile` validity or `display` validity. `addRotation` returns `false` silently (no `logAction`, no UI feedback).

**Expected vs Actual:** A menu item that cannot produce a change should be disabled, or produce feedback when it silently fails. Actual: enabled → silent no-op, no dirty, no feedback.

**Recommended fix (design-level):** Disable "Add Rotation" when `!activeProfile` or the profile display is invalid, or emit a WARN log on the `changed: false` path.

---

### WC-07-05 — Document tabs are cosmetic labels over a single store; close never clears dirty; stale tab survives node deletion
**Severity:** Low · **Failure type:** UI misleading state + stale state · **Confidence:** CONFIRMED · **Scenario:** S8 (plus delete of an open tab's theme/rotation)

**Repro steps:**
1. Select a Theme node → a tab opens (`openDocument`). Edit → dirty.
2. Click the tab's × to "close" it → the tab disappears, but the single store keeps the same document and the global "Dirty" note remains.
3. Alternatively, delete the Theme whose label opened a tab → the tab label remains, pointing at a deleted node.

**Evidence:**
`src/App/App.tsx:383-395`
```ts
const openDocument = (label: string) => {
  setOpenDocuments((current) => current.includes(label) ? current : [...current, label]);
  setActiveDocument(label);
  logAction(`${label} document active`);
};
const closeDocument = (label: string) => {
  if (openDocuments.length <= 1) return;
  const remaining = openDocuments.filter((document) => document !== label);
  setOpenDocuments(remaining);
  if (activeDocument === label) setActiveDocument(remaining[remaining.length - 1]);
  logAction(`${label} document closed`);
};
```
`src/App/App.tsx:414` (tabs open from navigation, not documents)
```ts
if (kind === "theme" || kind === "rotation") openDocument(node.label);
```
`src/App/App.tsx:272-283` (delete clears selection but not the open-document label)
```ts
const deleteSelectionCommand = (): boolean => { ... setSelection(null); setSelectedIds([]); ... }
```
The store is a single `InMemoryDocumentStore` (`:139-143`); `openDocuments`/`activeDocument` are independent labels. Closing a "tab" does not close/clear the document or its dirty state; deleting a theme/rotation leaves its tab label stale.

**Expected vs Actual:** Tabs present as multiple documents, but there is one document with one global dirty flag. This is internally consistent with single-document reality, but the multi-tab appearance (per-tab close, per-tab labels) misleads — including a global "Dirty" note while "documents" are individually closable.

**Recommended fix (design-level):** Either hide/disable tab close and relabel the surface as breadcrumbs/views, or implement real per-document stores and reconcile `openDocuments` on node deletion (remove labels whose nodes no longer resolve).

---

### WC-07-06 — Dirty detection is `JSON.stringify` deep-equality, duplicated and order/`undefined`-sensitive
**Severity:** Low · **Failure type:** dirty-state corruption (latent) + performance · **Confidence:** CONFIRMED (mechanism) / UNVERIFIED (actual divergence — deterministic construction currently masks it) · **Scenario:** S1, S7, S9

**Evidence:**
`src/Core/document-store.ts:26-28, 121-129`
```ts
function serialize(project: Project | undefined): string {
  return project ? JSON.stringify(project) : "";
}
// ...
private refreshSnapshot(): void {
  this.snapshot = {
    project: this.currentProject,
    isOpen: Boolean(this.currentProject),
    isDirty: serialize(this.currentProject) !== serialize(this.savedProject),
    history: this.history.snapshot,
  };
  this.listeners.forEach((listener) => listener());
}
```
`src/Core/editor-application.ts:9, 125-139`
```ts
function equalProject(left: Project, right: Project): boolean { return JSON.stringify(left) === JSON.stringify(right); }
// ...
const before = clone(current);
const after = mutation(clone(before));
if (equalProject(before, after)) return { changed: false };
this.documents.execute({
  label,
  execute: () => this.documents.replaceCurrent(clone(after)),
  undo: () => this.documents.replaceCurrent(clone(before)),
});
```

**Analysis:** Two independent `JSON.stringify` equality checks decide "dirty" and "no-op". `JSON.stringify` is key-order-sensitive and drops `undefined`-valued properties, so two semantically equal projects with different insertion order (or a field that only differs by `undefined`) would compare as changed, and vice versa. Today the risk is masked because every mutation is constructed deterministically (spread in fixed order) and the domain model has no `undefined`-valued fields; but any future external project (file open/import) with non-canonical key order would produce phantom-dirty or missed-dirty states. Additionally, each mutation performs `structuredClone(before)` + `clone(after)` + `clone(after)` again inside the command + two `JSON.stringify` calls (in `equalProject`) + two more in `refreshSnapshot` — O(project) repeated ~5× per mutation; acceptable at foundation scale but grows with project size.

**Expected vs Actual:** A structural deep-equality (or content-addressed baseline) would be order/`undefined`-insensitive. Actual: string equality on `JSON.stringify` is fragile and duplicated in two layers.

**Recommended fix (design-level):** Use a stable serialization (e.g. the existing `stableSerialize` in `src/Core/export.ts:19-24`) or a structural deep-equal for both `equalProject` and `serialize`, and drop the redundant double-clone in the `execute` command path.

---

### WC-07-07 — Advertised shortcuts Ctrl+S / Ctrl+Z / Ctrl+Y are not wired to any keyboard handler
**Severity:** Low · **Failure type:** command mismatch + UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S1 (Save/Undo/Redo via keyboard)

**Repro steps:**
1. Edit → press Ctrl+Z → nothing happens (undo not triggered).
2. Press Ctrl+S → nothing happens (no save).

**Evidence:**
`src/App/App.tsx:780-786` (menu labels) and `:955` (settings "Confirmed shortcuts")
```ts
{ label: "Save", shortcut: "Ctrl+S", disabled: !documentSnapshot.isDirty, onClick: saveDocument },
{ label: "Undo", shortcut: "Ctrl+Z", disabled: !commandHistory.canUndo, onClick: undo },
{ label: "Redo", shortcut: "Ctrl+Y", disabled: !commandHistory.canRedo, onClick: redo },
// ...
<span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span>
```
`src/App/App.tsx:715-746` — the only keydown handler (`handleCanvasKeyDown`) handles Escape, Ctrl+A, Delete/Backspace, and arrows; grep for `Ctrl+`/`keydown`/`addEventListener("keydown"` finds no Ctrl+S/Z/Y binding anywhere in `src/`.

**Expected vs Actual:** Shortcut labels should be functional. Actual: they are decorative, and the Settings dialog labels them "Confirmed shortcuts" — misleading relative to the Save/Undo/Redo affordances.

**Recommended fix (design-level):** Add a global keydown binding for Ctrl+S/Z/Y (respecting `isCanvasKeyboardExcludedTarget`) or remove the shortcut kbd labels until wired.

---

## Invariant check table

Legend: ✓ consistent, ✗ divergent/misleading, — not applicable.

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 edit→save→edit→undo→redo | ✓ immutable | ✓ (unchanged by save/undo) | ✓ cleared on commit | ✓ undo/redo stacks | ✓ serialize-compare | ✓ | ✓ | ✓ | ✓ |
| S2 New Project while dirty | ✗ silently replaced | ✓ reset | ✓ cleared (`:239`) | ✓ cleared (`open`) | ✗ dirty lost, no warning | ✓ | ✓ reset | ✗ selection reset | ✗ selection reset |
| S3 drag preview only | ✓ untouched | ✓ | ✓ overlay only | ✓ no command | ✓ stays clean | ✓ | ✓ | ✓ | ✓ |
| S4 sub-threshold drag | ✓ untouched | ✓ | ✓ cleared (`:699`) | ✓ no command | ✓ stays clean | ✓ | ✓ | ✓ | ✓ |
| S5 simulator value/setting | ✓ untouched | ✓ | ✓ | ✓ | ✓ stays clean | ✓ (runtime-driven) | ✓ | ✓ | ✓ |
| S6 program Settings change | ✓ untouched | ✓ | ✓ | ✓ | ✓ stays clean | ✓ | ✓ | ✓ | ✓ |
| S7 duplicate→undo→clean | ✓ | — (selection not auto-updated to copy) | ✓ | ✓ | ✓ dirty→clean | ✓ | ✓ | ✓ | ✓ |
| S8 tab switch/close while dirty | ✓ single store | ✓ | ✓ cleared on doc/scene change (`:754-758`) | ✓ | ✓ persists | ✓ | ✗ cosmetic tabs; close doesn't clear | ✓ | ✓ |
| S9 Build/Validate/Simulator Run-Reset | ✓ read-only | ✓ | ✓ | ✓ | ✓ stays clean | ✓ | ✓ | ✓ | ✓ |

Notes on table:
- **S7**: `duplicateSelectionCommand` (`:285-293`) does not move selection to the new copy — the original stays selected while the copy is created. Not a dirty-state bug, but the Properties/Explorer selection does not reflect the newly created node.
- **S2/S8**: the ✗ "dirty" and "tab" cells are the substance of WC-07-01 and WC-07-05.

## Summary (counts by severity)

- **High: 1** — WC-07-01 (New Project discards dirty work, `confirmDestructive` dead)
- **Medium: 1** — WC-07-02 (Save/Saved is memory-only, persistence misleading)
- **Low: 5** — WC-07-03 (tab dirty dot ignores `isDirty`), WC-07-04 (Add Rotation silent no-op enablement), WC-07-05 (cosmetic tabs + stale label), WC-07-06 (`JSON.stringify` deep-equality fragility/duplication), WC-07-07 (Ctrl+S/Z/Y shortcuts unwired)

**Top findings one-liners:**
1. **WC-07-01 (High):** `createProject` silently discards dirty work and the `confirmDestructive` setting has no consumer — data loss with zero warning.
2. **WC-07-02 (Medium):** `save()` only snapshots in memory; no storage backend exists, so "Save"/"Saved"/"clean" is a persistence mismatch.
3. **WC-07-03 (Low):** the tab `dirty-indicator` renders on the active tab regardless of `isDirty`, contradicting the adjacent "Clean/Dirty" note.
