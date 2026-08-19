# STM32 Binding motoru — nasıl kurulur

| Alan | Değer |
|---|---|
| Repo | MyApplication_6 (STM32) + Template Designer V2 |
| Baseline | `feb5f56` parser; belge 2026-08-19 |
| Kapsam | Araştırma. C yazılmadı. |
| Önceki not | `binding_yapisi_20260819.md` — Binding’i yalnız `sahne=` yapmak. **Bu belge MCU’da gerçek Binding tablosu.** |

**Neden ayrı:** Binding STM32 tarafında **önemli**. Sahne üyeliği (`sahne=`) Binding’in yerine geçmez. `floor==5` overlay, yangında videoyu durdur, aynı sahnede iki kural — bunlar sahne sayısını 16’ya şişirmeden **cihazda** çözülmeli.

`varlik <ad> : dosya` Binding değildir (dosya haritası).

---

## 1. Ne kurulacak

Designer Binding (`models.ts:115-140`):

- Koşul: DeviceProfile state (`fire`, `floor`, `door_state`, …), op, değer, NOT, all/any
- Eylem: show hide play pause stop restart continue select-content select-style
- Öncelik **0–15** (sahne önceliğinden bağımsız)
- Kazanan: yüksek priority; eşitlikte belge sırası

STM32 bugün (`sahne_motoru.c`, `havuzGorunurlukTazele`):

- Sahne seçer (ARKEL bit/kat)
- Widget `sahne=` listesinde mi bakar
- Video: görünür ⇒ play, gizli ⇒ pause
- Binding kaydı **yok**

Kurulacak üç parça, sırayla:

```text
1) Canonical runtime snapshot   (ARKEL → RAM state, Designer bit yazmaz)
2) tema.cfg `binding` satırları (yüklemede RAM tablo; karede SD yok)
3) havuzGorunurlukTazele içinde Binding değerlendir
```

JSON MCU’ya konmaz. Satır parser `sahne_yukle` genişler.

---

## 2. Katmanlar (karıştırma)

| Katman | Soru | Sahibi | Disk |
|---|---|---|---|
| A Sahne | Hangi sunum aktif? | `sahne_degerlendir` | `sahne yangin : b3&0x20` |
| B Üyelik | Widget bu sahnede **var mı**? | `sahne_tanim_gorunur` | `w … sahne=bosta,yangin` |
| C Binding | Bu sahnede **ne yapsın**? | **yeni motor** | `binding …` |

Kural:

- Binding, üye olmadığı sahnede widget **açmaz** (fail-closed). Yangın + `show` Binding, widget `sahne=`’de `yangin` yoksa geçersiz.
- Binding `hide`, üyelik true olsa da gizler.
- Digit/ok **içeriği** Binding değildir (ARKEL kat/yön). Binding onları gizleyebilir, kat numarasını seçemez.

Yalnız B ile C’yi birleştirmek (`sahne=` derlemek) `SAHNE_MAX=16` ve `WIDGET_SAHNE_LEN=96` altında kat-özel overlay’i taşıyamaz. STM32 Binding bunun için.

---

## 3. Canonical state (Binding koşulunun dili)

Binding `b3&0x20` yazmaz. MCU ARKEL’i **önce** state’e çevirir; Binding state okur.

Önerilen snapshot (AXI SRAM, `arkel_feed` yazar, UI okur — tek yazar):

```c
typedef struct {
    uint8_t  fire;          /* 0/1 */
    uint8_t  overload;      /* 0/1 */
    uint8_t  service_out;   /* 0/1 */
    uint8_t  door;          /* 0 closed 1 opening 2 open 3 closing */
    uint8_t  travel;        /* 0 idle 1 up 2 down */
    int16_t  floor;         /* LOP çözümü; Unicode V1 dışı */
    uint32_t seq;           /* g_arkel_seq kopyası */
} runtime_state_t;
```

Doldurma: mevcut `arkel_feed` / `g_arkel` alanlarından (`Screen1View.cpp` zaten `g_arkel.floor`, `door_open`, `elev_state` okur). Bit tablosu **firmware içi**; Designer’a çıkmaz.

Eşleme (Designer `stateId` → enum). Tablosuz id **yüklemede düşer**, sayaç, çökme yok.

`contains` / NFC string kat: V1 MCU’da **yok**. `floor equals 5` → `floor == 5`.

---

## 4. RAM kaydı (önerilen)

`sahne_kosul_t` 4 bayt. Binding kaydı aynı stilde, sabit dizi, heap yok.

