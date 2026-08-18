# DEEPSEEK_UI_UX_AUDIT.md — Template Designer V2 · Workflow B (UI Consistency, Visual Quality & UX Audit)

**Role:** Lead UI/UX Quality Architect
**Type:** Read-only audit. No application code was modified. No commits were created.
**Method:** 15 specialized audit agents (global layout, toolbar, explorer, canvas, properties, docking, settings, typography, spacing, icons, states, accessibility, responsive, visual consistency, affordances) audited the application against the canonical design system, followed by Lead verification of every cited line. All findings are objective and measurable (px measurements, contrast ratios, state comparisons, canonical conflicts), not taste judgments.

**Canonical sources (read in full):**
- `docs/UI_DESIGN_SYSTEM_V2.md` (sections 1–29)
- `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` (overrides the main spec on conflict)
- `.agents/skills/ui-ux-system/SKILL.md`

**Audited implementation:** `src/App/App.tsx` (992 lines), `src/App/app.css` (364 lines), `src/App/canvas-interaction.ts`, `src/App/panel-manager.ts`, `src/App/editor-commands.ts`, `src/App/editor-types.ts`, `src/App/profile-registry.ts`, `src/main.tsx`, `index.html`.

**Priority scale:** P0 = severely harms usability or information hierarchy, or communicates state incorrectly · P1 = clearly inconsistent, visually broken, or a direct canonical violation · P2 = noticeable polish problem · P3 = minor refinement.

---

## Global Assessment

The shell is structurally faithful to the canonical specification. The `§2` Application Shell geometry is present (Application Bar → Document Tabs → Explorer | Device Canvas | Properties → Console → Statusbar), the `:root` block seeds the `§23` token families (surfaces, borders, text, accent, status, dark preview), panels have docked/collapsed/floating modes, Settings is a blocking modal (`§17`), the Simulator's state list is DeviceProfile-driven (`§15`), the Explorer tree and Properties are model views over one canonical project model, grid and snap are separate toggles (`§27`), multi-select `*` value logic exists, and canvas marquee/drag/resize/nudge/snap-guide interactions are implemented. The restrained teal-on-neutral language with a dark device preview follows the skill's visual direction.

However, the audit found **five systemic weaknesses** that recur across nearly every surface:

1. **State honesty (the dominant problem).** Numerous controls look enabled or claim a state that the code does not deliver: Align/Lock buttons (TB-01/TB-02), Simulator Run/Pause/Step (SF-03), Settings checkboxes that save but never apply (ST-02), the Design/Preview mode switch that changes only a label (SF-02), displayed shortcuts with no handlers (AX-01, ST-05), a green status LED while the text reports validation problems (GL-04), and a dirty dot tied to the active tab instead of the dirty document (GL-03). These violate `§25` UI States and the skill's "No dead-end interactions" principle.
2. **Incomplete token layer.** ~60 one-off hex values, 6 distinct shadows, no typography scale, no icon system, no elevation tokens — direct conflicts with `§23` (see Design System Violations).
3. **Metric drift.** Control heights span ~19–43 px across adjacent toolbars/rows against the canonical 28–36 px guidance and 4/8 rhythm (Spacing Problems).
4. **Unmet accessibility contract.** `§24` requires focus containment in modals, keyboard-reachable menus/trees/tabs, accessible labels on icon-only controls and ≥4.5:1 contrast; most of these are absent (Accessibility Problems).
5. **Broken canvas view model.** The grid is drawn behind the device frame, zoom scales only an inner layer that is then clipped, pan does not work over widgets, the device frame is capped at 280 px regardless of available space, and the authored empty-canvas state is never rendered (Canvas Problems).

**Overall:** the canonical architecture is respected; the visual execution and the honesty of interactive states are not yet at the spec's bar. One P0, 30 P1, and 75 P2/P3 findings follow, all with concrete corrections.

---

## Layout Problems

### GL-01 — P1
- **Location:** `app.css:180` (inside `@media (max-width:1180px)`) vs the inline 5-track `gridTemplateColumns` at `App.tsx:215`.
- **Problem:** The media rule forces `.editor-workspace` to `246px minmax(0,1fr) 260px !important`, a 3-track template, over the inline 5-track template (`leftWidth | 5px splitter | canvas | 5px splitter | rightWidth`).
- **Why it is objectively problematic:** `!important` beats the inline style, so with the five rendered children (left panel, splitter, canvas, splitter, right panel) grid auto-placement wraps the right splitter and Properties panel onto an implicit second row; the user's splitter-resized widths are also discarded below 1180 px. `§21` requires resize to reflow, not break, and `§2` requires a stable shell.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §21 Responsive Layout` + `§2 Application Shell`.
- **Suggested correction:** Remove the `!important` 3-track override, or emit the same 5-track template with the reduced 246/260 px widths so splitter tracks and visibility logic are preserved.

### GL-02 — P1
- **Location:** `app.css:121` `.device-frame { width: clamp(180px, 25vh, 280px) }` vs panel widths 286 px / 298 px (`App.tsx:149-150`).
- **Problem:** The central device preview is capped at ≤280 px while a single side panel is wider (286/298 px); on a 1920 px window the device occupies roughly a fifth of the canvas stage.
- **Why it is objectively problematic:** The skill states the device preview is the visual center of gravity and side panels "must not visually dominate" it; here both side panels together (584 px) dwarf the device, and the clamp prevents the canvas from growing with the window, violating `§21` ("canvas esnek büyür").
- **Canonical reference:** `ui-ux-system SKILL — UX principles §1` + `UI_DESIGN_SYSTEM_V2 §21`.
- **Suggested correction:** Size the device frame from the available stage (fit-to-width/height with a sane max) instead of the fixed 25vh/280 px clamp.

### GL-05 — P2
- **Location:** `App.tsx:214` (`workspaceRows 'minmax(0,1fr) 156px'`), `App.tsx:940` (`consoleEntries.slice(-3)`), `app.css:163`.
- **Problem:** The console row is 156 px tall but renders only the last 3 of the 25 buffered entries with no scroll, leaving most of the dark row empty.
- **Why it is objectively problematic:** More than three-quarters of the Console surface is empty while command/validation/runtime traces are silently unreachable; `§21` explicitly requires that scrollback is not lost.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §16 Console` + `§21 Responsive Layout`.
- **Suggested correction:** Make `.console-body` a scrollable list that fills the row and render the full buffer instead of `slice(-3)`.

### GL-08 — P3
- **Location:** `app.css:193` `.splitter` + `App.tsx:971/977`.
- **Problem:** Panel splitters are 5 px wide with a 5 px hit target, `role="separator"`, no `tabIndex`, no keyboard handler, no `aria-valuenow/min/max`.
- **Why it is objectively problematic:** A 5 px target is below a comfortable grab size and the separator is mouse-only, contrary to `§3` resize behavior and `§24` keyboard reachability.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3 Docking System` + `§24 Accessibility`.
- **Suggested correction:** Enlarge the hit area (padding/`::before`) and make the separator focusable with arrow-key resize and aria value attributes.

### GL-09 — P3
- **Location:** `app.css:30-31, 36` (`min-width:1080px`, `min-height:650px`, `body { overflow: hidden }`).
- **Problem:** Below 1080×650 px the shell is hard-clipped: the statusbar and right edge are cut off with no scroll or graceful reflow.
- **Why it is objectively problematic:** The shell cannot degrade at smaller Windows sizes; `§21` expects realistic resize behavior, not silent clipping.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §21 Responsive Layout`.
- **Suggested correction:** Enforce a real minimum window size at the shell level (Tauri `minWidth`/`minHeight`) instead of clipping, or allow the workspace to scroll.

### GL-10 — P3
- **Location:** `App.tsx:966` `.tab-close`.
- **Problem:** The document tab close `×` is disabled when only one document is open, with no tooltip explaining why.
- **Why it is objectively problematic:** A visible close control that silently does nothing (opacity 0.43) is a false affordance; `§25` requires the disabled reason to be communicated.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25 UI States` + `ui-ux-system SKILL §5`.
- **Suggested correction:** Add a `title` (e.g. "The last open document cannot be closed") or hide the close button for a sole tab.

