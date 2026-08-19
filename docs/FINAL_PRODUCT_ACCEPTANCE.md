# FINAL PRODUCT ACCEPTANCE — Template Designer V2

**Pass:** Final functional closure + chrome rewrite (visual P2 not closed)  
**Branch:** `manus2`  
**Base HEAD inspected:** `dc33b10412ac87edf3d0c01bcdf7f50845570d25`  
**Date:** 2026-08-19  
**Runtime:** Vite `http://127.0.0.1:1420/` (browser). Tauri/Cargo **not present**.

## Functional Closure

A designer can create a project, pick a device, switch R0/R90/R180/R270, add and switch Scenes, create and configure widgets, import assets (browser file picker), bind, preview, simulate, validate, build a verified package, save, undo/redo, and open a dedicated SD deployment dialog.

**Automated:** typecheck PASS · **182/182** tests PASS · production build PASS.

**Live (Playwright Chromium, clean localStorage, 0 console errors):**

| Viewport | Canvas stage | Device frame |
|----------|--------------|--------------|
| 1920×1080 | 1326×821 | 453×805 |
| 1440×900 | 846×607 | 332×591 |
| 1280×720 (console collapsed) | 810×547 | 299×531 |

Before this pass the same 1920×1080 stage was **32px**. Screenshots: `docs/visual-qa/`.

## Functional Findings

See `docs/PRODUCT_COMPLETION_LEDGER.md` **Final closure pass** (FC-01…FC-15) and **Chrome rewrite** (FC-07b, FC-16, FC-17).

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
| Binary media copy onto the card | **CODE COMPLETE, HARDWARE UNVERIFIED** — copies when `metadata.resolvedPath` is absolute; browser imports stay logical-only |
| Browser honesty | VERIFIED — dialog states there is no transport; does not claim success |

Never faked a write. Never auto-selected a fixed disk.

## Tauri Status

**UNVERIFIED.** `cargo` and `rustc` are not installed in this environment. Rust sources (`src-tauri/src/sd_card.rs`) were reviewed, not compiled. Do not treat native CSP, close-guard, or ACL as executed.

## UI/UX Changes

1. Compact 32px application bar; Save is the primary toolbar action; Deploy opens the dialog.
2. **Two-row** editor chrome (UI-D-0015): tools / Theme / R0–R270 / Design-Preview / zoom on row 1; **exclusive scene strip** on row 2 (UI-D-0016). UI-D-0013 one-row strip is superseded.
3. Canvas is the `1fr` row; device frame dominates at 1920 and 1440 (UI-D-0012).
4. Panel headings 28px; kickers and footnotes hidden.
5. Console default 120px; status 22px.
6. Dedicated Deploy to SD Card dialog (UI-D-0014).
7. Add Widget cascade = widget size + snap grid (UI-D-0017).
8. Project inspector section only at document (UI-D-0018) — Device Profile is on the project/document inspector, not on widget/scene/theme.

Decisions: UI-D-0012, UI-D-0014, UI-D-0015, UI-D-0016, UI-D-0017, UI-D-0018 in `docs/design/UI_DESIGN_DECISION_LOG.md`. Visual P2 **not** complete: chrome rewrite is source-landed, not re-measured.

## Design Decisions

Canonical domain, mutation pipeline, persistence, runtime, and Tauri boundary were not rewritten. Visual mockups (`docs/01_canvas_first_studio.png`) were used as **style/composition** reference only — Explorer | Canvas | Properties remains the shell (UI spec §2), not the mockup’s icon rail.

## Visual QA

Live table below is the **pre-two-row** pass (`docs/visual-qa/`, fused 33px chrome). Two-row chrome + exclusive scene strip **have not been re-measured**. Visual P2 is **OPEN**.

| Check | 1920 | 1440 | 1280 |
|-------|------|------|------|
| Canvas dominates (one-row chrome) | VERIFIED then | VERIFIED then | PARTIALLY VERIFIED then (frame 231px; chrome wrapped) |
| One-row toolbar 33px | historical | historical | historical (wrapped) |
| Two-row chrome / exclusive scene strip | **UNVERIFIED** | **UNVERIFIED** | **UNVERIFIED** |
| Panel headers 28px | VERIFIED | VERIFIED | VERIFIED |
| Deploy dialog | VERIFIED | — | — |
| Empty/error/disabled states | VERIFIED | VERIFIED | VERIFIED |
| Console errors | 0 | 0 | 0 |

