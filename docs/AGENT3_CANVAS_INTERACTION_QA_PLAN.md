# Agent 3 — Canvas Interaction QA / Acceptance Plan

## Belge amacı ve kapsamı

Bu belge, **Agent 2 — Canvas Interaction Foundation** uygulamasının objektif kabul sözleşmesidir. Agent 3 yalnızca QA tasarımı, kabul matrisi, statik audit ve doğrulama raporlaması yapar; Canvas, Agent 1 veya Agent 2 uygulama kodunu değiştirmez. Kanonik davranış kararları `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` dosyasının manus2 dalındaki güncel sürümünden alınmıştır [1].

> Kabul kuralı: Bir davranışın tamamlanmış sayılması için yalnızca ekranda çalışıyor görünmesi yeterli değildir. **Doküman mutasyonu, history davranışı, undo/redo doğruluğu, UI gözlemi ve domain bütünlüğü** birlikte doğrulanmalıdır.

Bu QA planındaki durum etiketleri şöyledir: **IMPLEMENTED AND PASSING**, mevcut test veya gözlemin davranışı doğruladığını; **IMPLEMENTED AND FAILING**, kodun davranışı denediğini fakat kontrata aykırı olduğunu; **NOT IMPLEMENTED YET**, davranış için gerekli uygulama yüzeyinin mevcut olmadığını; **BLOCKED**, testin çalıştırılabilmesi için gerekli ortam veya gerçek fixture bulunmadığını; **UNVERIFIED**, statik inceleme veya mevcut testlerle kesin kabul kararı verilemediğini ifade eder. Agent 2, eksik davranış nedeniyle otomatik olarak başarısız ilan edilmez.

## 1. Kanonik baseline

| Alan | Değer |
|---|---|
| Repository | `Huseyincansagir/Template_Designer` |
| Branch | `manus2` |
| İncelenen HEAD | `f1306ac` — `feat(canvas): implement canvas interaction foundation` |
| Agent 1 referans baseline | `c76442826c02ad54fd37850c5742c1263c2fccf3` |
| Kanonik Agent 2 planı | `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` |
| QA dokümanı | `docs/AGENT3_CANVAS_INTERACTION_QA_PLAN.md` |
| Agent 3 uygulama kodu değişikliği | Yok; audit edilen Agent 2 implementation commit’i `f1306ac` |
| Kabul matrisi senaryo sayısı | **119**; ayrıca 21 adımlı browser smoke dizisi |

Kanonik pipeline `Canvas → EditorApplication → DocumentStore → CommandHistory → Domain → snapshot → React UI` şeklindedir. Canvas’ın Project veya başka bir domain nesnesinin sahibi olmaması, kalıcı değişikliklerin uygulama katmanından geçmesi ve transient preview durumunun canonical Project kopyasına dönüşmemesi temel mimari koşullardır [1].

Mevcut `App.tsx`, `InMemoryDocumentStore` ve `EditorApplication` örneklerini React yaşam döngüsü boyunca memoize eder; React tarafında `useSyncExternalStore` ile store snapshot’ı okunur. Bu nedenle static audit sırasında **canonical Project ownership** için mevcut olumlu bulgu, Canvas’ın doğrudan ikinci bir Project store’u oluşturmamasıdır [2] [5].

## 2. Mevcut doğrulama baseline’ı

| Kontrol | Komut | Sonuç | QA yorumu |
|---|---|---|---|
| TypeScript | `pnpm run typecheck` | **PASS** | Tip kontrolü başarılı. |
| Unit ve integration testleri | `pnpm test` | **PASS** | 6 test dosyası, toplam 40 test başarılı; yeni Canvas helper suite’i 9 pure test içeriyor. UI/application history entegrasyonu halen ayrı kabul kapsamıdır. |
| Production build | `pnpm run build` | **PASS** | `tsc --noEmit` ve Vite build başarılı. |
| Tauri validation | `pnpm run tauri:check` | **BLOCKED** | Ortamda `cargo` bulunmuyor; bu bir uygulama defect’i olarak sınıflandırılmadı. |
| Browser smoke | Gerçek populated fixture ile | **BLOCKED** | Mevcut `App` bootstrap’i `createEmptyProject()` açıyor; test fixture’ı browser’a enjekte eden mevcut bir açılış yolu yok [2] [10]. |

Mevcut testler canonical editor pipeline için exact undo/redo, no-op history, dirty state, New Project, duplicate, delete, locked geometry ve snapshot notification davranışlarını doğrulamaktadır [8]. Agent 2 implementation commit’i ayrıca coordinate round-trip, aspect-ratio letterboxing, zoom/pan pure conversion, inclusive hit testing, z-order, selection ordering, marquee visibility filtering, resize, multi-selection bounds ve nearest snap candidate için 9 pure test eklemiştir [13]. Buna rağmen pointer lifecycle, React/store integration, history lifecycle, keyboard focus boundary ve gerçek browser smoke senaryosu bu test dosyasında henüz doğrulanmamaktadır [13].

## 3. Kabul matrisi kullanım kuralı

Her satır aşağıdaki sözleşmeyle yürütülür. Test, mümkün olduğunda saf fonksiyon seviyesinde; kalıcı davranışlarda gerçek `Project`, gerçek `InMemoryDocumentStore`, gerçek `EditorApplication` ve gerçek history ile çalışmalıdır. Fake Project state oluşturarak Canvas’ı canonical domain’den izole etmek kabul edilmez.

| Matris alanı | Zorunlu doğrulama |
|---|---|
| Ön koşul ve aksiyon | Fixture, active Scene, seçim, pointer veya keyboard girdisi açıkça tanımlanır. |
| Beklenen sonuç | Geometry, selection, mode, z-order, snap veya command sonucu exact değerlerle ifade edilir. |
| Doküman mutasyonu | Mutasyon var, yok veya exact before/after karşılaştırmasıyla belirtilir. |
| History | History entry sayısı ve label mantığı; no-op/cancel için sıfır entry doğrulanır. |
| UI beklentisi | Selection outline, marquee, preview, snap guide, focus, dirty state veya menü davranışı gözlemlenir. |
| Edge case / fixture | Sınır değeri, locked/invisible durum, bozuk ID, farklı parent veya modifier kombinasyonu verilir. |
| Test tipi | Pure unit, integration/history, architecture/static veya browser olarak etiketlenir. |

# 4. Acceptance Matrix

## 4.1 Koordinatlar — C-01–C-09

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| C-01 | Sabit viewport ve CSS pointer ver; `screenToCanvas` çağır. | Pointer, viewport offset düşülerek doğru Canvas CSS pikseline dönüşür. | Yok. | 0 entry. | Preview geometry değişmez. | Sol/top viewport offset sıfırdan farklıdır. | Pure unit |
| C-02 | Canvas point’i bilinen Scene frame’e dönüştür. | `canvasToScene` doğru Scene koordinatını üretir. | Yok. | 0 entry. | Yok. | Letterbox alanındaki point reddedilir veya açık contract sonucu verir. | Pure unit |
| C-03 | Scene point’i Canvas frame’e dönüştür ve ters dönüşümü uygula. | `sceneToCanvas` ve `canvasToScene` floating-point toleransı içinde birbirinin tersidir. | Yok. | 0 entry. | Yok. | Fractional x/y değerleri korunur. | Pure unit |
| C-04 | Zoom değerini 50, 100 ve 200 yüzdeye değiştir; aynı Scene point’i test et. | Zoom yalnızca görünür dönüşümü değiştirir; committed Widget geometry değişmez. | Yok. | 0 entry. | Zoom readout ve device frame ölçeği değişir. | CSS transform ve `getBoundingClientRect` farkı test edilir. | Pure unit + browser |
| C-05 | Mevcut repository zoom davranışıyla viewport’u büyüt/küçült. | Scene origin ve geometry viewport yeniden boyutlandırmasında sabit kalır. | Yok. | 0 entry. | Aspect ratio korunur; widget oranı bozulmaz. | Panel resize ve scroll/letterbox birlikte denenir. | Integration/browser |
| C-06 | Pan için mevcut repository davranışı varsa Canvas’ı kaydır. | Pan yalnızca view transform’i değiştirir; Scene geometry değişmez. Yeni ürün gesture’ı varsayılmaz. | Yok. | 0 entry. | Pan cursor/viewport gözlemi yalnızca mevcut davranışa göre yapılır. | Pan tool seçiliyken select/drag ile karışmamalıdır. | Integration/browser |
| C-07 | Scene origin’i top-left kabul edilen fixture yükle; `(0,0)` ve sağ-alt köşeyi test et. | x sağa, y aşağı artar; origin top-left’tedir. | Yok. | 0 entry. | Widget pozisyonu beklenen ekranda görünür. | Negatif Scene point açıkça reddedilir veya canvas dışı kabul edilir. | Pure unit |
| C-08 | Floating-point `{x: 10.25, y: 20.5, width: 30.75, height: 40.125}` ile preview ve commit yap. | Hesaplama precision’ı korunur; unrelated rounding uygulanmaz. | Commit sonrası exact domain convention uygulanır. | Changed gesture 1 entry. | Preview ve committed geometry tutarlıdır. | NaN, Infinity ve fractional zero sınırları ayrıca DI-07’de test edilir. | Pure unit + history |
| C-09 | Geometry commit’ini mevcut Domain normalization convention’ına göre çalıştır. | Commit değerleri canonical convention’a uyar; Canvas kendi yeni rounding kuralını icat etmez. | Sadece intended Widget geometry değişir. | 1 entry, no-op ise 0. | Properties ve Canvas aynı değeri gösterir. | Aynı geometry’nin tekrar commit’i no-op olmalıdır. | Integration/history |

