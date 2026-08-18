# Phase 0 — Foundation Migration

## Status

The repository has been moved from a specification-only state into the first buildable application foundation.

## Architectural boundaries introduced

```text
Application Shell
      |
      +-- UI / React
      +-- Commands
      +-- Documents
      +-- Workspace (future)
      |
      v
Application Core
      |
      +-- Project services
      +-- Validation boundary
      +-- Deployment boundary
      |
      v
Domain
      |
      +-- Project / Theme / Rotation / Scene
      +-- Widget / Asset
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

## Created foundation

### Frontend

- React + TypeScript
- Vite development server
- strict TypeScript configuration
- minimal CAD/IDE-oriented application shell
- browser-first development target

### Domain

Initial contracts exist for:

- Project
- Theme
- Rotation
- Scene
- Widget
- Asset
- DeviceProfile
- RuntimeStateDefinition
- Binding
- FloorMappingEntry
- DeploymentTarget
- DeploymentManager

These are intentionally minimal. Product behavior must be added in later phases according to the existing specifications.

### Application Core

Initial boundaries exist for:

- project lifecycle
- document store
- validation service
- deployment orchestration
- application errors/logging

### Commands

A minimal command/undo/redo contract exists. It is intentionally small and is the basis for the later full editor command system.

### Tauri

A minimal Tauri v2 Windows shell exists with no product business logic in Rust.

### Tests

Initial tests cover:

- project creation
- command undo/redo
- minimum project validation

## Intentionally NOT implemented

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

These belong to later phases.

## Migration rule

Existing product/domain documentation remains authoritative. Implementation must not redefine product requirements merely to fit the current code.
