# Template Designer — UI Design System V2

**Durum:** Uygulanabilir tasarım spesifikasyonu  
**Kapsam:** UI/UX mimarisi; kod, domain model ve Phase 0 foundation değişikliği içermez.  
**Kaynak önceliği:** Repository referans görselleri → mevcut UI kararları → ürün/domain sözleşmeleri → yalnızca boşlukları doldurmak için genel profesyonel masaüstü UX bilgisi. Bu sıra repository UI/UX skill'inde açıkça tanımlanmıştır.[1]

> Template Designer, basit bir form veya generic dashboard değil; canvas'ı yapılandırılmış bir domain model üzerinde çalışan **Windows engineering/design application** olan, tema tasarlama, runtime davranışını simüle etme, doğrulama ve deployment paketi üretme ortamıdır.[2] [3]

## 0. Durum işaretleri ve bağlayıcı kurallar

Bu dokümanda üç karar seviyesi kullanılır. **CONFIRMED**, mevcut repository belgelerinde veya kullanıcı isteminde kesinleşmiş karardır ve implementasyon sırasında korunur. **PROPOSED**, mevcut kararlarla çelişmeyen, uygulamayı doğrudanlaştıran tasarım önerisidir; kodlama öncesi düşük maliyetli bir ürün kararı olarak kabul edilebilir. **UNDECIDED**, canonical sözleşmede açık bırakılmıştır; UI bu noktayı kullanıcıya yanlış kesinlikte sunmamalı ve henüz desteklenmeyen bir davranışı varmış gibi göstermemelidir.[4]

| Seviye | Uygulama kuralı | Örnek |
|---|---|---|
| **CONFIRMED** | Doğrudan tasarım sözleşmesine alınır. | Dört rotation, dockable tool window, Properties'te çoklu seçimde ortak alanlar, Settings'in modal olması. |
| **PROPOSED** | Bu dokümandaki varsayılan UX olarak uygulanabilir; domain davranışı icat etmez. | Panel başlangıç oranları, Command Palette kısayolu, seçili nesne için alt context toolbar. |
| **UNDECIDED** | Control gizlenir, `Not available in this profile` veya `To be defined by DeviceProfile` ile açıklanır. | Aynı priority tie-break'in nihai algoritması, kesin audio mixing, exact dynamic alignment matematiği. |

Tüm UI olayları `UI Event → Application Command/Use Case → Canonical Project State → View Model → UI` zincirinden geçer. React bileşeni firmware/template iş mantığının sahibi değildir; Preview, Simulator, Validation ve Export aynı canonical modelden beslenir.[3] [5]

## 1. Design Principles

### 1.1 Ürün hissi

Uygulama ilk açıldığında bir web sitesi değil, **profesyonel engineering/design application** hissi vermelidir. Altium Designer, Visual Studio, JetBrains IDE ve CAD yazılımlarının alışılmış yoğunluğu ve çalışma disiplini referans alınır; ancak bunların görünüşü kopyalanmaz. Hedef; profesyonel, kullanışlı, yoğun fakat karmaşık olmayan, tanıdık, estetik ve Windows masaüstü davranışlarına sahip bir araçtır.[1] [6]

### 1.2 Görsel omurga

Repository görsellerinin ortak omurgası üç parçadan oluşur: açık nötr çalışma alanı, görsel odağı oluşturan koyu fiziksel cihaz/display preview'si ve sınırlı teal/cyan vurgu. Sol taraftaki navigasyon veya hiyerarşi, merkezdeki cihaz canvas'ını; sağdaki contextual inspector ise seçili nesneyi destekler. İnce border, kompakt kontroller, kontrollü boşluk ve hafif elevation kullanılmalıdır.[7] [8]

Aşağıdaki davranışlar ürünün her yüzeyinde korunur: kullanıcının nerede olduğu, neyi düzenlediği, neyin seçili olduğu, yapılacak değişikliğin kapsamı, geçersizliğin nedeni ve sonraki adım açıkça görülebilir. Renk tek başına durum anlatmaz; ikon, metin veya yapı ile tamamlanır.[1]

### 1.3 Domain sınırları

`State`, firmware/DeviceProfile'dan gelen runtime değeridir; `Scene`, aktif state'lerin condition ve priority ile seçtiği görsel sunumdur. Birden fazla state aynı anda aktif olabilir, fakat aynı runtime bağlamında tek bir Scene active olur. Runtime priority, visual Z-order ve Bounding Group geometrisi birbirinden ayrıdır.[4] [9]

`Widget Type` semantik nesneyi, `Media Type` ise görsel/işitsel kaynağın formatını ifade eder. Direction widget Image veya Video içerik kullanabilir; Digit/Floor widget da aynı şekilde profile destekliyorsa image/video content kullanabilir. UI bu ayrımı hem Add menüsünde hem Properties başlıklarında görünür kılar; ancak kullanıcıyı teknik ayrıntıyla boğmaz.[10]

## 2. Application Shell

### 2.1 Ana pencere

Application Shell bütün ekranlarda kararlı kalır. Üstten alta doğru şu katmanlar kullanılır: Menu Bar, Toolbar, Document Tabs, ana çalışma alanı ve Status/Tool Area. Sol ve sağdaki araç pencereleri sabit kolon değil, Dock Manager tarafından yönetilen tool window'lar olarak ele alınır. Project Explorer, Properties, Asset Browser, Simulator, Runtime State, Console/Output ve Validation bu kapsamdadır.[3]

| Bölge | Sorumluluk | Başlangıç sunumu | Durum |
|---|---|---|---|
| Menu Bar | File, Edit, View, Project, Theme, Scene, Widget, Simulator, Validation, Export/Deployment, Window, Help komutları | Pencerenin üstünde, genişletilebilir yatay menü | **CONFIRMED** |
| Toolbar | Sık kullanılan command'lar: Save, Undo/Redo, Add, Validate, Preview/Design Mode, Publish/Deploy | Menu Bar'ın altında; profile ve belge bağlamına göre değişir | **CONFIRMED / PROPOSED** |
| Document Tabs | Açık Theme/Rotation tasarım belgeleri | Toolbar'ın altında, reorder ve detach destekli | **CONFIRMED** |
| Project Explorer | Workspace ve proje hiyerarşisinde gezinme | Varsayılan sol dock | **CONFIRMED** |
| Canvas | Gerçek display oranında düzenleme ve render | Merkez document area | **CONFIRMED** |
| Properties | Seçime bağlı düzenleme | Varsayılan sağ dock | **CONFIRMED** |
| Asset Browser | Asset Depot/library görünümü | Ayrı dockable tool window; varsayılan yerleşimde sol veya alt sekme olabilir | **CONFIRMED / PROPOSED** |
| Simulator | Aynı domain/runtime engine ile test | Ayrı dockable tool window veya Test workspace | **CONFIRMED** |
| Runtime State | DeviceProfile state/setting bağlamı | Simulator ile tabbed veya split dock | **CONFIRMED / PROPOSED** |
| Console | Komut, işlem, validation, export, deployment ve debug çıktısı | Varsayılan alt dock | **CONFIRMED** |
| Validation | Publish readiness ve Design Rules sonuçları | Sağ/alt dock veya Publish workspace | **CONFIRMED / PROPOSED** |
| Status Bar | Dirty state, validation özeti, aktif form/scene, zoom, koordinat ve işlem durumu | Pencerenin altında | **PROPOSED** |

### 2.2 Shell içi ürün navigasyonu

Sol taraftaki compact product rail, Project Explorer'ın yerine geçmez. Ürün yüzeyleri `Home/Projects`, `Theme Library`, `Design Studio`, `Media/Resources`, `Test Studio/Simulator`, `Validation/Publish`, `Deployment` ve `Application Settings` olarak gruplanabilir. Bu öğeler aynı ana pencere içinde workspace değiştirir; her işlem için yeni bir OS penceresi veya wizard zinciri açılmaz.[1] [5]

Referans görsellerindeki Tema, Kaynaklar, Tasarım, Test, Yayın ve Ayarlar rail'i bu ürün navigasyonunun görsel kaynağıdır. Proje içi hiyerarşi ise ayrıca Project Explorer'da tutulur; böylece ürün yüzeyi ile domain navigation birbirine karışmaz.[7]

### 2.3 Başlangıç yerleşimi

İlk açılışta varsayılan **Design workspace** şu geometrik ilişkiyi kullanır: sol tarafta Project Explorer, ortada Document Tabs + Canvas, sağda Properties, altta Console/Status. Başlangıç panel oranları uygulama tercihi olarak saklanabilir; spesifik değerler implementasyon sırasında referans ekranların gerçek pencere boyutlarıyla kalibre edilir. Aşağıdaki oranlar **PROPOSED** başlangıç değerleridir ve minimum usable width'i ihlal etmemelidir.

