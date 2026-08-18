# Canvas Interaction Red-Team Review

**Reviewer role:** Independent senior desktop-editor architecture & UX red team
**Objective:** Break the Agent 2 Canvas Interaction Foundation plan before its decisions become irreversible.

| Field | Value |
|---|---|
| Repository | `Huseyincansagir/Template_Designer` |
| Branch | `manus2` |
| Baseline reviewed | `c76442826c02ad54fd37850c5742c1263c2fccf3` — `fix(editor): complete final hardening pass` |
| Plan reviewed | `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` (plan commit `741baa1`, contract finalization `a8bc378`) |
| Canonical sources reviewed | `docs/UI_DESIGN_SYSTEM_V2.md`, `docs/UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md`, `docs/DOMAIN_MODEL_V1.md`, `docs/DOMAIN_RUNTIME_CONTRACT_AUDIT_V1.md`, `docs/ARCHITECTURE_V2_APPLICATION_SHELL_DOMAIN_EDITOR.md`, `docs/TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md` |
| Agent 1 code reviewed | `src/Core/editor-application.ts`, `src/Core/document-store.ts`, `src/Core/commands.ts`, `src/App/App.tsx`, `src/App/canvas-interaction.ts`, `src/App/editor-commands.ts`, `src/Domain/models.ts` |
| Post-landing note | Agent 2's implementation landed at `f1306ac` after this review was commissioned. Findings F1 and F2 were verified as already live in that commit (see §8). |

---

## 1. Executive Summary

**Verdict: REQUIRES PRODUCT CHANGES**

The plan's central architectural boundary — *Canvas is a deterministic interaction layer over canonical Project state; all persistent changes cross `EditorApplication` → `DocumentStore` → `CommandHistory`; transient state (selection, hover, marquee, preview, zoom, guides) never becomes a second document* — is genuinely sound and matches Agent 1's mutation pipeline. The cancellation contract (Escape / `pointercancel` / lost capture / blur = zero history with exact initial-preview restore) is well specified. The pure-primitive separation and the "no fake commands" rule are correct.

However, the plan is not acceptable as-is, for two independent reasons plus several compounding ones:

1. **CRITICAL — The keyboard contract (§4.9, §6A) contradicts the canonical UI design system.** `UI_DESIGN_SYSTEM_V2.md` §19 and `UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` §8 define the CONFIRMED table as *Arrow = snap-grid movement*, *Ctrl+Arrow = snap-grid ÷ 10 (fine)*, *Shift+Ctrl+Arrow = snap-grid × 5*. The plan inverts the plain-Arrow and Ctrl+Arrow roles and invents "Arrow = 1 Scene unit." The development plan's first rule forbids agents from silently redefining canonical semantics, and §6B's self-declared precedence cannot override a document that is itself canonical. This contradiction has now been implemented (`src/App/App.tsx:667`).

2. **HIGH (borderline CRITICAL) — The coordinate/interaction model is axis-aligned-rectangle-only, while widget rotation is already a CONFIRMED canonical feature.** Free rotation + 5° snap and `R` = 90° rotation are locked in the UI spec (§27, corrections §8), but `Geometry` in `src/Domain/models.ts` has no rotation/anchor field. Every locked decision — hit-test, inclusive boundaries, marquee intersection, selection bounding-box multi-resize, snapping on AABB edges/centers — is AABB-specific math, not a future hook. Rotation will force re-derivation of all of it.

Compounding issues: multi-resize "preserve proportions" is under-specified and can irreversibly distort aspect-sensitive widgets (F3); the snap model races qualitatively different targets in one nearest-distance pool with an undefined "Scene unit" (F4, F11); the domain carries two overlapping z-order concepts the plan never reconciles (F5); selection ordering discards the anchor widget needed by alignment/distribution (F6); and `Ctrl+D` is locked as "approved" while the canonical spec still marks it PROPOSED and defines a different, confirmed Duplicate mode (F8).

**Final Gate: BLOCK** — see §9 for the exact flip conditions.

---

## 2. Critical Findings

Each finding answers the six required questions: decision → why it is a problem → future conflict → category → severity → recommended alternative.

### F1 — CRITICAL — Keyboard shortcuts contradict the canonical spec and are presented as "canonical"

