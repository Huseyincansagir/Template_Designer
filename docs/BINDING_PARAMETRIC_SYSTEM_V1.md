# Binding & Parametric System V1

## Core principle

Runtime data drives presentation. Binding is the mechanism that connects firmware-defined runtime state/value data to widgets, media, visibility, playback, and parameterized content.

```text
Firmware Runtime Data
        ↓
     Binding
        ↓
Widget / Media / Digit / Direction
        ↓
Visibility / Playback / Value / Media selection
```

## Widget-level binding

Digit and Direction widgets are binding-capable widgets just like Media widgets. Their binding can determine which media/style/variant is shown.

Examples:

```text
Direction == Up
→ show Up media/style

Direction == Down
→ show Down media/style

Floor == -2
→ use mapped floor representation P2
```

The binding model must therefore not be designed as a Media-only feature.

## Positive and negative bindings

Bindings may be expressed as:

- **Show/Activate when** — positive condition
- **Hide/Stop when** — negative condition

Negative bindings are important for mutually exclusive media. Example:

```text
Floor == 6
→ stop/hide generic floor animation
```

while another binding activates the floor-6-specific media.

## Condition model

Conditions support DeviceProfile-defined state/value types and operators. Multiple conditions can be combined with AND/OR and advanced expressions.

Examples:

```text
Floor == 6 AND Door == Opening
Floor == 6 AND Waiting == true
NOT Fire
```

The Designer must not invent runtime states. The DeviceProfile/firmware runtime registry is the source of truth.

## Floor representation / mapping editor

The firmware may provide floor data in different representations. Examples include:

```text
K
P
R
Z
F
-2
-1
0
1
2
...
```

A project may require a display mapping. Example:

```text
Runtime floor: -2
Display representation: P2
```

The Designer therefore needs a dedicated **Floor Mapping Editor** rather than forcing this transformation into generic text binding.

The editor should support at least:

```text
Firmware Value     Display Value
---------------------------------
-2                 P2
-1                 P1
 0                 G
 1                 1
 2                 2
 K                  K
 R                  R
 Z                  Z
```

The exact supported runtime values come from the DeviceProfile. The mapping is a presentation/configuration rule and must be exportable in a deterministic firmware-readable form.

## Floor / Digit / Direction bindings

Floor/Digit and Direction widgets participate in the same binding framework as media widgets.

Examples:

```text
Floor == -2
→ Digit representation P2
→ select corresponding digit/style media
```

```text
Direction == Up
→ select Up style/media
```

A floor/digit widget can also use bindings to control associated media behavior.

## Parametric text

The Designer may expose parameter substitution such as:

```text
{FloorNumber}
```

and localized text may combine language selection with parameter substitution:

```text
TR: {FloorNumber}. Kat
EN: Floor {FloorNumber}
```

Runtime states, template parameters and external data sources remain distinct concepts.

## External data / CSV

The architecture should allow future parameter sources such as CSV-backed resident/contact data, e.g. a conceptual `{residents}` parameter. This is not required to be implemented in the first binding iteration; the binding model should remain extensible enough to support it later.

## Binding actions

Actions are type-dependent. Image-like widgets primarily use visibility/selection. Media widgets may support:

```text
Show
Hide
Play
Pause
Stop
Restart
Continue
```

Generic arbitrary runtime mutation of every widget property is not assumed.

## Scene + Widget binding

Scene activation determines which Scene is active. Widget binding is evaluated only within an active Scene.

```text
Scene condition
    ↓
Scene active
    ↓
Widget condition
    ↓
Widget action
```

Widget binding does not directly switch Scenes. Scene selection remains governed by Scene conditions and Scene priority.

## Media continuation

When a Scene changes and a Media Widget is replaced:

- If the new media has incompatible size/playback characteristics, the previous media is cut and the new media starts.
- If the user enables the optional **Continue/Retain Playback** behavior and the relevant size/playback parameters are compatible, the new Scene's media widget may continue the previous media's playback position/audio while using the new Scene's position/layout.

This is an optional runtime behavior, not an implicit guarantee.

## Binding preview / simulator

The Simulator exposes a dockable Runtime State panel. State values can be changed manually according to their DeviceProfile-defined type.

Binding evaluation should be visible in the Console, for example:

```text
[Binding] Floor == 6 → TRUE
[Binding] Door == Opening → TRUE
[Widget] Media_004 → PLAY
[Widget] Media_007 → HIDE
[Scene] Fire → ACTIVE
```

A `Test Binding` command may automatically construct the necessary simulator state context.

## Validation

Binding validation must detect at least:

- unknown/removed state,
- invalid datatype comparison,
- unsupported operator,
- invalid value,
- unresolved parameter,
- invalid floor mapping reference.

Invalid references must not be silently deleted. They remain explicitly marked as unresolved/unknown until the user fixes them.

## Future extension

The binding model is intentionally extensible toward:

- richer expressions,
- external data sources,
- reusable binding definitions,
- AI-generated binding expressions,
- parameterized media selection.

These are architectural extension points, not all mandatory first-release features.
