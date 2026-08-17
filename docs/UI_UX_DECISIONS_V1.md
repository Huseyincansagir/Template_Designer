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

## Simulator
- Simulator is a separate collapsible/dockable workspace panel/window, similar to Project Explorer.
- It may be docked, floated or opened as a tab.
- Preview must preserve device aspect ratio when resized.
- Multiple panels/windows may be used across monitors.

## Visual direction
- Match supplied reference screenshots as the primary visual source.
- Light neutral workspace, dark device preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation, dense but calm information layout.
- Professional, familiar, useful, aesthetic and not fussy.

## Not yet fixed
- Exact top-bar menus.
- Exact Project Explorer icons/nodes.
- Exact tab close/pin/docking interactions.
- Exact keyboard shortcuts.
- Exact selection handles/colors.
- Exact snap-grid visual treatment.
- Exact context-menu command ordering.
- Exact Properties section ordering.
- Simulator toolbar.
- Validation, Publish, Deployment, Theme Library and Settings detailed screens.
