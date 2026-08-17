# Media Layering, Audio ve Kata Özel İçerik

## 1. Görsel katmanlama

Template içindeki widgetlar ve medya içerikleri aynı ekran üzerinde üst üste render edilir.

Her görsel öğenin bir **z-order / layer priority** değeri vardır. Daha yüksek değer üstte görünür.

Örnek:

```text
Layer 0   Background
Layer 10  Main media
Layer 20  Floor number
Layer 30  Direction arrow
Layer 40  Text
Layer 100 Floor Popup
```

Bu değerler örnektir; cihaz/firmware profile gerektiğinde farklı defaultlar tanımlayabilir.

Temel kural:

```text
lower layer → behind
higher layer → in front
```

Background varsayılan olarak en arkadadır.

Layering yalnız Designer canvas görünümü için değildir. Firmware'deki gerçek compositing/render sırası ile aynı semantiğe sahip olmalıdır.

## 2. Runtime priority ile visual layer priority farklıdır

İki farklı priority kavramı vardır ve karıştırılmamalıdır.

### Event / Binding Priority

Birden fazla runtime condition aktif olduğunda hangi davranışın seçileceğini belirler.

```text
fire = 10
estop = 9
door_open = 4
```

### Visual Layer / Z-order

Seçilen içeriklerin fiziksel olarak birbirinin üzerinde nasıl çizileceğini belirler.

```text
background = 0
main = 10
popup = 100
```

Bir eventin priority'sinin yüksek olması otomatik olarak widgetın z-order'ını değiştirmez. İkisi ayrı kavramdır.

## 3. Kata özel medya

Template Designer kata özel media/content tanımlamayı desteklemelidir.

Örneğin:

```text
floor == 5
    → floor_5_media
```

Bu medya:

- image
- video
- desteklenen diğer media content

olabilir.

Normal runtime içeriklerin üzerinde görünmesi gerekiyorsa yüksek z-order verilebilir.

## 4. Kata özel Popup

Kullanıcı Designer'da bir **Floor Popup** oluşturabilir.

Örneğin:

```text
Floor Popup
Condition:
    floor == 5

Content:
    customer_5_popup.mp4

Layer:
    100
```

Floor 5 aktif olduğunda bu medya yalnızca Floor 5 için gösterilir ve yüksek layer nedeniyle diğer normal içeriklerin üzerinde görünür.

Popup ayrı bir fiziksel ekran değildir; aynı canvas/compositing sistemindeki bir üst katmandır.

Popup'ın görünürlüğü runtime condition ile belirlenir.

## 5. Kata özel içerik genel binding sistemini kullanır

Floor-specific content özel bir runtime motoru icat etmemelidir.

```text
State:
    floor

Condition:
    floor == 5

Content:
    popup_5.png

Layer:
    100
```

Aynı mekanizma:

```text
floor == R
floor == Z
floor == -1
floor == 11
```

gibi değerlerde de çalışmalıdır.

## 6. Kata özel anons

Her kata özel audio announcement tanımlanabilir.

Örneğin:

```text
Floor 5
├── TR
│   └── floor_5_tr.wav
├── EN
│   └── floor_5_en.wav
└── DE
    └── floor_5_de.wav
```

Kullanıcı isterse kat anonsunu parçalardan oluşturabilir:

```text
Language = TR
Floor = 5

announcement sequence:
[5] + [inci] + [kat]
```

veya firmware'in/voice pack'in desteklediği hazır kat anonsu kullanılabilir.

Kat anonsu template içinde **kata özel** olarak tanımlanabilir.

## 7. Kat sembolleri

Floor value yalnız sayısal digitlerden oluşmaz.

Desteklenen floor value'lar örneğin:

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

olabilir.

Gerçek desteklenen değer kümesini firmware/device profile belirler.

Designer digit/floor style seçerken gerekli sembollerin assetlerinin bulunup bulunmadığını validation ile kontrol etmelidir.

## 8. Audio sisteminde ayrı seviyeler

Audio volume tek bir global değer değildir.

