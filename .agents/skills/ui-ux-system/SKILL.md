# UI/UX System Skill — Template Designer

## Purpose

This skill governs the visual and interaction design of the Windows Template Designer. The supplied reference screenshots are the primary visual source. The goal is not to invent a trendy UI; it is to reproduce the visual discipline and usability of a professional, familiar engineering/design desktop application.

## Source of truth

Use, in this order:

1. Supplied reference screenshots in `docs/`.
2. `docs/UI_REFERENCE.md`.
3. Product/domain contracts and current implementation requirements.
4. General UI/UX knowledge only where the sources do not specify a detail.

The repository currently contains reference screens including:

- `01_canvas_first_studio.png`
- `01_tema_kutuphanesi_detayli.png`
- `02_ayrintili_durumlar.png`
- `02_tasarim_studyosu_detayli.png`
- `03_design_studio.png`
- `tema_katalogu_acik_gri.png`

Treat these as visual references, not optional inspiration.

## Visual direction

The application should feel like a mature Windows engineering/design tool:

- light neutral application shell,
- dark device/display preview as the visual focal point,
- restrained teal/cyan accent,
- compact controls,
- high information density without clutter,
- clear typography hierarchy,
- thin borders,
- subtle elevation only where it helps grouping,
- predictable spacing,
- conventional desktop interaction patterns.

Avoid:

- generic SaaS dashboard aesthetics,
- excessive rounded cards,
- giant hero sections,
- decorative gradients,
- excessive glassmorphism,
- oversized empty whitespace,
- unnecessary animations,
- icon-only controls without discoverable meaning,
- UI that looks like a website instead of a desktop engineering application.

## UX principles

### 1. Device preview is the center of gravity

In Design Studio the physical display/canvas must remain visually central. Side panels support editing; they must not visually dominate the actual device preview.

### 2. Contextual complexity

Do not show every possible property at once. The right Inspector is contextual:

- nothing selected → document/form properties,
- widget selected → widget properties,
- media selected → media properties,
- Bounding Group selected → group layout properties,
- multiple selection → common properties and alignment tools.

### 3. Familiar desktop behavior

Use established patterns users already know from engineering/design tools:

- click to select,
- Shift/Ctrl multi-select where appropriate,
- drag to move,
- resize handles,
- Delete/Backspace to remove,
- Ctrl/Cmd+Z undo,
- Ctrl/Cmd+Shift+Z redo,
- Ctrl/Cmd+S save,
- copy/paste/duplicate,
- context menus where useful,
- tooltips for unfamiliar controls,
- persistent selection feedback.

### 4. Progressive disclosure

Basic controls should be immediately visible. Advanced controls appear in collapsible sections or contextual panels rather than overwhelming the user.

### 5. No dead-end interactions

Every visible control must either work or clearly communicate why it is disabled. Avoid decorative buttons that do nothing.

### 6. One source of truth

The editor, preview, simulator, validation and deployment screens must derive from the same canonical project state. Do not create a separate fake UI state that disagrees with the renderer.

## Application shell

Use a stable desktop shell across all screens:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ App / Menu / Project / Save / Undo / Redo / Help                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Navigation / Workspace                            Context Inspector │
│                                                                      │
│  ┌──────────────┐       Main Work Area / Device Preview             │
│  │              │                                                     │
│  │              │                                                     │
│  │              │                                                     │
│  └──────────────┘                                                     │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Status / Validation / Logs / Selection / Zoom                        │
└──────────────────────────────────────────────────────────────────────┘
```

The exact panel widths are implementation details, but the hierarchy should remain stable.

## Product navigation

Primary surfaces:

1. Home / Project Start
2. Theme Library
3. Design Studio
4. Media / Resources
5. Test Studio / Simulator
6. Validation / Publish
7. Deployment
8. Application Settings

Navigation should be compact and persistent where practical. Avoid turning every operation into a separate wizard.

## Theme Library

Purpose: choose, create, duplicate and manage themes.

Structure:

```text
Header
├── Search
├── Filter
└── New Theme

Theme list/grid
├── Preview thumbnail
├── Theme name
├── Device/profile
├── orientation
├── modified status
└── actions

Selected theme
├── large preview
├── metadata
├── Open in Designer
├── Duplicate
└── Delete/archive where supported
```

The large preview should communicate the actual target display, not a generic card illustration.

## New Project / Device Selection

Device selection is capability-driven.

The user should first understand:

- target device/profile,
- display resolution/orientation,
- supported widgets,
- supported media types,
- supported styles/languages.

Unsupported widgets/media must not appear as if they were available.

Avoid a long technical configuration form. Use a concise selection surface with a clear summary before continuing.

## Design Studio

This is the most important screen.

### Layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Studio Toolbar                                                       │
├───────────────┬──────────────────────────────────┬───────────────────┤
│ Scenes /      │                                  │ Properties /      │
│ Resources /   │          DEVICE CANVAS          │ Inspector         │
│ Layers        │                                  │                   │
│               │                                  │                   │
│               │                                  │                   │
├───────────────┴──────────────────────────────────┴───────────────────┤
│ Context toolbar / alignment / zoom / selection / status              │
└──────────────────────────────────────────────────────────────────────┘
```

### Left side

Use tabs or compact sections for:

- Scenes/forms,
- Layers,
- Assets/resources.

Do not show three huge permanent trees simultaneously. Use the reference-screen density and contextual switching.

### Center

The device display is rendered at its logical aspect ratio.