## 4.2 Hit testing — H-01–H-09

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| H-01 | Boş Canvas point’inde hit test çalıştır. | `null` döner; selection temizlenebilir. | Yok. | 0 entry. | Empty click selection’ı temizler. | Marquee başlangıcı için boş alan korunur. | Pure unit + browser |
| H-02 | Tek görünür Widget bounds içinde point ver. | Widget ID döner. | Yok. | 0 entry. | Widget selected state alır. | İç nokta ve tam merkez denenir. | Pure unit |
| H-03 | İki overlapping Widget fixture’ı kullan. | Effective z-order’a göre tek ve deterministik topmost ID döner. | Yok. | 0 entry. | Yalnız kazanan Widget selection alır. | Her iki widget visible ve unlocked olabilir. | Pure unit |
| H-04 | Farklı `zIndex` değerleriyle overlap test et. | Büyük effective z-order kazanır; document order DOM tesadüfüne bırakılmaz. | Yok. | 0 entry. | Görsel stacking ve selection aynı sonucu verir. | Negatif, sıfır ve pozitif z-order. | Pure unit + browser |
| H-05 | Eşit z-order, farklı Scene document order kullan. | Active Scene canonical document/widget order tie-break olur. | Yok. | 0 entry. | Sonuç her çalıştırmada aynıdır. | Stable ID yalnız document order ayırt edemezse son tie-break’tir. | Pure unit |
| H-06 | Widget’in dört boundary noktasına pointer ver. | Boundary inclusive olduğundan Widget hit olur. | Yok. | 0 entry. | Boundary click selection üretir. | Dört köşe ve edge midpoint. | Pure unit + browser |
| H-07 | `visible: false` Widget bounds içine pointer ver. | Canvas hit test sonucu Widget olmamalıdır. | Yok. | 0 entry. | Hidden Widget Canvas pointer target’ı olmamalı; Explorer ile seçilebilir olmalıdır. | Hidden ve locked kombinasyonu. | Pure unit + integration |
| H-08 | Locked Widget bounds içine pointer ver. | Hit test Widget’ı döndürür; selection mümkündür. | Yok. | 0 entry. | Locked görünümü ve selection outline görünür; move/resize disabled/no-op olur. | Locked-only selection. | Pure unit + browser |
| H-09 | Aynı point’te z-order, document order ve stable ID’nin tümü çakışacak fixture hazırla. | Sonuç stable ID tie-break ile deterministik olur. | Yok. | 0 entry. | Aynı sonuç tekrar üretilebilir. | Duplicate stable ID ayrıca DI-05’te defect’tir; burada tie-break fixture ID’leri benzersiz olmalıdır. | Pure unit |

## 4.3 Selection — S-01–S-09

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| S-01 | Hiç seçim yokken tek görünür Widget’a normal click yap. | Yalnız Widget seçilir. | Yok. | 0 entry. | Canvas, Explorer ve Properties aynı Widget’ı gösterir. | Locked ve invisible explicit-selection varyantları ayrıdır. | Integration/browser |
| S-02 | Seçim varken boş Canvas’a normal click yap. | Selection tamamen temizlenir. | Yok. | 0 entry. | Selection outline ve Properties context kaybolur. | Empty area, marquee başlamadan click. | Integration/browser |
| S-03 | Bir Widget seçiliyken `Ctrl` ile başka Widget’a click yap. | Additive selection iki benzersiz ID içerir. | Yok. | 0 entry. | İki outline ve multi-selection context görünür. | Windows modifier. | Integration/browser |
| S-04 | Bir Widget seçiliyken `Cmd` ile başka Widget’a click yap. | `metaKey` additive selection olarak çalışır. | Yok. | 0 entry. | Ctrl ile aynı UI sonucu. | Mac modifier; `ctrlKey` ile karıştırılmamalı. | Integration/browser |
| S-05 | Seçili Widget’a additive modifier ile tekrar click yap. | Widget toggle edilerek selection’dan çıkar. | Yok. | 0 entry. | Outline kalkar; selection context güncellenir. | Son ID çıkarıldığında `selection` state de null olmalıdır. | Integration |
| S-06 | Aynı Widget’a normal click ve additive click dizisi uygula. | Selection array hiçbir zaman duplicate ID içermez. | Yok. | 0 entry. | Tek outline; duplicate badge veya ikinci render yok. | Hızlı art arda pointer/click event’leri. | Pure unit + integration |
| S-07 | Widget’ları canonical Scene document order’dan farklı click-arrival order’ında additive seç. | Final selection canonical document/widget order’dadır; click sırası saklanmaz. | Yok. | 0 entry. | Explorer selection order ve Canvas order tutarlıdır. | Üç veya daha fazla widget. | Pure unit + integration |
| S-08 | Explorer’dan Widget seç, sonra Canvas selection’ı değiştir; Canvas’tan seç, sonra Explorer’a bak. | Tek ortak transient selection modeli korunur; Project değişmez. | Yok. | 0 entry. | Explorer, Canvas, Properties aynı selection snapshot’ını gösterir. | Additive cross-surface selection. | Integration |
| S-09 | Scene dışındaki veya artık silinmiş ID ile selection state’i dene. | Stale/unknown ID canonical selection’a sızmaz; selection temizlenir veya güvenli biçimde filtrelenir. | Yok. | 0 entry. | Properties blank veya valid context gösterir. | Silme sonrası selection cleanup. | Integration/domain |

## 4.4 Marquee — M-01–M-10

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| M-01 | Boş Canvas’ta pointer down ve threshold üstü sağa-aşağı hareket yap. | Normal marquee rectangle oluşur ve kesişen Widget’lar seçilir. | Yok. | 0 entry. | Marquee preview görünür; pointer up sonrası kalır. | Primary pointer gerekir. | Pure unit + browser |
| M-02 | Aynı marquee’yi ters yönde, sağ-alttan sol-üste çiz. | `normalizeRect` ile aynı rectangle ve aynı selection elde edilir. | Yok. | 0 entry. | Görsel rectangle yön bağımsızdır. | Negative dx ve dy birlikte. | Pure unit + integration |
| M-03 | Marquee yalnız tek Widget bounds’ını kesiyor olsun. | Yalnız o Widget seçilir. | Yok. | 0 entry. | Tek selection outline. | Widget marquee’nin içinde tamamen bulunabilir. | Pure unit |
| M-04 | Marquee birden fazla Widget bounds’ını kessin. | Tüm kesişen Widget’lar canonical order’da seçilir. | Yok. | 0 entry. | Multi-selection bounds/outline gösterilir. | Partial overlap. | Pure unit + integration |
| M-05 | Marquee edge’i Widget edge’ine tam değsin. | Edge-touch inclusive intersection kabul edilir. | Yok. | 0 entry. | Widget seçilir. | Dört edge ve köşe touch. | Pure unit |
| M-06 | Pointer down/up aynı point’te veya 4 CSS px ve altında hareket etsin. | Marquee başlamaz; davranış click/selection olarak değerlendirilir. | Yok. | 0 entry. | Marquee görünmez. | Exactly 0, 1 ve 4 px. | Integration/browser |
| M-07 | Mevcut selection varken `Ctrl` veya `Cmd` ile marquee çiz. | Hits mevcut selection’a additive ve duplicate-free eklenir; canonical order korunur. | Yok. | 0 entry. | Önceki ve yeni outline’lar görünür. | Ctrl ve Cmd ayrı test. | Integration |
| M-08 | Mevcut selection varken boş alanda non-additive marquee çiz. | Selection temizlenir. | Yok. | 0 entry. | Eski outline kaybolur; empty selection görünür. | Zero hit rectangle. | Integration |
| M-09 | Marquee’de locked Widget bounds’ı kes. | Locked Widget seçilebilir olarak kalır; geometry mutation hakkı kazanmaz. | Yok. | 0 entry. | Locked outline görünür, move/resize disabled/no-op. | Locked-only marquee. | Integration |
| M-10 | Marquee hidden Widget bounds’ını kessin. | Canvas marquee hit-testable olmayan hidden Widget’ı seçmez; explicit Explorer/selection-bounds yolu ayrı test edilir. | Yok. | 0 entry. | Hidden widget Canvas selection’ı olmamalıdır. | Hidden + visible overlap. | Pure unit + integration |

