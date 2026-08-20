# Compiled Event–State–Binding Runtime Engine — Uygulama Planı

| Alan | Değer |
|---|---|
| Repo | MyApplication_6 (`SAVAS-7-A12-sadelestirme`) |
| Baseline commit | `feb5f56c721ba87b6b35d96cb3945427faff2ad6` (parser/sözleşme); bu belge **2026-08-20** kaynak taraması |
| Kapsam | Araştırma + mimari + uygulama planı. **C/TS ürün kodu yazılmadı.** |
| Prompt | kök `prompt.txt` (COMPILED RUNTIME RULE ENGINE) |
| Kardeş belgeler | `docs/template-designer/research/stm32_binding_motoru_20260819.md`, `stm32_binding_mantik_operatorleri_20260819.md`, `docs/TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md` |
| Kanıt kuralı | Her mevcut yetenek: FILE / SYMBOL / STRUCT / DATA FLOW / REASON. Uydurma yok. |

Etiketler: **CURRENT** · **PROPOSED** · **REQUIRED** · **OPTIONAL** · **UNRESOLVED** · **UNKNOWN — NEEDS VERIFICATION**

Designer derler. STM32 derlenmiş kuralları çalıştırır. MCU’da ifade string parser, JSON, özyinelemeli AST, Binding için heap **yok**.

---

# 1. Executive Summary

Önerilen zincir (DataSource → RuntimeState/Event → Logic IR → Binding → OnTrue/OnFalse → Action Dispatcher → Target) mevcut firmware ile **uyumludur**: yeni bir işletim sistemi veya sahne motoru yazılmaz. Mevcut sistem zaten üç parçayı ayrı ayrı yapıyor; Binding bunları birleştiren **eksik katmandır**.

| Parça | Bugün | Runtime engine’de |
|---|---|---|
| Dış veri | USART1 9-bit → `arkel_rx_9bit` → `arkel_feed` | DataSource + ProtocolAdapter (**WRAP**) |
| Durum | `g_arkel` + `g_sahne` + DTCM bayrakları | RuntimeState snapshot (**NEW** ince kabuk) |
| Mantık | `sahne_degerlendir` AND-satır / OR-çok-satır (DNF) | Logic IR = aynı model Binding’e taşınır (**REUSE**) |
| Eylem | `havuzGorunurlukTazele` `setVisible` / `play` / `pause` | Action Dispatcher (**WRAP**, tek sahip korunur) |
| Binding tablosu | **yok** | **NEW** (`tema_bag_t`, `tema.cfg` `binding` satırı) |
| Olay kuyruğu | Genel yok; `seq` / DTCM bayrak / `g_menu_cmd` | RuntimeEvent V1 **türetilir**, yeni bus V1’de yok |

**V1 minimum:** canonical `runtime_state_t` + DNF Binding tablosu + `SET_VISIBLE`/`PLAY`/`PAUSE` + üyelik AND + öncelik 0–15. Sahneyi Binding ile değiştirmek, LED desen, serbest `SET_TEXT` şablonu, `select-content`, postfix VM, OnFalse her kare **V1 dışı**.

**Küçük sağlam çekirdek:** Designer DNF basar; STM32 `sahne_degerlendir` ile aynı AND/OR’u Binding satırında çalıştırır; eylem yalnız `havuzGorunurlukTazele` içinden uygulanır.

---

# 2. Firmware Baseline

| Öğe | Kanıt |
|---|---|
| MCU (build) | `STM32H747XIHx` — CubeIDE `.cproject` / `STM32H747XIHX_FLASH.ld` |
| MCU (CubeMX) | `STM32H747BITx` LQFP208 — `STM32H747I-DISCO.ioc` `Mcu.Name`. **ÇELİŞKİ:** aynı aile, paket farklı. Kaynak: **derlenen XIH**. |
| Çekirdekler | CM7 uygulama (FreeRTOS); CM4 bare-metal `LED2` PC4 500 ms toggle. CM4’te FreeRTOS **yok**. |
| Branch | `SAVAS-7-A12-sadelestirme` |
| Parser/tema | `sahne_yukle` — satır türleri `w ` / `varlik ` / `liste ` / `sahne ` (`sahne_motoru.c:230-358`). `binding` **yok**. |
| JSON | CM7 tema yolunda JSON parser **yok**. |
| Heap Binding için | **Derlenen** `CM7/Core/Inc/FreeRTOSConfig.h` `configTOTAL_HEAP_SIZE = 100000`. `Config/FreeRTOSConfig.h` 128 KB **kullanılmayan kopya**. `pvPortMalloc` FatFS + LibJPEG. Binding heap **kullanmaz**. |

Bu belge önceki Binding notlarını **genişletir**, çelişmez: sahne üyeliği (`sahne=`) Binding’in yerine geçmez; MCU’da tablo gerekir.

---

# 3. Existing Architecture Map

## 3.1 Donanım (CURRENT)

| Öğe | Değer | Kanıt |
|---|---|---|
| MCU ailesi | STM32H7 dual-core Cortex-M7 + M4 | `STM32H747I-DISCO.ioc` CortexM7 IP listesi |
| CM7 saat | **480 MHz** (`RCC.CpuClockFreq_Value=480000000`) | `.ioc` |
| CM4 saat | **240 MHz** (`RCC.CPU2Freq_Value=240000000`) | `.ioc` |
| HCLK | 240 MHz (`HPRE=DIV2`) | `.ioc` |
| Flash CM7 | `0x08000000` 1024 K | `docs/memory/06_memory_and_linker.md` + `STM32H747XIHX_FLASH.ld` |
| DTCM | `0x20000000` 128 K — `.dtcm_flags`, yığın, `g_arkel` | `savas_bayraklar.h`, `main.c` `DTCM_FLAGS` |
| AXI SRAM D1 | `0x24000000` 512 K — `.bss`/`.data`, FatFS | linker |
| SDRAM | `0xD0000000` 16 M — framebuffer, video, `.sd_media` | MPU Region 2 non-cacheable |
| QSPI | Linker/MPU 32 M @ `0x90000000` | `HAL_QSPI_MODULE_ENABLED` **kapalı**; sürücü **yok**. Harici RAM = FMC SDRAM |
| Panel | 720×1280 DSI, ~52,8 Hz tarama | `docs/architecture/01_architecture_overview.md` |
| Grafik | LTDC + DMA2D | `.ioc` IPs: LTDC, DMA2D, DSIHOST, JPEG |
| Video | Donanım JPEG + MJPEG/AVI | `HardwareMJPEGDecoder`, `VIDEO_BUDGET_PX=921600` |
| Ses | I2S1 + DMA, mix **44100** | `audio_player.c`, `hi2s1` |
| SD | SDMMC1 + FatFS | `sd_durum.c`, `sd_diskio.c` |
| Saha seri | USART1, USER CODE **9600 / 9-bit** | `main.c:1863-1864` Cube varsayılan 115200/8B **ezilir** |
| CAN | Cube IP listesinde **yok**; `RCC.FDCANFreq_Value` saat ağacı kalıntısı | `.ioc` `CortexM7.IPs=...USART1...` FDCAN IP değil |
| Ethernet | Cube IP listesinde **yok** | aynı |
| RS485 sürücü | Ayrı transceiver API **yok**; fiziksel hat USART1 | CURRENT: UART asenkron |

**REASON:** CubeMX IP listesi saha IO’yu USART1 + SDMMC + I2S1 + DSI/LTDC/JPEG ile sınırlar. Çoklu DataSource (CAN/ETH) donanımda **yok**; V1’de tasarlanmaz.

## 3.2 Bellek (CURRENT)

FILE: `STM32CubeIDE/CM7/STM32H747XIHX_FLASH.ld`, `docs/memory/06_memory_and_linker.md`

| Bölge | Kullanım Binding için |
|---|---|
| DTCM 128 K | Snapshot teşhis sayaçları (`bag_dusen`). Tablo **konmaz** (sahne motoru da DTCM’de değil: `main.c:2116`) |
| AXI SRAM 512 K | `tema_bag_t[]` + `runtime_state_t` (`.bss`) |
| SDRAM 16 M | Binding **yok**; video/asset |
| FreeRTOS heap 128 K | Binding **yasak** |

