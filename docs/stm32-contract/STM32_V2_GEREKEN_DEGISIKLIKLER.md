# STM32 (MyApplication_6) — Template Designer V2 için gereken değişiklikler

| Alan | Değer |
|---|---|
| Repo | `C:\TouchGFXProjects\MyApplication_6` |
| Baseline | `feb5f56c721ba87b6b35d96cb3945427faff2ad6` |
| Tarih | 2026-08-19 |
| Kapsam | Yalnız **STM32/CM7 firmware**. Designer kodu bu belgede yazılmaz. |
| Üst sözleşme | [TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md](../TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md) |
| Binding ayrıntı | [binding_yapisi_20260819.md](../template-designer/research/binding_yapisi_20260819.md) |

**Tek cümle:** Designer JSON’unu MCU’da okumak için firmware’i şişirmek **ürün V1 işi değildir**. STM32 zaten `tema.cfg` + ikili okur. Asıl P0 boşluk Designer derleyicisindedir.

**Taşıma:** ürün V1 = SD. Ürün V2 = SD + Wi-Fi; SD **kapanmaz**. Wi-Fi alıcısı ayrı iş; `sd_scan_templates` / `sahne_yukle` silinmez. `SURUM_TASIMA_V1_V2.md`.

Kod yazılmadı. Kanıt: mevcut C sembolleri.

---

## 1. Karar özeti

```text
V1 (cihaz dumanı)
  STM32 C: DEĞİŞMEZ
  Şart: V2, bugünkü sahne_yukle gramerini + RAW/MJPEG/atlas üretir

V2 semantics tam (Binding tablosu, state=, JSON, Unicode kat, çok-öğe slayt)
  STM32 C: AŞAĞIDAKİ P1–P3 maddeleri
  Şart: bellek ölçümü + golden eski kart
```

Firmware’i V2 JSON’una uydurmak (MCU’da cJSON) **reddedildi**: parser yok, 2 MB arena dolu, eski kartlar ölür. Sözleşme §25 F-4.

---

## 2. Zaten yeterli olan (dokunma)

Bu dosyalar V1 kabulünün omurgasıdır. V2 “uyum” için silinmez / rewrite edilmez.

| Bileşen | Sembol | Ne yapıyor | Kanıt |
|---|---|---|---|
| Tema tarama | `sd_scan_templates` | `0:/tN/r<form>/layout.cfg` veya `img/` | `sd_config.c:169` |
| Sahne parser | `sahne_yukle` | `tema.cfg` satır: `sahne` `w` `liste` `varlik` | `sahne_motoru.c:197` |
| Tür sözlüğü | `tur_coz` | `image\|media\|digit\|arrow\|list\|text\|saat` | `:142` |
| Sahne seçimi | `sahne_degerlendir` | ARKEL 12 bayt + kat; öncelik + debounce N=3 | `:41` |
| Üyelik | `sahne_tanim_gorunur` | `sahne=` + alarm fail-closed | `:477` |
| Çizim | `havuzUygula` / `havuzGorunurlukTazele` | tek yol, video play=görünür | `Screen1View.cpp:3490` |
| Kaynak soyutlaması | `tema_kaynagi` | SD ve vanilla aynı arayüz | `tema_kaynak.h` |
| RAW görsel | `gorsel_yukle` | u16le w/h + ARGB8888 | `gorsel.c:45` |
| Video | `sd_query_avi_size` | yalnız MJPG | `sd_content_manager.h:57` |
| Glif | `glif_atlas_yukle` | `font/<ad>.raw+.cfg` ALFA | `glif_atlasi.h` |
| Ses | FON+ANONS mikser | I2S 44100 | `audio_player.c` |
| Kat listesi | `sd_floors_load` | CSV `int8,left,right` | `sd_config.c:362` |
| Yerleşim | `sd_load_template_layout` | `layout.cfg` | `sd_config.c:292` |

**Yapılmaması gerekenler**

- `havuzUygula` içine `if (vanilla)` eklemek (`tema_kaynak.h` sınav cümlesi).
- `sahne_degerlendir` içinde SD açmak (ISR/UART bağlamı, yalnız RAM).
- Bilinmeyen `tema.cfg` satır türünü çökertmek (bugün atlanır).
- `state=`-yalnız kuralı eski parser’a bırakmak (jeton düşünce yangın varsayılan olur).
- Arena’ya Binding tablosu ekleyip ölçmeden `BINDING_MAX` uydurmak.

---

## 3. V1 — STM32 değişiklik listesi