## 4.5 Drag / move — D-01–D-13

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| D-01 | Seçili Widget’a pointer down/up, hareket yok. | Click selection olur; drag başlamaz. | Yok. | 0 entry. | Selection güncellenir; geometry aynı kalır. | `pointerup` aynı coordinate. | Integration/browser |
| D-02 | Seçili Widget’ı 1 CSS px hareket ettir. | Threshold aşılmadığı için drag commit edilmez. | Yok. | 0 entry. | Preview veya drag mode oluşmaz. | Zoom 100 ve zoom 200. | Integration |
| D-03 | Seçili Widget’ı tam 4 CSS px hareket ettir. | `<= 4` click davranışıdır; geometry değişmez. | Yok. | 0 entry. | Click state; no move preview. | Her iki eksende 4 px. | Integration |
| D-04 | Seçili Widget’ı 4 CSS px üstünde hareket ettir. | Drag mode başlar; Scene delta ile preview geometry üretilir. | Preview transient; pointerup öncesi Project unchanged. | Pointerup öncesi 0 entry. | Drag preview görünür. | 4.01 CSS px ve fractional Scene delta. | Integration |
| D-05 | Tek unlocked Widget’ı common delta ile sürükle ve pointerup yap. | Exact `{x + dx, y + dy}` geometry commit edilir. | Yalnız Widget geometry değişir. | 1 logical entry. | Preview canonical geometry’ye dönüşür; dirty state true olur. | Snap disabled varyantı. | Integration/history |
| D-06 | Aynı Scene’de üç selected unlocked Widget’ı sürükle. | Her biri aynı Scene delta’yı alır; relative spacing korunur. | Üç geometry tek application mutation ile değişir. | 1 logical entry. | Tüm selection birlikte hareket eder. | Farklı width/height. | Integration/history |
| D-07 | Selection içinde locked ve unlocked Widget’ı birlikte sürükle. | Locked geometry unchanged; unlocked Widget’lar common delta alır. | Sadece mutable Widget’lar değişir. | 1 entry yalnız gerçekten change varsa. | Locked outline yerinde, diğerleri hareketli. | Locked first/last document order. | Integration/history |
| D-08 | Yalnız locked Widget seçip drag gesture yap. | Gesture no-op olur; selection korunur. | Değişiklik yok. | 0 entry. | Not-allowed veya locked feedback; preview commit edilmez. | Pointer down yine selection yapabilmelidir. | Integration/history |
| D-09 | Seçim dışı Widget’a pointer down ile drag başlat. | Widget seçim modeline göre seçilir ve yalnız uygun selection move edilir. | Pointerup sonrası yalnız yeni selection geometry’si değişir. | 1 entry if moved. | Önceki selection yerine Widget seçilir. | Additive modifier ile selection seti korunur. | Integration |
| D-10 | Drag preview oluştur, sonra pointercancel gönder. | Initial preview exact geri yüklenir; interaction idle olur. | Project byte-for-byte unchanged. | 0 entry. | Preview, capture ve guides temizlenir. | Pointercancel after threshold. | Integration/browser |
| D-11 | Drag sırasında pointer capture kaybolsun. | Interaction cancel olur; commit yapılmaz. | Değişiklik yok. | 0 entry. | Preview temizlenir; mode idle. | `lostpointercapture` event. | Integration/browser |
| D-12 | Drag sırasında window blur veya Escape gönder. | Interaction cancel olur; initial geometry geri gelir. | Değişiklik yok. | 0 entry. | Preview ve snap guides kaybolur. | Escape before and after threshold. | Integration/browser |
| D-13 | Pointerdown sırasında primary olmayan pointer button kullan. | Selection/drag/marquee/resize başlamaz. | Yok. | 0 entry. | Canvas normal UI davranışını korur. | Right/middle button; context menu ayrı davranır. | Integration/browser |

## 4.6 Resize — R-01–R-11

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| R-01 | Selected unlocked Widget üzerinde left handle delta uygula. | x ve width handle contract’ına göre değişir; width negatif olmaz. | Yalnız Widget geometry değişir. | 1 entry if changed. | Left handle preview doğru yönde görünür. | Minimum width clamp. | Pure unit + history |
| R-02 | Right handle delta uygula. | Width değişir; x sabit kalır. | Yalnız width değişir. | 1 entry if changed. | Right edge pointer ile hizalanır. | Snap enabled/disabled. | Pure unit + history |
| R-03 | Top handle delta uygula. | y ve height contract’a göre değişir; height negatif olmaz. | Yalnız Widget geometry değişir. | 1 entry if changed. | Top edge doğru preview verir. | Minimum height clamp. | Pure unit + history |
| R-04 | Bottom handle delta uygula. | Height değişir; y sabit kalır. | Yalnız height değişir. | 1 entry if changed. | Bottom edge doğru preview verir. | Large positive delta. | Pure unit + history |
| R-05 | NW, NE, SW ve SE corner handle’larını ayrı ayrı test et. | İlgili iki eksen birlikte transform edilir; anchor edge korunur. | Yalnız mutable geometry değişir. | 1 entry per completed gesture. | Dört handle görünür ve cursor yönleri doğrudur. | Corner crossing ve minimum size. | Pure unit + browser |
| R-06 | Delta minimum boyuttan küçük olacak şekilde resize et. | Width/height minimum dimension’ın altına inmez. | Geometry valid kalır. | 1 entry only if final differs. | Handle clamp noktasında durur. | Exact minimum ve minimum-1. | Pure unit |
| R-07 | Handle’ı karşı kenarın ötesine taşı. | Negative width/height oluşmaz; x/y anchor davranışı deterministic olur. | Malformed geometry commit edilmez. | 0 veya 1; no-op ise 0. | Preview geometry domain sınırında kalır. | Çok büyük negative delta. | Pure unit + domain |
| R-08 | En az iki unlocked Widget seç; selection bounding box üzerinden resize et. | Mutable Widget’lar bounding-box transform ile relative position/proportion korur. | Tek mutation ile tüm mutable geometry değişir. | 1 entry. | Multi-selection bounds ve handle tek reference frame kullanır. | Farklı boyut ve uzaklıkta widget’lar. | Pure unit + history |
| R-09 | Multi-resize selection’a locked Widget dahil et. | Locked geometry byte-for-byte unchanged; mutable olanlar transform edilir. | Sadece mutable geometry değişir. | 1 entry if mutable change. | Locked Widget bounding-box transform’dan görsel olarak hariç tutulur. | Tümü locked ise R-10. | Integration/history |
| R-10 | Yalnız locked Widget veya tümü locked selection resize et. | No-op. | Project unchanged. | 0 entry. | Resize handle aktif olmamalı veya commit edilmemeli. | Locked selection üzerinden explicit selection. | Integration/history |
| R-11 | Resize preview oluştur; Escape, pointercancel veya lost capture ile iptal et. | Initial geometry exact geri gelir; no history. | Byte-for-byte unchanged. | 0 entry. | Preview, handle active state ve guides temizlenir. | Cancel her cancellation kanalında ayrı çalışır. | Integration/browser |

