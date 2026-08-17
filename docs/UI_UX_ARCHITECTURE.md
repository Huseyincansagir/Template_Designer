# Template Designer — UI/UX Architecture

## 1. Design objective

Template Designer is a Windows engineering/design application, not a generic SaaS dashboard and not a simple form editor.

The supplied reference screenshots define the visual direction. The implementation should reproduce their visual hierarchy, density, device-preview focus, contextual editing model and professional desktop behavior.

The repository's UI reference describes the target language as a light neutral workspace, dark device/display preview, restrained teal/cyan accent, compact controls, thin borders, subtle elevation and dense information without clutter. fileciteturn76file0L2-L2

## 2. Core UX principle

The application should always make the user's current task obvious:

```text
Where am I?
What am I editing?
What is selected?
What will change?
What is invalid?
What happens next?
```

Avoid requiring the user to understand the internal domain model before using the application.

## 3. Product navigation architecture

```text
Application Shell
│
├── Home / Projects
├── Theme Library
├── Design Studio
├── Media / Resources
├── Test Studio
├── Validation / Publish
├── Deployment
└── Settings
```

These are product workspaces, not necessarily separate OS windows.

### Recommended navigation behavior

- persistent compact primary navigation,
- clear active workspace,
- recent projects accessible from Home,
- contextual secondary navigation inside workspaces,
- no unnecessary wizard chains.

## 4. Application shell

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Application Menu / Project / Save / Undo / Redo / Help               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Workspace navigation         Main workspace         Inspector        │
│                                                                       │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│ Context toolbar / validation / logs / zoom / status                  │
└───────────────────────────────────────────────────────────────────────┘
```

The shell must remain stable enough that users build muscle memory.

## 5. Theme Library architecture

### Purpose

The Theme Library is the starting point for choosing and managing themes.

### Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Themes                                      Search  Filter  + New    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Theme cards/list                 Selected theme                     │
│  ┌────────┐ ┌────────┐            ┌────────────────────────────┐     │
│  │preview │ │preview │            │ large device preview       │     │
│  │        │ │        │            │                            │     │
│  └────────┘ └────────┘            └────────────────────────────┘     │
│                                                                      │
│                                  metadata / device / orientation     │
│                                  [Open] [Duplicate]                  │
└──────────────────────────────────────────────────────────────────────┘
```

The preview must show the actual target display aspect ratio and orientation.

## 6. New Project / Device Selection

The device/profile selection surface should be simple and capability-aware.

```text
Choose Device
────────────────────────────────────
[ Device Profile ]

Display
  480 × 800
  Portrait

Capabilities
  ✓ Floor Number
  ✓ Direction
  ✓ Media Slide
  ✓ Video
  ✓ Audio
  ...

                         [Continue]
```

The user should not be forced to read raw firmware metadata.

Unsupported capabilities must not appear as available controls.

## 7. Design Studio architecture

This is the primary product screen.

The repository architecture already identifies the central device canvas, left-side navigation/resources/layers and contextual right-side Properties/Inspector as the main Design Studio pattern. fileciteturn73file0L2-L2

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Studio toolbar                                                         │
├───────────────┬─────────────────────────────────────┬───────────────────┤
│ Left Context  │                                     │ Inspector         │
│               │             DEVICE CANVAS           │                   │
│ Scenes        │                                     │ Contextual        │
│ Layers        │          ┌─────────────────┐        │ properties        │
│ Resources     │          │                 │        │                   │
│               │          │  actual device  │        │                   │
│               │          │     display     │        │                   │
│               │          │                 │        │                   │
├───────────────┴──────────┴─────────────────┴────────┴───────────────────┤
│ contextual editing toolbar / zoom / status                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Canvas rules

- Device preview is visually central.
- Render actual template content.
- Preserve logical display aspect ratio.
- Support zoom and pan.
- Selection is obvious but restrained.
- Resize handles appear only when applicable.
- Optional grid/rulers/guides should not permanently consume space.
- Canvas chrome must not compete with the device preview.

### Left panel

Use compact tabs/sections:

```text
Scenes / Forms
Layers
Resources
```

The panel should support drag/reorder where the underlying domain operation exists.

### Right Inspector

Contextual sections:

```text
Identity
Position & Size
Binding / Condition
Appearance / Style
Content / Media
Typography
Audio
Layer
Advanced
```

Do not display irrelevant sections.

## 8. Widget creation UX

```text
[ + Add ]
      ↓
Supported widget menu
      ↓
Place on canvas
      ↓
Inspector opens
```

