# Firmware Presentation Settings

## 1. Temel prensip

Firmware, sahada teknisyenin bina ve müşteri ihtiyacına göre değiştirebileceği presentation ayarlarını yönetebilir.

Template Designer bu ayarları kendi başına icat etmez. Firmware/device profile hangi ayarları destekliyorsa Designer bunu bilir ve template'in gerekli seçeneklerini buna göre hazırlar.

## 2. Ses sistemi

Firmware tarafından yönetilebilen ses ayarları en az şu kavramları desteklemeye uygun tasarlanmalıdır:

```text
Voice / Announcement Language
Voice Pack
Announcement Volume
Background Music Volume
Background Music Enable/Disable
```

### Default ses seviyeleri

Template Designer'da ses seviyeleri **default değer olarak tasarlanabilir**.

Örneğin:

```text
Announcement Volume: 70%
Background Music Volume: 25%
```

Bu değerler deployment/template default'u olabilir.

Firmware menüsü daha sonra sahada bu değerleri değiştirebilir.

Dolayısıyla:

```text
Template Default
       ↓
Firmware Initial/Stored Setting
       ↓
Technician can change in field
       ↓
Runtime Audio
```

Designer'da ses seviyesi seçilememesi gibi bir kısıt olmamalıdır.

## 3. Fon müziği

Fon müziği bağımsız bir audio content türüdür.

Template Designer:

- fon müziği assetini tanımlayabilir,
- default volume belirleyebilir,
- enable/disable default'u belirleyebilir,
- gerekiyorsa loop davranışını tanımlayabilir.

Firmware sahada desteklenen ayarları değiştirebilir.

Örneğin:

```text
Background Music
Asset: lobby_music.wav
Default Volume: 20%
Default Enabled: true
```

## 4. Announcement audio

Anonslar runtime state/condition ile tetiklenebilir.

Örneğin:

```text
floor = 5
      ↓
announcement sequence
      ↓
localized audio
```

Anons içeriği firmware tarafından seçilen runtime language'a göre çözülebilir.

## 5. Kat anonsu

Kat anonsları **kata özel tek bir hazır cümleye indirgenmemelidir**.

Bir kat için birden fazla dilde ve/veya birden fazla ses parçası sıralanabilmelidir.

Örneğin kat 5 için:

```text
Floor 5 Announcement
├── Language 1
│   └── audio asset
├── Language 2
│   └── audio asset
└── ...
```

Ancak asıl model daha genel olmalıdır:

```text
Announcement Sequence
├── language 1 content
├── language 2 content
├── language 3 content
└── ...
```

Firmware sahada seçili dili belirlediğinde ilgili dilin anonsu kullanılır.

## 6. Birden fazla anons parçası

Kat anonsu tek dosya olmak zorunda değildir.

Örneğin:

```text
"5"
"inci"
"kat"
```

veya:

```text
"Fifth"
"floor"
```

gibi parçalar sequence olarak birleştirilebilir.

Bu yapı ileride ortak audio parçalarının tekrar kullanılmasına imkan verir.

Kesin audio sequencing modeli firmware sözleşmesiyle ayrıca belirlenmelidir.

## 7. Kata özel anons

Sistemde **kata özel anons tanımı desteklenmelidir**.

Örneğin:

```text
Floor -1
  announcement assets

Floor 0
  announcement assets

Floor 1
  announcement assets

...

Floor 11
  announcement assets
```

Ancak her katın aynı uzunlukta veya aynı asset yapısında olması zorunlu değildir.

Bir kat için farklı dilde farklı audio content tanımlanabilir.

## 8. Kat numarası sembolleri

Floor değeri yalnız sayılardan oluşmaz.

Sistemin kat/konum sembol seti şu tür karakterleri desteklemeye uygun olmalıdır:

```text
R
Z
K
T
P
0
1
2
...
9
-
```

Bu liste örnek/ilk set olarak ele alınmalıdır; gerçek firmware profile desteklenen sembolleri ilan etmelidir.

Dolayısıyla `floor` değeri yalnız `integer` kabul edilmemelidir.

Canonical runtime model gerekirse:

```text
FloorValue
├── numeric value
└── symbolic value
```

veya daha genel bir typed value modeli kullanmalıdır.

Örneğin:

```text
floor = "R"
floor = "Z"
floor = "K"
floor = "T"
floor = "P"
floor = "-1"
floor = "8"
```

Designer gelen değeri kendi kafasına göre başka kata dönüştürmez.

## 9. Digit style ve sembol seti

Digit style yalnız `0-9` dosyalarından oluşmamalıdır.

Bir style gerektiğinde:

```text
0-9
-
R
Z
K
T
P
```

gibi desteklenen sembolleri taşıyabilir.

Bir style'ın hangi sembolleri desteklediği metadata ile ilan edilmelidir.

Eksik sembol varsa validation bunu göstermelidir.

## 10. Dil + kat sembolü

Kat gösterimi runtime language ile birlikte değişebilir.

Örneğin firmware language setting değiştiğinde template uygun localized floor representation kullanabilir.

Ancak raw floor state yine firmware'in verdiği değer olarak korunur.

```text
Firmware floor = R
Firmware language = en
        ↓
Floor Resolver
        ↓
English-compatible representation/style
```

## 11. Firmware ayarı ile template default'u

Bir ayarın iki farklı değeri olabilir:

```text
Template Default
Firmware Runtime Value
```

Örneğin:

```text
Template:
Announcement Volume = 70%
Background Music = 20%
Language = tr-TR

Firmware menu:
Language → en-US
Announcement Volume → 80%
Background Music → 10%
```

Runtime'da firmware'in aktif değeri kullanılır.

Template defaultları ise firmware'in ilgili setting için kayıtlı bir değeri olmadığında veya firmware sözleşmesi böyle tanımladığında başlangıç değeri olarak kullanılır.

Kesin precedence firmware contract tarafından belirlenmelidir.

## 12. Simulator

Simulator hem template defaultlarını hem firmware runtime settinglerini simüle edebilmelidir.

Örneğin:

```text
Language: English
Announcement Volume: 80%
Background Music Volume: 10%
Floor: 5
```

ve olay tetiklendiğinde gerçek runtime audio/content resolution kullanılmalıdır.

## 13. Validation

Designer şu durumları kontrol etmelidir:

- seçilen dil için gerekli text/audio asset var mı?
- seçilen floor sembolü digit style tarafından destekleniyor mu?
- R/Z/K/T/P gibi semboller gerekli style'da var mı?
- kat anonsu için gerekli dil varyantı var mı?
- default audio volume geçerli aralıkta mı?
- background music asseti geçerli mi?
- firmware profile ilgili settingleri destekliyor mu?
- firmware'in değiştirebileceği setting için template gerekli varyantları içeriyor mu?

## 14. Temel ayrım

```text
Firmware State
    = cihazın o anki durumu

Firmware Setting
    = teknisyenin firmware menüsünden seçtiği değer

Template Default
    = Designer'ın paket için tanımladığı başlangıç değeri

Template Binding
    = state/setting sonucunda hangi içeriğin gösterileceği/çalınacağı
```

Bu dört kavram birbirine karıştırılmamalıdır.
