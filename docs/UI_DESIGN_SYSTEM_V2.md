# Template Designer — UI/UX Design System V2

**Durum:** Canonical UI/UX design specification
**Kapsam:** Application Shell, editor surfaces, panel davranışları, interaction model, visual design system ve UI state contract'ı.
**Kısıt:** Bu belge UI implementasyonu değildir; React/Tauri/component kodu, application shell kodu ve domain contract bu çalışma kapsamında değiştirilmez.

> Template Designer, canvas merkezli fakat canvas'a indirgenemeyen, **Windows engineering/design application** niteliğinde bir ürün olarak tasarlanır. UI; canonical DeviceProfile, runtime state, Scene, Widget, Binding ve Presentation modelinin editörüdür. UI kendi runtime state'lerini, firmware davranışını, audio mixer'ını veya deployment formatını icat etmez. [1] [2]

## 1. UI Philosophy

Template Designer'ın görsel ve etkileşim dili profesyonel CAD/IDE araçlarının yoğunluğunu, keşfedilebilirliğini ve çalışma disiplinini taşımalıdır. Ürün bir web sitesi, generic dashboard, mobil arayüz veya Figma klonu gibi davranmaz. Altium Designer, Visual Studio, JetBrains IDE ve modern EDA/CAD araçları davranışsal referans olabilir; başka bir ürünün görünümü birebir kopyalanmaz. [3] [4]

Görsel omurga; açık nötr bir çalışma alanı, koyu fiziksel cihaz/display preview'si, sınırlı teal/cyan vurgu, ince border'lar, kompakt kontroller ve güçlü bilgi hiyerarşisinden oluşur. Ana yüzey her zaman şu sorulara cevap verebilmelidir: kullanıcı nerede, neyi düzenliyor, ne seçili, ne değişecek, hangi sorun var ve sonraki adım nedir? Durumlar yalnızca renkle anlatılmaz; metin, ikon, şekil veya yapısal ayrımla desteklenir. [3] [5]

UI davranışlarında **domain contract canonicaldır**. Görsel referanslar layout, yoğunluk ve ürün dilini belirler; State, Scene, priority, Binding, Media Slide, Digit, Direction, Settings veya DeviceProfile davranışında domain kaynakları geçerlidir. [1] [6]

UI olaylarının temel sınırı aşağıdaki gibidir:

```text
UI Event
   ↓
Application Command / Use Case
   ↓
Canonical Project State
   ↓
Selector / View Model
   ↓
UI
```

React bileşeni canonical template state'inin veya firmware davranışının sahibi değildir. Preview, Simulator, Validation ve Export aynı canonical project modelini kullanır. [2] [7]

## 2. Application Shell

Application Shell bütün workspace'lerde kararlı kalır ve kullanıcının ürün içindeki zihinsel haritasını korur. Varsayılan yapı; üst Application Bar, Document Tabs, merkezî document/canvas alanı, dockable tool window'lar ve alt Console/Status bölgesinden oluşur.

```text
┌──────────────────────────────────────────────────────────────┐
│ Application Bar / Menus / Toolbar                            │
├──────────────────────────────────────────────────────────────┤
│ Document Tabs                                                │
├───────────────┬───────────────────────────┬──────────────────┤
│ Project       │                           │ Properties       │
│ Explorer      │       Device Canvas       │ / Inspector      │
│               │                           │                  │
├───────────────┴───────────────────────────┴──────────────────┤
│ Console / Output / Validation / Status                       │
└──────────────────────────────────────────────────────────────┘
```

Bu şema başlangıç yerleşimidir; sabit kolon zorunluluğu değildir. Project Explorer, Properties, Asset Browser, Simulator, Runtime State, Console/Output ve Validation dock, tab, split, floating, collapse veya auto-hide davranışlarına sahip tool window'lar olarak ele alınır. [2] [3]

| Shell yüzeyi | UI sorumluluğu | Canonical sınır |
|---|---|---|
| Application Bar | Menü, toolbar, command ve workspace komutları | Domain işlemleri command/use-case üzerinden çalışır. |
| Document Tabs | Açık Theme Project/Rotation editörlerini gösterme | Tab kapatmak domain nesnesini silmez. |
| Project Explorer | Project/Theme/Rotation/Scene/Widget/resource hiyerarşisi | Asset Depot bu ağacın gizli klasörü değildir. |
| Canvas | Seçili rotation/form için görsel düzenleme ve preview | Display aspect ratio korunur. |
| Properties | Seçime bağlı contextual inspector | Profile'da desteklenmeyen alan gösterilmez. |
| Simulator | Aynı runtime evaluation modelini çalıştırma | Custom State veya ikinci rule system yoktur. |
| Console | Command, validation, export ve runtime trace görünürlüğü | Yeni bir domain state sistemi değildir. |
| Status | Dirty, validation, aktif form/scene, zoom ve işlem özeti | Teknik başarı verification öncesi ilan edilmez. |

Ürün navigasyonu `Home/Projects`, `Theme Library`, `Design Studio`, `Media/Resources`, `Test Studio/Simulator`, `Validation/Publish`, `Deployment` ve `Settings` yüzeylerini aynı ana uygulama içinde workspace olarak gruplayabilir. Bu yüzeyler gereksiz OS penceresi veya zorunlu wizard zinciri oluşturmaz. [3]

## 3. Docking System

Dock Manager modern IDE/CAD davranışını izler. Panel `dock`, `undock`, `resize`, `split`, `tab`, `collapse`, `auto-hide`, `float` ve `close/reopen` işlemlerini destekler. Bir panel başka bir panelin üzerine bırakılırsa mevcut panel yok edilmez; aynı dock group içinde tab stack oluşur. Geçerli dock hedefinde insertion preview, geçersiz hedefte reddedici görsel durum gösterilir.

| Docking durumu | Beklenen davranış |
|---|---|
| Left/right/top/bottom dock | Yeni split veya mevcut group içinde tab; mevcut içerik korunur. |
| Center/tab dock | Document veya tool tab stack'e eklenir; aktif tab açıkça vurgulanır. |
| Floating | Ayrı pencere açılır; ana shell ile workspace ilişkisi korunur. |
| Resize/split | Splitter ile oran değişir; canvas geometry'si değişmez. |
| Auto-hide/collapse | Panel kenar rail'ine veya minimum başlığa küçülür; tekrar açıldığında önceki konum korunur. |
| Close/reopen | Panel kapanır; Window/View komutlarıyla geri açılır. |
| Multi-monitor | Floating panel başka monitöre taşınabilir; workspace state saklanır. |
| Reset Layout | Kullanıcı onayıyla bilinen workspace düzenine dönülür; işlem undoable command olabilir. |

Panel sürüklenirken canvas'ın içeriği gerilmez veya kaybolmaz. Drag iptalinde panel önceki konumuna güvenli biçimde döner. Workspace; dock konumlarını, açık tabları, floating pencereleri, görünürlükleri, pencere boyutlarını ve aktif layout profilini saklar. Program default layout ile project-specific workspace state birbirinden ayrıdır. [2] [3]

## 4. Project Explorer

Project Explorer Altium benzeri, hiyerarşik ve kaynak-of-truth navigation yüzeyidir. V1 canonical hiyerarşi şöyledir:

```text
Workspace
└── Project
    └── Theme Project Group
        └── Theme Project
            ├── Rotation 0 / r0
            ├── Rotation 90 / r90
            ├── Rotation 180 / r180
            └── Rotation 270 / r270
                └── Scene
                    └── Widget
```

**Theme Project gerçek temadır ve dört rotation/form içerir. Rotation ve Form V1'de aynı fiziksel yön/geometri kavramıdır.** Required rotation'lar sessizce silinemez veya eksik bırakılarak publish edilemez. Scene/rotation işlemleri yalnız active DeviceProfile ve canonical domain kuralları izin veriyorsa gösterilir; eksik required rotation veya scene validation'da açıkça raporlanır. [1]

| Node | Gösterilen bilgi | Uygun komut örnekleri |
|---|---|---|
| Workspace | Açık projeler ve workspace layout | Open/Close Workspace, layout seçimi |
| Project | SD-card-level project, profile, dirty ve validation durumu | Open, Rename, Close, Project Settings |
| Theme Project Group | Tema grubu | Add/Remove/Invert yalnız domain izin veriyorsa |
| Theme Project | Tema adı, dört form hazır durumu ve validation özeti | Open, Duplicate, Rename, Publish |
| Rotation/Form | Orientation, resolution ve document durumu | Open, Rename, Required olmayan öğede Remove |
| Scene | Ad, priority, condition, active/validation durumu | Add, Duplicate, Rename, Test, Edit |
| Widget | Kullanıcı adı, type, visibility/lock ve validation | Add, Rename, Duplicate, Delete, Z-order |
| Resources | Theme-owned supported resources | Import, Rename, Replace, Reveal, Remove |
| Unsupported Files | Profile tarafından desteklenmeyen dosyalar | Inspect, Reveal, Remove |

Project Explorer state listelerini global hard-code etmez. Scene condition, warning ve runtime state seçenekleri DeviceProfile registry'den gelir. Kullanıcıya `Custom State`, generic `Popup Widget`, klasik widget-to-widget anchor graph veya profile'da olmayan widget komutu sunulmaz. `Asset Depot/Asset Browser` ayrı bir library/depot tool window'dur. [1] [8]

Drag/drop işlemleri domain command'ına dönüşür. Uyumlu nesne normal şekilde taşınır; `Ctrl` ile kopyalama yapılabilir. Project, Theme Project, Rotation veya Scene arasında taşıma yapılırken source/target DeviceProfile ve capability uyumu kontrol edilir. Uyuşmazlıkta sessiz taşıma yapılmaz; conflict dialog, kaynak-hedef farkı ve uygulanabilir seçenekler gösterilir. Windows Explorer'dan gelen dosyalar yalnız uygun Resources hedeflerine bırakılır; canvas'a dosya bırakmak widget oluşturmaz. [3] [9]

## 5. Application Bar

Application Bar genişletilebilir Menu Bar ve bağlama göre değişen Toolbar'dan oluşur. Menüler bütün özellikleri aynı anda göstermek zorunda değildir; aktif context ve profile capability'ye göre sadeleşir.

| Menü | Örnek kapsam |
|---|---|
| File | New/Open/Save/Close/Recent/Export |
| Edit | Undo/Redo/Cut/Copy/Paste/Delete |
| View | Panels, workspace, zoom, grid, guides |
| Project | Project Settings, validate, package |
| Theme | Theme defaults, duplicate, resources |
| Scene | Add, duplicate, test, priority/context |
| Widget | Add, duplicate, style, binding |
| Asset | Import, inspect, dependency, replace |
| Tools | Simulator, command palette, diagnostics |
| Validation | Validate, filter, navigate issues |
| Export/Deployment | Build package, target, verification |
| Help | Documentation, shortcuts, diagnostics |

Toolbar; Save, Undo/Redo, Add, Select, Align, Duplicate, Zoom, Snap, Design/Preview, Simulator, Validate ve Publish gibi sık kullanılan command'ları bağlama göre sunabilir. Toolbar bir işlemin domain davranışını kendi içinde uygulamaz; mevcut command registry/use case'lerini çağırır.

`Ctrl+Shift+P` Command Palette **PROPOSED** bir shell yüzeyidir. Arama sonuçları command adı, kategori, shortcut, enabled/disabled durumu ve disabled reason gösterir. Command Palette ürün domain'ine yeni bir command veya runtime state eklemez. [3]

## 6. Canvas

Canvas, seçili Rotation/Form'un gerçek display oranını koruyan merkezî editor surface'tir. Canvas uygulamanın tamamı değildir; structured domain modelin görsel düzenleme yüzeyidir. Device preview koyu yüzey üzerinde gösterilir, dış çalışma alanı açık ve nötr kalır. Resize sırasında içerik stretched edilmez; viewport, zoom, pan ve gerekirse letterbox yeniden hesaplanır. Widget geometry'si panel resize nedeniyle değişmez. [2] [3]

Canvas şu temel işlemleri destekleyebilir: zoom, pan, grid, snap grid, selection, multi-selection, marquee selection, drag, resize, rotate, duplicate, alignment, Bounding Group ve Z-order. Grid görünürlüğü snap davranışından ayrıdır. Rulers ve guides isteğe bağlıdır; kullanılabilir alanı sürekli tüketmez.

Design Mode ile Preview Mode ayrıdır. Design Mode'da kullanıcı Project Explorer'dan seçtiği Scene'i düzenler. Preview Mode'da runtime context, Scene activation conditions ve binding'ler değerlendirilir; örneğin Explorer'da Up Scene seçili olsa bile `fire = true` context'i active Scene'i Fire Scene yapabilir. Preview'da active Scene değişmesi, edit edilen Scene'i domain'den silmez veya document selection'ı sessizce değiştirmez. [6]

Canvas boş alanına tıklama selection'ı temizleyebilir. Seçim, device surface üzerinde gerçek widget/content sonucu varsa gösterilir; placeholder veya fake runtime state görüntüsü tamamlanmış UI kabul edilmez. DeviceProfile'ın desteklemediği bir widget veya capability Add menüsünde gösterilmez.

## 7. Selection

Single selection görünür outline, resize handle, rotation handle ve contextual Properties güncellemesi üretir. Multi-selection; `Ctrl`/`Shift` ile ekleme/çıkarma ve uygun durumda marquee selection destekler. Group selection editörün geçici veya düzenleme amaçlı seçimidir; **Bounding Group** ise canonical geometry/layout ilişkisidir ve aynı kavram gibi etiketlenmez.

| Selection durumu | UI davranışı |
|---|---|
| Single | Tam contextual properties, bounds ve applicable handles. |
| Multi | Yalnız ortak düzenlenebilir properties; farklı değerler `*`. |
| Locked widget | Seçilebilir ve properties okunabilir; position/size/geometry değişimi disabled. |
| Invisible widget | Render edilmez; Explorer/Layers ve selection bounds üzerinden seçilebilir. |
| Empty selection | Properties paneli `Select an item to edit its properties` mesajı gösterir. |
| Hide All | Görünürlükleri tek undoable command ile kapatır; önceki user intent saklanır. |
| Show All | Gizlenenleri açar; başlangıçta kapalı olan user intent gereksiz yere kaybolmaz. |

