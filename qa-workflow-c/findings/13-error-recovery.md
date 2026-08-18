# Agent 13 — Error Recovery Integration

Read-only static QA of error-recovery / invalid-input / exceptional-flow behavior in Template Designer.
Baseline: typecheck passes; vitest 51/51 passes (per delegation). No live browser run is available, so UI-behavior claims that depend on React's controlled-input DOM reconciliation or pointer-event delivery are marked accordingly.

Confidence legend:
- **CONFIRMED** — statically provable from source (control/data flow only).
- **UNVERIFIED** — depends on runtime behavior (browser/React event delivery) that could not be exercised live; reasoning is given but the claim is not runtime-proven.

---

## Scope & scenarios traced

| # | Scenario | Path traced | Result |
|---|----------|-------------|--------|
| S1 | Clear X/Y geometry field | `App.tsx:910` → `commitSelectionGeometryField` `App.tsx:867-886` | Commits `0` (see WC-13-1) |
| S2 | Type "abc" in X | `type="number"` `App.tsx:910` | Not reachable via number input (letters sanitized to `""`) — see WC-13-3 note |
| S3 | Type -50 in width | `App.tsx:878` `Math.max(10, -50)` | Commits `10` (see WC-13-4) |
| S4 | Type 1e12 in X | `App.tsx:878` + `editor-application.ts:11-18` | Commits `1e12`; widget off-canvas (see WC-13-2) |
| S5 | Type 1e999 in X (overflow→Infinity) | `App.tsx:878` + `editor-application.ts:11-18` | Silently rejected; stale text (see WC-13-3) |
| S6 | Delete last scene of a rotation | `deleteSelection` `App.tsx:272-283`; fallback `App.tsx:464-466` | No crash; empty canvas (verified safe) |
| S7 | Delete ALL rotations | fallback `App.tsx:464-469`, frame `App.tsx:487-492` | No crash; frame fallback `inset:0` (verified safe) |
| S8 | Delete ALL theme projects / last group | `addThemeProject` `App.tsx:248-254`, menu `App.tsx:803` | Dead-end; menu no-ops (see WC-13-5) |
| S9 | Delete last group → validate/build | `validation.ts:282-322`, `export.ts:131-182` | Empty project validates + builds (see WC-13-6) |
| S10 | Undo after each delete | memo `App.tsx:192` deps `[project, activeProfile]` | Validation recomputes (verified safe) |
| S11 | Drag then capture loss without pointercancel | `App.tsx:517-527`, listeners `App.tsx:374-380/510/750`, `App.tsx:974` | Stranded drag mode (see WC-13-8) |
| S12 | Failed build → retry | `buildAndVerifyPackage` `App.tsx:322-343` | Logs error; status resets on retry (verified safe) |
| S13 | Binding modal after widget delete | `App.tsx:204`, fallback `App.tsx:988` | Graceful "Unknown" fallback (verified safe) |

---

## Findings

### WC-13-1 Clearing a geometry field commits 0 (or 10) instead of being a no-op
**Severity:** Medium · **Failure types:** command mismatch, UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S1

**Repro:** Select a widget; focus the X field; select-all + Delete (clear the field). The field is `type="number"`, so an emptied field yields `event.target.value === ""`, and `Number("") === 0`.

**Evidence:**
- `src/App/App.tsx:910` — `onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))}`
- `src/App/App.tsx:878` — `updates[id] = { ...canonicalGeometry(widget), [field]: Math.max(field === "width" || field === "height" ? 10 : 0, value) };`

**Expected vs Actual:** Clearing a field should either be ignored (no commit) or produce an explicit "invalid/empty" state. Actual: clearing X/Y commits `x=0` / `y=0`; clearing W/H commits `10` (via `Math.max(10, 0)`). The widget jumps position (X/Y) or snaps to minimum size (W/H) with no indication that the clear was reinterpreted as a numeric zero/ten.

**Recovery:** Recoverable via Undo (the commit is pushed to history), but the user must notice the jump. No confirmation or warning is logged.

**Recommended fix:** Detect empty/invalid input *before* coercing: in `commitSelectionGeometryField`, treat `event.target.value.trim() === ""` (or `Number.isNaN`) as "reject without commit" and reset the controlled field, instead of `Number("") → 0`. Alternatively compute on a derived "draft" state so the field can be empty without committing.

