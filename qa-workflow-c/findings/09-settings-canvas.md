# Agent 09 — Settings / Canvas Integration

Read-only static audit of the Settings↔Canvas interaction surface in `src/App/App.tsx` and `src/App/canvas-interaction.ts`. Baseline: `tsc` typecheck passes, vitest 51/51 passes (given; not re-run). No live UI run was available — every finding is static evidence only, marked CONFIRMED (proven by grep + code read) or UNVERIFIED (needs a live run).

## Scope & scenarios traced

| # | Scenario | Trace result (static) |
|---|----------|-----------------------|
| S1 | Change `snapGridSize` 10→20 → Apply → snap drag → nudge → undo → redo | `snapGridSize` derived once at `App.tsx:472` from `savedSettings.snapGridSize`, and is the *identical* value consumed at move-snap `:640`, resize-snap `:687`, and nudge `:740`. Fallback `DEFAULT_GRID_SIZE` at `:472`; `DEFAULT_SNAP_THRESHOLD` at `:640`/`:687`. No per-site divergence. |
| S2 | Change `showGrid` → Apply → grid visibility changes? | **No.** `savedSettings.showGrid` is never read anywhere. Grid is driven solely by `gridVisible` state (`:156`, toggled `:973`, applied `:974`). See WC-09-03. |
| S3 | Change `snapGridSize` → Cancel → still 10? | Cancel (`:989`) resets `settingsDraft` to `savedSettings` and closes; `savedSettings` untouched, so applied value stays 10. Draft reset is correct on Cancel/× but **not** on backdrop close (WC-09-05). |
| S4 | Backdrop close → reopen → draft kept? | **Yes, kept.** Backdrop `onClick` only does `setSettingsOpen(false)` (`:989`); draft is not reset, so uncommitted edits survive to the next open. See WC-09-05. |
| S5 | Settings during dirty document | Settings state is `useState` (`:171-172`) and never touches `documentStore`. No command is dispatched, so dirty state/history are unaffected. Benign (see invariant table). |
| S6 | Settings → simulator unaffected | Settings never write `runtimeValues`/`runtimeSettings`/`simulationStatus`; simulator panel (`:927-935`) reads only those. Benign. |
| S7 | Grid toggle vs settings `showGrid` conflict | Two independent sources: toolbar `gridVisible` (`:156/973`) vs settings `showGrid` (`:950`, never applied). Toggling the toolbar and "applying" the checkbox are disconnected — no sync, no conflict message. See WC-09-03. |
| S8 | Settings change mid-drag | Not reachable: pointer capture on canvas (`setPointerCapture`, `:519`) prevents clicking the Settings button while a drag is in progress, and there is no keyboard shortcut that opens Settings. Handlers are re-bound each render, so no stale `snapGridSize` closure would persist anyway. Low risk — no finding. |

## Findings

### WC-09-01 `confirmDestructive` is a dead setting — the checkbox does nothing (Medium · UI misleading state · CONFIRMED)
- **Scenario:** Open Settings → General, toggle "Confirm destructive commands" → Apply.
- **Repro steps:** Tools ▸ Program Settings → General → toggle checkbox → Save / Apply & Close → issue any destructive command (e.g. Delete).
- **Evidence:** `confirmDestructive` appears at exactly three sites, all write-only UI:
  - `src/App/App.tsx:171` — `const [settingsDraft, setSettingsDraft] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });`
  - `src/App/App.tsx:172` — `const [savedSettings, setSavedSettings] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });`
  - `src/App/App.tsx:947` — `<input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmDestructive: event.target.checked }))} /> Confirm destructive commands`
- **Expected vs Actual:** Expected a confirmation gate before destructive commands. Actual: `savedSettings.confirmDestructive` is never read; destructive commands (e.g. `deleteSelectionCommand` via `handleCanvasKeyDown` Delete/Backspace `:734-738`) run unconditionally.
- **Recommended fix (design-level):** Either wire a confirmation check into the destructive command paths or remove the control until implemented.

