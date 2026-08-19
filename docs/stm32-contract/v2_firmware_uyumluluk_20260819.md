# Template Designer V2 paketi ↔ STM32 firmware — uyumluluk (2026-08-19)

Kaynak: çalışan kod. Qt yazıcı bu depodan silindi; karşılaştırma **V2’nin bugün yazdığı şey** ile **firmware’in bugün okuduğu şey**.

**Sonuç:** V2 paketi karta yazılırsa cihaz temayı **görmez**. Vanilla’ya düşer veya boş tarama. Domain niyeti kısmen aynı (4 form, widget, sahne); disk sözleşmesi **uyumsuz**.

---

## 1. İki ağaç

V2 (`src/Core/export.ts` + `PACKAGE_ROOT_DIRECTORY = "template-designer"`):

```text
<template-designer>/
  manifest.json
  themes/{uuid}/theme.json
  themes/{uuid}/rotations/{uuid}.json
  assets/{uuid}.asset.json          # binary: false, sourcePath
  assets/{uuid}.png|mp4|…           # kopya, dönüştürmesiz (resolvedPath varsa)
```

Firmware (`sd_scan_templates`, `sahne_yukle`, `sd_theme_path`):

```text
0:/config.txt
0:/t<N>/                            # N = 0..14, VANILLA=15
    audio/
    font/<ad>.raw + <ad>.cfg
    r0|r90|r180|r270/
        layout.cfg                  # tarama için yeterli
        tema.cfg                    # sahne/widget
        img/                        # .raw / .bmp / .jpeg
        video/                      # MJPEG AVI
    data/floors.csv
```

Tarama ölçütü: geçerli formda `layout.cfg` **veya** `img/` dizini. `manifest.json` / `themes/` **yok sayılır**.

---

## 2. Uyumlu (kavram)

| Kavram | V2 | Firmware | Not |
|---|---|---|---|
| Dört form | `Rotation.angle` 0/90/180/270 | `r0` `r90` `r180` `r270` | İsim aynı fikir; V2 UUID klasör yazar, firmware açı klasörü ister |
| Ekran 720×1280 | `foundationDeviceProfile.display` | Panel 720×1280 | Foundation profil geometrisi doğru |
| Widget tür fikri | media, digit, direction, warning, text | W_MEDIA, W_DIGIT, W_ARROW, W_IMAGE, W_TEXT | İsimler **diskte** farklı (aşağı) |
| Sahne + öncelik fikri | `Scene` 0–10 | `sahne` satırı, `oncelik` int16 | Sayı aralığı farklı (100/90/… cihaz) |
| Asset kimliği | UUID | FatFS göreli yol | Derleme şart |
| Offline SD | PC → SD | SDMMC/FatFS | Taşıma aynı; içerik değil |

---

## 3. Uyumsuz (cihazı kıran)

### 3.1 Kök dizin — kırıcı

V2 `template-designer/` altına yazar. Firmware `0:/t%d` tarar.

Kartta yalnız V2 ağacı varsa `sd_scan_templates` 0 tema bulur → VANILLA.

### 3.2 Biçim — kırıcı

| | V2 üretir | Firmware okur |
|---|---|---|
| Tema tanımı | JSON `theme.json` / `rotations/*.json` | Satır `tema.cfg` (`w `, `sahne `, `liste `, `varlik `) |
| JSON parser | var (PC) | **CM7’de yok** |
| Yerleşim | rotation JSON geometry | `layout.cfg` anahtar=değer (satır 64) |
| Asset | `.asset.json` + ham PNG/MP4 kopyası | `.raw` (u16le w/h + pikseller), `.bmp`, `.jpeg`, MJPEG AVI, WAV, glif atlas |

`sahne_yukle` `tema.cfg` açamazsa `false` → vanilla kurallar.

### 3.3 Medya dönüşümü — kırıcı

V2 `binaryMediaCopiesFromPackage` kaynağı **aynı uzantıyla** kopyalar (`assets/{id}.mp4`). Dönüştürme yok.

Firmware:

- Video: `sd_query_avi_size` yalnız **MJPG**. H264/MP4 → skip.
- Rakam/ok: `gorsel_yukle` `.raw`
- Uyarı/logo yolu BMP/JPEG (widget image)
- Font: `font/<ad>.raw`+`.cfg` ALFA atlas; TTF yok
- Firmware PNG/MP4 dönüştürmez

`foundationDeviceProfile.videoCapabilities.supportedCodecs = ["h264"]`, `1920×1080` — cihaz MJPEG, tavan 720×1280, sahne bütçesi **921 600 px**.

