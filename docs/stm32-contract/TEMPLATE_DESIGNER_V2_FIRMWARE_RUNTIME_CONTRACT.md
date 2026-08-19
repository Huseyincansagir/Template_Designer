# Template Designer V2 ↔ STM32 Runtime Contract

| Field | Value |
|---|---|
| Firmware repo | `C:\TouchGFXProjects\MyApplication_6` |
| Firmware baseline | `feb5f56c721ba87b6b35d96cb3945427faff2ad6` (`SAVAS-7-A12-sadelestirme`) |
| Designer repo | `C:\Users\b1601\Template_Designer` |
| Date | 2026-08-19 |
| Mode | Documentation only. Firmware C and Designer TS were not modified. |
| Status | Audit of current code. Shared *device* package is not implemented. |

Evidence rule: each claim cites a file/symbol. Uncertain items are **UNKNOWN** or **PRODUCT DECISION REQUIRED**.

---

# 1. Purpose

This document is the bridge:

```text
Template Designer V2
  → Template / Build Package
  → SD Card
  → STM32 firmware (MyApplication_6)
  → Runtime model
  → Renderer / audio / media
```

A firmware engineer must be able to answer: *what must STM32 receive?*  
A Designer engineer must be able to answer: *what must I generate so STM32 executes it?*

# 2. Scope

In scope: on-disk theme package, parsers, runtime (scene, widget pool, media, audio, glyphs), Designer V2 domain/export, compatibility, limits, validation ownership.

Out of scope for **ürün V1**: implementing the compiler in this audit, changing `sahne_yukle`, Wi-Fi/ESP32, inventing a 3- vs 5-channel audio mixer, Arabic shaping.

**Taşıma (kullanıcı 2026-08-19):** ürün **V1 = yalnız SD**. Ürün **V2 = SD + Wi-Fi**. V2’de SD kart **devre dışı bırakılmaz**. Aynı cihaz paketi her iki taşıma ile gider. Ayrıntı: `docs/planning/SURUM_TASIMA_V1_V2.md`. “Template Designer V2” = Tauri uygulama kod tabanı; ürün sürümü V2 (Wi-Fi) ile aynı şey değildir.

At this SHA the in-tree Qt writer (`tools/template_designer/`) is already **gone** (user deletion, commit `feb5f56`). Firmware still parses the **historical SD tree** (`tema.cfg` / `layout.cfg` / binaries). Designer V2 still emits a **logical JSON tree**. Those two trees are not the same format.

# 3. Canonical Architecture

## 3.1 Designer (authoring)

```text
Project
  └── ThemeProjectGroup[]     (design-time grouping)
        └── ThemeProject[]    (one installable theme)
              └── Rotation[4] (0 / 90 / 180 / 270)
                    └── Scene[]
                          └── Widget[]
                                └── Binding[]
```

Evidence: `Template_Designer/src/Domain/models.ts` (`Project` 274, `ThemeProjectGroup` 253, `ThemeProject` 243, `Rotation` 210, `Scene` 200, `Widget` 182, `Binding` 115).

## 3.2 Firmware (execution)

```text
0:/config.txt                 sd_config_read
0:/t<N>/                      sd_scan_templates  (N = 0..14)
    r<form>/layout.cfg        sd_load_template_layout
    r<form>/tema.cfg          sahne_yukle
    r<form>/img/              gorsel_yukle / sd_load_widget_image
    r<form>/video/            sd_query_avi_size (MJPG only)
    font/<ad>.raw+.cfg        glif_atlas_yukle
    audio/                    FON ring
    data/floors.csv           sd_floors_load
        ↓
tema_kaynagi → havuzUygula → havuzGorunurlukTazele
        ↓
TouchGFX + DMA2D + LTDC + DSI
audioTask  I2S1 44.1 kHz
videoTask  hardware JPEG
```

Evidence: `CM7/Core/Inc/sd_config.h` `SD_TEMPLATE_ROOT_FMT`, `sd_scan_templates` (`sd_config.c:169`), `sahne_yukle` (`sahne_motoru.c:197`), `tema_kaynak.h`.

## 3.3 Hardware (this board)

| Item | Value | Evidence |
|---|---|---|
| MCU | STM32H747XIH CM7+CM4 | `AGENTS.md` |
| Panel | 7" DSI 720×1280 portrait | `docs/architecture/01_architecture_overview.md` |
| Graphics | LTDC + DMA2D | same |
| Framebuffer | 720×1280 RGB565, does **not** rotate in hardware | `docs/depo/tema_yapisi.md:42-49` |
| Video | Hardware JPEG, MJPEG/AVI | `sd_query_avi_size` `sd_content_manager.c:502` |
| Audio | I2S1 + DMA, mix 44100 | `audio_player.c` `MIX_RATE` |
| Storage | SDMMC + FatFS | `sd_content_manager.c` |
| Field bus | USART1 ARKEL LOP 9600 9-bit | `AGENTS.md` |

