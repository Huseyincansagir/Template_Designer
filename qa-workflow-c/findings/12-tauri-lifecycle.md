# Agent 12 — Tauri Lifecycle Integration

**Repo:** `C:\Users\b1601\Template_Designer` (Windows)
**Audit mode:** Read-only static integration QA. No application code, tests, docs, or config modified. No Tauri/browser shell was run.
**Confidence legend:** `CONFIRMED` = statically proven from source; `UNVERIFIED` = requires a real Tauri/browser run (none available in this environment — never claimed as executed).

## Baseline re-verified this session

| Check | Result | Evidence |
|---|---|---|
| `npm.cmd run typecheck` | PASS | `tsc --noEmit` exit 0 |
| `npm.cmd test` | PASS | 6 files, **51/51 tests** passed |
| `npx.cmd tauri --version` | PASS | `tauri-cli 2.11.4` |
| `cargo --version` | **BLOCKED (environment)** | `cargo` not recognized — not a code defect |

Environment note: PowerShell execution policy blocks `npm`/`npm.ps1`; `& npm.cmd …` / `& npx.cmd …` work. `npm` writes its run-notices to stderr, surfacing as a `NativeCommandError` wrapper with exit code 0 — cosmetic only. `tauri:check` (`package.json:14` → `cargo check --manifest-path src-tauri/Cargo.toml`) therefore cannot run here; this is the same environment block Agent 4 recorded (`AGENT4_INTEGRATION_REGRESSION_REPORT.md:35`, `A4-001`). The rest of this report goes deeper on lifecycle integration rather than repeating it.

## Scope & scenarios traced

| # | Scenario | Shell-level path traced |
|---|---|---|
| S1 | Drag a widget → native window loses focus / is minimized | `App.tsx:748-752` window `blur` → `cancelCanvasInteraction()` (`App.tsx:550-561`) |
| S2 | Close the Tauri window with a dirty document | No `onCloseRequested`/`on_window_event` anywhere → default destroy |
| S3 | File → Save (Ctrl+S) inside Tauri | `App.tsx:243-246` → `InMemoryDocumentStore.save()` (`document-store.ts:75-78`) |
| S4 | Resize the Tauri window | `App.tsx:500-515` ResizeObserver + window `resize` → `readCanvasViewport` |
| S5 | Minimize / restore the Tauri window | Minimize → focus loss → `blur` → cancel path; restore → `focus` (no handler) |

---

## Findings

### WC-12-001 — File→Save is an in-memory no-op; there is no native persistence surface at all (HIGH · persistence mismatch + UI misleading state · CONFIRMED · S3)

**Repro steps:** Open the shell, make an edit, press Ctrl+S, then reload/relaunch or close and reopen.

**Evidence:**
- `src/App/App.tsx:243-246`
  ```ts
  const saveDocument = () => {
    documentStore.save();
    logAction("Project saved", "EVENT");
  };
  ```
- `src/Core/document-store.ts:75-78`
  ```ts
  save(): void {
    this.savedProject = this.currentProject;
    this.refreshSnapshot();
  }
  ```
- `src/App/App.tsx:781` — `{ label: "Open Project", disabled: true },`
- `src-tauri/src/lib.rs:10-13` — builder has only an `invoke_handler`; **no** `.plugin(tauri_plugin_fs/…)`, dialog, store, or updater:
  ```rust
  tauri::Builder::default()
      .invoke_handler(tauri::generate_handler![app_version])
      .run(tauri::generate_context!())
  ```