### DK-01 — P1
- **Location:** `App.tsx:828-830` `renderPanelHeader` (float `⤢`, collapse `−`, close `×`).
- **Problem:** The "Collapse" (`−`) and "Close" (`×`) header actions call the same `collapsePanel` function; there is no close/reopen behavior at all.
- **Why it is objectively problematic:** Two adjacent controls promise different operations but perform the identical one — a classic false affordance — and `§3` defines close/reopen as a distinct behavior from collapse/auto-hide.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3 Docking System` (Close/reopen) + `§25 UI States`.
- **Suggested correction:** Implement real close (hide panel; reopen via View menu) or remove the `×`; never map two differently-labeled buttons to one handler.

### DK-02 — P1
- **Location:** `app.css:195-201` `.floating-tool-panel` + `App.tsx:944, 981`.
- **Problem:** "Floating" panels are absolutely positioned boxes at fixed offsets (`floating-explorer` at `top:15px; left:15px`, etc.); they cannot be dragged, repositioned, or re-docked except via Reset Layout.
- **Why it is objectively problematic:** `§3` requires floating panels to be movable windows whose drag can be cancelled safely, with re-dock support; a fixed box labelled "float" misrepresents the docking model.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3 Docking System` (Floating, Drag iptali).
- **Suggested correction:** Add drag-by-header and a re-dock affordance, or replace the fixed offsets with user-movable positioning.

### DK-03 — P2
- **Location:** `App.tsx:937-942` `renderConsole` vs `App.tsx:824-833` `renderPanelHeader`.
- **Problem:** Every tool panel has a 52 px heading with kicker + title + three actions, but the Console has a different chrome (tabs row, only float/collapse actions, no heading or kicker).
- **Why it is objectively problematic:** Panel chrome is inconsistent across surfaces, breaking the "panel header, tab, toolbar share the same rhythm" rule of `§22/§23`.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §22 Visual Design System` + `§23 Design Tokens`.
- **Suggested correction:** Unify the Console header with the panel-heading pattern (kicker "OUTPUT", title, same action set).

### DK-05 — P2
- **Location:** `src/App/panel-manager.ts:15-22` `activateDockedPanel`.
- **Problem:** Activating a docked panel silently collapses its sibling (Explorer↔Assets, Properties↔Simulator) instead of creating a tab stack.
- **Why it is objectively problematic:** `§3` says dropping a panel onto another preserves content and creates a tab stack; here switching tabs destroys the sibling's docked state without warning.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3 Docking System`.
- **Suggested correction:** Implement a real dock group/tab-stack so both panels can coexist, or surface the collapse explicitly.

### DK-06 — P3
- **Location:** `App.tsx:148-168` (panel state in component `useState` only).
- **Problem:** Panel layout, widths and dock modes are never persisted; `§3` requires workspace state (positions, sizes, visibility) to be stored.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3 Docking System` ("Workspace … saklar").
- **Suggested correction:** Persist panel modes/widths (e.g. localStorage now, workspace file later) and restore on startup.

### DK-07 — P3
- **Location:** `App.tsx:835-838` `renderDockTabs` + `app.css:189-192`.
- **Problem:** Dock tabs are plain buttons without `role="tab"`/`aria-selected` and no keyboard switching semantics.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24 Accessibility`.
- **Suggested correction:** Add tab roles/aria state and arrow-key switching.

### DK-09 — P3
- **Location:** `App.tsx:939` (console "Collapse console" action uses `×`).
- **Problem:** The Console's collapse button uses the close glyph `×` with title "Collapse console" — glyph and label disagree (close semantics shown for a collapse action).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (icons carry correct meaning) + `ui-ux-system SKILL`.
- **Suggested correction:** Use `−` (or a chevron) for collapse and reserve `×` for close.

### RS-07 — P2
- **Location:** `app.css:62` `.document-tab { min-width:190px }` + `App.tsx:966`.
- **Problem:** Document tabs have a 190 px minimum width and the tab strip has no horizontal scroll/overflow affordance.
- **Why it is objectively problematic:** With several open documents the tabs silently overflow the window with no way to reach them; `§20/§21` require reorder/scroll behavior for open documents.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §20 Document Tabs` + `§21`.
- **Suggested correction:** Add an overflow affordance (scroll or dropdown "more tabs" list) to the tab strip.

---

## Spacing Problems

### SP-01 — P1
- **Location:** Measured control heights across `app.css`: menu-button 27 px / toolbar-button ~25 px / brand-mark 28 px (lines 41-55); studio-tool ~28 px (108); context-action ~21 px (133); sim-button ~28 px (233); small-action ~23 px (83); zoom-button 25 px (112); tree-row 33 px (89); property-row 29 px (145); asset-row ~43 px (221).
- **Problem:** Controls that sit on the same visual baselines do not share a height, and several fall below the 28–36 px canonical band.
- **Why it is objectively problematic:** The canonical token section requires control and toolbar heights to share one baseline with a 4/8 rhythm; the measured 21–43 px spread is a measurable density and rhythm violation, and ~19-21 px targets are too small for precise interaction.
- **Canonical reference:** `ui-ux-system SKILL — Density (28–36 px, 4/8 spacing)` + `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** Define `--control-height` (e.g. 28 px) and `--control-height-sm` (e.g. 24 px) tokens and apply them to all button/row recipes.

### SP-02 — P2
- **Location:** `app.css:36` (50/35/27 px shell rows), `:105` (42/31 px canvas rows), `:214` (156 px console).
- **Problem:** Shell row heights (50, 35, 27) and toolbar rows (42, 31) are off the 4/8 grid.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` (4/8-based rhythm).
- **Suggested correction:** Normalize to on-grid values (e.g. 48/32/28 and 40/32) or record them as deliberate exceptions in the token documentation.

### SP-04 — P2
- **Location:** `app.css:89` (tree-row 33 px) vs `:145` (property-row 29 px) vs `:238` (sim-row 29 px) vs `:221` (asset-row ~43 px).
- **Problem:** Adjacent panels use four different row rhythms (29/33/43 px).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §22/§23` (panels share vertical rhythm).
- **Suggested correction:** Standardize list rows to one 32 px (or 28 px compact) token.

### SP-05 — P3
- **Location:** `app.css:189` (dock tabs 30 px), `:156` (console tabs 34 px), `:36` (document tabs row 35 px).
- **Problem:** Three tab surfaces have three heights (30/34/35 px).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** One tab-bar height token (e.g. 32 px) across dock tabs, console tabs and document tabs.

### SP-06 — P2
- **Location:** `app.css:78` (panel-heading 52 px) vs `:136` (inspector-context 63 px) vs console tabs 34 px.
- **Problem:** Panel headers differ in height by 11 px between the Explorer/Assets/Simulator and the Properties inspector.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` + SKILL panel rhythm.
- **Suggested correction:** Unify header heights (single token, e.g. 52 px) and move inspector context into the header.

### SP-07 — P3
- **Location:** `app.css:39` (app bar gap 18 px), `:52` (topbar gap 6 px), `:107` (tool-group gap 3 px), `:129` (context bar gap 10 px).
- **Problem:** Micro-gaps (3/6/10/18 px) are ad hoc and off the 4/8 rhythm.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** Constrain gaps to the 4/8 scale (4/8/12/16 px).

---

## Typography Problems

### TY-01 — P1
- **Location:** `app.css` throughout (7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17 px sizes); no `--font-size-*` tokens.
- **Problem:** Eleven distinct font sizes are used without a typography scale; `§23` requires a semantic token layer (text-primary/secondary/muted).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23 Design Tokens` + SKILL Typography.
- **Suggested correction:** Define a 3–4 step UI scale (e.g. 10/11/12/13 px) plus micro-label size and replace raw sizes.

### TY-02 — P2
- **Location:** `app.css:2` font stack; `index.html` loads no font.
- **Problem:** `Inter` is listed first in the stack but is never bundled or imported, so Windows always renders Segoe UI — a dead stack entry.
- **Canonical reference:** SKILL Typography (use one highly legible Windows UI font).
- **Suggested correction:** Drop the Inter reference (keep Segoe UI first) or actually bundle Inter; do not ship a misleading stack.

### TY-03 — P1
- **Location:** `app.css:122` `.device-frame-header/footer` 7 px.
- **Problem:** The device frame header/footer text ("DISPLAY", "R0 · 720 × 1280") is 7 px.
- **Why it is objectively problematic:** Sub-9 px text is illegible at 100% scaling on a standard Windows display; the identity of the displayed rotation is core canvas state and must be readable.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24 Accessibility` (contrast/text size at real Windows sizes).
- **Suggested correction:** Raise to ≥9–10 px with adequate letter-spacing and contrast.

### TY-04 — P2
- **Location:** `app.css:171` statusbar 9 px; `:253` console-level 8 px.
- **Problem:** Status/console text is 8–9 px — below comfortable readability for frequently consulted state information.
- **Canonical reference:** SKILL Density ("do not make controls so small that precision editing becomes difficult") + `§24`.
- **Suggested correction:** Minimum 10 px for statusbar/console text.

### TY-05 — P2
- **Location:** `app.css:144` `.property-section-title` (9 px uppercase) vs `:145` `.property-row` (10 px).
- **Problem:** Section titles are smaller than the content they label, inverting the label/content hierarchy.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §22` (strong hierarchy).
- **Suggested correction:** Make section titles visually dominant (e.g. 10 px semibold uppercase + stronger color, or 11 px).