---

### WC-13-2 No upper clamp on x/y — huge finite values commit and push the widget off-canvas
**Severity:** Medium · **Failure types:** stale preview, UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S4

**Repro:** Select a widget; type `1e12` in X. `Number("1e12") = 1e12` (finite), `Math.max(0, 1e12) = 1e12`.

**Evidence:**
- `src/App/App.tsx:878` — `Math.max(field === "width" || field === "height" ? 10 : 0, value)` (clamps low end only; no upper bound for x/y).
- `src/Core/editor-application.ts:11-18` — `isValidGeometry` accepts any `Number.isFinite` value; only `width > 0` and `height > 0` are enforced (x/y may be any finite number, no scene-bounds check).
- `src/App/App.tsx:773` — `left: \`${(geometry.x / canvasWidth) * 100}%\`` (x = 1e12 / 720 → ~1.4e11% → far outside the device frame).

**Expected vs Actual:** x/y should be clamped to the rotation/scene bounds (like the canvas drag path), or rejected. Actual: the commit succeeds, and the widget is rendered far off-canvas with no way to recover it by clicking on the canvas.

**Recovery:** Recoverable only via the Explorer tree (the widget node still lists and can be selected to re-edit X) or Undo. There is no canvas affordance to reach the widget.

**Recommended fix:** Add an upper clamp for x/y (e.g., `sceneWidth - width` / `sceneHeight - height`), consistent with the drag/resize path, or validate against scene dimensions in `isValidGeometry`.

---

### WC-13-3 Overflow (Infinity) is silently rejected, leaving stale input text in the field
**Severity:** Medium · **Failure types:** stale state, UI misleading state · **Confidence:** CONFIRMED (static; React controlled-input reconciliation is documented behavior) · **Scenario:** S5

**Repro:** Select a widget; type `1e999` in X (a valid float-string the number input accepts). `Number("1e999") === Infinity`.

**Evidence:**
- `src/App/App.tsx:910` — `value={... canonicalGeometry(widget).x ...}` (controlled input).
- `src/App/App.tsx:878` — `Math.max(0, Infinity) === Infinity`; `updates[id] = { ...canonicalGeometry(widget), x: Infinity }`.
- `src/Core/editor-application.ts:200` — `setWidgetGeometriesInScene` → `ids.every((id) => isValidGeometry(updates[id]))`; `isValidGeometry` (lines 15-17) requires `Number.isFinite(candidate[key])` → `Infinity` fails → returns `{ changed: false }`.
- `src/App/App.tsx:884-885` — `if (result.changed) logAction(...)` — on `changed: false`, no state update, no re-render.

**Expected vs Actual:** The commit is safely blocked (model unchanged — good), but because no state changed there is no re-render, so React does not reset the controlled `value`. The DOM input keeps showing `1e999` while the model still holds the old value. The stale text persists until an unrelated re-render changes the `value` prop (e.g., selecting another widget, undo, a canvas edit).

**Note on "abc"/NaN:** the mission's `Number("abc") → NaN` path is **not reachable** through this exact input, because `App.tsx:910` renders `type="number"` (single selection) — the browser sanitizes non-numeric text (e.g., `abc`, `-`, `.`) to an empty string, so `Number("") === 0`, not `NaN`. The reachable non-finite variant is overflow → `Infinity`, traced above. `Number("1e999") → Infinity` exercises the identical "silent reject + stale text" control-flow gap.

**Recommended fix:** In `commitSelectionGeometryField`, when `!Number.isFinite(value)` (or when `Number.isNaN`), log a WARN and force a controlled reset of the field (e.g., bump a local "field revision" state keyed to the widget id, or reject + `setState` on an editable-draft layer) so the input snaps back to the canonical value immediately instead of showing stale text.

---

### WC-13-4 Negative width/height are silently clamped to 10 (misleading command)
**Severity:** Low · **Failure types:** command mismatch, UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S3

**Repro:** Select a widget; type `-50` in Width (or Height). `Number("-50") === -50`.

**Evidence:**
- `src/App/App.tsx:878` — `Math.max(field === "width" || field === "height" ? 10 : 0, -50) === 10`.