JSON parser in `CM7/Core`: **none** (search at this SHA).

# 4. Project Hierarchy

## 4.1 Project

| | Designer V2 | Firmware today |
|---|---|---|
| Identity | `Project.id`, `name`, `schemaVersion: number` (`models.ts:274`) | No project object. Selected theme is `config.txt` `TEMPLATE=` + disk scan |
| Device | `deviceProfileId` + `deviceProfileVersion?` | Implicit: this H747 image |
| Package | `buildDeploymentPackage` → `manifest.json` (`export.ts:143`) | Optional `package.json` was Qt-side; firmware **does not** read it (`paket.py` doctrine: scan disk). Qt tree deleted at this SHA |

**Runtime-relevant:** theme slot `tN`, `ORIENTATION`, style/volume keys in `config.txt`. Project UUID is not used on the MCU.

## 4.2 ThemeProjectGroup

Designer-only folder in the editor (`models.ts:253`). Firmware has no group. **Do not serialize groups to the device.** Runtime selects `tN` folders independently (`sd_scan_templates`).

## 4.3 ThemeProject

Maps to `0:/t<N>/`.

| | Designer | Firmware |
|---|---|---|
| ID | UUID `ThemeProject.id` | Integer 0..14; 15 = VANILLA (`TEMPLATE_VANILLA`, `sd_config.h`) |
| Discovery | manifest `themeProjectIds` | `layout.cfg` **or** `img/` in the active form (`sd_config.c:179-186`) |
| Name | `ThemeProject.name` | Not required for draw; menu may use `proj.json` / `package.json` historically |

Compiler must assign UUID → `tN` (product: ask user at publish). Firmware never sees UUID.

# 5. Rotation Contract

Canonical angles: **R0, R90, R180, R270**.

Designer: `Rotation.angle` 0\|90\|180\|270; R90/R270 swap width/height (`factories.ts:89-92`). Four rotations are mandatory (`createThemeProject`).

Firmware:

- Framebuffer is **always** 720×1280. LTDC/DMA2D do not rotate (`tema_yapisi.md:42-49`).
- Form folders `r0/` `r90/` `r180/` `r270/`. Selection: `config.txt` `ORIENTATION=` + `sd_form_set` (`sd_config.h:82-83`).
- Side-mount assets **must be pre-rotated at package time**. If not: video plays sideways, logo garbage (measured 2026-07-31, same doc).

**Transform (historical Qt `xform`, still the device rule):** Designer 90/270 geometry is *viewer* space. Compiler applies **one** mapping into 720×1280 FB pixels, then rasters/AVI into that box. Firmware does not apply a second rotation.

V2 `rotations/{uuid}.json` is **not** a device file. Device path is `tN/r{angle}/`.

# 6. Scene Contract

Designer `Scene` (`models.ts:200-208`): `id`, `name`, `widgets[]`, `priority` **0–10**, `activationConditions` on DeviceProfile states (no ARKEL bits), `activationConditionMode` all\|any.

Firmware `sahne_kural_t` (`sahne_motoru.h`): `ad[16]`, `oncelik` int16, up to 4 AND conditions, same name on multiple lines = OR.

Evaluation (`sahne_degerlendir`, `sahne_motoru.c:41`): highest `oncelik`; tie = latest rising edge (`aktif_sira`); debounce `SAHNE_ONAY_N=3`. Unconditional first rule is default (`varsayilan_ix`). Tokens (`jeton_kosul` `:165`): only `bN&mask`, `bN=val`, `kat=`/`<`/`>`/`!=` with `strtol`. Unknown tokens are **dropped**. If every token drops, `kosul_n==0` → rule becomes **default scene** (alarm fail-open). Therefore **never emit `state=fire` alone**.

Historical default priorities (git history `scene_contract.py`; in-tree file deleted at this SHA): yangin 100, asiri_yuk 90, … bosta 0. Designer UI 0–10 **must not** be written as device `oncelik`.

Canonical names firmware `sahne_elev_state` knows (`sahne_motoru.c:497-509`): `yangin asiri_yuk servis_disi kapi_ac kapi_kapa seyir_yukari seyir_asagi estop mesgul` else idle. `estop` has **no** LOP token in the deleted `LOP_BITLERI` table — do not emit an empty `sahne estop` line.

Scene-level bindings in Designer are `activationConditions`, not `Binding`. Firmware has no scene-level Binding object.

# 7. Widget Contract

## 7.1 Types

Firmware `tur_coz` (`sahne_motoru.c:142-151`): `image media digit arrow list text saat`. Anything else → `W_BILINMEZ` (not drawn).

Designer `WidgetType` (`models.ts:9-15`): `media digit direction warning text` (+ open string).

