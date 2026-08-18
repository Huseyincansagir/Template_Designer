# Agent 10 — Runtime / Binding Integration

Read-only integration QA for Template Designer (Workflow C). Scope: simulator ↔ canvas scene selection ↔ binding editor ↔ duplication, focused on `src/Core/runtime.ts`, `src/Domain/models.ts`, `src/App/App.tsx`, `src/Core/editor-application.ts`, `src/Domain/factories.ts`, and `tests/domain-runtime.test.ts`.

Baseline verified in this run: `& npm.cmd run typecheck` → exit 0 (no `tsc` errors); `& npm.cmd test` → 51/51 passed (6 files). No code was modified.

Confidence legend: **CONFIRMED** = statically proven from the cited source (no live UI was run; no UI click is ever claimed). **UNVERIFIED** = requires a live run (none available).

---

## Scope & scenarios traced

| # | Scenario | Primary surfaces | Trace result |
|---|----------|------------------|--------------|
| S1 | Set integer state via simulator text input → binding `equals 5` | `runtime.ts` `conditionMatches` / `valuesEqual` / `isNumber`; `App.tsx:932` input handler | **Never matches** (string `"5"` vs number `5`, strict `===`). See WC-10-01. |
| S2 | Simulator toggles a state that activates Scene B while Scene A is explorer-selected | `App.tsx:465` canvas scene; `App.tsx:932` Active Scene card; explorer/properties selection | Three surfaces can disagree. See WC-10-03. |
| S3 | Duplicate a widget that owns a binding, then inspect the copy's `binding.widgetId` | `editor-application.ts:83-90`, `92-99`, `267-305`; `validation.ts:114-115` | Copy's `binding.widgetId` still points to the ORIGINAL widget id. See WC-10-06. |
| S4 | Delete the widget while its Binding Editor modal is open | `App.tsx:959` (shell keydown), `App.tsx:715-717`/`734-737` (Delete), `App.tsx:204`/`988` (modal resolve + fallback) | Widget removed; modal stays open showing "Widget / Unknown". See WC-10-07. |
| S5 | Toggle Preview mode | `viewMode` consumers (`App.tsx:154,963,973,974`) | Purely cosmetic label change. See WC-10-09. |
| S6 | Runtime values persist across a scene / rotation / document switch | `App.tsx:754-758` effect; `App.tsx:230-241` `createProject`; `App.tsx:931` Reset | Values survive scene/rotation/new-project; only manual Reset clears. See WC-10-05. |
| S7 | Setting with `defaultValue` never touched by user → condition `equals default` | `App.tsx:932` (defaultValue only a placeholder); `runtime.ts:36-37` (undefined ⇒ false) | Untouched setting conditions never match. See WC-10-11. |
| S8 | Equal-priority scenes tie-break | `runtime.ts:81,89-91`; `App.tsx:201`; `models.ts:221-223` | Resolved by array index, not runtime activation order. See WC-10-02. |

---

## Findings

### WC-10-01 Integer/number simulator inputs store raw strings; `equals`/`greater-than`/`less-than` never match — `not-equals` always matches (Severity: High · Failure types: UI misleading state, command mismatch · Confidence: CONFIRMED · Scenario: S1)

**Repro steps (design-level, for any profile registering an integer/number state):** (1) Register a DeviceProfile with `runtimeStates: [{ type: "integer", ... }]`. (2) Type `5` into that state's simulator input. (3) Observe a binding with `condition { stateId, operator: "equals", value: 5 }` stays FALSE; a `not-equals`/`greater-than`/`less-than` condition mis-reports.

**Evidence:**
- `src/App/App.tsx:932` — non-boolean states (integer, number, string, enum) all use a text input whose `onChange` stores the raw DOM string:
  > `{state.type === "boolean" ? <input type="checkbox" checked={current === true} onChange={(event) => setRuntimeValues((values) => ({ ...values, [state.id]: event.target.checked }))} /> : <input type="text" value={current == null ? "" : String(current)} placeholder="Unset" onChange={(event) => setRuntimeValues((values) => ({ ...values, [state.id]: event.target.value }))} />}`
