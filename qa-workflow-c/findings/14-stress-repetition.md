# Agent 14 — Stress / Repetition Integration

Static read-only audit. No live run performed; every finding is either statically proven (`CONFIRMED`) or a live-run-only behavioral question (`UNVERIFIED`). Baseline stated by the orchestrator: `tsc --noEmit` passes; `vitest run` 51/51 passes (not re-executed here to avoid any file writes).

## Scope & scenarios traced

| # | Scenario | Static trace result |
|---|----------|---------------------|
| S1 | Duplicate ×5 then drag each copy away | CONFIRMED stacking defect — all copies at identical `+10/+10` (WC-14-01) |
| S2 | Nudge ×20 then Undo ×20 | CONFIRMED 20 independent commands, no coalescing (WC-14-02) |
| S3 | Undo/redo ×100 exactness | CONFIRMED deterministic, id-stable (WC-14-06) |
| S4 | Duplicate 50 scenes/themes | CONFIRMED unbounded growth, no limit, depth fixed (WC-14-15) |
| S5 | Rapid tab switches mid-drag | CONFIRMED clean cancel/abort, no commit, no crash (WC-14-12) |
| S6 | Repeated splitter pointercancel | CONFIRMED orphan window listeners accumulate (WC-14-04) |
| S7 | Rapid New Project while dirty | CONFIRMED synchronous, no race, silently discards dirty work (WC-14-11) |
| S8 | 1000-command history memory | CONFIRMED O(N×project) retained clones (WC-14-08) |
| S9 | Geometry number inputs (type/arrow) | CONFIRMED one command per onChange (WC-14-03) |
| S10 | StrictMode dev double-mount | CONFIRMED throwaway store, harmless (WC-14-10) |

## Findings

### WC-14-01 Duplicate always re-duplicates the ORIGINAL → N exact-overlap copies (Medium · lost selection / UI misleading state · CONFIRMED · S1)

**Repro steps:** Select one widget. Press the context-bar "Duplicate" button (or `Widget → Duplicate Selection`) 5 times without changing the selection.

**Evidence:**
- Copy offset is from the original, not cumulative — `src/Core/editor-application.ts:83-90`:
  ```ts
  function duplicateWidget(widget: Widget): Widget {
    return {
      ...clone(widget),
      id: newId("widget"),
      name: `${widget.name} Copy`,
      geometry: { ...widget.geometry, x: widget.geometry.x + 10, y: widget.geometry.y + 10 },
    };
  }
  ```
- The copy is never selected after the command — `src/App/App.tsx:285-293` only mutates the document and logs; `setSelection`/`setSelectedIds` are not touched:
  ```ts
  const duplicateSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
    const result = widgetSelection
      ? activeScene?.id ? editorApplication.duplicateSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
      : editorApplication.duplicateSelection(selectedIds);
    if (result.changed) logAction("Selection duplicated", "EVENT");
    return result.changed;
  };
  ```
- Insertion is `flatMap` right after the selected original — `src/Core/editor-application.ts:260-265`:
  ```ts
  scene.widgets.flatMap((widget) => selected.has(widget.id) ? [widget, duplicateWidget(widget)] : [widget])
  ```

**Expected vs Actual:** Expected: each Duplicate copies the currently-selected item and selects the new copy, so repeated presses produce an offset chain. Actual: selection stays on the original, so every press copies the *same original* into the *same* `+10/+10` geometry. All copies share the original's `zIndex` (only `id`/`name`/`geometry` are changed in `duplicateWidget`), so the N copies are pixel-exact overlapped.