| Designer type | Disk `tur=` | Firmware | Compatible? |
|---|---|---|---|
| `media` | `media` | `W_MEDIA` | PARTIAL (name + decode) |
| `digit` | `digit` | `W_DIGIT` | PARTIAL |
| `direction` | **must be `arrow`** | `W_ARROW` | INCOMPATIBLE if `tur=direction` |
| `warning` | **must be `image`** | `W_IMAGE` | INCOMPATIBLE if `tur=warning` |
| `text` | `text` | `W_TEXT` | PARTIAL (needs atlas) |
| *(none)* | `list` | `W_LIST` | MISSING in Designer union |
| *(none)* | `saat` | `W_CLOCK` | MISSING in Designer union |

`ad`: firmware copies at most `SAHNE_AD_MAX-1` = **15** characters (`sahne_motoru.c:249`). UUID ads truncate. Required short names: `kat_no`, `ok`, `logo`, `bg`, `videoWidget1..4`, `u_yangin`, `u_asiri_yuk`, `u_estop`, `u_servis_disi`. Do not use Qt-era `uyari_sym_yangin` (16 chars).

`W_MEDIA` slot bind: `Screen1View::medyaAdIndisi` matches `videoWidgetN` / `vidN` / `videoN`, `N<=MEDYA_MAX` (4). Unmatched names take “next free slot”.

`locked` is editor-only; do not put on disk.

## 7.2 Matrix (HIGH PRIORITY)

| Widget | Designer model | Serialized V2 today | Firmware parser | Runtime | Renderer | Gap |
|---|---|---|---|---|---|---|
| media | `WidgetType media`, `mediaSlide` | rotation JSON + `.asset.json` | `w tur=media` `kaynak=`/`liste=` | `havuzGorunurlukTazele` play/pause | VideoWidget + JPEG HW | Package not `tema.cfg`; H264 vs MJPG |
| digit | `digit` | JSON geometry | `w tur=digit` | ARKEL kat → cells | dynamic RAW glyphs | UUID ad; no `adim_*` from V2 |
| direction | `direction` | JSON | needs `tur=arrow` | ARKEL yon | RAW up/down | type token |
| warning | `warning` | JSON | needs `tur=image` + alarm `sahne=` | fail-closed | BMP/JPEG | type token; long ad |
| text | `text` | JSON font name | `w tur=text` `font=` `icerik=` | RTC/capacity string | glyph atlas RGB565 | no atlas pipeline in V2 |
| list | not in union | — | `tur=list` | C list | C-drawn | Designer cannot author |
| clock | not in union | — | `tur=saat` | RTC glyphs | RAW charset | Designer cannot author |

# 8. Geometry Contract

Designer: `{x,y,width,height}` numbers on `Widget.geometry` (`models.ts:28-33`). Preview uses them as scene pixels (`App.tsx` canvas). No documented unit conversion; treat as **device pixels** of the *viewer* canvas (720×1280 or swapped 1280×720).

Firmware `tema_widget_t`: `int16_t x,y,w,h` in **framebuffer** space (always 720×1280) (`sahne_motoru.h` widget struct). `layout.cfg` keys (`sd_load_template_layout`, `sd_config.c:292-354`) are the same space: `bg_x`, `dir_x`, `dig_tens_x`, `logo_x`, `list_*`. Line buffer **64**.

Rules:

- Origin: top-left of the 720×1280 FB.
- Integers on disk. Designer floats must round (unspecified rounding → **UNKNOWN**, recommend round-to-nearest, clamp to int16).
- Clip to 720×1280 after transform.
- R90/R270: compiler transforms once; firmware does not.
- Digit cells: one V2 box → `dig_tens_*` / `dig_units_*` / `dig_1_*` + `adim_x/adim_y` on both `layout.cfg` and `w kat_no` (box model `adim=0` is horizontal; r90/r180 vertical digits need nonzero `adim`). Evidence: `sahne_motoru.h` comments on `adim_x/y`; `Screen1View.cpp` still reads `m_layout`.

# 9. Asset Contract

Designer `Asset` (`models.ts:259`): `id`, `name`, `sourcePath`, `mediaType?`, `metadata?`. Export writes `assets/{id}.asset.json` with `binary: false` and `sourcePath` (`export.ts:74-93`). Optional copy: `binaryMediaCopiesFromPackage` copies **source extension unchanged** to `assets/{id}.png|mp4` (`removable-storage.ts:149-170`). Root directory `PACKAGE_ROOT_DIRECTORY = "template-designer"` (`:117`).

Firmware never opens `.asset.json`. Image load:

- Digit/arrow RAW: `gorsel_yukle` — path `0:/tN/r<form>/img/<rel>`, header u16le w,h then **w×h×4 ARGB8888** (`gorsel.c:58-75`).
- Widget BMP/JPEG: `sd_load_widget_image` (warning/logo/bg). RAW is not opened on that path (historical split).

