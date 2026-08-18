# Reference — Interaction Design (Template Designer)

Deep-dive for the `ui-design` skill. Applies `docs/design/UI_DESIGN_PRINCIPLES_V1.md` §13, §15, §16. Canonical authority: `docs/UI_DESIGN_SYSTEM_V2.md` §7, §18–§19; corrections §8; `docs/AGENT2_CANVAS_INTERACTION_FOUNDATION_PLAN.md` §4 (locked).

## 1. Selection language

| Situation | Behavior |
|---|---|
| Single click | Select widget; make it primary; empty Canvas click clears selection |
| `Ctrl`/`Shift` + click | Toggle/add membership |
| Marquee | Inclusive intersection; additive with `Ctrl`/`Shift`; normalized transient rect |
| Multi-selection | Ordered in active-Scene document order; common properties only; differing values = `*` |
| Locked widget | Selectable; properties readable; geometry mutation disabled |
| Invisible widget | Not rendered; not Canvas-hit-testable; selectable via Explorer; shows selection bounds |
| Hide All / Show All | One undoable command each; preserves prior user intent |

- Selection is **transient UI state**: it never mutates the document, never creates history (AGENT2 §4.6).
- Primary/anchor widget: last clicked (click), first hit in document order (marquee); falls back per AGENT2 §4.6; reserved as the future alignment/distribution anchor.
- Selection feedback uses the accent family; never confused with focus or error colors (canonical §7).
- Bounding Group is a canonical geometry/layout relationship — never labeled "grouping" like editor selection grouping (canonical §7).

## 2. Canvas interaction contract (locked, AGENT2 §4)

The full deterministic contract lives in AGENT2 §4. The invariants an implementer must hold:

```text
Coordinate model   Scene units = logical pixels of the active Rotation space;
                   dimensions from DeviceProfile.display (R90/R270 swap);
                   one shared view transform for rendering AND conversion (fit + letterbox + pan + zoom)
Pointer lifecycle  primary button only; 4 CSS px drag threshold; capture/release;
                   Escape/pointercancel/lost capture/blur/Scene switch/unmount cancel with
                   zero history and exact initial-preview restore
Hit testing        pure function; boundary points inside; invisible widgets excluded;
                   stacking order: zIndex asc → array index asc → stable ID asc (topmost = greatest)
Z-order            zIndex is the stacking source; array order is Explorer order + equal-z tie-break;
                   Bring Forward / Send Backward / Bring To Front / Send To Back = deterministic zIndex math
Movement/resize    one command + one history entry per completed gesture; commit recomputed from
                   initial geometry + final pointer state (never last-rendered preview);
                   locked excluded; all-locked = no-op; min size 10 Scene units;
                   corner resize non-uniform, edge resize single-axis (uniform waits for aspect lock)
Snapping           pass-priority per axis: Grid > Edge > Center; nearest within the winning pass;
                   6 Scene-unit threshold; self-snap exclusion; visible/enabled candidates;
                   one guide per axis; grid visibility ≠ snap enablement
Keyboard           Arrow = snap-grid; Ctrl/Cmd+Arrow = grid ÷ 10; Shift+Ctrl/Cmd+Arrow = grid × 5;
                   Shift+Arrow = none; registry-owned; text-input focus exclusion;
                   platform-exact Mod (Meta on macOS / Control on Windows/Linux);
                   exact-modifier matching; Ctrl/Cmd+D PROPOSED and unbound
```

- Rotation (R key, free rotation, 5° snap) is a CONFIRMED product feature that Canvas foundation V1 does **not** implement yet — do not fake it (AGENT2 §5).
- Snap-grid unit is a settings-owned editor preference (interim default 10); never hard-coded (AGENT2 §4.11).

## 3. Keyboard and shortcut registry

- The shortcut registry is the single source with conflict detection (§19). Canvas consumes registry-resolved commands; it never owns a competing per-handler table (AGENT2 §4.12).
- Movement triggers only for the exact modifier sets: none, `Mod`, `Mod+Shift`. `Shift+Arrow` and `Alt+…` combos must not move.
- Text-input focus exclusion: no canvas shortcuts fire inside `input`, `textarea`, `select`, `contentEditable`, search fields, numeric fields, or the Binding editor; Escape there cancels that surface's own state.
- Deleting the focused widget must restore a sane focus target (body/dead-keyboard failure is audit INT-31/32).
- Familiar desktop conventions first (`docs/UI_UX_DECISIONS_V1.md` §"Shortcut policy"): do not invent modifiers where a convention exists.

## 4. Affordance and signifiers

- Affordance = behavior: an element looks interactive only if it is; interactive elements must look interactive (`AP-AFFORD-01`, `AP-COMPONENT-03`).
- Signifiers per state: hover (subtle), pressed (distinct from selected), selected (restrained accent), disabled (reason).
- Handles appear only when applicable (resize handles on selection; no decorative handles).
- Context menus expose only real capabilities; unavailable commands are disabled or omitted — never fake handlers or fake success logs (canonical §18, AGENT2 §4.14).

## 5. Feedback

- Every mutation produces proportional, visible feedback: selection update, outline, Console trace, dirty state, validation result.
- Feedback for deployment follows the real operation: `Preparing → Writing → Verifying → Completed / Safe to remove`; success only after verification (§16, §26).
- Notification discipline: inline validation for local errors, status/toast for completed background operations, modal only when user action is required; no spam (`docs/UI_UX_ARCHITECTURE.md` §24).

## 6. Cross-surface synchronization

These must agree at all times across Project Explorer, Canvas, Properties, Document Tabs, Status Bar, Console:

```text
active document   active Scene   selection set   dirty state
zoom/pan context  validation state   operation status (preparing/writing/verifying)
```

- Explorer selection and Canvas selection share one selection path (audit evidence: shared `selectNode` is the correct pattern — AGENT4 report).
- Runtime-driven Scene changes (Simulator/Preview) must reconcile or explain selection; never silently diverge (audit INT-20/21).
- Deleting/undoing must restore or explicitly clear selection; no stale labels (audit INT-24/25).

## 7. Motion and reduced motion

- Functional only: panel open/close, selection feedback, progress, transient status. No pulse loops, no floating decoration, no canvas-moving animation (canonical §22).
- Short, subtle transitions (≤ ~200 ms; a named motion token).
- `prefers-reduced-motion` disables/minimizes non-essential motion.
- Media playback in previews is real media control, not decoration.

## 8. Quick self-check (interaction)

```text
□ Selection transient-only; never mutates the document or history?
□ Canvas gestures follow AGENT2 §4 exactly (thresholds, cancel, commit, z-order, snapping)?
□ Keyboard table exact: no Shift+Arrow binding, no Ctrl/Cmd+D, exact modifiers, focus exclusion?
□ One shared view transform for render and pointer conversion?
□ Affordances correspond to real behavior only?
□ Selection/active Scene/dirty/status agree across surfaces?
□ Motion functional-only; reduced-motion respected?
```

Failing any check maps to audit dimension D10 and possibly gate G3.