`g_sahne` (`sahne_motoru_t`) AXI SRAM’de: “DTCM’de degil (buyuk + yalniz task/ISR RAM okur)” — `main.c:2114-2116`. Binding tablosu aynı kural.

## 3.3 RTOS (CURRENT)

FILE: `CM7/Core/Src/main.c` `osThreadNew` (~1139–1188)

| Görev | İş |
|---|---|
| `TouchGFXTask` | UI, `havuzGorunurlukTazele`, Binding **tüketici** (PROPOSED) |
| `videoTask` | MJPEG üretici |
| `defaultTaskUART` | `HAL_UARTEx_ReceiveToIdle_IT` döngüsü; saha LOP **bu görevde çözülmez** |
| `audioTask` | FON+ANONS mix; `g_ab_noaudio==0xA5` ise açılmaz |
| `buttonsTask` | 20 ms tarama, LED1/LED6, SD yoklama çağrıları |
| `sdfsTask` | SWD dosya komutu + `rtc_poll_settime` |
| `videoDebugTask` | video bekçisi |

Kuyruklar: `UARTQueue` (CMSIS `osMessageQueue`, ASCII debug), FatFS `SDQueueID`, `s_audioQueue` (anons). **Genel uygulama event queue yok.** `configUSE_TIMERS=1` ama `osTimerNew` / `xTimerCreate` CM7 uygulamasında **0 eşleşme** — FreeRTOS yazılım timer **kullanılmıyor**.

## 3.4 Çizim yolu (CURRENT)

```
tema.cfg | vanilla  →  tema_kaynagi  →  havuzUygula  →  havuz yuvası
                                              ↑
                              sahne_motoru (görünürlük anahtarı)
                                              ↓
                         TouchGFX + DMA2D → frameBuf[2] @ 0xD0000000 → LTDC → DSI
```

FILE: `tema_kaynak.h`, `Screen1View.cpp` `havuzUygula` / `havuzGorunurlukTazele`.

Sahne motoru piksel üretmez. Binding de **piksel üretmez**.

---

# 4. Existing Data Flow

Saha protokolü **uygulama detayıdır**. Genel isimler: DataSource / ProtocolAdapter / RuntimeState. Üretici adı mimari sözleşmeye girmez.

## 4.1 Saha seri (CURRENT) — asıl canlı yol

```
USART1 RXNE IRQ
  → USART1_IRQHandler          FILE stm32h7xx_it.c:224
  → arkel_rx_9bit(RDR & 0x1FF)  9. bit = çerçeve başı/uzunluk
  → arkel_feed(buf, len)        checksum 0x33, id 0x0B
  → g_arkel + g_arkel_seq++     DTCM
  → sahne_degerlendir(&g_sahne, p, kat)   ISR/görev RAM-only
  → TouchGFX handleTickEvent
       arkelBaglantiTuket / arkelTuket    seq değişince UI
       havuzGorunurlukTazele              görünürlük tek sahip
```

| Adım | FILE / SYMBOL | REASON |
|---|---|---|
| IRQ | `stm32h7xx_it.c:USART1_IRQHandler` | RDR HAL’den **önce** okunur; 9. bit kaybolmasın |
| Framing | `main.c:arkel_rx_9bit` | `v&0x100` → uzunluk |
| Decode | `main.c:arkel_feed` | `len<4 \|\| fr[0]!=len \|\| fr[1]!=0x0B` reddet |
| State | `arkel_state_t g_arkel` | `arkel_link.h:24-35` |
| Sahne | `sahne_degerlendir` | `sahne_motoru.c:41` |
| UI | `Screen1View::arkelTuket` | `g_arkel_seq != son_seq` |

**Bağlam:** `arkel_feed` USART ISR içinden çağrılır (`arkel_rx_9bit` IRQ). `sahne_degerlendir` yorumu: ISR’da güvenli, yalnız RAM. **Binding bu yolda olmaz** — ISR’da widget/TouchGFX yasak.

## 4.2 Demo / SWD (CURRENT)

`arkel_link.h`: demo **aynı** `arkel_feed` girişine yazar. `g_demo_zorla` DTCM. TIM6 sanal çerçeve üretir (`arkel_sanal`). DataSource çeşitliliği zaten var: seri **veya** sanal, tek adapter.

## 4.3 ASCII UART kuyruğu (CURRENT, ayrı kanal)

`HAL_UARTEx_RxEventCallback` (`main.c:279`) baytı `UARTQueue`’ya koyar; `Model::tick` `SET:T=` / `MENU`… parse eder.

**Çakışma riski:** IRQ RDR’yi tüketir, sonra `HAL_UART_IRQHandler` çalışır. Saha 9-bit LOP ile ASCII idle-RX **aynı USART1**. Bu yol menü/debug içindir; Binding DataSource’u **değil**.

**PROPOSED:** ProtocolAdapter = yalnız `arkel_feed` çıktısı. ASCII kuyruk System/debug kalır.

**İkinci UI enjeksiyonu (CURRENT):** `Model::tick` CSV `N,D,S,E` **`g_arkel` yazmaz**; `asansorDurumUygula` doğrudan. Binding snapshot `g_arkel` okursa bu yol **görünmez**. V1 Binding bu ASCII yolu **kapsamaz** (saha + demo `arkel_feed`).

## 4.4 Zaman aşımı

`ARKEL_TIMEOUT_MS=3000` — `Screen1View.cpp:611`. `g_arkel_seq` 3 sn artmazsa `m_arkel_link=false`; digit/ok gizlenir. Bu **CAN BE DERIVED** event: `DATA_TIMEOUT` / `DATA_LOST`.

---

# 5. Existing State System

Kaynak: kod. İsimler uydurulmadı.

## 5.1 Saha çözülmüş durum

| Alan | Tip | Yer | Yazar | Tüketici | Kalıcı | Olay? |
|---|---|---|---|---|---|---|
| `g_arkel.floor` | `int8_t` | DTCM | `arkel_feed` ISR | `arkelTuket`, digit | hayır | seq değişince **türetilir** |
| `g_arkel.elev_state` | `uint8_t` 0–9 | DTCM | feed + `sahne_elev_state` | UI/anons kenarı | hayır | evet (kenar) |
| `g_arkel.door_open` | `uint8_t` | DTCM | feed | UI | hayır | evet |
| `g_arkel.error_code` | `uint8_t` | DTCM | `p[9]` | az tüketim | hayır | **UNKNOWN** UI’da tam kullanım |
| `g_arkel.left_ch/right_ch` | `char` | DTCM | feed | digit glif | hayır | hayır |
| `g_arkel.raw[12]` | `uint8_t` | DTCM | feed | `sahne_degerlendir` | hayır | hayır |
| `g_arkel_seq` | `uint32_t` | DTCM | feed ++ | UI poll | hayır | **DATA_RECEIVED türevi** |

STRUCT: `arkel_state_t` `arkel_link.h:24`.

`elev_state` sözleşme (`arkel_link.h:26-28`): 0 BOSTA 1 YUKARI 2 ASAGI 3 KAPI ACILIYOR 4 KAPI KAPANIYOR 5 ESTOP 6 YANGIN 7 ASIRI YUK 8 SERVIS DISI 9 MESGUL.

## 5.2 Sahne motoru durumu

STRUCT: `sahne_motoru_t g_sahne` `sahne_motoru.h:162` / `main.c:2116`

| Alan | Anlam |
|---|---|
| `kural[]` / `kural_n` | Sahne kuralları, `SAHNE_MAX=16` |
| `widget[]` / `widget_n` | `WIDGET_MAX=16` |
| `aday` / `secili` | Anlık vs debounce (`SAHNE_ONAY_N=3`) |
| `hazir` | Yükleme sırasında 0 |
| `varsayilan_ix` | `kosul_n==0` ilk kural |

`g_sahne_surucu=1` motor sürer (`main.c:2132`). **Sapma (CURRENT):** `elev_state` köprüsü `g_sahne.aday` (anlık); görünürlük `g_sahne.secili` (3 çerçeve debounce). Binding koşulu sahne adına bağlanırsa hangisinin kullanılacağı **UNRESOLVED** — öneri: görünürlük ile aynı, `secili`. Cascade A/B yedek durur.

UI ayrıca `Screen1View::m_elev_state` (`ST_TRAVEL/IDLE/ACTION/WARNING`) tutar; `m_action_ticks` ~300 tick (~5 s) ACTION→IDLE. Bu **ikinci** durum makinesi Binding snapshot’ına **girmez** (V1 `g_arkel` + `secili`).

