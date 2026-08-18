# TEMPLATE DESIGNER — INDEPENDENT INTEGRATION AUDIT

**Branch:** `manus2`  
**Audited repository:** `Huseyincansagir/Template_Designer`  
**Audited commit:** `7e00397` — `feat: align domain runtime binding validation and export`  
**Audit mode:** Read-only QA / architecture audit  
**Code change:** Yok  
**Commit:** Yok

## Kapsam ve repository notu

Görev adı ve istenen branch ile eşleşen repository `Huseyincansagir/Template_Designer` oldu. GitHub entegrasyonunda seçili görünen `Huseyincansagir/MyApplication_6` repository’sinde `manus2` branch’i bulunmuyor ve repository STM32 kaynak ağacını içeriyor. Bu nedenle audit, görevle eşleşen `Template_Designer/manus2` hedefinde yürütüldü.

Audit; gerçek `src/` implementasyonu, `src-tauri/`, testler ve branch’e ait canonical dokümanlar karşılaştırılarak yapılmıştır. Yeşil typecheck/test/build sonuçları, UI özelliklerinin canonical davranışı gerçekten uyguladığı anlamına gelmez; aşağıdaki mimari bulgular kaynak kodu ile sözleşme karşılaştırmasının sonucudur.

## Doğrulama komutları

Son koşuda sandbox bağımlılıkları tamamlandıktan sonra bütün istenen komutlar başarıyla tamamlandı. İlk koşuda `node_modules`, Cargo ve Linux WebKit/GTK geliştirme bağımlılıkları eksikti; bunlar yalnızca doğrulama ortamına kuruldu, tracked source dosyalarında değişiklik yapılmadı.

| Komut | Sonuç | Kanıt |
|---|---:|---|
| `npm run typecheck` | **PASS** | Exit status `0` |
| `npm test` | **PASS** | 3 test dosyası, 11 test başarılı |
| `npm run build` | **PASS** | Vite production build başarılı |
| `npm run tauri:check` | **PASS** | Stable Cargo 1.97.1 ve GTK/WebKit sistem bağımlılıkları ile exit status `0` |

Son çalışma ağacı kontrolü `## manus2...origin/manus2` döndürdü; tracked değişiklik veya yeni commit yoktur.

## Özet karar matrisi

| # | Denetim alanı | Sonuç |
|---:|---|---|
| 1 | UI → Canonical Domain Model | **FAIL** |
| 2 | UI → Application Shell | **FAIL** |
| 3 | Project Explorer → `themeProjectGroups` | **FAIL** |
| 4 | Properties → canonical Widget | **FAIL** |
| 5 | Canvas → Rotation / Scene / Widget | **FAIL** |
| 6 | Binding UI → canonical Binding contract | **FAIL** |
| 7 | Digit / Direction / Media ayrımı | **PASS domain / WARN UI** |
| 8 | DeviceProfile capability kullanımı | **FAIL** |
| 9 | Asset Depot / Resources / Unsupported Files | **FAIL** |
| 10 | Simulator’ın canonical runtime modeli | **FAIL** |
| 11 | Settings’in blocking modal olması | **FAIL** |
| 12 | Docking / panel mimarisi | **FAIL** |
| 13 | Command / Undo / Redo kullanımı | **FAIL** |
| 14 | Tauri / Core / Domain / UI boundary’leri | **PASS import boundary / WARN flow** |
| 15 | Foundation ↔ UI type/API mismatch | **FAIL** |
| 16 | Runtime/export modelinin UI yorumlaması | **FAIL** |

## Bulgular

### F-01 — UI canonical Project modelinin edit kaynağı değil, UI state taşıyıcısı olarak kullanılması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:12-17, 72-105, 120-138, 371-395` — [App.tsx][1]  
**CURRENT:** `Project` React component state içinde tutuluyor. Explorer seçimi ise `id`, `label`, `kind`, `detail` alanlarından oluşan ayrı bir `Selection` snapshot’ı olarak tutuluyor. `createProject`, `selectNode`, panel, görünüm ve canvas işlemleri doğrudan `setState` çağrılarıyla yürütülüyor; seçilen canonical Widget’ın kendisi üzerinde bir edit işlemi yok.  
**CANONICAL:** Canonical Project Model source of truth olmalı; Project Explorer, Canvas, Properties, Simulator, Validation ve Export aynı modelden beslenmeli. UI kontrolleri domain nesnelerini komutlar/servisler üzerinden değiştirmeli; Explorer domain state sahibi olmamalıdır. [Architecture V2][3] [UI Corrections][6]  
**PROBLEM:** UI, modelin navigation görünümünü üretse de edit yaşam döngüsünü canonical document/command akışına bağlamıyor. `Selection` modelden türetilmiş salt bir view model olarak kalmıyor; UI’nın tek aktif seçim gerçeğine dönüşüyor. Properties ve Canvas bu snapshot’ı gösteriyor, canonical Widget/Scene/Rotation üzerinde değişiklik yapmıyor. Bu nedenle UI, validation/undo/redo/preview/export ile ortak bir edit state paylaşmıyor.  
**RECOMMENDATION:** Mevcut canonical `Project`/`DocumentStore` ve `CommandHistory` akışını UI’ya bağlayın; seçimleri yalnızca canonical node ID’siyle çözümleyin ve tüm editleri mevcut domain tipleri üzerinden command olarak yürütün. İkinci bir UI domain modeli oluşturmayın.