1. **Decision:** Arrow = 1 Scene unit; Ctrl/Cmd+Arrow = snap-grid unit; Shift+Ctrl/Cmd+Arrow = 5× snap-grid (plan §4.9, §6A).
2. **Why it is a problem:** `UI_DESIGN_SYSTEM_V2.md` §19 (keyboard table) and `UI_DESIGN_SYSTEM_V2_CANONICAL_CORRECTIONS.md` §8 define the CONFIRMED canonical table as *Arrow = normal snap-grid movement*, *Ctrl+Arrow = snap grid ÷ 10 fine movement*, *Shift+Ctrl+Arrow = snap grid × 5*. The plan swaps the roles of bare Arrow and Ctrl+Arrow and invents a new base step ("1 Scene unit"). The plan even self-contradicts: §4.9 calls Ctrl/Cmd+Arrow "the fine/grid movement modifier" while assigning it the *coarse* step. §6B claims this contract supersedes older wording, but the shortcuts it overrides are marked CONFIRMED in a canonical document; overriding them inside an Agent-2-local plan is precisely the "silently redefine canonical semantics" the development plan prohibits. **Verified live:** `src/App/App.tsx:667` computes `step = shift && mod ? GRID*5 : mod ? GRID : 1` — the inversion is now in production code.
3. **Future feature conflict:** the confirmed Settings→Shortcuts surface, Agent 3 Properties synchronization, Agent 4 command palette, and any future rotate/resize nudge commands all inherit a wrong base table.
4. **Type:** UX + architecture (canonical-contract violation).
5. **Severity:** CRITICAL.
6. **Recommended alternative:** Adopt the canonical table verbatim (`Arrow` = snap-grid, `Ctrl+Arrow` = ÷10 fine, `Shift+Ctrl+Arrow` = ×5). If a "1 Scene unit" fine step is genuinely wanted, file a `DOMAIN CONTRADICTION FOUND` correction against the canonical docs first — do not override them from within the Agent 2 contract.

### F2 — HIGH — Coordinate model is AABB-only while rotation is already confirmed

1. **Decision:** Geometry is `{x, y, width, height}` in Scene coordinates; hit-test, inclusive boundaries, marquee intersection, selection bounding box, multi-resize and snapping all operate on axis-aligned rectangles; rotation is deferred as a "hook."
2. **Why it is a problem:** `UI_DESIGN_SYSTEM_V2.md` §27 confirms "Free rotation + 5° snap" and "`R` = 90° clockwise rotation"; corrections §8 repeats it. `src/Domain/models.ts` `Geometry` (lines 28–33) has **no** rotation/anchor field. The "hooks" the plan promises to prepare are, in reality, the exact math rotation invalidates: hit-testing a rotated widget, marquee intersection with a rotated box, a selection bounding box over rotated widgets, and snapping to rotated edges/centers are all different algorithms. Locking AABB-only decisions now means a confirmed feature will force rework of the interaction core.
3. **Future feature conflict:** rotation, aspect-ratio lock (rotation changes which axis is "width"), nested groups/transform stacks, alignment/distribution of rotated bounds.
4. **Type:** architecture + geometry.
5. **Severity:** HIGH (borderline CRITICAL because the conflicting feature is already CONFIRMED).
6. **Recommended alternative:** Either (a) extend the geometry contract now with rotation + anchor so hit-test/marquee/snap operate on oriented bounds, or (b) explicitly downgrade: declare the interaction contract AABB-only and state that rotation requires a documented contract v2 plus a full re-spec of §4.3–4.8. Do not present AABB-only decisions as stable foundations.

### F3 — HIGH — Multi-resize "bounding-box transform, preserve proportions" is under-specified and can distort irreversibly

1. **Decision:** Multi-widget resize uses the selection bounding box as reference frame and "preserves relative positions/proportions" (§4.7, §6A).
2. **Why it is a problem:** (a) The pivot is unspecified (opposite edge? center?). (b) Edge handles scale one axis → non-uniform scale that silently changes every widget's aspect ratio. (c) "Proportions" is ambiguous: preserving each widget's *aspect ratio* (corner = uniform scale) and preserving *relative layout ratios* are different and conflict across corner vs. edge handles. (d) Text widgets have intrinsic layout (firmware font size, wrapping); stretching the box distorts content rather than reflowing it. (e) Media widgets are aspect-sensitive; non-uniform scaling violates their content contract. (f) No per-type minimum size is sourced from DeviceProfile/content. (g) Because the commit writes per-widget absolute geometry, the distortion becomes canonical and is recoverable only by undoing the whole gesture — the intermediate state was still wrong.
3. **Future feature conflict:** aspect-ratio lock (canonical: "size lock and aspect-ratio lock are independent settings"), text/media widgets, min sizes, rotation (bounds change shape), grouping.
4. **Type:** geometry + UX + state/history.
5. **Severity:** HIGH.
6. **Recommended alternative:** Specify exact math (pivot = opposite handle edge; corner handles scale uniformly by default; edge handles scale one axis and are disallowed for aspect-locked/content-locked widgets), exclude or reflow text widgets, define per-type minimum sizes from canonical sources, and compute the whole transform as one reversible command from *initial geometry + final delta* rather than incremental absolute writes.

### F4 — HIGH — Snap model races qualitatively different targets; "Scene unit" undefined; no spatial index

