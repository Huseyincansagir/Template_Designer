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
- Persistent visibility controls exist for right-side, left-side and bottom tool regions.
- Controls are placed in the upper/right workspace chrome in a compact, familiar IDE-like manner.
- The exact chrome can be more flexible than VS Code, but behavior must remain predictable.
- Controls reflect current visibility/docking state.
- Opening a hidden panel restores its previous useful dock/context where possible.
- Simulator, Console and other secondary tools use the same docking framework as Project Explorer and Properties.

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
- Locked objects remain selectable and their non-geometry properties can still be edited.
- When locked, size and coordinates cannot be changed through canvas or Properties.
- Visibility is separate from lock state.

## Drag/drop
- External files can be dragged into the application/resource area.
- Imported media initially has semantic type `None` unless explicitly assigned.
- User may assign an appropriate semantic type such as image, video, warning symbol, digit, direction, etc.; exact options come from DeviceProfile.
- Unsupported/inappropriate formats are not automatically inserted into the template. They remain in the intake/resource area and can still be handled according to project/SD resource rules.
- Resource intake and template semantic usage are distinct.

## Design Studio — Canvas Interaction

### Selection
- Primary selection uses left mouse click.
- `Ctrl + left click` adds/removes an object from the current selection.
- Clicking empty canvas clears the current selection.
- Rectangle selection is supported.
- Selection behavior should follow familiar CAD/engineering-editor conventions.

### Move
- Objects can be moved by dragging.
- Snap behavior is controlled by Snap Grid state.
- `Ctrl` temporarily bypasses snapping while moving/resizing where that behavior is applicable.
- Exact shortcut conflicts must be resolved centrally in the application shortcut registry.

### Snap Grid
- Snap Grid is a first-class Designer setting.
- Snap can be enabled/disabled.
- Grid step is configurable.
- Move, resize and alignment operations can respect the active snap grid.
- The visual grid treatment remains a visual-design choice, but it must remain unobtrusive and useful.

### Keyboard movement
- Arrow keys move the selected object(s) by the normal small-step amount.
- `Ctrl + Arrow` moves by the active Snap Grid amount.
- `Ctrl + Shift + Arrow` moves by `Snap Grid × 5`.
- This rule is specifically for normal object movement; it does not redefine unrelated shortcut behavior.

### Resize
- Resize uses visible handles and Properties editing.
- There is no multi-selection scale/transform operation requirement in V1.
- If a user grabs one object's resize handle, that object is resized; other selected objects are not automatically scaled.
- Width/height can be entered directly in Properties to make objects the same size.
- Size lock and aspect-ratio lock are explicit settings.
- Aspect ratio locking is supported independently from size locking.
- The user can enable/disable these locks according to the selected object's capabilities.

### Rotation
- Rotation is available through the object's rotation UI and Properties.
- Rotation is free by default.
- Rotation has 5-degree snapping.
- 45° and 90° positions have visible snap/guide indication.
- While dragging/rotating, pressing `R` rotates the selected object by 90°.
- Rotation must not be forced into only 90° increments.

### Duplicate
- Duplicate is available from the context menu and toolbar.
- Duplicate does not require a permanent duplicate mode after one action.
- On invoking Duplicate, the duplicated object's/group's center follows the cursor; the user places it with the next click.
- After placement, normal selection behavior resumes unless the repeated-duplicate command is explicitly invoked.
- Repeated duplicate behavior is a separate interaction decision and must not be conflated with the one-shot Duplicate command.

### Alignment / Distribution
- Multi-selection supports alignment and distribution commands.
- Commands are available through toolbar/contextual UI as appropriate.
- Alignment/distribution must respect the active snap/layout rules where applicable.

### Cross-scene positioning
- Scenes may intentionally contain the same object at different positions.
- A dedicated command can apply the selected object's position to other applicable scenes.
- This is an explicit cross-scene operation, not an automatic synchronization rule.
- No `Shift+S` shortcut is reserved for cross-scene visibility/position behavior.

### Z-order
- Objects support Bring to Front, Bring Forward, Send Backward and Send to Back.
- Z-order controls may be exposed through toolbar/context menu/project hierarchy where useful.

### Lock / Visibility
- Locked objects can still be selected.
- Locked objects expose their properties, but coordinate and size editing is disabled.
- `Visible` is independent from `Locked`.
- A hidden object can remain selectable when selected from the Project Explorer.
- When a hidden object is selected from the Project Explorer, the canvas shows its selection bounding box/handles but does not render the object's visual content.
- Hidden objects have a clear visibility indicator in the Project Explorer.
- `Hide All` and `Show All` commands are available.
- The previous proposal to use `Shift+S` as a hide/visibility shortcut is removed.

### Context menu
- Right-click menus are contextual and should follow familiar engineering/CAD ordering.
- Core commands include selection/editing, duplicate/delete, alignment/distribution, order, grouping/Bounding Group, lock/visibility, scene-position operations and Properties where applicable.
- Media/widget-specific commands may be inserted contextually.

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

## Color / Asset selection
- DeviceProfile provides the initial supported/default firmware-defined color palette.
- V1 device profile should expose 10 defined colors to the Designer.
- Color Properties should normally present those profile-defined colors.
- A Windows/native color picker is also available for custom selection.
- A custom color may be stored in the project, but if the target firmware/device does not support that color at runtime, validation/simulation must make the limitation visible rather than silently pretending it will work.
- Asset selectors use a dropdown containing profile-supported/default assets where applicable.
- An `...`/Browse action opens a custom asset/resource selection flow.

## Visual direction
- Match supplied reference screenshots as the primary visual source.
- Light neutral workspace, dark device preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation, dense but calm information layout.
- Professional, familiar, useful, aesthetic and not fussy.

## Shortcut policy
- Keyboard shortcuts should follow familiar Altium/CAD/Windows conventions wherever possible.
- Do not invent application-specific modifier behavior when a familiar convention exists.
- A centralized shortcut registry must own assignments and detect conflicts.
- Current explicit interaction decisions include `Ctrl` as the main modifier family, `R` for 90° rotation during rotation, arrow-key movement, `Ctrl+Arrow` for grid-step movement and `Ctrl+Shift+Arrow` for 5× grid-step movement.

## Not yet fixed
- Exact top-bar menus.
- Exact Project Explorer icons/nodes.
- Exact tab close/pin/docking interactions.
- Full application shortcut table and conflict resolution for every command.
- Exact selection handle visuals/colors.
- Exact snap-grid visual treatment.
- Exact context-menu command ordering.
- Exact Properties section ordering.
- Simulator toolbar.
- Validation, Publish, Deployment, Theme Library and Settings detailed screens.
