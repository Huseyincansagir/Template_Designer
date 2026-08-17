# Template Designer — Ana Proje Geliştirme Promptu

## 1. Proje Amacı

Windows üzerinde çalışan modern bir **Template Designer / Device Deployment** uygulaması geliştir.

Uygulamanın temel amacı, kullanıcı tarafından oluşturulan ve düzenlenen temaları/template'leri bir deployment paketi haline getirip **SD karta yazmaktır**.

İlk sürümde gerçek deployment yöntemi yalnızca:

**PC → SD Card → fiziksel olarak cihaz → SD Card**

olacaktır.

Kullanıcı laptopu cihazın yanına götürür, Template Designer ile temayı hazırlar, SD karta yazar, SD kartı güvenli şekilde çıkarır ve SD kartı hedef cihaza takar.

Şimdilik Wi-Fi haberleşmesi uygulanmayacaktır.

Ancak mimari en baştan, ileride:

**PC → Wi-Fi → ESP32-C6 → hedef cihaz**

şeklindeki deployment yöntemini destekleyecek şekilde tasarlanmalıdır.

---

# 2. Çok Önemli Mimari Ayrım

"Web desteği" kesinlikle cihaz üzerinde web sayfası çalışması anlamına gelmez.

Cihazın:

- web arayüzü olmayacak,
- browser üzerinden açılan bir sayfası olmayacak,
- HTTP server olarak kullanıcı arayüzü sunmayacak.

Web teknolojileri yalnızca **PC'deki Template Designer UI'ının geliştirilmesinde** kullanılacaktır.

Uygulamanın frontend'i:

- React
- TypeScript
- HTML
- CSS
- SVG / Canvas

gibi web teknolojileriyle geliştirilebilir.

Desktop uygulaması Windows üzerinde local olarak çalışacaktır.

Geliştirme sırasında UI browser üzerinden:

`localhost`

üzerinden çalışabilmelidir.

Production'da ise uygulama Windows desktop uygulaması olarak paketlenmelidir.

Önerilen desktop shell:

**Tauri**

Ancak mimariyi Tauri'ye gereksiz şekilde bağımlı hale getirme.

---

# 3. Hedef Mimari

Genel mimari:

```text
                    TEMPLATE DESIGNER
                           |
              +------------+------------+
              |                         |
          Presentation            Application Core
              |                         |
      React + TypeScript                |
      HTML + CSS                        |
              |                         |
              +------------+------------+
                           |
                   Deployment Manager
                           |
                 Deployment Interface
                           |
              +------------+------------+
              |                         |
        SD Card Adapter          Wi-Fi Adapter
             V1                         V2
           ACTIVE                    RESERVED
              |                         |
              v                         v
           SD Card                  ESP32-C6
                                        |
                                   UART/SPI/etc.
                                        |
                                        v
                                  Target Device
                                        |
                                        v
                                    SD Card
```

V1'de yalnızca `SD Card Adapter` aktif olacaktır.

`Wi-Fi Adapter` için gerekli abstraction/interface oluşturulabilir ancak gerçek Wi-Fi kodu V1 kapsamında yazılmamalıdır.

---

# 4. Deployment Mantığı

Application Core seviyesinde deployment işlemi transporttan bağımsız olmalıdır.

Örneğin üst seviyede:

```text
Deploy(project)
```

veya eşdeğer bir abstraction bulunmalıdır.

UI'nin şunu bilmesi gerekmemektedir:

- SD karta mı yazılıyor?
- Wi-Fi ile mi gönderiliyor?
- USB ile mi gönderiliyor?

Bunlar deployment target/adapter katmanının sorumluluğudur.

Mantıksal yapı:

```text
DeploymentManager
       |
       +-- SDCardTarget
       |
       +-- WiFiDeviceTarget
       |
       +-- Future targets
```

V1:

```text
DeploymentManager
       |
       v
SDCardTarget
       |
       v
SD Card
```

V2:

```text
DeploymentManager
       |
       v
WiFiDeviceTarget
       |
       v
ESP32-C6
       |
       v
Target Device
```