1. **Decision:** 6 Scene-unit threshold; nearest candidate wins; Grid > Edge > Center > stable-ID tie-break only at equal distance; per-axis; selection-bbox reference (§4.8, §6A).
2. **Why it is a problem:** (a) Grid, edge and center are qualitatively different snap targets; collapsing them into one "nearest distance" makes behavior unpredictable — a grid line 0.1 unit closer beats a visually meaningful edge alignment. (b) Floating-point "equal distance" is effectively unreachable, so the Grid>Edge>Center tie-break is nearly dead code and "nearest" is the real rule. (c) "Evaluated independently per axis" never says what happens when x snaps to grid and y snaps to an edge — the composite delta matches neither, and guide rendering for that case is undefined. (d) "Scene unit" has no domain definition (see F11); a 6-unit threshold is resolution- and zoom-dependent. (e) "All eligible candidates within threshold" is O(n) per `pointermove`; thousands of widgets → jank. (f) Geometry is floating-point with no rounding policy in the store, so snapped values accumulate error across nudges.
3. **Future feature conflict:** rulers/guides, zoom (threshold must be screen-space or adaptive), dense/large scenes, snapping rotated edges.
4. **Type:** geometry + performance + UX.
5. **Severity:** HIGH.
6. **Recommended alternative:** Use snap-type priority (grid/edge/center as distinct passes, each with its own threshold and guide rendering) instead of a nearest-distance race; define Scene-unit explicitly; make the threshold zoom-normalized (screen px at current zoom); specify per-axis independent snapping with two independent guides; add a spatial index for candidate lookup.

### F5 — MEDIUM — Two overlapping z-order sources; "effective z-order" never defined

1. **Decision:** Hit-test "topmost wins"; equal z-order → active Scene document order → stable ID (§4.3, §6A).
2. **Why it is a problem:** `src/Domain/models.ts` has **both** `Widget.zIndex` (numeric) and `Scene.widgets` array order. `DOMAIN_MODEL_V1.md` says z-order = draw order; the UI spec gives Explorer Bring Forward/Send Backward commands; Agent 1 has both `moveWidget` (array reorder) and a `zIndex` property. "Effective z-order" is never declared to be `zIndex` or array index, and "document order" as tie-break only makes sense if array order is the stacking source — in which case `zIndex` is redundant and can contradict it. The Agent 1 baseline renders array order and ignores `zIndex` entirely.
3. **Future feature conflict:** alignment/distribution anchor, Explorer ordering, a future layer panel, "primary/active widget."
4. **Type:** architecture + geometry.
5. **Severity:** MEDIUM (becomes HIGH the moment alignment/distribution lands).
6. **Recommended alternative:** Declare exactly one canonical stacking source (recommend `zIndex` = draw order; array order = Explorer/navigation order only), sort hit-testing and rendering by it, and treat document order strictly as the equal-`zIndex` tie-break.

### F6 — MEDIUM — "Document order" selection discards the anchor widget and is not scene-scoped

1. **Decision:** Selection ordering = active Scene document order; unique IDs only (§4.4, §6A).
2. **Why it is a problem:** Forcing document order destroys the "last-clicked/primary" signal that alignment, distribution, duplicate placement and multi-select Properties all need. In addition, Agent 1's selection is global while `setWidgetGeometries`, `deleteSelection` and `duplicateSelection` apply by ID across the *whole project* — so a selection spanning scenes silently mutates multiple scenes with one gesture.
3. **Future feature conflict:** alignment/distribution (anchor), multi-select Properties, copy/paste, keyboard navigation, duplicate placement.
4. **Type:** architecture + UX + extensibility.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Keep a deterministic ordered list but also track a primary/anchor widget, and scope geometry-mutating selection to the active Scene (reject or explicitly handle cross-scene multi-select).

### F7 — MEDIUM — Invisible-widget interaction semantics are incomplete

1. **Decision:** Invisible widgets are not Canvas-hit-testable; selectable via Explorer/selection bounds (§4.3, §6A).
2. **Why it is a problem:** (a) Marquee behavior over invisible widgets is unspecified — does a marquee select them? (b) The mixed visible+invisible selection bounding box is undefined (do invisible geometries contribute?). (c) Accessibility: the UI spec requires a keyboard equivalent for canvas interaction, but an invisible widget unreachable on-canvas has no keyboard path. (d) Hide All/Show All (confirmed) interacts with selection retention — hiding a selected widget leaves a stale selection whose bounds/geometry semantics are undefined.
3. **Future feature conflict:** accessibility, hidden-layer/layer workflows, Hide All/Show All, selection bounds.
4. **Type:** UX + accessibility + state.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Define marquee/selection-bounds rules explicitly (recommend: marquee excludes invisible; invisible selected widgets show bounds but their geometry is excluded from multi-resize/snap unless all selected widgets are visible), and provide keyboard navigation that reaches invisible widgets.

### F8 — MEDIUM — `Ctrl/Cmd+D` is locked as "approved" and conflated with the real Duplicate mode