### F-02 — Application Shell’in gerçek dockable tool-window mimarisi olmaması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:6, 74, 108-118, 231-233, 292-417`; `src/App/app.css:72-77, 174-180` — [App.tsx][1] [app.css][12]  
**CURRENT:** Shell yalnızca `explorer`, `properties` ve `console` için boolean görünürlük state’i tutuyor. Üç kolonlu sabit CSS grid, alt console satırı ve kapatma düğmeleri var; paneli dock/undock/float/resize/split/tab/auto-hide/reopen yapmak mümkün değil. Ayrıca `app.css:174-180` içindeki responsive `!important` grid tanımı, dar ekranlarda React’in dinamik panel kolonlarını ezerek görünürlük toggle’larının düzenini de bozuyor. Asset Browser, Simulator, Runtime State ve bağımsız Validation tool window’ı yok.  
**CANONICAL:** Project Explorer, Properties, Asset Browser, Simulator, Runtime State, Console/Output ve Validation dockable tool window’lar olmalı; dock, undock, float, resize, split, tab, collapse, auto-hide ve close/reopen desteklenmeli. [Architecture V2][3]  
**PROBLEM:** Mevcut görünürlük toggles’ı docking mimarisi olarak yorumlanamaz. Uygulama, canonical CAD/IDE-style Application Shell’in yalnızca sabit bir mock yerleşimini içeriyor.  
**RECOMMENDATION:** Shell panel state’ini yalnızca görünürlük değil, mevcut canonical workspace/dock davranışını temsil edecek şekilde bağlayın. Sabit üç kolonun tool-window manager yerine geçmesine izin vermeyin.

### F-03 — Project Explorer’ın yalnızca ilk `themeProjectGroups` öğesini göstermesi

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:90-93, 174-190` — [App.tsx][1]  
**CURRENT:** `const group = project.themeProjectGroups[0]` ile yalnızca ilk grup seçiliyor. `projectTree` tek bir `theme-group` düğümü üretiyor; diğer canonical gruplar Explorer’da hiç görünmüyor.  
**CANONICAL:** `Project.themeProjectGroups` bir dizi olabilir ve canonical hierarchy içindeki bütün Theme Project Group → Theme Project → Rotation → Scene → Widget ilişkileri navigation view’da temsil edilmelidir. [Domain Model V1][4] [Runtime Contract][5]  
**PROBLEM:** Birden fazla Theme Project Group içeren geçerli bir Project, UI tarafından sessizce tek gruba indirgeniyor. Bu yalnızca görüntüleme eksikliği değil; yanlış grup üzerinde çalışma ve export kapsamını yanlış algılama riski yaratıyor.  
**RECOMMENDATION:** Explorer ağacını tüm `themeProjectGroups` öğelerinden türetin; sabit ilk grup varsayımını kaldırın. Seçim ve aktif document de group/theme/rotation bağlamını korusun.

### F-04 — Properties panelinin canonical Widget inspector yerine metadata stub olması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:361-395` — [App.tsx][1]  
**CURRENT:** Properties yalnızca `Name`, `Type`, `Stable ID`, `Source`, `Edit state` ve `Validation` metadatasını gösteriyor. Widget seçildiğinde `Position = Not available` ve `Size Lock = Independent` hard-coded olarak gösteriliyor. `geometry`, `zIndex`, `enabled`, `visible`, `locked`, `bindings`, `content`, `style`, `mediaSlide` ve asset referansları düzenlenemiyor. Çoklu seçim ve `*` ortak değer davranışı yok.  
**CANONICAL:** Properties paneli seçilen canonical nesnenin gerçek alanlarını göstermeli; canonical Widget `id`, `widgetType`, geometry, z-index, binding/condition, content ve style taşır. Locked geometry değiştirilememeli, diğer izinli alanlar düzenlenebilmeli; çoklu seçimde farklı değer `*` ile gösterilmelidir. [Domain Model V1][4] [UI Corrections][6]  
**PROBLEM:** Panel, gerçek Widget modelini yorumlamıyor ve kullanıcıya düzenlenebilir bir inspector varmış izlenimi veriyor. `Size Lock = Independent` değeri modeldeki `locked` alanından türetilmiyor; ayrıca `Validation = Not evaluated` bilgisi global validation state’i de yansıtmıyor.  
**RECOMMENDATION:** Properties’i canonical node çözümlemesi üzerinden gerçek typed alanlara bağlayın; yalnız aktif DeviceProfile’ın izin verdiği alanları gösterin. Editleri mevcut command/history yolundan geçirin ve sabit placeholder değerleri kaldırın.

