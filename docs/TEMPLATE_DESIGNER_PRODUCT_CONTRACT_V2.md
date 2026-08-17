# Template Designer — Product, Theme, Widget ve Runtime Contract v2

**Status:** Canonical product specification for the new Template Designer.

> Bu belge, mevcut Widget/Tema Sözleşmesi ile kullanıcı tarafından sonradan netleştirilen ürün kararlarının birleştirilmiş, temizlenmiş V2 sözleşmesidir. Eski sözleşmede bulunan ancak burada açıkça kaldırılan kavramlar yeni uygulamaya taşınmamalıdır.

---

# 1. Ürünün amacı

Template Designer, Windows üzerinde çalışan profesyonel bir template/theme tasarım ve deployment uygulamasıdır.

Kullanıcı:

1. cihaz/firmware profilini seçer,
2. template oluşturur,
3. medya ve widget'ları yerleştirir,
4. runtime data'ya göre hangi içeriğin gösterileceğini tanımlar,
5. tasarımı preview/simulator ile test eder,
6. validate eder,
7. deployment package üretir,
8. package'ı SD karta yazar.

V1 deployment:

```text
PC
 ↓
SD Card
 ↓
Physical Target Device
```

Gelecekte aynı package başka transportlarla gönderilebilir. Wi-Fi/ESP32-C6 V1 kapsamı değildir.

---

# 2. Temel ürün prensibi

## One Template, Multiple Runtime Inputs, Multiple Deployment Transports

Template, runtime verisinden ve deployment transportundan bağımsız bir modeldir.

```text
Device Profile
      ↓
Template Project
      ↓
Widgets + Media + Styles + Runtime Bindings
      ↓
Runtime State
      ↓
Event / Priority Resolution
      ↓
Renderer
      ↓
Validation
      ↓
Deployment Package
      ↓
SD Card
```

Aynı template ileride Wi-Fi gibi başka bir deployment transportuna da gönderilebilmelidir.

---

# 3. Cihaz seçimi ve capability sistemi

Yeni proje oluşturulurken kullanıcı önce hedef cihaz/firmware profilini seçer.

Örnek:

```text
New Project

Device:
[ Elevator Display H747 V2 ]

Firmware:
[ v2.x ]
```

Device profile şu capability'leri tanımlar:

- desteklenen widget/content türleri
- image formatları
- video codec/container
- çözünürlükler
- pixel formatları
- video slotları
- background video desteği
- media sequence desteği
- text/font desteği
- runtime signal/event desteği
- maksimum medya boyutları
- diğer firmware sınırları

**Capability yalnız validation filtresi değildir.** Designer'ın palette'i, Properties seçenekleri, import seçenekleri ve publish davranışı mümkün olduğunca seçilen profile göre belirlenmelidir.

Kullanıcı desteklenmeyen bir widgetı normal şekilde eklemeye çalışmamalıdır.

Validation son güvenlik kapısıdır.

---

# 4. Theme / Template modeli

Bir Theme/Template en az şu kavramları içerir:

```text
ThemeProject
├── metadata
├── device profile
├── forms
├── widgets
├── styles
├── media/assets
├── runtime bindings
├── priority rules
├── text/font settings
├── test/simulation configuration
├── validation state
└── deployment metadata
```

Editor, Preview, Simulator, Validation ve Publish aynı canonical project modelini kullanmalıdır.

---

# 5. Fiziksel formlar

Asansör/display ürünü için dört fiziksel orientation/form bulunabilir:

```text
r0
r90
r180
r270
```

Formların çözünürlükleri cihaz profile tarafından belirlenmelidir. Eski sözleşmedeki 720×1280 / 1280×720 değerleri profile sabit kodlanmamalıdır.

Bir widgetın her form için çözülmüş geometry/state bilgisi bulunabilir.

---

# 6. Widget ve runtime event ayrımı

**En önemli mimari kural:**

`yangin`, `estop`, `asiri_yuk`, `servis_disi`, `kapi_ac`, `kapi_kapa`, `seyir_yukari`, `seyir_asagi`, `bosta` gibi kavramlar temel olarak runtime state/event/condition'lardır.

