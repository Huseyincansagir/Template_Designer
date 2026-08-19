# FINAL PRODUCT ACCEPTANCE — Template Designer V2

**Pass:** Final functional closure + professional UI polish  
**Branch:** `manus2`  
**Base HEAD inspected:** `dc33b10412ac87edf3d0c01bcdf7f50845570d25`  
**Date:** 2026-08-19  
**Runtime:** Vite `http://127.0.0.1:1420/` (browser). Tauri/Cargo **not present**.

## Functional Closure

A designer can create a project, pick a device, switch R0/R90/R180/R270, add and switch Scenes, create and configure widgets, import assets (browser file picker), bind, preview, simulate, validate, build a verified package, save, undo/redo, and open a dedicated SD deployment dialog.

**Automated:** typecheck PASS · **177/177** tests PASS · production build PASS.

**Live (Playwright Chromium, clean localStorage, 0 console errors):**

| Viewport | Canvas stage | Device frame |
|----------|--------------|--------------|
| 1920×1080 | 1326×821 | 453×805 |
| 1440×900 | 846×607 | 332×591 |
| 1280×720 | 686×427 | 231×411 |

Before this pass the same 1920×1080 stage was **32px**. Screenshots: `docs/visual-qa/`.

## Functional Findings

See `docs/PRODUCT_COMPLETION_LEDGER.md` section **Final closure pass** (FC-01…FC-08).

Headline:

- **FC-01 P0** canvas grid assigned `1fr` to the navigator — **FIXED**
- **FC-02 P0** Theme Project could be born with zero rotations — **FIXED**
- **FC-03 P1** rotation/theme navigation did not select the visible node — **FIXED**
- **FC-04 P1** Preview leaked mutations — **FIXED**
- **FC-05 P1** Theme-group Duplicate was a false affordance — **FIXED**
- **FC-06 P2** SD workflow moved to a dedicated dialog — **FIXED**

## SD Deployment Status

| Step | Status |
|------|--------|
| Validate → Build → Verify package | VERIFIED (browser + unit) |
| Detect SD / select target / preflight | CODE COMPLETE; **UNVERIFIED** on hardware |
| Write / flush / read-back verify | CODE COMPLETE (`InMemoryRemovableStorage` tests); **HARDWARE UNVERIFIED** |
| Safe eject | HONEST LIMITATION (`EJECT_UNSUPPORTED`) |
| Binary media copy onto the card | DEFERRED / adapter-ready in Rust (`sd_copy_file` unused from TS because browser import has no real path) |
| Browser honesty | VERIFIED — dialog states there is no transport; does not claim success |

Never faked a write. Never auto-selected a fixed disk.

## Tauri Status

**UNVERIFIED.** `cargo` and `rustc` are not installed in this environment. Rust sources (`src-tauri/src/sd_card.rs`) were reviewed, not compiled. Do not treat native CSP, close-guard, or ACL as executed.

## UI/UX Changes

1. Compact 32px application bar; Save is the primary toolbar action; Deploy opens the dialog.
2. Single fused editor chrome (tools + theme + rotations + scene tabs + Design/Preview + zoom).
3. Canvas is the `1fr` row; device frame dominates at 1920 and 1440.
4. Panel headings 28px; kickers and footnotes removed.
5. Console default 120px; status 22px.
6. Dedicated Deploy to SD Card dialog (UI-D-0014).
7. Jargon reduced (no “ASPECT LOCKED”, “MODEL VIEW”, “canonical object”).

Decisions: UI-D-0012, UI-D-0013, UI-D-0014 in `docs/design/UI_DESIGN_DECISION_LOG.md`.

## Design Decisions

Canonical domain, mutation pipeline, persistence, runtime, and Tauri boundary were not rewritten. Visual mockups (`docs/01_canvas_first_studio.png`) were used as **style/composition** reference only — Explorer | Canvas | Properties remains the shell (UI spec §2), not the mockup’s icon rail.

## Visual QA

| Check | 1920 | 1440 | 1280 |
|-------|------|------|------|
| Canvas dominates | VERIFIED | VERIFIED | PARTIALLY VERIFIED (frame 231px; chrome wraps one row) |
| Toolbar compact (33px) | VERIFIED | VERIFIED | VERIFIED (wraps) |
| Scene/rotation always visible | VERIFIED | VERIFIED | VERIFIED |
| Panel headers 28px | VERIFIED | VERIFIED | VERIFIED |
| Deploy dialog | VERIFIED | — | — |
| Empty/error/disabled states | VERIFIED | VERIFIED | VERIFIED |
| Console errors | 0 | 0 | 0 |

Remaining visually weak: default widgets still start near the canvas centre (cascade improved); asset list has type glyphs rather than thumbnails (bytes not held in browser transport); 1280 device is small because side panels stay docked.

## Regression Tests

```
npm run typecheck   PASS
npm test            PASS  177/177
npm run build       PASS
npm run tauri:check BLOCKED  cargo not installed
```

New coverage: canvas `1fr` contract; four-rotation invariant; missing-angle repair; group-duplicate refusal.

## Remaining Issues

| ID | Sev | Status |
|----|-----|--------|
| Native SD write on a physical card | P1 env | HARDWARE UNVERIFIED |
| Tauri shell / `cargo check` | P1 env | UNVERIFIED |
| Binary media materialisation on the card | P2 | DEFERRED (logical `*.asset.json`; `sd_copy_file` unused) |
| Native file dialogs | P2 | DEFERRED (interfaces exist; browser input is wired) |
| Audio channel authoring | — | BLOCKED ON PRODUCT (PD-01) |
| Asset thumbnails | P3 | DEFERRED |
| Explorer search at 12+ scenes | P3 | DEFERRED |
| Atomic staging directory on the card | P2 | CODE incomplete in Rust; cargo blocked |

## Recommended Next Steps

1. Install Rust and run `npm run tauri:dev` against a real removable volume.
2. Wire `sd_copy_file` for assets whose `metadata.resolvedPath` is a real filesystem path (native importer).
3. Native open/save/import dialogs behind the existing gateways.
4. Optional: collapse side panels automatically at 1280 to keep the device ≥300px tall.

## Honest answers

1. **Gaps found:** canvas grid collapse (P0), empty-rotation theme (P0), nav/selection desync, Preview leaks, false Duplicate on groups, Deploy buried + false detection error.
2. **Fixed:** all of the above in design/browser scope.
3. **Remains:** Tauri/hardware SD, binary copy, native dialogs, audio spec.
4. **SD actually verified?** In-memory **VERIFIED**. Physical card **UNVERIFIED**.
5. **Tauri actually verified?** **UNVERIFIED**.
6. **UI change:** compact CAD shell, canvas-first, fused navigation, Deploy dialog.
7. **Still visually weak:** 1280 device size; widget default size vs display; no thumbnails.
8. **Canvas dominates?** **Yes** at 1440 and 1920. At 1280, usable but tight.
9. **Toolbar compact?** **Yes** (32px app bar, 33px editor chrome).
10. **Scene navigation efficient?** **Yes** — always-visible tab strip.
11. **Assets discoverable?** **Yes** — Assets dock + Import; no thumbnails.
12. **Widgets configurable?** **Yes** — per-type inspector.
13. **Deployment professional?** **Dialog + honest browser refusal.** Native write unverified.
14. **Serious desktop engineering editor?** **Closer.** Browser-verified. Not a finished native product until Tauri+SD run.

**Verdict:** ACCEPTED WITH WARNINGS — WEB VERIFIED, TAURI UNVERIFIED, SD HARDWARE UNVERIFIED.
