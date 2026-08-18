# Phase 0 — Foundation Migration

## Status

Phase 0 establishes the first buildable application foundation. It is an architectural foundation, not the finished Template Designer.

## Architectural boundaries introduced

```text
Application Shell
      |
      +-- UI / React
      +-- Commands
      +-- Documents
      +-- Workspace
      |
      v
Application Core
      |
      +-- Project services
      +-- Validation boundary
      +-- Export / deployment boundary
      |
      v
Domain
      |
      +-- Project / Theme Project Group / Theme Project / Rotation / Scene
      +-- Widget / Asset / Media
      +-- DeviceProfile / Runtime State
      +-- Binding / Floor Mapping
      +-- Commands
      |
      v
Infrastructure / Platform
      |
      +-- Logging
      +-- Tauri shell
      +-- Future SD Card adapter
```

These are architectural boundaries. A boundary is not considered implemented merely because it is documented.

## Created foundation

### Frontend

- React + TypeScript
- Vite development server
- strict TypeScript configuration
- minimal CAD/IDE-oriented application shell
- browser-first development target

### Domain

Initial contracts exist for the core domain concepts. They are intentionally minimal and must remain aligned with the canonical Domain / Runtime Contract.

The foundation does **not** claim that the complete runtime engine is implemented.

### Application Core

Initial boundaries exist for:

- project lifecycle
- document store
- validation service boundary
- export/deployment orchestration boundary
- application errors/logging

### Commands

A minimal command/undo/redo contract exists. It is the basis for the later full editor command system; Phase 0 does not need the complete command catalogue.

### Tauri

A minimal Tauri v2 Windows shell exists. Tauri is a platform/application-shell boundary and does not own Template Designer domain semantics or firmware runtime behavior.

### Tests

Initial tests cover the foundation-level behavior that is actually implemented, including project creation, command undo/redo, and minimum project validation where present.

## Canonical domain rules that the foundation must preserve

- State and Scene are different concepts.
- Multiple runtime states may be active simultaneously.
- Runtime selects exactly one active Scene.
- Scene selection is priority-driven; same-priority activation is resolved by runtime activation order.
- DeviceProfile is the source of firmware-defined capabilities and runtime state definitions.
- Binding affects presentation inside the selected Scene; it does not select the active Scene.
- Z-order is visual ordering, not Scene priority.
- Digit uses Digit Style; it is not a font/glyph asset system.
- Warning State and Warning Sign Asset are different concepts.
- Media, Media Slide and semantic widgets are distinct concepts.
- Asset Depot is a library; unused depot assets are not automatically exported.
- Export/deployment is separate from the domain model.
- The Simulator must eventually use the canonical domain/runtime evaluation path rather than inventing a second rule system.

## Intentionally NOT implemented in Phase 0

- full canvas editor
- docking manager
- complete Properties panel
- full Project Explorer
- complete simulator
- firmware protocol
- ARKEL raw mapping
- Wi-Fi/ESP32 communication
- real SD-card deployment
- complete binding engine
- complete media engine
- full validation rules
- AI runtime integration

These belong to later phases. Phase 0 may establish interfaces and boundaries needed by them, but must not pretend they are complete.

## Implementation status rule

Documentation must distinguish:

- **IMPLEMENTED** — verified in source code/tests.
- **FOUNDATION / INTERFACE** — architectural boundary or minimal contract exists, but the feature is not complete.
- **PLANNED** — intentionally deferred to a later phase.

Do not describe a planned feature as implemented merely because its architecture is documented.

## Migration rule

Existing product/domain documentation remains authoritative. Implementation must not redefine product requirements merely to fit the current code.

When implementation and specification conflict, record the contradiction and correct the implementation or specification deliberately; do not silently change the product semantics.
