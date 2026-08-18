# Template Designer — UI Design Principles V1

**Status:** Canonical design-principles layer of the UI Design Intelligence System (Layer 1).
**Language note:** This document is written in English. Canonical documents it references are partly in Turkish; references use section numbers (`§`), which are stable across the translation.
**Scope:** This document defines *how to reason* about Template Designer UI. It does not redefine the canonical design system, domain model, or interaction contract. It does not prescribe application code changes and does not prescribe product features that the domain/runtime contract does not support.

## 1. Relationship to canonical documents

This layer is subordinate to the canonical sources. Reading order for any UI work, in precedence order:

| # | Canonical source | Role |
|---|---|---|
| 1 | `Template Designer — Ana Proje Geliştirme Promptu.md` | Authoritative V1 product specification |
| 2 | `AGENTS.md` (repository root) | Coding-agent contract; UI rules |
| 3 | `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md` | Domain/runtime contract (canonical) |
| 4 | `docs/DOMAIN_MODEL_V1.md` | Platform-neutral domain model |
| 5 | `docs/UI_DESIGN_SYSTEM_V2.md` | Canonical UI/UX design specification |
| 6 | `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` | Canonical corrections; wins over the main spec on conflict (§13) |
| 7 | `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` | Interaction contract for Canvas (locked V1 decisions, §7.2/§11) |
| 8 | `docs/BINDING_PARAMETRIC_SYSTEM_V1.md` | Binding & parametric system |
| 9 | `docs/UI_UX_ARCHITECTURE.md`, `docs/UI_UX_DECISIONS_V1.md` | UX architecture and early decisions |
| 10 | `docs/UI_REFERENCE.md` + supplied screenshots in `docs/*.png` | Visual reference (direction, not pixel spec) |
| 11 | `DEEPSEEK_UI_UX_AUDIT.md`, `DEEPSEEK_FUNCTIONAL_AUDIT.md`, `DEEPSEEK_E2E_INTEGRATION_AUDIT.md`, `AGENT4_INTEGRATION_REGRESSION_REPORT.md` | Historical audit evidence: principles input, not prescriptions |

## 2. Product character (visual north star)

Template Designer is a **professional Windows desktop visual editor**. Its UI must feel like a **professional visual editor + CAD workstation + IDE**, and must not feel like a marketing dashboard, a generic SaaS admin panel, or an AI-generated component showcase.

The supplied reference screens and the canonical documents establish:

- **Application Bar** — menu + context toolbar at top.
- **Document Tabs** — open Rotation/Form documents, editor-style.
- **Navigation / Project Explorer** — left hierarchical project navigation.
- **Central Canvas** — the device display, rendered at its logical aspect ratio, visually dominant.
- **Properties / Inspector** — right contextual inspector.
- **Console / Output** — bottom dock for command, validation, export and runtime traces.
- **Status Bar** — dirty state, validation summary, active form/scene, zoom, operation summary.
- **Chrome tone (resolved):** light neutral workspace around a dark device/display preview, with a restrained teal/cyan accent. This is the canonical direction (`docs/UI_REFERENCE.md`, `docs/UI_DESIGN_SYSTEM_V2.md` §22, `.agents/skills/ui-ux-system/SKILL.md`). Any draft that suggested dark application chrome is superseded; see decision `UI-D-0001`.
- **Character attributes:** professional, precise, calm, technical, dense but readable, spatially organized, consistent, trustworthy, long-session friendly.

**Canvas dominance rule.** The Editor chrome must remain visually subordinate to the designed Scene. The Canvas/device preview is the primary visual workspace. Panels support editing; they must never visually dominate the device preview. Chrome density is for work, not for decoration.

**Reference rule.** The mockup/screenshots are a visual reference only. Extract spatial structure, visual hierarchy, surface language, density, proportions, and editor character. Never copy example data, and never invent product functionality from a mockup.

## 3. Decision hierarchy (precedence)

When a design decision is needed, the higher tier always wins. A conflict between tiers is never resolved silently: report it per the conflict protocol.