| Alan | Önerilen başlangıç payı | Minimum kullanılabilirlik kuralı |
|---|---:|---|
| Project Explorer | %20–24 | Hiyerarşi satırları ve isimler kısaltılmadan taranabilir olmalı |
| Document/Central Canvas | Esnek kalan alan | Cihaz preview'si letterbox ile bozulmadan görünmeli |
| Properties | %24–28 | Etiket, değer ve validation hint aynı satır/akışta okunabilmeli |
| Console | Alt bölgede %18–25 yükseklik | Son olaylar ve severity filtreleri görünür kalmalı |

## 3. Docking System ve Window UX

Dockable yüzeyler `dock`, `undock`, `float`, `resize`, `split`, `tab`, `collapse`, `auto-hide`, `close/reopen` işlemlerini destekler. Dock Manager kullanıcıya standart IDE/CAD davranışını tanıtır: panel sürüklenirken bırakma hedefleri canlı görünür; geçerli hedefte preview bölgesi, geçersiz hedefte reddedici görsel durum oluşur. Incoming panel, mevcut paneli rastgele kapatmaz; uygun durumda stack/tab veya split oluşturur.[3] [11]

### 3.1 Docking senaryoları ve geri bildirim

| Senaryo | Bırakma davranışı | Kullanıcıya verilecek visual feedback | Durum |
|---|---|---|---|
| Sağa dock | Panel central document area's sağ kenarına split olarak yerleşir; mevcut sağ grup varsa ona tab olabilir | Sağda yarı saydam mavi/teal insertion zone; splitter çizgisi ve hedef başlık | **CONFIRMED** |
| Sola dock | Project Explorer veya mevcut sol gruba split/tab | Solda insertion zone; genişlik ghost preview | **CONFIRMED** |
| Üste dock | Üst tool-window bandı oluşturur; document tabların üstüne içerik bindirmez | Üstte yatay highlight ve panelin önizleme yüksekliği | **CONFIRMED** |
| Alta dock | Console/Output gibi alt gruba split veya tab | Altta highlight; status bar ile çakışmayacak ghost frame | **CONFIRMED** |
| Paneli diğerinin üzerine bırakma | Aynı dock group içinde tab oluşturur | Hedef panel çevresinde outline, bırakmada tab adı preview | **CONFIRMED** |
| Tab group oluşturma | Aynı gruptaki tool window'lar tab strip'te birikir | Tab insertion caret ve aktif tab highlight | **CONFIRMED** |
| Split oluşturma | Yatay/dikey split; split oranı splitter ile ayarlanır | Bölme eksenini gösteren ghost line ve iki alan fill | **CONFIRMED** |
| Floating panel | Ayrı pencerede açılır; ana pencere ile ilişkisi korunur | Pencere gölgesi, başlık ve ana shell üzerinde floating outline | **CONFIRMED** |
| Multi-monitor | Floating panel veya document window başka monitöre taşınabilir; layout/state saklanır | Taşınabilir pencere preview'si, ana uygulamada ilişki/restore durumu | **CONFIRMED** |
| Auto-hide | Panel kenar sekmesine küçülür; hover/focus ile açılır | Kenarda ikon+etiket rail'i; açılınca overlay değil dock preview | **CONFIRMED** |
| Panel collapse | Panel genişliği minimum başlık/rail boyutuna düşer | Collapse chevron, kalan içerik alanında artan canvas görünürlüğü | **CONFIRMED** |
| Close/reopen | Panel kapanır, Window/View menüsünden tekrar açılır | Close sonrası toast değil; menüde checked/unchecked görünümü | **CONFIRMED** |
| Reset Layout | Workspace layout'ı bilinen başlangıç düzenine döndürür | Önce etkilenecek panel/layouların özeti; geri alınabilir command | **PROPOSED** |
| Workspace Layout | Design, Simulation, Debug gibi layout profilleri panel görünürlüğü ve konumunu değiştirir | Aktif layout adı toolbar/status alanında görünür | **CONFIRMED** |
| Design / Simulation / Debug | Aynı document/project state korunur; yalnız çalışma yüzeyi ve araç görünürlüğü değişir | Layout geçişinde kısa status mesajı, aktif layout tab/label vurgusu | **CONFIRMED / PROPOSED** |

Panel sürükleme sırasında imleç geçerli bir hedef üzerinde değilse panel mevcut yerinden ayrılmış görünür fakat bırakma işlemi gerçekleşmez. Kullanıcı paneli kaybetmiş hissine kapılmamalıdır; drag iptalinde önceki konum geri yüklenir. Auto-hide açıldığında içerik, odak kaybedilince kapanabilir; ancak form/Properties üzerinde devam eden edit odak kaybıyla sessizce iptal edilmez.

### 3.2 Workspace state

Workspace; dock pozisyonlarını, açık document tablarını, floating panelleri, panel görünürlüklerini, window boyutlarını ve seçili layout profilini saklar. Program-level varsayılan layout ile project-specific workspace state birbirinden ayrılır. Bir projeyi yeniden açarken document ve panel state geri yüklenemiyorsa uygulama güvenli bir fallback layout seçer ve Console'a teknik ayrıntı yazar.[3]

## 4. Document Tabs ve document navigation

### 4.1 Hiyerarşi

Canonical navigation aşağıdaki biçimdedir:

```text
Workspace
└── Project                         # SD-card deployment projesi
    └── Theme Project Group
        └── Theme Project           # gerçek tema paketi
            ├── Rotation r0         # 0°, 720×1280
            ├── Rotation r90        # 90°, 1280×720
            ├── Rotation r180       # 180°, 720×1280
            └── Rotation r270       # 270°, 1280×720
                └── Scene
                    └── Widget
```

Bir Theme Project tam dört rotation taşır; her rotation bağımsız geometriye sahip bir design document/tab'dır. Yeni projede profile destekli iskelet otomatik oluşturulabilir; kullanıcı rotation/scene silebilir ve Project Explorer üzerinden uygun olanı geri ekleyebilir. Desteklenmeyen rotation veya Scene sessizce oluşturulamaz.[4] [12]

### 4.2 Project Explorer ile Document Tabs ayrımı

Project Explorer, **hangi proje/theme/rotation/scene/object'ın var olduğunu ve nerede bulunduğunu** gösterir. Document Tabs ise **şu anda açık çalışma belgelerini** gösterir. Explorer'da bir rotation seçildiğinde onun document tab'ı aktive edilir veya açılır; tab kapatıldığında domain nesnesi silinmez. Scene tab'ın ayrı domain document'ı değildir; varsayılan olarak aktif rotation document içinde Scene context olarak görünür.

Önerilen tab başlıkları şunlardır: `Theme 01 · R0`, `Theme 01 · R90` ve bağlam açıklaması gerektiğinde `Theme 01 · R0 · Scene Up`. Scene adının başlığa eklenmesi **PROPOSED** bir görünürlük yardımcısıdır; Scene'in rotation'dan ayrı bir dosya/document olduğu anlamına gelmez.

Tab davranışları reorder, close, close others, close all, pin/unpin, detach to floating document window ve başka monitöre taşıma işlemlerini içerir. Dirty document için başlıkta nokta/asterisk ve close sırasında kaydetme kararı gösterilir; kullanıcıya görünmeyen otomatik kaydetme ile değişiklik kaybı önlenmez.

## 5. Project Explorer

Project Explorer Altium benzeri hiyerarşik ve kaynak-of-truth navigation yüzeyidir. Varsayılan kökler Workspace, Projects, Theme Project Group, Theme Projects, dört Rotation, Scenes, Widgets, Theme Resources ve `Unsupported Files` olarak görünür. Asset Depot/Asset Browser bu ağaç altında gizli bir kaynak klasörü değildir; ayrı dockable library/depot tool window'dur.[11] [13]

| Düğüm | Gösterilen bilgi | Temel komutlar |
|---|---|---|
| Workspace | Açık workspace ve layout bağlamı | New/Open/Close Workspace, layout seçimi |
| Project | SD-card-level project adı, profile ve dirty/validation durumu | Open, Rename, Close, Project Settings |
| Theme Project Group | Projedeki tema paketi grubu | Add/Remove/Invert theme project, Rename |
| Theme Project | Tema adı, dört form hazır durumu, validation özeti | Open, Duplicate, Rename, Delete, Create Inverted Theme, Export/Publish |
| Rotation | `r0`, `r90`, `r180`, `r270`, çözünürlük ve yön | Open document, Add/Restore Rotation, Rename, Delete |
| Scene | Scene adı, thumbnail opsiyonu, active/priority/validation işareti | New, Duplicate, Rename, Delete, Add/Restore, Test Scene |
| Widget | Kullanıcı görünen ad, widget type, visibility/lock ve validation | Add, Rename, Duplicate, Delete, Enable/Disable, Bring/Send Z-order |
| Resources | Theme-owned supported files ve semantic category | Import, Rename, Replace, Reveal, Remove |
| Unsupported Files | Desteklenmeyen veya henüz profile'a uymayan dosyalar | Inspect, Reveal, Remove; widget/export akışına kapalı |