Selection feedback accent ailesini kullanır fakat status/error/focus renkleriyle karıştırılmaz. Selection değişikliği command veya selector katmanından geçer; React state tek başına canonical değişiklik olarak kabul edilmez. [2] [3]

## 8. Properties

Properties paneli Altium tarzı contextual inspector'dır. Seçim yoksa document/form özelliklerini, Scene seçiliyse Scene Properties'i, widget seçiliyse yalnız o widgetın gerçekten desteklediği alanları, Bounding Group seçiliyse layout alanlarını gösterir. Profile'da bulunmayan alan boş bir control olarak gösterilmez; `Not supported by active profile` veya eşdeğer açıklama kullanılır.

| Kategori | İçerik | Kapsam |
|---|---|---|
| Identity | Display name, salt okunur stable ID, type | Uygun bütün domain nesneleri |
| Transform | X, Y, width, height, rotation, aspect/size lock | Widget/Bounding Group |
| Appearance/Style | Default/custom style, supported color, opacity | Widget/profile bağlamı |
| Binding/Runtime | State, condition, positive/negative action, presentation priority | Binding-capable widget/Scene |
| Content/Media | Asset, media type, fit/crop, duration, loop/repeat | Media kullanan semantic nesneler |
| Typography | Firmware font reference, size, bold, italic, alignment, localized content | Text; Digit'te font yok |
| Audio | Asset, volume, repeat ve profile policy alanları | Media/Theme Audio |
| Layer | Visibility, lock, Z-order | Widget/content |
| Layout | Reference, alignment, spacing ve profile/domain destekliyorsa layout mode | Bounding Group |
| Advanced | Unresolved reference, profile version, metadata | Progressive disclosure |

Bir property değişikliği command üretir; dirty state, Undo/Redo, validation ve Console aynı command sonucundan beslenir. Birden fazla seçimde ortak değer normal görünür, farklı değer `*` ile gösterilir. `*` alanına yazılan yeni değer seçili bütün uyumlu nesnelere uygulanır. [3] [7]

Scene Properties; Name, Priority `0–10`, Activation/Condition, Rotation/Form relation ve Enabled alanlarını domain izin verdiği ölçüde gösterir. Scene priority, widget Z-order ve Bounding Group geometry tek bir “Priority” alanında birleştirilmez.

## 9. Widget Editing

Widget ekleme akışı DeviceProfile-driven'dır:

```text
[ Add ]
   ↓
Profile-supported semantic widget listesi
   ↓
Canvas'a yerleştir
   ↓
Contextual Properties aç
   ↓
Validation / preview
```

Widget Type semantic nesnenin anlamıdır; Media Type ise kullanılan image/video/audio içeriğinin biçimidir. Direction veya Digit gibi semantic widget'lar profile izin veriyorsa image/video content kullanabilir. UI bu ayrımı kullanıcıya yeterince açık gösterir fakat firmware iç implementation ayrıntısını gereksiz yere açmaz. [8]

Widget ortak alanları stable ID, display name, type, enabled/visible, geometry, Z-order, style/content reference ve runtime binding'dir. Teknik ID kullanıcıya değiştirilebilir görünen isim gibi sunulmaz. Widget başka Scene'e kopyalandığında varsayılan olarak Scene-specific instance oluşur; diğer Scene'lere yayma explicit command ile yapılır.

### Digit/Floor editing

Digit/Floor widget runtime floor değerini gösterir; Designer floor değerini hesaplamaz, yeniden numaralandırmaz veya raw symbolic value'yu sessizce dönüştürmez. Digit için font picker veya glyph asset sistemi gösterilmez. Kullanıcı default Digit Style, custom Digit Style, size, style/color metadata, floor mapping ve profile-supported media/style reference'larını düzenler. Custom digit asset'e Designer tarafından otomatik renk uygulanmaz. [1] [8]

### Direction editing

Direction widget `up`, `down` veya profile'ın none/hidden karşılığını gösterir. Default style'da profile'ın sağladığı shape/style katalogu ve palette kullanılır; örneğin 10 shape varsa UI bunu hard-coded product listesi değil profile sonucu olarak sunar. Default Up seçildiğinde karşılık gelen Down varyantı başlangıçta atanır ve `Derived default; editable` açıklamasıyla bağımsız değiştirilebilir. Custom mode'da Up ve Down dosyaları ayrı seçilir; Custom Up seçildiğinde Down otomatik doldurulmaz ve custom içerikte color picker gösterilmez. [1] [8]

### Text editing

Text widget firmware font reference, text/localized content, size, bold, italic ve alignment alanlarını taşır. Normal Text için glyph atlası kullanıcıya açılmaz. Runtime language, text içeriğinin çözümlemesinde kullanılabilir; font ile language aynı kavram değildir. [1] [10]

## 10. Scene Editing

Scene, runtime state değildir; active runtime state/condition context'i için seçilen presentation modelidir. Bir Rotation/Form altında birden fazla Scene bulunabilir. Birden fazla runtime state aynı anda aktif olabilir, ancak Scene selection tamamlandığında tek active Scene vardır.

Scene editor şu yüzeyleri sunabilir: Scene listesi, Name, Activation Condition, Priority `0–10`, Enabled, Scene-specific widget listesi, Z-order/layer ve Test Scene. Scene thumbnail veya scene context tabı yardımcı UI olabilir; Scene'in Rotation/Form'dan bağımsız global document olduğu varsayılmaz.

Scene selection algoritmasının UI'daki açıklaması şöyledir:

```text
Firmware/DeviceProfile runtime states
          ↓
Scene activation conditions
          ↓
Scene priority 0..10
          ↓
Aynı priority'de runtime'da daha sonra aktif olan Scene
          ↓
ONE ACTIVE SCENE
```

**Project Explorer/document order aynı priority tie-break değildir.** Scene listesi kullanıcıya edit/navigation sırası sağlar; active Scene seçiminde canonical tie-break olarak gösterilmez. UI, active Scene'in hangi condition ve runtime activation order nedeniyle kazandığını Simulator/Console trace'inde açıklayabilir. [1]

Scene içindeki widget condition'ları Scene selection'dan sonra değerlendirilir. Widget binding'i Scene'i değiştirmez. Scene priority, widget Z-order ve Bounding Group geometry ayrı kavramlardır. Fire Scene içinde Up Arrow bulunması mümkündür; Fire active olduğunda o Scene'in Up Arrow'u kendi binding/visibility şartlarına göre render edilir.

## 11. Binding Editor

Binding Editor Media'ya özel değildir. Media, Digit/Floor, Direction, Text, Warning ve profile tarafından binding-capable ilan edilen diğer semantic widget'lar aynı DeviceProfile-driven condition engine'i kullanır. Kullanıcı common condition'ları raw JSON yazmadan satır tabanlı editörle kurar.

```text
Show / Activate when
[ Floor ] [ equals ] [ 6 ]
[ AND   ]
[ Door  ] [ equals ] [ Opening ]

Action
[ Show / Play / Select / Continue ]
```