1. **Decision:** Ctrl/Cmd+D = `EditorApplication.duplicateSelection()` (§4.9, §6A).
2. **Why it is a problem:** `UI_DESIGN_SYSTEM_V2.md` §19 still marks `Ctrl+D` **PROPOSED**, and the corrections doc keeps it Proposed. The canonical **Duplicate mode** is a *different, confirmed* feature (click-center placement, repeated click duplicates, Esc exits). Agent 1's `duplicateSelection()` does a fixed non-snapped `+10/+10` offset, does not select the copy and does not place it at the cursor — so Ctrl+D neither implements Duplicate mode nor matches its eventual semantics. The plan's justification ("`duplicateSelection()` exists") is an implementation-capability argument, not a product-decision argument.
3. **Future feature conflict:** Duplicate mode, copy/paste (Ctrl+C/V), shortcut registry.
4. **Type:** UX + state/history + product.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Leave Ctrl+D unbound/Proposed until Duplicate mode is defined; implement duplication as a cursor-relative, snapped, select-the-copy command when the product decision lands.

### F9 — MEDIUM — Scope gap: z-order changes dropped despite being in the Agent 2 mandate

1. **Decision:** Agent 2 plan §3 omits z-order operations.
2. **Why it is a problem:** `TEMPLATE_DESIGNER_DEVELOPMENT_PLAN_V1.md` §4.C explicitly puts "z-order changes" in Agent 2's scope, and hit-testing's "effective z-order" (F5) depends on a working z-order model. Agent 1's `executeEditorDescriptor` stubbed `moveScene`/`moveWidget` to `toIndex = 0`, so there is no real reorder capability to build on.
3. **Future feature conflict:** hit-test correctness, Bring Forward/Send Backward, layer workflows.
4. **Type:** architecture + scope.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Add z-order (bring forward/back, send front/back) to Agent 2 scope, or record it as explicitly deferred with an owner, and resolve the z-order source first (F5).

### F10 — MEDIUM — History has no coalescing; commit can read stale transient state

1. **Decision:** One gesture = one history entry; commit computed from preview (§4.6/§4.7).
2. **Why it is a problem:** (a) The baseline prototype commit path reads `geometryOverrides` React state at `pointerup` — a stale-closure risk (the final override may not have flushed). The commit must be recomputed from *initial geometry + final pointer delta*, never from the last-rendered override. (b) `DocumentStore.refreshSnapshot()` JSON-serializes the entire project on every snapshot (`src/Core/document-store.ts:121–129`), and `EditorApplication.execute()` clones the whole project twice plus JSON-compares before/after (`src/Core/editor-application.ts:73–87`) — O(n) per commit. That is acceptable per gesture, but `CommandHistory` (`src/Core/commands.ts`) has **no coalesce/transaction primitive**, so future continuous value editing (numeric scrubber, slider) cannot collapse into one entry. (c) `geometryOverrides` is keyed by widget ID and cleared only on the happy path; a scene/rotation switch or unmount mid-gesture can leak overrides onto different content.
3. **Future feature conflict:** continuous property editing (Agent 3), live preview, undo granularity.
4. **Type:** state/history + performance.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Compute commits from initial+delta; guarantee override cleanup on *every* exit path (cancel/blur/scene-switch/unmount); add a coalesce/transaction capability to `CommandHistory` so continuous edits collapse into one entry.

### F11 — MEDIUM — "Scene unit" and the snap-grid unit have no defined source; device size is hard-coded

1. **Decision:** "6 Scene units" snap threshold; "configured snap-grid unit" keyboard step (§4.8/§4.9).
2. **Why it is a problem:** The domain has no Scene-unit definition. Agent 1's `addRotation()` hard-codes `720 × 1280` (`src/Core/editor-application.ts:99`), contradicting the plan's own rule "must not hard-code a device size," while `DeviceProfile.display` defines resolution. "Configured snap-grid unit" has no canonical source (DeviceProfile? project settings? editor prefs?). Thresholds and step sizes are therefore device- and resolution-dependent and unpredictable.
3. **Future feature conflict:** device/profile switching, zoom, responsive layouts, the Settings surface.
4. **Type:** geometry + extensibility.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Define Scene coordinates = the active Rotation's logical resolution (`rotation.width × height`, sourced from DeviceProfile); source the snap-grid unit from a canonical setting; make the snap threshold screen-space (px at current zoom) or explicitly document its device dependence.

### F12 — MEDIUM — Zoom/pan deferred, but the coordinate contract depends on it

1. **Decision:** Defer zoom/pan gesture (§6A).
2. **Why it is a problem:** The coordinate functions take `viewTransform`, and the drag threshold is CSS px while the snap threshold is Scene units — their relationship is defined by zoom. Deferring zoom leaves the `viewTransform` contract and unit conversion unverified: screen↔scene math is specified against a transform that does not yet exist or is only implicitly encoded in `toCanvasPoint()`.
3. **Future feature conflict:** zoom/pan, rulers/guides, DPI.
4. **Type:** geometry + extensibility.
5. **Severity:** MEDIUM.
6. **Recommended alternative:** Define and unit-test the `viewTransform` contract (scale + translate + letterbox) even if no user gesture binds to it yet, and state explicitly that the drag threshold is screen px (converted) while snap thresholds are Scene units.

