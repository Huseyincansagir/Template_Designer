# Template Designer — Domain / Runtime Contract V1 (Canonical)

**Status:** Canonical after product-decision review  
**Branch:** `manus2`

Bu belge Phase 1 domain implementasyonu için canonical referanstır. Firmware/DeviceProfile runtime truth'tur; Designer bu truth'u görsel, metinsel ve işitsel sunuma dönüştürür. Bu belge implementation kodu değildir.

## 1. Canonical hierarchy

```text
Workspace
└── Project
    └── Theme Project Group
        └── Theme Project
            ├── Rotation 0
            ├── Rotation 90
            ├── Rotation 180
            └── Rotation 270
```

- Theme Project gerçek temadır ve dört rotation içerir.
- Rotation/Form V1'de aynı fiziksel yön/geometri kavramıdır.
- Her rotation kendi Scene/Widget düzenini taşıyabilir.
- Domain hierarchy ile fiziksel SD-card klasör yapısı aynı şey değildir; export yapısı bu domain ilişkilerini temsil eder.

## 2. State, Scene and priority

**State != Scene.**

State firmware/device profile tarafından gelen runtime truth'tur. Birden fazla state aynı anda aktif olabilir.

Scene, aktif runtime state'ler ve Scene activation conditions üzerinden seçilen **tek active Scene**'dir.

Scene priority **0–10** arasındadır. Daha yüksek priority kazanır. Aynı priority'de **runtime'da daha sonra aktif olan Scene kazanır**. Project Explorer/document order tie-break değildir.

```text
Runtime states
    ↓
Scene activation conditions
    ↓
Scene priority 0..10 + runtime activation order
    ↓
ONE active Scene
    ↓
Widget bindings
    ↓
Visibility / content / playback
```

Binding Scene seçmez; active Scene içindeki presentation davranışını değiştirir. Widget Z-order ve Bounding Group, Scene priority'den ayrı kavramlardır.

## 3. Firmware-defined state registry

Runtime state listesi Designer'a hard-code edilmez.

- DeviceProfile/firmware hangi state'leri destekliyorsa Designer onları gösterir.
- DeviceProfile yeni state ekleyebilir.
- Designer custom runtime state oluşturmaz.
- `Custom State` V1'de yoktur.
- State ID stable/canonical firmware ID'sidir; UI label metadata'dan gelebilir.
- State ailesi cihaz/profil özeldir ve genişletilebilirdir.

Mevcut profile'daki bilinen warningler:

```text
service_out
overload
fire
```

Bunlar global sabit liste olarak Designer'a gömülmez. Gelecekte başka profile başka state/warning sağlayabilir. `estop` mevcut üç warning listesine otomatik eklenmez.

Direction ve door state isimleri de profile tarafından belirlenir. Designer kendi başına `idle`, `door_opening`, `door_open`, `door_closing`, `door_closed` gibi enum'ları zorunlu kılmaz.

Direction presentation mapping'i de profile registry'deki canonical state ID'lerine göre yapılır. `UP`, `DOWN` ve `none/no direction` aşağıdaki örneklerdir; bunlar Designer tarafından universal runtime enum olarak dayatılmaz:

```text
UP   → Up variant
DOWN → Down variant
none/no direction → hidden/no arrow
```

## 4. DeviceProfile

DeviceProfile aşağıdakilerin kaynağıdır:

- display resolution
- supported rotations
- supported scene/state capabilities
- runtime states
- runtime settings
- runtime parameters
- media capabilities
- supported formats
- supported colors/palette
- video/decode limits
- audio capabilities
- floor values
- language capabilities
- digit styles
- direction styles
- deployment capabilities

Designer capability'leri varsaymaz; profile'dan okur.

State registry ileride stableId, label, category, valueType, operators, allowedValues, simulator metadata gibi alanlar taşıyabilir. Kesin schema ayrı DeviceProfile contract'ında belirlenecektir.

## 5. Floor data and mapping

