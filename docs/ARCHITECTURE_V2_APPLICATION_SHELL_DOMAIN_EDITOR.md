# Template Designer — Architecture V2

## Purpose

Template Designer is no longer modeled as a simple canvas application. It is a Windows desktop, CAD/IDE-style authoring environment for creating, editing, simulating, validating and exporting elevator-display template projects.

The architecture is therefore organized into three major layers:

1. **Application Shell** — windows, menus, commands, docking, tabs and workspace management.
2. **Domain Model / Engine** — projects, themes, rotations, scenes, widgets, media, bindings, device profiles and runtime rules.
3. **Editor** — canvas editing, selection, geometry, snapping, properties and document editing.

The UI must not contain firmware/template business logic directly.

---

## 1. Application Shell

The Application Shell owns the desktop application's global behavior.

```text
Application
└── MainWindow
    ├── MenuBar
    ├── ToolBars
    ├── Command System
    ├── Workspace Manager
    ├── Dock Manager
    └── Document Manager
```

### Responsibilities

- application startup/shutdown
- menus and toolbars
- command routing
- keyboard shortcuts
- command palette
- document tabs
- docking/undocking/floating panels
- multi-monitor windows
- workspace layouts
- global application settings
- recent projects/documents

### Dockable tool windows

The following are tool windows, not fixed regions of the main window:

- Project Explorer
- Properties
- Asset Browser
- Simulator
- Runtime State
- Console / Output
- Validation
- other future tools

They support:

- dock
- undock
- float
- resize
- split
- tab with another tool window
- collapse
- auto-hide
- close/reopen

Docking behavior should follow established professional CAD/IDE conventions.

### Modal windows

Application Preferences and similar configuration dialogs are modal CAD/IDE-style dialogs. While open, the underlying Designer cannot be interacted with.

Examples:

- Preferences
- selected import/export dialogs
- conflict-resolution dialogs
- critical confirmation dialogs

---

## 2. Document System

The Designer uses a document-oriented model.

```text
Workspace
└── Project
    └── Theme
        └── Rotation
            └── Scene
                └── Widget
```

A Project is the unit that will eventually be packaged for the SD card. A Theme Project contains its four rotations. Scenes belong to rotations.

Documents may be opened as tabs. Tabs can be reordered and detached into floating document windows.

The Project Explorer remains the authoritative hierarchical navigation view.

---

## 3. Domain Model

The domain model is independent of the UI.

```text
Domain
├── Workspace
├── Project
├── Theme
├── Rotation
├── Scene
├── Widget
├── Media
├── Asset
├── Binding
├── FloorMapping
├── Localization
├── AudioRules
├── DeviceProfile
└── DesignRules
```

### Important rule

UI controls edit domain objects through commands/services. They must not directly implement firmware behavior.

For example:

```text
Properties Panel
      ↓
Editor/Domain Command
      ↓
Document Model
      ↓
Validation / Dirty State / Undo
      ↓
UI refresh
```

This makes editing, undo/redo, AI-generated projects, simulation and export use the same underlying model.

---

## 4. Device Profile

DeviceProfile defines the firmware contract available to the Designer.

It determines things such as:

- supported states
- supported scenes
- supported rotations
- media capabilities
- image/video/audio capabilities
- supported colors
- supported formats
- display resolution
- video decoding constraints
- supported parameters
- floor/state datatypes
- validation constraints

The Designer must not invent firmware states that are not defined by the active DeviceProfile.

A project can select a DeviceProfile, while the DeviceProfile itself is managed separately from normal project editing.

---

## 5. Scene / State Model

States are runtime data. Scenes are the visual result selected by scene priority.

Multiple states may be active simultaneously, but only one Scene is active according to the scene-priority rules.

Examples of states include:

- fire
- overload
- service out
- door opening
- door closing
- direction up
- direction down
- floor data
- other firmware-defined states/parameters

The Designer must preserve the distinction between **State** and **Scene**.

---

## 6. Binding Engine

Binding is a domain subsystem, not a Media-only feature.