- `src/Core/runtime.ts:23-25` — `equals` uses strict identity:
  > `function valuesEqual(left: PrimitiveValue | null | undefined, right: PrimitiveValue): boolean { return left === right; }`
- `src/Core/runtime.ts:19-21` — numeric comparison requires `typeof number`:
  > `function isNumber(value: PrimitiveValue | null | undefined): value is number { return typeof value === "number" && Number.isFinite(value); }`
- `src/Core/runtime.ts:40-56` — `equals` → `valuesEqual`, `greater-than`/`less-than` → `isNumber(value) && isNumber(condition.value) && value >/< condition.value`, `not-equals` → `!valuesEqual`.
- `src/Domain/models.ts:98-104` — `Condition.value` is `PrimitiveValue` (`string | number | boolean`), so the authoring-side condition for an integer state is the number `5` (also enforced by `validation.ts:79-83`).

**Expected vs Actual:** Expected — integer/number simulator values coerce to their declared `RuntimeValueType` so `equals 5`, `greater-than 4`, `less-than 6` match. Actual — `runtimeValues[id]` is `"5"` (string); `"5" === 5` is false; `isNumber("5")` is false, so `equals`/`greater-than`/`less-than` are all false; `not-equals` becomes `!("5" === 5)` = true, i.e. **inverted**. Boolean states are consistent (checkbox stores real boolean), enum/string states are consistent (strings). Only integer/number are broken.

**Recommended fix (design-level):** Coerce simulator input to the declared `RuntimeStateDefinition.type`/`RuntimeSettingDefinition.type` in the `onChange` (e.g. `type === "integer" || type === "number" ? Number(event.target.value) : event.target.value`), or coerce inside `conditionMatches` using the `getDefinition` result (which already knows `definition.type`). Prefer the evaluator-side coercion so the canonical evaluator is robust to string inputs.

---

### WC-10-02 `sceneActivationOrder` is hardcoded `{}`; the documented "activated later at runtime" tie-break is never exercised (Severity: Medium · Failure types: UI misleading state, wrong Scene mutation · Confidence: CONFIRMED · Scenario: S8)

**Evidence:**
- `src/App/App.tsx:201` — the only `RuntimeContext` ever built passes an empty order:
  > `const runtimeContext: RuntimeContext = { values: runtimeValues, settings: runtimeSettings, sceneActivationOrder: {} };`
- `src/Core/runtime.ts:78-91` — fallback is array index, and sort breaks ties by that order:
  > `activationOrder: context.sceneActivationOrder?.[scene.id] ?? index,`
  > `.sort((left, right) => right.priority - left.priority || right.activationOrder - left.activationOrder)[0]`
- `src/Domain/models.ts:221-223` documents a semantics the app never populates:
  > `/** Larger sequence means the Scene became active later at runtime. */ sceneActivationOrder?: Readonly<Record<Id, number>>;`

