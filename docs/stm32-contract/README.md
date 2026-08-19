# STM32 / SD kart sözleşmesi (MyApplication_6 ile ortak)

Bu klasör, `C:\TouchGFXProjects\MyApplication_6` ile **aynı** belgelerdir. STM32 firmware C’si bu depoda değiştirilmez.

Kaynak repo: MyApplication_6 `docs/` (baseline `feb5f56` / sözleşme commit `2c4898c`).

| Dosya | İçerik |
|---|---|
| [TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md](TEMPLATE_DESIGNER_V2_FIRMWARE_RUNTIME_CONTRACT.md) | Kanonik runtime sözleşmesi (32 bölüm) |
| [STM32_V2_GEREKEN_DEGISIKLIKLER.md](STM32_V2_GEREKEN_DEGISIKLIKLER.md) | STM32 C: V1’de yok; P1+ sonra |
| [UC_TARAF_GOZDEN_GECIRME_20260819.md](UC_TARAF_GOZDEN_GECIRME_20260819.md) | Designer · SD · STM32 yeniden tarama |
| [v2_firmware_uyumluluk_20260819.md](v2_firmware_uyumluluk_20260819.md) | Paket ağacı uyumsuzluk |
| [binding_yapisi_20260819.md](binding_yapisi_20260819.md) | Binding → `sahne=` (derleme) |
| [stm32_binding_motoru_20260819.md](stm32_binding_motoru_20260819.md) | STM32 Binding motoru (RAM, 0–15, üyelik AND) |
| [stm32_binding_mantik_operatorleri_20260819.md](stm32_binding_mantik_operatorleri_20260819.md) | Tam AND/OR/NOT/XOR — DNF ve C yığın VM |
| [template_designer_v2_stm32_paket_sozlesmesi_plani_20260819.md](template_designer_v2_stm32_paket_sozlesmesi_plani_20260819.md) | Uzun plan / errata |

**Başlangıç işi bu depoda:** DeviceProfile MJPG + `0:/tN` `tema.cfg` derleyici. Firmware dumanından önce CM7 patch yok.

**Ürün V1 = SD. Ürün V2 = SD + Wi-Fi (SD kapanmaz).** [SURUM_TASIMA_V1_V2.md](SURUM_TASIMA_V1_V2.md)
