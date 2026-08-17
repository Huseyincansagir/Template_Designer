# Template Designer — Consolidated Product Decisions

Bu belge, bu konuşmada alınan ürün kararlarının tek yerdeki çalışma kaydıdır. Canonical teknik sözleşme `TEMPLATE_DESIGNER_CONTRACT_V2.md`; bu belge ise kararların kapsamını ve uygulamada unutulmaması gereken ayrıntıları toplar.

## 1. Ürün amacı

Windows için profesyonel bir Template Designer hazırlanacaktır. Kullanıcı cihaz/firmware profilini seçer, tema/form/widget/media/style yapılarını tasarlar, preview/simulator ile runtime davranışını görür, validate eder ve firmware'in beklediği deployment paketini üretir.

Uygulama ayrıca harici AI agentlarının programatik olarak kullanabileceği API/command yüzeyine sahip olacaktır. AI uygulamanın içine gömülmez.

## 2. Runtime temel modeli

```text
Firmware runtime data
        ↓
Canonical Runtime States
        ↓
Conditions + Priority
        ↓
Widget / Media / Text bindings
        ↓
Visual + Audio resolution
        ↓
Renderer
```

Kontrolcü/firmware runtime truth'tur. Template Designer gelen state'i kendi başına hesaplamaz.

## 3. Firmware-owned state registry

Designer'da kullanıcı `Custom State` oluşturamaz.

State'lerin ne olduğu firmware/device profile tarafından tanımlanır. Designer profile'dan state registry'yi okuyup ilgili Properties, Binding, Simulator, Validation ve AI API alanlarına otomatik olarak yansıtır.

Şimdilik gerçek ARKEL protokolü kullanılmayacaktır. ARKEL bit/byte mapping bu projede tanımlanmayacaktır.

Mevcut elevator state ailesi örnek olarak:

```text
floor
up
down
idle
door_opening
door_open
door_closing
door_closed
fire
overload
estop
service
```

Liste firmware registry ile canonical hale gelecektir.

## 4. Generic state engine

State sistemi yalnız asansör için tasarlanmayacaktır. Firmware ileride aydınlatma, fan, enerji, bakım, sensör veya başka cihaz verileri tanımlayabilir.

Designer yeni state için özel kod gerektirmeden profile-driven çalışmalıdır.

## 5. State priority

Aktif koşulların template presentation priority'si 0–10 arasında ayarlanabilir.

Örneğin yangın yüksek priority olabilir. Nihai default değerler ayrıca profile/template tarafından tanımlanabilir.

Bu priority, visual Z-order ile aynı kavram değildir.

## 6. Firmware settings

Firmware kendi menüsünden teknisyenin sahada değiştirebileceği çok sayıda ayar sağlayabilir. Designer bu ayarları oluşturmaz; firmware/device profile ilan eder.

Örnek:

```text
language
active_theme
arrow_style
digit_style
voice_pack
announcement_volume
background_music_volume
video_audio_volume
brightness
clock/date presentation
```

Liste sınırlı değildir.

State ve setting ayrıdır:

```text
State   = cihaz şu anda ne yapıyor?
Setting = teknisyen cihazı nasıl seçmiş/ayarlamış?
```

## 7. Dil

Dil firmware menüsünden saha teknisyeni tarafından değiştirilebilir.

Aynı template birden fazla dili taşıyabilir:

```text
TR
EN
DE
...
```

Localization şu contentlerde desteklenebilir:

- normal text,
- announcement audio,
- video/audio content,
- floor announcements,
- floor-specific content,
- digit/floor visual variants where required.

Designer'da dil seçimi yapılabilir ama gerçek runtime language seçimi firmware setting olabilir.

## 8. Ses sistemi

En az üç ayrı ses seviyesi kavramsal olarak ayrılmalıdır:

```text
Announcement Volume
Background Music Volume
Video Audio Volume
```

Designer template için default değerleri ayarlayabilir.

Firmware sahada bunları değiştirebilir.

Template Designer firmware'in runtime audio arbitration davranışını yeniden tasarlamaz. Örneğin düşük öncelikli bir Media Slide sesi aktifken yüksek öncelikli bir alarm/anons gelirse hangi sesin kazanacağı firmware/runtime katmanının sorumluluğudur.

## 9. Audio repeat

Bir Media Slide'a bağlanan ses için tekrar sayısı ayarlanabilir.

```text
Audio File
Audio Repeat Count
```

Bu video loop count'tan bağımsızdır.

Örneğin 2 saniyelik bir fotoğraf + özel ses + ses repeat count = 2 desteklenmelidir.

## 10. Media Slide

Ayrı bir `Popup` widgetı yoktur.

