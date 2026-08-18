# Reference — Spatial Design (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_PRINCIPLES_V1.md` §4. Canonical structural authority: `docs/UI_DESIGN_SYSTEM_V2.md` §2–§4, §20–§21; `docs/UI_UX_ARCHITECTURE.md` §4, §7.

## 1. The shell (canonical anatomy)

```text
┌──────────────────────────────────────────────────────────────┐
│ Application Bar / Menus / Toolbar                            │
├──────────────────────────────────────────────────────────────┤
│ Document Tabs                                                │
├───────────────┬───────────────────────────┬──────────────────┤
│ Project       │                           │ Properties       │
│ Explorer      │       Device Canvas       │ / Inspector      │
│               │                           │                  │
├───────────────┴───────────────────────────┴──────────────────┤
│ Console / Output / Validation / Status                       │
└──────────────────────────────────────────────────────────────┘
```

- The scheme is the **starting placement**, not a fixed-column mandate: every tool window may dock, tab, split, float, collapse, or auto-hide (`UI_DESIGN_SYSTEM_V2.md` §3).
- The shell is stable across all product workspaces so users build muscle memory.
- Document Tabs are views over documents; closing a tab never deletes a domain object (§20).

## 2. Docking grammar

| Situation | Rule |
|---|---|
| Panel dropped onto another panel | Tab stack in the same dock group; existing content is preserved, never destroyed |
| Edge dock | New split or tab in an existing group |
| Center dock | Joins the document/tool tab stack; active tab clearly marked |
| Invalid target | Reductive visual feedback (preview shows rejection) |
| Floating | Own window; workspace relation preserved |
| Auto-hide/collapse | Shrinks to edge rail/min header; reopening restores previous position |
| Drag cancelled | Panel returns safely to its previous position |
| Multi-monitor | PROPOSED/FUTURE: store workspace state if supported; otherwise single-window fallback (canonical §3) |

Workspace state (dock positions, open tabs, floats, visibility, sizes, active layout profile) is persisted; program default layout and project-specific workspace state are separate.

## 3. Panel roles and their canonical boundaries

| Surface | Responsibility | Boundary (never cross) |
|---|---|---|
| Application Bar | Menus, toolbar, commands, workspace commands | Commands flow through command registry/use cases |
| Document Tabs | Open Rotation/Form documents (`Theme 01 · R0`, …) | Closing a tab never deletes the object |
| Project Explorer | Hierarchical navigation of the canonical tree | It is a view, not the source of truth (corrections §3); Asset Depot is not its hidden folder |
| Canvas | Visual editing of the selected Rotation/Form | Display aspect ratio is preserved; resize never changes Widget geometry |
| Properties | Contextual inspector for the selection | Fields not supported by the profile are hidden or explicitly marked |
| Simulator | Same canonical evaluation model with controlled runtime context | No second state/rule system; no Custom State |
| Console | Command/validation/export/runtime trace visibility | Not a domain state system |
| Status | Dirty, validation, active form/scene, zoom, operation summary | Technical success never announced before verification |

## 4. Canvas dominance

- The device display is rendered at its logical aspect ratio, centered, on a workspace surface clearly tone-separated from the device surface.
- Zoom/pan/grid/snap/guides are supporting chrome; they never cover the device preview; grid visibility is independent from snap enablement.
- Canvas resize recomputes viewport, zoom, pan, and letterbox; content is never stretched (§6, §21).
- The scene coordinate contract: Scene units = logical pixels of the active Rotation space; dimensions come from `DeviceProfile.display` (R90/R270 swap); **no device size is ever hard-coded** (AGENT2 §4.1–§4.2).

## 5. Density and the spacing rhythm

- 4/8-based rhythm; every gap, padding, inset, and row height derives from named tokens.
- **One value per recurring row type:** one list-row height, one panel-header height, one tab-bar height, one top-bar control height, one control height per family. (Audit history shows 29/33/43 px rows and 52/63 px headers as the defect class — `AP-SPACE-01`.)
- Common control heights: 28–36 px; not smaller for precision surfaces that users edit frequently.
- Density target: reference-screen density at the same window size. Content must not be pushed below the fold by whitespace (`AP-WHITE-01`).

## 6. Alignment rules

- Shared vertical rhythm: panel headers, tabs, toolbars, property rows align across the whole shell.
- Edge alignment over centering for reading surfaces (labels, values, tree rows).
- Baseline alignment for mixed-size text in one row.
- Optical alignment only to correct glyph/icon box offsets; record it (token or comment), never as a magic number.
- Grid/snap on the Canvas are design aids with deterministic pass-priority behavior (AGENT2 §4.11); grid visibility ≠ snap enablement.

## 7. Responsive behavior (desktop-only)

| Resize | Expected result |
|---|---|
| Window grows | Canvas flexes; aspect ratio and centering preserved |
| Window shrinks | Secondary labels shorten; panels collapse/tab/auto-hide |
| Inspector width changes | Rows reflow; Canvas viewport recomputed |
| Explorer narrows | Vertical scroll/ellipsis; minimum preview visibility kept |
| Console opens/closes | Canvas fits remaining height; scrollback preserved |
| Rotation/Form changes | Fit to new logical resolution; geometry never stretched |

No phone/portrait viewport target. Panel resize never silently changes runtime context or active Scene (§21).

## 8. Quick self-check (spatial)

```text
□ Shell matches the canonical anatomy (not an invented layout)?
□ Every panel maps to a canonical role and boundary?
□ No content destroyed by docking; invalid targets visually rejected?
□ Device preview dominant and aspect-correct at every size?
□ All spacing values on the 4/8 rhythm / named tokens?
□ One height per recurring row type?
□ Headers/tabs/rows aligned across surfaces?
□ No hard-coded device dimensions anywhere?
□ Panel resize never distorts content or changes context?
```

Failing any check means a spatial defect (audit dimensions D2/D4/D5/D6/D14/D15), not a taste issue.
