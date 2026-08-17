# UI/UX Decisions V1

## Core terminology

- **State:** runtime condition/value coming from firmware data. States may exist simultaneously. Examples include up, down, door states and warnings.
- **Scene:** visual presentation selected from currently active states according to scene priority. Exactly one scene is active for a given runtime presentation context.
- **Rotation:** one of the four design documents in a Theme Project.
- **Theme Project:** the theme package containing exactly four rotations.
- **Project:** the SD-card-level project. One project is placed on an SD card deployment.
- **Asset Browser / Asset Depot:** the library/depot view used to browse available reusable/default assets. It is not the same thing as a Theme's Resources area.

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

Each Theme Project contains its own Resources area.

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

## Resources and Asset Depot

The application distinguishes the **Asset Depot/Asset Browser** from the Theme's **Resources** area.

### Asset Depot / Asset Browser

The Asset Browser is analogous to an engineering library such as an Altium library. It represents the assets available for reuse by the application/project ecosystem.

It shows assets from a configured depot/library location and also exposes profile/default assets as applicable.

It is not itself a Scene and it does not contain widgets.

The Asset Browser should have:

- a library/depot selector or configured depot location,
- category navigation,
- search/filter,
- list/grid/thumbnail views,
- supported/default asset views,
- visual indication when an asset is already used by the current project/theme,
- dependency/use information where useful.

A good UX term for the reusable collection is **Asset Depot**. The UI may show `Asset Browser` as the tool-window title and `Depot`/library as the source selector.

### Used indicator

If an asset selected from the Asset Depot is already used by the current project/theme, the Asset Browser should show a clear but unobtrusive indicator (for example a checkmark/badge) and may expose `Used By` information.

The asset can still be reused; the indicator is informational and helps the user understand project usage.

### Default assets

DeviceProfile/default assets are available to the Designer without requiring every project to maintain redundant source copies. They are included in the deployment package when referenced/required by the project.

## Theme Resources

Every Theme contains its own Resources area.

Resources are **project-owned files** rather than a library category.

Only files belong in Resources. Widgets and Scenes never belong inside Resources.

A supported asset can be stored directly in a Theme's Resources area even when it has not yet been assigned to a Scene.

A resource may also be used directly by a Scene; in that case the Scene's object reference is visible in the Scene hierarchy and the asset remains associated with that Scene/object according to the project model.

### Resource intake rule

When an external file is dropped into a Project Explorer location, the target location determines the operation.

There is **no generic Windows Explorer → Canvas drag/drop workflow**.

The Designer must not create a widget merely because a file is dragged over the canvas.

If a file is dropped into a project resource-capable location:

- if its format is supported by the DeviceProfile, it is placed in the appropriate Resources area/category;
- if its format is unsupported, it is placed in `Unsupported Files`;
- no additional Unassigned/Unsigned category is required.

`Unsupported Files` are retained for visibility/debugging but are not usable template resources and are not part of the normal asset-selection workflow.

## Resource categories

Resource categories should follow useful semantic/device-supported media categories where appropriate, for example:

```text
Images
Videos
Audio
Fonts (if applicable to a future profile contract)
Digit Styles
Direction Styles
Warning Signs
Other profile-defined media categories
```

If a resource is explicitly assigned a semantic category such as `Warning Sign`, the UI can place/display it in that category. The exact on-disk category structure must remain compatible with the firmware contract.

The current firmware-facing rule can use category folders directly where useful (for example a `Warning Signs` folder) so firmware can discover the expected resources predictably.

## Unsupported Files

`Unsupported Files` is the only special unsupported bucket required by the current UX model.

Unsupported files:

- remain visible in Project Explorer/resource management where they were dropped,
- are not displayed as usable assets in the normal Asset Browser workflow,
- cannot be inserted as template widgets,
- are not exported as normal project assets,
- may be reported by Design Rules/Validation.

They are intentionally not promoted to a semantic asset type.

## Asset Browser visibility model

The main places where usable assets are intentionally visible are:

1. Canvas/Scene when referenced by a widget.
2. Theme Resources.
3. Asset Browser / Asset Depot.
4. Default/Profile asset views.

`Unsupported Files` is a management/debug area and should not pollute normal asset browsing.

## Asset preview

The Asset Browser provides type-appropriate preview:

- Images display directly.
- Videos can be played in the preview pane.
- Audio can be played in the preview pane.
- A video thumbnail uses an appropriate video frame (first frame by default or another available representative frame).

### Audio/video preview controls

Preview playback is intentionally simple:

- Play/Pause.
- A seek/progress bar that can be clicked to start playback from any point.
- Volume where applicable.
- Audio/video is not automatically looped in the Asset Browser preview.
- Pressing play again resumes/continues playback according to the preview player behavior.

Playback behavior for actual template widgets is configured separately in Widget/Media Slide Properties.

## Asset metadata

Asset Properties may show basic information plus an Advanced section:

```text
Name
Stable ID
File
Type
Format
Size
Duration
Resolution
Color Format
```

Metadata display should remain compact by default.

## Stable IDs

Assets have a stable internal identifier independent from their human-readable display name and physical filename.

Example:

```text
Display Name: Serdar Ortaç
Stable ID:    T01A0042
File:         serdarortac.wav
```

The display name and filename may change without changing the stable ID.

### Stable ID and rotation

A key design rule is that **an asset is not inherently a rotation-specific object**. The same asset may legitimately be reused by multiple rotations and themes.

Therefore the stable asset identifier should not be forced to contain a rotation identifier merely because the asset is referenced from a rotation.

A practical V1 model is:

```text
Theme/Package namespace + Asset ID
```

For example:

```text
T01-A0042
```

where `T01` identifies the theme/package namespace and `A0042` identifies the asset within that namespace.

Rotation usage is represented by the Scene/widget reference, not by changing the asset's identity.

If the same asset is intentionally duplicated into another Theme, it receives an independent asset namespace/ID there. Duplicate stable IDs across physically separate theme packages are acceptable because package/theme scope disambiguates them. Within one exported package, stable IDs must be unique.

This avoids unnecessary ID churn when one asset is reused by multiple rotations and keeps firmware references deterministic.

## Asset rename

Changing the display name does not change the stable ID.

Changing the physical filename does not change the stable ID.

The UI may allow display name and filename to be changed independently where safe.

## Duplicate/import of an existing asset

When the same content is imported again, the Designer may detect the existing asset.

Recommended UX:

```text
Existing asset found
[ Use Existing ] [ Create Copy ] [ Cancel ]
```

A deliberate copy gets its own asset identity in the destination ownership scope.

## Asset ownership and copying

If an asset is reused by another Theme/project, the destination can receive a physical copy so firmware deployment remains self-contained and predictable.

The Designer should preserve source/reference metadata for debugging where useful, but firmware deployment must not depend on an external Theme's resource path.

## Asset replacement

Replacing an asset's content while preserving its semantic identity keeps the stable ID unchanged.

Example:

```text
T01-A0042
old.wav → new.wav
```

The stable identity remains `T01-A0042`.

## Asset dependency

When an asset is selected, the Designer can show `Used By` information such as:

```text
Theme 1
  Rotation 2
    Scene Fire
      Media Slide
```

This information is especially important before deleting/replacing assets.

## Asset deletion

If an asset is referenced by Scenes/widgets, deletion opens a dependency-aware dialog rather than silently breaking references.

The dialog can offer:

```text
Cancel
Remove References
Delete + Replace
```

The exact options depend on the reference type and DeviceProfile.

## Asset selection and external files

There is no canvas file-drop import path.

Windows Explorer files are imported only by dropping them onto an appropriate Project Explorer/resource target.

The target location determines whether the file enters Theme Resources or `Unsupported Files`.

## Media format handling

The current Designer does **not** perform full media format conversion.

Do not automatically convert:

```text
MP4 → AVI
JPEG → another format
WAV → another format
ARGB888 conversion
```

unless a small, low-risk resize/processing feature is explicitly implemented later.

A separate Format Tool is the planned location for full format conversion and device-specific encoding.

## Designer resize vs Format Tool

The Designer may change the **widget/displayed size** through Widget Properties and canvas resize.

This does not mean it performs full asset format conversion.

The future Format Tool owns:

- format conversion,
- encoding,
- pixel-format conversion,
- device-specific media preparation,
- bulk conversion.

If a simple asset resize is later added to Designer, it must remain clearly separate from full format conversion.

## Export asset selection

Only the following are exported as normal assets:

1. Assets actually required/referenced by the project.
2. Assets explicitly present in Theme Resources and included by deployment rules.
3. Required DeviceProfile/default assets.

`Unsupported Files` are not normal export assets.

The Asset Browser itself is only a view of the depot/library; it is not an export source by itself.

An asset existing in the depot does not automatically get copied to the SD card. It must be referenced/selected by the project or be required by the default/profile package rules.

## Design Rules / Asset Validation

A dedicated **Design Rules** tab/section can contain the project's asset/design checks.

The checks should be consolidated into a single rule configuration rather than scattered across unrelated dialogs.

Examples:

```text
Missing asset reference
Unsupported file
Asset format mismatch
Missing required profile asset
Duplicate stable ID within package
Missing resource
Invalid widget/media combination
Unused resource (informational)
```

Design Rules can run manually and as part of export validation.

Export should clearly report critical errors vs warnings and ask whether the user wants to continue when only non-critical issues remain.

## Asset Browser and project usage indicator

The Asset Browser may show a subtle status badge/check when an asset is already used by the current project/theme.

The indicator must not prevent reuse.

The Asset Browser should also allow the user to inspect `Used By` references where available.

## Console and validation

Asset import/export/validation actions can be logged in the dockable Console, including:

- imported file,
- destination resource category,
- stable ID assignment,
- unsupported status,
- validation result,
- export inclusion/exclusion.

## Future firmware optimization — TODO

Remember but do not implement now:

The Theme Project Group config could contain an index/manifest of the complete file/directory tree. Firmware could locate files through this index instead of requiring fixed paths/names. This could save SD-card space and allow more flexible asset reuse, but it requires firmware changes.

Keep this in the future implementation backlog.

## Shortcut policy

- Prefer familiar Altium/CAD/Windows conventions.
- Do not invent unrelated modifier behavior when a familiar convention exists.
- Central shortcut registry owns assignments and detects conflicts.
- Explicit current decisions: `Ctrl` modifier family, `R` during rotation for 90°, Arrow movement, `Ctrl+Arrow` for grid-step movement and `Ctrl+Shift+Arrow` for 5× grid-step movement.

## Visual direction

- Supplied reference screenshots are the primary visual source.
- Light neutral workspace, dark device preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation, dense but calm information layout.
- Professional, familiar, useful, aesthetic and not fussy.

## Default decisions

Where the user did not explicitly override a proposed behavior, retain the previously proposed professional-desktop behavior, subject to the rules above. Context-sensitive UI, DeviceProfile-driven capabilities, Altium/CAD interaction conventions and a calm professional desktop aesthetic remain defaults.