## 4.7 Snapping — N-01–N-14

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| N-01 | Snap enabled, candidate grid line’a 6 Scene unit veya daha yakın olsun. | Grid candidate değerlendirilir ve eligible ise nearest kuralına göre snap olur. | Yalnız commit’te final geometry değişir. | 1 entry if changed. | Grid snap guide görünür. | Exact 6 unit boundary. | Pure unit |
| N-02 | Snap enabled, candidate grid line’dan 6 Scene unit’ten uzak olsun. | Grid snap uygulanmaz. | Final geometry candidate değerinde kalır. | 1 entry only if drag changed. | Grid guide görünmez. | 6.01 unit. | Pure unit |
| N-03 | Other Widget edge alignment threshold içinde olsun. | Edge candidate değerlendirilir. | Preview transient; commit pipeline unchanged. | 0 before pointerup. | Edge guide görünür. | Left-left, right-right, opposite edges. | Pure unit |
| N-04 | Other Widget center alignment threshold içinde olsun. | Center candidate değerlendirilir. | Sadece pointerup değişikliği commit edilir. | 1 if changed. | Center guide görünür. | X ve Y axis bağımsız. | Pure unit |
| N-05 | Grid ve Widget candidate’ları aynı anda eligible fakat uzaklıklar farklı olsun. | En yakın candidate kazanır; type priority yakın olmayan candidate’ı zorla seçmez. | Intended final geometry. | 1 if changed. | Kazanan guide tek ve deterministic. | Grid daha uzak, edge daha yakın; tersi de denenir. | Pure unit |
| N-06 | İki candidate exact equal distance’te olsun. | Tie-break `Grid → Edge → Center → stable ID` sırasını izler. | Yok. | 0 pure / 1 commit. | Kazanan guide deterministic. | Her tie pair ayrı test. | Pure unit |
| N-07 | Candidate threshold dışına çıkarılsın. | Snap yapılmaz; raw floating geometry korunur. | Commit raw geometry’yi kullanır. | 1 if drag changed. | Guide yok. | Her axis için ayrı outside-threshold. | Pure unit |
| N-08 | Multi-selection sürüklenirken snap reference kullan. | Selection bounding box snap reference olur; tek child geometry referans seçilmez. | Her mutable Widget common snapped delta alır. | 1 entry. | Bounding-box guide görünür. | Child’lardan biri candidate’a daha yakın olsa bile reference bbox’tır. | Pure unit + integration |
| N-09 | Active selection içindeki Widget’ları snap candidate listesine dahil et. | Self-snap exclusion uygulanır. | Yok. | 0 pure. | Self-guide oluşmaz. | Overlapping selected widgets. | Pure unit |
| N-10 | Grid görünür, snap disabled. | Grid çizilir fakat geometry snap olmaz. | Geometry raw kalır. | 1 if actual drag. | Grid visible, snap guide yok. | Toggle states independent. | Integration/browser |
| N-11 | Grid gizli, snap enabled. | Grid görünmese de snap calculation çalışır. | Final geometry snapped olabilir. | 1 if changed. | Snap guide görünür; background grid görünmez. | Grid visibility independent. | Integration/browser |
| N-12 | Snap enabled iken `snapValue`, `snapPoint`, `snapGeometry` pure fonksiyonlarını farklı axis config ile çalıştır. | X/Y axis kuralları ve geometry boyutları canonical primitive contract’a uyar. | Yok. | 0 entry. | Yok. | Fractional step ve disabled axis. | Pure unit |
| N-13 | Snap guide üret, sonra pointerup/cancel yap. | Guide yalnız transient’tir; commit edilen Project’e guide state girmez. | Domain guide alanı eklenmez. | Commit 1; cancel 0. | Pointerup/cancel sonrası guide temizlenir. | Re-render during drag. | Integration |
| N-14 | Equal-distance candidate’larda stable ID sırasını tersine çevirerek iki fixture çalıştır. | Stable ID tie-break deterministic fakat domain document order/z-order kurallarını ihlal etmez. | Yok. | 0 pure. | Her run aynı candidate’ı seçer. | Duplicate IDs DI-05’te ayrı defect’tir. | Pure unit |

## 4.8 Keyboard — K-01–K-11

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| K-01 | Widget selection varken plain Arrow tuşuna bas. | Selection 1 Scene unit hareket eder. | Application mutation ile geometry değişir. | 1 entry per logical key action. | Selection ve Properties güncellenir; dirty true. | Her dört yön. | Integration/history |
| K-02 | Selection varken `Ctrl/Cmd + Arrow` bas. | Configured snap-grid unit kadar hareket eder. | Canonical application mutation. | 1 entry. | Correct delta preview/commit. | Ctrl ve Cmd. | Integration/history |
| K-03 | Selection varken `Shift + Ctrl/Cmd + Arrow` bas. | `5 × snap-grid unit` hareket eder. | Canonical application mutation. | 1 entry. | Correct large-step movement. | Modifier order/browser event normalization. | Integration/history |
| K-04 | Selection varken Delete bas. | `EditorApplication.deleteSelection()` çağrılır. | Selected nodes exact silinir. | 1 entry. | Widget Canvas/Explorer’dan kaybolur; selection temizlenir. | Empty selection no-op. | Integration/history |
| K-05 | Selection varken Backspace bas. | Delete ile aynı canonical command davranışı. | Exact delete mutation. | 1 entry. | Delete ile aynı UI. | Text input focus varyantı K-10. | Integration/history |
| K-06 | Active drag/resize varken Escape bas. | Active interaction iptal edilir. | Project unchanged. | 0 entry. | Initial preview, handles ve guides geri gelir/kaybolur. | Before threshold ve after threshold. | Integration/browser |
| K-07 | Active Scene’de `Ctrl/Cmd + A` bas. | Active Scene’deki tüm Widget ID’leri canonical order’da seçilir. | Yok. | 0 entry. | All outlines; Explorer/Properties coherent. | Hidden Widget Canvas’ta doğrudan hit-test edilmez; select-all contract’ı ayrıca kararlaştırılmışsa explicit selection olarak doğrulanır. | Integration |
| K-08 | Widget selection varken `Ctrl/Cmd + D` bas. | `EditorApplication.duplicateSelection()` gerçek capability üzerinden çalışır. | Unique ID’li duplicate eklenir. | 1 entry. | Duplicate görünür ve selection policy explicit olarak doğrulanır. | Multiple selection ve locked selection. | Integration/history |
| K-09 | Selection varken yalnız `Shift + Arrow` bas. | Canonical movement shortcut değildir; geometry değişmez. | Yok. | 0 entry. | UI bunu move olarak raporlamaz. | Dört yön. | Integration |
| K-10 | Focus bir input, textarea veya contenteditable içindeyken shortcut bas. | Canvas keyboard command tetiklenmez; text editing korunur. | Yok. | 0 entry. | Input value ve caret davranışı korunur. | Properties geometry input, dialog input, contenteditable. | Integration/browser |
| K-11 | Canvas veya widget focus’unda Enter/Space ve modifier combination’larını test et. | Sadece açıkça tanımlı accessibility selection davranışı çalışır; unsupported key fake command üretmez. | Selection dışında mutation yok. | 0 veya gerçek command için 1. | Focus ring ve ARIA selection state tutarlı. | Keyboard click sonrası pointer suppression. | Integration/browser |

## 4.9 History — HST-01–HST-08

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| HST-01 | Known Project `before`; one completed single drag yap; `after` snapshot al; undo ve redo çalıştır. | Undo exact `before`, redo exact `after` üretir. | Exact structural equality. | Drag 1 entry. | Dirty state undo sonrası saved baseline’a göre doğru olur. | Floating geometry. | Integration/history |
| HST-02 | Multi-drag tamamla; before/after/undo/redo snapshots karşılaştır. | Tüm mutable Widget’lar tek gesture olarak geri/al ileri uygulanır. | Exact multi-widget state. | 1 entry, 2 veya daha fazla değil. | Relative spacing undo/redo’da korunur. | Mixed locked/unlocked. | Integration/history |
| HST-03 | Resize tamamla; before/after/undo/redo karşılaştır. | Exact resize transform geri/al ileri uygulanır. | Exact structural equality. | 1 entry. | UI geometry fields undo/redo ile senkron kalır. | Multi-resize ve minimum size. | Integration/history |
| HST-04 | Duplicate selection yap; before/after/undo/redo karşılaştır. | Unique ID ve duplicate content exact geri gelir. | One duplicate mutation. | 1 entry. | Duplicate UI’da görünür. | Multi-selection. | Integration/history |
| HST-05 | Delete selection yap; before/after/undo/redo karşılaştır. | Silinen hierarchy exact geri gelir; orphan oluşmaz. | One delete mutation. | 1 entry. | Selection cleanup doğru. | Widget, Scene, Group scope. | Integration/history |
| HST-06 | Drag veya resize cancel kanallarından birini kullan. | Initial state exact korunur. | No mutation. | 0 entry. | Dirty state değişmez. | Escape, pointercancel, lost capture, blur. | Integration/history |
| HST-07 | No-op drag, no-op resize ve locked-only gesture çalıştır. | Canonical application `changed: false` döner ve Project unchanged kalır. | Yok. | 0 entry. | No fake “committed” event/history. | Snap sonucu başlangıçla aynı. | Integration/history |
| HST-08 | Save baseline; mutation; dirty doğrula; undo; clean doğrula; redo; dirty doğrula. | Dirty state serialized current-vs-saved Project ile doğru geçiş yapar. | Mutasyonlar exact. | Entry count doğru. | Saved/Unsaved indicator doğru. | New Project ve history reset regresyonu A1-06’da ayrıca doğrulanır. | Integration/history |