### F13 — LOW — Inclusive marquee/hit boundaries reserve no "window vs. crossing" mode

1. **Decision:** Inclusive edge-touch for both hit-test and marquee (§4.3/§4.5).
2. **Why it is a problem:** Inclusive boundaries are deterministic and correct for hit-testing, but CAD/EDA tools conventionally offer a *crossing* (intersect) and a *window* (fully-contained) marquee mode. A 1-unit graze selecting a widget on dense layouts can surprise; no mode parameter is reserved now.
3. **Future feature conflict:** dense layouts, precise selection, alternate marquee modes.
4. **Type:** UX + extensibility.
5. **Severity:** LOW.
6. **Recommended alternative:** Keep inclusive (deterministic) but parameterize the marquee predicate (`intersect` vs `contains`) so a "window" mode can be added without breaking the contract.

---

## 3. Product Decision Review

Every major approved decision, with verdict.

| # | Approved decision | Verdict | Severity | Problem summary | Recommendation |
|---|---|---|---|---|---|
| 1 | Scene-coordinate widget geometry | KEEP WITH CONDITIONS | MEDIUM | Correct canonical frame, but "Scene unit" is undefined and `addRotation()` hard-codes 720×1280 | Pin Scene coords to active Rotation logical resolution sourced from DeviceProfile (F11) |
| 2 | 4 CSS px drag threshold | KEEP | — | Screen-space threshold; standard and deterministic | Lock it |
| 3 | Deterministic selection ordering (document order) | KEEP WITH CONDITIONS | MEDIUM | Discards the anchor widget; selection is not scene-scoped | Add primary/anchor widget; scope geometry-mutating selection to active Scene (F6) |
| 4 | Inclusive hit-test boundaries | KEEP | — | Deterministic; boundary points are inside | Lock it |
| 5 | Inclusive marquee edge-touch | KEEP WITH RESERVATION | LOW | No window/crossing mode reserved | Parameterize predicate as `intersect`/`contains` (F13) |
| 6 | Selection bounding-box multi-resize | CHANGE REQUIRED | HIGH | Pivot, uniform vs non-uniform, text/media and min sizes unspecified; can irreversibly distort | Specify exact math; corner = uniform; exclude/reflow text; per-type minimums (F3) |
| 7 | 6 Scene unit snap threshold | CHANGE REQUIRED | HIGH | Undefined unit; zoom-dependent; no candidate index | Define Scene unit; zoom-normalize threshold; spatial index (F4, F11) |
| 8 | Nearest eligible snap candidate | CHANGE REQUIRED | HIGH | Races qualitatively different targets; unpredictable; float "equal distance" is unreachable | Snap-type priority passes instead of nearest-distance race (F4) |
| 9 | Grid → Edge → Center → stable ID tie-break | CHANGE | HIGH | Tie-break is nearly dead code under float equality; priority should be primary, not tie-break | Make priority the primary rule with per-type thresholds (F4) |
| 10 | Selection bounding-box multi-snap reference | KEEP WITH CONDITIONS | MEDIUM | Depends on F3/F6 (which geometries compose the box; mixed visibility/lock undefined) | Define bbox membership explicitly; exclude locked/invisible per F3/F7 |
| 11 | Arrow = 1 Scene unit | CHANGE REQUIRED | CRITICAL | Contradicts canonical CONFIRMED table (Arrow = snap-grid) | Adopt canonical `Arrow = snap-grid` (F1) |
| 12 | Ctrl/Cmd+Arrow = snap-grid unit | CHANGE REQUIRED | CRITICAL | Canonical Ctrl+Arrow is the ÷10 fine step; plan inverts the modifier roles | Adopt canonical `Ctrl+Arrow = ÷10 fine` (F1) |
| 13 | Shift+Ctrl/Cmd+Arrow = 5× snap-grid | KEEP | — | Matches canonical | Lock it |
| 14 | Escape / pointercancel / lost capture / blur = cancel, zero history | KEEP | — | Correct and complete for the listed risks | Lock it (add F10 override-cleanup guarantee) |
| 15 | Locked widgets selectable but not geometrically mutable | KEEP | — | Core already enforces as final authority; mixed selection semantics specified | Lock it |
| 16 | Ctrl/Cmd+D = `duplicateSelection()` | CHANGE REQUIRED | MEDIUM | Canonical still marks Ctrl+D PROPOSED; real Duplicate mode is a different confirmed feature; current duplicate is +10/+10, non-snapped, no copy selection | Unbind until Duplicate mode is defined (F8) |
| 17 | Invisible widgets not Canvas-hit-testable | KEEP WITH CONDITIONS | MEDIUM | Marquee/bounds/keyboard behavior over invisible widgets unspecified | Define explicitly (F7) |
| 18 | Zoom/pan deferred | KEEP WITH CONDITIONS | MEDIUM | Coordinate contract and thresholds depend on `viewTransform` | Define `viewTransform` contract now, bind gesture later (F12) |

