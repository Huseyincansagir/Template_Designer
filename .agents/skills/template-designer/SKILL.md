# Template Designer Product Skill

## Use this skill for

Product-level implementation of the Windows Template Designer / Device Deployment application.

## Source hierarchy

1. `Template Designer — Ana Proje Geliştirme Promptu.md` — authoritative V1 product specification.
2. `AGENTS.md` — coding-agent contract derived from that specification.
3. Supplied UI/theme screenshots — visual and interaction reference.
4. Existing code — implementation context, not permission to violate the specification.

## Product boundary

V1 is a local/offline Windows application. The frontend uses React + TypeScript + CSS and may use SVG/Canvas. Tauri is the preferred desktop shell. The application core must remain browser-compatible and Tauri-independent.

V1's actual deployment path is only SD card. Wi-Fi/ESP32-C6 is a future transport boundary, not a V1 feature.

## Canonical workflow

```text
Project -> Edit -> Preview -> Validate -> Package -> Deploy -> Verify -> Safe Eject
```

## Implementation rule

Build the underlying product behavior before polishing the screen around it. A UI element is not considered implemented if it has no real state/use-case behind it.

Keep these layers separate:

```text
React UI
 -> Application Services
 -> Domain/Core
 -> Adapter
```

Native Windows APIs belong behind adapters.

## Product surfaces

Use the supplied references to guide the product toward:

- Theme Library
- Design Studio
- Resources/Media
- Test Studio
- Publish/Deployment
- Settings

Design Studio should feel like professional engineering software: clear navigation, central device preview/canvas, contextual inspector, layers/resources and strong status feedback.

## Development workflow

For every feature:

1. inspect current repository state
2. identify affected domain/use cases
3. update core model/contracts if required
4. implement application behavior
5. connect UI
6. add validation/tests
7. run build/tests
8. verify persistence and deployment impact

## V1 stop rule

Do not start Wi-Fi, ESP32 firmware, cloud, device discovery or network UI while the SD-card V1 workflow is incomplete.
