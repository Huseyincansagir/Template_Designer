# Scene Designer — UX Questionnaire V1

> Bu belge, Scene Designer için yapılan soru-cevap turunun arşivlenmiş UX karar setidir. Gelecekte UI/UX tasarımı, implementation veya regression review sırasında referans alınabilir.

## Temel Model

```text
Runtime States
      ↓
Scene Conditions
      ↓
Priority 0–10
      ↓
Active Scene = exactly one
      ↓
Scene widgets/media
      ↓
Z-order
      ↓
Render
```

### State ≠ Scene

- **State:** firmware/DeviceProfile'dan gelen runtime koşulu veya değeridir. Birden fazla state aynı anda aktif olabilir.
- **Scene:** aktif state'ler arasından condition + priority kurallarına göre seçilen görsel sunumdur. Aynı runtime context içinde tek bir active scene vardır.
- Warning'ler de state'tir.
- `up`, `down`, kapı durumları, `fire`, `overload`, `service_out` vb. state modelinin parçalarıdır.
- Warning scene daha yüksek öncelik kazanırsa active scene warning scene olur. Warning scene içinde `up` oku varsa ok yine görünür.

## 1. New Scene

Yeni Scene oluşturma seçenekleri:

- Blank Scene
- DeviceProfile/firmware tarafından sağlanan Scene Template
- Existing Scene Duplicate

## 2. Scene Properties

Sağdaki Altium-style Properties panelinde Scene seçildiğinde temel özet görünür:

```text
Scene Properties
Name
Priority
Activation
Rotation
Enabled
```

Activation için gelişmiş Condition Editor `...` ile açılabilir.

## 3. Scene Priority

Priority 0–10 arasındadır.

UI'da numeric input + slider bulunabilir:

```text
Priority: [ 7 ]
0 ─────●──── 10
```

Daha yüksek değer daha yüksek önceliktir.

## 4. Priority açıklaması

Priority alanı için tooltip/help açıklaması kullanılabilir. Ana UI gereksiz metinle doldurulmaz.

## 5. Condition Editor

Normal kullanıcı için basit condition UI, gerektiğinde advanced expression editor:

```text
Direction = Up
AND
Door = Closed
```

ve gerekirse:

```text
IF Direction == Up
AND Door != Open
AND Fire == False
THEN Scene Active
```

## 6. State Selection

Condition state listesi DeviceProfile'ın runtime registry'sinden gelir.

State'ler mümkün olduğunda profile-defined kategorilerle gösterilir. Designer yeni runtime state icat edemez.

## 7. Type-aware Operators

State veri tipine göre condition editor uygun operator/editor üretir:

- Boolean → Active/Inactive veya eşdeğeri
- Enum → Equals vb. + profile-defined seçenekler
- Number → Equals vb. + numeric input
- String/symbol → Equals vb. + text/symbol input

## 8. Multiple Conditions

Bir Scene birden fazla state ile koşullandırılabilir. AND/OR/advanced expression modeli kullanılabilir.

## 9. Multiple Scenes for One State

Aynı state birden fazla Scene'in condition'ında bulunabilir. Bu durum yasaklanmaz; Scene priority sonucu belirler.

Conflict/ambiguity varsa Designer kullanıcıya warning gösterebilir.

## 10. Equal Priority

Applicable Scene'lerin priority değerleri eşitse runtime event ordering/tie-break sırası kullanılır.

Scene document/list order bu tie-break sırasının kullanıcı tarafından anlaşılabilir kısmıdır.

Designer aynı priority'deki çakışmaları warning olarak gösterebilir.

## 11. Scene Order

Project Explorer'daki Scene sırası kullanıcı tarafından drag/drop ile değiştirilebilir.

Bu sıra yalnız eşit priority durumunda tie-break olarak etkili olur; farklı priority'yi override etmez.

## 12. Active Scene Preview

State/Context Bar üzerinden runtime context seçildiğinde Designer/Simulator aktif Scene'i gösterebilir:

```text
ACTIVE SCENE: Up
Priority: 5
```

State bar context kontrolünü yapar; Project Explorer hangi Scene'in düzenlendiğini gösterir.

## 13. Design Mode / Preview Mode

Scene edit ederken runtime state değişikliklerinin çalışma alanını beklenmedik şekilde değiştirmemesi için iki mod bulunur:

