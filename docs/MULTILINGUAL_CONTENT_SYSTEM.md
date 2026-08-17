# Template Designer — Multilingual Content System

## 1. Temel kural

Tema sistemi çoklu dil desteğini yalnız UI dili olarak değil, **runtime'da gösterilen/çalınan içeriğin dili** olarak desteklemelidir.

Dil desteği en az şu içerik türlerinde bulunmalıdır:

- metin
- ses
- kat numarası / digit içerikleri
- gerektiğinde medya varyantları

Dil, widget'ın kendisinden bağımsız bir content dimension'dır.

```text
Widget
  ↓
Runtime / Static Content
  ↓
Language Selection
  ↓
Language-specific asset/content
  ↓
Renderer / Audio Player
```

## 2. Dil registry

Desteklenen diller cihaz/firmware profile tarafından ilan edilebilir.

Designer'da kullanıcı rastgele dil oluşturmaz. Profile'ın desteklediği diller seçilebilir olmalıdır.

Örnek:

```text
tr-TR  Türkçe
 en-US  English
 de-DE  Deutsch
 ar-SA  العربية
```

Kesin dil listesi cihaz/firmware profile göre belirlenir.

## 3. Runtime language

Cihazın hangi dili kullanacağı firmware/runtime tarafından belirlenebilir.

Template aynı içeriğin birden fazla dil varyantını taşıyabilir.

Örnek:

```text
language = tr
    → "Kapı açık"

language = en
    → "Door open"

language = de
    → "Tür offen"
```

Designer dilin runtime'dan geldiği durumlarda template içeriğini seçilen runtime language'a göre çözmelidir.

Eğer cihaz dili runtime tarafından değiştirilmiyorsa tema içinde varsayılan dil seçilebilir.

## 4. Text multilingual content

Text widgetı tek bir `text` stringine indirgenmemelidir.

Örnek model:

```text
Text Widget
├── Font / typography
├── Alignment
├── Size
└── Localized Content
    ├── tr → "Kapı açık"
    ├── en → "Door open"
    └── de → "Tür offen"
```

Font seçimi dil içeriğinden ayrıdır. Bir dil için firmware'de desteklenen uygun font bulunmalıdır.

Validation, seçilen dilde kullanılacak font/capability'nin cihaz profile tarafından desteklenip desteklenmediğini kontrol etmelidir.

## 5. Event-driven multilingual text

Runtime condition ile dil birlikte çözülür.

Örnek:

```text
Condition: door_open == true

tr → "Kapı açık"
en → "Door open"
de → "Tür offen"
```

Başka örnek:

```text
Condition: moving_up == true

tr → "Yukarı çıkılıyor"
en → "Moving up"
de → "Aufwärts"
```

Priority condition üzerinde çalışmaya devam eder; dil yalnız seçilen presentation content'i belirler.

```text
Runtime States
      ↓
Priority Resolution
      ↓
Selected Binding
      ↓
Language Resolution
      ↓
Localized Content
```

## 6. Audio multilingual content

Ses de aynı şekilde dil varyantlarına sahip olabilir.

Örnek:

```text
Announcement
├── tr → welcome_tr.wav
├── en → welcome_en.wav
└── de → welcome_de.wav
```

Runtime language `en` ise English audio seçilir.

Audio dosyaları firmware/device profile'ın kabul ettiği hedef formatta olmalıdır; örneğin WAV. Exact codec/sample rate/channel gereksinimi profile'dan alınmalıdır.

## 7. Video ve media multilingual content

Gerekirse video/media da dil varyantı taşıyabilir.

Örneğin:

```text
Safety Video
├── tr → safety_tr.mjpeg
├── en → safety_en.mjpeg
└── de → safety_de.mjpeg
```

Bu zorunlu olarak her video için uygulanmaz. Widget content'i dil bağımsız olabilir veya localized variant kullanabilir.

## 8. Kat numarası / digit multilingual content

Kat numarası da dil/locale'e bağlı görsel gösterim taşıyabilir.

Örneğin bazı sistemlerde digit/glyph seti veya kat isimlendirmesi dile göre değişebilir:

```text
Language: tr
  -1 → -1
  0  → G
  1  → 1

Language: en
  -1 → B1
  0  → G
  1  → 1
```

Ayrıca digit style'ın kendisi language-specific olabilir.