**Endianness:** headers little-endian. **Alignment:** arena 32-byte (`sd_arena_ayir`). Failed load spends **no** arena bytes (`PLAN.md` / `gorsel.c` comment).

# 10. Binding Contract

Designer Binding (`models.ts:115-140`):

- `id`, `widgetId`
- `conditions[]` on DeviceProfile state/setting (`equals|not-equals|greater-than|less-than|contains`, optional `negated`, `conditionMode` all\|any)
- `action`: show hide play pause stop restart continue select-content select-style
- `contentId?`
- `priority?` integer **0–15** (product: do not change). Absent = lowest. Independent of `Scene.priority` 0–10. Higher wins; document order breaks ties (`runtime.ts` + `App.tsx:2286-2305` sorts ascending then last-write-wins).

Firmware: **no Binding record, no parser, no priority table.** `varlik <ad> : <path>` is a **file map**, not V2 Binding (`sahne_motoru.h:140-160`).

Semantic mismatch: do not rename `sahne=` to Binding. `sahne=` is scene **membership**. Binding is intra-scene action + extra conditions.

# 11. Binding Runtime Semantics

Designer PC (`runtime.ts`):

```text
RuntimeContext.values/settings
  → selectActiveScene (priority 0–10, then activationOrder)
  → evaluateBinding per widget (priority 0–15)
  → mutate preview: hidden / playback / contentId
```

Frequency: UI recompute when simulator inputs change (not per vsync).

Missing data: unset value does not match; `negated` on unset is true (`runtime.ts:62`).

Firmware (`havuzGorunurlukTazele`, `Screen1View.cpp:3490`):

```text
ARKEL frame 12 bytes → sahne_degerlendir (every UART frame, RAM only)
  → selected scene name
  → sahne_tanim_gorunur(widget, scene): membership + alarm fail-closed
  → setVisible; video play iff visible && reader open
```

Digit/arrow **content** is not Binding: ARKEL kat/yön (`updateDigits`). No data → hide live types (`:3597`).

**Agreed V1 execution (compile, not MCU Binding):**

1. Author Binding in Designer against canonical states.
2. Compiler reduces show/hide to `sahne=` membership (see `docs/template-designer/research/binding_yapisi_20260819.md`).
3. Non-reducible actions → Validate `BINDING_NOT_ON_DEVICE`; do not ship.
4. Device Binding table is **not** in V1 (RAM unmeasured).
5. Never emit `state=`-only scene rules.

# 12. Media Contract

Designer `MediaSlideContent` (`models.ts:171`): ordered `items[]` of image|video, per-item `duration`, `loop?`, `repeatCount?`, slide-level `audioAssetId`, `volume`, `continuePlayback`. Product: a slide is a **sequence**, not one asset.

Firmware `tema_liste_t` (`sahne_motoru.h:133-138`): `{ad, dosya[64], tekrar}` — **one file**. Parser takes the first path (`sahne_yukle` liste branch `:322-355`). Duration/transition/crossfade: **not present**.

V1: do not publish multi-item slides (`MEDIA_SLIDE_MULTI_ITEM`). Single image or single video only. Sequence playback on MCU is MISSING.

# 13. Video Contract

| Layer | Status | Evidence |
|---|---|---|
| Designer import | YES (`supportedFormats` includes `mp4`) | `factories.ts:18` |
| Designer package | copies MP4 if `resolvedPath` | `removable-storage.ts:163` |
| Firmware parser | path string in `tema.cfg` | `sahne_yukle` `kaynak=`/`liste=` |
| Firmware decoder | **MJPG only** | `sd_query_avi_size` returns false unless MJPG (`sd_content_manager.h:57-59`) |
| Hardware playback | JPEG HW + `videoTask`, max 720×1280, scene Σ ≤ 921600 px | `media_config.h` `VIDEO_MAX_*`, `VIDEO_BUDGET_PX` |
| Concurrent decode | 4× HardwareMJPEGDecoder | `sd_content_manager.h` comments; Designer profile says `maxConcurrentDecode: 1` and **h264 1920×1080** (`factories.ts:41-46`) — **wrong for this hardware** |

Do not claim V2 can generate playable video packages today.

# 14. Font Contract

Firmware has **no TTF**. `W_TEXT` uses a theme glyph atlas (`glif_atlasi.h`). Designer `DeviceProfile.fonts` is a string list (`factories.ts:29` `"firmware-default"`). There is **no** atlas generator in V2 at this SHA.

Clock (`W_CLOCK`) uses RAW glyph **images** (`tur=saat`, `font` prefix, `karakter` list) — a second path, not the alfa atlas.

# 15. Glyph Atlas Contract

What the renderer needs (`glif_atlasi.h:8-19`, `docs/moduller/glif_atlasi.md`):

