import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createEmptyProject } from "../Domain/factories";
import { InMemoryDocumentStore } from "../Core/document-store";
import type { Command } from "../Core/commands";
import { createEditorApplication } from "../Core/editor-application";
import { buildDeploymentPackage, verifyDeploymentPackage } from "../Core/export";
import { evaluateActiveSceneBindings, evaluateBinding, selectActiveScene } from "../Core/runtime";
import { validateProject } from "../Core/validation";
import type { Asset, Geometry, PrimitiveValue, Project, Rotation, RuntimeContext, Scene, ThemeProject, ThemeProjectGroup, Widget } from "../Domain/models";
import { intersects, normalizeRect, snapGeometry, updateWidgetGeometries, type CanvasPoint, type CanvasRect } from "./canvas-interaction";
import { commandsForSelection, type EditorCommandId } from "./editor-commands";
import type { PanelId, PanelMode, SelectionKind } from "./editor-types";
import { activateDockedPanel, defaultPanelLayout, floatingPanels as getFloatingPanels, setPanelLayoutMode } from "./panel-manager";
import type { DeviceProfileRegistry } from "./profile-registry";

type ViewMode = "design" | "preview";
type CanvasTool = "select" | "pan";
type MenuKey = "File" | "Edit" | "View" | "Project" | "Theme" | "Scene" | "Widget" | "Tools";
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