**Expected vs Actual:** The user types `-50`; the command silently commits `10` — a value different from what was typed, with no warning that the input was clamped. (The same low-end clamp silently maps a negative x/y to `0`.) This is misleading: the field displays `10` after commit, so the user's `-50` vanishes with no explanation.

**Recovery:** Undo restores the prior geometry; no data corruption.

**Recommended fix:** Surface a warning when a value is clamped (log a WARN via `logAction`), or reject non-positive width/height and reset the field, rather than silently substituting `10`/`0`.

---

### WC-13-5 Deleting the last Theme Project Group leaves "Add Theme Project" enabled but a silent no-op, with no "Add Group" command
**Severity:** High · **Failure types:** UI misleading state, state divergence · **Confidence:** CONFIRMED · **Scenario:** S8

**Repro:** Select the root Theme Project Group node in the Explorer and delete it (`deleteSelection` filters the group). `project.themeProjectGroups` becomes `[]`, so `group = groups[0]` is `undefined`.

**Evidence:**
- `src/Core/editor-application.ts:225-226` — `themeProjectGroups: project.themeProjectGroups.filter((group) => !selected.has(group.id))` (a selected group is removed).
- `src/App/App.tsx:194` — `const group = groups[0];` (→ `undefined` when empty).
- `src/App/App.tsx:249-250` — `const groupId = resolvedSelection?.group?.id ?? group?.id; if (!groupId) return false;`
- `src/App/App.tsx:803` — `{ label: "Add Theme Project", onClick: addThemeProject },` (no `disabled` condition — always enabled).
- `src/App/editor-commands.ts:29-39` — the command registry has `project.add-theme-project` (needs a group) but **no** command to add a Theme Project Group; `createEmptyThemeProjectGroup()` (`src/Domain/factories.ts:18-24`) is never invoked from the UI.

**Expected vs Actual:** With no group, "Add Theme Project" should be disabled or the app should offer "Add Theme Project Group". Actual: the menu item stays enabled, clicking it returns `false` silently (no `logAction`, because `addThemeProject` only logs on `result.changed`), and the Explorer shows only `Project > [Resources, Unsupported Files]`. The user has no in-UI path to create a group.

**Recovery:** Only Undo (restores the deleted group) or **New Project** (`App.tsx:780`) recovers the editing workflow. No crash, but the primary "add content" workflow is a dead-end.

**Recommended fix:** Add a disabled condition to "Add Theme Project" when no group exists, and either add an "Add Theme Project Group" command or make `addThemeProject` auto-create a group when `groups` is empty (or seed a fallback group).

---

### WC-13-6 A project with no Theme Projects (or no groups) still validates and builds a "verified" empty package
**Severity:** Medium · **Failure types:** persistence mismatch, UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S9

**Repro:** Delete every Theme Project (or the last group) and run "Build & Verify Package".

**Evidence:**
- `src/Core/validation.ts:282-322` — `validateProject` has no minimum-content rule: it validates each `themeProjectGroups[].themeProjects[]` that exists. A project with `themeProjectGroups: []` (or a single group with `themeProjects: []`) produces **no** issues, so `valid === true`.
- `src/Core/export.ts:131-182` — `buildDeploymentPackage` → `themes = project.themeProjectGroups.flatMap((g) => g.themeProjects)` (empty) → manifest with empty `themeProjectIds`/`assetIds` and a single `manifest.json` file → checksum → returns a package.
- `src/App/App.tsx:337-338` — `verified.verified ? "Verified package" : ...`, logged `Package verified · 0 asset(s)`.

**Expected vs Actual:** A contentless project should be flagged (e.g., "at least one Theme Project is required") and block the build. Actual: it validates clean and reports a "Verified package" with zero themes — a deployment package that carries no theme/layout data. This is misleading "publish readiness" feedback.

**Note:** The only structural rule present is `REQUIRED_ROTATIONS_MISSING` (`validation.ts:254-255`, "exactly 4 rotations") — but it runs *only when a Theme Project exists*, so a theme with zero rotations errors while a project with zero themes does not.

**Recommended fix:** Add a validation rule requiring at least one Theme Project (and at least one Scene), emitted as an error, so an empty/partial project cannot reach "Verified package".

---

### WC-13-7 The validation severity taxonomy (info/warning/error) is defined but only "error" is ever emitted
**Severity:** Low · **Failure types:** UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S9/S10 (general)