### WC-09-02 `compactDensity` is a dead setting — "Use compact panel density" does nothing (Medium · UI misleading state · CONFIRMED)
- **Scenario:** Open Settings → Appearance, toggle density → Apply.
- **Evidence:** `compactDensity` appears only at `App.tsx:171`, `App.tsx:172`, and the checkbox at `App.tsx:948`:
  - `:948` — `<input type="checkbox" checked={settingsDraft.compactDensity} onChange={(event) => setSettingsDraft((current) => ({ ...current, compactDensity: event.target.checked }))} /> Use compact panel density`
- **Expected vs Actual:** Expected panel/layout density to change. Actual: no consumer reads `savedSettings.compactDensity`; no CSS class is toggled. Grep across `src/` confirms the identifier is absent outside the settings state + checkbox.
- **Recommended fix:** Apply a density class to the workspace/pandels from the value, or remove the control.

### WC-09-03 `showGrid` ("Show grid by default") is a pure no-op; toolbar grid and settings grid are disconnected (High · UI misleading state / state divergence · CONFIRMED)
- **Scenario:** S2/S7 — toggle the "Show grid by default" checkbox, Apply, and observe grid; separately toggle the toolbar Grid button.
- **Evidence:**
  - `savedSettings.showGrid` is never read. Grep shows `showGrid` only at `App.tsx:171`, `App.tsx:172`, and the checkbox at `App.tsx:950`:
    - `:950` — `<input type="checkbox" checked={settingsDraft.showGrid} onChange={(event) => setSettingsDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> Show grid by default`
  - The actual grid is driven by a different state and toggle:
    - `:156` — `const [gridVisible, setGridVisible] = useState(true);`
    - `:973` — `<button ... className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button>`
    - `:974` — `<div className={`canvas-stage ${gridVisible ? "show-grid" : ""} ...`}>`
    - `:986` — status bar reports `... · {gridVisible ? "Grid on" : "Grid off"}`.
- **Expected vs Actual:** The checkbox is labelled "Show grid **by default**", implying a persisted default applied on next start. Actual: there is no restart-load (no `localStorage`/`sessionStorage`, see WC-09-04) and `savedSettings.showGrid` is never read, so the checkbox changes nothing at any time. The two controls (toolbar `gridVisible`, settings `showGrid`) silently diverge with no cross-sync and no conflict indication.
- **Recommended fix:** Bind the toolbar/`gridVisible` to the same source (make `showGrid` the initializer/authority and keep them in sync), or remove the checkbox and rely solely on the toolbar toggle.

### WC-09-04 Settings are not persisted; "Save / Apply & Close" wording is misleading (Medium · persistence mismatch / UI misleading state · CONFIRMED)
- **Scenario:** Change any setting → Save → reload the app.
- **Evidence:**
  - Grep for `localStorage|sessionStorage` across `src/` → **no matches**.
  - `:171-172` — both `settingsDraft` and `savedSettings` are `useState` initialized to hard-coded constants (`compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE`), so every reload re-initializes.
  - `:989` — the primary button reads `Save / Apply &amp; Close` and calls `setSavedSettings(settingsDraft)` + `logAction("Program Settings saved")`.
- **Expected vs Actual:** "Save" implies durable persistence. Actual: the value lives only in component state and is lost on reload; the console entry "Program Settings saved" reinforces the false impression. ("Apply & Close" is accurate; "Save" is not.)
- **Recommended fix:** Persist to `localStorage` (or a platform store) and hydrate on mount, or rename the button to "Apply & Close".

### WC-09-05 Backdrop click closes Settings without resetting the draft → stale uncommitted edits survive to the next open (Medium · stale state / UI misleading state · CONFIRMED)
- **Scenario:** S4 — edit `snapGridSize` to 20 (do not Save/Cancel), click the backdrop, reopen Settings.
- **Evidence:** `src/App/App.tsx:989`
  - Backdrop: `onClick={() => setSettingsOpen(false)}` (no draft reset).
  - × button: `onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}` (resets).
  - Cancel button: `onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}` (resets).
  - Apply button: `onClick={() => { setSavedSettings(settingsDraft); setSettingsOpen(false); logAction("Program Settings saved"); }}`.