Floor raw/canonical değeri firmware'den gelir. Numeric ve symbolic değerler mümkündür; örnekler `-2`, `-1`, `0..11`, `K`, `P`, `R`, `Z`, `F`, `T` olabilir. Kesin değerler DeviceProfile'a aittir.

Designer raw floor değerini yeniden hesaplamaz.

```text
Firmware floor value
      ↓
Floor Mapping
      ↓
Display value
      ↓
Digit / Digit Style
```

Örnek: `-2 → P2`.

Floor Mapping için Digit Style seçilebilir. Kullanıcı özel Digit Style seçmezse Designer **default Digit Style kullanılsın mı?** diye sorar; kabul edilirse uygun default atanır.

## 6. Digit and Text

Digit widget font/glyph sistemi kullanmaz.

Digit:
- default digit styles
- custom digit style
- size
- style/color metadata
- firmware-selected style
- floor mapping

ile çalışır.

Text widget firmware font seçimi kullanır: type/family, size, bold, italic vb. Digit için glyph atlas veya Asset Browser font kategorisi yoktur.

## 7. Direction styles

Default Direction Style:
- 10 default shape/style seçeneği
- program/device profile palette'den renk seçimi
- Up/Down varyantları

Up seçildiğinde Down başlangıçta karşılık gelen default varyantı alır; kullanıcı Down'ı bağımsız değiştirebilir.

Custom Direction Style:
- kullanıcı dosya seçer
- image veya video olabilir
- dosya olduğu gibi kullanılır
- color picker yoktur
- Custom Up seçildiğinde Down otomatik doldurulmaz; ayrıca seçilir

## 8. Bounding Group

Bounding Group widget değildir; opsiyonel layout/composition grubudur. Özellikle Arrow + Digit gibi nesnelerin ortak merkez/reference üzerinden hizalanması için kullanılır.

Örnek merkez davranışı:

```text
1 child → child center
2       → group center
3       → middle/reference center
4       → between 2 and 3
5       → 3
```

Bu anchor graph değildir. V1'de `Fixed Slots` ve `Dynamic Active Items` ayrı zorunlu domain modları değildir; gerekirse ileride layout algorithm olarak eklenir.

## 9. Binding

Binding runtime state/value ile presentation davranışı arasındaki bağlantıdır.

Örnekler:

```text
floor == 6
Door == Opening
fire == true
floor == 6 AND Door == Opening
NOT fire
```

Widget tipine göre binding:
- visible/hidden
- media selection
- play/pause/stop/restart/continue
- text/content resolution
- digit value/style/media
- direction variant/style/media

sağlayabilir.

Binding Scene selection'ı değiştirmez. Arbitrary runtime property scripting V1 değildir.

`=floornumber` gibi parametric content extension point'tir. `=residents` gibi external data/CSV entegrasyonu geleceğe dönüktür; V1'in zorunlu runtime contract'ı değildir.

## 10. Media model

Media ile Widget Type ayrıdır.

Media types:
- image
- video
- audio

Widget types:
- Media
- Digit
- Direction
- Warning
- Text
- DeviceProfile'ın diğer desteklediği semantic widgetler

Bir widget yalnızca kendi capability'siyle uyumlu media/reference türlerini kullanabilir. Audio, generic olarak her semantic widget'a bağlanmaz; audio kullanımı Media/Media Slide ve audio policy kapsamındadır.

Duration her yerde **0.1 s** hassasiyetindedir.

Normal media default duration: **0 = indefinite/applicable default**.  
Media Slide içindeki media default duration: **3.0 s**.

Loop = sonsuz tekrar.  
Repeat = sınırlı tekrar.  
Repeat Count = tekrar sayısı.

Bu kavramlar desteklenen image/video/audio media ve gerektiğinde komple Media Widget playback'i için kullanılabilir.

Image şeffaflığı için hedef cihazın desteklediği alpha-capable format kullanılır. Mevcut proje kararındaki hedef format **ARGB888**'dir; başka formatlar yalnızca ilgili DeviceProfile capability'si tanımlıyorsa desteklenir.

Video dimensions, duration, loop/repeat, repeat count, volume, optional audio ve profile-defined decode capability taşır.

