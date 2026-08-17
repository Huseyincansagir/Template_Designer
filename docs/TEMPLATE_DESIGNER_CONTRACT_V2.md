# Template Designer — Ürün, Widget ve Tema Sözleşmesi v2

> Bu belge, sohbet içinde sağlanan `Template Designer Widget ve Tema Sözleşmesi.md` kaynağının ve son ürün kararlarının canonical taslak sözleşmesidir. Eski sözleşmedeki artık geçerli olmayan anchor/glyph/tek-uyarı varsayımları bu belgeyle değiştirilmiştir.

## 1. Temel prensip

**Runtime data determines what the template shows. The template determines how that data is presented.**

Template Designer sabit ekranlar çizmez. Cihazdan/seri haberleşmeden gelen runtime data, generic runtime state/event engine üzerinden widgetların hangi içerikleri göstereceğini belirler.

```text
Serial / Runtime Data
        ↓
Runtime State
        ↓
Conditions + Priority
        ↓
Widget / Content Binding
        ↓
Renderer
        ↓
Display
```

Asansör kontrolcüsü runtime truth'tur. Designer kat/yön gibi değerleri kendi hesaplamaz; gelen değeri gösterir. Aynı engine ileride aydınlatma, fan, enerji, sensör, bakım vb. başka cihaz verilerini de desteklemelidir.

## 2. Proje ve cihaz profili

Yeni proje oluşturulurken hedef cihaz/firmware profili seçilir. Profil gerçek capability kaynağıdır; yalnız UI filtresi değildir.

Profil; desteklenen widget/content türlerini, image/video formatlarını, video slotlarını, sequence desteğini, text/font özelliklerini, digit kapasitesini, çözünürlükleri ve deployment formatını belirleyebilir.

Designer desteklenmeyen özellikleri mümkün olduğunca kullanıcıya sunmamalı; validation son kabul kapısı olmalıdır.

## 3. Formlar

Her tema dört fiziksel form taşır:

| ID | Yön | Çözünürlük |
|---|---:|---:|
| `r0` | 0° | 720×1280 |
| `r90` | 90° | 1280×720 |
| `r180` | 180° | 720×1280 |
| `r270` | 270° | 1280×720 |

Formlar bağımsız geometri taşır. Widget eklenirken başlangıç geometri değerleri diğer formlara kopyalanabilir; sonrasında her form ayrı düzenlenebilir. Publish için dört formun tamamı geçerli olmalıdır.

## 4. Generic runtime event/state

`yangin`, `estop`, `asiri_yuk`, `servis_disi`, `kapi_ac`, `kapi_kapa`, `seyir_yukari`, `seyir_asagi`, `bosta` gibi kavramlar öncelikle runtime durum/koşullarıdır; gereksiz yere ayrı fiziksel widget türlerine dönüştürülmez.

Kavramsal model:

```text
Runtime Signal
├── id
├── type
├── value/state
└── timestamp/sequence (gerekiyorsa)

Condition
├── signal
├── operator/value
└── priority 0..10

Binding
├── condition
├── widget
└── content/state result
```

Hazır elevator koşulları UI'da preset olarak gösterilebilir; engine generic kalmalıdır.

## 5. Priority

Aktif koşulların önceliği 0–10 arasında ayarlanabilir. Yüksek priority daha düşük priority'li davranışın önüne geçebilir.

Örnek defaultlar: yangın 10, E-Stop 9, aşırı yük 8, servis dışı 7, kapı açık 4, kapı kapanıyor 3, seyir 2, boşta 0. Bunlar örnek değerlerdir; nihai defaultlar ayrıca kesinleştirilebilir.

Aynı priority'de birden fazla koşul aktifse deterministic tie-break kuralı gerekir; rastgele seçim yapılamaz.

## 6. Widget modeli

Widget ile runtime event birbirinden ayrıdır. Her widget en az benzersiz `id`, kullanıcı `name`, `type`, `enabled`, layer, dört form geometry, runtime bindings, media/content binding, style binding ve türe özel properties taşır.

Kullanıcıya `video1`, `video2` gibi teknik isimler gösterilmez; teknik ID sistem tarafından üretilir.

## 7. Widget type ≠ Media type

Temel mimari kural:

