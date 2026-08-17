# Media / Asset Browser — UX Questionnaire V1

> Arşivlenmiş soru-cevap turu. Media/Asset Browser, Media Slide, audio davranışı ve resource yönetimi implementasyonu sırasında referans alınır.

## 1. Asset Browser / Asset Depot

Asset Browser, Altium kütüphanesi benzeri bir **Asset Depot** içeriğini gösteren dockable bir tool window'dur.

- Asset Browser = depo/kütüphane görünümü.
- Theme Resources = projenin sahip olduğu/kullandığı kaynaklar.
- Bunlar aynı şey değildir.
- Asset Browser'dan seçilen asset istenen uyumlu projeye/scene'e kullanılabilir.
- Asset'in mevcut projede kullanılıp kullanılmadığı Asset Browser'da bir badge/check ile anlaşılabilir.
- Kullanım bilgisi `Used By` ile incelenebilir.
- Asset Browser ayrıca seçilen depo klasörünün içeriğini gösterir.
- Kullanılan assetler için ayrı ve anlaşılır bir kullanım durumu/badge gösterilir.

## 2. Asset kategorileri

`Unassigned`/`Unsigned` gibi ayrı bir kategori kullanılmaz.

Normal asset browser categories kullanılabilir; ayrıca unsupported dosyalar normal Asset Browser akışına dahil edilmez.

## 3. Preview

- Image: doğrudan gösterilir.
- Video: oynatılabilir ve temsilî frame/ilk frame thumbnail olarak gösterilir.
- Audio: oynatılabilir.
- Video/audio preview bir kez oynatılır; otomatik loop yoktur.
- Play/Pause bulunur.
- Seek/progress bar bulunur ve istenen noktadan oynatma başlatılabilir.
- Preview oynatma davranışı, widget/media-slide playback ayarlarından ayrıdır.

## 4. Asset'in Project Explorer'a bırakılması

Windows Explorer'dan dosya sürükleme yalnızca Project Explorer/resource hedeflerine yapılır.

**Canvas'a dışarıdan dosya sürükleme yoktur.**

Dosya Project Explorer'da bırakıldığı hedefe göre işlenir:

- destekleniyorsa uygun Theme Resources alanına düşer,
- desteklenmiyorsa `Unsupported Files` alanına düşer.

## 5. Resources

Theme içinde Resources bulunur.

Resources yalnızca dosya/asset kaynakları içindir. Widget veya Scene Resources içine konmaz.

Bir asset doğrudan Scene içine eklenmiş bir nesnenin parçası olarak kullanılabilir; bu durumda Scene/object hiyerarşisinde görünür ve o Scene'e bağlı referans olarak anlaşılır.

Sadece desteklenen dosya/formatlar Scene içine alınabilir. Unsupported dosyalar Scene'e alınmaz.

## 6. Unsupported Files

Unsupported dosyalar ayrı bir `Unsupported Files` alanında tutulur.

- Normal Asset Browser asset'i değildir.
- Widget olarak kullanılamaz.
- Template'e eklenemez.
- Normal export asset'i değildir.
- Gerekirse Design Rules/Validation tarafından raporlanabilir.

Bunlar normal asset kullanım ekranlarında gösterilerek UI'ı kirletmez; teknik/development görünürlüğü gereken yerde ayrı tutulur.

## 7. Asset semantic categories and filesystem

Asset deposu, programın kullanabileceği asset kütüphanesidir. Firmware'e gönderilecek klasör yapısı ise export aşamasında açık ve deterministik biçimde oluşturulur.

Örneğin semantic asset yapısı:

```text
THEME/
├── FLOOR/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
├── UP/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
├── DOWN/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
└── WARNING/
    ├── WARNING_01/
    ├── WARNING_02/
    └── CUSTOM/
```

Warning Sign olarak sınıflandırılan medya ilgili `Warning`/`Warning Signs` klasörüne gidebilir. Klasör isimleri ve export yapısı firmware'in doğrudan anlayabileceği kadar açık tutulur.

Renkler için daha sonra deterministik kod/klasör yapısı kullanılabilir. Bu konu firmware sözleşmesiyle birlikte kesinleştirilecektir.

## 8. Stable ID

