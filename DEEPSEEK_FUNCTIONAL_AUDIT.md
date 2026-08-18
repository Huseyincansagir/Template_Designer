# DEEPSEEK FUNCTIONAL AUDIT — Template Designer V2

**Workflow A — Full Functional & Logical Product Audit**

> **Produced by:** DeepSeek — Workflow A session (Lead Functional QA Architect)
> **This file is the ONLY repository artifact created by this session.**
> The other audit files in the repository root — `DEEPSEEK_UI_UX_AUDIT.md` (Workflow B) and `DEEPSEEK_E2E_INTEGRATION_AUDIT.md` + `qa-workflow-c/` (Workflow C) — were produced by different audit workflows and are NOT authored by this session.
> Runtime probe scripts used for live-browser evidence live outside the repository (system temp dir, `td-cdp/`) and were never added to this tree.

| Field | Value |
|---|---|
| Repository | Huseyincansagir/Template_Designer |
| Branch / HEAD audited | `manus2` @ `55bf0f49c60801b3fba1e740949b4b514741b8ae` (verified: `git rev-parse HEAD`, clean tree) |
| Audit mode | Read-only — **no application code, tests, or configuration modified**. The audit itself created no commits; this report was committed afterwards at the user's explicit request. |
| Method | 14 specialized sub-agent audits (SA-1…SA-14, all evidence file:line) + automated checks + **live browser execution** (Edge 151 headless driven over CDP at http://127.0.0.1:1420) |
| Canonical documents | `docs/DOMAIN_MODEL_V1.md`, `docs/BINDING_PARAMETRIC_SYSTEM_V1.md`, `docs/UI_DESIGN_SYSTEM_V2.md`, `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`, `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` (reconciled contract), `docs/AGENT3_*`, `docs/CANVAS_INTERACTION_REDTEAM_REVIEW.md`, `docs/ARCHITECTURE*.md`, `docs/TEMPLATE_SCHEMA_V1.md`, `docs/DEPLOYMENT_FORMAT.md`, `docs/RUNTIME_STATE_REGISTRY.md`, root `AGENTS.md`, root `Template Designer — Ana Proje Geliştirme Promptu.md` |

---

## Executive Summary

**VERDICT: FUNCTIONALLY INCOMPLETE — PHASE-0 FOUNDATION SHELL, NOT A WORKING EDITOR.**

The repository at HEAD `55bf0f49` contains a **genuine, well-tested foundation**: the canonical mutation pipeline (`EditorApplication.execute` → `DocumentStore` → `CommandHistory` → immutable replacement → snapshot → UI) is correct, every mutation is undoable, dirty-state computation is exact, locked-geometry is enforced in Core, and the Domain/Runtime/Validation/Export engines are coherent and largely conformant. TypeScript, the production build, and all **51 automated tests pass**.

But the **product is not functionally complete** — and the failure is in the *product layer*, exactly where the previous audits (Agent 3, Agent 4) claimed "PASS WITH WARNINGS" on the strength of static inspection:

1. **The editor cannot create a widget. At all.** No `addWidget` exists in Core, no command, no menu, no factory. The live app lets you build Theme → Rotation (R0 only) → Scene and then shows *"Scene contains no widgets"* with **no affordance to add one**. The entire canvas interaction contract (drag/resize/marquee/snap/nudge/z-order), the Properties inspector, and multi-selection are therefore **unexercisable in the running product**. *(Live-browser verified.)*
2. **"Save" is fake.** `InMemoryDocumentStore.save()` copies an in-memory reference and flips the chip to **"Saved"**, but nothing is written anywhere (no localStorage, no file, no Tauri command). `Open Project` is permanently disabled. **Live-browser verified:** create content → Save → reload → everything gone.
3. **The V1 deployment path does not exist.** `SDCardTarget.deploy()` unconditionally throws `SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED`. The exported package contains **no binary asset content** (JSON metadata files mislabeled `.png`), "verification" re-hashes the same in-memory strings it just built (no read-back), and `verified: true` is hard-coded into the built package before verification runs. V1's acceptance test (full SD-card workflow) cannot pass.
4. **Large parts of the visible UI are placeholders.** Align, Lock, Open Project, Project Settings, Theme Defaults, Command Palette, Import are dead/disabled controls; Design/Preview and Simulator Run/Pause/Step are cosmetic; confirmed keyboard shortcuts (Ctrl+Z/Y/S/N, R) are advertised but unbound; 3 of 4 Settings controls are stored but never consumed; Properties edits commit **per keystroke** and the W/H min-clamp corrupts typed values ("50" becomes "100", two history entries per digit).
5. **Previously-reported canvas defects are fixed, but the reconciliations are incomplete.** Agent 3's D4/F12 (renderer↔pointer transform mismatch), F10 (preview leak into Properties), and F13 (marquee mode) are **resolved at HEAD**. New deviations: the reconciled §4.8 says `marqueeSelection` must *reject* `contains`, but HEAD *implements* it (doc-vs-code contradiction); `primaryWidgetId` (§4.6.2) is absent; resize handles skip the primary-button guard; wrong-platform `Mod`+Arrow silently falls through to plain-Arrow movement.

**Defect counts (consolidated, calibrated):** 2 CRITICAL · 7 HIGH · 13 MEDIUM · 20 LOW · 5 UNVERIFIED. See the Priority Fix List (§22) — every finding carries ID, severity, expected vs actual behavior, evidence with file:line, affected files, canonical document, reproduction, and recommended fix.

---

## Runtime Verification (actually executed)

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` (via `cmd /c`, true exit code) | **PASS** (exit 0, no diagnostics) | tsc --noEmit clean |
| `npm test` | **PASS — 6 files / 51 tests** | vitest 3.2.7; note PowerShell shows exit 1 due to `npm notice` stderr noise — text output is all green |
| `npm run build` (true exit code) | **PASS** (exit 0) | tsc + vite build; 40 modules, dist emitted |
| `npm run tauri:check` | **BLOCKED BY ENVIRONMENT** | `cargo` is not installed on this machine (same block as Agent 4 A4-001); script resolves correctly |
| Live browser (Edge 151 headless, CDP-driven, http://127.0.0.1:1420) | **EXECUTED — see §17 Runtime Findings** | App boots; menu/toolbar/panel inventory captured; creation chain executed end-to-end; Save→reload data loss reproduced; Build-blocked-by-validation reproduced; dead controls confirmed |

---

## Functional Completeness Matrix

Legend: **P** = PASS, **∂** = PARTIAL, **F** = FAIL, **M** = MISSING, **U** = UNVERIFIED. Never infer PASS from source presence; "Actually works" reflects runtime or test-proven behavior only.

### A. Lifecycle / Core

| Feature | Canonical requirement | UI exists | Command exists | State exists | Persisted | Undoable | Tested | Actually works | Status |
|---|---|---|---|---|---|---|---|---|---|
| New Project | Project → Group → ThemeProject → **exactly R0/R90/R180/R270** → Scene (DOMAIN_MODEL_V1 §Theme Project) | Yes (toolbar + File menu) | Direct `store.create`, not a command | Yes — but **empty** (`themeProjects: []`, factories.ts:26-36) | **No** | n/a (resets) | Yes — test *encodes* the empty shape (foundation.test.ts:35-37) | Partial — creates an empty, non-canonical hierarchy | **F** |
| Open Project | File menu Open (UI_DESIGN_SYSTEM_V2 §5) | Rendered but `disabled: true` (App.tsx:781) | No | No | No | n/a | No | No — permanently disabled | **M** |
| Save | Persist document (AGENTS.md; TEMPLATE_SCHEMA_V1 serialization) | Yes (File→Save) | No | In-memory `savedProject` only | **No** | n/a | No (save() untested for I/O) | No — marks clean only; chip says "Saved"; reload discards (live-verified) | **F** |
| Document tabs | Real documents (ARCH_V2:84-107) | Yes — label strings only | No | `openDocuments: string[]` | No | n/a | No | No — decorative labels; close/activate touch no domain state | **F** |
| Add Theme Project | Group→ThemeProject (UI §4) | Yes | Yes | Yes | No | Yes | Yes (editor-pipeline:71-84) | Yes — live-verified | **P** |
| ThemeProject has 4 rotations | "tam olarak dört rotation" (DOMAIN_MODEL_V1:107-115) | Partial — only R0 creatable; no scaffold | `addRotation(angle)` exists; UI hardcodes angle 0 (App.tsx:259) | Yes | No | Yes | R90/R270 swap tested (editor-pipeline:90-95) | Partial — R90/180/270 unreachable from UI | **∂** |
| Rotation dims from DeviceProfile.display | No hard-coded resolution (AGENT2 plan; Agent 3 D3) | n/a | Yes (editor-application.ts:20-24,148-155) | Yes | n/a | n/a | Yes | Yes — live-verified R0 = 720 × 1280 from profile | **P** |
| Add Scene | Scene under Rotation (UI §4) | Yes (enabled only with selected Rotation) | Yes | Yes (`priority: 0` hardcoded, editor-application.ts:160) | No | Yes | Yes (editor-pipeline:102-118) | Yes — live-verified through full chain | **P** |
| Scene priority / conditions editing | Editable 0–10 priority + activation conditions (UI §6; DOMAIN §Condition) | Display-only rows (App.tsx:916) | No | Yes (models.ts:154-161) | No | n/a | Engine tested (domain-runtime:104) | No — read-only; `sceneActivationOrder: {}` hardcoded (App.tsx:201) | **∂** |
| Add Widget | Create Widget command + profile-driven Add flow (ARCH_V2:480; UI §7) | **None** | **None** (`addWidget` absent everywhere) | **None** | n/a | n/a | No | No — live-verified: "Scene contains no widgets" with no affordance | **M** |
| Rename (any node) | Rename per node type (UI §4) | No | No (editWidgetProperties dead) | No | n/a | n/a | mutator tested, UI path not | No | **M** |
| Hide/Show, Hide All/Show All | corrections §8:156; UI §7 | **None** | **None** | `visible` field only | n/a | n/a | No | No | **M** |
| Lock / unlock | Locked selectable, geometry immutable, other props editable (corrections §8:154) | Dead "Lock" button (App.tsx:975) | No (editWidgetProperties dead) | `locked` field | n/a | n/a | Core enforcement tested (editor-pipeline:301) | Core yes; UI no | **∂** |
| Delete selection | scene-scoped delete (ARCH §17) | Yes (menus/ctx bar/key) | Yes | Yes | No | Yes | global path tested; **InScene untested** | Yes (live log; undo tested) | **P** |
| Duplicate selection | capability only; fixed offset; NOT Ctrl+D; NOT Duplicate mode (reconciled) | Yes (toolbar + Widget menu) | Yes | Yes (+10/+10, editor-application.ts:83-90) | No | Yes | Yes | Partial — copy **not selected**, **not snapped** | **∂** |
| Undo / Redo | one gesture = one entry (ARCH §17) | Yes (toolbar + Edit menu) | Yes | Yes | n/a | Yes | Yes (16 editor-pipeline tests) | Yes | **P** |
| Dirty state | serialized compare (Agent 1 contract) | Yes (chip "Saved/Unsaved") | Yes | Yes | n/a | n/a | Yes (editor-pipeline:273-285) | Yes — but chip lies about durability (Save is no-op) | **P** (display) / **F** (durability) |
| Z-order ops (4) | bring forward/back, front/back (ARCH §8) | Yes — widget context menu only | Yes | Yes (zIndex) | No | Yes | helper tested; **InScene mutation untested** | Yes (static trace complete) | **∂** |
| Scene/widget reorder | moveScene/moveWidget reachable (ARCH §17) | **No** | Core methods exist (editor-application.ts:164-186) | Yes | n/a | Yes | Yes (editor-pipeline:120-164) | No — no UI caller; moveWidget also contradicts zIndex stacking (SA3-04) | **∂** |
| Persistence (project + settings) | reload restores work (AGENTS.md; SA9 canonical §2) | Save yes; Open no | No | No | **No** | n/a | No | No — live-verified data loss | **F** |

### B. Canvas interaction (reconciled contract, AGENT2 plan)

| Feature | Canonical requirement | UI exists | Command exists | State exists | Persisted | Undoable | Tested | Actually works | Status |
|---|---|---|---|---|---|---|---|---|---|
| 4 CSS px drag threshold | strict `>4`, screen-space | Yes | — | Yes | n/a | n/a | Yes (3.99/4/4.01 test:198-202) | Yes (pure; runtime unexercised — no widgets) | **P** |
| Scene/screen coords + fit-scale + letterbox + inverse | one shared transform for render & pointer (D4/F12) | Yes | — | Yes | n/a | n/a | round-trip tests :45-77 | Yes — **resolved at HEAD** (App.tsx:486-498) | **P** |
| Zoom / pan | reachable; viewTransform contract | Yes (buttons + Pan tool + middle-button) | — | Yes (50-200%) | No | n/a | Yes (:54-77) | Yes (pan term added unscaled vs §4.2 formula — L-06) | **P** |
| Primary pointer only | button 0 gates move/marquee | move/marquee yes; **resize handles missing the check** (App.tsx:595,610) | — | Yes | n/a | n/a | No | Partial | **∂** |
| Pointer capture / pointercancel / lostpointercapture / blur / Escape | cancel = zero history + exact restore | Yes (all five paths, App.tsx:517-561,705,719-724,748-763) | — | Yes | n/a | n/a | No runtime integration test | Static PASS; runtime U | **∂** |
| Locked widgets | selectable; excluded from geometry mutation (Core final authority) | Hit-testable yes; **Lock UI missing** | Core filters (editor-application.ts:193,203) | Yes | n/a | Yes | Yes (editor-pipeline:301) | Core yes; product flow unexercisable | **∂** |
| Invisible widgets | not hit-testable; Explorer-selectable; bounds; excluded from snap; **not rendered** | Partial — rendered as 65%-opacity ghost (app.css:296,334) | No Hide command | Yes | n/a | n/a | hit/marquee exclusion tested (:231-239) | Hit-test exclusion yes; "not rendered" **violated** | **∂** |
| Selection ordering | active-Scene document order + stable-ID tie-break + **primary widget** | Yes ordering; **no `primaryWidgetId`** (§4.6.2) | — | Yes | n/a | n/a | Yes (:97-100) | Ordering yes; primary missing; cross-scene additive leak (M-07) | **∂** |
| Marquee | inclusive edge-touch; `mode: "intersect"|"contains"` with contains **rejected** in V1 | Yes (Ctrl/Shift additive, empty clears) | — | Yes | n/a | n/a | Yes (:113-126) | intersect yes; **contains implemented despite locked contract** (L-02) | **∂** |
| Multi-selection resize | bbox transform; 8 handles | **Yes — all 8 handles at HEAD** (Agent 3 D10 superseded) | Yes | Yes | No | Yes | Yes (:128-149) | Pure math yes; runtime U (no widgets) | **∂** |
| Snap threshold 6 Scene units | scene-space; pass priority Grid>Edge>Center; per-axis; self-snap exclusion | Yes | Yes | Yes | n/a | Yes | Yes (:151,241) | Yes (pure; runtime U) | **P** |
| Multi-selection snap reference | selection bbox | Yes | Yes | Yes | n/a | n/a | Partial | Yes (static) | **P** |
| Keyboard nudge | Arrow=grid; Mod+Arrow=grid÷10; Shift+Mod=grid×5; Shift+Arrow=none; exact modifier sets; platform-exact Mod | Yes (App.tsx:715-746) | Yes | Yes | n/a | Yes | Yes (:204-229) | Math yes; **wrong-platform Mod falls through to plain Arrow** (L-03) | **∂** |
| Ctrl/Cmd+D | PROPOSED — not bound in V1 | Correctly unbound | n/a | n/a | n/a | n/a | grep-verified | Yes | **P** |
| One gesture = one history entry; commit from initial+delta | zero history on cancel/no-op | Yes | Yes | Yes | n/a | Yes | malformed-geometry no-history (:261-278); gesture-level integration untested | Static yes; runtime U | **∂** |
| Geometry validation on commit | reject NaN/±Inf/≤0 without history | Yes | Yes | Yes | n/a | Yes | Yes (:261-278); −Inf untested | Yes | **P** |
| Hit-test via pure `hitTest()` | §4.5 stacking-order hit-test | **Not called by App** — DOM event targeting + CSS stacking instead (D9) | dead-from-app | n/a | n/a | n/a | pure tested (:79-95) | Reachable cases behave (zIndex+DOM order), but the canonical helper is dead code | **∂** |

### C. Panels, Commands, Settings, Runtime, Deployment

| Feature | Canonical requirement | UI exists | Command exists | State exists | Persisted | Undoable | Tested | Actually works | Status |
|---|---|---|---|---|---|---|---|---|---|
| Explorer hierarchy view | Workspace→Project→Group→Theme→R0..R270→Scene→Widget (corrections §6) | Partial — no Workspace root; Resources/Unsupported pseudo-leaves never resolve | — | Yes (derived view, correct) | n/a | n/a | No | Tree renders full domain subtree; selection sync single-path and bidirectional | **∂** |
| Expand / Collapse All | toolbar controls (UI §4) | Yes — **wrong id keys** ("project"/"theme-group" vs real ids, App.tsx:164,844) | — | Yes | No | n/a | No | Expand-All no-op; Collapse-All doesn't fully collapse (depth<2 default) | **F** |
| Properties: X/Y/W/H | editable, commit on blur/Enter, validated | Yes (4 number inputs) | Yes | Yes | No | Yes | pipeline tested | **Per-keystroke commit; W/H min-10 clamp corrupts entry; no max bound; no error feedback** (H-03) | **F** |
| Properties: multi-select `*` | mixed → `*`; entering applies to all (corrections §9) | `*` shown; fields **disabled** for multi | No multi-apply command | Yes | n/a | n/a | No | Display yes; apply-to-all **absent** | **∂** |
| Properties: all non-geometry | zIndex/name/visible/locked/style/duration/binding editable (UI §8-13) | Display-only rows; no toggles/editors | `editWidgetProperties` dead | Yes | n/a | n/a | mutator tested only | Read-only | **F** |
| Binding editor | row-based authoring (BINDING_V1) | Modal is **read-only viewer** | No add/edit/delete mutators | Yes | No | n/a | eval tested | View-only | **∂** |
| Floor Mapping Editor | dedicated editor (BINDING_V1:70-112; corrections §12) | Read-only row only | No | Model+validation+export yes | No | n/a | validation tested | No editor | **M** |
| Audio policy surface | per-layer 0–100 priority/ducking/override (corrections §5) | **None** | **None** | Capability flags only | n/a | n/a | No | Absent | **M** |
| Parametric text `{FloorNumber}` + localized content | BINDING_V1:133-148 | **None** | **None** | **None** | n/a | n/a | No | Absent (0 grep hits) | **M** |
| Multilingual content | MULTILINGUAL_CONTENT_SYSTEM | **None** | **None** | `languages` field only | n/a | n/a | No | Absent | **M** |
| Runtime State/Setting registry | DeviceProfile-driven (DOMAIN §Runtime State) | Simulator rows (profile-driven) | — | Yes — **shipped profile EMPTY** (factories.ts:11-12) | n/a | n/a | Yes (test fixture) | Live app always shows "No state registry entries" | **∂** |
| Scene activation + bindings → presentation | engine + applied to render (BINDING_V1 core) | Simulator panel | Yes | Yes | n/a | Yes | Yes (domain-runtime:104-121) | **Bindings never applied to canvas render** (App.tsx:775 ignores match); simulator integer inputs store strings → `===` never matches (H-06, M-04) | **F** |
| Simulator | Runtime State panel; [Binding] console trace; Test Binding (BINDING_V1:195-209) | Panel yes; **Run/Pause/Step cosmetic** | No Test Binding | Yes | No | n/a | No | State inputs work; no trace; Step = log-only | **∂** |
| DeviceProfile switching | profile selector (ARCH_V2:546) | Read-only row | No | Fixed single profile | n/a | n/a | No | Absent | **M** |
| Settings modal | ONE blocking modal; 9 categories; Cancel discards; Save persists (corrections §2) | Yes — modal + all 9 categories | — | React state only | **No** | n/a | No | snapGridSize consumed live; **showGrid/compactDensity/confirmDestructive dead**; backdrop click closes without draft reset | **∂** |
| Validate Project | shared validation service + UI (ARCH §15) | Yes (auto + menu command) | Yes | Yes (~34 rules) | n/a | n/a | Partial (core rules) | Yes — live-verified: validation blocks Build ("Blocked · validation failed") | **∂** (missing canonical rules, M-08) |
| Build package | Project → Package Builder → Deployment Package (AGENTS.md) | Yes ("Build & Verify Package") | Yes | Yes | n/a | n/a | Yes (export scope + integrity tests) | Builds in-memory package; **no binary assets; verified:true hardcoded; manifest lacks schemaVersion** (H-07) | **F** |
| SD Card deploy | detect→space→write→verify→safe eject (AGENTS.md Reliability) | **None** | **Throwing stub** `SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED` (sd-card-target.ts:11-16) | No | n/a | n/a | No | Absent | **M** |
| Deployment states Preparing/Writing/Verifying/Completed | prompt §19 | Status strings only ("Not built/Building…/Verified package") | No | Yes (strings) | n/a | n/a | No | Absent | **M** |
| Preview mode | distinct runtime preview (UI §6) | Toggle yes | — | `viewMode` label only | n/a | n/a | No | Cosmetic — renders identical editable canvas | **F** |
| Tauri shell / packaging | packageable Windows desktop app (AGENTS.md) | — | — | — | — | — | cargo-verification U | Config v2-valid; **bundle.active:false** → no installer; no dirty-close guard; zero IPC | **∂** |
| Shortcut registry | single registry, conflict detection (UI §19; AGENT2 §4.12) | **None** | ad hoc if-chain (App.tsx:715-746) | — | n/a | n/a | Pure helpers tested | No registry; Ctrl+Z/Y/S/N/R advertised but unbound | **F** |
| Automated tests | coverage of product behavior | — | — | — | — | — | 51/51 pass | **node env only — zero DOM/browser interaction tests; App component has 1 renderToString smoke** | **∂** |

---

## Core Workflow Audit (lifecycle)

- **New Project → edit → Save → reload:** FAIL. New Project resets to an empty, non-canonical hierarchy (`themeProjects: []`, `factories.ts:26-36` — canonical requires a ThemeProject with exactly 4 rotations, `DOMAIN_MODEL_V1.md:107-115`; the foundation test *encodes* the empty shape, `foundation.test.ts:35-37`). Save is a durability no-op (`document-store.ts:75-78`). Live-verified: after Save the chip reads "Saved"; reload restores the boot-time empty project, `localStorage` stays `{}`.
- **Theme → Rotation → Scene creation chain:** PARTIAL. Each step is a real undoable command, but only R0 is creatable (`App.tsx:259` hardcodes angle 0), the 4-rotation invariant is neither scaffolded nor enforced, and after creation the rotation row is hidden behind a collapsed expander (depth ≥ 2 defaults collapsed, `App.tsx:427`), which makes "Add Scene" appear permanently disabled. Live-verified the full chain works only when the user selects theme → Add Rotation → expands → selects R0 → Add Scene.
- **Deleting the only ThemeProjectGroup:** FAIL-safe gap. `deleteSelection` can remove the group (`editor-application.ts:220-227`); with zero groups, `addThemeProject` returns false forever (`App.tsx:249`) — the editor reaches a dead end with no recovery path (SA1-F10).
- **Document open/activate/close:** FAIL. Tabs are label strings (`App.tsx:165-166,383-395`); `Open Project` is disabled; `DocumentStore.close()` is never called from UI. No real multi-document model.
- **DeviceProfile:** fixed single profile (`main.tsx:8`, `factories.ts:31`); no selector; the shipped `foundationDeviceProfile` declares empty `runtimeStates/runtimeSettings/digitStyles/directionStyles/languages/supportedFormats` and no `audioCapabilities` (`factories.ts:3-16`) — every profile-driven surface (Simulator, Binding editor, floor/style pickers) is empty in the shipped product.

## Canvas Audit

- **Contract conformance is strong where reachable.** At HEAD the renderer and pointer conversion share one fit/letterbox transform (`App.tsx:486-498` — Agent 3 D4/F12 RESOLVED); pointer-up commits recompute from initial geometry + final delta, never from rendered overrides (`App.tsx:683-697` — D5 RESOLVED); Properties reads canonical geometry, not preview (`App.tsx:470,910` — F10 RESOLVED); all 8 resize handles exist (`App.tsx:974` — D10 superseded); snap implements 6-unit threshold with Grid>Edge>Center pass priority, per-axis, self-snap exclusion, bbox reference (`canvas-interaction.ts:74,105-121,292-347`); the canonical keyboard nudge math and Shift+Arrow no-op are in place (`canvas-interaction.ts:84-103`); Ctrl+D is unbound.
- **Contract deviations at HEAD:** (1) §4.8 locks `marqueeSelection(mode)` with explicit *rejection* of `contains` in V1 — HEAD implements it (`canvas-interaction.ts:260-281`, test `:113-126`) without a `DOMAIN CONTRADICTION FOUND` record (L-02); (2) `primaryWidgetId` (§4.6.2) is absent — no anchor for future alignment/distribution (M-07); (3) resize entry skips the `button !== 0` guard (`App.tsx:595,610`) — secondary-button pointerdown starts a resize (L-01); (4) wrong-platform `Mod`+Arrow (Meta on Windows) silently moves by grid instead of doing nothing (L-03); (5) `updateWidgetGeometries()` remains a history-bypassing dead helper without the mandated contract comment / no-history test (L-07).
- **Invisible-widget contract:** hit-test/marquee exclusion, Explorer selection, bounds, and snap-target exclusion all verified; but invisible widgets render as 65%-opacity ghosts (`app.css:296,334`), violating "render edilmez" (corrections §8) — and the Hide command itself does not exist, so the whole path is unreachable in product.
- **Z-order:** zIndex is the stacking source; the 4 operations are real, undoable, reachable via widget context menu; DOM/CSS stacking matches the §4.5 total order for reachable cases; the pure `hitTest()` is **never called by App** (dead-from-app).
- **The canvas contract's widget-level behaviors (drag/resize/marquee/snap/nudge/undo) are UNVERIFIED at runtime** — the product cannot create a widget, so no populated canvas can exist (see §17).

## Explorer Audit

- Architecturally correct as a *view*: the tree derives entirely from the canonical project; all mutations route through `EditorApplication`; selection uses one shared `selectNode` path with bidirectional canvas↔Explorer sync.
- **Navigation gaps:** no Add Widget, no Rename, no Hide/Show/Lock toggles, no move-up/down (core `moveScene`/`moveWidget` have zero UI callers), no Workspace root, Resources/Unsupported Files are non-resolving pseudo-leaves (SA4-F1).
- **Defects:** Expand/Collapse-All use wrong id keys (`App.tsx:164,844` vs real `project-foundation`/`theme-group-foundation`) → Expand-All is a no-op, Collapse-All can't fully collapse (SA4-F3, live-visible); additive selection across scenes leaks stale widget ids (`App.tsx:403` + `canvas-interaction.ts:253-258` → `selectedIds` retains Scene-A widgets while editing Scene B; delete/duplicate gating is inflated; Properties shows phantom multi-select) (M-07); widget rows are labeled by `widgetType` with a dead icon branch (`App.tsx:429`).
- **Document tabs are decorative** label lists; "Open Project" is disabled.

## Properties Audit

- Exactly **four editable controls exist in the entire product: X, Y, W, H.** Every other property (name, type, stable ID, visible, enabled, locked, zIndex, bindings, digit style, floor mapping, direction style, media duration/loop/repeat/audio, text content, scene priority/conditions) is a read-only `PropertyRow`.
- **H-03 (per-keystroke commit + clamp):** `onChange` commits an undoable command per keystroke (`App.tsx:910→867-886→884`); W/H are clamped `Math.max(10, value)` mid-typing, so entering "50" produces 10 then 100, and each digit pushes one history entry. No blur/Enter commit, no upper bound, no error feedback for silently rejected non-finite values.
- **Multi-select:** `*` display works (`valueFor`, `App.tsx:893-898`); apply-to-all is not implemented (fields disabled for multi); non-geometry sections read the *first* widget instead of `*` (SA5-F4).
- **Locked:** geometry disabled for locked single-select (correct); "other permitted properties editable" is vacuously unmet because nothing else is editable (SA5-F5).
- **Agent 3 F10 verified RESOLVED:** no `effectiveGeometry` symbol exists; inspector reads `canonicalGeometry` (`App.tsx:470`).

## Toolbar Audit

- **Wired and real:** New Project, Undo, Redo, Settings, Select, Pan, Grid toggle, Snap toggle, zoom ± (50–200%), Duplicate (+10/+10, copy not selected/not snapped), Delete (scene-scoped). Undo/Redo disabled-state is correct. Grid and Snap are independent and both functional.
- **Dead controls (visible, no handler):** Align and Lock (context bar) are `disabled` with no `onClick` (`App.tsx:975`); Import (`:858`), Open Project (`:781`), Project Settings (`:798`), Theme Defaults (`:805`), Command Palette (`:818`) are permanently disabled — violating AGENTS.md "never leave fake core buttons".
- **Cosmetic:** Design/Preview toggles only change labels (`App.tsx:963,973-974`); runtime evaluation runs identically in both modes.
- **Command descriptors:** the 9 context-menu descriptors are all reachable; toolbar/menu items are hard-coded handlers, not part of any single registry.
- **Missing surfaces:** Hide All/Show All, Add Widget, device-profile selector, scene selector, Save As, real deployment UI.

## Keyboard Audit

- **Bound and correct:** Delete/Backspace (scene-scoped), Ctrl/Cmd+A (active scene), Escape (cancel gesture), Arrow nudge math per the canonical table, Shift+Arrow no-op, Alt rejection, platform-exact `isCanonicalModifier` (fixed since Agent 3 D1), text-input focus exclusion (`input/textarea/select/contentEditable`), Ctrl+D unbound.
- **Advertised but unbound (HIGH):** Ctrl+Z / Ctrl+Y / Ctrl+S / Ctrl+N shown as menu `<kbd>` hints (`App.tsx:780-786`), Ctrl+S/Ctrl+Z listed in Settings→Shortcuts (`:955`), "R 90° rotation" listed — **none have key handlers** (the only handler is `handleCanvasKeyDown`, `App.tsx:715-746`). Confirmed canonical shortcuts (UI_DESIGN_SYSTEM_V2 §19) Ctrl+C/X/V also unbound.
- **No shortcut registry:** ad hoc if-chain; no conflict detection; registry ownership (AGENT2 §4.12) unmet.
- **Modifier hole:** holding both Control and Meta degrades to plain-Arrow grid movement (exact-modifier-set contract violated).

## Runtime Audit (bindings / simulator / data flow)

- The runtime **engine** is real: `selectActiveScene` (priority 0–10, higher-wins, document-order tie-break), condition evaluation (all/any, negated, equals/gt/lt/contains), `evaluateBinding` with the full action union, validation of unknown states/operators/types/values, and export that does not drop bindings/conditions/floor-mappings.
- **The presentation half is missing:** `activeBindings` is computed (`App.tsx:203`) but **never applied to rendering** (canvas renders `widget.visible` only, `App.tsx:775`) and never displayed anywhere. Bindings are dead end-to-end.
- **Simulator defects:** non-boolean state/setting inputs store raw strings (`App.tsx:932`) while `conditionMatches` uses strict `===` / numeric-only gt/lt (`runtime.ts:19-25,47-52`) → integer state "6" never matches condition 6 (live-configurable bug); no `[Binding] … → TRUE` console trace; no Test Binding command; Run/Pause/Step are label/log only.
- **Missing entirely:** parametric `{FloorNumber}` substitution + localized text; multilingual content storage/resolution; per-layer audio policy metadata (0–100 priority/ducking/override); media continuation behavior; 2 of 6 required binding-validation checks (unresolved parameter, floor-mapping reference).
- **Production profile empty** (`factories.ts:3-16`) — the shipped app can never demonstrate any of the above.

## Settings Audit

- The modal dialog exists with all 9 canonical categories; Cancel correctly restores the draft; Save/Apply&Close copies draft→saved in memory.
- **No persistence at all** (`grep localStorage|sessionStorage|indexedDB` → 0 hits in `src/`); reload resets everything (live-verified).
- **3 of 4 controls are dead:** `showGrid` (grid uses independent `gridVisible` state), `compactDensity` (no consumer), `confirmDestructive` (delete executes unconditionally, `App.tsx:272-283`). Only `snapGridSize` is consumed (`App.tsx:472→640,687,740`) — session-only.
- **Blocking-modal contract violated:** backdrop click closes the dialog *without* resetting the draft (abandoned edits reappear); no focus trap; Escape does not cancel.
- The visual grid is a hard-coded CSS `18px 18px` (`app.css:116`) decoupled from the snap-grid setting — the drawn grid can never match the snap step.
- Editor/Assets/Simulator/Validation/Export categories render informational text only; Shortcuts is a static list containing the **unimplemented** "R 90° rotation" and unbound Ctrl+S/Ctrl+Z.

## Asset / Widget Audit

- **Semantic boundaries are respected:** Digit/Direction are not Media; audio is scoped to media; MediaSlide must be a media widget; validation enforces these (`validation.ts:163-177`).
- **Rendering:** every widget type renders as one generic placeholder box with name + type text (`App.tsx:770-776`) — no type-specific rendering.
- **No asset ingestion:** Import disabled ("later phase", `App.tsx:858`); no file input; no drag-drop routing (corrections §7 unimplemented); Asset Depot hard-coded empty; no preview, no used-asset badges.
- **Model-only:** MediaSlide (no editor), loop/repeat as bool+count with no UI, duration precision enforced but no 3.0 s default / 0=indefinite semantics, digit-style/floor-mapping validation without any editor, Direction up/down without any editor.
- **Bounding Group: absent entirely** (0 matches; canonical `docs/BOUNDING_GROUP_LAYOUT.md`, `DOMAIN_MODEL_V1.md:168-183`).
- **Export scoping is correct:** Resources + Used + Default, unused excluded (`export.ts:54-77,141`; tested `domain-runtime.test.ts:187-199`) — but asset "files" are JSON logical records, not media bytes.

## Deployment Audit

- **Validation:** ~34 real rules, auto-run (`App.tsx:192`), Validate command logs results; remediation/path text never surfaced. Live-verified: Build is blocked with "Blocked · validation failed" on an invalid project. **Missing canonical rules:** duplicate widget ID, z-order/zIndex, video-slot limit, asset format, language/font references, required floor symbols, custom Up/Down completeness, deployment-config integrity (SA11-F8).
- **Package builder:** transport-independent, derived from the canonical model; includes bindings/conditions/floor-mappings; SHA-256 integrity; blocks on validation errors. **Fails:** no binary asset content (JSON metadata written with `.png/.mp4` extensions, `export.ts:84-97`); `verified: true` hard-coded at build (`export.ts:180`); manifest has no `schemaVersion` (`export.ts:145-156`); no checksum file on disk; layout diverges from the documented SD layout (no `config.cfg`, no R0..R270 folders).
- **SD-card target:** `SDCardTarget.deploy()` unconditionally throws `SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED` (`sd-card-target.ts:11-16`) — honest stub, zero capability: no detection, selection, space/size validation, atomic write, progress, read-back verify, safe eject. `PackageDeploymentManager`/`UnsupportedDeploymentManager` are unwired (`application.ts:44-77`); the UI calls `buildDeploymentPackage`/`verifyDeploymentPackage` directly, bypassing the mandated UI→Service→Adapter chain.
- **V1 boundary respected:** zero Wi-Fi/network/cloud code (grep-verified); no native calls inside React; architecture test enforces Domain/Core platform-independence.

## Tauri / Shell Audit (static; cargo unavailable)

- Config is schema-v2 and internally consistent (devUrl 1420 ↔ vite config, frontendDist `../dist`, 1440×900 resizable window). Rust is a minimal launcher with one unused `app_version` command; **zero IPC** in either direction.
- **Gaps:** `bundle.active: false` → `tauri build` cannot emit an MSI/NSIS installer (AGENTS.md "packageable" unmet); no dirty-state close guard (work lost on Alt+F4); no `capabilities/` directory (latent for future fs/dialog IPC); CSP null; no `.ico`; no single-instance; no tray.
- The status-bar self-label — "Browser core · Tauri shell reserved" (`App.tsx:986`) — is an accurate description of the product today.

## Cross-Feature Workflow Audit

| # | Workflow | Verdict | Evidence |
|---|---|---|---|
| 1 | Select widget → edit geometry → undo → redo | **UNVERIFIED end-to-end** — no widgets can be created; static chain (commit→execute→undo/redo) proven by tests, but the live inspector commits per keystroke with the W/H clamp bug (H-03) | §Properties, SA3 matrix |
| 2 | Select multiple → resize → undo → redo | **UNVERIFIED runtime** — multi-resize pure math tested (8 handles, bbox); no populated canvas possible | SA2 matrix row 9 |
| 3 | Lock → select → drag → no mutation | **FAIL (unexercisable)** — Core enforces locked-geometry (tested), but there is no Lock command/UI anywhere | SA4-F7, SA6-03 |
| 4 | Hide → canvas hit-test → Explorer select | **FAIL (unexercisable)** — Hide command absent; invisible semantics only via dead `editWidgetProperties`; ghost-render contradicts "not rendered" | SA2-04/06, SA4-F8 |
| 5 | Duplicate → rename → move → undo | **PARTIAL** — duplicate works (+10/+10, copy unselected); rename missing; move-widget has no UI and contradicts zIndex | SA6-08, SA3-03/04 |
| 6 | Switch Scene → selection → keyboard → undo | **PARTIAL** — switching works; additive selection leaks cross-scene ids (M-07); scene switch does not reset selection (`App.tsx:754-758`) | SA4-F9, SA1-F8 |
| 7 | Create project → edit → switch Scene → undo | **PARTIAL** — core undo is exact; but New Project itself is non-canonical (no ThemeProject/4 rotations) and nothing persists | SA1-F2, C-02 |
| 8 | Change settings → Canvas → keyboard → snapping | **PARTIAL** — snapGridSize is live-consumed and affects snap+nudge (session only); 3 other settings dead; visual grid decoupled; nothing persists | SA9 matrix |
| 9 | Delete → undo → redo | **PASS (core)** — exact undo/redo tested; runtime unverified (no widgets) | editor-pipeline.test.ts:196-199,273-285 |
| 10 | Open/activate document → selection → Canvas interaction | **FAIL** — Open Project disabled; tabs decorative | SA3-02, SA4-F12/F13 |
| 11 | Simulator state change → Scene switch → bindings | **PARTIAL** — engine works (tested); live UI broken for non-boolean states (string coercion); bindings never applied to render | SA8-04/07 |
| 12 | Validate → fix → Build & Verify → deploy | **FAIL after build** — validation blocks correctly (live-verified); package lacks asset bytes and real verification; deployment throws | SA11-F1/F2/F3 |

## Static Findings

- **No TODO/FIXME/HACK/XXX in `src/`; no shipped `console.log`; no `alert/confirm/prompt`.** The only `console.*` is the never-instantiated `ConsoleLogger` adapter (dead export). Stub strings are honest ("reserved for a later phase") but mark unimplemented product features.
- **No unsafe casts** (`as any`, `as unknown as`, `@ts-ignore` — zero hits) and **no direct canonical domain mutation** in `src/` (all push/splice/sort operate on local copies; verified line-by-line).
- **Dead code is elevated: ~30% of exported runtime symbols are unreachable from the app** — `hitTest`, `updateWidgetGeometries`, `canvasToScreen/snapGeometry/detectKeyboardPlatform/containsPoint/intersects` (test-only), `canvasToScene/sceneToCanvas/clampCanvasPoint/calculateSnapGuides/snapValue` (fully dead), `ConsoleLogger/UnsupportedDeploymentManager/SDCardTarget/executeCommand/PackageDeploymentManager` (dead or test-only), `moveScene/moveWidget/setWidgetGeometries(global)/editWidgetProperties` (dead from UI).
- **Duplicate state:** `selection` + `selectedIds` hand-synced in 7 places; `geometryOverrides` + `geometryOverridesRef`; `MIN_WIDGET_SIZE=10` re-expressed as magic numbers (`App.tsx:654,695,878`); z-order comparator duplicated in two sort directions.
- **Two "active scene" authorities** can diverge: Explorer selection wins for canvas/mutations, `runtime.activeScene` wins for the Simulator card (`App.tsx:465` vs `:932`).
- **Lock semantics inconsistent:** geometry guarded everywhere; z-order operations unguarded for locked widgets (`editor-application.ts:253-258`).
- **Architecture boundaries hold:** App→Core imports only; no Core→App/Domain→App/Infrastructure→App; no Tauri imports in `src/`; `@tauri-apps/api` declared but unused (`package.json:17`).
- Repo-root audit artifacts from previous workflows (`agent4_source_evidence.txt`, `DEEPSEEK_E2E_INTEGRATION_AUDIT.md`, `qa-workflow-c/**`) contain **stale pre-HEAD snapshots** (old `effectiveGeometry` name, legacy `marqueeSelection` signature) and must not be treated as current source evidence.

## Runtime Findings (live browser, Edge 151 headless via CDP @ http://127.0.0.1:1420)

- **RT-01 (CRITICAL-adjacent, live):** The product boots and renders the full shell (menu bar, toolbar, Explorer, canvas, Properties/Simulator/Console/Validation panels, status bar), but the **editing loop terminates at an empty scene**. Live sequence: Theme → Add Theme Project → select → Add Rotation (only R0) → expand → select R0 → Add Scene → select scene → canvas reads "◇ New Scene — Scene contains no widgets." There is **no control anywhere** to add a widget. Console logs confirm each step ("Rotation added", "Scene added").
- **RT-02 (CRITICAL, live):** **Save → reload = data loss.** After creating a Theme Project and Rotation, File → Save flips the chip to "Saved"; `Page.reload` restores the boot-time empty project ("0 theme projects"), `localStorage` remains `{}`.
- **RT-03 (live, positive):** Validation gates the package build: with an incomplete project, "Build & Verify Package" sets status "Package: Blocked · validation failed" — the only honest end-to-end gate found.
- **RT-04 (live):** Dead controls confirmed by clicking: Open Project (`disabled`), Command Palette (`disabled`), Add Scene disabled until a rotation is selected (correct but undiscoverable because the rotation row is collapsed by default).
- **RT-05 (live):** The app's own Console panel shows `logAction` entries only ("Foundation shell initialized", "Theme Project selected", "Program Settings saved") — no `[Binding]`/`[Widget]` runtime traces, no validation output unless triggered.
- **RT-06 (intermittent, UNVERIFIED):** A page-level exception "Error: Could not establish connection. Receiving end does not exist." appeared in 3 of 8 loads (no src code path can produce it — zero `postMessage/MessageChannel/sendMessage` in `src/`; a 5-reload stack-capture loop returned 0 exceptions). Classified as environmental (browser-internal), not an application defect; flagged for completeness.
- **RT-07 (UNVERIFIED by necessity):** All widget-level canvas interactions (drag, resize, marquee selection, snapping, nudge, z-order gestures, cancellation history) cannot be exercised because the product cannot create a widget (RT-01). This is itself the finding — not a test-environment limitation.

---

## Missing Functionality

Implemented nowhere in `src/` (evidence = grep + audit citations). Each item cites its canonical source.

| # | Feature | Canonical source | Evidence of absence |
|---|---|---|---|
| 1 | **Widget creation (any type)** — the editor's core loop | ARCH_V2:480; UI §7:188-202 | No `addWidget`/`createWidget` anywhere; `editor-application.ts` has no such mutator; `editor-commands.ts:29-39` has no descriptor; live-verified "Scene contains no widgets" with no affordance |
| 2 | **Project persistence / Open / Save As** | AGENTS.md; UI §5; TEMPLATE_SCHEMA_V1 serialization | `InMemoryDocumentStore` only; no storage API in `src/`; Open Project disabled (`App.tsx:781`); live-verified data loss |
| 3 | **SD-card deployment** (detect/write/verify/eject/progress) | AGENTS.md Reliability; prompt §8-9, §25 | `SDCardTarget.deploy` throws (`sd-card-target.ts:11-16`); no deployment UI |
| 4 | Rename (all node types) | UI §4:102-110 | grep `rename` = 0; no mutator/descriptor |
| 5 | Hide/Show + Hide All/Show All | corrections §8:156; UI §7 | No command/descriptor/button |
| 6 | Lock/Unlock toggle | corrections §8:154 | Dead "Lock" button; `editWidgetProperties` uncalled |
| 7 | Align (and any alignment/distribution) | UI §7 | "Align" disabled, no handler (`App.tsx:975`) |
| 8 | Duplicate mode (click-center placement, Esc exits) | UI §27; corrections §8:150-152 | Fixed-offset duplicate only |
| 9 | Free rotation + 5° snap + `R` 90° | UI §27; corrections §8:145-147 | No rotation primitive; `R` listed but unbound |
| 10 | Bounding Group | DOMAIN_MODEL_V1:168-183; docs/BOUNDING_GROUP_LAYOUT.md | 0 grep matches |
| 11 | Floor Mapping Editor | BINDING_V1:70-112; corrections §12 | Read-only row (`App.tsx:912`) |
| 12 | Binding authoring (add/edit/delete) | BINDING_V1; corrections §4 | Read-only modal (`App.tsx:988`); no mutators |
| 13 | Audio policy surface (per-layer 0–100, ducking/override) | corrections §5 | No UI; no model fields |
| 14 | Parametric text `{FloorNumber}` + localized content | BINDING_V1:133-148 | 0 grep hits |
| 15 | Multilingual content system | docs/MULTILINGUAL_CONTENT_SYSTEM.md | `languages` field only |
| 16 | Media Slide editor + 3.0 s default / 0=indefinite | corrections §11 | Model + validation only |
| 17 | Asset ingestion / import / drag-drop routing | corrections §7, §10 | Import disabled (`App.tsx:858`); no file input/drop handlers |
| 18 | Asset previews (image/video/audio playback) + used-asset badges | corrections §10 | Depot hard-coded empty (`App.tsx:859`) |
| 19 | DeviceProfile selector / profile switch | ARCH_V2:546 | Read-only row; single profile (`main.tsx:8`) |
| 20 | Scene priority/conditions/enabled editing | UI §6; DOMAIN §154 | Display-only (`App.tsx:916`); `addScene` fixes priority 0 |
| 21 | Scene/widget reorder UI (`moveScene`/`moveWidget` callers) | ARCH §17 | Core methods have zero UI callers |
| 22 | Command Palette | UI §19 | `disabled: true` (`App.tsx:818`) |
| 23 | Project Settings / Theme Defaults surfaces | ARCH §19 | `disabled: true` (`App.tsx:798,805`) |
| 24 | Shortcut registry + editing (Settings→Shortcuts) | UI §19; AGENT2 §4.12 | Static list only (`App.tsx:955`) |
| 25 | Real Preview mode / distinct simulator render | UI §6 | `viewMode` label-only |
| 26 | `[Binding]`/`[Widget]` console traces + Test Binding | BINDING_V1:195-209 | Absent |
| 27 | Real document tabs / multi-document | ARCH_V2:84-107 | Label arrays only |
| 28 | Media continuation (Continue/Retain Playback) | BINDING_V1:186-193 | Model flag only |

## Broken Functionality

Exists but produces wrong behavior, contradicts canonical, or is fake.

| ID | Feature | What is broken |
|---|---|---|
| **C-02** | Save / persistence | "Saved" chip + File→Save write nothing; reload discards all work (live-verified) |
| **H-03** | Properties W/H editing | Per-keystroke commit + `Math.max(10,…)` clamp corrupts typed values; undo floods per digit; no max; silent rejection |
| **H-06** | Bindings → presentation | `activeBindings` computed, never applied to render; integer simulator inputs store strings → conditions never match |
| **H-07** | Package build/verify | No binary assets (JSON labeled `.png`); `verified:true` before verify; in-memory self-hash "verification"; no `schemaVersion` in manifest |
| **H-05** | Keyboard shortcuts | Ctrl+Z/Y/S/N/R/C/X/V advertised (menus + Settings) but unbound |
| M-01 | Invisible widgets | Rendered as 65%-opacity ghosts, not "not rendered" (`app.css:296,334`) |
| M-02 | Dead controls | Align/Lock/Open Project/Project Settings/Theme Defaults/Command Palette/Import — visible, disabled, no handler |
| M-03 | Design/Preview | Toggle changes labels only |
| M-04 | Simulator Run/Pause/Step | Cosmetic; Step = `logAction("Simulator step requested")` |
| M-05 | Settings controls | `showGrid`/`compactDensity`/`confirmDestructive` stored, never consumed; backdrop click closes without draft reset |
| M-09 | Expand/Collapse-All | Wrong id keys → Expand-All no-op, Collapse-All incomplete |
| M-07 | Cross-scene additive selection | `selectedIds` retains widgets of other scenes; delete/duplicate gating and multi-Properties inflated |
| M-11 | Scene activation order | `sceneActivationOrder: {}` hardcoded → tie-break degenerates to document order in UI |
| L-02 | Marquee `contains` | Implemented despite locked §4.8 "reject `contains`" — silent doc-vs-code deviation |
| L-03 | Modifier exactness | Wrong-platform `Mod`+Arrow (both mods) falls through to plain-Arrow movement |
| L-04 | `moveWidget` | Mutates array order; stacking uses zIndex → call has no visible effect / can contradict stacking |
| L-05 | Duplicate | Copy at +10/+10 not snapped, not selected; absent from context menu; reachable via mislabeled "Widget" menu for non-widget selections |
| L-13 | Deleting last group | Editor bricks: no group → `addThemeProject` returns false forever |
| L-14 | Validation of empty project | `validateProject(createEmptyProject())` returns valid — a publish-invalid project validates clean |

## Partial Functionality

Implemented with material gaps (each item: what works / what is missing).

| # | Feature | Works | Missing |
|---|---|---|---|
| 1 | Canvas interaction foundation | All pure math + transform contract + cancellation paths + 8 handles + snap passes + nudge math | No `primaryWidgetId`; resize button-guard; widget-level runtime verification impossible (no widget creation) |
| 2 | Theme/Rotation/Scene creation | Undoable commands, profile-derived dims, R90/R270 swap math | Only R0 creatable; no 4-rotation scaffold/enforcement; empty-boot project; hidden-behind-collapsed-expander UX |
| 3 | Selection model | Document-order + stable-ID ordering; additive; primary via `selection` object | No dedicated primary-widget state; cross-scene leak; duplicate `selection`+`selectedIds` state |
| 4 | Properties panel | 4 geometry fields commit undoably through the canonical pipeline | Everything else read-only; multi apply-to-all absent; per-keystroke bug |
| 5 | Multi-select `*` semantics | Mixed-value display correct | Entry-to-apply-all absent; non-geometry sections read first widget |
| 6 | Locked-widget contract | Core is final authority (geometry filtered) | No lock UI; z-order unguarded for locked |
| 7 | Invisible-widget contract | Hit-test/marquee/snap exclusion + Explorer selection + bounds | Ghost rendering; no Hide command |
| 8 | Z-order | 4 undoable ops reachable via context menu; zIndex stacking | No Properties field; `moveWidget` divergence; InScene mutation untested |
| 9 | Undo/redo/dirty | Exact core behavior, 16 tests | Ctrl+Z/Y unbound; Save baseline resets without durability |
| 10 | Runtime engine | Scene activation, conditions, binding eval, priority/tie-break | Not applied to render; empty production profile; no authoring UI |
| 11 | Simulator | Panel reachable; state inputs drive scene selection | String coercion bug; no trace; cosmetic transport; activeBindings unrendered |
| 12 | Validation | ~34 real rules, blocks build | Missing canonical rule families; remediation never surfaced |
| 13 | Export | Transport-independent; bindings/conditions/floor-mapping included; SHA-256; scope correct | No asset bytes; unversioned manifest; no on-disk checksums; layout divergence |
| 14 | Settings | Modal + 9 categories; snapGridSize live | No persistence; 3 dead controls; non-blocking backdrop |
| 15 | Keyboard | Delete/Ctrl+A/Escape/arrows correct with focus exclusion | Registry absent; half the canonical table unbound |
| 16 | Explorer | True derived view; single-path selection sync | Missing nav actions; broken Expand/Collapse-All; pseudo-leaves |
| 17 | Tauri shell | Valid v2 config; correct boundaries; offline | No installer, no IPC, no close guard, no capabilities |
| 18 | Test suite | 51/51 pass; strong core coverage | Zero DOM/browser tests; UI-called mutators untested; acceptance gaps (-Infinity, mixed selections, multi-scene e2e) |
| 19 | Duplicate capability | Undoable fixed-offset duplication | Not selected/snapped; no Duplicate mode; no Ctrl+D (correctly unbound) |
| 20 | Document lifecycle | Create (empty) + in-memory open/save/close | No real open/close/save; tabs decorative |
| 21 | DeviceProfile mechanism | Profile-driven validation/runtime/display | Shipped profile empty; no switching |

## Unverified Functionality

Cannot be executed in this environment — with the reason.

| ID | Area | Why unverified |
|---|---|---|
| U-01 | Widget-level canvas interactions (drag/resize/marquee/snap/nudge/z-order/undo at runtime) | The product cannot create a widget (C-01) — no populated canvas can exist; not an environment limitation |
| U-02 | `npm run tauri:check` / `tauri build` / window runtime | `cargo` not installed on this machine (environmental block) |
| U-03 | SD-card hardware operations | Not implemented (nothing to verify) |
| U-04 | macOS `Cmd` semantics, Windows installer artifacts | No macOS/installer build environment |
| U-05 | Pointer-capture/pointercancel/lostpointercapture/blur/Escape runtime sequences | Static paths verified; no browser integration test and no widgets to gesture on |
| U-06 | Intermittent "Could not establish connection" page exception | 3/8 loads; no src code can produce it; stack-capture loop negative — environmental, unresolved |

## Priority Fix List

Sorted by severity. Every finding includes ID, severity, feature, expected behavior, actual behavior, evidence, affected files, canonical document, reproduction, and recommended fix.

### CRITICAL

#### C-01 — No widget creation: the editor's core loop is impossible
- **Severity:** CRITICAL
- **Feature:** Widget creation (the central editing operation)
- **Expected:** Profile-driven "Add Widget" flow placing a widget into the active Scene via an undoable command (UI_DESIGN_SYSTEM_V2 §7:188-202; ARCHITECTURE_V2:480; corrections §7/§8 widget semantics)
- **Actual:** No `addWidget` mutator in `EditorApplication` (all 14 mutators cover theme/rotation/scene/geometry/delete/duplicate/z-order only), no widget factory, no command descriptor, no menu/toolbar/context entry. A fresh project contains zero widgets and there is no path to create one; the canvas shows "Scene contains no widgets." Consequently every widget-level feature (selection, drag, resize, marquee, snapping, z-order, Properties editing, multi-select) is unexercisable in the product.
- **Evidence:** `src/Core/editor-application.ts:141-305` (no addWidget); `src/Domain/factories.ts:26-36` (empty project); `src/App/editor-commands.ts:29-39`; `src/App/App.tsx:812-816,975`; live-browser: creation chain ends at empty scene
- **Affected files:** `src/Core/editor-application.ts`, `src/Domain/factories.ts`, `src/App/editor-commands.ts`, `src/App/App.tsx`
- **Canonical document:** `docs/UI_DESIGN_SYSTEM_V2.md` §7; `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md:480`
- **Reproduction:** Run app → Theme → Add Theme Project → select → Add Rotation → select R0 → Add Scene → select scene → observe "Scene contains no widgets"; no menu, context menu, toolbar, or keyboard path can add one.
- **Recommended fix:** Add `EditorApplication.addWidget(sceneId, widgetType, geometry)` (undoable, scene-scoped, validated), a widget factory driven by `DeviceProfile.supportedWidgetTypes`, and an Add Widget command surface (menu/toolbar/context).

#### C-02 — Save is fake: all work is lost on reload
- **Severity:** CRITICAL
- **Feature:** Project persistence / Save / Open
- **Expected:** Save serializes the project to durable storage (file/localStorage behind an adapter); Open restores it; dirty chip reflects durability (AGENTS.md "Open/Create Project" workflow; TEMPLATE_SCHEMA_V1:371-385; UI_DESIGN_SYSTEM_V2 §5)
- **Actual:** `InMemoryDocumentStore.save()` copies `currentProject → savedProject` in memory only and refreshes the dirty flag. No `localStorage`/IndexedDB/file/Tauri write exists anywhere in `src/`. "Open Project" is permanently disabled. The chip flips to "Saved" while nothing is saved.
- **Evidence:** `src/Core/document-store.ts:75-78`; grep `localStorage|sessionStorage|indexedDB` in `src/` → 0 hits; `src/App/App.tsx:139-143` (store re-created per mount), `781-782`; live-verified: Save → reload → content gone, `localStorage {}`
- **Affected files:** `src/Core/document-store.ts`, `src/App/App.tsx`
- **Canonical document:** root `AGENTS.md`; `docs/TEMPLATE_SCHEMA_V1.md`; `docs/UI_DESIGN_SYSTEM_V2.md` §5
- **Reproduction:** Add Theme Project → File → Save (chip "Saved") → reload → "0 theme projects".
- **Recommended fix:** Introduce a persistence adapter behind `DocumentStore` (localStorage for web dev, Tauri fs behind an adapter for desktop), write on save/autosave, hydrate on boot/open, and enable Open Project.

### HIGH

#### H-01 — SD-card deployment entirely unimplemented; V1 acceptance cannot pass
- **Severity:** HIGH
- **Feature:** Deployment (PC → SD Card → device), the product's core purpose
- **Expected:** Removable-drive detection, SD selection, space/size validation, atomic write with progress, read-back checksum verification, safe eject, explicit completion, user-oriented errors + technical logs; never claim success before verification (AGENTS.md Reliability; prompt §8-9, §19, §25)
- **Actual:** `SDCardTarget.deploy()` unconditionally throws `ApplicationError("SD-card deployment is reserved for a later phase.", "SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED")`. No detection/write/verify/eject/progress code exists. `PackageDeploymentManager`/`UnsupportedDeploymentManager` are unwired; the UI calls export functions directly. The Tauri shell exposes only an unused `app_version` command — no filesystem backend.
- **Evidence:** `src/Infrastructure/sd-card-target.ts:11-16`; `src/Core/application.ts:44-77`; `src/App/App.tsx:322-343`; `src-tauri/src/lib.rs:3-6`
- **Affected files:** `src/Infrastructure/sd-card-target.ts`, `src/Core/application.ts`, `src/App/App.tsx`, `src-tauri/src/lib.rs`
- **Canonical document:** root `AGENTS.md` (Reliability, Platform isolation); `Template Designer — Ana Proje Geliştirme Promptu.md` §25
- **Reproduction:** Build & Verify Package → no "Select SD Card"/Write/Eject UI exists anywhere; calling `SDCardTarget.deploy()` throws.
- **Recommended fix:** Implement the removable-drive adapter behind `DeploymentTargetAdapter` (detect → select → space/size validation → atomic write → read-back SHA-256 verify → safe eject), add a Tauri fs/dialog command + capabilities, wire it through `PackageDeploymentManager` into the UI with Preparing/Writing/Verifying/Completed states.

#### H-02 — New Project creates a non-canonical empty hierarchy; test suite encodes the defect
- **Severity:** HIGH
- **Feature:** Project creation
- **Expected:** A ThemeProject with exactly four rotations R0/R90/R180/R270 (DOMAIN_MODEL_V1:107-115; UI_DESIGN_SYSTEM_V2:100)
- **Actual:** `createEmptyProject` yields one group with `themeProjects: []`. `foundation.test.ts:35-37` asserts the empty shape, locking the defect in as expected behavior. The editor then cannot reach a Rotation/Scene until the user manually adds a Theme Project and an R0.
- **Evidence:** `src/Domain/factories.ts:18-36`; `tests/foundation.test.ts:27-38`
- **Affected files:** `src/Domain/factories.ts`, `tests/foundation.test.ts`
- **Canonical document:** `docs/DOMAIN_MODEL_V1.md:107-115`; `docs/UI_DESIGN_SYSTEM_V2.md:100`
- **Reproduction:** New Project → Explorer shows "0 theme projects"; canvas disabled ("No Theme Project").
- **Recommended fix:** Seed a default ThemeProject with the four canonical rotations (or a creation command producing them), and update the test to assert the canonical shape.

#### H-03 — Properties W/H editing corrupts values and floods history
- **Severity:** HIGH
- **Feature:** Geometry editing via the Properties panel
- **Expected:** Commit on blur/Enter as one undoable command; entering "50" yields 50 (UI_DESIGN_SYSTEM_V2 §8; Agent 1 pipeline: one logical mutation = one history entry)
- **Actual:** `onChange` commits per keystroke; W/H clamped `Math.max(10, value)` mid-typing → typing "5" then "0" produces 10 then 100; two history entries per intended edit; no upper bound; non-finite values silently rejected with no feedback.
- **Evidence:** `src/App/App.tsx:910,867-886,878,884`; `src/Core/editor-application.ts:11-18,125-139`; `src/Core/commands.ts:33-38`
- **Affected files:** `src/App/App.tsx`
- **Canonical document:** `docs/UI_DESIGN_SYSTEM_V2.md` §8; `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md`
- **Reproduction:** Select a widget (via test fixture), set W=100, Ctrl+A, type "50" → field shows 100; Undo stack gains one entry per digit.
- **Recommended fix:** Hold local draft state; commit once on blur/Enter; clamp only at commit; add max-bound + inline validation feedback.

#### H-04 — All non-geometry properties are read-only; rename/visibility/lock/zIndex/style/content editing missing
- **Severity:** HIGH
- **Feature:** Properties panel completeness
- **Expected:** Editable name, visible/enabled/locked toggles, zIndex, digit style, floor mapping, direction style, media duration/loop/repeat/audio, text content, scene priority/conditions; multi-select apply-to-all (UI_DESIGN_SYSTEM_V2 §8-13; corrections §9; BINDING_V1)
- **Actual:** Only X/Y/W/H are editable. `editWidgetProperties` (name/visible/enabled/locked/zIndex/content/style) is defined but never called; `moveScene`/`moveWidget`/global `setWidgetGeometries` likewise have zero UI callers. Multi-select fields are disabled even for mixed values (apply-to-all absent).
- **Evidence:** `src/App/App.tsx:906-921`; `src/Core/editor-application.ts:164-218` (dead mutators); `src/App/editor-commands.ts:29-39`
- **Affected files:** `src/App/App.tsx`, `src/Core/editor-application.ts`, `src/App/editor-commands.ts`
- **Canonical document:** `docs/UI_DESIGN_SYSTEM_V2.md` §8-13; `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` §5, §9, §12
- **Reproduction:** Select any node → every property except X/Y/W/H is a read-only row.
- **Recommended fix:** Wire property editing commands (rename, setWidgetProperties, scene priority/conditions) and toggles; implement multi-apply; add Floor Mapping / Binding / Media editors.

#### H-05 — Confirmed keyboard shortcuts are advertised but unbound; no shortcut registry
- **Severity:** HIGH
- **Feature:** Keyboard shortcuts
- **Expected:** Ctrl+Z/Y undo/redo, Ctrl+S save, Ctrl+N new, Ctrl+C/X/V clipboard, R rotation — all CONFIRMED in UI_DESIGN_SYSTEM_V2 §19 — bound via a single registry with conflict detection and focus exclusion (AGENT2 §4.12)
- **Actual:** The only keydown handler (`handleCanvasKeyDown`, `App.tsx:715-746`) handles Escape, Ctrl+A, Delete/Backspace, Arrows. Menu `<kbd>` hints and Settings→Shortcuts list Ctrl+Z/Y/S/N and "R 90° rotation" with no handler. Registry ownership and conflict detection absent.
- **Evidence:** `src/App/App.tsx:715-746,780-786,955`; `src/App/editor-commands.ts:37` (display-only shortcut string)
- **Affected files:** `src/App/App.tsx`, `src/App/editor-commands.ts`
- **Canonical document:** `docs/UI_DESIGN_SYSTEM_V2.md` §19; `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §4.12
- **Reproduction:** Mutate, press Ctrl+Z → nothing; press Ctrl+S → nothing; select a widget, press R → nothing.
- **Recommended fix:** Implement a command-level shortcut registry (Mod-normalized, exact modifier sets, conflict detection, focus exclusion) binding the canonical table; remove or bind every advertised hint.

#### H-06 — Bindings are evaluated but never applied to presentation
- **Severity:** HIGH
- **Feature:** Binding & parametric system (runtime data drives presentation)
- **Expected:** Active-scene widget bindings drive visibility/playback/style per action (BINDING_V1 core principle: "Runtime data drives presentation")
- **Actual:** `evaluateActiveSceneBindings` runs (`App.tsx:203`) but the result is used nowhere; canvas render uses only `widget.visible` (`App.tsx:775`). The Binding Editor modal is read-only ("Add Binding" disabled). `select-content`/`select-style` have no resolution against Digit/Direction style registries.
- **Evidence:** `src/App/App.tsx:203,775,988`; `src/Core/runtime.ts:100-112`; `src/Domain/models.ts:106-122`
- **Affected files:** `src/App/App.tsx`
- **Canonical document:** `docs/BINDING_PARAMETRIC_SYSTEM_V1.md`; `docs/DOMAIN_MODEL_V1.md` §Runtime
- **Reproduction:** Create a binding via test fixture; observe the widget's canvas rendering never changes with runtime state.
- **Recommended fix:** Apply matched bindings in the render path (visibility/playback/style resolution) and add command-backed binding authoring.

#### H-07 — Deployment package is not a real package: no asset bytes, fake verification, unversioned manifest
- **Severity:** HIGH
- **Feature:** Package builder + verification
- **Expected:** Package carries required asset content, a versioned manifest, persisted checksums, and verification by read-back from the target (DEPLOYMENT_FORMAT.md; AGENTS.md "Never claim success before verification completes")
- **Actual:** `assetFile()` writes JSON metadata (`stableSerialize({id,name,mediaType,metadata})`) under source extensions like `.png` (`export.ts:84-97`); `buildDeploymentPackage` returns `verified: true` hard-coded (`export.ts:180`); `verifyDeploymentPackage` re-hashes the same in-memory strings; manifest has no `schemaVersion` (`export.ts:145-156`); no checksum file is written.
- **Evidence:** `src/Core/export.ts:84-97,145-180`
- **Affected files:** `src/Core/export.ts`
- **Canonical document:** `docs/DEPLOYMENT_FORMAT.md`; root `AGENTS.md` (Package boundary)
- **Reproduction:** Build a package with a referenced asset; open `assets/<id>.png` → contains JSON, not image bytes.
- **Recommended fix:** Materialize binary assets through an adapter; add `schemaVersion` to the manifest; write checksum file(s); set `verified:false` at build and only assert verified after a read-back hash comparison.

### MEDIUM

| ID | Finding (condensed) | Key evidence | Canonical doc |
|---|---|---|---|
| M-01 | Hide/Show, Hide All/Show All missing; invisible widgets ghost-rendered (65% opacity) instead of not rendered | `app.css:296,334`; `editor-commands.ts:29-39` | corrections §8 |
| M-02 | Visible dead controls (Align, Lock, Open Project, Project Settings, Theme Defaults, Command Palette, Import) — disabled, no handlers | `App.tsx:781,798,805,818,858,975` | AGENTS.md "never leave fake core buttons" |
| M-03 | Design/Preview toggle cosmetic — no runtime re-evaluation | `App.tsx:963,973-974` vs `465` | UI §6 |
| M-04 | Simulator Run/Pause/Step cosmetic; integer state inputs store strings → conditions never match; no [Binding] trace; no Test Binding | `App.tsx:931-932`; `runtime.ts:19-25,47-52` | BINDING_V1:195-209 |
| M-05 | Settings not persisted; showGrid/compactDensity/confirmDestructive never consumed; backdrop click closes without draft reset | `App.tsx:171-172,947-950,989` | corrections §2 |
| M-06 | Only R0 rotation creatable; 4-rotation invariant neither scaffolded nor enforced; rotation hidden behind collapsed expander | `App.tsx:259`; `editor-application.ts:148-155`; `App.tsx:427` | DOMAIN_MODEL_V1:107-115 |
| M-07 | Cross-scene additive selection leaks stale widget ids; no `primaryWidgetId` | `App.tsx:403`; `canvas-interaction.ts:253-258` | AGENT2 plan §4.4/§4.6.2 |
| M-08 | Validation missing canonical rules (duplicate widget ID, z-order, video slot, asset format, language/font refs, deployment integrity); remediation/path never surfaced | `validation.ts` (rule inventory) | TEMPLATE_DESIGNER_CONTRACT_V2 §19 |
| M-09 | Expand/Collapse-All use wrong node-id keys → Expand no-op, Collapse partial; not persisted | `App.tsx:164,844` vs `factories.ts:20,28` | UI §4 |
| M-10 | Production DeviceProfile empty → Simulator/Binding/floor/style surfaces always empty | `factories.ts:3-16` | ARCH_V2 §4 |
| M-11 | Scene priority/conditions display-only; `sceneActivationOrder: {}` hardcoded | `App.tsx:201,916`; `editor-application.ts:160` | DOMAIN §154 |
| M-12 | No dirty-state guard on window close; `bundle.active:false` → no installer | `src-tauri/src/lib.rs:9-13`; `tauri.conf.json:27-29` | AGENTS.md |
| M-13 | Zero DOM/browser test coverage; UI-called scoped mutators untested; acceptance gaps (−Infinity, mixed selection, multi-scene e2e) | `vitest.config.ts:7` (node env); `tests/` grep | AGENT3 plan SA-11/SA-12 |

### LOW

| ID | Finding (condensed) | Key evidence |
|---|---|---|
| L-01 | Resize handles skip primary-button guard (secondary pointerdown starts resize) | `App.tsx:595,610` vs `579,564` |
| L-02 | Marquee `contains` implemented despite locked "reject contains" contract (doc-vs-code) | `canvas-interaction.ts:260-281`; AGENT2 §4.8 |
| L-03 | Wrong-platform Mod + Arrow falls through to plain-Arrow movement (exact-modifier contract) | `canvas-interaction.ts:91-103`; `App.tsx:718,740-743` |
| L-04 | `moveWidget` mutates array order while stacking uses zIndex → no visible effect | `editor-application.ts:176-186` vs `App.tsx:773` |
| L-05 | Duplicate copy not selected/not snapped; absent from context menu; Widget-menu duplicate enables for non-widget selections | `editor-application.ts:83-90`; `App.tsx:285-293,813` |
| L-06 | Pan term added unscaled vs §4.2 `pan × fitScale` formula | `canvas-interaction.ts:131-132` |
| L-07 | `updateWidgetGeometries` dead, history-bypassing, lacks mandated contract comment/no-history test | `canvas-interaction.ts:353-369`; `ui-phase2.test.ts:29-34` |
| L-08 | Duplicate state authorities: `selection`+`selectedIds`; `geometryOverrides`+ref; duplicated min-size constant and z-order comparator | `App.tsx:152-153,180,187`; `:654,695,878` |
| L-09 | `activeBindings` computed but never rendered | `App.tsx:203` |
| L-10 | `executeCommand` is an unvalidated mutation bypass (unused) | `editor-application.ts:121-123` |
| L-11 | Explorer: no Workspace root; Resources/Unsupported pseudo-leaves never resolve; dead widget icon branch | `App.tsx:429,446-462` |
| L-12 | Document tabs are decorative label strings | `App.tsx:165-166,383-395` |
| L-13 | Deleting the last ThemeProjectGroup bricks the editor | `editor-application.ts:220-227`; `App.tsx:249` |
| L-14 | `validateProject(createEmptyProject())` returns valid | `validation.ts:282-321`; `foundation.test.ts:40-45` |
| L-15 | Z-order operations unguarded for locked widgets | `editor-application.ts:253-258` |
| L-16 | Tauri: no capabilities dir, CSP null, no .ico, no single-instance, no tray; `@tauri-apps/api` unused | `src-tauri/tauri.conf.json:23-29`; `package.json:17` |
| L-17 | Asset model lacks `variants`; loop/repeat/MediaSlide editor absent; Asset Depot hard-coded empty | `models.ts:198-204`; `App.tsx:859` |
| L-18 | No-selection Properties shows placeholder instead of document properties | `App.tsx:921` vs UI §8:169 |
| L-19 | ThemeProjectGroup selection has no inspector section | `App.tsx:916-919` |
| L-20 | Visual grid hard-coded CSS 18px, decoupled from snap-grid setting | `app.css:116` vs `App.tsx:472,950` |

---

## Prior QA reconciliation

- **Agent 4 (55bf0f49, "PASS WITH WARNINGS") was a regression-focused, static audit.** Its mutation-pipeline, history, dirty-state, and snapshot conclusions are re-verified and correct. Its two warnings (cargo unavailable; UI not manually exercised) remain; this audit supplies the missing manual-UI evidence and finds the product-layer gaps its scope did not target.
- **Agent 3 defects at HEAD:** D4/F12 (renderer/pointer transform mismatch) — **RESOLVED** (`App.tsx:486-498`); F10 (preview leak into Properties) — **RESOLVED** (`App.tsx:470,910`); F13 (marquee mode contract) — **PARTIALLY RESOLVED** (signature present, but `contains` implemented rather than rejected — L-02); D1 (keyboard) — math fixed, registry ownership still absent (H-05); F11 (snap-grid hard-code) — setting consumed, but not persisted and not registry-owned (M-05); D9 (hitTest dead in UI) — unchanged (L-xx/§Canvas); D6/D5/D7/D10 — statically remediated, runtime verification still impossible (C-01).
- **Canonical contradictions recorded (no silent fixes):** (1) AGENT2 §4.8 "reject `contains`" vs implemented `contains` (L-02); (2) workflow checklist item "Arrow = 1 Scene unit; Ctrl+Arrow = snap-grid" vs the reconciled canonical table (Arrow = snap-grid, Ctrl = grid÷10) — the code correctly implements the reconciled table; the checklist item is the stale pre-reconciliation wording; (3) `TEMPLATE_SCHEMA_V1.md` widget-type vocabulary (`floor_number`, `media_slide`, `480x800`) diverges from `models.ts` `WidgetType` (`digit/media/direction/warning/text`) and `schemaVersion` ("1.0" vs numeric 1) — schema doc drift; (4) `DOMAIN_MODEL_V1.md:22-24` diagram places widgets on Rotation while text and code nest them under Scene.

---

*Audit performed read-only. No application code, tests, or configuration were modified and no commits were created. The only new artifact is this report. Live-browser evidence was captured with a headless Edge session driven over CDP against the Vite dev server at http://127.0.0.1:1420; the session and its temp scripts live under the system temp directory, outside the repository.*


