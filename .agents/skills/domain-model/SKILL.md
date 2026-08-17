# Domain Model Skill

Use this skill for ThemeProject, forms, scenes, widgets, styles, media, firmware profiles, validation models and persistence schemas.

## Rules

- Domain objects must represent the product contract, not the current UI layout.
- Stable IDs are required for themes, widgets, scenes, assets and styles.
- Four physical forms are first-class: `r0`, `r90`, `r180`, `r270`.
- Canonical scene IDs are `yangin`, `estop`, `asiri_yuk`, `servis_disi`, `kapi_ac`, `kapi_kapa`, `seyir_yukari`, `seyir_asagi`, `bosta`.
- Separate base widget state from scene overrides.
- Keep designer-only fields distinct from firmware-exportable fields.
- Model firmware capability profiles explicitly.
- Use versioned, migration-friendly persisted project schemas.

## Changes

When changing a domain model:
1. Find all consumers.
2. Update serialization/deserialization.
3. Update validation.
4. Update preview/render model mapping.
5. Update export mapping if relevant.
6. Add regression tests.