## 5.3 SD

FILE: `sd_durum.h`

| Sembol | Anlam |
|---|---|
| `g_sd_present` | kart var |
| `g_sd_lost` | tek atımlık → vanilla |
| `g_sd_reinit` | tek atımlık → varlık tazele |
| `g_sd_izin` | çekiş kapısı |
| `g_quick_apply` | temayı yeniden uygula |

Detect pini sokete **bağlı değil** (`main.c:727` yorum). Yazılımsal remount.

## 5.4 Saat

| Sembol | Yazar | Not |
|---|---|---|
| `g_saat_sn/dk/sa/gun/ay/yil` | TIM6 ~1 s RTC oku | `main.c:188-193` |
| `g_saat_tazele` | TIM6=1, UI temizler | SECOND tick **EXISTS** (bayrak) |
| `g_clock_*` | yazılım saniye | Eski yorum “pil yok”; RTC init **var**. **UNRESOLVED:** `g_clock_*` hâlâ canlı mı yoksa ölü mü — TIM6 gövdesi doğrulanmalı |

Timezone **yok**. `d.WeekDay` settime’da `MONDAY` sabit (`main.c:469`) — weekday Binding V1 **yok**.

## 5.5 Medya / ses / UI

| Durum | Yer |
|---|---|
| `m_medya[i].oynuyor` | `Screen1View` üye |
| `m_medya_okuyucu[i].isOpen()` | okuyucu |
| `VideoController::isPlaying` | üretilen denetleyici |
| `s_sound_on`, `s_fon_on`, volume 0–10 | `audio_player.c` |
| `g_settings_menu.open` | menü → havuz tamamen gizli |
| `m_arkel_link` | 3 sn timeout |

## 5.6 Canonical snapshot (PROPOSED, Binding dili)

`g_arkel` Binding koşuluna **doğrudan** bağlanmaz (`b3&0x20` Designer yazmaz). `arkel_feed` sonunda (veya UI tick başında, ISR dışında kopya) doldurulur:

```c
typedef struct {
    uint8_t  fire;         /* elev_state==6 veya raw b3&0x20 — TEK yerde map */
    uint8_t  overload;
    uint8_t  service_out;
    uint8_t  door;         /* 0 kapalı 1 açılıyor 2 açık 3 kapanıyor — V1: door_open 0/1 yeter */
    uint8_t  travel;       /* 0 idle 1 up 2 down */
    int16_t  floor;        /* int8 genişletme */
    uint8_t  link;         /* 0/1 m_arkel_link kopyası — UI yazar, Binding UI tick'te okur */
    uint8_t  sd_present;
    uint8_t  saat, dk;     /* V1 zaman koşulu için */
    uint32_t seq;
} runtime_state_t;
```

**REQUIRED:** bit→alan eşlemesi firmware içi. Designer `st=fire`.  
**UNRESOLVED:** `door` 2 durum mu 4 mü — bugün `door_open` 0/1 (`arkel_feed` kapi=1 yalnız açılıyor).

---

# 6. Existing Event System

Genel observer / Binding event bus **yok**. Sınıflandırma:

| Aday | Sınıf | Kanıt |
|---|---|---|
| DATA_RECEIVED | **CAN BE DERIVED** | `g_arkel_seq++` |
| DATA_CHANGED | **CAN BE DERIVED** | seq + `g_arkel` memcmp |
| DATA_TIMEOUT | **CAN BE DERIVED** | `ARKEL_TIMEOUT_MS` |
| FLOOR_CHANGED | **CAN BE DERIVED** | `floor` kenar (anons motoru kenar kullanır, `04_audio` §4) |
| DOOR_OPENED/CLOSED | **CAN BE DERIVED** | `door_open` kenar |
| SCENE_CHANGED | **CAN BE DERIVED** | `g_sahne.secili` değişimi (debounce sonrası) |
| BUTTON_PRESSED | **EXISTS** | `buttonsTask` `pressed` → `g_menu_cmd` |
| BUTTON_RELEASED | **EXISTS** | `released` ENTER kısa/uzun |
| BUTTON_LONG | **EXISTS** | ENTER 3 s, BUT7 1 s |
| BUTTON_DOUBLE | **MISSING** | kod yok |
| SD_LOST | **EXISTS** | `g_sd_lost`, `evlog` ev=13 a=0 |
| SD_INSERTED | **CAN BE DERIVED** | remount + `g_sd_reinit` / ev=13 a=1 |
| SD_DETECT GPIO | **MISSING** (donanım) | pin sokete bağlı değil |
| TIME_TICK_1HZ | **EXISTS** | `g_saat_tazele` |
| SECOND/MINUTE/HOUR_CHANGED | MINUTE/HOUR **CAN BE DERIVED** | sn=0 kenarı |
| MEDIA_FINISHED | **CAN BE DERIVED** | `isPlaying` false + `!repeat` (`DirectFrameBufferVideoController.hpp:203-215`). Uygulama callback **MISSING** |
| AUDIO_FINISHED | **CAN BE DERIVED** | `evlog` ev=4 `FON_SONU`; anons bitişi mix’te `s_an_rd` tükenmesi — uygulama Binding kancası **MISSING** |
| FAULT_RAISED | **EXISTS** (HardFault döküm) | `g_fault_dok`; Binding hedefi değil |
| TIMER_EXPIRED Binding | **MISSING** | `osTimerNew` yok |
| Generic event enum/queue | **MISSING** | |

**V1 RuntimeEvent:** yeni kuyruk **yok**. Binding **seviye** (her UI kare, snapshot). Kenar (RISING/FALLING) Binding kaydında `prev_true` biti — 32 binding = 4 bayt.

**PROPOSED V2 event:** `evlog` halkası zaten var (`evrec_t`, `EVLOG_N=96`) — teşhis. Binding’e bağlanmaz (overwrite, ISR). Ayrı 16 slotluk `runtime_event_t` ring **OPTIONAL** sonra.

---

# 7. Existing Widget System

STRUCT: `tema_widget_t` `sahne_motoru.h:82-120`

Limit: `WIDGET_MAX=16`, `ad[SAHNE_AD_MAX=16]` → 15 char + NUL. Designer `widgetId` MCU’da **kısa ad**.

Türler (`tur_coz`, `sahne_motoru.c:142`): `image|media|digit|arrow|list|text|saat` → `W_IMAGE..W_CLOCK`.

| Tür | Renderer | Canlı içerik | Binding hedefi V1 |
|---|---|---|---|
| W_IMAGE | havuz `Image` | statik bitmap | `SET_VISIBLE` **WRAP** `setVisible` |
| W_MEDIA | `VideoWidget` × `MEDYA_MAX=4` | AVI | `SET_VISIBLE` + `PLAY`/`PAUSE` **WRAP** |
| W_DIGIT | havuz + `updateDigits` | `g_arkel.floor` | `SET_VISIBLE` evet; `SET_VALUE` **hayır** (ARKEL sahip) |
| W_ARROW | havuz | `elev_state` yön | `SET_VISIBLE` evet; yön Binding **hayır** |
| W_LIST | Parser kabul; **havuz yuva `n=0`** (`havuzYuva`) — tema listesi **düşer**. `wList0` firmware menü/kapı yüzeyi | `floors.csv` named yol | Binding hedefi **V1 yok** (yuva yok) |
| W_TEXT | glif atlas RGB565; walker **tek bayt** (UTF-8 yok) | `icerik=saat\|tarih\|kapasite` | `SET_VISIBLE`; `SET_TEXT` serbest **hayır** |
| W_CLOCK | `havuzUygula` `havuzYuva(W_CLOCK)` çağırır; `havuzYuva` case **yok** → NULL, `g_havuz_dusen++` | RTC görsel set | Binding `SET_VISIBLE` **şimdilik yok** (yuva bağlanmıyor) |

**Invented function yok.** TouchGFX `Image::setVisible`, `VideoWidget::play/pause/setVisible/setRepeat`. `stop()` = `gotoFrame(1)` **tuzak** (`Screen1View.cpp:92-99`) — Binding `stop` V1 `pause`’a **WRAP** edilir, `stop()` çağrılmaz.

