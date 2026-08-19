# Template Designer

Windows için modern Template Designer / Device Deployment uygulaması.

## V1 hedefi

Gerçek deployment akışı:

`PC -> SD Card -> fiziksel hedef cihaz`

Uygulama offline-first çalışır. UI React + TypeScript + CSS tabanlıdır; geliştirme sırasında browser/localhost üzerinde çalışabilir ve production'da Tauri ile Windows desktop uygulaması olarak paketlenebilir.

## Ana kaynaklar

- [`Template Designer — Ana Proje Geliştirme Promptu.md`](./Template%20Designer%20%E2%80%94%20Ana%20Proje%20Geli%C5%9Ftirme%20Promptu.md) — authoritative V1 specification
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — architecture boundaries
- [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md) — implementation phases
- [`docs/DEPLOYMENT_FORMAT.md`](./docs/DEPLOYMENT_FORMAT.md) — package/deployment boundary
- [`docs/stm32-contract/`](./docs/stm32-contract/) — MyApplication_6 STM32 / SD kart runtime sözleşmesi (cihaz `0:/tN/tema.cfg`, V2 JSON değil)
- [`docs/DEVICE_PROTOCOL.md`](./docs/DEVICE_PROTOCOL.md) — future device protocol boundary
- [`AGENTS.md`](./AGENTS.md) — coding-agent contract

## V1 dışı

Wi-Fi/ESP32-C6 communication, device discovery, ESP32 firmware, device-hosted web UI, cloud/backend and online account systems V1 kapsamında değildir. Mimari bunların ileride eklenmesine izin verecek sınırlar oluşturur.