| Tier | Authority | Typical source |
|---|---|---|
| 1 | Product requirements | `Template Designer — Ana Proje Geliştirme Promptu.md`, `AGENTS.md` |
| 2 | Domain/runtime contract | `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`, `docs/DOMAIN_MODEL_V1.md` |
| 3 | Interaction contract | `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md`, canonical corrections §8 |
| 4 | Accessibility | `docs/UI_DESIGN_SYSTEM_V2.md` §24, `docs/design/UI_DESIGN_EVALUATION_V1.md` |
| 5 | Information architecture | `docs/UI_UX_ARCHITECTURE.md`, `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md` |
| 6 | Canonical design system | `docs/UI_DESIGN_SYSTEM_V2.md` (+ corrections §13) |
| 7 | Spatial consistency | This document, §4 |
| 8 | Visual hierarchy | This document, §5 |
| 9 | Aesthetic preference | Last-resort, documented in the decision log |
| 10 | Decorative polish | Almost always rejected; see §12 |

**Non-negotiable corollary:** aesthetic preference may NEVER override correctness. A visually pleasing control that misrepresents application state, invents a capability, or violates canonical interaction behavior is a defect, not a design achievement.

**Conflict protocol.** If a canonical document and a proposal contradict: report `DOMAIN CONTRADICTION FOUND` (corrections §13), do not silently resolve it in UI code. If two canonical documents contradict, the corrections document wins for UI topics; otherwise escalate in the decision log rather than deciding locally.

## 4. Spatial architecture and spatial grammar

### 4.1 Application shell

- One stable shell across all workspaces (Home/Projects, Theme Library, Design Studio, Media/Resources, Test Studio/Simulator, Validation/Publish, Deployment, Settings).
- Tool windows (Project Explorer, Properties, Asset Browser, Simulator, Runtime State, Console/Output, Validation) are dockable, tabbable, splittable, collapsible, floatable, auto-hidable; see `docs/UI_DESIGN_SYSTEM_V2.md` §3.
- Docking never destroys existing content; dropping a panel onto another creates a tab stack in the same dock group. Invalid drop targets are visually rejected.
- Panel resize changes viewport and letterboxing; it never changes Widget geometry (canonical §6/§21).

### 4.2 Spatial grammar

- **Spacing rhythm:** 4/8-based scale (canonical §23). Arbitrary spacing values are forbidden; every gap, padding, and row height must derive from the scale or from a named token.
- **One value per recurring row type:** one list-row height, one panel-header height, one tab-bar height, one top-bar control height, one control height per control family. Ad hoc per-surface variants (e.g., 29/33/43 px rows, 52/63 px headers) are anti-pattern `AP-SPACE-01`.
- **Alignment:** every panel header, toolbar, tab, and property row sits on the same vertical rhythm. Labels, values, and controls align to a common grid; prefer edge alignment over centering for reading surfaces.
- **Optical alignment** corrects for glyph weight and icon bounding boxes (e.g., visually centering a glyph whose box is off-center); it must not be used to justify arbitrary offsets — record the correction in a comment or token.
- **Baseline alignment:** text rows share baselines across columns; mixed font sizes in one row are aligned by baseline, not by top edge.
- **Negative space:** whitespace separates functional regions. Excessive whitespace that pushes content out of the viewport is an anti-pattern (`AP-WHITE-01`). Dense but breathable, never sparse.

### 4.3 Information density

- Engineering-application density: compact controls, short labels, grouped properties, minimal redundant helper text.
- Common control heights 28–36 px depending on context; keep them within one or two named tokens.
- Density must remain readable for long sessions: no <10 px UI text, no sub-24 px primary hit targets (see §9).

### 4.4 Responsive behavior (desktop)

- Target realistic Windows desktop sizes. There is no phone/portrait viewport target.
- Narrowing the window: secondary labels shorten, panels collapse/tab/auto-hide; the Canvas keeps its aspect ratio and priority.
- Properties must not be squeezed below a usable width; collapse or auto-hide instead.
- Resize must never silently change runtime context or active Scene (canonical §21).