**P0 firmware C: boş.**

V1 kabul testi değiştirilmemiş `feb5f56` ELF ile geçer: kartta `tN/r0/tema.cfg` + `layout.cfg` + `img/` vardır.

STM32 tarafında V1’de yalnızca **test/doküman** işi vardır (davranış değişmez):

| ID | Alan | Bugün | İstenen | Neden | Şiddet | Bağımlılık | Zorluk | Donanım riski | Test |
|---|---|---|---|---|---|---|---|---|---|
| S-V1-01 | Test | `state=` üretilmiyor | Eski `sahne_yukle` ile `state=fire` yalnız satırın `kosul_n==0` yaptığını **kanıtlayan** golden (kırmızı = derleyici hatası) | Fail-open | P1 test | V2 derleyici | düşük | yok (PC/kart fixture) | `tools/testing/` veya host fixture |
| S-V1-02 | Gözlem | `widget_dusen` / `kural_dusen` DTCM | V2 dumanında UART/SWD checklist | Paket aşımı | P2 | PR-18 | düşük | yok | `nabiz` / evlog |
| S-V1-03 | Docs | `AGENTS.md` Qt yazıcı | Zaten V2 repo’ya işaret ediyor (`feb5f56`) | — | — | — | — | — | — |

Firmware kaynaklarına V1’de **patch yok**.

---

## 4. V1 sonrası — STM32’de gerçek C değişiklikleri

Bunlar **yalnız** V2 derleyici + değiştirilmemiş firmware dumanı yeşil olduktan sonra. Hepsi isteğe bağlı ürün adımıdır.

### P1 — semantik genişleme (hala satır parser)

| ID | Alan | Bugün | İstenen | Neden | Şiddet | Bağımlılık | Zorluk | Donanım riski | Test |
|---|---|---|---|---|---|---|---|---|---|
| S-01 | `liste` çok dosya | `tema_liste_t` tek `dosya[64]` (`sahne_motoru.h:133`); parser ilk yolu alır (`sahne_motoru.c:322`) | Sıralı öğe: image/video, süre, tekrar | Media Slide V2 | P1 | ürün kararı; JPEG+MJPEG sırası | orta | SD çekişme, video assert | slayt 2 öğe; okuyucu kapalıyken gizle |
| S-02 | `state=` jetonu | `jeton_kosul` yalnız `bN`/`kat` (`:165`); bilinmeyen düşer | `state=fire` **ve** derlenmiş `b3&0x20` aynı satırda | Designer bit yazmasın | P1 | LOP→canonical tablo; **asla yalnız `state=`** | orta | alarm fail-open | eski ELF + yeni kart: yangın varsayılan **olmamalı** |
| S-03 | `config.txt` / profil sürümü | `sd_config_read` TEMPLATE/ORIENT/VOLUME… | İsteğe bağlı `PROFILE_VER=`; yoksa yok say | Registry kayması uyarısı | P2 | Designer manifest | düşük | yok | eski kart yüklenir |
| S-04 | `layout.cfg` emekliliği | `Screen1View` `m_layout` okur (`:144` civarı) | Çizim %100 `w` satırı kanıtlanınca yazmayı kesmek **okumayı kesmek değil** | Çift otorite | P2 | V2 hikâye B kanıtı | orta | rakam/logo kayması | r0 ve r90 digit `adim` |

### P2 — runtime model

| ID | Alan | Bugün | İstenen | Neden | Şiddet | Bağımlılık | Zorluk | Donanım riski | Test |
|---|---|---|---|---|---|---|---|---|---|
| S-05 | Canonical state | `arkel_feed` bitleri sahne motoruna ham | Önce `fire/floor/door_state/…` RAM, sonra sahne eşle | Binding/Scene Designer ile aynı isimler | P2 | bit-eşdeğer golden (`VARSAYILAN_SAHNE_KURALLARI` git geçmişi) | yüksek | sahne yanlış | 65536 çerçeve A/B (eski PLAN) |
| S-06 | Binding tablosu | yok | `tema.cfg` `binding` satırı; öncelik 0–15; show/hide/play | Sahne-içi kural | P2 | **arena/DTCM ölçümü zorunlu**; `BINDING_MAX` uydurulmaz | yüksek | her kare maliyet, video donması | salınım sayacı; alarm fail-closed |
| S-07 | Kat string | `int kat`, `floor_num` int8 | NFC string runtime + `kat=` sayı hâlâ | `Restaurant` | P2 | glif kapsamı | yüksek | digit boş/yanlış | floors.csv + harf RAW |
| S-08 | `W_LIST` / `W_CLOCK` | firmware’de var | V2 union’da yok; STM32 değişmez | Designer eksik | — | Designer | — | — | — |

