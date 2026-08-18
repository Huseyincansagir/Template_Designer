import { useMemo, useState, type ReactNode } from "react";
import { createEmptyProject } from "../Domain/factories";
import { validateProject } from "../Core/validation";
import type { Project, ThemeProject, ThemeProjectGroup } from "../Domain/models";

type PanelId = "explorer" | "properties" | "console";
type ViewMode = "design" | "preview";
type CanvasTool = "select" | "pan";
type MenuKey = "File" | "Edit" | "View" | "Project" | "Theme" | "Scene" | "Widget" | "Tools";
type SelectionKind = "project" | "theme-group" | "theme" | "rotation" | "scene" | "widget" | "canvas";

type Selection = {
  id: string;
  label: string;
  kind: SelectionKind;
  detail?: string;
};

type TreeNode = {
  id: string;
  label: string;
  kind: string;
  detail?: string;
  disabled?: boolean;
  children?: TreeNode[];
};

type MenuItem = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
};

const menuKeys: MenuKey[] = ["File", "Edit", "View", "Project", "Theme", "Scene", "Widget", "Tools"];

function getThemeNodes(group: ThemeProjectGroup): TreeNode[] {
  return group.themeProjects.map((theme: ThemeProject) => ({
    id: theme.id,
    label: theme.name,
    kind: "Theme Project",
    children: theme.rotations.map((rotation) => ({
      id: rotation.id,
      label: `R${rotation.angle}`,
      kind: "Rotation / Form",
      detail: `${rotation.width} × ${rotation.height}`,
      children: rotation.scenes.map((scene) => ({
        id: scene.id,
        label: scene.name,
        kind: "Scene",
        detail: `Priority ${scene.priority}`,
        children: scene.widgets.map((widget) => ({
          id: widget.id,
          label: widget.name,
          kind: widget.widgetType,
          detail: widget.locked ? "Locked" : widget.visible ? "Visible" : "Hidden",
        })),
      })),
    })),
  }));
}

function PropertyRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="property-row">
      <span>{label}</span>
      <strong className={muted ? "property-muted" : undefined}>{value}</strong>
    </div>
  );
}