### TY-07 — P3
- **Location:** `app.css:147` `.property-row strong` (right-aligned, ellipsis) — no `title` on values.
- **Problem:** Long property values (e.g. asset `sourcePath`) are truncated with ellipsis and cannot be read in full anywhere.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §8 Properties`.
- **Suggested correction:** Add `title` tooltips (or click-to-copy) for truncated values.

### TY-08 — P3
- **Location:** `app.css:263` (`h2` 17 px) vs `:269` (`h3` 16 px).
- **Problem:** Dialog heading hierarchy differs by 1 px, and the application has no `h1` anywhere.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §22`.
- **Suggested correction:** Establish a real heading scale (dialog title vs section) and use it consistently.

### TY-09 — P3
- **Location:** `app.css:81/85/144/119` letter-spacing `.14em/.1em/.12em/.15em`.
- **Problem:** Uppercase micro-labels use four different letter-spacing values with no token.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** One micro-label token (size + tracking) shared by kickers, section titles and rail labels.

---

## Component Problems

### DK-01 — P1
*(Duplicate of the header-action conflation, detailed under Layout Problems — placed here as the primary component-level defect.)*
- **Location:** `App.tsx:828-830`; `app.css:188`.
- **Problem:** Collapse `−` and Close `×` both run `collapsePanel`; there is no close behavior.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §3` (close/reopen) + `§25`.
- **Suggested correction:** Distinct implementations or remove `×`.

### VC-03 — P2
- **Location:** `app.css:55` (toolbar-button), `:108` (studio-tool), `:83` (small-action), `:133` (context-action), `:233` (sim-button), `:281` (settings-button-secondary).
- **Problem:** Six duplicated button recipes each restate border + padding + font with drifted values (heights 21–28 px, fonts 9–11 px).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` (single token layer; no duplicate styles).
- **Suggested correction:** One `.btn` base + size/variant modifiers (`--btn`, `--btn-sm`, `--btn-primary`).

### VC-04 — P2
- **Location:** `app.css:213-214` (asset-search input: box-shadow focus ring) vs `:355-356` (geometry-editor input: 2 px outline) vs `:358` (settings-number: no focus style beyond global button rule which does not apply to inputs).
- **Problem:** Input controls have three different focus treatments (box-shadow ring, outline, none).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23/§24` (one `focus-ring` token).
- **Suggested correction:** One `--focus-ring` treatment applied to every input and control.

### VC-05 — P3
- **Location:** `app.css:143` (border-bottom `var(--border)`), `:145` (`#e8edef`), `:221` (`#e7edef`), `:238` (`#e7edef`), `:314` (`#e5ecee`), console `:155` (border-top `#182b31`).
- **Problem:** Row separators use four different raw colors and mixed border directions.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` (border-subtle token).
- **Suggested correction:** One `--border-subtle` separator token, one direction convention.

### VC-06 — P3
- **Location:** `app.css` radii: 0 (most surfaces), 50% (dots), 7 px (`:159` tab-count), 14 px (`:102` footnote-mark).
- **Problem:** Border radius has no scale; values are ad hoc.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` (low radius system).
- **Suggested correction:** Define `--radius-none/sm/full` tokens and apply.

### SF-05 — P2
- **Location:** `app.css:33` `button:disabled { opacity: 0.43 }` (global); no other disabled styling.
- **Problem:** The disabled state is conveyed by opacity alone, with no text/icon structural difference and no reason text.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25 UI States` (Disabled: reason explained when necessary) + `§24` (not color-only).
- **Suggested correction:** Pair opacity with a visible reason (tooltip/annotation) on every disabled control, or remove controls that are never available.

### DK-09 — P3
- **Location:** `App.tsx:939`.
- **Problem:** Console collapse action uses `×` glyph labelled "Collapse console".
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Use `−`/chevron for collapse; reserve `×` for close.

---

## Canvas Problems

### CV-01 — P2
- **Location:** `App.tsx:578-593` `beginWidgetMove` vs `App.tsx:563-576` `beginCanvasMarquee`.
- **Problem:** With the Pan tool active, a left-drag starting on a widget still moves the widget, because `beginWidgetMove` never checks `canvasTool` and stops propagation.
- **Why it is objectively problematic:** The Pan tool's grab cursor promises panning, but over the only content it performs a move — the tool behaves inconsistently across the surface.
- **Canonical reference:** `ui-ux-system SKILL §5` + `UI_DESIGN_SYSTEM_V2 §6`.
- **Suggested correction:** Early-return in `beginWidgetMove` when `canvasTool === "pan"` so the event bubbles to the pan handler.

### CV-02 — P1
- **Location:** `App.tsx:775` (`role="button" tabIndex={0}`) and `App.tsx:974` (`device-screen tabIndex={0}`) vs `app.css:34` (focus-visible styles native `<button>` only).
- **Problem:** Canvas widgets and the device screen are keyboard-focusable but have no visible focus indicator.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (focus ring must be visible and distinct from selection).
- **Suggested correction:** Add `.canvas-widget:focus-visible` / `.device-screen:focus-visible` using a dedicated focus token.

### CV-03 — P1
- **Location:** `app.css:124-127` (`.canvas-empty-state` authored, never rendered); `App.tsx:974`.
- **Problem:** An empty project shows a completely blank dark device screen; the authored empty state is dead CSS.
- **Why it is objectively problematic:** The first surface a new user sees communicates nothing about the next step; `§25/§26` require the Canvas empty state to direct to "Add/select Scene/Widget".
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` + `§26`.
- **Suggested correction:** Render `.canvas-empty-state` inside `.device-screen` when no rotation/scene/widgets exist, pointing to the Add command.

### CV-04 — P2
- **Location:** `app.css:123` (`overflow:hidden`) + `App.tsx:490-492` (`canvasLayerStyle`) + `canvas-interaction.ts:123-137`.
- **Problem:** Zoom scales only the inner widget layer; at zoom > 100% the layer exceeds the fixed device screen and is silently cropped, with no scroll/letterbox/zoom-to-fit recovery.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §6` (viewport/zoom/pan/letterbox recomputed on resize).
- **Suggested correction:** Scale the frame with zoom, or provide scroll/pan-over-content plus a zoom-to-fit reset.

### CV-05 — P2
- **Location:** `app.css:115-116` (grid on `.canvas-stage`, 18 px) vs `canvas-interaction.ts:73` (`DEFAULT_GRID_SIZE = 10` scene units).
- **Problem:** The visible grid is drawn on the light workspace at a fixed 18 px, behind the opaque device frame; it is unrelated to the 10-unit snap grid and never pans/zooms with the scene.
- **Why it is objectively problematic:** The Grid toggle produces lines that don't correspond to the snapping grid the editor actually uses, misrepresenting the snap surface.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §6` + `§22` (major/minor grid on the editing surface).
- **Suggested correction:** Render grid lines inside `.device-screen` in scene units matching `snapGridSize`, scaling with zoom.

### CV-06 — P1
- **Location:** `app.css:296` (`.canvas-widget.is-invisible`) + `App.tsx:775`.
- **Problem:** Invisible widgets are rendered as 0.65-opacity ghosts with dotted outlines; the canonical contract says invisible widgets are not rendered.
- **Why it is objectively problematic:** Direct deviation from `§7`/Corrections `§8`: "Invisible widget render edilmez; Explorer/Layers ve selection bounds üzerinden seçilebilir". The ghost conflates "hidden" with "dimmed".
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §7` + `CANONICAL_CORRECTIONS §8`.
- **Suggested correction:** Don't render the widget element when `!widget.visible`; show selection bounds only when it is selected via the tree.

### CV-08 — P2
- **Location:** `app.css:121`.
- **Problem:** Device frame hard-capped at 280 px / 25vh — the preview never grows with the window.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §21` + SKILL §1.
- **Suggested correction:** Fit the frame to the available stage (see GL-02).

