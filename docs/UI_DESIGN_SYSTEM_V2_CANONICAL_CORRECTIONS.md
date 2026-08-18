# Template Designer — UI/UX V2 Canonical Corrections

Bu belge `docs/UI_DESIGN_SYSTEM_V2.md` ile birlikte okunur. Ana UI specification'ın ayrıntılı içeriğini değiştirmez; aşağıdaki kararlar önceki metindeki ilgili ifadeleri düzeltir ve canonicaldır.

## 1. Semantic widget boundary

`Digit` ve `Direction` generic `Media` widget değildir.

```text
Digit
 └── Digit Style / Floor Mapping

Direction
 └── Default Style OR Custom Up/Down assets
```

`Media` semantic widget image/video ve optional attached audio ile çalışır. Digit ve Direction için generic image/video content slotu veya Media inheritance kurulmaz. Ancak Digit ve Direction binding-capable olabilir; binding onların style/presentation/content sonucunu değiştirebilir.

Digit font/glyph asset sistemi kullanmaz. Text firmware font reference kullanabilir. Text fontu ile Digit Style aynı kavram değildir.

## 2. Settings boundary

Settings/Preferences tek bir **blocking modal dialog**'dur. Ana application shell bu dialog açıkken etkileşime kapalıdır.

İçeride category listesi, tabs veya search olabilir:

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

Bunlar dockable application panels değildir. `Cancel` değişiklikleri atar; `Save / Apply & Close` kaydeder.

## 3. Project Explorer boundary

Project Explorer source of truth değildir.

```text
Canonical Project Model
        ↓
Selectors / View Models
        ↓
Project Explorer / Canvas / Properties / Simulator
```

Canonical Project Model source of truth'tur. Project Explorer bunun hiyerarşik navigation/editing view'ıdır ve bağımsız domain state sahibi değildir.

## 4. Binding boundary

Binding active Scene'i seçmez ve Scene priority'yi değiştirmez.

```text
Runtime State
 ↓
Scene selection / priority
 ↓
ONE active Scene
 ↓
Widget bindings
 ↓
Presentation result
```

Positive/negative binding desteklenir:

```text
Floor == 6
  positive → Media A visible / play

NOT (Floor == 6)
  negative → Media A hidden / stop
```

Birden fazla mutually-exclusive presentation binding ile toggle edilebilir.

Digit ve Direction binding-capable olabilir; örneğin floor mapping sonucu Digit display value değişebilir veya Direction Up/Down style/asset seçebilir.

Parametric content binding de desteklenir; örneğin `=floornumber` gibi expression'lar canonical binding contract'ına göre kullanılabilir.

## 5. Audio policy surface

Properties içindeki Audio / Override / Ducking policy alanları:

- Background Music
- Announcement / Voice
- Media Audio

katmanlarını ayrı yönetir.

Priority değerleri ayrı ayrı `0–100` aralığındadır.

Özellikle şu kombinasyonlar UI'da explicit policy olarak düzenlenebilir:

```text
Background + Announcement
Background + Media
Background + Announcement + Media
```

Background duck/mute ve Media/Announcement override davranışları policy metadata olarak düzenlenebilir. Gerçek firmware mixer/arbitration algoritması UI tarafından yeniden tanımlanmaz.

## 6. Canonical project hierarchy

Project Explorer ve UI dokümanlarında kullanılan hierarchy:

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

Theme Project dört rotation/form içerir. State ve Scene aynı kavram değildir.

## 7. External file drop

Canvas'a dosya sürükleyip bırakmak bir V1 widget-creation mekanizması değildir.

Windows Explorer'dan gelen dosya **Project Explorer'da bırakılan hedefe göre** işlenir:

- Scene içine bırakılırsa ve destekleniyorsa Scene asset/widget contract'ına göre işlenir.
- Resources hedefi destekliyorsa Resources'a gider.
- Desteklenmeyen dosya `Unsupported Files` alanına gider.
- Unsupported Files normal widget/resource/export akışına girmez.

## 8. Canvas interaction invariants

Canonical editor behavior:

- Snap Grid vardır.
- Free rotation vardır; 5° snap kullanılır.
- 45° ve 90° yön göstergeleri vardır.
- `R` ile 90° rotation yapılabilir.
- `Ctrl + Arrow` → snap grid / 10 ince hareket.
- `Shift + Ctrl + Arrow` → snap grid × 5.
- Duplicate context menu veya toolbar'dan başlatılabilir.
- Duplicate mode'da her click seçili grubun merkezini click noktasına taşıyan duplicate üretir.
- `Esc` duplicate mode'u kapatır ve normal Select'e döner.
- Size lock ve aspect-ratio lock bağımsız ayarlardır.
- Locked widget seçilebilir; geometry değiştirilemez, diğer izinli properties değişebilir.
- Invisible widget render edilmez fakat seçilebilir ve selection bounds gösterebilir.
- Hide All / Show All vardır.

Bounding Group widget hierarchy'sini değiştirmez; geometry/layout grouping mekanizmasıdır.

## 9. Multi-selection Properties

Properties Altium-style contextual inspector'dır.

```text
same value      → actual value
different value  → *
```

`*` alanına girilen yeni değer uygun seçili nesnelerin tamamına uygulanır.

Locked geometry fields disabled olur; widget yine seçilebilir ve izin verilen diğer properties düzenlenebilir.

## 10. Asset Browser

Asset Browser bir **Asset Depot/library viewer**'dır; projenin Resources klasörünün kendisi değildir.

Görüntüleme yüzeyleri:

- Asset Browser / Depot
- Project Resources
- Scene content
- Unsupported Files

Used asset'ler Asset Browser'da badge/indicator ile gösterilebilir.

Image doğrudan preview edilir. Video ilk/uygun frame ile gösterilir ve preview playback desteklenir. Audio için play/pause, seek/progress ve duration bulunur.

Stable ID ile display name ayrıdır. Asset farklı Theme'lerde duplicate olabilir; deployment scope içinde collision olmamalıdır.

V1 export kapsamı:

```text
Resources
+ Used assets
+ Default assets
```

Asset Depot'un kullanılmayan içeriği export edilmez.

## 11. Media behavior

Normal Media için duration `0` indefinite anlamına gelir.

Media Slide default duration `3.0 s` ve duration precision `0.1 s`'dir.

Loop = sonsuz tekrar.
Repeat = finite tekrar sayısı.

Image, Video ve Audio için ilgili loop/repeat davranışı bulunabilir. Media Slide'ın kendi media playback policy'si de loop/repeat destekleyebilir.

Full format conversion V1 kapsamı değildir.

## 12. Floor Mapping / Digit UI

Firmware floor value ile Designer display value birbirinden ayrıdır.

Örneğin:

```text
Firmware: -2
Designer: P2
```

Floor Mapping Editor bu eşleştirmeyi yapar. Designer firmware raw floor değerini yeniden numaralandırmaz.

Digit Style ayrı bir seçimdir. Digit Style seçilmemişse firmware/profile default'u kullanılabilir; UI gerekli durumda kullanıcıya default kullanımı konusunda açık seçim/uyarı sunar.

## 13. Scope rule

Ana `UI_DESIGN_SYSTEM_V2.md` ayrıntılı UI specification'dır.

Bu correction document'teki kararlar ana dokümanda çelişen bir ifade varsa **üstün canonical karar** olarak kabul edilir.

UI implementasyonu sırasında yeni bir domain kavramı icat edilmez. Contradiction bulunursa:

`DOMAIN CONTRADICTION FOUND`

olarak raporlanır.
