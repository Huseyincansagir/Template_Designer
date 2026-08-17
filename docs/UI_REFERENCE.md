# UI Reference — Supplied Screens

This document records the visual/interaction direction visible in the supplied reference screens. It is a design reference, not a pixel-perfect implementation specification.

## Overall visual language

The references consistently show a professional desktop engineering/design application:

- predominantly light neutral application workspace
- dark device/display preview as the visual focus
- restrained teal/cyan accent for active states and controls
- high-contrast typography and compact labels
- thin borders, subtle elevation and clean spacing
- dense information without visual clutter

## Main product surfaces shown by the references

### Theme Library

The theme library presents multiple saved themes as cards/list items and exposes theme metadata. A selected theme shows a large device preview, device/orientation information and actions such as opening in the designer or duplicating the theme.

Physical display orientations are explicit and include portrait and the rotated landscape/inverted variants.

### Design Studio

The designer uses:

- left navigation/context area
- scene/form controls
- layers/resources area
- central canvas with the physical display rendered at its logical aspect ratio
- contextual right-side properties inspector
- bottom contextual editing toolbar for alignment/distribution/lock/duplicate/delete/focus

The inspector changes according to the selected item. Position, size, anchor, visibility and style are shown for visual elements.

### Media / Resources

The references show a dedicated media/resource workflow where assets can be imported, inspected and associated with template content. Media operations should remain connected to the real project state rather than being a visual-only library.

### Test Studio

The references show a block/sequence-oriented test surface with a device preview, test blocks, block settings and sequence progress. V1 should preserve this product direction where test functionality is implemented, but should not invent unsupported device behavior.

### Publish / Deployment

The references show a publish-readiness screen with validation checks, package information, target-device information and a clear final action. The written V1 specification adds the real SD-card workflow: detect/select card, write, verify and safe eject.

## Design interaction principles

1. Keep the device preview visually central.
2. Use contextual properties instead of an always-expanded property form.
3. Make selected state obvious without excessive decoration.
4. Keep navigation and tools compact.
5. Show progress and validation state explicitly.
6. Use the same underlying project state for editor, preview, validation and deployment.
7. Avoid making the UI resemble a generic website or dashboard; it should feel like an engineering tool.

## Implementation note

The supplied screenshots are the visual source. The authoritative behavior and V1 scope remain the project prompt. Where visual references imply a capability not required by the written V1 specification, implement the smallest useful version or defer it rather than inventing device behavior.