| Field | Format |
|---|---|
| Files | `0:/t<N>/font/<ad>.raw` + `<ad>.cfg` (form-independent) |
| RAW | u16le width, u16le height, then width×height **alpha only** (0..255). No color. |
| CFG | `punto=` `sayfa=WxH` `adet=N` then `g <code> <x> <y> <w> <h> <advance> <left> <top>` |
| Draw | RGB565 box, `out = fg*a/255 + bg*(1-a/255)`. **ARGB8888 blit forbidden** (HardFault history) |
| Cache | 2 atlases; 3rd font drops the widget (`glif_atlasi.md`) |
| Load | `glif_atlas_yukle` — SD only on miss; clock refresh must not hit SD |

Kerning: **not** in the cfg line. Fallback glyph: **UNKNOWN** (widget drop vs tofu). Unicode: cfg `g <kod>` is integer code; Arabic shaping **not** implemented.

# 16. Unicode / Floor Identifier Contract

Designer: `FloorIdentifier = string`, NFC compare (`models.ts:218-227`). `floor` runtime state type `string` (`factories.ts:21`).

Firmware:

- Scene conditions: `kat` is `int` via `strtol` (`jeton_kosul`).
- List labels: `floor_entry_t.floor_num` **int8** (`sd_config.h`); `sd_floors_load` `atoi` first CSV field (`sd_config.c:390-401`). Rows 64, text 32 chars, line 128.
- Digit glyphs: files `n0.raw` … plus letters via `kat.c` (`n_A.raw` etc.) — **bitmap set**, not Unicode font.

`Restaurant` cannot be `kat=Restaurant`. V1: `firmwareValue` must parse as int8 or Validate; `displayValue` → left and right CSV columns. Symbolic Unicode on the **digit renderer** is PARTIAL (pre-made letter RAWs). Full Unicode floors: INCOMPATIBLE until decoder + glyph coverage exist.

# 17. DeviceProfile Contract

Designer: `DeviceProfile` (`models.ts:77-105`) — display size, widget/media types, formats, runtime state/setting registries, audio/video capability blobs, `version` string.

Firmware: no DeviceProfile file. Limits are **compiled** (`media_config.h`, `WIDGET_MAX=16`, `SAHNE_MAX=16`, `TEMA_ARENA_BAYT=2MiB`, `TEMPLATE_COUNT=16`).

What firmware needs from a profile (validation in Designer, not parsed on MCU):

- 720×1280, four rotations
- codecs: mjpeg-avi, raw-argb, bmp, jpeg, wav, glyph-atlas — not h264/mp4 as device formats
- `videoBudgetPx = 921600`
- widget/scene/atlas maxima
- runtime state IDs that map to the scene table
- `deviceProfileVersion` in package manifest for “registry changed” warnings

`compactDeviceProfile` 480×800, no video: **not publishable** to this firmware.

# 18. Audio Contract

**Do not guess 3 vs 5.** What the mixer actually is (`audio_player.c`, `docs/audio/04_audio_subsystem.md`):

| Item | Actual |
|---|---|
| Mix buses | **2**: FON (BGM ring 1 MB SDRAM) + ANONS (announcement) |
| Output | I2S1 DMA, `MIX_RATE` **44100**, stereo stream (zeros when idle) |
| Ducking | ANONS present → FON attenuated, not stopped |
| File | WAV header parsed (`channels`, `sample_rate`); mono flagged `s_fon_mono` |
| Volume | `audio_set_volume(0..10)`, default 1; `audio_set_sound` master mute |
| FON list | up to 8 files (`FON_MAX`) |
| Theme audio | `0:/tN/audio/` via `sd_theme_audio_path` |

Designer `AudioCapabilities` is a bag of booleans, no channel IDs (`models.ts:60-67`). Product intent (user, 2026-08-19): **five Designer roles**, two device buses. Mapping table **PRODUCT DECISION REQUIRED** (which roles collapse to FON vs ANONS). Unmapped role → do not publish. Do not implement a 5-bus MCU mixer in V1.

# 19. Serialization Contract

**Current device format (what STM32 actually reads):**

| Path | Format | Parser |
|---|---|---|
| `0:/config.txt` | `KEY=value` text | `sd_config_read` |
| `0:/tN/rA/tema.cfg` | lines, 160 chars; `sahne ` `w ` `liste ` `varlik ` | `sahne_yukle` |
| `0:/tN/rA/layout.cfg` | `key=value`, line 64 | `sd_load_template_layout` |
| `0:/tN/rA/img/*.raw` | u16le w,h + BGRA/ARGB8888 | `gorsel_yukle` |
| `img` bmp/jpeg | BMP/JPEG | `sd_load_widget_image` |
| `video/*.avi` | RIFF MJPG | `sd_query_avi_size` |
| `font/<ad>.raw+.cfg` | alpha atlas | `glif_atlas_yukle` |
| `data/floors.csv` | `int,left,right` | `sd_floors_load` |