Kaynakların desteklediği örnekler `floor == 6`, `Door == Opening`, `fire == true`, `floor == 6 AND Door == Opening` ve `NOT fire` biçimindedir. State listesi profile registry'den gelir; boolean, enum, number ve symbol/string state için uygun operator/editor gösterilir. Unknown state, invalid operator veya invalid value sessizce silinmez; `Unresolved` olarak kalır ve Validation'a bağlanır. [1] [11]

Binding action'ları type-dependent'dır. Görünürlük/selection; media için Show, Hide, Play, Pause, Stop, Restart ve Continue; Text için content/localization; Digit için value/style/media; Direction için variant/style/media çözümlemesi desteklenebilir. Arbitrary runtime property scripting V1 değildir.

Binding evaluation yalnız active Scene içinde yapılır:

```text
Scene condition
      ↓
Active Scene
      ↓
Widget condition / binding
      ↓
Visible, content, style veya playback result
```

Binding Scene selection'ı değiştirmez ve Binding Editor Scene priority'yi widget playback action'ı ile karıştırmaz. `=floornumber` veya `{FloorNumber}` gibi parametric content extension point olarak gösterilebilir; `=residents` gibi external data/CSV kaynağı V1'de kullanılabilir bir field gibi sunulmaz, `Future parameter source` olarak işaretlenir. [1] [11]

## 12. Floor Mapping

Floor Mapping generic Text binding içine gizlenmez; ayrı editor/panel olarak sunulur. UI, firmware/device profile tarafından ilan edilen raw floor values listesini ve proje/theme presentation mapping'ini birlikte gösterir.

| Firmware value | Display value örneği | Digit Style |
|---|---|---|
| `-2` | `P2` | Style 1 veya default |
| `-1` | `P1` | Style 1 veya default |
| `0` | `G` | Style 2 veya default |
| `1`, `2` | `1`, `2` | Style 1 veya default |
| `K`, `P`, `R`, `Z`, `F`, `T` | Profile destekliyorsa sembol/değer | Profile-supported style |

UI zinciri açıkça gösterilir:

```text
Firmware Value
      ↓
Floor Mapping
      ↓
Display Value
      ↓
Digit Rendering / Digit Style
```

Designer raw floor value'yu yeniden hesaplamaz. Mapping satırında özel Digit Style seçilebilir. Kullanıcı özel style seçmezse `Default Digit Style kullanılsın mı?` onayı gösterilir; kabul edilirse profile'ın uygun default style'ı atanır. Bu dialog, firmware'in hangi style'ı zorunlu kullandığına dair yeni ürün kararı vermez.

Bilinmeyen veya kaldırılmış floor value sessizce silinmez; `Unresolved` validation durumuyla kalır. Exact value set, symbolic encoding ve locale-specific floor representation DeviceProfile/firmware contract'ından gelir. [1] [11]

## 13. Media

Media ile Widget Type ayrıdır. Media types `image`, `video` ve `audio` olabilir; Widget types Media, Digit, Direction, Warning, Text ve DeviceProfile'ın desteklediği diğer semantic nesnelerdir. Bir semantic widget yalnızca kendi capability'siyle uyumlu media/reference türlerini kullanabilir; audio generic olarak her semantic widget'a bağlanmaz ve Media/Media Slide ile audio policy kapsamındadır.

Media Properties profile ve media türüne göre duration, loop, repeat, repeat count, volume, playback, fit/crop ve optional audio alanlarını gösterir. Duration her yerde `0.1 s` precision ile düzenlenir. Normal Media default duration `0` veya uygulanabilir durumda indefinite; Media Slide içindeki visual media default duration `3.0 s`'dir. Loop sonsuz tekrar, Repeat sınırlı tekrar, Repeat Count ise sayıdır. [1]

V1 Template Designer full format conversion yapmaz. MP4→AVI, image conversion, audio conversion veya ARGB888 preparation UI'da otomatik işlem gibi gösterilmez. UI capability validation, unsupported indication, metadata, source/reference ve export dependency resolution sunar; hedef format hazırlanmadıysa açık validation sonucu üretir. Format Tool gelecekte ayrı bir surface olabilir. [1]

### Media Slide

Media Slide ayrı bir Popup widget değildir. Kata özel veya state-specific üst içerik `Media Slide + runtime condition + visual Z-order` olarak düzenlenir. V1 canonical model:

```text
Media Slide
├── visual media: image OR video
└── optional attached audio
```

Media Slide Properties şu sırada gösterilebilir:

| Alan | UI davranışı |
|---|---|
| Condition/Binding | Floor/state condition; unresolved referans görünür kalır. |
| Visual Media | Image veya Video; profile desteklemiyorsa seçenek gizlenir. |
| Duration | Varsayılan `3.0 s`, `0.1 s` precision. |
| Playback | Loop, Repeat, Repeat Count ayrı alanlar. |
| Attached Audio | Optional audio reference, volume/repeat alanları. |
| Continuity | Yalnız aynı gerekli size/playback continuity koşulları sağlanırsa opsiyonel Continue/Retain Playback; aksi halde yeni media başlar. |
| Layer/Z-order | Scene içi görsel çizim sırası; runtime priority değildir. |

Aynı Scene içinde birden fazla Media Slide bulunabilir ve DeviceProfile izin verdiği sürece aynı anda active olabilir. Media Slide playback'inin bitmesi Scene'i değiştirmez. `Media Sequence` veya tam timeline editor V1'de zorunlu domain/UI değildir; generic sequence veya keyframe surface'i Future/Not in V1 olarak gizlenir. [1]

`1280×720` gibi decode limitleri UI'a global hard-coded capability olarak yazılmaz. Eşzamanlı video/decode sınırı DeviceProfile'dan okunur ve validation sonucu profile'a göre gösterilir.

### Audio / Background Music

Background Music Theme-level persistent/looping audio katmanıdır. Announcement/Voice ve Media/Video Audio ayrı kanallardır. UI; volume, enabled, repeat/loop, video/media audio volume ve background duck/override/mute policy alanlarını gösterebilir. Audio priority kesin olarak `0–100` aralığındadır; Designer policy metadata'sını tanımlar, gerçek firmware mixer/arbitration algoritmasını icat etmez.

Designer policy metadata ve template defaultlarını düzenleyebilir; gerçek firmware mixer, interrupt, ducking ve arbitration algoritmasını icat etmez. Firmware saha ayarları template defaultlarını runtime'da override edebilir. Background + Announcement, Background + Media ve Background + Announcement + Media kombinasyonları supported policy kapsamı kadar preview'da açıklanır; desteklenmeyen mix çalışıyormuş gibi gösterilmez. Language 1/Language 2 announcement sırası UI'da düzenlenebilir; gerçek runtime audio arbitration firmware'e aittir. [1] [12]

## 14. Asset Browser

Asset Browser, Asset Depot/library görünümünü sağlayan dockable tool window'dur. Theme Resources, Scene references ve Unsupported Files ile aynı şey değildir. Asset Depot'ta bulunan her asset otomatik export edilmez.

| Kategori | İçerik ve davranış |
|---|---|
| Images | Thumbnail/direct preview, resolution ve format metadata |
| Videos | Representative frame, Play/Pause, seek; otomatik loop yok |
| Audio | Play/Pause, seek/progress, duration ve uygun volume |
| Digit Styles | Profile/default/custom digit style kaynakları |
| Direction Styles | Profile/default/custom direction style kaynakları |
| Warning Signs / semantic categories | Profile tarafından ilan edilen kategoriler |
| Unsupported Files | Normal preview/widget/export akışına kapalı teknik alan |