### CV-09 — P3
- **Location:** `canvas-interaction.ts:279` (marquee filter `widget.visible && widget.enabled`).
- **Problem:** Marquee silently excludes hidden/disabled widgets while `Ctrl+A` (App.tsx:728) includes them — inconsistent selectable sets between two mechanisms.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §7` (invisible widgets remain selectable).
- **Suggested correction:** Align marquee inclusion with the canonical selectable set.

### CV-10 — P3
- **Location:** `app.css:348-352` (snap-guide colors) + `App.tsx:768`.
- **Problem:** Snap guide kinds (grid/edge/center) are distinguished by color alone (teal/amber/magenta), with no legend or shape difference.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §1` (states not color-only) + `§24`.
- **Suggested correction:** Add a non-color distinction (solid/dashed/dotted) or a transient label for each guide kind.

### CV-11 — P3
- **Location:** `app.css:128` (`.canvas-overlay-note` never referenced).
- **Problem:** Dead CSS for a canvas annotation that was never wired.
- **Canonical reference:** SKILL (no scattered/unused values).
- **Suggested correction:** Render it (e.g. grid/snap hint) or remove it.

### CV-12 — P2
- **Location:** `App.tsx:974` (`R{activeRotation?.angle ?? 0} · {canvasWidth} × {canvasHeight}`).
- **Problem:** With no rotation in the project, the device header fabricates "R0" from the `?? 0` fallback.
- **Why it is objectively problematic:** The header states a rotation that does not exist in the model — a false canvas state.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` + `§6`.
- **Suggested correction:** Show "No rotation" or the profile dimensions only when `activeRotation` is undefined.

### CV-13 — P3
- **Location:** `App.tsx:974` (canvas `onContextMenu`) + `App.tsx:984` + `editor-commands.ts:41-44` (no descriptor supports kind `"canvas"`).
- **Problem:** Right-clicking empty canvas opens a context menu whose only content is "No commands for this selection" — a dead menu.
- **Canonical reference:** `ui-ux-system SKILL §5` + `UI_DESIGN_SYSTEM_V2 §18`.
- **Suggested correction:** Suppress the menu on empty canvas (or populate it with Canvas commands: Grid/Snap/Fit).

### CV-14 — P2
- **Location:** `App.tsx:285-293` `duplicateSelectionCommand` vs `§19` duplicate mode.
- **Problem:** Duplicate executes immediately; the canonical duplicate mode (click-to-place with center on cursor, repeated clicks, `Esc` exit) is not implemented.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §19 Keyboard/Mouse` (Duplicate mode).
- **Suggested correction:** Implement duplicate mode, or relabel the button until the mode exists.

---

## Explorer Problems

### EX-01 — P1
- **Location:** `App.tsx:844` (Expand sets `{ project: true, 'theme-group': true }`) vs real node ids (`App.tsx:446-462`).
- **Problem:** Expand and Collapse produce the same result: the hardcoded keys never match any real node id, so both buttons collapse the tree (depth < 2 default only).
- **Canonical reference:** `ui-ux-system SKILL §5`.
- **Suggested correction:** Expand must mark every real node id expanded (or use an all-expanded sentinel).

### EX-02 — P1
- **Location:** `App.tsx:432/436` + `app.css:89-91`.
- **Problem:** Tree selection is shown only by a teal left border + pale background, with no `aria-selected`/`aria-current`.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (selected state not color-only).
- **Suggested correction:** Add `aria-selected` and a non-color cue (bold label or glyph).

### EX-03 — P2
- **Location:** `App.tsx:100` (widget nodes get `kind: widget.widgetType`) vs `App.tsx:429` (icon map tests `kind === "Widget"`).
- **Problem:** The `◇` widget icon branch can never match; every widget row falls through to the `▱` fallback.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §4`.
- **Suggested correction:** Match on `node.nodeType` (or a dedicated Widget kind).

### EX-04 — P1
- **Location:** `App.tsx:459-460` (Resources/Unsupported pseudo-nodes) + `App.tsx:397-416` (`selectNode`).
- **Problem:** Resources and Unsupported Files are selectable and highlight, but their ids never resolve in `resolveCanonicalNode`, so the selection has no canonical target; Properties shows "Select a canonical item to inspect" while the statusbar says "Selection: Resources".
- **Why it is objectively problematic:** A contradictory dead-end selection: highlight + statusbar claim a selection that no surface can act on.
- **Canonical reference:** `ui-ux-system SKILL §5` + `UI_DESIGN_SYSTEM_V2 §26`.
- **Suggested correction:** Render them as non-selectable group headers, or bind them to a real navigation/asset surface.

### EX-05 — P1
- **Location:** `app.css:16` (`--text-muted #8b9a9f`) at `:85` (8 px), `:99` (9 px), `:101` (10 px).
- **Problem:** Explorer secondary text renders #8b9a9f at 8–10 px on near-white — ≈2.8:1 contrast.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Darken the muted token (see GL-07).

### EX-06 — P2
- **Location:** `App.tsx:432` (`paddingLeft: 10 + depth * 15`).
- **Problem:** Tree indentation uses a 10 px base with a 15 px step (10, 25, 40, 55…) — off the 4/8 grid.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** Use `8 + depth * 16` (or `12 + depth * 16`).

### EX-07 — P2
- **Location:** `app.css:92` (`.tree-expander` 17×23 px).
- **Problem:** The expander hit area is 17×23 px — below the 24 px minimum target and the 28–36 px guidance.
- **Canonical reference:** SKILL Density.
- **Suggested correction:** ≥24×24 px hit area (padding), preserving the 17 px visual column.

### EX-08 — P2
- **Location:** `App.tsx:196` (`hasThemeProject` computed, never used) + `App.tsx:446-462`.
- **Problem:** A tree with no theme projects renders only Project/Resources/Unsupported rows with no empty-state guidance.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25/§26` (Explorer empty → Create/Open Project).
- **Suggested correction:** Render an empty state with an "Add Theme Project" action when `hasThemeProject` is false.

### EX-09 — P3
- **Location:** `App.tsx:430-441`.
- **Problem:** The tree has no `role="tree"`/`treeitem` and no arrow-key navigation.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Add tree roles, `aria-level`/`aria-expanded`, and arrow-key movement.

### EX-10 — P3
- **Location:** `App.tsx:429` fallback `▱`.
- **Problem:** Theme Project Group, Theme Project and Unsupported Files share the same fallback glyph.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §4`.
- **Suggested correction:** Distinct glyphs per node kind.

### EX-11 — P3
- **Location:** `app.css:89` (tree-row min-height 33 px).
- **Problem:** 33 px is off the 4/8 grid and drifts from the adjacent 29 px property-row rhythm.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** 32 px.

---

## Properties Problems

### PR-01 — P0
- **Location:** `App.tsx:910` (geometry inputs) → `App.tsx:867-886` `commitSelectionGeometryField`.
- **Problem:** X/Y/W/H number inputs commit on every keystroke: typing "12" commits "1" then "12" as two undoable commands; clearing a field commits `Number("") === 0`.
- **Why it is objectively problematic:** The widget visibly jumps between keystrokes, the undo stack is polluted, and clearing a field destructively resets position/size — the application's only editable numeric fields are unusable for precise entry.
- **Canonical reference:** SKILL UX principles §3/§5 + `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Local draft value per field; commit on blur/Enter only; treat empty as "pending", never as 0.

### PR-02 — P1
- **Location:** `App.tsx:910` (`disabled={… || multi || widget.locked}`, `type={multi ? "text" : "number"}`).
- **Problem:** Multi-selection `*` geometry fields are rendered disabled, so a new value cannot be typed to apply to all selected widgets.
- **Why it is objectively problematic:** `§8` (line 184) and Corrections `§9` (line 169) both require the `*` field to accept a value applied to every compatible selected object — a direct canonical violation that makes multi-select editing impossible.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §8` + `CANONICAL_CORRECTIONS §9`.
- **Suggested correction:** Render `*` fields enabled; on commit apply to all selected unlocked widgets of the same scene.

### PR-03 — P1
- **Location:** `App.tsx:910` + `app.css:353-357`.
- **Problem:** Geometry fields show single-letter labels ("X/Y/W/H") with no unit and no validation message; out-of-range values are silently clamped (`Math.max` at `App.tsx:878`) with no feedback.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (label + unit + validation message in one accessible form association).
- **Suggested correction:** Add explicit units ("scene units"), `aria-describedby` validation text, and a visible message when a value is clamped.