Remaining visually weak: visual P2 not re-run; Project section still on every selection; asset list has type glyphs rather than thumbnails (bytes not held in browser transport); Explorer labels truncate at 1280.

## Regression Tests

```
npm run typecheck   PASS
npm test            PASS  182/182
npm run build       PASS
npm run tauri:check BLOCKED  cargo not installed
```

New coverage: canvas `1fr` contract; four-rotation invariant; missing-angle repair; group-duplicate refusal.

## Remaining Issues

| ID | Sev | Status |
|----|-----|--------|
| Native SD write on a physical card | P1 env | HARDWARE UNVERIFIED |
| Tauri shell / `cargo check` | P1 env | UNVERIFIED (`cargo` / `rustc` absent) |
| Binary media copy (`sd_copy_file`) | P1 | **CODE COMPLETE, HARDWARE UNVERIFIED** — copies when `resolvedPath` is absolute; browser imports stay logical-only |
| Native import path recording | P2 | **CODE COMPLETE, TAURI UNVERIFIED** |
| Atomic staging (`template-designer.next`) | P2 | **CODE COMPLETE, TAURI UNVERIFIED** (Rust uncompiled) |
| Two-row chrome / exclusive scene strip visual P2 | P2 | **CODE COMPLETE, VISUAL UNVERIFIED** (UI-D-0015/0016) |
| Project section only at document | P2 | **CODE COMPLETE, VISUAL UNVERIFIED** (UI-D-0018) |
| Audio channel authoring | — | **BLOCKED ON PRODUCT** (PD-01) — not implemented |
| Asset thumbnails | P3 | **DEFERRED** |
| Wi-Fi / ESP32 transport | — | **V2 — not implemented** |
| Explorer search at 12+ scenes | P3 | **DEFERRED** |

## Recommended Next Steps

1. Install Rust and run `npm run tauri:dev` against a real removable volume. Do not treat SD as verified until that run.
2. Re-measure visual P2 against two-row chrome (UI-D-0015/0016) and Project-at-document (UI-D-0018).
3. Native open/save/import dialogs behind the existing gateways (native import path is already recorded when Tauri is present — unverified).
4. Optional: collapse side panels automatically at 1280 to keep the device ≥300px tall.

## Honest answers

1. **Gaps found:** canvas grid collapse (P0), empty-rotation theme (P0), nav/selection desync, Preview leaks, false Duplicate on groups, Deploy buried + false detection error.
2. **Fixed:** all of the above in design/browser scope.
3. **Remains:** Tauri/hardware SD, visual P2 re-measure, native dialogs, PD-01 audio. Binary copy is **CODE COMPLETE**, not missing. UI-D-0018 is source-landed.
4. **SD actually verified?** In-memory **VERIFIED**. Physical card **UNVERIFIED**. Never claimed otherwise.
5. **Tauri actually verified?** **UNVERIFIED**.
6. **UI change:** compact CAD shell, canvas-first, **two-row chrome + exclusive scene strip** (source), Deploy dialog. Visual P2 **not** closed.
7. **Still visually weak:** two-row chrome unmeasured; 1280 device size; no thumbnails.
8. **Canvas dominates?** **Yes** at 1440 and 1920 under the previous chrome. Two-row chrome not re-measured.
9. **Toolbar compact?** App bar 32px. Editor chrome is now **two rows** (~32 + 28), not the historical 33px strip.
10. **Scene navigation efficient?** Exclusive second-row strip in source; visual P2 unverified.
11. **Assets discoverable?** **Yes** — Assets dock + Import; thumbnails **DEFERRED**.
12. **Widgets configurable?** **Yes** — per-type inspector. Project Device Profile is document-only (UI-D-0018).
13. **Deployment professional?** **Dialog + honest browser refusal.** Native write unverified.
14. **Serious desktop engineering editor?** **Closer.** Browser-verified for function. Visual P2 open. Not a finished native product until Tauri+SD run.

**Verdict:** ACCEPTED WITH WARNINGS — WEB FUNCTION VERIFIED, VISUAL P2 UNVERIFIED, TAURI UNVERIFIED, SD HARDWARE UNVERIFIED.
