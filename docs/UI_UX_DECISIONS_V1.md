# UI/UX Decisions V1

## Core terminology

- **State:** runtime condition/value coming from firmware data. States may exist simultaneously. Examples include up, down, door states and warnings.
- **Scene:** visual presentation selected from currently active states according to scene priority. Exactly one scene is active for a given runtime presentation context.
- **Rotation:** one of the four design documents in a Theme Project.
- **Theme Project:** the theme package containing exactly four rotations.
- **Project:** the SD-card-level project. One project is placed on an SD card deployment.

State and Scene must remain distinct in the application model even when users casually mix the terms.

## Workspace

- Professional engineering desktop application; not a generic dashboard.
- Expandable top command/menu bar.
- Left Altium-style hierarchical Project Explorer.
- Multiple projects can be open and switched.
- Open rotations/documents appear as tabs and behave like switching schematic documents in Altium.
- Tabs may be docked, floated, moved to another monitor, reordered and recombined.
- Project Explorer, Properties, Simulator, Console and other tool windows are resizable/collapsible/dockable.
- Docking follows familiar professional IDE behavior: panels can dock to left, right, top, bottom, center/document area and appropriate side regions; incoming panels rearrange/stack/tab existing content rather than arbitrarily overlapping or destroying it.
- Dock targets/preview zones are visible while dragging a panel.
- Panels can be resized by splitters, collapsed/auto-hidden, undocked/floated, redocked and moved between monitors.
- Docking/workspace state is remembered where practical.
- Resizing panels must not distort content; device previews preserve logical aspect ratio and use scaling/centering/letterboxing as needed.

## Canonical project hierarchy

The canonical logical hierarchy is:

```text
Workspace
└── Project (SD-card project)
    └── Theme Project Group
        └── Theme Project
            ├── Rotation 1
            ├── Rotation 2
            ├── Rotation 3
            └── Rotation 4
```

A Project contains one Theme Project Group. The Theme Project is the actual theme package and contains exactly four rotations.

Each Theme Project contains its own resources.

## Project creation

When a new Project is created for a DeviceProfile:

1. Firmware/profile-supported rotations are created automatically.
2. Firmware/profile-supported scenes are created automatically.
3. Corresponding profile/config information is initialized.
4. The user may delete rotations/scenes.
5. The user may later restore/add them through Project Explorer context menus such as `Add Rotation` and `Add Scene`.
6. Unsupported rotations/scenes cannot silently be added.

This gives a new project a profile-conformant skeleton instead of an empty canvas.

## Rotation

A Theme Project has exactly four rotations. Each is a separate design document/tab.

Selecting a rotation from Project Explorer activates its corresponding document/tab and workspace.

An inverted theme project may be generated from a theme through a context command such as:

```text
Create Theme Project as Inverted
```

The operation mirrors the visual layout toward the opposite screen orientation and creates the corresponding inverted design structure. The implementation may later use DSI/LTDC/display-controller-friendly transformations, but the Designer must explicitly model the resulting layout rather than depend on an unspecified runtime transform.

## Scene semantics

A Scene is the **active presentation** selected from runtime states by priority. It is not merely a static canvas and it is not itself a runtime state.

Multiple states may be active simultaneously. Exactly one scene is selected according to the applicable scene priority.

Examples:

```text
fire active       → Fire scene wins
fire inactive
idle              → Idle scene
up active         → Up scene wins over idle if its priority is higher
```

If applicable scenes have equal priority, the later-arriving applicable event/state wins according to runtime event ordering.

Scene priority is separate from widget Z-order.

Example: if `up` is active and the Up scene contains an arrow, then a higher-priority warning scene can replace it. If that warning scene also contains an Up arrow, the arrow remains visible because it belongs to the active Warning scene.

Therefore:

```text
Firmware runtime states
        ↓
Applicable scene conditions
        ↓
Scene priority resolution
        ↓
Exactly one active scene
        ↓
Scene widgets/media rendered using Z-order
```

## Runtime State registry

States come from the DeviceProfile/firmware contract. The Designer does not invent new runtime states.

Examples include:

```text
up
down
door_opening
door_open
door_closing
fire
overload
service_out
```

Warnings are also states. The warning registry is firmware-facing; the current elevator application has three known warnings:

```text
service_out
overload
fire
```

The UI may expose firmware warning identifiers such as `warning1`, `warning2`, `warning3` where that is the actual profile terminology. Warnings remain inside the common state model rather than being a separate presentation system.

## State / Context Bar

The State/Context Bar is a workspace control for selecting/inspecting runtime context while editing/testing.

It is not a second project hierarchy and does not replace Project Explorer.

Project Explorer answers:

> Which project/theme/rotation/scene/object am I editing?

State/Context Bar answers:

> Which runtime state/context am I previewing or binding against?

