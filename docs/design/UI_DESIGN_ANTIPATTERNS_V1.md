# Template Designer — UI Design Anti-Pattern Library V1

**Status:** Canonical anti-pattern layer of the UI Design Intelligence System (Layer 7).
**Purpose:** A detection-and-correction catalog for UI defects — with special attention to defects that AI systems statistically over-produce. Used by the UI Designer, Implementer, Auditor, and Visual QA agents; findings must cite anti-pattern IDs.
**Evidence:** Where marked `[audit]`, the pattern was actually observed in this repository's audit history (`DEEPSEEK_UI_UX_AUDIT.md`, `DEEPSEEK_FUNCTIONAL_AUDIT.md`, `DEEPSEEK_E2E_INTEGRATION_AUDIT.md`). These are failure evidence, not permission to repeat them.

Every entry provides the five required fields:

```text
Problem            What the defect is
Why AI produces it Why this defect is disproportionately machine-generated
Why it is harmful  Concrete product impact
How to detect it   Measurable/observable check
Preferred alternative What to do instead
```

## A. Visual-style anti-patterns

### AP-CARD-01 — Cardification
- **Problem:** Every logical group becomes a rounded, elevated "card" with a title and padding.
- **Why AI produces it:** Card grids are the dominant pattern in AI training data for dashboards and marketing pages.
- **Why it is harmful:** In a dense professional editor, cards waste vertical space, inflate scroll depth, and produce the "generic SaaS admin" character the product explicitly rejects (`UI_DESIGN_SYSTEM_V2.md` §22).
- **How to detect it:** Count surfaces rendered as elevated cards inside other panels; if a Properties group or Explorer row is a card, it's a violation.
- **Preferred alternative:** Flat panel surfaces separated by `border-subtle` and spacing; one group = one section header, not one card.

### AP-BORDER-01 — Excessive borders
- **Problem:** Borders around every control, cell, and group (grid-of-boxes look).
- **Why AI produces it:** "Structure" is cheap to express with boxes; AI reaches for explicit boundaries instead of alignment and whitespace.
- **Why it is harmful:** Visual noise multiplies with density; hierarchy flattens because everything is equally framed.
- **How to detect it:** Look for nested rectangles: a border inside a border inside a border. Rule: a border must separate two *different* visual regions.
- **Preferred alternative:** 1 px `border-subtle` only at real region boundaries; whitespace and background tone do the rest (`UI_DESIGN_PRINCIPLES_V1.md` §7.2).

### AP-SHADOW-01 — Excessive shadows
- **Problem:** Drop shadows on static panels, buttons, and rows.
- **Why AI produces it:** Elevation/glow styling is over-represented in generated CSS.
- **Why it is harmful:** Shadows on non-floating content blur edges and conflict with the thin-border technical language.
- **How to detect it:** Count shadow declarations; any shadow outside menus/floating panels/dialogs is a violation. [audit: 6 raw shadows found where 3 named tokens should exist]
- **Preferred alternative:** Max 3 elevation tokens (`shadow-panel`, `shadow-floating`, `shadow-dialog`) used only for genuinely floating content.

### AP-RADIUS-01 — Excessive radius
- **Problem:** Large or mixed corner radii (0/50%/7/14 px scattered) [audit: VC-06].
- **Why AI produces it:** Rounded "friendly" styling is the AI default; radius is treated as decoration rather than a system token.
- **Why it is harmful:** Mixed radii break the mechanical, precise character; pills on function buttons look like marketing components.
- **How to detect it:** Inventory all `border-radius` values; more than the defined token set = violation.
- **Preferred alternative:** One low radius per level from the token scale; pills only where the system defines a badge/avatar shape.

