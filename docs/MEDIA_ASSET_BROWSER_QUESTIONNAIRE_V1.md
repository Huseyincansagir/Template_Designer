# Media / Asset Browser — UX Questionnaire V1

> Arşivlenmiş soru-cevap turu. Media/Asset Browser ve resource yönetimi implementasyonu sırasında referans alınır.

## 1. Asset Browser / Asset Depot

Asset Browser, Altium kütüphanesi benzeri bir **Asset Depot** içeriğini gösteren dockable bir tool window'dur.

- Asset Browser = depo/kütüphane görünümü.
- Theme Resources = projenin sahip olduğu/kullandığı kaynaklar.
- Bunlar aynı şey değildir.
- Asset Browser'dan seçilen asset istenen uyumlu projeye/scene'e kullanılabilir.
- Asset'in mevcut projede kullanılıp kullanılmadığı Asset Browser'da bir badge/check ile anlaşılabilir.
- Kullanım bilgisi `Used By` ile incelenebilir.

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

## 6. Unsupported Files

Unsupported dosyalar ayrı bir `Unsupported Files` alanında tutulur.

- Normal Asset Browser asset'i değildir.
- Widget olarak kullanılamaz.
- Template'e eklenemez.
- Normal export asset'i değildir.
- Gerekirse Design Rules/Validation tarafından raporlanabilir.

Bunlar kullanıcıya normal asset seçim ekranlarında gösterilerek UI'ı kirletmez.

## 7. Asset semantic categories

Supported resource categories firmware/device contractına göre oluşturulabilir.

Örneğin kullanıcı bir dosyayı Warning Sign olarak kullanacaksa ilgili `Warning Signs` kategorisine yerleştirilebilir. On-disk klasör yapısı gerektiğinde firmware'in doğrudan anlayacağı şekilde kullanılabilir.

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

- Project tarafından gerçekten kullanılan/referenced assetler,
- deployment rules'a göre Theme Resources içinde export edilmesi gerekenler,
- gerekli DeviceProfile/default assets.

`Unsupported Files` normal export asseti değildir.

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

Basit asset resize daha sonra eklenirse Format Tool'un kapsamıyla karıştırılmamalıdır.

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
```

Export validation bu kuralları çalıştırabilir.

## 14. Console

Asset import/export/validation işlemleri Console'a yazılabilir:

- import,
- destination,
- stable ID,
- unsupported status,
- validation,
- export inclusion/exclusion.

## Genel UX ilkesi

Asset Browser bir **kütüphane/depo**, Theme Resources ise **projenin kaynak alanıdır**. Bu ayrım UI'da açıkça korunmalıdır.

Canvas dosya-drop hedefi değildir.

Unsupported Files kullanıcıya teknik/development görünürlüğü sağlar ancak normal asset kullanım akışını kirletmez.
