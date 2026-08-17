# Template Designer — Template Schema V1

## Amaç

Bu belge editable Template/Project verisinin nasıl serialize edileceğini tanımlar. UI, Simulator, Validation, AI API ve Package Builder aynı canonical modele dayanır.

Deployment paketi bu dosyanın birebir kopyası değildir.

## İlkeler

- Schema version zorunludur.
- DeviceProfile template'in capability kaynağıdır.
- Kullanıcı firmware-owned runtime state veya warning tanımlayamaz.
- Widget type ile media type ayrıdır.
- Runtime condition, priority ve z-order ayrı alanlardır.
- Bounding Group opsiyoneldir.
- Asset referansları stable ID ile yapılır; absolute Windows path deployment modeline girmez.
- Bilinmeyen/unsupported capability template'e yazılmamalıdır.
- Serialization deterministic olmalıdır.

## Kök yapı

```json
{
  "schemaVersion": "1.0",
  "project": {},
  "deviceProfile": {},
  "themes": [],
  "assets": [],
  "localization": {},
  "metadata": {}
}
```

## Project

```json
{
  "id": "project-id",
  "name": "My Elevator Theme Project",
  "schemaVersion": "1.0",
  "deviceProfileId": "device-profile-id",
  "themeIds": ["theme-main"],
  "assetIds": [],
  "metadata": {}
}
```

Project editable çalışma alanıdır.

## Device Profile reference

Template yalnız profile ID/version referansı taşır. Profile'ın tamamını editable template içine kopyalamak zorunlu değildir.

```json
{
  "deviceProfileId": "elevator-display-v1",
  "deviceProfileVersion": "1.0"
}
```

Validation sırasında seçili profile yüklenir ve capability kontrolü yapılır.

## Theme

```json
{
  "id": "theme-main",
  "name": "Main Theme",
  "canvas": {
    "width": 480,
    "height": 800,
    "orientation": "portrait"
  },
  "settings": {},
  "widgets": [],
  "boundingGroups": []
}
```

Canvas boyut/orientation değerleri DeviceProfile ile uyumlu olmak zorundadır.

## Widget

Minimum ortak widget modeli:

```json
{
  "id": "widget-floor",
  "widgetType": "floor_number",
  "geometry": {
    "x": 100,
    "y": 200,
    "width": 120,
    "height": 80
  },
  "zIndex": 20,
  "visible": true,
  "styleRef": "digit-default-01",
  "bindings": [],
  "conditions": [],
  "content": {}
}
```

`geometry` doğrudan pixel veya profile'ın izin verdiği coordinate system ile ifade edilir. Coordinate system V1 implementation kararında tekleştirilecektir; schema farklı coordinate systemleri aynı anda uydurmamalıdır.

## Binding

Binding firmware-owned runtime state veya runtime setting'e referans verir.

```json
{
  "id": "binding-floor",
  "sourceType": "runtime_state",
  "sourceId": "floor"
}
```

Örneğin direction:

```json
{
  "sourceType": "runtime_state",
  "sourceId": "direction"
}
```

State isimleri Designer tarafından serbestçe oluşturulmaz.

## Condition

```json
{
  "id": "condition-floor-5",
  "expression": {
    "type": "comparison",
    "source": {
      "sourceType": "runtime_state",
      "sourceId": "floor"
    },
    "operator": "equals",
    "value": "5"
  },
  "priority": 3
}
```

Priority 0–10 aralığındadır.

Birden fazla condition'ın mantıksal birleşimi gerektiğinde expression ağacı kullanılabilir. V1 yalnız profile tarafından desteklenen operatorleri kabul eder.

## Warning priority

Mevcut elevator warning registry'de üç warning vardır:

```text
service_out
overload
fire
```

Bunların template presentation priority değerleri condition/presentation modelinde tutulabilir. Yeni warning Designer'da oluşturulamaz.

## Media Slide

Popup diye ayrı schema type yoktur.

```json
{
  "id": "slide-floor-5",
  "widgetType": "media_slide",
  "geometry": {
    "x": 0,
    "y": 0,
    "width": 480,
    "height": 800
  },
  "zIndex": 100,
  "conditions": ["condition-floor-5"],
  "media": {
    "type": "image",
    "assetRef": "asset-floor-5",
    "durationMs": 2000
  },
  "audio": {
    "assetRef": "audio-floor-5",
    "repeatCount": 1
  }
}
```

Video:

```json
{
  "media": {
    "type": "video",
    "assetRef": "video-floor-8",
    "durationMs": 0,
    "loop": true,
    "loopCount": 3
  }
}
```

Audio repeat count video loop count'tan bağımsızdır.

Media Slide'ın yüksek zIndex ile diğer presentation contentlerinin üzerinde görünmesi mümkündür.

Runtime audio arbitration firmware sorumluluğudur.

## Text

```json
{
  "widgetType": "text",
  "text": {
    "localizationKey": "welcome_message"
  },
  "fontRef": "firmware-font-01",
  "fontSize": 32,
  "bold": true,
  "italic": false,
  "alignment": "center"
}
```

Normal text glyph atlası olarak serialize edilmez. Firmware font referansı kullanılır.

## Localization

```json
{
  "languages": ["tr-TR", "en-US"],
  "strings": {
    "welcome_message": {
      "tr-TR": "Hoş Geldiniz",
      "en-US": "Welcome"
    }
  }
}
```

Audio/media localization gerekiyorsa variant asset referansları kullanılır.

## Floor-specific content

