# Reference — Visual Hierarchy (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_PRINCIPLES_V1.md` §5–§10. Canonical authority: `docs/UI_DESIGN_SYSTEM_V2.md` §22–§23; `docs/UI_REFERENCE.md`; the reference screens.

## 1. The hierarchy contract

- **One focal point per surface** (device preview in Design Studio, target/package summary in Deployment).
- Visual weight (size, weight, color, elevation) increases together with importance; a large but low-contrast element is noise.
- The six questions (Where am I / What am I editing / What is selected / What will change / What is invalid / What happens next) must be answerable by hierarchy alone.
- Suppression over decoration: reduce secondary weight (muted text, subtle borders) instead of amplifying primary elements.

## 2. Surface hierarchy

Named levels only, in order: `app-bg` → `panel-bg`/`surface` → `surface-elevated` → floating/dialog surfaces.

- Light neutral workspace; the device display surface is dark — the tone separation is the primary focal mechanism.
- Panels are flat surfaces separated by 1 px `border-subtle` + tone; section headers delimit groups.
- A new surface level requires a documented decision (decision log).

## 3. Border strategy

| Token | Use |
|---|---|
| `border-subtle` | Structural region separation (default) |
| `border-strong` | Interaction/hierarchy edges (inputs, active tab, selected rows where applicable) |
| `splitter` | Resizable panel dividers |

- A border must separate two *different* visual regions; nested boxes are `AP-BORDER-01`.
- Separator colors are one token everywhere (audit VC-05).

## 4. Elevation and shadow language

- Shadows only for genuinely floating content: menus, floating panels, dialogs.
- Exactly three tokens: `shadow-panel`, `shadow-floating`, `shadow-dialog`. No shadows on static rows/cards/buttons (`AP-SHADOW-01`).
- Depth is communicated by tone and borders first; shadow is the last resort.

## 5. Corner radius hierarchy

- One low radius token per level (controls, small surfaces); default range ~0–4 px.
- No 50% pills except a defined badge/avatar shape; no mixed radii scattered per surface (`AP-RADIUS-01`, audit VC-06).

## 6. Typography hierarchy

- Named type scale: one size per role; ≤ ~5–6 sizes per surface family; one micro-label treatment.
- System UI font stack (Windows-legible); firmware fonts never used for chrome, UI fonts never for firmware Text content (§23).
- Minima: 10 px UI text, 12 px reading text; section titles must not visually dominate content text (audit TY-05).
- Emphasis: one strong per heading level; weight or color, not both; no decorative caps/letter-spacing.
- Numeric fields: distinguishable 1/I/l, 0/O glyphs.

## 7. Color hierarchy

- Neutral surfaces by default; color = meaning only.
- **Accent economy:** teal/cyan for action, selection, focus, active state. One family with hover/muted derivatives. ≤1 dominant accent element per local region (`AP-ACCENT-01`).
- Status: `success` / `warning` / `error` / `info`; never color-only (pair with icon/text/structure).
- Selection ≠ focus: selection uses the accent family; focus ring is the distinct `focus-ring`/`keyboard-focus` token; error/warning never use the selection accent.
- Dark-surface pairs (device preview overlays) are calibrated separately.

## 8. Iconography

- One glyph per concept, one concept per glyph, application-wide (`AP-ICON-01`; audit IC-01/IC-02).
- Icon size tokens; icon-only controls require accessible label + tooltip (§24).
- State icons (warning/error/validation) carry meaning; decorative icons on every row are noise (`AP-ICON-01`).

## 9. Contrast and calibration

- Semantic text tokens meet WCAG AA on their actual backgrounds: ≥4.5:1 normal text, ≥3:1 large text/UI components.
- `text-muted` is still readable text — calibrate it against its real background (audit GL-07/EX-05).
- Exact token color values are calibrated during Windows contrast QA against the reference screens; component code never hard-codes hex values (`AP-COLOR-01`).

## 10. Quick self-check (hierarchy)

```text
□ One focal point per surface; chrome subordinate to the device preview?
□ Weight tracks importance (no large-but-muted elements)?
□ Surfaces from the named token levels only?
□ Borders only at real region boundaries; one separator token?
□ ≤3 shadow tokens, only on floating content?
□ One radius scale; no scattered radii/pills?
□ One type scale; ≥10 px minimum; no decorative type treatment?
□ Accent ≤1 dominant element per region; selection/focus/error distinct?
□ One glyph per concept?
□ All colors via semantic tokens; contrast measured, not estimated?
```

Failing any check maps to audit dimensions D3/D7/D8/D9/D16.
