# Reference — Component Design (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_PRINCIPLES_V1.md` §7, §11, §12, §14. Canonical authority: `docs/UI_DESIGN_SYSTEM_V2.md` §23–§26; token governance in `UI_DESIGN_PRINCIPLES_V1.md` §11.

## 1. Component anatomy rule

Every recurring control family has exactly one base anatomy:

```text
base (one recipe)
 └── variants (deliberate, named, documented)
      └── states (normal, hover, active, focused, disabled, selected, error)
           └── sizes (named tokens; usually one per family)
```

- Six button recipes for one concept is a defect (`AP-COMPONENT-03`; audit VC-03); three focus treatments is a defect (audit VC-04).
- A new variant is a **decision** (decision-log entry), never a shortcut.
- Primitives hold reusable controls, not product business logic; product surfaces compose primitives and call application use cases (`docs/UI_UX_ARCHITECTURE.md` §29).

## 2. Token discipline

- Component code consumes **semantic tokens only**; raw values exist exclusively in the token definition layer.
- Canonical token families (§23): Surfaces, Borders, Text, Accent, Status, Canvas, Focus, Elevation — plus spacing, control-height, radius, and typography scales.
- Hard-coded device values are banned everywhere, including documentation (AGENT2 §4.1).
- Dead CSS: wire it or remove it; unreachable breakpoints and unused classes are removed with `git grep` proof of zero usages (audit VC-07, RS-06).

## 3. Control heights

- One named control-height token per family; common range 28–36 px (compact engineering density).
- Top-bar controls, toolbar buttons, and tab bars each use their single family token (audit TB-04, TB-11, SP-05).
- Hit targets for icon/tree/expander controls: ≥24 × 24 px (audit EX-07).

## 4. Required state design (every interactive surface)

Every surface defines at minimum these states (canonical §25), each with a distinct, honest treatment:

| State | Rule |
|---|---|
| Normal | Default surface; readable |
| Hover | Subtle emphasis; no layout jump |
| Active | Command/tab visibly running |
| Focused | `focus-ring`, distinct from selection |
| Disabled | Cannot act; reason shown when not obvious (opacity alone is not a design) |
| Selected | Clear, restrained accent |
| Error | Icon + text + source location + recovery action |
| Warning | Amber/neutral icon + explanation; never color-only |
| Empty | The single meaningful next action as a command |
| Loading | Operation scope visible; stale edits/selection safe; cancel/retry where meaningful |
| Unavailable | Capability/source missing; reason + alternative |
| Unsupported | Active profile does not support it; control hidden or explicitly marked |

Selected and pressed are different treatments; hover and selected are different treatments (audit TB-07).

## 5. State honesty wiring (non-negotiable)

- Every control's visible state derives from canonical state: DocumentStore/dirty comparison, validation service, command results, DeviceProfile capability — never local guesses.
- Disabled must carry a reason where non-obvious (`Not supported by active profile`, `Select an item first`); a permanently disabled control with no path to enable is a defect — implement, hide, or remove (audit TB-01/02, INT-50).
- Status indicators (LEDs, dots, chips) are bound to the real value or removed (audit GL-04, SF-10).
- Dirty dots follow the document's saved-vs-current comparison (audit GL-03, INT-05).

## 6. Inputs and editors

- Numeric fields: draft-per-field; commit on blur/Enter; empty ≠ 0 (audit PR-01, INT-52); no per-keystroke history flooding (audit INT-53 — coalescing is a future Core capability).
- Every field: label + unit + validation message in one accessible form relation (§24).
- Multi-select editing: common value shown normally, differing values as `*`; a value typed into `*` applies to all compatible selected objects (canonical §8).
- Read-only vs editable must be visually distinct (audit PR-04).

## 7. Empty / loading / error / unsupported (per surface)

Follow the canonical matrix (§26): each surface (Project Explorer, Canvas, Properties, Asset Browser, Simulator, Console, Validation/Publish, Settings, Deployment) defines its Empty, Loading, Error, and Recovery treatments.

- Empty state = next command (`Create/Open Project`, `Add Widget`, `Select an item`, `Choose a depot`, `Run Simulator`, `Validate to check readiness`) — never marketing text.
- Errors use **problem + reason + location + action**; validation issues navigate to the source location.
- Unresolved references (unknown state, removed asset, unknown floor value) stay visible as `Unresolved` and flow into Validation — never silently deleted (§11–§12).

## 8. Reusable microcopy

- Imperative, short, action-oriented. Technical detail goes to the Console, not into labels (§16).
- Examples: `Select an item to edit its properties`, `Insert the SD card and try again.`, `Deployment completed. You can safely remove the SD card.`

## 9. Quick self-check (components)

```text
□ One base recipe per control family; variants are documented decisions?
□ Tokens only; no raw values outside the token layer?
□ Heights/sizes from named tokens; hit targets ≥24×24 for icon/tree controls?
□ All 12 states designed per surface; selected/pressed/hover distinct?
□ Every visible status bound to canonical state?
□ Disabled always has a reason or is hidden?
□ Fields commit on blur/Enter; empty ≠ 0; no history flood?
□ Empty states are commands; errors carry problem/reason/location/action?
□ No dead CSS, dead classes, or unreachable styles?
```

Failing any check maps to audit dimensions D7–D12, D16 and possibly gates G2/G4.
