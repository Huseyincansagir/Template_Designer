# Settings Architecture Questionnaire V1

## Decision — Settings Navigation

Program Settings / Preferences will **not** be a dockable navigation panel and will not use an in-canvas settings navigator.

It will open as a dedicated **modal Preferences/Settings window**, following the interaction model familiar from professional CAD and IDE applications.

### Required behavior

- The Settings window opens above the main application.
- While the Settings window is open, the user cannot interact with the main application behind it.
- The user must explicitly choose one of:
  - **Cancel** → discard changes and close.
  - **Save / Apply & Close** → persist changes and close.
- Clicking the background/main canvas while Settings is open must not activate or modify anything behind the dialog.
- The Settings window may contain its own category navigation and search; only the outer Settings container is modal.

### UX intent

The interaction should feel like the Preferences/Options dialogs of established CAD/IDE desktop applications rather than a web-style settings page or dockable tool window.

Example conceptual structure:

```text
┌─────────────────────────────────────────────────────────┐
│ Preferences                                         ×   │
├────────────────┬────────────────────────────────────────┤
│ General        │                                        │
│ Appearance     │  Settings content                      │
│ Editor         │                                        │
│ Canvas         │                                        │
│ Assets         │                                        │
│ Simulator      │                                        │
│ Validation     │                                        │
│ Export         │                                        │
│ Shortcuts      │                                        │
│                │                                        │
├────────────────┴────────────────────────────────────────┤
│                         [Cancel] [Save & Close]          │
└─────────────────────────────────────────────────────────┘
```

This decision applies specifically to **Program Settings / Preferences**. Project, Theme, Scene, and Widget settings remain part of the project editing workflow and are not automatically converted into modal application preferences.
