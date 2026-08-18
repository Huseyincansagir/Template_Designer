# Template Designer — Development Plan V1

**Status:** Canonical implementation roadmap for the current `manus2` development phase.

## 0. Purpose

This document turns the existing canonical UI, Domain/Runtime, and Foundation decisions into an ordered implementation plan for the four current Manus agents. It is an execution plan, not a replacement for the canonical specifications.

### Canonical sources

- `docs/UI_DESIGN_SYSTEM_V2.md` — canonical UI/UX behavior and interaction model.
- `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` — later UI decisions/corrections.
- `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md` — canonical runtime/domain behavior.
- `docs/DOMAIN_MODEL_V1.md` — canonical domain hierarchy/model.
- `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md` — application shell/domain/editor boundaries.
- `docs/PHASE_0_FOUNDATION_MIGRATION.md` — Phase 0 foundation scope.

**Rule:** agents must not silently redefine canonical semantics. If a real contradiction is found, report it before changing the contract.

---

# 1. Current Baseline

The following are considered substantially complete and should not be redesigned:

- Domain Project hierarchy and runtime contract.
- `State != Scene`; one active Scene; priority `0–10`; equal-priority runtime activation order.
- DeviceProfile capability model and registry abstraction.
- Typed Binding validation.
- Media/Widget separation.
- Floor Mapping and Digit Style concepts.
- Validation and deterministic deployment package model.
- Tauri/Core boundary and basic command/document infrastructure.
- Full canonical UI specification.
- Application Shell first implementation and canonical Project Explorer integration.

The current bottleneck is no longer domain modeling. It is turning the UI into a real editor with one coherent mutation pipeline.

---

# 2. Target Editor Architecture

The target mutation flow is:

```text
UI Event
   ↓
Application Command / Use Case
   ↓
Document Store / Canonical Project State
   ↓
Command History
   ↓
Selectors / View Models
   ↓
Canvas / Explorer / Properties / Simulator
```

React UI state may own transient presentation state such as selection, hover, drag state, zoom, active panel, and modal state. It must not become a second source of truth for Project/Theme/Rotation/Scene/Widget domain state.

The target editor loop is:

```text
Select Widget
  → edit on Canvas or Properties
  → canonical Project mutation
  → DocumentStore update
  → CommandHistory entry
  → Canvas + Properties + Explorer refresh
  → Undo
  → exact previous state restored
  → Redo
  → exact edited state restored
```

---

# 3. Agent Ownership and Order

## Agent 1 — Editor/Application Core

**Scope:** mutation pipeline, document ownership, command/use-case integration, undo/redo, dirty state.

**Must finish before Agent 2's real mutation work is merged.**

### Prompt

```text
TEMPLATE DESIGNER — PHASE 1: EDITOR MUTATION PIPELINE

Read first:
- docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md
- docs/UI_DESIGN_SYSTEM_V2.md
- docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md
- docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md
- docs/DOMAIN_MODEL_V1.md
- docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md

Goal: establish one canonical editor mutation pipeline.

Do NOT redesign the Domain model.
Do NOT create a second Project state model.
Do NOT implement Canvas interaction yet.

Implement/finish:
1. DocumentStore as the canonical owner of the current editable Project document.
2. Application/use-case boundary for Project mutations.
3. CommandHistory integration for editor mutations.
4. Dirty/clean document state.
5. Undo/Redo that restores exact canonical Project state.
6. Safe document open/create/close lifecycle.
7. Selector/view-model boundary for UI reads where useful.
8. Editor command execution contracts for:
   - add Theme Project
   - add Rotation
   - add Scene
   - move/reorder Scene
   - move/reorder Widget
   - edit Widget properties
   - delete selection
   - duplicate selection where the canonical model permits it.

The existing editor command descriptors are not enough by themselves; connect them to the canonical application command/use-case layer.

React state may keep transient UI state, but Project/Theme/Rotation/Scene/Widget state must not have a competing React source of truth.

Do not implement real SD-card writes, firmware communication, or full runtime engine.

Acceptance:
- A Project mutation goes through the application command/use-case boundary.
- DocumentStore is the source of truth for the open document.
- Every implemented mutation can be undone and redone.
- Dirty state follows mutations and returns clean after undoing to the saved state.
- Existing Domain and Foundation tests remain valid.

Run:
npm run typecheck
npm test
npm run build
npm run tauri:check

Commit only if all required checks pass:
feat: establish canonical editor mutation pipeline
```

---

# 4. Agent 2 — Canvas Editor

**Scope:** actual design-surface interaction. Start after Agent 1's mutation pipeline is available.

### Prompt