**Evidence:**
- `src/Core/validation.ts:15` — `export type ValidationSeverity = "info" | "warning" | "error";`
- `src/Core/validation.ts:36` — `severity: ValidationSeverity = "error",` (default param).
- `src/Core/validation.ts:30-39` — `issue(...)` is invoked with only 5 arguments at every call site (no `severity` override anywhere in the file), so every emitted issue is `"error"`.
- `src/Core/validation.ts:305` and `:319` — `valid: issues.every((current) => current.severity !== "error")`.

**Expected vs Actual:** The model supports graduated severity, but the implementation never distinguishes blocking errors from warnings/info. Consequence: `validation.valid` is all-or-nothing — any issue (including a cosmetic empty-name or empty-source-path on an unused asset) blocks build (`App.tsx:328-331`). This undermines "fail soft" recoverability: there is no "warnings only, still buildable" state.

**Recovery:** N/A (not a crash); purely a granularity gap.

**Recommended fix:** Assign non-blocking severities to issues that should not block export (e.g., unused-asset source-path/name concerns), and keep `valid` keyed to `error` only (the current predicate already does this correctly once severities are diversified).

---

### WC-13-8 A pointer-capture failure can strand the canvas in "drag/resize" mode (no window-level pointerup fallback)
**Severity:** Medium · **Failure types:** stale state, stale preview · **Confidence:** CONFIRMED (static); runtime trigger is UNVERIFIED (requires `setPointerCapture` to throw) · **Scenario:** S11

**Repro:** Begin a widget drag. If `setPointerCapture` throws (e.g., invalid pointerId, element detached, browser cancellation), the drag proceeds without capture; for a mouse (no implicit capture) the subsequent `pointerup` outside the canvas is never delivered to `device-screen`.

**Evidence:**
- `src/App/App.tsx:517-520` — `captureCanvasPointer`: `try { canvasScreenRef.current?.setPointerCapture(pointerId); } catch { /* Pointer capture can fail after browser cancellation. */ }` (swallows failure and continues).
- `src/App/App.tsx:662-664` — `handleCanvasPointerUp` runs only on `device-screen`'s `onPointerUp` (`App.tsx:974`); it returns early unless `canvasPointer.mode !== "idle"` and the pointerId matches.
- `src/App/App.tsx:974` — `device-screen` registers `onPointerCancel` and `onLostPointerCapture` → `handleCanvasPointerCancel`, but `onLostPointerCapture` only fires if capture was actually established; if `setPointerCapture` threw, no `lostpointercapture` event is emitted.
- Window-level listeners are limited to the resize splitter's `pointermove`/`pointerup` (`App.tsx:374-380`), `resize` (`App.tsx:510`), and `blur` (`App.tsx:750`) — confirmed by grep: **no** window-level `pointerup` fallback for the canvas.

**Expected vs Actual:** A drag whose capture is lost without `pointercancel` can leave `canvasPointer.mode` stuck at `"drag"`/`"resize"` until the next matching pointer event, Escape, or window blur. While stuck, the geometry inputs are disabled (`App.tsx:910` `disabled={canvasPointer.mode !== "idle" ...}`) and the widget sits at its preview geometry (`geometryOverrides`) without being committed.

**Recovery:** Escape (`App.tsx:719-725` → `cancelCanvasInteraction`) or window blur (`App.tsx:750`) clears the interaction and restores the widget. No data corruption, but the state is stale and the preview is misleading until then.

