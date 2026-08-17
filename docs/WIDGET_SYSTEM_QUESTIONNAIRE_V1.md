# Widget System — UX Questionnaire V1

> Arşivlenmiş Widget Library, Widget Type/Media Type, Style, Digit, Direction, Text, Audio ve stable ID kararları.

## Widget Type vs Media Type

Bu iki kavram farklıdır ve birbirleriyle çelişmez:

```text
Widget Type = nesnenin Designer/firmware semantiği
Media Type  = o nesnenin görsel/işitsel kaynağının formatı
```

Örnek:

```text
Widget Type = Direction
Media Type  = Image
```

ve:

```text
Widget Type = Direction
Media Type  = Video
```

Widget Type runtime anlamını belirler. Media Type ise içeriğin nasıl render edildiğini belirtir.

Widget Type değişimi yalnız DeviceProfile tarafından uyumlu görülen semantic type'lar arasında yapılabilir.

## Digit Widget

`Digit` burada **kat numarası/floor number widget'ıdır**.

Digit widget için font sistemi kullanılmaz.

Temel model:

```text
Digit / Floor Number
├── Runtime binding → Floor
├── Style
│   ├── Default styles
│   └── Custom upload
└── Media source
```

Default style sayısı sabit değildir. DeviceProfile/firmware ile desteklenen stiller zamanla artırılabilir.

Kullanıcı default style seçeneklerinden seçim yapabilir.

Custom style seçildiğinde kullanıcı kendi dosyasını yükler; custom içerik ne şekilde yüklenmişse o şekilde kullanılır ve **custom style için Designer color picker uygulanmaz**.

## Direction Widget

Direction için karar:

```text
Up Style
Down Style
Color
```

Default style seçildiğinde Up seçimi Down varyantını otomatik olarak aynı style ailesinden oluşturur.

Kullanıcı Down varyantını ayrıca değiştirebilir.

Default style tarafında renk seçimi ortak olabilir.

Custom style tarafında Up ve Down dosyaları manuel seçilir ve custom içerikte renk seçimi yapılmaz; yüklenen içerik olduğu gibi kullanılır.

## Style Library

Style seçenekleri görsel olarak incelenebilir. Dropdown + visual style browser yaklaşımı kullanılabilir.

Default style sayısı DeviceProfile tarafından belirlenebilir ve gelecekte artırılabilir.

## Text / Language

Text widget font/glyph atlası mantığıyla değil, firmware'de bulunan font seçeneklerine referans veren yazı özellikleriyle çalışır.

Text için:

- font family/type reference,
- size,
- weight/bold,
- italic,
- alignment,
- language/localization behavior

gibi Properties bulunabilir.

Dil yalnızca bir text alanının literal değerini değiştirmek değildir. Firmware'deki dil seçimi template tarafından tanımlanan bütün localization-aware text ve ilgili language-dependent content/settings davranışlarını değiştirebilir.

Designer'da:

- tek dil,
- iki dil,
- desteklenen daha fazla dil,
- dil sırasına göre text/audio varyantları

tanımlanabilir.

Firmware runtime'da dili değiştirdiğinde template bu seçime göre ilgili içeriği kullanır.

## Floor Number / Symbols

Floor number runtime'dan gelen değeri doğrudan gösterir.

Kat değerleri yalnız decimal olmak zorunda değildir; profile tarafından desteklenen `R`, `Z`, `K`, `T`, `P` gibi semboller de kullanılabilir.

Digit için font seçimi yoktur; görsel stil/asset modeli kullanılır.

## Floor-specific media

Kat özel medya ayrı bir popup widget tipi değildir.

Kat koşuluna bağlanan normal `Media Slide` kullanılabilir.

Örneğin:

```text
Condition: Floor == 5
Media Slide:
  image = floor5.jpg
  duration = 2s
  audio = floor5.wav
```

Bu model runtime'da kat özel medya/ses davranışını sağlar.

## Media Slide

Media Slide içinde medya tipine göre Properties değişir.

Image seçilirse image sabit bir içeriktir ve kendi `duration` değeri bulunur.

Video seçilirse:

- video duration,
- video loop,
- video loop count,
- video audio volume,
- external audio

gibi değerler bulunabilir.

Audio için ayrıca:

- audio duration,
- audio repeat/loop,
- audio repeat count

ayarlanabilir.

External audio ile video kullanılıyorsa video sesi ve external audio birlikte/ayrı yönetilebilir; kesin runtime mixing davranışı firmware contract'a bağlıdır.

## Background Music / Audio Overrides

Fon müziği ayrı bir runtime audio katmanı olarak ele alınır.

Designer'da background music Properties üzerinden runtime audio override kuralları tanımlanabilir. Örneğin hangi state/scene/media audio geldiğinde:

- background music volume düşürülecek,
- background music pause edilecek,
- background music tamamen kapatılacak,
- normal seviyeye geri dönecek

gibi davranışlar profile destekliyorsa yapılandırılabilir.

Bu, tek tek Media Slide'ın kendi audio ayarından farklı bir runtime audio policy katmanıdır.

## Widget Name

Project Explorer'da kullanıcı tarafından görülen isim ile stable ID birbirinden ayrıdır.

Örneğin:

```text
Display name: Serdar Ortaç
Stable ID:    <stable firmware-safe identifier>
```

Stable ID kullanıcı tarafından kolayca değiştirilen görünen isim değildir.

## Stable ID

Her widget/resource/media öğesinin deterministic, firmware-safe ve benzersiz bir stable ID'si bulunmalıdır.

Stable ID'ler kodlanmış bir format kullanabilir ve mümkün olduğunda en azından:

- Project/Theme identity,
- Rotation identity,
- object/resource sıra veya kimliği

gibi bilgileri taşıyabilir.

Örnek yaklaşım:

```text
T01R03M0042
```

veya firmware-safe dosya adı:

```text
T01R03M0042.wav
```

Kullanıcı arayüzünde ise aynı dosya:

```text
Serdar Ortaç
```

olarak gösterilebilir.

Stable ID üretimi deterministic olmalı, collision olmamalı ve export sırasında firmware'in güvenle kullanabileceği isimlere dönüştürülmemelidir.

Aynı medya farklı Theme/Rotation altında fiziksel olarak ayrı kopyalanıyorsa her deployment-owned copy kendi stable ID'sine sahip olabilir.

## Resource Type Assignment

Dışarıdan sürüklenen dosya önce Resource olarak gelir.

```text
Type: None
```

Format DeviceProfile tarafından destekleniyorsa kullanıcı semantic type seçebilir. Type seçimi uygun durumda resource'u template kullanımına hazır hale getirir.

DeviceProfile formatı desteklemiyorsa resource `Unsupported` olarak kalır.

## Font

Font sistemi normal Text widget için firmware font referanslarıyla çalışır. Digit/Floor Number widgetı için font seçimi kullanılmaz; Digit style/asset modeli kullanılır.

## General principle

Widget Library, Widget Type ve Media Type ayrımını kullanıcıya açıkça göstermeli ancak gereksiz teknik ayrıntıyla arayüzü doldurmamalıdır.

Properties paneli Altium tarzında contextual kalır: yalnız seçilen widgetın gerçekten desteklediği özellikler gösterilir.