Bunların her birini ayrı fiziksel widget sınıfı yapmak zorunlu değildir.

Örnek:

```text
Widget: Image/Media

Binding:
    condition = fire == true
    priority  = 10

Content:
    fire-warning.png
```

Aynı mekanizma:

```text
fire
overload
estop
door_open
door_closing
moving_up
moving_down
lighting
fan
maintenance
energy
...
```

gibi tamamen farklı runtime datalarıyla çalışabilmelidir.

Elevator-specific hazır event'ler UI'da kolay kullanım için preset olarak sunulabilir.

---

# 7. Runtime state

Runtime state seri haberleşmeden gelen verinin Designer runtime modelindeki temsilidir.

Örneğin:

```text
floor = 8
direction = up
door = closed
fire = false
overload = false
estop = false
```

Designer runtime truth'u değiştirmez.

Özellikle kat numarası ve yön için:

> Asansör kontrolcüsü ne gönderiyorsa onu göster.

Designer katı hesaplamaz, yönü tahmin etmez ve kontrolcü verisini düzeltmeye çalışmaz.

---

# 8. Event priority

Birden fazla event aynı anda aktif olabilir.

Her event/condition için **0–10 arasında ayarlanabilir priority** bulunmalıdır.

Örnek başlangıç değerleri yalnızca örnektir:

```text
fire              10
e-stop             9
overload           8
service            7
door_open           4
door_closing        3
moving              2
idle                0
```

Ürün defaultları ayrıca tanımlanabilir.

Daha yüksek priority, aynı anda aktif düşük priority durumun önüne geçer.

Aynı priority değerinde iki koşul aynı anda aktifse çözüm deterministic olmalıdır. Tie-break kuralı ayrıca tanımlanmalı; rastgele seçim yapılmamalıdır.

---

# 9. Runtime visibility

Widgetlar runtime state'e göre:

- görünür,
- görünmez,
- farklı content kullanır,
- farklı style/variant kullanır,
- farklı media kullanır,
- farklı text gösterir,
- farklı animation oynatır

hale gelebilir.

Örnek:

```text
Direction Widget

up == true
    → Up content

down == true
    → Down content

none
    → hidden
```

Kat numarası:

```text
floor available
    → floor content visible

floor unavailable
    → hidden
```

---

# 10. Resmî widget kavramları

Başlangıç widget paleti şu kavramları desteklemelidir:

- Background
- Floor Number / Kat Numarası
- Direction Arrow / Yön Oku
- Clock / Saat
- Floor List / Kat Listesi
- Logo
- Text / Metin
- Image/Media based warning or event content
- Video
- Media Sequence
- Door Animation
- Overlay, yalnız hedef profile gerçek bir export karşılığı varsa

Ancak widget listesi runtime event isimleriyle karıştırılmamalıdır.

Örneğin `Yangın Uyarısı` UI'da hazır bir semantic preset olabilir; domain'de bu, generic media/image widget + `fire == true` binding olarak temsil edilebilir.

---

# 11. Widget ortak modeli

Her widget mümkün olduğunca şu ortak bilgileri taşır:

```text
id
name
type
enabled
locked
form geometry
layer
runtime bindings
priority rules where applicable
style
content/media binding
widget-specific properties
```

Teknik ID kullanıcıya zorunlu olarak gösterilmez.

Kullanıcı:

```text
+ Add Widget → Video
```

der.

Sistem benzersiz teknik ID üretir.

---

# 12. Widget Type ≠ Media Type

Bu ayrım zorunludur.

```text
Widget
  ↓
Content Binding
  ↓
Media Type
```

Bir widgetın içeriği profile izin verdiği ölçüde:

- image
- video
- media sequence

olabilir.

Örneğin:

```text
Direction Arrow
    ├── image
    └── video

Floor Number
    ├── image/digit assets
    └── video/animated digit

Background
    ├── image
    └── video
```

Video yalnızca `VideoWidget` isimli bağımsız bir kutu değildir; bazı widgetların content türü de olabilir.

---

# 13. Background

Background ekranın arka plan içeriğidir.

Profile izin veriyorsa:

