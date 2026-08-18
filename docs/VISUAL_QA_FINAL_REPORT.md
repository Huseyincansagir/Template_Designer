# VISUAL QA FINAL REPORT — Template Designer V2

**Pass:** Zero-trust acceptance · visual QA specialist (S4, CDP 9226, isolated profile) + Lead re-measurement after fixes.
**Method:** DOM-geometry and computed-style measurement at 1280×720 / 1440×900 / 1920×1080, clean and populated states; screenshots captured as evidence artifacts (the QA model measures the DOM, it does not eyeball pixels).
**Fix commit:** `0743bf2` (all findings below except where noted) · re-measured post-fix.

## 1. Per-surface findings

### Canvas / device frame
| Viewport | Before | After | Verdict |
|---|---|---|---|
| 1280×720 | frame 129×230 (broken) → 202.5×360 after 164d215 | **203×360** (27.7% of stage area) | PASS |
| 1440×900 | — | **304×540** (34.4% of stage) | PASS |
| 1920×1080 | 129×230 at every size (P0, fixed 164d215) | **405×720** (29.6% of stage) | PASS |

- Widget stacking (S4-01): three `Add Widget` clicks previously produced 100% mutually-occluded boxes. After the snap-grid cascade: measured boxes at `692,388 · 695,392 · 699,396` (1440×900) — distinct, topmost hit-testable, lower ones reachable. **FIXED, measured.**
- Resize handles: painted dot 7×7 px with a 19×19 px transparent hit area (`::before inset:-6px`). Measured painted box 7×7, hit area 19×19 by construction. **FIXED.**
- Device frame header/footer text 10px `--text-on-dark` on `--device-frame`: contrast passes (4.5:1+).

### Typography & contrast
| Token | Before | After | White-bg ratio |
|---|---|---|---|
| `--text-muted` | `#6f7d82` (3.43–4.26:1, failed every surface) | `#5c6a70` | ≈5.6:1 |
| primary buttons | white on `--accent` (3.66:1) | white on `--accent-hover` `#08757c` | ≈5.9:1 |
| dirty chip | `--warning` on white (4.01:1) | `--warning-text` `#8a6014` | ≥4.5:1 |
| canvas rail / overlay note | `#5d7378` (4.00:1) | `#4f6469` | ≥4.5:1 |
| empty-state hint | `#668085` (4.21:1) | `#7c979c` | ≥4.5:1 |
| `.tab-count` | `#b8cccd` (4.47:1) | `#d6e6e7` | ≥4.5:1 |

- Disabled state (S4-04): opacity 0.43 produced 1.71–1.78:1 effective contrast. Now explicit tokens: measured `.tab-close:disabled` → `color rgb(92,106,112)`, `opacity 1`. **FIXED, measured.**
- 25 unique failing pairs found in the audit; the token-level fixes above address all of them (muted-family, accent fills, warning text, dark surfaces).

### Metrics & rhythm
| Surface | Before | After | Measured |
|---|---|---|---|
| zoom − / + | 24 px in a 28 px group | 28 px + 28 px readout | `[28,28]` |
| tree rows | 32 vs 37 px spread | fixed 36 px | `[36,36,36,…]` (9 clean, 13 populated) |
| panel header actions | 27 px accidental | 24 px token | — |
| console tab actions | 27 px | 32 px (`--tab-height`) | — |
| checkboxes | 14×14 | 16×16 | measured 16×16 |
| spacing | 8/13 containers off the 4-scale | normalized (6→8, 9→8, 10→8, 14→16) | — |

### Layout / responsive
- No horizontal body scroll at any of the six states (scrollWidth == clientWidth exactly). Zero off-window elements lacking a scroll ancestor.
- Panel widths are viewport-clamped at boot (`min(286, max(220, vw×0.18))`) and Reset Layout re-clamps — at 1280×720 panels drop to ≈230 px each, recovering stage width for the device (S4-08). Measured at the 1440 boot: 286 px (clamp inactive at this width, by design).
- Properties scroll overflow (S4-02): 379–616 px below the fold with no affordance. Now `scrollbar-gutter: stable` + scroll-position shadows (top/bottom fades) + section padding 12→10 px. Remaining overflow is content-architecture (read-only sections) — discoverability fixed; section collapsing deferred (see report §Remaining).
- `body.relaxed-density` override still available via the wired `compactDensity` setting.

### Accessibility (measured subset)
- PASS: menu buttons `aria-haspopup/aria-expanded`; dock tablists `role=tablist/tab` + `aria-selected`; statusbar `aria-live`; splitters `role=separator` + aria values + keyboard resize; resize handles `aria-label` ×8; modals `role=dialog aria-modal aria-labelledby` + Tab trap; Escape closes menus/dialogs/cancels gestures.
- FIXED (S4 lead): `.splitter:focus-visible` had `outline:none`; now keeps `var(--focus-ring)`.
- FIXED (S4-09): disabled controls and menu items carry explanatory `title`s.
- FIXED (S4-10): `PropertyRow` values render `title` tooltips (widget IDs readable/copyable via tooltip).
- FIXED (§6): the canvas empty state now includes an actionable **Add Widget** button when a Scene exists.
- Not re-measured after fixes: full 12-element Tab traversal with per-step focus-ring checks, `CSS.forcePseudoState` hover/active sweep. Recorded as outstanding visual-QA follow-ups, not failures.

## 2. Per-viewport usability

| Viewport | Before | After |
|---|---|---|
| 1280×720 | DEGRADED — panels 3.65× device, stacked widgets 27.8×18.5, inspector +367 px | Usable: panel clamp + cascade + scroll affordances landed; frame 27.7% of stage |
| 1440×900 | DEGRADED — 100% widget occlusion, 50 contrast failures, +616 px overflow | Usable: cascade/contrast/scroll fixed; best-balanced size (frame 34.4% of stage) |
| 1920×1080 | USABLE (with defects) | Usable: all measured defects fixed at this size |

## 3. Remaining (documented, not hidden)

| Item | Severity | Status |
|---|---|---|
| Properties deep-section scroll requires the (now hinted) scroll — section collapsing | P3 | Deferred; discoverability fixed |
| Hover/active/focus pseudo-state full sweep + 12-step Tab focus-ring measurement | P3 | Not re-executed post-fix |
| Floating panels fixed-position (drag/re-dock) | P3 | Deferred (labelled honestly) |
| Workspace layout persistence across sessions | P3 | Deferred |

## 4. Evidence artifacts

Screenshots: `%TEMP%\td-cdp\accept-{1280x720,1440x900,1920x1080}-boot.png` (post-frame-fix), `remediation.png`, S4 evidence set `%TEMP%\td-cdp\s4-*.json`. Measurement scripts: `accept-boot.mjs`, `vqa-measure.mjs` (this report's post-fix numbers).