```text
Design Mode
Preview Mode
```

Design Mode: seçili Scene düzenlenmeye devam eder.

Preview Mode: runtime state'ler değerlendirilir ve active Scene gösterilir.

## 14. Editing Scene vs Active Scene

Project Explorer'dan `Up Scene` seçilmiş olabilirken Preview Mode'da `Fire` state'i active ise gerçek active Scene `Fire Scene` olur.

Design Mode'da kullanıcı seçtiği Scene'i düzenlemeye devam eder.

## 15. Widget Addition

Bir widget Scene'e eklendiğinde varsayılan olarak yalnız o Scene'e ait instance oluşturulur.

Diğer Scene'lere otomatik eklenmez.

Kullanıcı isterse explicit `Apply to Other Scenes` benzeri işlemlerle kopyalayabilir.

## 16. Widget Conditions

Widget-level condition desteklenebilir.

Ayrım:

```text
Scene condition
→ Scene'in aktif olması

Widget condition
→ Scene aktifken widgetın ayrıca gösterilmesi
```

Widget condition Scene condition'ı yerine geçmez.

## 17. Widget Priority vs Z-order

Widget'lara Scene priority verilmez.

Scene priority → hangi Scene'in aktif olduğunu belirler.

Z-order → aktif Scene içindeki çizim sırasını belirler.

Bu iki kavram kesinlikle ayrıdır.

## 18. Scene Z-order

Scene içindeki widgetların sıralaması Project Explorer/canvas/context menu üzerinden yönetilebilir.

Örnek:

```text
Background       Z=0
Floor            Z=20
Arrow            Z=30
Text             Z=40
Media Slide      Z=100
```

Numeric Z değeri ve görsel sıralama birlikte desteklenebilir.

## 19. Runtime Scene Change

State değişince active Scene'in değişmesi runtime/profile davranışına göre değerlendirilir.

Designer firmware'in desteklemediği transition davranışını uydurmaz.

## 20. Scene Transition

Fade/slide vb. transition yalnız DeviceProfile/runtime contract açıkça destekliyorsa Designer'da sunulur.

Profile desteklemiyorsa transition seçenekleri gösterilmez.

## 21. Media Slide Timing

Media Slide seçildiğinde süre, video loop, loop count ve audio repeat gibi değerler Properties üzerinden düzenlenir.

İlk sürümde tam timeline editor yerine Media Slide için contextual timing controls tercih edilir. Gelecekte tam timeline editor eklenebilir.

## 22. Scene Thumbnail

Project Explorer'da Scene thumbnail desteği bulunabilir.

Kullanıcı thumbnail görünürlüğünü açıp kapatabilir.

## 23. Test Scene

Scene context menu'de `Test Scene` bulunabilir.

Test sırasında:

1. Scene'in activation conditions'ları incelenir.
2. Gerekli runtime state context otomatik oluşturulabilir.
3. Simulator açılır/aktive edilir.
4. Kullanıcı runtime sonucunu gözlemler.

## 24. Explain Scene

AI/API destekli geliştirme için `Explain Scene` komutu bulunabilir.

Console'da örneğin:

```text
Scene: Fire
Priority: 10

Activation:
  fire == true

Widgets:
  Background
  Fire Symbol
  Floor Number
  Direction Arrow

Z-order:
  ...
```

gibi açıklama üretilebilir.

## 25. Scene Validation

Scene yanında validation durum ikonu gösterilebilir.

Ayrıca global Validation ekranında aynı sorunlar listelenir.

Örnekler:

```text
✓ Valid
⚠ No activation condition
⚠ Priority conflict
⚠ Unsupported asset
⚠ Missing required widget
```

## Genel UX Kararı

Scene Designer:

- Altium/CAD benzeri profesyonel masaüstü etkileşimlerini takip eder.
- State ile Scene'i kullanıcıya açıkça ayırır.
- Firmware/DeviceProfile runtime sözleşmesini source of truth kabul eder.
- Designer'ın desteklenmeyen runtime davranışı icat etmesine izin vermez.
- Active Scene preview ile Scene editing'i birbirine karıştırmaz.
- Scene priority, widget Z-order ve runtime state'i ayrı kavramlar olarak tutar.