### F-05 — Canvas’ın aktif Rotation/Scene/Widget yerine hard-coded boş R0 ekranı kullanması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:315-358`; `src/App/app.css:104-127` — [App.tsx][1] [app.css][12]  
**CURRENT:** Canvas üst bilgisi sabit olarak `R0 · 720 × 1280` yazıyor. Ekran her durumda empty state render ediyor; seçilen Scene veya Widget’ın geometry/content/style değerleri çizilmiyor. Zoom yalnızca CSS scale; Rotation seçimi, 90/180/270 yönleri, widget move/resize/rotate, z-order, locked/invisible davranışı ve selection bounds uygulanmıyor.  
**CANONICAL:** Canvas seçili Rotation/Form ve Scene içindeki canonical Widget’ları göstermeli; resolution ve rotation DeviceProfile/Rotation modelinden gelmeli. Canvas pan, zoom, selection, multi-selection, move, resize, rotation, snap, guides, bounding groups ve z-order davranışlarını desteklemelidir. [Architecture V2][3] [UI Corrections][6]  
**PROBLEM:** Canvas, domain modelin bir editor surface’i değil, yalnızca görsel shell’dir. R0/720×1280 sabiti, hem aktif Rotation hem de DeviceProfile display capability’sini bypass ediyor.  
**RECOMMENDATION:** Canvas context’ini seçili canonical Rotation → Scene → Widget zincirinden çözümleyin; frame ölçüsünü model/profile’dan alın. Widget render ve geometry işlemlerini aynı canonical değerlerden türetin.