- static image
- video

kullanabilir.

Background ile canvas üzerinde serbest konumlanan normal media widget ayrıdır.

---

# 14. Kat Numarası widgetı

Kat numarası runtime-driven bir widgettır.

Kontrolcüden gelen floor değeri olduğu gibi gösterilir.

Örnek:

```text
floor = -1 → -1
floor = 8  → 8
floor = 16 → 16
no floor signal → hidden
```

Kat numarası için grafik tabanlı digit style kullanılabilir.

Digit assetleri saydam arka plana sahip olmalıdır.

Hedef temel image formatı:

```text
ARGB8888
```

olarak desteklenmelidir; gerçek firmware pixel formatı device profile tarafından doğrulanır.

Kat numarası yalnız statik image olmak zorunda değildir. Kullanıcı hareketli digit tasarlamak isterse video/media tabanlı içerik kullanılabilmelidir.

---

# 15. Direction Arrow widgetı

Yön oku runtime state'e bağlıdır.

```text
up
 ↓
Up variant

 down
 ↓
Down variant

none
 ↓
hidden
```

## Default style

Programın default paketiyle birden fazla ok şekli gelir. Başlangıçta örneğin 10 şekil bulunabilir.

Kullanıcı:

```text
Shape
Color
```

seçer.

Programın sunduğu renk paletinden istediği rengi seçebilir.

Up ve Down seçimleri varsayılan olarak aynı shape/style olabilir ancak **bağımsızdır**.

Örneğin:

```text
Up:
    Default Shape 04
    Blue

Down:
    Default Shape 07
    Blue
```

geçerlidir.

## Custom style

Kullanıcı custom dosya yükleyebilir.

```text
Up   → custom_up.png / custom_up.video
Down → custom_down.png / custom_down.video
```

Custom Up seçildiğinde Down otomatik doldurulmaz.

Custom içerikte Designer'ın default color palette'i uygulanmaz. Dosya neyse o gösterilir.

Custom image image olarak, custom video video olarak kullanılmalıdır.

---

# 16. Digit styles

Digit style, Direction Arrow style ile aynı genel tasarım mantığına sahiptir fakat Up/Down varyantı yoktur.

Örnek:

```text
Digital Style 01
    0
    1
    2
    ...
    9
    -
```

Default digit styles programla gelir.

Kullanıcı custom digit style ekleyebilir.

Digit content image veya profile destekliyorsa video olabilir.

---

# 17. Stil kavramı

Bu üründe stil yalnızca renk değildir.

**Stil = görsel şekil/karakter + ilgili asset seti + varyantlar + varsa renk seçenekleri.**

Örneğin:

```text
Arrow Style 04
├── Up asset
├── Down asset
└── selectable colors
```

Default style'larda renk palette üzerinden seçilebilir.

Custom style'da yüklenen dosya authoritative asset'tir; default palette ile yeniden renklendirilmez.

Şimdilik `firmware_selectable` gibi bir style alanı gerekmemektedir. Stil seçimi ve firmware'de bulunabilirlik cihaz/profile/theme sözleşmesi üzerinden çözülmelidir.

---

# 18. Normal Text widgetı

Normal Text widgetı glyph atlası kullanmaz.

Firmware flashında bulunan fontlardan biri seçilir.

Designer şu özellikleri taşıyabilir:

```text
Text
Font
Size
Bold
Italic
Alignment
Line/overflow behaviour
```

Örnek:

```text
Text: Kapı açık
Font: Modern Sans
Size: 32
Bold: true
Italic: false
```

Designer font glyphlerini firmware'e ayrıca üretmek zorunda değildir.

---

# 19. Event-driven Text

Text widgetı generic runtime conditions ile bağlanabilir.

Örneğin:

```text
Default:
    Hoş geldiniz

floor == 1:
    1. kata hoş geldiniz

moving_up:
    Yukarı çıkılıyor

moving_down:
    Aşağı iniliyor

door_open:
    Kapı açık

fire:
    Yangın!
```

Bu yapı yalnız elevator eventlerine özel kodlanmamalıdır.