- Grep across `src/` for `@tauri-apps`, `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `invoke` → **zero matches** in application code.

**Expected vs Actual:** `save()` only reassigns the in-memory `savedProject` baseline and flips `isDirty` to false. Nothing is written to disk — no fs/dialog plugin, no browser storage, no `invoke` bridge. The menu (Ctrl+S), the header chip `Saved` (`App.tsx:963`), and the console `Project saved` log all present a persistence event that does not exist.

**Recommended fix (design-level):** Introduce a platform-neutral `ProjectPersistence` adapter (matching the existing `UI → Application Service → Platform Adapter` rule in `AGENTS.md`), then wire File→Save/Open through it behind the Tauri `fs`+`dialog` plugins (or browser `download`/`FileSystemAccess` during localhost dev). Until then, relabel the action (e.g. "Mark Saved") or disable it.

---

### WC-12-002 — Closing the Tauri window silently destroys all unsaved edits (HIGH · dirty-state corruption / silent data loss + persistence mismatch · CONFIRMED · S2)

**Repro steps:** Make edits so the header shows `Unsaved changes`, then close the native window.

**Evidence:**
- Grep `getCurrentWindow|onCloseRequested|preventClose|CloseRequested|on_window_event` across the whole repo → **no matches** in `src/` or `src-tauri/`.
- `src-tauri/src/lib.rs:10-13` registers no window event handler and no close-request interception.
- `src/App/App.tsx:963`
  ```tsx
  <span className={`mode-chip ${documentSnapshot.isDirty ? "is-dirty" : "is-clean"}`}>{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}</span>
  ```
- `src/Core/document-store.ts:30-35` — the entire document lives in a JS heap object (`private currentProject` / `savedProject`), so process teardown is total loss.

**Expected vs Actual:** A desktop editor should intercept `onCloseRequested` and either prompt to save/discard/cancel, or persist automatically. Here the "Unsaved changes" chip (`App.tsx:963`) and the footer `dirty` indicator (`App.tsx:986`) describe **only the in-memory baseline**; they are destroyed the instant the window closes. This is a persistence mismatch, not just a missing feature: the UI actively asserts a dirty-state that the shell does nothing to protect.

**Recommended fix (design-level):** Add `tauri::Builder::on_window_event` handling `WindowEvent::CloseRequested` that consults the store's `isDirty` (via an `invoke` command) and calls `api.preventClose()` until the user resolves the prompt; combine with the persistence adapter from WC-12-001 so "Save" is a real operation before close-interception can be meaningful.

---

### WC-12-003 — "Build & Verify Package" produces a verified package in memory, but no DeploymentManager / SD-card adapter is wired and there is no deploy UI (MEDIUM · UI misleading state + command mismatch · CONFIRMED · n/a)

**Repro steps:** Run Project → Build & Verify Package on a valid project; observe `Verified package` status, then try to deploy.

**Evidence:**
- `src/App/App.tsx:322-343` — `buildAndVerifyPackage` calls `buildDeploymentPackage` + `verifyDeploymentPackage` directly and sets `Verified package`:
  ```ts
  const built = await buildDeploymentPackage(project, activeProfile);
  const verified = await verifyDeploymentPackage(built);
  setDeploymentStatus(verified.verified ? "Verified package" : "Blocked · integrity failed");
  ```
- `src/App/App.tsx:799-800` — menu `Build & Verify Package`; `App.tsx:939` console scope `Package: {deploymentStatus}`; `App.tsx:986` footer `{deploymentStatus} · … · Browser core · Tauri shell reserved`.
- `src/main.tsx:8-13` wires **only** `profileRegistry → App`; no `DeploymentManager` is constructed.
- `src/Core/application.ts:44-51` `UnsupportedDeploymentManager` and `:53-77` `PackageDeploymentManager` are defined but **never imported by any `src/` runtime module** (only `tests/domain-runtime.test.ts:179` exercises `PackageDeploymentManager`).
- `src/Infrastructure/sd-card-target.ts:11-16`
  ```ts
  async deploy(_packageFile: DeploymentPackage): Promise<void> {
    throw new ApplicationError(
      "SD-card deployment is reserved for a later phase.",
      "SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED",
    );
  }
  ```
  — `SDCardTarget` is also never imported by any `src/` runtime module.

**Expected vs Actual:** The build/verify path is real *in memory* (a `DeploymentPackage` with `verified:true` is produced and checksummed), but there is **no adapter or UI to select an SD card, write, verify, or eject** (`AGENTS.md` V1 workflow steps "Select SD Card → Write → Verify → Safe Eject" are absent). The `Verified package` status + `Package: …` console scope + "Build & Verify Package" menu item are therefore **partially misleading**: they present a "ready" package with no downstream transport. This is a *known phase boundary* (SD-card is explicitly reserved per `docs/ARCHITECTURE.md:64` `[V1 active]` vs `sd-card-target.ts`), but the UI wording overstates readiness.

**Recommended fix (design-level):** Route the UI through `PackageDeploymentManager` + `SDCardTarget` (even if the adapter keeps throwing `SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED`), and relabel the completion state to "Package built (deployment transport pending)" instead of a bare "Verified package" until a real SD adapter exists. Keep the verify-before-deploy ordering already present in `PackageDeploymentManager.deploy`.

---

### WC-12-004 — The Tauri shell has a single `app_version` command that the frontend never calls; the entire JS↔Rust boundary is dead (LOW · command mismatch · CONFIRMED · n/a)

**Evidence:**
- `src-tauri/src/lib.rs:3-6`
  ```rust
  #[tauri::command]
  fn app_version() -> &'static str {
      env!("CARGO_PKG_VERSION")
  }
  ```
  and `:11` `.invoke_handler(tauri::generate_handler![app_version])`.
- Grep `invoke\(|@tauri-apps` across `src/` → **zero matches**. `package.json:17` lists `@tauri-apps/api` as a dependency, but it is never imported.

**Expected vs Actual:** One native command exists but no `invoke("app_version")` or `@tauri-apps/api` call exercises it, so no Host↔Client round trip is proven. This is not a crash bug, but it means the shell is currently a pure webview host with an unreachable command surface — the risk is that the first real `invoke` wiring is unvalidated.

**Recommended fix (design-level):** Either delete the unused command or wire it to a visible surface (e.g. an About/version readout) so the Tauri IPC path is exercised before File/SD-card commands are built on top of it.

---

### WC-12-005 — `devUrl` host (`localhost`) disagrees with the Vite bind host (`127.0.0.1`) (LOW · command mismatch / environment · CONFIRMED (config) · UNVERIFIED (runtime failure) · n/a)

**Evidence:**
- `src-tauri/tauri.conf.json:7-8`
  ```json
  "beforeDevCommand": "npm run dev",
  "devUrl": "http://localhost:1420",
  ```
- `vite.config.ts:6-10`
  ```ts
  server: { host: "127.0.0.1", port: 1420, strictPort: true },
  ```
- `package.json:7` — `"dev": "vite --host 127.0.0.1 --port 1420"`.

**Expected vs Actual:** Vite binds IPv4 loopback only (`127.0.0.1`), while `devUrl` uses the hostname `localhost`. On Windows `localhost` can resolve to `::1` before `127.0.0.1`; WebView2 generally falls back (Happy-Eyeballs), so `tauri dev` usually still loads — but this is a known flakiness source and a real config inconsistency. Ports match (`1420` both sides, `strictPort` guards the port).

**Recommended fix (design-level):** Change `devUrl` to `http://127.0.0.1:1420` to match the explicit bind host, eliminating the IPv6-resolution ambiguity.

---

### WC-12-006 — `csp: null` and `bundle.active: false`: no CSP and no installer output (LOW · config/security note · CONFIRMED · n/a)

**Evidence:**
- `src-tauri/tauri.conf.json:23-29`
  ```json
  "security": { "csp": null },
  "bundle": { "active": false }
  ```
- `package.json:13` — `"tauri:build": "tauri build"`.

**Expected vs Actual:** `csp: null` injects no Content-Security-Policy into the webview; Tauri emits a security warning for this. With `bundle.active: false`, `tauri build` compiles the binary but **does not generate installers** (NSIS/MSI), so the app cannot currently ship as an installer. Both are consistent with a Phase-0 shell but must be revisited for release.

**Recommended fix (design-level):** Before packaging, set a restrictive CSP (the app uses no remote resources) and set `bundle.active: true` with a Windows bundle target; keep `csp` non-null even in dev to surface violations early.

---

### WC-12-007 — Splitter drag (left/right panels) has no blur/pointercancel cancellation, unlike the canvas (LOW · stale state / UI misleading · CONFIRMED (gap) · UNVERIFIED (runtime) · S1-adjacent)

**Evidence:**
- `src/App/App.tsx:364-381`
  ```ts
  const beginResize = (side, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    const move = (moveEvent: PointerEvent) => { … setLeftWidth(nextWidth) … };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      …
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };
  ```
- Contrast: the canvas path has `onPointerCancel`/`onLostPointerCapture` (`App.tsx:974`) and a window `blur` cancel (`App.tsx:748-752`).

**Expected vs Actual:** `stop` is bound only to `pointerup`. If the native window loses focus mid-splitter-drag (alt-tab) the `pointerup` is lost, the listeners remain attached, and `move` (which never checks a button state) keeps resizing the panel on subsequent mouse movement until the next `pointerup`. The canvas already models the correct mitigation; the splitter does not.

**Recommended fix (design-level):** Give the splitter the same cancellation surface as the canvas — a window `blur`/`pointercancel` handler that removes both listeners (and optionally `setPointerCapture` so `lostpointercapture` is available).

---

### WC-12-008 — Window-blur effect (748-752) has no dependency array: re-registers every render, and the "fresh closure" is what makes it correct (LOW · stale state (avoided) / performance churn · CONFIRMED · S1)

**Evidence:**
- `src/App/App.tsx:748-752`
  ```ts
  useEffect(() => {
    const cancelOnBlur = () => cancelCanvasInteraction();
    window.addEventListener("blur", cancelOnBlur);
    return () => window.removeEventListener("blur", cancelOnBlur);
  });
  ```

**Expected vs Actual:** Because there is no dependency array, the effect tears down and re-adds the `blur` listener on **every** render (including every pointermove during a drag, since `setGeometryPreview` updates state). This is leak-free — the cleanup runs each cycle — but it is churn. The missing dep array is also load-bearing: `cancelCanvasInteraction` is re-created each render and reads the latest `canvasPointer`; a `[]` dep array would capture the initial `{ mode: "idle" }` closure and silently stop cancelling. So the current code is *correct but wasteful*; the correctness relies on an implicit re-subscription contract.

**Recommended fix (design-level):** Keep the cancel logic reading a ref (`canvasPointerRef`), and register the blur listener once with `[]`; alternatively extract `cancelCanvasInteraction` to a `useCallback`-free ref-stable function and add the dep array.

---

### WC-12-009 — React StrictMode double-invocation: dev-vs-prod behavioral difference; dev double-instantiates the in-memory store (harmless) (INFO · no observed divergence · CONFIRMED (structure) · UNVERIFIED (observable effect) · n/a)

**Evidence:**
- `src/main.tsx:10-13`
  ```tsx
  <StrictMode>
    <App profileRegistry={profileRegistry} />
  </StrictMode>
  ```
- `src/App/App.tsx:139-143`
  ```ts
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore();
    store.open(createEmptyProject());
    return store;
  }, []);
  ```
- `src/App/App.tsx:760-763` mount-cleanup effect clears `geometryOverridesRef` once.

**Expected vs Actual:** In dev (including `tauri dev`, whose `beforeDevCommand` runs the Vite dev server into the Tauri webview), StrictMode double-invokes render and mount/unmount effects. The `useMemo` factory therefore runs twice and two `InMemoryDocumentStore` instances are created (each pre-opening an empty `createEmptyProject()`), with one discarded. The discarded store pre-populates nothing user-visible (both start empty and in-memory), and effect `760`'s cleanup only clears an already-empty ref — so no leak or divergence is expected. In the production build StrictMode's double-invoke is disabled, so this is a dev-only difference. The blur effect (`748`) and the resize effect (`500`) both have correct cleanups, so no double-subscription leak was found.

**Recommended fix (design-level):** None required for correctness; keep the store creation pure/idempotent (as it is) so the dev double-run stays harmless, and consider hoisting the store creation out of the component if the double-instantiation cost ever matters.

---

### WC-12-010 — Keyboard platform detection maps macOS to `metaKey` (Cmd); Windows is correct, mac/Linux are out of V1 scope (INFO · design note · CONFIRMED (static) · UNVERIFIED (mac/linux build) · n/a)

**Evidence:**
- `src/App/canvas-interaction.ts:84-93`
  ```ts
  export function detectKeyboardPlatform(platformHint?: string): KeyboardPlatform {
    const value = platformHint ?? (typeof navigator === "undefined" ? "" : `${navigator.platform} ${navigator.userAgent}`);
    if (/mac|iphone|ipad|ipod/i.test(value)) return "mac";
    if (/win/i.test(value)) return "windows";
    return "linux";
  }
  export function isCanonicalModifier(event, platform = detectKeyboardPlatform()): boolean {
    return platform === "mac" ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  }
  ```

**Expected vs Actual:** In the Windows Tauri webview (WebView2), `navigator.platform` is `Win32` and `userAgent` contains `Windows NT` → `windows` → Ctrl modifier, which matches the Ctrl+N/Ctrl+S shortcuts in `App.tsx:780-782`. On macOS/Linux (not V1 targets per `AGENTS.md`) it selects `metaKey`, and a Linux build with `navigator.platform` "Linux x86_64" would fall through to `windows`-style Ctrl. These are acceptable given the Windows-only product boundary, but worth noting if a macOS build is ever produced (Cmd vs Ctrl preference).

**Recommended fix (design-level):** No action for V1. If cross-platform builds are planned, make the platform hint injectable and assert on it in a unit test rather than relying on `navigator` in the webview.

---

### WC-12-011 — Window `minWidth: 1000` / `minHeight: 650` are adequate for the layout minimums (INFO · design note · CONFIRMED · S4)

**Evidence:**
- `src-tauri/tauri.conf.json:18-19` — `"minWidth": 1000, "minHeight": 650`.
- `src/App/App.tsx:149-150` — `leftWidth` default 286, `rightWidth` default 298; `:370` splitter clamp `Math.min(420, Math.max(220, startWidth + …))`.

**Expected vs Actual:** Both docked panels plus splitters occupy `286 + 298 + 5 + 5 = 594px` at default; at `minWidth 1000` the canvas keeps ~406px. Worst case (both panels dragged to the 420 clamp) panels+splitters = 850px, leaving 150px canvas at minimum width. The canvas column is `minmax(0, 1fr)` (`App.tsx:215`), so it degrades without overflow. Height: 650 minus header/toolbar/console (~156px console row) leaves a usable canvas. No overflow or overlap is expected at the stated minimums.

**Recommended fix (design-level):** None. (If the console is made always-docked later, re-check the 650px minimum.)

---

### WC-12-012 — `tauri:check` cannot run: `cargo` is not installed (INFO · environment evidence · CONFIRMED · n/a)

**Evidence:**
- `cargo --version` → `The term 'cargo' is not recognized …` (CommandNotFoundException).
- `package.json:14` — `"tauri:check": "cargo check --manifest-path src-tauri/Cargo.toml"`.

**Expected vs Actual:** The Rust compile check is blocked by the missing toolchain, identical to Agent 4's `A4-001` (`AGENT4_INTEGRATION_REGRESSION_REPORT.md:35`). This is environment evidence, **not a code bug** — the script itself resolves correctly.

**Recommended fix (design-level):** Run `npm.cmd run tauri:check` on a machine with Rust/Cargo installed before release; it is a verification step, not a code change.

---

## Invariant check table

Legend: ✓ holds · ✗ violated · ⚠ misleading/non-canonical · — not applicable (state destroyed).

| Scenario | Document | Selection | Canvas preview | History | Dirty state | Active Scene | Active document | Explorer selection | Properties selection |
|---|---|---|---|---|---|---|---|---|---|
| S1 drag → window blur | ✓ unchanged | ✓ unchanged | ✓ cleared (revert) | ✓ no commit | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged |
| S2 close w/ dirty doc | ✗ destroyed | ✗ destroyed | — destroyed | ✗ destroyed | ✗ silent loss (no prompt) | ✗ destroyed | ✗ destroyed | ✗ destroyed | ✗ destroyed |
| S3 Save in Tauri | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged (save does not clear history) | ⚠ flips to clean — in-memory only | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged |
| S4 Tauri resize | ✓ unchanged | ✓ unchanged | ✓ frame recomputed (live DOM) | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged |
| S5 minimize / restore | ✓ unchanged | ✓ unchanged | ✓ drag cancelled on blur | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged | ✓ unchanged |

Notes:
- S1/S5: `cancelCanvasInteraction()` (`App.tsx:550-561`) releases pointer capture, restores pan on panning, clears `geometryOverrides`/snap guides, resets pointer to idle, and suppresses the click — it never mutates the document, selection, or history, so a cancelled drag commits nothing.
- S2: no `onCloseRequested`/`on_window_event` exists (`grep` zero hits), and the store is heap-only, so every invariant column is destroyed with the process.
- S3: `save()` (`document-store.ts:75-78`) is baseline-only; it re-marks clean without persisting, and it deliberately does not clear history (undo still available) — consistent with the in-memory semantics but misleading as a "save".
- S4: drag move handlers call `toCanvasPoint` → `readCanvasViewport()` (`App.tsx:494-498`) against the live DOM rect, so a resize mid-session re-reads geometry rather than using stale `canvasViewportSize` state.

## Summary (counts by severity)

| Severity | Count | IDs |
|---|---|---|
| HIGH | 2 | WC-12-001, WC-12-002 |
| MEDIUM | 1 | WC-12-003 |
| LOW | 5 | WC-12-004, WC-12-005, WC-12-006, WC-12-007, WC-12-008 |
| INFO | 4 | WC-12-009, WC-12-010, WC-12-011, WC-12-012 |

**Top findings one-liners:**
- **WC-12-001 (HIGH):** Save/Open are entirely in-memory — no dialog/fs plugin, no storage, no `invoke` — so "Save" and "Saved" are UI fiction.
- **WC-12-002 (HIGH):** No `onCloseRequested` anywhere, so closing the Tauri window silently destroys all unsaved edits despite the "Unsaved changes" chip.
- **WC-12-003 (MEDIUM):** "Build & Verify Package" yields a real in-memory "Verified package" but no `DeploymentManager`/`SDCardTarget` is wired and there is no deploy UI — readiness is overstated.
- **WC-12-007/008 (LOW):** The canvas blur-cancel path is correct (and its missing dep array is load-bearing), but the panel splitter drag has no blur/pointercancel cancellation and can keep resizing after a lost pointerup.