**Fonts Asset Browser'da bağımsız asset kategorisi değildir.** Normal Text, firmware font reference kullanır; Digit/Floor widget font/glyph sistemi kullanmaz ve Asset Browser font/glyph kategorisi sunmaz. [1] [8]

Asset preview playback'i template widget playback policy'den bağımsızdır. Asset metadata'da display name, stable ID, file, type, format, size, duration, resolution ve color format gösterilebilir. Used/default/profile asset'ler badge veya `Used By` bilgisiyle işaretlenebilir.

Windows Explorer'dan gelen dosyalar yalnız Project Explorer/Theme Resources hedeflerine bırakılır. Supported dosya uygun resource kategorisine, unsupported dosya `Unsupported Files` alanına gider. Unsupported Files widget olarak kullanılamaz ve normal export'a dahil edilmez. V1 export kapsamı açıkça **Resources + Used assets + Default assets** kümesidir; Asset Depot'un kullanılmayan içeriği export edilmez. [1] [9]

Stable ID, display name ve physical filename'dan ayrıdır. UI display name'i kullanıcı dostu biçimde gösterir; stable ID salt okunur teknik metadata olarak sunulur. Rename veya safe replacement stable ID'yi değiştirmez. Stable ID gerektiğinde Theme/Project/Rotation gibi hiyerarşik context'leri deterministik biçimde encode edebilir; exact string formatı ayrı implementation detail'dir. Aynı asset farklı Theme'lerde duplicate/reference edilebilir ve bu tek başına hata değildir; yalnızca deployment scope içinde collision oluşmamalıdır. Dependency'li asset silinmek istenirse Used By ve replacement/removal seçenekleri gösterilir.

## 15. Simulator

Simulator ayrı, dockable, collapsible ve resizable bir tool window'dur. Preview/Export ile aynı canonical project modelini, Scene selection'ı, Binding Engine'i, Bounding Group/layout ve renderer semantiğini kullanır. İkinci, basitleştirilmiş veya UI'a özel bir state/rule system oluşturulmaz. Simulator firmware değildir; Designer davranışını kontrollü runtime context ile test eder. [1] [2]

Önerilen Simulation workspace; Runtime Inputs/Scenario, Device Preview ve Runtime Inspector alanlarından oluşur. Runtime State listesi DeviceProfile registry'den dinamik gelir; `Custom State` düğmesi bulunmaz. Runtime Settings ayrı başlıkta gösterilir ve State ile Setting karıştırılmaz.

| Simulator yüzeyi | Gösterilen bilgi |
|---|---|
| Runtime State | Profile-defined floor, direction, door, warning ve diğer state değerleri |
| Runtime Setting | Language, active theme, voice/style ve profile-defined audio settings |
| Active Scene | Scene adı, priority ve activation explanation |
| Active Bindings | Condition sonucu, action, hedef widget ve trace |
| Media/Audio | Oynayan media, duration/loop/repeat ve policy metadata |
| Transport | Run, Pause, Step, Reset, Test Scene, Test Binding |

Runtime flow şu şekilde görünür:

```text
Runtime values/states
      ↓
Scene conditions
      ↓
Priority + runtime activation order
      ↓
ONE active Scene
      ↓
Binding evaluation
      ↓
Render / media / audio policy
```

Simulator'da `Fire`, `Overload`, `Service Out`, floor veya direction gibi örnekler ürünün global hard-coded state listesi olarak değil, active DeviceProfile'ın registry sonuçları olarak gösterilir. Language değiştiğinde text/audio/media/floor content çözümlemesi aynı canonical model üzerinden yeniden değerlendirilir. Gerçek firmware audio arbitration veya serial protocol simulator'da uydurulmaz. [1]

## 16. Console

Console/Output alt dock'ta bulunan, command, operation, validation, export, simulator trace ve deployment mesajlarını gösteren tool window'dur. Console yeni bir domain state sistemi değildir; application command ve logging sonuçlarının görünür yüzeyidir.

| Seviye | Örnek | Görsel sunum |
|---|---|---|
| INFO | `Template validated`, `Package created` | Neutral icon, zaman ve kısa mesaj |
| WARN | `Profile capability not available` | Amber icon, filtrelenebilir |
| ERROR | `Missing referenced asset` | Kırmızı icon ve issue navigation |
| COMMAND | `> validate()` | Teknik/monospace command trace |
| EVENT | `[Binding] Floor == 6 → TRUE` | Source, target ve result bilgisi |

Kullanıcı mesajı kısa ve eylem odaklı, teknik ayrıntı Console'da olmalıdır. Örneğin `No removable SD card was detected. Insert the SD card and try again.` kullanıcıya gösterilir; adapter exception/path/checksum ayrıntısı Console'a yazılır. Her validation satırı mümkünse problem, source location, reason ve action taşır.

External AI veya command client application command'larını kullandığında Console yapılan işlemi görünür kılar. AI uygulamanın içine gömülü runtime özelliği değildir; Console yalnız command görünürlüğünü sağlar. [2]

## 17. Settings

**Program Settings / Preferences modal ve blocking bir penceredir.** Dockable panel, in-canvas navigator veya web-style full-page settings değildir. Settings açıkken ana uygulama ve canvas etkileşime kapalı kalır. Kullanıcı `Cancel` ile değişiklikleri atar veya `Save / Apply & Close` ile kaydeder. Arka plana tıklama ana uygulamayı aktive etmez. [13]

Önerilen kategori navigasyonu `General`, `Appearance`, `Editor`, `Canvas`, `Assets`, `Simulator`, `Validation`, `Export` ve `Shortcuts` başlıklarını taşıyabilir. Outer Settings container modal kalır; iç navigation veya search kullanılabilir.

| Scope | UI yüzeyi | Örnek |
|---|---|---|
| Program Settings | Modal Preferences | UI language, appearance, editor/grid, asset browser, simulator, validation, shortcuts |
| Project Settings | Project context/Properties | DeviceProfile, project override, simulation profile, export behavior |
| Theme Defaults | Theme/Properties/Audio context | Default Digit/Direction style, background, theme audio defaults |
| Runtime Setting | Profile-driven Simulator/Runtime context | Language, active theme, voice pack, firmware audio/style settingleri |

Runtime Setting, Project Setting veya Theme Default Program Settings modalına sessizce taşınmaz. Firmware-owned runtime setting'ler DeviceProfile'dan gelir; UI bu listeyi kendi başına genişletmez. [1] [13]

## 18. Context Menus

Context menu'lar Canvas, Widget, Scene, Rotation/Form, Theme Project, Project, Asset, Resource ve panel bağlamına göre ayrı command listeleri üretir. Tek bir devasa menu oluşturulmaz; profile/domain izin vermeyen command gösterilmez.

