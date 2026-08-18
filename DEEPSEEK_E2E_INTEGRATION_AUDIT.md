# DEEPSEEK E2E INTEGRATION AUDIT — Template Designer V2
# WORKFLOW C — Full Product Integration & End-to-End Audit

> Audit mode: **read-only**. No application code modified, no commits created.
> Lead: Integration QA Engineer (Workflow C). Sub-agents: 14 scoped audit agents (WC-01 … WC-14).
> Status: **COMPLETE** — consolidated from 14 per-agent reports in `qa-workflow-c/findings/`.

---

## 1. Executive summary

Template Designer V2 (foundation shell, `manus2` @ `55bf0f4`) was audited end-to-end across feature interactions: project lifecycle, scene lifecycle, selection synchronization, canvas/core, properties/canvas, undo/redo, dirty state, keyboard/focus, settings/canvas, runtime/binding, explorer/canvas, Tauri lifecycle, error recovery, and stress/repetition.

**Baseline health is good.** Typecheck is clean, 51/51 unit tests pass, and the core mutation pipeline (`EditorApplication → DocumentStore → CommandHistory`) is well-architected: immutable clones, no-op rejection, exact undo/redo, eager before/after capture (deterministic redo), locked-geometry enforcement at the core boundary, and correct cancellation semantics (Escape/blur/pointercancel produce no history and no dirty state). Prior-audit findings (Agent 3 static list SA-01…SA-15) were verified **fixed** in the current code.

**However, the integration seams — exactly what Workflow C exists to test — carry 76 consolidated items** (74 defects + 2 info notes, after cross-agent deduplication of 139 raw findings): **0 Critical · 19 High · 39 Medium · 16 Low · 2 Info**. No *Critical* crash/corruption was confirmed statically; the Highs are dominated by **silent data loss, command mismatches, and UI surfaces that lie about state** — the failure types this workflow targets. Two environmental limits are recorded honestly: `cargo` is missing (Tauri compile checks blocked, same as Agent 4) and no live browser/Tauri run was available, so timing-dependent findings are labeled UNVERIFIED.

### Top consolidated defects (16 representative Highs)