- **Expected vs Actual:** A backdrop/Escape dismissal is conventionally a cancel; the user reasonably expects the draft discarded. Actual: draft edits are silently retained (not applied — `savedSettings` unchanged), so the next open shows a stale value (e.g. "20") that is **not** the active value (still 10). The inconsistency between ×/Cancel (reset) and backdrop (keep) is misleading.
- **Recommended fix:** Make backdrop dismissal call the same reset path as Cancel, or introduce an explicit "draft persisted until Apply" model and surface it (e.g. a "discard" affordance).

### WC-09-06 "Shortcuts" category advertises non-functional shortcuts (Ctrl+S, Ctrl+Z, R 90° rotation) (Medium · command mismatch / UI misleading state · CONFIRMED)
- **Scenario:** Open Settings → Shortcuts, then press Ctrl+S / Ctrl+Z / R.
- **Evidence:**
  - `src/App/App.tsx:955` — `Shortcuts: <><h3>Shortcuts</h3><p>Confirmed shortcuts are shown by the command registry; Proposed shortcuts are not presented as settled product behavior.</p><div className="shortcut-list"><span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span></div></>`
  - The only canvas key handler is `handleCanvasKeyDown` (`:715-746`), which handles `Escape`, `Ctrl+A`, `Delete`/`Backspace`, and `Arrow*` only. There is no branch for `s`, `z`, or `r`.
  - The command registry `src/App/editor-commands.ts` declares a `shortcut` only for Delete (`:37` — `shortcut: "Delete"`). No widget/rotation `rotate` command exists anywhere (grep `rotate|90|Rotate` across `src/` returns only `RotationAngle`/`supportedRotations`/validation angle lists and the `addRotation` form-add, none of which is a "90° rotation" shortcut).
- **Expected vs Actual:** The page asserts "Confirmed shortcuts are shown by the command registry" yet lists Ctrl+S/Ctrl+Z/R which are **not** in the registry and have no key binding (the `menuItems` at `:782`/`:785` display these as `<kbd>` labels but only trigger via `onClick`). Pressing them does nothing. "R 90° rotation" references a command that does not exist.
- **Recommended fix:** Remove unbound shortcuts from the list (or add real `keydown` bindings + a rotate command), and make the list derive from the actual registry to stay consistent.

### WC-09-07 Canvas category copy contradicts the behavior of "Snap grid size" (Low · UI misleading state / copy mismatch · CONFIRMED)
- **Scenario:** Read the Canvas category description, then change `snapGridSize` and observe snap/nudge behavior.
- **Evidence:**
  - `src/App/App.tsx:950` — `<p>Canvas preferences are application UI defaults and do not change runtime semantics.</p>` … `<span>Snap grid size</span>`.
  - But `snapGridSize` flows into editor behavior, not just UI: `:472` derivation → `:640` move-snap, `:687` resize-snap, `:740` nudge.
- **Expected vs Actual:** "UI defaults … do not change runtime semantics" is defensible for the visual grid, but "Snap grid size" changes move/resize snapping and arrow-key nudge step — editor semantics. The copy understates the control's effect (a user may not realize the value affects geometry operations).
- **Recommended fix:** Reword to note that "Snap grid size" affects snapping and nudge in the editor, and that `showGrid` is a visual default (once WC-09-03 is fixed).

### WC-09-08 Visual grid is hard-coded 18px and does not track `snapGridSize` (Low · state divergence / UI misleading state · CONFIRMED)
- **Scenario:** Set `snapGridSize` to 20 → Apply → compare the drawn grid spacing to the snap step.
- **Evidence:**
  - `src/App/app.css:116` — `.canvas-stage.show-grid { background-image: linear-gradient(...), linear-gradient(90deg, ...); background-size: 18px 18px; }`
  - `src/App/canvas-interaction.ts:73` — `export const DEFAULT_GRID_SIZE = 10;`
