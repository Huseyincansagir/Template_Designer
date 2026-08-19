# Elevator Project UI References

Bu klasör, Template Designer'ın asansör display template ürünü için hazırlanmış görsel UI reference setini içerir. Görseller statik tasarım referanslarıdır; functional prototype, yeni domain modeli veya firmware davranışı iddiası değildir.

| Görsel | Kullanım amacı | Ana canonical yüzeyler |
|---|---|---|
| [`01_elevator_design_studio.png`](./01_elevator_design_studio.png) | Canvas-first editor ve selected Floor/Digit widget | Application Shell, Project Explorer, Document Tabs, Canvas, Properties, selection, geometry |
| [`02_elevator_theme_library.png`](./02_elevator_theme_library.png) | Theme Library ve dört canonical rotation yönetimi | Theme Project, DeviceProfile, R0/R90/R180/R270, Theme Resources, profile-driven styles |
| [`03_elevator_test_studio_simulator.png`](./03_elevator_test_studio_simulator.png) | Runtime evaluation ve test sequence | Profile-defined Runtime Inputs, Active Scene, Binding trace, Simulator transport |
| [`04_elevator_assets_publish.png`](./04_elevator_assets_publish.png) | Asset Browser ile validation/publish readiness | Asset Depot, Used/Unsupported Files, package verification, deployment gating |

## Shared visual language

Tüm set; açık nötr engineering workspace, koyu metal çerçeveli fiziksel elevator display, compact desktop shell, thin borders, dark navy navigation, teal/cyan selection/action accents ve coral warning accents kullanır. Ekranlar generic SaaS dashboard değil, Windows CAD/IDE çalışma alanı olarak ele alınır.

## Canonical boundaries represented

Project Explorer hierarchy `Workspace → Project → Theme Project Group → Theme Project → R0/R90/R180/R270 → Scene → Widget` olarak gösterilir. Rotation/form ölçüleri DeviceProfile kaynaklıdır. Digit/Floor yüzeyinde font/glyph asset sistemi veya bağımsız Fonts kategorisi gösterilmez; Theme Library ve Properties görsellerinde Digit Style profile-driven olarak adlandırılır. State ile Scene ayrıdır; Simulator tek active Scene, condition/priority açıklaması ve binding trace gösterir. Asset Depot, Theme Resources ve Unsupported Files birbirine karıştırılmaz. Publish paneli package verification tamamlanmadan deployment action'ını etkin göstermez.

## Generation brief

Tam üretim bağlamı ve ekran bazlı acceptance criteria için [`ELEVATOR_UI_REFERENCE_BRIEF.md`](../../ELEVATOR_UI_REFERENCE_BRIEF.md) dosyasına bakın. Genel supplied-screen kararları [`UI_REFERENCE.md`](../../UI_REFERENCE.md) ve canonical UI davranışları [`UI_DESIGN_SYSTEM_V2.md`](../../UI_DESIGN_SYSTEM_V2.md) içinde tanımlıdır.
