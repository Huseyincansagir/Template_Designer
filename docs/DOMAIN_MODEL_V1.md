# Template Designer — Domain Model V1

Bu belge, mevcut ürün kararlarını platformdan bağımsız domain modeline çevirir. UI, Tauri, filesystem ve SD-card erişimi domain modelinin sahibi değildir.

## Ana nesneler

```text
Project
├── DeviceProfile
├── Theme[]
├── Asset[]
└── ProjectSettings

Theme
├── Canvas
├── Scene[]
├── Widget[]
├── BoundingGroup[]
└── ThemeDefaults

DeviceProfile
├── display
├── supportedWidgetTypes
├── supportedMediaTypes
├── supportedFormats
├── runtimeStates[]
├── runtimeSettings[]
├── languages[]
├── fonts[]
├── styles[]
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
├── themes
├── assets
└── metadata
```

## DeviceProfile

Cihaz/firmware capability sözleşmesidir. Designer kullanıcıya rastgele runtime state veya setting oluşturmaz.

Profile; desteklenen widget/media/formatları, runtime state registry'yi, runtime setting registry'yi, dilleri, fontları, stilleri ve display/audio capability'lerini tanımlar.

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

Mevcut elevator kapsamındaki üç uyarı:

```text
service_out
 overload
fire
```

Bunların dışında yeni warning varsayılmaz. Diğer runtime state'ler warning değildir; örneğin floor, up/down ve kapı durumları ayrı runtime state'lerdir.

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

## Theme / Scene / Widget

Theme ekran tasarımının editable modelidir. Scene editor/simulator organizasyonu için kullanılabilir; gerçek runtime state çözümlemesinin yerine geçmez.

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

Widget type ile media type ayrı kavramlardır.

## Media Slide

Popup diye ayrı bir widget veya domain nesnesi yoktur. Kata özel üst içerik de Media Slide'dır.

```text
MediaSlide
├── media: image | video
├── duration
├── videoLoop
├── videoLoopCount
├── audio?
├── audioRepeatCount?
├── conditions[]
└── zIndex
```

Örneğin `floor == 5` koşuluna bağlanmış iki saniyelik fotoğraf ve ona bağlı ses, kullanıcıya popup gibi görünebilir; teknik olarak Media Slide'dır.

## Condition / Priority

Condition firmware-owned state/setting registry'den seçim yapar. Presentation priority 0–10 arasındadır.

Runtime priority ile visual z-order ve Bounding Group birbirinden bağımsızdır.

```text
Runtime Priority → hangi presentation davranışı kazanır
Z-order          → hangi içerik üstte çizilir
Bounding Group   → geometrik hizalama
```

## Z-order

Sahnedeki içerikler üst üste compositing edilir. Background en arkadadır. Bir Media Slide yüksek z-order ile diğer içeriklerin üzerinde gösterilebilir.

## Bounding Group

Opsiyonel layout container/composition nesnesidir; her widget kullanmak zorunda değildir.

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

`fixed_slots` ve `dynamic_active_items` davranışları desteklenebilir.

Özellikle floor + direction veya birden fazla uyarının ortak referansa göre hizalanmasını sağlar. 1 child varsa child merkezi; 2 child varsa ikisinin arasındaki merkez; 3 child varsa ortadaki child; 4 child varsa 2 ve 3 arasındaki merkez; 5 child varsa 3. child group referans merkezine gelir.

## Floor Number

Floor runtime state'ten gelir. Sadece decimal integer değildir. `-1`, `0..11` ve firmware tarafından sağlanan `R`, `Z`, `K`, `T`, `P` gibi sembolik değerler desteklenebilir.

Designer floor değerini yeniden yorumlamaz. Digit placement/alignment matematiğinin gerçek firmware rendererında uygulanması hedeflenir; Simulator aynı davranışı PC'de taklit eder.

## Direction

Runtime state tarafından belirlenir: up, down veya hidden/none. Default/custom arrow styles profile tarafından sağlanabilir. Up/down varyantları bağımsız değiştirilebilir.

## Style

Style görsel şekil/appearance ailesidir. Arrow ve digit style ayrı ailelerdir. Default paket stilleri ve custom asset stilleri desteklenebilir.

## Localization

Dil firmware runtime setting olabilir. Aynı template birden fazla dil için text, audio ve gerektiğinde media/digit varyantları taşıyabilir.

## Audio

Media Slide audio'sunun kendi repeat count'u vardır. Firmware runtime settings announcement/background-music/video-audio volume değerlerini değiştirebilir. Designer template defaultlarını hazırlayabilir; runtime audio arbitration Designer'ın işi değildir.

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
         Conditions
              ↓
      Presentation Priority
              ↓
      Active Content Set
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