### PR-04 — P2
- **Location:** `App.tsx:906-921` (PropertyRow) vs `App.tsx:910` (geometry-editor) + `app.css:145-148, 353-357`.
- **Problem:** Read-only property rows and the editable geometry inputs share the same typographic treatment (right-aligned strong values); there is no visual language distinguishing editable fields from read-only metadata.
- **Why it is objectively problematic:** The user cannot tell at a glance what is editable; `§8` requires clear editable vs read-only state.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §8 Properties` + `§25 UI States`.
- **Suggested correction:** Give editable fields a distinct affordance (bordered input background) and keep read-only rows plain.

### PR-05 — P2
- **Location:** `App.tsx:907` (Validation row) vs `App.tsx:899` (`issueCount`).
- **Problem:** Validation is reduced to a count in one row; issues are never marked on the offending field/section and no navigation to the issue exists.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §26` (problem + reason + location + action).
- **Suggested correction:** Link validation issues to their sections/fields with per-field indicators and click-to-navigate.

### PR-06 — P3
- **Location:** `app.css:147` + `App.tsx:919` (asset Source row).
- **Problem:** Long values (e.g. `sourcePath`) truncate with ellipsis and no tooltip.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §8`.
- **Suggested correction:** Add `title` tooltips (or copy-on-click) for truncated values.

### PR-07 — P2
- **Location:** `App.tsx:904` (`inspector-context`, 63 px) vs `App.tsx:975` (canvas context bar selection readout).
- **Problem:** The inspector header duplicates the selection summary already shown in the canvas context bar, costing 63 px of vertical space with a redundant icon card.
- **Canonical reference:** SKILL Density (minimal redundant helper text/chrome).
- **Suggested correction:** Collapse the context card into the panel heading (name + type line) and drop the duplicated icon block.

---

## Toolbar Problems

### TB-01 / TB-02 — P1 (merged: also reported by agents GL-06, CV-07)
- **Location:** `App.tsx:975` canvas-context-bar — Align and Lock buttons.
- **Problem:** Both buttons are hard-coded `disabled` with `title="Requires a selected widget"`, but they never enable even with widgets selected.
- **Why it is objectively problematic:** The disabled reason is factually wrong once a selection exists — a false affordance and a permanent dead end.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` + `ui-ux-system SKILL §5`.
- **Suggested correction:** Implement Align/Lock gated on selection, or remove them; never show a stale disable reason.

### TB-03 — P1
- **Location:** `App.tsx:973` zoom `−`/`+` buttons.
- **Problem:** Icon-only zoom buttons have no `aria-label` and no `title`.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (icon-only controls need accessible label + tooltip).
- **Suggested correction:** Add `aria-label="Zoom out"/"Zoom in"` + `title`.

### TB-04 — P1
- **Location:** `app.css:133` (`.context-action`: 9 px font, 4/7 padding ≈19-21 px) vs `app.css:108` (`.studio-tool`: 11 px, 6/8 padding ≈28 px).
- **Problem:** Two adjacent toolbars in the same canvas column have ~19-21 px and ~28 px controls — no shared baseline, and the context bar is below the 28–36 px guidance.
- **Canonical reference:** SKILL Density + `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** Normalize context actions to the toolbar control-height token (see SP-01).

### TB-05 — P2
- **Location:** `App.tsx:931` (`.sim-status`) — no CSS rule exists (verified).
- **Problem:** The simulator status readout renders at the inherited 16 px default inside a 10 px toolbar, breaking the type scale.
- **Canonical reference:** SKILL Density + `UI_DESIGN_SYSTEM_V2 §25`.
- **Suggested correction:** Add a `.sim-status` rule (10 px, secondary color, tracked caps) aligned with the sim buttons.

### TB-06 — P2
- **Location:** `app.css:51` (`.menu-command kbd` — `--text-muted` at 10 px).
- **Problem:** Menu shortcut hints render at ≈2.9:1 contrast.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Use `--text-secondary` for kbd hints (see GL-07).

### TB-07 — P2
- **Location:** `app.css:110` (hover and `.active` share one declaration; no `:active`).
- **Problem:** Hover and selected states of studio tools are identical, so the toggled state (Grid/Snap/Select/Pan) is indistinguishable from hover.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` (hover lightly highlights; selected clearly shows).
- **Suggested correction:** Distinct, stronger selected treatment + pressed state.

### TB-08 — P2
- **Location:** `App.tsx:70-71, 973`.
- **Problem:** Zoom buttons stay enabled at the 50%/200% bounds and clamp silently.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25`.
- **Suggested correction:** Disable `−` at min and `+` at max.

### TB-09 — P2
- **Location:** `App.tsx:781/798/805/818` (Open Project, Project Settings, Theme Defaults, Command Palette).
- **Problem:** Disabled menu commands offer no reason; `§18` says unavailable commands are not shown, `§25` says disabled explains why.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §18/§25`.
- **Suggested correction:** Hide unavailable commands, or add reason tooltips; label future items per `§29` instead of presenting dead commands.

### TB-10 — P2
- **Location:** `App.tsx:931` Step button.
- **Problem:** Step is enabled when not idle but its handler only logs "Simulator step requested" — no observable effect.
- **Canonical reference:** `ui-ux-system SKILL §5` + `UI_DESIGN_SYSTEM_V2 §15`.
- **Suggested correction:** Implement real stepping or disable Step with an accurate reason.

### TB-11 — P3
- **Location:** `app.css:46/55/41` (menu-button 27 px, toolbar-button ~25 px, brand-mark 28 px).
- **Problem:** Three control heights inside one application bar.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23`.
- **Suggested correction:** Shared top-bar control-height token.

### TB-12 — P3
- **Location:** `App.tsx:858` (Asset Browser Import button).
- **Problem:** Permanently disabled Import button (title "Asset import command is a later phase") occupies the primary asset toolbar.
- **Canonical reference:** `ui-ux-system SKILL §5`.
- **Suggested correction:** Remove it until import exists, or render as an explicitly labelled "Not available in this build" placeholder.

---

## Settings Problems

### ST-01 — P1
- **Location:** `App.tsx:989` (Settings backdrop `onClick={() => setSettingsOpen(false)}`) and `App.tsx:988` (Binding Editor backdrop — same pattern).
- **Problem:** Clicking the backdrop closes the blocking modals without saving and without reverting the draft; the Settings draft survives into the next open.
- **Why it is objectively problematic:** `§17`/Corrections `§2` require a blocking modal where backdrop clicks do nothing and the only exits are Cancel (discard) or Save/Apply & Close; here a stray click exits with unsaved state silently retained.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §17` + `CANONICAL_CORRECTIONS §2`.
- **Suggested correction:** Ignore backdrop clicks; keep × = Cancel (revert + close) and document Escape = Cancel.

### ST-02 — P1
- **Location:** `App.tsx:171-172` (settingsDraft/savedSettings) vs consumers: `showGrid` never read (gridVisible is independent state at `App.tsx:156`), `compactDensity` never read, `confirmDestructive` never checked (`deleteSelectionCommand` at `App.tsx:272-283`); only `snapGridSize` is consumed (`App.tsx:472`).
- **Problem:** Three of the four saved settings have no effect on the application.
- **Why it is objectively problematic:** Controls that look functional and persist through Save are no-ops — a false affordance that violates the skill's no-dead-end rule and `§17` (saved settings apply).
- **Canonical reference:** `ui-ux-system SKILL §5` + `UI_DESIGN_SYSTEM_V2 §17`.
- **Suggested correction:** Wire each setting to its consumer (grid default → `gridVisible` init; density → body class; confirm → destructive commands) or remove the control.

### ST-03 — P1
- **Location:** `App.tsx:988-989` (both modals).
- **Problem:** No focus trap; Escape does nothing; focus can leave the `aria-modal` dialog into the background shell.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (focus stays in modal; Escape = Cancel documented).
- **Suggested correction:** Implement focus trapping + Escape-to-Cancel in both dialogs.

### ST-04 — P1
- **Location:** `App.tsx:988` (Binding Editor modal, `binding-layout` — display-only cards).
- **Problem:** The "Binding Editor" offers no way to add, edit, or remove a condition, action or operator — it is a read-only viewer presented as an editor.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §11` (row-based condition editing without raw JSON) + SKILL §5.
- **Suggested correction:** Add row-based add/edit/remove affordances, or rename the surface ("Binding Inspector") until editing exists.

### ST-05 — P1
- **Location:** `App.tsx:955` (Shortcuts page lists "R — 90° rotation").
- **Problem:** The Settings page presents R as a working shortcut although no R handler exists anywhere (verified: `handleCanvasKeyDown` at `App.tsx:715-746` handles only Escape/Ctrl+A/Delete/arrows).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §19` (R is CONFIRMED behavior — showing it without implementing it is a false affordance).
- **Suggested correction:** Implement the R handler or remove the row.

