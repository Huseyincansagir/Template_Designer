# Validation Skill

## Purpose

Use this skill for project validation, package readiness and deployment preflight.

## Validation layers

1. Project/template structure
2. Required template data
3. Asset references and availability
4. Layout/content validity
5. Package build validity
6. Deployment target readiness
7. Post-write verification

The exact validation rules must be derived from the project specification and the actual package schema. Do not invent firmware rules that have not been specified.

## Result model

Validation results should be structured and actionable:

- severity: info / warning / error
- stable code
- human-readable message
- affected project/template/asset/package/target where applicable
- suggested remediation

## Deploy rule

A blocking validation error prevents package generation or deployment. Warnings must be visible and handled by an intentional policy; do not silently ignore them.

## SD-card preflight

Before writing:

- target removable drive must be detected
- target must be selectable
- available space must be sufficient
- package must be valid and verified

After writing, verification must complete before reporting success.

## Error handling

Never expose raw exceptions as the primary user-facing message. Preserve technical details in centralized logs and provide the user with what failed, why it matters and what action to take.