En azından şu kanallar ayrı modellenebilir:

```text
Announcement Volume
Background Music Volume
Video Audio Volume
```

Bunların Designer'da **default değerleri** tanımlanabilir.

Örneğin:

```text
Announcement Default: 80%
Background Music Default: 20%
Video Audio Default: 60%
```

Ancak firmware profile bu ayarların runtime'da teknisyen tarafından değiştirilebilmesine izin verebilir.

Bu durumda:

```text
Template Default
       ↓
Firmware Runtime Setting
       ↓
Effective Volume
```

kullanılır.

## 9. Firmware volume settings

Firmware kendi menüsünden örneğin:

```text
Announcement Volume
Background Music Volume
Video Volume
Master Volume
```

gibi değerleri değiştirebilir.

Hangi ayarların mevcut olduğu firmware/device profile tarafından ilan edilir.

Designer'da olmayan bir firmware setting'i uydurulmaz.

## 10. Fon müziği

Template bir background music asset tanımlayabilir.

Fon müziği:

- ayrı audio asset olarak paketlenebilir,
- default volume taşıyabilir,
- firmware runtime volume setting'i tarafından değiştirilebilir,
- announcement/audio policy ile birlikte çalışabilir.

Örneğin:

```text
Background Music:
    lobby_music.wav

Default Volume:
    20%
```

## 11. Video audio

Video content'in kendi audio track'i olabilir.

Ayrıca harici audio/fon müziği bağlanabilir.

Volume seviyeleri ayrı tutulabilir:

```text
Video Audio Volume
Background Music Volume
Announcement Volume
```

Final audio mixing policy firmware capability'sine göre belirlenmelidir.

## 12. Audio priority

Görsel z-order ile audio priority aynı şey değildir.

Bir alarm/announcement görsel olarak üstte olmasa bile audio olarak daha yüksek öncelikli olabilir.

Örneğin:

```text
Fire announcement
    → audio priority high

Background music
    → audio priority low
```

Firmware profile destekliyorsa audio ducking/muting gibi davranışlar ayrıca tanımlanabilir.

## 13. Dil çözümleme

Dil firmware runtime setting olabilir.

Template gerekli language variantlarını paketler.

Örneğin:

```text
floor == 5

TR → floor_5_tr.wav
EN → floor_5_en.wav
DE → floor_5_de.wav
```

Firmware menüsündeki aktif language seçimi effective content'i belirler.

## 14. Render/compositing invariantı

Designer canvas, Simulator ve firmware deployment aynı layer semantiğini kullanmalıdır.

```text
Canonical Project
      ↓
Layer Resolution
      ↓
┌─────────────┬──────────────┐
│ Designer    │ Simulator    │ Firmware
│ Preview     │ Render       │ Renderer
└─────────────┴──────────────┘
```

Designer'da popup üstte görünüyorsa simulator'da da üstte görünmelidir. Export edilen firmware package de aynı z-order bilgisini taşımalıdır.

## 15. AI için görünür layer bilgisi

AI template oluştururken yalnız widget listesini değil, z-order bilgisini de okuyabilmelidir.

Örneğin:

```text
Background       z=0
Floor Number     z=20
Arrow            z=30
Text             z=40
Floor Popup      z=100
```

Böylece AI oluşturduğu ekranın hangi öğesinin hangisinin üzerinde olduğunu anlayabilir ve screenshot/render sonucunu doğru yorumlayabilir.

## 16. Açık kararlar

Kesinleştirilecekler:

1. Firmware'in desteklediği kesin z-order aralığı.
2. Aynı z-order değerindeki iki widget için deterministic sıra.
3. Popup'ın varsayılan yaşam süresi / sürekli görünme davranışı.
4. Floor popup'ın state değişiminde kapanma davranışı.
5. Audio channel mixing/ducking kuralları.
6. Video audio + background music aynı anda destekleniyorsa kesin mix davranışı.
7. Firmware'in volume settinglerinin template defaultlarını nasıl override ettiği.