Properties panelinde kullanıcı condition ekleyip her condition için text tanımlayabilmelidir.

---

# 20. Dynamic floor + direction alignment

Klasik anchor sistemi **kullanılmayacaktır**.

İhtiyaç şudur:

```text
7   ↑
16  ↑
-1  ↑
```

farklı digit genişliklerinde bile floor number ve arrow arasındaki görsel ilişki stabil kalmalıdır.

Bu problem için daha sonra özel bir:

**Dynamic Runtime Layout / Alignment Group**

mekanizması tasarlanacaktır.

Bu sistem runtime content bounds, digit count, media bounds, desired spacing ve alignment üzerinden çözüm üretmelidir.

Şimdilik klasik `anchor -> target widget -> anchor graph` implementasyonu yapılmayacaktır.

Asansör kontrolcüsü runtime verisinin doğruluğundan sorumludur; Designer'ın görevi bu veriyi görsel olarak doğru yerleştirmektir.

---

# 21. Event-based warning / alarm içerikleri

Yangın, E-Stop, aşırı yük ve servis dışı gibi durumlar generic runtime eventlerdir.

Her event için ayrı content binding yapılabilir.

Örnek:

```text
fire = true
priority = 10
content = fire-warning.png
```

```text
overload = true
priority = 8
content = overload-warning.png
```

Bu nedenle tek bir `uyari` widgetı altında bütün alarm kaynaklarını zorunlu olarak toplama yaklaşımı kullanılmamalıdır.

Kullanıcı ayrı widgetlar ekleyebilir ve her birini farklı event condition'a bağlayabilir.

---

# 22. Media Sequence

Media Sequence, birden fazla media içeriğini zaman sırasına göre çalıştıran gerçek bir widgettır.

Her sequence item en az şu mantığı destekleyebilmelidir:

```text
media_id
duration_ms
repeat_mode
repeat_count
fit
audio_binding
audio_policy
```

Örnek:

```text
0–3000 ms   image_01
3000–8000   video_01
8000–11000  image_02
```

Profile sequence desteklemiyorsa widget palette'de gizlenmeli veya publish'te kesin hata vermelidir.

---

# 23. Door Animation

Door Animation semantik olarak kapı açılma/kapanma davranışına yönelik hazır widget/preset olabilir.

İçeriği:

- image
- video
- animation/media sequence

olabilir; device profile izinlerini takip eder.

Örneğin:

```text
door_opening
    → opening animation

door_closing
    → closing animation
```

Bu da generic runtime event engine üzerinden çalışır.

---

# 24. Overlay

Overlay, canvas üzerinde başka içeriklerin üzerine gelen saydam görsel katmandır.

Ancak hedef firmware'in bağımsız overlay kavramını desteklemesi zorunlu değildir.

Bu nedenle:

- profile gerçek bir overlay export karşılığı varsa kullanılabilir,
- yoksa publish'te açık ve actionable validation hatası verilmelidir.

Sessizce yok sayılmamalıdır.

Overlay V1'in ana widgetlarından biri olmak zorunda değildir.

---

# 25. Media asset sistemi

Designer kaynak asset ile firmware target asset'i birbirinden ayırmalıdır.

Kaynaklar örneğin:

```text
PNG
JPG
MP4
MOV
MKV
AVI
WAV
MP3
OGG
```

olabilir.

Hedef formatlar cihaz profile göre belirlenir.

En azından ürün yol haritasında şu dönüşümler desteklenmelidir:

```text
Image → target image / ARGB8888 where required
Video → MJPEG AVI where required
Audio → WAV where required
```

Kaynak dosyanın var olması target dosyanın hazır olduğu anlamına gelmez.

---

# 26. Media resize / preparation

Designer içinde temel medya hazırlama bulunmalıdır:

- resize
- fit
- crop
- target resolution
- target format preparation

Ayrı bir Format Tool kullanılabilir; Designer buna bağımlı olmamalıdır.

İleri aşamada kaynak video seçildiğinde video görüntüsünü ve sesini otomatik ayırmak faydalı olacaktır. İlk sürümde bu dönüşüm ayrı bir Format Tool'a bırakılabilir.

---