`SET_ENABLED` widget API **yok**. `SET_ASSET` yükleme `havuzUygula` / `asset_getir` tema yükünde; karede SD **yasak** (glif dersi). `select-content` V1 **uygulanmaz**.

Görünürlük **tek sahip:** `havuzGorunurlukTazele` (`Screen1View.cpp:3490`). Her kare karşı yönden `setVisible` = donma (yorum 3532–3538, 852 `g_havuz_sal_cnt`). Binding bu fonksiyona **girdi** verir, ikinci sahip olmaz.

Yaşam döngüsü: tema yük → `havuzUygula` yuvaları bağlar → her tick görünürlük. Destroy = sonraki `applyTemplate` / vanilla. Binding tablosu tema yükünde sıfırlanır (`sahne_yukle` başı deseni).

---

# 8. Existing Scene System

FILE: `sahne_motoru.c/.h`

| Soru | Cevap | Kanıt |
|---|---|---|
| Sahne ID | `kural[i].ad[]` string, indeks 0..15 | `sahne_kural_t` |
| Öncelik | `int16_t oncelik` (varsayılan cascade 100..0) | `sahne_varsayilan` |
| Seçim | aktif AND-koşul → max öncelik → eşitse `aktif_sira` (yükselen kenar) → yoksa kosulsuz | `sahne_degerlendir:52-76` |
| Debounce | `SAHNE_ONAY_N=3` çerçeve | `:79-96` |
| Üyelik | `sahne=` virgüllü liste | `sahne_tanim_gorunur` |
| Alarm fail-closed | yangin/asiri_yuk/estop/servis_disi | `sahne_alarm_mi:470` |
| Fail-open | `kosul_n==0` = varsayılan sahne | `sahne_yukle:394` |
| Persistence | RAM only; tema yeniden yüklenir | |

**Sahne Binding için:**

| Rol | V1 | Reason |
|---|---|---|
| Runtime state (input) | **EVET** | `secili` adı snapshot’a `scene_id` olarak konabilir (uint8 indeks) |
| Event source | **CAN BE DERIVED** | `secili` kenar |
| Binding target (sahne değiştir) | **HAYIR V1** | Döngü: Binding A sahne B, Binding B sahne A. Debounce sahne **kuralları** için; Binding eylemi debounce’u bypass eder |
| Binding input (koşul `st=scene`) | **OPTIONAL V1** | sahne adı string karşılaştırma pahalı; indeks enum |

Sahne geçiş eylemi **REQUIRED değil**. Overlay Binding aynı sahnede çözülür — motor belgesinin gerekçesi.

Sonsuz geçiş koruması (PROPOSED, sahne-hedef ileride): bir tick’te en fazla **bir** sahne eylemi; `SAHNE_ONAY_N` Binding sahne eylemine de uygulanır; self-loop Validate’de reddedilir. V1’de kod yazılmaz.

---

# 9. Existing Media System

| Öğe | CURRENT |
|---|---|
| Kapasite | `MEDYA_MAX = 4` (`Screen1View.hpp:346`) |
| Format | MJPEG AVI, `sd_query_avi_size` RIFF başlık |
| Bütçe | `VIDEO_BUDGET_PX = 1280*720` `media_config.h:53`. Aşım `setupVideo` içinde **yalnız UART uyarısı**; oynatma **kesilmez** (`Screen1View.cpp` ~223–231). Designer Validate asıl kemer. |
| Tampon tavan | `VIDEO_MAX_W/H 720×1280` |
| Play | `vy->play()` yalnız `isOpen() && sahne_tanim_gorunur && !menu` |
| Pause | `vy->pause(); setVisible(false)` |
| Repeat | `setRepeat(tekrar)` liste `tekrar=` |
| Stop | **kullanma** (gotoFrame tuzağı) |
| Restart | **UNKNOWN** güvenli sarmalayıcı: pause + play, `isOpen` şart |
| Resume | pause konum korur — **CAN WRAP** play |
| Finished callback | uygulama **MISSING**; denetleyici `repeat==0` bitince `isPlaying=false` |
| Slide (Designer MediaSlide) | firmware **MISSING** (V2 Designer model; STM32 `liste` tek dosya) |

**V1 Binding medya eylemleri:** PLAY, PAUSE. STOP→PAUSE. RESTART **OPTIONAL** ölçümden sonra. FINISHED trigger **OPTIONAL** (poll `isPlaying`).

---

# 10. Existing Audio System

Kanal sayısı **uydurulmaz**. CURRENT:

| Öğe | Değer | FILE |
|---|---|---|
| Fiziksel çıkış | **1** I2S stereo (L=R kopya mix) | `audio_player.c:mix_to_dma` `out[2u*f]=out[2u*f+1]` |
| Mantıksal kaynak | **2 halka:** FON + ANONS (+ ~TONE) | aynı dosya üst yorum |
| FON halka | 1 MB `.sd_media` | `FON_RING_SZ` |
| ANONS | 192 KB, olayda dosya RAM’e dolar | `AN_RING_SZ` `audio_player.c:111-116` |
| Mix | 44100 sürekli DMA half/full | ISR `mix_to_dma` |
| Liste FON | `FON_MAX=8` | |
| API | `audio_queue_send`, `audio_set_volume(0..10)`, `audio_set_sound`, `audio_fon_enable`, `audio_fon_restart` | `audio_player.h` |
| Pause/resume API | **yok** (fon anons sırasında duck) | |
| Mute pin | `I2S1_MUTE` GPIO | `audio_player.c:160` |
| Binding önceliği vs ses | **ayrı** | Binding 0–15 widget çatışması; ses kuyruk FIFO + duck. Karıştırma **yok**. |

`docs/audio/04_audio_subsystem.md` ANONS’u “akış” diye yazar; **kod** “TAM RAM” der. Kod kaynak.

**V1 Binding ses:** `PLAY` → `audio_queue_send(varlik yolu)` **WRAP**. STOP/PAUSE/SET_VOLUME/MUTE **OPTIONAL** (API kısmen var: volume/sound_on; pause yok). Anons kenarı bugün ARKEL durum kenarından — Binding ile **çift tetik** riski **UNRESOLVED** (V1 ses eylemini açmadan ürün kararı).

---

# 11. Existing LED System

| LED | Pin | CURRENT işlev | Binding |
|---|---|---|---|
| LED1 | PA0 | basılı feedback + `g_btnled_blink` | tema LED’i **değil** |
| LED2 | PC4 | **CM4** canlılık toggle | CM7 Binding **dokunmaz** |
| LED3/4 | PC5/PB0 | PC7 EXTI test toggle | teşhis |
| LED6 | PB2 | UI heartbeat `g_ui_alive` | Binding **dokunmaz** |
| LED5 | — | bırakılmış teşhis | |

Desen motoru, `SET_PATTERN`, tema LED widget **yok**. `ON/OFF/TOGGLE/BLINK` Binding hedefi V1 **OPTIONAL / önerilmez** — kullanıcı LED’leri sistem nabzı. Ürün “ Binding ile LED” isterse **NEW** GPIO map + çatışma (heartbeat ile).

---

# 12. Existing Button System

FILE: `main.c:buttonsTask` ~561

| Öğe | CURRENT |
|---|---|
| Adet | 7 (`BTN_N`) BUT1–7 |
| Tarama | 20 ms poll, **EXTI değil** (PC7 SD_DETECT test hariç) |
| Debounce | 2 örnek |
| Kısa bas | yön: `pressed` → `g_menu_cmd`; ENTER release kısa = OK |
| Uzun | ENTER 3 s MENU; BUT7 1 s tema |
| Çift tık | **yok** |
| Tüketici | ayarlar menüsü, `g_quick_apply` |

Binding RuntimeEvent kaynağı olarak buton: **PROPOSED** yeni anlam (menü komutu ≠ widget kuralı). V1 **gerekmez**. Menü açıkken havuz zaten gizli — Binding menüde çalışmaz.

---

# 13. Existing SD System

FILE: `sd_durum.c/.h`, `sd_config.c`, `sahne_yukle`

| STATE | CURRENT eşleşme |
|---|---|
| sd.present | `g_sd_present` **EXISTS** |
| sd.mounted | `g_sd_present && g_sd_izin` **CAN BE DERIVED** |
| sd.ready | tema `g_sahne.hazir` **CAN BE DERIVED** (kart ≠ tema) |
| sd.error | diskio `sd_durum_kayip` **EXISTS** (lost) |