Endianness: little-endian headers. Checksum: firmware does **not** verify package SHA-256. Designer logical package SHA-256 is PC-only (`export.ts:118-127`).

**Current V2 format:** JSON under `template-designer/` — firmware **does not read it**.

Target shared device serialization = **today’s `tema.cfg` grammar**, not MCU JSON (no parser; not mandated).

# 20. Template Package Structure

## 20.1 What V2 builds today

```text
template-designer/manifest.json
themes/{uuid}/theme.json
themes/{uuid}/rotations/{uuid}.json
assets/{uuid}.asset.json
[+ optional assets/{uuid}.<src-ext>]
```

## 20.2 What STM32 must receive

```text
0:/config.txt
0:/t<N>/
  audio/
  font/<ad>.raw
  font/<ad>.cfg
  data/floors.csv
  r0/ r90/ r180/ r270/
    layout.cfg
    tema.cfg
    img/
    video/
```

`proj.json` / logical JSON: firmware must not require them (`sahne_yukle` does not open JSON).

# 21. Runtime State

| Kind | Owner | Examples |
|---|---|---|
| Design-time | Designer project file | Widget.locked, editor selection, ThemeProjectGroup |
| Deployed template | SD files | `tema.cfg` widgets/scenes, binaries, `floors.csv` |
| Runtime | MCU RAM | `g_sahne.secili`, ARKEL 12 bytes, kat int, video `oynuyor`, FON/ANONS mix, `config.txt` volume/lang, RTC |

Designer `RuntimeContext` is the **simulator**. Firmware runtime is ARKEL + menu + RTC. They share *canonical state names* only after a mapping table exists. Designer must not decode LOP bits (`RUNTIME_STATE_REGISTRY.md` doctrine).

# 22. Validation Responsibilities

| Constraint | Designer | Build/compiler | Firmware | Hardware |
|---|---|---|---|---|
| Resolution 720×1280 | DeviceProfile | emit matching rasters | clip/ignore | panel |
| Widget count ≤16 | Validate | refuse | `widget_dusen++` | — |
| Scene rules ≤16 | Validate | refuse | `kural_dusen++` | — |
| `ad` strlen <16 | Validate | short names | truncate | — |
| `tur=` token set | map types | emit legal tokens | `W_BILINMEZ` | — |
| Video MJPG + budget | **must** (today does not) | encode AVI | skip non-MJPG | JPEG HW |
| Atlas ≤2 | Validate | generate | drop 3rd | 2 MB arena |
| Binding 0–15 | already | reduce or refuse | N/A V1 | — |
| `state=`-only rules | — | **forbidden** | fail-open | — |
| Floor non-int | Validate | CSV int8 | atoi/int8 | — |
| Unsupported widget | hide or error | omit | ignore unknown | — |
| Path traversal | preflight | — | FatFS paths | — |

# 23. Memory / Performance Limits

| Resource | Limit | Evidence |
|---|---|---|
| Theme arena | 2 MiB bump, 32 B align | `TEMA_ARENA_BAYT` `sd_content_manager.h:89` |
| SDRAM | 16 MB (FB 2×~1.8 MB + video RGB) | `06_memory_and_linker.md` / header comments |
| Widgets | 16 | `WIDGET_MAX` |
| Scene rules | 16 | `SAHNE_MAX` |
| Conditions/rule | 4 AND | `SAHNE_KOSUL_MAX` |
| Media lists | 4, one file each | `LISTE_MAX` |
| Video pixels/scene | 921 600 | `VIDEO_BUDGET_PX` |
| Video max one file | 720×1280 | `VIDEO_MAX_W/H` |
| AVI read buf | 512 KB | `AVI_READ_BUF_BYTES` |
| Glyph atlases | 2 | `glif_atlasi.md` |
| Text box max | 720×300 | `glif_atlasi.md` |
| FON ring | 1 MB | `FON_RING_SZ` |
| Image cache slots | 32 RAW (`GORSEL_ONBEL_N`) | `gorsel.c:20` |
| Theme IDs | 0..14 | `TEMPLATE_COUNT` 16, vanilla 15 |
| `tema.cfg` line | 160 | `sahne_yukle` |
| `sahne=` field | 96 | `WIDGET_SAHNE_LEN` |
| `kaynak` | 48 | `tema_widget_t` |

Designer currently does **not** validate these. Packages that exceed them can be authored; firmware drops with counters, not a crash *if* defensive paths hold.

Binding tables: **not measured** — do not add `BINDING_MAX` without arena/DTCM numbers.

# 24. Firmware Compatibility Matrix