Project Explorer context menu, yalnız mevcut profile ve domain modelin izin verdiği komutları gösterir. Örneğin Theme Project için `Add Rotation`, `Add Scene`, `Duplicate`, `Rename`, `Delete`, `Create Theme Project as Inverted` komutları sunulabilir. `Custom State`, `Popup Widget`, klasik anchor graph veya profile'da olmayan widget komutları kesinlikle eklenmez.[4] [10]

### 5.1 Drag & drop

Normal drag uyumlu nesneyi taşır; `Ctrl` modifier uyumlu kopyalama anlamına gelir. Scene veya widget başka bir project/rotation/scene'e bırakıldığında hedef DeviceProfile uyumu kontrol edilir. Uyuşmazlık varsa drop sessizce uygulanmaz; kaynak ve hedef capability karşılaştırması ile çözüm diyalogu açılır. Başka Scene'e taşınan widget varsayılan olarak o Scene'e ait scene-specific instance olur; diğer sahnelere geometri/özellik yaymak ayrıca `Apply to Other Scenes` komutuyla seçilir.[11]

Windows Explorer'dan gelen dosyalar yalnızca uygun Project Explorer/Theme Resources hedeflerine bırakılır. Dış dosyanın canvas üzerine sürüklenmesi widget oluşturmaz. Supported dosya uygun Resources kategorisine, unsupported dosya yalnız `Unsupported Files` alanına alınır; `Unassigned` veya `Unsigned` gibi ek bucket oluşturulmaz.[11] [14]

## 6. Properties Panel

Properties paneli Altium tarzı contextual inspector'dır. Seçim olmadığında document/form özelliklerini, bir Scene seçildiğinde Scene Properties'i, bir widget seçildiğinde widgetın gerçekten desteklediği alanları, Bounding Group seçildiğinde grup layout alanlarını gösterir. Profile'da desteklenmeyen alanlar boş bir control olarak değil, UI'dan çıkarılır veya açıkça `Not supported by active profile` olarak gösterilir.

### 6.1 Kategori yapısı

| Kategori | İçerik | Görünme kuralı |
|---|---|---|
| Identity | Görünen ad, stable ID'yi salt okunur teknik bilgi olarak gösterme, type | Her seçilebilir domain nesnesinde uygun olan kadar |
| Transform | X, Y, Width, Height, rotation; oran kilidi | Widget/Bounding Group; locked geometry'de disabled |
| Appearance / Style | Style mode, default/custom style, color yalnız destekleniyorsa, opacity | Profile ve widget type'a göre |
| Binding / Runtime | State/condition, positive/negative action, priority, active context | Binding-capable widget veya Scene |
| Content / Media | Image/video/audio, source, fit/crop, duration, loop/repeat | Media içerik kullanan nesnelerde |
| Typography | Firmware font reference, size, weight, italic, alignment, localization | Text widget; Digit/Floor'da font gösterilmez |
| Audio | Volume/default, audio file, repeat, ducking/override policy | Media/Theme Audio bağlamında |
| Layer | Visibility, lock, Z-order; runtime priority'den ayrı | Widget/Scene content |
| Layout | Bounding Group, reference, alignment, spacing, fixed/dynamic mode | Group veya profile destekli dynamic layout |
| Advanced | Stable metadata, unresolved references, profile version, teknik açıklamalar | Varsayılan kapalı progressive disclosure |

`Transform`, `Appearance`, `Binding`, `Media`, `Audio`, `Layout` ve `Advanced` kategorilerinin her biri yalnız bağlam anlamlıysa görünür. Her property değişikliği bir command üretir; dirty state, Undo/Redo, validation ve Console güncellemesi aynı command sonucundan beslenir.

### 6.2 Tekli ve çoklu seçim

Tek widget seçildiğinde tüm desteklenen özellikler görünür. Birden fazla widget seçildiğinde yalnız ortak düzenlenebilir parametreler listelenir. Aynı değere sahip alan normal değeri gösterir; değerler farklıysa `*` gösterir. Kullanıcı `*` alanına değer girdiğinde komut seçili tüm nesnelere uygulanır. Uygulanamayan veya profile'lar arasında ortak olmayan alanlar gizlenir ve gizlenme nedeni gerektiğinde tooltip'te açıklanır.

Locked widget seçilebilir, layer/identity/binding gibi izin verilen parametreleri değiştirmeye devam eder; position/size/rotation gibi geometry alanları disabled olur. Visible kapatılan widget canvas'ta render edilmez ama Project Explorer, Layers veya doğrudan seçim komutu ile seçilebilir ve selection bounds görünür.

### 6.3 Scene ve form Properties

Scene Properties en az Name, Priority 0–10, Activation/Condition, Rotation ve Enabled alanlarını taşır. Scene priority ile widget Z-order aynı kategori veya tek bir `Priority` alanı gibi sunulmaz. Form/document Properties; display resolution, orientation, Design/Preview mode, grid/snap ve form-level metadata'yı kapsar. Settings içindeki program tercihleri bu panelle karıştırılmaz.

## 7. Canvas UX

Canvas, uygulamanın merkezi değil **uygulamanın domain modelini görsel olarak düzenleyen bir editor surface**'idir. Seçilen rotation'ın gerçek display aspect ratio'su korunur. Resize sırasında cihaz içeriği stretched edilmez; viewport yeniden hesaplanır, zoom/pan ilişkisi korunur ve gerekirse letterbox kullanılır. Canvas arka planı açık nötr, cihaz/display yüzeyi koyu ve preview odaklıdır.[1] [5]

### 7.1 Canvas durumları

Design Mode'da kullanıcı Project Explorer'dan seçtiği Scene'i beklenmedik runtime state değişimi olmadan düzenler. Preview Mode'da state/context değerlendirilir ve active Scene görünür. Örneğin Explorer'da Up Scene seçili olsa bile Preview Mode'da Fire state'i active ise Fire Scene render edilir; kullanıcı Design Mode'a dönünce seçtiği Scene'i düzenlemeye devam eder.[12]

Canvas toolbar'da seçim aracı, Add, zoom, fit, center, grid, snap, rulers/guides, Design/Preview ve Focus Canvas bulunabilir. Bu kontroller ana görünümü boğmaz; nadir kullanılan seçenekler View menüsü veya Command Palette'te de bulunur.

### 7.2 Temel interactions

| Interaction | Beklenen davranış | Kullanıcı hissi | Durum |
|---|---|---|---|
| Select | Tıklanan visible widget seçilir; selection bounds ve inspector anında güncellenir | Hızlı ve geri bildirimli | **CONFIRMED / PROPOSED** |
| Multi-select | Ctrl/Shift ile ekleme/çıkarma; marquee selection profile/editor kuralına göre | CAD/IDE'de tanıdık | **PROPOSED** |
| Drag/move | Seçim bounds taşınır; snap aktifse grid/guides ile manyetik hizalanır | Yumuşak ama hassas | **CONFIRMED** |
| Resize | Uygun tutamaçlar görünür; oran kilidi açık/kapalı açıkça bellidir | Kontrollü, içerik bozulmaz | **CONFIRMED** |
| Rotate | Rotation handle 5° snap ile çalışır; 45°/90° kılavuz göstergeleri görünür | Hassas ama yön duygusu güçlü | **CONFIRMED** |
| Duplicate | `Ctrl+D` veya toolbar ile yeni kopya; ikinci canvas tıklaması grubun merkezini o noktaya yerleştirir; tekrar tıklamalar ardışık duplicate üretir | Seri yerleştirme hızlıdır | **CONFIRMED / PROPOSED** |
| Cancel duplicate | `Esc` duplicate/tool modunu bitirir ve son seçimi korur | Kullanıcı modda sıkışmaz | **CONFIRMED** |
| Copy/paste | Canonical command; hedef Scene/Profile uyumu doğrulanır | Dosya yöneticisi gibi öngörülebilir | **PROPOSED** |
| Delete | Delete ile seçili nesne silinir; referanslı asset/domain nesnesinde dependency confirmation gerekir | Geri alınabilir ve güvenli | **PROPOSED** |
| Snap grid | Grid görünürlüğü ve snap ayrı toggle; precision değeri Settings/Context'ten gelir | Görsel düzen temiz kalır | **CONFIRMED / PROPOSED** |
| Zoom/pan | Wheel/Ctrl+wheel veya profile'dan bağımsız conventional input; Space/pan davranışı final shortcut registry'ye bırakılır | Viewport, içerikten kopmaz | **PROPOSED / UNDECIDED** |
| Fit/center | Fit Canvas ve Focus Canvas device preview'yi görünür çalışma alanına göre ortalar | Tek komutla kayıp içerik bulunur | **PROPOSED** |
| Alignment | Left/center/right, top/middle/bottom ve distribute seçime göre etkinleşir | Alt toolbar'da erişilebilir | **PROPOSED** |
| Z-order | Bring Front/Forward, Send Backward/Back; numeric Z gerekiyorsa profile/domain ile gösterilir | Scene içi çizim sırası net | **CONFIRMED** |
| Lock/visibility | Lock geometry'yi sınırlar; visibility render'ı gizler, selection/debug görünürlüğünü korur | Görsel ve düzenleme durumu ayrıdır | **CONFIRMED** |
| Bounding Group | Arrow + Digit gibi ilişkili nesneler tek geometry/layout ilişkisi içinde düzenlenir | Grup hizalaması anlaşılır | **CONFIRMED** |