**Ordering nuance (corrects the brief's "last copy wins"):** `flatMap` inserts the *newest* copy immediately after the original, pushing older copies to higher array indices. After 3 duplicates of `w1` the array is `[w1, copy3, copy2, copy1]`. The exported `hitTest` (`src/App/canvas-interaction.ts:284-290`) sorts equal-`zIndex` by descending index:
```ts
.sort((left, right) => right.widget.zIndex - left.widget.zIndex || right.index - left.index || right.widget.id.localeCompare(left.widget.id))
```
So the *first-created* copy (highest index) — not the most recent — is "topmost" by that rule. Crucially, `hitTest` is **dead code**: a repo-wide grep finds it exported but never imported/called anywhere. The real hit-testing is DOM paint order: `renderCanvasWidget` sets `style zIndex: widget.zIndex` (`App.tsx:773`) for every widget, and equal-`zIndex` siblings paint later-DOM-order on top, so the highest-index copy (`copy1`, the first duplicate) is the one the user actually grabs. Either way the visible result is identical: **one copy visible; dragging it away reveals another identical copy underneath; hit/selection target is the first-created copy.**

**Recommended fix (design-level):** After a successful duplicate, set `setSelectedIds` to the newly-created ids (return them from `duplicateSelection*`), and either offset each copy cumulatively or explicitly re-offset from the selected widget so rapid presses cascade; alternatively disable Duplicate while the selection still points at the original.

---

### WC-14-02 Arrow-key nudge = one full command + full-project clone/stringify per key-repeat (Medium · command mismatch / scalability · CONFIRMED · S2)

**Repro steps:** Select a widget; hold `ArrowRight` so the OS key-repeat fires 20 times.

**Evidence:**
- Each keydown calls `commitGeometryCommand` — `src/App/App.tsx:739-746`:
  ```ts
  const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
  if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");
  ```
- `commitGeometryCommand` (`App.tsx:544-548`) → `setWidgetGeometriesInScene` → `EditorApplication.execute` (`editor-application.ts:125-139`) which clones the project twice and JSON-compares once per command:
  ```ts
  const before = clone(current);
  const after = mutation(clone(before));
  if (equalProject(before, after)) return { changed: false };
  ```
  with `clone = structuredClone` and `equalProject = JSON.stringify(...) === JSON.stringify(...)` (`editor-application.ts:7-9`).
- Each commit ends with a snapshot refresh that JSON-stringifies the project **twice** (current vs saved) — `src/Core/document-store.ts:121-129`:
  ```ts
  isDirty: serialize(this.currentProject) !== serialize(this.savedProject),
  ```
  (`serialize` = `JSON.stringify`, `document-store.ts:26-28`).

**Expected vs Actual:** Expected: rapid repeats coalesce into one logical "nudge" command (or at least the history granularity matches the user's mental "one nudge action"). Actual: every key-repeat is an independent `Command` on the undo stack (`commands.ts:33-38`), so 20 nudges = 20 history entries and 20 Undo presses to return. Cost classification is algorithmic (not runtime-tested): each key-repeat performs ≥3 `structuredClone`s (before, after, replace) plus 4 `JSON.stringify`s of the *entire* project, plus the O(depth) structural map. Holding a key on a large project is therefore **O(n·m)** where `n` = project size and `m` = repeat count.

**Recommended fix (design-level):** Coalesce consecutive same-label nudge/geometry commands on key auto-repeat (merge into one command with cumulative delta, keyed by an active-drag/repeat token), or defer commit until keyup for keyboard nudges.

---

### WC-14-03 Geometry number inputs commit one command per onChange (keystroke/arrow tick) (Medium · command mismatch · CONFIRMED · S9)

**Repro steps:** Focus the X/Y/W/H number input in Properties and type a multi-digit value (e.g. `120`), or click the field's up/down arrows repeatedly.

**Evidence:**
- `src/App/App.tsx:867-886` — every `onChange` runs a full scoped commit:
  ```ts
  const commitSelectionGeometryField = (field: keyof Geometry, value: number) => {
    ...
    const result = editorApplication.setWidgetGeometriesInScene(sceneId, updates, `Set widget ${field}`);
  ```
- Wired directly to the controlled number input — `src/App/App.tsx:910`:
  ```tsx
  <input type={multi ? "text" : "number"} value={...} onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))} />
  ```

**Expected vs Actual:** Expected: one command per completed edit (blur/Enter). Actual: each `onChange` event (each keystroke that yields a valid number, and each arrow up/down tick) creates an independent command with the full clone/stringify cost described in WC-14-02. Typing `120` over a value `10` produces 3 history entries (`1` → `12` → `120`), plus `Number("")` coerces an emptied field to `0` (a committed `x: 0`), and there is no coalescing.

**Recommended fix (design-level):** Debounce/commit-on-blur for text entry (or use a local draft + commit on blur/Enter), and coalesce arrow-tick repeats.

---

### WC-14-04 Splitter drag leaks window listeners on pointercancel (no `pointercancel` handler) (Medium · stale state / UI misleading state · CONFIRMED · S6)

**Repro steps (static trace):** Begin a left/right splitter resize; let the pointer be *canceled* (touch/pen cancellation, or browser-interrupt) instead of pointerup.

**Evidence:**
- `src/App/App.tsx:364-381` — listeners are added per drag, removed only inside `stop`, and `stop` is bound only to `pointerup`:
  ```ts
  const beginResize = (side, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    const move = (moveEvent) => { ... setLeftWidth(...) / setRightWidth(...) };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      ...
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  ```
- There is no `window.addEventListener("pointercancel", ...)` and no `setPointerCapture` on the splitter (`App.tsx:971` binds only `onPointerDown`).

**Expected vs Actual:** Expected: cancellation releases the drag and its listeners. Actual: a `pointercancel` (which does **not** fire `pointerup`) leaves `move` and `stop` attached to `window`. Every subsequent `pointermove` on the window then invokes *all* accumulated stale `move` closures, each calling `setLeftWidth`/`setRightWidth` with its own stale `startX`/`startWidth`; multiple leaked sessions fire in registration order and the panel width flickers ("jitter"). Repeated canceled splits accumulate one leaked move/up pair each — a genuine unbounded listener leak. This is a desktop-mouse low-frequency trigger (mouse rarely cancels pointers) but a real defect for touch/pen or interruption.

**Recommended fix (design-level):** Add a `pointercancel` handler that calls the same `stop` teardown, and/or use `setPointerCapture` on the splitter so release/cancel is handled uniformly.

---

### WC-14-05 Window `blur` effect re-subscribes every render (no dependency array) (Low · UI misleading state · CONFIRMED · S5)

**Evidence** — `src/App/App.tsx:748-752`:
```ts
useEffect(() => {
  const cancelOnBlur = () => cancelCanvasInteraction();
  window.addEventListener("blur", cancelOnBlur);
  return () => window.removeEventListener("blur", cancelOnBlur);
});
```
**Expected vs Actual:** React guarantees cleanup-before-reapply, so there is **no accumulation**; this is correct but churns an add/remove listener pair on every render (including every pointermove re-render during a drag). Cosmetic/perf note, not a leak.

**Recommended fix (design-level):** Wrap `cancelCanvasInteraction` in a stable ref and add `[]` deps (the handler reads `canvasPointer` via a ref or use the latest state through a functional update) to subscribe once.

---

### WC-14-06 Undo/redo ×100 is deterministic and id-stable (Info · none (verified safe) · CONFIRMED · S3)

**Repro (traced):** create → duplicate → move → delete → undo×4 → redo×4, and separately undo→redo cycled ×100.

**Evidence:**
- Redo replays the *captured* `after`, never regenerating ids — `src/Core/editor-application.ts:133-137`:
  ```ts
  this.documents.execute({
    label,
    execute: () => this.documents.replaceCurrent(clone(after)),
    undo: () => this.documents.replaceCurrent(clone(before)),
  });
  ```
- `duplicateWidget`/`duplicateScene`/`duplicateRotation`/`duplicateThemeProject` assign ids once via `newId` = `crypto.randomUUID()` (`editor-application.ts:8`); those ids are baked into the captured `after` object, so redo replays the identical ids.
- Dirty state is an exact `JSON.stringify` compare against `savedProject` (`document-store.ts:125`); `save()` stores a reference that is never mutated (all mutations clone/spread, never mutate in place — `editor-application.ts` mappers), so no aliasing drift.

**Expected vs Actual:** After undo×4 the project equals the initial created state byte-for-byte; after redo×4 it equals the final deleted state byte-for-byte (same ids). Dirty flag flips clean→dirty→clean across the saved baseline with no drift after 100 cycles. Confirmed-safe.

---

### WC-14-07 Snapshot refresh creates a new object each op; `useSyncExternalStore` re-renders every op (Info · none (correct) · CONFIRMED · S3)

**Evidence:**
- `src/Core/document-store.ts:121-129` reassigns `this.snapshot` to a fresh object and notifies listeners; `getSnapshot()` (`:52`) returns the *cached* reference, and `App.tsx:144-146` passes `getSnapshot` as both client and server reader:
  ```ts
  const documentSnapshotReader = useMemo(() => () => documentStore.getSnapshot(), [documentStore]);
  const documentSnapshot = useSyncExternalStore(documentSubscribe, documentSnapshotReader, documentSnapshotReader);
  ```
**Expected vs Actual:** Because `getSnapshot` returns a stable reference between store events, React does **not** infinite-loop; each op triggers exactly one re-render (the test at `tests/editor-pipeline.test.ts:287-299` asserts one notification per mutation/undo/redo). The "new snapshot every op" behavior is correct, not a churn bug. Confirmed-safe.

---

### WC-14-08 Command history is unbounded and retains ~2 full project clones per command (Medium · scalability · CONFIRMED · S8)

**Evidence:**
- Unbounded stacks — `src/Core/commands.ts:15-16`:
  ```ts
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  ```
- Each command closure captures both clones — `src/Core/editor-application.ts:125-137` (the `execute` closure captures `after`, the `undo` closure captures `before`; each is a full `structuredClone`). The live document is a third clone (`replaceCurrent(clone(after))`).

**Expected vs Actual:** 1000 commands on a large project retain ~2,000 full-project copies (undo stack) plus any redo-stack remnants — **O(N × projectSize)** memory with no cap or pruning. Not a correctness bug today, but a scalability ceiling for long sessions.

**Recommended fix (design-level):** Cap undo depth (e.g. 100/200) with oldest-command eviction, or store inverted deltas/patches instead of full before+after clones.

---

### WC-14-09 `geometryOverridesRef` is write-only; preview reads state, commit uses `canvasPointer.initial` (Low · stale preview (cosmetic) · CONFIRMED · S6)

**Evidence:**
- The ref is written (`App.tsx:534,539,757,761`) but a repo-wide grep finds **no read** of `geometryOverridesRef.current` anywhere. The drag-start `initial` capture the brief attributes to "the ref" actually reads *state* — `src/App/App.tsx:471` and `:591`:
  ```ts
  const previewGeometry = (widget: Widget): Geometry => geometryOverrides[widget.id] ?? widget.geometry;
  ...
  const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
  ```
- `setGeometryPreview` writes ref + state (`:533-536`); `clearGeometryPreview` writes both (`:538-542`).
- Commit path never reads the preview state — `src/App/App.tsx:691-697` recomputes from `canvasPointer.initial` + `finalDelta`, so async state lag during a drag does **not** corrupt the committed geometry.

**Expected vs Actual:** Correct commit (uses `initial`), but the ref is dead code; the render preview (which reads `geometryOverrides` state) lags one frame behind pointermoves because React batches continuous-event state updates. Cosmetic only.

**Recommended fix (design-level):** Either use the ref for the synchronous render read (as the code appears to intend) or delete the write-only ref; document that preview lag is by design.

---

### WC-14-10 StrictMode dev double-mount discards a throwaway document store (Low · state divergence (dev-only) · CONFIRMED · S10)

**Evidence:**
- `src/main.tsx:11` wraps `<App>` in `<StrictMode>` (React 19, `package.json:18-19`).
- `src/App/App.tsx:139-143` runs `store.open(createEmptyProject())` inside a `useMemo` initializer:
  ```ts
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore();
    store.open(createEmptyProject());
    return store;
  }, []);
  ```

**Expected vs Actual:** In dev, StrictMode double-invokes the render and the `useMemo` factory, creating **two** `InMemoryDocumentStore` instances (each running `open()` → `history.clear()` + `refreshSnapshot`); one is discarded and garbage-collected (no external refs). `createEmptyProject()` uses fixed ids (`factories.ts:27-35`), so the two stores are identical; the committed `editorApplication` (`App.tsx:174`, dep `[documentStore]`) wraps the committed store. Harmless, but a dev/prod behavioral divergence: production has no double-invoke, so exactly one store. No user-visible divergence.

---

### WC-14-11 Rapid New Project is synchronous and unguarded; each click discards dirty work (Low · persistence mismatch / lost selection · CONFIRMED · S7)

**Evidence** — `src/App/App.tsx:230-241`:
```ts
const createProject = () => {
  cancelCanvasInteraction();
  const nextProject = createEmptyProject("Untitled Project");
  documentStore.create(nextProject);   // -> open() -> history.clear() + refreshSnapshot
  setSelection(null); setSelectedIds([]); setViewMode("design");
  setOpenDocuments(["Project Overview"]); setActiveDocument("Project Overview");
  clearGeometryPreview(); logAction("New document created", "EVENT");
};
```
**Expected vs Actual:** No dirty-state guard, so a click while dirty silently clears history and discards unsaved work (the dirty-loss severity is owned by agent 07). The stress angle: the flow is fully synchronous (`documentStore.create` → `open` has no await), so rapid double-click has **no race** — it just creates two empty projects, the second overwriting the first. No crash, no torn state.

**Recommended fix (design-level):** Add a confirm/guard when `documentSnapshot.isDirty` (the `confirmDestructive` setting already exists in the settings draft but is not consulted).

---

### WC-14-12 Rapid tab switching cancels a drag cleanly (abort, no commit); close guard is safe (Info · none (verified safe) · CONFIRMED · S5)

**Evidence:**
- Tab-switch effect — `src/App/App.tsx:754-758`:
  ```ts
  useEffect(() => {
    if (canvasPointer.mode !== "idle") cancelCanvasInteraction();
    else clearGeometryPreview();
    return () => { geometryOverridesRef.current = {}; };
  }, [activeDocument, activeRotation?.id, activeScene?.id]);
  ```
- `cancelCanvasInteraction` (`:550-561`) aborts without committing (clears preview, resets pan, suppresses click); when idle it only clears preview.
- Close guard — `src/App/App.tsx:389-395`:
  ```ts
  const closeDocument = (label: string) => {
    if (openDocuments.length <= 1) return;
    const remaining = openDocuments.filter((document) => document !== label);
    setOpenDocuments(remaining);
    if (activeDocument === label) setActiveDocument(remaining[remaining.length - 1]);
    ...
  };
  ```

**Expected vs Actual:** `remaining` is guaranteed non-empty (guard returns when length ≤ 1, and exactly one label is removed), so `remaining[remaining.length - 1]` never indexes undefined — no crash on closing the active tab. Switching `activeDocument` during a drag aborts the drag cleanly (geometry is *not* committed), which is a minor UX quirk but correct. Tabs are cosmetic (label-keyed, `openDocument` dedupes by label `App.tsx:383-387`). Confirmed-safe.

---

### WC-14-13 Console buffer keeps ~25 entries but renders only 3 (Low · UI misleading state · CONFIRMED · S8)

**Evidence:**
- Buffer cap — `src/App/App.tsx:217-220`: `setConsoleEntries((current) => [...current.slice(-24), { level, message }]);` (keeps 24 prior + 1 new = 25 max).
- Render slice — `src/App/App.tsx:940`: `consoleEntries.slice(-3).map(...)`.

**Expected vs Actual:** Memory is bounded (rapid ops cannot grow the console unbounded), but the visible console shows only the last 3 while the buffer retains 25 — a minor mismatch (users can't see entries 4–25 in the list). Cosmetic.

---

### WC-14-14 `crypto.randomUUID` requires a secure context (Info · none · CONFIRMED · S1/S4)

**Evidence** — `src/Core/editor-application.ts:8`: `function newId(prefix: string): string { return `${prefix}-${crypto.randomUUID()}`; }`.
**Expected vs Actual:** Dev runs on `http://127.0.0.1:1420` (Vite, `package.json:7`) and production on Tauri's `tauri://` scheme; both are secure contexts, so `crypto.randomUUID` is available. (Only a `file://` static-open path would be insecure, and that is not a supported deployment path.) Uniqueness guarantee is UUID-v4 probabilistic; `validScopedWidgetIds`/`validGlobalGeometryUpdates` already guard against accidental id collisions (`editor-application.ts:44-57`). Confirmed-safe.

---

### WC-14-15 Duplicate ×50 scenes/themes grows the tree unbounded (no limit); render recursion depth is fixed (Low · scalability · CONFIRMED · S4)

**Evidence:**
- `duplicateScene`/`duplicateRotation`/`duplicateThemeProject` (`editor-application.ts:92-116`) recursively clone and re-id every descendant with `newId`; `duplicateSelection` (`:267-305`) walks the tree and duplicates any matching scene/rotation/theme id. No count/limit check anywhere.
- Tree rendering recursion is depth-bounded by the fixed domain depth (project → group → theme → rotation → scene → widget) — `src/App/App.tsx:426-444` with `paddingLeft: ${10 + depth * 15}px`; no infinite recursion.

**Expected vs Actual:** 50 duplicates produce 50 sibling scenes/themes (width growth), each with unique ids; undo/redo restores exactly. No crash and no stack overflow, but there is no cap on sibling count, and `renderTreeNode` re-renders the whole subtree per render (see WC-14-16). Confirmed-safe with a scalability caveat.

---

### WC-14-16 Per-pointermove full re-render + O(n) snap per move + O(n) marquee per commit (Medium · scalability · CONFIRMED · S4/S8)

**Evidence (algorithmic, not runtime-measured):**
- Every pointermove during drag/resize calls `setGeometryPreview(updates)` (`App.tsx:658`) → a full `App` re-render, reconciling `canvasWidgets.map(renderCanvasWidget)` (`App.tsx:974`) — each selected single widget renders 8 resize handles (`:774-775`). For 500 widgets this is O(widgets) reconciliation per frame.
- Snap loops over every other widget per pointermove — `src/App/canvas-interaction.ts:311-331` (the `for (const other of others)` inner loop), invoked from `:645`/`:651`.
- Marquee commit is O(n) once at pointerup (`:668`), not per move; per-move marquee only updates rect state (`:632`).
- `hitTest` O(n log n) sort (`canvas-interaction.ts:284-290`) is **unused** (see WC-14-01), so it contributes nothing at runtime.

**Expected vs Actual:** Per-move cost is dominated by the O(n) snap + O(n) React reconciliation per frame; marquee selection is correctly O(n) only at commit. For 500 widgets this is the primary drag-scale concern. No correctness defect.

**Recommended fix (design-level):** Memoize the widget layer (e.g. `React.memo` per widget with a geometry-only selector), and consider a spatial index for snap/hit candidates at high widget counts.

---

## Invariant check table

Legend: ✅ invariant holds; ⚠️ degraded but not corrupt; ✳️ not applicable / not exercised.

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 duplicate ×5 | ✅ (5 copies added) | ⚠️ stays on original (root cause) | ✅ | ✅ (5 entries) | ✅ (dirty) | ✅ unchanged | ✅ | ⚠️ same overlap node shown | ⚠️ still original's props |
| S2 nudge ×20 / undo ×20 | ✅ exact | ✅ | ✅ | ⚠️ 20 granular entries | ✅ flips correctly | ✅ | ✅ | ✅ | ✅ |
| S3 undo/redo ×100 | ✅ byte-exact | ✅ | ✅ | ✅ deterministic | ✅ no drift | ✅ | ✅ | ✅ | ✅ |
| S4 duplicate 50 scenes | ✅ 50 added, unique ids | ✅ unchanged | ✅ | ✅ | ✅ | ✅ unchanged | ✳️ | ✅ | ✅ |
| S5 rapid tab switch mid-drag | ✅ unchanged (abort) | ✅ | ✅ cleared | ✅ unchanged | ✅ | ✅ | ✅ (switches) | ✅ | ✅ |
| S6 repeated splitter pointercancel | ✅ unchanged | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ panel width jitters (leaked listeners) | ✅ |
| S7 rapid New Project while dirty | ✅ reset to empty | ✅ cleared | ✅ cleared | ✅ cleared | ⚠️ dirty work discarded silently | ✅ | ✅ reset | ✅ cleared | ✅ cleared |
| S8 1000-command history | ✅ | ✅ | ✅ | ⚠️ unbounded memory | ✅ | ✅ | ✅ | ✅ | ✅ |
| S9 geometry number inputs | ✅ | ✅ | ✅ | ⚠️ one command per keystroke/tick | ✅ | ✅ | ✅ | ✅ | ✅ |
| S10 StrictMode dev double-mount | ✅ (both stores equal) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

No scenario produced cross-document leakage, cross-Scene leakage, or wrong-Scene mutation: every mutation is scoped through `setWidgetGeometriesInScene`/`duplicateSelectionInScene`/`deleteSelectionInScene` with `validScopedWidgetIds` guarding scene containment (`editor-application.ts:48-57`).

## Summary

- **High:** 0
- **Medium:** 6 — WC-14-01 (duplicate stacking), WC-14-02 (nudge history/`O(n·m)` churn), WC-14-03 (geometry-input command churn), WC-14-04 (splitter `pointercancel` listener leak), WC-14-08 (unbounded history memory), WC-14-16 (per-frame render/snap scale)
- **Low:** 6 — WC-14-05 (blur effect churn), WC-14-09 (write-only ref / preview lag), WC-14-10 (StrictMode throwaway store), WC-14-11 (rapid New Project discards dirty), WC-14-13 (console buffer/render mismatch), WC-14-15 (unbounded tree width)
- **Info (verified safe):** 3 — WC-14-06 (undo/redo id-stable determinism), WC-14-07 (snapshot identity correct), WC-14-12 (tab-switch cancel + close guard safe), WC-14-14 (secure-context UUID availability)

**Top findings:**
1. WC-14-01 — Duplicate re-duplicates the original each press → N pixel-identical `+10/+10` copies; copy never selected; `hitTest` is dead code and the topmost copy is the *first-created* one, not the last.
2. WC-14-02 — Arrow nudge commits one full clone+JSON-stringify command per OS key-repeat → 20 nudges = 20 Undo steps and O(n·m) cost on large projects.
3. WC-14-04 — Splitter resize leaks window `pointermove`/`pointerup` listeners because `pointercancel` is unhandled → accumulated stale closures cause panel-width jitter.
4. WC-14-08 — Unbounded undo/redo stacks retain ~2 full project clones per command → O(N×project) memory over long sessions.