Kat özel içerik ayrı bir popup schema'sı değildir. Normal widget/Media Slide condition kullanır:

```json
{
  "conditions": ["condition-floor-5"]
}
```

Floor değerleri firmware registry tarafından tanımlanır. Decimal değerlerin yanında `R`, `Z`, `K`, `T`, `P` gibi semboller bulunabilir.

Designer floor değerini değiştirmez veya yeniden numaralandırmaz.

## Direction style

Style reference ile seçilir:

```json
{
  "widgetType": "direction",
  "style": {
    "mode": "default",
    "styleId": "arrow-style-03",
    "upVariant": "arrow-style-03-up",
    "downVariant": "arrow-style-03-down"
  }
}
```

Custom asset kullanılıyorsa:

```json
{
  "style": {
    "mode": "custom",
    "upAssetRef": "asset-arrow-up-custom",
    "downAssetRef": "asset-arrow-down-custom"
  }
}
```

Custom asset için Designer tarafından otomatik renk varyantı üretilmez.

## Digit style

```json
{
  "widgetType": "floor_number",
  "style": {
    "mode": "default",
    "styleId": "digit-style-02"
  }
}
```

Custom digit style profile tarafından izin verilen asset/format sözleşmesine uymalıdır.

## Bounding Group

Opsiyoneldir:

```json
{
  "id": "group-floor-direction",
  "reference": {
    "type": "screen",
    "anchor": "center"
  },
  "geometry": {
    "width": 100,
    "height": 60
  },
  "horizontalAlignment": "center",
  "verticalAlignment": "center",
  "spacing": 20,
  "layoutMode": "dynamic_active_items",
  "children": [
    "widget-floor",
    "widget-direction"
  ]
}
```

Bounding Group olmayan widgetlar normal geometry ile çalışır.

## Asset

```json
{
  "id": "asset-floor-5",
  "mediaType": "image",
  "source": {
    "kind": "project_relative",
    "path": "media/floor5.jpg"
  },
  "metadata": {
    "width": 480,
    "height": 800,
    "format": "jpeg"
  }
}
```

Windows absolute path kullanılmamalıdır.

Generated/converted media çıktıları package build aşamasında üretilebilir.

## Runtime settings defaults

Template firmware-owned settinglerin default değerlerini override edebiliyorsa, bunu profile'ın izin verdiği ayrı alanda tutmalıdır:

```json
{
  "runtimeDefaults": {
    "announcement_volume": 80,
    "background_music_volume": 20,
    "video_audio_volume": 60
  }
}
```

Bu alan yalnız profile capability bunu destekliyorsa geçerlidir. Firmware runtime menüsünün kendisi template tarafından tanımlanmaz.

## Deterministic serialization

Aynı canonical project state aynı schema version altında aynı normalized serialization'a dönüştürülebilmelidir.

Önerilen kurallar:

- stable IDs,
- stable array ordering where semantically meaningful,
- normalized numeric representation,
- UTF-8,
- explicit schemaVersion,
- no machine-specific absolute paths,
- no transient UI state,
- no random fields during save.

## Editable vs deployment

Editable project:

```text
project.json
media/
fonts/references/
styles/references/
```

Deployment package builder daha sonra bunu hedef firmware'in beklediği SD-card yapısına derler.

Root SD config ve theme config ayrımı deployment formatında kalır; editable schema ile birebir aynı olmak zorunda değildir.

## Validation invariants

Validator en az şunları kontrol eder:

1. Schema version supported.
2. DeviceProfile exists.
3. Widget types supported.
4. Media types/formats supported.
5. Runtime state references exist in profile.
6. Runtime setting references exist in profile.
7. Condition operators are supported.
8. Priority is 0–10.
9. Asset references exist.
10. Bounding Group child IDs exist.
11. No illegal cyclic group membership.
12. Language references are valid.
13. Font/style references are valid.
14. Required floor symbols/assets are available where the selected profile requires them.
15. No unsupported warning/state is invented by the template.

## Simulator contract

Simulator doğrudan schema'yı parse ederek aynı canonical modelden render etmelidir.

Örnek runtime input:

```json
{
  "floor": "11",
  "direction": "up",
  "service_out": false,
  "overload": false,
  "fire": false
}
```

Sonuç:

```text
runtime input
   ↓
condition evaluation
   ↓
active widgets/media
   ↓
Bounding Group layout
   ↓
z-order
   ↓
visual preview
```

Simulator gerçek firmware protokolünü taklit etmek zorunda değildir; profile-defined canonical runtime state input kullanır.

## AI operations

AI'nin schema üzerinde güvenli çalışması için raw file editing yerine domain operations tercih edilir:

```text
create_project
create_theme
add_widget
remove_widget
set_geometry
set_binding
set_condition
set_priority
set_z_index
create_bounding_group
add_to_bounding_group
set_media
set_audio
set_style
set_localized_content
validate_project
simulate
render_preview
build_package
```

AI sonucu render edip tekrar inceleyebilmelidir.

## Açık bırakılanlar

Bu V1 schema aşağıdakileri bilerek kesinleştirmez:

- gerçek ARKEL bit/byte mapping,
- gerçek seri frame formatı,
- firmware'in kesin floor alignment algoritması,
- gerçek audio mixer/ducking algoritması,
- kesin deployment binary formatı,
- Wi-Fi transport,
- firmware'in desteklediği nihai media format listesi.

Bunlar gerçek firmware/device profile sözleşmesi geldiğinde eklenmelidir; schema bu noktaları uydurmamalıdır.