### 7.3 Döndürme ve yön hareketi

Seçili nesne veya grup sürüklenirken `R` 90° döndürme komutudur. Serbest rotation, 5° snap ile çalışır; imleç/rotation handle yanında 45° ve 90° görsel tick/guideline belirir. Bu iki davranışın birbirine karışmaması için `R` basıldığında kısa status mesajı (`Rotate 90°`) ve canvas üzerinde geçici rotation marker gösterilir.[11]

Arrow tuşları seçimi yönünde hareket ettirir. `Ctrl+Arrow` grid-step hareketini, `Ctrl+Shift+Arrow` ise 5× grid-step hareketini temsil eder; grid kapalı olsa bile step değeri Context/Editor ayarından okunur. Bu kararlar mevcut shortcut kaydında explicit olarak belirtilmiştir.[11]

### 7.4 Bounding Group

Bounding Group widget değildir; optional layout/composition nesnesidir. Reference point/center, horizontal/vertical alignment, spacing ve `Fixed Slots` veya `Dynamic Active Items` layout mode'u Properties'te anlaşılır adlarla gösterilir. `Arrow + Digit Group` örneğinde iki digit ile yön oku, runtime floor değeri değişse bile ortak group center etrafında hizalanır.

Görsel referanslarda bulunan klasik 3×3 anchor matrix, current canonical contract'ta kaldırılmış klasik `anchor → target widget` mimarisini yeniden getirmez. Bu görsel kontrol, nihai UI'da ancak Bounding Group'un reference/alignment ayarının bir sunumu olarak yeniden yorumlanabilir; bağımsız widget-to-widget anchor graph oluşturamaz.[4] [10] [15]

Dynamic Runtime Layout'ın exact matematiği henüz kararlaştırılmamıştır. UI, `Dynamic Active Items`, spacing ve preview sonucu için yer ayırabilir; algoritmayı kesinleşmiş bir firmware davranışı gibi belgeleyemez.[4]

## 8. Selection UX

Single selection'da cyan/teal outline, resize handles, rotation handle ve Properties başlığı aynı nesne adını kullanır. Multi-selection'da ortak bounding box ve common properties görünür; farklı değerler `*` ile belirtilir. Group selection, editörün geçici veya düzenleme amaçlı çoklu seçimidir; Bounding Group ise domain layout ilişkisidir. Toolbar veya tooltip bu iki kavramı aynı kelimeyle çağırmaz.

Locked selection'da bounds/selection görünür, fakat geometry handles ve geometry input disabled olur. Invisible selection'da widget canvas'ta çizilmez; Explorer/Layers ve selection bounds üzerinden seçilebilir. Böylece kullanıcı görünmeyen bir nesnenin neden validation veya export etkisi oluşturduğunu bulabilir.

`Hide All` bütün görünür widgetların render visibility'sini kapatır; lock, selection ve canonical state değişmez. `Show All` görünürlükleri açar, fakat başlangıçta zaten gizli olan nesnelerin user intent'i korunmalıdır. Bu nedenle uygulama `Hide All` işlemini tek bir undoable command olarak kaydeder ve önceki visibility snapshot'ını geri alabilir.

## 9. Simulator UX

Simulator dockable bir tool window'dur ve Preview/Export ile aynı canonical project modelini, Binding Engine'i, layout ve renderer mantığını kullanır. İkinci bir basitleştirilmiş rule system oluşturulmaz. Simulator gerçek firmware değildir; Designer davranışını cihaz olmadan gözlemlemek için kontrollü test tezgâhıdır.[3] [4]

### 9.1 Yerleşim

Önerilen Simulation workspace üç bölümlüdür: solda Runtime Inputs/Scenario, ortada gerçek device preview, sağda Runtime State/Active Scene/Binding Inspector. Console alt dock'ta kalabilir. Properties ve Runtime State tabbed olduğunda kullanıcı panel başlığından hangi bağlamı düzenlediğini açıkça görür.

| Alan | İçerik | Kural |
|---|---|---|
| Runtime State | Floor, direction, door, fire, overload, service out, E-Stop ve profile'ın ilan ettiği diğer state'ler | Liste DeviceProfile registry'den dinamik gelir; Custom State düğmesi yoktur |
| Runtime Settings | Language, active theme, style, voice/audio volume gibi profile-defined settings | State ile setting ayrı başlıkta ve ayrı editörle gösterilir |
| Active Scene | Scene adı, priority, activation condition ve neden kazandığı | Design Mode'daki edit Scene ile karıştırılmaz |
| Active Bindings | TRUE/FALSE sonucu, action, hedef widget ve kaynak condition | `Floor == 6 → TRUE`, `Media → PLAY` gibi okunabilir trace |
| Media/Audio | Oynayan media, duration/loop/repeat, audio channel ve template policy | Firmware audio arbitration uydurulmaz; desteklenmeyen mix açıklanır |
| Transport | Run, Pause, Step, Reset, Test Scene/Test Binding, Save Scenario | Sadece simulator state değiştirir; project domain'ini sessizce değiştirmez |

Floor değerleri yalnız decimal değildir; profile registry'nin sağladığı `K`, `P`, `R`, `Z`, `F`, `-2`, `-1`, `0` ve benzeri değerler kontrol tipine göre gösterilir. Direction `none/up/down`, door profile'daki enum, fire/overload/service boolean veya profile-defined tip olarak gelir.[10] [16]

## 10. Console

Console alt tarafta dockable `Console/Output` tool window'udur. Aynı panel içinde Commands, Operations, Validation, Export, Deployment, Simulator Events ve Errors/Warnings görünümleri tabbed veya severity-filtered sunulabilir. Bu, yeni bir domain sistemi değil, application command ve logging çıktılarının görünür yüzeyidir.

Bir işlem kullanıcıya kısa ve anlaşılır status ile, teknik ayrıntıya ihtiyaç duyulduğunda Console event'i ile raporlanır. Örneğin `No removable SD card was detected. Insert the SD card and try again.` kullanıcı mesajıdır; adapter exception, path ve checksum ayrıntıları Console'da kalır. Validation satırı problem, kaynak konum, neden ve çözüm eylemi taşımalıdır.[2]

| Console seviyesi | Örnek | Görsel davranış |
|---|---|---|
| INFO | `Template validated`, `Package created` | Soluk/neutral ikon ve zaman |
| WARN | `Concurrent video decode limit exceeded` | Amber ikon, filtrelenebilir; export kuralına göre devam edilebilir |
| ERROR | `Missing fire_warning asset` | Kırmızı ikon, ilgili document/asset'e navigation linki |
| COMMAND | `> validate()` | Monospace veya teknik text style; kullanıcı command history'si |
| EVENT | `[Binding] Floor == 6 → TRUE` | Source ve target ile trace satırı |

AI veya dış command istemcisi uygulamayı kullandığında Console, yapılan işlemi kullanıcıya canlı gösterir. AI uygulamaya gömülü runtime feature değildir; Console yalnız command görünürlüğünü sağlar.[4]

## 11. Asset Browser ve Resources

Asset Browser, Altium kütüphanesine benzer **Asset Depot** içeriğini gösteren dockable tool window'dur. Theme Resources ise belirli Theme Project'in sahip olduğu/kullandığı dosyalardır. Asset Browser bir Scene, Widget veya export manifesti değildir; depoda bulunan her asset otomatik olarak deployment package'a girmez.[11] [14]

### 11.1 Asset Browser yüzeyi

Üstte depot/source selector, search ve filter; solda Images, Videos, Audio, Fonts (profile uygunsa), Digit Styles, Direction Styles, Warning Signs ve profile-defined semantic categories; merkezde list/grid/thumbnail görünümü; sağda preview ve metadata kullanılır. Kullanılan asset üzerinde unobtrusive check/badge, `Used By` ve default/profile asset üzerinde ayrı rozet bulunur.

| Asset türü | Önizleme | Ek davranış |
|---|---|---|
| Image | Doğrudan image preview | Fit/actual size, resolution ve format metadata |
| Video | İlk/temsilî frame thumbnail; Play/Pause; seek | Otomatik loop yok; duration, resolution ve format gösterilir |
| Audio | Play/Pause; seek; duration; volume uygun olduğu kadar | Preview playback, template playback policy'den bağımsızdır |
| Unsupported File | Normal preview akışına alınmaz | `Unsupported Files` altında teknik görünürlük; widget/export seçiminde yok |

