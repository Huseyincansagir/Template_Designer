# Elevator Project UI Reference Brief

## Purpose

Create a set of visual UI reference screens for the Template Designer elevator-display product. The images are static visual references for the Application Shell, Design Studio, Theme Library, Test Studio/Simulator, Asset Browser and Publish/Validation surfaces. They are not functional prototypes and must not introduce domain behavior that is absent from the canonical model.

## Shared visual direction

Use a mature Windows engineering/design application composition rather than a web dashboard. Use a light neutral desktop shell, thin gray borders, compact controls, restrained teal/cyan selection and action accents, coral/red runtime warning accents, and a dark physical elevator display as the visual focal point. Use crisp typography, high information density, conventional desktop menus, dockable panels and contextual inspectors. Avoid rounded SaaS cards, large hero whitespace, decorative gradients, glassmorphism, mobile layouts and generic dashboard charts.

The elevator display should use realistic but fictional project content: a building/lobby display, floor value `12`, next stop `18`, direction arrow, door state, capacity and weight, no-smoking/compliance markers, and profile-defined warning examples such as Fire Alarm or Overload. These are presentation examples only; the visual must not imply a new universal runtime state registry.

## Reference screen set

### 01 — Elevator Design Studio / Canvas-first editor

A 16:9 desktop editor at approximately 2560×1440. Show the full Application Shell with compact top Application Bar, File/Edit/View/Project/Theme/Scene/Widget/Tools menus, Save, Undo/Redo and Preview/Publish actions; Document Tabs below; a left Project Explorer with `Workspace → Project → Theme Project Group → Theme Project → R0/R90/R180/R270 → Scene → Widget`; a centered metallic-framed dark elevator display at a real portrait aspect ratio; canvas grid/rulers; one selected Floor/Digit widget with cyan bounds and four resize handles; a bottom contextual action rail; and a right Properties inspector showing Identity, Position X/Y, Size W/H, Locked, Visible, Z-order, Digit Style and Floor Mapping. Use a plausible active scene called `Travel Up` or `Lobby Idle`, showing floor 12 and next stop 18. Make the central display dominant and the inspector contextual.

### 02 — Elevator Theme Library / profile and orientation management

A 16:9 desktop Theme Library screen. Show a compact left navigation and a list/grid of elevator themes such as `SAVAS Lobby`, `Metro Vertical`, `Night Lift` and `Minimal Cabin`, each with a small dark display thumbnail and readiness badge. Center the selected theme preview with `DeviceProfile`, display resolution and language metadata. Show four explicit orientation cards: `R0 Portrait`, `R90 Landscape`, `R180 Inverted`, `R270 Landscape`, with profile-derived dimensions and one selected teal card. Include actions `Open in Designer`, `Duplicate Theme` and `Export Package`; show a right metadata inspector with supported widget/media capabilities, default Digit/Direction styles, language and four-form readiness. Keep unused asset depot content separate from theme resources.

### 03 — Elevator Test Studio / Simulator and runtime trace

A 16:9 desktop Test Studio screen with the same shell and dark elevator preview language. Use a left Runtime Inputs panel whose rows are visibly profile-defined: Floor, Direction, Door, Fire Alarm, Overload, Service Out and Language, with no Custom State button. Center a live-looking dark elevator display showing a Fire Alarm state with a clear `DO NOT USE ELEVATOR` warning, floor and direction context. Show a right Runtime Inspector with Active Scene, Scene Priority, Activation Conditions, Active Bindings, binding result, media/audio trace and transport state. Add a bottom sequence strip with steps such as Floor, Travel, Door, Warning, Progress, Run/Pause/Step/Reset. Make clear that one Active Scene is selected after conditions and priority, while binding changes presentation inside that scene.

### 04 — Elevator Assets / Validation and Publish readiness

A 16:9 desktop workspace combining a dockable Asset Browser and a publish-readiness review. Show Asset Depot categories Images, Videos, Audio, Digit Styles, Direction Styles and Warning Signs; preview cards for a lobby video, upward arrow image, fire warning sign and announcement audio; metadata including format, resolution, duration, Used By and supported/unsupported status. Keep `Unsupported Files` visibly separate. In the right or lower panel show validation checks: Profile compatible, Required rotations available, Required assets available, Media formats valid, Runtime bindings valid, Floor mappings valid, Package verified. Show a restrained success/readiness state with `Build Package`, target DeviceProfile and a disabled `Deploy` until verification. Do not show invented format conversion or SD-card behavior that is not indicated by the canonical project contract.

## Acceptance criteria

The four screens must share the same shell geometry and visual token family, preserve the physical elevator-display focus, show canonical hierarchy and profile-driven terminology, distinguish semantic Widget Type from Media Type, distinguish State from Scene, and keep Asset Depot separate from Project/Theme Resources. The visuals should be suitable as repository reference images for future UI implementation.