---

# 5. Deployment Package

Template'in kaynak proje yapısı ile cihaza gönderilecek deployment paketi birbirinden ayrılmalıdır.

Örneğin kullanıcı projesi:

```text
MyTheme/
├── project.json
├── source/
├── templates/
├── components/
└── assets/
```

olabilir.

Fakat SD karta doğrudan bu proje yapısını kopyalama.

Önce bir deployment package oluştur:

```text
theme.pkg
```

Örnek mantıksal içerik:

```text
theme.pkg
├── manifest.json
├── theme.json
├── layout.json
├── assets/
│   ├── logo.png
│   ├── background.jpg
│   └── icons/
└── checksum
```

Package formatı ileride hem SD Card hem Wi-Fi deployment için aynı olmalıdır.

Temel prensip:

```text
Template Project
       |
       v
Template Compiler / Package Builder
       |
       v
Deployment Package
       |
       +--------> SD Card
       |
       +--------> Wi-Fi / ESP32-C6
```

Aynı package iki farklı fiziksel taşıma yöntemiyle aktarılabilmelidir.

---

# 6. Gelecekteki Wi-Fi Mimarisi

Wi-Fi V1'de uygulanmayacak.

Ancak gelecekte sistem şu şekilde çalışacaktır:

```text
Laptop
   |
   | Wi-Fi
   v
ESP32-C6
   |
   | UART / SPI / CAN / RS485 / other
   v
Target Device
   |
   v
SD Card
```

ESP32-C6 bir **web UI hostu olmayacaktır**.

ESP32-C6 yalnızca network communication/device transport katmanı olacaktır.

PC uygulaması ESP32-C6'nın IP adresini kullanarak veri gönderip alacaktır.

Örneğin gelecekte:

```text
PC Application
      |
      | TCP / HTTP / WebSocket / custom protocol
      |
      v
ESP32-C6
      |
      | device protocol
      v
Target Device
```

kullanılabilir.

Kullanılacak gerçek protokol V2 kapsamında ayrıca tasarlanacaktır.

V1'de bu protokolün yalnızca abstraction/interface seviyesinde geleceğe hazır olması yeterlidir.

---

# 7. Local / Offline Çalışma

Uygulama tamamen offline-first olmalıdır.

V1 için:

- Internet gerekmemeli.
- Cloud gerekmemeli.
- Account/login gerekmemeli.
- Remote database gerekmemeli.
- Online API bağımlılığı olmamalı.
- Template Designer'ın temel fonksiyonları internet olmadan çalışmalıdır.

PC'de local web teknolojileri kullanılabilir.

Örneğin geliştirme:

```text
http://localhost:3000
```

gibi çalışabilir.

Production'da:

```text
TemplateDesigner.exe
```

şeklinde Windows uygulaması olarak çalışmalıdır.

---

# 8. SD Card V1 İş Akışı

V1'in ana kullanıcı akışı:

```text
Open Application
      |
      v
Open/Create Project
      |
      v
Edit Template
      |
      v
Preview
      |
      v
Validate
      |
      v
Build Deployment Package
      |
      v
Select SD Card
      |
      v
Write Package
      |
      v
Verify
      |
      v
Safe Eject
      |
      v
"Remove SD Card and insert it into the device"
```

Uygulama mümkün olduğunca kullanıcıya açık ve güvenli bir workflow sağlamalıdır.

---

# 9. SD Card İşlemleri

V1'de aşağıdaki işlemler desteklenmelidir:

- Removable drive detection
- SD card selection
- Available space kontrolü
- Package size kontrolü
- SD karta deployment
- Dosya yazma progress'i
- Verification
- Checksum/hash kontrolü
- Yazma hatalarının yönetimi
- SD card removal / safe eject workflow
- İşlem sırasında kullanıcıyı yanlış işlem yapmaktan koruyan UI

Kullanıcı SD kartı çıkarmadan önce uygulama açıkça:

```text
Deployment completed successfully.

You can safely remove the SD card and insert it into the device.
```

benzeri bir durum göstermelidir.

---