Asset seçildiğinde Name, stable ID, File, Type, Format, Size, Duration, Resolution ve Color Format gibi temel metadata compact biçimde gösterilir; Advanced panelde kaynak ve dependency ayrıntısı bulunur. Display name veya filename değişse bile stable ID değişmez. Referanslı asset silinmek istenirse `Used By` listesi ve dependency-aware confirmation gösterilir.[11] [14]

### 11.2 Resources, import ve export

Dış dosya uygun Project Explorer resource hedeflerine bırakıldığında DeviceProfile destekliyorsa Theme Resources altında ilgili kategoriye, desteklemiyorsa Unsupported Files'a gider. Canvas'a dosya bırakmak yoktur. `Unsupported Files` normal Asset Browser akışına, widget seçimine veya normal export'a dahil edilmez.

Export yalnızca kullanılan/referenced assetleri, export kurallarına dahil edilmiş Theme Resources'u ve gerekli DeviceProfile/default assetleri alır. Asset Depot'un bütün içeriği veya editable project klasörü SD karta körlemesine kopyalanmaz; önce deployment package oluşturulur.[2] [4]

## 12. Media Slide UI

Media Slide ayrı bir `Popup` widget değildir. Kata özel üst içerik, `Media Slide + floor/state condition + visual Z-order` olarak oluşturulur. Media Slide seçildiğinde Properties bağlamı aşağıdaki sırayla düzenlenir:

```text
Media Slide
├── Condition / Binding
├── Media: image | video
├── Fit / Crop / displayed size
├── Duration
├── Loop / Repeat / Repeat Count
├── Audio / External Audio
├── Audio Repeat Count / Volume
├── Media Continuity: Continue/Retain Playback (profile destekliyorsa)
└── Layer / Z-order
```

Duration UI'sı 0.1 saniye hassasiyeti kullanır. Media Slide default duration `3.0 s`, Media Slide dışındaki normal media için uygulanabilir default `0` (indefinite) olur. `Loop` sonsuz tekrar, `Repeat` sonlu tekrar ve `Repeat Count` sayıyı ifade eder; birbirlerine tek bir belirsiz `repeat` toggle'ı ile indirgenmez.[4] [14]

Bir Scene değiştiğinde yeni medyanın size/playback parametreleri uyumsuzsa eski medya kesilir; uyumluysa ve kullanıcı `Continue/Retain Playback` seçmişse playback position/audio sürdürülebilir. Yeni Scene'in geometry'si kullanılır. Bu seçenek bir garanti değil, profile/domain destekliyorsa açıkça gösterilen bir runtime davranışıdır.[3] [14]

### 12.1 Sequence ve timing UI

İlk UI iterasyonunda tam bir global timeline editor yerine Media Slide için contextual timing controls kullanılır. Profile `Media Sequence` destekliyorsa, Media/Sequence panelinde sıralı içeriklerin compact strip'i bulunur: sıra numarası, thumbnail, media type, duration, audio durumu ve drag reorder. Bir öğe seçildiğinde duration/loop/repeat alt inspector'da açılır. Bu strip Scene'in active olmasını değiştirmez.

Tam timeline, keyframe veya scene transition editor'ü **UNDECIDED/FUTURE** kapsamındadır. DeviceProfile/runtime contract geçiş davranışını açıkça desteklemeden fade/slide gibi transition seçenekleri gösterilmez.[12]

### 12.2 Audio UX

Theme-level background music, Scene-specific media gibi görünmez; Theme Audio Settings veya canvas boşken uygun context Properties alanından yönetilir. Audio yüzeyi Background Music, Announcement/Voice ve Media Audio kanallarını, volume değerlerini, mute, priority 0–100, ducking/override ve gerektiğinde loop/repeat seçeneklerini ayrı satırlarda gösterir.

Kullanıcı `Background Music + Announcement + Media` kombinasyonunu bir channel stack/preview olarak görebilir. Örneğin announcement geldiğinde music'in template default seviyesine düştüğü veya fire durumunda mute edildiği politika satırında görünür. Ancak gerçek firmware audio arbitration, kesin mix/ducking ve cihazın runtime override önceliği Designer tarafından icat edilmez; desteklenmeyen alanlar profile sözleşmesine bırakılır.[4] [14] [16]

## 13. Digit / Floor UI

Digit/Floor widget, runtime'dan gelen floor değerini gösterir; Designer floor değerini hesaplamaz veya yeniden yorumlamaz. Digit widget için application veya firmware font picker kullanılmaz. Görsel sonuç default Digit Style veya custom style/media asset üzerinden seçilir. Default style listesi DeviceProfile tarafından sağlanır; custom style'da yüklenen içeriğe Designer color picker uygulanmaz.[10] [16]

### 13.1 Floor Mapping Editor

Floor Mapping, generic text binding içine saklanmaz; ayrı bir editor/tool olarak sunulur. Tablo satırları profile'ın verdiği firmware value'yu ve Designer'ın export edilebilir display representation'ını yan yana gösterir.

| Firmware value | Display value örneği | UI kuralı |
|---|---|---|
| `-2` | `P2` | Mapping açıkça kullanıcı tarafından girilir; örnek default karar değildir |
| `-1` | `P1` | Profile destekliyorsa gösterilir |
| `0` | `G` | Display representation profile/project kuralıdır |
| `1`, `2` | `1`, `2` | Decimal floor değerleri doğrudan gösterilebilir |
| `K`, `P`, `R`, `Z`, `F` | Aynı sembol veya profile değeri | Sembolik değerler numeric-only control'a zorlanmaz |

Exact desteklenen değerler DeviceProfile'dan gelir. Bilinmeyen veya kaldırılmış değer validation'da unresolved olarak kalır; sessizce silinmez.[10] [16]

### 13.2 İki digit ve ok hizalaması

İki digit, yön oku ve varsa label bağımsız widget'lar olarak eklenir; ortak görsel ilişki için Bounding Group kullanılır. Group, ortak reference/center, horizontal/vertical alignment ve spacing taşır. `Fixed Slots`, slot sayısını koruyan sunumlar içindir; `Dynamic Active Items`, runtime'da aktif item sayısı değiştiğinde group merkezini hesaplamak için kullanılır.

`7`, `16`, `-1`, `R` gibi değerlerde digit content bounds değişebilir. UI Preview sonucu aynı canonical Dynamic Runtime Layout/renderer ile gösterebilir; exact alignment matematiği kesinleşmediği sürece form alanı `Profile-defined` veya `Not finalized` olarak işaretlenir. Klasik widget-to-widget anchor graph oluşturulmaz.[4] [10]

## 14. Direction Widget

Direction widget runtime `up`, `down` veya `none/hidden` değerine bağlanır. Style Mode iki ana dala ayrılır: **Default** ve **Custom**. Default dalında profile'ın sağladığı shape katalogu ve color palette gösterilir; örneğin 10 stil mevcutsa UI bunu sabit kodlanmış 10 seçenek değil profile sonucu olarak listeler.

Default Up stili seçildiğinde program Down için aynı style ailesinin varsayılan varyantını başlatır. Down alanı bağımsızdır ve kullanıcı daha sonra farklılaştırabilir. Custom dalında Up ve Down dosyaları ayrı seçilir; Custom Up seçildiğinde Down dosyası sessizce kopyalanmaz ve ayrıca seçilmesi gerekir. Custom image/video assetin kendi görünümü korunur, renk picker gösterilmez.[10] [16]

Properties preview'si Up Variant ve Down Variant'ı yan yana gösterir. Eksik Down custom asset'i `Missing required variant` validation durumuyla işaretlenir; default style'da otomatik üretilmiş Down varyantı ise `Derived default; editable` açıklaması taşır.

## 15. Warning UI

Warning, ayrı bir sınırsız widget generator değil, DeviceProfile/firmware runtime state ve content binding sisteminin bir parçasıdır. Mevcut elevator kapsamındaki bilinen durumlar `fire`, `overload` ve `service_out`/`service` ailesidir; profile gerçek firmware terminology'si olarak `warning1`, `warning2`, `warning3` sağlıyorsa bunlar kullanıcıya profile display name'iyle gösterilebilir. Designer yeni warning/state icat etmez.[4] [16]

Warning scene veya condition priority'si 0–10 aralığında gösterilir. Bu değer **presentation/runtime priority**'dir; warning visual assetinin Z-order'ı ayrı Layer alanında yönetilir. Fire/Overload/Service Out için UI; condition, priority, content/media binding, active Scene ve validation sonucunu aynı model üzerinden gösterebilir. Tek bir generic `warning.png` alanı bütün alarm tiplerini temsil etmez.

Warning listesinde her satır severity text/icon, state ID, active/disabled, assigned content, priority ve validation badge taşır. Equal-priority conflict, eksik asset veya profile uyumsuzluğu varsa kullanıcıya `problem + reason + location + action` biçiminde açıklanır; exact tie-break kesinleşmemişse Warning çözümünü uydurmaz.

## 16. Binding Editor

