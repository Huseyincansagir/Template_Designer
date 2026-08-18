# Template Designer — Domain Model V1

Bu belge, mevcut ürün kararlarını platformdan bağımsız domain modeline çevirir. UI, Tauri, filesystem ve SD-card erişimi domain modelinin sahibi değildir.

## Ana nesneler

```text
Project
├── DeviceProfile
├── ThemeProjectGroup[]
├── Asset[]
└── ProjectSettings

ThemeProjectGroup
└── ThemeProject[]

ThemeProject
├── Rotation[4]
├── ThemeDefaults
└── Resources

Rotation
├── Scene[]
└── Widget[]

DeviceProfile
├── display
├── supportedWidgetTypes
├── supportedMediaTypes
├── supportedFormats
├── runtimeStates[]
├── runtimeSettings[]
├── languages[]
├── fonts[]
├── digitStyles[]
├── directionStyles[]
└── audioCapabilities
```

## Project

Editable çalışma alanıdır; deployment package değildir.

```text
Project
├── id
├── schemaVersion
├── name
├── deviceProfileId
├── themeProjectGroups
├── assets
└── metadata
```

## DeviceProfile

Cihaz/firmware capability sözleşmesidir. Designer kullanıcıya rastgele runtime state veya setting oluşturmaz.

Profile; desteklenen widget/media/formatları, runtime state registry'yi, runtime setting registry'yi, dilleri, fontları, digit/direction stillerini ve display/audio capability'lerini tanımlar.

Gerçek ARKEL raw protocol mapping bu modelin parçası değildir.

## Runtime State

Firmware'in ürettiği runtime bilgidir.

```text
RuntimeStateDefinition
├── id
├── displayName
├── type
├── category
├── description
├── enumValues?
└── simulator
```

Mevcut elevator kapsamındaki bilinen warningler:

```text
service_out
overload
fire
```

Bunlar global sabit liste olarak Designer'a gömülmez. Diğer runtime state'ler warning değildir; örneğin floor, direction ve kapı durumları ayrı runtime state'lerdir. Kesin registry aktif DeviceProfile tarafından belirlenir.

## Runtime Setting

Firmware menüsünden teknisyenin sahada değiştirebildiği ayardır.

```text
RuntimeSettingDefinition
├── id
├── displayName
├── type
├── options?
├── defaultValue?
├── persistence?
└── affectedCapabilities?
```

Örnekler: language, active_theme, arrow_style, digit_style, voice_pack, announcement_volume, background_music_volume, video_audio_volume. Kesin liste firmware profile tarafından belirlenir.

## Theme Project / Rotation / Scene / Widget

Theme Project gerçek editable temadır ve tam olarak dört rotation/form içerir:

```text
ThemeProject
├── R0
├── R90
├── R180
└── R270
```

Her Rotation kendi Scene ve Widget düzenini taşır. Rotation/Form V1'de aynı fiziksel yön/geometri kavramıdır.

Scene, runtime state değildir. Scene; aktif runtime state'ler ve scene activation conditions sonucunda runtime'da seçilen tek active presentation'dır. Bir Rotation birden fazla Scene içerebilir.

Widget canonical görsel nesnedir:

```text
Widget
├── id
├── widgetType
├── x/y/width/height
├── zIndex
├── bindings/conditions
├── content
└── style
```

Widget type ile media type ayrı kavramlardır. Digit ve Direction semantic widget'tır; generic Media inheritance kullanmazlar.

## Media Slide

Popup diye ayrı bir widget veya domain nesnesi yoktur. Kata özel üst içerik de Media Slide'dır.

```text
MediaSlide
├── media: image | video
├── duration
├── loop/repeat policy
├── audio?
├── conditions[]
└── zIndex
```

Örneğin `floor == 5` koşuluna bağlanmış iki saniyelik fotoğraf ve ona bağlı ses, kullanıcıya popup gibi görünebilir; teknik olarak Media Slide'dır.

## Condition / Priority

Condition firmware-owned state/setting registry'den seçim yapar. Presentation priority 0–10 arasındadır. Daha yüksek priority kazanır; aynı priority'de runtime'da daha sonra aktif olan Scene kazanır.