1. **Save/"Saved"/"clean" is fiction** — `save()` only re-marks the in-memory baseline; no persistence backend exists anywhere, and the Tauri shell has no fs/dialog plugin and no close-with-unsaved interception → reload or window-close silently destroys all work. (LV-03 · WC-01-02 · WC-07-02 · WC-12-001 · WC-12-002)
2. **New Project silently discards dirty work**; the "Confirm destructive commands" setting is dead (no consumer). (WC-01-01 · WC-07-01 · WC-09-01)
3. **Cross-scene widget selection is silently subset** to the active scene by Delete/Duplicate/Nudge/Z-order — commands log success while skipping the rest of the selection. (LV-08 · WC-03-01 · WC-06-09 · WC-11-04)
4. **Mixed-kind selection (widget + scene/theme) routes to global delete/duplicate** — pressing Delete can remove an entire scene/theme beyond user intent. (WC-03-03 · WC-02-02)
5. **Keyboard geometry commands have no `canvasPointer.mode` guard** — nudge during a drag is committed then overwritten by the drag commit (spurious history entry, lost delta); Delete during a drag leaves a silent no-op commit. (WC-04-01 · WC-06-02 · WC-08-05 · WC-04-02)
6. **Integer/number simulator inputs store strings**; strict `===` evaluation means `equals/greater-than/less-than` never match and `not-equals` is inverted. (LV-01 · WC-10-01)
7. **Duplicating a widget clones bindings verbatim** — the copy's `binding.widgetId` still points at the original → `BINDING_WIDGET_MISMATCH` validation error immediately after Duplicate. (LV-02 · WC-10-06)
8. **Explorer-selected scene vs simulator-active scene diverge** — canvas, simulator card, and explorer/properties can show three different "active" scenes with no warning; scene-scoped edits land on the selected scene while the simulator claims another. (LV-09 · WC-02-01 · WC-10-03 · WC-04-07)
9. **Keyboard is hostage to focus** — clicking the canvas stage/rail background or deleting the focused widget drops focus to `<body>`, silently killing Delete/Arrows/Ctrl+A (root handler is focus-gated). (WC-08-01 · WC-08-02)
10. **Advertised shortcuts (Ctrl+S/Z/Y/N, R) are unbound** — menus and Settings→Shortcuts display them; no handler exists; Ctrl+S/Z leak to browser-native behavior. (LV-07 · WC-01-08 · WC-07-07 · WC-08-03 · WC-09-06)
11. **Document tabs are cosmetic** — one real document behind N label-keyed tabs; "switch document" changes nothing but a label; the active-tab dirty dot shows even when clean. (LV-04 · WC-01-03 · WC-01-04 · WC-07-03 · WC-07-05)
12. **Widget lock/visibility cannot be exercised from the UI at all** — `editWidgetProperties` is dead code (test-only caller), the context-bar Lock button is hard-disabled with a misleading title, and there is no widget-creation path (`addWidget` doesn't exist; a fresh project has zero widgets). Mission scenarios "Locking" and "Visibility" are therefore UI-inexecutable. (WC-11-01 · WC-11-02 · WC-05-08 · WC-05-09)
13. **Deleting the last Theme Project Group** leaves "Add Theme Project" enabled but a permanent silent no-op — recovery only via Undo/New Project. (WC-13-5)
14. **Settings `showGrid` is a pure no-op** (never read; grid driven by a separate toolbar state), and settings aren't persisted despite "Save / Apply & Close". (WC-09-03 · WC-09-04)
15. **Possible pan-revert on pointer release** — `lostpointercapture` is wired to the full cancel path which restores `initialPan`; release-inside-pointerup may synchronously re-enter and undo a just-completed pan. (WC-04-06 — UNVERIFIED, browser-timing dependent)
16. **History pollution from rapid input** — per-keystroke geometry commits (typing "350" = 3 undo steps) and per-key-repeat nudges (20 nudges = 20 undo steps), plus unbounded history stacks (~2 project clones per command). (WC-05-04 · WC-08-12 · WC-14-02 · WC-14-03 · WC-14-08)

---

## 2. Audit scope, method, and environment

| Item | Value |
|---|---|
| Repository | `C:\Users\b1601\Template_Designer` |
| Branch / HEAD | `manus2` @ `55bf0f4` (`Add Agent 4 integration regression audit`) |
| Stack | React 19 · TypeScript 5.9 · Vite 7 (127.0.0.1:1420) · Vitest 3 · Tauri 2 shell |
| Baseline | `npm.cmd run typecheck` **PASS** (0 diagnostics) · `npm.cmd test` **PASS** (6 files, 51/51) — re-verified by multiple agents |
| Tauri CLI | tauri-cli 2.11.4 |
| `cargo` | **Missing** → `tauri:check`/`tauri:build` blocked (environment block, also recorded by Agent 4 as A4-001) |
| Live UI runs | Not possible (no browser automation, no populated fixture). Each finding is labeled **CONFIRMED** (static proof, file:line) or **UNVERIFIED** (needs a live run). |

**Method.** 14 parallel sub-agents traced their feature surface through the canonical pipeline
`UI (src/App/App.tsx — single 992-line integration surface) → EditorApplication (src/Core/editor-application.ts, the only mutation path) → InMemoryDocumentStore/CommandHistory (document-store.ts, commands.ts) → Domain (models.ts)`
and cross-checked every consumer (canvas, explorer, properties, simulator, console, settings, validation, export, Tauri shell). Findings were cross-referenced and deduplicated by the lead; per-agent reports retain full evidence, repro steps, and invariant tables.

**Prior-audit continuity (dedupe).** Findings already fixed and NOT re-reported: Agent 3's SA-01 (drag threshold `< 4` — now `> POINTER_DRAG_THRESHOLD`), SA-03 (hidden widgets lacked `pointer-events:none` — now present, `app.css:296`), SA-05 (only 4 resize handles — now all 8), SA-06 (grid candidate unfiltered by threshold — now `distance <= threshold`), SA-07 (Shift+Arrow moved — now returns `null`), SA-08 (fixed view transform — now live zoom/pan), SA-11 (malformed geometry accepted — now `isValidGeometry` guarded), SA-12 (unscoped mutation — now `validScopedWidgetIds`). Agent 1 FND-01…05 and Agent 4's cleared items were also verified still fixed.

---

## 3. Architecture integration map (verified)

```text
src/App/App.tsx (single UI shell — all integration seams)
  ├─ selection / selectedIds / canvasPointer / geometryOverrides   (transient UI state)
  ├─ useSyncExternalStore(documentStore)                           (canonical document view)
  ├─ EditorApplication → InMemoryDocumentStore → CommandHistory    (mutations / undo-redo / dirty)
  ├─ canvas-interaction.ts (pure math: snap, hit-test, marquee, nudge)
  ├─ runtime.ts (selectActiveScene, evaluateBinding) ← simulator inputs (strings)
  ├─ validation.ts (validateProject — live memo)  ·  export.ts (build/verify package)
  └─ settings (draft/saved), document tabs (cosmetic), panels, menus, context menu
src-tauri/ — minimal Tauri v2 shell: app_version command (uncalled), no plugins,
             bundle.active=false, csp:null, devUrl localhost:1420 vs vite 127.0.0.1
```

Foundational facts established in this audit:
1. **One document exists.** Tabs are label strings only (`App.tsx:165-166`); the store holds a single project.
2. **No persistence anywhere** — no localStorage/fs/invoke/fetch in `src/`; Tauri shell exposes one unused `app_version` command.
3. **No UI path to create widgets, hide/lock/rename them** — `editWidgetProperties` (Core) has zero UI callers; context-bar Lock is hard-disabled.
4. **Preview Mode is label-only** (`viewMode` consumers change text only).
5. **`confirmDestructive`, `compactDensity`, `showGrid` are dead settings**; only `snapGridSize` is consumed (single source: move-snap `App.tsx:640`, resize-snap `:687`, nudge `:740` — verified consistent).
6. **`hitTest` and `activeBindings` are dead code** (defined, never consumed by the UI).

---

## 4. Scenario Matrix

| # | Scenario | Result | Key findings |
|---|---|---|---|
| P1 | Create → edit → save → edit → undo → redo | PASS core / FAIL persistence honesty | Store dirty/history transitions exact (WC-01 invariant table); "Save"/"Saved" is in-memory fiction (WC-01-02) |
| P2 | New Project while dirty / mid-drag / mid-modal | FAIL (dirty) / PASS (drag) / UNVERIFIED (modal) | Silent discard, `confirmDestructive` dead (WC-01-01); drag cancelled correctly; modal not reset; simulator/deployment state leaks (WC-01-07) |
| S1 | Scene A → select → modify → Scene B → select → Scene A | PASS core / FAIL surface sync | Geometry preview + interaction cleared on scene switch (App.tsx:754-758); selection persists cross-scene and commands silently subset (WC-02/03/04) |
| S2 | Explorer-selected vs simulator-selected scene | FAIL | Three surfaces can disagree (WC-02-01, WC-10-03); selection never reconciled (WC-04-07) |
| C1 | Select → drag → resize → snap → undo → redo | PASS (move) / FAIL (resize-snap) | Move/snap/undo/redo exact; right/bottom resize handles never snap, anchor can creep (WC-04-03); multi-resize min-clamp breaks alignment (WC-04-04) |
| C2 | Multi-select A+B → move → resize → snap → undo → redo | PARTIAL | Uniform move PASS; mixed locked/unlocked selection box ≠ dragged set, locked become snap targets (WC-04-05) |
| C3 | Drag → Escape / blur / pointercancel | PASS | No history, no dirty, preview cleared, pan restored (WC-04 S5 invariant table; WC-12 S1) |
| C4 | Sub-threshold drag (≤4 px) | PASS | `exceedsPointerDragThreshold` guard; no commit, preview cleared (WC-04 S6) |
| M1 | Mixed kinds / cross-scene multi-select → delete/duplicate/nudge/z-order | FAIL | Cross-scene widgets silently dropped (WC-03-01); mixed-kind delete removes whole containers (WC-03-03); z-order silent no-op cross-scene (WC-11-04) |
| M2 | Marquee / Ctrl+A with hidden+locked widgets | FAIL consistency | Marquee filters visible&&enabled; Ctrl+A selects everything; nudge moves hidden-but-unlocked invisibly (WC-08-04, WC-11-06) |
| L1 | Select → lock → drag → resize → keyboard | BLOCKED in UI | No lock control exists (Lock button hard-disabled; properties read-only; `editWidgetProperties` dead). Core-level locked guards verified working (tests + WC-11-03 contrast: z-order bypasses lock) |
| V1 | Hide → hit test → explorer select → show → interaction | BLOCKED in UI | No visibility control exists. Hidden-widget semantics verified: pointer/marquee/hitTest exclude; keyboard still selects (WC-04-08, WC-08-08) |
| D1 | Select → duplicate → move duplicate → undo → redo | PASS | Exact undo/redo, id-stable redo (WC-06 verified-correct notes); but selection stays on original |
| D2 | Duplicate ×N | FAIL | Copies stack at identical +10/+10 offset from the ORIGINAL; overlap; hitTest is dead code (WC-11-05, WC-14-01, LV-12) |
| E1 | Delete → undo → redo | PASS core / FAIL selection | Exact restore; selection not restored by undo (WC-03-05, WC-06-05); focused-widget delete drops focus to body → keyboard dead (WC-08-02) |
| K1 | Arrow → Mod+Arrow → Shift+Mod+Arrow → undo → redo | PARTIAL | Steps correct (grid, grid/10, grid×5; Shift-alone null); per-repeat history spam; grid=1 → 0.1 px fractional geometry (WC-08-12) |
| K2 | Ctrl+Z / Ctrl+S / Ctrl+N / R (advertised) | FAIL | Unbound — display-only (WC-08-03, WC-09-06) |
| K3 | Keyboard after focus loss to body | FAIL | Root handler is focus-gated; stage/rail clicks and deleted focused widgets kill keyboard (WC-08-01/02) |
| X1 | Change grid → snap → keyboard → change grid again | PASS | Single source of truth (`snapGridSize`, App.tsx:472) at all three consumers; threshold constant consistent (WC-09 S1) |
| X2 | Settings showGrid / confirmDestructive / compactDensity apply | FAIL | Dead settings; `showGrid` disconnected from toolbar grid (WC-09-01/02/03); backdrop keeps stale draft (WC-09-05); settings not persisted (WC-09-04) |
| Q1 | Edit property → canvas → undo → redo | PARTIAL | Commit path correct and undoable; per-keystroke history spam (WC-05-04); clearing a field commits 0/10 (WC-05-01); NaN input leaves stale text (WC-13-3) |
| Q2 | Property input fuzzing ("", "abc", −5, 1e12) | FAIL | `Number("")`→0 commit; NaN silently rejected without snap-back; 1e12 accepted → widget unrecoverable from canvas (WC-05-01/03, WC-13-1/3) |
| O1 | Create/open → canvas interaction → switch document | FAIL | "Document switch" changes a label only; no second document exists (WC-01-03); transient canvas state is cleared on tab switch (App.tsx:754-758) |
| R1 | Simulator integer state vs binding equality | FAIL | String vs number strict equality: equals/greater/less never match, not-equals inverted (WC-10-01); defaults never seeded (WC-10-11) |
| R2 | Duplicate widget with bindings → validate/runtime | FAIL | Copy's bindings point at original → BINDING_WIDGET_MISMATCH (WC-10-06) |
| T1 | Window blur during drag / close with unsaved / Save in shell | PARTIAL | Blur-cancel PASS (WC-12 S1); close-with-unsaved = silent total loss (WC-12-002); Save no-op (WC-12-001); devUrl host mismatch (WC-12-005) |
| F1 | Delete last scene/rotation/theme/group; failed build; malformed input | PARTIAL | Last-group → Add Theme Project silent no-op (WC-13-5); empty-theme project still builds "Verified package" (WC-13-6); failed capture can strand drag (WC-13-8); command atomicity verified safe (WC-13 verified) |
| Z1 | Rapid ops: 20 nudges, undo×100, duplicate×50, splitter pointercancel | PARTIAL | Undo×100 exact (WC-14); nudge/keystroke history flooding (WC-14-02/03); splitter listener leak on pointercancel (WC-14-04); unbounded history memory (WC-14-08) |

---

## 5. State Invariants — verified per scenario

The nine invariant surfaces (Document, Selection, Canvas preview, History, Dirty state, Active Scene, Active document, Explorer selection, Properties selection) were checked per scenario in every agent report.

**Invariants that hold everywhere (verified clean):**
- **Document** — no mutation path bypasses the store; all writes flow through `EditorApplication`; no-ops are rejected (`equalProject`).
- **Canvas preview** — transient only; cleared on commit, cancel, scene/document switch, unmount. Never persisted, never dirtied.
- **History** — one entry per logical command; none for no-ops/cancels/sub-threshold drags; redo deterministic (eager before/after capture — no uuid regeneration on redo); redo branch cleared on new command; cleared on New Project.
- **Dirty state** — exact serialize-compare vs saved baseline; correct across edit/save/undo/redo; canvas preview, simulator, settings, zoom/pan never dirty.

**Invariants that diverge (all have corresponding findings in §6):**
1. **Active Scene** — three-way divergence possible (explorer selection vs runtime active vs canvas) via the `resolvedSelection?.scene ?? runtime.activeScene ?? …` chain.
2. **Selection** — (a) cross-scene selections silently subset by scene-scoped commands; (b) mixed-kind selections mutate containers; (c) label snapshots go stale; (d) additive-deselect can null the primary label while ids remain; (e) undo/duplicate never reconcile selection; (f) runtime-driven scene change leaves stale cross-scene selection.
3. **Active document** — tabs are label strings; identity collisions (two `R0` rotations), stale tabs after node deletion, per-tab dirty dot independent of `isDirty`.
4. **Explorer/Properties selection** — both derive from the same React state, so they stay mutually consistent, but diverge from the canvas when (1) or (2) occur.

---

## 6. Consolidated Integration Findings

Raw findings (139, plus 8 info notes) were deduplicated across agents into **76 unique items (74 defects + 2 info notes)** below. IDs in parentheses are the source findings; severity is the maximum reported by any corroborating agent.

### 6.1 Persistence & document lifecycle

#### INT-01 — "Save"/"Saved"/"clean" describes a persistence that does not exist (High · persistence mismatch, UI misleading state · CONFIRMED)
- **Scenario:** P1/O1/T1. Edit → Save → reload/close → everything is gone while the UI said "Saved".
- **Evidence:** `App.tsx:243-246` (saveDocument = `documentStore.save()` + log); `document-store.ts:75-78` (baseline copy only); zero `localStorage|sessionStorage|indexedDB|fetch|invoke|fs` hits across `src/`; `src-tauri/src/lib.rs:10-13` registers no fs/dialog plugin. (LV-03 · WC-01-02 · WC-07-02 · WC-12-001)
- **Fix:** platform-neutral `ProjectPersistence` adapter (per AGENTS.md UI → Application Service → Platform/Deployment Adapter); until then relabel Save and show "not persisted".

#### INT-02 — Closing the Tauri window silently destroys all unsaved edits (High · dirty-state corruption, persistence mismatch · CONFIRMED)
- **Scenario:** T1. Dirty chip "Unsaved changes" → close window → total loss, no prompt.
- **Evidence:** zero matches for `onCloseRequested|preventClose|on_window_event` in repo; store is heap-only. (WC-12-002)
- **Fix:** `on_window_event(CloseRequested)` → invoke `isDirty` → prompt save/discard/cancel.

#### INT-03 — New Project silently discards dirty work; "Confirm destructive commands" is a dead setting (High · dirty-state corruption, UI misleading state · CONFIRMED)
- **Scenario:** P2. Dirty → New Project → no prompt, work gone.
- **Evidence:** `App.tsx:230-241` never reads `isDirty`/`confirmDestructive`; grep shows `confirmDestructive` only at `:171-172/947`. (WC-01-01 · WC-07-01 · WC-09-01)
- **Fix:** consume the setting as a guard (or remove it), warning whenever `isDirty`.

#### INT-04 — Document tabs imply N documents; the store holds exactly one (High · cross-document leakage, UI misleading state · CONFIRMED)
- **Scenario:** O1. Switch tabs → document/selection/history/dirty/canvas unchanged; only the label changes.
- **Evidence:** `App.tsx:165-166` string arrays; tab click only `setActiveDocument` (`:966`); store has one `currentProject`. (LV-04 · WC-01-03 · WC-07-05)
- **Fix:** real per-document state keyed by id, or rename the surface as navigation/views.

#### INT-05 — Active-tab dirty dot renders even when clean (Low · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:966` gated only on `activeDocument === document`; `app.css:65` warning color. (LV-13 · WC-01-04 · WC-07-03)

#### INT-06 — Tabs keyed by label → identity collisions and stale tabs (Medium · cross-Scene leakage · CONFIRMED)
- **Scenario:** two rotations both labeled `R0` (addRotation always adds angle 0) collapse to one tab; deleting a theme leaves its tab. (WC-01-05 · WC-07-05)
- **Fix:** key tabs by canonical node id.

#### INT-07 — Selecting a Theme shows the FIRST theme's first rotation on the canvas (Medium · wrong Scene mutation, UI misleading state · CONFIRMED)
- **Evidence:** `activeRotation`/`runtimeRotation` fall back to `group.themeProjects[0].rotations[0]` (`App.tsx:200/464`); theme selection never sets a rotation → edits land in the wrong theme silently. (WC-01-06)
- **Fix:** derive the active rotation from `resolvedSelection.theme?.rotations[0]`.

#### INT-08 — New Project leaves simulator runtime state, simulation status, and deployment status stale (Medium · cross-document leakage, stale state · CONFIRMED)
- **Evidence:** `createProject` (`App.tsx:230-241`) resets selection/tabs/preview but not `runtimeValues`/`runtimeSettings`/`simulationStatus`/`deploymentStatus`; a fresh project can report "Verified package". (WC-01-07 · WC-10-05)

#### INT-09 — Every project shares the hard-coded id `project-foundation` (Low · state divergence, persistence mismatch · CONFIRMED)
- **Evidence:** `factories.ts:28`; `App.tsx:232`. Any future id-keyed persistence/`expandedNodes` collides. (WC-01-09)

#### INT-10 — "Add Rotation" enabled but silent no-op on invalid display/missing profile (Low · command mismatch · CONFIRMED)
- **Evidence:** menu gates only `!resolvedSelection?.theme` (`App.tsx:804`) vs core guard (`editor-application.ts:148-149`); no feedback on `changed:false`. (WC-07-04)

### 6.2 Settings & their consumers

#### INT-11 — `showGrid` is a pure no-op; toolbar grid and settings grid are disconnected (High · state divergence, UI misleading state · CONFIRMED)
- **Evidence:** `savedSettings.showGrid` never read; grid driven by `gridVisible` (`App.tsx:156/973/974`). (WC-09-03)

#### INT-12 — `compactDensity` and `confirmDestructive` are dead settings (Medium · UI misleading state · CONFIRMED)
- **Evidence:** write-only at `App.tsx:171-172/947-948`. (WC-09-01 · WC-09-02 — `confirmDestructive` impact elevated in INT-03)

#### INT-13 — Settings are not persisted; "Save / Apply & Close" wording is misleading (Medium · persistence mismatch · CONFIRMED)
- **Evidence:** no storage anywhere; both setting states re-initialize per reload. (WC-09-04)

#### INT-14 — Backdrop click keeps the uncommitted settings draft; ×/Cancel reset it (Medium · stale state · CONFIRMED)
- **Evidence:** backdrop only `setSettingsOpen(false)` (`App.tsx:989`) vs ×/Cancel resetting the draft. (WC-09-05)

#### INT-15 — Shortcuts category advertises non-functional bindings (Medium · command mismatch · CONFIRMED)
- **Evidence:** `App.tsx:955` lists Ctrl+S/Ctrl+Z/R while no handler exists and no rotate command exists. (WC-09-06 — see also INT-30)

#### INT-16 — Visual grid is fixed 18 px and ignores `snapGridSize`; Canvas copy understates snap semantics (Low · state divergence, copy · CONFIRMED)
- **Evidence:** `app.css:116` (`background-size: 18px 18px`) vs `DEFAULT_GRID_SIZE=10`; `App.tsx:950` copy claims "UI defaults". (WC-09-07 · WC-09-08)

#### INT-17 — Settings dialog: no Escape-close, no focus trap, no autofocus (Medium · accessibility · CONFIRMED)
- **Evidence:** `App.tsx:989` dialog; shell Escape handler ignores overlays. (WC-09-09 · WC-08-09 · WC-08-06)

### 6.3 Selection & cross-scene consistency

#### INT-18 — Cross-scene widget selections silently subset by Delete/Duplicate/Nudge/Z-order (High · command mismatch, wrong Scene mutation · CONFIRMED)
- **Scenario:** M1. Select W1 in Scene A, Shift+select W2 in Scene B (canvas switches to B). Delete → only W2 deleted, W1 survives, success logged.
- **Evidence:** `selectedWidgetIds` filters to active scene (`App.tsx:484`); `deleteSelectionCommand`/`duplicateSelectionCommand` pass that subset (`:272-293`); nudge uses `selectedEditableWidgets` (`:744`); z-order returns false silently (`:295-303`). Contrast: properties geometry field DOES warn (`:867-872`). (LV-08 · WC-03-01 · WC-06-09 · WC-11-04 · WC-02-02)
- **Fix:** scene-scope the selection model, or operate per-scene across the whole selection with explicit partial warnings.

#### INT-19 — Mixed-kind selection silently deletes/duplicates container nodes (High · wrong Scene mutation · CONFIRMED)
- **Scenario:** select widget W + scene S (additive). Delete → `deleteSelection([W, S])` removes the whole scene including W's siblings; Duplicate similarly clones an entire scene beyond intent.
- **Evidence:** `widgetSelection = selectedIds.every(kind === "widget")` falls through to global `deleteSelection`/`duplicateSelection` (`App.tsx:274/287`). (WC-03-03 · WC-02-02)
- **Fix:** reject mixed-kind bulk mutations or require explicit container-only selections.

#### INT-20 — Explorer-selected scene and canvas-displayed scene diverge via the simulator (High · state divergence · CONFIRMED)
- **Scenario:** S2. Select Scene A; simulator activates Scene B → canvas, explorer/properties, and the simulator card can each show a different scene; edits land on the selected scene.
- **Evidence:** `App.tsx:465` chain `resolvedSelection?.scene ?? runtime.activeScene ?? …`; simulator card reads `runtime.activeScene` (`:932`). (LV-09 · WC-02-01 · WC-10-03)
- **Fix:** single source of truth for the canvas scene + explicit "runtime override" indicator.

#### INT-21 — Runtime-driven scene change never reconciles selection (Medium · stale selection · CONFIRMED)
- **Evidence:** effect `App.tsx:754-758` clears interaction/preview only; stale widget ids stay selected in explorer/properties while canvas commands no-op. (WC-04-07)

#### INT-22 — `sceneActivationOrder` is hard-coded `{}`; documented runtime-order tie-break never exercised (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:201` passes `{}`; `runtime.ts:81/89-91` falls back to array index; only the unit test supplies a real order. (WC-10-02 · WC-02-03)

#### INT-23 — Simulator evaluation silently follows explorer selection via `runtimeRotation` (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:200` derives the runtime rotation from selection; no indication in the simulator panel. (WC-10-04)

#### INT-24 — Selection label/detail snapshots go stale after rename/hide/lock (Medium · stale state · CONFIRMED)
- **Evidence:** `selectNode` stores label/detail at select time (`App.tsx:412`); properties header/status read the snapshot (`:197/904-906`). (WC-03-06)

#### INT-25 — Undo of delete never restores selection; duplicate keeps the original selected (Medium · lost selection · CONFIRMED)
- **Evidence:** delete clears selection (`App.tsx:279-280`); `undo()` touches only the store (`:222-224`); duplicate doesn't select the copy. (WC-03-05 · WC-06-05 · WC-11-05)

#### INT-26 — Additive-deselect of the primary node nulls the selection label while ids remain (Low · state divergence · CONFIRMED)
- **Evidence:** `App.tsx:407-410` rebuilds from `nextIds[0]` only if it's a widget. (LV-10 · WC-03-02)

#### INT-27 — Asset/root selection makes Delete/Duplicate silently no-op (Medium · command mismatch · CONFIRMED)
- **Evidence:** `deleteSelection`/`duplicateSelection` never touch `project.assets` or project/group roots (`editor-application.ts:220-305`); UI enables the buttons anyway. (WC-03-04)

#### INT-28 — Canvas context menu kind reads stale `selection?.kind`, not the hovered target (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:974` uses `selection?.kind ?? "canvas"`; `hitTest` exists but is never imported. (WC-03-07 · WC-11-07)

#### INT-29 — Ctrl+A selects hidden+disabled+locked widgets; nudge then moves hidden ones invisibly (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:728` no filter vs marquee `visible && enabled` (`canvas-interaction.ts:279`); `selectedEditableWidgets` filters locked only (`:485`). (WC-08-04 · WC-11-06)

### 6.4 Keyboard & focus

#### INT-30 — Advertised shortcuts Ctrl+S/Z/Y/N/R are unbound (High · command mismatch · CONFIRMED)
- **Evidence:** `handleCanvasKeyDown` (`App.tsx:715-746`) handles only Escape/Ctrl+A/Delete/Backspace/arrows; menus (`:780-786`) and Settings (`:955`) advertise the rest. (LV-07 · WC-01-08 · WC-07-07 · WC-08-03 · WC-09-06)

#### INT-31 — Keyboard is hostage to focus: stage/rail clicks and focus-less body kill Delete/Arrows/Ctrl+A (High · lost selection · CONFIRMED)
- **Evidence:** handler is `onKeyDown` on `.app-shell` (`App.tsx:959`); stage/rail are non-focusable divs (`:974`); body-target keydown never reaches it. (WC-08-01)

#### INT-32 — Deleting the focused widget drops focus to `<body>`; keyboard dies (High · lost selection · CONFIRMED)
- **Evidence:** widget has `tabIndex={0}` (`App.tsx:775`); Delete removes it; no focus restoration. (WC-08-02)

#### INT-33 — Escape only cancels canvas interaction; menus/modals/context menu stay open (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:719-724` early-returns; overlays close only by click. (WC-08-06)

#### INT-34 — Delete/Backspace/Arrows fire from any focused button (menu, tree, tab) and mutate the canvas selection (Medium · wrong Scene mutation · CONFIRMED)
- **Evidence:** exclusion list is INPUT/TEXTAREA/SELECT/contentEditable only (`canvas-interaction.ts:95-97`). (WC-08-07)

#### INT-35 — Modals lack focus management; Apply closes with focus on an unmounted button (Medium · lost selection · CONFIRMED)
- **Evidence:** `App.tsx:988-989` — no autofocus/trap/Escape; focus falls to body after Apply. (WC-08-09 · WC-09-09)

#### INT-36 — Hidden widgets remain keyboard-selectable (Tab → Enter/Space) despite `pointer-events:none` (Low · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:775` + `app.css:296`. (WC-04-08 · WC-08-08 · WC-11-06)

#### INT-37 — Nudge key-repeat = one history command per repeat; grid=1 → 0.1 px fractional geometry (Medium · history pollution, stale state · CONFIRMED)
- **Evidence:** `App.tsx:744-745` per-keydown commit; `calculateNudgeStep` `grid/10` with no integral minimum (`canvas-interaction.ts:99-103`). (WC-08-12 · WC-14-02)

### 6.5 Canvas ↔ Core

#### INT-38 — Mid-drag nudge commits canonical geometry, is overwritten by the drag commit; spurious history entry (High · state divergence, command mismatch · CONFIRMED)
- **Scenario:** drag (hold) → Arrow key → release. Two history entries; nudge delta lost; preview flickers.
- **Evidence:** no `mode` guard in `handleCanvasKeyDown` (`App.tsx:739-746`); commit from `widget.geometry`; pointerup recomputes from stale `canvasPointer.initial` (`:683-697`). (WC-04-01 · WC-06-02 · WC-08-05)
- **Fix:** early-return on `canvasPointer.mode !== "idle"` for mutation keys (mirror the property-input guard at `:910`).

#### INT-39 — Mid-drag Delete deletes widgets, then pointerup commit silently no-ops (Medium · command mismatch · CONFIRMED)
- **Evidence:** `App.tsx:734-738` no guard; `validScopedWidgetIds` rejects the trailing move (`editor-application.ts:48-52`); no feedback. (WC-04-02)

#### INT-40 — Mid-drag Undo/Redo (toolbar) has no guard: pointerup commit applies to the post-undo document from a stale initial (Medium · state divergence · CONFIRMED-static, single-pointer-shielded)
- **Evidence:** toolbar buttons (`App.tsx:963`) enabled whenever history exists; capture currently shields single-pointer use — latent if keyboard bindings are added. (WC-06-04)

#### INT-41 — `lostpointercapture` wired to full cancel can re-enter during pointerup and revert a completed pan (High · state divergence · UNVERIFIED — browser event timing)
- **Evidence:** `App.tsx:974` binds both `onPointerCancel` and `onLostPointerCapture` to `cancelCanvasInteraction` (`:550-561` pan restore at `:556`); `releaseCanvasPointer` called first in pointerup (`:664`). Needs a live browser confirmation. (WC-04-06)
- **Fix:** separate cancel vs capture-loss handling; don't release capture before commit.

#### INT-42 — Resize snap only adjusts x/y — right/bottom handles never snap; anchored edge can creep (Medium · state divergence · CONFIRMED)
- **Evidence:** `snapGeometryWithTargets` emits `x`/`y` only (`canvas-interaction.ts:339-347`); `e/s/se` anchors displaced when the moving edge nears a target. (WC-04-03)
- **Fix:** snap per active handle (x+width / y+height for east/south).

#### INT-43 — Mixed locked/unlocked multi-selection: box includes locked, drag set excludes them silently; locked become snap targets (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `selectionBounds` from all selected (`App.tsx:765-766`) vs `editable` filter (`:583`); `otherWidgets` excludes only dragged ids (`:641`). (WC-04-05)

#### INT-44 — Multi-resize per-widget min-size clamp breaks relative alignment (Low · state divergence · CONFIRMED)
- **Evidence:** clamp applied after uniform transform (`App.tsx:654/695`), position untouched. (WC-04-04)

#### INT-45 — Duplicate stacks identical copies at +10/+10 from the ORIGINAL; selection stays on original (Medium · UI misleading state · CONFIRMED)
- **Scenario:** D2. Duplicate ×3 → overlapping copies; topmost is the first-created (hitTest is dead code, DOM order rules).
- **Evidence:** `duplicateWidget` (`editor-application.ts:83-90`); `duplicateSelectionCommand` doesn't reselect. (LV-12 · WC-11-05 · WC-14-01)
- **Fix:** select the copies; cascade the offset.

#### INT-46 — Lock blocks geometry but z-order bypasses the lock (Medium · command mismatch · CONFIRMED)
- **Evidence:** `calculateZOrderUpdates`/`setWidgetZIndicesInScene` have no `locked` check (`canvas-interaction.ts:52-71`, `editor-application.ts:253-258`). (WC-11-03)

#### INT-47 — Z-order tie-break leapfrogs siblings when ≥3 widgets share a zIndex (Low · command mismatch · CONFIRMED)
- **Evidence:** `calculateZOrderUpdates` neighbor swap semantics. (WC-11-12)

#### INT-48 — Splitter drag leaks window listeners on pointercancel/blur; logs a resize on no-movement click (Medium · stale state · CONFIRMED)
- **Evidence:** `beginResize` binds move/up without pointercancel/blur cleanup and logs unconditionally (`App.tsx:364-381`). (WC-08-10 · WC-12-007 · WC-14-04)

### 6.6 Properties ↔ Canvas

#### INT-49 — No widget-creation path exists; fresh projects have zero widgets (High · functional gap · CONFIRMED)
- **Evidence:** no `addWidget` in `EditorApplication`; `createEmptyProject` has no widgets; "Open Project" disabled; Import disabled. Every widget scenario is unreachable in a fresh project. (WC-11-01 · WC-05-09)

#### INT-50 — No UI control for visible/enabled/locked/rename; `editWidgetProperties` is dead code; Lock button permanently disabled with misleading title (High · functional gap, UI misleading state · CONFIRMED)
- **Evidence:** properties rows read-only (`App.tsx:909-911`); context-bar Lock `disabled` with "Requires a selected widget" (`:975`); `editWidgetProperties` called only from tests. Mission scenarios "Locking"/"Visibility" are UI-inexecutable. (WC-11-02 · WC-05-08)

#### INT-51 — Cross-scene geometry guard is unreachable (multi disables inputs; single always matches active scene) while the bulk paths stay silent (High · command mismatch · CONFIRMED)
- **Evidence:** `App.tsx:868-872` guard vs `:910` (`disabled={... || multi ...}`) and silent nudge/delete/duplicate. (WC-05-06)

#### INT-52 — Clearing a geometry field commits 0 (X/Y) or 10 (W/H); NaN input silently rejected with stale text left in the field (Medium · UI misleading state · CONFIRMED; render nuance UNVERIFIED)
- **Evidence:** `Number("") === 0`; `Math.max(field==="width"||"height" ? 10 : 0, value)` passes 0 through (`App.tsx:878`); blocked commit → no re-render → typed "abc" stays visible against the canonical model. (LV-11 · WC-05-01 · WC-13-1 · WC-13-3)

#### INT-53 — Per-keystroke `onChange` = one history command per keystroke (Medium · history pollution · CONFIRMED)
- **Evidence:** `App.tsx:910` commits in onChange; no debounce/commit-on-blur. Typing "350" = 3 undo steps. (WC-05-04 · WC-14-03)

#### INT-54 — Huge values (1e12) accepted with no canvas-bound clamp; widget unrecoverable from canvas (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `commitSelectionGeometryField` has no upper clamp (`App.tsx:874-879`). (WC-05-03)

### 6.7 Runtime & binding

#### INT-55 — Integer/number simulator values are strings; equals/gt/lt never match; not-equals inverted (High · state divergence, command mismatch · CONFIRMED)
- **Evidence:** `App.tsx:932` raw `event.target.value`; `runtime.ts:23-25` strict `===`; `:19-21` `isNumber`. Boolean checkbox path is consistent. (LV-01 · WC-10-01)
- **Fix:** coerce at the input or evaluator boundary using the declared `RuntimeValueType`.

#### INT-56 — Duplicated widgets keep bindings pointing at the original widget (High · wrong Scene mutation · CONFIRMED)
- **Evidence:** `duplicateWidget` clones bindings verbatim (`editor-application.ts:83-90`); `validation.ts:114-116` flags `BINDING_WIDGET_MISMATCH` immediately after Duplicate. (LV-02 · WC-10-06)
- **Fix:** remap `bindings[].widgetId` (and re-id bindings) in `duplicateWidget` — fixes scene/theme duplication by construction.

#### INT-57 — Setting `defaultValue` never seeded into runtime state; untouched settings never match (Medium · persistence mismatch · CONFIRMED)
- **Evidence:** `App.tsx:932` placeholder-only; `runtime.ts:36-37` unset → false. (WC-10-11)

#### INT-58 — Binding actions are display-only; Preview mode is label-only; Run/Pause/Step are inert toggles (Medium · functional gap, UI misleading state · CONFIRMED)
- **Evidence:** no consumer applies binding `action`/`contentId`; `viewMode` changes two labels (`App.tsx:963/974`); simulator buttons only set status (`:931`); `activeBindings` memo is dead. (WC-10-09 · LV-06 · WC-10-08)

#### INT-59 — Binding modal can outlive its widget (Delete key not excluded in modal) → "Widget/Unknown" stale modal (Medium · stale state · CONFIRMED)
- **Evidence:** modal has no excluded targets; `handleCanvasKeyDown` Delete runs; `bindingWidget` resolves undefined; modal fallback renders. (WC-10-07 · WC-05-11)

#### INT-60 — Binding modal copy "evaluated inside the active Scene" is false — evaluation is scene-independent (Low · UI misleading state · CONFIRMED)
- **Evidence:** `evaluateBinding` takes no scene (`runtime.ts:100-112`). (WC-10-08)

#### INT-61 — Foundation profile ships empty runtime registries, so all runtime/binding paths are inert by default (Low · functional gap · CONFIRMED)
- **Evidence:** `factories.ts:10-15` empty `runtimeStates/runtimeSettings/languages/fonts/styles`; UI handles empties gracefully. (WC-10-10)

### 6.8 Tauri / platform

#### INT-62 — "Build & Verify Package" produces a verified in-memory package, but no DeploymentManager/SD-card adapter is wired and no deploy UI exists (Medium · UI misleading state · CONFIRMED)
- **Evidence:** `App.tsx:322-343` builds/verifies directly; `PackageDeploymentManager`/`SDCardTarget` imported nowhere in runtime code; `sd-card-target.ts` throws "reserved for a later phase". Status says "Verified package" with no downstream transport. (WC-12-003)

#### INT-63 — `app_version` Tauri command is never invoked; the entire JS↔Rust boundary is unvalidated (Low · command mismatch · CONFIRMED)
- **Evidence:** `lib.rs:3-12`; zero `invoke(`/`@tauri-apps` imports in `src/`. (WC-12-004)

#### INT-64 — `devUrl` `localhost` vs Vite bind `127.0.0.1` (Low · config · CONFIRMED)
- **Evidence:** `tauri.conf.json:8` vs `vite.config.ts:6-10`; ports match (1420, strictPort). IPv6-resolution flakiness risk on Windows. (WC-12-005)

#### INT-65 — `csp: null` and `bundle.active: false` — no CSP, no installer output (Low · security/packaging note · CONFIRMED)
- **Evidence:** `tauri.conf.json:23-29`. (WC-12-006)

#### INT-66 — Blur effect re-subscribes every render (correct but churny); its missing dep array is load-bearing (Low · robustness note · CONFIRMED)
- **Evidence:** `App.tsx:748-752` no-deps effect; a `[]` dep array would capture a stale `canvasPointer` closure. (WC-12-008 · WC-04-09)

#### INT-67 — StrictMode dev double-mount double-instantiates the store (harmless); dev/prod behavioral difference (Info · CONFIRMED)
- **Evidence:** `main.tsx:11` + `App.tsx:139-143`. (WC-12-009)

### 6.9 Error recovery & robustness

#### INT-68 — Deleting the last Theme Project Group leaves "Add Theme Project" enabled but a permanent silent no-op (High · command mismatch · CONFIRMED)
- **Evidence:** `addThemeProject` needs a group id (`App.tsx:249` → undefined → false); menu item always enabled (`:803`); no "Add Group" command exists. Recovery: Undo/New Project only. (WC-13-5)

#### INT-69 — A project with zero Theme Projects still validates and builds a "Verified package" (empty manifest) (Medium · validation gap · CONFIRMED)
- **Evidence:** `validateProject` iterates groups but requires none; `buildDeploymentPackage` proceeds. (WC-13-6)

#### INT-70 — Failed `setPointerCapture` can strand the canvas in drag mode; no window-level pointerup fallback (Medium · stale state · CONFIRMED)
- **Evidence:** capture failure is swallowed (`App.tsx:517-520`); pointerup handler lives only on `device-screen` (`:974`); recovery only via Escape/blur. (WC-13-8)

#### INT-71 — No React ErrorBoundary anywhere; any render-phase throw unmounts the entire app (Medium · robustness · CONFIRMED)
- **Evidence:** `main.tsx` renders `App` directly. Command atomicity itself is verified safe (`commands.ts:33-38` — a throwing command leaves history and redo stack untouched). (WC-13 verified)

#### INT-72 — Dirty detection uses order/undefined-sensitive `JSON.stringify` equality, duplicated across two layers (~5 clones+serializes per mutation) (Low · latent fragility, scalability · CONFIRMED mechanism)
- **Evidence:** `document-store.ts:26-28/125` vs `editor-application.ts:9/131`; deterministic construction currently masks divergence; any future file-open path with non-canonical key order could phantom-dirty. (WC-07-06)

### 6.10 Stress & scale

#### INT-73 — Unbounded undo/redo stacks retain ~2 full project clones per command → O(N×project) memory (Medium · scalability · CONFIRMED)
- **Evidence:** `commands.ts:15-16` unbounded arrays; `editor-application.ts:129-136` clone before/after per command. (WC-14-08)

#### INT-74 — Per-pointermove `setGeometryPreview` + O(n) snap per move makes drag cost O(n) per frame with full re-render (Medium · scalability note · CONFIRMED)
- **Evidence:** `App.tsx:658` + `canvas-interaction.ts:311-331`. Fine at foundation scale; primary risk at 500+ widgets. (WC-14-16)

#### INT-75 — `expandedNodes` persists across New Project via fixed foundation ids (Low · stale state · CONFIRMED)
- **Evidence:** `factories.ts:19-28` fixed ids; `App.tsx:164` keyed by id; createProject doesn't reset expansion. (WC-11-12)

#### INT-76 — Verified-safe stress behaviors (Info — positive)
- Undo×100 / redo cycles exact; redo id-stable; no listener accumulation in blur effect; console buffer capped (slice(-24)); `geometryOverridesRef` is write-only but commit path correctly uses `canvasPointer.initial` (no stale-commit bug); StrictMode double-mount benign. (WC-14-06/07/12/14 · WC-04-09/10)

---

## 7. Severity rollup (consolidated)

| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | No statically-confirmed crash/corruption |
| High | 19 | INT-01, 02, 03, 04, 11, 18, 19, 20, 30, 31, 32, 38, 41*, 49, 50, 51, 55, 56, 68 |
| Medium | 39 | remaining INT items at Medium |
| Low | 16 | remaining INT items at Low |
| Info/notes | 2 | INT-67, INT-76 (design/positive notes) |

*INT-41 is High but UNVERIFIED (browser event timing); all other Highs are CONFIRMED statically.

**Raw per-agent counts** (before deduplication — 139 findings + 8 info):

| Agent | Scope | High | Med | Low | Info |
|---|---|---|---|---|---|
| WC-01 | Project lifecycle | 2 | 4 | 3 | — |
| WC-02 | Scene lifecycle | 2 | 2 | 2 | — |
| WC-03 | Selection synchronization | 2 | 5 | 3 | — |
| WC-04 | Canvas/Core | 2 | 4 | 4 | — |
| WC-05 | Properties/Canvas | 3 | 4 | 6 | — |
| WC-06 | Undo/redo lifecycle | 1 | 4 | 5 | — |
| WC-07 | Dirty-state | 1 | 1 | 5 | — |
| WC-08 | Keyboard/focus | 4 | 4 | 4 | — |
| WC-09 | Settings/Canvas | 1 | 6 | 2 | — |
| WC-10 | Runtime/binding | 3 | 7 | 1 | — |
| WC-11 | Explorer/Canvas | 4 | 5 | 3 | — |
| WC-12 | Tauri lifecycle | 2 | 1 | 5 | 4 |
| WC-13 | Error recovery | 1 | 6 | 3 | — |
| WC-14 | Stress/repetition | — | 6 | 6 | 4 |

---

## 8. Reproduction steps (consolidated)

Per-finding numbered UI repro steps live in the agent reports. Environment commands used for all verification:

```powershell
& npm.cmd run typecheck     # PASS — 0 diagnostics
& npm.cmd test              # PASS — 6 files, 51/51 tests
# & npm.cmd run tauri:check # BLOCKED — cargo not installed in this environment
```

Quick smoke repros for the top defects (all statically traced; a live browser confirms in minutes):
1. **Fake Save:** edit → Save → reload → content gone (INT-01).
2. **Dead confirm:** make dirty → Settings→General (checkbox on) → New Project → no prompt (INT-03).
3. **Cross-scene subset:** select widget in Scene A, Shift+click widget in Scene B, Delete → A's widget survives silently (INT-18).
4. **Mixed-kind delete:** select widget + its scene, Delete → whole scene removed (INT-19).
5. **Mid-drag nudge:** hold a drag, press Arrow, release → nudge lost, 2 history entries (INT-38).
6. **Simulator coercion:** (with any integer-state profile) type `5`, binding `equals 5` stays FALSE, `not-equals 5` shows TRUE (INT-55).
7. **Duplicate bindings:** duplicate a bound widget → validation shows `BINDING_WIDGET_MISMATCH` (INT-56).
8. **Keyboard dead zone:** marquee, click stage background, press Delete → nothing (INT-31).
9. **Unbound shortcuts:** edit, press Ctrl+Z → nothing (INT-30).
10. **Scene divergence:** select Scene A; simulator activates Scene B → canvas/simulator/explorer disagree (INT-20).

---

## 9. Recommended fixes (consolidated, design-level only)

**Cross-cutting architecture recommendations:**
1. **Persistence contract first.** Decide Phase-0's persistence story and make Save/Open/tabs/dirty chips honest about it. Wire `UI → Application Service → Platform/Deployment Adapter` per AGENTS.md (Tauri fs+dialog plugins or browser storage for localhost dev), then add `CloseRequested` interception (INT-01, 02).
2. **Selection scoping.** Anchor selection to a scene (or make every bulk command resolve ids per scene and report partial application); reject mixed-kind bulk mutations (INT-18, 19).
3. **Active-scene single source.** One derivation for the canvas scene with an explicit "runtime overrides selection" indicator; reconcile selection when the scene changes (INT-20, 21).
4. **Interaction re-entrancy.** Guard all mutation keys and toolbar undo/redo with `canvasPointer.mode !== "idle"`; separate pointercancel from lostpointercapture; give the splitter the canvas's cancellation surface (INT-38, 39, 40, 41, 48).
5. **Keyboard contract.** One shortcut registry driving both menu labels and the handler (bind or un-advertise); move the handler to window level with the existing input exclusion; restore focus after delete/Apply (INT-30, 31, 32, 34).
6. **Settings integrity.** A test asserting every settings field has a consumer; wire or remove `confirmDestructive`/`compactDensity`/`showGrid`; persist settings or rename the button; make backdrop-close = cancel (INT-03, 11, 12, 13, 14).
7. **Simulator typing.** Coerce runtime inputs to the declared `RuntimeValueType` at the input or evaluator boundary; seed `defaultValue`s (INT-55, 57).
8. **Duplicate integrity.** Re-parent internal references (bindings.widgetId, binding ids) when cloning; select the copies; cascade offsets (INT-56, 45).
9. **Editor UX basics.** Commit geometry on blur (one command per edit), reject empty/non-numeric input with snap-back, clamp to canvas bounds, minimum integer nudge step, bound history memory (INT-52, 53, 54, 37, 73).
10. **Close the capability gap.** A widget-creation path and visible/enabled/locked/rename controls are prerequisites for the Locking/Visibility scenarios; either implement or mark the controls "not in foundation" (INT-49, 50).
11. **Validation/export honesty.** Require ≥1 theme project for a "Verified package"; relabel "Verified package" until a real deployment transport exists (INT-69, 62).
12. **Robustness.** ErrorBoundary at the root; stable deep-equality for dirty detection; window-level pointerup fallback (INT-71, 72, 70).

**Prior-audit verification note.** All SA/FND findings from Agents 1/3/4 were re-verified fixed in the current HEAD; the defects above are newly discovered at the integration seams.

---

## 10. Agent reports

| Agent | Scope | Report |
|---|---|---|
| WC-01 | Project lifecycle | `qa-workflow-c/findings/01-project-lifecycle.md` |
| WC-02 | Scene lifecycle | `qa-workflow-c/findings/02-scene-lifecycle.md` |
| WC-03 | Selection synchronization | `qa-workflow-c/findings/03-selection-sync.md` |
| WC-04 | Canvas/Core integration | `qa-workflow-c/findings/04-canvas-core.md` |
| WC-05 | Properties/Canvas integration | `qa-workflow-c/findings/05-properties-canvas.md` |
| WC-06 | Undo/redo lifecycle | `qa-workflow-c/findings/06-undo-redo.md` |
| WC-07 | Dirty-state | `qa-workflow-c/findings/07-dirty-state.md` |
| WC-08 | Keyboard/focus | `qa-workflow-c/findings/08-keyboard-focus.md` |
| WC-09 | Settings/Canvas | `qa-workflow-c/findings/09-settings-canvas.md` |
| WC-10 | Runtime/binding | `qa-workflow-c/findings/10-runtime-binding.md` |
| WC-11 | Explorer/Canvas | `qa-workflow-c/findings/11-explorer-canvas.md` |
| WC-12 | Tauri lifecycle | `qa-workflow-c/findings/12-tauri-lifecycle.md` |
| WC-13 | Error recovery | `qa-workflow-c/findings/13-error-recovery.md` |
| WC-14 | Stress/repetition | `qa-workflow-c/findings/14-stress-repetition.md` |

## 11. Environment limitations (honest scope)

1. **No live browser/Tauri run** — pointer-capture timing, focus transitions, and pan-revert (INT-41) are static inferences; the two UNVERIFIED findings and all "needs live confirmation" notes must be re-checked in a running shell before release (same limitation Agent 4 recorded as A4-002).
2. **`cargo` missing** — Rust-side checks (`tauri:check`) could not run; the Rust shell itself was only statically audited.
3. **The widget-surface scenarios are structurally un-executable** in the current UI (no widget creation, no lock/visibility controls) — those scenario matrix rows are marked BLOCKED, not PASS.