Audio duration, loop, repeat, repeat count ve volume taşır.

## 11. Media Slide

Media Slide popup widget değildir. Kata özel "popup" ihtiyacı Media Slide + binding ile çözülür.

```text
floor == 6
    ↓
Media Slide visible
    ↓
image/video
    ↓
optional audio
```

V1 canonical model:

```text
Media Slide
 ├── visual media: image OR video
 └── optional attached audio
```

Ayrı `Media Sequence` domain/widget nesnesi V1 için zorunlu değildir. Bir Scene'de birden fazla Media Slide bulunabilir ve DeviceProfile izin verdiği sürece aynı anda aktif olabilir.

Media Slide playback'in bitmesi Scene değiştirmez. Scene değişimi runtime state/priority sonucudur.

Scene değişiminde playback continuity kullanıcıya bir seçenek olarak sunulabilir. Yeni Scene'deki karşılık gelen media widget aynı gerekli size/playback continuity parametrelerine sahipse önceki playback'in yeni Scene'de devam etmesine izin verilebilir; farklıysa önceki playback kesilir ve yeni media doğrudan başlar. Bu bir runtime capability/option'dır; her media geçişinde otomatik devam garantisi değildir.

Daha önce konuşulan `1280×720` eşzamanlı video decode sınırı global Designer sabiti değildir; ilgili DeviceProfile capability'sidir ve validation bunu profile'a göre kontrol eder.

## 12. Audio policy

Üç temel katman vardır:

1. Background Music
2. Announcement / Voice
3. Media / Video Audio

Background Music Theme-level persistent/looping medyadır.

Designer default policy ayarları hazırlayabilir:
- volume
- priority
- ducking
- override
- mute
- background enable

Audio priority **0–100** aralığındadır. Designer policy metadata'sını tanımlar; gerçek firmware mixer/arbitration algoritmasını icat etmez.

Background + Announcement, Background + Media ve Background + Announcement + Media kombinasyonları policy ile tanımlanabilir. Firmware saha ayarları runtime'da template defaultlarını override edebilir.

Video/media audio volume ayrıca ayarlanabilir. Background music'in hangi durumda kısılacağı, tamamen kapanacağı veya hangi katmanın override edeceği policy alanlarıyla tanımlanabilir.

Language 1 / Language 2 announcement sırası Designer'da ayarlanabilir; iki dil seçildiğinde anonslar peş peşe oynatılabilir.

## 13. Localization

Language widget değildir; content resolution parametresidir.

Dil değişimi:
- text
- announcement audio
- media variants
- floor display
- digit/content representation

üzerinde etkili olabilir.

Tek veya çift dil desteklenebilir. Firmware'deki dil seçimi değiştiğinde template'in language-aware content'i buna göre çözülür.

Exact locale fallback, voice-pack registry ve locale-specific floor encoding DeviceProfile/firmware contract'ına aittir.

## 14. Asset / Resource ownership

### Asset Depot / Asset Browser
Library/depo sistemidir. Depodaki her asset otomatik export edilmez. Used/default işaretleri ve preview gösterilir.

### Resources
Project/Theme seviyesindeki desteklenen veya gerekli resource dosyalarıdır.

### Scene references
Scene içine eklenen asset Scene/Widget altında görünür ve o kullanım için referanslanır. Ownership ile reference kavramları birbirine karıştırılmaz.

### Unsupported Files
Ayrı alandır. Widget oluşturmaz, supported asset gibi davranmaz, Canvas'a render edilmez ve normal Scene asset pipeline'ına girmez.

Kullanıcı dosyayı Project Explorer'da nereye bırakırsa o hedefin import kuralları uygulanır. Canvas'a özel "dosya sürükle ve otomatik import et" davranışı yoktur.

V1 export kapsamı nettir: **Resources, Used assets ve Default assets** export edilir. Asset Depot'un kullanılmayan içeriği export edilmez. Unsupported Files normal export kapsamına girmez.

## 15. Stable ID

Stable ID ile Display Name ayrıdır.

```text
Stable ID: media_0042
Display Name: Serdar Ortaç
```