## 4.10 Domain integrity — DI-01–DI-08

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| DI-01 | Widget ID mevcut fakat verilen `sceneId` yanlış parent’a ait; scoped geometry/property mutation çağır. | Mutation yanlış Scene’deki aynı ID’li Widget’a uygulanmaz; parent contract ihlali reddedilir veya no-op olur. | Project unchanged. | 0 entry. | Error/blocked feedback fake success olmadan gösterilir. | Aynı ID farklı Scene’lerde de fixture’lanır. | Domain/integration |
| DI-02 | `missing-widget` ID ile geometry, delete, duplicate ve property command çağır. | Her command güvenli no-op veya açık validation error verir. | Unchanged. | 0 entry. | UI stale selection üretmez. | `missing-widget`, empty IDs, whitespace IDs. | Domain/integration |
| DI-03 | `missing-scene` veya `missing-rotation` parent ile Widget mutation çağır. | Parent bulunamadığında mutation uygulanmaz; başka parent etkilenmez. | Unchanged. | 0 entry. | No fake success. | Valid widget ID + invalid parent ID. | Domain/integration |
| DI-04 | Domain graph’te gerekli Rotation veya Scene eksik fixture ile Canvas aç. | Canvas blank/crash olmaz; validation açık ve yapı değişmeden kalır. | No repair mutation. | 0 entry. | Blocking validation/error UI güvenli görünür. | Missing R0, missing Scene, empty Theme. | Domain/integration |
| DI-05 | Project, group, theme, rotation, Scene ve Widget scope’larında duplicate stable ID fixture oluştur. | Validation veya command boundary duplicate ambiguity’sini açıkça raporlar; yanlış node mutate edilmez. | Invalid document üzerinde sessiz mutation yok. | 0 veya explicit rejected command. | Warning/error path deterministic. | Widget ID duplicate kontrolü özellikle zorunludur; mevcut validator bunu açıkça kapsamıyor [6]. | Domain/static |
| DI-06 | Orphan Widget veya parent graph dışında referanslanan node üret. | Orphan node commit/export/selection pipeline’a sızmaz; validation defect’i görünür. | Unchanged veya rejected import fixture. | 0 entry. | Explorer ve Canvas canonical graph dışını göstermez. | Orphan Widget, orphan asset reference. | Domain/integration |
| DI-07 | Geometry `{width: -1}`, `{height: 0}`, `NaN`, `Infinity`, non-finite x/y veya malformed shape ile mutation çalıştır. | Invalid geometry commit edilmez; canonical document valid kalır. | Invalid geometry persist edilmez. | 0 entry for rejected mutation. | Validation issue veya blocked command. | Validator width/height positivity kontrol ediyor; x/y finiteness ve command boundary ayrıca test edilmelidir [6]. | Domain/integration |
| DI-08 | Failed interaction sırasında Project’in `structuredClone` veya canonical structural snapshot’ını before/after karşılaştır. | Failure sonrası Project byte-for-byte/structurally unchanged; unrelated groups, themes, rotations, scenes, widgets ve assets korunur. | No corruption. | 0 entry. | UI safe fallback; blank app yok. | Wrong parent, missing ID, malformed geometry, cancellation. | Integration/history |

## 4.11 Canonical mutation pipeline — P-01–P-07

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| P-01 | Static olarak App Canvas commit call-site’larını tara. | Persistent geometry yalnız `EditorApplication.setWidgetGeometries()` üzerinden gider. | Direct Project mutation yok. | History yalnız application/store tarafından oluşur. | UI console fake success üretmez. | `updateWidgetGeometries` yalnız pure helper/test fixture olarak kalabilir [3]. | Architecture/static |
| P-02 | Canvas transient preview sırasında React state ve canonical snapshot’ı eşzamanlı incele. | `geometryOverrides` transient’tir; canonical `project` preview ile mutate edilmez. | Pointerup öncesi Project unchanged. | 0 entry. | Preview görünür, Properties canonical/contract’a göre davranır. | Re-render during pointer move. | Integration |
| P-03 | `setWidgetGeometries` command’i locked Widget update’i ile çağır. | Application boundary locked geometry’yi son otorite olarak reddeder. | Unchanged for locked. | 0 if no mutable changes. | UI locked feedback. | Canvas filtering bozulsa bile core protection sürer [4]. | Integration/history |
| P-04 | Delete ve duplicate keyboard/context actions’ını gerçek application methods ile izleyerek çalıştır. | `deleteSelection` ve `duplicateSelection` gerçek capability’lere gider; Canvas-local array manipulation yoktur. | Exact canonical mutation. | 1 per command. | Selection/history/dirty state senkron. | Empty selection no-op. | Architecture/integration |
| P-05 | Context menu descriptor’larını selection kind’lara göre incele ve çalıştır. | Yalnız mevcut capability’ler görünür/etkin; fake success handler yoktur. | Unsupported command document değiştirmez. | 0 unsupported; 1 real mutation. | Disabled/omitted state açık. | Widget, Scene, Canvas, asset selection. | Architecture/integration |
| P-06 | Store subscription ve snapshot identity’yi one mutation, undo, redo boyunca ölç. | One logical mutation one snapshot notification üretir; React subscription stabil kalır. | Canonical current Project güncellenir. | History snapshot doğru. | UI stale kalmaz veya duplicate render notification üretmez. | `useSyncExternalStore` cached snapshot [5]. | Integration |
| P-07 | Her persistent gesture için spy/mock yerine gerçek Project before/after + undo/redo lifecycle kullan. | Test yalnız truthy result değil, exact behavior doğrular. | Exact structural equality. | One gesture one entry. | UI gözlemi domain sonucu ile eşleşir. | Fake Project state kullanımı yasak. | Test design/integration |

## 4.12 Agent 1 regression — A1-01–A1-10

| ID | Ön koşul ve aksiyon | Beklenen sonuç | Doküman mutasyonu | History | UI beklentisi | Edge case / fixture | Test tipi |
|---|---|---|---|---|---|---|---|
| A1-01 | Store snapshot’ını iki kez oku; mutation sonrası listener ve identity’yi ölç. | Cached snapshot stable; mutation sonrası yeni snapshot yayınlanır. | Exact current Project. | History snapshot doğru. | React stale snapshot göstermez. | `useSyncExternalStore` getSnapshot stability. | Integration |
| A1-02 | App render ve store subscribe lifecycle’ını çalıştır. | App canonical snapshot’a abonedir; duplicate Project owner oluşturmaz. | App render mutasyonu yok. | 0. | Blank/crash yok. | StrictMode render. | Architecture/integration |
| A1-03 | Add, geometry edit, delete ve duplicate’i EditorApplication üzerinden çalıştır. | Tüm mutation pipeline’dan geçer. | Exact before/after. | One per command. | Console/dirty/selection coherent. | Invalid/no-op commands. | Integration/history |
| A1-04 | Her Agent 1 mutation için undo uygula. | Exact before restore edilir. | Exact equality. | Undo stack azalır. | UI before state’e döner. | Nested hierarchy. | Integration/history |
| A1-05 | Undo sonrası redo uygula. | Exact after restore edilir. | Exact equality. | Redo stack doğru. | UI after state’e döner. | Redo branch mutation clears redo. | Integration/history |
| A1-06 | Save, mutate, undo ve redo ile dirty indicator’ı kontrol et. | Saved baseline’a eşitse clean; farklıysa dirty. | Saved/current serialization doğru. | History ve dirty ayrışmaz. | Topbar/statusbar doğru. | New Project history reset. | Integration/browser |
| A1-07 | New Project oluştur. | Current document yeni Project olur; eski history temizlenir. | Old Project sızmaz. | Undo/redo 0. | Selection, tabs ve Canvas reset olur. | Dirty old project. | Integration |
| A1-08 | Duplicate selection yap. | New IDs unique; nested content/geometry canonical duplicate policy’ye uyar. | One duplicate mutation. | 1 entry; undo/redo exact. | Duplicate görünür. | Multi selection. | Integration/history |
| A1-09 | Delete selection yap. | Correct parent hierarchy’den exact nodes silinir; unrelated nodes korunur. | One delete mutation. | 1 entry; undo/redo exact. | Selection cleanup. | Group, Theme, Rotation, Scene, Widget. | Integration/history |
| A1-10 | Locked Widget geometry mutation ve non-geometry property mutation çalıştır. | Geometry değişmez; izin verilen diğer property mutation’ı Agent 1 contract’ına göre çalışır. | Geometry protected. | Geometry no-op 0; property change 1. | Locked state görünür. | Canvas ve Properties iki giriş yolu. | Integration/history |

