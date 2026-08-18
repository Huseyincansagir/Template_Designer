# Reference — Accessibility (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_PRINCIPLES_V1.md` (accessibility is precedence tier 4). Canonical authority: `docs/UI_DESIGN_SYSTEM_V2.md` §24. Operating procedure: Workflow G in `docs/design/UI_DESIGN_WORKFLOWS_V1.md`.

## 1. The bar

The application is desktop-first, but every surface must satisfy the canonical §24 contract:

- keyboard operability for every surface,
- visible focus distinct from selection,
- accessible labels and tooltips,
- sufficient contrast,
- no color-only state communication.

## 2. Keyboard operability

Focusable surfaces (canonical §24): Menu Bar, Toolbar, Document Tabs, Project Explorer, Canvas actions, Properties fields, dock headers, modal Settings, Console filters.

- Focus ring: the `focus-ring` / `keyboard-focus` token — visible and distinct from selection accent. Exactly one focus treatment application-wide (audit VC-04).
- No dead keyboard zones: Delete/Arrows/Ctrl+A must work from the Canvas context; deleting the focused widget must not drop focus to `<body>` and kill the keyboard (audit INT-31/32 are the failure archetype).
- Focus containment: modal Settings traps focus inside; Escape = Cancel is documented and functional (audit ST-03, INT-17).
- Canvas pointer interactions have keyboard equivalents: precise drag/marquee that keyboard cannot fully reproduce is editable via X/Y/Width/Height/Z-order in Properties (§24).
- Escape inside text-editing surfaces cancels that surface's own state, not the canvas gesture (AGENT2 §4.12).

## 3. Labels and roles

- Icon-only controls: accessible label + tooltip, always (Save, Publish, Lock, Visibility, Fit, Dock, zoom buttons — audit TB-03, AX-06).
- Form fields: label + unit + validation message in one accessible relation (numeric Properties fields).
- ARIA only where the real pattern exists: a real tablist gets the tablist pattern; a fake one gets either the pattern implemented or the roles dropped — never half-applied roles (audit AX-03, DK-07).
- Status/console updates announce through `aria-live` where appropriate (audit AX-05).
- Explorer selection: `aria-selected` plus a non-color cue (audit EX-02).

## 4. Contrast

- Measured, not estimated: ≥4.5:1 normal text; ≥3:1 large text and UI components; every pair on its actual background.
- `text-muted` is still text: calibrate to ≥4.5:1 (audit GL-07/EX-05 — the muted token was a failing pair).
- Focus indicators: ≥3:1 against adjacent colors.
- Dark device-preview overlays get their own calibrated pairs.

## 5. No color-only state

Locked, invisible, selected, active Scene, warning, error, and disabled states pair color with icon/text/structure (§24).

- Selection: accent + outline/shape, not accent alone.
- Disabled: opacity + reason text, not opacity alone (audit SF-05).
- Guides (grid/edge/center) distinguishable beyond color where color alone is ambiguous (audit CV-10).

## 6. Hit targets and text size

- Icon/tree/expander/close controls: ≥24 × 24 px hit area (audit EX-07, GL-08 splitter).
- Minimum UI text: 10 px; reading surfaces 12 px. 7–9 px text is a defect (audit TY-03, AX-07).

## 7. Keyboard shortcut honesty

- Advertised shortcuts must be bound, or the hints removed (audit AX-01, INT-15/30): advertising `Ctrl+S/Z/Y/N/R` while unbound is a state-honesty violation, not just an a11y issue.
- `Ctrl/Cmd+D` stays PROPOSED/unbound; Settings→Shortcuts must not advertise it as a working binding.

## 8. Motion

- `prefers-reduced-motion` disables/minimizes non-essential animation (see `interaction-design.md` §7).

## 9. Quick self-check (accessibility)

```text
□ Every canonical surface keyboard-reachable with a visible, distinct focus ring?
□ No dead keyboard zones; focus restored after delete/modal close?
□ Modal Settings traps focus; Escape = Cancel works?
□ Every icon-only control labeled + tooltipped?
□ ARIA roles only for real patterns?
□ All contrast pairs measured and passing on actual backgrounds?
□ No state communicated by color alone?
□ Hit targets ≥24×24 for icon/tree controls; no <10 px text?
□ Advertised shortcuts are bound; unbound hints removed?
```

Failing any check maps to audit dimension D12; unbound-but-advertised shortcuts also trigger gate G2/G4 (fake affordance).