The menu comes from the selected Device Profile. There is no generic “Custom State” creation UI.

## 9. Widget selection model

### Single selection

Inspector displays full contextual properties.

### Multi-selection

Inspector displays only common editable properties.

Bottom toolbar exposes:

```text
Align Left
Align Center
Align Right
Align Top
Align Middle
Align Bottom
Distribute
Group
Lock
Duplicate
Delete
```

Grouping in this toolbar means editor grouping where supported; it must not be confused with the domain `Bounding Group`.

## 10. Bounding Group UX

Bounding Group is optional.

It should appear as an explicit action:

```text
[ Create Bounding Group ]
```

When selected:

```text
Bounding Group
────────────────────
Reference      [Screen Center]
Width          [100]
Height         [60]
Horizontal     [Center]
Vertical       [Center]
Spacing        [20]
Layout Mode    [Dynamic Active Items]

Children
  Floor Number
  Direction
```

The UI should explain the concept in plain language rather than expose mathematical terminology unnecessarily.

Example helper text:

> Align these items as one group around the selected reference.

## 11. Layers UX

Layers should be a compact tree/list showing:

```text
Background
Media Slide
Floor Number
Direction
Text
Warning
```

Show:

- visibility,
- lock,
- selection,
- z-order where relevant.

Drag reorder is allowed only when it maps cleanly to canonical z-order.

Runtime priority must not be presented as z-order.

## 12. Media / Resources architecture

```text
Resources
├── Images
├── Videos
├── Audio
├── Fonts
└── Styles
```

Use thumbnails for visual media and meaningful metadata for technical assets.

Resource actions:

- Import
- Preview
- Replace
- Rename
- Inspect
- Reveal/locate source where supported
- Remove

Asset usage should be visible when useful.

## 13. Media Slide editor

When a Media Slide is selected, the Inspector should expose only relevant properties:

```text
Media Slide
────────────────────────
Condition
Media
  [ Image / Video ]
Duration
Loop
Loop Count

Audio
  File
  Repeat Count

Layer
```

There is no “Popup” widget in the UI.

A floor-specific presentation is simply a Media Slide with a runtime condition.

## 14. Floor Number editor

The user should edit the visual presentation of the floor number without being asked to implement firmware runtime math.

```text
Floor Number
────────────────
Style        [Default 02]
Position
X
Y
Width
Height

Optional
Bounding Group
```

Supported floor values are supplied by the Device Profile/runtime registry. The UI must not assume floors are only decimal digits.

## 15. Direction editor

```text
Direction
────────────────
Style Mode
  ○ Default
  ○ Custom

Default Style
  Shape   [03]
  Color   [palette]

Up Variant
Down Variant

Custom
  Up Asset
  Down Asset
```

The exact available choices come from the profile/style catalog.

## 16. Text editor

```text
Text
────────────────
Content / Localization
Font
Size
Bold
Italic
Alignment
Color
```

Normal text uses firmware font references; it must not expose glyph-atlas internals to ordinary users.

## 17. Runtime / Condition UX

Conditions should be understandable as rules:

```text
Show when
[ Floor ] [ equals ] [ 5 ]
```

or:

```text
Show when
[ Fire ] [ is ] [ Active ]
```

Advanced expression editing can exist behind an Advanced section.

The user should never need to type raw JSON for common conditions.

## 18. Warning UX

The current warning set is exactly:

```text
Service Out
Overload
Fire
```

No additional warning creation UI should be presented.

Each warning can have its own priority/configuration where the profile permits it.

## 19. Test Studio

The Test Studio should feel like a controlled test bench, not a generic dashboard.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Test Studio        [Run] [Pause] [Reset] [Save Scenario]             │
├───────────────────────┬──────────────────────────┬───────────────────┤
│ Scenario / Timeline   │ Device Preview           │ Runtime State     │
│                       │                          │                   │
│ 1  Floor -1           │                          │ Floor: 8          │
│ 2  Move Up            │                          │ Direction: Up     │
│ 3  Door Open          │                          │ Fire: Off         │
│ 4  Floor 8            │                          │ Language: TR      │
│                       │                          │                   │
└───────────────────────┴──────────────────────────┴───────────────────┘
```

The current step should be visually obvious.

## 20. Validation / Publish UX

Use a readiness-oriented layout:

```text
Publish
────────────────────────────────────────
Template: My Theme
Device:   H747 Display

