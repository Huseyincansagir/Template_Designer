# Product Decision Closure — V1

Four decisions were handed down to close open items in the V1 scope. This is the
record of what was decided, what it changed in the code, and — for the one that
stays open — what is still needed and from whom.

It exists because the specification documents contradict each other on all four
subjects (catalogued as C1–C16 and C10a–C10i in
`docs/completion-findings/D6-reachability-matrix.md`). Where a decision settles a
contradiction, this file is the authority; where it does not, the contradiction is
still live and named below.

---

## 1. Audio channel count — **OPEN**

**Status: firmware specification confirmation required.**

No channel count is assumed, and no channel, mixing or default-volume control is
exposed. `Settings ▸ Audio` states this in the product itself rather than leaving
a designer to infer it.

The conflict, verified:

| Source | Claim |
|--------|-------|
| `MEDIA_LAYERING_AUDIO_AND_FLOOR_CONTENT.md:149-155,179` | at least **three** channels modelled separately |
| `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:381-389` | **five** (Background Music / Media / Announcement / Video / External Audio) |
| `FIRMWARE_PRESENTATION_SETTINGS.md:28-29` | Announcement 70%, BGM **25%** |
| `FIRMWARE_PRESENTATION_SETTINGS.md:268-269` | Announcement 70%, BGM **20%** — same document |
| `TEMPLATE_SCHEMA_V1.md:362-364` | 80 / 20 / 60, and invents `video_audio_volume` the settings document never lists |
| `WIDGET_SYSTEM_QUESTIONNAIRE_V1.md:163-170` vs `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:339,355` | background-music override is per scene / is explicitly *not* per scene |

The seven `AudioCapabilities` fields on `DeviceProfile` remain declared and unread.
They are not removed, because the shape is the only concrete definition that
exists; they are simply not driving anything yet.

**What unblocks it:** one statement of the channel set and the default volumes,
plus where an override lives. Until then the only audio behaviour every document
agrees on is implemented: a Media Sequence may carry one attached audio asset.

---

## 2. Media Slide — **ORDERED MEDIA SEQUENCE**

A Media Slide is an ordered sequence that may mix Image and Video in any order:

```text
Media Slide
    Image
    Video
    Image
    Video
```

### Domain

`MediaSlideContent` changed from one asset to a sequence:

```ts
interface MediaSlideItem {
  id: Id;
  mediaType: VisualMediaType;   // image | video
  assetId: Id;
  duration: number;             // seconds, 0.1 precision
  loop?: boolean;
  repeatCount?: number;
}

interface MediaSlideContent {
  items: readonly MediaSlideItem[];   // ORDERED
  loop?: boolean;                     // loop the whole sequence
  repeatCount?: number;               // repeat the whole sequence
  audioAssetId?: Id;
  volume?: number;
  continuePlayback?: boolean;
}
```

Nothing beyond ordering, dwell time and repetition is implied. Cross-fades,
transitions and per-entry audio are **not** modelled, because no decision defines
them — `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:247,270` says a sequence has "its
own timeline/order rules" without stating them.

### Consequences

