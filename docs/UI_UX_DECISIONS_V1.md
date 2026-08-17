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
- Project Explorer, Properties, Simulator, Console and other tool windows are resizable/collapsible/dockable.
- Window docking must behave like familiar professional desktop applications/IDEs: panels can dock to left, right, top, bottom, center/document area, or appropriate side regions; an incoming docked panel takes the selected docking region and existing content is rearranged/stacked/tabbed rather than arbitrarily overlapping or destroying content.
- Dock targets/preview zones should be visible during drag, making the result predictable before drop.
- Multiple panels can occupy the same dock region as tabs or stacked groups.
- Panels can be resized by dragging splitters, collapsed/auto-hidden, undocked/floated, redocked and moved between monitors.
- Docking is stateful: the application remembers the user's workspace arrangement and restores it where practical.
- The system should be at least as flexible as common IDE docking systems, while remaining simpler and more predictable than an unrestricted custom window manager.
- When a docked panel is opened/closed, the remaining workspace reflows; panels do not cover the canvas unexpectedly unless explicitly floated/overlaid.
- Resizing panels must not distort their contents; previews preserve logical aspect ratio and use scaling/centering/letterboxing as needed.

## Dock/Window Controls

The application has persistent visibility controls for the main tool regions, similar in spirit to professional IDEs such as VS Code but adapted to this application.

- A compact control area at the upper-right/workspace edge exposes visibility toggles for right-side panels.
- Corresponding controls expose left-side panels and bottom panels.
- These controls are available without requiring the user to search through menus every time.
- The controls reflect current visibility/docking state.
- A panel can be opened, closed, collapsed, expanded, docked or floated without losing its current document/context.
- Docking and visibility controls must never remove the underlying project/scene state.
- Simulator, Console and other secondary tools can use the same docking framework as Project Explorer and Properties.

Conceptually:

```text
┌─────────────────────────────────────────────────────────────┐
│ Menu / Command Bar                         [Right Panels ▾] │
├───────────────┬───────────────────────────────┬─────────────┤
│ Project       │                               │ Properties  │
│ Explorer      │            Canvas             │             │
│               │                               │             │
├───────────────┴───────────────────────────────┴─────────────┤
│ State / Context Bar                                  [▾]    │
├─────────────────────────────────────────────────────────────┤
│ Console                                                     │
└─────────────────────────────────────────────────────────────┘
```

The exact chrome/placement of visibility buttons is still a visual-design detail, but the behavior is fixed: left/right/bottom tool regions can be independently shown/hidden and docked/floated.

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
- Ctrl is the primary multi-selection/modifier family and shortcut conventions should follow familiar Altium/CAD patterns wherever possible rather than inventing unrelated interactions.

## State / Context Bar
- There is a dedicated bar between the main workspace regions and the canvas/tool area for firmware-defined runtime states/contexts.
- This bar is independently collapsible/hidden.
- It must remain available as a workspace edge/region when other dockable panels are added.
- Runtime state/context controls are not the same thing as the Project Explorer hierarchy.

## Console
- A dedicated Console is dockable/collapsible/floating like other tool windows and is normally available in the lower workspace region.
- The Console supports command entry.
- The Console also displays commands/actions performed by the Designer and relevant tool output.
- Validation output is visible here.
- SD-card/package build output is visible here.
- Simulator/runtime test commands and results are visible here.
- AI/API operations can be shown here so the user can observe what the agent is doing.
- Errors, warnings, progress and command results should be structured and readable rather than being an unfiltered log dump.

Example:

```text
> validate
✓ 0 errors, 2 warnings

> build sd-card
✓ package generated

> simulate floor=11 direction=up
✓ runtime state applied

> _
```

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
- Exact keyboard shortcuts beyond the stated Altium/CAD compatibility direction.
- Exact selection handles/colors.
- Exact snap-grid visual treatment.
- Exact context-menu command ordering.
- Exact Properties section ordering.
- Simulator toolbar.
- Validation, Publish, Deployment, Theme Library and Settings detailed screens.