# 10. Cihaz Protokolü İçin Geleceğe Hazır Abstraction

V1'de Wi-Fi çalışmayacak olsa bile device communication abstraction oluştur.

Örneğin konsept olarak:

```text
DeviceTransport
├── send()
├── receive()
├── connect()
├── disconnect()
└── getStatus()
```

veya projeye uygun daha iyi bir abstraction kullanılabilir.

SD card deployment bununla karıştırılmamalıdır.

Örneğin:

```text
DeploymentTarget
├── SDCardTarget
└── WiFiDeviceTarget
```

ayrı kavramdır.

Bu sayede ileride Wi-Fi eklendiğinde Template Editor'ın değiştirilmesi gerekmemelidir.

---

# 11. Önerilen Proje Yapısı

Projeyi temiz ve ölçeklenebilir şekilde organize et.

Örneğin:

```text
template-designer/
│
├── apps/
│   ├── desktop/
│   │   └── Tauri application
│   │
│   └── web/
│       └── Browser-compatible frontend
│
├── packages/
│   ├── ui/
│   ├── template-core/
│   ├── project-core/
│   ├── deployment-core/
│   ├── device-protocol/
│   └── shared-types/
│
├── adapters/
│   ├── filesystem/
│   ├── sd-card/
│   ├── wifi/
│   └── web/
│
└── docs/
    ├── ARCHITECTURE.md
    ├── TEMPLATE_FORMAT.md
    ├── DEPLOYMENT_FORMAT.md
    └── DEVICE_PROTOCOL.md
```

Bu yapı örnektir.

Repository'nin mevcut durumunu analiz ederek daha iyi bir yapı gerekiyorsa onu tercih et.

Gereksiz abstraction veya premature complexity oluşturma.

---

# 12. UI Teknolojisi

UI modern bir desktop application gibi görünmelidir.

Tercih:

```text
React
TypeScript
CSS
SVG
```

UI web teknolojileriyle yapılmalıdır.

Native Windows görünümünü birebir taklit etmek zorunda değildir.

Modern profesyonel engineering software / IDE / designer uygulamalarından ilham alan bir UI kullanılabilir.

Ana layout örneği:

```text
+----------------------------------------------------------+
| Menu / Toolbar                                           |
+----------------+-------------------------+---------------+
|                |                         |               |
| Project        |                         | Properties    |
| Explorer       |      Template Canvas    | / Inspector   |
|                |                         |               |
| Templates      |                         |               |
| Assets         |                         |               |
|                |                         |               |
+----------------+-------------------------+---------------+
| Status / Logs / Deployment Progress                      |
+----------------------------------------------------------+
```

UI bileşenleri modüler olmalıdır.

---

# 13. Template Editor

Template Designer yalnızca dosya kopyalayan bir araç olmamalıdır.

Temel olarak:

- Template creation
- Template editing
- Component management
- Properties
- Layout
- Assets
- Preview
- Validation
- Export/deployment

işlevlerine sahip olacak şekilde tasarlanmalıdır.

Ancak V1'de gereksiz yere devasa bir visual editor geliştirme.

Öncelikle çalışan bir temel sistem oluştur.

---

# 14. Data Model

Template, project, asset, deployment ve device kavramlarını birbirinden ayır.

Örneğin:

```text
Project
Template
Asset
DeploymentPackage
DeploymentTarget
Device
DeviceConnection
```

kavramları ayrı modeller olarak tasarlanmalıdır.

Shared types TypeScript tarafında merkezi bir yerde tutulmalıdır.

---

# 15. Device Model

Gelecekte cihazlar şu bilgileri taşıyabilir:

```text
Device
├── id
├── name
├── type
├── ipAddress
├── firmwareVersion
├── hardwareVersion
├── capabilities
└── connectionStatus
```

V1'de `Device` modelinin büyük kısmı kullanılmayabilir.

Ancak gelecekte Wi-Fi device management'a geçişi kolaylaştıracak şekilde tasarlanabilir.

---

# 16. Wi-Fi Device Discovery

V1'de IMPLEMENT ETME.

