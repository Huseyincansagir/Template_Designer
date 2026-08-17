# Validation Skill

Use this skill whenever implementing project validation, firmware compatibility checks or publish readiness.

## Validation layers

1. Domain validation
2. Form/layout validation
3. Scene and visibility validation
4. Widget/property validation
5. Anchor graph validation
6. Media/font/audio validation
7. Firmware capability validation
8. Package/output validation

## Result model

Validation results should be structured and actionable:
- severity: info, warning, error
- stable code
- human-readable message
- affected form/scene/widget/asset where applicable
- suggested fix

## Publish rule

Any blocking `error` prevents publishing.

Alarm scenes must default to fail-closed behavior: floor number and direction arrow are hidden unless explicitly enabled for that alarm scene.

Never expose raw exceptions as the primary user-facing validation message.