| Context | Command örnekleri |
|---|---|
| Canvas | Select, Paste, Add supported widget, Grid/Snap, Fit, Properties |
| Widget | Duplicate, Delete, Lock, Hide, Bring Forward, Send Backward, Properties, Binding |
| Scene | Add, Duplicate, Rename, Test, Priority, Binding, Validation |
| Rotation/Form | Open, Rename, Restore if allowed, Validate, Publish readiness |
| Theme Project | Rename, Duplicate, Resources, Theme Defaults, Publish |
| Project | Open, Project Settings, Validate, Build Package, Deployment |
| Asset/Resource | Preview, Replace, Rename, Used By, Reveal, Remove |

Destructive delete, overwrite, invalid capability transfer ve external target selection için dialog kullanılır. Normal property configuration inline inspector veya popover'da kalır. `Custom State`, Popup Widget, generic anchor graph ve unsupported capability context menu'lerde bulunmaz. [1] [9]

## 19. Keyboard/Mouse

Shortcut registry tek kaynaktır ve conflict tespiti yapar. Canonical veya promptta açıkça belirtilen davranışlar aşağıdaki gibidir:

| Input | Davranış | Durum |
|---|---|---|
| `Ctrl+C` / `Ctrl+V` | Copy / Paste | CONFIRMED |
| `Ctrl+X` | Cut | CONFIRMED |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo | CONFIRMED |
| `Ctrl+S` | Save | CONFIRMED |
| `Delete` | Seçili nesneyi silme; dependency dialog gerekebilir | CONFIRMED |
| `Esc` | Current tool/duplicate mode iptali | CONFIRMED |
| `Ctrl+A` | Uygun canvas/list context'inde select all | CONFIRMED |
| `R` | Transform sırasında 90° clockwise rotation | CONFIRMED |
| Arrow | Normal snap-grid hareketi | CONFIRMED |
| `Ctrl+Arrow` | Snap grid / 10 fine movement | CONFIRMED |
| `Shift+Ctrl+Arrow` | Snap grid × 5 movement | CONFIRMED |
| `Ctrl+D` | Duplicate mode veya duplicate command | CONFIRMED |
| Mouse click | Select/focus; boş canvas'ta selection clear | CONFIRMED |
| `Ctrl/Shift + click` | Multi-select toggle | CONFIRMED |
| Marquee drag | Uygun editor context'inde multi-select | PROPOSED |
| Wheel/pinch | Zoom; pan modifier registry ile belirlenir | PROPOSED |

Duplicate mode'da duplicate grubun merkezi cursor/click position'a bağlanır. Her tıklama yeni duplicate oluşturur; `Esc` duplicate mode'u kapatır ve normal selection tool'a döner. `Shift+S` ile Scene switching V1 feature'ı değildir; shortcut olarak eklenmez. [3]

## 20. Document Tabs

Document Tabs, açık çalışma belgelerini gösterir; domain nesnesinin kendisi değildir. Canonical tab yüzeyi Theme Project ve Rotation/Form document'larıdır. Scene, Rotation/Form altında bir edit context'tir; global veya bağımsız bir Scene dosyası gibi modellenmez.

Örnek tab başlıkları `Theme 01 · R0`, `Theme 01 · R90`, `Theme 01 · R180` ve `Theme 01 · R270` biçiminde olabilir. Scene adı gerekiyorsa `Theme 01 · R0 · Scene Fire` yalnız context yardımcısı olarak eklenir. Tab kapatmak Rotation/Form veya Scene'i silmez.

Tab'lar active/inactive, reorder, close, close others, close all, pin/unpin, detach/floating ve başka monitöre taşıma davranışlarını destekleyebilir. Dirty document başlığında belirgin işaret taşır; close sırasında kaydetme kararı kullanıcıya bırakılır. Project Explorer'dan Rotation/Form seçildiğinde ilgili document tab aktive edilir veya açılır.

## 21. Responsive Layout

Bu ürün mobile responsive web sayfası değildir; gerçekçi Windows desktop boyutlarında resize edilir. Panel genişliği splitter ile değişir, central canvas önceliğini korur ve secondary tool window'lar collapse, auto-hide veya tab olabilir. Properties minimum usable width'in altına zorla sıkıştırılmaz; panel collapse veya auto-hide davranışı önerilir.

| Resize durumu | Beklenen UI sonucu |
|---|---|
| Ana pencere genişler | Canvas esnek büyür; aspect ratio ve center korunur. |
| Ana pencere daralır | Secondary labels kısalır, paneller collapse/tab olur. |
| Sağ panel genişliği değişir | Inspector satırları reflow olur; canvas viewport yeniden hesaplanır. |
| Sol Explorer daralır | Vertical scroll/ellipsis kullanılır; preview minimum görünürlüğü korunur. |
| Console açılır/kapanır | Canvas kalan yüksekliğe fit edilir; scrollback kaybolmaz. |
| Floating panel taşınır | Selection, document state ve workspace state korunur. |
| Rotation/Form değişir | Yeni logical resolution'a fit edilir; geometry stretched edilmez. |

Exact minimum window size implementasyon visual QA aşamasında belirlenebilir; telefon/portrait viewport hedefi yoktur. Panel resize, runtime context'i veya active Scene'i sessizce değiştirmez.

## 22. Visual Design System

Visual language; professional, clean, technical, modern, familiar ve non-cumbersome olmalıdır. Aşırı rounded cards, oversized buttons, decorative gradients, glassmorphism, excessive whitespace, mobile-style bottom navigation veya gereksiz animation kullanılmaz. Teal/cyan accent; selection, focus, action ve link state'lerinde tutarlı fakat ölçülü kullanılır.

Canvas background ile device/display surface arasında net ton farkı bulunur. Grid ve snap ayrı davranışlardır. Major/minor grid çizgileri düşük opacity ile gösterilir; device preview'nin okunabilirliğini kapatmaz. Panel header, tab, toolbar ve property rows aynı vertical rhythm içinde kalır.

Motion yalnız işlevseldir: panel aç/kapa, selection feedback, progress ve kısa status transition'ları desteklenebilir. Sürekli pulse, decorative floating effect veya canvas'ı hareket ettiren animation kullanılmaz. Media preview playback'i gerçek media kontrolüdür; decoration değildir. [3] [5]

## 23. Design Tokens

Kodlama aşamasında renk, spacing ve control ölçüleri dağınık sabitlerle kullanılmamalı; semantic token katmanı üzerinden yönetilmelidir. Aşağıdaki isimler UI specification için canonical token ailesidir; exact color değerleri screenshot ve Windows contrast QA sırasında kalibre edilir.

| Token grubu | Örnek token'lar | Kullanım |
|---|---|---|
| Surfaces | `app-bg`, `panel-bg`, `canvas-bg`, `surface`, `surface-elevated` | Shell, panel ve çalışma yüzeyi |
| Borders | `border-subtle`, `border-strong`, `splitter` | Panel ve dock ayrımları |
| Text | `text-primary`, `text-secondary`, `text-muted`, `text-on-dark-preview` | Bilgi hiyerarşisi |
| Accent | `accent`, `accent-hover`, `accent-muted`, `selection` | Action, focus ve selection |
| Status | `success`, `warning`, `error`, `info` | Validation ve operation state |
| Canvas | `device-frame`, `device-surface`, `grid-major`, `grid-minor`, `guide` | Device preview ve geometry |
| Focus | `focus-ring`, `keyboard-focus` | Klavye odağı |
| Elevation | `shadow-panel`, `shadow-floating`, `shadow-dialog` | Sınırlı surface separation |

