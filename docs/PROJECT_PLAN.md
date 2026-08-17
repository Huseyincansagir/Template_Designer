# Template Designer — V1 Project Plan

The plan is deliberately staged. Do not implement V2 capabilities while V1 is incomplete.

## Phase 0 — Repository and foundation

Goal: establish a clean, buildable Windows/web foundation.

- inspect repository and toolchain
- choose the smallest suitable workspace structure
- React + TypeScript + CSS frontend
- local browser development
- Tauri Windows shell
- shared/platform-neutral types
- application service boundaries
- adapter interfaces
- centralized logging/error model
- basic test/build commands

Exit criteria:
- frontend runs locally
- desktop shell starts
- core code is independent of Tauri
- no native calls are embedded in UI components

## Phase 1 — Project and template core

Goal: create/edit/save a useful template project.

- Project model
- Template model
- Asset model
- persistence
- template creation/open/save
- template editing
- component management appropriate to the supplied design references
- properties/inspector
- preview
- validation entry point

UI should evolve toward the supplied reference language: theme library, orientation selection, central display canvas, layers/resources and contextual properties.

Exit criteria:
- a project can be created, edited, saved, reopened and previewed
- editor and preview read the same canonical state

## Phase 2 — Deployment package

Goal: turn a valid project into a transport-independent package.

- package version
- manifest
- theme/layout data
- asset inclusion
- deterministic package assembly where practical
- checksum/hash
- package verification
- clear package build errors

Do not copy the editable project directory directly to a deployment target.

Exit criteria:
- a valid project produces a package
- package integrity can be verified independently

## Phase 3 — SD Card deployment

Goal: complete the real V1 workflow.

- removable-drive detection
- SD-card selection
- available-space check
- package-size check
- deployment progress
- safe/controlled write process
- verification after write
- checksum/hash comparison
- failure recovery guidance
- safe-eject workflow
- completion state telling the user the card can be removed and inserted into the target device

Exit criteria:

```text
Create/Edit -> Preview -> Validate -> Build -> Select SD -> Write -> Verify -> Eject
```

works reliably on Windows.

## Phase 4 — Product hardening

- regression tests
- error-message quality
- logging quality
- recovery from interrupted operations
- packaging/build verification
- performance review
- accessibility/usability pass
- documentation synchronization

## Phase 5 — V2 preparation only

Do not implement the transport.

Ensure the boundaries can later host:

- WiFiDeviceTarget
- DeviceTransport
- Device model
- protocol model
- capability model

Do not add ESP32 firmware, discovery, network communication, device web UI or cloud services in V1.

## Milestone rule

Do not move to the next phase merely because screens exist. A phase is complete only when the underlying behavior, persistence, tests and relevant integration are functional.