```text
Widget
  ↓
Content / Binding
  ↓
Image | Video | Sequence | Text | Runtime Value
```

Dolayısıyla ok, kat numarası veya background gibi widgetlar desteklenen profile göre image veya video content kullanabilir. Video yalnızca `Video` isimli bir widgeta hapsedilmez.

## 8. Temel widget davranışları

### Background
Ekran arka planıdır. Profile göre image veya video olabilir.

### Kat numarası
Runtime'dan gelen floor değerini gösterir:

```text
floor = -1 → -1
floor = 8  → 8
floor yok  → hidden
```

Kat değeri Designer tarafından hesaplanmaz.

Kat numarası grafik tabanlı digit style kullanabilir. Digit görselleri saydam olmalı; temel hedef format ARGB8888 olarak ele alınmalıdır. Nihai firmware formatı profile göre doğrulanır. Hareketli digit tasarımları için video content de desteklenebilir.

### Yön oku
Runtime direction verisini gösterir:

```text
up      → Up content
 down    → Down content
none     → hidden
```

Default pakette örneğin 10 ok şekli bulunabilir. Default seçimde kullanıcı shape ve programın sağladığı renk paletinden renk seçer. Up ve Down bağımsız style seçebilir.

Custom seçimde kullanıcı dosyayı kendisi verir. Custom Up seçildiğinde Down otomatik kopyalanmaz; ayrıca seçilmelidir. Custom content image veya video olabilir ve programın renk paleti uygulanmaz.

### Alarm / uyarı
Tek bir `uyari` dosyası bütün alarm türlerini temsil etmez. Yangın, aşırı yük, E-Stop ve servis dışı gibi durumlar generic runtime condition + content binding ile ayrı ayrı ele alınır.

Örnek:

```text
fire == true
priority = 10
content = fire_warning.png
```

### Logo
Saydam image veya desteklenen media content olabilir.

### Saat / tarih
Runtime zaman firmware RTC'den gelir. Designer font, font size, bold, italic, format, date format ve alignment gibi gösterim özelliklerini belirler. Normal text için glyph atlas zorunluluğu yoktur.

### Kat listesi
Birden fazla kat/hedef etiketini gösteren ayrı widgettır; runtime kabin katı gösteren `kat_no` ile aynı değildir.

### Video
Kullanıcı `Video` ekler; sistem teknik ID üretir. MP4/MOV/MKV/AVI gibi kaynaklar profile göre kabul edilebilir. Gerekirse firmware hedefi için MJPEG AVI üretilir. Video widgetına harici audio bağlanabilir.

### Media Sequence
Timeline tabanlı medya widgetıdır. Image/video, duration, repeat, audio binding/policy ve fit gibi alanları taşıyabilir. Örneğin bir image 3 saniye, ardından video 5 saniye oynatılabilir.

### Kapı animasyonu
Kapı opening/closing gibi runtime durumlarına bağlanan hareketli içeriktir. Content image veya video olabilir.

### Metin
Gerçek firmware fontlarını kullanır. Glyph asset modeli normal text için kullanılmaz. Properties:

```text
Text
Font
Size
Bold
Italic
Alignment
```

Metin runtime koşullarına bağlanabilir; örneğin normal, kapı açık, yukarı, aşağı, yangın gibi durumlarda farklı metin gösterilebilir. Bu mekanizma generic condition engine kullanır.

## 9. Stil sistemi

Stil yalnız renk değildir; şekil, asset seti, varyant ve gerektiğinde renk seçeneklerini kapsayan görsel tasarım tanımıdır.

### Default style
Program default paketinde hazır stiller bulunur. Örneğin 10 arrow shape ve çeşitli digit style setleri. Default arrow style seçildiğinde kullanıcı renk paletinden renk seçebilir.

### Custom style
Kullanıcı özel image/video asset yükleyebilir. Custom assetin rengi Designer tarafından değiştirilmez.

Firmware style menüsü ile ilgili ayrıntılar ileride ayrıca kesinleştirilecektir. Şimdilik kullanıcı-facing `firmware_selectable` alanı zorunlu değildir.

## 10. Dynamic runtime layout

Klasik anchor graph sistemi kaldırılmıştır.

Asıl ihtiyaç, runtime floor değeri değiştiğinde kat numarası ile okun görsel ilişkisinin bozulmamasıdır:

```text
 7  ↑
16  ↑
-1  ↑
```

Bu daha sonra ayrı bir **Dynamic Runtime Layout / Alignment** mekanizması olarak tasarlanacaktır. Bu mekanizma runtime content bounds, digit count, direction variant, spacing ve grup hizalamasını dikkate alabilir.

Şu aşamada klasik `anchor → target widget` mimarisi uygulanmayacaktır.

## 11. Media preparation

Designer temel olarak resize, fit, crop ve hedef çözünürlük hazırlama işlemlerini desteklemelidir. Ayrı bir Format Tool da kullanılabilir.

Gerekli dönüşümler profile göre örneğin:

```text
Image → ARGB8888 / firmware image target
Video → MJPEG AVI
Audio → WAV
```

olabilir. Dönüşüm tamamlanmadan publish yapılmamalıdır.

## 12. Video audio

Video seçildiğinde harici audio bağlanabilir. Audio policy açıkça modellenmelidir:

```text
Video audio
External audio
Video audio + background mix
None
```

Kaynak videonun ses/görüntüsünü otomatik ayırma özelliği ileride eklenebilir; ilk sürümde Format Tool'a bırakılabilir.

## 13. Simulator

Designer içinde gerçek cihaz olmadan runtime davranışını çalıştıran simulator bulunmalıdır.

Elevator simulator en az:

```text
Floor: -1 ... 11
Direction: none / up / down
Door: closed / opening / open / closing
Fire: on/off
E-Stop: on/off
Overload: on/off
Service: on/off
```

durumlarını simüle edebilmelidir.

Play/Pause/Step/Reset desteklenmelidir. Simulator gerçek runtime engine ve renderer'ı kullanmalıdır. Örneğin Fire ON olduğunda gerçek fire binding'i ve gerçek warning content'i gösterilmelidir.

Simulator firmware değildir; Designer davranışını test eder.

## 14. AI-ready mimari

AI uygulamanın içine gömülmez. Program API key, embedded LLM veya cloud AI bağımlılığı istemez.

Harici Claude/VS Code agent gibi bir LLM Designer'ı programatik olarak kontrol edebilmelidir.

UI ve AI aynı application command katmanını kullanmalıdır. Kavramsal komutlar:

```text
create_project()
select_device()
create_theme()
add_widget()
remove_widget()
set_widget_property()
set_style()
set_media()
bind_event()
set_priority()
set_form_geometry()
set_text()
set_font()
validate()
render()
simulate()
export_package()
```

## 15. Designer Console

Uygulamada görünür bir console/log paneli bulunmalıdır. AI komutları çalıştırdığında kullanıcı ne olduğunu canlı görebilmelidir:

```text
> add_widget("direction")
✓ Widget created
> set_style("Arrow 04")
✓ Style assigned
> bind("direction", "up", ...)
✓ Binding created
> validate()
✓ 0 errors
```

Console development/debugging için de kullanılmalıdır.

## 16. AI'nin template'i anlaması

AI yalnız JSON üretip tamamlandı sayılmamalıdır. Designer programatik olarak proje özeti, device profile, forms, widget listesi, geometry, style/media bindingleri, runtime bindings, priorityler, simulator state ve validation sonuçlarını döndürebilmelidir.

Ayrıca screenshot/render alınabilmelidir.

Hedef döngü:

```text
External LLM
 → Designer API
 → Template oluştur
 → Simulator state çalıştır
 → Render/screenshot
 → Sonucu incele
 → Düzelt
 → Tekrar test
```

AI mevcut default asset/style kütüphanesini okuyabilmelidir. Yeni asset gerektiğinde Python, image generation veya başka harici tooling kullanabilir ve sonucu Designer API ile projeye ekleyebilir.

## 17. Preview / Simulator / Export invariantı

Üç sistem aynı canonical project modelini kullanmalıdır:

```text
             Canonical Project Model
              /        |        \
         Preview   Simulator    Export
```

Preview, simulator ve export farklı layout/render mantıkları kullanmamalıdır. Aynı geometry, style, media ve runtime binding resolution kullanılmalıdır.

## 18. SD Card deployment

V1 workflow:

```text
Open/Create Theme
→ Design
→ Preview
→ Validate
→ Build Package
→ Select SD Card
→ Write
→ Verify
→ Safe Eject
```

SD kartta iki config seviyesi bulunur:

```text
SD/
├── config.cfg          # SD kart genel bilgileri / tema indeksi
├── Theme1/
│   └── config.cfg      # yalnız Theme1 bilgileri
├── Theme2/
│   └── config.cfg
└── ...
```

Root config kartın genel bilgilerini ve tema indeksini taşır. Theme config yalnız ilgili temanın içeriğini tanımlar. Kesin parser alanları gerçek firmware sözleşmesiyle ayrıca kesinleştirilecektir.

Editable project doğrudan SD karta kopyalanmaz; önce firmware deployment package oluşturulur.

## 19. Validation

Validation en az şunları kontrol eder:

- device/profile uyumu,
- dört form tamamlığı,
- duplicate widget ID,
- geçersiz geometry,
- runtime binding tutarlılığı,
- priority çözümünün deterministic olması,
- eksik media,
- tamamlanmamış dönüşüm,
- video slot limiti,
- desteklenmeyen content type,
- custom Up/Down eksiklikleri,
- asset formatı,
- gerekli font/capability,
- deployment config bütünlüğü,
- gerçek package dosyalarının varlığı.

Hatalar kullanıcıya `hangi widget/form/condition/asset + sorun + çözüm` şeklinde anlatılmalıdır.

## 20. UI

Ana görevler:

```text
Themes
Design
Test
Publish
```

Design Studio profesyonel Windows engineering/design tool görünümünde olmalıdır:

```text
+---------------------------------------------------------+
| Toolbar                                                  |
+---------------+------------------------+----------------+
| Project /     |                        | Properties     |
| Widgets /     |      Device Canvas     | Inspector      |
| Assets        |                        |                |
+---------------+------------------------+----------------+
| Console / Simulator / Logs / Status                     |
+---------------------------------------------------------+
```

Sağ Properties paneli seçilen widgetın gerçek özelliklerini göstermelidir.

## 21. Yapılmaması gerekenler

1. Runtime eventleri gereksiz ayrı widget sınıflarına dönüştürmek.
2. Tüm alarm tiplerini tek warning assetine indirgemek.
3. Kat değerini Designer'ın hesaplaması.
4. Normal text için glyph atlas zorunluluğu.
5. Klasik anchor graph uygulamak.
6. Widget type ile media type'ı birleştirmek.
7. Custom asset rengini otomatik değiştirmek.
8. Custom Up seçilince Down'u sessizce kopyalamak.
9. Desteklenmeyen capability'yi çalışıyormuş gibi göstermek.
10. Preview/Simulator/Export için farklı resolution/render mantıkları kullanmak.
11. AI'yi uygulamaya gömülü servis yapmak.
12. AI'nin oluşturduğu template'i render/simulate etmeden tamamlanmış kabul etmek.
13. Source project'i deployment package yerine SD karta kopyalamak.
14. Root config ile theme config görevlerini karıştırmak.

## 22. Açık kararlar

Aşağıdakiler ayrıca kesinleştirilecektir ve varsayımla doldurulmayacaktır:

1. Dynamic Runtime Layout algoritmasının kesin matematiği.
2. Aynı priority için nihai tie-break kuralı.
3. Exact runtime signal schema.
4. Exact serial protocol mapping.
5. Device profile başına kesin image/video/audio formatları.
6. Root/theme `config.cfg` kesin parser alanları.
7. Firmware style menu ve fallback protokolü.
8. Media sequence audio mix sınırları.

## 23. Canonical ürün tanımı

**Tema, cihazdan gelen dinamik runtime verinin hangi görsel içerikle, hangi stil ve yerleşimle gösterileceğini tanımlayan çalıştırılabilir bir görsel davranış modelidir.**

Tema =

```text
Device Profile
+ Forms
+ Widgets
+ Media
+ Styles
+ Runtime Bindings
+ Priorities
+ Text/Fonts
+ Simulator/Test Data
+ Deployment Metadata
```

Bu model hem insan tasarımcının hem de harici AI authoring agentının aynı Designer sistemi üzerinden güvenilir template oluşturmasını, test etmesini, görmesini ve publish etmesini sağlamalıdır.