4/8 tabanlı spacing rhythm, düşük border radius, 1 px border ve compact control density varsayılan ölçü sistemidir. Control height ve tab/toolbar height aynı baseline'a oturur. Typography'de application UI için okunabilir sistem fontu, firmware Text widget için ise DeviceProfile font reference kullanılır; bu iki font alanı karıştırılmaz.

## 24. Accessibility

Menu Bar, Toolbar, Document Tabs, Project Explorer, Canvas actions, Properties fields, dock headers, modal Settings ve Console filtreleri klavye odağı alabilmelidir. Focus ring selection accent'ten ayrı ve belirgin bir token kullanır. Icon-only control'ler accessible label ve tooltip olmadan bırakılmaz; Save, Publish, Lock, Visibility, Fit ve Dock komutları anlamlı text/label taşır.

Locked, invisible, selected, active Scene, warning, error ve disabled durumları yalnız renk ile anlatılmaz. Numeric Properties alanlarında label, unit ve validation message aynı erişilebilir form ilişkisi içinde bulunur. Modal Settings açıkken focus modal içinde kalır; Escape'ın Cancel davranışı açıkça belgelenir.

Canvas pointer interaction'ının keyboard karşılığı sağlanır. Hassas drag veya marquee keyboard ile tam karşılanamıyorsa X/Y/Width/Height/Z-order Properties üzerinden düzenlenebilir. Contrast, focus visibility ve text size gerçek Windows pencere boyutlarında visual QA ile doğrulanır.

## 25. UI States

Her önemli interactive surface en az aşağıdaki durumları tanımlamalıdır:

| State | UI kuralı |
|---|---|
| Normal | Varsayılan surface ve readable control state |
| Hover | Etkileşim alanını hafifçe vurgular; layout sıçraması yapmaz |
| Active | Command veya tab'ın çalıştığını açıkça gösterir |
| Focused | Keyboard focus, selection'dan ayrı focus ring ile görünür |
| Disabled | İşlem yapılamaz; neden gerekiyorsa açıklanır |
| Selected | Seçili node/widget/tab net fakat ölçülü accent ile görünür |
| Error | Icon + text + source location + recovery action |
| Warning | Amber/neutral warning icon + açıklama; renk tek kaynak değildir |
| Empty | Kullanıcıyı anlamlı ilk command'a yönlendirir |
| Loading | Operation devam eder; stale edit ve selection güvenli yönetilir |
| Unavailable | Capability veya source mevcut değil; neden ve alternatif gösterilir |
| Unsupported | Active DeviceProfile desteklemiyor; control gizlenir veya açıkça işaretlenir |

Empty state marketing metni değil, tek anlamlı sonraki adımdır: `Add Widget`, `Select an item`, `Choose a depot`, `Run Simulator`, `Validate to check readiness`. Loading durumunda kullanıcıya operation kapsamı ve gerekirse cancel/retry bilgisi verilir.

## 26. Validation/Error States

Validation editor, simulator, save, export ve console tarafından paylaşılan first-class service'dir. UI her sorunu yalnız `Invalid` etiketiyle bırakmaz; **problem + reason + location + action** formatını kullanır.

| UI yüzeyi | Empty | Loading | Error/warning | Recovery |
|---|---|---|---|---|
| Project Explorer | Create/Open Project | Tree loading | Project/path okunamadı | Retry, Open Another, Console |
| Canvas | Add/select Scene/Widget | Model/preview loading | Geometry/render issue | Navigate, Revalidate |
| Properties | Select an item | Field updating | Invalid, unsupported, unresolved | Focus field, Reset, Profile |
| Asset Browser | Choose depot/import resource | Thumbnail/metadata | Missing, unsupported, decode error | Reveal, Replace, Remove |
| Simulator | Run/choose scenario | Evaluate states/bindings | Invalid context/capability | Reset, Binding, Console |
| Console | No messages yet | Operation progress | Filtered severity messages | Navigate, copy, retry |
| Validation/Publish | Validate to check readiness | Rule groups running | Blocking error/non-blocking warning | Fix, navigate, rerun |
| Settings | Load preferences | Category loading | Invalid preference/conflict | Reset, Cancel, Save |
| Deployment | Build/select package/target | Preparing/Writing/Verifying | Drive, space, checksum failure | Retry, target change, safe abort |

Canonical validation kuralları; missing referenced asset, broken stable ID, invalid binding, unsupported capability, invalid configuration, duplicate stable ID, invalid required rotation, unresolved floor mapping, impossible capability combination, video/decode violation ve missing optional language/style/media content'i kapsayabilir. Exact ERROR/WARNING severity, active DeviceProfile ve ürün validation matrix'i tarafından belirlenir; UI kendi başına severity icat etmez. [1]

Validation success, package verification veya SD-card deployment verification tamamlanmadan gösterilmez. Deployment UI `Preparing`, `Writing`, `Verifying` ve `Completed/Safe to remove` durumlarını ayrı gösterir. [2]

## 27. Confirmed Decisions

Aşağıdaki kararlar bu UI specification içinde **CONFIRMED** kabul edilir:

| Karar | UI sonucu |
|---|---|
| IDE/CAD-style Application Shell | Stable shell, dockable panels ve command-driven editing |
| Altium-like Project Explorer | Hierarchical project/theme/rotation/scene/widget/resource navigation |
| Altium-like Properties | Contextual inspector ve common property editing |
| Multi-select `*` | Ortak değer normal, farklı değer `*`; yeni değer tüm seçime uygulanır |
| Dockable/collapsible/floating panels | Dock, tab, split, float, auto-hide, collapse desteklenir |
| Canvas central editor surface | Device preview gerçek aspect ratio ile merkezde kalır |
| Simulator separate dockable panel | Aynı domain evaluation modelini kullanır |
| Console bottom dock | Command/validation/export/runtime trace görünürlüğü sağlar |
| Program Settings modal/blocking | Cancel veya Save/Apply & Close ile kapanır |
| Snap Grid | Grid görünürlüğü snap davranışından ayrıdır |
| Free rotation + 5° snap | `R` transform sırasında 90° clockwise rotation'dır |
| Duplicate mode | Click center placement; repeated click duplicate; `Esc` exits |
| Locked/invisible widget | Seçilebilir; locked geometry değişmez; invisible render edilmez |
| Hide All/Show All | Visibility command'ları user intent'i koruyacak şekilde çalışır |
| Bounding Group optional | Widget değildir; klasik anchor graph değildir |
| Scene selection | Priority `0–10`; tek active Scene; same priority'de runtime'da son aktif olan kazanır |
| State ownership | State listesi DeviceProfile-defined; Custom State yoktur |
| Warning ownership | Warning listesi profile-defined; bilinen current profile state'leri `service_out`, `overload`, `fire`'dır |
| Digit | Font/glyph asset sistemi yoktur; Digit Style kullanılır |
| Direction | Default/custom ayrıdır; default Up, editable Down varyantı başlatır; custom Up/Down ayrıdır |
| Media Slide | Popup değildir; visual image/video + optional attached audio'dur |
| Media timing | Precision `0.1 s`; normal media `0`; Slide `3 s`; Loop infinite, Repeat finite |
| Media capability | Decode/video limitleri DeviceProfile'dan gelir; `1280×720` global hard-code edilmez |
| Asset boundary | Asset Depot, Resources, Scene references ve Unsupported Files ayrıdır |
| Format conversion | Full conversion V1 Designer özelliği değildir |
| Localization | Text/audio/floor/media content etkilenebilir; Language 1/2 sequence mümkündür |
| Background Music | Theme-level persistent/looping audio katmanıdır |
| Audio priority | Kesin `0–100`; gerçek arbitration firmware'e aittir |
| Simulator | Aynı canonical domain evaluation motorunu kullanır |
| Shift+S | Scene switching shortcut'ı değildir |