### P3 — yapılmaması gereken / çok pahalı

| ID | Alan | Bugün | İstenen | Neden redd / geciktir | Şiddet |
|---|---|---|---|---|---|
| S-09 | MCU JSON | yok | `theme.json` oku | Flash/RAM ölçülmedi; eski kart; çökme yüzeyi | P3 — V1 yok |
| S-10 | TTF raster | yok | MCU’da font | CPU/SD; atlas Designer işi | P3 — yasak |
| S-11 | H264 | MJPG HW | H264 yazılım | Bütçe/decoder yok | P3 — yasak |
| S-12 | 5 kanallı mikser | FON+ANONS | 5 otobüs | Ürün kararı yok; I2S tek çıkış | P3 — **PRODUCT DECISION REQUIRED** |
| S-13 | LTDC rotasyon | FB 720×1280 sabit | HW rotate | Donanım döndürmez (`tema_yapisi.md`) | P3 — paket ön-döndürür |

---

## 5. Değişirse hangi dosyalar

V1: **hiçbiri (uygulama C).**

| ID | Dosyalar (ileride) |
|---|---|
| S-01 | `sahne_motoru.h` (`tema_liste_t` dizi), `sahne_motoru.c` liste parser, `Screen1View.cpp` medya sırası |
| S-02 | `sahne_motoru.c` `jeton_kosul` + `kosul_dogru`; **dual emit** zorunlu |
| S-03 | `sd_config.h/.c` yeni anahtar, yok sayma |
| S-04 | `Screen1View.cpp` `m_layout` kullanımını daralt; `sd_load_template_layout` kalır |
| S-05 | `sahne_motoru.c`, `arkel` feed, vanilla varsayılan tablo |
| S-06 | `sahne_motoru.h` yeni tablo, `havuzGorunurlukTazele`, arena |
| S-07 | `sd_config.h` `floor_entry_t`, `kat.c`, `jeton_kosul` |

TouchGFX generated / CubeMX: elle yazılmaz (`AGENTS.md`).

---

## 6. STM32’nin V2’den **isteyeceği** paket (C değişmeden)

Derleyici bunları basmazsa firmware “eksik özellik” değil, **boş tarama / vanilla** verir.

```text
0:/config.txt                 TEMPLATE=, ORIENTATION=  (VOLUME/LANG ezme)
0:/t<N>/r0|r90|r180|r270/
    layout.cfg                tarama + m_layout
    tema.cfg                  sahne … b3&0x20 ; w … tur=arrow ad≤15
    img/*.raw|.bmp|.jpeg
    video/*.avi               fourcc MJPG, Σ px ≤ 921600
0:/t<N>/font/<ad>.raw+.cfg    text varsa
0:/t<N>/audio/                FON WAV
0:/t<N>/data/floors.csv       int8,left,right
```

STM32 şunları **istemez:** `template-designer/`, `.asset.json`, UUID `ad`, `tur=direction`, `state=`-yalnız, MP4, TTF, Binding JSON.

---

## 7. Sıra (STM32 mühendisi)

```text
0. V2 derleyici + kart 0:/tN     ← bu depo dışında
1. Değiştirilmemiş ELF dumanı    ← S-V1-02
2. (isteğe bağlı) S-01 slayt
3. S-05 canonical state + golden
4. S-02 state= dual-emit
5. S-06 Binding ancak ölçümden sonra
```

Adım 0 bitmeden 2–5 **başlatılmaz**.

---

## 8. Kabul (STM32)

V1 yeşil:

- Aynı ELF (`feb5f56` veya sonrası davranış-eşit)
- `sd_scan_templates` ≥ 1
- `sahne_yukle` true, `*_dusen == 0` golden temada
- Yangın: uyarı görünür, digit/ok gizli
- Video yalnız MJPG + `sahne=` + okuyucu açık
- Vanilla kartsız hâlâ ayağa kalkar

V1 kırmızı (firmware “eksik” değil, paket yanlış):

- Kartta yalnız `template-designer/*.json`
- `tur=warning` / UUID ad
- H264 AVI

---

## 9. İlişkili belgeler

- Üst sözleşme: `docs/TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md` §25–26
- Binding: `docs/template-designer/research/binding_yapisi_20260819.md`
- Uyumluluk taraması: `docs/template-designer/reports/v2_firmware_uyumluluk_20260819.md`