Kullanıcının popup gibi gördüğü kat-özel içerik de normal `Media Slide` mekanizmasıdır.

Media Slide:

```text
Media Slide
├── Image or Video
├── duration
├── video loop enable
├── video loop count
├── audio
├── audio repeat count
└── runtime condition/binding
```

Image belirli süre gösterilebilir.

Video loop edebilir ve tekrar sayısı ayarlanabilir.

Media Slide runtime condition ile bir kata bağlanabilir.

Örnek:

```text
condition: floor == 5
media: customer_5.jpg
 duration: 2 sec
audio: customer_5.wav
audio_repeat: 1
visual layer: high
```

Bu teknik olarak popup değildir; normal Media Slide'ın runtime state'e bağlanmasıdır.

## 11. Kata özel medya

Herhangi bir floor state değeri için özel media kullanılabilir.

Örnekler:

```text
floor == 5 → customer_5.jpg
floor == 8 → floor8.mp4
floor == R → reception.mp4
```

Bu media başka widgetların üzerinde görünecek şekilde yüksek visual layer'a yerleştirilebilir.

## 12. Kat özel anons

Katlara özel ses/anons tanımlanabilir.

Bir floor value için farklı dillerde farklı audio içerikleri bulunabilir:

```text
floor 5
├── tr → floor5_tr.wav
├── en → floor5_en.wav
└── de → floor5_de.wav
```

Ayrıca daha karmaşık anons sequence'leri desteklenebilir:

```text
5 + inci + kat
Fifth + floor
```

Kesin audio sequence formatı ayrıca tanımlanacaktır.

## 13. Floor value

Kat numarası yalnız 0–9 integer değildir.

Aşağıdaki gibi semboller desteklenebilmelidir:

```text
-1
0..11
R
Z
K
T
P
```

İleride firmware başka floor identifiers sağlayabilir.

Designer gelen floor değerini kendi kafasına göre dönüştürmemelidir.

Digit/floor style gerekli tüm sembolleri sağlamalıdır. Eksik symbol varsa validation bunu yakalamalıdır.

## 14. Kat numarası widgetı

Kat numarası dinamik runtime widgettır.

Firmware/runtime hangi floor değerini veriyorsa o gösterilir.

Saydam grafik tabanlı digit/floor styles desteklenir. Temel hedef pixel format ARGB8888 olabilir; gerçek firmware formatı device profile belirler.

Kat numarası gerektiğinde image veya video content kullanabilmelidir.

## 15. Yön oku widgetı

Ok widgetı runtime direction state'e bağlanır.

```text
up → up variant
 down → down variant
none → hidden
```

Default paket örneğin 10 shape içerir.

Default style:
- shape seçilebilir,
- renk palette içinden seçilebilir,
- Up ve Down ayrı ayrı değiştirilebilir,
- Down başlangıçta Up seçimini kopyalayabilir ama bağımsız değiştirilebilir.

Custom style:
- kullanıcı dosya seçer,
- Up ve Down ayrı dosyalardır,
- Custom Up seçilince Down otomatik oluşturulmaz,
- custom asset image veya video olabilir,
- custom assette renk seçimi yapılmaz.

## 16. Digit styles

Digit style ok style'a benzer fakat Up/Down varyantı yoktur.

Default digit styles programla gelir.

Custom digit style yüklenebilir.

Digit style, 0–9 dışında desteklenen floor symbol setlerini de içerebilir.

## 17. Widget type ve media type

Widget ile media birbirinden bağımsız kavramlardır.

Örneğin:

```text
Direction Widget → Image
Direction Widget → Video
Floor Widget → Image
Floor Widget → Video
Background → Image
Background → Video
Media Slide → Image
Media Slide → Video
```

## 18. Text

Normal text gerçek firmware fontlarını kullanır.

Glyph atlas modeli normal text için kullanılmaz.

Properties:

```text
text
font
font size
bold
italic
alignment
```

Text runtime state/condition ile değişebilir.

Localization text seviyesinde desteklenir.

## 19. Layering / compositing

Sahnedeki widgetlar ve media içerikleri firmware'de aynı ekran üzerinde üst üste compositing edilir.

Visual layer/Z-order, çizim sırasını belirler.

Örnek:

```text
Background            z = 0
Main media            z = 10
Floor number          z = 20
Direction arrow       z = 30
Text                   z = 40
Floor-specific slide   z = 100
```

Bu yalnız örnek bir sıralamadır. Kesin default layer değerleri daha sonra profile ile belirlenebilir.

Background en arkadadır.

## 20. Runtime priority ≠ visual layer

İki farklı priority vardır:

### Runtime/Event Priority
Birden fazla aktif condition arasında davranış/selection önceliğini belirler. 0–10.

### Visual Layer / Z-order
İçeriklerin ekranda hangi sırada çizildiğini belirler.

Bunlar tek bir sayıya indirgenmemelidir.

## 21. Popup yok

Ürün modelinde `Popup` isimli ayrı widget yoktur.

Kat özel üst içerik gerekiyorsa:

```text
Media Slide
+ floor condition
+ high visual layer
```

kullanılır.

## 22. Dynamic floor + arrow alignment

Klasik anchor sistemi kullanılmayacaktır.

Kat değeri `7`, `16`, `-1`, `R` vb. olduğunda kat numarası ve yön okunun görsel ilişkisini koruyacak özel Dynamic Runtime Layout/Alignment sistemi daha sonra tasarlanacaktır.

Kontrolcüden gelen floor/direction değeri değiştirilmez.

## 23. Media preparation

Designer temel resize/fit/crop işlemlerini desteklemelidir.

Harici Format Tool da kullanılabilir.

Hedef formatlar profile göre örneğin:

```text
JPEG
ARGB8888
WAV
MJPEG AVI
```

olabilir.

Video kaynaklarının ses/görüntü ayrıştırılması ileride Format Tool tarafından otomatik yapılabilir.

## 24. Simulator

Simulator gerçek cihaz olmadan runtime state ve firmware settings'i taklit eder.

Örneğin:

```text
Floor: -1..11 + symbolic floors
Direction: none/up/down
Door: closed/opening/open/closing
Fire: on/off
Overload: on/off
E-stop: on/off
Service: on/off
Language: firmware-defined
Arrow Style: firmware-defined
Digit Style: firmware-defined
Announcement Volume
Background Music Volume
Video Audio Volume
```

Simulator gerçek renderer, state resolver, priority ve layer modelini kullanmalıdır.

## 25. AI integration

AI uygulamaya gömülü değildir.

Harici Claude/VS Code gibi agentlar Designer API/command systemini kullanabilir.

Designer console yapılan işlemleri görünür kılar.

AI:

```text
get_device_profile()
get_runtime_states()
get_runtime_settings()
get_styles()
get_media()
add_widget()
bind_state()
set_condition()
set_priority()
set_layer()
set_media()
set_audio()
validate()
simulate()
render()
```

gibi operasyonları kullanabilmelidir.

AI template'i oluşturduktan sonra simulator state çalıştırıp render/screenshot alarak sonucunu inceleyebilmelidir.

## 26. AI'nin görsel bilgisi

AI'nin oluşturduğu template'in hangi form/sahne üzerinde ne bulunduğunu programatik olarak okuyabilmesi ve render edilmiş görüntüyü alabilmesi gerekir.

Hedef döngü:

```text
Create
→ Validate
→ Simulate
→ Render
→ Screenshot
→ Inspect
→ Modify
→ Test again
```

## 27. Firmware profile

Device profile aşağıdakilerin canonical kaynağı olmalıdır:

```text
supported widgets/content
media capabilities
runtime states
runtime settings
languages
fonts
styles
image/video/audio formats
resolution
layer capabilities
simulator capabilities
```

Firmware tarafından desteklenmeyen capability Designer'da mümkün olduğunca gösterilmemelidir.

## 28. SD Card

Deployment yapısı:

```text
SD/
├── config.cfg
├── Theme1/
│   └── config.cfg
├── Theme2/
│   └── config.cfg
└── ...
```

Root config SD/genel tema bilgilerini; tema config yalnız o temanın bilgilerini taşır.

## 29. Explicit non-goals

- Şu aşamada ARKEL bit/byte protokolü yok.
- Designer'da Custom State yok.
- Popup widget yok.
- Normal text glyph atlas modeli yok.
- Klasik anchor graph yok.
- Firmware audio arbitration Designer'da yeniden uygulanmayacak.
- Firmware menu Designer'a birebir taşınmayacak.
- AI programın içine gömülmeyecek.

## 30. Açık bırakılan konular

Aşağıdakiler henüz uydurulmayacaktır:

1. Gerçek firmware runtime state registry formatı.
2. Gerçek firmware setting registry formatı.
3. ARKEL protocol/bit mapping.
4. Exact dynamic alignment matematiği.
5. Exact visual layer default değerleri.
6. Exact audio mixing/ducking davranışı.
7. Exact floor announcement sequence formatı.
8. Exact firmware image/video/audio formats.
9. Root/theme config field names.
10. Same-priority tie-break kuralı.

Bu kararlar gerçek firmware sözleşmesinden geldiğinde ayrıca canonical hale getirilecektir.
