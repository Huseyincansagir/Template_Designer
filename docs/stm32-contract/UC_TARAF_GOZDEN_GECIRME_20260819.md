# Üç taraf gözden geçirme — Designer · SD kart · STM32

| Alan | Değer |
|---|---|
| Tarih | 2026-08-19 |
| STM32 HEAD (gözden geçirme anı) | `2c4898c` / sözleşme baseline `feb5f56` |
| Designer branch | `manus2` |
| Sonuç | **Başlamaya hazır.** V1 işi STM32 C değil; V2 derleyici + SD kökü. |

Bu not, sözleşmeyi koda karşı **yeniden** okur. Uygulama yok.

---

## 1. Template Designer V2 — teyit

| İddia | Kod | Durum |
|---|---|---|
| Mantıksal paket JSON, `binary: false` | `src/Core/export.ts:74-93` `assets/{id}.asset.json` | Doğru |
| Tema ağacı UUID | `export.ts:97-115` `themes/{id}/theme.json` + `rotations/{id}.json` | Doğru |
| SD kökü `template-designer/` | `removable-storage.ts:117` `PACKAGE_ROOT_DIRECTORY` | Doğru — **STM32 bunu taramaz** |
| Ham kopya uzantı korunur | `binaryMediaCopiesFromPackage` `assets/{id}.mp4` | Doğru — **MJPG değil** |
| Profil 720×1280, 4 açı | `factories.ts:14-15` | Doğru |
| Video `h264` 1920×1080 | `factories.ts:41-46` | Doğru ve **cihaza aykırı** |
| Widget `direction` / `warning` | `models.ts:9-15` | STM32 `tur_coz` bunları bilmez (`arrow` / `image` ister) |
| Binding 0–15, PC runtime | `models.ts:115-140`, `runtime.ts` | MCU’da karşılık yok |
| Media Slide sıra | `models.ts:171` | STM32 `liste` tek dosya |
| `floor` string | `factories.ts:21` | STM32 `kat` / CSV `int8` |

**Designer P0 (başlangıç işi):** DeviceProfile düzelt, `0:/tN` derleyici, transcode, `tur=`/`ad` map, Binding→`sahne=`, çok-öğe slayt kes.

---

## 2. SD kart — teyit

STM32’nin **gördüğü** ağaç (`sd_scan_templates` `sd_config.c:169`, `SD_TEMPLATE_ROOT_FMT` `0:/t%d`):

```text
0:/config.txt
0:/t<N>/r0|r90|r180|r270/layout.cfg   ← tarama için yeterli
0:/t<N>/r{form}/tema.cfg              ← sahne_yukle
0:/t<N>/r{form}/img/                  ← yoksa layout yoksa tema sayılmaz (img/ alternatif)
0:/t<N>/r{form}/video/*.avi           ← MJPG
0:/t<N>/font/<ad>.raw+.cfg
0:/t<N>/audio/
0:/t<N>/data/floors.csv
```

V2’nin **yazdığı** ağaç:

```text
<template-designer>/manifest.json
themes/{uuid}/…
assets/{uuid}.asset.json
assets/{uuid}.png|mp4
```

| Kartta ne varsa | STM32 ne yapar |
|---|---|
| Yalnız V2 JSON kökü | `sd_scan_templates` 0 → VANILLA / boş |
| `tN/r0/layout.cfg` veya `img/` | Tema listelenir |
| `tema.cfg` yok | `sahne_yukle` false → `sahne_varsayilan` |
| MP4 / H264 | `sd_query_avi_size` false → video skip |
| `config.txt` yok | Varsayılan TEMPLATE/ORIENT; seçim kaybolabilir |

Checksum: STM32 paket SHA-256 **okumaz**. V2 SHA-256 yalnız PC doğrulama.

---

## 3. STM32 — teyit

| İddia | Kod | Durum |
|---|---|---|
| JSON yok | CM7 araması | Doğru |
| `tur_coz` kapalı küme | `sahne_motoru.c:142-151` | Doğru |
| `ad` ≤15 | `SAHNE_AD_MAX-1` kopya `:249` | Doğru |
| Sahne jetonu `bN`/`kat` | `jeton_kosul` `:165` | Doğru; `state=` fail-open |
| Üyelik = Binding değil | `sahne_tanim_gorunur` | Doğru |
| Video görünür ⇒ play | `havuzGorunurlukTazele` | Doğru |
| RAW header LE + ARGB | `gorsel_yukle` | Doğru |
| Ses 2 otobüs 44100 | `audio_player.c` FON+ANONS | Doğru — 5 kanal uydurma |
| FB döndürmez | `tema_yapisi.md` | Doğru — paket ön-döndürür |
| V1 C değişikliği | — | **Gerekmez** (ayrı belge) |

---

## 4. Başlamadan kilit cümleler

1. Üç taraf **aynı ürünü** konuşmuyor; aynı **fikirleri** konuşuyor.
2. İlk kod **MyApplication_6 CM7 değil** — `Template_Designer` derleyici.
3. STM32 C, kart `tN/r0/tema.cfg` basılana kadar **dondurulur**.
4. Binding MCU’ya JSON gitmez; `sahne=` olur veya yayın kesilir.
5. Video: Designer mp4 **cihaz dosyası değildir**.

---

## 5. İlk uygulama sırası (henüz kod yok)

| # | Nerede | İş |
|---|---|---|
| 1 | Designer | `foundationDeviceProfile` MJPG 720×1280, bütçe 921600, h264 kalksın |
| 2 | Designer | `tema.cfg`/`layout.cfg` + ikili derleyici |
| 3 | Designer | Yazım kökü sürücü `0:/tN` (mantıksal JSON ayrı) |
| 4 | SD | Golden `t0` kart; tarama + yangın fail-closed |
| 5 | STM32 | Aynı ELF dumanı — C patch yok |

Ayrıntı: `STM32_V2_GEREKEN_DEGISIKLIKLER.md`, `TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md`.