export function App() {
  const [project, setProject] = useState<Project>(() => createEmptyProject());
  const [panels, setPanels] = useState<Record<PanelId, boolean>>({ explorer: true, properties: true, console: true });
  const [menuOpen, setMenuOpen] = useState<MenuKey | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [consoleTab, setConsoleTab] = useState<"console" | "validation">("console");
  const [lastAction, setLastAction] = useState("Foundation shell initialized");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    project: true,
    "theme-group": true,
  });

  const validation = useMemo(() => validateProject(project), [project]);
  const group = project.themeProjectGroups[0];
  const themeNodes = group ? getThemeNodes(group) : [];
  const hasThemeProject = themeNodes.length > 0;
  const activeDocumentLabel = hasThemeProject ? themeNodes[0].label : "Project Overview";
  const activeSelectionLabel = selection?.label ?? "Nothing selected";

  const updateAction = (message: string) => {
    setLastAction(message);
    setMenuOpen(null);
  };

  const createProject = () => {
    setProject(createEmptyProject("Untitled Project"));
    setSelection(null);
    setViewMode("design");
    setLastAction("New project created in foundation state");
  };

  const togglePanel = (panel: PanelId) => {
    setPanels((current) => ({ ...current, [panel]: !current[panel] }));
    setLastAction(`${panel[0].toUpperCase()}${panel.slice(1)} panel toggled`);
    setMenuOpen(null);
  };

  const resetLayout = () => {
    setPanels({ explorer: true, properties: true, console: true });
    setLastAction("Workspace layout reset");
    setMenuOpen(null);
  };

  const selectNode = (node: TreeNode) => {
    if (node.disabled) return;
    const normalizedKind = node.kind.toLowerCase();
    const kind: SelectionKind = normalizedKind.includes("theme project")
      ? "theme"
      : normalizedKind.includes("theme group")
        ? "theme-group"
        : normalizedKind.includes("rotation")
          ? "rotation"
          : normalizedKind === "scene"
            ? "scene"
            : normalizedKind === "project"
              ? "project"
              : normalizedKind === "widget" || normalizedKind === "media" || normalizedKind === "digit" || normalizedKind === "direction" || normalizedKind === "warning" || normalizedKind === "text"
                ? "widget"
                : "canvas";
    setSelection({ id: node.id, label: node.label, kind, detail: node.detail });
    setLastAction(`${node.kind} selected: ${node.label}`);
  };

  const toggleExpanded = (nodeId: string) => {
    setExpandedNodes((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  };

  const renderTreeNode = (node: TreeNode, depth = 0): ReactNode => {
    const expanded = expandedNodes[node.id] ?? depth < 2;
    const isSelected = selection?.id === node.id;
    return (
      <li key={node.id} className={`tree-node ${node.disabled ? "is-disabled" : ""}`}>
        <div className={`tree-row ${isSelected ? "is-selected" : ""}`} style={{ paddingLeft: `${10 + depth * 15}px` }}>
          {node.children && node.children.length > 0 ? (
            <button
              type="button"
              className="tree-expander"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
              aria-expanded={expanded}
              onClick={() => toggleExpanded(node.id)}
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : <span className="tree-expander-placeholder" />}
          <button type="button" className="tree-label" onClick={() => selectNode(node)} disabled={node.disabled}>
            <span className="tree-icon">{node.kind === "Scene" ? "◈" : node.kind === "Widget" ? "◇" : node.kind === "Rotation / Form" ? "▧" : node.kind === "Project" ? "▣" : "▱"}</span>
            <span className="tree-copy">
              <strong>{node.label}</strong>
              {node.detail && <small>{node.detail}</small>}
            </span>
          </button>
        </div>
        {expanded && node.children && node.children.length > 0 && <ul className="tree-children">{node.children.map((child) => renderTreeNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  const projectTree: TreeNode = {
    id: "project",
    label: project.name,
    kind: "Project",
    detail: `Schema v${project.schemaVersion}`,
    children: [
      {
        id: "theme-group",
        label: group?.name ?? "Theme Project Group",
        kind: "Theme Project Group",
        detail: hasThemeProject ? `${themeNodes.length} theme` : "No Theme Project",
        children: themeNodes.length > 0 ? themeNodes : [{ id: "theme-empty", label: "Theme Project", kind: "Theme Project", detail: "Not created", disabled: true }],
      },
      { id: "resources", label: "Resources", kind: "Resources", detail: `${project.assets.length} assets` },
      { id: "unsupported", label: "Unsupported Files", kind: "Unsupported Files", detail: "Empty" },
    ],
  };

  const menuItems: Record<MenuKey, MenuItem[]> = {
    File: [
      { label: "New Project", shortcut: "Ctrl+N", onClick: createProject },
      { label: "Open Project", disabled: true },
      { label: "Save", shortcut: "Ctrl+S", disabled: true },
    ],
    Edit: [
      { label: "Undo", shortcut: "Ctrl+Z", disabled: true },
      { label: "Redo", shortcut: "Ctrl+Y", disabled: true },
      { label: "Reset Layout", onClick: resetLayout },
    ],
    View: [
      { label: "Project Explorer", onClick: () => togglePanel("explorer") },
      { label: "Properties", onClick: () => togglePanel("properties") },
      { label: "Console / Output", onClick: () => togglePanel("console") },
      { label: "Reset Layout", onClick: resetLayout },
    ],
    Project: [
      { label: "Project Settings", disabled: true },
      { label: "Validate Project", onClick: () => updateAction("Foundation validation completed") },
    ],
    Theme: [
      { label: "Theme Defaults", disabled: true },
      { label: "Create Theme Project as Inverted", disabled: true },
    ],
    Scene: [
      { label: "Add Scene", disabled: true },
      { label: "Test Scene", disabled: true },
    ],
    Widget: [
      { label: "Add Widget", disabled: true },
      { label: "Binding Editor", disabled: true },
    ],
    Tools: [
      { label: "Command Palette", disabled: true },
      { label: "Diagnostics", onClick: () => togglePanel("console") },
    ],
  };

  const panelColumns = `${panels.explorer ? "286px" : "0px"} minmax(0, 1fr) ${panels.properties ? "298px" : "0px"}`;
  const workspaceRows = panels.console ? "minmax(0, 1fr) 156px" : "minmax(0, 1fr) 0px";

  return (
    <div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)}>
      <header className="application-bar">
        <div className="brand-block">
          <span className="brand-mark">TD</span>
          <div>
            <strong>Template Designer</strong>
            <span className="muted">Design Studio · Foundation</span>
          </div>
        </div>
        <nav className="menu-bar" aria-label="Application menu">
          {menuKeys.map((menu) => (
            <div key={menu} className="menu-item-wrap">
              <button
                type="button"
                className={`menu-button ${menuOpen === menu ? "is-open" : ""}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((current) => current === menu ? null : menu);
                }}
              >
                {menu}
              </button>
              {menuOpen === menu && (
                <div className="menu-popover" onClick={(event) => event.stopPropagation()}>
                  {menuItems[menu].map((item) => (
                    <button key={item.label} type="button" className="menu-command" disabled={item.disabled} onClick={item.onClick}>
                      <span>{item.label}</span>
                      {item.shortcut && <kbd>{item.shortcut}</kbd>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="topbar-actions">
          <span className="mode-chip"><span className="live-dot" /> {viewMode === "design" ? "Design Mode" : "Preview Mode"}</span>
          <button type="button" className="toolbar-button primary" onClick={createProject}>New Project</button>
          <button type="button" className="toolbar-button" disabled title="Command history is a later foundation phase">Undo</button>
          <button type="button" className="toolbar-button" disabled title="Command history is a later foundation phase">Redo</button>
        </div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Open documents">
        <button type="button" className="document-tab active" role="tab" aria-selected="true" onClick={() => setLastAction(`${activeDocumentLabel} document active`)}>
          <span className="document-tab-icon">▧</span>
          <span>{activeDocumentLabel}</span>
          <span className="dirty-indicator" title="Foundation project has local state" />
          <span className="tab-close" aria-hidden="true">×</span>
        </button>
        <span className="document-tab-note">Theme Project / Rotation documents appear here</span>
        <div className="tab-actions">
          <button type="button" className="icon-button" title="Reset layout" onClick={resetLayout}>↺</button>
          <button type="button" className="icon-button" title="Application settings are modal and not implemented in Phase 0" disabled>⚙</button>
        </div>
      </div>

      <main className="workspace-stack" style={{ gridTemplateRows: workspaceRows }}>
        <div className="editor-workspace" style={{ gridTemplateColumns: panelColumns }}>
          {panels.explorer && (
            <aside className="tool-panel explorer-panel" aria-label="Project Explorer">
              <div className="panel-heading">
                <div><span className="panel-kicker">NAVIGATION</span><strong>Project Explorer</strong></div>
                <button type="button" className="panel-action" title="Close Project Explorer" onClick={() => togglePanel("explorer")}>×</button>
              </div>
              <div className="explorer-toolbar">
                <button type="button" className="small-action" onClick={() => setExpandedNodes({ project: true, "theme-group": true })}>Expand</button>
                <button type="button" className="small-action" onClick={() => setExpandedNodes({})}>Collapse</button>
                <span className="explorer-source">MODEL VIEW</span>
              </div>
              <div className="tree-scroll">
                <ul className="project-tree">{renderTreeNode(projectTree)}</ul>
              </div>
              <div className="panel-footnote">
                <span className="footnote-mark">i</span>
                <span>Canonical Project Model is the source of truth. Explorer is a navigation view.</span>
              </div>
            </aside>
          )}

          <section className="canvas-workspace" aria-label="Canvas editor">
            <div className="studio-toolbar">
              <div className="tool-group">
                <button type="button" className={`studio-tool ${canvasTool === "select" ? "active" : ""}`} onClick={() => setCanvasTool("select")} title="Select tool">↖ <span>Select</span></button>
                <button type="button" className={`studio-tool ${canvasTool === "pan" ? "active" : ""}`} onClick={() => setCanvasTool("pan")} title="Pan tool">✥ <span>Pan</span></button>
                <span className="tool-divider" />
                <button type="button" className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button>
                <button type="button" className={`studio-tool ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((current) => !current)} title="Toggle snap">⌁ <span>Snap</span></button>
              </div>
              <div className="tool-group">
                <button type="button" className={`mode-button ${viewMode === "design" ? "active" : ""}`} onClick={() => setViewMode("design")}>Design</button>
                <button type="button" className={`mode-button ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button>
                <span className="tool-divider" />
                <button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.max(50, current - 10))}>−</button>
                <span className="zoom-readout">{zoom}%</span>
                <button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.min(200, current + 10))}>+</button>
              </div>
            </div>
            <div className={`canvas-stage ${gridVisible ? "show-grid" : ""} ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={() => setSelection(null)}>
              <div className="canvas-rail-label">{viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}</div>
              <div className="device-canvas-wrap" style={{ transform: `scale(${zoom / 100})` }} onClick={(event) => event.stopPropagation()}>
                <div className="device-frame">
                  <div className="device-frame-header"><span>DISPLAY</span><span>R0 · 720 × 1280</span></div>
                  <div className="device-screen">
                    <div className="canvas-empty-state">
                      <span className="empty-glyph">◇</span>
                      <strong>{hasThemeProject ? "Select a Scene or Widget" : "No Theme Project"}</strong>
                      <span>{hasThemeProject ? "Choose an item from Project Explorer to edit." : "Create a Theme Project to begin canvas editing."}</span>
                    </div>
                  </div>
                  <div className="device-frame-footer"><span>ASPECT LOCKED</span><span>R0</span></div>
                </div>
              </div>
              <div className="canvas-overlay-note">Canvas shell · editor implementation follows canonical model</div>
            </div>
            <div className="canvas-context-bar">
              <div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}</div>
              <div className="context-actions">
                <button type="button" className="context-action" disabled title="Requires a selected widget">Align</button>
                <button type="button" className="context-action" disabled title="Requires a selected widget">Duplicate</button>
                <button type="button" className="context-action" disabled title="Requires a selected widget">Lock</button>
                <button type="button" className="context-action" disabled title="Requires a selected widget">Delete</button>
              </div>
            </div>
          </section>

          {panels.properties && (
            <aside className="tool-panel properties-panel" aria-label="Properties inspector">
              <div className="panel-heading">
                <div><span className="panel-kicker">INSPECTOR</span><strong>Properties</strong></div>
                <button type="button" className="panel-action" title="Close Properties" onClick={() => togglePanel("properties")}>×</button>
              </div>
              <div className="inspector-context">
                <span className={`context-icon ${selection ? "has-selection" : ""}`}>{selection ? "◇" : "□"}</span>
                <div><strong>{selection?.label ?? "Document Properties"}</strong><small>{selection?.detail ?? "Nothing selected · Project context"}</small></div>
              </div>
              {selection ? (
                <div className="properties-scroll">
                  <section className="property-section">
                    <div className="property-section-title">Identity</div>
                    <PropertyRow label="Name" value={selection.label} />
                    <PropertyRow label="Type" value={selection.kind} />
                    <PropertyRow label="Stable ID" value={selection.id} muted />
                  </section>
                  <section className="property-section">
                    <div className="property-section-title">Context</div>
                    <PropertyRow label="Source" value="Canonical Project Model" />
                    <PropertyRow label="Edit state" value="Foundation view" />
                    <PropertyRow label="Validation" value="Not evaluated" muted />
                  </section>
                  {selection.kind === "widget" && <section className="property-section"><div className="property-section-title">Transform</div><PropertyRow label="Position" value="Not available" muted /><PropertyRow label="Size Lock" value="Independent" /></section>}
                </div>
              ) : (
                <div className="properties-empty">
                  <span className="empty-panel-icon">□</span>
                  <strong>Select an item to edit its properties</strong>
                  <span>Project, Theme, Rotation, Scene and Widget selections appear here contextually.</span>
                </div>
              )}
              <div className="panel-footnote"><span className="footnote-mark">i</span><span>Unsupported profile fields stay hidden. Changes flow through commands.</span></div>
            </aside>
          )}
        </div>

        {panels.console && (
          <section className="console-panel" aria-label="Console and validation">
            <div className="console-tabs">
              <button type="button" className={consoleTab === "console" ? "active" : ""} onClick={() => setConsoleTab("console")}>Console</button>
              <button type="button" className={consoleTab === "validation" ? "active" : ""} onClick={() => setConsoleTab("validation")}>Validation <span className="tab-count">{validation.issues.length}</span></button>
              <span className="console-spacer" />
              <span className="console-scope">Foundation / local project</span>
              <button type="button" className="panel-action" title="Close Console" onClick={() => togglePanel("console")}>×</button>
            </div>
            <div className="console-body">
              {consoleTab === "console" ? (
                <><span className="console-time">NOW</span><span className="console-info">{lastAction}</span><span className="console-muted">Command and runtime traces will appear here when the editor commands are implemented.</span></>
              ) : (
                <><span className={`validation-dot ${validation.valid ? "ok" : "error"}`} /> <span className="console-info">{validation.valid ? "No blocking foundation issues" : `${validation.issues.length} validation issue(s)`}</span><span className="console-muted">Publish readiness is not evaluated by the Phase 0 foundation.</span></>
              )}
            </div>
          </section>
        )}
      </main>

      <footer className="statusbar">
        <span><span className="status-led" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span>
        <span>Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span>
        <span>Browser core · Tauri shell reserved</span>
      </footer>
    </div>
  );
}