```c
#define BAG_MAX          32   /* ölçümden sonra sıkılaştır */
#define BAG_KOSUL_MAX     4   /* Designer ile aynı AND tavanı */

enum {
    BAG_SHOW = 0, BAG_HIDE,
    BAG_PLAY, BAG_PAUSE, BAG_STOP, BAG_RESTART, BAG_CONTINUE,
    BAG_SEL_ICERIK, BAG_SEL_STIL,   /* V1: yükle, uygula sonra */
    BAG_BILINMEZ
};

typedef struct {
    uint8_t  widget_ix;     /* tema_widget[] indisi, ad ile çözülür */
    uint8_t  eylem;         /* BAG_* */
    uint8_t  oncelik;       /* 0..15 */
    uint8_t  all;           /* 1 = AND, 0 = OR */
    uint8_t  kosul_n;
    uint8_t  sira;          /* belge sırası, eşit priority tie-break */
    uint8_t  icerik_ix;     /* varlik[] veya 0xFF yok */
    uint8_t  _pad;
    struct {
        uint8_t state;      /* ST_FIRE … ST_FLOOR */
        uint8_t op;         /* EQ NEQ GT LT */
        uint8_t not;
        int16_t deger;
    } kosul[BAG_KOSUL_MAX];
} tema_bag_t;               /* ~ 8 + 4*5 ≈ 28–32 B */
```

32 × 32 B ≈ **1 KB** `.bss` (AXI SRAM). DTCM’ye konmaz (128 K yığın/bayrak). Teşhis sayacı (`bag_dusen`, `bag_uygula`) `.dtcm_flags`.

`BAG_MAX` uydurma tavan: ilk saha temasında `bag_dusen` ve `sd_arena_kullanilan` ölçülür; 32 yetmezse artırılmaz, Designer Validate keser.

16 widget × 32 binding × 4 koşul: UI karesinde mikrosaniye; DMA2D yanında ucuz. **UART ISR’da Binding yok** — `sahne_degerlendir` gibi yalnız RAM, ama çağrı yeri `havuzGorunurlukTazele` (TouchGFX görevi). Snapshot ISR’da güncellenir.

---

## 5. Disk satırı (`tema.cfg`)

`sahne_yukle` yeni tür; bilinmeyen eski firmware’de **satır türü atlanır** (yalnız `sahne `/`w `/`liste `/`varlik ` tanınır). Eski ELF + yeni kart: Binding yok sayılır, yalnız `sahne=` kalır — **bozulma = özellik yok**, yangın varsayılan sahne **değil** (`state=` sahne satırına konmaz).

```text
binding <widget_ad> : oncelik=12 all eylem=hide st=fire eq=1
binding overlay : oncelik=5 all eylem=show st=floor eq=5
binding videoWidget1 : oncelik=10 all eylem=pause st=fire eq=1
```

Kurallar:

- `widget_ad` mevcut `w` `ad` (≤15). Yoksa `bag_dusen++`.
- `st=` firmware enum adı (`fire floor door travel overload service`). Ham `b3&` **yasak** (Designer da yazmaz; derleyici `st=` basar).
- `eylem=` bilinmiyorsa satır düşer, çökmez.
- `select-content` V1: yok veya `icerik=` `varlik` adı; uygulanmazsa Validate Designer’da.
- Öncelik 0–15 dışı: düş.

Yükleme: tema değişince tablo sıfırlanır (`sahne_yukle` başı gibi). Karede `f_open` yok.

---

## 6. Değerlendirme (her UI karesi)

`havuzGorunurlukTazele` mevcut sıra korunur, Binding **üyelikten sonra**:

```text
menu açık?           → her şey gizli (Binding yok)
ARKEL yok + digit/ok → gizli
sahne_tanim_gorunur  → üyelik (fail-closed alarm)
sonra binding_uygula(widget):
    adaylar = bu widget_ix, koşul eşleşen
    sırala: oncelik desc, sira asc
    son kazanan eylemi uygula
    hiç aday yok → üyelik sonucu (Binding yok = dokunma)
```

Koşul: `runtime_state_t` alan op değer; `not` tersler. `all` hepsi, aksi biri.

Eylem:

| Designer | STM32 V1 Binding |
|---|---|
| show | `setVisible(true)` (üyelik zaten true şart) |
| hide | `setVisible(false)` |
| play | video: görünür + `play()` (okuyucu kapalıysa **açma**, assert yolağı) |
| pause/stop | `pause` + isteğe gizli |
| restart | `stop`+`play` eğer API varsa; yoksa play | **UNKNOWN** VideoWidget API doğrulanacak |
| continue | no-op veya play | **UNKNOWN** |
| select-content | V1 uygulamaz (`bag_yoksay`) |
| select-style | V1 uygulamaz |