Sadece mimariyi buna uygun bırak.

Gelecekte:

```text
Scan
   |
   v
Discover ESP32-C6
   |
   v
Get Device Info
   |
   v
Show Device
   |
   v
Connect
```

akışı eklenebilir.

ESP32-C6'nın IP adresi ileride cihaz kimliğinin bir parçası olarak kullanılabilir.

---

# 17. Browser Compatibility

Web UI mümkün olduğunca browser-compatible olmalıdır.

Özellikle şu bölümler platform bağımsız olmalıdır:

- Template editor
- Preview
- Project management
- Validation
- Package building
- UI state
- Shared data models

Native API gerektiren bölümler adapter üzerinden kullanılmalıdır:

```text
UI
 |
 v
Application Service
 |
 v
Platform Adapter
```

Örneğin SD card erişimi doğrudan React component'larının içine yazılmamalıdır.

---

# 18. Platform Adapter Kuralı

Aşağıdaki gibi kod yazma:

```text
Button onClick
    -> directly access filesystem
```

Bunun yerine:

```text
Button
   |
   v
DeploymentService
   |
   v
SDCardAdapter
   |
   v
Native filesystem
```

kullan.

Aynı şekilde gelecekte:

```text
Button
   |
   v
DeploymentService
   |
   v
WiFiDeviceAdapter
   |
   v
ESP32-C6
```

olabilsin.

---

# 19. Güvenilirlik

Bu uygulama ileride gerçek cihazlarda kullanılacağı için deployment işlemi güvenilir olmalıdır.

Özellikle:

- checksum
- package validation
- versioning
- atomic deployment mümkünse atomic write
- temporary files
- rollback/failure handling
- verification
- detailed logs

gibi mekanizmaları düşün.

Kullanıcıya:

```text
Preparing...
Writing...
Verifying...
Completed
```

gibi açık durumlar göster.

Başarısız durumda:

```text
What failed?
Why did it fail?
What should the user do?
```

sorularının cevabı UI'da anlaşılır şekilde verilmelidir.

---

# 20. Logging

Application seviyesinde merkezi bir logging sistemi oluştur.

Örneğin:

```text
INFO
WARN
ERROR
DEBUG
```

seviyeleri olabilir.

Deployment sırasında:

```text
[INFO] Project loaded
[INFO] Template validated
[INFO] Deployment package created
[INFO] SD card detected
[INFO] Writing package
[INFO] Verification started
[INFO] Verification successful
[INFO] Deployment completed
```

gibi loglar üret.

---

# 21. Error Handling

Hataları sadece console'a yazma.

Örneğin:

```text
SD card not found
```

yerine:

```text
No removable SD card was detected.

Insert the SD card and try again.
```

gibi kullanıcıya yönelik hata mesajları kullan.

Ancak teknik detayları log sisteminde koru.

---

# 22. Security

V1 offline olsa bile temel güvenlik prensiplerini uygula.

Özellikle ileride Wi-Fi device communication geleceği için:

- arbitrary network command çalıştırma
- uncontrolled file writes
- path traversal
- invalid package
- malformed device response
- oversized payload

gibi durumları dikkate al.

Wi-Fi protokolü V2'de ayrıca güvenli hale getirilecektir.

---

# 23. Development Strategy

Projeyi tek seferde devasa hale getirme.

Aşamalar:

## Phase 1 — Foundation

- Repository analizi
- Architecture
- Project structure
- React + TypeScript + CSS
- Tauri integration
- Shared types
- Core services
- Adapter interfaces

## Phase 2 — Template Core

- Project model
- Template model
- Asset model
- Template editor
- Preview
- Validation

## Phase 3 — Deployment Package

- Package format
- Manifest
- Version
- Hash/checksum
- Package builder
- Verification

## Phase 4 — SD Card Deployment

- Removable drive detection
- SD card selection
- Write
- Verify
- Safe eject
- Progress UI
- Error handling

Bu noktada V1 kullanılabilir durumda olmalıdır.

## Phase 5 — Future Wi-Fi Preparation

V1'de gerçek Wi-Fi implementation yapma.

