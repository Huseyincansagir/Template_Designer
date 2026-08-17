# Template Designer — Widgets, Medya ve Tema Sözleşmesi

> **Kaynak:** Kullanıcı tarafından sağlanan `Template Designer Widget ve Tema Sözleşmesi.md` ve verilen Template Designer ekran referansları. Bu belge, uygulamanın widget/medya UX'ini ve domain davranışını implementasyon için görünür hale getirir. Kaynak sözleşme her zaman nihai otoritedir.

## 1. Tema zihinsel modeli

Tema yalnızca görsel yerleştirme dosyası değildir. Tema; dört fiziksel form, kanonik sahneler, widget'lar, stiller, hazırlanmış medya, dil/ses/glyph bağları, test programı ve hedef firmware profil sözleşmesinin birlikte çalıştığı bir proje modelidir.

```text
ThemeProject
├── Forms: r0 / r90 / r180 / r270
├── Scenes
├── Widgets
├── Styles
├── Media / Assets
├── Languages / Audio / Glyphs
├── Anchors / Overrides
├── Test Program
└── Firmware Profile
```

Editor, Preview, Test, Validation ve Publish aynı canonical project modelinden beslenmelidir.

## 2. Fiziksel formlar

Dört form zorunludur ve bağımsız geometri taşır:

| ID | Yön | Çözünürlük |
|---|---:|---:|
| `r0` | 0° | 720×1280 |
| `r90` | 90° | 1280×720 |
| `r180` | 180° | 720×1280 |
| `r270` | 270° | 1280×720 |

Widget eklendiğinde başlangıç geometrisi dört forma da oluşturulabilir; kullanıcı daha sonra her formda `x/y/w/h`, layer, anchor, background/media/glyph bağlarını bağımsız değiştirebilir. Publish için dört formun tamamında çözülmüş widget geometrisi bulunmalıdır.

## 3. Kanonik sahneler

| ID | Kullanıcı etiketi | Sınıf | Varsayılan |
|---|---|---|---|
| `yangin` | Yangın | Alarm | `uyari` açık; `kat_no` ve `ok` kapalı |
| `estop` | Acil durdurma | Alarm | `uyari` açık; `kat_no` ve `ok` kapalı |
| `asiri_yuk` | Aşırı yük | Alarm | `uyari` açık; `kat_no` ve `ok` kapalı |
| `servis_disi` | Servis dışı | Alarm | `uyari` açık; `kat_no` ve `ok` kapalı |
| `kapi_ac` | Kapı açık | Normal | normal widget matrisi |
| `kapi_kapa` | Kapı kapanıyor | Normal | normal widget matrisi |
| `seyir_yukari` | Yukarı seyir | Normal | kat/ok kullanılabilir |
| `seyir_asagi` | Aşağı seyir | Normal | kat/ok kullanılabilir |
| `bosta` | Boşta | Normal | kat/ok kullanılabilir |

Alarm görünürlüğü **fail-closed** olmalıdır. Eksik görünürlük bilgisi normal seyir widget'larını alarm ekranında otomatik açmamalıdır. Warning kaynağı da alarm sahnesi başına ayrı bağlanmalıdır.

## 4. Resmî Designer widget paleti

| Widget ID | Kullanıcı etiketi | Kategori | Medya | Stil | Scene override | Anchor | Sistem |
|---|---|---|---:|---:|---:|---:|---:|
| `background` | Arka plan | Cihaz | ✓ | ✓ | ✓ | — | ✓ |
| `kat_no` | Kat numarası | Cihaz | — | ✓ | ✓ | ✓ | ✓ |
| `ok` | Yön oku | Cihaz | ✓ | ✓ | ✓ | ✓ | ✓ |
| `uyari` | Uyarı | Cihaz | ✓ | ✓ | ✓ | ✓ | ✓ |
| `logo` | Logo | Cihaz | ✓ | ✓ | ✓ | ✓ | ✓ |
| `saat` | Saat / tarih | Cihaz | — | ✓ | ✓ | ✓ | ✓ |
| `kat_listesi` | Kat listesi | Cihaz | — | ✓ | ✓ | ✓ | ✓ |
| `video` | Video | Medya | ✓ | ✓ | ✓ | ✓ | — |
| `media_sequence` | Medya dizisi | Medya | ✓ | ✓ | ✓ | ✓ | — |
| `kapı_animasyonu` | Kapı animasyonu | Medya | ✓ | ✓ | ✓ | ✓ | — |
| `metin` | Metin | İçerik | — | ✓ | ✓ | ✓ | — |
| `overlay` | Saydam katman | Görsel | ✓ | ✓ | ✓ | ✓ | — |