### AP-GRADIENT-01 — Excessive gradients
- **Problem:** Decorative background/border/button gradients.
- **Why AI produces it:** Gradients are the cheapest "polish" in generated CSS.
- **Why it is harmful:** Canonical visual language is flat neutral surfaces; gradients read as web/marketing styling and fight the CAD/IDE character.
- **How to detect it:** Search for `gradient(` outside explicitly approved cases (none currently approved in the canonical system).
- **Preferred alternative:** Flat semantic surfaces. (The device preview itself may show device content, which is content — not chrome gradient.)

### AP-GLASS-01 — Glassmorphism
- **Problem:** Translucent blurred surfaces ("frosted glass").
- **Why AI produces it:** Trendy training data; reads as modern to an LLM.
- **Why it is harmful:** Canonical spec explicitly rejects glassmorphism (`UI_DESIGN_SYSTEM_V2.md` §22); blur hurts text legibility and adds GPU cost in long sessions.
- **How to detect it:** `backdrop-filter`/`blur()` plus translucency on chrome surfaces.
- **Preferred alternative:** Opaque panel surfaces with tone/border separation.

### AP-GLOW-01 — Glow effects
- **Problem:** Outer glows, neon halos, colored shadows on selection/status.
- **Why AI produces it:** "Make it pop" translation into CSS.
- **Why it is harmful:** Glows bleed into neighboring content, destroy precision perception, and compete with the restrained accent economy.
- **How to detect it:** `box-shadow` with same-color large blur, or `text-shadow` outside the device-preview content.
- **Preferred alternative:** Crisp 1–2 px outlines in the accent/selection family.

### AP-ACCENT-01 — Accent overuse
- **Problem:** Accent color on borders, icons, headings, backgrounds, and microcopy simultaneously. [audit: 8 raw accent-family values drifting outside tokens]
- **Why AI produces it:** Accent is AI's default way to signal "designed".
- **Why it is harmful:** When everything is accent, nothing is; selection and action lose their meaning; the canonical "restrained teal/cyan" contract breaks.
- **How to detect it:** In any region, count accent-colored elements; >1 dominant accent element per local region = violation.
- **Preferred alternative:** Accent only for action, selection, focus, and active state; one derived hover/muted variant each.

### AP-BADGE-01 — Badge inflation
- **Problem:** Numeric/dot badges on everything (tabs, panels, icons).
- **Why AI produces it:** Badge components are ubiquitous in training data.
- **Why it is harmful:** Attention markers that carry no real meaning train users to ignore all badges — including the ones that matter (dirty, validation errors).
- **How to detect it:** For every badge, ask: what canonical state does it represent? If none, remove.
- **Preferred alternative:** Badges only for canonical signals (dirty, error count, used-by asset indicator) — one visual family, honest data.

### AP-PILL-01 — Pill inflation
- **Problem:** Pill-shaped chips/tags/buttons everywhere.
- **Why AI produces it:** Pills are the AI's default "modern" shape vocabulary.
- **Why it is harmful:** Pills fragment the geometry of a dense editor; they fight the low-radius token scale.
- **How to detect it:** Count pill-shaped (fully rounded) controls outside approved badge shapes.
- **Preferred alternative:** Rectangular compact controls on the shared radius token.

### AP-TYPE-01 — Oversized typography
- **Problem:** Hero-sized headings, oversized empty-state text, display fonts.
- **Why AI produces it:** Landing-page patterns dominate AI aesthetics; big type feels "confident".
- **Why it is harmful:** Wastes vertical space in a density-first editor; violates the type scale; looks like a website, not a workstation.
- **How to detect it:** Any font size not on the token scale, or a heading taller than two control rows.
- **Preferred alternative:** Compact type scale; hierarchy by weight/color within the scale.

### AP-TYPE-02 — Arbitrary typography values
- **Problem:** Ad hoc font sizes/weights/line-heights per surface. [audit: 11 raw font sizes measured]
- **Why AI produces it:** Each surface is generated independently; the model doesn't hold the scale constant across turns.
- **Why it is harmful:** Cross-surface inconsistency; QA matrix explodes; long-session reading rhythm breaks.
- **How to detect it:** Extract all font declarations and diff against the token scale.
- **Preferred alternative:** Semantic type tokens (`text-primary`/size role tokens); one scale for the whole application.