## 28. Open Decisions

UI şu konularda kullanıcıya yanlış kesinlik sunmaz; alanı profile-driven gizler veya `Profile-defined`, `Not finalized`, `Unsupported` açıklaması gösterir:

| Açık konu | UI davranışı |
|---|---|
| Exact DeviceProfile JSON/schema | Raw registry editörü açılmaz; profile metadata beklenir. |
| State metadata/setting registry alanları | Yalnız profile'ın verdiği alanlar gösterilir. |
| Exact locale fallback ve voice-pack registry | Fallback sonucu profile/firmware tanımı olmadan garanti edilmez. |
| Exact floor symbolic encoding | Unknown symbol unresolved kalır. |
| Exact visual layer defaults ve same Z-order order | Numeric/layer field profile/domain sonucu olmadan varsayılmaz. |
| Exact audio mixer/ducking/interruption | UI policy metadata'yı gösterir; firmware sonucunu taklit etmez. |
| Root/theme `config.cfg` kesin alanları | Publish readiness semantic düzeyde gösterilir; parser alanı uydurulmaz. |
| Exact physical export folder names | UI semantic package/resources gösterir; fiziksel isimler exporter contract'ına bırakılır. |
| Dynamic Runtime Layout exact math | Bounding Group form alanı `Profile-defined/Not finalized` olabilir. |
| Generic Media Sequence/timeline/keyframes | V1'de gizli veya Future/Not in V1 olarak işaretli. |
| External CSV/residents parameter source | Kullanılabilir runtime field gibi gösterilmez. |
| Transition fade/slide | DeviceProfile/runtime açıkça desteklemiyorsa control gösterilmez. |
| Exact validation severity matrix | ERROR/WARNING kendi başına icat edilmez; profile-aware rule sonucu gösterilir. |

Bu açıklar UI tarafından çözülmez; canonical domain/firmware contract kesinleştiğinde aynı UI yüzeyleri profile-driven olarak genişletilebilir. [1]

## 29. Future Extensions

Aşağıdaki yüzeyler architecture için extension point olabilir fakat V1 UI'ında tamamlanmış ürün özelliği gibi sunulmaz:

| Gelecek extension | V1 sınırı |
|---|---|
| Full Format Tool | Designer yalnız metadata, capability validation ve dependency resolution yapar. |
| Generic Media Sequence/timeline editor | Media Slide contextual timing ile sınırlıdır. |
| Dynamic Runtime Layout math | Bounding Group semantic reference ile sınırlıdır. |
| External CSV/resident parameters | `Future parameter source` olarak belgelenir. |
| AI-generated bindings | External agent command yüzeyi olabilir; UI'ya gömülü runtime feature değildir. |
| Additional firmware states | DeviceProfile registry ile yeniden UI hard-code edilmeden görünür. |
| Wi-Fi deployment | V1 UI yalnız SD-card deployment'a odaklanır; future target abstraction'dır. |
| Advanced manifest/index lookup | Semantic package readiness gösterilir; firmware parser uydurulmaz. |
| Full transition/timeline authoring | Runtime contract açıkça destekleyene kadar gösterilmez. |

### Canonicalization review record

Bu ikinci geçişte korunan doğru kararlar; professional shell, dockable/floating panels, merkezi canvas, Project Explorer, contextual Properties, multi-select `*`, modal Settings, profile-driven state listesi, State/Scene ayrımı, Binding'in Scene selection'ı değiştirmemesi, Digit'te font kullanılmaması, Direction default/custom ayrımı, Media Slide'ın Popup olmaması, Asset Depot/Resources/Unsupported Files ayrımı, Simulator'ın ortak evaluation modelini kullanması ve validation/deployment feedback'idir.

Düzeltilen veya netleştirilen noktalar; canonical hierarchy'nin dört Rotation/Form ile sabitlenmesi, same-priority winner'ın runtime'da son aktif Scene olarak açıkça yazılması, Project Explorer order'ın tie-break olmaktan çıkarılması, `service_out` warning ID'sinin canonicallaştırılması, Asset Browser'dan Fonts kategorisinin kaldırılması, V1 Media Sequence/timeline yüzeyinin zorunlu olmaktan çıkarılması, `1280×720` limitinin hard-code edilmemesi, full format conversion'ın V1 Designer'dan ayrılması, Fixed Slots/Dynamic Active Items'ın V1'de zorunlu domain mode gibi sunulmaması ve audio arbitration'ın firmware sorumluluğunun görünür kılınmasıdır.

Aşağıdaki domain kararları değiştirilmemiştir: DeviceProfile ownership, Custom State'in yokluğu, canonical state/scene evaluation sırası, Floor Mapping zinciri, Digit/Direction ayrımı, Media Slide modeli, Asset stable ID sınırı, deployment semantic hierarchy ve V1 non-goals. Domain/UI arasında yeni bir contradiction bulunursa bu dosyada sessizce çözülmemeli; `DOMAIN CONTRADICTION FOUND` olarak raporlanmalıdır. [1]

## References

[1]: ./DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md "Template Designer — Domain / Runtime Contract V1 (Canonical)"
[2]: ../AGENTS.md "Template Designer — Agent Contract"
[3]: ./.agents/skills/ui-ux-system/SKILL.md "UI/UX System Skill — Template Designer"
[4]: ./UI_REFERENCE.md "Template Designer — UI Reference"
[5]: ./UI_UX_ARCHITECTURE.md "Template Designer — UI/UX Architecture"
[6]: ./TEMPLATE_DESIGNER_CONTRACT_V2.md "Template Designer — Ürün, Widget ve Tema Sözleşmesi v2"
[7]: ./ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md "Template Designer — Architecture V2"
[8]: ./WIDGET_SYSTEM_QUESTIONNAIRE_V1.md "Widget System — UX Questionnaire V1"
[9]: ./MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md "Media / Asset Browser — UX Questionnaire V1"
[10]: ./MULTILINGUAL_CONTENT_SYSTEM.md "Template Designer — Multilingual Content System"
[11]: ./BINDING_PARAMETRIC_SYSTEM_V1.md "Binding & Parametric System V1"
[12]: ./PRODUCT_DECISIONS_2026-08.md "Template Designer — Consolidated Product Decisions"
[13]: ./SETTINGS_ARCHITECTURE_QUESTIONNAIRE_V1.md "Settings Architecture Questionnaire V1"
[14]: ./PROJECT_PLAN.md "Template Designer — Project Plan"