# 5. Mevcut Canvas static audit

Bu bölüm, Agent 2’nin gerçek implementation commit’i `f1306ac` sonrasında yapılmıştır. Önceki prototype’a ait bulgular yalnızca güncel HEAD’de hâlâ geçerliyse korunmuştur. Pure primitives ve yeni test dosyası önemli ilerleme sağlamıştır; ancak pure helper’ın bulunması, React event wiring ve gerçek history lifecycle’ının otomatik olarak kabul edildiği anlamına gelmez.

## 5.1 Olumlu bulgular

| Bulgu | Kanıt | Durum |
|---|---|---|
| Canonical Project ikinci bir Canvas store’unda tutulmuyor. | `App` store’u `useMemo` ile oluşturuyor, snapshot `useSyncExternalStore` üzerinden okunuyor [2]. | **PASS static; integration required** |
| Merkezi coordinate primitives eklendi. | `screenToCanvas`, `canvasToScreen`, `canvasToScene`, `sceneToCanvas`, aspect-ratio letterboxing, zoom/pan helper’ları mevcut [3]. | **PASS pure tests; App wiring unverified** |
| Pure hit test ve selection helpers eklendi. | Inclusive `containsPoint`, z-order/document-order `hitTest`, unique/order selection ve marquee filtering mevcut [3]. | **PASS pure tests; App hit path partial** |
| Pointer capture ve cancellation yüzeyi eklendi. | `setPointerCapture`, `releasePointerCapture`, `pointercancel`, `lostpointercapture`, Escape ve window blur yolları mevcut [2]. | **PASS static; browser/integration required** |
| Preview/commit ayrımı korunuyor. | `geometryOverrides` transient tutuluyor; pointerup `editorApplication.setWidgetGeometries()` çağırıyor [2]. | **PASS static; history integration unverified** |
| Multi-widget move ve selection-bounds resize için primitives ve UI state eklendi. | `getBounds`, `moveGeometry`, `resizeGeometry`, `transformGeometryWithinBounds` ve selection bounds mevcut [2] [3]. | **PARTIAL** |
| Snap candidate, threshold, nearest choice ve guide primitives eklendi. | `snapGeometryWithTargets` ve `calculateSnapGuides` mevcut; App self-selection dışı eligible Widget’ları geçiriyor [2] [3]. | **PARTIAL; threshold edge defect remains** |
| Keyboard commands gerçek application methods üzerinden bağlandı. | Arrow nudge, Delete/Backspace, Escape, Ctrl/Cmd+A ve Ctrl/Cmd+D App keydown handler’ında dispatch ediliyor [2]. | **PARTIAL; Shift+Arrow defect remains** |

## 5.2 Post-Agent-2 defect ve coverage bulguları

| ID | Severity | Bulgu | Kanıt | QA sınıflandırması |
|---|---|---|---|---|
| SA-01 | **HIGH** | Canonical threshold `<= 4 CSS px` click olmalıdır; implementasyon `Math.hypot(...) < 4` ile yalnız 4’ten küçük hareketi click sayıyor. Exactly 4 px drag/marquee başlatabilir. | Drag/marquee move guard’ları `< POINTER_DRAG_THRESHOLD`; pointerup marquee koşulu `>=` [2]. | D-03, M-06 **IMPLEMENTED AND FAILING** |
| SA-02 | **HIGH** | Pure `hitTest` mevcut ve testli olsa da App pointer path’i pure hit test kullanmıyor; DOM child event target’ı Widget’ı doğrudan move/selection handler’ına taşıyor. Hidden Widget için App-level Canvas hit exclusion bu nedenle garanti değil. | `hitTest` [3]; `renderCanvasWidget` her Widget’a `onPointerDown`/`onClick` bağlar [2]. | H-03–H-08 **PARTIAL / UNVERIFIED runtime** |
| SA-03 | **HIGH** | Invisible Widget pure marquee/hit helper’larında dışlanıyor; fakat `.is-invisible` CSS’i `pointer-events: none` uygulamıyor. Doğrudan hidden DOM child pointer event’i Canvas contract’ını bypass edebilir. | `marqueeSelection` visible/enabled filter’lar; CSS hidden class yalnız opacity/outline değiştirir [2] [3] [11]. | H-07, M-10 **IMPLEMENTED AND FAILING at UI path** |
| SA-04 | **MEDIUM** | `Cmd` desteği Canvas click/marquee üzerinde var; Explorer tree selection hâlâ `shiftKey || ctrlKey` ile sınırlı. Cross-surface Cmd selection tutarsızdır. | Canvas handlers metaKey kabul eder; `renderTreeNode` modifier kontrolünde metaKey yok [2]. | S-04, S-08 **IMPLEMENTED AND FAILING edge** |
| SA-05 | **HIGH** | Multi-resize için selection-bounds primitive ve overlay var; Widget-level UI yalnız dört corner handle render ediyor. Canonical left/right/top/bottom handle davranışı pure helper’da olsa da browser surface’te yok. | `renderCanvasWidget` handles yalnız `nw`, `ne`, `sw`, `se`; selection overlay da aynı dört handle’ı üretir [2]. | R-01–R-05 **PARTIAL / NOT IMPLEMENTED YET UI** |
| SA-06 | **HIGH** | Snap grid candidate’ı threshold dışındayken de candidates listesine ekleniyor. Edge/center candidates threshold ile filtrelenirken grid candidate `distance <= threshold` kontrolü yapmıyor. | `candidateForAxis` grid candidate’ı doğrudan push eder; threshold filtresi yalnız other-widget options’ta var [3]. | N-02 **IMPLEMENTED AND FAILING** |
| SA-07 | **HIGH** | Keyboard’da yalnız `Shift + Arrow` canonical movement shortcut olmamalı; mevcut handler modifier yoksa da Arrow movement yapıyor, yani Shift+Arrow plain Arrow gibi 1 Scene unit hareket ettiriyor. | `handleCanvasKeyDown` Arrow branch’inde `step` modifier yoksa 1 olarak atanıyor; Shift tek başına reddedilmiyor [2]. | K-09 **IMPLEMENTED AND FAILING** |
| SA-08 | **MEDIUM** | Coordinate primitives zoom/pan kabul ediyor; App `canvasTransform` ise sabit `{ zoom: 1, pan: {x: 0, y: 0} }` geçiriyor. Görsel wrapper CSS transform uygulasa da canonical view transform App’e açıkça bağlanmamış. | `canvasTransform` sabit; wrapper ayrıca `translate(pan) scale(zoom)` kullanıyor [2]. | C-04–C-06 **PARTIAL / UNVERIFIED integration** |
| SA-09 | **HIGH** | Multi-widget resize state yalnız editable Widget’ların bounds’ını kullanıyor. Bu, locked Widget’ların değişmemesi açısından doğru olabilir; ancak locked Widget’ın selection bounding-box reference’a dahil edilmesi gerektiği yorumuyla çelişebilecek bir acceptance ambiguity’sidir ve mixed-lock fixture ile doğrulanmalıdır. | `selectedEditableWidgets` ile selection bounds ve initial bounds hesaplanıyor [2]. | R-08–R-10 **UNVERIFIED contract edge** |
| SA-10 | **MEDIUM** | Keyboard handler app-shell seviyesinde; input/textarea/select/contenteditable korunuyor, fakat button/menu focus için ayrı focus boundary yok. Canvas shortcut’ları UI command button focus’unda da tetiklenebilir. | `handleCanvasKeyDown` yalnız text-entry target’larını early-return eder [2]. | K-10–K-11 **UNVERIFIED focus edge** |
| SA-11 | **CRITICAL** | `EditorApplication.setWidgetGeometries()` malformed geometry’yi finite/positive boundary’de reddetmiyor; validator width/height positivity kontrol ediyor ancak mutation boundary x/y finiteness ve malformed shape’i engellemiyor. | Core method verilen geometry’yi clone eder; validator kapsamı sınırlıdır [4] [6]. | DI-07 **CRITICAL acceptance gap** |
| SA-12 | **HIGH** | Wrong parent ID, duplicate Widget ID ve global ID uniqueness için canonical mutation scope guard’ı görünmüyor. `setWidgetGeometries` yalnız Widget ID ile tüm graph’ı tarıyor. | `resolveCanonicalNode` global traversal yapar; core geometry update parent ID almaz [2] [4]. | DI-01, DI-03, DI-05 **HIGH acceptance gap** |
| SA-13 | **MEDIUM** | Domain validator duplicate group/theme/project/widget IDs, orphan Widget ve wrong-parent invariant’larını açıkça doğrulamıyor. | Validator duplicate Rotation/Scene ID’lerini kontrol eder; Widget/global parent kontrolleri yoktur [6]. | DI-05–DI-06 **UNVERIFIED / coverage gap** |
| SA-14 | **LOW** | `updateWidgetGeometries` saf Project transformation’ıdır ve güncel App commit path’inde kullanılmıyor. Bu doğrudan defect değildir, ancak future architecture guard gerektirir. | App commit path `EditorApplication` kullanır; helper test yüzeyinde kalır [2] [3] [9]. | P-01 **PASS static; guard required** |
| SA-15 | **MEDIUM** | Yeni Canvas testleri pure helper kapsamındadır; gerçek React pointer lifecycle, `EditorApplication` history, undo/redo exactness, dirty state ve browser fixture akışı için Canvas-specific integration testi eklenmemiştir. | `tests/canvas-interaction.test.ts` 9 pure test içerir; mevcut 40 test içinde Canvas history integration yoktur [8] [13]. | HST, P-02–P-07 **UNVERIFIED / coverage gap** |