## 5. Visual hierarchy and visual weight

- **One focal point per surface.** In Design Studio the device preview is the focal point; in Deployment the target/package summary is. Chrome competes with content only when the content is the task.
- **Visual weight is earned by importance:** size, weight, color, and elevation must all increase together with importance. A large but low-contrast element is hierarchy noise.
- **Information hierarchy:** every surface must answer the six canonical questions (see §6.1) by hierarchy alone — without reading, a user should see where they are, what is selected, what is invalid, and what the next action is.
- **Suppression over decoration:** reduce visual weight of secondary content (muted text, subtle borders) rather than increasing decoration of primary content.
- **Restrained emphasis:** at most one accent-colored element should dominate a local region; multiple competing accents destroy hierarchy (`AP-ACCENT-01`).

## 6. Wayfinding and cognitive load

### 6.1 The six questions

Every major surface must make these answerable at a glance (`docs/UI_UX_ARCHITECTURE.md` §2):

```text
Where am I?      What am I editing?   What is selected?
What will change? What is invalid?    What happens next?
```

### 6.2 Cognitive load rules

- Progressive disclosure: basic controls visible; advanced controls in collapsible sections, Advanced sections, or contextual panels.
- Contextual complexity: show only what the current selection supports. Nothing selected → document/form properties; widget → that widget's real fields; Bounding Group → layout fields; multi-selection → common properties only.
- No redundant helper text that restates the label.
- Microcopy is imperative, short, and action-oriented; it tells the user what to do next, never marketing prose. Examples (canonical): `Add Widget`, `Select an item to edit its properties`, `Validate to check readiness`, `Insert the SD card and try again.`
- Technical detail belongs in the Console, not in user-facing microcopy (canonical §16).

## 7. Surface system

### 7.1 Surface hierarchy

- Named surface levels only: `app-bg` → `panel-bg` → `surface` → `surface-elevated` → floating/dialog surfaces (canonical token family §23). A new surface level requires a documented reason.
- The Canvas workspace and the device display surface are clearly tone-separated (light workspace / dark device surface).

### 7.2 Border strategy

- Thin (1 px) `border-subtle` borders are the default structural separator; `border-strong` marks interaction or hierarchy edges; splitters use the splitter token.
- Borders separate regions; they are not decorative frames. If a border does not separate two visual regions, remove it (`AP-BORDER-01`).

### 7.3 Elevation and shadow language

- Elevation is for genuine floating content: menus, floating panels, dialogs.
- Maximum three shadow tokens (`shadow-panel`, `shadow-floating`, `shadow-dialog`). No decorative drop shadows on static surfaces (`AP-SHADOW-01`).
- Separation is achieved by borders and tone first; shadows are the last resort.

### 7.4 Corner radius hierarchy

- Low, consistent radii: a small radius for controls and surfaces (0–4 px range; one token per level). No 50% pills except where a specific badge/avatar shape is defined by the system (`AP-RADIUS-01`).
- Radius tokens are part of the token layer; ad hoc radii (0/50%/7/14 px scattered) are forbidden.

## 8. Typography hierarchy

- **Type scale:** a named token scale (one size per level); the canonical system expects a compact but clear hierarchy. A maximum of ~5–6 sizes per surface family; ad hoc sizes are forbidden (`AP-TYPE-01`).
- **UI font:** a highly legible system UI font stack available on Windows. Firmware fonts are never used for application UI, and the UI font is never used for firmware Text widget content (canonical §23).
- **Minimum sizes:** 10 px minimum UI text; 12 px minimum for reading surfaces; status/console text never below 10 px.
- **Contrast:** text colors are semantic tokens; every pair must meet WCAG AA (4.5:1 normal text; 3:1 large text/UI components) on its actual background. `text-muted` is still readable text.
- **Weight and emphasis:** one strong per heading level; emphasis via weight or color, not both, not caps, not letter-spacing decoration.
- **Numeric legibility:** numeric fields must use a font with distinguishable digits (1/I/l, 0/O).

