# Package and SD Deployment Skill

## Purpose

Use this skill for deployment-package construction and the real V1 Windows SD-card workflow.

## Boundary

```text
Editable Project
   -> Template Compiler / Package Builder
   -> Deployment Package
   -> Deployment Manager
   -> SDCardTarget
   -> Removable SD Card
```

The package is transport-independent. The SD-card adapter is one deployment implementation, not part of the template model.

## Package requirements

The package concept described by the project specification contains:

- manifest metadata
- theme/layout data
- required assets
- checksum/integrity data

Keep the exact format versioned and documented. Do not invent target-device semantics without a source requirement.

## SD-card workflow

Support:

1. removable-drive detection
2. SD-card selection
3. available-space check
4. package-size check
5. write progress
6. verification
7. checksum/hash comparison
8. clear failure handling
9. safe-eject workflow
10. explicit successful completion

Never report success before verification finishes.

## Reliability

Prefer temporary/atomic write strategies where practical. Avoid partially replacing a target package when a write fails. Preserve detailed technical logs while showing actionable user-facing errors.

## UI integration

React components call application services. They do not access drives directly.

```text
UI
 -> DeploymentService
 -> SDCardAdapter
 -> Windows removable storage
```

The same application service boundary must be able to host a future Wi-Fi target.

## V1 exclusion

Do not implement Wi-Fi, ESP32-C6 firmware, discovery, network protocols, cloud services or browser-to-device deployment as part of this skill's V1 work.