Widgets such as Media, Digit/Floor and Direction may have bindings.

Examples:

```text
Floor == 6
Door == Opening
Fire == true
Floor == 6 AND Door == Opening
NOT Fire
```

Bindings can control appropriate widget behavior such as visibility and media playback behavior.

Scene activation is controlled by Scene priority; widget bindings do not directly change the active Scene.

The binding engine must support validation against DeviceProfile datatypes and states.

---

## 7. Floor Mapping

Firmware floor data may arrive as values such as:

```text
-2, -1, 0, 1, 2, ...
K, P, R, Z, F, ...
```

The Designer provides a Floor Mapping Editor so project-specific display values can be defined.

Example:

```text
Firmware Value    Display Value
-2                P2
-1                P1
0                 G
1                 1
2                 2
```

Mapping converts the runtime value into a display value. Digit style selection remains a Digit/Theme concern.

A mapped floor may optionally specify a special Digit Style. If no special style is selected, the applicable default Digit Style is used.

---

## 8. Editor

The Editor is responsible for visual manipulation of domain objects.

```text
Editor
├── Canvas
├── Selection Model
├── Transform / Geometry
├── Snap/Grid
├── Bounding Groups
├── Z-Order
├── Properties Adapter
└── Commands
```

### Canvas

The canvas supports:

- pan
- zoom
- selection
- multi-selection
- drag/move
- resize
- rotation
- duplicate
- snap grid
- guides
- bounding groups
- Z-order operations

### Selection

Multiple objects may be selected. The Properties panel displays only common properties. If selected objects differ, the property displays `*`. Editing a common property applies it to all selected objects.

### Locked / Visible

Locked widgets remain selectable but cannot have size/position changed. Other parameters may remain editable.

Invisible widgets can remain selectable and show their selection bounds without rendering their visual content. Hide All / Show All are supported.

---

## 9. Bounding Groups

Bounding Groups are optional layout relationships for groups such as:

```text
Arrow + Digit Group
```

They can define:

- reference object/point
- group center
- spacing
- alignment
- relative positioning

The simulator must reproduce the same geometry behavior so the firmware implementation can later mirror it.

A common elevator example is keeping an arrow and two-digit floor number centered as one logical group.

---

## 10. Media Engine

Media is a generic visual/audio asset concept. Arrow, Digit and other semantic widgets are not mixed into the Media model.

Media widgets support applicable:

- image
- video
- audio
- duration
- loop
- repeat count
- playback control
- volume

Duration uses 0.1-second precision.

For ordinary media, default duration is `0` (indefinite where applicable). Media used in a Media Slide has a default duration of 3 seconds.

Loop means continuous playback. Repeat means a finite number of plays.

The active DeviceProfile defines simultaneous media/decode constraints. Validation must detect unsupported combinations, including excessive simultaneous video decoding.

---

## 11. Scene Media Continuity

When switching scenes:

- if the new media has incompatible size parameters, the previous media is stopped and the new media starts;
- if compatible, an optional playback-retention behavior may allow the new scene's media widget to continue playback from the previous media's position;
- the new scene's geometry is used;
- compatible audio may continue according to the configured behavior.

This behavior must be represented in the domain model rather than implemented only by the simulator UI.

---

## 12. Audio System

Theme-level background music is persistent/looping rather than Scene-specific.

Audio settings are available from the appropriate Properties context, including background music behavior and ducking/override rules.

Audio priorities are independent values from 0–100.

The system must support combinations including:

- background music + announcement
- background music + media
- background music + announcement + media

Higher-priority audio may reduce/override lower-priority audio according to configured rules.

---

## 13. Localization

Program UI language and firmware/template runtime language are separate concepts.

Runtime language affects:

- text
- announcements
- applicable floor display text
- other localized content

Multiple languages may be configured for announcements, including ordered Language 1 / Language 2 playback.

---

## 14. Asset System

Asset Depot / Asset Browser is analogous to a library/depot. It does not mean that every asset in the depot is exported.

Project resources and scene assets are separate from the depot.

