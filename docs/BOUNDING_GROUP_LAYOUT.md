# Bounding Group Layout

## Status

Bu sistem Template Designer'da **opsiyonel** bir layout özelliğidir. Her widget Bounding Group kullanmak zorunda değildir.

## Amaç

Birden fazla widgetın veya runtime'da değişken genişlikte içeriğin ortak bir geometrik referansa göre hizalanmasını sağlar.

Özellikle:

- kat numarası + yön oku,
- birden fazla uyarı/content,
- runtime'da değişen sayıda aktif içerik,
- başka birlikte hizalanması gereken widget kümeleri

için kullanılabilir.

## Temel mantık

```text
Screen / Parent
      ↓
Bounding Group
      ├── Child 1
      ├── Child 2
      ├── Child 3
      └── ...
```

Bounding Group bir widget değildir; layout container/composition yardımcı yapısıdır.

Kullanıcı group oluşturmayı seçerse çocuk widgetları group içine alır. Group için referans, boyut, alignment ve spacing gibi layout özellikleri tanımlanabilir.

## Referans

Group bir referans noktasına göre yerleştirilebilir. İlk hedef screen/form referansıdır.

Örneğin ekran genişliği 800 px ise screen center:

```text
x = 400
```

Group center bu referansa hizalanabilir.

İleride parent veya başka bir group gibi referanslar desteklenebilir; bu özellik zorunlu değildir.

## Centering kuralı

Group içindeki aktif içeriklerin toplam geometrik merkezi group referansına göre hizalanabilir.

Örnek:

```text
1 item:
        [1]
         ↑
       center
```

```text
2 items:
      [1]   [2]
          ↑
        center
```

```text
3 items:
      [1] [2] [3]
          ↑
        center
```

```text
4 items:
    [1] [2] [3] [4]
          ↑
       2 ↔ 3 center
```

```text
5 items:
  [1] [2] [3] [4] [5]
          ↑
          3
```

Genel olarak grup merkezinin geometrik merkezi referansa denk gelir.

## Alignment

Bounding Group opsiyonel olarak:

```text
Horizontal:
  Left
  Center
  Right

Vertical:
  Top
  Center
  Bottom
```

alignment seçeneklerini destekleyebilir.

## Fixed Slots / Dynamic Active Items

Group iki davranış modeli sağlayabilir:

### Fixed Slots

Çocukların slotları sabittir. Bir child görünmez olduğunda diğer childlar onun slotunu doldurmak için otomatik hareket etmez.

```text
[A][B][ ][D][E]
```

### Dynamic Active Items

Yalnız aktif childlar layout'a dahil edilir.

```text
[A][B][D][E]
```

ve kalan içerikler yeniden ortalanır.

Bu seçim group seviyesinde tanımlanabilir.

## Kat + yön oku örneği

Dikey ekranın merkezinde bir Bounding Group:

```text
┌──────────────────────────┐
│                          │
│        11       ↑        │
│                          │
└──────────────────────────┘
            ↑
       screen center
```

Group örneğin 100 px genişliğinde bir reference area kullanabilir.

```text
screen width = 800
screen center = 400

group center = 400
```

Floor değeri değişse bile:

```text
1
11
-1
R
Z
K
T
P
```

gibi içeriklerin oluşturduğu grup merkezi değişmez.

Okun kendi widget geometrisi group içindeki slotuna göre sabit kalabilir; floor digit sayısı arttığında group'un referans merkezi kaymamalıdır.

Bu modelde Designer'ın firmware'in floor digit placement matematiğini birebir uygulaması zorunlu değildir. Simulator'da canonical Bounding Group davranışı gösterilir; gerçek firmware aynı davranışı kendi renderer/layout kodunda uygulayacaktır.

## Uyarı örneği

Üç içerik aynı Bounding Group içine alınırsa:

```text
[Service Out] [Overload] [Fire]
                     ↑
                  center
```

iki içerikte:

```text
[Service Out]       [Fire]
         \           /
          \ center /
```

bir içerikte:

```text
              [Fire]
                  ↑
                center
```

Bu, uyarıların kendi runtime priority sisteminden ayrıdır.

## Runtime Priority ≠ Bounding Group

Bounding Group yalnız geometrik yerleşimi belirler.

Runtime/event priority 0–10 ise hangi koşulun presentation davranışının kazanacağını belirler.

Visual Z-order ise çizim sırasını belirler.

Üç kavram ayrı tutulur:

```text
Runtime Priority → behavior/content resolution
Bounding Group   → geometry/alignment
Z-order          → rendering order
```

## Designer UI

Bounding Group bir widget seçeneği/container seçeneği olarak sunulabilir:

```text
[ + Bounding Group ]
```

Group seçildiğinde:

```text
Bounding Group
────────────────────
Reference:   [ Screen Center ▼ ]
Width:       [ 100 ]
Height:      [ 60 ]

Horizontal:  [ Center ▼ ]
Vertical:    [ Center ▼ ]

Layout Mode:
  ( ) Fixed Slots
  (•) Dynamic Active Items

Spacing:     [ 20 ]

Children:
  • Floor Number
  • Direction Arrow
```

Bu seçenek zorunlu değildir. Normal widgetlar Bounding Group olmadan serbestçe konumlandırılabilir.

## Simulator

Simulator Bounding Group'u gerçek Designer layout modelinin bir parçası olarak render etmelidir.

Örneğin:

```text
floor = 1
```

ve:

```text
floor = 11
```

arasında group referans merkezi aynı kalmalıdır.

AI tarafından oluşturulan template de simulator üzerinden test edilebilmelidir.

## Firmware hedefi

Template Designer simulatorındaki Bounding Group davranışı firmware için referans davranıştır.

Firmware implementasyonu daha sonra aynı geometrik sözleşmeyi kendi renderer'ında gerçekleştirecektir.

Designer firmware'e gereksiz bir anchor graph dayatmaz.

## Explicit non-goals

- Bounding Group bütün widgetların zorunlu parent'ı değildir.
- Klasik anchor-to-anchor sistemi değildir.
- Runtime priority değildir.
- Z-order değildir.
- Popup değildir.
- Floor widgetına özel bir sistem değildir.

**Bounding Group yalnızca ihtiyaç olduğunda kullanılan genel bir geometrik hizalama mekanizmasıdır.**