### ST-06 — P3
- **Location:** `App.tsx:950` ("Snap grid size" `settings-number`).
- **Problem:** The numeric input has no unit ("scene units"/px) and the label gives no context about what the number means.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (label + unit).
- **Suggested correction:** Add a unit suffix and a hint line.

---

## State Feedback Problems

### GL-03 — P1
- **Location:** `App.tsx:966` (`.dirty-indicator` rendered when `activeDocument === document`).
- **Problem:** The amber dirty dot appears on the active tab regardless of dirty state, and disappears from dirty inactive tabs.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §20` ("Dirty document başlığında belirgin işaret taşır").
- **Suggested correction:** Condition the dot on the document's dirty state, not on tab activation.

### GL-04 — P1
- **Location:** `App.tsx:986` + `app.css:173` (`.status-led` fixed `#43ae76`).
- **Problem:** The status LED is always green while the adjacent text can read "Foundation validation requires attention".
- **Why it is objectively problematic:** The green success affordance contradicts the failure text — state is misrepresented by a fixed color.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` + `§24`.
- **Suggested correction:** Derive the LED class from `validation.valid` (ok/error colors matching the text).

### SF-02 — P1
- **Location:** `App.tsx:973-974` (Design/Preview buttons) vs `App.tsx:465` (`activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? …` used in both modes).
- **Problem:** Switching Design/Preview changes only the rail label ("DESIGN STUDIO" / "RUNTIME PREVIEW") and the top-bar chip; the canvas content is identical in both modes.
- **Why it is objectively problematic:** A mode switch that communicates a behavioral change that does not exist violates `§6` (Design edits the selected Scene; Preview evaluates runtime context) and `§25` (states must be represented correctly).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §6 Canvas` + `§25`.
- **Suggested correction:** Make Preview actually evaluate bindings/active-scene rendering, or hide the switch until the distinction exists.

### SF-03 — P1
- **Location:** `App.tsx:931` (Simulator toolbar).
- **Problem:** Run only sets `simulationStatus = "running"` and logs; Pause and Step are log-only no-ops; nothing evaluates, animates or progresses.
- **Why it is objectively problematic:** The transport controls claim RUNNING/PAUSED while no simulation occurs — enabled controls that do nothing observable.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §15 Simulator` + `ui-ux-system SKILL §5`.
- **Suggested correction:** Implement real evaluation/progress for Run/Pause/Step, or disable them with an honest reason.

### SF-04 — P2
- **Location:** `App.tsx:963` (`mode-chip is-dirty/is-clean`) — no CSS rules exist (verified).
- **Problem:** The dirty chip's state classes are dead; only the text swaps between "Saved"/"Unsaved changes" with no visual emphasis.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25` + `§20`.
- **Suggested correction:** Style the dirty state distinctly (warning accent + icon) or drop the dead classes.

### SF-06 — P3
- **Location:** `App.tsx:322-343` (buildAndVerifyPackage — text statuses only).
- **Problem:** No loading/progress state exists anywhere in the app (canonical `§25` Loading: operation scope + cancel/retry).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25 UI States`.
- **Suggested correction:** Add a progress state to package build/verify (this becomes P1 when deployment lands).

### SF-07 — P2
- **Location:** `App.tsx:59-62` (`ConsoleEntry` has no time field) + `App.tsx:940`.
- **Problem:** Console entries show no timestamps, though `§16` specifies time + level + message.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §16 Console`.
- **Suggested correction:** Add a `time` field and render it (monospace, secondary color).

### SF-08 — P2
- **Location:** `App.tsx:907` (validation count row) vs `App.tsx:940` (issue list).
- **Problem:** Validation problems are visible only as console rows; the editor surfaces show a bare count with no per-field error state, navigation or recovery action.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §26` (problem + reason + location + action).
- **Suggested correction:** Mark offending sections/fields and add navigate/rerun actions (see PR-05).

### SF-09 — P3
- **Location:** `app.css:362` (context-menu disabled items — color only).
- **Problem:** Disabled context-menu commands are distinguished by color alone with no reason.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25/§24`.
- **Suggested correction:** Add reason text or hide unavailable commands.

### SF-10 — P3
- **Location:** `App.tsx:963` (`.live-dot` next to "Design Mode").
- **Problem:** A permanently green "live" dot next to a static mode label implies a live connection/state that does not exist.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §25`.
- **Suggested correction:** Remove the dot or bind it to a real state.

---

## Accessibility Problems

### GL-07 — P2 (primary contrast finding; also reported by EX-05, TB-06)
- **Location:** `app.css:16` `--text-muted: #8b9a9f` used at `:43` (brand subtitle), `:67` (tab note), `:81` (panel kicker), `:99` (tree detail), `:101` (panel footnote), `:51` (menu kbd) — 8–10 px text.
- **Problem:** Muted text renders at ≈2.9:1 on white/#f8fafb.
- **Why it is objectively problematic:** Fails the WCAG 4.5:1 threshold for normal-size text on the shell's primary labels.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (contrast at real Windows sizes).
- **Suggested correction:** Darken `--text-muted` to ≥#6f7d82 (≈4.6:1) or raise the affected labels to `--text-secondary`.

### AX-01 — P1
- **Location:** `App.tsx:780-786` (menu shortcuts Ctrl+N/Ctrl+S/Ctrl+Z/Ctrl+Y) vs the only key handler `App.tsx:715-746` (Escape/Ctrl+A/Delete/arrows). Verified: no other `keydown`/shortcut handling exists in `src/`.
- **Problem:** Menus display shortcuts that are not implemented; Ctrl+S/Ctrl+Z/Ctrl+Y/Ctrl+N do nothing at application level.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §19` (CONFIRMED shortcut table) + `§25`.
- **Suggested correction:** Implement the CONFIRMED shortcuts globally, or remove the `<kbd>` hints until they work.

### AX-02 — P2
- **Location:** `App.tsx:962` (menu buttons/popover).
- **Problem:** Menu buttons lack `aria-haspopup`/`aria-expanded`; the popover has no `role="menu"`/`menuitem`; no arrow-key navigation and no Escape-to-close-menu.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` (Menu Bar must take keyboard focus).
- **Suggested correction:** Add ARIA menu semantics + arrow/Escape handling.

### AX-03 — P2
- **Location:** `App.tsx:966` (`role="tablist"`/`role="tab"`).
- **Problem:** Document tabs declare tab roles but have no `aria-controls`, no tabpanel association, and no arrow-key roving.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Complete the tab pattern or remove the roles.

### AX-04 — P2
- **Location:** `app.css:119` (`#71868c` on `#dfe7e9` ≈3.2:1), `:161/166` (`#708a8e`/`#698287` on `#17272d` ≈3.2:1), `:122` (`#9bb0b3` on `#22343a` at 7 px).
- **Problem:** Canvas rail label, console scope/muted text and device frame text all fail 4.5:1.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Raise each pair to ≥4.5:1 (and see TY-03 for size).

### AX-05 — P3
- **Location:** `App.tsx:986` (statusbar), `App.tsx:940` (console).
- **Problem:** No `aria-live` region announces status/console/validation changes to assistive technology.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24/§26`.
- **Suggested correction:** Add polite `aria-live` to the statusbar and console message lists.

### AX-06 — P2
- **Location:** `App.tsx:828-830` (panel header actions `title` only), `App.tsx:973` (zoom buttons — no label at all, see TB-03).
- **Problem:** Icon-only controls rely on `title` tooltips without `aria-label`; `§24` requires both accessible label and tooltip.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24`.
- **Suggested correction:** Add `aria-label` to every icon-only control (panel actions, zoom, tab close).

