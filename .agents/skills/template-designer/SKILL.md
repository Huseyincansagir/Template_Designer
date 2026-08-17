# Template Designer Product Skill

## Purpose

Use this skill whenever implementing or modifying the Template Designer product. It defines the product-level workflow and keeps implementation aligned with the repository's contract and reference UI.

## Required inputs

Before changing code, inspect:
- `AGENTS.md`
- `Template Designer Widget ve Tema Sözleşmesi.md` if present
- all existing source files
- supplied UI/theme references available in the project

## Workflow

1. Understand the existing repository before changing it.
2. Identify the affected domain concepts.
3. Update domain/application models first.
4. Implement the behavior through services/commands.
5. Connect the UI to the real state.
6. Add/update validation and tests.
7. Verify save/load and publish behavior if the change touches project data.
8. Build and run tests before considering the task complete.

## Canonical model

Use one canonical `ThemeProject` as the source for:
- Design Studio
- Preview
- Test Studio
- Validation
- Publish

Do not maintain separate ad-hoc UI representations that can diverge from the project model.

## UI behavior

The application should feel like a professional Windows engineering/design tool. Preserve the established visual language: light workspace, dark device canvas, restrained teal accent, compact controls, strong hierarchy, clear selection states, layers and a dynamic properties inspector.

Prefer contextual controls over giant static property forms.

## Done criteria

A feature is not complete if its UI exists but its underlying project state, persistence, validation, preview, or publish path is missing where applicable.