## 9. Color hierarchy and semantic colors

- **Neutral base.** Surfaces are neutral by default; color communicates meaning, never decoration.
- **Accent economy:** teal/cyan accent is reserved for action, selection, focus, and active states. One accent family; hover/muted variants are derived from it, not new hues (`AP-ACCENT-01`).
- **Semantic colors:** `success` (validated/complete), `warning` (attention required), `error` (blocking issue), `info` (neutral). State is never encoded by color alone — always pair with icon, text, or structure (canonical §24).
- **Selection** uses the accent family but never the same treatment as focus or error; focus ring is a distinct token (`focus-ring` / `keyboard-focus`).
- **Status colors on dark surfaces** (device preview overlays) are separate, calibrated pairs — never the light-surface tokens reused blindly.

## 10. Iconography

- One glyph per concept, one concept per glyph, across the whole application (`AP-ICON-01`).
- Icon-only controls require an accessible label and tooltip (canonical §24). If an icon is ambiguous without a tooltip, it needs a label.
- Icon size tokens (16/18/20 or equivalent named tokens); no per-control ad hoc sizes.
- Ad hoc Unicode glyph substitution for icons is an anti-pattern (`AP-ICON-02`).

## 11. Design token governance (Layer 2 rules)

The canonical token families are defined in `docs/UI_DESIGN_SYSTEM_V2.md` §23 (Surfaces, Borders, Text, Accent, Status, Canvas, Focus, Elevation). This system adds governance:

1. **Semantic-first.** Component code consumes semantic tokens only. Raw values may exist exclusively inside the token definition layer.
2. **No scattered constants.** Hard-coded colors, spacing, radii, heights, shadows, or font sizes in components are violations, regardless of whether the value happens to match a token (`AP-TOKEN-01`).
3. **One token per role.** One radius scale, one border scale, one elevation scale, one spacing scale, one type scale. Merging two roles into one token or splitting one role into many is a governance decision recorded in the decision log.
4. **Device values are never hard-coded.** No display resolution (e.g., `720 × 1280`), decode limit, or profile capability may be hard-coded anywhere, including documentation (AGENT2 §4.1).
5. **Calibration is a QA activity.** Exact color values are calibrated during Windows contrast QA against the reference screens; designers propose token *roles*, not arbitrary hex values.
6. **Token additions require a documented reason** (recorded in the decision log): a token exists because a role exists, not because a screen needed a value.
7. **Component rules live with the components.** Recurring controls get one base recipe with variants (one button base, one input base, one row base); six button recipes for one concept is a defect (`AP-COMPONENT-03`).

## 12. State design and State Honesty (first-class principle)

### 12.1 Truthfulness rule

Every visible control must truthfully represent the canonical application/domain state. The UI may render *less* than the state contains, never *more*, and never *different*.

A visible control must honestly represent at least these facets where applicable:

```text
availability   active state   selected state   disabled state
saved state    dirty state    running state    error state    loading state
```

### 12.2 State honesty rules

1. **No fake controls.** Never create a visual affordance for functionality that does not exist. If a feature is unavailable: disable it honestly (with a reason) OR hide it. Never leave decorative controls (`AP-FAKE-01`). Historical, audit-verified examples of this violation: Save that persists nothing; `Run/Pause/Step` inert toggles; settings whose consumers are unwired; shortcut hints for unbound keys; a status LED not derived from real validation state.
2. **Single source of truth.** Editor, Preview, Simulator, Validation, and Deployment derive from the same canonical project model; a React component never owns canonical state (`docs/UI_DESIGN_SYSTEM_V2.md` §1, corrections §3).
3. **Transient ≠ canonical.** Transient editor state (drag preview, marquee, hover, snap guides) is preview-only, cleared on every exit path, and never read back as a commit source (AGENT2 §4.13).
4. **Unavailable vs unsupported.** Profile-unsupported capability: hide the control or mark it explicitly (`Not supported by active profile`). Missing asset/source: mark `Unresolved` and route to Validation; never silently delete (canonical §8/§11).
5. **Disabled with reason.** Disabled controls explain why where the reason is not obvious; opacity alone is not a disabled-state design (`AP-STATE-01`).
6. **Empty states are commands, not marketing.** An empty state shows the single meaningful next action (canonical §25).
7. **Loading states scope the operation.** Show what is loading and offer cancel/retry where meaningful; stale edits and selection are handled safely during loading.
8. **Errors use problem + reason + location + action** (canonical §26). `Invalid` alone is never enough.
9. **Deployment honesty.** Success is never announced before verification completes (AGENTS.md; canonical §16/§26): `Preparing → Writing → Verifying → Completed / Safe to remove`.
10. **Dirty state.** The dirty indicator follows the document's real saved-vs-current comparison, not a local guess.