| Concept | Designer V2 | Firmware current | Compatible? | Gap | Required change |
|---|---|---|---|---|---|
| Project | UUID + schema | none | INCOMPATIBLE | MCU has slots not projects | Compiler maps to `tN` + `config.txt` |
| ThemeProjectGroup | yes | none | N/A design-time | — | Do not ship |
| ThemeProject | UUID theme | `tN/` scan | PARTIAL | ID space | Slot mapping |
| Rotation | 4 angles JSON | `r0..r270/` pre-rotated FB | PARTIAL | JSON vs folders; transform | Compiler |
| Scene | conditions 0–10 | `sahne` ARKEL 100/90/… | INCOMPATIBLE | bits vs states; priority scale | Table + compile |
| Widget | 5 types UUID | 7 `tur` 15-char `ad` | INCOMPATIBLE | tokens, names, list/clock | Map + Validate |
| Geometry | float-ish viewer px | int16 FB | PARTIAL | transform, `layout.cfg` | Compiler |
| Asset | JSON + src copy | RAW/BMP/JPEG/AVI/WAV/atlas | INCOMPATIBLE | no transcode | Compiler |
| Image | png/jpg | RAW/BMP/JPEG | INCOMPATIBLE as shipped | formats | Convert |
| Video | mp4/h264 advertised | MJPG AVI | INCOMPATIBLE | codec | Encode + profile fix |
| Media Slide | ordered sequence | one-file `liste` | INCOMPATIBLE | duration/items | V1 block multi |
| Binding | 0–15 actions | none (`sahne=` only) | INCOMPATIBLE | semantics | Reduce show/hide |
| Binding priority | 0–15 | N/A | MISSING on MCU | — | Compile-time only V1 |
| Glyph | font name string | alfa atlas | MISSING pipeline | generator | Port `glif_atlasi.py` |
| Glyph Atlas | no type | `.raw+.cfg` | MISSING in domain | — | Artifact + Validate |
| Font | TTF not used | no TTF | INCOMPATIBLE if TTF shipped | — | Atlas only |
| Floor ID | Unicode string | int8 + letter RAWs | PARTIAL | `Restaurant` | Validate int; later decoder |
| DeviceProfile | yes, wrong video caps | compile-time limits | PARTIAL | h264 1080p lie | Profile 1.1 |
| Runtime state | simulator registry | ARKEL RAM | PARTIAL | mapping | Table, no bits in UI |
| Serialization | JSON SHA-256 | line cfg, no hash | INCOMPATIBLE | root + grammar | Device tree |
| Manifest | `manifest.json` | unused | INCOMPATIBLE | scan wins | Optional extra file |
| Validation | project rules, no HW caps | defensive drop | PARTIAL | limits missing | Add gates |
| Deployment package | `template-designer/` | `0:/tN` | INCOMPATIBLE | root | Write volume root |

**Summary:** conceptual overlap ~40% (four forms, widget/scene *ideas*, 720×1280). **On-disk executable compatibility: ~0%.** A V2 deploy today does not produce a theme `sd_scan_templates` can see.

# 25. Required Firmware Changes

None for V1 **if** Designer emits current `tema.cfg`. Firmware C stays.

| ID | Area | Current | Required | Reason | Sev | Deps | Complexity | HW risk | Test |
|---|---|---|---|---|---|---|---|---|---|
| F-0 | — | line parser works | keep | working path | — | — | — | — | existing cards |
| F-1 | optional later | no `state=` | dual-emit after flash | fail-open today | P2 | golden old parser | med | alarm | `kosul_n==0` test |
| F-2 | Binding table | none | only after measure | RAM | P3 | arena | high | drop/crash | DTCM counters |
| F-3 | `liste` multi | one file | sequence | Media Slide | P2 | product | med | SD/video | item order |
| F-4 | JSON parser | none | not V1 | flash/RAM | P3 | measure | high | boot | — |
| F-5 | Floor string | int | NFC string | Unicode floors | P2 | glyphs | high | draw | — |

P0 firmware work for compatibility: **none** — the gap is the package.

# 26. Required Template Designer Changes

| ID | Area | Why | Sev |
|---|---|---|---|
| D-1 | DeviceProfile | Remove h264/1920×1080; add MJPG, 921600, maxima | P0 |
| D-2 | Export root | Device package at `0:/tN` not `template-designer/` | P0 |
| D-3 | Compiler | Emit `tema.cfg`/`layout.cfg` + binaries | P0 |
| D-4 | Transcode | PNG→RAW/BMP/JPEG, MP4→MJPG AVI, TTF→atlas, pre-rotate | P0 |
| D-5 | Widget map | `direction→arrow`, `warning→image`, short `ad`, `videoWidgetN` | P0 |
| D-6 | Binding Validate | Reduce show/hide; block rest | P0 |
| D-7 | Media Slide | Block multi-item | P0 |
| D-8 | Floor CSV | int8 `firmwareValue` | P1 |
| D-9 | `config.txt` | Write `TEMPLATE=`/`ORIENTATION=`; do not clobber VOLUME/LANG | P1 |
| D-10 | Scene table | Copy H747 rules; do not write UI 0–10 as device priority | P0 |
| D-11 | Eject | Native Windows eject (user decision); today `EJECT_UNSUPPORTED` | P1 |
| D-12 | Compact profile | Not publishable to this firmware | P1 |