# 27. Video + external audio

Video widget/content seçildiğinde harici audio binding desteklenmelidir.

Örneğin:

```text
Video: lobby.mp4
Audio: background.wav
```

Audio policy açıkça modellenmelidir.

İleride şu seçenekler desteklenebilir:

```text
Use video audio
Use external audio
Mix video audio + background audio
Mute video audio
```

Video kaynağının audio stream'ini otomatik ayırma ilk implementation'da zorunlu değildir.

---

# 28. Runtime event priority çözümleme örneği

```text
Runtime:

floor = 8
direction = up
door = closed
fire = true

events:
    moving_up priority=2
    fire      priority=10
```

Resolution:

```text
fire wins
```

Ancak floor/direction gibi bağımsız runtime signals tamamen kaybolmaz; hangi widgetların hangi priority-aware binding'e sahip olduğuna göre çözülür.

Priority'nin yalnız tüm ekranı körlemesine değiştiren tek bir global state olması zorunlu değildir. Binding seviyesinde uygulanabilmelidir.

---

# 29. Runtime Simulator

Designer içinde gerçek cihaz olmadan template'in runtime davranışını gösteren Simulator bulunmalıdır.

Simulator seri haberleşmeden data geliyormuş gibi davranır.

Elevator simulator örneği:

```text
Floor: -1 ... 11
Direction: None / Up / Down
Door: Closed / Opening / Open / Closing
Fire: Off / On
Overload: Off / On
E-Stop: Off / On
Service: Off / On
```

Kullanıcı:

- Play
- Pause
- Step
- Reset
- state değiştir

işlemlerini yapabilmelidir.

---

# 30. Simulator gerçek renderer'ı kullanır

Simulator için ayrı sahte bir render sistemi yapılmamalıdır.

```text
Simulator Input
      ↓
Runtime State
      ↓
Event/Binding Engine
      ↓
Real Widget Resolution
      ↓
Real Renderer
      ↓
Canvas
```

Örneğin:

```text
Fire = ON
```

gerçek fire binding'ini tetikler.

```text
Door = Opening
```

gerçek door animation/media binding'ini tetikler.

```text
Floor = -1
```

gerçek floor widgetının -1 göstermesini sağlar.

---

# 31. Real runtime ile simulator ayrımı

Simulator firmware değildir.

Simulator yalnızca runtime state + binding + rendering davranışını test eder.

İleride gerçek seri haberleşme adapteri:

```text
Serial Input
    ↓
Runtime State
```

Simulator ise:

```text
Simulator Controls
    ↓
Runtime State
```

üretir.

Her iki yol aynı Event/Binding Engine'i kullanmalıdır.

---

# 32. Test edilebilirlik

Uygulama baştan test edilebilir tasarlanmalıdır.

Test kapsamı:

### Unit / domain tests

- project model
- runtime state
- priority resolution
- widget binding
- media binding
- style resolution
- dynamic layout
- validation

### Integration tests

- project → renderer
- project → simulator
- project → package builder
- package → SD deployment

### Visual tests

- form render
- widget placement
- runtime states
- alarm states
- floor values
- direction variants

---

# 33. AI authoring

AI programın içine gömülü değildir.

Template oluşturma amacıyla harici bir LLM/coding agent Designer'ın API/CLI/command yüzeyini kullanabilmelidir.

Örnek client:

```text
VS Code
Claude
other external LLM agent
        ↓
Designer API / CLI
```

Programın içine AI API key koymak veya cloud AI servisine bağımlı olmak V1 gereksinimi değildir.

---

# 34. Designer API

UI ve AI aynı application command katmanını kullanmalıdır.

Kavramsal API:

```text
create_project()
select_device()
add_widget()
remove_widget()
set_widget_property()
set_geometry()
set_media()
set_style()
bind_runtime_condition()
set_priority()
set_text()
set_font()
validate()
render()
simulate()
export_package()
```

Gerçek API isimleri implementasyon sırasında typed command modeline göre belirlenebilir.

AI'nin UI tıklamalarını taklit etmesi tercih edilmez.

---

# 35. Designer Console