Paket: `0:/tN/r{0,90,180,270}/tema.cfg` + `layout.cfg` + img/video; ses/font form bağımsız. `sd_scan_templates` klasör tarar.

Binding yükleme: `sahne_yukle` içinde yeni satır türü; karede `f_open` **yok**. Bozuk kart: `hazir=0` → varsayılan sahne; Binding `bag_n=0`.

---

# 14. Existing Clock/Time System

CURRENT: `MX_RTC_Init`, `HAL_RTC_SetTime/Date`, BKP_DR0 imza `0x5A5A5`, `g_settime` SWD/menü. Saat kaynağı **`RCC_RTCCLKSOURCE_LSI`** (`stm32h7xx_hal_msp.c`) — **LSE değil**; Binding saat atomu kayabilir.

UI: `g_saat_*` (TIM6 her 1000 kesme) + `glif_icerik_uret` / W_CLOCK. `anonsMotoru` (`Screen1View`) `elev_state` **kenarında** `audio_queue_send` — Binding PLAY ile **çift tetik** riski kanıtlandı (mevcut kenar var).

Zaman penceresi Binding (`hour==12`) **feasible**: snapshot’ta `saat/dk`. `TIME_WINDOW` (12:00–13:00) iki atom AND. Scheduler/DELAY: `osTimer` kullanılmıyor — **V1 yok**. `HAL_GetTick` 1 ms; Binding delay yazılım sayacı **OPTIONAL** sonra.

---

# 15. Existing Serial/DataSource System

| Katman | CURRENT somut | Genel ad |
|---|---|---|
| DataSource | USART1 9-bit IRQ | `serial_1` |
| ProtocolAdapter | `arkel_feed` LOP 0x0B / 12 bayt | `protocol_lop_v1` (isim sözleşmede; üretici yok) |
| RuntimeState | `g_arkel` → PROPOSED `runtime_state_t` | |
| İkinci kaynak | sanal `arkel_feed` | aynı adapter |
| ASCII debug | `UARTQueue` + `Model::tick` | System, Binding değil |
| Çoklu DS | CAN/ETH yok | V1 tek DS |

**REQUIRED:** sözleşme üretici adı içermez. Adapter bir `runtime_state_t` doldurur. İleride Wi-Fi (ürün V2, SD kapanmaz) ikinci DataSource olur — **şimdi tasarlanmaz**, slot bırakılır: `runtime_merge()` tek yazar kuralı.

Tek yazar: saha snapshot’ı `arkel_feed` (ISR) yazar; UI `link/saat/sd` alanlarını tick’te yazar. Çözüm: Binding **yalnız UI tick** okur; ISR `g_arkel`’i günceller; tick başında `runtime_snapshot_cek()` kopya alır (kısa, hizalı). ISR’da Binding yok.

---

# 16. Existing Template/Parser System

`sahne_yukle` (`sahne_motoru.c:197`):

- Satır 160 char; `f_gets`
- Tanınan: `w `, `varlik `, `liste `, `sahne `
- **Bilinmeyen satır atlanır** (`sahne ` değilse `continue` — `w`/`varlik`/`liste` önce yakalanır)
- Yeni `binding ` satırı eski ELF’te **sessiz atlanır** (özellik yok, yangın bozulmaz)
- Sahne jeton: `oncelik=` + `bN&mask` `bN=val` `kat=` `<` `>` `!=`
- `state=` sahne satırında **yok** (jeton_kosul tanımaz → `kosul_n` artmaz → fail-open varsayılan riski — **bu yüzden Binding `state=` sahneye basılmaz**)

`layout.cfg` ayrı (`sd_config` `template_layout_t`) — Binding değil.

Vanilla: `sahne_varsayilan` + RAM üreteç. Binding yok = eski davranış **REQUIRED** (A/B).

---

# 17. Proposed Runtime Rule Engine

```
DataSource (serial_1 | demo)
        ↓
ProtocolAdapter (LOP v1)          CURRENT arkel_feed
        ↓
runtime_state_t snapshot          NEW, UI tick kopya
        ↓
Logic IR eval (DNF satırlar)      NEW, sahne_degerlendir kardeşi
        ↓
Binding kazanan (öncelik, sira)
        ↓
Action dispatcher                 WRAP havuzGorunurlukTazele
        ↓
Target (widget görünürlük / video play-pause)
```

STM32 **ifade parse etmez**. Designer:

```
A AND B = K1     →  DNF satır 1
C == 5 = K2      →  atom
K1 OR K2 = K3    →  iki Binding kaydı aynı (widget, eylem, öncelik)
```

Firmware:

```
for each bag in widget grubu, öncelik desc, sira asc:
    ok = AND(atomlar)   // all=1
    if ok: winner = bag; break  // ilk kazanan (yüksek öncelik)
apply winner.action once if changed
```

Bu, prompt’taki “for each operation: resolve A/B, op, store output” modelinin **DNF indirgemesidir**. Ara K1/K2 RAM’de tutulmaz; Designer patlatır. XOR/parantez patlaması → OPTIONAL postfix (kardeş belge).

**Uyumluluk kanıtı:** `sahne_degerlendir` zaten AND döngüsü + çok kural OR (farklı ad vs aynı ad). Binding aynı döngü, hedef widget.

---

# 18. DataSource / ProtocolAdapter

**PROPOSED V1 struct (anlamsal, binary freeze sonra):**

```c
typedef struct {
    uint8_t id;           /* 0 = serial_1 */
    uint8_t alive;        /* link */
} datasource_info_t;
```

Adapter **NEW dosya değil**: `arkel_feed` sonunda `runtime_from_arkel(&g_arkel)` **MODIFY**. İkinci adapter V1 yok.

---

# 19. RuntimeState

Bkz. §5.6. **REQUIRED** alanlar V1: fire, overload, service_out, door, travel, floor, seq. **OPTIONAL:** link, sd_present, saat/dk. **V1 değil:** string kat etiketi, float, widget_state (döngü).

Okuma: `int16_t runtime_oku(id)` switch. Bilinmeyen id → `INT16_MIN`, atom fail-closed.

---

# 20. RuntimeEvent

V1: event bus **yok**. Trigger enum Binding kaydında:

| Trigger | V1 |
|---|---|
| LEVEL_TRUE | **REQUIRED** (sahne gibi) |
| LEVEL_FALSE | OnFalse ile; her kare tehlikeli → kazanan önbellek |
| RISING_EDGE | **OPTIONAL** `prev` bit |
| FALLING_EDGE | **OPTIONAL** |
| CHANGED | **OPTIONAL** |
| TIMER_EXPIRED | **V1 değil** |

Kenar belleği: `uint32_t bag_prev_mask` (32 binding). Maliyet 4 B.

---

# 21. Logic IR

Prompt örneği `LogicOperation {a,b,op,output}` **doğrudan V1 değil** — ara K hücreleri RAM ve doğrulama maliyeti. Mevcut C modeli DNF.

## 21.1 V1 IR (REQUIRED) — DNF satır

Mevcut `sahne_kosul_t` (4 B) Binding atomuna genişler:

```c
typedef struct {
    uint8_t  state;     /* ST_* id, string yok */
    uint8_t  op;        /* EQ NEQ GT LT GE LE */
    uint8_t  not;       /* 1 = NOT atom */
    int16_t  deger;
} bag_atom_t;           /* 6 B + pad = 8 B */

typedef struct {
    uint8_t  widget_ix;
    uint8_t  eylem;     /* BAG_SHOW/HIDE/PLAY/PAUSE */
    uint8_t  oncelik;   /* 0..15 */
    uint8_t  all;       /* 1 AND 0 OR tek satır */
    uint8_t  kosul_n;
    uint8_t  sira;
    uint8_t  trigger;   /* V1: LEVEL_TRUE=0 */
    uint8_t  _pad;
    bag_atom_t kosul[BAG_KOSUL_MAX];  /* 4 */
} tema_bag_t;           /* ~ 8+32 = 40 B */
```

Hizalama: `int16_t` sonrası pad. `sizeof` derlemede `static_assert`.

Aynı (widget, eylem, öncelik) birden fazla satır = OR (Designer DNF).

## 21.2 V1.1 IR (OPTIONAL) — postfix

