# Template Designer — UI/UX Design System V2

**Durum:** Canonical UI/UX design specification
**Kapsam:** Application Shell, editor surfaces, panel davranışları, interaction model, visual design system ve UI state contract'ı.
**Kısıt:** Bu belge UI implementasyonu değildir; React/Tauri/component kodu, application shell kodu ve domain contract bu çalışma kapsamında değiştirilmez.

> Template Designer, canvas merkezli fakat canvas'a indirgenemeyen, Windows engineering/design application niteliğinde bir üründür. UI; canonical DeviceProfile, runtime state, Scene, Widget, Binding ve Presentation modelinin editörüdür. UI kendi runtime state'lerini, firmware davranışını, audio mixer'ını veya deployment formatını icat etmez.

## Canonical corrections for implementation

### 1. Semantic widgets are not generic media containers

`Digit` ve `Direction` generic Media widget gibi modellenmez.

```text
Digit
 └── Digit Style / Floor Mapping

Direction
 └── Default Style OR Custom Up/Down assets
```

`Media` semantic widget'ı image/video ve optional attached audio ile çalışır. Digit ve Direction için image/video'yu generic content slotu olarak açan bir abstraction oluşturulmaz. Profile'da açıkça ilan edilen özel bir capability varsa bu capability ayrı semantic contract olarak modellenir; genel Media inheritance kurulmaz.

Digit font/glyph asset sistemi kullanmaz. Direction default/custom style sistemini kullanır. Text firmware font reference kullanabilir; Text fontu ile Digit Style aynı kavram değildir.

### 2. Settings is one blocking modal

Program Settings/Preferences **tek bir modal, blocking dialog** olarak açılır. Ana canvas ve arka uygulama bu dialog açıkken etkileşime kapalıdır.

İçeride kategori listesi, tabs veya search bulunabilir:

```text
Settings Dialog
├── General
├── Appearance
├── Editor
├── Canvas
├── Assets
├── Simulator
├── Validation
├── Export
└── Shortcuts
```

Bunlar ayrı application navigation surface'leri veya dockable settings panelleri değildir. `Cancel` değişiklikleri atar; `Save / Apply & Close` kaydeder.

### 3. Project Model is source of truth

Project Explorer source-of-truth değildir. **Canonical Project Model source-of-truth'tur.** Project Explorer yalnızca bu modelin hiyerarşik navigation/editing view'ıdır.

```text
Canonical Project Model
        ↓
Selectors / View Models
        ↓
Project Explorer / Canvas / Properties / Simulator
```

Project Explorer doğrudan kendi bağımsız domain state'ini tutmaz.

### 4. Binding positive/negative behavior

Binding, Scene selection'dan sonra active Scene içindeki presentation sonucunu belirler. Positive ve negative binding aynı condition'ın karşıt sonuçlarını açıkça ifade edebilir.

Örnek:

```text
Floor == 6
  positive → Media A visible / play

NOT (Floor == 6)
  negative → Media A hidden / stop
```

Birden fazla birbirini dışlayan media/presentation nesnesi gerekiyorsa binding'ler görünürlük, selection veya playback action'larıyla birbirini toggle edebilir. Binding Scene priority'yi veya active Scene'i değiştirmez.

### 5. Audio policy surface

Background Music, Announcement/Voice ve Media Audio ayrı policy katmanlarıdır. Properties içinde Audio/Override/Ducking policy düzenlenebilir.

Priority değerleri ayrı ayrı `0–100` aralığındadır. Template Designer policy metadata ve varsayılanları tanımlar; gerçek firmware mixer/arbitration algoritmasını icat etmez.

Desteklenen policy kombinasyonları profile/firmware contract'ına göre gösterilir. Özellikle:

```text
Background + Announcement
Background + Media
Background + Announcement + Media
```

durumlarında background duck/mute ve media/announcement override davranışları explicit policy alanlarından ayarlanabilir. Announcement'ların runtime arbitration sonucu firmware'e aittir.

---

## Existing canonical UI architecture remains unchanged

Application Shell; Application Bar, Document Tabs, Project Explorer, central Canvas, Properties/Inspector, Asset Browser, Simulator, Console/Output ve modal Settings yüzeylerinden oluşur. Paneller dock/undock/resize/split/tab/floating/auto-hide/collapse/close davranışlarını destekleyebilir.

Canonical hierarchy:

```text
Workspace
└── Project
    └── Theme Project Group
        └── Theme Project
            ├── R0
            ├── R90
            ├── R180
            └── R270
                └── Scene
                    └── Widget
```

Canvas gerçek display aspect ratio'sunu korur. Selection, multi-selection, Properties'te ortak değer / farklı değer `*`, locked/invisible davranışları, Snap Grid, free rotation + 5° snap, `R` ile 90° rotation, duplicate mode ve Bounding Group canonical editor davranışlarıdır.

Bounding Group widget değildir; geometry/layout ilişkisidir ve widget hierarchy'sini değiştirmez.

Properties değişiklikleri command/use-case üzerinden canonical model'e uygulanır. Project Explorer, Canvas, Properties, Simulator ve Console aynı canonical modelden beslenir.

Scene selection canonical runtime akışında tek active Scene üretir; State ve Scene birbirinden farklıdır. Binding active Scene'i değiştirmez.

Asset Depot/Asset Browser, Theme Resources, Scene references ve Unsupported Files birbirinden ayrıdır. Asset Depot'un kullanılmayan içeriği export edilmez. V1 export kapsamı Resources + Used assets + Default assets'tır.

Media Slide Popup değildir:

```text
Media Slide
├── visual media: image OR video
└── optional attached audio
```

Normal media duration `0`, Media Slide default duration `3.0 s`, duration precision `0.1 s`; Loop sonsuz, Repeat finite tekrar mantığıdır. Full format conversion V1 değildir.

Simulator ikinci runtime/rule system oluşturmaz; canonical evaluation modelini kullanır.

Console command, validation, export ve simulator trace görünürlüğü sağlar; yeni domain state sistemi değildir.

## Implementation boundary

Bu belge UI davranışını tanımlar; Phase 0 foundation veya Domain/Runtime Contract yerine geçmez. UI implementasyonu sırasında yeni domain kavramı icat edilirse önce canonical domain dokümanları kontrol edilir. UI ile domain arasında contradiction bulunursa sessizce çözülmez; `DOMAIN CONTRADICTION FOUND` olarak raporlanır.
