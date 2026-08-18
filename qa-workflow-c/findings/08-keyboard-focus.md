# Agent 08 — Keyboard / Focus Integration

**Repo:** `C:\Users\b1601\Template_Designer`
**Agent scope:** read-only static audit of keyboard/focus cross-feature interaction (no live UI run; no files modified except this report).
**Baseline:** `npm.cmd run typecheck` → clean (tsc --noEmit, no errors). Vitest baseline is stated as 51/51 (not re-run; out of keyboard scope).
**Confidence model:** `CONFIRMED` = statically proven from source + deterministic browser focus semantics; `UNVERIFIED` = requires a live run (none available).

---

## Scope & scenarios traced

| # | Scenario | Path traced |
|---|---|---|
| S1 | Arrow nudge → undo → redo | `handleCanvasKeyDown` 739-745 → `commitGeometryCommand` 544 → `CommandHistory.execute` |
| S2 | Mod+Arrow nudge → undo → redo | `calculateNudgeStep` 99-103 (`modifier → grid/10`) |
| S3 | Shift+Mod+Arrow nudge → undo → redo | `calculateNudgeStep` 101 (`shift+modifier → grid*5`) |
| S4 | Nudge after marquee (focus lost?) | `beginCanvasMarquee` 563-576 → `handleCanvasPointerUp` 665-674 → focus on `device-screen` 974 |
| S5 | Ctrl+Z / Ctrl+S (declared but unbound) | menu 780-786, Shortcuts 955, `handleCanvasKeyDown` 715-746 |
| S6 | Delete with focus on body | root `onKeyDown` 959 (focus-gated) |
| S7 | Escape during drag with menu open | `Escape` 719-724 vs `menuOpen` 151/962 |
| S8 | Ctrl+A with hidden/locked widgets | `Ctrl+A` 726-733 vs `marqueeSelection` 279 vs `selectedEditableWidgets` 485 |
| S9 | Keyboard select of hidden widget | `canvas-widget` 775 vs `.is-invisible` css 296 |
| S10 | Delete focused widget then nudge remaining selection | 734-737 + `deleteSelectionCommand` 272-283 |

---

## Findings

### WC-08-01 — Root keydown handler is focus-dependent; non-focusable stage/rail/disabled elements drop focus to `<body>` and kill all canvas keyboard (Severity: High · Failure: UI misleading state / lost selection · CONFIRMED · Scenarios S4, S6)

**Repro steps:**
1. Marquee-select one or more widgets (pointer down on `device-screen`, drag, release). Focus is on the focusable `device-screen` (`tabIndex={0}`), so Arrow/Delete work.
2. Click the empty **canvas stage background** (the dark area around the device frame) to deselect.
3. Press `Arrow`/`Delete`/`Ctrl+A` — nothing happens.

**Evidence:**
- Root handler is attached only to the `.app-shell` div:
  `src/App/App.tsx:959` — `<div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)} onKeyDown={handleCanvasKeyDown}>`
- The stage background and rail label are plain, non-focusable divs; only the inner `device-screen` is focusable:
  `src/App/App.tsx:974` — `<div className={\`canvas-stage …\`} onClick={() => { if (!suppressCanvasClickRef.current) clearSelection(); setContextMenu(null); }} onContextMenu={…}>` and `<div className="canvas-rail-label">…</div>` (no `tabIndex`, no `role`); the only focusable canvas node is `<div className="device-screen" ref={canvasScreenRef} tabIndex={0} …>`.
- Because the handler is `onKeyDown` on `.app-shell`, a `keydown` whose target is `<body>` bubbles to `document`/`html` and **never passes through** the `.app-shell` subtree, so `handleCanvasKeyDown` is not invoked.

**Expected vs actual:** Expected — keyboard commands stay available after clicking any part of the canvas to deselect. Actual — deselecting via stage/rail click moves focus to `<body>`, silently disabling Delete/Arrows/Ctrl+A until the user clicks a focusable element (a widget, `device-screen`, a toolbar button, etc.). This directly breaks the "marquee → deselect → arrows" flow. Disabled buttons (`Align`/`Lock`/`Import`/`Open Project`, all `disabled`) and the `canvas-rail-label` are the same class of dead zone.