Project Explorer manages project-owned files.

External files placed into the Project Explorer are routed according to support:

```text
supported → appropriate project Resources / scene location
unsupported → Unsupported Files
```

Unsupported Files are not part of the normal asset/scene visualization flow.

Export includes only the resources/default/used content defined by the project's export rules.

---

## 15. Validation

Validation is a first-class service shared by:

- editor
- simulator
- save
- export
- console/output

It checks DeviceProfile compatibility, Design Rules, bindings, media constraints, missing assets, invalid mappings, unsupported formats and other project constraints.

Critical validation errors may block export. Warnings may require user confirmation according to export rules.

---

## 16. Simulator

The Simulator is a dockable tool window and uses the same Domain Model and Binding Engine as the real template.

It provides:

- runtime state editing
- floor simulation
- direction simulation
- door states
- fire/overload/service-out scenarios
- scene activation
- binding evaluation
- media playback
- audio behavior
- console/debug output

The simulator must not implement a second, simplified rule system. It should execute the same domain/runtime evaluation logic used to validate the template.

---

## 17. Command System

Editing operations should be represented as commands wherever practical.

Examples:

- Create Widget
- Delete Widget
- Move Widget
- Resize Widget
- Rotate Widget
- Duplicate Widget
- Change Property
- Add Scene
- Remove Scene
- Add Asset
- Change Binding
- Change Floor Mapping
- Reorder Z

This provides a consistent basis for Undo/Redo, keyboard shortcuts, console logging and future AI automation.

---

## 18. Workspace System

Workspace stores application layout/document presentation state, including:

- dock positions
- open documents
- document tabs
- floating panels
- panel visibility
- window sizes
- selected layout/profile

Example layouts:

```text
Design
Simulation
Debug
```

Program defaults and project-specific workspace state may coexist according to the workspace manager rules.

---

## 19. Program Settings vs Project Settings

These scopes must remain separate.

### Program Settings

How the Designer application behaves:

- UI language
- appearance
- editor defaults
- canvas defaults
- asset browser behavior
- simulator defaults
- validation preferences
- export defaults
- keyboard shortcuts

Opened through a modal Preferences dialog.

### Project Settings

How a specific project behaves:

- selected DeviceProfile
- project-level overrides
- simulation profile
- export behavior
- project-specific editor defaults where supported

### Theme Settings

Theme-level defaults such as:

- default Digit Style
- default Direction Style
- default color
- background
- theme audio defaults

Widget/Scene-specific values can override applicable defaults.

---

## 20. AI / Automation Compatibility

The architecture must be deterministic and inspectable so an external LLM/agent working through the development environment can:

- inspect the project structure
- create/edit domain documents
- create widgets
- configure bindings
- create scenes/themes
- validate projects
- run the simulator
- inspect console output
- export a project

AI is not embedded as a runtime component of the Windows Designer. Development-time agents may operate through the project's API/console/tooling.

---

## 21. Recommended Source Layout

The implementation should follow a separation similar to:

```text
src/
├── App/
├── Core/
├── Domain/
│   ├── Project/
│   ├── Theme/
│   ├── Scene/
│   ├── Widget/
│   ├── Media/
│   ├── Binding/
│   ├── FloorMapping/
│   ├── Localization/
│   ├── Audio/
│   └── Device/
├── Editor/
│   ├── Canvas/
│   ├── Selection/
│   ├── Geometry/
│   └── Commands/
├── UI/
│   ├── Shell/
│   ├── Docking/
│   ├── Documents/
│   ├── Panels/
│   └── Properties/
├── Simulator/
├── Validation/
├── Export/
└── Infrastructure/
```

The exact technology-specific names may differ, but the architectural boundaries should remain.

---

## 22. Architectural Principle

**The Canvas is not the application.**

The Designer is an IDE/CAD-style authoring environment whose canvas is one editor surface over a structured domain model.

The same domain model must be consumable by:

```text
UI
Editor
Simulator
Validation
Export
Console
AI/Automation
```

This is the central architectural decision for Template Designer V2.
