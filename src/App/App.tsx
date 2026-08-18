import { useMemo, useState } from "react";
import { createEmptyProject } from "../Domain/factories";
import { validateProject } from "../Core/validation";

export function App() {
  const [project, setProject] = useState(() => createEmptyProject());
  const validation = useMemo(() => validateProject(project), [project]);

  function createProject() {
    setProject(createEmptyProject("Untitled Project"));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">TD</span>
          <div>
            <strong>Template Designer</strong>
            <span className="muted">Phase 0 Foundation</span>
          </div>
        </div>
        <div className="toolbar-group" aria-label="Application actions">
          <button type="button" onClick={createProject}>New Project</button>
          <button type="button" disabled aria-disabled="true">Undo</button>
          <button type="button" disabled aria-disabled="true">Redo</button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar panel" aria-label="Project navigation">
          <div className="panel-heading">
            <span>Workspace</span>
            <span className="badge">LOCAL</span>
          </div>
          <nav className="nav-list">
            <button className="nav-item active" type="button">Project</button>
            <button className="nav-item" type="button" disabled>Scenes <span>Later</span></button>
            <button className="nav-item" type="button" disabled>Assets <span>Later</span></button>
            <button className="nav-item" type="button" disabled>Validation <span>Later</span></button>
          </nav>
          <div className="sidebar-note">
            The foundation keeps the editor, preview, validation and deployment surfaces on one canonical project model.
          </div>
        </aside>

        <section className="main-panel" aria-label="Foundation workspace">
          <div className="section-title">
            <div>
              <span className="eyebrow">DOCUMENT</span>
              <h1>{project.name}</h1>
            </div>
            <span className="status-chip success">{validation.valid ? "Ready" : "Needs attention"}</span>
          </div>
          <div className="foundation-card">
            <div className="device-preview" aria-label="Device preview placeholder">
              <div className="preview-label">DEVICE PREVIEW</div>
              <div className="preview-screen">
                <span>Canvas editor will be added in a later phase.</span>
              </div>
            </div>
            <div className="foundation-copy">
              <span className="eyebrow">APPLICATION SHELL</span>
              <h2>Ready for the canonical project model.</h2>
              <p>
                This shell intentionally contains no widget editor, simulator or deployment workflow yet. Those surfaces will consume the same domain and application-core contracts.
              </p>
              <dl className="facts">
                <div><dt>Schema</dt><dd>v{project.schemaVersion}</dd></div>
                <div><dt>Device profile</dt><dd>{project.deviceProfileId}</dd></div>
                <div><dt>Themes</dt><dd>{project.themes.length}</dd></div>
                <div><dt>Assets</dt><dd>{project.assets.length}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <aside className="inspector panel" aria-label="Project inspector">
          <div className="panel-heading">Foundation status</div>
          <div className="inspector-section">
            <span className="eyebrow">ARCHITECTURE</span>
            <div className="status-row"><span>React UI</span><strong>Browser</strong></div>
            <div className="status-row"><span>Application Core</span><strong>Independent</strong></div>
            <div className="status-row"><span>Domain</span><strong>Platform-neutral</strong></div>
            <div className="status-row"><span>Tauri</span><strong>Shell only</strong></div>
          </div>
          <div className="inspector-section">
            <span className="eyebrow">VALIDATION</span>
            <div className="validation-state"><span className="dot" />{validation.valid ? "No blocking issues" : "Blocking issues found"}</div>
            {validation.issues.length > 0 && <ul>{validation.issues.map((issue) => <li key={issue.code}>{issue.message}</li>)}</ul>}
          </div>
        </aside>
      </main>

      <footer className="statusbar">
        <span><span className="dot" /> Offline-first foundation</span>
        <span>Browser-compatible core · Tauri adapter reserved</span>
      </footer>
    </div>
  );
}