Assetlerin stable ID'si vardır. Display name ve fiziksel filename stable ID'den bağımsızdır.

Örneğin:

```text
Display Name: Serdar Ortaç
Stable ID:    T01-A0042
File:         serdarortac.wav
```

Stable ID display name veya filename değişince değişmez.

### Rotation konusu

Asset inherently rotation-specific değildir. Aynı asset birden fazla rotation'da kullanılabilir.

Bu nedenle V1'de stable ID'nin rotation numarasını zorunlu olarak taşıması yerine Theme/package namespace + asset ID kullanılması tercih edilir:

```text
T01-A0042
```

Rotation kullanımı Scene/widget referansında tutulur.

Aynı asset farklı Theme'lere fiziksel olarak duplicate edilirse destination Theme kendi stable ID'sine sahip olabilir. Ayrı package/theme scope'larında aynı local ID'nin bulunması debug açısından sorun oluşturmaz; tek exported package içinde stable ID'ler unique olmalıdır.

Bu karar ileride firmware/package ID modeli netleştiğinde tekrar gözden geçirilebilir.

## 9. Asset duplication

Aynı asset tekrar içeri alındığında existing asset detection yapılabilir:

```text
Existing asset found
[ Use Existing ] [ Create Copy ] [ Cancel ]
```

Fiziksel olarak başka Theme'e kopyalanan asset destination ownership altında bağımsız olabilir.

## 10. Asset rename / replace

- Display name değişimi stable ID'yi değiştirmez.
- Filename değişimi stable ID'yi değiştirmez.
- Asset content replacement stable ID'yi korur.

## 11. Asset Browser vs export

Asset Browser yalnızca depo/library görünümüdür.

Depoda bulunan her asset SD Card'a otomatik export edilmez.

Normal export kapsamı:

- gerçekten kullanılan/referenced assetler,
- Theme Resources içindeki export edilmesi gereken kaynaklar,
- gerekli DeviceProfile/default assets.

**Yalnız Resources, kullanılan assetler ve gerekli default assets export edilir.**

`Unsupported Files` export edilmez.

## 12. Format conversion

V1 Designer tam media format conversion yapmaz.

Özellikle otomatik:

- MP4 → AVI
- JPEG → başka format
- WAV → başka format
- ARGB888 conversion

yoktur.

Gelecekte ayrı Format Tool yapılabilir.

Designer'da widget/display size değiştirilebilir. Bu, full media encoding/format conversion değildir.

Basit asset resize/ölçekleme daha sonra eklenebilir; full format conversion ayrı Format Tool kapsamındadır.

## 13. Design Rules

Tek bir `Design Rules` sekmesi/alanı bulunabilir ve asset/design kontrolleri burada toplanabilir.

Örnek kontroller:

```text
Missing asset reference
Unsupported file
Asset format mismatch
Missing required profile asset
Duplicate stable ID within package
Missing resource
Invalid widget/media combination
Unused resource (informational)
Concurrent video decode/resolution limit
```

Export validation bu kuralları çalıştırabilir.

## 14. Media Slide temel modeli

Media, media olarak ele alınır. Arrow, digit vb. semantic widget kavramları Media Slide'ın içine karıştırılmaz.

Bir Media Slide tek bir medya içeriği oynatır. Aynı Scene içinde birden fazla Media Slide/widget bulunabilir.

Bir Scene'de birden fazla media widget aynı anda aktif olabilir. Cihazın desteklediği eşzamanlı medya/decode kapasitesi DeviceProfile'da belirtilir.

Örneğin V1 hedef cihaz için aynı anda toplam video decode çözünürlüğünün 1280×720 sınırını aşması validation warning/error üretmelidir.

## 15. Media duration

Duration her yerde **0.1 saniye çözünürlükte** düzenlenir ve UI'da yuvarlanmış biçimde gösterilir.

Default davranış:

- Media Slide içinde olmayan bağımsız medya için default duration = `0` → süresiz.
- Media Slide içindeki medya için default duration = `3.0 s`.
- Kullanıcı duration değerini değiştirebilir.

## 16. Loop / Repeat

Medya playback seçenekleri genel medya widget'ı seviyesinde de bulunabilir.

Playback modeli:

```text
Playback
├── Loop
├── Repeat Count
└── Duration
```