Yığın 8, opcode ≤24, ara K yok: `fire, 1, EQ, floor, 5, GE, AND`. XOR burada. Designer DNF terim > `BAG_MAX` ise Validate keser **veya** postfix basar. MCU iki evaluator **aynı anda V1’de yok**.

## 21.3 Operatör kümesi

| Op | V1 | Not |
|---|---|---|
| AND OR NOT | **REQUIRED** | NOT atom veya De Morgan Designer |
| XOR | **OPTIONAL** | postfix |
| == != > < | **REQUIRED** | sahne kat ops + Designer |
| >= <= | **REQUIRED** | Designer’da yok; `NOT <` ile de olur — açık op daha net |
| NAND NOR | **V1 değil** | |
| arithmetic bitwise | **V1 değil** | |
| string contains | **V1 değil** | `runtime.ts` var; MCU string yok |

---

# 22. Binding

```
Binding
├── ID          → yüklemede sira; UUID MCU’da yok
├── Priority    0–15
├── Trigger     V1 LEVEL_TRUE
├── Logic[]     DNF satır / atomlar
├── Final       satır bool
├── OnTrue[]    V1 tek eylem (show/hide/play/pause)
└── OnFalse[]   V1 yok (üyelik varsayılanı)
```

Designer `models.ts:115-140`: conditions[], conditionMode all\|any, action, priority, contentId.

`runtime.ts:91-101`: all=AND, any=OR, boş koşul **true** (MCU’da boş Binding fail-closed önerilir — **UNRESOLVED** ürün: Designer true, MCU false çelişmesin. **REQUIRED:** boş koşul Designer Validate reddet veya her iki taraf true = “her zaman”).

`BAG_MAX=32` ölçümden sonra. `BAG_KOSUL_MAX=4` sahne ile aynı.

---

# 23. Action Dispatcher

Mevcut komut dispatch tablosu **yok**. Menü `g_menu_cmd` enum ayrı.

**PROPOSED:** Binding kazanınca switch `eylem` — fonksiyon pointer tablosu şart değil (4 eylem).

Sıra: bir Binding V1 **tek** eylem. Çok eylem (show+play+anons) Designer’da **birden fazla Binding** aynı öncelik + sira. OnTrue[0,1,2] V1.1: `bag_eylem_t eylem[BAG_EYLEM_MAX=2]` — şimdi gerekmez.

**Tek sahip kuralı:** dispatcher `havuzGorunurlukTazele` içinde, üyelik AND’den sonra. `g_havuz_sal_cnt` durum sabitken artmaz (önbellek son eylem).

---

# 24. Target Model

| Target | V1 | Nasıl |
|---|---|---|
| WIDGET visible | **REQUIRED** | `setVisible` havuz yuva |
| WIDGET text/value/asset | **hayır** | içerik sahipleri ARKEL/RTC/tema |
| MEDIA play/pause | **REQUIRED** | mevcut video bloğu |
| SCENE switch | **hayır** | döngü |
| AUDIO queue | **OPTIONAL** | çift tetik |
| LED | **hayır** | sistem LED |
| SYSTEM | **hayır** | reset vs. |

Hedef ID: `widget_ix` yüklemede `ad` ile çözülür; yoksa satır `bag_dusen++`.

---

# 25. Trigger Model

V1 LEVEL_TRUE: koşul true iken kazanan eylem **seviye** (her kare aynı eylem, ama `setVisible` yalnız değişince).

OnFalse: “koşul false olunca hide” = ikinci Binding `NOT` veya üyelik varsayılanı. Yangın hide video zaten sahne üyeliği ile oluyor; Binding asıl kazancı **aynı sahnede** overlay.

RISING_EDGE: overlay’i bir kez play (anons). `prev` bit. Ses V1 kapalıysa gerekmez.

---

# 26. Priority / Conflict Resolution

Sahne: yüksek `oncelik`, eşitlikte `aktif_sira` (son yükselen).  
Designer Binding: yüksek priority, eşitlikte **belge sırası**.

**REQUIRED Binding çatışması** (aynı widget, aynı kare, iki true):

1. `oncelik` büyük kazanır (15 > 0)
2. eşitse `sira` küçük (belgede önce)
3. Binding UUID yok

Örnek: A pri 2 visible true, B pri 15 visible false → **gizli**.

Öncelik **mantık değerlendirme sırasını değiştirmez** (tüm adaylar hesaplanır) — **yalnız eylem seçimi**. Eval sırası yükleme sırası; kazanan sort anahtarı.

Eşit öncelik + farklı eylem: belge sırası. Designer Validate uyarı **OPTIONAL**.

Binding önceliği sahne 0–10/0–100 ile **bağımsız** (`models.ts:132-137`). Ses önceliği de bağımsız (§10).

---

# 27. Serialization Contract

Önce anlam, sonra satır. Binary blob V1 **yok** (MCU satır parser var, JSON yok).

**Semantik:**

| Alan | Anlam |
|---|---|
| widget ad | `w` satırı `ad` ≤15 |
| oncelik | 0–15 |
| eylem | show hide play pause |
| all | AND (1) / OR (0) tek satır |
| st | enum ad (`fire` `floor` …) |
| op | eq ne gt lt ge le |
| deger | int16 |
| not | atom NOT |

**Satır (PROPOSED, `tema.cfg`):**

```
binding video1 : oncelik=10 all eylem=pause st=fire eq=1 st=floor ge=5
binding video1 : oncelik=10 all eylem=pause st=overload eq=1
```

Aynı widget+eylem+öncelik → OR.  
Eski ELF: satır düşer.  
Yeni ELF eski kart: `bag_n=0`.

`ops=` postfix **V1 değil**.

Designer export: V2 JSON iç model; SD yazarken **bu satırlar**. JSON MCU’ya gitmez.

---

# 28. Validation

Designer yayın **öncesi** (REQUIRED):

- bilinmeyen `stateId` / op / eylem
- widget ad boş, >15, temada yok
- öncelik 0–15 dışı
- `kosul_n` > 4
- DNF terim sayısı > `BAG_MAX`
- `contains` / string floor
- `select-content` / `select-style`
- sahne-hedef eylem
- boş koşul (karar: reddet)
- video play bütçe (mevcut VIDEO_BUDGET)
- döngüsel sahne (V1 eylem yok, yine de sahne graph)
- XOR + DNF patlama

Firmware yükleme (REQUIRED, çökmez):

- taşma `bag_dusen++`
- bilinmeyen `st=` atom fail-closed
- widget_ix yok düş
- `sizeof` / magic yok; bozuk satır skip

---

# 29. Memory Analysis

Tahmini (ölçülmedi — **PROPOSED**, DWT sonra):

| Nesne | Boyut | 10 | 32 (V1 tavan) | 100 | 500 |
|---|---|---|---|---|---|
| `tema_bag_t` | ~40 B | 400 B | 1.3 KB | 4 KB | 20 KB |
| `runtime_state_t` | ~20 B | 20 B | 20 B | 20 B | 20 B |
| `bag_prev_mask` | 4 B / 64 B | 4 | 4 | 16 | 64 |
| `g_sahne` mevcut | ~ birkaç KB | değişmez | | | |

AXI SRAM 512 K içinde 20 KB rahat; **sorun RAM değil**, yükleme doğrulama + her kare invalidate. 500 Binding **V1 hedef değil**. `BAG_MAX=32` Designer tavanı.

Heap 0. DTCM: 2 sayaç.

---

# 30. Performance Analysis

CM7 480 MHz. 32 Binding × 4 atom = 128 karşılaştırma + birkaç branch. UI kare bütçesi DMA2D/video yanında **mikrosaniye**. Risk: `setVisible`+`invalidate` her kare (öğrenilmiş donma). Önbellek zorunlu.

Değerlendirme yeri: `havuzGorunurlukTazele` (zaten her tick). Snapshot `seq` + `g_saat_tazele` + sd bayrak hash değişmediyse Binding atlanır — **OPTIONAL** mikro-optimizasyon; V1 her tick eval + eylem önbelleği yeter.

ISR: 0 Binding.

Ölçüm: DWT cycle `bag_uygula`, `g_havuz_sal_cnt`, `bag_n`. **Ölçmeden fps iddiası yok.**

---

# 31. Existing Code Reuse Map

