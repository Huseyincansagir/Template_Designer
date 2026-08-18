import { useMemo, useState, type ReactNode } from "react";
import { createEmptyProject, foundationDeviceProfile } from "../Domain/factories";
import { InMemoryDocumentStore } from "../Core/document-store";
import { evaluateActiveSceneBindings, evaluateBinding, selectActiveScene } from "../Core/runtime";
import { validateProject } from "../Core/validation";
import type { Asset, Project, Rotation, Scene, ThemeProject, ThemeProjectGroup, Widget } from "../Domain/models";

type PanelId = "explorer" | "assets" | "properties" | "simulator" | "console";
type PanelMode = "docked" | "floating" | "collapsed";
type ViewMode = "design" | "preview";
type CanvasTool = "select" | "pan";
type MenuKey = "File" | "Edit" | "View" | "Project" | "Theme" | "Scene" | "Widget" | "Tools";
type SelectionKind = "project" | "theme-group" | "theme" | "rotation" | "scene" | "widget" | "asset" | "canvas";
type AssetCategory = "depot" | "resources" | "scene" | "unsupported";
type SettingsCategory = "General" | "Appearance" | "Editor" | "Canvas" | "Assets" | "Simulator" | "Validation" | "Export" | "Shortcuts";
type BindingModalState = { widgetId: string } | null;

type Selection = {
  id: string;
  label: string;
  kind: SelectionKind;
  nodeType?: string;
  detail?: string;
};

type TreeNode = {
  id: string;
  label: string;
  kind: string;
  nodeType?: string;
  detail?: string;
  disabled?: boolean;
  children?: TreeNode[];
};

type ResolvedNode = {
  kind: SelectionKind;
  node: Project | ThemeProjectGroup | ThemeProject | Rotation | Scene | Widget | Asset;
  project?: Project;
  group?: ThemeProjectGroup;
  theme?: ThemeProject;
  rotation?: Rotation;
  scene?: Scene;
  widget?: Widget;
  asset?: Asset;
};

type MenuItem = {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick?: () => void;
};

type ConsoleEntry = {
  level: "INFO" | "WARN" | "ERROR" | "EVENT";
  message: string;
};

const menuKeys: MenuKey[] = ["File", "Edit", "View", "Project", "Theme", "Scene", "Widget", "Tools"];
const settingsCategories: SettingsCategory[] = ["General", "Appearance", "Editor", "Canvas", "Assets", "Simulator", "Validation", "Export", "Shortcuts"];
const assetCategories: { id: AssetCategory; label: string }[] = [
  { id: "depot", label: "Asset Depot" },
  { id: "resources", label: "Project Resources" },
  { id: "scene", label: "Scene Content" },
  { id: "unsupported", label: "Unsupported Files" },
];

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
            nodeType: widget.widgetType,
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

function resolveCanonicalNode(project: Project, id: string): ResolvedNode | undefined {
  if (project.id === id) return { kind: "project", node: project, project };
  for (const group of project.themeProjectGroups) {
    if (group.id === id) return { kind: "theme-group", node: group, project, group };
    for (const theme of group.themeProjects) {
      if (theme.id === id) return { kind: "theme", node: theme, project, group, theme };
      for (const rotation of theme.rotations) {
        if (rotation.id === id) return { kind: "rotation", node: rotation, project, group, theme, rotation };
        for (const scene of rotation.scenes) {
          if (scene.id === id) return { kind: "scene", node: scene, project, group, theme, rotation, scene };
          const widget = scene.widgets.find((candidate) => candidate.id === id);
          if (widget) return { kind: "widget", node: widget, project, group, theme, rotation, scene, widget };
        }
      }
    }
  }
  const asset = project.assets.find((candidate) => candidate.id === id);
  return asset ? { kind: "asset", node: asset, project, asset } : undefined;
}