- **Validation** checks every entry (asset reference, declared type against the
  asset's actual type, duration precision, repeat count, duplicate entry ids) and
  reports `MEDIA_SLIDE_EMPTY` for a sequence that would play nothing.
- **Video decode slots** are counted per *slide*, not per entry: entries play one
  at a time, so a sequence containing five videos still needs one slot.
- **Export** walks every entry when collecting used assets.
- **Deleting an asset** drops the entries that referenced it and clears a slide
  left with none, so a deletion can never leave a dangling entry.
- **UI**: the media inspector has an append / reorder / per-entry duration /
  remove editor, plus sequence-level loop, repeat and attached audio.
- **Migration**: a legacy single-asset slide becomes a one-entry sequence,
  preserving duration, loop, repeat and audio.

---

## 3. Binding priority — **integer 0–15**

Sixteen levels, `0` through `15`, **independent of `Scene.priority`** (which
remains 0–10 and decides which Scene is active).

```ts
interface Binding {
  // ...
  priority?: number;   // 0..15; absent means the lowest level
}
```

- `MIN_BINDING_PRIORITY` / `MAX_BINDING_PRIORITY` are exported so no call site
  repeats the bounds.
- **Validation**: `BINDING_PRIORITY_INVALID` for a non-integer or out-of-range
  value, and its remediation says the two priorities are separate.
- **Runtime**: conflicting bindings on one widget resolve by priority descending,
  with document order as the tie-break. This is the substance of the decision —
  before it, the last binding in document order simply won.
- An absent priority is treated as the lowest level, so an unprioritised binding
  can never silently outrank an explicit one.
- **UI**: a level picker in the authoring form and on every binding card.

This resolves contradiction **C6** in favour of the three documents that specify
0–10 per-*event* priority (`MEDIA_LAYERING…:30-32`,
`TEMPLATE_DESIGNER_PRODUCT_CONTRACT_V2.md:221,828`) — with the range set to 0–15
by this decision — against the single document that denied per-binding priority
(`SCENE_DESIGNER_QUESTIONNAIRE_V1.md:185-191`), which is now superseded.

---

## 4. Floor identifiers — **symbolic Unicode strings**

A floor identifier is a symbolic string, never an enumeration.

- `A`–`Z` and digits work.
- `Restaurant`, `Park`, `Terminal`, `North`, `South` work **today**, with no
  domain change.
- Localized and Unicode identifiers, including Arabic, work today.

### Domain

```ts
type FloorIdentifier = string;

interface FloorMappingEntry {
  firmwareValue: FloorIdentifier;   // was PrimitiveValue
  displayValue: string;
  digitStyleId?: Id;
}
```

The `floor` runtime state changed from `type: "integer"` to `type: "string"`, with
operators `equals` / `not-equals` / `contains`. Numeric comparison was removed
because it is meaningless across a symbolic set: `Restaurant > 3` has no answer.

### Unicode safety

- Identifiers are compared and de-duplicated in **NFC**, so a composed and a
  decomposed spelling of the same identifier are one identifier rather than two
  that differ invisibly.
- **Both sides** of a condition are now coerced against the declared type. Before
  this, coercing only the runtime input left an authored `value: 6` unable to
  match a symbolic state spelled `"6"` — a silent non-match.
- No Arabic-specific UI was added, as instructed; the representation simply does
  not stand in the way.

### Consequences

- **Validation**: `FLOOR_IDENTIFIER_REQUIRED`, `FLOOR_DISPLAY_VALUE_REQUIRED` and
  NFC-based `DUPLICATE_FLOOR_MAPPING`.
- **Core**: `setThemeFloorMappings` is the canonical, undoable mutation.
- **UI**: a Floor Mapping editor on the Theme Project inspector — free-text
  identifier, display value, optional per-entry digit style. Free text, not a
  picker over a fixed alphabet, precisely because the set is open.
- **Migration**: a legacy numeric `firmwareValue` becomes its string spelling.

This resolves **C11** in favour of `FIRMWARE_PRESENTATION_SETTINGS.md:190` and
`DOMAIN_MODEL_V1.md:187` ("Sadece decimal integer değildir"), against
`RUNTIME_STATE_REGISTRY.md:301`, which declared `floor` an integer. The shipped
profiles previously declared the integer form, which is why symbolic floors were
unrepresentable in practice.

---

## Still open after this closure

These are **not** implementation gaps. Each needs a product decision, and each has
contradictory documentation recorded in the ledger:

| Item | Blocked on |
|------|-----------|
| Audio channels, default volumes, override location | Decision 1 above (three sources disagree, one with itself) |
| Sequence timeline semantics beyond order and dwell | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:247,270` states rules exist without stating them |
| Stable-ID composition and determinism | `WIDGET_SYSTEM_QUESTIONNAIRE_V1.md:191-219` vs `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:113-121`; `:456,504` records the ID model as explicitly undecided |
| Rotation placement in the schema | `SCENE_DESIGNER_QUESTIONNAIRE_V1.md:48` vs `TEMPLATE_SCHEMA_V1.md:73` — neither matches the shipped container model |
| Media format conversion / resize / crop | `MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md:494-496` puts it in a separate Format Tool outside V1 |
