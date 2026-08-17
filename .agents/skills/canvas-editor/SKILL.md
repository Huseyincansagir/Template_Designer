# Canvas Editor Skill

Use this skill for Design Studio, canvas rendering, selection, geometry, layers, anchors and editor interactions.

## Requirements

- Render at the device's logical resolution while scaling to the available viewport.
- Preserve aspect ratio.
- Support zoom, pan, rulers, selection, multi-selection, resize, alignment, distribution, duplicate, delete, lock and undo/redo.
- Keep editor coordinates separate from screen/pixel coordinates.
- Use a render model derived from the canonical ThemeProject.
- Keep interaction responsive; do not serialize the whole project on every pointer move.

## Anchors

Support 9-point anchors and canvas/safe-area/widget targets. Support dynamic content anchors only when the firmware profile permits them. Detect cycles and missing targets before publish.

## Layers

Layer ordering must correspond to render ordering. Visibility and lock state must be real project state.

## Quality

Selection handles, guides and inspector changes must update the same canonical state used by preview and export. Avoid fake rectangles that are disconnected from actual widgets.