UI display name gösterebilir; firmware/package reference stable ID kullanır.

Rename stable ID'yi değiştirmez. Stable ID immutable, deterministic ve reference-safe olmalıdır.

Stable ID'nin collision-free scope'u Theme/Project/Rotation gibi hiyerarşik bağlamları gerektiğinde kodlayabilir. Proje kararındaki yaklaşım, stable ID içinde theme/rotation gibi bağlamların basit ve deterministik biçimde temsil edilebilmesidir; exact string encoding ayrı implementation detail olarak standardize edilir.

Aynı asset farklı Theme'lerde duplicate/reference edilebilir. Farklı Theme'lerde fiziksel duplicate bulunması tek başına debug/runtime hatası değildir; ilgili deployment scope içinde stable ID collision oluşmamalıdır.

## 16. Package / SD Card

V1 semantic yapı:

```text
SD Card
├── config.cfg
└── Theme Project
    ├── config.cfg
    ├── R0
    ├── R90
    ├── R180
    ├── R270
    └── resources
```

Root `config.cfg` project genel bilgileri ve tema/index metadata'sını taşır. Her Theme Project kendi `config.cfg` dosyasına sahiptir.

Kesin fiziksel klasör isimleri exporter implementasyonunda standardize edilebilir; semantic hierarchy değişmez. Ayrıntılı fiziksel asset klasörleme/export mapping ayrı Asset/Media Package specification'ında standardize edilir.

İleride Theme Project config içinde dosya dizini/manifest-index bulunabilir; bu V1 firmware'ini gereksiz yere karmaşıklaştırmamak için sonraki iştir.

## 17. Export flow

```text
Editable Project
      ↓
Resolve DeviceProfile
      ↓
Resolve Themes / Rotations / Scenes
      ↓
Resolve Widget references
      ↓
Resolve Stable IDs / Assets / Resources
      ↓
Validation
      ↓
Build SD package
      ↓
Verification
```

Absolute development paths export edilmez. Stable IDs ve package-relative references kullanılır.

## 18. Format conversion boundary

V1 Template Designer full format conversion yapmaz.

Ayrı Format Tool daha sonra:
- resize
- format conversion
- MP4 → AVI
- image conversion
- audio conversion
- ARGB888 preparation

yapabilir.

Designer V1:
- capability validation
- unsupported indication
- media metadata
- asset reference
- export dependency resolution

yapar.

Hedef format dönüşümü gerekiyorsa fakat henüz yapılmamışsa açık validation sonucu üretilir; otomatik conversion yapılmaz.

## 19. Validation

Validation editor, simulator, console ve export tarafından ortak kullanılmalıdır.

Kontroller:
- missing referenced asset
- broken stable ID reference
- invalid binding
- unsupported required capability
- invalid configuration
- duplicate stable ID in deployment scope
- invalid required rotation
- unresolved required floor mapping
- impossible device capability combination
- simultaneous video/decode capability violation
- missing required content
- missing optional language/style/media content

Severity matrix profile-aware olabilir. Ürün kararında kesinleşmemiş severity'ler implementation sırasında sessizce uydurulmaz.

## 20. Simulator

Simulator gerçek runtime domain evaluation motorunu kullanmalıdır; ayrı bir sahte state sistemi olmamalıdır.

```text
runtime values/states
      ↓
scene conditions
      ↓
priority + activation order
      ↓
active Scene
      ↓
binding evaluation
      ↓
render / media / audio
```

DeviceProfile'a yeni state eklenirse simulator profile registry üzerinden otomatik genişleyebilmelidir.

Simulator örnek runtime senaryolarını üretmek için DeviceProfile'ın gerçek state/value registry'sini kullanabilir; yeni state icat etmez.

## 21. AI theme generation

AI tema oluşturma sistemi DeviceProfile, Scene, Widget, Media, Binding, Floor Mapping ve Style registry'yi bilmelidir.

AI kendi runtime state'ini icat etmez. AI çıktısı Simulator'da gerçek domain evaluation ile test edilebilir.

AI model/API key runtime programına gömülmez; AI generation geliştirme/authoring tarafında dış araç/API kullanımıdır.