### F-06 — Binding UI’nın olmaması ve mevcut UI’nın canonical Binding contract’ını tüketmemesi

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:221-224, 371-395`; `src/Domain/models.ts:98-122`; `src/Core/runtime.ts:100-123` — [App.tsx][1] [models.ts][2] [runtime.ts][9]  
**CURRENT:** `Binding Editor` menüsü disabled. Properties içinde binding, condition, action, content/style selection veya binding sonucu yok. `App.tsx`, `evaluateBinding` ya da `evaluateActiveSceneBindings` fonksiyonlarını kullanmıyor.  
**CANONICAL:** Binding; Media’ya özel inheritance değil, Media/Digit/Direction ve uygun semantic widget’lar için cross-cutting presentation contract’ıdır. Scene selection önce yapılır; binding yalnız active Scene içindeki presentation davranışını değiştirir. Positive/negative koşullar ve DeviceProfile-defined state/operator/value validation desteklenmelidir. [Binding System][7] [Runtime Contract][5]  
**PROBLEM:** Core’da contract ve evaluator bulunmasına rağmen UI bunu hiç sunmuyor; dolayısıyla kullanıcı canonical binding oluşturamıyor, test edemiyor veya sonucunu göremiyor. Ayrıca `validation.ts` binding action’ının widget type/capability ile uyumunu doğrulamıyor; yalnız referans, koşul ve asset varlığını denetliyor.  
**RECOMMENDATION:** UI’yı mevcut `Binding`, `Condition` ve runtime evaluator sözleşmelerine bağlayın; state/operator/value listesini DeviceProfile’dan üretin ve action’ları widget capability’sine göre sınırlayın. Binding’in Scene seçimini değiştirmesine izin vermeyin.

### F-07 — Digit/Direction/Media ayrımının domain’de doğru, UI’da görünür ve uygulanabilir olmaması

**SEVERITY:** MEDIUM  
**FILE:** `src/Domain/models.ts:7-18, 135-151`; `src/Core/validation.ts:157-180`; `src/App/App.tsx:120-138, 385` — [models.ts][2] [validation.ts][8] [App.tsx][1]  
**CURRENT:** Domain tipleri `WidgetType` ve `MediaType` olarak ayrı tanımlanmış; validation da Media Slide’ı `widgetType === "media"` ile sınırlandırıyor. Ancak UI’da Digit, Direction ve Media için farklı property surface’i yok; hepsi yalnız generic `widget` selection metadata’sı olarak gösteriliyor.  
**CANONICAL:** Digit ve Direction semantic widget’tır; generic Media değildir. Digit floor mapping/style, Direction Up/Down style/variant, Media ise image/video ve optional audio/slide davranışıyla ayrı ele alınmalıdır. [UI Corrections][6] [Runtime Contract][5]  
**PROBLEM:** Domain separation şu an korunuyor; fakat UI bu ayrımı ifade edemediği için kullanıcı semantic widget ile generic media davranışını düzenleyemiyor. Bu, mevcut modelin doğrudan ihlali değil, UI entegrasyonunun canonical ayrımı görünür kılmaması ve ileride yanlış generic editor’a dönüşme riskidir.  
**RECOMMENDATION:** Yeni widget/media inheritance kurmadan, mevcut canonical `widgetType`, `mediaType`, `mediaSlide`, digit style, direction style ve floor mapping alanlarını type-specific Properties yüzeylerinde kullanın.

### F-08 — DeviceProfile’ın UI validation, canvas ve capability surface’inde source of truth olmaması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:2-4, 72-90, 337-345`; `src/Domain/factories.ts:3-16`; `src/Core/validation.ts:282-316` — [App.tsx][1] [factories.ts][14] [validation.ts][8]  
**CURRENT:** UI `validateProject(project)` çağırıyor; aktif `DeviceProfile` nesnesini validator’a vermiyor. `foundationDeviceProfile` boş runtime state/setting registry’leriyle oluşturuluyor. Canvas 720×1280 ve R0 bilgisini doğrudan yazıyor. `validation.ts` profile verilmediğinde yalnız genel Project/Asset kontrollerini çalıştırıyor.  
**CANONICAL:** DeviceProfile display resolution, supported rotations/widget/media/formats, runtime state/setting registry, audio/video limits, digit/direction styles ve diğer capability’lerin tek kaynağıdır. Designer capability varsaymamalı; validation profile-aware olmalıdır. [Domain Model V1][4] [Runtime Contract][5]  
**PROBLEM:** UI’daki `No blocking foundation issues` mesajı tam capability validation sonucu değildir. Profile mismatch, unsupported runtime reference, supported format, video decode limit, audio capability ve diğer profile kuralları UI validation’a ulaşmıyor. Modelde alanlar mevcut olsa da UI bunları kullanmadığı için capability contract yalnız Core testlerinde kısmen görünür.  
**RECOMMENDATION:** Project’in `deviceProfileId` değerinden aktif profile’ı çözümleyip aynı profile’ı canvas, menu enablement, Properties ve validation’a verin. `supportedFormats`, audio/video capability ve diğer mevcut DeviceProfile alanlarını canonical validation akışında tüketin; sabit resolution/state varsaymayın.

### F-09 — Asset Depot, Resources ve Unsupported Files’ın UI/domain yüzeyinde ayrılmaması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:174-189`; `src/Domain/models.ts:182-204`; `src/Core/export.ts:54-77, 138-166` — [App.tsx][1] [models.ts][2] [export.ts][10]  
**CURRENT:** Explorer’da `Resources` satırının detail değeri `project.assets.length`; bu, Project asset listesi ile Theme Resources’ı aynı sayaçta gösteriyor. `Unsupported Files` yalnızca `detail: "Empty"` olan statik bir node. Asset Depot için ayrı UI/domain state yok. Export Core ise Resources + Used + Default union’ını topluyor.  
**CANONICAL:** Asset Depot/Asset Browser library/depo, Project/Theme Resources ayrı, Scene references ayrı, Unsupported Files ayrı olmalıdır. Unsupported Files widget oluşturmaz, Canvas’a render edilmez ve normal export pipeline’a girmez. Kullanılmayan Depot içeriği export edilmez. [UI Corrections][6] [Runtime Contract][5]  
**PROBLEM:** UI Project assets’i Resources gibi gösteriyor ve Unsupported Files’ın gerçek varlığını/ownership’ini tutmuyor. Core export’un doğru union mantığı, UI’daki yanlış sınıflandırmayı düzeltmiyor; import/drop ve unsupported routing davranışı olmadığı için kullanıcı asset ownership’ini yanlış anlayabilir.  
**RECOMMENDATION:** Mevcut `Asset`, `ThemeProject.resources` ve export kurallarını ayrı navigation yüzeylerinde gösterin. Unsupported Files için normal asset listesine karışmayan gerçek import/status akışı kurun; Canvas drop’unun otomatik widget üretmemesi kuralını koruyun.