Provide:

- zoom,
- pan,
- selection,
- bounding boxes,
- resize handles where supported,
- optional rulers/guides,
- optional grid/snap,
- orientation/device frame where useful.

The canvas background should visually separate the editor workspace from the device itself.

### Right Inspector

The Inspector is the main editing surface for properties.

Recommended sections:

```text
Properties
────────────────
Identity
Position & Size
Appearance
Binding / Runtime
Media / Content
Typography
Audio
Layer
Advanced
```

Only show sections relevant to the selected object.

### Bottom contextual toolbar

Use a compact toolbar for frequent actions:

- align left/center/right,
- align top/middle/bottom,
- distribute,
- duplicate,
- lock/unlock,
- visibility,
- focus/zoom selection,
- delete.

Do not move every action into the right Inspector.

## Widget insertion

Adding a widget should be a predictable two-step flow:

```text
+ Add
  ↓
Supported Widget Types
  ↓
Place on Canvas
  ↓
Inspector
```

The list is generated from the Device Profile. Do not hard-code unsupported widget choices into the UI.

## Media workflow

Media should feel like a real asset manager, not a file picker glued onto the canvas.

Provide:

- import,
- preview,
- metadata,
- source/converted status,
- language variants where relevant,
- usage references,
- remove/replace,
- resize/fit preparation where supported.

When a video is selected, show video-specific controls. When audio is attached, expose repeat count and applicable volume/default controls without mixing them with unrelated widget properties.

## Test Studio / Simulator

The simulator should keep the same device preview visual language as Design Studio.

Recommended structure:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Simulator Toolbar: Run / Pause / Reset / Scenario                   │
├───────────────────────┬──────────────────────────┬───────────────────┤
│ Runtime Inputs        │ Device Preview           │ Runtime Inspector│
│                       │                          │                   │
│ Floor                 │                          │ Active states     │
│ Direction             │                          │ Settings          │
│ Door                  │                          │ Conditions        │
│ Warnings              │                          │ Layers            │
│ Language              │                          │ Audio             │
└───────────────────────┴──────────────────────────┴───────────────────┘
```

Use real rendered content. Do not use placeholder rectangles where the actual renderer can be used.

Test sequences should be visually understandable: current step, next step, elapsed time and result/status.

## Validation / Publish

The publish surface should answer three questions immediately:

1. Is the template valid?
2. What will be exported?
3. Where will it go?

Use a clear readiness summary:

```text
✓ Profile compatible
✓ Required assets available
✓ Media formats valid
✓ Localization complete
✓ Runtime bindings valid
✓ Bounding groups valid

[ Build Package ]
```

Errors should be actionable and linked to the relevant editor location when possible.

## Deployment

Deployment is a focused operation, not a second editor.

Flow:

```text
Package Ready
    ↓
Select SD Card
    ↓
Review target + package
    ↓
Deploy
    ↓
Writing
    ↓
Verifying
    ↓
Safe to remove
```

Make destructive or irreversible operations explicit. Never hide the target drive identity.

## Settings

Settings should be conventional and low-friction:

- General,
- Appearance,
- Language,
- Editor,
- Paths,
- Diagnostics/logging.

Do not put template-specific runtime settings here; those belong to the project/profile/template context.

## Design system

Create a small semantic token system instead of scattered values.

Tokens should cover:

- application background,
- panel background,
- canvas background,
- surface,
- border,
- text primary/secondary/muted,
- accent,
- success/warning/error,
- selection,
- focus,
- spacing scale,
- control heights,
- radii,
- typography scale,
- shadow/elevation levels.

The visual language should remain restrained. Accent color is for action, selection and status—not decoration everywhere.

## Density

This is an engineering application. Prefer compact but breathable density:

- compact controls,
- 28–36 px common control heights depending on context,
- consistent 4/8-based spacing rhythm,
- short labels,
- grouped properties,
- minimal redundant helper text.

Do not make controls so small that precision editing becomes difficult.

## Typography

Use a highly legible UI font available on Windows. Prioritize:

- clear numeric glyphs,
- compact labels,
- distinguishable 1/I/l and 0/O,
- strong hierarchy.

Do not use the target firmware fonts for the application UI.

## Color semantics

Use neutral surfaces as the default.

Accent:
- active navigation,
- selection,
- primary action,
- focus.

Success:
- validated/complete.

Warning:
- attention required.

Error:
- blocking issue.

Do not encode state by color alone; pair with icon/text/structure.

## Motion

Motion is functional only:

- panel open/close,
- selection feedback,
- progress,
- transient status.

Keep transitions short and subtle. No decorative floating effects.

## Screenshot-driven implementation

When a reference screenshot is available:

1. Identify shell geometry.
2. Identify major regions.
3. Identify spacing rhythm.
4. Identify typography hierarchy.
5. Identify controls and states.
6. Identify canvas/preview proportions.
7. Recreate the layout before polishing details.
8. Compare implementation screenshot against the reference.
9. Fix the largest visual mismatch first.

Do not merely approximate the screenshot with a generic dashboard layout.

## Acceptance criteria

A UI surface is complete only if:

- it follows the reference visual language,
- its main task is obvious without explanation,
- controls are discoverable,
- selected/disabled/error states are clear,
- keyboard and pointer interaction are predictable,
- it uses canonical application state,
- it remains consistent with the rest of the application,
- it works at realistic Windows desktop sizes,
- it does not introduce unnecessary visual complexity.