Binding Editor Media'ya özel değildir. Media, Digit/Floor, Direction, Text, Warning ve uygun diğer widgetlar aynı DeviceProfile-driven condition engine ile bağlanır. Scene condition Scene'in active olup olmayacağını belirler; widget binding ise Scene active olduktan sonra widgetın gösterilmesi, gizlenmesi, oynatılması, durdurulması veya uygun içerik/style seçimini belirler.[4] [17]

### 16.1 Normal görünüm

Kullanıcı common case için raw JSON veya expression yazmaz. Editor, her koşulu satır halinde gösterir:

```text
Show / Activate when
[ Floor ] [ equals ] [ 6 ]
[ AND   ]
[ Door  ] [ equals ] [ Opening ]

Action
[ Show / Play / Select / Continue ]
Priority [ 0–10 ]
```

Negative binding için `Hide/Stop when` seçilebilir. Boolean state Active/Inactive, enum state profile seçenekleri, number state numeric input, string/symbol state text/symbol input kullanır. Unknown state, invalid operator veya invalid value satırı silinmez; `Unresolved` olarak kalır ve validation'a bağlanır.[12] [17]

### 16.2 Gelişmiş görünüm

`AND`, `OR`, `NOT`, condition grouping, action ve priority ayrı satırlarda görünür. Expression preview, seçilen runtime context'te TRUE/FALSE sonucu ve hedef widgetın beklenen action'ı gösterilir. Örnek trace:

```text
Floor == 6        TRUE
Door == Opening   TRUE
Binding           TRUE
Media Slide       PLAY
```

Scene condition için ayrıca Active Scene Preview bulunur. Aynı priority'deki sahneler için Project Explorer Scene order görünür fakat bu, nihai tie-break algoritması kesinleşmiş anlamına gelmez; ambiguity warning'i gösterilir.[12]

### 16.3 Floor Mapping ve parametric sınır

Floor Mapping Editor, binding editor içinden açılabilir fakat mapping'i generic `Text = ...` ifadesine dönüştürmez. Gelecekte `{FloorNumber}` gibi parametrik text substitution desteklenebilir; `{residents}` gibi CSV/external-data parametreleri yalnız extensibility boundary olarak belgelenir. İlk sürümde desteklenmeyen parametre bir text field içinde kabul edilip çalışıyormuş gibi gösterilmez; `Future parameter source` olarak işaretlenir.[17]

## 17. Settings

Program Settings/Preferences, dockable panel veya in-canvas navigator değildir. Üstte açılan modal CAD/IDE-style Preferences penceresidir; açık olduğu sürece ana uygulama ile etkileşim kurulamaz. Kullanıcı açıkça `Cancel` ile değişiklikleri atıp kapanır veya `Save & Close` ile kaydeder ve kapanır. Ana canvas'a tıklamak arka planı aktive etmez.[18]

Önerilen kategori navigasyonu `General`, `Appearance`, `Editor`, `Canvas`, `Assets`, `Simulator`, `Validation`, `Export` ve `Shortcuts` başlıklarını içerir. Project Settings, Theme Settings, Scene/Widget Properties ve firmware runtime settings bu modalın içine taşınmaz. Settings araması eklenebilir; outer window modal kalır.

| Settings scope | Nerede düzenlenir | Örnek |
|---|---|---|
| Program Settings | Modal Preferences | UI language, appearance, editor defaults, canvas grid, asset browser, simulator defaults, validation/export/shortcut tercihleri |
| Project Settings | Project context/Properties | DeviceProfile, project overrides, simulation profile, export behavior |
| Theme Defaults | Theme/Audio/Properties | Digit/Direction default style, color, background, background music defaults |
| Runtime Setting | Profile-driven Simulator/Binding context | Language, active theme, voice pack, firmware audio/style settingleri |

## 18. Command Palette

`Ctrl+Shift+P` ile açılan Command Palette **PROPOSED** bir application-shell komut yüzeyidir. Komutlar domain state'i doğrudan değiştirmez; mevcut command registry/use case'lerini arar ve aynı command execution/logging/undo kurallarını kullanır. Arama sonucu command adı, category, shortcut, enabled/disabled durumu ve disabled reason gösterir.

İlk komut grupları şunları kapsar: Create Project, Create Theme, Add Scene, Add Widget, Duplicate, Validate, Export/Build Package, Open Simulator, Open Properties, Reset Layout, Save, Toggle Design/Preview Mode ve Focus Canvas. Komut uygulanırken Console event'i oluşur. Search Everywhere'e genişleme **PROPOSED/FUTURE**; dosya veya domain aramasının kapsamı kesinleşmeden ürün özelliği gibi sunulmaz.

## 19. Keyboard / Mouse Interaction Table

Aşağıdaki tabloda kesinlik özellikle ayrılmıştır. `CONFIRMED` satırları mevcut UI karar kaydında explicit olarak korunur; `PROPOSED` satırları yaygın desktop davranışıdır fakat shortcut registry ile conflict kontrolü gerektirir; `UNDECIDED` davranışlar Settings'te kullanıcıya gösterilmez.

| Girdi | Komut/beklenen davranış | Durum |
|---|---|---|
| `Ctrl+Z` | Undo | **PROPOSED** |
| `Ctrl+Y` | Redo; platform konvansiyonu olarak değerlendirilebilir | **PROPOSED / UNDECIDED** |
| `Ctrl+Shift+Z` | Redo alternatif kısayolu | **PROPOSED** |
| `Ctrl+C` / `Ctrl+V` | Copy / Paste | **PROPOSED** |
| `Ctrl+D` | Duplicate | **PROPOSED** |
| `Delete` / `Backspace` | Delete selected object; dependency confirmation gereken domain silmelerinde diyalog | **PROPOSED** |
| `Esc` | Current tool/duplicate/rotation iptali, gerektiğinde selection clear | **CONFIRMED / PROPOSED** |
| `R` | Transform sırasında 90° rotation | **CONFIRMED** |
| `Arrow` | Seçimi hareket ettirme | **CONFIRMED** |
| `Ctrl+Arrow` | Grid-step hareket | **CONFIRMED** |
| `Ctrl+Shift+Arrow` | 5× grid-step hareket | **CONFIRMED** |
| `Ctrl+S` | Save | **PROPOSED** |
| `Ctrl+N` / `Ctrl+O` | New Project / Open | **PROPOSED** |
| `Ctrl+Shift+P` | Command Palette | **PROPOSED** |
| Mouse click | Select/focus; empty canvas click selection clear veya document context | **PROPOSED** |
| Shift/Ctrl + click | Multi-select toggle | **PROPOSED** |
| Marquee drag | Çoklu selection; locked/invisible inclusion rules final editor kararına bağlı | **UNDECIDED** |
| Wheel/pinch | Zoom; canvas pan modifier final registry ile belirlenir | **PROPOSED / UNDECIDED** |
| Drag handle | Resize/move/rotate; snap ve guide feedback | **CONFIRMED** |
| Context menu | Seçim, Explorer ve panel bağlamına göre command listesi | **CONFIRMED / PROPOSED** |

Shortcut registry tek kaynaktır ve conflict tespit eder. Kullanıcı shortcut değiştirebiliyorsa platform kritik komutları için conflict warning verir; kesinleşmemiş kısayol listeleri implementasyon kararına dönüştürülmez.[11]

## 20. Visual Design System

### 20.1 Semantic tokens

Kodlama aşamasında renk ve ölçü değerleri dağınık kullanılmamalı; semantic token katmanı kullanılmalıdır. Aşağıdaki isimler **PROPOSED** token sözleşmesidir; exact hex değerleri referans görsellerden ve Windows contrast testlerinden sonra kalibre edilir.

| Token grubu | Token örnekleri | Kullanım |
|---|---|---|
| Surfaces | `app-bg`, `panel-bg`, `canvas-bg`, `surface`, `surface-elevated` | Açık nötr shell, panel ve canvas ayrımı |
| Borders | `border-subtle`, `border-strong`, `splitter` | İnce ayraçlar ve dock splitter'ları |
| Text | `text-primary`, `text-secondary`, `text-muted`, `text-on-dark-preview` | Hiyerarşik okunabilirlik |
| Accent | `accent`, `accent-hover`, `accent-muted`, `selection` | Teal/cyan action, focus ve selection |
| Status | `success`, `warning`, `error`, `info` | Hazır, dikkat, bloklayıcı ve bilgi durumları |
| Canvas | `device-frame`, `device-surface`, `grid-major`, `grid-minor`, `guide` | Cihaz preview'si ve yardımcı geometry |
| Focus | `focus-ring`, `keyboard-focus` | Pointer ve keyboard odağını ayırmak |
| Elevation | `shadow-panel`, `shadow-floating`, `shadow-dialog` | Yalnız gruplayan hafif elevation |

### 20.2 Typography ve spacing

Application UI için Windows'ta okunabilir sistem UI fontu tercih edilir; target firmware fontu application chrome veya Properties metni için kullanılmaz. Numeric glyph'lerde `1/I/l` ve `0/O` ayrımı, kısa label'larda taranabilirlik ve başlık/section/value hiyerarşisi önceliklidir. Digit/Floor widget için font seçilmemesi bu application UI font kuralıyla çelişmez.[1] [10]