**Recommended fix:** Register a window-level `pointerup`/`pointercancel` fallback while a drag is active (mirroring `beginResize`'s window listeners at `App.tsx:374-380`), and/or have `captureCanvasPointer` return a boolean that, when false, falls back to the window-level listeners.

---

### WC-13-9 No ErrorBoundary — any render-phase throw unmounts the whole tree (white screen)
**Severity:** Medium · **Failure types:** state divergence (full-tree loss) · **Confidence:** CONFIRMED (static) · **Scenario:** general

**Evidence:**
- `src/main.tsx:10-13` — `createRoot(document.getElementById("root")!).render(<StrictMode><App profileRegistry={profileRegistry} /></StrictMode>);` — no error boundary wrapping `App`.
- `index.html:10` — `<div id="root"></div>` is the only mount target.
- grep for `ErrorBoundary|componentDidCatch|getDerivedStateFromError` across `src/` returns no matches (only `ApplicationError` in `src/Core/application.ts` and `src/Infrastructure/sd-card-target.ts`, which are not UI boundaries).

**Expected vs Actual:** With React 18/19, an uncaught error during render unmounts the entire component tree, leaving a blank `#root` (white screen) with no fallback UI or recovery path. Event-handler throws propagate to `window` (uncaught in console) and are likewise unhandled. `documentStore.execute`'s `try/finally` (`document-store.ts:88-92`) does **not** catch — a throwing command propagates to the caller (see "Command atomicity", below).

**Recovery:** None in-app (manual page reload only). No known *current* render-crash path was found in the traced flows (zero-groups, deleted binding widget, empty scenes all render safely), so this is a latent robustness gap rather than an active bug.

**Recommended fix:** Wrap `<App/>` in a React error boundary that renders a recovery card (with "reload"/"reset" affordance) instead of a white screen.

---

### WC-13-10 Validation console list uses `issue.code` as React key (duplicate keys for repeated issues)
**Severity:** Low · **Failure types:** UI misleading state · **Confidence:** CONFIRMED · **Scenario:** S9 (two widgets with the same issue)

**Evidence:**
- `src/App/App.tsx:940` — `{validation.issues.map((issue) => <div className="console-entry" key={issue.code}>...)}`

**Expected vs Actual:** Issue codes are not unique across instances (e.g., two widgets both failing `INVALID_WIDGET_GEOMETRY` produce the same `code`). Duplicate React keys cause a React reconciliation warning and can produce incorrect list rendering (e.g., two same-key entries) when the issue list changes. The validation *count* (tab badge, `App.tsx:940`) and the status bar (`App.tsx:986`) remain correct, but the per-issue list can render unreliably.

**Recommended fix:** Key by a stable composite (e.g., `${issue.code}-${issue.path}` or an index) so repeated codes render as distinct entries.

---

## Verified-safe behaviors (not findings, but explicitly audited)

- **Command atomicity (history/dirty consistency):** `CommandHistory.execute` (`src/Core/commands.ts:33-38`) runs `command.execute(); this.undoStack.push(command); this.redoStack.length = 0; this.emit();`. A throw in `command.execute()` skips `push`/`redoStack` clear/`emit`, leaving both stacks untouched. In the single-threaded React flow this is sound: `EditorApplication.execute` (`editor-application.ts:125-139`) computes the mutation on a **clone** first, compares with `equalProject`, and only then calls `documents.execute`; the only throw inside `command.execute()` is `replaceCurrent`'s `"No document is open"` guard (`document-store.ts:81`), which fires **before** mutating `currentProject`. A failed command therefore preserves the redo stack (a correct semantic — a failed command should not discard redo history), and undo/redo remain consistent. `document-store.execute`'s `try/finally` (`88-92`) guarantees a single snapshot refresh per command.
- **Delete last scene of a rotation:** selection cleared (`App.tsx:279-280`); `activeScene` fallback (`App.tsx:465`) → `runtime.activeScene ?? activeRotation?.scenes[0]` → `undefined`; `canvasWidgets=[]` (`:466`); `canvasAvailable` stays true (rotation exists) → empty canvas, no crash.
- **Delete ALL rotations:** `activeRotation` undefined (`:464`), `canvasAvailable` false (`:469`), frame falls back to `inset:0` (`:492`), `renderCanvasWidget`/snapGuides/selectionBounds guarded by `canvasAvailable` (`:974`) → no crash.
- **Binding modal after widget delete:** `bindingWidget` resolves to `undefined` (`App.tsx:204`) and the modal header/body fall back to `"Widget"` / `"Unknown"` / empty-state (`App.tsx:988`) → no crash.
- **Cross-scene geometry edits blocked:** `commitSelectionGeometryField` (`App.tsx:868-873`) verifies all selected ids resolve to a single scene that equals `activeScene?.id`, preventing wrong-scene mutation; mixed-scene selections are rejected with a WARN.
- **Build/export failures log the message:** `App.tsx:339-341` catches, sets `"Blocked · export error"`, and `logAction(error.message)`; verification failure sets `"Blocked · integrity failed"` (`:337`); no-profile and validation-failed paths also set a status and log (`:323-331`). Deployment status state (`:179`) is consistent; no SD-card adapter is wired (V1 gap outside this agent's scope).
- **Validation recomputes on undo/redo:** the memo `validateProject(project, activeProfile)` (`App.tsx:192`) depends on `project` (a fresh snapshot object after each `refreshSnapshot`) and `activeProfile` (stable reference from the registry map), so it recomputes after any command/undo/redo.
- **Unknown deviceProfileId / missing profile:** `activeProfile` undefined → `runtime` short-circuits to `{ activeSceneId: undefined, activeScene: undefined, candidates: [] }` (`App.tsx:202`), `canvasAvailable` false (`:469`), `canvasWidth/Height` fall back to `1` (`:467-468`) → no crash; `buildAndVerifyPackage` guards `!activeProfile` (`:323`).

---

## Invariant check table

Legend: ✓ consistent · ⚠ diverges/misleading · — n/a (no crash)

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active doc | Explorer sel | Properties sel |
|----------|----------|-----------|----------------|---------|-------------|--------------|------------|--------------|----------------|
| S1 clear X/Y → commit 0/10 | ⚠ committed (unintended) | ✓ | ⚠ widget jumps | ✓ undoable | ✓ | ✓ | ✓ | ✓ | ⚠ field shows 0/10 |
| S3 -50 width → commit 10 | ⚠ clamped | ✓ | ⚠ resized to 10 | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ shows 10 |
| S4 1e12 X | ⚠ off-canvas widget | ✓ | ⚠ widget invisible | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ shows 1e12 |
| S5 1e999 X (Infinity) | ✓ unchanged | ✓ | ✓ unchanged | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ stale "1e999" text |
| S6 delete last scene | ✓ | ✓ (cleared) | ✓ empty | ✓ | ✓ | ⚠ undefined (safe) | ✓ | ✓ | ✓ (empty state) |
| S7 delete all rotations | ✓ | ✓ | ✓ frame fallback | ✓ | ✓ | ⚠ undefined | ✓ | ✓ | ✓ |
| S8 delete last group | ✓ | ✓ | ✓ empty | ✓ | ✓ | ⚠ undefined | ✓ | ✓ | ✓ |
| S9 empty project validate/build | ✓ | ✓ | ✓ empty | ✓ | ✓ | ⚠ undefined | ✓ | ✓ | ✓ |
| S10 undo each delete | ✓ restored | ✓ (null) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S11 capture-loss drag | ✓ unchanged | ✓ | ⚠ stuck preview | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ inputs disabled |
| S12 failed build → retry | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S13 binding modal after delete | ✓ | ⚠ stale id (safe) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ⚠ "Unknown" |

---

## Summary

**Counts by severity:**
- **High:** 1 — WC-13-5 (deleting last Theme Project Group dead-ends "Add Theme Project"; no "Add Group" command).
- **Medium:** 6 — WC-13-1 (clear commits 0/10), WC-13-2 (no upper x/y clamp → off-canvas), WC-13-3 (Infinity silent reject → stale input text), WC-13-6 (empty project builds a "verified" package), WC-13-8 (pointer-capture loss strands drag), WC-13-9 (no ErrorBoundary).
- **Low:** 3 — WC-13-4 (negative dims silently clamped), WC-13-7 (severity taxonomy unused; all issues are "error"), WC-13-10 (duplicate React keys in validation list).

**Top findings (one-liners):**
1. **WC-13-5 (High):** Deleting the last Theme Project Group leaves "Add Theme Project" enabled but a silent no-op, with no "Add Group" command — recovery only via Undo or New Project.
2. **WC-13-1 (Medium):** Clearing a geometry field commits `0` (X/Y) or `10` (W/H) via `Number("") → 0` instead of being rejected/ignored.
3. **WC-13-3 (Medium):** Overflow input (`1e999` → `Infinity`) is safely rejected but leaves stale text in the controlled input until an unrelated re-render.
4. **WC-13-6 (Medium):** A project with zero Theme Projects still validates and builds a "Verified package" (empty manifest).
5. **WC-13-8 (Medium):** A failed `setPointerCapture` can strand the canvas in drag mode with no window-level `pointerup` fallback (recoverable via Escape/blur).
