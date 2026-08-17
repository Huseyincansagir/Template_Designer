# Template Designer — Agent Instructions

## Mission

Build a production-oriented Windows desktop Template Designer for the STM32H747I-DISCO elevator display project. The application is a real product, not a mockup. It must turn a canonical ThemeProject into a validated firmware-compatible SD-card publish package.

## Source of truth

1. `Template Designer Widget ve Tema Sözleşmesi.md` is the primary product/data/firmware contract when present in the repository.
2. Provided design references/screenshots are the visual and UX reference.
3. Existing repository code is authoritative for already-implemented behavior unless it conflicts with the contract; conflicts must be surfaced and resolved deliberately, never silently.

Do not invent firmware behavior that is not supported by the contract.

## Architecture principles

- Domain-first architecture.
- Keep editor, preview, test, validation, and publish on the same canonical `ThemeProject` model.
- Keep firmware/package logic out of UI code.
- Use explicit export adapters between Designer concepts and firmware concepts.
- Treat firmware capability profiles as actual constraints, not cosmetic UI filters.
- Prefer typed models, immutable value objects where appropriate, commands, services, and dependency injection.
- Avoid global mutable state and hidden singleton coupling.

## Product invariants

A theme consists of:
- metadata
- target firmware profile
- four physical forms: `r0`, `r90`, `r180`, `r270`
- canonical scenes
- widgets
- styles
- media/assets
- audio
- fonts/glyphs
- language bindings
- test sequence
- validation/publish state

Canonical scenes:
- `yangin`
- `estop`
- `asiri_yuk`
- `servis_disi`
- `kapi_ac`
- `kapi_kapa`
- `seyir_yukari`
- `seyir_asagi`
- `bosta`

Alarm scenes must fail closed: `kat_no` and `ok` remain hidden unless explicitly enabled by an alarm-scene override.

All four forms must exist in a publishable project.

## Widget rules

Supported Designer widget concepts include:
- `background`
- `kat_no`
- `ok`
- `uyari`
- `logo`
- `saat`
- `kat_listesi`
- `video`
- `media_sequence`
- `kapı_animasyonu`
- `metin`
- `overlay`

Each widget should have a stable technical ID, type, name, enabled/locked state, layer, per-form geometry, scene visibility, optional scene overrides, style binding, media binding, and type-specific properties.

Do not expose technical fixed names such as `video1` to users. Users add generic `Video` widgets; the system generates unique IDs.

## Anchor rules

Support canvas/safe-area/widget anchors and 9-point alignment. Support dynamic `content` anchors only when the selected firmware profile allows them. Detect cycles, missing targets, invalid geometry, and unsupported profile capabilities.

## Media rules

Designer source files and firmware target files are distinct.

Where required by the selected profile, perform real conversion (for example video to MJPEG AVI and audio extraction/conversion to supported WAV). Do not claim a target exists merely because a source exists.

Conversion must be asynchronous/non-blocking and publish must wait for required targets to finish successfully.

## Validation rules

Validation must cover at least:
- theme ID consistency
- four-form completeness
- duplicate widget IDs
- invalid geometry
- out-of-bounds geometry where prohibited
- alarm fail-closed visibility
- warning/media asset bindings
- glyph completeness and digit limits
- anchor cycles/unknown targets
- media conversion state
- video slot limits
- media sequence bindings
- firmware capability compatibility
- required package files
- layout/config fields supported by the firmware contract

User-facing errors must be actionable and must not expose raw exceptions as the primary message.

## Firmware/package rules

Do not export fields that the firmware contract does not support merely because the Designer model contains them. In particular, do not emit `warn_x`, `warn_y`, `warn_w`, `warn_h` as if they were valid firmware layout fields when the contract says they have no firmware parser/layout counterpart.

The publish structure should follow the contract, including `config.txt`, `tN`, four forms, `layout.cfg`, `tema.cfg`, media/image/video/audio/font/data areas and Designer metadata files where applicable.

Do not silently overwrite global device settings such as `SOUND`, `VOLUME`, or `LANG` during theme export.

## UI/UX rules

Target a professional Windows engineering/design application: modern, restrained, technical, high information density without clutter.

Primary areas:
- Themes
- Design
- Test
- Publish
- Settings

Design Studio should support canvas zoom/pan, selection, resize, multi-selection, rulers, guides, alignment, distribution, layers, lock, duplicate, delete, undo/redo, keyboard shortcuts and a dynamic Properties inspector.

Use the supplied screenshots as UX references, not as a mandate to copy pixels. Improve usability where necessary while preserving the product's interaction model.

## Development rules

- Read the repository before making architectural changes.
- Make small, coherent commits.
- Keep builds green after each milestone.
- Add or update tests for domain/validation/export behavior.
- Never replace real functionality with fake buttons, placeholders, or `TODO` paths for core features.
- Do not rewrite unrelated files.
- Prefer incremental, reviewable changes.
- Keep documentation synchronized with behavior.

## Quality bar

The application should be able to create/open/edit/save a theme, modify all four forms, edit scenes/widget visibility, manage anchors, import and convert media, run a test sequence, validate the project, and generate a real firmware-compatible publish package from the same canonical project model.