The bar is independently collapsible/hidden and remains a usable workspace edge/region when other dockable panels are added.

## Scene management

Scene operations are available through Project Explorer context menus and suitable toolbar commands:

```text
New Scene
Duplicate Scene
Rename
Delete
Add/Restore Scene
```

Scenes can be reordered within compatible parents. Compatible scenes/objects may be dragged between projects/rotations.

If a drag/drop operation causes a DeviceProfile/capability mismatch, the application must not silently perform it. Show a comparison/conflict UI explaining the mismatch and ask which supported resolution the user wants.

## Scene duplication

Duplicate Scene performs a deep copy of the editable presentation model:

- widgets,
- widget properties,
- bindings/conditions,
- layout,
- style references,
- media-slide configuration,
- Bounding Groups,
- relevant scene metadata.

Assets are not blindly duplicated; references may continue to point to the same asset when appropriate.

## Objects across scenes

Objects may intentionally have different positions in different scenes.

Moving/copying an object from one scene to another creates a scene-specific object instance by default.

A dedicated operation can apply general parameters to other scenes. For geometry synchronization, an explicit selection such as:

```text
Apply to other scenes
☑ X
☑ Y
☐ Width
☐ Height
```

may be used. The important rule is that scene-specific geometry remains possible while common parameters can be propagated intentionally.

## Project Explorer object ordering

When a scene is selected, its child objects are visible in Project Explorer.

The Explorer may expose object order and category/filter controls. Z-order operations remain available through context menus/toolbars and can be adjusted from the Explorer where useful.

When the user clicks empty canvas space, the UI may expose ordering/layer controls without requiring a widget selection.

Core order operations:

```text
Bring to Front
Bring Forward
Send Backward
Send to Back
```

## Drag/drop within Explorer

Project Explorer supports drag/drop for compatible operations.

- Normal drag: Move.
- `Ctrl` modifier: Copy.
- Cross-project drag/drop is allowed when compatible.
- Incompatible drops show a comparison/resolution dialog.
- Objects dropped into another scene become scene-specific instances.

## Resources

Every Theme contains its own Resources area/directory. Theme assets remain separated by theme for predictable firmware deployment.

A higher-level Resources area may exist under Theme Project Group if needed later, but its exact contents are intentionally not fixed yet.

### Future firmware optimization — TODO

Remember but do not implement now:

The Theme Project Group config could contain an index/manifest of the complete file/directory tree. Firmware could locate files through this index instead of requiring fixed paths/names. This could save SD-card space and allow more flexible asset reuse, but it requires firmware changes.

Keep this in the future implementation backlog.

## External resource drag/drop

Files may be dragged from Windows Explorer into the application.

Resource intake distinguishes:

### Unassigned

The file format is recognized/supported by the active DeviceProfile, but no semantic template type has been assigned.

Example:

```text
random.png
→ supported image format
→ semantic type = None / Unassigned
```

It remains in project resources and can later be assigned as an Image, Digit, Direction, Warning, etc. when supported.

### Unsupported

The DeviceProfile does not support the file format/type.

The resource is explicitly marked `Unsupported` and must not silently become a template object.

It may still be retained in the project/SD resource area according to the current resource policy. Export must warn the user and ask whether to continue.

### Current scope

Do not add automatic media format conversion to the current Designer implementation. A separate Format Tool may be added later.

## Resource semantic assignment

A selected resource exposes:

```text
Type: [ None ▼ ]
```

The dropdown contains only semantic types supported by the active DeviceProfile.

If the user assigns a supported type, the resource becomes available for template usage. If no type is assigned, it remains Unassigned.

## Asset copying

When an object/resource is copied into another Theme/scene and independent ownership is required, the application may create a separate asset copy in the destination Theme's resource directory. The UI must make the ownership/reference behavior clear.

During export, referenced assets are copied/processed according to the deployment package rules. Automatic format/size conversion is intentionally deferred to the later Format Tool.

## Cross-project compatibility

Projects, themes, rotations, scenes and resources may be moved/copied by drag/drop only when compatible.

On mismatch, show a comparison/resolution UI with:

- source DeviceProfile,
- destination DeviceProfile,
- conflicting capabilities,
- affected objects/assets,
- supported resolutions.

## Tabs

Open rotations and other design documents appear as tabs.

Tabs can be reordered, closed, pinned where useful, docked, floated, moved to another monitor and recombined into the main document area.

Tab titles should expose enough project/theme/rotation identity to avoid confusion when multiple projects are open.

## Properties

Right-side Altium-style contextual Properties/Inspector remains the authoritative editing surface for object parameters.

- One selected object: show all supported relevant properties.
- Multiple selected objects: show only properties common to all selected objects.
- Identical values display normally.
- Different values display `*`.
- Editing a mixed value applies it to every selected object as one undoable operation.
- Locked objects remain selectable and non-geometry properties remain editable.
- Locked size and coordinates cannot be changed through canvas or Properties.
- Visibility is independent from lock.