### F-10 — Simulator’ın canonical runtime engine’i kullanmaması; fiilen Simulator’ın bulunmaması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:6, 74-83, 325-343, 399-414`; `src/Core/runtime.ts:13-123` — [App.tsx][1] [runtime.ts][9]  
**CURRENT:** `ViewMode` yalnızca `design | preview`; Preview seçildiğinde toolbar etiketi ve canvas rail label değişiyor. Runtime state input’u, Simulator paneli, Play/Pause/Step/Reset, active Scene veya binding trace yok. `runtime.ts` içindeki evaluator UI tarafından çağrılmıyor.  
**CANONICAL:** Simulator dockable bir tool window olmalı ve aynı canonical Domain Model, DeviceProfile registry, scene priority/activation order ve Binding Engine’i kullanmalıdır. Ayrı, sadeleştirilmiş state/rule sistemi oluşturulmamalıdır. [Architecture V2][3] [Runtime Contract][5]  
**PROBLEM:** Preview, runtime preview olarak etiketlense de canonical runtime evaluation yapmıyor; boş canvas gösteriyor. Bu, Preview/Simulator/Export invariant’ını kırıyor. Core runtime kodunun testleri geçse de Simulator entegrasyonu yok.  
**RECOMMENDATION:** Preview/Simulator yüzeyini mevcut `selectActiveScene` ve `evaluateActiveSceneBindings` ile aynı Project/Profile üzerinden çalıştırın. Runtime state kontrollerini profile registry’den üretin; hard-coded elevator state listesi eklemeyin.

### F-11 — Aynı Scene priority’sinde activation order yoksa document order’a fallback yapılması

**SEVERITY:** MEDIUM  
**FILE:** `src/Core/runtime.ts:78-91` — [runtime.ts][9]  
**CURRENT:** `sceneActivationOrder?.[scene.id] ?? index` kullanılıyor. `RuntimeContext.sceneActivationOrder` verilmezse, aynı priority’de `scenes` dizisindeki indeks tie-break oluyor.  
**CANONICAL:** Aynı priority’de runtime’da daha sonra aktif olan Scene kazanır; Project Explorer/document order tie-break değildir. [Runtime Contract][5]  
**PROBLEM:** Activation order eksik olduğunda evaluator sessizce document/list order kullanıyor. Bu, runtime activation order bulunmayan çağrılarda canonical deterministic kuralın yerine Explorer veya serialization order’ını geçiriyor. Testler activation order sağlandığında doğru davranışı doğruluyor, ancak eksik context fallback’ini reddetmiyor.  
**RECOMMENDATION:** Mevcut `RuntimeContext` akışında activation order’ı zorunlu runtime verisi olarak sağlayın; order yoksa document index’ini gerçek runtime tie-break gibi kullanmayın ve evaluation sonucunu eksik runtime context olarak işaretleyin.