### 12.3 Cross-surface synchronization

Selection, active document, active Scene, dirty state, and validation results must agree across Project Explorer, Canvas, Properties, Document Tabs, and Status Bar. When two surfaces show the same entity, they show the same truth; divergence is a defect (`AP-SYNC-01`).

## 13. Affordance, feedback, focus, keyboard, hit targets

- **Affordance = behavior.** An element looks interactive only if it is; interactive elements must look interactive. Decorative affordances that do not correspond to real behavior are banned (`AP-AFFORD-01`).
- **Signifiers:** hover, active, selected, and disabled states are distinct treatments; a pressed state differs from a selected state.
- **Feedback:** every mutation produces visible feedback (selection, outline, Console trace, dirty state, validation). Feedback is immediate and proportional; no notification spam.
- **Focus:** all surfaces in canonical §24 are keyboard-focusable; focus ring is visible, distinct from selection, and consistent (one `focus-ring` treatment).
- **Keyboard UX:** the canonical shortcut table (`docs/UI_DESIGN_SYSTEM_V2.md` §19, corrections §8, AGENT2 §4.12) is registry-owned with conflict detection, text-input focus exclusion, platform-exact `Mod` normalization, and exact-modifier matching. Canvas keyboard math: Arrow = snap-grid; `Ctrl+Arrow` = grid ÷ 10; `Shift+Ctrl+Arrow` = grid × 5; `Shift+Arrow` = none; `R` = 90° clockwise during transform (confirmed product feature; not yet implemented in Canvas foundation V1); `Ctrl+D` PROPOSED and unbound.
- **Hit targets:** ≥ 24 × 24 px for icon/tree/expander controls; controls never shrink below their family token; precision editing surfaces (Canvas) keep pointer precision while chrome targets stay generous.
- **Pointer/Cancel semantics:** primary button starts interactions; 4 CSS px drag threshold; Escape/pointercancel/lost capture/blur/Scene switch/unmount cancel with zero history and exact restore (AGENT2 §4.3/§4.13).

## 14. Progressive disclosure and required state vocabulary

- Progressive disclosure over permanent complexity: collapsible sections, Advanced sections, contextual panels. Do not move every action into one inspector.
- Every interactive surface must define at minimum: Normal, Hover, Active, Focused, Disabled, Selected, Error, Warning, Empty, Loading, Unavailable, Unsupported (canonical §25).
- Dialog policy: dialogs only for genuinely interrupting decisions (destructive delete, overwrite, external target selection, unrecoverable validation/deployment errors); inline panels/popovers for ordinary configuration (canonical §18).
- Settings is a single blocking modal dialog: Cancel discards, `Save / Apply & Close` commits; backdrop clicks do not activate the main app (canonical §17, corrections §2).

## 15. Selection language and cross-surface synchronization