### 3.4 Widget `tur=` ve `ad`

`tur_coz`: yalnız `image|media|digit|arrow|list|text|saat`.

V2 `widgetType`: `media|digit|direction|warning|text`.

| V2 | Diskte yazılırsa | Firmware |
|---|---|---|
| `direction` | `tur=direction` | **W_BILINMEZ**, çizilmez |
| `warning` | `tur=warning` | **W_BILINMEZ** |
| UUID `id` | `ad=<uuid>` | `ad[15]`; kesilir, çakışır |
| media adı rastgele | `videoWidgetN` değil | `medyaAdIndisi` eşleşmez → “sonraki boş yuva” |

Firmware `W_LIST` / `W_CLOCK` (`tur=saat`) V2 union’da yok → V2 bunları **yazar bile**.

### 3.5 Sahne / Binding / ARKEL

V2: `Scene.activationConditions` DeviceProfile state (`fire`, `floor` string). `Binding` widget eylemi, öncelik 0–15. ARKEL biti yok.

Firmware: `sahne yangin : oncelik=100 b3&0x20`. Koşul jetonları yalnız `bN&maske`, `bN=`, `kat<op>` (`strtol`). `state=fire` **düşer**; tüm jetonlar düşünce `kosul_n==0` → kural **varsayılan sahne** (alarm fail-open).

Widget görünürlüğü `sahne=` kanonik ad listesi. Binding satırı **yok**.

V2 sahneleri widget’ın içinde yuvalı; firmware widget tema-global + `sahne=` birleşimi.

### 3.6 Kat / floors.csv

V2 `FloorMapping.firmwareValue` Unicode string (`Restaurant`). Firmware `floors.csv` ilk alan `int8 floor_num`. `kat=Restaurant` parse edilmez.

### 3.7 config.txt

Firmware seçili tema/form/stil/ses `0:/config.txt`. V2 bunu **yazmaz**. Boş kartta TEMPLATE yok → VANILLA / varsayılan.

### 3.8 Kapasiteler (V2 doğrulamaz)

| Tavan | Firmware | V2 |
|---|---|---|
| Widget | 16 (`WIDGET_MAX`) | yok |
| Sahne kuralı | 16 | yok |
| Video bütçe | 921 600 px | yok (üstelik h264 1080p reklamı) |
| Atlas | 2 | yok |
| Tema id | 0..14 | UUID |
| `tema.cfg` satır | 160 | — |
| `ad` | 15 karakter | UUID |

### 3.9 Eject / yazım

V2 native eject `EJECT_UNSUPPORTED`. Kullanıcı kararı: uygulama kartı çıkarsın — kod bunu yapmıyor.

---

## 4. Bugün karta yazılırsa ne olur

1. Kullanıcı V2 “Deploy to SD” der.
2. Kartta `template-designer/manifest.json` + JSON + belki PNG/MP4.
3. Cihaz `0:/t0/r0/layout.cfg` arar → yok.
4. `img/` yok → tarama boş.
5. Vanilla tema (kartsız acil) veya boş ekran.
6. MP4 olsa bile MJPG değil, çözülmez.

Bu “kısmi uyum” değil; **uçtan uca uyumsuz paket**.

---

## 5. Köprü (henüz yok)

V2 domain → cihaz derleyicisi gerekir (Qt yazıcı silindi; semantik git geçmişinde):

- Kök `0:/t<N>/r{açı}/` (kullanıcı slot seçer)
- `tema.cfg` bugünkü gramer: `sahne … b3&0x20`, `w … tur=arrow`, `ad` ≤15 (`kat_no`, `ok`, `videoWidget1`, `u_yangin`)
- `layout.cfg` Qt `lay` anahtarları
- PNG→RAW/BMP/JPEG, MP4→MJPEG AVI, font→atlas, 90/270 ön-döndürme
- `config.txt` TEMPLATE= (VOLUME/LANG ezme)
- `floors.csv` int8 + metin
- Binding/slayt çok-öğe **yayınlama**

Firmware C değişmeden bu derleyici V2’de kurulabilir.

---

## 6. Kaynak dosyalar

V2: `src/Core/export.ts`, `src/Core/removable-storage.ts:117`, `src/Domain/models.ts`, `src/Domain/factories.ts:41-46`

FW: `CM7/Core/Src/sahne_motoru.c` (`sahne_yukle`, `tur_coz`), `sd_config.c` (`sd_scan_templates`, `sd_load_template_layout`), `media_config.h`, `sd_content_manager.c` (`sd_query_avi_size`), `gorsel.c`, `glif_atlasi.c`