| Alt sistem | Karar | Ne |
|---|---|---|
| `arkel_feed` / `g_arkel` | **WRAP** / **MODIFY** | snapshot doldur, protokol aynı |
| `sahne_degerlendir` | **REUSE** (dokunma) | sahne katmanı kalır |
| `sahne_yukle` | **MODIFY** | `binding ` dalı |
| `sahne_kosul_t` / AND döngü | **REUSE** kalıp | Binding atom |
| `sahne_tanim_gorunur` | **REUSE** | üyelik AND Binding |
| `havuzGorunurlukTazele` | **MODIFY** | Binding kazananı uygula |
| `VideoWidget` play/pause | **WRAP** | `isOpen` koruması aynı |
| `Image::setVisible` | **WRAP** | tek sahip |
| `audio_queue_send` | **WRAP** (V1.x) | |
| `buttonsTask` / LED | **REUSE** | Binding V1 bağlama |
| `sd_durum` | **REUSE** | snapshot `sd_present` |
| `g_saat_*` | **REUSE** | zaman atomu |
| `UARTQueue` ASCII | **REUSE** | Binding değil |
| `evlog` | **REUSE** | teşhis, event bus değil |
| FreeRTOS timer | kullanılmıyor | **NEW etme** V1 |
| JSON parser | **yok** | **NEW etme** |
| Sahne cascade gömülü | yedek | Binding kullanmaz |

---

# 32. Required New Components

| Bileşen | Nerede | V1 |
|---|---|---|
| `runtime_state_t` + `runtime_oku` | `arkel_link` veya `runtime_durum.c` **NEW** | evet |
| `tema_bag_t` tablosu | `sahne_motoru.h/.c` | evet |
| `binding` satır parser | `sahne_yukle` | evet |
| `bag_esles` / `bag_kazanan` | `sahne_motoru.c` | evet |
| DTCM `bag_dusen`, `bag_n` | `savas_bayraklar.h` | evet |
| Designer DNF derleyici | Template_Designer TS | evet (firmware dumanından önce kart basabilir) |
| Designer Validate tavan | aynı | evet |
| Postfix VM | — | hayır |
| Event bus | — | hayır |
| Action script | — | hayır |

---

# 33. Required Modifications

| Dosya | Değişiklik | CubeMX |
|---|---|---|
| `arkel_link.h` / `main.c` `arkel_feed` | snapshot doldur | dokunma |
| `sahne_motoru.h/.c` | tablo+parser+eval | dokunma |
| `Screen1View.cpp` `havuzGorunurlukTazele` | üyelik sonrası Binding | dokunma (USER) |
| `savas_bayraklar.h` | sayaç | dokunma |
| Vanilla | Binding yok | dokunma |
| Generated TouchGFX | **yok** | |

Eski kart A/B: `bag_n=0`, görünürlük yalnız üyelik.

---

# 34. Migration Plan

1. Sözleşme freeze (bu belge + motor + mantık MD).
2. Designer: DNF export + Validate; firmware hâlâ Binding’siz → özellik yok, yangın sağlam.
3. Firmware snapshot (davranışsız).
4. Parser + tablo, eylem no-op, `bag_n` SWD.
5. `SET_VISIBLE` overlay (`floor eq=5`).
6. Video pause yangın (üyelik zaten gizliyorsa A/B aynı; boşta fire overlay ayrı test).
7. Golden paket SD.
8. DWT + salınım.
9. Dur — select-content / postfix / ses / kenar **sonra**.

Geri dönüş: `BAG` derleme bayrağı veya `bag_n` yok sayma. Sahne motoru bağımsız kalır.

---

# 35. Test Plan

| ID | Kural | Beklenen |
|---|---|---|
| T1 | fire AND door → W17 show | fire=0 door=1 → W17 üyelik; fire=1 → visible |
| T2 | çok Binding | bağımsız widget |
| T3 | pri 15 hide vs 2 show | gizli |
| T4 | eşit pri | belge sırası |
| T5 | OnTrue only V1 | false → üyelik |
| T6 | rising (V1.1) | bir kez |
| T7 | serial floor 5 overlay | yalnız kat 5 |
| T8 | sahne değişimi | Binding üye değilse show yok (alarm fail-closed) |
| T9 | media pause fire | `isOpen` yoksa görünür yapma |
| T10 | malformed `st=xyz` | düş, çökme yok |
| T11 | `BAG_MAX+1` | `bag_dusen`, Designer zaten keser |
| T12 | Binding’siz kart | piksel A/B |
| T13 | eski ELF yeni satır | yangın varsayılan sahne |
| T14 | menü açık | Binding yok, hepsi gizli |
| T15 | seq sabit | `g_havuz_sal_cnt` +0 |

Donanım: gerçek LOP + demo `arkel_feed`.

---

# 36. Golden Template

Çapraz repo `0:/tN` fixture (isim önerisi: `t_golden_bind`):

1. Boolean `fire eq=1` hide `u_yangin` değil — **ad ≤15** mevcut uyarı widget
2. Nested DNF iki satır OR
3. `floor gt=5`
4. İki widget iki Binding
5. Priority conflict aynı widget
6. OnFalse — **V1 skip** (belgede “henüz”)
7. Widget show/hide
8. Scene action — **V1 skip**
9. Media pause
10. Audio — **V1 skip** veya tek `audio_queue_send` kapalı varsayılan
11. LED — skip
12. Button — skip
13. SD event — skip
14. Serial DataSource — LOP çerçevesi
15. Runtime floor değişimi
16. Time `saat eq=12` — OPTIONAL
17. MediaFinished — skip
18. AudioFinished — skip

V1 golden **1,3,4,5,7,9,14,15**. Diğerleri paket yorumunda “beklenen: firmware yok sayar / Designer yayınlamaz”.

---

# 37. Risks

| Risk | Sınıf | Azaltma |
|---|---|---|
| Her kare setVisible çekişmesi | CURRENT ders | tek sahip + önbellek |
| Video assert `!isOpen` | CURRENT | play koruması |
| ISR Binding | kolay hata | yasak, review |
| `kosul_n==0` fail-open sahne | CURRENT | Binding `state=` sahneye yazılmaz |
| DNF patlama | PROPOSED | Validate `BAG_MAX` |
| Canonical map kayması | PROPOSED | enum + profil sürümü |
| Anons + Binding PLAY çift | OPTIONAL | V1 ses kapalı |
| Sahne-hedef döngü | OPTIONAL | V1 yasak |
| 16 widget tavan | CURRENT | overlay Binding ile sahne şişmez |
| Ölçümsüz 500 Binding | — | tavan 32 |
| `g_clock_*` vs RTC | UNKNOWN | TIM6 1 Hz `HAL_RTC_Get*` yazar; `g_clock_*` ayrı yazılım alanları — Binding `g_saat_*` okusun |
| `aday` vs `secili` | CURRENT | Binding görünürlükle `secili` |
| `W_CLOCK`/`W_LIST` yuva yok | CURRENT | Binding hedefi değil |
| ASCII `Model::tick` `g_arkel` bypass | CURRENT | V1 Binding saha+demo `arkel_feed` |
| USART ASCII vs 9-bit | CURRENT | Binding bu kuyruğu kullanmaz |

---

# 38. Open Decisions

Ürün / teknik, sessiz çözülmez:

1. Boş Binding koşulu: Designer `true` (`runtime.ts:97`). MCU fail-closed mu, aynı true mu?
2. `door` 0/1 mi 4-faz mı?
3. V1 ses Binding açılacak mı (çift tetik)?
4. `>=` `<=` Designer’a eklenecek mi yoksa NOT ile mi?
5. `BAG_MAX` 32 mi saha teması ölçümü mü?
6. Snapshot ISR sonunda mı UI tick kopyası mı? (öneri: UI tick kopya)
7. OnFalse V1.1 mi hiç değil mi?
8. Wi-Fi DataSource ürün V2 — Binding sözleşme slotu şimdi dondurulsun mu?
9. Binding sahne adı: `aday` mı `secili` mi? (öneri `secili`, görünürlük ile aynı)
10. `W_CLOCK` / `W_LIST` havuz yuvası onarılmadan Binding hedefi açılsın mı? (öneri: **hayır**, önce yuva)

---

# 39. Implementation Order

Firmware mimarisinden türetilen sıra (prompt örneği birebir değil):