### 4.1 Widget ortak modeli

Her widget en az şunları taşır:

- benzersiz teknik `id`
- kullanıcıya görünen `name`
- `type`
- `layer`
- `enabled`
- opsiyonel `locked`
- dört form için geometri
- sahne görünürlük matrisi
- scene/form overrides
- `style_id` gerektiğinde
- `media_binding` gerektiğinde
- türe özel `properties`

Teknik widget adları kullanıcı sözleşmesine sabitlenmemelidir. Özellikle kullanıcı `video1` gibi isimler görmemelidir; kullanıcı **Video** ekler, sistem benzersiz teknik ID üretir.

## 5. Widget davranışları

### `background`

Statik görsel veya desteklenen profillerde video arka planı olabilir. Form arka planı olarak çalışır.

### `kat_no`

Anlık kabin katını digit/glyph sistemiyle gösterir. Tek/çift hane, negatif kat ve farklı glyph genişlikleri nedeniyle content anchor kullanımı önemlidir. Hedef profil digit hücresi sınırı uygulanır.

### `ok`

Yukarı/aşağı yönünü gösterir. Statik görsel ok veya desteklenen profilde medya/animasyon olabilir. Kat numarasına göre bağıl konumlandırılabilir.

### `uyari`

Yangın, acil durdurma, aşırı yük ve servis dışı alarm görsellerini temsil eder. Tek warning dosyası bütün alarm sahnelerini temsil etmez; sahne başına ayrı kaynak eşleşmesi gerekir.

### `logo`

Saydam PNG/BMP/RAW gibi kaynakları destekleyebilen dekoratif marka/ürün widget'ıdır. Alpha, fit, layer ve scene visibility önemlidir.

### `saat`

Firmware RTC snapshot'ından gelen zamanı gösterir. Designer saat formatını ve glyph sözleşmesini tanımlar; gerçek zamanın sahibi firmware RTC'dir. En az `0–9`, `:`, `.`, gerekiyorsa boşluk ve 12 saat için `A/M/P` glyphleri doğrulanır.

### `kat_listesi`

Birden fazla kat/hedef etiketini gösteren ayrı bir widget'tır. `kat_no` ile aynı şey değildir. `floors.csv` veya ilgili liste manifestiyle beslenebilir; alan geometrisi, satır adımı, stil, hizalama ve tekrar davranışı bulunabilir.

### `video`

Kullanıcı **Video** ekler; sistem benzersiz teknik ID verir. Video; arka plan, kapı hareketi, yön oku animasyonu, dekoratif alan veya sahne içeriği olabilir. Kaynak MP4/MOV/MKV/AVI gibi formatlardan gelir; hedef firmware için gerekli MJPEG AVI üretilir. Profilin video slot sınırı publish'i belirler.

### `media_sequence`

Fotoğraf ve videoları tek zaman çizelgesinde birleştirir. Her öğe en az `media_id`, `duration_ms`, `repeat_mode` (`once`/`forever`/`count`), `repeat_count`, `audio_binding`, `audio_policy` (`none`/`replace`/`mix`) ve `fit` (`cover`/`contain`) taşır. Hedef profil sequence ve ilgili ses yeteneklerini desteklemiyorsa publish edilemez.

### `kapı_animasyonu`

Kapı açma/kapanma gibi kısa hareketli içeriklerin kullanıcıya yönelik işlevsel widget'ıdır. Teknik olarak video/media sequence hedeflerine bağlanabilir. `kapi_ac` ve `kapi_kapa` sahneleriyle görünürlük ve playback politikası ilişkilendirilir.