4/8 tabanlı spacing rhythm, 28–36 px arası common control height, 1 px border, kısa label ve sıkı property grouping varsayılan yoğunluktur. Panel header, tab ve toolbar kontrolleri aynı vertical rhythm'i kullanır. Büyük hero alanları, aşırı boşluk, aşırı yuvarlak card'lar ve glassmorphism kullanılmaz. Border radius düşük tutulur; yalnız modal, floating panel veya durum badge'lerinde sınırlı yarıçap kullanılır.

### 20.3 States ve motion

Selected navigation, selected document tab, selected Project Explorer row ve selected canvas object birbirinden ayırt edilebilir fakat aynı accent ailesinde tutulur. Hover yalnız etkileşilebilir alanın yüzeyini hafifçe değiştirir; disabled state düşük kontrast + açıklama/tooltip ile belirtilir. Warning/error durumları color + icon + text ile birlikte gösterilir.

Motion işlevseldir: panel open/close, selection feedback, progress ve transient status için kısa geçişler kullanılabilir. Dekoratif floating effect, sürekli pulse veya canvas'ı hareket ettiren animasyonlar kullanılmaz. Media preview playback'i gerçek media kontrolüdür; UI decoration değildir.

### 20.4 Canvas, rulers ve grid

Canvas background ile cihaz/display surface arasında net ton farkı vardır. Grid snap'ten bağımsız görünürlük toggle'ına sahiptir; major/minor çizgiler düşük opacity kullanır ve koyu device preview'nin önüne geçmez. Rulers/guides isteğe bağlıdır, sürekli kullanılabilir alan tüketmez. Rotation, 45° ve 90° guide'ları yalnız aktif transform sırasında görünür.

### 20.5 Empty states

Empty state büyük marketing metni değil, sonraki anlamlı komutu gösteren kompakt bir çalışma durumu olmalıdır. Örneğin selection yokken Properties `Select an item to edit its properties`; boş Scene'de `Add Widget`; boş Asset Browser'da `Choose a depot or import into Theme Resources`; boş Console'da `No messages yet` gösterir. Her state, mümkünse tek primary action ve ilgili command bağlantısı taşır.

## 21. Responsive / Resize Behavior

Bu ürün mobile responsive web sayfası değildir; gerçekçi Windows masaüstü boyutlarında resize davranışı hedeflenir. Panel genişlikleri splitter ile değişir, document canvas merkezi önceliğini korur ve secondary tool window'lar collapse/auto-hide/tab olabilir. Properties minimum usable width'in altına zorla sıkıştırılmaz; panel kapanır veya auto-hide önerilir.

| Resize durumu | Beklenen sonuç |
|---|---|
| Ana pencere genişler | Canvas esnek büyür; device aspect ratio ve center korunur; panel oranları gereksiz genişlemez |
| Ana pencere daralır | Secondary label'lar kısalır, paneller collapse/tab olur; Properties usable width'i korunur |
| Sağ panel genişliği değişir | Inspector satırları yeni width'e göre yeniden akar; canvas viewport ve zoom recalculated olur |
| Sol Explorer daralır | Hiyerarşi vertical scroll/ellipsis kullanır; central preview minimum görünürlüğünü kaybetmez |
| Console açılır/kapanır | Canvas kalan yüksekliğe göre yeniden hesaplanır; scrollback kaybolmaz |
| Floating panel başka monitöre taşınır | Ana document state ve selection korunur; panel layout/workspace state saklanır |
| Orientation değişir | Cihaz preview'si yeni logical resolution'a fit edilir; geometry stretched edilmez |

Minimum pencere boyutu için exact karar **PROPOSED** olarak implementasyonun ilk visual QA turunda belirlenir; telefon/portrait viewport hedefi yoktur. Resize sırasında scroll position ve zoom ilişkisi kullanıcıyı beklenmedik şekilde başka bir Scene'e taşımaz.

## 22. Accessibility

Klavye odağı bütün Menu Bar, Toolbar, Tabs, Explorer, Canvas actions, Properties fields, dock headers, modal Settings ve Console filtrelerine ulaşabilmelidir. Focus ring selection accent'ten ayrı ve belirgin token kullanır. Icon-only control'ler tooltip ve accessible label olmadan bırakılmaz; Save, Publish, Lock, Visibility, Fit ve panel dock commands hem icon hem anlamlı label/tooltip taşır.

Locked, invisible, selected, warning, error ve active Scene durumları yalnız renk ile anlatılmaz; icon, metin, pattern veya control state eklenir. Numeric Properties alanlarında label, unit ve validation message aynı erişilebilir form ilişkisinde tutulur. Modal Settings açıkken focus modal içinde kalır, Escape davranışı Cancel ile karıştırılmayacak şekilde açıkça tanımlanır ve arka pencere tıklanamaz.

Canvas etkileşimlerinin pointer karşılığı keyboard command ile de ulaşılabilir olmalıdır. Marquee veya hassas drag keyboard ile tam karşılanamıyorsa Properties üzerinden X/Y/Width/Height/Z-order düzenleme her zaman mümkün kalır. Contrast, focus görünürlüğü ve text size gerçek Windows pencere boyutlarında visual QA sırasında doğrulanır.

## 23. Empty / Error / Loading / Validation States

State tasarımı, `güzel görünen boş ekran` yerine kullanıcıyı güvenli bir sonraki adıma götürür. Aşağıdaki tablo bütün ana yüzeyler için minimum sözleşmedir.

| Yüzey | Empty | Loading | Error/Warning | Recovery action |
|---|---|---|---|---|
| Project Explorer | `Create/Open Project` | Project tree loading indicator; canvas kilitlenir | Project okunamadı, path ve teknik detay Console'da | Retry, Open Another, Reveal Log |
| Document Tab/Canvas | `Add or select a Scene/Widget` | Preview/model loading; stale selection temizlenir | Render/geometry validation mesajı | Select issue, Revalidate |
| Properties | `Select an item` | Field skeleton veya `Updating…` | Invalid value, unsupported profile, unresolved binding | Focus field, Reset, Open Profile |
| Asset Browser | Depot seç veya Resources'a import et | Thumbnail/metadata loading | Unsupported, missing file, decode failure | Reveal, Replace, Remove, Inspect |
| Simulator | `Run or choose a scenario` | Evaluating states/bindings | Invalid runtime context veya unsupported capability | Reset, Open Binding, Open Console |
| Console | `No messages yet` | Operation progress | Severity filtreleri; error source linki | Filter, Copy details, Navigate |
| Validation/Publish | `Validate to check readiness` | Rule groups running | Critical error / non-critical warning ayrımı | Navigate, Fix, Re-run |
| Deployment | `Build/select package and target` | Preparing/Writing/Verifying/Safe eject steps | Drive missing, space insufficient, checksum failure | Reinsert, Choose Target, Retry, Safe Abort |
| Settings | Load last saved preferences | Category content loading | Invalid preference or conflict | Reset category, Cancel, Save & Close |

Validation first-class service olarak editor, simulator, save, export ve Console tarafından paylaşılır. Bir hata yalnız `Invalid` demez; **hangi widget/form/condition/asset + sorun + çözüm** bilgisini verir. Critical error export'u bloklar; warning ancak export kuralları izin veriyorsa kullanıcı onayıyla devam eder.[3] [4]

Deployment durumları `Preparing`, `Writing`, `Verifying` ve `Completed/Safe to remove` olarak görünür. Verification tamamlanmadan başarı iddiası gösterilmez. Başarılı durumda kullanıcıya açıkça SD kartı güvenle çıkarabileceği ve hedef cihaza takabileceği söylenir.[2]

## 24. Görsel referanslarla kararların uzlaştırılması

Repository'deki `01_canvas_first_studio.png`, `01_tema_kutuphanesi_detayli.png`, `02_ayrintili_durumlar.png`, `02_tasarim_studyosu_detayli.png`, `03_design_studio.png` ve `tema_katalogu_acik_gri.png` referans olarak incelenmiştir.[7] [8] [19] [20] [21] [22]

Referanslar; koyu sol rail, açık nötr workspace, merkezi fiziksel cihaz preview'si, sağ contextual Properties, alt selection toolbar, dört orientation varyantı, Theme Library kartları, media/test/publish yüzeyleri ve görünür validation/console durumlarını güçlü biçimde destekler. Bu özellikler dokümanın sabit görsel/interaction omurgasına alınmıştır.

İki önemli uzlaştırma kararı vardır. Birincisi, görsellerdeki `Form` ve `Scene` dropdown'ları State/Context Bar ile Project Explorer'ın görevlerini birleştirmez: Explorer hiyerarşiyi, State/Context Bar runtime preview/binding bağlamını yönetir.[11] İkincisi, görsellerde görülen anchor matrix, canonical sözleşmede kaldırılmış klasik anchor graph olarak taşınmaz; yalnız Bounding Group reference/alignment sunumu olarak yeniden yorumlanabilir.[4] [10] Görsel referans ile domain sözleşmesi çelişirse domain sözleşmesi ve açık karar logu, görsel kontrolün birebir kopyalanmasına üstün gelir.