- `Loop` = sonsuz tekrar.
- `Repeat` = sayılı tekrar.
- Duration = süre bazlı oynatma davranışı.
- Loop ve Repeat birbirinden ayrı seçeneklerdir.
- Loop aktifse sonsuz tekrar yapılabilir.
- Repeat Count sayılı tekrar miktarını belirler.

Media Slide içindeki default repeat/loop davranışı da aynı playback modelini kullanır.

## 17. Media Slide tamamlanması

Bir media widget/slide kendi playback'ini tamamladığında yalnızca kendi playback'i sona erer; aktif Scene otomatik olarak başka bir Scene'e çevrilmez.

Scene'in active olup olmadığı runtime state/priority tarafından belirlenir.

Bir Scene'de birden fazla media widget varsa, bunlar aynı anda aktif olabilir. Aynı Media Slide içindeki ardışık medya yapısı varsa kendi timeline/order kuralları geçerlidir.

## 18. Scene değişiminde medya devamlılığı

Scene değiştiğinde media player davranışı için opsiyonel bir **media continuity** ayarı bulunabilir.

Varsayılan mantık:

- Yeni Scene'deki medya widget'ının size parametresi farklıysa mevcut medya kesilir ve yeni Scene medyası doğrudan başlar.
- Uyumlu aynı size parametresi varsa kullanıcı `continue/retain playback` benzeri opsiyonu açabilir.
- Bu durumda önceki medyanın playback konumu ve gerekiyorsa sesi yeni Scene'deki karşılık gelen medya widget'ında sürdürülebilir.
- Yeni Scene'in konumu farklı olsa bile yeni Scene geometry'si kullanılır.

Bu davranış opsiyoneldir ve Properties'te açıklanmalıdır.

## 19. Concurrent media

Bir Scene içinde birden fazla Media Slide bulunabilir ve hepsi aynı anda çalışabilir.

Bu, cihazın DeviceProfile medya/decode kapasitesiyle sınırlandırılır.

Örneğin aynı anda video decoding için izin verilen toplam çözünürlük sınırı aşılırsa Validation bunu açıkça rapor eder.

Bir Media Slide'ın kendi içindeki ardışık içerikler ise timeline/order ile oynatılır.

## 20. Binding modeli

Media Slide'lar state/parameter binding ile açılıp kapanabilir.

Hem positive hem negative binding desteklenir:

```text
Positive binding → koşul sağlanınca göster/aktif et
Negative binding → koşul sağlanınca durdur/gizle/deaktif et
```

Örnek:

```text
Floor == 6
AND
Door == Opening
```

veya:

```text
Floor == 6
AND
Waiting == true
```

Bu sayede kat özel medya, kat animasyonu ve başka medya oynatılırken öncekinin durdurulması gibi davranışlar ayrı ayrı tanımlanabilir.

Binding sistemi zamanla expression/parametric binding destekleyecek şekilde tasarlanmalıdır.

Örnek parametric kullanım:

```text
Text = {FloorNumber}
```

ve gelecekte dış veri/CSV tabanlı parametreler:

```text
residents = external parameter/data source
```

gibi kullanılabilir. Bu gelişmiş parametrik veri özelliği ayrı kapsam olarak ele alınacaktır.

## 21. Kat özel medya

Kat özel medya ayrı bir popup kavramı değildir.

Kat özel medya, Media Slide/widget + binding ile gerçekleştirilebilir.

Örneğin:

```text
Floor == 6
→ ilgili Media Slide aktif
```

Aynı medya kat gelince kaldığı yerden devam edebilsin istenirse Media Continuity seçeneği kullanılabilir.

Kat özel medya diğer medya üzerinde görünüyorsa normal widget Z-order kuralları geçerlidir.

## 22. Background Music

Fon müziği Theme-level bir sistemdir.

- Theme boyunca loop halinde çalışabilir.
- Scene-level override kullanılmaz.
- Fon müziğinin kısılması/durdurulması/normal seviyeye dönmesi için ayrı Audio Settings sistemi bulunur.
- Bu Audio Settings, canvas boşken/right-side Properties context'inde açılabilecek şekilde tasarlanabilir.

## 23. Audio override / ducking

