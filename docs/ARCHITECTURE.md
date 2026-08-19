# Template Designer — Architecture

## Scope

This document turns the authoritative project prompt into an implementation boundary. It does not add a second product specification.

## System boundary

```text
React + TypeScript UI
        |
Application Core
        |
Deployment Manager
        |
Deployment Target
   +----+----+
   |         |
SD Card   Wi-Fi (V2 reserved)
```

The Windows desktop shell is Tauri. Tauri owns native integration and packaging; it must not become the domain model or business-logic layer.

## Layers

### Presentation

Browser-compatible React/TypeScript/CSS. Owns views, interaction state, editor presentation and user feedback. It must not directly access Windows drives or native APIs.

### Application Core

Owns project/template operations, validation orchestration, preview orchestration, package-building orchestration and deployment workflows. It exposes use-case-oriented services to the UI.

### Domain / Shared Types

Owns platform-neutral models such as Project, Template, Asset, DeploymentPackage, DeploymentTarget, Device and DeviceConnection. Keep these concepts distinct.

### Adapters

Native/platform-specific implementations live behind interfaces. V1 requires filesystem/removable-drive/SD-card capability. Wi-Fi/device transport is reserved for V2.

## Canonical flow

```text
Project
  -> Template editing
  -> Preview
  -> Validation
  -> Package Builder
  -> Deployment Package
  -> Deployment Manager
  -> SD Card Target
```

The same deployment package must later be usable by a Wi-Fi target without changing the template editor.

## Transport abstraction

Deployment is transport-independent at the application layer.

```text
UI
  -> DeploymentService
       -> RemovableStorageAdapter   [V1: Tauri / in-memory]
            -> physical SD card
       -> WiFiDeviceTarget          [V2 reserved]
```

A separate future `DeviceTransport` abstraction may model communication with an ESP32-C6. It must not be conflated with the SD-card target.

## Offline-first rule

No cloud service, account system, remote database or internet dependency belongs in the V1 core workflow. Browser compatibility means the UI/core can run locally in a browser during development; it does not mean the target device hosts a web application.

## Package boundary

Editable project data and deployment data are separate:

```text
Editable Project
      |
      v
Template Compiler / Package Builder
      |
      v
Versioned Deployment Package
      |
      +--> SD Card
      +--> Wi-Fi (V2)
```

The package format must be deterministic enough to hash and verify.

## Windows deployment boundary

The UI requests deployment through an application service. The application service resolves the selected deployment target. The SD-card adapter performs removable-drive detection, capacity checks, writing, verification and safe-eject operations.

Do not place any of these operations in React components.

## UI architecture

The reference screens imply these major product surfaces:

- Theme Library
- Design Studio
- Media/Resources
- Test Studio
- Publish/Deployment
- Settings

Design Studio should use a central device canvas, left-side navigation/resources/layers and a contextual right-side inspector. Preview and editor must derive from the same project state.

## Future Wi-Fi boundary

V2 may implement:

```text
PC Application
   -> WiFiDeviceTarget
   -> DeviceTransport
   -> ESP32-C6
   -> target device
```

The ESP32-C6 is not a web UI host. The exact network/device protocol is intentionally outside V1.

## Architectural constraints

- Do not couple domain models to React.
- Do not couple application services to Tauri APIs.
- Do not couple template data to SD-card paths.
- Do not implement Wi-Fi in V1.
- Do not add a backend merely to support local project management.
- Prefer small interfaces with a current purpose over speculative framework layers.