### AX-07 — P2
- **Location:** `app.css:122/171/253` (7–9 px text surfaces) + `TY-03/TY-04`.
- **Problem:** Sub-10 px text across device frame, statusbar and console.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §24` + SKILL Density.
- **Suggested correction:** Enforce a 10 px minimum for application UI text.

**Cross-referenced accessibility findings (primary entries elsewhere):** EX-02/EX-09 (tree selection semantics, tree roles), CV-02 (focus visibility on canvas), PR-03 (geometry input label/unit/validation association), TB-03/TB-06 (zoom labels, kbd contrast), ST-03/ST-05 (modal focus trap/Escape; R shortcut), EX-07 (expander target size), GL-08 (splitter keyboard resize).

---

## Design System Violations

### VC-01 — P1
- **Location:** `app.css` throughout (raw values outside `:root`).
- **Problem:** ~60 one-off hex values bypass the token layer, including four drifting families: accent (#13949a/#08757c vs #4abec2/#38aeb2/#62dfe0/#39aeb0/#19898f/#0d5e67/#8ac9cb/#9dcfd1), success (#27845b vs #43ae76/#45b77b/#158164), warning (#a67627 vs #f0c36a/#d5ad63), error (#b64c4c vs #d66b6b/#e38383), plus ~30 neutral one-offs (#e1e8ea, #d8e2e4, #e2e9eb, #f4f8f9, #f1f6f7, #eaf3f4, #e8edef, #e7edef, #f5f8f9, #f7fafb, #edf2f3, #aebfc3, #b9dbdd, #c7dcde, #cad7da, #bde0e2, #e0e8ea, #182b31, #30474d, #40595f, #8ea5a9, #e3f1f1, #b8cccd, #708a8e, #a8cdd0, #698287, #658084, #9bb0b3, #314950, #304950, #789296, #bdd0d0, #668085, #7c9095, #71868c, #aebbbf, #b7c8ca, #1d3036, #d7fbfb, #eafefe …).
- **Why it is objectively problematic:** `§23` mandates a semantic token layer; scattered raw values are exactly what the spec forbids and make every future restyle error-prone.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23 Design Tokens`.
- **Suggested correction:** Collapse every value into the canonical families (`accent/accent-hover/accent-muted`, `success/warning/error`, `border-subtle/strong`, `device-frame/device-surface`, etc.); keep raw hex only in `:root`.

### VC-02 — P1
- **Location:** `app.css:26` (`--shadow` 0 8px 22px), `:39` (0 1px 4px), `:121` (0 16px 30px), `:195` (0 12px 28px), `:359` (0 10px 28px), `:261/301` (0 20px 52px).
- **Problem:** Six distinct shadows with no elevation scale; the canonical `shadow-panel/shadow-floating/shadow-dialog` tokens are absent.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23` (Elevation token group).
- **Suggested correction:** Define the three canonical elevation tokens and map every shadow to them.

### IC-01 — P1
- **Location:** `App.tsx` icon glyphs (◈ ◇ ▧ ▣ ▤ ▱ ⊘ ♫ ▶ ↖ ✥ ▦ ⌁ ⚙ ⤢ − × ▾ ▸ Ⅱ ↺ ⌘).
- **Problem:** The entire icon system is raw Unicode glyphs with no icon component/token, no size scale, and font-dependent rendering (glyphs like ⚙ ⤢ ⌁ ✥ fall back differently across Windows fonts).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §23/§24` + SKILL (icon consistency).
- **Suggested correction:** Introduce an icon layer (SVG set + size tokens) and replace glyphs progressively.

### IC-02 — P1
- **Location:** `App.tsx:429` (tree icons), `:861` (asset category icons), `:966` (document tab icon).
- **Problem:** Meaning collisions: `▧` means Rotation node, image asset type AND document tab; `◈` means Scene node AND Scene Content category; `▱` is the default tree fallback AND the Asset Depot icon.
- **Why it is objectively problematic:** One glyph with three meanings destroys scannability of the type hierarchy (`§4`).
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §4` + `§23`.
- **Suggested correction:** Unique semantic icons per concept (see EX-03/EX-10 for the tree mapping gaps).

### VC-07 — P3
- **Location:** Verified dead/unwired CSS: `.canvas-empty-state` (`app.css:124-127`), `.empty-glyph` (`:127`), `.canvas-overlay-note` (`:128`), `.console-time` (`:164`), `.explorer-panel`/`.properties-panel` (`:76-77`); classes used with no CSS: `.sim-status`, `.mode-chip.is-dirty/.is-clean`.
- **Problem:** Dead CSS and orphan classes accumulate in the design system layer.
- **Canonical reference:** SKILL (no scattered/unused values).
- **Suggested correction:** Wire or remove each; add a dead-CSS check to CI.

### RS-06 — P3
- **Location:** `app.css:325-328` (`@media (max-width:780px)` binding dialog) vs `app.css:30` (`min-width:1080px`).
- **Problem:** The 780 px breakpoint is unreachable because the app enforces a 1080 px minimum width — dead responsive code.
- **Canonical reference:** `UI_DESIGN_SYSTEM_V2 §21`.
- **Suggested correction:** Remove the unreachable breakpoint or lower the app minimum consistently.

### Token inventory summary (measured)

| Canonical token group (`§23`) | Present in `:root` | Reality in code |
|---|---|---|
| Surfaces | Partial (`app-bg`, `surface`, `panel`, `panel-alt`, `canvas-bg`) | ~15 additional raw surface colors bypass tokens |
| Borders | Partial (`border`, `border-strong`) | `border-subtle` missing; raw `#e8edef/#e7edef/#e5ecee` variants |
| Text | Partial (`text`, `text-secondary`, `text-muted`) | `text-on-dark-preview` missing; muted token fails contrast |
| Accent | Partial (`accent`, `accent-dark`, `accent-soft`) | 8 raw accent-family values drift outside tokens |
| Status | Partial (`success`, `warning`, `error`) | 7 raw status variants (success ×4, warning ×3, error ×3) |
| Canvas | Missing | `device-frame/surface/grid-major/grid-minor/guide` all raw (`#22343a`, `#17272d`, `#0d1a1f`, `#f0c36a`, `#df8ad6`) |
| Focus | Missing | `focus-ring`/`keyboard-focus` absent; 3 different focus treatments |
| Elevation | Missing | 6 raw shadows, no `shadow-panel/floating/dialog` |
| Spacing/control | Missing | No size/height tokens; heights 19–63 px ad hoc |
| Typography | Missing | No font-size/weight/leading tokens; 11 raw sizes |

---

## Priority Fix Matrix