- Single selection: full contextual properties, bounds, applicable handles.
- Multi-selection: only common editable properties; differing values shown as `*`; a value typed into `*` applies to all compatible selected objects (canonical §7/§8).
- Selection is transient UI state; it never mutates the document and never creates history (AGENT2 §4.6).
- Selection ordering is active-Scene document order; a transient primary/anchor widget exists for future alignment/distribution hooks (AGENT2 §4.6).
- Locked widgets: selectable, properties readable, geometry mutation disabled. Invisible widgets: not rendered, not Canvas-hit-testable, still selectable via Explorer and selection bounds (canonical §7, AGENT2 §4.7).
- Bounding Group is a canonical geometry/layout relationship, not "editor grouping"; the two must never share a label (canonical §7).

## 16. Motion and reduced motion

- Motion is functional only: panel open/close, selection feedback, progress, transient status. No continuous pulse, no decorative floating effects, no canvas-moving animation (canonical §22).
- Transitions are short and subtle (≤ ~200 ms; a named motion token).
- `prefers-reduced-motion` must disable or minimize all non-essential motion.
- Media playback in previews is real media control, not decoration.

## 17. Editor chrome vs content

- Chrome is scaffolding for the designed Scene; it must never out-visual the content.
- Canvas chrome (selection outlines, handles, guides, marquee) is temporary, low-opacity where appropriate, and never competes with the device preview. Grid visibility is independent from snap enablement (canonical §22).
- Overlay guides use shape/tag in addition to color where color alone would be ambiguous (grid vs edge vs center).

## 18. Safety rule: the redesign test

The UI system must never become an excuse for unnecessary redesign. Before recommending or accepting any visual change, the responsible agent must answer:

```text
Does this change improve at least one of:
  usability?        hierarchy?       consistency?
  discoverability?  accessibility?   information density?
  interaction clarity?
```

If the answer is NO to all seven, the change is probably decorative and must be rejected — regardless of how much better it "looks". This rule applies to agents and humans alike, and applies to audit findings as well: an audit must not recommend restyling just because a surface differs from personal taste.

## References

- [`../UI_DESIGN_SYSTEM_V2.md`](../UI_DESIGN_SYSTEM_V2.md) — canonical UI/UX design specification
- [`../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`](../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md) — canonical corrections (wins on conflict)
- [`../UI_REFERENCE.md`](../UI_REFERENCE.md) + supplied screenshots in `../` — visual reference
- [`../DOMAIN_MODEL_V1.md`](../DOMAIN_MODEL_V1.md), [`../DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`](../DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md) — domain/runtime contract
- [`../AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md`](../AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md) — Canvas interaction contract
- [`../BINDING_PARAMETRIC_SYSTEM_V1.md`](../BINDING_PARAMETRIC_SYSTEM_V1.md) — binding & parametric system
- [`../UI_UX_ARCHITECTURE.md`](../UI_UX_ARCHITECTURE.md), [`../UI_UX_DECISIONS_V1.md`](../UI_UX_DECISIONS_V1.md) — UX architecture / early decisions
- [`../../AGENTS.md`](../../AGENTS.md), [product prompt](<../../Template Designer — Ana Proje Geliştirme Promptu.md>) — product/agent contract
- [`../../.agents/skills/ui-ux-system/SKILL.md`](../../.agents/skills/ui-ux-system/SKILL.md) — product UI/UX system skill
- [`../../DEEPSEEK_UI_UX_AUDIT.md`](../../DEEPSEEK_UI_UX_AUDIT.md), [`../../DEEPSEEK_FUNCTIONAL_AUDIT.md`](../../DEEPSEEK_FUNCTIONAL_AUDIT.md), [`../../DEEPSEEK_E2E_INTEGRATION_AUDIT.md`](../../DEEPSEEK_E2E_INTEGRATION_AUDIT.md) — audit evidence
- [`UI_DESIGN_ANTIPATTERNS_V1.md`](UI_DESIGN_ANTIPATTERNS_V1.md), [`UI_DESIGN_EVALUATION_V1.md`](UI_DESIGN_EVALUATION_V1.md), [`UI_DESIGN_DECISION_LOG.md`](UI_DESIGN_DECISION_LOG.md), [`UI_DESIGN_WORKFLOWS_V1.md`](UI_DESIGN_WORKFLOWS_V1.md) — sibling layers of this system