| Aşama | İş | Neden bu sıra |
|---|---|---|
| 0 | Sözleşme freeze + golden iskelet | Designer yanlış `state=` basmasın |
| 1 | `runtime_state_t` UI tick kopya | Binding’siz, A/B |
| 2 | `tema_bag_t` + parser + SWD sayaç | eylem yok |
| 3 | DNF eval + kazanan seçimi (log/SWD) | görünürlük henüz yok |
| 4 | `havuzGorunurlukTazele` SET_VISIBLE | tek sahip |
| 5 | Video PLAY/PAUSE wrap | mevcut video bloğu |
| 6 | Designer DNF export + Validate | kart üret |
| 7 | Golden T1/T3/T5/T7 SD dumanı | değişmemiş sahne motoru |
| 8 | Kenar `prev` + isteğe OnFalse | |
| 9 | Saat atomu | RTC zaten var |
| 10 | RuntimeEvent türevi (seq/sd) | bus yok |
| 11 | Audio WRAP | ürün kararı 3 |
| 12 | Postfix VM | yalnız DNF tavanı yetmezse |
| 13 | Sahne/LED/text/select-content | V1 sonrası |
| 14 | Hardware LOP + DWT | kabul |

DataSource soyut sınıfı **ayrı aşama değil** — 1 ile `arkel_feed` wrap yeter. Event sistemi 10’a ertelenir çünkü UI zaten seq poll ediyor.

---

# 40. Executive Table

| Area | Existing | Reusable | Missing | Change Required | Priority |
|---|---|---|---|---|---|
| DataSource | USART1 9-bit IRQ | evet | soyut tip | WRAP | P0 |
| ProtocolAdapter | `arkel_feed` | evet | genel ad | WRAP | P0 |
| RuntimeState | `g_arkel` | kısmen | canonical struct | NEW+MODIFY | P0 |
| RuntimeEvent | seq/bayrak | türetilir | bus | V1 yok | P2 |
| LogicIR | sahne AND/OR DNF | kalıp | Binding atom ST_* | NEW | P0 |
| Binding | Designer TS only | — | MCU tablo | NEW | P0 |
| Priority | sahne int16; Binding TS 0–15 | fikir | MCU 0–15 | NEW | P0 |
| Action | havuz setVisible/play | WRAP | dispatcher | MODIFY | P0 |
| Widget | 7 tür havuz | evet | Binding hedef map | MODIFY görünürlük | P0 |
| Scene | motor tam | evet | Binding hedef | **yapma** V1 | — |
| Media | 4× MJPEG | play/pause | finished cb | WRAP | P0 |
| Audio | FON+ANONS I2S | queue | Binding kanca | OPTIONAL | P2 |
| LED | sistem nabız | hayır tema | Binding LED | yapma | — |
| Button | menü 20 ms | hayır Binding | event kaynağı | P2 | P2 |
| SD | durum makinesi | snapshot | Binding event | REUSE | P1 |
| Clock | RTC+TIM6 | `g_saat_*` | Binding atom | REUSE | P1 |
| Validation | widget_dusen vs | kalıp | Designer Binding | NEW TS | P0 |
| Serialization | tema.cfg satır | parser | `binding ` | MODIFY | P0 |
| Testing | sahne_esdeger.py | fikir | golden bind | NEW | P0 |

---

# 41. Final Recommendation (12 soru)

**1. Mimari mevcut firmware ile uyumlu mu?**  
Evet. Yeni RTOS, JSON, heap Binding, sahne yeniden yazımı gerekmez. Uyumluluk: katmanlı WRAP + ince NEW tablo.

**2. Ne var?**  
DataSource+LOP decode, `g_arkel`, DNF sahne motoru, widget havuzu, görünürlük tek sahip, video play/pause emniyeti, SD tema parser (bilinmeyen satır drop), RTC, buton/LED sistem, FreeRTOS görevler.

**3. Doğrudan reuse?**  
`sahne_degerlendir` kalıbı, `sahne_tanim_gorunur`, `sahne_yukle` skip-unknown, `setVisible`/`play`/`pause`, `g_arkel_seq` poll, DTCM sayaç deseni.

**4. Wrapper?**  
`arkel_feed` → snapshot; video play (`isOpen`); `audio_queue_send`; `pause` instead of `stop`.

**5. Yeni?**  
`runtime_state_t`, `tema_bag_t`, parser dalı, `bag_kazanan`, Designer DNF/Validate.

**6. Minimum V1?**  
Snapshot + DNF Binding ≤32 + SET_VISIBLE + PLAY/PAUSE + üyelik AND + öncelik 0–15 + fail-safe yükleme. Designer `tema.cfg` `binding` satırı.

**7. V1’de açıkça yok?**  
Sahne değiştirme, LED, serbest metin şablonu, contains/string, arithmetic, XOR/postfix (gerekmedikçe), OnFalse her kare, event bus, CAN/ETH DS, `select-content/style`, Binding ISR, `VideoWidget::stop()`, JSON MCU, heap, 500 Binding.

**8. Sıra?**  
§39: sözleşme → snapshot → parser → eval SWD → görünürlük → video → Designer export → golden → ölçüm.

**9. En yüksek teknik risk?**  
Görünürlük çift sahip (tarihsel donma); video `!isOpen` assert; sahneye `state=` basıp fail-open; DNF sessiz kırpma; ISR’da Binding.

**10. Designer tam olarak ne üretir?**  
`0:/tN/rD/tema.cfg` içinde `binding <ad> : oncelik=N all|any eylem=… st=… op=… [not]`. JSON iç model kalır, karta satır düşer. `ad` mevcut `w` ile eşleşir. `st` profil enum.

**11. STM32 tam olarak ne tüketir?**  
`tema_bag_t[BAG_MAX]` + `runtime_state_t` kopya. String ifade yok. Atom `runtime_oku` + op.

**12. En küçük sağlam mimari?**  
Üç katman: (A) sahne seçimi mevcut motor, (B) üyelik `sahne=`, (C) Binding DNF tablosu yalnız (B) true iken. Tek eval noktası `havuzGorunurlukTazele`. Designer derler, MCU düz satır çalıştırır.

---

## PR Plan

Firmware C bu belgede **yazılmaz**. Aşağıdaki dilimler belgeler + ileride PR.

| PR | Başlık | Dosyalar | Bağımlılık |
|---|---|---|---|
| PR0 | Sözleşme: bu plan + PLAN.md link | `docs/COMPILED_RUNTIME_RULE_ENGINE_IMPLEMENTATION_PLAN.md`, kopyalar | — |
| PR1 | Designer DeviceProfile + DNF Validate (TS) | Template_Designer | PR0 |
| PR2 | `tema.cfg` `binding` export | Template_Designer compiler | PR1 |
| PR3 | STM32 `runtime_state_t` | `arkel_link.h`, `main.c` | PR0 |
| PR4 | STM32 Binding parser/tablo | `sahne_motoru.c/.h` | PR3 |
| PR5 | STM32 eval + SET_VISIBLE | `Screen1View.cpp` | PR4 |
| PR6 | Video PLAY/PAUSE Binding | `Screen1View.cpp` | PR5 |
| PR7 | Golden SD + DWT | `tools/testing`, kart | PR2+PR6 |

## Key Decisions

1. **DNF birincil IR** — mevcut `sahne_degerlendir` ile aynı C modeli; postfix ikinci.  
2. **Binding ISR’da yok** — UI tick, snapshot kopya.  
3. **Görünürlük tek sahip** `havuzGorunurlukTazele`.  
4. **Sahne Binding hedefi V1 yasak** — döngü.  
5. **Üretici protokolü adapter detayı** — sözleşme genel.  
6. **`stop()` Binding’de yok** — `pause`.  
7. **LED/buton sistem** — tema Binding V1 değil.  
8. **Heap/JSON/AST yok.**  
9. **`BAG_MAX=32`** ölçülene kadar Designer tavanı.  
10. **Eski ELF / yeni kart:** satır drop, yangın sağlam.

## İlişkili belgeler

- `docs/template-designer/research/stm32_binding_motoru_20260819.md`
- `docs/template-designer/research/stm32_binding_mantik_operatorleri_20260819.md`
- `docs/TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md`
- `docs/architecture/01_architecture_overview.md`
- `docs/protocol/05_communication_protocol.md`
- `docs/memory/06_memory_and_linker.md`
- `docs/audio/04_audio_subsystem.md` (ANONS boyutu için **kod** öncelikli)