export function App() {
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore();
    store.open(createEmptyProject());
    return store;
  }, []);
  const [project, setProject] = useState<Project>(() => documentStore.getCurrent() ?? createEmptyProject());
  const [panelModes, setPanelModes] = useState<Record<PanelId, PanelMode>>({
    explorer: "docked",
    assets: "collapsed",
    properties: "docked",
    simulator: "collapsed",
    console: "docked",
  });
  const [leftWidth, setLeftWidth] = useState(286);
  const [rightWidth, setRightWidth] = useState(298);
  const [menuOpen, setMenuOpen] = useState<MenuKey | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [consoleTab, setConsoleTab] = useState<"console" | "validation">("console");
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    { level: "INFO", message: "Foundation shell initialized" },
  ]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({ project: true, "theme-group": true });
  const [openDocuments, setOpenDocuments] = useState<string[]>(["Project Overview"]);
  const [activeDocument, setActiveDocument] = useState("Project Overview");
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("depot");
  const [assetSearch, setAssetSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("General");
  const [settingsDraft, setSettingsDraft] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true });
  const [savedSettings, setSavedSettings] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true });
  const [bindingModal, setBindingModal] = useState<BindingModalState>(null);

  const profileRegistry = [foundationDeviceProfile];
  const activeProfile = profileRegistry.find((profile) => profile.id === project.deviceProfileId);
  const validation = useMemo(() => validateProject(project, activeProfile), [project, activeProfile]);
  const groups = project.themeProjectGroups;
  const group = groups[0];
  const themeNodes = groups.flatMap((currentGroup) => getThemeNodes(currentGroup));
  const hasThemeProject = themeNodes.length > 0;
  const activeSelectionLabel = selectedIds.length > 1 ? `${selectedIds.length} items selected` : selection?.label ?? "Nothing selected";
  const resolvedSelection = useMemo(() => selection ? resolveCanonicalNode(project, selection.id) : undefined, [project, selection]);
  const runtimeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
  const runtime = useMemo(() => selectActiveScene(runtimeRotation?.scenes ?? [], { values: {}, settings: {}, sceneActivationOrder: {} }, activeProfile ?? foundationDeviceProfile), [runtimeRotation, activeProfile]);
  const activeBindings = useMemo(() => evaluateActiveSceneBindings(runtime.activeScene, { values: {}, settings: {}, sceneActivationOrder: {} }, activeProfile ?? foundationDeviceProfile), [runtime.activeScene, activeProfile]);
  const bindingWidget = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId)?.widget : undefined;
  const profileStates = activeProfile?.runtimeStates ?? [];
  const profileSettings = activeProfile?.runtimeSettings ?? [];
  const bindingEvaluations = useMemo(() => bindingWidget ? bindingWidget.bindings.map((binding) => evaluateBinding(binding, { values: {}, settings: {}, sceneActivationOrder: {} }, activeProfile ?? foundationDeviceProfile)) : [], [bindingWidget, activeProfile]);
  const activeLeftPanel = panelModes.explorer === "docked" ? "explorer" : panelModes.assets === "docked" ? "assets" : null;
  const activeRightPanel = panelModes.properties === "docked" ? "properties" : panelModes.simulator === "docked" ? "simulator" : null;
  const leftVisible = activeLeftPanel !== null;
  const rightVisible = activeRightPanel !== null;
  const consoleVisible = panelModes.console === "docked";
  const floatingPanels = (Object.keys(panelModes) as PanelId[]).filter((panel) => panelModes[panel] === "floating");
  const workspaceRows = consoleVisible ? "minmax(0, 1fr) 156px" : "minmax(0, 1fr) 0px";
  const editorColumns = `${leftVisible ? `${leftWidth}px` : "0px"} ${leftVisible ? "5px" : "0px"} minmax(0, 1fr) ${rightVisible ? "5px" : "0px"} ${rightVisible ? `${rightWidth}px` : "0px"}`;

  const logAction = (message: string, level: ConsoleEntry["level"] = "INFO") => {
    setConsoleEntries((current) => [...current.slice(-24), { level, message }]);
    setMenuOpen(null);
  };

  const replaceProject = (nextProject: Project) => {
    documentStore.open(nextProject);
    setProject(nextProject);
  };

  const createProject = () => {
    replaceProject(createEmptyProject("Untitled Project"));
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setOpenDocuments(["Project Overview"]);
    setActiveDocument("Project Overview");
    logAction("New project created in foundation state");
  };

  const setPanelMode = (panel: PanelId, mode: PanelMode) => {
    setPanelModes((current) => ({ ...current, [panel]: mode }));
    logAction(`${panel[0].toUpperCase()}${panel.slice(1)} panel: ${mode}`);
  };

  const activatePanel = (panel: PanelId) => {
    setPanelModes((current) => {
      const next = { ...current, [panel]: "docked" as PanelMode };
      if (panel === "explorer") next.assets = "collapsed";
      if (panel === "assets") next.explorer = "collapsed";
      if (panel === "properties") next.simulator = "collapsed";
      if (panel === "simulator") next.properties = "collapsed";
      return next;
    });
    logAction(`${panel[0].toUpperCase()}${panel.slice(1)} panel docked`);
  };

  const collapsePanel = (panel: PanelId) => setPanelMode(panel, "collapsed");

  const resetLayout = () => {
    setPanelModes({ explorer: "docked", assets: "collapsed", properties: "docked", simulator: "collapsed", console: "docked" });
    setLeftWidth(286);
    setRightWidth(298);
    logAction("Workspace layout reset");
  };

  const beginResize = (side: "left" | "right", event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.min(420, Math.max(220, startWidth + (side === "left" ? delta : -delta)));
      if (side === "left") setLeftWidth(nextWidth);
      else setRightWidth(nextWidth);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      logAction(`${side === "left" ? "Explorer" : "Properties"} splitter resized`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  const openDocument = (label: string) => {
    setOpenDocuments((current) => current.includes(label) ? current : [...current, label]);
    setActiveDocument(label);
    logAction(`${label} document active`);
  };

  const closeDocument = (label: string) => {
    if (openDocuments.length <= 1) return;
    const remaining = openDocuments.filter((document) => document !== label);
    setOpenDocuments(remaining);
    if (activeDocument === label) setActiveDocument(remaining[remaining.length - 1]);
    logAction(`${label} document closed`);
  };

  const selectNode = (node: TreeNode, additive = false) => {
    if (node.disabled) return;
    const canonical = resolveCanonicalNode(project, node.id);
    const normalizedKind = node.kind.toLowerCase();
    const kind: SelectionKind = canonical?.kind ?? (normalizedKind.includes("resource") || normalizedKind.includes("unsupported") ? "asset" : "canvas");
    const nodeType = canonical?.widget?.widgetType ?? node.nodeType ?? node.kind;
    setSelection({ id: node.id, label: node.label, kind, nodeType, detail: node.detail });
    setSelectedIds((current) => additive
      ? current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id]
      : [node.id]);
    if (kind === "theme" || kind === "rotation") openDocument(node.label);
    logAction(`${node.kind} selected: ${node.label}`, "EVENT");
  };

  const clearSelection = () => {
    setSelection(null);
    setSelectedIds([]);
    logAction("Canvas selection cleared");
  };

  const toggleExpanded = (nodeId: string) => setExpandedNodes((current) => ({ ...current, [nodeId]: !current[nodeId] }));

  const renderTreeNode = (node: TreeNode, depth = 0): ReactNode => {
    const expanded = expandedNodes[node.id] ?? depth < 2;
    const isSelected = selectedIds.includes(node.id);
    const icon = node.kind === "Scene" ? "◈" : node.kind === "Widget" ? "◇" : node.kind === "Rotation / Form" ? "▧" : node.kind === "Project" ? "▣" : node.kind === "Resources" ? "▤" : "▱";
    return (
      <li key={node.id} className={`tree-node ${node.disabled ? "is-disabled" : ""}`}>
        <div className={`tree-row ${isSelected ? "is-selected" : ""}`} style={{ paddingLeft: `${10 + depth * 15}px` }}>
          {node.children && node.children.length > 0 ? (
            <button type="button" className="tree-expander" aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`} aria-expanded={expanded} onClick={() => toggleExpanded(node.id)}>{expanded ? "▾" : "▸"}</button>
          ) : <span className="tree-expander-placeholder" />}
          <button type="button" className="tree-label" onClick={(event) => selectNode(node, event.shiftKey || event.ctrlKey)} disabled={node.disabled}>
            <span className="tree-icon">{icon}</span>
            <span className="tree-copy"><strong>{node.label}</strong>{node.detail && <small>{node.detail}</small>}</span>
          </button>
        </div>
        {expanded && node.children && node.children.length > 0 && <ul className="tree-children">{node.children.map((child) => renderTreeNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  const projectTree: TreeNode = {
    id: project.id,
    label: project.name,
    kind: "Project",
    detail: `Schema v${project.schemaVersion}`,
    children: [
      ...groups.map((currentGroup) => ({
        id: currentGroup.id,
        label: currentGroup.name,
        kind: "Theme Project Group",
        detail: `${currentGroup.themeProjects.length} theme project${currentGroup.themeProjects.length === 1 ? "" : "s"}`,
        children: getThemeNodes(currentGroup),
      })),
      { id: "resources", label: "Resources", kind: "Resources", detail: `${groups.flatMap((currentGroup) => currentGroup.themeProjects.flatMap((theme) => theme.resources)).length} theme resources` },
      { id: "unsupported", label: "Unsupported Files", kind: "Unsupported Files", detail: "Not imported" },
    ],
  };

  const activeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
  const activeScene = resolvedSelection?.scene ?? runtime.activeScene ?? activeRotation?.scenes[0];
  const canvasWidgets = activeScene?.widgets ?? [];
  const displayProfile = activeProfile ?? foundationDeviceProfile;
  const canvasWidth = activeRotation?.width ?? displayProfile.display.width;
  const canvasHeight = activeRotation?.height ?? displayProfile.display.height;

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
      { label: "Project Explorer", onClick: () => activatePanel("explorer") },
      { label: "Asset Browser", onClick: () => activatePanel("assets") },
      { label: "Properties", onClick: () => activatePanel("properties") },
      { label: "Simulator", onClick: () => activatePanel("simulator") },
      { label: "Console / Output", onClick: () => activatePanel("console") },
      { label: "Reset Layout", onClick: resetLayout },
    ],
    Project: [
      { label: "Project Settings", disabled: true },
      { label: "Validate Project", onClick: () => logAction("Foundation validation completed") },
    ],
    Theme: [
      { label: "Theme Defaults", disabled: true },
      { label: "Create Theme Project as Inverted", disabled: true },
    ],
    Scene: [
      { label: "Add Scene", disabled: true },
      { label: "Test Scene", onClick: () => activatePanel("simulator") },
    ],
    Widget: [
      { label: "Add Widget", disabled: true },
      { label: "Binding Editor", disabled: !resolvedSelection?.widget, onClick: () => setBindingModal({ widgetId: resolvedSelection?.widget?.id ?? "" }) },
    ],
    Tools: [
      { label: "Command Palette", disabled: true },
      { label: "Diagnostics", onClick: () => activatePanel("console") },
      { label: "Program Settings", onClick: () => setSettingsOpen(true) },
    ],
  };

  const renderPanelHeader = (panel: PanelId, kicker: string, title: string) => (
    <div className="panel-heading">
      <div><span className="panel-kicker">{kicker}</span><strong>{title}</strong></div>
      <div className="panel-header-actions">
        <button type="button" className="panel-action" title="Float panel" onClick={() => setPanelMode(panel, "floating")}>⤢</button>
        <button type="button" className="panel-action" title="Collapse panel" onClick={() => collapsePanel(panel)}>−</button>
        <button type="button" className="panel-action" title="Close panel" onClick={() => collapsePanel(panel)}>×</button>
      </div>
    </div>
  );

  const renderDockTabs = (active: "explorer" | "assets" | "properties" | "simulator") => {
    const tabs = active === "explorer" || active === "assets" ? [["explorer", "Explorer"], ["assets", "Assets"]] : [["properties", "Properties"], ["simulator", "Simulator"]];
    return <div className="panel-dock-tabs">{tabs.map(([id, label]) => <button key={id} type="button" className={active === id ? "active" : ""} onClick={() => activatePanel(id as PanelId)}>{label}</button>)}</div>;
  };

  const renderExplorer = () => (
    <>
      {renderPanelHeader("explorer", "NAVIGATION", "Project Explorer")}
      {renderDockTabs("explorer")}
      <div className="explorer-toolbar"><button type="button" className="small-action" onClick={() => setExpandedNodes({ project: true, "theme-group": true })}>Expand</button><button type="button" className="small-action" onClick={() => setExpandedNodes({})}>Collapse</button><span className="explorer-source">MODEL VIEW</span></div>
      <div className="tree-scroll"><ul className="project-tree">{renderTreeNode(projectTree)}</ul></div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Canonical Project Model is the source of truth. Explorer is a navigation view.</span></div>
    </>
  );

  const resourceAssetIds = new Set(groups.flatMap((currentGroup) => currentGroup.themeProjects.flatMap((theme) => theme.resources)));
  const sceneAssetIds = new Set(groups.flatMap((currentGroup) => currentGroup.themeProjects.flatMap((theme) => theme.rotations.flatMap((rotation) => rotation.scenes.flatMap((scene) => scene.widgets.flatMap((widget) => widget.assetIds ?? []))))));
  const assetsForCategory = assetCategory === "resources" ? project.assets.filter((asset) => resourceAssetIds.has(asset.id)) : assetCategory === "scene" ? project.assets.filter((asset) => sceneAssetIds.has(asset.id)) : [];
  const filteredAssets = assetsForCategory.filter((asset) => asset.name.toLowerCase().includes(assetSearch.toLowerCase()) || asset.mediaType.toLowerCase().includes(assetSearch.toLowerCase()));
  const renderAssets = () => (
    <>
      {renderPanelHeader("assets", "LIBRARY", "Asset Browser")}
      {renderDockTabs("assets")}
      <div className="asset-search"><input aria-label="Search assets" placeholder="Search depot" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} /><button type="button" className="small-action" disabled title="Asset import command is a later phase">Import</button></div>
      <div className="asset-category-list">{assetCategories.map((category) => <button key={category.id} type="button" className={assetCategory === category.id ? "active" : ""} onClick={() => setAssetCategory(category.id)}><span>{category.id === "depot" ? "▱" : category.id === "resources" ? "▤" : category.id === "scene" ? "◈" : "⊘"}</span>{category.label}<small>{category.id === "depot" ? 0 : category.id === "resources" ? project.assets.filter((asset) => resourceAssetIds.has(asset.id)).length : category.id === "scene" ? project.assets.filter((asset) => sceneAssetIds.has(asset.id)).length : 0}</small></button>)}</div>
      <div className="asset-list">
        {filteredAssets.length > 0 ? filteredAssets.map((asset) => <button type="button" className="asset-row" key={asset.id} onClick={() => selectNode({ id: asset.id, label: asset.name, kind: "Asset", detail: asset.mediaType })}><span className="asset-type">{asset.mediaType === "audio" ? "♫" : asset.mediaType === "video" ? "▶" : "▧"}</span><span><strong>{asset.name}</strong><small>{asset.mediaType} · {asset.id}</small></span></button>) : <div className="asset-empty"><span className="empty-panel-icon">{assetCategory === "unsupported" ? "⊘" : "▱"}</span><strong>{assetCategory === "depot" ? "Asset Depot is empty" : assetCategory === "unsupported" ? "Unsupported Files is empty" : "No assets in this scope"}</strong><span>{assetCategory === "depot" ? "Depot library content is not Project Resources and unused depot assets are not exported." : assetCategory === "unsupported" ? "Unsupported files cannot become widgets or enter normal export." : "Project Resources and Scene Content are derived from canonical references."}</span></div>}
      </div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Asset Depot, Resources, Scene Content and Unsupported Files remain separate surfaces.</span></div>
    </>
  );

  const renderProperties = () => {
    const multi = selectedIds.length > 1;
    const node = resolvedSelection;
    const widget = node?.widget;
    const selectedCanonical = selectedIds.map((id) => resolveCanonicalNode(project, id)).filter((current): current is ResolvedNode => Boolean(current));
    const valueFor = (getter: (current: ResolvedNode) => string | number | boolean | undefined, fallback = "—") => {
      const values = selectedCanonical.map(getter).filter((value): value is string | number | boolean => value !== undefined);
      if (values.length === 0) return fallback;
      if (!multi) return String(values[0]);
      return new Set(values.map((value) => String(value))).size === 1 ? String(values[0]) : "*";
    };
    const issueCount = validation.issues.filter((issue) => Boolean(selection && issue.path?.includes(selection.id))).length;
    return (
      <>
        {renderPanelHeader("properties", "INSPECTOR", "Properties")}
        {renderDockTabs("properties")}
        <div className="inspector-context"><span className={`context-icon ${selection ? "has-selection" : ""}`}>{selection ? "◇" : "□"}</span><div><strong>{multi ? `${selectedIds.length} items selected` : selection?.label ?? "Document Properties"}</strong><small>{selection?.detail ?? "Nothing selected · Project context"}</small></div></div>
        {selection && node ? <div className="properties-scroll">
          <section className="property-section"><div className="property-section-title">Identity</div><PropertyRow label="Name" value={multi ? valueFor((current) => "name" in current.node ? String(current.node.name) : undefined) : selection.label} /><PropertyRow label="Type" value={multi ? valueFor((current) => current.widget?.widgetType ?? current.kind) : (widget?.widgetType ?? selection.nodeType ?? selection.kind)} /><PropertyRow label="Stable ID" value={multi ? valueFor((current) => String(current.node.id)) : selection.id} muted /></section>
          <section className="property-section"><div className="property-section-title">Canonical Context</div><PropertyRow label="Source" value="Canonical Project Model" /><PropertyRow label="Device Profile" value={project.deviceProfileId} muted /><PropertyRow label="Validation" value={issueCount > 0 ? `${issueCount} issue(s)` : validation.valid ? "Valid" : "Review project"} muted /></section>
          {widget && <>
            <section className="property-section"><div className="property-section-title">Widget</div><PropertyRow label="Widget Type" value={multi ? valueFor((current) => current.widget?.widgetType) : widget.widgetType} /><PropertyRow label="Visible" value={multi ? valueFor((current) => current.widget?.visible) : String(widget.visible)} /><PropertyRow label="Enabled" value={multi ? valueFor((current) => current.widget?.enabled) : String(widget.enabled)} /><PropertyRow label="Geometry Lock" value={multi ? valueFor((current) => current.widget?.locked ? "Locked" : "Editable") : widget.locked ? "Locked" : "Editable"} /></section>
            <section className="property-section"><div className="property-section-title">Geometry / Layer</div><PropertyRow label="Position" value={`${widget.geometry.x}, ${widget.geometry.y}`} muted={widget.locked} /><PropertyRow label="Size" value={`${widget.geometry.width} × ${widget.geometry.height}`} muted={widget.locked} /><PropertyRow label="Z-order" value={String(widget.zIndex)} /></section>
            <section className="property-section"><div className="property-section-title">Presentation</div><PropertyRow label="Bindings" value={String(widget.bindings.length)} /><PropertyRow label="Asset References" value={String(widget.assetIds?.length ?? 0)} /><PropertyRow label="Media Type" value={widget.mediaType ?? "None"} /><PropertyRow label="Media Slide" value={widget.mediaSlide ? "Configured" : "None"} /><button type="button" className="property-inline-action" onClick={() => setBindingModal({ widgetId: widget.id })}>Open Binding Editor</button></section>
            {widget.widgetType === "digit" && <section className="property-section"><div className="property-section-title">Digit</div><PropertyRow label="Style" value={String(widget.style?.digitStyleId ?? "Profile default / unresolved")} /><PropertyRow label="Floor Mapping" value={String(widget.content?.floorMappingId ?? "Not selected")} /></section>}
            {widget.widgetType === "direction" && <section className="property-section"><div className="property-section-title">Direction</div><PropertyRow label="Style" value={String(widget.style?.directionStyleId ?? "Profile default / unresolved")} /><PropertyRow label="Variant" value={String(widget.content?.variant ?? "Profile-defined")} /></section>}
            {widget.widgetType === "media" && <section className="property-section"><div className="property-section-title">Media</div><PropertyRow label="Visual" value={widget.mediaType ?? "Not selected"} /><PropertyRow label="Attached Audio" value={widget.audioAssetId ?? "None"} muted /></section>}
          </>}
          {node.scene && <section className="property-section"><div className="property-section-title">Scene Runtime</div><PropertyRow label="Priority" value={`${node.scene.priority} / 10`} /><PropertyRow label="Enabled" value={String(node.scene.enabled !== false)} /><PropertyRow label="Activation Conditions" value={`${node.scene.activationConditions.length} · ${node.scene.activationConditionMode ?? "all"}`} /><PropertyRow label="Widgets" value={String(node.scene.widgets.length)} /></section>}
          {node.rotation && <section className="property-section"><div className="property-section-title">Rotation / Form</div><PropertyRow label="Angle" value={`R${node.rotation.angle}`} /><PropertyRow label="Display" value={`${node.rotation.width} × ${node.rotation.height}`} /><PropertyRow label="Scenes" value={String(node.rotation.scenes.length)} /></section>}
          {node.theme && <section className="property-section"><div className="property-section-title">Theme Project</div><PropertyRow label="Rotations" value={String(node.theme.rotations.length)} /><PropertyRow label="Resources" value={String(node.theme.resources.length)} /><PropertyRow label="Floor Mappings" value={String(node.theme.floorMappings?.length ?? 0)} /></section>}
          {node.asset && <section className="property-section"><div className="property-section-title">Asset</div><PropertyRow label="Media Type" value={node.asset.mediaType} /><PropertyRow label="Source" value={node.asset.sourcePath} /><PropertyRow label="Stable ID" value={node.asset.id} muted /></section>}
          {multi && <div className="multi-selection-note"><strong>Multi-selection</strong><span>Same values show their value; different values show `*`. Geometry fields remain read-only when a selected widget is locked.</span></div>}
        </div> : <div className="properties-empty"><span className="empty-panel-icon">□</span><strong>Select a canonical item to inspect</strong><span>Project, Theme Group, Theme, Rotation, Scene, Asset and profile-defined Widget selections resolve from the Project Model.</span></div>}
        <div className="panel-footnote"><span className="footnote-mark">i</span><span>Properties is a model view; edits must flow through commands and profile capability checks.</span></div>
      </>
    );
  };

  const renderSimulator = () => (
    <>
      {renderPanelHeader("simulator", "TEST STUDIO", "Simulator")}
      {renderDockTabs("simulator")}
      <div className="simulator-toolbar"><button type="button" className="sim-button primary" onClick={() => logAction("Simulator run requested", "EVENT")}>▶ Run</button><button type="button" className="sim-button" disabled>Ⅱ Pause</button><button type="button" className="sim-button" onClick={() => logAction("Simulator reset requested", "EVENT")}>↺ Reset</button></div>
      <div className="simulator-scroll"><section className="sim-section"><div className="property-section-title">Runtime Inputs</div>{profileStates.length === 0 ? <div className="sim-empty">No state registry entries in active DeviceProfile.</div> : profileStates.map((state) => <div className="sim-row" key={state.id}><span>{state.displayName}</span><strong>Unset</strong></div>)}</section><section className="sim-section"><div className="property-section-title">Active Scene</div><div className="active-scene-card"><strong>{runtime.activeScene?.name ?? "No active Scene"}</strong><span>{runtime.activeScene ? `Priority ${runtime.activeScene.priority}` : "Runtime inputs are empty"}</span></div><div className="sim-row"><span>Candidate scenes</span><strong>{runtime.candidates.length}</strong></div><div className="sim-row"><span>Active bindings</span><strong>{activeBindings.length}</strong></div></section><section className="sim-section"><div className="property-section-title">Runtime Inspector</div><div className="sim-row"><span>Binding Engine</span><strong>Canonical</strong></div><div className="sim-row"><span>Second rule system</span><strong>No</strong></div><div className="sim-row"><span>Firmware mixer</span><strong>Not simulated</strong></div></section></div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Simulator consumes the canonical runtime evaluator; it does not invent Custom State.</span></div>
    </>
  );

  const renderConsole = () => (
    <>
      <div className="console-tabs"><button type="button" className={consoleTab === "console" ? "active" : ""} onClick={() => setConsoleTab("console")}>Console</button><button type="button" className={consoleTab === "validation" ? "active" : ""} onClick={() => setConsoleTab("validation")}>Validation <span className="tab-count">{validation.issues.length}</span></button><span className="console-spacer" /><span className="console-scope">Foundation / local project</span><button type="button" className="panel-action" title="Float console" onClick={() => setPanelMode("console", "floating")}>⤢</button><button type="button" className="panel-action" title="Collapse console" onClick={() => collapsePanel("console")}>×</button></div>
      <div className="console-body">{consoleTab === "console" ? <div className="console-entry-list">{consoleEntries.slice(-3).map((entry, index) => <div className="console-entry" key={`${entry.message}-${index}`}><span className={`console-level ${entry.level.toLowerCase()}`}>{entry.level}</span><span className="console-info">{entry.message}</span></div>)}<span className="console-muted">Command, validation, export and runtime traces appear here.</span></div> : <div className="console-entry-list"><div className="console-entry"><span className={`validation-dot ${validation.valid ? "ok" : "error"}`} /><span className="console-info">{validation.valid ? "No blocking foundation issues" : `${validation.issues.length} validation issue(s)`}</span></div><span className="console-muted">Publish readiness is not evaluated by the Phase 0 foundation.</span>{validation.issues.map((issue) => <div className="console-entry" key={issue.code}><span className={`console-level ${issue.severity}`}>{issue.severity.toUpperCase()}</span><span className="console-info">{issue.message}</span></div>)}</div>}</div>
    </>
  );

  const renderPanelContainer = (panel: PanelId, content: ReactNode) => panelModes[panel] === "floating" ? <div className={`floating-tool-panel floating-${panel}`} data-panel={panel}>{content}</div> : <aside className="tool-panel">{content}</aside>;

  const settingsContent: Record<SettingsCategory, ReactNode> = {
    General: <><h3>General</h3><p>Application-level behavior stays separate from Project, Theme and Runtime settings.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmDestructive: event.target.checked }))} /> Confirm destructive commands</label></>,
    Appearance: <><h3>Appearance</h3><p>Neutral surfaces, restrained teal accent and compact Windows desktop density are canonical.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.compactDensity} onChange={(event) => setSettingsDraft((current) => ({ ...current, compactDensity: event.target.checked }))} /> Use compact panel density</label></>,
    Editor: <><h3>Editor</h3><p>Editor defaults apply to the UI shell only; domain geometry remains canonical.</p><div className="settings-value">Shortcut registry <strong>Foundation</strong></div></>,
    Canvas: <><h3>Canvas</h3><p>Canvas preferences are application UI defaults and do not change runtime semantics.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.showGrid} onChange={(event) => setSettingsDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> Show grid by default</label></>,
    Assets: <><h3>Assets</h3><p>Asset Browser is a depot/library view. Resources, Scene Content and Unsupported Files remain separate.</p><div className="settings-value">Preview mode <strong>Profile-supported</strong></div></>,
    Simulator: <><h3>Simulator</h3><p>Simulator consumes canonical DeviceProfile runtime state and settings registries.</p><div className="settings-value">Rule system <strong>Canonical evaluator</strong></div></>,
    Validation: <><h3>Validation</h3><p>Validation issues are sourced from the shared validation service.</p><div className="settings-value">Severity <strong>Profile-aware</strong></div></>,
    Export: <><h3>Export</h3><p>Export scope is controlled by canonical Resources + Used + Default asset rules.</p><div className="settings-value">Format conversion <strong>Not in V1</strong></div></>,
    Shortcuts: <><h3>Shortcuts</h3><p>Confirmed shortcuts are shown by the command registry; Proposed shortcuts are not presented as settled product behavior.</p><div className="shortcut-list"><span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span></div></>,
  };

  return (
    <div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)}>
      <header className="application-bar">
        <div className="brand-block"><span className="brand-mark">TD</span><div><strong>Template Designer</strong><span className="muted">Design Studio · Foundation</span></div></div>
        <nav className="menu-bar" aria-label="Application menu">{menuKeys.map((menu) => <div key={menu} className="menu-item-wrap"><button type="button" className={`menu-button ${menuOpen === menu ? "is-open" : ""}`} onClick={(event) => { event.stopPropagation(); setMenuOpen((current) => current === menu ? null : menu); }}>{menu}</button>{menuOpen === menu && <div className="menu-popover" onClick={(event) => event.stopPropagation()}>{menuItems[menu].map((item) => <button key={item.label} type="button" className="menu-command" disabled={item.disabled} onClick={item.onClick}><span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button>)}</div>}</div>)}</nav>
        <div className="topbar-actions"><span className="mode-chip"><span className="live-dot" /> {viewMode === "design" ? "Design Mode" : "Preview Mode"}</span><button type="button" className="toolbar-button primary" onClick={createProject}>New Project</button><button type="button" className="toolbar-button" disabled title="Command history is a later foundation phase">Undo</button><button type="button" className="toolbar-button" disabled title="Command history is a later foundation phase">Redo</button><button type="button" className="toolbar-button settings-button" onClick={() => setSettingsOpen(true)} title="Program Settings">⚙ Settings</button></div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Open documents"><div className="document-tab-list">{openDocuments.map((document) => <div key={document} className={`document-tab ${activeDocument === document ? "active" : ""}`} role="tab" aria-selected={activeDocument === document}><button type="button" className="document-tab-main" onClick={() => { setActiveDocument(document); logAction(`${document} document active`); }}><span className="document-tab-icon">▧</span><span>{document}</span>{activeDocument === document && <span className="dirty-indicator" title="Foundation project has local state" />}</button><button type="button" className="tab-close" aria-label={`Close ${document}`} onClick={() => closeDocument(document)} disabled={openDocuments.length <= 1}>×</button></div>)}</div><span className="document-tab-note">Theme Project / Rotation documents</span><div className="tab-actions"><button type="button" className="icon-button" title="Reset layout" onClick={resetLayout}>↺</button></div></div>

      <main className="workspace-stack" style={{ gridTemplateRows: workspaceRows }}>
        <div className="editor-workspace" style={{ gridTemplateColumns: editorColumns }}>
          {activeLeftPanel && renderPanelContainer(activeLeftPanel, activeLeftPanel === "explorer" ? renderExplorer() : renderAssets())}
          {leftVisible && <div className="splitter" role="separator" aria-label="Resize left panel" onPointerDown={(event) => beginResize("left", event)} />}
          <section className="canvas-workspace" aria-label="Canvas editor">
            <div className="studio-toolbar"><div className="tool-group"><button type="button" className={`studio-tool ${canvasTool === "select" ? "active" : ""}`} onClick={() => setCanvasTool("select")} title="Select tool">↖ <span>Select</span></button><button type="button" className={`studio-tool ${canvasTool === "pan" ? "active" : ""}`} onClick={() => setCanvasTool("pan")} title="Pan tool">✥ <span>Pan</span></button><span className="tool-divider" /><button type="button" className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button><button type="button" className={`studio-tool ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((current) => !current)} title="Toggle snap">⌁ <span>Snap</span></button></div><div className="tool-group"><button type="button" className={`mode-button ${viewMode === "design" ? "active" : ""}`} onClick={() => setViewMode("design")}>Design</button><button type="button" className={`mode-button ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button><span className="tool-divider" /><button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.max(50, current - 10))}>−</button><span className="zoom-readout">{zoom}%</span><button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.min(200, current + 10))}>+</button></div></div>
            <div className={`canvas-stage ${gridVisible ? "show-grid" : ""} ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={clearSelection}><div className="canvas-rail-label">{viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}</div><div className="device-canvas-wrap" style={{ transform: `scale(${zoom / 100})` }} onClick={(event) => event.stopPropagation()}><div className="device-frame"><div className="device-frame-header"><span>DISPLAY</span><span>R{activeRotation?.angle ?? 0} · {canvasWidth} × {canvasHeight}</span></div><div className="device-screen"><div className="canvas-widget-layer">{canvasWidgets.map((widget) => { const selected = selectedIds.includes(widget.id); const style = { left: `${(widget.geometry.x / canvasWidth) * 100}%`, top: `${(widget.geometry.y / canvasHeight) * 100}%`, width: `${(widget.geometry.width / canvasWidth) * 100}%`, height: `${(widget.geometry.height / canvasHeight) * 100}%` }; return <button type="button" key={widget.id} className={`canvas-widget ${selected ? "is-selected" : ""} ${widget.locked ? "is-locked" : ""} ${widget.visible ? "" : "is-invisible"}`} style={style} aria-label={`${widget.name} ${widget.widgetType}`} onClick={(event) => { event.stopPropagation(); selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : widget.visible ? "Visible" : "Hidden" }, event.shiftKey || event.ctrlKey); }}><span>{widget.name}</span><small>{widget.widgetType}</small></button>; })}{canvasWidgets.length === 0 && <div className="canvas-empty-state"><span className="empty-glyph">◇</span><strong>{activeScene?.name ?? (hasThemeProject ? "Select a Scene or Widget" : "No Theme Project")}</strong><span>{activeScene ? "Scene contains no widgets." : "Create or select a Theme Project to begin canvas editing."}</span></div>}</div></div><div className="device-frame-footer"><span>ASPECT LOCKED</span><span>R{activeRotation?.angle ?? 0}</span></div></div></div><div className="canvas-overlay-note">{activeScene ? `${activeScene.name} · ${canvasWidgets.length} widget(s)` : "Canvas shell · select a canonical Rotation or Scene"}</div></div>
            <div className="canvas-context-bar"><div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}</div><div className="context-actions"><button type="button" className="context-action" disabled title="Requires a selected widget">Align</button><button type="button" className="context-action" disabled title="Requires a selected widget">Duplicate</button><button type="button" className="context-action" disabled title="Requires a selected widget">Lock</button><button type="button" className="context-action" disabled title="Requires a selected widget">Delete</button></div></div>
          </section>
          {rightVisible && <div className="splitter" role="separator" aria-label="Resize right panel" onPointerDown={(event) => beginResize("right", event)} />}
          {activeRightPanel && renderPanelContainer(activeRightPanel, activeRightPanel === "properties" ? renderProperties() : renderSimulator())}
        </div>
        {consoleVisible && <section className="console-panel" aria-label="Console and validation">{renderConsole()}</section>}
        {floatingPanels.map((panel) => renderPanelContainer(panel, panel === "explorer" ? renderExplorer() : panel === "assets" ? renderAssets() : panel === "properties" ? renderProperties() : panel === "simulator" ? renderSimulator() : renderConsole()))}
      </main>

      <footer className="statusbar"><span><span className="status-led" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span><span>Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span><span>Browser core · Tauri shell reserved</span></footer>

      {bindingModal && <div className="settings-backdrop" role="presentation" onClick={() => setBindingModal(null)}><section className="binding-dialog" role="dialog" aria-modal="true" aria-labelledby="binding-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">CANONICAL PRESENTATION</span><h2 id="binding-title">Binding Editor</h2></div><button type="button" className="panel-action" aria-label="Close Binding Editor" onClick={() => setBindingModal(null)}>×</button></header><div className="binding-layout"><div className="binding-context-card"><span className="context-icon has-selection">◇</span><div><strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Binding is evaluated inside the active Scene</small></div></div><div className="binding-section"><div className="property-section-title">Bindings</div>{bindingWidget?.bindings.length ? bindingWidget.bindings.map((binding, index) => { const evaluation = bindingEvaluations[index]; return <div className="binding-card" key={binding.id}><div className="binding-card-head"><strong>{binding.action}</strong><span className={evaluation?.matched ? "binding-true" : "binding-false"}>{evaluation?.matched ? "TRUE" : "FALSE"}</span></div><div className="binding-condition-list">{binding.conditions.map((condition, conditionIndex) => { const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === condition.stateId); return <div className="binding-condition" key={`${binding.id}-${conditionIndex}`}><span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? condition.stateId}</span><code>{condition.operator} {String(condition.value)}</code></div>; })}</div><small>Target widget: {evaluation?.widgetId ?? binding.widgetId} · content/style: {binding.contentId ?? "presentation"}</small></div>; }) : <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No bindings on this widget</strong><span>Binding records remain in the canonical Widget model; this surface does not invent scene selection rules.</span></div>}</div><div className="binding-section"><div className="property-section-title">DeviceProfile Registry</div><div className="binding-registry-grid"><div><strong>Runtime States</strong>{profileStates.length ? profileStates.map((state) => <span key={state.id}>{state.displayName}<small>{state.type}</small></span>) : <em>Empty registry</em>}</div><div><strong>Runtime Settings</strong>{profileSettings.length ? profileSettings.map((setting) => <span key={setting.id}>{setting.displayName}<small>{setting.type}</small></span>) : <em>Empty registry</em>}</div></div></div></div><footer className="settings-footer"><span>Positive/negative conditions and actions are constrained by the active DeviceProfile.</span><div><button type="button" className="settings-button-secondary" disabled title="Command-backed binding creation is the next UI command phase">Add Binding</button><button type="button" className="settings-button-primary" onClick={() => setBindingModal(null)}>Close</button></div></footer></section></div>}
      {settingsOpen && <div className="settings-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">APPLICATION PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" className="panel-action" aria-label="Close Settings" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>×</button></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{settingsCategories.map((category) => <button key={category} type="button" className={settingsCategory === category ? "active" : ""} onClick={() => setSettingsCategory(category)}>{category}</button>)}</nav><div className="settings-content">{settingsContent[settingsCategory]}</div></div><footer className="settings-footer"><span>Program settings only · Project/Theme/Runtime settings stay in their canonical contexts.</span><div><button type="button" className="settings-button-secondary" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>Cancel</button><button type="button" className="settings-button-primary" onClick={() => { setSavedSettings(settingsDraft); setSettingsOpen(false); logAction("Program Settings saved"); }}>Save / Apply &amp; Close</button></div></footer></section></div>}
    </div>
  );
}