Bu nedenle `kat_no` yalnızca `integer → raw image` olarak modellenmemeli; gerektiğinde:

```text
floor value
      ↓
language / locale
      ↓
digit/content mapping
      ↓
style
      ↓
image/video render
```

çözümünü desteklemelidir.

Ancak temel kural değişmez: Designer kat değerini hesaplamaz; firmware'in verdiği runtime değeri gösterir.

## 9. Dil ile style/font ayrımı

Dil ve görsel stil aynı şey değildir.

```text
Language
  = içerik / dil varyantı

Font / Style
  = içeriğin görsel sunumu
```

Örneğin aynı English text farklı fontlarda gösterilebilir:

```text
English
 ├── Modern Bold
 ├── Digital
 └── Narrow
```

Designer bunları birbirine zorunlu olarak bağlamamalıdır.

## 10. Fallback

Bir localized content için seçilen dilde içerik bulunmuyorsa profile/template tarafından belirlenmiş fallback uygulanmalıdır.

Örneğin:

```text
Requested: fr
Available: tr, en
Fallback: en
```

Sonuç:

```text
fr content missing
      ↓
English content
```

Fallback davranışı sessiz ve belirsiz olmamalıdır. Validation kullanıcıya eksik dil içeriğini gösterebilmelidir.

## 11. Dil kapsamı

Bir tema:

- yalnız bir dil,
- birden fazla dil,
- tüm profile dilleri

için hazırlanabilir.

Kullanıcı tema oluştururken kullanılacak dilleri seçebilir.

Örneğin:

```text
Theme Languages
☑ Türkçe
☑ English
☐ Deutsch
☐ العربية
```

Seçilmeyen dil için localized content zorunlu değildir.

## 12. Simulator

Simulator runtime language'ı değiştirebilmelidir.

Örneğin:

```text
Language: [ Türkçe ▼ ]

Fire: ON
Door: Open
Floor: 8
```

→ Türkçe text/audio/media.

Language:

```text
[ English ▼ ]
```

→ English text/audio/media.

Bu özellik AI tarafından da kontrol edilebilir olmalıdır.

## 13. AI API

AI mevcut language registry'yi okuyabilmelidir.

Örneğin:

```text
get_supported_languages()
get_theme_languages()
get_localized_content(widgetId)
set_localized_text(widgetId, language, text)
set_localized_audio(widgetId, language, asset)
set_runtime_language(language)
```

AI bir template oluştururken seçilen tüm diller için içerik üretip bağlayabilir.

## 14. Asset naming / deployment

Language-specific assetler deployment package içinde birbirinden deterministically ayrılmalıdır.

Örneğin kavramsal olarak:

```text
media/
  announcements/
    tr/
    en/
    de/
```

veya farklı bir yapı kullanılabilir. Klasör yapısı implementation kararıdır; canonical contract yalnız assetlerin language metadata'sı ile doğru locale'e bağlanmasını zorunlu kılar.

## 15. Validation

Validation en az şunları kontrol etmelidir:

- seçilen language profile tarafından destekleniyor mu?
- gerekli localized content eksik mi?
- fallback var mı?
- text için gerekli font mevcut mu?
- audio target formatı doğru mu?
- localized media profile capability ile uyumlu mu?
- digit/floor content ilgili language için geçerli mi?
- deployment package içinde tüm referanslanan localized assetler mevcut mu?

## 16. Temel model

```text
                 Runtime State
                      ↓
               Priority Resolution
                      ↓
                 Widget Binding
                      ↓
                Language Resolve
                 /      |      \
                /       |       \
             Text      Audio    Media
               |         |        |
            Font      WAV/etc   Image/Video
               \         |        /
                \        |       /
                 └── Renderer ──┘
```

**Dil, template'in tamamını değiştiren ayrı bir tema değildir; aynı widget/runtime davranışının localized content katmanıdır.**

## 17. Açık karar

Aşağıdaki konu ileride firmware sözleşmesine göre kesinleştirilecektir:

- runtime language state'inin canonical ID'si,
- dilin hangi firmware state'i ile seçildiği,
- desteklenen locale listesi,
- font-language capability mapping,
- kat isimlerinin/digit gösteriminin locale'e özgü kesin kuralları,
- audio priority ve interrupt davranışı.