En önemli post-implementation sonuç şudur: Agent 2 artık birçok pure behavior için **IMPLEMENTED AND PASSING** durumundadır; ancak iki doğrudan runtime defect (exactly 4 px threshold ve Shift+Arrow), bir snap threshold defect’i, hidden Widget DOM hit bypass riski ve malformed geometry/domain boundary açıkları kapanmadan tamamlanmış kabul edilemez. Bu audit uygulama kodunu düzeltmez; bulguları kabul testlerinin önceliği olarak kaydeder.

## 5.3 Static audit sonucu

| Audit konusu | Sonuç |
|---|---|
| Canvas canonical Project sahibi mi? | **PASS static**; A1-01/A1-02 ve P-02 ile runtime doğrulama gerekli. |
| Direct Project/Widget mutation veya DocumentStore bypass | **PASS static**; Canvas commit path’i EditorApplication kullanıyor. |
| Pure coordinate, hit test, selection, marquee, resize, snap primitives | **PASS pure tests**; UI wiring ve canonical edge cases partial. |
| Pointer capture ve cancellation | **PASS static / UNVERIFIED browser**; event wiring mevcut. |
| Exactly 4 px threshold | **FAIL**; D-03 ve M-06 acceptance defect’i. |
| Invisible Widget Canvas hit exclusion | **FAIL at DOM path / PASS pure helper**. |
| Selection order ve Canvas Ctrl/Cmd | **PASS Canvas path / FAIL Explorer Cmd edge**. |
| Resize handle coverage | **PARTIAL**; pure all-direction support, UI corners only. |
| Snapping | **PARTIAL/FAIL**; nearest/guide mevcut, grid outside-threshold bug’ı var. |
| Keyboard | **PARTIAL/FAIL**; canonical commands mevcut, Shift+Arrow plain movement bug’ı var. |
| Geometry integrity boundary | **FAIL / CRITICAL GAP**. |
| Canvas integration/history/browser coverage | **UNVERIFIED/BLOCKED**. |

# 6. Domain integrity QA sözleşmesi

Domain graph `Project → ThemeProjectGroup → ThemeProject → Rotation → Scene → Widget` olarak korunmalıdır. Canvas’ın bir pointer gesture’ı, yanlış parent’a ait başka bir node’u değiştiremez. Her başarısız command için test; `structuredClone(before)`, interaction, `structuredClone(after)` ve history snapshot karşılaştırması yapmalıdır. `after` exact `before` olmalı veya validation sonucu açıkça raporlanmalıdır.

Mevcut validator pozitif width/height, duplicate rotation/Scene ID, asset referansları, scene priority ve profile uyumsuzluklarını kapsar; ancak wrong parent ID, duplicate Widget ID, orphan Widget, Project/group/theme global ID uniqueness ve x/y finite geometry koşulları için açık kontroller bulunmamaktadır [6]. Bu nedenle DI-01–DI-08 yalnız UI testi değil, domain boundary acceptance testidir.

Önerilen test fixture’ı şu minimum özellikleri taşımalıdır: benzersiz Project, group, theme, rotation, Scene ve Widget ID’leri; aynı Scene’de en az beş Widget; overlapping ve equal-z Widget’lar; visible, invisible, locked ve unlocked kombinasyonları; farklı geometry boyutları; dört Rotation; en az bir asset referansı. Browser smoke için mevcut `projectWithTheme()` fixture’ı başlangıç verisi olarak kullanılabilir; bu fixture dört Rotation, gerçek Scene ve media Widget içerir [10].

# 7. Browser QA planı

## 7.1 Fixture ve mevcut erişilebilirlik durumu

Browser testi **gerçek populated fixture** ile yapılmalıdır. Mevcut test suite’inde böyle bir fixture vardır, ancak uygulama bootstrap’i her açılışta `createEmptyProject()` kullandığı için fixture browser’a bağlanmış değildir [2] [10]. Bu nedenle aşağıdaki prosedür bir **hazır kabul prosedürü**dür; current HEAD için sonucu **BLOCKED**, fixture wiring sağlandığında ise adım adım uygulanacak beklenen gözlemler olarak kaydedilir. UI davranışı bu prosedürde icat edilmemiş, yalnızca prompttaki canonical senaryo ve mevcut uygulama yüzeyleri kullanılmıştır.

## 7.2 Exact 21-step smoke sequence