---

## 4. Important Questions

### 4.1 Coordinate model

**Is "Widget geometry → Scene coordinates" the correct canonical model?** Yes — with two caveats. Scene coordinates are the right canonical frame (device-relative, top-left origin, positive down), and the model survives viewport scaling, letterboxing, panel resize, rulers/guides and device-resolution changes **provided** "Scene" is pinned to the active Rotation's logical resolution (`rotation.width × height`). It is not pinned today: `addRotation()` hard-codes 720×1280, and the plan never defines what a "Scene unit" is (F11). Without that, "6 Scene units" and "1 Scene unit" are meaningless across devices and zoom levels. It is also rotation-blind: the frame is fine for axis-aligned V1 widgets, but the confirmed free-rotation feature means `{x, y, width, height}` must grow a rotation/anchor — or the interaction contract must be explicitly scoped as AABB-only (F2). Nested groups would eventually need a local transform stack; the canonical model is correct to keep Bounding Group as a *layout relationship* rather than a coordinate space, so flat Scene coordinates are acceptable for V1 — but the plan should not imply that flat coordinates scale to nested transforms.

### 4.2 Multi-resize

**Is selection bounding-box transformation the right abstraction?** It is the right *reference frame*, and the wrong *unspecified algorithm*. Mixed aspect ratios, locked widgets (excluded, fine) and minimum sizes are all handled by the plan at the level of intention only; the pivot, per-handle scaling law, and rounding policy are absent, so the same contract can be implemented as a uniform scale or a distortion. Text widgets cannot be safely non-uniformly stretched (intrinsic font/layout), and media widgets are aspect-sensitive. Future rotation changes the bounding-box shape entirely. The chosen model *can* create irreversible geometry distortion because the commit writes absolute per-widget geometry; only a full undo restores the original, and the user may not notice until later. It must be specified exactly before implementation (F3).

### 4.3 Snapping

**Does "nearest candidate within threshold" produce predictable behavior?** No — not when grid, edge and center compete in one distance pool. A grid line 0.1 unit closer silently beats a visually meaningful edge alignment; floating-point "equal distance" is effectively unreachable, making the declared tie-break nearly dead code; per-axis independence is declared without defining what happens when axes snap to different candidate kinds (composite delta matches neither); and the threshold is expressed in an undefined unit across zoom levels. Multi-selection bbox reference is reasonable but inherits the membership ambiguities of F3/F6. Axis-independent snapping *is* necessary, and it is already the plan's claim — the problem is that per-axis *priority* is unspecified. Large scenes and dense layouts add an O(n)-per-pointermove cost with no spatial index. Recommend snap-type priority passes (F4).

### 4.4 Selection

**Is document order the correct canonical ordering?** As a *deterministic serialization* of the selection set, yes. As the *only* ordering, no. Document order throws away the last-clicked/primary signal that alignment, distribution, duplicate placement, multi-select Properties and keyboard navigation all need; it also fails to explain how a selection that spans scenes should behave when `setWidgetGeometries`/`deleteSelection`/`duplicateSelection` apply by ID across the whole project. Keep deterministic order for the set; add an explicit primary/anchor widget and scene-scoping (F6).

### 4.5 Invisible widgets

**Is excluding invisible widgets from Canvas hit-testing consistent?** Consistent with rendering and with the Explorer/selection-bounds escape hatch — but incomplete. Marquee behavior over invisible widgets, the composition of mixed visible/invisible selection bounds, Hide All/Show All interaction with a retained selection, and the accessibility requirement of a keyboard path to an invisible widget are all unspecified. The decision itself is sound; the surrounding semantics must be defined (F7).

### 4.6 Keyboard

**Is the shortcut model scalable?** Only after F1 is fixed. The current table contradicts the canonical CONFIRMED table and is now in code. Beyond that: the shortcut handling is ad-hoc in the canvas keydown handler rather than the single shortcut registry the UI spec requires (with conflict detection); `Ctrl+D` collides with the future Duplicate mode and with copy/paste conventions; and no future rotate/resize command bindings are reserved. Text-input/focus boundaries are declared but must be enforced through the registry, not per-handler discipline (F1, F8).

### 4.7 Pointer interaction

**Are pointer capture / pointercancel / lost capture / blur / Escape sufficient?** Yes for the enumerated desktop cases — with one addition. The missing cases: pointer leaving the *application window* while captured (blur covers it if the window loses focus, but not all platforms fire window blur on pointer exit while captured — the contract should also treat `pointerleave` of the document/viewport as a cancel candidate); OS-level gesture takeovers (covered by `pointercancel` on modern browsers); and touch introduction later, which will need a separate tap-vs-drag articulation and explicit touch-action policies. The interaction state machine should also define what happens when the active Scene/Rotation changes mid-gesture (e.g., Explorer click) — cancel-with-restore is the only safe answer and is not specified (F12-adjacent, F10).