Programda görünür bir Console/Log paneli bulunmalıdır.

API ile çalışan işlemler burada görülebilmelidir.

Örneğin:

```text
> create_project("Modern Elevator")
✓ Project created

> select_device("H747-V2")
✓ Device selected

> add_widget("direction")
✓ Widget added

> set_style("Arrow 04")
✓ Style assigned

> bind_runtime("direction", "up")
✓ Binding created

> validate()
✓ 0 errors
```

Bu console geliştirme ve AI-assisted authoring için önemlidir.

---

# 36. AI'nin asset/style awareness'i

External AI mevcut Designer asset/style kütüphanesini okuyabilmelidir.

Örneğin API ile:

```text
list_devices()
list_widget_types()
list_styles()
list_colors()
list_media()
list_fonts()
list_runtime_signals()
get_capabilities()
```

gibi bilgi alınabilmelidir.

AI mümkün olduğunca mevcut default assetleri yeniden kullanmalıdır.

Yeni asset gerektiğinde external Python/image-generation tooling kullanılabilir ve üretilen asset Designer API ile projeye import edilebilir.

---

# 37. AI'nin oluşturduğu template'i görmesi

AI yalnız JSON üretip işi bitirmiş sayılmamalıdır.

Designer AI'nin şu bilgileri okuyabileceği bir interface sağlamalıdır:

```text
Project summary
Device profile
Forms
Widget list
Widget geometry
Styles
Media bindings
Runtime bindings
Priority rules
Current simulator state
Validation results
```

Ayrıca render edilmiş preview/screenshot alınabilmelidir.

AI workflow:

```text
Create template
      ↓
Render
      ↓
Simulate runtime states
      ↓
Capture screenshot
      ↓
Inspect result
      ↓
Modify template
      ↓
Render again
      ↓
Validate
```

AI'nin oluşturduğu template'in hangi runtime state'lerinde ne göstereceğini anlayabilmesi ürün gereksinimidir.

---

# 38. AI için semantic project description

Project model makine tarafından okunabilir olmalıdır.

AI bir template'i açtığında yalnız ham koordinatları değil, şu bilgileri de anlayabilmelidir:

```text
This is the background.
This widget displays floor number.
This widget displays direction.
This text appears when door_open.
This media appears when fire.
Fire has priority 10.
This form is r0.
This is the r90 variant.
```

Bu nedenle project metadata ve runtime bindings semantic ID'ler taşımalıdır.

---

# 39. AI-generated template visual verification

AI tarafından oluşturulan template için minimum verification:

```text
Render r0
Render r90
Render r180
Render r270

Simulate:
- idle
- floor -1
- floor 0
- floor 11
- moving up
- moving down
- door opening
- door closing
- fire
- overload
- estop
```

Her state için render/screenshot alınabilmesi hedeflenmelidir.

Bu özellik AI'nin template'i kendi çıktısıyla karşılaştırmasına ve düzeltmesine imkan verir.

---

# 40. SD Card package

V1 deployment SD card üzerindedir.

Genel yapı kavramsal olarak:

```text
SD Card/
├── config.cfg
├── Theme-1/
│   └── config.cfg
├── Theme-2/
│   └── config.cfg
└── ...
```

Root `config.cfg`:

- SD kartın genel bilgileri,
- tema listesi/indexi,
- deployment/global metadata

gibi kart seviyesindeki bilgileri taşır.

Her tema klasöründeki `config.cfg` yalnız o temanın içeriği hakkındaki bilgileri taşır.

Kesin alan isimleri ve firmware parser sözleşmesi deployment contract ile ayrıca tanımlanacaktır.

---

# 41. Deployment güvenilirliği

Deployment:

```text
Prepare
 ↓
Validate
 ↓
Build
 ↓
Write
 ↓
Verify
 ↓
Safe eject
```

adımlarından geçmelidir.

Checksum/hash, yazma doğrulama, hata logları ve safe eject desteklenmelidir.

---

# 42. UI ürün yapısı

Ana uygulama alanları:

```text
Theme Library
Design Studio
Media Library
Test / Simulator
Publish
Settings
```

Design Studio genel bilgi mimarisi:

```text
+----------------------------------------------------------+
| Toolbar                                                   |
+----------------+-------------------------+---------------+
| Project/       |                         | Properties    |
| Layers/Assets  |      Device Canvas      | Inspector     |
|                |                         |               |
+----------------+-------------------------+---------------+
| Console / Logs / Simulator / Status                      |
+----------------------------------------------------------+
```

Görsel referanslarda bulunan profesyonel engineering/design-tool karakteri korunmalıdır.

---

# 43. Dosya organizasyonu

Tema için fiziksel klasör yapısı implementasyon detayıdır.

Öncelik:

- semantic project model,
- deterministic package,
- kolay validation,
- AI tarafından okunabilirlik,
- firmware parser uyumluluğu

olmalıdır.

Klasör yapısı yalnız "güzel göründüğü" için seçilmemelidir.

---

# 44. Kaldırılan / geçersiz eski yaklaşımlar

Aşağıdaki eski yaklaşımlar V2 canonical contract değildir:

### Klasik anchor graph

`anchor -> target widget -> anchor` sistemi kullanılmayacaktır.

### Text glyph atlası

Normal Text widgetı için Designer-side glyph üretimi kullanılmayacaktır. Firmware fontları kullanılacaktır.

### Tek `uyari` widgetı

Tüm uyarıları tek widget altında toplamak zorunlu değildir. Runtime event + generic content binding kullanılacaktır.

### `firmware_selectable` style flag'i

Şimdilik gerekli değildir.

### Event = Widget sınıfı

`fire`, `door_open`, `moving_up` gibi runtime eventlerin her biri ayrı widget class olmak zorunda değildir.

### Eski Python repository yapısına bağımlılık

Eski implementasyon referans olabilir; yeni Windows uygulaması eski dosya yapısını zorunlu olarak taşımamalıdır.

---

# 45. V1 önceliği

İlk çalışan ürün için öncelik sırası:

1. Device profile/capability model
2. Theme project model
3. Widget model
4. Media/asset system
5. Runtime state/event engine
6. Priority resolution
7. Canvas renderer
8. Properties inspector
9. Simulator
10. Validation
11. Package builder
12. SD card deployment
13. AI/CLI/API authoring surface

AI API yüzeyi ve Simulator sonradan eklenen bir "eklenti" gibi tasarlanmamalıdır; application core sınırları baştan bunları desteklemelidir.

---

# 46. Başarı kriteri

V1 şu senaryoyu gerçekleştirebilmelidir:

```text
Create Project
      ↓
Select Device
      ↓
Create Theme
      ↓
Add Background
      ↓
Add Floor Number
      ↓
Add Direction Arrow
      ↓
Add event-driven media/text
      ↓
Choose styles/colors
      ↓
Configure runtime bindings
      ↓
Set event priorities
      ↓
Run Simulator
      ↓
-1 / 0 / ... / 11
Up / Down
Door opening/closing
Fire
Overload
E-Stop
      ↓
Inspect real rendered result
      ↓
Validate
      ↓
Build package
      ↓
Write SD card
      ↓
Verify
      ↓
Safe eject
```

Buna ek olarak external AI:

```text
Designer API
   ↓
create/edit template
   ↓
Console
   ↓
Simulator
   ↓
Render/screenshot
   ↓
Validation
   ↓
Fix
```

workflow'unu kullanabilmelidir.

---

# 47. Tasarım ilkesi

Template Designer bir "resim yerleştirme programı" değildir.

Bir **runtime-driven visual template authoring system**dir.

Kullanıcı görsel tasarımı oluşturur; cihazın runtime verisi bu tasarımın hangi parçasının ne zaman görüneceğini belirler.

Temel ayrım:

```text
DESIGN TIME
────────────────────────
Widget
Style
Media
Text
Geometry
Binding
Priority
Device Capability

             ↓

RUNTIME
────────────────────────
Serial Data
State
Event
Priority Resolution
Content Selection
Rendering

             ↓

DEPLOYMENT
────────────────────────
Validated Package
SD Card
Physical Device
```

Bu ayrım bütün mimarinin temelidir.