### AP-SPACE-01 — Arbitrary spacing
- **Problem:** Per-surface gaps, paddings, row heights (3/6/10/18 px, rows 29/33/43 px). [audit: SP-04, SP-06]
- **Why AI produces it:** AI fits each screen locally without a shared scale.
- **Why it is harmful:** The shell loses its rhythm; panels that should feel identical feel different; alignment defects cascade.
- **How to detect it:** Inventory gap/padding/height values; anything off the 4/8 scale (or its named tokens) = violation.
- **Preferred alternative:** Named spacing tokens on the 4/8 rhythm; one row height, one header height, one tab height.

### AP-WHITE-01 — Excessive whitespace
- **Problem:** Half-empty panels, oversized padding "for breathing room".
- **Why AI produces it:** Marketing layouts bias toward negative space.
- **Why it is harmful:** In an engineering editor, whitespace pushes content below the fold and wastes the user's screen; the canonical character is dense but breathable, not sparse.
- **How to detect it:** Measure content density vs reference screens at the same window size; a panel whose content fits in half its area is a warning.
- **Preferred alternative:** Compact density with the 4/8 rhythm; breathing room comes from rhythm, not emptiness.

### AP-COLOR-01 — Arbitrary colors
- **Problem:** Raw hex values in components bypassing tokens. [audit: VC-01 — ~15 additional raw surface colors]
- **Why AI produces it:** LLMs generate concrete hex values per component instead of referencing a token layer.
- **Why it is harmful:** Token governance collapses; contrast and calibration cannot be fixed centrally; theme coherence rots silently.
- **How to detect it:** Search component code for hex/rgb/rgba literals outside the token definition file.
- **Preferred alternative:** Semantic tokens only (`UI_DESIGN_PRINCIPLES_V1.md` §11); raw values live exclusively in the token layer.

### AP-ICON-01 — Excessive icons
- **Problem:** Icons on every label, button, and row.
- **Why AI produces it:** Icons substitute for reasoning about hierarchy.
- **Why it is harmful:** Icon noise buries the few icons that carry meaning (warning, error, validation).
- **How to detect it:** For each icon: does it encode state or action that text doesn't already carry? If redundant, remove.
- **Preferred alternative:** Icons for state and high-frequency actions; text for the rest.

### AP-ICON-02 — Icon inconsistency / glyph soup
- **Problem:** Different glyphs for one concept, or ad hoc Unicode glyphs as icons. [audit: IC-01, IC-02]
- **Why AI produces it:** Each generation picks its own emoji/unicode; no icon asset exists yet, so AI improvises.
- **Why it is harmful:** Same concept rendered differently across surfaces breaks recognition and looks unprofessional.
- **How to detect it:** Collect all icon usages per concept; >1 glyph per concept = violation.
- **Preferred alternative:** One icon layer with one glyph per concept and size tokens (implemented when the icon asset system lands).

## B. Component and CSS anti-patterns

### AP-COMPONENT-01 — One-off CSS
- **Problem:** Per-surface bespoke styles instead of shared component recipes.
- **Why AI produces it:** It's easier to style locally than to find and extend the existing recipe.
- **Why it is harmful:** Every one-off doubles maintenance; the "same" control diverges across surfaces.
- **How to detect it:** Search for repeated selector families that duplicate a base recipe with small deltas.
- **Preferred alternative:** One base per control family + named variants; a new variant is a decision, not a shortcut.

