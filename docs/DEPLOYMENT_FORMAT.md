# Deployment Package Format

> **STM32 cihaz paketi:** bu belgedeki `theme.pkg` örneği **mantıksal** pakettir. MyApplication_6 `template-designer/*.json` okumaz. Cihaz ağacı: [`stm32-contract/`](stm32-contract/).
>
> **Taşıma:** ürün V1 = SD. Ürün V2 = SD + Wi-Fi; SD **devre dışı bırakılmaz**. Aynı paket iki yolla da gider.

## Purpose

The deployment package is the boundary between editable project data and physical delivery. It is transport-independent.

```text
Template Project
      |
      v
Template Compiler / Package Builder
      |
      v
Deployment Package
      |
      +--> SD Card (V1)
      +--> Wi-Fi / ESP32-C6 (V2)
```

## Editable project vs deployment package

Do not write the user's editable project directory directly to the SD card.

An editable project may contain source files, templates, components and assets. A deployment package contains only the data required by the target deployment contract.

## Logical package

The current project specification describes the package conceptually as:

```text
theme.pkg
├── manifest.json
├── theme.json
├── layout.json
├── assets/
│   ├── logo.png
│   ├── background.jpg
│   └── icons/
└── checksum
```

This is a logical example, not a claim about an already-existing firmware parser. Do not invent device-specific package semantics until they are specified by the project.

## Required properties

The package system must support:

- package/version identity
- manifest metadata
- theme/layout data
- required assets
- integrity information
- verification before deployment

The exact schema must be versioned and documented before implementation is treated as stable.

## Build pipeline

```text
Load project
   -> validate
   -> resolve required assets
   -> build package
   -> calculate integrity data
   -> verify package
   -> hand package to DeploymentManager
```

A failed validation or failed package verification blocks deployment.

## SD-card deployment

The SD-card adapter receives a verified package and a user-selected removable target. It must check capacity before writing and verify the written result afterward.

The UI must not claim deployment success until verification succeeds.

## Future Wi-Fi

The same package must be transferable by a future Wi-Fi target. Package creation must therefore not contain SD-card-specific assumptions.

The future network protocol is outside V1.