## 22. V1 non-goals

- ARKEL seri protokolünün Designer'a gömülmesi
- raw UART parser / CRC / frame decoder
- user-defined Custom State
- full Format Tool
- automatic MP4→AVI conversion
- generic Media Sequence domain object
- arbitrary runtime property scripting
- external residents/CSV runtime system
- advanced manifest/index lookup
- Wi-Fi deployment

## 23. Remaining technical decisions

Ürün mantığı artık canonicaldır. Sonraki teknik sözleşmelerde belirlenecek konular:

- kesin DeviceProfile JSON/schema
- state registry metadata alanları
- Project/Theme/Rotation/Scene/Widget stable-ID namespace formatının exact string encoding'i
- root/theme `config.cfg` kesin alanları
- exact physical export folder names
- profile-aware validation severity matrix
- firmware audio mixer implementation
- locale fallback algorithm
- future manifest/index formatı

Bunlar temel domain davranışını değiştirmeden ayrıca standardize edilebilir.

## 24. Canonical decision matrix

| Konu | V1 kararı |
|---|---|
| State source | DeviceProfile/Firmware |
| Custom State | Yok |
| State list | Device/profile specific, extensible |
| Active Scene | Tek |
| Scene priority | 0–10 |
| Same priority | Runtime'da son aktif olan kazanır |
| Warning | State ailesinin parçası |
| Current warnings | service_out, overload, fire |
| Direction states | DeviceProfile-defined |
| Door states | DeviceProfile-defined |
| Floor | DeviceProfile-defined raw value |
| Floor mapping | Designer/project rule |
| Floor digit style | Seçilebilir; seçilmezse default sorulur |
| Digit font/glyph | Yok |
| Text font | Firmware font selection |
| Bounding Group | Opsiyonel layout group |
| Anchor graph | V1 yok |
| Media | image/video/audio |
| Media vs Widget | Ayrı kavramlar |
| Media Slide | visual image/video + optional attached audio |
| Popup widget | Yok |
| Normal media duration | 0 / indefinite default |
| Slide duration | 3 s default |
| Duration precision | 0.1 s |
| Loop | Infinite |
| Repeat | Counted |
| Direction defaults | 10 shapes + palette |
| Direction custom | File as-is, no color picker |
| Asset Depot | Library, not auto-export |
| Exported assets | Resources + Used + Default |
| Unsupported Files | Ayrı alan |
| Stable ID | Display name'den bağımsız immutable reference |
| Stable ID scope | Deterministic, collision-safe, hierarchical context may be encoded |
| Root config | Project/SD general metadata |
| Theme config | Theme content metadata |
| Format conversion | V1'de ayrı Format Tool |
| Simulator | Aynı domain evaluation motoru |
| AI state creation | Yok |

## 25. Phase 1 implementation rules

1. Runtime state listelerini global hard-code etme.
2. DeviceProfile registry'yi canonical source yap.
3. State ve Scene'i ayrı domain modelleri yap.
4. Scene selection'ı binding evaluation'dan önce yap.
5. Aynı Scene priority'de runtime activation order kullan.
6. Binding Scene selection'ı değiştirmesin.
7. Digit ve Text'i ayır.
8. Media ve Widget Type'ı ayır.
9. Popup domain nesnesi oluşturma; Media Slide kullan.
10. Asset Depot ile Resources'ı birleştirme.
11. Stable ID ve display name'i birleştirme.
12. Unsupported Files'ı normal asset pipeline'a sokma.
13. Format conversion'ı V1 Designer'a gömme.
14. DeviceProfile'da olmayan capability/state'i varsayma.
15. Simulator ve AI preview aynı domain evaluation motorunu kullanmalı.
16. Export kapsamını Resources + Used + Default ile sınırla.
17. Audio priority range'ini 0–100 kabul et; mixer/arbitration implementation'ını firmware'e bırak.
18. Generic semantic widget'lara audio capability varsayma.
19. Stable ID'lerin deployment scope içinde deterministic ve collision-safe olmasını sağla.
