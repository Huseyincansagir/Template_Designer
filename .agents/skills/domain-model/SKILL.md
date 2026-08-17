# Domain and Shared Model Skill

## Purpose

Use this skill for Project, Template, Asset, DeploymentPackage, DeploymentTarget, Device and DeviceConnection models and shared TypeScript contracts.

## Core separation

Keep these concepts distinct:

- `Project` — editable project container and persistence boundary
- `Template` — template/theme data being designed
- `Asset` — source or deployment asset
- `DeploymentPackage` — compiled, transport-independent delivery artifact
- `DeploymentTarget` — physical delivery mechanism
- `Device` — future target-device identity/capability model
- `DeviceConnection` — future communication state

Do not make SD-card paths or network addresses part of the Template model.

## Canonical state

Editor, preview, validation, package builder and deployment preparation must consume a coherent canonical project/template state. Avoid separate UI-only representations that can diverge from persisted data.

## V1 transport model

```text
DeploymentTarget
├── SDCardTarget        active V1
└── WiFiDeviceTarget    reserved V2
```

A future device transport is separate from the deployment target abstraction.

## Persistence

Project persistence must be versioned and migration-friendly. Do not couple the persisted schema to React component state or Tauri APIs.

## Package model

The deployment package is derived from the editable project. It should carry version/manifest, theme/layout data, required assets and integrity information according to the documented package format.

## Device model

Future device information may include id, name, type, IP address, firmware/hardware versions, capabilities and connection status. V1 does not require device management.

## Change checklist

When changing a model:

1. update shared types/domain code
2. update serialization/deserialization
3. update application services
4. update validation
5. update preview mapping
6. update package mapping if relevant
7. add regression tests

Do not add speculative fields solely to make future UI screens look complete.
