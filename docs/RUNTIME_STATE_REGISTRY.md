# Runtime State Registry

## Amaç

Template Designer şu aşamada ARKEL protokolünü veya başka bir gerçek seri haberleşme protokolünü çözmez. Bu doküman yalnızca Template Designer'ın kullanacağı **runtime state isimlendirme ve registry mekanizmasını** tanımlar.

Gerçek state'lerin ne olduğu ve hangi ham veriden üretildiği firmware tarafından belirlenir.

## 1. Temel kural

**Runtime state'leri Template Designer icat etmez. Firmware tanımlar.**

Designer'da kullanıcıya genel amaçlı `+ Custom State` / `Yeni State Oluştur` özelliği verilmeyecektir.

Firmware bir state tanımladığında bu state, cihaz/firmware profile ait state registry'ye eklenir. Designer bu registry'yi okuyarak ilgili Properties, Binding, Simulator ve test bölümlerinde state'i otomatik olarak kullanılabilir hale getirir.

```text
Firmware Profile
      ↓
Runtime State Registry
      ↓
Template Designer
      ├── Widget Properties
      ├── Runtime Binding
      ├── Priority
      ├── Simulator
      └── AI API
```

## 2. State ile protokol ayrımı

Template Designer'ın domain modeli ham seri haberleşme protokolüne bağlanmamalıdır.

Örneğin firmware içindeki gerçek protokol:

```text
raw bytes / bits / packets
        ↓
firmware decoder
        ↓
canonical runtime state
```

şeklinde çalışır.

Designer'ın gördüğü şey yalnızca canonical state'tir:

```text
floor
up
 down
door_open
fire
...
```

Ham bit numarası, byte offseti, UART frame yapısı, CRC vb. Designer'ın template modeline ait değildir.

## 3. Şimdilik kullanılacak elevator state'leri

İlk Designer state registry'si, mevcut proje/sözleşmede tanımlanan elevator davranışlarıyla sınırlıdır.

### Hareket / yön

```text
up
 down
idle
```

### Kat

```text
floor
```

`floor` boolean değildir; firmware'in belirlediği runtime değeridir. Designer değeri değiştirmez veya yeniden hesaplamaz.

### Kapı

```text
door_opening
door_open
door_closing
door_closed
```

Bu isimler mevcut firmware tarafından farklı adlarla sağlanıyorsa firmware profile mapping'i canonical Designer state adına dönüştürür.

### Alarm / güvenlik

```text
fire
overl​​oad
estop
service
```

### Diğer mevcut runtime durumları

```text
warning
```

`warning` gibi genel state'ler yalnız firmware profile gerçekten sağlıyorsa kullanılmalıdır. Ayrı semantic alarm durumları varsa onlar ayrı state olarak registry'ye eklenmelidir.

> Not: Bu liste protokol bit tablosu değildir. Gerçek firmware state registry'si kesinleştiğinde isimler, tipler ve açıklamalar oradan canonical olarak alınacaktır.

## 4. State metadata

Bir state yalnız string isimden oluşmamalıdır. Registry mümkün olduğunca şu metadata'yı taşımalıdır:

```text
StateDefinition
├── id
├── displayName
├── description
├── type
├── category
├── unit (optional)
├── enumValues (optional)
├── defaultValue (optional)
├── simulatorSupport
└── bindingCapabilities
```

Örnek:

```json
{
  "id": "door_open",
  "displayName": "Kapı Açık",
  "type": "boolean",
  "category": "door",
  "simulatorSupport": true
}
```

Kat:

```json
{
  "id": "floor",
  "displayName": "Kat",
  "type": "integer",
  "category": "elevator",
  "simulatorSupport": true
}
```

## 5. State registry UI'ya nasıl yansır?

Kullanıcı bir widget seçtiğinde Properties paneli yalnız o cihaz profilinde bulunan state'leri göstermelidir.

Örneğin `Text` widgetı:

```text
Runtime Binding

[ None ▼ ]

Available states:
  Floor
  Direction
  Door Open
  Door Closing
  Fire
  E-Stop
  Overload
  Service
```

Kullanıcı ayrıca condition oluştururken registry'den state seçer:

```text
State: Fire
Operator: ==
Value: true
Priority: 10
```

## 6. Yeni firmware state eklenirse

Firmware profile'a yeni bir state eklendiğinde Designer kodunun içine yeni `if/else` eklemek gerekmemelidir.

Örneğin firmware profile:

```text
lighting
```

state'ini eklediğinde Designer otomatik olarak:

```text
Properties → Runtime Binding → Lighting
Simulator → Lighting
AI API → lighting
Validation → lighting
```

alanlarında bu state'i tanıyabilmelidir.

Aynı şekilde:

```text
fan_running
energy_mode
maintenance
alarm_ack
```

gibi ileride eklenecek state'ler de Designer yeniden derlenmeden, profile/registry güncellemesiyle kullanılabilir hale getirilebilmelidir.

## 7. Custom State oluşturma YOK

Designer'da şu özellik bulunmayacaktır:

```text
+ Custom State
State Name: my_state
Type: boolean
```

Bunun nedeni state'in yalnız bir template değişkeni olmamasıdır. State gerçek cihaz firmware'inin ürettiği runtime bilgisidir.

Template Designer yalnızca firmware tarafından ilan edilen state'lere bağlanır.

Bu ayrım şu şekilde korunur:

```text
Firmware
  owns → State Definition

Template Designer
  owns → Binding / Presentation

Template
  stores → Which content to show for the state
```

## 8. State → widget binding

Bir state'in kendisi widget değildir.

Örnek:

```text
State:
fire = true

Binding:
fire == true
priority = 10

Widget:
image_01

Content:
fire_warning.png
```

Aynı state birden fazla widget tarafından kullanılabilir:

```text
fire
 ├── warning image
 ├── warning text
 ├── background effect
 └── alarm animation
```

## 9. Priority state'in değil binding/condition'ın özelliğidir

State registry yalnız state'i tanımlar.

Template içindeki gösterim önceliği binding/condition üzerinde tanımlanabilir.

Örneğin:

```text
fire == true
priority = 10
```

ve:

```text
door_open == true
priority = 4
```

Bu sayede aynı state farklı widgetlarda farklı presentation priority'lerine sahip olabilir.

## 10. Simulator

Simulator state registry'den dinamik olarak oluşturulmalıdır.

Firmware profile:

```text
floor: integer
up: boolean
down: boolean
fire: boolean
lighting: enum
```

ise Simulator otomatik olarak ilgili kontrolleri oluşturabilir:

```text
Floor      [ 8 ]
Up         [ OFF ]
Down       [ ON ]
Fire       [ OFF ]
Lighting   [ 70% ]
```

Böylece Designer'ın simulator kodu da her yeni firmware state'i için yeniden yazılmak zorunda kalmaz.

## 11. AI API

AI de state'leri kendi kafasına göre oluşturamaz.

AI önce:

```text
get_device_profile()
get_runtime_states()
```

gibi API komutlarıyla mevcut state registry'yi öğrenir.

Sonra:

```text
bind_state()
set_condition()
set_priority()
```

komutlarıyla mevcut state'leri kullanır.

Böylece AI yanlış veya firmware'de bulunmayan bir state adı ürettiğinde validation bunu yakalar.

## 12. State name ve firmware compatibility

Template dosyasında state'in kullanıcı görünen adı ile firmware'in canonical ID'si ayrılmalıdır.

Örnek:

```text
id: door_open
displayName: Kapı Açık
```

Template deployment sırasında firmware'in anlayacağı canonical ID kullanılmalıdır.

Kullanıcıya Türkçe açıklama gösterilebilir; firmware'e gönderilen/konfigürasyonda saklanan identifier değişmemelidir.

## 13. State registry versioning

Firmware profile state registry'si version'lanmalıdır.

Örneğin:

```text
firmware: elevator_h747_v2
stateRegistryVersion: 1.2
```

Bir template oluşturulduğunda hangi state registry sürümüne göre oluşturulduğu kaydedilmelidir.

Böylece firmware sonradan state kaldırır/değiştirirse Designer validation bunu anlayabilir.

## 14. Backward compatibility

Firmware yeni state eklediğinde eski template'ler bozulmamalıdır.

Yeni state yalnızca registry'de görünür hale gelir.

Bir state kaldırılırsa veya tipi değişirse template validation uyarı/hata vermelidir.

## 15. Bu aşamada yapılmayacaklar

- ARKEL protokolü çözümleme
- gerçek bit/byte mapping
- yeni custom state oluşturma UI'sı
- Designer içinde kullanıcı tanımlı runtime signal oluşturma
- state'in firmware dışı hesaplanması
- state isimlerini widget sınıflarına dönüştürme

Bunlar yerine Designer firmware profile tarafından sağlanan state registry'yi kullanacaktır.

## 16. Özet

```text
Firmware
   │
   │ State Registry
   ▼
Template Designer
   │
   ├── State listelerini otomatik göster
   ├── Widget bindinglerinde kullanılabilir yap
   ├── Priority/condition seçiminde göster
   ├── Simulator kontrollerini üret
   ├── AI API'ye expose et
   └── Validation'da doğrula
```

**Firmware state'i tanımlar. Template Designer state'i kullanır. Template state'in hangi görsel/medya davranışını tetikleyeceğini tanımlar.**
