# Template Designer — Agent Contract

## Authoritative specification

The primary product specification is `Template Designer — Ana Proje Geliştirme Promptu.md`. Read it before architectural or implementation work. It defines the V1 product boundary, deployment model, offline requirement, future Wi-Fi boundary, technology direction, workflow, reliability requirements and development phases.

The supplied UI/theme screenshots are the visual reference. They establish the intended product language: professional engineering/designer tooling, theme library and orientation variants, a central device canvas, contextual properties, layers/resources, media, test sequences, validation and publish/deployment states.

Do not silently replace these requirements with a generic template editor architecture.

## Product mission

Build a Windows desktop Template Designer / Device Deployment application.

V1's real deployment path is only:

`PC -> SD Card -> physical target device`

The application is offline-first. No cloud, account, remote database, internet dependency or device-hosted web UI is part of V1.

The UI is a local web-technology application using React + TypeScript + CSS and may use SVG/Canvas. Development must support localhost execution. Production must be packageable as a Windows desktop application, with Tauri as the preferred shell while keeping the application core independent of Tauri.

## Core architecture

The central principle is **One Template, Multiple Deployment Transports.**

```text
UI / Presentation
        |
Application Core
        |
Deployment Manager
        |
Deployment Target
   +----+----+
   |         |
SD Card   Wi-Fi (reserved V2)
```

V1 implements only the SD-card target. A future Wi-Fi target may communicate with an ESP32-C6, but V1 must not implement Wi-Fi communication, ESP32 firmware, an ESP32 web page, cloud services or browser-to-device deployment.

The deployment package must be transport-independent so the same package can later be delivered by SD card or Wi-Fi.

## Platform isolation

Never put native filesystem, removable-drive, safe-eject or future network/device calls directly inside React components.

Use:

`UI -> Application Service -> Platform/Deployment Adapter`

Examples:

`DeploymentService -> SDCardAdapter -> Windows removable storage`

`DeploymentService -> WiFiDeviceAdapter (reserved for V2)`

The UI must not need to know which transport is being used.

## Domain boundaries

Keep these concepts distinct:

- Project
- Template
- Asset
- DeploymentPackage
- DeploymentTarget
- Device
- DeviceConnection

Shared types should be centralized and platform-neutral. Do not make the visual editor's component tree the deployment source of truth. Use a canonical project/template model consumed by editor, preview, validation, package building and deployment.

## V1 workflow

```text
Open/Create Project
 -> Edit Template
 -> Preview
 -> Validate
 -> Build Deployment Package
 -> Select SD Card
 -> Write
 -> Verify
 -> Safe Eject
 -> User inserts card into target device
```

The deployment UI must expose clear states such as Preparing, Writing, Verifying and Completed and explain failures in user-oriented language while retaining technical details in logs.

## Reliability

Deployment is a real device operation. Support or design for removable-drive detection, available-space validation, package-size validation, progress reporting, checksum/hash verification, temporary/atomic writes where practical, failure handling, detailed logs, safe-eject workflow and explicit completion state.

Never claim success before verification completes.

## Package boundary

Do not copy the editable project directory directly to the SD card.

Use:

```text
Project
  -> Template Compiler / Package Builder
  -> Deployment Package
  -> Deployment Target
```

The package schema must be documented and versioned. The project specification currently describes a logical package containing a manifest, theme/layout data, assets and checksum information. Do not invent target-device file semantics beyond the specification.

## UI rules

Use the screenshots as interaction and visual references, not pixel-perfect specifications. Preserve these characteristics:

- light workspace around a dark device/display preview
- restrained teal/cyan accent
- clear active/selected states
- compact controls and strong hierarchy
- central device canvas
- contextual right-side inspector
- left navigation/resource/layer areas
- status/validation/deployment feedback
- theme library with physical orientation variants
- test sequence/block workflow
- publish readiness feedback

## Development rules

Before changing code:

1. Read this file.
2. Read `Template Designer — Ana Proje Geliştirme Promptu.md`.
3. Read all applicable `.agents/skills/*/SKILL.md` files.
4. Inspect the complete repository and existing toolchain.
5. Determine the smallest coherent architectural change.

Then:

- update architecture/domain models before wiring UI when data behavior changes
- keep browser-compatible logic platform-neutral
- keep native APIs behind adapters
- add tests for core behavior
- build after meaningful milestones
- never leave fake core buttons, placeholder deployment, or TODO implementations for claimed V1 functionality
- do not add V2 Wi-Fi functionality prematurely
- do not create abstractions with no architectural purpose

## Completion rule

A feature is complete only when its underlying state, persistence where applicable, UI behavior, validation and relevant application/deployment path are coherent.

The V1 acceptance test is successful Windows execution of the full SD-card workflow from project creation/editing through verified deployment and safe removal.