# 27. Shared Contract Decisions

Locked by code or prior product record:

- Binding priority **0–15**.
- Media Slide = ordered sequence (device cannot play it yet).
- Floor IDs are symbolic strings in Designer; device kat token is int V1.
- Device transport V1 = SD.
- Disk scan beats manifest.
- No MCU JSON V1.
- Alarm fail-closed.
- Two audio mix buses on hardware.

Still shared / open:

- UUID → `tN` (user picks at publish).
- Five Designer audio roles → FON/ANONS map.
- When to stop writing `layout.cfg` (must write while `Screen1View` reads `m_layout`).
- Schema version integer vs string in docs.

# 28. Golden Template

A future card `0:/t0/` used by Designer tests, PC parser tests, and hardware:

- One ThemeProject, four form folders with pre-rotated assets.
- Scenes: `yangin` (b3&0x20), `bosta` (unconditional), plus `seyir_yukari` if mapped.
- Widgets: `logo` image, `kat_no` digit, `ok` arrow, `videoWidget1` media (MJPG, within budget), `u_yangin` image `sahne=yangin` only.
- `ad` all `strlen<16`.
- `floors.csv` numeric floors 0..N with labels.
- One alfa atlas if text present.
- `config.txt` `TEMPLATE=0` `ORIENTATION=0`.
- Bindings in Designer project: fire→warning membership; no `state=` on disk.

Consumers: V2 compiler golden diff, firmware `sahne_yukle` on device, UART `*_dusen` = 0, fire hides digit (fail-closed).

# 29. Migration Strategy

1. Freeze this contract.
2. Designer: profile + compiler emitting **current** grammar (unmodified `feb5f56` firmware).
3. Write volume root; verify binary read-back.
4. Hardware smoke on **unmodified** ELF.
5. Only then consider `state=` dual-emit or Binding tables.

Old SD cards remain `surum=1` line files. Do not require JSON.

# 30. Open Product Decisions

1. FON/ANONS mapping for five Designer audio roles — **PRODUCT DECISION REQUIRED** (levels still conflict in older Designer docs).
2. Native eject implementation vs OS (user asked app eject; code unsupported).
3. `door_state==opening` has no dedicated LOP scene.
4. Binding `contains` / Unicode floor on `kat=` — V1 refuse.
5. `layout.cfg` retirement after proving draw is 100% `w` lines — not now.

# 31. Risks

| Risk | Sev | Note |
|---|---|---|
| V2 JSON on card called “deployed” | P0 | Empty scan / vanilla |
| `state=`-only fire rule | P0 | Default scene = fire |
| h264 profile | P0 | Decoder skip |
| `ad` truncation collisions | P1 | Wrong widget |
| Video assert if visible without reader | P0 | already mitigated in `havuzGorunurlukTazele` |
| Arena overflow | P1 | drop widgets |
| Deleted Qt tools | P1 | compiler must be rebuilt in V2; `scene_contract.py` only in git history |

# 32. Acceptance Criteria

A package is acceptable when **unmodified** firmware at `feb5f56`:

1. `sd_scan_templates` finds `tN` via `layout.cfg` or `img/`.
2. `sahne_yukle` returns true; `widget_dusen`/`kural_dusen` = 0 for the golden set.
3. Fire LOP bit shows `u_yangin`, hides digit/ok (fail-closed).
4. Idle shows logo; video plays iff MJPG and `sahne=` matches and reader open.
5. R90 assets are pre-rotated (not sideways).
6. Designer refused: multi-item slides, h264, UUID ads, `tur=direction`, non-int floors, non-reducible Binding.
7. No claim of success before SD read-back.

---

## Appendix A — Evidence index

Firmware: `sahne_motoru.c/.h`, `sd_config.c/.h`, `gorsel.c`, `glif_atlasi.h`, `audio_player.c`, `media_config.h`, `sd_content_manager.h`, `Screen1View.cpp` `havuzGorunurlukTazele`, `kat.c`, `docs/depo/tema_yapisi.md`, `docs/audio/04_audio_subsystem.md`, `docs/moduller/glif_atlasi.md`.

Designer: `src/Domain/models.ts`, `src/Domain/factories.ts`, `src/Core/export.ts`, `src/Core/runtime.ts`, `src/Core/removable-storage.ts`, `src/App/App.tsx` binding effects.