### `metin`

Sabit veya çok dilli metin içeriğidir. Dil ID, fallback dili, glyph seti, hizalama, satır kırma, taşma ve stil bilgileriyle tanımlanır. Desteklemeyen firmware profiline sessizce rasterleştirilmemelidir.

### `overlay`

Saydamlık, renk filtresi, karartma veya vurgu yüzeyi sağlayabilir. Firmware'de bağımsız overlay yoksa profil desteğine göre görsele dönüştürülmeli veya açıkça reddedilmelidir; sessizce yok sayılamaz.

## 6. Scene override sistemi

Bir widgetın temel form yerleşimi ortak olabilir; scene/form override yalnız gerekli istisnayı taşır. Desteklenen override kavramları `visible`, `geometry`, `placement`, `style_id`, `media_binding`, `layer`, `enter_action`, `exit_action` ve `audio_action` alanlarını kapsar. Override silindiğinde widget taban form davranışına dönmelidir; widget projeden silinmez.

## 7. Anchor sistemi

Anchor bileşenleri:

- hedef türü: `canvas`, `safe_area`, `widget`
- hedef ID
- hedef kutusu: `frame` veya `content`
- hedef noktası: 9 noktalı referans sistemi
- kendi noktası
- X/Y offset
- fallback: `freeze_geometry`, `hide`, `use_frame`

Örnek: yön okunu kat numarasının gerçek sağ content kenarından 24 px uzağa bağlamak için `kat_no` + `content` + `right_center` hedefi, okun `left_center` noktası ve `offset_x=24` kullanılabilir.

`content` anchor yalnız `dynamic_content_anchor` capability'si olan `h747_dsi_v2_layout` profilinde güvenle yayınlanabilir. Anchor graph'ında cycle, bilinmeyen hedef, ekran dışı sonuç veya çözülemeyen fallback bulunamaz.

## 8. Stil sistemi

Stil widgetın görsel varyantıdır. Ürün düzeyinde sabit stil sayısı sınırı yoktur. Stil; widget türü, ad, sürüm, parametreler, kullanılan assetler, capability'ler ve `firmware_selectable` alanını taşır.

`firmware_selectable=false` stiller Designer preview'da kullanılabilir ancak firmware stil kataloğuna gönderilmez. `true` olanlar `style_catalog.json` ve gerçek firmware asset/manifest kayıtlarına export edilir.

Cihazın global `SOUND`, `VOLUME`, `LANG` gibi ayarları stil içine sessizce gömülmez.

## 9. Medya kaynakları ve dönüşüm

Designer kaynak dosyayı saklar; cihaz paketine firmware'in hedeflediği hazırlanmış dosya yazılır.

| Kaynak | Hedef | Kullanım |
|---|---|---|
| PNG/JPG | RAW/BMP veya profilin istediği görsel | arka plan, logo, uyarı, ok, overlay |
| MP4/MOV/MKV | MJPEG AVI | video, arka plan, kapı animasyonu |
| Video ses akışı | PCM WAV | video eşlik sesi / ortak ses |
| WAV/MP3/OGG | desteklenen WAV hedefi | anons, alarm, medya sesi |
| Glyph kaynakları | font/glyph atlası + manifest | kat, saat/tarih, metin |

Kaynak dosyanın var olması hedef dosyanın var olduğu anlamına gelmez. Gerekli dönüşüm tamamlanmadan publish başlatılamaz. Manifestte fiziksel olarak bulunmayan hedef dosya gösterilemez.

## 10. Dil ve ses

Üç dil katmanı vardır: UI dili, görsel metin dili ve ses dili. Görsel metin ve ses için fallback dili açıkça tanımlanmalıdır. Tema exportu cihazın global dil ayarını sessizce değiştirmemelidir.

## 11. Test programı

Test blokları `floor`, `scene`, `wait` türlerindedir. Başlangıç test akışı:

```text
-1 → 16 → yangin → asiri_yuk → estop → 16 → 0
```