export function App({ profileRegistry }: { profileRegistry: DeviceProfileRegistry }) {
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore();
    store.open(createEmptyProject());
    return store;
  }, []);
  const documentSnapshot = useSyncExternalStore(documentStore.subscribe.bind(documentStore), () => documentStore.getSnapshot(), () => documentStore.getSnapshot());
  const project = documentSnapshot.project ?? createEmptyProject();
  const [panelModes, setPanelModes] = useState<Record<PanelId, PanelMode>>(() => ({ ...defaultPanelLayout }));
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
  const editorApplication = useMemo(() => createEditorApplication(documentStore), [documentStore]);
  const commandHistory = documentStore.history;
  const [runtimeValues, setRuntimeValues] = useState<Record<string, PrimitiveValue | null>>({});
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, PrimitiveValue | null>>({});
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "paused">("idle");
  const [deploymentStatus, setDeploymentStatus] = useState("Not built");
  const [geometryOverrides, setGeometryOverrides] = useState<Record<string, Geometry>>({});
  const [canvasPointer, setCanvasPointer] = useState<{ mode: "idle" } | { mode: "marquee"; start: CanvasPoint; rect: CanvasRect; additive: boolean } | { mode: "drag" | "resize"; widgetIds: string[]; start: CanvasPoint; initial: Record<string, Geometry>; handle?: string }>({ mode: "idle" });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: SelectionKind } | null>(null);
  const canvasScreenRef = useRef<HTMLDivElement>(null);
  const suppressCanvasClickRef = useRef(false);

  const availableProfiles = profileRegistry.list();
  const activeProfile = profileRegistry.get(project.deviceProfileId);
  const validation = useMemo(() => validateProject(project, activeProfile), [project, activeProfile]);
  const groups = project.themeProjectGroups;
  const group = groups[0];
  const themeNodes = groups.flatMap((currentGroup) => getThemeNodes(currentGroup));
  const hasThemeProject = themeNodes.length > 0;
  const activeSelectionLabel = selectedIds.length > 1 ? `${selectedIds.length} items selected` : selection?.label ?? "Nothing selected";
  const profileStatus = activeProfile ? `${activeProfile.name} · ${availableProfiles.length} profile${availableProfiles.length === 1 ? "" : "s"} registered` : `DeviceProfile unavailable · ${availableProfiles.length} registered`;
  const resolvedSelection = useMemo(() => selection ? resolveCanonicalNode(project, selection.id) : undefined, [project, selection]);
  const runtimeRotation = resolvedSelection?.rotation ?? group?.themeProjects[0]?.rotations[0];
  const runtimeContext: RuntimeContext = { values: runtimeValues, settings: runtimeSettings, sceneActivationOrder: {} };
  const runtime = useMemo(() => activeProfile ? selectActiveScene(runtimeRotation?.scenes ?? [], runtimeContext, activeProfile) : { activeSceneId: undefined, activeScene: undefined, candidates: [] }, [runtimeRotation, activeProfile, runtimeValues, runtimeSettings]);
  const activeBindings = useMemo(() => activeProfile && runtime.activeScene ? evaluateActiveSceneBindings(runtime.activeScene, runtimeContext, activeProfile) : [], [runtime.activeScene, activeProfile, runtimeValues, runtimeSettings]);
  const bindingWidget = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId)?.widget : undefined;
  const profileStates = activeProfile?.runtimeStates ?? [];
  const profileSettings = activeProfile?.runtimeSettings ?? [];
  const bindingEvaluations = useMemo(() => bindingWidget && activeProfile ? bindingWidget.bindings.map((binding) => evaluateBinding(binding, runtimeContext, activeProfile)) : [], [bindingWidget, activeProfile, runtimeValues, runtimeSettings]);
  const activeLeftPanel = panelModes.explorer === "docked" ? "explorer" : panelModes.assets === "docked" ? "assets" : null;
  const activeRightPanel = panelModes.properties === "docked" ? "properties" : panelModes.simulator === "docked" ? "simulator" : null;
  const leftVisible = activeLeftPanel !== null;
  const rightVisible = activeRightPanel !== null;
  const consoleVisible = panelModes.console === "docked";
  const floatingPanels = getFloatingPanels(panelModes);
  const workspaceRows = consoleVisible ? "minmax(0, 1fr) 156px" : "minmax(0, 1fr) 0px";
  const editorColumns = `${leftVisible ? `${leftWidth}px` : "0px"} ${leftVisible ? "5px" : "0px"} minmax(0, 1fr) ${rightVisible ? "5px" : "0px"} ${rightVisible ? `${rightWidth}px` : "0px"}`;

  const logAction = (message: string, level: ConsoleEntry["level"] = "INFO") => {
    setConsoleEntries((current) => [...current.slice(-24), { level, message }]);
    setMenuOpen(null);
  };

  const runCommand = (command: Command) => {
    editorApplication.executeCommand(command);
    logAction(`> ${command.label}`, "EVENT");
  };

  const undo = () => {
    if (documentStore.undo()) logAction("> undo()", "EVENT");
  };

  const redo = () => {
    if (documentStore.redo()) logAction("> redo()", "EVENT");
  };

  const replaceProject = (nextProject: Project) => {
    documentStore.replaceCurrent(nextProject);
  };

  const createProject = () => {
    const previousProject = project;
    const nextProject = createEmptyProject("Untitled Project");
    runCommand({ label: "Create Project", execute: () => replaceProject(nextProject), undo: () => replaceProject(previousProject) });
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setOpenDocuments(["Project Overview"]);
    setActiveDocument("Project Overview");
    logAction("New project command executed");
  };

  const saveDocument = () => {
    documentStore.save();
    logAction("Project saved", "EVENT");
  };

  const addThemeProject = () => {
    const groupId = resolvedSelection?.group?.id ?? group?.id;
    if (!groupId) return;
    editorApplication.addThemeProject(groupId);
    logAction("Theme Project added", "EVENT");
  };

  const addRotation = () => {
    const themeId = resolvedSelection?.theme?.id;
    if (!themeId) return;
    editorApplication.addRotation(themeId);
    logAction("Rotation added", "EVENT");
  };

  const addScene = () => {
    const rotationId = resolvedSelection?.rotation?.id;
    if (!rotationId) return;
    editorApplication.addScene(rotationId);
    logAction("Scene added", "EVENT");
  };

  const deleteSelectionCommand = () => {
    if (!selectedIds.length) return;
    editorApplication.deleteSelection(selectedIds);
    setSelection(null);
    setSelectedIds([]);
    logAction("Selection deleted", "EVENT");
  };

  const duplicateSelectionCommand = () => {
    if (!selectedIds.length) return;
    editorApplication.duplicateSelection(selectedIds);
    logAction("Selection duplicated", "EVENT");
  };

  const executeEditorDescriptor = (commandId: EditorCommandId) => {
    const node = resolvedSelection;
    if (commandId === "project.add-theme-project") addThemeProject();
    else if (commandId === "theme.add-rotation") addRotation();
    else if (commandId === "rotation.add-scene") addScene();
    else if (commandId === "scene.reorder" || commandId === "scene.move") {
      if (node?.scene && node.rotation) editorApplication.moveScene(node.rotation.id, node.scene.id, 0);
    } else if (commandId === "widget.reorder") {
      if (node?.widget && node.scene) editorApplication.moveWidget(node.scene.id, node.widget.id, 0);
    } else if (commandId === "widget.edit-properties") activatePanel("properties");
    else if (commandId === "widget.move") activatePanel("properties");
    else if (commandId === "canvas.delete-selection") deleteSelectionCommand();
    logAction(`${commandId} executed`, "EVENT");
    setContextMenu(null);
  };

  const buildAndVerifyPackage = async () => {
    if (!activeProfile) {
      setDeploymentStatus("Blocked · DeviceProfile unavailable");
      logAction("Package build blocked: active DeviceProfile is unavailable", "ERROR");
      return;
    }
    if (!validation.valid) {
      setDeploymentStatus("Blocked · validation failed");
      validation.issues.forEach((issue) => logAction(`${issue.code}: ${issue.message}`, issue.severity === "error" ? "ERROR" : "WARN"));
      return;
    }
    try {
      setDeploymentStatus("Building…");
      const built = await buildDeploymentPackage(project, activeProfile);
      const verified = await verifyDeploymentPackage(built);
      setDeploymentStatus(verified.verified ? "Verified package" : "Blocked · integrity failed");
      logAction(verified.verified ? `Package verified · ${verified.manifest.assetIds.length} asset(s)` : "Package verification failed", verified.verified ? "INFO" : "ERROR");
    } catch (error) {
      setDeploymentStatus("Blocked · export error");
      logAction(error instanceof Error ? error.message : "Package build failed", "ERROR");
    }
  };

  const setPanelMode = (panel: PanelId, mode: PanelMode) => {
    setPanelModes((current) => setPanelLayoutMode(current, panel, mode));
    logAction(`${panel[0].toUpperCase()}${panel.slice(1)} panel: ${mode}`);
  };

  const activatePanel = (panel: PanelId) => {
    setPanelModes((current) => activateDockedPanel(current, panel));
    logAction(`${panel[0].toUpperCase()}${panel.slice(1)} panel docked`);
  };

  const collapsePanel = (panel: PanelId) => setPanelMode(panel, "collapsed");

  const resetLayout = () => {
    setPanelModes({ ...defaultPanelLayout });
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
        <div className={`tree-row ${isSelected ? "is-selected" : ""}`} style={{ paddingLeft: `${10 + depth * 15}px` }} onContextMenu={(event) => { event.preventDefault(); selectNode(node); setContextMenu({ x: event.clientX, y: event.clientY, kind: resolveCanonicalNode(project, node.id)?.kind ?? "canvas" }); }}>
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
  const canvasWidth = activeRotation?.width ?? activeProfile?.display.width ?? 1;
  const canvasHeight = activeRotation?.height ?? activeProfile?.display.height ?? 1;
  const canvasAvailable = Boolean(activeProfile && activeRotation);
  const effectiveGeometry = (widget: Widget): Geometry => geometryOverrides[widget.id] ?? widget.geometry;
  const selectedWidgetIds = selectedIds.filter((id) => Boolean(resolveCanonicalNode(project, id)?.widget));

  const toCanvasPoint = (event: React.PointerEvent<HTMLDivElement>): CanvasPoint => {
    const bounds = canvasScreenRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return { x: ((event.clientX - bounds.left) / bounds.width) * canvasWidth, y: ((event.clientY - bounds.top) / bounds.height) * canvasHeight };
  };

  const commitGeometryCommand = (updates: Readonly<Record<string, Geometry>>, label: string) => {
    const previous = project;
    const next = updateWidgetGeometries(project, updates);
    runCommand({ label, execute: () => replaceProject(next), undo: () => replaceProject(previous) });
    setGeometryOverrides({});
  };

  const beginCanvasMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasAvailable || (event.target as HTMLElement).closest(".canvas-widget, .resize-handle")) return;
    event.preventDefault();
    const start = toCanvasPoint(event);
    setCanvasPointer({ mode: "marquee", start, rect: { x: start.x, y: start.y, width: 0, height: 0 }, additive: event.shiftKey || event.ctrlKey });
    if (!event.shiftKey && !event.ctrlKey) {
      setSelection(null);
      setSelectedIds([]);
    }
  };

  const beginWidgetMove = (widget: Widget, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const selected = selectedWidgetIds.includes(widget.id) ? selectedWidgetIds : [widget.id];
    const editable = selected.map((id) => resolveCanonicalNode(project, id)?.widget).filter((candidate): candidate is Widget => Boolean(candidate && !candidate.locked));
    if (!editable.length) {
      selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: "Locked" });
      logAction(`${widget.name} is locked; geometry command blocked`, "WARN");
      return;
    }
    if (!selectedWidgetIds.includes(widget.id)) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.visible ? "Visible" : "Hidden" });
    setCanvasPointer({ mode: "drag", widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), initial: Object.fromEntries(editable.map((candidate) => [candidate.id, effectiveGeometry(candidate)])) });
  };

  const beginWidgetResize = (widget: Widget, handle: string, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (widget.locked) {
      logAction(`${widget.name} is locked; resize blocked`, "WARN");
      return;
    }
    if (!selectedWidgetIds.includes(widget.id)) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: "Selected" });
    setCanvasPointer({ mode: "resize", widgetIds: [widget.id], start: toCanvasPoint(event as unknown as React.PointerEvent<HTMLDivElement>), initial: { [widget.id]: effectiveGeometry(widget) }, handle });
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (canvasPointer.mode === "idle") return;
    const current = toCanvasPoint(event);
    if (canvasPointer.mode === "marquee") {
      setCanvasPointer((state) => state.mode === "marquee" ? { ...state, rect: normalizeRect(state.start, current) } : state);
      return;
    }
    const delta = { x: current.x - canvasPointer.start.x, y: current.y - canvasPointer.start.y };
    const updates: Record<string, Geometry> = {};
    for (const widgetId of canvasPointer.widgetIds) {
      const initial = canvasPointer.initial[widgetId];
      if (!initial) continue;
      let next = { ...initial };
      if (canvasPointer.mode === "drag") next = { ...next, x: initial.x + delta.x, y: initial.y + delta.y };
      else {
        const handle = canvasPointer.handle ?? "se";
        if (handle.includes("e")) next.width = Math.max(10, initial.width + delta.x);
        if (handle.includes("s")) next.height = Math.max(10, initial.height + delta.y);
        if (handle.includes("w")) { next.x = initial.x + delta.x; next.width = Math.max(10, initial.width - delta.x); }
        if (handle.includes("n")) { next.y = initial.y + delta.y; next.height = Math.max(10, initial.height - delta.y); }
      }
      updates[widgetId] = snapGeometry(next, snapEnabled, 10);
    }
    setGeometryOverrides(updates);
    suppressCanvasClickRef.current = true;
  };

  const handleCanvasPointerUp = () => {
    if (canvasPointer.mode === "marquee") {
      const hits = canvasWidgets.filter((widget) => intersects(canvasPointer.rect, effectiveGeometry(widget))).map((widget) => widget.id);
      const nextIds = canvasPointer.additive ? [...new Set([...selectedIds, ...hits])] : hits;
      setSelectedIds(nextIds);
      const first = hits[0] ? resolveCanonicalNode(project, hits[0])?.widget : undefined;
      setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
      setCanvasPointer({ mode: "idle" });
      suppressCanvasClickRef.current = true;
      return;
    }
    if (canvasPointer.mode === "drag" || canvasPointer.mode === "resize") {
      const updates = geometryOverrides;
      if (Object.keys(updates).length) commitGeometryCommand(updates, canvasPointer.mode === "drag" ? "Move widget" : "Resize widget");
      setCanvasPointer({ mode: "idle" });
      window.setTimeout(() => { suppressCanvasClickRef.current = false; }, 0);
    }
  };

  const renderCanvasWidget = (widget: Widget) => {
    const geometry = effectiveGeometry(widget);
    const selected = selectedIds.includes(widget.id);
    const style = { left: `${(geometry.x / canvasWidth) * 100}%`, top: `${(geometry.y / canvasHeight) * 100}%`, width: `${(geometry.width / canvasWidth) * 100}%`, height: `${(geometry.height / canvasHeight) * 100}%` };
    const handles = ["nw", "ne", "sw", "se"];
    return <div key={widget.id} className={`canvas-widget ${selected ? "is-selected" : ""} ${widget.locked ? "is-locked" : ""} ${widget.visible ? "" : "is-invisible"}`} style={style} role="button" tabIndex={0} aria-label={`${widget.name} ${widget.widgetType}`} onPointerDown={(event) => beginWidgetMove(widget, event)} onClick={(event) => { event.stopPropagation(); if (!suppressCanvasClickRef.current) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : widget.visible ? "Visible" : "Hidden" }, event.shiftKey || event.ctrlKey); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : widget.visible ? "Visible" : "Hidden" }); }}><span>{widget.name}</span><small>{widget.widgetType}{widget.locked ? " · locked" : ""}{!widget.visible ? " · hidden" : ""}</small>{selected && !widget.locked && handles.map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize ${widget.name} ${handle}`} onPointerDown={(event) => beginWidgetResize(widget, handle, event)} />)}</div>;
  };

  const menuItems: Record<MenuKey, MenuItem[]> = {
    File: [
      { label: "New Project", shortcut: "Ctrl+N", onClick: createProject },
      { label: "Open Project", disabled: true },
      { label: "Save", shortcut: "Ctrl+S", disabled: !documentSnapshot.isDirty, onClick: saveDocument },
    ],
    Edit: [
      { label: "Undo", shortcut: "Ctrl+Z", disabled: !commandHistory.canUndo, onClick: undo },
      { label: "Redo", shortcut: "Ctrl+Y", disabled: !commandHistory.canRedo, onClick: redo },
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
      { label: "Validate Project", onClick: () => { if (validation.valid) logAction("Project validation passed"); else validation.issues.forEach((issue) => logAction(`${issue.code}: ${issue.message}`, issue.severity === "error" ? "ERROR" : "WARN")); } },
      { label: "Build & Verify Package", onClick: () => { void buildAndVerifyPackage(); } },
    ],
    Theme: [
      { label: "Add Theme Project", onClick: addThemeProject },
      { label: "Add Rotation", disabled: !resolvedSelection?.theme, onClick: addRotation },
      { label: "Theme Defaults", disabled: true },
    ],
    Scene: [
      { label: "Add Scene", disabled: !resolvedSelection?.rotation, onClick: addScene },
      { label: "Delete Selection", disabled: !selectedIds.length, onClick: deleteSelectionCommand },
      { label: "Test Scene", onClick: () => activatePanel("simulator") },
    ],
    Widget: [
      { label: "Duplicate Selection", disabled: !selectedIds.length, onClick: duplicateSelectionCommand },
      { label: "Delete Selection", disabled: !selectedIds.length, onClick: deleteSelectionCommand },
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

  const commitSelectionGeometryField = (field: keyof Geometry, value: number) => {
    const previous = project;
    const updates: Record<string, Geometry> = {};
    selectedIds.forEach((id) => {
      const widget = resolveCanonicalNode(project, id)?.widget;
      if (!widget || widget.locked) return;
      updates[id] = { ...effectiveGeometry(widget), [field]: Math.max(field === "width" || field === "height" ? 10 : 0, value) };
    });
    if (!Object.keys(updates).length) {
      logAction("Geometry edit blocked: selection is locked or not a Widget", "WARN");
      return;
    }
    const next = updateWidgetGeometries(project, updates);
    runCommand({ label: `Set widget ${field}`, execute: () => replaceProject(next), undo: () => replaceProject(previous) });
  };

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
            <section className="property-section"><div className="property-section-title">Geometry / Layer</div><div className="geometry-editor"><label>X<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? effectiveGeometry(current.widget).x : undefined) : effectiveGeometry(widget).x} disabled={multi || widget.locked} onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))} /></label><label>Y<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? effectiveGeometry(current.widget).y : undefined) : effectiveGeometry(widget).y} disabled={multi || widget.locked} onChange={(event) => commitSelectionGeometryField("y", Number(event.target.value))} /></label><label>W<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? effectiveGeometry(current.widget).width : undefined) : effectiveGeometry(widget).width} disabled={multi || widget.locked} onChange={(event) => commitSelectionGeometryField("width", Number(event.target.value))} /></label><label>H<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? effectiveGeometry(current.widget).height : undefined) : effectiveGeometry(widget).height} disabled={multi || widget.locked} onChange={(event) => commitSelectionGeometryField("height", Number(event.target.value))} /></label></div><PropertyRow label="Locked" value={multi ? valueFor((current) => current.widget?.locked) : String(widget.locked)} /><PropertyRow label="Visible" value={multi ? valueFor((current) => current.widget?.visible) : String(widget.visible)} /><PropertyRow label="Z-order" value={String(widget.zIndex)} /></section>
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
      <div className="simulator-toolbar"><button type="button" className="sim-button primary" onClick={() => { setSimulationStatus("running"); logAction("Simulator run requested", "EVENT"); }}>▶ Run</button><button type="button" className="sim-button" disabled={simulationStatus !== "running"} onClick={() => { setSimulationStatus("paused"); logAction("Simulator paused", "EVENT"); }}>Ⅱ Pause</button><button type="button" className="sim-button" disabled={simulationStatus === "idle"} onClick={() => logAction("Simulator step requested", "EVENT")}>Step</button><button type="button" className="sim-button" onClick={() => { setSimulationStatus("idle"); setRuntimeValues({}); setRuntimeSettings({}); logAction("Simulator reset requested", "EVENT"); }}>↺ Reset</button><span className="sim-status">{simulationStatus.toUpperCase()}</span></div>
      <div className="simulator-scroll"><section className="sim-section"><div className="property-section-title">Runtime States · DeviceProfile</div>{profileStates.length === 0 ? <div className="sim-empty">No state registry entries in active DeviceProfile.</div> : profileStates.map((state) => { const current = runtimeValues[state.id]; return <label className="sim-input-row" key={state.id}><span>{state.displayName}<small>{state.type}</small></span>{state.type === "boolean" ? <input type="checkbox" checked={current === true} onChange={(event) => setRuntimeValues((values) => ({ ...values, [state.id]: event.target.checked }))} /> : <input type="text" value={current == null ? "" : String(current)} placeholder="Unset" onChange={(event) => setRuntimeValues((values) => ({ ...values, [state.id]: event.target.value }))} />}</label>; })}</section><section className="sim-section"><div className="property-section-title">Runtime Settings · DeviceProfile</div>{profileSettings.length === 0 ? <div className="sim-empty">No runtime settings in active DeviceProfile.</div> : profileSettings.map((setting) => <label className="sim-input-row" key={setting.id}><span>{setting.displayName}<small>{setting.type}</small></span><input type="text" value={runtimeSettings[setting.id] == null ? "" : String(runtimeSettings[setting.id])} placeholder={setting.defaultValue == null ? "Unset" : String(setting.defaultValue)} onChange={(event) => setRuntimeSettings((values) => ({ ...values, [setting.id]: event.target.value }))} /></label>)}</section><section className="sim-section"><div className="property-section-title">Active Scene</div><div className="active-scene-card"><strong>{runtime.activeScene?.name ?? "No active Scene"}</strong><span>{runtime.activeScene ? `Priority ${runtime.activeScene.priority}` : "Runtime inputs are empty"}</span></div>{runtime.candidates.map((candidate) => <div className="sim-row" key={candidate.sceneId}><span>{candidate.sceneId}</span><strong>{candidate.matched ? "MATCH" : "skip"} · P{candidate.priority}</strong></div>)}<div className="sim-row"><span>Active bindings</span><strong>{activeBindings.length}</strong></div></section><section className="sim-section"><div className="property-section-title">Runtime Inspector</div><div className="sim-row"><span>Binding Engine</span><strong>Canonical</strong></div><div className="sim-row"><span>Audio arbitration</span><strong>Firmware-owned</strong></div><div className="sim-row"><span>Package status</span><strong>{deploymentStatus}</strong></div></section></div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Simulator consumes DeviceProfile, Scene selection and active-scene bindings; it does not invent Custom State.</span></div>
    </>
  );

  const renderConsole = () => (
    <>
      <div className="console-tabs"><button type="button" className={consoleTab === "console" ? "active" : ""} onClick={() => setConsoleTab("console")}>Console</button><button type="button" className={consoleTab === "validation" ? "active" : ""} onClick={() => setConsoleTab("validation")}>Validation <span className="tab-count">{validation.issues.length}</span></button><span className="console-spacer" /><span className="console-scope">Package: {deploymentStatus}</span><button type="button" className="panel-action" title="Float console" onClick={() => setPanelMode("console", "floating")}>⤢</button><button type="button" className="panel-action" title="Collapse console" onClick={() => collapsePanel("console")}>×</button></div>
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
        <div className="topbar-actions"><span className="mode-chip"><span className="live-dot" /> {viewMode === "design" ? "Design Mode" : "Preview Mode"}</span><span className={`mode-chip ${documentSnapshot.isDirty ? "is-dirty" : "is-clean"}`}>{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}</span><button type="button" className="toolbar-button primary" onClick={createProject}>New Project</button><button type="button" className="toolbar-button" disabled={!commandHistory.canUndo} onClick={undo} title={commandHistory.canUndo ? "Undo last command" : "No commands to undo"}>Undo</button><button type="button" className="toolbar-button" disabled={!commandHistory.canRedo} onClick={redo} title={commandHistory.canRedo ? "Redo last command" : "No commands to redo"}>Redo</button><button type="button" className="toolbar-button settings-button" onClick={() => setSettingsOpen(true)} title="Program Settings">⚙ Settings</button></div>
      </header>

      <div className="document-tabs" role="tablist" aria-label="Open documents"><div className="document-tab-list">{openDocuments.map((document) => <div key={document} className={`document-tab ${activeDocument === document ? "active" : ""}`} role="tab" aria-selected={activeDocument === document}><button type="button" className="document-tab-main" onClick={() => { setActiveDocument(document); logAction(`${document} document active`); }}><span className="document-tab-icon">▧</span><span>{document}</span>{activeDocument === document && <span className="dirty-indicator" title="Foundation project has local state" />}</button><button type="button" className="tab-close" aria-label={`Close ${document}`} onClick={() => closeDocument(document)} disabled={openDocuments.length <= 1}>×</button></div>)}</div><span className="document-tab-note">Theme Project / Rotation documents · {documentSnapshot.isDirty ? "Dirty" : "Clean"}</span><div className="tab-actions"><button type="button" className="icon-button" title="Reset layout" onClick={resetLayout}>↺</button></div></div>

      <main className="workspace-stack" style={{ gridTemplateRows: workspaceRows }}>
        <div className="editor-workspace" style={{ gridTemplateColumns: editorColumns }}>
          {activeLeftPanel && renderPanelContainer(activeLeftPanel, activeLeftPanel === "explorer" ? renderExplorer() : renderAssets())}
          {leftVisible && <div className="splitter" role="separator" aria-label="Resize left panel" onPointerDown={(event) => beginResize("left", event)} />}
          <section className="canvas-workspace" aria-label="Canvas editor">
            <div className="studio-toolbar"><div className="tool-group"><button type="button" className={`studio-tool ${canvasTool === "select" ? "active" : ""}`} onClick={() => setCanvasTool("select")} title="Select tool">↖ <span>Select</span></button><button type="button" className={`studio-tool ${canvasTool === "pan" ? "active" : ""}`} onClick={() => setCanvasTool("pan")} title="Pan tool">✥ <span>Pan</span></button><span className="tool-divider" /><button type="button" className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button><button type="button" className={`studio-tool ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((current) => !current)} title="Toggle snap">⌁ <span>Snap</span></button></div><div className="tool-group"><button type="button" className={`mode-button ${viewMode === "design" ? "active" : ""}`} onClick={() => setViewMode("design")}>Design</button><button type="button" className={`mode-button ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button><span className="tool-divider" /><button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.max(50, current - 10))}>−</button><span className="zoom-readout">{zoom}%</span><button type="button" className="zoom-button" onClick={() => setZoom((current) => Math.min(200, current + 10))}>+</button></div></div>
            <div className={`canvas-stage ${gridVisible ? "show-grid" : ""} ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={() => { if (!suppressCanvasClickRef.current) clearSelection(); setContextMenu(null); }} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, kind: selection?.kind ?? "canvas" }); }}><div className="canvas-rail-label">{viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}</div><div className="device-canvas-wrap" style={{ transform: `scale(${zoom / 100})` }} onClick={(event) => event.stopPropagation()}><div className="device-frame"><div className="device-frame-header"><span>DISPLAY</span><span>R{activeRotation?.angle ?? 0} · {canvasWidth} × {canvasHeight}</span></div><div className="device-screen" ref={canvasScreenRef} onPointerDown={beginCanvasMarquee} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp}><div className="canvas-widget-layer">{canvasAvailable && canvasWidgets.map(renderCanvasWidget)}{canvasPointer.mode === "marquee" && <div className="selection-marquee" style={{ left: `${(canvasPointer.rect.x / canvasWidth) * 100}%`, top: `${(canvasPointer.rect.y / canvasHeight) * 100}%`, width: `${(canvasPointer.rect.width / canvasWidth) * 100}%`, height: `${(canvasPointer.rect.height / canvasHeight) * 100}%` }} />}{(!canvasAvailable || canvasWidgets.length === 0) && <div className="canvas-empty-state"><span className="empty-glyph">◇</span><strong>{!activeProfile ? "DeviceProfile unavailable" : activeScene?.name ?? (hasThemeProject ? "Select a Scene or Widget" : "No Theme Project")}</strong><span>{!activeProfile ? "Register the canonical DeviceProfile before editing this display." : activeScene ? "Scene contains no widgets." : "Create or select a canonical Rotation and Scene to begin canvas editing."}</span></div>}</div></div><div className="device-frame-footer"><span>ASPECT LOCKED</span><span>R{activeRotation?.angle ?? 0}</span></div></div></div><div className="canvas-overlay-note">{activeScene ? `${activeScene.name} · ${canvasWidgets.length} widget(s)` : "Canvas shell · select a canonical Rotation or Scene"}</div></div>
            <div className="canvas-context-bar"><div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}</div><div className="context-actions"><button type="button" className="context-action" disabled title="Requires a selected widget">Align</button><button type="button" className="context-action" disabled title="Requires a selected widget">Duplicate</button><button type="button" className="context-action" disabled title="Requires a selected widget">Lock</button><button type="button" className="context-action" disabled title="Requires a selected widget">Delete</button></div></div>
          </section>
          {rightVisible && <div className="splitter" role="separator" aria-label="Resize right panel" onPointerDown={(event) => beginResize("right", event)} />}
          {activeRightPanel && renderPanelContainer(activeRightPanel, activeRightPanel === "properties" ? renderProperties() : renderSimulator())}
        </div>
        {consoleVisible && <section className="console-panel" aria-label="Console and validation">{renderConsole()}</section>}
        {floatingPanels.map((panel) => renderPanelContainer(panel, panel === "explorer" ? renderExplorer() : panel === "assets" ? renderAssets() : panel === "properties" ? renderProperties() : panel === "simulator" ? renderSimulator() : renderConsole()))}
      </main>

      {contextMenu && <div className="editor-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{commandsForSelection(contextMenu.kind).map((command) => <button type="button" key={command.id} disabled={Boolean(command.disabledReason)} title={command.disabledReason} onClick={() => executeEditorDescriptor(command.id)}><span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}{commandsForSelection(contextMenu.kind).length === 0 && <span className="context-menu-empty">No commands for this selection</span>}</div>}

      <footer className="statusbar"><span><span className="status-led" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span><span>{profileStatus} · Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span><span>{deploymentStatus} · Document: {documentSnapshot.isDirty ? "dirty" : "clean"} · Browser core · Tauri shell reserved</span></footer>

      {bindingModal && <div className="settings-backdrop" role="presentation" onClick={() => setBindingModal(null)}><section className="binding-dialog" role="dialog" aria-modal="true" aria-labelledby="binding-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">CANONICAL PRESENTATION</span><h2 id="binding-title">Binding Editor</h2></div><button type="button" className="panel-action" aria-label="Close Binding Editor" onClick={() => setBindingModal(null)}>×</button></header><div className="binding-layout"><div className="binding-context-card"><span className="context-icon has-selection">◇</span><div><strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Binding is evaluated inside the active Scene</small></div></div><div className="binding-section"><div className="property-section-title">Bindings</div>{bindingWidget?.bindings.length ? bindingWidget.bindings.map((binding, index) => { const evaluation = bindingEvaluations[index]; return <div className="binding-card" key={binding.id}><div className="binding-card-head"><strong>{binding.action}</strong><span className={evaluation?.matched ? "binding-true" : "binding-false"}>{evaluation?.matched ? "TRUE" : "FALSE"}</span></div><div className="binding-condition-list">{binding.conditions.map((condition, conditionIndex) => { const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === condition.stateId); return <div className="binding-condition" key={`${binding.id}-${conditionIndex}`}><span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? condition.stateId}</span><code>{condition.operator} {String(condition.value)}</code></div>; })}</div><small>Target widget: {evaluation?.widgetId ?? binding.widgetId} · content/style: {binding.contentId ?? "presentation"}</small></div>; }) : <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No bindings on this widget</strong><span>Binding records remain in the canonical Widget model; this surface does not invent scene selection rules.</span></div>}</div><div className="binding-section"><div className="property-section-title">DeviceProfile Registry</div><div className="binding-registry-grid"><div><strong>Runtime States</strong>{profileStates.length ? profileStates.map((state) => <span key={state.id}>{state.displayName}<small>{state.type}</small></span>) : <em>Empty registry</em>}</div><div><strong>Runtime Settings</strong>{profileSettings.length ? profileSettings.map((setting) => <span key={setting.id}>{setting.displayName}<small>{setting.type}</small></span>) : <em>Empty registry</em>}</div></div></div></div><footer className="settings-footer"><span>Positive/negative conditions and actions are constrained by the active DeviceProfile.</span><div><button type="button" className="settings-button-secondary" disabled title="Command-backed binding creation is the next UI command phase">Add Binding</button><button type="button" className="settings-button-primary" onClick={() => setBindingModal(null)}>Close</button></div></footer></section></div>}
      {settingsOpen && <div className="settings-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">APPLICATION PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" className="panel-action" aria-label="Close Settings" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>×</button></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{settingsCategories.map((category) => <button key={category} type="button" className={settingsCategory === category ? "active" : ""} onClick={() => setSettingsCategory(category)}>{category}</button>)}</nav><div className="settings-content">{settingsContent[settingsCategory]}</div></div><footer className="settings-footer"><span>Program settings only · Project/Theme/Runtime settings stay in their canonical contexts.</span><div><button type="button" className="settings-button-secondary" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>Cancel</button><button type="button" className="settings-button-primary" onClick={() => { setSavedSettings(settingsDraft); setSettingsOpen(false); logAction("Program Settings saved"); }}>Save / Apply &amp; Close</button></div></footer></section></div>}
    </div>
  );
}