### AP-COMPONENT-02 — Inconsistent component families
- **Problem:** Same concept, different anatomy across surfaces (e.g., several button recipes, three focus treatments). [audit: VC-03, VC-04]
- **Why AI produces it:** Components are regenerated per task without a shared inventory.
- **Why it is harmful:** Users can't build muscle memory; focus/disabled/selected semantics become ambiguous.
- **How to detect it:** Component inventory diff: name → implementations; >1 = violation.
- **Preferred alternative:** Shared primitives; variant matrix documented once.

### AP-COMPONENT-03 — Decorative UI / fake controls (state-honesty violation)
- **Problem:** Visible controls with no real behavior: dead buttons, fake toggles, status indicators not bound to state. [audit: C-02 fake Save; SF-02 label-only Preview mode; SF-03 inert Run/Pause/Step; GL-04 LED not derived from validation; INT-11 dead `showGrid` setting; TB-01/02 Align/Lock unimplemented]
- **Why AI produces it:** The UI is generated to "look complete" faster than the behavior exists; the screenshot is optimized, not the product.
- **Why it is harmful:** **This is the most severe anti-pattern in this system.** It breaks the product's trust contract (AGENTS.md), misleads users into destructive decisions, and is a hard FAIL gate in evaluation (G2/G4).
- **How to detect it:** For every visible control, trace its handler to a real command/use case and its state to canonical state. Any control whose trace ends in a no-op, a comment, or local-only state = violation.
- **Preferred alternative:** Implement the real behavior, or disable with an honest reason, or hide. Never decorate.

### AP-COMPONENT-04 — Screenshot optimization
- **Problem:** Layout/typography tuned to look good in one screenshot at the cost of real usage (e.g., huge preview pane, truncated tables).
- **Why AI produces it:** AI optimizes for the artifact it will be shown (the screenshot), not the user's workflow.
- **Why it is harmful:** The product is a working editor, not a portfolio image; demo-optimized UIs fail at task completion.
- **How to detect it:** Exercise the surface at realistic window sizes with real data; compare to the canonical interaction contract.
- **Preferred alternative:** Design for states and flows first; verify with populated fixtures; screenshot only as evidence, never as the goal.

### AP-COMPONENT-05 — Generic SaaS dashboard aesthetics
- **Problem:** The whole application drifts toward admin-panel patterns (cards, widgets, sparklines, hero headers).
- **Why AI produces it:** The dominant AI aesthetic is the SaaS dashboard.
- **Why it is harmful:** Directly violates the canonical product character (`UI_DESIGN_SYSTEM_V2.md` §1/§22).
- **How to detect it:** The "elevator test": does this surface look like an engineering tool or a metrics website? Reference screens decide.
- **Preferred alternative:** The IDE/CAD vocabulary: toolbars, dockable panels, inspectors, console, status bar.

## C. State and architecture anti-patterns

### AP-STATE-01 — State-honesty violations
- **Problem:** UI claims a state the canonical state doesn't have ("Saved" without persistence, "Verified" before verification, dirty dot when clean, enabled buttons that silently no-op). [audit: INT-01, INT-05, INT-10, INT-68]
- **Why AI produces it:** LLMs mirror the *wording* of the requested UI without wiring the *truth* behind it.
- **Why it is harmful:** Users act on false information (data loss, premature deployment claims); hard FAIL gates G2/G4.
- **How to detect it:** Assert every status label against the canonical state registry (`docs/RUNTIME_STATE_REGISTRY.md`) and DocumentStore/dirty comparison.
- **Preferred alternative:** Derive all visible state from canonical sources; disabled-with-reason or hidden when unavailable.

### AP-STATE-02 — Duplicated state
- **Problem:** UI-local copies of canonical state that diverge (second stores, hard-coded registries, stale snapshots). [audit: INT-04 one store vs N tabs; INT-08 stale simulator state; INT-22 hard-coded activation order]
- **Why AI produces it:** Local state is the path of least resistance; AI avoids touching the canonical pipeline.
- **Why it is harmful:** Divergence produces exactly the lying UI that audits keep finding; fixes in one place don't propagate.
- **How to detect it:** Search for duplicated domain structures in component state; any React state holding project-model clones = violation.
- **Preferred alternative:** Single source of truth: `UI Event → Application Command → Canonical State → Selector → UI` (corrections §3); transient editor state may exist only for interaction previews.

