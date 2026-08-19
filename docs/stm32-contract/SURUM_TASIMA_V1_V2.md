# Ürün sürümü ve taşıma — V1 SD, V2 SD + Wi-Fi

**Karar (kullanıcı, 2026-08-19):** Wi-Fi sonraki ürün sürümüdür (**V2**). V2 gelince **SD kart kapanmaz, kaldırılmaz, “eski yol” diye gizlenmez.** Aynı paket hem SD hem Wi-Fi ile gidebilir.

## İsimler (karıştırma)

| İsim | Ne |
|---|---|
| **Template Designer uygulaması** | React/Tauri masaüstü. Klasör: `C:\Users\b1601\Template_Designer`. “Designer V2 uygulaması” = bu kod tabanı, ürün sürümü değil. |
| **Ürün V1** | Yalnız **SD kart**: `PC → SD → cihaz`. Şimdi bunun üzerindeyiz. |
| **Ürün V2** | **SD + Wi-Fi**. SD durur. Wi-Fi eklenir (ESP32-C6 vb. ayrıca tasarlanır). |

Sözleşmelerdeki “V1 derleyici / V1’de STM32 C yok” = **ürün V1** (SD + mevcut `tema.cfg`). MCU JSON Binding tablosu değil.

## Kural

```text
                 AYNI cihaz paketi
                 (0:/tN/tema.cfg + ikili)
                        |
              +---------+---------+
              |                   |
              v                   v
           SD kart              Wi-Fi
           ürün V1              ürün V2
           (şimdi)              (sonra, SD açık kalır)
```

- Paket **taşıma-bağımsız** üretilir. SD’ye özel dosya yolu paketin *içine* gömülmez.
- Ürün V2’de Deployment Manager: `SDCardTarget` **aktif kalır**; `WiFiDeviceTarget` eklenir.
- Cihaz Wi-Fi ile paket alsa da FatFS’te aynı `tN/` ağacını görür (veya eşdeğer). Firmware’in okuduğu sözleşme değişmez.
- Ürün V1’de Wi-Fi kodu yazılmaz; arayüz/abstraction yerinde durabilir.

## STM32

Ürün V1: CM7 tema parser’ı değişmez.  
Ürün V2 Wi-Fi: ayrı iş (alıcı, tampon, atomik yazım). **SDMMC/FatFS tema yükleme yolu silinmez.**