Ayrıca referanslardaki dört orientation kartı ve `4/4 form hazır` durumu, Theme Project'in dört rotation zorunluluğu ile uyumludur. Referans görsellerindeki medya preview, test block ve publish readiness yüzeyleri ise yeni domain nesneleri icat etmeden Media Slide, Simulator, Validation ve Deployment workflow'larının görsel sunumu olarak değerlendirilmiştir.

## 25. Kısa karar raporu

### A) İncelenen referanslar

İncelenen görsel kaynaklar `01_canvas_first_studio.png`, `01_tema_kutuphanesi_detayli.png`, `02_ayrintili_durumlar.png`, `02_tasarim_studyosu_detayli.png`, `03_design_studio.png` ve `tema_katalogu_acik_gri.png` dosyalarıdır. Buna ek olarak `AGENTS.md`, ana proje geliştirme promptu, Application Shell/Domain Editor mimarisi, Domain Model V1, UI/UX Architecture, UI/UX Decisions V1, Template Designer Contract V2, Scene/Settings/Media/Widget/Binding/Runtime State belgeleri incelenmiştir.[1] [2] [3] [4] [11] [12] [14] [17] [18]

### B) Mevcut UI kararlarından korunanlar

Korunan ana kararlar şunlardır: profesyonel Windows CAD/IDE hissi; Theme Library, Design Studio, Test/Simulator, Validation/Publish ve Deployment yüzeyleri; dört bağımsız rotation document'ı; Project Explorer ile Document Tabs ayrımı; dockable/floating/split/tab panel davranışları; merkezî cihaz canvas'ı; sağ contextual Properties; selection/multi-selection/locked/invisible widget davranışları; runtime state ile Scene ayrımı; Scene priority ile Z-order ayrımı; Asset Depot ile Theme Resources ayrımı; `Unsupported Files`; Widget Type ile Media Type ayrımı; Media Slide'ın Popup olmaması; Digit'te font kullanılmaması; Direction Up/Down varyantları; profile-driven state/capability; Simulator'ın gerçek binding/render modelini kullanması; modal Settings; Console, Validation ve güvenli SD-card deployment feedback'i.[2] [3] [4] [11]

### C) Yeni netleştirilen kararlar

Bu çalışma, yeni bir domain özelliği icat etmeden şu UI kararlarını netleştirmiştir: başlangıç shell bölgeleri ve panel sorumlulukları; on dört docking/Workspace senaryosu için visual feedback; rotation tab adlandırması ve Scene context gösterimi; Project Explorer context menu ve drag/drop conflict akışları; Properties kategori ve çoklu değer `*` davranışı; canvas transform/duplicate/rotation/keyboard geri bildirimi; State/Context Bar'ın Explorer'dan ayrımı; Simulator'ın Runtime State/Setting/Active Scene/Binding trace düzeni; Console severity ve command görünürlüğü; Asset Browser preview ve Used By davranışı; Media Slide timing/audio yüzeyi; Floor Mapping ve Arrow + Digit Bounding Group sunumu; Binding Editor'ın positive/negative ve type-aware condition satırları; Settings modal davranışı; Command Palette sınırı; semantic visual token, density, empty/error/loading ve accessibility sözleşmesi.

### D) Hâlâ belirsiz olan kararlar

Açık bırakılan konular kesinleştirilmeden UI tarafından varsayılmayacaktır: Dynamic Runtime Layout'ın exact matematiği; aynı priority için nihai tie-break algoritması; exact runtime signal ve firmware setting registry schema'sı; serial protocol mapping; DeviceProfile başına kesin image/video/audio formatları; root/theme `config.cfg` alanları; firmware style menu/fallback protokolü; Media Sequence audio mix sınırları; exact audio mixing/ducking ve firmware runtime arbitration; floor announcement sequence formatı; exact visual layer default değerleri; tam timeline/transition editor kapsamı.[4] [9] [16] [17]

Bu belirsizlikler için doğru UX, kullanıcıya boş/uydurulmuş control göstermek değil, profile'dan capability gelene kadar alanı gizlemek veya `Profile-defined / Not finalized` olarak açıklamaktır.

### E) Kodlamaya geçerken ilk uygulanması gereken UI aşaması

İlk UI aşaması **Application Shell + Workspace/Dock Manager + Document Manager iskeleti** olmalıdır. Bu aşama Menu Bar, Toolbar, Document Tabs, Project Explorer host'u, Properties host'u, merkezi Design Studio document alanı, alt Console host'u, Status Bar ve Design/Simulation/Debug layout profillerinin görünür ama domain-safe kabuklarını kurar. İlk geçişte canvas'a fake widget, deployment'a fake button veya yeni UI componentlerinin sahte işlevi eklenmez; yalnız gerçek command/state sınırları ve panel docking davranışı doğrulanır.

İkinci adımda tek bir gerçek rotation document'ı canonical modelden açılır; ardından Selection/Canvas geometry, contextual Properties ve gerçek Renderer bağlanır. Sonrasında Asset Browser, Binding Editor, Simulator ve Validation aynı command/state sınırlarına sırayla eklenir. Her aşama reference screenshot geometry, panel density, device preview oranı, keyboard focus ve empty/error/loading state'leriyle görsel olarak doğrulanır. Bu plan Phase 0 foundation'a dokunmaz ve bu dokümanın kendisi dışında repository kodu değiştirmez.

## 26. UI kabul ölçütleri

Bir UI yüzeyi yalnız component'leri render ettiği için tamamlanmış sayılmaz. Kabul için ana görev açıklanabilir olmalı; reference visual language korunmalı; control'ler discoverable olmalı; selected/disabled/error/loading durumları açık olmalı; keyboard/pointer davranışı tahmin edilebilir olmalı; canonical state kullanılmalı; gerçekçi Windows boyutlarında resize çalışmalı; canvas/device preview oranı bozulmamalı; domain sözleşmesinde olmayan özellik kullanıcıya varmış gibi gösterilmemeli ve gereksiz görsel karmaşıklık oluşmamalıdır.[1]

Visual QA sırası şu olmalıdır: önce genel geometri, ardından panel oranları, device preview boyutu/konumu, typography hierarchy, spacing, control styling, iconography ve en son micro-detail. Her önemli ekran referans görsellerle karşılaştırılır; en büyük fark düzeltilmeden küçük görsel ayrıntılara geçilmez.[1]

## References

[1]: ../.agents/skills/ui-ux-system/SKILL.md "UI/UX System Skill — Template Designer"
[2]: ../AGENTS.md "Template Designer — Agent Contract"
[3]: ./ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md "Template Designer — Architecture V2"
[4]: ./TEMPLATE_DESIGNER_CONTRACT_V2.md "Template Designer — Ürün, Widget ve Tema Sözleşmesi v2"
[5]: ./UI_UX_ARCHITECTURE.md "Template Designer — UI/UX Architecture"
[6]: ../Template%20Designer%20%E2%80%94%20Ana%20Proje%20Geli%C5%9Ftirme%20Promptu.md "Template Designer — Ana Proje Geliştirme Promptu"
[7]: ./01_canvas_first_studio.png "Canvas-First Studio reference"
[8]: ./01_tema_kutuphanesi_detayli.png "Tema Kütüphanesi reference"
[9]: ./DOMAIN_MODEL_V1.md "Template Designer — Domain Model V1"
[10]: ./WIDGET_SYSTEM_QUESTIONNAIRE_V1.md "Widget System — UX Questionnaire V1"
[11]: ./UI_UX_DECISIONS_V1.md "UI/UX Decisions V1"
[12]: ./SCENE_DESIGNER_QUESTIONNAIRE_V1.md "Scene Designer — UX Questionnaire V1"
[13]: ./MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md "Media / Asset Browser — UX Questionnaire V1"
[14]: ./MEDIA_ASSET_BROWSER_QUESTIONNAIRE_V1.md "Media / Asset Browser — UX Questionnaire V1"
[15]: ./BOUNDING_GROUP_LAYOUT.md "Bounding Group Layout"
[16]: ./RUNTIME_STATE_REGISTRY.md "Runtime State Registry"
[17]: ./BINDING_PARAMETRIC_SYSTEM_V1.md "Binding & Parametric System V1"
[18]: ./SETTINGS_ARCHITECTURE_QUESTIONNAIRE_V1.md "Settings Architecture Questionnaire V1"
[19]: ./02_ayrintili_durumlar.png "Ayrıntılı durumlar reference collage"
[20]: ./02_tasarim_studyosu_detayli.png "Tasarım stüdyosu detaylı reference"
[21]: ./03_design_studio.png "Design Studio reference"
[22]: ./tema_katalogu_acik_gri.png "Açık gri tema kataloğu reference"