- **Expected vs Actual:** The "Snap grid size" label implies the drawn grid matches the snap increment. Actual: the grid is a fixed 18px (mismatched even against the default snap of 10), and changing `snapGridSize` moves the snap/nudge step but never redraws the grid. The visible grid can therefore disagree with the snap positions.
- **Recommended fix:** Drive `background-size` from `snapGridSize` (in canvas pixels, accounting for zoom) or clearly separate "visual grid spacing" from "snap grid size".

### WC-09-09 Settings dialog has no Escape-close, no focus trap, no autofocus (Medium · UI misleading state / accessibility · CONFIRMED)
- **Scenario:** Open Settings, press Escape, or Tab-past the last control.
- **Evidence:**
  - `src/App/App.tsx:959` — the shell owns the only keydown handler: `<div className="app-shell" onClick={...} onKeyDown={handleCanvasKeyDown}>`.
  - `src/App/App.tsx:719-724` — `if (event.key === "Escape") { if (canvasPointer.mode !== "idle") { event.preventDefault(); cancelCanvasInteraction(); } return; }` — when no drag is active, Escape is a no-op, so it does **not** close the dialog.
  - `src/App/App.tsx:989` — `<section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}>` — no `onKeyDown`, no `autoFocus`, no focus management.
  - No `autoFocus`/`autofocus` anywhere in the settings tree.
- **Expected vs Actual:** A modal dialog (`aria-modal="true"`) should trap focus, auto-focus an initial control, and close on Escape. Actual: Escape is ignored (settings stays open), focus is not trapped (Tab can leave into the background app), and initial focus is unspecified.
- **Recommended fix:** Add an Escape handler scoped to the dialog, a focus trap, and initial focus on the dialog (or first field).

## Invariant check table

Dimensions: Doc = Document model, Sel = Selection, Prev = Canvas preview, Hist = History, Dirty = Dirty state, Scene = Active Scene, DocTab = Active document, Expl = Explorer selection, Prop = Properties selection.

| Scenario | Doc | Sel | Prev | Hist | Dirty | Scene | DocTab | Expl | Prop | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| S1 snapGridSize 10→20 → snap/nudge/undo/redo | geometry changes via Move/Nudge commands (`:544/697/745`) | preserved (no selection write) | preview cleared on commit (`:547`) | Move/Nudge + undo/redo entries (`:697`,`:745`) | becomes dirty after geometry commit | unchanged (commit scoped to `activeScene?.id`) | unchanged | unchanged | unchanged | UNVERIFIED (runtime snap/undo; code path CONFIRMED) |
| S2 showGrid → Apply | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | CONFIRMED (no-op — WC-09-03) |
| S3 snapGridSize → Cancel | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | CONFIRMED (draft reset `:989`) |
| S4 backdrop close → reopen | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | CONFIRMED (draft kept — WC-09-05) |
| S5 settings during dirty document | unchanged | unchanged | unchanged | unchanged | dirty state preserved (no store write) | unchanged | unchanged | unchanged | unchanged | CONFIRMED (benign) |
| S6 settings → simulator | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | CONFIRMED (benign) |
| S7 grid toggle vs showGrid | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged | CONFIRMED (divergence — WC-09-03) |

## Summary

- **High:** 1 — WC-09-03 (`showGrid` checkbox is a no-op; toolbar/settings grid disconnected).
- **Medium:** 6 — WC-09-01, WC-09-02 (dead `confirmDestructive`/`compactDensity`), WC-09-04 (no persistence + "Save" wording), WC-09-05 (backdrop keeps stale draft), WC-09-06 (non-functional advertised shortcuts), WC-09-09 (no Escape/focus trap).
- **Low:** 2 — WC-09-07 (copy mismatch), WC-09-08 (visual grid 18px ≠ `snapGridSize`).
- **Benign/not-a-finding:** single source of truth for `snapGridSize` is consistent across move/resize/nudge (S1); settings do not dirty the document or enter history (S5); settings→simulator unaffected (S6); mid-drag settings change unreachable (S8).

Counts by severity: **1 High, 6 Medium, 2 Low, 0 Info/Critical.**