Video: Binding play, okuyucu kapalıysa görünür yapma (`Screen1View.cpp:3559` dersi). Binding hide yangında video: üyelikte yangın olmasa bile `sahne=`’de varsa hide gerekir — yangın sahnesinde video üyeliği genelde yok; Binding hide `bosta` içinde fire==true için: **fire iken sahne zaten yangın** ise widget `bosta` üyesiyse sahne değişince üyelik gizler. Asıl Binding kazancı: **aynı sahnede** (ör. boşta) `floor==5` overlay.

Çekişme yasağı: Binding her kare `setVisible` yazarsa `show*State` ile savaşır. Görünürlük **tek sahip** `havuzGorunurlukTazele` kalır; Binding yalnız o fonksiyona girdi verir. `g_havuz_sal_cnt` Binding yüzünden durum sabitken artmamalı (önbellek: son eylem).

---

## 7. Alternatifler

| Yol | Artı | Eksi | Karar |
|---|---|---|---|
| A. Yalnız `sahne=` derle | C yok | Kat overlay, aynı sahne iki kural, 16 sahne tavanı | Binding’i önemsiz sayar — **red** (kullanıcı: STM32 Binding önemli) |
| B. MCU Binding + canonical state (seçilen) | Designer modeli cihazda | C + parser + ölçüm | **kabul** |
| C. Binding’i sahne çoğalt (her floor bir sahne) | Parser yok | `SAHNE_MAX=16` biter | yalnız birkaç kat için yedek |
| D. JSON Binding MCU | V2 dosyası | parser yok, RAM | **red** |

B içinde faz:

1. Snapshot (`runtime_state_t`) — Binding satırı yok, davranış değişmez  
2. Parser + tablo, eylem show/hide  
3. play/pause video  
4. Ölçüm; select-content

---

## 8. STM32 iş listesi (kod sonra)

| Adım | Dosya | Not |
|---|---|---|
| 1 | `arkel_link` / feed | `runtime_state_t` doldur; bit Designer’a çıkmaz |
| 2 | `sahne_motoru.h/.c` | `tema_bag_t`, `BAG_MAX`, `binding_yukle` dalı `sahne_yukle` içinde |
| 3 | `sahne_motoru.c` | `bag_degerlendir(widget_ix, &state)` |
| 4 | `Screen1View.cpp` `havuzGorunurlukTazele` | üyelik ∧ Binding; video assert koruması |
| 5 | Vanilla | Binding yok = eski davranış |
| 6 | Ölç | `bag_n`, `bag_dusen`, kare süresi DWT, arena |

CubeMX/TouchGFX generated: dokunulmaz.

Eski kart: `binding` satırı yok → adım 4 no-op.

Yeni kart + eski ELF: `binding` satır türü atlanır; özellik yok, yangın bozulmaz.

---

## 9. Designer’ın basacağı şey

STM32 `st=fire` bekler, UUID Binding id değil.

- `widgetId` → kısa `ad` (≤15)
- `stateId` → `st=` enum (profil tablosu)
- `priority` 0–15
- `action` → `eylem=`
- Koşul değeri int (floor string int değilse **yayın kes**)

Designer Preview aynı snapshot semantiğini taklit etmeli (aksi halde “PC’de var cihazda yok”).

---

## 10. Risk

| Risk | Azaltma |
|---|---|
| Her kare çekişme | Tek sahip `havuzGorunurlukTazele` |
| Video assert | play ancak `isOpen()` |
| `BAG_MAX` sessiz kırpma | `bag_dusen` + Designer tavan |
| Canonical state kayması | Enum + profil sürümü; bilinmeyen `st=` düş |
| Binding show alarm fail-open | Üyelik AND; alarmda üye değilse show yok |
| ISR’da Binding | Yasak |

---

## 11. Kabul (motor yeşil)

- Binding’siz kart = bugünkü ekran (A/B)
- `floor eq=5` overlay yalnız kat 5
- `fire eq=1 eylem=hide` video yangında durur (üyelik + Binding)
- Öncelik 12 hide, 5 show → gizlenir
- Eski ELF yeni `binding` satırını yok sayar, yangın varsayılan olmaz
- Salınım sayacı durum sabitken +0 (`salinim.py` dersi)

Bu yeşil olmadan `select-content` açılmaz.
