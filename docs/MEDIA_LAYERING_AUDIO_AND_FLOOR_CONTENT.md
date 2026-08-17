# Media Layering, Audio ve Kata Özel İçerik

## 1. Görsel katmanlama

Template içindeki widgetlar ve medya içerikleri aynı ekran üzerinde üst üste render edilir.

Her görsel öğenin bir **z-order / visual layer** değeri vardır. Daha yüksek değer üstte görünür.

Örnek:

```text
Layer 0   Background
Layer 10  Main media
Layer 20  Floor number
Layer 30  Direction arrow
Layer 40  Text
Layer 100 Floor-specific Media Slide
```

Bu değerler örnektir; cihaz/firmware profile göre defaultlar değişebilir.

Background varsayılan olarak en arkadadır.

Layering yalnız Designer canvas görünümü için değildir. Firmware'deki gerçek compositing/render sırası ile aynı semantiğe sahip olmalıdır.

## 2. Runtime priority ile visual layer priority farklıdır

İki farklı kavram kesinlikle karıştırılmamalıdır.

### Event / Binding Priority

Birden fazla runtime condition aktif olduğunda hangi davranışın seçileceğini belirler. Template'te 0–10 aralığındadır.

### Visual Layer / Z-order

Seçilen içeriklerin fiziksel olarak birbirinin üzerinde nasıl çizileceğini belirler.

Bir eventin runtime priority'sinin yüksek olması otomatik olarak widgetın z-order'ını değiştirmez.

## 3. Kata özel medya = normal Media Slide

Ürün modelinde ayrı bir `Popup` veya `Floor Popup` widgetı **yoktur**.

Kullanıcı kata özel üst içerik istiyorsa normal `Media Slide` kullanır ve bunu `floor` runtime state'ine bağlar.

Örnek:

```text
Media Slide
Condition:
    floor == 5

Content:
    customer_5.jpg

Duration:
    2 sec

Audio:
    customer_5.wav

Audio Repeat Count:
    1

Visual Layer:
    100
```

Floor 5 aktif olduğunda bu normal Media Slide diğer normal içeriklerin üzerinde görünebilir. Kullanıcı bunu görsel olarak popup gibi kullanabilir; ancak domain modelinde popup kavramı yoktur.

## 4. Media Slide içeriği

Media Slide şunları destekler:

- image,
- video,
- duration,
- video loop enable,
- video loop count,
- audio,
- audio repeat count,
- runtime condition/binding,
- visual layer.

Örneğin 2 saniyelik fotoğraf + kat özel ses veya loop eden video + ayrı ses tekrar sayısı tanımlanabilir.

Video loop count ile audio repeat count birbirinden bağımsızdır.

## 5. Kata özel medya

Herhangi bir firmware-supported floor value için özel media kullanılabilir:

```text
floor == 5 → customer_5.jpg
floor == 8 → floor8.mp4
floor == R → reception.mp4
```

Bu içerik yüksek visual layer ile diğer normal içeriklerin üzerinde gösterilebilir.

## 6. Kata özel anons

Her kata özel audio announcement tanımlanabilir.

Örneğin:

```text
Floor 5
├── TR → floor_5_tr.wav
├── EN → floor_5_en.wav
└── DE → floor_5_de.wav
```

Kullanıcı isterse anonsu parçalardan oluşturabilir:

```text
TR
[5] + [inci] + [kat]
```

Kata özel anons sistemi language-aware olmalıdır.

## 7. Kat sembolleri

Floor value yalnız sayısal digitlerden oluşmaz.

Desteklenen değerler örneğin:

```text
-1
0
1
2
...
11
R
Z
K
T
P
```

Gerçek değer kümesini firmware/device profile belirler.

Designer digit/floor style gerekli sembollerin assetlerini kontrol etmelidir.

## 8. Audio seviyeleri

En az üç ses kanalı ayrı modellenmelidir:

```text
Announcement Volume
Background Music Volume
Video Audio Volume
```

Designer bunların template defaultlarını ayarlayabilir.

Örneğin:

```text
Announcement Default: 80%
Background Music Default: 20%
Video Audio Default: 60%
```

Firmware bunları sahada runtime setting olarak değiştirebilir.

## 9. Fon müziği

Template bir background music asset tanımlayabilir.

Fon müziği ayrı audio asset olarak paketlenir ve default volume taşıyabilir. Firmware runtime setting'i bu değeri override edebilir.

## 10. Video audio

Video kendi audio track'ini taşıyabilir. Ayrıca harici audio bağlanabilir.

Video audio, background music ve announcement ayrı kanallar olarak modellenmelidir.

## 11. Audio repeat

Media Slide'a bağlanan audio için tekrar sayısı açıkça ayarlanabilir:

```text
Audio File
Audio Repeat Count
```

Bu ayar video loop count'tan bağımsızdır.

## 12. Audio arbitration Designer'ın işi değildir

Template Designer firmware'in gerçek runtime audio arbitration/mixing mantığını yeniden uygulamaz.

Örneğin düşük öncelikli bir Media Slide sesi çalarken yüksek öncelikli bir alarm/anons gelirse hangi sesin duyulacağı firmware/runtime audio engine tarafından belirlenir.

Designer yalnızca content, binding, default volume ve repeat bilgisini sağlar.

## 13. Dil

Language firmware runtime setting olabilir.

Template gerekli language variantlarını paketler:

```text
floor == 5
TR → floor_5_tr.wav
EN → floor_5_en.wav
DE → floor_5_de.wav
```

Aynı localization yaklaşımı text, media/audio ve gerektiğinde floor/digit content için kullanılabilir.

## 14. Render/compositing invariantı

Designer canvas, Simulator ve firmware deployment aynı layer semantiğini kullanmalıdır.

```text
Canonical Project
      ↓
Layer Resolution
      ↓
Designer Preview / Simulator / Firmware Renderer
```

Designer'da üstte görünen içerik simulator ve firmware'de de aynı layer semantiğine sahip olmalıdır.

## 15. AI için layer ve media bilgisi

AI template oluştururken widgetların yanı sıra:

- z-order,
- media type,
- duration,
- loop,
- loop count,
- audio,
- audio repeat,
- runtime condition,
- floor binding

bilgilerini okuyabilmelidir.

Böylece oluşturduğu ekranın gerçek runtime görünümünü simulator/render üzerinden değerlendirebilir.

## 16. Açık kararlar

Kesinleştirilecekler:

1. Firmware'in kesin z-order aralığı.
2. Aynı z-order değerindeki iki widget için deterministic sıra.
3. Audio channel mixing/ducking kuralları.
4. Firmware volume settinglerinin template defaultlarını override etme modeli.
5. Exact floor announcement sequence formatı.