Runtime priority ile visual z-order ve Bounding Group birbirinden bağımsızdır.

```text
Runtime Priority → hangi Scene/presentation davranışı kazanır
Z-order          → hangi içerik üstte çizilir
Bounding Group   → geometrik hizalama
```

## Z-order

Sahnedeki içerikler üst üste compositing edilir. Background en arkadadır. Bir Media Slide yüksek z-order ile diğer içeriklerin üzerinde gösterilebilir.

## Bounding Group

Opsiyonel layout/composition ilişkisidir; Widget değildir ve Scene/State hierarchy'sini değiştirmez.

```text
BoundingGroup
├── reference
├── geometry
├── horizontalAlignment
├── verticalAlignment
├── spacing
├── layoutMode
└── children[]
```

1 child varsa child merkezi; 2 child varsa ikisinin arasındaki merkez; 3 child varsa ortadaki child; 4 child varsa 2 ve 3 arasındaki merkez; 5 child varsa 3. child group referans merkezine gelir. Bu V1 geometry/layout davranışıdır; klasik widget-to-widget anchor graph değildir.

## Floor Number

Floor runtime state'ten gelir. Sadece decimal integer değildir. `-1`, `0..11` ve firmware tarafından sağlanan `R`, `Z`, `K`, `T`, `P` gibi sembolik değerler desteklenebilir.

Designer floor değerini yeniden yorumlamaz. Digit placement/alignment matematiğinin gerçek firmware rendererında uygulanması hedeflenir; Simulator aynı davranışı PC'de taklit eder.

## Direction

Runtime state tarafından belirlenir: profile-defined up/down/none benzeri değerler olabilir. Default/custom arrow styles profile tarafından sağlanabilir. Up/down varyantları bağımsız değiştirilebilir. Direction generic Media değildir; custom style capability'si image/video referansı kullanabilir.

## Style

Style görsel şekil/appearance ailesidir. Arrow ve digit style ayrı ailelerdir. Default paket stilleri ve custom asset stilleri desteklenebilir.

## Localization

Program UI dili ve firmware/template runtime dili ayrı kavramlardır. Runtime language; text, announcement audio, media variants ve gerektiğinde floor/digit content resolution üzerinde etkili olabilir.

## Audio

Media Slide audio'sunun kendi loop/repeat policy'si vardır. Firmware runtime settings announcement/background-music/video-audio volume değerlerini değiştirebilir. Designer template defaultlarını ve 0–100 audio priority/ducking/override policy metadata'sını hazırlayabilir; gerçek runtime audio arbitration Designer'ın işi değildir.

## Asset

```text
Asset
├── id
├── sourcePath
├── mediaType
├── metadata
└── variants?
```

Deployment assetleri editable source'dan ayrı derlenmiş/normalize edilmiş biçimde paketlenebilir.

## Canonical runtime evaluation

Simulator ve ileride firmware kavramsal olarak şu zinciri takip eder:

```text
Runtime States + Runtime Settings
              ↓
      Scene Conditions
              ↓
      Presentation Priority
              ↓
        ONE Active Scene
              ↓
        Widget Bindings
              ↓
      Bounding/Layout
              ↓
        Z-order Render
              ↓
         Audio Output
```

Gerçek firmware audio arbitration, hardware renderer ve ARKEL frame decoding bu domain modelin dışındadır.

## AI

AI Designer API üzerinden profile ve domain model ile çalışır. Önce capability/state/setting bilgisi alınır; sonra template oluşturulur, validate edilir, simulator çalıştırılır ve render sonucu incelenir.

## Serialization

Domain model deterministic ve versioned olmalıdır. Editable project schema ile deployment schema ayrı olabilir. Domain modeli doğrudan SD-card path'lerine bağlanmamalıdır.

## Explicit boundaries

Bu sürümde tanımlanmayanlar: ARKEL raw protocol, UART/RS485 frame, bit/byte mapping, gerçek firmware register mapping, kesin hardware pixel pipeline, kesin audio mixer implementation ve Wi-Fi transport.