```text
TEMPLATE DESIGNER — PHASE 2: CANVAS EDITOR

Read:
- docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md
- docs/UI_DESIGN_SYSTEM_V2.md
- docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md
- docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md

Use the mutation/application pipeline produced by Agent 1.
Do NOT create local Project mutation state.
Do NOT redesign Domain semantics.

Implement the Canvas editor in this order:

A. Core interaction
- single selection
- Ctrl multi-selection
- marquee selection
- drag
- resize handles
- zoom
- pan
- display aspect-ratio preservation
- snap grid

B. Selection rules
- locked widget remains selectable but cannot have geometry changed
- invisible widget is not rendered but remains selectable through Explorer/selection bounds
- empty canvas click clears selection
- unsupported profile capabilities cannot be added

C. Editing
- delete selection
- duplicate selection
- z-order changes
- geometry changes

Every mutation must use the canonical application command/use-case pipeline and therefore support Undo/Redo.

D. Later interaction hooks
Prepare clean extension points for:
- R → 90° rotation
- 5° rotation snap
- 45°/90° indicators
- aspect-ratio lock
- Bounding Group
- alignment/distribution

Do not implement those advanced behaviors unless the current architecture can support them without bypassing the mutation pipeline.

Canvas must derive:
- Rotation
- Scene
- Widget
- DeviceProfile capabilities
from canonical state; no hard-coded display size, widget whitelist, or runtime state.

Acceptance:
- A real widget can be selected, moved, resized and deleted.
- Changes persist in the canonical Project.
- Properties/Explorer can observe the same mutation.
- Undo/Redo restores exact geometry/selection-relevant state.
- Snap behavior follows the canonical UI rules.

Run typecheck, tests, production build and Tauri check.

Commit:
feat: implement canonical canvas editor interactions
```

---

# 5. Agent 3 — Properties and Editor Synchronization

**Scope:** contextual inspector and synchronization between Canvas, Properties, Explorer, and canonical Project state.

**Start after Agent 1; preferably after Agent 2 has the first stable Canvas interaction pass.**

### Prompt

```text
TEMPLATE DESIGNER — PHASE 3: PROPERTIES / EDITOR SYNCHRONIZATION

Read:
- docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md
- docs/UI_DESIGN_SYSTEM_V2.md
- docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md
- docs/DOMAIN_MODEL_V1.md
- docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md

Do not redesign the Domain model.
Do not create a second Project state.
Use the canonical editor command/use-case pipeline.

Turn Properties into a real contextual inspector.

Single selection:
- geometry
- position
- size
- visibility
- lock
- z-order
- type-specific supported properties
- style/media/binding fields where already defined by canonical contract

Multi-selection:
- common value → actual value
- differing value → `*`
- entering a value into `*` applies it to all compatible selected widgets
- unsupported/incompatible fields are hidden or disabled

Rules:
- locked geometry is read-only
- invisible widgets remain selectable
- unsupported DeviceProfile properties are not presented
- validation errors are visible next to the affected property
- changing a property is an undoable command

Synchronize:
Canvas selection ↔ Explorer selection ↔ Properties selection.

A property edit must:
UI → command/use-case → DocumentStore → CommandHistory → selectors → UI.

Do not mutate the Project directly from a React component.

Acceptance:
- Canvas move is reflected in Properties.
- Properties geometry edit moves the Canvas widget.
- Explorer selection updates Properties.
- Multi-selection `*` works.
- Undo/Redo works for property edits.
- Dirty state updates correctly.

Run all standard checks.

Commit:
feat: implement canonical properties editor integration
```

---

# 6. Agent 4 — Workspace, Docking, Assets, Simulator

**Scope:** workspace infrastructure and secondary editor surfaces. Do not bypass the canonical editor pipeline.

**Start after Agents 1–3 provide stable contracts; these areas may be developed in smaller independent commits.**

### Prompt

```text
TEMPLATE DESIGNER — PHASE 4: WORKSPACE / ASSET / SIMULATOR

Read:
- docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md
- docs/UI_DESIGN_SYSTEM_V2.md
- docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md
- docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md

Do not redesign Domain or runtime semantics.
Do not replace the editor mutation pipeline.

Part A — Docking
Implement/strengthen real desktop tool-window behavior:
- dock
- undock
- resize
- split
- tab stack
- floating
- collapse
- auto-hide
- close/reopen
- reset layout
- workspace layout persistence

Panel layout state is UI/application state, not Domain state.
Canvas geometry must not change when panels resize.

Part B — Asset Browser
Implement the canonical depot workflow:
- Asset Depot/library
- categories
- search/filter
- image preview
- video preview/frame/playback
- audio playback with play/pause/seek
- stable ID and display name
- Used indicator
- Resources relationship
- Unsupported Files relationship

Do not treat Asset Browser as Project Resources.
Do not put widgets/scenes into Resources.

Part C — Simulator
Use the existing canonical runtime evaluator.
Do not create a second state/scene/binding engine.
Prepare the Simulator to render the same canonical Scene/Widget presentation used by the editor.

The simulator must not silently change document selection or edit state.

Acceptance:
- Docked panels behave like desktop engineering software.
- Asset Browser follows canonical depot/resource rules.
- Simulator uses canonical runtime evaluation.
- No duplicate domain model is introduced.

Run all standard checks.

Commit each coherent sub-area separately when practical.
```