Sadece:

- WiFiDeviceTarget interface
- DeviceTransport abstraction
- Device model
- Protocol model
- capability model

gibi gerekli abstraction'ların doğru yerde olduğundan emin ol.

---

# 24. Kesinlikle Yapılmaması Gerekenler

Şimdilik:

- ESP32 firmware geliştirme
- Wi-Fi communication implementation
- HTTP server on ESP32
- ESP32 web page
- Cloud backend
- Authentication server
- Online account
- Internet dependency
- Remote database
- Browser-to-device deployment
- Android application
- iOS application

GELİŞTİRME.

Bunlar gelecekteki aşamalardır.

Ancak mimari bunları destekleyebilecek şekilde tasarlanmalıdır.

---

# 25. Başarı Kriteri

İlk gerçek milestone şu olmalıdır:

1. Windows laptopta Template Designer açılır.
2. Kullanıcı proje oluşturabilir.
3. Template oluşturabilir/düzenleyebilir.
4. Preview görebilir.
5. Template validate edilir.
6. Deployment package oluşturulur.
7. SD card takılır.
8. Uygulama SD card'ı algılar.
9. Kullanıcı "Deploy to SD Card" seçer.
10. Package SD karta yazılır.
11. Yazılan veriler doğrulanır.
12. Deployment başarılı olarak işaretlenir.
13. Kullanıcı SD kartı güvenli şekilde çıkarır.
14. SD kart fiziksel olarak hedef cihaza takılır.

Bu akış stabil şekilde çalışıyorsa V1'in temel amacı gerçekleşmiştir.

---

# 26. Coding Agent İçin Çalışma Kuralı

Projeye kod yazmaya başlamadan önce:

1. Repository'nin mevcut yapısını incele.
2. Mevcut dosyaları ve teknolojileri tespit et.
3. Mevcut `README`, `AGENTS`, `SKILL`, `MD` ve documentation dosyalarını oku.
4. Mevcut mimariyle çelişen gereksiz değişiklikler yapma.
5. Önce architecture planını çıkar.
6. Ardından minimum çalışan foundation'ı oluştur.
7. Sonra V1 SD Card workflow'unu tamamla.
8. Her aşamadan sonra build/test çalıştır.
9. Hataları çözmeden bir sonraki aşamaya geçme.
10. Gereksiz abstraction oluşturma; ancak gelecekteki Wi-Fi deployment için gerekli sınırları doğru belirle.

Kod kalitesi production-oriented olmalıdır.

---

# 27. Temel Tasarım Prensibi

Bu projenin ana prensibi:

**"One Template, Multiple Deployment Transports."**

Template'in kendisi deployment yönteminden bağımsızdır.

```text
                 TEMPLATE
                    |
                    v
             Deployment Package
                    |
          +---------+---------+
          |                   |
          v                   v
      SD Card              Wi-Fi
       V1                   V2
          |                   |
          v                   v
      Target Device       ESP32-C6
                              |
                              v
                         Target Device
```

Dolayısıyla bugün sadece:

**PC → SD Card**

yapıyoruz.

Fakat yarın:

**PC → Wi-Fi → ESP32-C6 → Device**

eklemek Template Designer'ın temel mimarisini değiştirmemelidir.

---

# SON TALİMAT

Bu gereksinimleri temel proje spesifikasyonu olarak kabul et.

Önce mevcut repository'yi incele ve mevcut durum ile bu hedef mimari arasındaki farkları belirle.

Ardından V1 için uygulanabilir bir geliştirme planı çıkar.

Planı gereksiz şekilde büyütme.

Öncelik:

**çalışan, güvenilir, modern Windows Template Designer + SD Card Deployment.**

Wi-Fi ve web/device communication geleceğe hazır abstraction olarak tasarlanacak; fakat V1'de gerçek Wi-Fi implementation yapılmayacak.

UI ise baştan **React + TypeScript + CSS tabanlı local web UI** olarak tasarlanacak ve Windows'ta **Tauri desktop application** olarak paketlenebilecek şekilde geliştirilecek.