Test preview placeholder dikdörtgenlerden oluşmamalıdır. Gerçek widget snapshot'ı, görseller, videonun kareleri ve bağlı ses oynatma durumu kullanılmalıdır. Her test adımı en az seçili formu, sahneyi, kat etiketini, görünür widget listesini, resolved geometriyi, bağlı medyayı, beklenen sesi ve hata/uyarı durumunu göstermelidir.

## 12. Designer → firmware widget mapping

| Designer | Firmware |
|---|---|
| `background` statik | `image` |
| `background` video | `media` |
| `kat_no` | `digit` |
| `ok` | `arrow` veya `media` |
| `uyari` | `image` / `media` |
| `logo` | `image` |
| `saat` | `clock` |
| `kat_listesi` | `list` |
| `video` | `media` |
| `media_sequence` | `media` / sequence manifesti |
| `kapı_animasyonu` | `media` |
| `metin` | `text` |
| `overlay` | profile göre `image` veya reddet |

Karşılığı olmayan widget hedef profile göre seçilebilir olmamalı veya publish'te kesin hata üretmelidir.

## 13. Firmware hedef profilleri

| Profil | Video | Sequence | Video background | Content anchor | Stil kataloğu | Digit |
|---|---:|---:|---:|---:|---:|---:|
| `h747_dsi_v1` | 1 | Hayır | Hayır | Hayır | Hayır | 3 hücre |
| `h747_dsi_v2_media` | 2 | Evet | Evet | Hayır | Evet | 3 hücre |
| `h747_dsi_v2_layout` | 2 | Evet | Evet | Evet | Evet | 6 hücre |

Profil yalnız UI filtresi değildir; gerçek publish capability'sidir.

## 14. Publish kabul kapısı

Publish şu durumlarda durmalıdır: tema kimliği uyuşmazlığı; dört formdan birinin eksikliği; duplicate widget ID; alarmda açık izin olmadan `kat_no`/`ok`; yanlış warning kaynağı; ekran dışı/negatif geometri; anchor cycle/unknown target/unsupported content anchor; eksik glyph veya digit limit aşımı; eksik kaynak veya tamamlanmamış dönüşüm; video slot sınırı; eksik sequence media/audio; eksik saat glyphleri; eksik `tema.cfg`, audio, font veya bağlı görsel; global cihaz ayarlarının sessizce değiştirilmesi.

Kullanıcıya teknik exception değil, hangi form/sahne/widget/asset üzerinde ne yapması gerektiği söylenmelidir.

## 15. Yeni widget ekleme kuralı

Yeni bir widget yalnızca palette bir buton eklenerek tamamlanmış sayılmaz. Domain registry, varsayılan geometri, preview renderer, Properties alanları, scene/visibility davranışı, medya/stil/anchor davranışı, Designer → firmware export mapping, profile capability, validator ve contract/regression test birlikte hazırlanmalıdır.

## 16. Görsel referanslardan çıkarılan UX

Verilen ekran görüntülerindeki ürün dili korunmalıdır: profesyonel engineering/design tool görünümü; açık çalışma alanı; ortada koyu cihaz/display canvas; sağda contextual Properties inspector; solda navigation/theme/library/layers/resource alanları; teal/cyan vurgu; güçlü selection state; Theme Library içinde tema kartları ve dört orientation; Design Studio'da canvas + layers + properties; Media Library'de kaynak/preview/conversion durumu; Test Studio'da blok tabanlı test sequence; Publish ekranında validation/readiness ve SD deployment.

Ekran görüntüleri pixel-perfect kopyalanacak UI spesifikasyonu değildir; ürünün bilgi mimarisi ve etkileşim referansıdır.

## 17. Ana prensip

**Kullanıcı sade bir şekilde “Uyarı ekle”, “Video ekle”, “Yön okunu kat numarasına bağla” demelidir.** Designer arka planda doğru form, sahne, layer, geometry, media, style, anchor, capability, manifest ve gerçek firmware hedef dosyasını üretmelidir.

Tema = **formlar + sahneler + widgetlar + stiller + medya + dil/ses/glyph bağları + test + firmware profile**.