**Recommended fix (design-level):** Make the stage focusable (`tabIndex={-1}` won't focus on click; use `tabIndex={0}` or `tabIndex={-1}` + explicit `.focus()` in the stage click handler), or attach a window-level `keydown` listener (with the existing input-exclusion guard) so keyboard commands are not hostage to focus location.

---

### WC-08-02 — Deleting the focused widget drops focus to `<body>`; keyboard becomes dead and "nudge remaining selection" is impossible (Severity: High · Failure: lost selection / UI misleading state · CONFIRMED · Scenario S10)

**Repro steps:**
1. Click a widget (focus moves to the `.canvas-widget` div, `tabIndex={0}`).
2. Press `Delete`.

**Evidence:**
- Widgets are individually focusable and receive pointer focus:
  `src/App/App.tsx:775` — `role="button" tabIndex={0} … onPointerDown={(event) => beginWidgetMove(widget, event)}`.
- `Delete`/`Backspace` are handled globally and delete the whole selection:
  `src/App/App.tsx:734-737` — `if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelectionCommand(); return; }`
- `deleteSelectionCommand` clears the selection entirely (so there is no "remaining selection" to nudge — the mission phrase overstates; the real impact is focus loss):
  `src/App/App.tsx:272-283` — `if (!result.changed) return false; setSelection(null); setSelectedIds([]); …`
- The focused `.canvas-widget` div is removed from the DOM on the following render; the browser moves focus to `<body>`; `handleCanvasKeyDown` (root `.app-shell` `onKeyDown`) stops firing (see WC-08-01).

**Expected vs actual:** Expected — after deleting via keyboard, focus remains somewhere in the shell and keyboard remains live (e.g., `Ctrl+A`/Arrows). Actual — focus falls to `<body>`, so a user who deletes via keyboard cannot then nudge/re-select via keyboard; they must click back into a focusable node. If focus was instead on `device-screen` (not on the widget div), the delete succeeds and keyboard stays live — behavior depends on which element happened to have focus.

**Recommended fix:** After `deleteSelectionCommand`, restore focus to a stable focusable anchor (e.g., `canvasScreenRef.current?.focus()`); also pair with WC-08-01 (window-level handler) so focus loss is not fatal.

---

### WC-08-03 — Menu/Shortcuts advertise Ctrl+S / Ctrl+Z / Ctrl+Y / Ctrl+N / R but no handler exists (command mismatch) (Severity: High · Failure: command mismatch · CONFIRMED · Scenario S5)

**Repro steps:**
1. Open the **File**/**Edit** menu and observe `Ctrl+N`, `Ctrl+S`, `Ctrl+Z`, `Ctrl+Y`; open **Settings → Shortcuts** and observe `Ctrl+S`, `Ctrl+Z`, `R`.
2. Press any of them.

**Evidence:**
- Advertised shortcuts:
  `src/App/App.tsx:780-782` — `{ label: "New Project", shortcut: "Ctrl+N", … }`, `{ label: "Save", shortcut: "Ctrl+S", … }`
  `src/App/App.tsx:785-786` — `{ label: "Undo", shortcut: "Ctrl+Z", … }`, `{ label: "Redo", shortcut: "Ctrl+Y", … }`
  `src/App/App.tsx:955` — `<div className="shortcut-list"><span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span></div>`
- The only global keyboard handler is `handleCanvasKeyDown`, which handles `Escape`, `a`+modifier, `Delete`/`Backspace`, and the four arrow keys:
  `src/App/App.tsx:715-746` — full body; no branch for `z`, `y`, `s`, `n`, or `r`.
- Repository-wide grep for `event.key` / `key ===` / `keyCode` returns no handler for these keys anywhere outside `App.tsx` and no window-level keydown listener (grep results: only `Escape`, `a`, `Delete`, `Backspace`, `Arrow*`, and the widget `Enter`/` ` handler at 775).

**Expected vs actual:** Expected — displayed shortcuts are wired to `saveDocument` (243), `undo` (222), `redo` (226), `createProject` (230). Actual — none are bound. `Ctrl+S` and `Ctrl+Z` will fall through to the browser/webview (Save Page / Undo-in-page) rather than the app, and `Ctrl+N`/`Ctrl+Y`/`R` do nothing. Note the inverse mismatch: `Ctrl+A` **is** implemented (726-733) but is not advertised anywhere in the menus or Shortcuts list.

**Recommended fix:** Add a window-level key handler that maps `Ctrl/Cmd+S`→`saveDocument`, `Ctrl/Cmd+Z`→`undo`, `Ctrl/Cmd+Y`/`Ctrl+Shift+Z`→`redo`, `Ctrl/Cmd+N`→`createProject`, `R`→rotation (only outside input targets), and `preventDefault()`; reconcile the Shortcuts list with what is actually bound.

---

### WC-08-04 — Ctrl+A selects hidden+locked widgets; selection box includes widgets the nudge silently skips (misleading multi-selection) (Severity: Medium · Failure: UI misleading state / stale preview · CONFIRMED · Scenario S8)

**Repro steps:**
1. Have a scene containing at least one `locked` and one `visible:false` widget.
2. Press `Ctrl+A`, then `Arrow`.

**Evidence:**
- `Ctrl+A` takes every widget with no filter:
  `src/App/App.tsx:726-733` — `const allIds = orderSelectionIds(canvasWidgets, canvasWidgets.map((widget) => widget.id)); setSelectedIds(allIds); …`
- The pointer marquee, by contrast, filters on `visible && enabled`:
  `src/App/canvas-interaction.ts:279` — `const hits = widgets.filter((widget) => widget.visible && widget.enabled && predicate(widget.geometry)).map((widget) => widget.id);`
- Nudge operates only on `selectedEditableWidgets`, which filters `locked` but **not** `visible`:
  `src/App/App.tsx:485` — `const selectedEditableWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id) && !widget.locked);`
  `src/App/App.tsx:744` — `const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));`
- The selection bounds box includes **all** selected widgets (locked + hidden) with no filter:
  `src/App/App.tsx:765-766` — `const selectionGeometryWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id)); const selectionBounds = getBounds(selectionGeometryWidgets.map(previewGeometry));`

**Expected vs actual:** Expected — `Ctrl+A` selects only widgets the pointer could select (visible + enabled), or the selection box tracks the actually-movable subset. Actual — locked widgets enter the selection box but are skipped by nudge (their `moveGeometry` never commits because `setWidgetGeometriesInScene` also guards `!widget.locked` at `src/Core/editor-application.ts:203`), while **hidden-but-unlocked** widgets *are* nudged invisibly. The selection box and the mutation outcome diverge, giving a misleading "everything moved" appearance.

**Recommended fix:** Filter `Ctrl+A` to `widget.visible && widget.enabled` (mirror `marqueeSelection`), and/or render the selection box from `selectedEditableWidgets` only.

---

### WC-08-05 — `handleCanvasKeyDown` has no `canvasPointer.mode` guard: Delete/Arrows during an active drag/resize commit against canonical geometry mid-drag (Severity: High · Failure: state divergence / wrong Scene mutation / stale preview · CONFIRMED · Scenarios S1-S3 under drag)

**Repro steps:**
1. Pointer-down on a widget and begin dragging (do not release).
2. While still dragging, press `ArrowRight` (or `Delete`).

**Evidence:**
- The keyboard handler only early-returns for excluded targets; it never checks `canvasPointer.mode`:
  `src/App/App.tsx:715-717` — `const target = event.target as HTMLElement; if (isCanvasKeyboardExcludedTarget(target)) return; const modifier = isCanonicalModifier(event);`
  `src/App/App.tsx:734-745` — `Delete`/arrow branches run regardless of `canvasPointer.mode`.
- The arrow branch computes updates from **canonical** geometry, then commits immediately:
  `src/App/App.tsx:744-745` — `const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)])); if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");`
  `widget.geometry` is canonical: `src/App/App.tsx:470` — `const canonicalGeometry = (widget: Widget): Geometry => widget.geometry;`
- By contrast, the property geometry inputs explicitly disable edits during an active pointer interaction:
  `src/App/App.tsx:910` — `disabled={canvasPointer.mode !== "idle" || multi || widget.locked}`.

**Expected vs actual:** Expected — keyboard geometry/delete is ignored (or cancels the drag) while a pointer interaction is in flight, matching the property-input guard. Actual — during a drag, `canvasPointer.initial` still holds pre-drag geometry while `commitGeometryCommand` writes a nudge from `widget.geometry` into the canonical scene and calls `clearGeometryPreview()` (547). The drag then continues from stale `initial`, and the final `pointerup` commit (`handleCanvasPointerUp` 686-697) overwrites the nudge with the drag result — producing a spurious "Nudge widget" history entry whose effect is then clobbered (stale preview / wrong Scene mutation). `Delete` mid-drag is worse: `deleteSelectionCommand` (272-283) removes the widget from the scene but leaves `canvasPointer.mode === "drag"` with `widgetIds` referencing the deleted id; the later pointerup `commitGeometryCommand` returns `changed:false` (the id no longer satisfies `validScopedWidgetIds`), leaving `geometryOverrides` pointing at a deleted widget.

**Recommended fix:** Early-return from `handleCanvasKeyDown` when `canvasPointer.mode !== "idle"` (or call `cancelCanvasInteraction()` first), mirroring the property-input `disabled` guard.

---

### WC-08-06 — Escape only cancels canvas interaction; it does not close the menu, settings, binding, or context menu (focus/UX inconsistency) (Severity: Medium · Failure: UI misleading state · CONFIRMED · Scenario S7)

**Repro steps:**
1. Open the **File** menu (or Settings, or right-click the context menu), then start a drag.
2. Press `Escape`.

**Evidence:**
- Escape short-circuits to canvas-only logic and returns:
  `src/App/App.tsx:719-724` — `if (event.key === "Escape") { if (canvasPointer.mode !== "idle") { event.preventDefault(); cancelCanvasInteraction(); } return; }`
- The open/close state for menus and dialogs is independent and only toggled by click:
  `src/App/App.tsx:151` — `const [menuOpen, setMenuOpen] = useState<MenuKey | null>(null);`
  `src/App/App.tsx:962` — menu button `onClick` toggles `menuOpen`; no Escape path.
  `src/App/App.tsx:984` / `988` / `989` — context menu, binding dialog, and settings dialog close only via backdrop click or their `×`/`Apply` buttons.

**Expected vs actual:** Expected — Escape closes the topmost transient layer (context menu → menu → modal → then cancels canvas interaction). Actual — Escape cancels the interaction but leaves the menu/settings/binding/context menu open; a user mid-drag with a menu open gets interaction-cancel yet the menu persists, and pressing Escape with a modal open does nothing at all (modal stays).

**Recommended fix:** Give `handleCanvasKeyDown` a close-precedence order (context menu → menuOpen → settings/binding) before the canvas-interaction cancel, or add modal-level `onKeyDown` Escape handlers.

---

### WC-08-07 — Delete/Backspace/Arrow are global and ignore focused element type: Backspace/Arrows on any focused button (menu, tree, tab) mutate the canvas selection (Severity: Medium · Failure: wrong Scene mutation · CONFIRMED · S6 adjacent)

**Repro steps:**
1. Select a widget.
2. Focus any non-input control — e.g., the **Undo** toolbar button, a tree-node label, or a menu button — and press `Backspace` or `ArrowRight`.

**Evidence:**
- The only focus-type gate is the input/editable exclusion:
  `src/App/canvas-interaction.ts:95-97` — `return Boolean(target.isContentEditable) || ["INPUT", "TEXTAREA", "SELECT"].includes((target.tagName ?? "").toUpperCase());`
- Delete/Backspace and arrows then run unconditionally for any other focused element:
  `src/App/App.tsx:734-737` (delete) and `src/App/App.tsx:739-745` (arrows) — no check that focus is on the canvas.

**Expected vs actual:** Expected — destructive/navigation keys act only in a canvas context, or the handler confirms the target is a canvas/body descendant. Actual — with a widget selected, pressing `Backspace` while a menu/tree/tab button has focus deletes the selection (and `Arrow*` nudges it), because buttons are not in the exclusion list and the keydown bubbles from the focused button up through `.app-shell`. This is a latent cross-feature hazard (menu navigation with arrow keys, or editing a tree label, would mutate the canvas).

**Recommended fix:** In addition to the input exclusion, early-return unless the target is within the canvas (`target.closest('.device-screen')`) for Delete/Arrow (Escape and Ctrl+A can stay global), or use a window-level handler with a tighter target predicate.

---

### WC-08-08 — Hidden widget stays `tabIndex={0}` + Enter/Space select; keyboard can select a widget the pointer can't reach (Severity: Low · Failure: UI misleading state · CONFIRMED · Scenario S9)

**Repro steps:**
1. Make a widget hidden (`visible:false` → `.is-invisible`, `pointer-events:none`).
2. Tab until the hidden widget receives focus, then press `Enter` or `Space`.

**Evidence:**
- Hidden widgets still render with keyboard affordances:
  `src/App/App.tsx:775` — `role="button" tabIndex={0} … onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ … }); }}` (no `visible` check).
- Pointer access is disabled via CSS:
  `src/App/app.css:296` — `.canvas-widget.is-invisible { … pointer-events: none; }`.

**Expected vs actual:** Expected — hidden widgets are unreachable by both pointer and keyboard (or the keyboard reach mirrors pointer reach). Actual — the keyboard tab order reaches a hidden widget and Enter/Space selects it, creating a selection state the pointer cannot reproduce. Locked widgets are also keyboard-selectable, which is acceptable (selection is allowed; geometry is blocked), but hidden widgets should arguably be skipped.

**Recommended fix:** Drop `tabIndex` (and the Enter/Space handler) for `!widget.visible` widgets, or set `aria-hidden`/`tabIndex={-1}` on `.is-invisible`.

---

### WC-08-09 — Settings/binding modals lack focus trap, autofocus, and Escape close; closing via Apply leaves focus on a removed button → body dead zone (Severity: Medium · Failure: lost selection / UI misleading state · CONFIRMED · S5 adjacent)

**Repro steps:**
1. Open **Settings**, click **Save / Apply & Close**.
2. Press `Arrow`/`Delete`/`Ctrl+A`.

**Evidence:**
- The Apply button closes the dialog and unmounts itself:
  `src/App/App.tsx:989` — `<button … className="settings-button-primary" onClick={() => { setSavedSettings(settingsDraft); setSettingsOpen(false); logAction("Program Settings saved"); }}>Save / Apply &amp; Close</button>`
- There is no autofocus, no `onKeyDown`/Escape handler, and no focus-trap anywhere in the dialog markup (989) or the binding dialog (988); `role="dialog" aria-modal="true"` is declared but no focus management is implemented.

**Expected vs actual:** Expected — opening the modal moves focus into it, Escape closes it, and closing restores focus to the opener. Actual — no autofocus (focus stays wherever it was before opening), no Escape close (see WC-08-06), no focus trap (Tab can escape the modal), and after Apply, focus was on the now-unmounted Apply button, dropping to `<body>` and triggering the WC-08-01 dead zone.

**Recommended fix:** Add autofocus + a focus trap + Escape close + focus restoration to the invoking control for both `settings-backdrop` dialogs (988/989).

---

### WC-08-10 — Splitter resize leaks move/up listeners on `pointercancel` and logs "splitter resized" on a no-movement click (Severity: Low · Failure: UI misleading state / stale state · CONFIRMED)

**Repro steps:**
1. Click (press+release without moving) a splitter → console logs a resize that didn't happen.
2. With a pen/touch pointer, begin a splitter drag and trigger a system `pointercancel` (e.g., palm rejection) → move/up listeners persist until the next pointerup.

**Evidence:**
- `beginResize` registers window-level move/up and always logs on up:
  `src/App/App.tsx:364-381` — `const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); logAction(\`${side === "left" ? "Explorer" : "Properties"} splitter resized\`); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop);`
- There is no `pointercancel` registration, no `setPointerCapture`/`lostpointercapture`, and no movement gate before logging.

**Expected vs actual:** Expected — no resize log when nothing moved, and listeners always cleaned up on cancel. Actual — `stop` logs "splitter resized" even for a zero-delta click (console noise), and a `pointercancel` (pen/touch) never invokes `stop`, leaking `pointermove`/`pointerup` window listeners until an unrelated pointerup occurs (stale state). The clamp itself is correct: `Math.min(420, Math.max(220, …))` (370) bounds width to 220–420 px, and the splitter is a sibling of the canvas section (971/977), not inside `device-screen`, so it correctly does **not** trigger a marquee — that part is fine.

**Recommended fix:** Guard the log on `nextWidth !== startWidth`, register a `pointercancel` handler that calls `stop`, and use pointer capture so cancellation is delivered deterministically.

---

### WC-08-11 — Collapsed panels are unmounted, not hidden: collapsing a panel that holds focus drops focus to `<body>` (Severity: Low · Failure: lost selection · CONFIRMED)

**Repro steps:**
1. Focus a tree-node label inside the Explorer panel.
2. Click the panel's `−`/`×` collapse button.

**Evidence:**
- Panel rendering is gated on "docked"/"floating", so a "collapsed" panel is not rendered at all:
  `src/App/App.tsx:208-212` — `const activeLeftPanel = panelModes.explorer === "docked" ? "explorer" : panelModes.assets === "docked" ? "assets" : null; … const consoleVisible = panelModes.console === "docked";`
  `src/App/App.tsx:970` — `{activeLeftPanel && renderPanelContainer(activeLeftPanel, …)}` (and 978/980/981 likewise).
  `src/App/App.tsx:944` — `renderPanelContainer` returns `<aside>` for non-floating, but is only ever called with "docked"/"floating" panels, never "collapsed".
  `src/App/panel-manager.ts:24-26` — `floatingPanels` filters `=== "floating"`.

**Expected vs actual:** The mission asked whether collapsed content is `display:none` (removed from tab order) or `visibility:hidden` (still tabbable). The answer is **neither** — collapsed panels are unmounted from the DOM entirely, so their content cannot be in the tab order, and any focus inside them is lost to `<body>` (re-triggering WC-08-01). This also means collapse and close are currently indistinguishable in the layout (both remove the panel; only `floating` keeps it visible).

**Recommended fix:** If collapse should keep a collapsed rail/tab visible, render a collapsed container and manage focus restoration; otherwise document that collapse == close for V1 and restore focus on collapse.

---

### WC-08-12 — Nudge key-repeat creates one history command per repeat; modifier nudge can produce fractional coordinates at grid=1 (Severity: Low · Failure: history corruption (benign) / stale state · CONFIRMED · Scenarios S1-S3)

**Repro steps:**
1. Hold `ArrowRight` (key repeat) — observe one "Nudge widget" history entry per repeat.
2. Set **Settings → Snap grid size** to `1`, then `Mod+Arrow`.

**Evidence:**
- Each keydown commits a separate command:
  `src/App/App.tsx:744-745` — `… commitGeometryCommand(activeScene?.id, updates, "Nudge widget");` (no repeat coalescing).
  `src/Core/commands.ts:33-38` — `execute(command) { command.execute(); this.undoStack.push(command); … }` (one entry per call).
- Modifier step is `grid/10`, with grid as low as 1:
  `src/App/canvas-interaction.ts:99-103` — `if (modifiers.shift) return gridSize * 5; return modifiers.modifier ? gridSize / 10 : gridSize;`
  `src/App/App.tsx:472` — `snapGridSize = Number.isFinite(savedSettings.snapGridSize) && savedSettings.snapGridSize > 0 ? savedSettings.snapGridSize : DEFAULT_GRID_SIZE;` (no minimum beyond `> 0`; settings input `min="1"` at 950).

**Expected vs actual:** Expected — a held key nudge coalesces to one undoable step (or is rate-limited), and nudge stays integral. Actual — OS key-repeat produces a flood of "Nudge widget" commands (undo requires one Ctrl+Z per repeat), and at `grid=1` the `Mod+Arrow` step is `0.1`px, writing non-integer geometry coordinates (`x: 0.1`) into the canonical model. `Shift`-alone and `Alt` correctly return `null` (no move) at line 100 — that part is fine. Note: `calculateNudgeStep` correctly shares the single `snapGridSize` source with pointer snapping (640/687), so there is no separate grid constant to drift — cross-check OK.

**Recommended fix:** Coalesce repeated nudges (debounce/merge into a single history command per key-press burst), and enforce a minimum integer nudge step (e.g., `Math.max(1, Math.round(grid/10))`).

---

## Invariant check table

Legend: ✓ = consistent; ✗ = divergence. "Explorer sel" and "Properties sel" are both derived from the same `selection`/`selectedIds` React state, so they are always mutually consistent but can diverge from Document/canvas.

| Scenario | Document | Selection (sel/selectedIds) | Canvas preview | History | Dirty state | Active Scene | Active doc | Explorer sel | Properties sel |
|---|---|---|---|---|---|---|---|---|---|
| S1 Arrow nudge → undo → redo | ✓ (move commits; undo/redo invert) | ✓ (unchanged by nudge) | ✓ (preview cleared on commit) | ✓ (one cmd; undo/redo symmetric) | ✓ | ✓ | ✓ | ✓ | ✓ |
| S2 Mod+Arrow nudge → undo → redo | ✗ (grid=1 → 0.1px fractional geom) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S3 Shift+Mod+Arrow nudge → undo → redo | ✓ (grid*5) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S4 Nudge after marquee | ✓ (selection cleared by stage click) | ✗→focus on body; keyboard dead | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S5 Ctrl+Z / Ctrl+S | ✓ (no-op) | ✓ | ✓ | ✗ (undo never invoked) | ✗ (save never invoked; stays dirty) | ✓ | ✓ | ✓ | ✓ |
| S6 Delete with focus on body | ✓ (no mutation) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| S7 Escape during drag w/ menu open | ✓ | ✓ | ✓ (interaction canceled) | ✓ | ✓ | ✓ | ✓ (menu still open) | ✓ | ✓ |
| S8 Ctrl+A w/ hidden+locked | ✓ | ✗ (includes hidden+locked) | ✗ (bounds box shows skipped locked) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| S9 Keyboard select hidden widget | ✓ | ✗ (hidden widget selectable) | ✗ (hidden widget highlighted) | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| S10 Delete focused widget → nudge | ✓ (widget deleted) | ✗ (selection cleared; focus to body) | ✗ (keyboard dead) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Summary

**Counts by severity:**
- **High: 4** — WC-08-01 (focus-dependent dead zones), WC-08-02 (delete→focus loss), WC-08-03 (displayed shortcuts unbound), WC-08-05 (no `canvasPointer.mode` guard → mid-drag commit).
- **Medium: 4** — WC-08-04 (Ctrl+A unfiltered), WC-08-06 (Escape doesn't close overlays), WC-08-07 (Delete/Arrow fire on any focused button), WC-08-09 (modal focus management missing).
- **Low: 4** — WC-08-08 (hidden widget keyboard-reachable), WC-08-10 (splitter pointercancel leak + console noise), WC-08-11 (collapsed panels unmount → focus loss), WC-08-12 (key-repeat history spam + fractional nudge).

**Top findings (one-liners):**
1. WC-08-01/02 — Keyboard is hostage to focus: clicking the stage/rail or deleting the focused widget drops focus to `<body>` and silently kills Delete/Arrows/Ctrl+A.
2. WC-08-03 — `Ctrl+S`/`Ctrl+Z`/`Ctrl+Y`/`Ctrl+N`/`R` are displayed in menus and Shortcuts but no handler exists (command mismatch; browser-native behavior leaks in).
3. WC-08-05 — `handleCanvasKeyDown` has no `canvasPointer.mode` guard, so Delete/Arrows during a drag/resize commit against canonical geometry mid-drag and are clobbered by the drag commit.
4. WC-08-04/07 — `Ctrl+A` selects hidden+locked widgets (nudge skips locked, moves hidden), and Delete/Backspace/Arrows mutate the selection from any focused button, not just the canvas.