### F-12 — Settings/Preferences blocking modal olarak uygulanmamış

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:210, 286-289` — [App.tsx][1]  
**CURRENT:** `Project Settings` disabled. Tab alanındaki settings düğmesi disabled ve title’ı `Application settings are modal and not implemented in Phase 0`. Açılan modal, Cancel, Save/Apply & Close veya background interaction lock yok.  
**CANONICAL:** Program Settings/Preferences dedicated blocking modal window olmalı; modal açıkken ana uygulama etkileşime kapalı olmalı ve kullanıcı Cancel veya Save/Apply & Close seçmelidir. [Settings Architecture][13] [UI Corrections][6]  
**PROBLEM:** Canonical olarak zorunlu shell davranışı yok; mevcut disabled ikon, modal sözleşmesini yerine getirmiyor.  
**RECOMMENDATION:** Settings’i dockable panel veya in-canvas navigator yapmadan, blocking Preferences modal olarak konumlandırın. Cancel ve Save/Apply & Close yaşam döngüsünü gerçek program settings state’iyle bağlayın.

### F-13 — Command/Undo/Redo altyapısının UI tarafından kullanılmaması

**SEVERITY:** HIGH  
**FILE:** `src/Core/commands.ts:1-40`; `src/App/App.tsx:192-207, 221-228, 270-275, 350-357` — [commands.ts][11] [App.tsx][1]  
**CURRENT:** `CommandHistory` generic execute/undo/redo semantics sağlıyor; ancak App `CommandHistory` import etmiyor, instance oluşturmuyor ve herhangi bir domain command yürütmüyor. Undo/Redo menüleri ve toolbar butonları disabled. `New Project`, selection, panel, grid, snap ve zoom değişimleri doğrudan React state’i değiştiriyor.  
**CANONICAL:** Create/Delete/Move/Resize/Rotate/Duplicate/Change Property/Binding/Scene/Asset/Floor Mapping gibi edit operasyonları mümkün olduğunca command olmalı; bu, Undo/Redo, logging, shortcuts ve automation için ortak temel oluşturur. [Architecture V2][3]  
**PROBLEM:** UI’daki `Changes flow through commands` footnote’u mevcut davranışla çelişiyor. Edit history, dirty state, keyboard shortcut ve command console bütünlüğü yok.  
**RECOMMENDATION:** Mevcut `CommandHistory` semantiğini UI editlerinin gerçek yürütme yolu yapın; disabled Undo/Redo’yu yalnız history state’iyle enable edin. Doğrudan Project mutation yapan UI handler’larını command üzerinden geçirin.

### F-14 — Import-level Tauri/Core/Domain boundary temiz; ancak UI flow Application Service sınırını tamamlamıyor

**SEVERITY:** MEDIUM  
**FILE:** `src/App/App.tsx:1-4, 72-105`; `src/Core/application.ts:1-78`; `src-tauri/src/lib.rs:3-14`; `tests/architecture.test.ts:5-33` — [App.tsx][1] [application.ts][15] [lib.rs][16] [architecture tests][17]  
**CURRENT:** Domain/Core kaynaklarında React veya Tauri import’u yok; architecture testleri başarılı. Tauri lib yalnızca `app_version` command’ı ve shell bootstrap içeriyor. UI, Domain factory ve Core validation import ediyor; fakat Project lifecycle’ı UI state’inde tutuyor ve deployment/application service kullanmıyor.  
**CANONICAL:** Domain platform bağımsız kalmalı; Tauri native shell olarak kalmalı; UI → Application Service → Platform/Deployment Adapter akışı kullanılmalı. React component içinde native filesystem/device çağrısı olmamalıdır. [Agent Contract][18] [Architecture V2][3]  
**PROBLEM:** Import boundary korunmuş durumda; bu başlıkta doğrudan React/Tauri sızıntısı yok. Ancak UI’nın canonical document/command/application flow’u bypass etmesi boundary’nin davranışsal tarafını eksik bırakıyor. Bu nedenle tamamen PASS değil, import-level PASS / flow-level WARNING kararı verildi.  
**RECOMMENDATION:** Tauri/Domain/Core import disiplinini koruyun; UI’nın Project/deployment lifecycle’ını mevcut Core application/document akışına bağlayın. Native erişimi React’e taşımayın.

### F-15 — Foundation UI ile canonical type/API arasında hard-coded whitelist ve context mismatch

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:9-10, 19-26, 120-138, 161-167, 337-345`; `src/Domain/models.ts:7-18, 75-96, 153-190` — [App.tsx][1] [models.ts][2]  
**CURRENT:** Domain `WidgetType` `(string & {})` ile gelecekte profile-defined semantic widget type’larını kabul ediyor. UI `selectNode` ise yalnız `widget`, `media`, `digit`, `direction`, `warning`, `text` değerlerini tanıyor; farklı bir profile-defined widget type’ı `canvas` selection kind’ına düşürüyor. Properties’te `Type`, gerçek `widget.widgetType` yerine `SelectionKind` değerini gösteriyor. Canvas ayrıca `R0 · 720 × 1280` sabitini kullanıyor.  
**CANONICAL:** DeviceProfile yeni semantic widget/capability ekleyebilir; UI state/label, stable ID ve display metadata’yı canonical type’lardan üretmeli ve profile-defined özellikleri rastgele generic canvas’a düşürmemelidir. DeviceProfile display/rotation kaynağıdır. [Domain Model V1][4] [Runtime Contract][5]  
**PROBLEM:** UI API’si açık uçlu canonical `WidgetType` ile uyumlu değil. Yeni veya profile-specific semantic widget’lar seçilebilir durumda olsa bile doğru selection/property/canvas context’ine sahip olmayacak. `TreeNode.kind` ve `SelectionKind` arasındaki string whitelist, type contract’ın daraltılmış ve sessizce kaybedilen bir yorumudur.  
**RECOMMENDATION:** UI selection ve display label’larını mevcut canonical `WidgetType`/DeviceProfile verisinden türetin; bilinmeyen profile-defined type’ı `canvas` olarak sınıflandırmayın. Properties’te canonical widget type ve typed domain context’i koruyun.

### F-16 — Runtime/Preview/Export/Deployment akışının UI’da yanlış veya eksik yorumlanması