Fon müziği, runtime'da başka sesler geldiğinde belirlenen kurallara göre kısılabilir veya durdurulabilir.

Örnek:

```text
Announcement → Music 20%
Media        → Music 40%
Fire         → Music 0%
```

Bu değerler Theme/Audio Settings'te tanımlanabilir; Scene override değildir.

## 24. Audio priority

Ses önceliği ayrı bir audio priority sistemiyle yönetilir.

Öncelik 0–100 aralığında ayrı değerlerle ayarlanabilir.

Ana ses sınıfları:

```text
Background Music
Media Audio
Announcement / Voice
```

Örnek davranış:

- Announcement + Background Music → announcement daha öncelikli, music duck/mute.
- Media + Background Music → media daha öncelikli, music duck/mute.
- Announcement + Media + Background Music → üçlü durum da Audio Priority kurallarına göre yönetilir; Designer bu kombinasyonu açıkça ayarlanabilir bir seçenek olarak sunabilir.

Anonslar zaten kendi içinde peş peşe oynatılır.

## 25. Audio volume

Ayrı volume değerleri bulunabilir:

```text
Background Music Volume
Media Volume
Announcement Volume
Video Volume
External Audio Volume
```

Video ve external audio seviyeleri birbirinden bağımsız olabilir.

## 26. Video + external audio

Video oynatılırken harici audio kullanılabilir.

Kullanıcı video audio'su ve external audio için uygun profile destekliyorsa ayrı seçenekler görebilir:

```text
Video Audio
External Audio
```

ve gerekli mix/override davranışını belirleyebilir.

## 27. Announcement / language

Kat anonsları dil bazında tanımlanabilir.

Örneğin:

```text
Floor 5
Language 1 → Beşinci kat
Language 2 → Fifth floor
```

Firmware menüsünden dil değiştirildiğinde template'in dil-dependent text/audio davranışı değişebilir.

Tek dil veya çift dil kullanılabilir.

Dil seçimi ve ilgili text/audio ayarları Designer'da yapılandırılabilir.

## 28. Announcement repeat

Anons için repeat/total play count ayarlanabilir.

Dil 1 ve Dil 2 gibi anonslar belirlenen sırayla peş peşe oynatılabilir.

## 29. Media folder/export model

Firmware açısından açık ve deterministik bir klasör yapısı tercih edilir.

Önerilen başlangıç modeli:

```text
THEME/
├── FLOOR/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
├── UP/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
├── DOWN/
│   ├── STYLE_01/
│   ├── STYLE_02/
│   └── CUSTOM/
└── WARNING/
    ├── WARNING_01/
    ├── WARNING_02/
    └── CUSTOM/
```

Renkler için deterministik kodlama/klasör yapısı ayrıca firmware sözleşmesinde kesinleştirilecektir.

Custom medya ilgili `CUSTOM` alanına gider.

Export, Designer'ın iç Asset Depot yapısını körlemesine kopyalamaz; firmware için tanımlanan açık klasör yapısını oluşturur.

## 30. Design Rules

Design Rules tek bir sekme/dosya üzerinden yönetilebilir.

Media kuralları, asset kuralları, widget kuralları ve export kuralları aynı Design Rules sisteminde toplanabilir.

Validation sırasında özellikle:

- unsupported media,
- eksik asset,
- yanlış format,
- geçersiz binding,
- eşzamanlı video decode çözünürlük sınırı,
- eksik required resource

kontrol edilir.

## 31. Console

Media import/export/validation işlemleri Console'a yazılabilir.

Örneğin:

```text
> validate media
✓ image assets
✓ audio assets
⚠ concurrent video decode limit exceeded
```

## 32. Current implementation scope

V1'de tam format conversion yapılmaz.

Özellikle MP4→AVI vb. dönüşümler ayrı Format Tool kapsamındadır.

Basit size/resize işlemleri Designer içinde ileride desteklenebilir.

Firmware'in dosya/klasör sözleşmesi açık ve deterministik tutulur.

## Açık kalan sorular

Bu turda kullanıcı 14 ve 15 numaralı önceki sorular için henüz seçim belirtmedi. Bunlar sonraki kısa soru turunda ayrıca netleştirilecektir; mevcut kararlar bu iki maddeyi varsayarak ilerletilmemiştir.
