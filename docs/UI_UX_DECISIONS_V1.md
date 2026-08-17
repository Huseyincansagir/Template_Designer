# UI/UX Decisions V1

## Workspace
- Professional engineering desktop application; not a generic dashboard.
- Expandable top command/menu bar.
- Left Altium-style hierarchical Project Explorer.
- Multiple projects/templates can be open and switched.
- Project hierarchy preserves deployment organization: project/theme/rotation/scene/objects/resources.
- Rotation/orientation selection behaves like switching schematic documents in Altium.
- Open rotations/scenes/projects appear as tabs.
- Tabs may be docked, floated, moved to another monitor, and recombined.
- Project Explorer, Properties and Simulator are resizable/collapsible/dockable.
- Resizing panels must not distort their contents; previews preserve logical aspect ratio and use scaling/centering/letterboxing as needed.

## Workspace state/context bar
A compact contextual bar must exist between the Project Explorer and Properties areas, adjacent to the canvas edge.

Its purpose is to expose the currently relevant firmware-defined runtime states/context selectors without consuming the main canvas area.

The bar itself is collapsible/hideable, but remains attached to the canvas edge while other dockable panels are opened or docked around the workspace.

Examples of content shown there may include firmware-defined states/context such as direction, door state, warning state, or other profile-provided runtime contexts. The Designer does not invent states.

Docking behavior:

```text
┌──────────────┬─────────────────────────────┬──────────────┐
│ Project      │                             │ Properties   │
│ Explorer     │            Canvas           │              │
│              │                             │              │
├──────────────┼─────────────────────────────┤              │
│ State /      │                             │              │
│ Context Bar  │                             │              │
└──────────────┴─────────────────────────────┴──────────────┘
```

If another panel is docked around the workspace, the state/context bar remains visually associated with the canvas edge rather than becoming part of an arbitrary floating panel.

## Project Explorer
```text
Deployment/Project
├── Theme Project
│   ├── Theme
│   │   ├── Rotation
│   │   │   ├── Scene
│   │   │   │   ├── Widget
│   │   │   │   └── Media
│   │   │   └── Scene
│   │   └── Rotation
│   └── Resources
└── Theme Project
```

The exact node names may evolve, but the hierarchical project/theme/rotation/scene/object relationship is required.

Rotation is selected from Project Explorer, similarly to switching schematic documents in Altium. Objects added to that rotation remain visible in its hierarchy and under the corresponding theme/project.

## Properties
- Right-side Altium-style contextual Properties/Inspector.
- One selected object: show all supported relevant properties.
- Multiple selected objects: show only properties common to all selected objects.
- If values are identical, show the value normally.
- If values differ, show `*` as a mixed value.
- Editing a mixed value applies the new value to every selected object.
- A multi-object edit is one meaningful undo/redo operation.
- Properties are contextual to object type/capability.

## Drag/drop
- External files can be dragged into the application/resource area.
- Imported media initially has semantic type `None` unless explicitly assigned.
- User may assign an appropriate semantic type such as image, video, warning symbol, digit, direction, etc.; exact options come from DeviceProfile.
- Unsupported/inappropriate formats are not automatically inserted into the template. They remain in the intake/resource area and can still be handled according to project/SD resource rules.
- Resource intake and template semantic usage are distinct.

## Design Studio
- Altium-like layer/context area can expose firmware-defined runtime states/context.
- Rotation is selected from Project Explorer; its scenes and objects appear in the workspace.
- Objects belong to the selected rotation/scene and remain visible in the corresponding project hierarchy.
- Objects may have different positions in different scenes.
- Optional command: apply selected object position to all applicable scenes.
- Snap Grid is supported, with configurable grid step and on/off control.
- Mouse drag, selection, resize and context-menu mechanics should feel like familiar professional desktop editors.
- Right-click menus are contextual.

## Keyboard and editing interaction
- Keyboard shortcuts should follow familiar Altium/CAD-style conventions where practical.
- `Ctrl` is preferred for modifier-based temporary editing behavior where it matches established desktop/CAD conventions.
- Example: holding `Ctrl` may temporarily modify snap/selection behavior rather than introducing a new custom shortcut language.
- The exact shortcut map remains a separate interaction specification and should be documented before implementation.

## Visibility behavior
- Hidden objects should follow familiar Altium-style editor behavior: remain represented in the project/layer hierarchy while being absent from normal canvas rendering.
- The exact visibility shortcut/key gesture will be defined in the keyboard shortcut specification; the UI should not invent an unrelated custom interaction.

## Simulator
- Simulator is a separate collapsible/dockable workspace panel/window, similar to Project Explorer.
- It may be docked, floated or opened as a tab.
- Preview must preserve device aspect ratio when resized.
- Multiple panels/windows may be used across monitors.

## Console
A dedicated bottom **Console** panel is part of the main workspace.

The Console is both:

1. an observable command/log surface, and
2. an interactive command input surface.

It can display:

- commands entered by the user or external AI agent,
- commands/actions executed by Designer,
- validation output,
- simulator/test operations,
- build/package operations,
- SD-card deployment/package operations,
- warnings and errors,
- API/automation activity.

Example:

```text
┌──────────────────────────────────────────────────────────────┐
│ Console                                                      │
├──────────────────────────────────────────────────────────────┤
│ > validate project                                           │
│ ✓ 0 errors, 2 warnings                                       │
│ > build sd-card-package                                      │
│ ✓ Theme package generated                                    │
│ > simulate floor=11 direction=up                             │
│ ✓ Runtime state applied                                      │
│                                                              │
│ > _                                                          │
└──────────────────────────────────────────────────────────────┘
```

The Console is dockable/collapsible/resizable like other workspace panels.

The Console must be useful during development because the Designer API/command surface is intentionally observable. External AI agents can issue commands through the supported API/console workflow, and the user can see what the Designer is doing.

Console output must not replace normal UI feedback; important errors/results should also appear through the appropriate UI surfaces.

## Docking and panel behavior
- Project Explorer, Properties, Simulator and Console are dockable/resizable/collapsible.
- A docked panel may be moved, resized or floated.
- Docking another panel must not destroy the canvas layout or permanently hide the contextual state bar.
- The contextual state bar remains attached to the canvas edge.
- Panels have sensible minimum sizes and responsive internal layout.
- Device previews preserve aspect ratio and do not stretch when their containing area changes.

## Visual direction
- Match supplied reference screenshots as the primary visual source.
- Light neutral workspace, dark device preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation, dense but calm information layout.
- Professional, familiar, useful, aesthetic and not fussy.

## Not yet fixed
- Exact top-bar menus.
- Exact Project Explorer icons/nodes.
- Exact tab close/pin/docking interactions.
- Exact keyboard shortcut map beyond the established modifier principles.
- Exact selection handles/colors.
- Exact snap-grid visual treatment.
- Exact context-menu command ordering.
- Exact Properties section ordering.
- Simulator toolbar.
- Exact state/context bar controls.
- Console command language/API command names.
- Validation, Publish, Deployment, Theme Library and Settings detailed screens.