**SEVERITY:** HIGH  
**FILE:** `src/App/App.tsx:203-212, 325-343, 399-423`; `src/Core/export.ts:131-181`; `src/Core/application.ts:53-77`; `src/Infrastructure/sd-card-target.ts:4-16` — [App.tsx][1] [export.ts][10] [application.ts][15] [sd-card-target.ts][19]  
**CURRENT:** `Preview` yalnızca view mode label’ını değiştiriyor. `Project → Validate Project` action’ı validation sonuçlarını kullanıcıya bağlamak yerine `Foundation validation completed` mesajı yazıyor. UI’da build package, select SD card, write, verify ve safe eject publish yolu yok. Core export Resources + Used + Default asset union’ını doğru kuruyor ve PackageDeploymentManager verification çağırıyor; ancak SD-card adapter `SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED` ile doğrudan hata veriyor.  
**CANONICAL:** Preview, Simulator ve Export aynı canonical Project Model, geometry, style, media ve binding resolution’ı kullanmalı. Editable Project önce validation, package build, verification ve sonrasında deployment target’a gitmelidir; UI verification tamamlanmadan success iddia etmemelidir. [Product Contract][20] [Deployment Format][21] [Runtime Contract][5]  
**PROBLEM:** Core export path’inin bazı parçaları doğru olsa da UI bu path’i kullanmıyor ve `Preview` adını runtime davranışı varmış gibi kullanıyor. Validation menüsü gerçek validation/publish gate değildir. Ayrıca V1 SD-card deployment adapter’ı henüz uygulanmadığı için canonical end-to-end deployment akışı UI’dan gerçekleştirilemez.  
**RECOMMENDATION:** Preview label’ını yalnız gerçek canonical render/runtime akışıyla kullanın; validation sonucu olmadan publish state üretmeyin. PackageDeploymentManager’ın mevcut verify-before-deploy akışını UI’ya bağlayın ve SD adapter tamamlanana kadar deployment success gösterilmemesini koruyun.

### F-17 — DeploymentPackage `verified` alanının build aşamasında erken `true` yapılması

**SEVERITY:** MEDIUM  
**FILE:** `src/Core/export.ts:131-181, 184-191`; `src/Domain/models.ts:264-275` — [export.ts][10] [models.ts][2]  
**CURRENT:** `buildDeploymentPackage` checksum hesapladıktan hemen sonra `verified: true` döndürüyor. Gerçek checksum doğrulaması ayrı `verifyDeploymentPackage` çağrısında yapılıyor; PackageDeploymentManager bu çağrıyı doğru biçimde yapıyor.  
**CANONICAL:** Package pipeline `build → calculate integrity → verify package → DeploymentManager` şeklindedir; verification başarısızsa deployment bloklanır. `verified` alanı doğrulanmış package anlamını taşımalıdır. [Deployment Format][21] [Runtime Contract][5]  
**PROBLEM:** Builder’ı doğrudan kullanan bir caller, henüz `verifyDeploymentPackage` çalışmadan `verified === true` görebilir. Mevcut manager bunu düzeltiyor, ancak API state’i build ile verified aşamalarını birbirine karıştırıyor ve UI entegrasyonunda yanlış başarı sinyali üretmeye açıktır.  
**RECOMMENDATION:** Mevcut build/verify sıralamasında `verified` semantiğini yalnız gerçek doğrulama sonrasında kullanın; UI ve application caller’larının builder çıktısını verified deployment sonucu olarak yorumlamamasını garanti edin.

## Olumlu kontroller

`src/Domain/models.ts` içinde semantic `WidgetType` ile `MediaType` ayrımı, `ThemeProjectGroup`/`ThemeProject`/`Rotation`/`Scene`/`Widget` hiyerarşisi, DeviceProfile registry alanları, Binding sözleşmesi ve DeploymentPackage tipleri canonical kararlarla büyük ölçüde uyumludur. `src/Core/runtime.ts` active Scene seçimini priority ve sağlanan runtime activation order ile yapıyor; `src/Core/validation.ts` DeviceProfile-defined runtime referanslarını ve temel asset/binding/rotation kurallarını doğruluyor; `src/Core/export.ts` Resources + Used + Default kapsamını uyguluyor. Bunlar domain foundation’ın güçlü taraflarıdır, ancak UI bu çekirdekleri henüz tüketmediği için entegrasyon audit sonucu değişmemektedir.

`tests/architecture.test.ts`, Domain/Core içinde React ve Tauri import sınırlarını; `tests/domain-runtime.test.ts` ise runtime priority/activation order, active-scene binding, validation ve export/checksum davranışlarının mevcut kısmını doğruluyor. Test kapsamı yeşil olsa da UI integration, docking, Settings modal, Properties editing, Simulator paneli ve publish workflow için coverage sağlamıyor.

## Sonuç

**FAIL**

TypeScript, test, production build ve Tauri check koşulları geçmiştir. Buna rağmen canonical UI integration ve architecture sözleşmelerinde HIGH severity seviyesinde çok sayıda eksik/çelişki vardır: UI gerçek canonical Widget/Rotation/Scene modelini düzenlemiyor, Application Shell docking modeli yok, Binding/Simulator/Settings/Undo-Redo yüzeyleri bağlı değil, DeviceProfile UI validation’ın kaynağı değil ve Preview/Export/Deployment invariant’ı kurulmamış durumdadır. Bu nedenle branch, bağımsız integration audit açısından **FAIL** olarak kapatılmıştır.