| Priority | ID | Location | Key correction |
|---|---|---|---|
| **P0** | PR-01 | `App.tsx:910` geometry inputs | Draft-per-field; commit on blur/Enter; empty ≠ 0 |
| **P1** | GL-01 | `app.css:180` media override | Remove `!important` 3-track override |
| **P1** | GL-02 | `app.css:121` device clamp | Fit device frame to stage |
| **P1** | GL-03 | `App.tsx:966` dirty dot | Dot follows document dirty state |
| **P1** | GL-04 | `App.tsx:986` status LED | LED state derived from `validation.valid` |
| **P1** | DK-01 | `App.tsx:828-830` header actions | Stop mapping close → collapse |
| **P1** | DK-02 | `app.css:195-201` floating panels | Draggable + re-dockable floating panels |
| **P1** | SP-01 | Control heights app-wide | Shared control-height tokens (24/28 px) |
| **P1** | TY-01 | All font sizes | Typography scale tokens |
| **P1** | TY-03 | `app.css:122` 7 px header | ≥9-10 px device frame text |
| **P1** | CV-02 | `App.tsx:775/974` | `:focus-visible` for canvas elements |
| **P1** | CV-03 | `App.tsx:974` | Render the canvas empty state |
| **P1** | CV-06 | `App.tsx:775` invisible ghost | Don't render invisible widgets |
| **P1** | PR-02 | `App.tsx:910` multi `*` | Editable `*` applied to all selected |
| **P1** | PR-03 | `App.tsx:910` geometry fields | Units + validation messages + clamp feedback |
| **P1** | TB-01/02 | `App.tsx:975` Align/Lock | Implement or remove; honest disable reasons |
| **P1** | TB-03 | `App.tsx:973` zoom buttons | `aria-label` + `title` |
| **P1** | TB-04 | `app.css:133` context actions | Toolbar control-height token |
| **P1** | ST-01 | `App.tsx:988-989` backdrops | Blocking modals: ignore backdrop clicks |
| **P1** | ST-02 | `App.tsx:171-172` settings | Wire showGrid/density/confirm to consumers |
| **P1** | ST-03 | `App.tsx:988-989` modals | Focus trap + Escape = Cancel |
| **P1** | ST-04 | `App.tsx:988` Binding Editor | Add row-based editing affordances |
| **P1** | ST-05 | `App.tsx:955` R shortcut | Implement or remove the R row |
| **P1** | SF-02 | `App.tsx:973-974` mode switch | Make Preview evaluate runtime, or hide switch |
| **P1** | SF-03 | `App.tsx:931` Simulator | Real Run/Pause/Step behavior or disable |
| **P1** | EX-01 | `App.tsx:844` Expand | Expand by real node ids |
| **P1** | EX-02 | `App.tsx:432/436` | `aria-selected` + non-color selection cue |
| **P1** | EX-04 | `App.tsx:459-460` | Non-selectable pseudo-nodes (or real targets) |
| **P1** | EX-05 | `app.css:16` muted token | Contrast ≥4.5:1 |
| **P1** | AX-01 | `App.tsx:780-786` shortcuts | Implement CONFIRMED shortcuts or remove hints |
| **P1** | VC-01 | Raw hex values | Collapse into semantic tokens |
| **P1** | VC-02 | 6 raw shadows | `shadow-panel/floating/dialog` tokens |
| **P1** | IC-01 | Unicode glyphs | Icon layer with size tokens |
| **P1** | IC-02 | `App.tsx:429/861/966` | One glyph per concept |
| **P2** | GL-05 | `App.tsx:940` console | Scrollable console with full buffer |
| **P2** | DK-03 | `App.tsx:937-942` console chrome | Unified panel headers |
| **P2** | DK-05 | `panel-manager.ts:15-22` | Real tab stack (no silent collapse) |
| **P2** | RS-07 | `app.css:62` tabs | Tab overflow affordance |
| **P2** | SP-02 | `app.css:36/105/214` | On-grid shell/toolbar/console rows |
| **P2** | SP-04 | Row heights 29/33/43 | One list-row token |
| **P2** | SP-06 | Headers 52/63 px | One panel header height |
| **P2** | TY-02 | `app.css:2` Inter stack | Bundle or drop Inter |
| **P2** | TY-04 | `app.css:171/253` | 10 px minimum for status/console |
| **P2** | TY-05 | `app.css:144-145` | Section titles dominate content text |
| **P2** | VC-03 | Six button recipes | One `.btn` base + variants |
| **P2** | VC-04 | Input focus treatments | One `--focus-ring` treatment |
| **P2** | SF-05 | `app.css:33` disabled | Disabled state + reason, not opacity alone |
| **P2** | CV-01 | `App.tsx:578-593` pan | Pan tool works over widgets |
| **P2** | CV-04 | `app.css:123` zoom clipping | Frame scales with zoom / scroll + fit reset |
| **P2** | CV-05 | `app.css:115-116` grid | Grid on device screen in scene units |
| **P2** | CV-08 | `app.css:121` | See GL-02 |
| **P2** | CV-12 | `App.tsx:974` "R0" fallback | "No rotation" when undefined |
| **P2** | CV-14 | `App.tsx:285-293` duplicate | Duplicate mode (click-to-place, Esc) |
| **P2** | PR-04 | `App.tsx:906-921` | Visual distinction editable vs read-only |
| **P2** | PR-05 | `App.tsx:907` validation | Per-field issue indicators + navigation |
| **P2** | PR-07 | `App.tsx:904` inspector header | Merge context into panel heading |
| **P2** | TB-05 | `App.tsx:931` sim-status | Add `.sim-status` style |
| **P2** | TB-06 | `app.css:51` kbd | `--text-secondary` for shortcuts |
| **P2** | TB-07 | `app.css:110` tool states | Distinct selected vs hover + pressed |
| **P2** | TB-08 | `App.tsx:973` zoom limits | Disable at min/max |
| **P2** | TB-09 | `App.tsx:781-818` menus | Hide unavailable or explain disabled |
| **P2** | TB-10 | `App.tsx:931` Step | Real step or disabled |
| **P2** | SF-04 | `App.tsx:963` dirty chip | Style dirty state (or drop dead classes) |
| **P2** | SF-07 | `App.tsx:59-62` console | Timestamps on console entries |
| **P2** | SF-08 | `App.tsx:907/940` | Link issues to fields + recovery actions |
| **P2** | GL-07 | `--text-muted` | Darken to ≥#6f7d82 |
| **P2** | AX-02 | `App.tsx:962` menus | Menu ARIA + keyboard navigation |
| **P2** | AX-03 | `App.tsx:966` tabs | Complete tablist pattern or drop roles |
| **P2** | AX-04 | `app.css:119/161/166/122` | Fix remaining contrast pairs |
| **P2** | AX-06 | `App.tsx:828-830` | `aria-label` on all icon-only controls |
| **P2** | AX-07 | 7–9 px text | 10 px minimum UI text |
| **P2** | EX-03 | `App.tsx:100/429` | Match widget icon on nodeType |
| **P2** | EX-06 | `App.tsx:432` indentation | `8 + depth*16` grid-aligned indent |
| **P2** | EX-07 | `app.css:92` expander | ≥24×24 px hit area |
| **P2** | EX-08 | `App.tsx:196` | Explorer empty state with Add action |
| **P3** | GL-08 | `app.css:193` splitter | Larger hit area + keyboard resize |
| **P3** | GL-09 | `app.css:30-31` min sizes | Window-level min size instead of clipping |
| **P3** | GL-10 | `App.tsx:966` tab close | Reason tooltip or hide for sole tab |
| **P3** | DK-06 | `App.tsx:148-168` | Persist workspace layout |
| **P3** | DK-07 | `App.tsx:835-838` | Tab roles/aria on dock tabs |
| **P3** | DK-09 | `App.tsx:939` | `−` for collapse, `×` for close |
| **P3** | SP-05 | Tab heights 30/34/35 | One tab-bar height token |
| **P3** | SP-07 | Micro-gaps 3/6/10/18 | 4/8 scale gaps |
| **P3** | TY-07 | `app.css:147` truncation | Tooltips for truncated values |
| **P3** | TY-08 | `app.css:263/269` | Real heading scale |
| **P3** | TY-09 | Letter-spacing values | One micro-label token |
| **P3** | VC-05 | Separator colors | `--border-subtle` everywhere |
| **P3** | VC-06 | Radii 0/50%/7px/14px | Radius tokens |
| **P3** | VC-07 | Dead CSS inventory | Wire or remove; CI check |
| **P3** | RS-06 | `app.css:325-328` | Remove unreachable 780 px breakpoint |
| **P3** | CV-09 | `canvas-interaction.ts:279` | Consistent marquee/Ctrl+A selectable set |
| **P3** | CV-10 | `app.css:348-352` guides | Non-color guide distinctions |
| **P3** | CV-11 | `app.css:128` overlay note | Wire or remove |
| **P3** | CV-13 | `App.tsx:974/984` context menu | No dead menu on empty canvas |
| **P3** | PR-06 | `App.tsx:919` | Tooltip/copy for long values |
| **P3** | TB-11 | `app.css:46/55/41` | One top-bar control height |
| **P3** | TB-12 | `App.tsx:858` Import | Remove or label explicitly |
| **P3** | ST-06 | `App.tsx:950` snap size | Unit suffix + hint |
| **P3** | SF-06 | `App.tsx:322-343` | Progress state for build/verify |
| **P3** | SF-09 | `app.css:362` menu disabled | Reason text or hide |
| **P3** | SF-10 | `App.tsx:963` live-dot | Remove or bind to real state |
| **P3** | AX-05 | `App.tsx:986/940` | `aria-live` on status/console |
| **P3** | EX-09 | `App.tsx:430-441` | Tree roles + arrow navigation |
| **P3** | EX-10 | `App.tsx:429` fallback glyph | Distinct glyphs per node kind |
| **P3** | EX-11 | `app.css:89` tree row | 32 px row height |

**Cross-reference note:** TB-01/TB-02 absorb GL-06 and CV-07 (same defect reported by four agents); GL-07 absorbs EX-05 and TB-06; GL-02 absorbs CV-08 and RS-03; GL-01 absorbs RS-01; GL-09 absorbs RS-02; GL-05 absorbs RS-04; DK-02 absorbs RS-05.

---

## Methodology notes

- Every finding's file/line location was verified against the current working tree by the Lead architect after the agent fan-out; no finding relies on unverified claims.
- Intentional design choices were excluded (e.g. shell row heights 50/35/27 px are documented geometry, `§27` grid/snap separation is correctly implemented, the multi-selection `*` explanation note at `App.tsx:920` is correct, device-frame `aspect-ratio: 9/16` CSS fallback is overridden correctly by the inline style).
- Defects already acknowledged by the code itself (e.g. the Import button's honest "later phase" title) were rated as low-priority affordance issues rather than canonical violations, except where the canonical spec demands a different behavior (ST-02, SF-03).
- **DOMAIN CONTRADICTION FOUND** check: no new domain/UI contradictions were introduced; CV-06 (invisible widget ghosting) is a UI-vs-canonical contradiction already resolved by the canonical corrections document (§8), reported here as a violation, not a new domain decision.
