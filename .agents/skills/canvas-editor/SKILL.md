# Canvas / Design Studio Skill

## Purpose

Use this skill for the visual Template Designer shown in the supplied reference screens.

## Visual product language

Target a professional engineering/design application rather than a generic website builder.

Reference characteristics:

- light neutral workspace
- dark device/display preview
- restrained teal/cyan accent
- compact toolbar controls
- clear active/selected states
- central canvas
- contextual right-side Properties/Inspector
- left navigation, resources or layers
- theme/orientation controls
- status/validation feedback

## Editor responsibilities

Design Studio should provide a real device-oriented editing surface with:

- logical device canvas
- zoom/pan
- selection
- multi-selection where useful
- resize handles
- rulers/guides where useful
- alignment/distribution
- duplicate/delete
- lock/visibility
- undo/redo
- contextual properties

The exact widget set and behavior must come from the product specification and subsequent domain contracts; do not invent a second incompatible editor model.

## State rule

Selection, geometry, visibility, lock state and property changes must update canonical application state. Avoid fake rectangles or local-only widgets that disappear when preview or persistence is used.

## Platform rule

Canvas/editor code must remain browser-compatible. Native Windows operations such as SD-card access must never be embedded in canvas components.

## Performance

Keep pointer interactions responsive. Do not serialize the entire project on every pointer movement. Use an editor/render model derived from canonical state and commit meaningful edits through application state/commands.

## Completion

A visual feature is complete only when it is represented in canonical state and participates correctly in preview, persistence, validation or package generation wherever relevant.