## References

[1]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/App/App.tsx "Template Designer App shell"
[2]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Domain/models.ts "Canonical TypeScript domain models"
[3]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md "Architecture V2 — Application Shell, Domain and Editor"
[4]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/DOMAIN_MODEL_V1.md "Domain Model V1"
[5]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md "Domain / Runtime Contract V1"
[6]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md "UI Design System V2 canonical corrections"
[7]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/BINDING_PARAMETRIC_SYSTEM_V1.md "Binding and Parametric System V1"
[8]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Core/validation.ts "Core validation"
[9]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Core/runtime.ts "Canonical runtime evaluator"
[10]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Core/export.ts "Deployment package builder and verifier"
[11]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Core/commands.ts "Command history"
[12]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/App/app.css "Application shell and panel CSS"
[13]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/SETTINGS_ARCHITECTURE_QUESTIONNAIRE_V1.md "Settings Architecture Questionnaire V1"
[14]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Domain/factories.ts "Foundation domain factories"
[15]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Core/application.ts "Application deployment service boundary"
[16]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src-tauri/src/lib.rs "Tauri shell entrypoint"
[17]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/tests/architecture.test.ts "Architecture boundary tests"
[18]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/AGENTS.md "Repository agent contract"
[19]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/src/Infrastructure/sd-card-target.ts "SD-card deployment adapter"
[20]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/TEMPLATE_DESIGNER_CONTRACT_V2.md "Template Designer Product Contract V2"
[21]: https://github.com/Huseyincansagir/Template_Designer/blob/manus2/docs/DEPLOYMENT_FORMAT.md "Deployment Package Format"


## Süreç Notu — Pull / Push / Revert ve Değişiklik Sınırı

Bu audit’in başlangıç talimatı **“KOD DEĞİŞTİRME. COMMIT YAPMA.”** idi. Audit çalışması sırasında `src/` veya `src-tauri/` altında uygulama kodu yazılmadı, değiştirilmedi ve commit oluşturulmadı. Hazırlanan Markdown raporu ilk aşamada repository dışında oluşturuldu ve yalnızca audit teslimatı olarak sunuldu.

Audit sonrasında kullanıcı tarafından verilen push talimatı üzerine branch durumu kontrol edildi. İlk `git push origin manus2` denemesi, remote branch’in yerel clone’dan ileride olması nedeniyle fast-forward olmayan güncelleme hatasıyla reddedildi. Remote’daki `c52f553` (`feat(ui): implement canonical application shell`) commit’i push işlemiyle oluşturulmamıştı; fetch çıktısı bu commit’in remote’da zaten bulunduğunu gösteriyordu.

Daha sonra verilen “pull push yap” talimatı üzerine `git pull --ff-only origin manus2` çalıştırıldı. Bu işlem yerel branch’i `7e00397` durumundan remote’daki `c52f553` durumuna fast-forward etti ve bu nedenle yerel çalışma ağacında `src/App/App.tsx` ile `src/App/app.css` dosyaları güncellendi. Ardından `git push origin manus2` sonucu `Everything up-to-date` oldu; yeni bir commit oluşturulmadı. Bu noktada, başlangıçtaki kod değiştirmeme kısıtıyla pull işleminin çalışma ağacını değiştirmesi arasındaki çelişkiyi işlemden önce yeniden teyit etmem gerekirdi.

Kullanıcı daha sonra remote branch üzerinde bu UI değişikliklerini kendisi revert etti. Revert commit’i `83036c6` (`Revert "feat(ui): implement canonical application shell`) oldu. İstenen şekilde önce tekrar `git pull --ff-only origin manus2` çalıştırıldı; branch `c52f553` durumundan `83036c6` durumuna fast-forward edildi. Böylece `src/App/App.tsx` ve `src/App/app.css` remote’daki revert edilmiş hâline döndü. Bu aşamada da source code üzerinde manuel değişiklik, merge, rebase veya force-push yapılmadı.

Bu dosyanın repository’ye eklenmesi, kullanıcı tarafından sonradan açıkça istenen **tek içerik değişikliğidir**. Bundan sonraki commit yalnızca bu audit Markdown dosyasını içerecektir. `src/App/App.tsx`, `src/App/app.css`, diğer `src/` dosyaları ve `src-tauri/` dosyaları bu işlem kapsamında commit’e dahil edilmeyecektir. Bu not, süreçteki pull/push/revert adımlarını ve kod değişikliği kısıtının nasıl uygulandığını şeffaf biçimde kayda geçirmek amacıyla eklenmiştir.