Validation
✓ Runtime states
✓ Media
✓ Fonts
✓ Localization
✓ Layout
✓ Bounding Groups

Package
  Size: 12.4 MB
  Version: 1.0.0

                    [Build Package]
```

Errors should provide:

- problem,
- reason,
- location,
- action.

Example:

> Fire warning media is missing for English. Open Media → Warning → Fire.

## 21. Deployment UX

The deployment screen should be deliberately simple:

```text
Deploy to SD Card
────────────────────────────────────
Package
  Theme: Main Theme
  Version: 1.0.0
  Size: 12.4 MB

Target
  E:\  SD Card
  Free: 14.2 GB

✓ Package validated

[ Deploy ]
```

During deployment:

```text
Preparing     ✓
Writing       ███████████░░  82%
Verifying     ○
Safe eject    ○
```

After success:

> Deployment completed. You can safely remove the SD card.

## 22. Settings UX

Use familiar Windows application settings patterns. Keep the page shallow.

```text
Settings
├── General
├── Appearance
├── Language
├── Editor
├── Paths
└── Diagnostics
```

Do not mix project/device runtime settings into application settings.

## 23. Dialog policy

Use dialogs only for decisions that genuinely interrupt the current task:

- destructive deletion,
- overwrite,
- selecting an external target,
- unrecoverable validation/deployment errors.

Prefer inline panels/popovers for ordinary configuration.

## 24. Notifications

Use a consistent status system:

- inline validation for local field errors,
- toast/status for completed background operations,
- modal only when user action is required.

Avoid notification spam.

## 25. Keyboard and pointer model

Minimum expected shortcuts:

```text
Ctrl+N  New Project
Ctrl+O  Open
Ctrl+S  Save
Ctrl+Z  Undo
Ctrl+Shift+Z  Redo
Ctrl+C  Copy
Ctrl+V  Paste
Ctrl+D  Duplicate
Delete  Delete
Esc     Cancel/clear selection
```

Canvas interactions should follow conventional design-tool behavior.

## 26. Accessibility

The application is desktop-first but should still provide:

- keyboard focus,
- visible focus states,
- accessible labels,
- tooltips where icons are ambiguous,
- sufficient contrast,
- no color-only state communication.

## 27. Responsive behavior

This is a Windows desktop application. Do not design for arbitrary phone widths.

Support realistic desktop window resizing by:

- collapsing secondary panels,
- reducing nonessential tool labels,
- preserving canvas visibility,
- allowing Inspector width adjustment,
- preserving important controls.

## 28. Visual QA workflow

Every major screen should be compared to the repository reference screenshots.

Workflow:

```text
Reference screenshot
        ↓
Structure extraction
        ↓
Implementation
        ↓
Runtime screenshot
        ↓
Visual comparison
        ↓
Fix largest mismatch
        ↓
Repeat
```

Prioritize, in order:

1. overall geometry,
2. panel proportions,
3. device preview size/position,
4. typography hierarchy,
5. spacing,
6. control styling,
7. iconography,
8. micro-details.

## 29. UI component architecture

Recommended component layers:

```text
ui/
├── shell/
├── navigation/
├── toolbar/
├── panels/
├── inspector/
├── canvas/
├── layers/
├── resources/
├── simulator/
├── validation/
├── deployment/
└── primitives/
```

Primitives should contain reusable controls, not product-specific business logic.

Product surfaces compose primitives and call application use cases.

## 30. State boundary

React components must not own canonical template state.

```text
UI Event
  ↓
Application Command / Use Case
  ↓
Canonical Project State
  ↓
Selectors / View Model
  ↓
React UI
```

Canvas pointer movement may use transient editor state for responsiveness, but committed edits must flow through canonical application state.

The repository's current architecture already requires browser-compatible React/TypeScript/CSS presentation, an application core, and native adapters behind interfaces. fileciteturn73file0L2-L2

## 31. Visual non-goals

Do not turn the application into:

- a website,
- a generic admin dashboard,
- a giant property spreadsheet,
- a Figma clone with unnecessary features,
- a glassmorphism showcase,
- an icon maze.

The target is a familiar, professional, efficient engineering desktop application.

## 32. Definition of done for UI

A screen is not complete merely because its components render.

It is complete when:

- the main task is obvious,
- the layout follows the reference visual language,
- the device/content preview is real,
- interactions are predictable,
- selection and state feedback are clear,
- empty/loading/error states exist,
- data is connected to canonical application state,
- the screen works at realistic Windows sizes,
- visual QA has been performed against the reference.