**Expected vs Actual:** Expected — equal-priority scenes are broken by which scene became active later at runtime (as documented and as exercised only in the unit test at `tests/domain-runtime.test.ts:104-111`, which passes an explicit `sceneActivationOrder: { first: 3, second: 7, … }`). Actual — in the running app the order is always `{}`, so every scene falls back to its array index and equal-priority ties resolve to "later scene in the rotation's declaration order", which the simulator never records or displays. The tie-break is deterministic (Array#sort is stable, and index is unique so an exact comparator tie is only possible when a caller supplies duplicate `activationOrder` values), but it is declaration order, not runtime activation order.

**Recommended fix (design-level):** Track the last time each scene's conditions became true in the simulator state and pass that map as `sceneActivationOrder`; or, if runtime order tracking is out of V1 scope, drop the documented claim and label the tie-break as "declaration order" in the UI and `models.ts` doc.

---

### WC-10-03 Three surfaces can disagree on the active Scene (canvas vs simulator card vs explorer/properties) (Severity: High · Failure types: state divergence, stale preview · Confidence: CONFIRMED · Scenario: S2)

**Evidence:**
- `src/App/App.tsx:465` — canvas scene prefers the explorer selection over the runtime result:
  > `const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];`
- `src/App/App.tsx:932` — simulator "Active Scene" card shows the runtime result:
  > `<div className="active-scene-card"><strong>{runtime.activeScene?.name ?? "No active Scene"}</strong><span>{runtime.activeScene ? `Priority ${runtime.activeScene.priority}` : "Runtime inputs are empty"}</span></div>`
- `src/App/App.tsx:199` + `src/App/App.tsx:118-136` — `resolvedSelection` resolves the explorer/properties selection; the explorer tree highlights `selectedIds` (`App.tsx:432`).

**Expected vs Actual:** Expected — one consistent notion of "active scene" across canvas, simulator, and inspector. Actual — if the explorer selection is a scene A, and a simulator state change makes `selectActiveScene` return scene B, the canvas keeps rendering scene A (`resolvedSelection.scene` wins) while the simulator card reports scene B; properties/explorer continue to highlight scene A. Three independent reads of "active" can display three different things with no reconciliation or warning. Editing commands (`deleteSelectionInScene`/`duplicateSelectionInScene`/`setWidgetGeometriesInScene`, `App.tsx:276,289,697,745,884`) are all scoped to `activeScene` (the *selected* scene), so mutations land on scene A while the simulator claims scene B is active.

**Recommended fix (design-level):** Introduce a single source of truth for "canvas scene" and surface an explicit indicator when `resolvedSelection.scene !== runtime.activeScene` (e.g. a "Runtime overrides selection" badge), or make the canvas honor the runtime scene in preview mode and the selection in design mode — but never silently.

---

### WC-10-04 Simulator evaluation context silently follows explorer selection via `runtimeRotation` (Severity: Medium · Failure types: UI misleading state · Confidence: CONFIRMED · Scenario: S2/S8)

**Evidence:**
- `src/App/App.tsx:200` — runtime rotation is derived from selection:
  > `const runtimeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];`
- `src/App/App.tsx:202` — `selectActiveScene` runs over that rotation's scenes:
  > `const runtime = useMemo(() => activeProfile ? selectActiveScene(runtimeRotation?.scenes ?? [], runtimeContext, activeProfile) : … , [runtimeRotation, activeProfile, runtimeValues, runtimeSettings]);`

**Expected vs Actual:** Expected — the simulator evaluates a well-defined, communicated target rotation. Actual — clicking a rotation (or any node that changes `resolvedSelection.rotation`) in the explorer silently re-targets the entire simulator (Active Scene card + activeBindings) to that rotation's scenes, with no indication that the simulation context changed. This is not communicated anywhere in the simulator panel (see `App.tsx:931-933`, which only mentions DeviceProfile / Scene selection / active-scene bindings).

**Recommended fix (design-level):** Render the rotation being evaluated in the simulator header ("Evaluating R90 · <rotation name>") and/or decouple the simulator target rotation from the explorer selection.

---

### WC-10-05 Runtime values/settings survive scene, rotation, and new-project switches — cross-document leakage (Severity: Medium · Failure types: cross-document leakage, cross-Scene leakage, stale state · Confidence: CONFIRMED · Scenario: S6)

**Evidence:**
- `src/App/App.tsx:176-177` — global UI state, not scoped to any document/scene/rotation:
  > `const [runtimeValues, setRuntimeValues] = useState<Record<string, PrimitiveValue | null>>({});`
  > `const [runtimeSettings, setRuntimeSettings] = useState<Record<string, PrimitiveValue | null>>({});`
- `src/App/App.tsx:754-758` — the only scene/rotation/document effect clears canvas geometry, never runtime values:
  > `useEffect(() => { if (canvasPointer.mode !== "idle") cancelCanvasInteraction(); else clearGeometryPreview(); return () => { geometryOverridesRef.current = {}; }; }, [activeDocument, activeRotation?.id, activeScene?.id]);`
- `src/App/App.tsx:230-241` — `createProject` resets selection/viewMode/documents but not `runtimeValues`/`runtimeSettings`/`simulationStatus`.
- `src/App/App.tsx:931` — only manual Reset clears them:
  > `onClick={() => { setSimulationStatus("idle"); setRuntimeValues({}); setRuntimeSettings({}); logAction("Simulator reset requested", "EVENT"); }}`

**Expected vs Actual:** If global runtime context is intentional, it should be scoped to a document (or clearly labeled global). Actual — values typed in one scene carry into another scene, another rotation, and even a brand-new project created via New Project, with no reset. With the foundation profile this is masked (no states), but with any real profile it produces cross-scene/cross-document leakage.

**Recommended fix (design-level):** Scope `runtimeValues`/`runtimeSettings` per open document (reset on `createProject` and document switch), or explicitly treat the simulator as a global scratchpad and reset it on New Project.

---

### WC-10-06 Duplicating a widget/scene clones bindings verbatim, leaving `binding.widgetId` pointing at the ORIGINAL widget — canonical reference corruption (Severity: High · Failure types: wrong Scene mutation, command mismatch, cross-widget reference corruption · Confidence: CONFIRMED · Scenario: S3)

**Evidence:**
- `src/Core/editor-application.ts:83-90` — `duplicateWidget` re-ids the widget but clones `bindings` untouched:
  > `function duplicateWidget(widget: Widget): Widget { return { ...clone(widget), id: newId("widget"), name: `${widget.name} Copy`, geometry: { ...widget.geometry, x: widget.geometry.x + 10, y: widget.geometry.y + 10 } }; }`
- `src/Core/editor-application.ts:92-99` — `duplicateScene` re-ids the scene and its widgets but not `binding.widgetId`:
  > `function duplicateScene(scene: Scene): Scene { return { ...clone(scene), id: newId("scene"), name: `${scene.name} Copy`, widgets: scene.widgets.map(duplicateWidget) }; }`
- `src/Core/editor-application.ts:267-305` — `duplicateSelection` fans out through `duplicateThemeProject`→`duplicateRotation`→`duplicateScene`→`duplicateWidget` (same verbatim binding clone at every level).
- `src/Domain/models.ts:106-108` — bindings carry an explicit owning-widget reference:
  > `export interface Binding { id: Id; widgetId: Id; conditions: readonly Condition[]; … }`
- `src/Core/validation.ts:114-115` — the invariant the command violates:
  > `if (binding.widgetId !== widget.id) { issue(issues, "BINDING_WIDGET_MISMATCH", "Binding widgetId must match its owning widget.", …); }`

**Expected vs Actual:** Expected — a duplicated widget's bindings re-target the new widget id (or are dropped). Actual — the copy's `bindings[].widgetId` still equals the ORIGINAL widget id, so the copy's bindings reference another widget; the project enters a state that `validateProject` flags as `BINDING_WIDGET_MISMATCH` immediately after a plain Duplicate command. `select-content` `contentId` (an asset id) is cloned verbatim, which is correct. If the original widget is later deleted, the copy's bindings point at a now-orphaned id.

**Recommended fix (design-level):** In `duplicateWidget`, remap every binding: `bindings: widget.bindings.map(b => ({ ...clone(b), id: newId("binding"), widgetId: <new widget id> }))`. This must also fix `duplicateScene`/`duplicateSelection` by construction (they all route through `duplicateWidget`).

---

### WC-10-07 Deleting the widget while its Binding Editor modal is open leaves a stale "Widget / Unknown" modal; Delete is not excluded in the modal (Severity: Medium · Failure types: stale state, lost selection, UI misleading state · Confidence: CONFIRMED · Scenario: S4)

**Evidence:**
- `src/App/App.tsx:959` — the shell keydown handler wraps the modal:
  > `<div className="app-shell" onClick={…} onKeyDown={handleCanvasKeyDown}>`
- `src/App/App.tsx:715-717` + `src/App/App.tsx:734-737` — Delete path, excluded only for inputs/textarea/select/contentEditable:
  > `if (isCanvasKeyboardExcludedTarget(target)) return;` … `if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteSelectionCommand(); return; }`
- `src/App/canvas-interaction.ts:95-97` — the exclusion list is narrow:
  > `export function isCanvasKeyboardExcludedTarget(target …): boolean { return Boolean(target.isContentEditable) || ["INPUT", "TEXTAREA", "SELECT"].includes((target.tagName ?? "").toUpperCase()); }`
- `src/App/App.tsx:988` — the modal is rendered inside the app-shell and has no INPUT/TEXTAREA/SELECT; its fallback text is:
  > `<strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Binding is evaluated inside the active Scene</small>`
- `src/App/App.tsx:204` — `bindingWidget` re-resolves on every render; after deletion it is `undefined`:
  > `const bindingWidget = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId)?.widget : undefined;`
- `src/App/App.tsx:911` — opening the modal does not clear selection, so the widget stays selected:
  > `<button … onClick={() => setBindingModal({ widgetId: widget.id })}>Open Binding Editor</button>`

**Expected vs Actual:** Expected — keyboard Delete is inert while a modal is open, or the modal auto-closes and the widget is not silently deleted. Actual — the binding modal contains no INPUT/TEXTAREA/SELECT, so focus (on the backdrop `<div>`, the `<section>`, or the close `<button>`) is not an excluded target; pressing Delete bubbles to the app-shell and runs `deleteSelectionCommand()`, removing the still-selected widget. `bindingWidget` then resolves to `undefined`, and the modal renders the fallback "Widget · Unknown" with an empty bindings list (`App.tsx:207` → `bindingEvaluations = []`), never closing. The widget is gone but the modal misleads the user into thinking it still exists.

**Recommended fix (design-level):** Add modal-state guards to `handleCanvasKeyDown` (skip Delete/Backspace when `bindingModal` or `settingsOpen` is set), and/or auto-close `bindingModal` when `bindingWidget` resolves to `undefined`.

---

### WC-10-08 Binding modal claims "evaluated inside the active Scene" but `evaluateBinding` is scene-independent; `activeBindings` is computed and never rendered (Severity: Medium · Failure types: UI misleading state, functional gap · Confidence: CONFIRMED · Scenario: S1/S8)

**Evidence:**
- `src/Core/runtime.ts:100-112` — `evaluateBinding` takes no Scene and only evaluates conditions against global context:
  > `export function evaluateBinding(binding, context, profile): BindingEvaluation { return { bindingId: binding.id, widgetId: binding.widgetId, matched: conditionsMatch(binding.conditions, binding.conditionMode, context, profile), action: binding.action, contentId: binding.contentId }; }`
- `src/App/App.tsx:207` — the modal's truth values come from the OPEN widget's bindings, not the active scene:
  > `const bindingEvaluations = useMemo(() => bindingWidget && activeProfile ? bindingWidget.bindings.map((binding) => evaluateBinding(binding, runtimeContext, activeProfile)) : [], …);`
- `src/App/App.tsx:203` — `activeBindings` is computed from the active scene but referenced nowhere else (grep across `src` finds only the definition):
  > `const activeBindings = useMemo(() => activeProfile && runtime.activeScene ? evaluateActiveSceneBindings(runtime.activeScene, runtimeContext, activeProfile) : [], …);`
- `src/App/App.tsx:988` — the claim:
  > `· Binding is evaluated inside the active Scene`

**Expected vs Actual:** Expected — the modal's truth table reflects the widget's bindings *within the active scene* (matching the copy), and the simulator surfaces the active-scene binding truth table it advertises (`App.tsx:933` "Simulator consumes … active-scene bindings"). Actual — `evaluateBinding` is scene-independent, so the modal evaluates the open widget's bindings globally regardless of whether that widget is in the active scene; the copy is wrong. Meanwhile `activeBindings` (the only scene-scoped binding evaluation) is a dead variable — never displayed in the simulator or anywhere else.

**Recommended fix (design-level):** Either display `activeBindings` in the simulator (honoring the copy) or correct the modal copy to "evaluated against the global runtime context"; and render or remove the unused `activeBindings` memo.

---

### WC-10-09 Binding actions are display-only; Preview mode is purely cosmetic — no behavior is applied (Severity: Medium · Failure types: functional gap, UI misleading state · Confidence: CONFIRMED · Scenario: S5)

**Evidence:**
- `src/Domain/models.ts:111-121` — bindings carry actions (`show/hide/play/pause/stop/restart/continue/select-content/select-style`).
- `src/App/App.tsx:775` — canvas widget rendering keys only off canonical `visible`/`enabled`, never off any binding evaluation:
  > `…className={`canvas-widget … ${widget.visible ? "" : "is-invisible"}`} …` (visibility from `widget.visible`, not from a `hide` action).
- grep across `src` for `activeBindings|bindingEvaluations|evaluateBinding|evaluateActiveSceneBindings` shows consumers only at `App.tsx:203` (unused) and `App.tsx:207`+`988` (modal truth table). No code applies `action`, `contentId`/`select-content`, or `select-style`.
- `src/App/App.tsx:973-974` — Preview mode changes only two labels; `viewMode` has no behavioral consumers:
  > `{viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}` and the top-bar `Design Mode/Preview Mode` chip (`App.tsx:963`).
- `src/App/App.tsx:931` — Run/Pause/Step only mutate `simulationStatus` and log; no simulation loop runs:
  > `onClick={() => { setSimulationStatus("running"); logAction("Simulator run requested", "EVENT"); }}` (Pause/Step analogous).

**Expected vs Actual:** Expected — a "RUNTIME PREVIEW" mode and a simulator that applies binding actions (hide/show the widget, switch `select-content`) so the preview reflects runtime behavior. Actual — bindings produce only TRUE/FALSE truth values in the modal; no action mutates the canvas; Preview mode is a cosmetic relabeling of the same design canvas, and the Run/Pause/Step controls are inert status toggles. The "runtime preview" promise (`App.tsx:974`) is not backed by any behavior.

**Recommended fix (design-level):** Either implement action application in preview mode (map `hide`/`show` to widget visibility, `select-content` to the widget's displayed asset) or relabel the surface as a "condition truth table / evaluation" rather than a runtime preview, and gate the Run/Pause/Step controls behind a real simulation loop.

---

### WC-10-10 Foundation profile has empty `runtimeStates`/`runtimeSettings` (and empty styles/languages/fonts), so all runtime/binding paths are dead by default (Severity: Low · Failure types: functional gap, UI misleading state · Confidence: CONFIRMED · Scenario: S1-S8 baseline)

**Evidence:**
- `src/Domain/factories.ts:10-15` — the only built-in profile ships empty registries:
  > `supportedFormats: [], runtimeStates: [], runtimeSettings: [], languages: [], digitStyles: [], directionStyles: [],`
- `src/App/App.tsx:932` — the simulator renders explicit empty branches:
  > `{profileStates.length === 0 ? <div className="sim-empty">No state registry entries in active DeviceProfile.</div> : …}` and `{profileSettings.length === 0 ? <div className="sim-empty">No runtime settings in active DeviceProfile.</div> : …}`
- `src/App/App.tsx:988` — the binding editor shows a "No bindings" empty state when a widget has none.

**Expected vs Actual:** Expected — an out-of-the-box project exercises at least one runtime state/setting so the binding editor and simulator are demonstrable. Actual — `createEmptyProject` (`factories.ts:26-35`) points at `foundationDeviceProfile`, which declares zero runtime states/settings, zero styles, zero languages, and zero fonts; the simulator permanently shows "No state registry entries" and the binding editor has nothing to evaluate against (every `conditionMatches` short-circuits at `runtime.ts:32-33` because `getDefinition` finds nothing). The UI does handle the empty case gracefully (empty branches exist), but the entire runtime subsystem is inert until an external profile is registered.

**Recommended fix (design-level):** Ship at least one profile with representative runtime states/settings (matching the test fixture at `tests/domain-runtime.test.ts:16-22`) so the runtime path is reachable in the default app, or clearly mark the foundation profile as a "no-capability stub".

---

### WC-10-11 Setting `defaultValue` is never seeded into `runtimeSettings`; untouched settings never satisfy their conditions (Severity: Medium · Failure types: persistence mismatch, UI misleading state · Confidence: CONFIRMED · Scenario: S7)

**Evidence:**
- `src/App/App.tsx:932` — the setting input uses `defaultValue` only as a placeholder, never writes it into state:
  > `<input type="text" value={runtimeSettings[setting.id] == null ? "" : String(runtimeSettings[setting.id])} placeholder={setting.defaultValue == null ? "Unset" : String(setting.defaultValue)} onChange={(event) => setRuntimeSettings((values) => ({ ...values, [setting.id]: event.target.value }))} />`
- `src/Core/runtime.ts:36-37` — an unset value is treated as non-matching:
  > `const value = (source === "setting" ? context.settings : context.values)?.[condition.stateId]; if (value === undefined || value === null) return false;`
- `src/Domain/models.ts:46-56` — `RuntimeSettingDefinition.defaultValue?: PrimitiveValue` and `persistence?: "volatile" | "persistent"`.

**Expected vs Actual:** Expected — a setting with `defaultValue` (e.g. the test profile's `language` default `"TR"`) satisfies `equals "TR"` until the user overrides it. Actual — `runtimeSettings` starts empty and `defaultValue` is only a visual placeholder; `conditionMatches` returns `false` for any condition on an untouched setting, so a persistent default like `language = TR` never matches out of the box. (This is independent of WC-10-01; it is a seeding issue, not a coercion issue.)

**Recommended fix (design-level):** Seed `runtimeSettings` from `activeProfile.runtimeSettings` defaults on profile/document load (and re-seed on Reset), or have `conditionMatches` fall back to `definition.defaultValue` when the context value is `undefined`.

---

## Invariant check table

Legend: ✅ holds · ⚠️ violated/divergent · — not applicable (no data/empty profile).

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 integer state → `equals 5` | ✅ | ✅ | ⚠️ no match shown (string vs number) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S2 simulator activates Scene B while A selected | ✅ | ✅ (A) | ⚠️ shows A, sim card shows B | ✅ | ✅ | ⚠️ divergent (canvas A vs runtime B) | ✅ | ✅ (A) | ✅ (A) |
| S3 duplicate widget with binding | ✅ | ✅ | ✅ (copy rendered) | ✅ | ⚠️ becomes dirty with corrupted binding | ✅ | ✅ | ✅ | ✅ |
| S4 delete widget with binding modal open | ✅ | ⚠️ widget gone, selection cleared by command | ✅ (widget gone) | ✅ (deletion recorded) | ✅ | ✅ | ✅ | ✅ | ⚠️ modal stays open, shows "Unknown" |
| S5 toggle Preview mode | ✅ | ✅ | ⚠️ same design canvas, only label changes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S6 runtime values persist across scene/new-project | ⚠️ new project keeps old runtime values | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| S7 untouched setting with `defaultValue` | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ condition false though default set | ✅ | ✅ | ✅ |
| S8 equal-priority scene tie-break | ✅ | ✅ | ⚠️ resolved by declaration order, not runtime order | ✅ | ✅ | ⚠️ tie-basis not surfaced | ✅ | ✅ | ✅ |

---

## Summary (counts by severity)

- **High: 3** — WC-10-01, WC-10-03, WC-10-06
- **Medium: 7** — WC-10-02, WC-10-04, WC-10-05, WC-10-07, WC-10-08, WC-10-09, WC-10-11
- **Low: 1** — WC-10-10
- **Critical: 0**

**Top findings one-liners:**
1. **WC-10-01 (High)** — Integer/number simulator inputs store raw strings, so `equals`/`greater-than`/`less-than` never match and `not-equals` is inverted (strict `===` + `isNumber` in `runtime.ts`).
2. **WC-10-03 (High)** — Canvas (`resolvedSelection.scene`), simulator card (`runtime.activeScene`), and explorer/properties can show three different "active" scenes simultaneously.
3. **WC-10-06 (High)** — Duplicating a widget/scene clones bindings verbatim, leaving `binding.widgetId` pointing at the original widget (immediately flagged `BINDING_WIDGET_MISMATCH`).