## Dock/Window Controls

Persistent visibility controls exist for right-side, left-side and bottom tool regions. Controls reflect current visibility/docking state and restore the previous useful context when a panel is reopened where possible.

## Design Studio — Canvas Interaction

### Selection

- Left click selects.
- `Ctrl + left click` adds/removes from selection.
- Empty canvas click clears selection.
- Rectangle selection follows familiar CAD conventions.

### Move

- Drag moves objects.
- Snap Grid controls snapping.
- `Ctrl` temporarily bypasses snapping where applicable.

### Snap Grid

- First-class Designer setting.
- On/off.
- Configurable grid step.
- Move, resize and alignment can respect the active grid.

### Keyboard movement

- Normal Arrow keys move by the small step.
- `Ctrl + Arrow` moves by active Snap Grid.
- `Ctrl + Shift + Arrow` moves by Snap Grid × 5.

### Resize

- Visible resize handles + Properties editing.
- No multi-selection scale/transform feature in V1.
- Resizing one selected object's handle changes only that object.
- Width/height can be entered directly in Properties.
- **Size Lock** and **Aspect Ratio Lock** are separate settings.
- Aspect ratio locking can be enabled independently of size locking.

### Rotation

- Rotation is available through rotation UI and Properties.
- Free rotation with 5° snapping.
- 45° and 90° positions have visible snap/guide indication.
- Pressing `R` while rotating turns the selected object 90°.

### Duplicate

- Duplicate is available from right-click context menu and toolbar.
- Invoking Duplicate starts a placement interaction: the duplicate/group center follows the cursor.
- The next click places the duplicate centered on that clicked location.
- Repeated duplicate mode: after each placement, another duplicate follows the cursor; each click places another copy centered at that location.
- `Esc` exits repeated duplicate mode and returns to normal selection behavior.

### Alignment / Distribution

Multi-selection supports alignment/distribution commands through toolbar/context UI.

### Cross-scene positioning

Scenes may intentionally contain the same object at different positions. A dedicated command can apply selected geometry/general parameters to other scenes. No `Shift+S` shortcut is reserved for this feature.

### Z-order

Objects support Bring to Front, Bring Forward, Send Backward and Send to Back.

### Lock / Visibility

- Locked objects remain selectable.
- Locked objects allow non-geometry Properties editing.
- Locked objects cannot have size or coordinates changed.
- `Visible` is independent from `Locked`.
- A hidden object can be selected from Project Explorer.
- Selecting a hidden object shows its selection bounding box/handles without rendering its visual content.
- Hidden objects have a clear visibility indicator in Project Explorer.
- `Hide All` and `Show All` are available.
- The previous `Shift+S` visibility shortcut is removed.

### Context menu

Right-click menus follow familiar engineering/CAD ordering and are contextual. They include appropriate selection/editing, duplicate/delete, alignment/distribution, order, grouping/Bounding Group, lock/visibility and Properties commands.

## Console

A dedicated Console is dockable/collapsible/floating and normally available in the lower workspace region.

It supports command entry and shows:

- Designer actions/commands,
- validation output,
- SD-card/package build output,
- simulator/runtime commands and results,
- AI/API operations,
- errors/warnings/progress/results.

## Simulator

Simulator uses the same docking framework as Project Explorer and Properties. It may be docked, floated or opened as a tab. Device previews preserve aspect ratio when resized.

## Color / Asset selection

- DeviceProfile supplies the initial firmware-defined palette.
- V1 device profile exposes 10 defined colors.
- Color Properties present those profile-defined colors.
- A Windows/native color picker is also available for custom selection.
- If firmware does not support a selected custom color, validation/simulation visibly reports the limitation instead of silently assuming support.
- Asset selectors use a dropdown of profile-supported/default assets/options where applicable.
- `...`/Browse opens custom asset/resource selection.

## Visual direction

- Supplied reference screenshots are the primary visual source.
- Light neutral workspace, dark device preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation, dense but calm information layout.
- Professional, familiar, useful, aesthetic and not fussy.

## Shortcut policy

- Prefer familiar Altium/CAD/Windows conventions.
- Do not invent unrelated modifier behavior when a familiar convention exists.
- Central shortcut registry owns assignments and detects conflicts.
- Explicit current decisions: `Ctrl` modifier family, `R` during rotation for 90°, Arrow movement, `Ctrl+Arrow` for grid-step movement and `Ctrl+Shift+Arrow` for 5× grid-step movement.

## Default decisions

Where the user did not explicitly override a proposed behavior, retain the previously proposed professional-desktop behavior, subject to the rules above. Context-sensitive UI, DeviceProfile-driven capabilities, Altium/CAD interaction conventions and a calm professional desktop aesthetic remain defaults.