| Adım | Aksiyon | Beklenen UI gözlemi | Mutasyon/history doğrulaması |
|---|---|---|---|
| B-01 | Uygulamayı aç. | Application shell blank/crash olmadan açılır; Project Explorer, Canvas, Properties ve status bar görünür. | Initial document clean; history empty. |
| B-02 | Populated Scene’i aç/seç. | Device frame active Rotation dimensions ile görünür; gerçek Widget’lar Canvas’ta görünür. | Document unchanged. |
| B-03 | Bir Widget seç. | Widget outline, Explorer row ve Properties aynı ID’yi gösterir. | Selection yalnız transient; history 0. |
| B-04 | Widget’a click without movement yap. | Selection korunur; geometry preview başlamaz. | Project unchanged; history 0. |
| B-05 | Widget’ı threshold üstünde drag et. | Preview common delta ile hareket eder; pointerup sonrası canonical geometry görünür. | One application mutation; history +1. |
| B-06 | Undo yap. | Widget exact initial geometry’ye döner. | History undo; document exact before. |
| B-07 | Redo yap. | Widget exact post-drag geometry’ye döner. | History redo; document exact after. |
| B-08 | İki veya daha fazla Widget’ı Ctrl/Cmd ile multi-select yap. | Outlines ve multi-selection context görünür; order deterministic. | No document mutation; history unchanged. |
| B-09 | Multi-selection’ı drag et. | Mutable Widget’lar relative spacing’i koruyarak birlikte hareket eder; locked varsa sabit kalır. | One logical mutation; history +1. |
| B-10 | Undo yap. | Multi-drag exact initial state’e döner. | Exact before; one entry undone. |
| B-11 | Seçili Widget’ı resize et. | Handle ve preview doğru anchor/minimum-size davranışı gösterir. | Pointerup sonrası one mutation. |
| B-12 | Undo yap. | Resize exact initial geometry’ye döner. | Exact undo; history transition correct. |
| B-13 | Duplicate komutunu çalıştır. | New unique ID’li Widget görünür; fake success log yoktur. | One duplicate mutation; history +1. |
| B-14 | Delete komutunu çalıştır. | Selected Widget Canvas/Explorer’dan kaybolur; selection cleanup yapılır. | One delete mutation; history +1. |
| B-15 | Yeni bir drag başlat, threshold’u aş, Escape gönder. | Preview initial geometry’ye döner; active drag/guide/handle temizlenir. | Project unchanged. |
| B-16 | History/UI state’i kontrol et. | Escape gesture için yeni history entry görünmez. | Cancel = 0 entry. |
| B-17 | Save yap. | Saved/clean indicator görünür. | Current = saved baseline. |
| B-18 | Herhangi bir gerçek mutation yap. | UI değişikliği ve dirty indicator görünür. | Current ≠ saved; history +1. |
| B-19 | Dirty state’i doğrula. | Topbar/statusbar `Unsaved changes` veya repository’deki eşdeğer temiz/dirty gözlemi görünür. | Serialized current-vs-saved ayrımı doğru. |
| B-20 | Undo yap. | Document saved baseline’a döner. | Current = saved; history undo. |
| B-21 | Clean state’i doğrula. | UI `Saved`/clean durumunu gösterir; redo mümkünse redo state ayrıca görünür. | Dirty false; exact saved document. |

Browser test sonucu, her adım için ekran gözlemi ve before/after serialized Project snapshot’ıyla kaydedilmelidir. Populated fixture wiring olmadan B-01–B-21 **UNVERIFIED/BLOCKED** kalır; bu durum Agent 2 defect’i olarak değil, browser fixture erişim eksikliği olarak sınıflandırılır.

# 8. Failure classification ve acceptance gate

## 8.1 Severity

| Severity | Canvas QA örnekleri |
|---|---|
| **CRITICAL** | Blank/crashing application, Project corruption, history corruption, direct mutation bypass, wrong undo/redo document, locked geometry mutation, duplicate IDs, malformed geometry persistence. |
| **HIGH** | Incorrect multi-selection movement, resize transform, snapping, cancellation, keyboard semantics, hit testing, wrong parent mutation. |
| **MEDIUM** | Visual selection inconsistency, deterministic order defect, missing browser coverage, incomplete guide cleanup. |
| **LOW** | Runtime defect olmadan test coverage gap veya documentation mismatch. |

## 8.2 Agent 2 completion gate

| Gate alanı | Current HEAD değerlendirmesi |
|---|---|
| Architecture | **PASS static / UNVERIFIED runtime** — direct bypass görülmedi; full runtime architecture ve React/store integration testleri eksik. |
| Selection, hit testing, marquee | **PARTIAL** — pure helpers PASS; App DOM path hidden hit exclusion ve runtime hit routing için kabul testi gerekli. |
| Drag, multi-drag, cancellation | **PARTIAL / IMPLEMENTED AND FAILING** — capture/cancel yüzeyi var; exactly-4px threshold defect’i ve history integration unverified. |
| Resize | **PARTIAL** — pure all-direction and bbox primitives exist; UI only corner handles and integration/history unverified. |
| Snapping | **PARTIAL / IMPLEMENTED AND FAILING** — nearest candidate and guides exist; grid outside-threshold defect remains. |
| Keyboard | **PARTIAL / IMPLEMENTED AND FAILING** — canonical commands are wired; Shift+Arrow incorrectly moves and focus edge cases are unverified. |
| History | **PASS core / UNVERIFIED Canvas integration** — EditorApplication no-op guard ve Agent 1 tests mevcut; Canvas gesture lifecycle tamamlanmalı. |
| Domain | **FAIL / CRITICAL GAP** — core locked protection mevcut; malformed geometry, wrong parent ve duplicate ID acceptance açıkları var. |
| Verification | Typecheck/tests/build **PASS**; 6 test dosyası ve 40 test başarılı. Tauri check **BLOCKED** çünkü `cargo` yok; browser smoke **BLOCKED** çünkü populated fixture App’a bağlı değil. |
| Final gate | **BLOCKED — not FAILED**. Agent 2 pure foundation önemli ölçüde mevcut; ancak SA-01, SA-03, SA-06, SA-07 ve SA-11/12 kapanmadan COMPLETE değildir. |

Agent 2 ancak tüm **CRITICAL** ve **HIGH** acceptance senaryoları PASS olduğunda, 119 senaryonun tamamı için sonuç kaydı bulunduğunda, Agent 1 regression suite korunup tekrar PASS olduğunda, `typecheck`, `test`, `build`, uygun ortamda `tauri:check` ve populated browser smoke tamamlandığında `COMPLETE` olabilir. “Test çalışmadı” sonucu PASS olarak raporlanamaz.

# 9. Test implementasyon spesifikasyonu

Canvas pure testleri için `tests/canvas-interaction.test.ts` veya repository’nin eşdeğer test dosyası kullanılmalıdır. Test fixture’ları gerçek Domain `Project` graph’ından türetilmeli; test içinde yalnız `{x, y}` döndüren truthy assertion’lar kullanılmamalıdır. Minimum assertion kalıbı şu lifecycle’dır:

```ts
const before = structuredClone(currentProject(store));

performInteraction();

const after = structuredClone(currentProject(store));
expect(after).toEqual(expectedAfter);
expect(store.getSnapshot().history.undoCount).toBe(expectedEntryCount);

expect(store.undo()).toBe(true);
expect(currentProject(store)).toEqual(before);

expect(store.redo()).toBe(true);
expect(currentProject(store)).toEqual(after);
```

Pure testlerde store veya React state okunmamalıdır. Integration/history testlerinde gerçek `EditorApplication` ve `InMemoryDocumentStore` kullanılmalıdır. Pointer lifecycle testleri event sequence’i, threshold crossing’i, pointer capture/cancel event’lerini, transient preview ile canonical Project ayrımını ve final history count’ını birlikte doğrulamalıdır. Architecture testleri source-level guard olarak Canvas call-site’larında `replaceCurrent`, direct Project assignment veya persistent `updateWidgetGeometries` kullanımını reddetmelidir; saf helper’ın test fixture’ında kullanılması tek başına defect değildir.

# 10. Agent 3 teslim ve commit sınırı

Bu audit sırasında application code, Agent 1 code veya Agent 2 code değiştirilmemiştir. Bu commit yalnızca aşağıdaki dokümanı içermelidir:

```text
docs(canvas): add Agent 3 QA acceptance plan
```

Untracked dependency metadata’sı olan `pnpm-lock.yaml` ve `pnpm-workspace.yaml`, yalnızca local dependency setup sırasında oluşmuşsa commit’e alınmamalı; commit öncesi çalışma ağacından kaldırılmalıdır. `dist/` veya başka build çıktıları da commit’e dahil edilmemelidir.

## References

[1]: ./AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md "Agent 2 — Canvas Interaction Foundation Implementation Plan"
[2]: ../src/App/App.tsx "Current Canvas and Editor Application integration"
[3]: ../src/App/canvas-interaction.ts "Current Canvas pure helper module"
[4]: ../src/Core/editor-application.ts "Canonical editor mutation application layer"
[5]: ../src/Core/document-store.ts "DocumentStore snapshot, history and dirty-state implementation"
[6]: ../src/Core/validation.ts "Canonical domain validation layer"
[7]: ../src/App/editor-commands.ts "Editor command descriptors and selection filtering"
[8]: ../tests/editor-pipeline.test.ts "Agent 1 editor pipeline regression tests"
[9]: ../tests/ui-phase2.test.ts "Existing UI phase-2 and Canvas helper tests"
[10]: ../tests/domain-runtime.test.ts "Populated project fixture and domain/runtime tests"
[11]: ../src/App/app.css "Canvas visual and pointer interaction styles"
[12]: ../package.json "Repository verification scripts"
[13]: ../tests/canvas-interaction.test.ts "Agent 2 Canvas pure interaction tests"