### AP-STATE-03 — Decorative affordances without behavior
- **Problem:** Handles, hover states, drag cues, or "interactive" styling on elements that do nothing.
- **Why AI produces it:** Visual affordance is generated by default with interactive-looking styles.
- **Why it is harmful:** Teaches users the UI lies; destroys the affordance vocabulary for the controls that do work.
- **How to detect it:** Style-first, handler-second review: any `:hover`/`cursor:pointer` without a real action = violation.
- **Preferred alternative:** Affordance = behavior (`UI_DESIGN_PRINCIPLES_V1.md` §13); add affordance only when the behavior lands.

### AP-ARCH-01 — Implementer redefines architecture silently
- **Problem:** The implementer changes panel structure, shell layout, or state flow "to make it work" without a recorded decision.
- **Why AI produces it:** Implementation pressure; the shortest path wins over the contract.
- **Why it is harmful:** The architect's/designer's approved decisions are silently voided; audits later find divergence no one authorized.
- **How to detect it:** Diff against the approved decision log and the canonical shell; any unrecorded structural delta = violation.
- **Preferred alternative:** Handoff model: implementer consumes approved decisions; any needed change is escalated and recorded in the decision log before code (see `UI_AGENT_ORGANIZATION.md`).

### AP-ARCH-02 — UI redesign without a correctness question
- **Problem:** Restyling surfaces that already work, without improving usability, hierarchy, consistency, discoverability, accessibility, density, or interaction clarity.
- **Why AI produces it:** AI defaults to "improve" = "restyle"; novelty is mistaken for progress.
- **Why it is harmful:** Churn risks regressions for zero user value; violates the redesign test (`UI_DESIGN_PRINCIPLES_V1.md` §18).
- **How to detect it:** Apply the seven-question redesign test to every proposed visual change; reject if all answers are NO.
- **Preferred alternative:** Fix measured defects; leave working surfaces alone.

## D. Usage rules

1. **Cite IDs.** Audit findings and review comments cite anti-pattern IDs (`AP-*`) so fixes and prevention rules stay traceable.
2. **Never fix an anti-pattern with another anti-pattern.** "Remove cards" must not become "add glowing buttons".
3. **Extend, don't fork.** New anti-patterns are appended with the five required fields and a unique ID; existing entries are never silently reworded (update via the decision log).
4. **Audit evidence is dated.** Patterns marked `[audit]` refer to findings at specific commits; re-verify before citing them against a new revision.

## References

- [`UI_DESIGN_PRINCIPLES_V1.md`](UI_DESIGN_PRINCIPLES_V1.md) — positive rules each entry's "preferred alternative" derives from
- [`UI_DESIGN_EVALUATION_V1.md`](UI_DESIGN_EVALUATION_V1.md) — severity/evidence labels and gates used when reporting
- [`../UI_DESIGN_SYSTEM_V2.md`](../UI_DESIGN_SYSTEM_V2.md) §22–§26, [`../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`](../UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md) — canonical visual/state rules
- [`../../DEEPSEEK_UI_UX_AUDIT.md`](../../DEEPSEEK_UI_UX_AUDIT.md), [`../../DEEPSEEK_FUNCTIONAL_AUDIT.md`](../../DEEPSEEK_FUNCTIONAL_AUDIT.md), [`../../DEEPSEEK_E2E_INTEGRATION_AUDIT.md`](../../DEEPSEEK_E2E_INTEGRATION_AUDIT.md) — `[audit]` evidence origin
- [`../../AGENTS.md`](../../AGENTS.md) — trust contract (state honesty, no fake core buttons)