---

# 7. QA / Integration Agent

QA is not a fifth permanent implementation owner. It is activated after each major phase or when parallel work creates integration risk.

### QA Prompt

```text
TEMPLATE DESIGNER — PHASE GATE QA

Read:
- docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md
- docs/UI_DESIGN_SYSTEM_V2.md
- docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md
- docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md
- docs/DOMAIN_MODEL_V1.md
- docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md

Do not modify code and do not commit.

Audit the current HEAD against the canonical documents and the phase acceptance criteria.

Check:
1. Domain contract is unchanged.
2. Project hierarchy is canonical.
3. DocumentStore is the single Project source of truth.
4. Mutations use application commands/use cases.
5. Undo/Redo covers implemented mutations.
6. Canvas reads/writes canonical state.
7. Properties and Explorer observe the same state.
8. DeviceProfile capabilities are not hard-coded in UI.
9. Runtime/Simulator uses canonical evaluator.
10. Asset Depot / Resources / Unsupported Files boundaries are preserved.
11. Tauri/Core/Domain/UI boundaries remain intact.
12. No duplicate rule system or domain model exists.
13. Typecheck/tests/build/Tauri checks pass.

For every finding report:
SEVERITY / FILE / CURRENT / EXPECTED / PROBLEM / RECOMMENDATION.

End with:
PASS / PASS WITH WARNINGS / FAIL.
```

---

# 8. Execution Protocol

## Before starting

Every agent must:

1. Pull/rebase the latest `manus2`.
2. Inspect the current HEAD rather than assuming previous reports are current.
3. Read the canonical documents listed above.
4. Identify files owned by other agents.
5. Avoid modifying another agent's scope unless required for integration.

## After each task

```text
implement
  ↓
typecheck
  ↓
tests
  ↓
production build
  ↓
Tauri check when applicable
  ↓
commit
  ↓
push
  ↓
report SHA + changed files + tests
```

If a check fails, do not report the task as complete.

## Parallelism rule

Parallel work is allowed only when file ownership and contracts are independent.

Safe examples:
- UI visual work + Foundation documentation audit.
- Asset Browser UI + QA documentation review.

Unsafe examples:
- two agents simultaneously changing `App.tsx` or the same application service.
- UI and Domain agents simultaneously redesigning the same model.

When overlap is unavoidable, one agent becomes the owner and the other must only review/report.

---

# 9. Phase Gates

### Gate 1 — Mutation Pipeline

Must pass:
- DocumentStore source of truth.
- Application command/use-case boundary.
- Undo/Redo.
- Dirty state.
- Existing Domain/Runtime tests.

### Gate 2 — Canvas

Must pass:
- selection.
- drag.
- resize.
- snap.
- delete/duplicate.
- canonical mutation pipeline.

### Gate 3 — Properties

Must pass:
- single selection inspector.
- multi-selection `*`.
- Canvas/Explorer/Properties synchronization.
- Undo/Redo.

### Gate 4 — Workspace / Assets / Simulator

Must pass:
- docking behavior.
- asset depot workflow.
- simulator canonical runtime usage.
- no architecture boundary regression.

### Gate 5 — Final Integration QA

Must pass:
- typecheck.
- all tests.
- production build.
- Tauri check.
- canonical UI audit.
- Domain/Runtime audit.
- Foundation boundary audit.

---

# 10. Deferred Work

Do not pull these into the current phase unless explicitly scheduled:

- Real SD-card hardware writing adapter.
- Full firmware communication.
- Full media format conversion.
- MP4 → AVI or general transcoding pipeline.
- Advanced firmware-side resource lookup/indexing optimization.
- Multi-monitor docking if not supported by the selected UI framework.
- Full runtime/media/audio engine beyond the canonical contracts already implemented.

These remain planned work, not reasons to destabilize the current editor foundation.

---

# 11. Definition of Done

Template Designer reaches the next major milestone when a user can:

1. Open/create a canonical Project.
2. Navigate Theme Project Group → Theme Project → Rotation → Scene.
3. Select widgets from Explorer or Canvas.
4. Move/resize/edit/delete/duplicate widgets.
5. Edit the same properties from Properties.
6. See Canvas, Explorer and Properties remain synchronized.
7. Undo and redo every implemented edit.
8. Use canonical DeviceProfile capabilities.
9. Validate the project.
10. Preview/simulate the canonical runtime result.
11. Browse assets through the Asset Depot and use them according to canonical resource rules.
12. Save/export a deterministic verified package without violating the SD-card deployment boundary.

At that point the application has crossed from “UI shell with domain integration” into a real engineering template editor.