### 4.8 History

**Does "one gesture = one history entry" remain correct?** Yes for drag, resize, snapping (snap is part of the gesture commit) and multi-selection gestures. It is *not* sufficient for future continuous property editing (numeric scrubbers, sliders) and live preview: those need coalescing, which `CommandHistory` currently lacks. Also, the commit must be derived from initial geometry + final delta, not from the last rendered override, or the history entry can record stale state. Gesture-level correctness is right; add a coalesce primitive and commit-from-delta (F10).

### 4.9 Performance

**Will the interaction model remain performant?** Mostly, with two documented risks. Per-commit cost is O(project size): full clone twice plus JSON serialize/compare (`editor-application.ts:73–87`, `document-store.ts:121–129`) — fine per gesture, but it bounds future continuous editing. Per-pointermove hit/snap cost is O(n) over all widgets with no spatial index; hundreds of widgets are fine, thousands on dense scenes will jank during marquee and snap evaluation. Rendering hundreds of absolutely-positioned DOM nodes is acceptable; thousands are not. Recommend a spatial index for candidate queries and a coalesced commit path before continuous editing lands (F4, F10).

### 4.10 Architecture

**Is there a clean boundary between transient interaction state and canonical document mutation?** Yes — this is the strongest part of the plan, and the boundary is correctly enforced by Agent 1 (`setWidgetGeometries` filters locked widgets, `execute` refuses no-ops). Two risks remain: (a) `geometryOverrides` can become a *de facto* second source of truth if it is ever read by anything other than the transient preview renderer (the baseline Properties panel already reads `effectiveGeometry`, mixing preview state into an inspector surface — that leakage must be closed); (b) `updateWidgetGeometries()` in `canvas-interaction.ts` is a pure Project transformation that bypasses history — it is currently used only for preview, but it is the most dangerous function in the codebase if any future code path commits through it. Keep it preview-only with an explicit contract comment and a test that asserts no history entry is produced through it (F10).

---

## 5. Future Compatibility

| Feature | Verdict | Why |
|---|---|---|
| Rotation | ❌ **Not supported by current model** | No rotation/anchor in `Geometry`; all §4.3–4.8 decisions are AABB-only; feature is already CONFIRMED (F2) |
| Grouping / nested groups | ⚠️ Partial | Bounding Group (layout-only) is consistent with flat Scene coords; nested *transforms* are not supported — acceptable for V1 but should be stated |
| Alignment | ⚠️ At risk | Needs an anchor/primary widget; document-order selection discards it (F6) |
| Distribution | ⚠️ At risk | Same anchor problem, plus selection-bbox spacing math that overlaps with multi-resize ambiguity (F3, F6) |
| Constraints | ⚠️ Deferred OK | No constraint model in the domain; deferral is fine but should be named, not assumed |
| Responsive layouts | ⚠️ Conditional | Works only if Scene unit = rotation logical resolution and is sourced from DeviceProfile (F11) |
| Device/profile switching | ⚠️ Conditional | Same Scene-unit dependency; profile-driven sizing is not wired into the interaction thresholds (F11) |
| Zoom/pan | ⚠️ Deferred but entangled | Coordinate contract and threshold units depend on `viewTransform` (F12) |
| Rulers / guides | ⚠️ Partial | Pure guide primitives are right, but guide rendering for mixed-axis snap kinds is undefined (F4) |
| Snapping | ⚠️ Partial | Nearest-candidate race and undefined units must be fixed (F4, F11) |
| Multi-selection | ⚠️ Partial | Needs scene-scoping and a primary widget (F6) |
| Copy/paste | ⚠️ Partial | `Ctrl+D` collision and duplicate placement semantics unresolved (F8) |
| Undo/redo | ✅ Correct for gestures | One entry per canvas gesture is right; coalescing needed for future continuous edits (F10) |
| Properties Panel | ⚠️ Partial | Multi-select `*` is canonical and fine, but the panel must not read transient preview overrides, and continuous edits need coalescing (F10) |
| Simulator | ✅ OK | Separate surface consuming canonical render; no interaction-model conflict |
| Asset/media widgets | ⚠️ At risk | Non-uniform multi-resize distorts aspect-sensitive media; no per-type min sizes (F3) |

---

## 6. Recommended Changes

Only changes worth making **before further contract work and before the Agent 3 QA gate**:

1. **Reconcile the keyboard table with `UI_DESIGN_SYSTEM_V2.md` §19 / corrections §8** — adopt `Arrow = snap-grid`, `Ctrl+Arrow = ÷10 fine`, `Shift+Ctrl+Arrow = ×5`; remove "1 Scene unit" or file a `DOMAIN CONTRADICTION FOUND` correction first. (F1, CRITICAL)
2. **Resolve the rotation geometry contract** — either add rotation/anchor to the geometry abstraction now, or explicitly downgrade the interaction contract to "AABB-only, rotation = contract v2." Do not silently lock AABB decisions. (F2, HIGH)
3. **Specify multi-resize math exactly** — pivot, uniform vs non-uniform per handle, text/media special-casing, per-type minimums. (F3, HIGH)
4. **Replace the nearest-distance snap race with snap-type priority** and define per-axis independent snapping plus explicit guide rendering; define Scene-unit and zoom-normalize the threshold. (F4, HIGH)
5. **Define "effective z-order" precisely** — pick `zIndex` (or array order) as the single stacking source and reconcile `moveWidget` vs `zIndex`. (F5)
6. **Add scene-scoping and a primary/anchor widget to the selection model.** (F6)
7. **Specify invisible-widget marquee/bounds/keyboard behavior.** (F7)
8. **Downgrade `Ctrl+D` to Proposed** and separate it from Duplicate mode until the product decision lands. (F8)
9. **Add z-order operations back into Agent 2 scope** (or explicitly defer with an owner). (F9)
10. **Compute commits from initial+delta, not rendered overrides; guarantee override cleanup on every exit path; add history coalescing.** (F10)
11. **Define Scene unit and snap-grid source; remove the 720×1280 hard-code.** (F11)
12. **Define the `viewTransform` contract now, even without a zoom gesture.** (F12)
13. **Keep `updateWidgetGeometries()` preview-only** with an explicit contract comment and a no-history-entry test. (§4.10)

---

## 7. Decisions That Should NOT Be Changed

These are sound and should remain locked:

- **Transient vs canonical boundary.** Selection/hover/marquee/`geometryOverrides` as transient; commits only through `EditorApplication.setWidgetGeometries()`/`deleteSelection()`/`duplicateSelection()`. Correct and matches Agent 1.
- **4 CSS-pixel drag threshold** (screen px). Standard and deterministic.
- **Pointer-cancellation contract.** `pointercancel` / lost capture / window blur / Escape = cancel with zero history and exact initial-preview restore. Correct and complete for the listed risks (with F10's cleanup guarantee added).
- **One gesture = one history entry** for canvas drag/resize — correct as stated for gestures (coalescing is only a *future* continuous-edit need).
- **Locked widgets:** selectable, excluded from geometry mutation, all-locked = no-op, mixed selection moves only unlocked. Correct, and Core already enforces it as final authority.
- **Pure-function primitives** for coordinates, hit-test, marquee, resize, snap and guides. Correct separation.
- **No fake command handlers; map only real capabilities.** Correct and important.
- **Mutually-exclusive interaction state machine** (`idle`/`marquee`/`drag`/`resize`/`pan`). Correct.
- **Grid visibility separate from snap enablement.** Correct.
- **Self-snap exclusion for the active selection.** Correct.
- **Inclusive hit-test and inclusive marquee edge-touch** as the deterministic default (with F13's mode-parameter reservation).
- **Selection changes never mutate the document or create history entries.** Correct.

---

## 8. Post-Implementation Note

Agent 2's implementation landed at `f1306ac` (`feat(canvas): implement canvas interaction foundation`) after this review was commissioned. Two findings were verified as already live in that commit:

- **F1 (CRITICAL) is in code:** `src/App/App.tsx:667` computes the nudge step as `shift && mod ? GRID*5 : mod ? GRID : 1` — i.e. plain Arrow = 1 unit, Ctrl+Arrow = grid, Shift+Ctrl+Arrow = 5× grid. This is the plan's inverted table, contradicting the canonical CONFIRMED shortcut spec. Changing it later is a code change plus a shortcut-registry migration; fixing it now is cheaper.
- **F2 (HIGH) is in code:** `Geometry` in `src/Domain/models.ts` remains `{x, y, width, height}` with no rotation/anchor, while the interaction contract stays AABB-only. The confirmed rotation feature still has no geometry contract.

The Agent 3 QA gate (`docs` plan `117579f`) should verify the remaining findings (F3–F13) against `f1306ac` before accepting the Canvas gate, since this review predates that commit and did not audit its full implementation.

---

## 9. Final Gate

**BLOCK.**

The plan's architecture boundary is right, and roughly half its decisions are sound and should stay locked. But it currently (1) contradicts the canonical keyboard spec on a CRITICAL point while claiming to *be* canonical — and that contradiction is now implemented in `src/App/App.tsx` — and (2) locks an AABB-only geometry/interaction contract against a rotation feature that is already confirmed, guaranteeing rework of hit-testing, marquee, multi-resize and snapping. Neither can be safely resolved mid-implementation.

**To flip the gate to GO WITH CHANGES:** resolve F1 (keyboard) and F2 (rotation-aware geometry contract or an explicit AABB-only downgrade) in the canonical docs, then apply F3–F12 to the contract before further implementation work.

**To reach GO:** also lock F3 (multi-resize math), F4 (snap model) and F5 (z-order source) — the three decisions most likely to become irreversible if implemented wrong.

---

*No application code was modified by this review. This document is the only artifact.*
