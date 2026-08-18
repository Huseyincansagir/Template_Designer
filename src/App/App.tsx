import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createEmptyProject } from "../Domain/factories";
import { CommandHistory } from "../Core/commands";
import { InMemoryDocumentStore } from "../Core/document-store";
import { createEditorApplication, defaultWidgetName } from "../Core/editor-application";
import { buildDeploymentPackage, verifyDeploymentPackage } from "../Core/export";
import { evaluateActiveSceneBindings, evaluateBinding, selectActiveScene } from "../Core/runtime";
import { validateProject } from "../Core/validation";
import { LocalStorageProjectStorage } from "../Infrastructure/project-storage";
import type { Asset, Geometry, PrimitiveValue, Project, Rotation, RuntimeContext, Scene, ThemeProject, ThemeProjectGroup, Widget, WidgetType } from "../Domain/models";
import { DEFAULT_GRID_SIZE, DEFAULT_SNAP_THRESHOLD, calculateNudgeStep, calculateZOrderUpdates, exceedsPointerDragThreshold, getBounds, getCanvasViewFrame, hitTest, isCanonicalModifier, isCanvasKeyboardExcludedTarget, marqueeSelection, moveGeometry, normalizeRect, orderSelectionIds, resizeGeometry, screenToCanvas, selectIds, snapGeometryWithTargets, transformGeometryWithinBounds, type CanvasPoint, type CanvasRect, type CanvasViewport, type ResizeHandle, type SnapGuide, type ZOrderOperation } from "./canvas-interaction";
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

type CanvasInteractionState =
  | { mode: "idle" }
  | { mode: "marquee"; pointerId: number; start: CanvasPoint; screenStart: CanvasPoint; rect: CanvasRect; additive: boolean; baseSelection: string[] }
  | { mode: "drag" | "resize"; pointerId: number; widgetIds: string[]; start: CanvasPoint; screenStart: CanvasPoint; initial: Record<string, Geometry>; initialBounds?: CanvasRect; handle?: ResizeHandle }
  | { mode: "panning"; pointerId: number; start: CanvasPoint; initialPan: CanvasPoint };

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;

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
  const projectStorage = useMemo(() => typeof window === "undefined" ? undefined : new LocalStorageProjectStorage(window.localStorage), []);
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore(new CommandHistory(), projectStorage);
    const restored = projectStorage?.load();
    store.open(restored ?? createEmptyProject());
    return store;
  }, [projectStorage]);
  const documentSubscribe = useMemo(() => (listener: () => void) => documentStore.subscribe(listener), [documentStore]);
  const documentSnapshotReader = useMemo(() => () => documentStore.getSnapshot(), [documentStore]);
  const documentSnapshot = useSyncExternalStore(documentSubscribe, documentSnapshotReader, documentSnapshotReader);
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
  const [pan, setPan] = useState<CanvasPoint>({ x: 0, y: 0 });
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
  const [settingsDraft, setSettingsDraft] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });
  const [savedSettings, setSavedSettings] = useState({ compactDensity: true, showGrid: true, confirmDestructive: true, snapGridSize: DEFAULT_GRID_SIZE });
  const [bindingModal, setBindingModal] = useState<BindingModalState>(null);
  const editorApplication = useMemo(() => createEditorApplication(documentStore), [documentStore]);
  const commandHistory = documentStore.history;
  const [runtimeValues, setRuntimeValues] = useState<Record<string, PrimitiveValue | null>>({});
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, PrimitiveValue | null>>({});
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "paused">("idle");
  const [deploymentStatus, setDeploymentStatus] = useState("Not built");
  const [geometryOverrides, setGeometryOverrides] = useState<Record<string, Geometry>>({});
  const [canvasPointer, setCanvasPointer] = useState<CanvasInteractionState>({ mode: "idle" });
  const canvasPointerRef = useRef<CanvasInteractionState>({ mode: "idle" });
  const [snapGuides, setSnapGuides] = useState<readonly SnapGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: SelectionKind } | null>(null);
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });
  const canvasScreenRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const geometryOverridesRef = useRef<Record<string, Geometry>>({});
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

  const undo = () => {
    if (documentStore.undo()) logAction("> undo()", "EVENT");
  };

  const redo = () => {
    if (documentStore.redo()) logAction("> redo()", "EVENT");
  };

  const createProject = () => {
    cancelCanvasInteraction();
    const nextProject = createEmptyProject("Untitled Project");
    documentStore.create(nextProject);
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setOpenDocuments(["Project Overview"]);
    setActiveDocument("Project Overview");
    clearGeometryPreview();
    logAction("New document created", "EVENT");
  };

  const saveDocument = () => {
    try {
      documentStore.save();
      logAction("Project saved", "EVENT");
    } catch (error) {
      logAction(`Save failed: ${error instanceof Error ? error.message : "storage unavailable"}`, "ERROR");
    }
  };

  const openProject = (): boolean => {
    if (!projectStorage) {
      logAction("Open Project is unavailable in this build", "WARN");
      return false;
    }
    if (documentSnapshot.isDirty) {
      logAction("Open Project blocked: unsaved changes exist — Save or undo first", "WARN");
      return false;
    }
    const restored = projectStorage.load();
    if (!restored) {
      logAction("Open Project: no saved project found", "WARN");
      return false;
    }
    cancelCanvasInteraction();
    documentStore.open(restored);
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setOpenDocuments(["Project Overview"]);
    setActiveDocument("Project Overview");
    clearGeometryPreview();
    logAction("Project opened from storage", "EVENT");
    return true;
  };

  const addThemeProject = (): boolean => {
    const groupId = resolvedSelection?.group?.id ?? group?.id;
    if (!groupId) return false;
    const result = editorApplication.addThemeProject(groupId);
    if (result.changed) logAction("Theme Project added", "EVENT");
    return result.changed;
  };

  const addRotation = (): boolean => {
    const themeId = resolvedSelection?.theme?.id;
    if (!themeId || !activeProfile) return false;
    const result = editorApplication.addRotation(themeId, 0, activeProfile.display);
    if (result.changed) logAction("Rotation added", "EVENT");
    return result.changed;
  };

  const addScene = (): boolean => {
    const rotationId = resolvedSelection?.rotation?.id;
    if (!rotationId) return false;
    const result = editorApplication.addScene(rotationId);
    if (result.changed) logAction("Scene added", "EVENT");
    return result.changed;
  };

  const addWidget = (widgetType: string): boolean => {
    const sceneId = activeScene?.id;
    if (!sceneId || !activeRotation || !activeProfile) {
      logAction("Add Widget blocked: select an active Scene first", "WARN");
      return false;
    }
    if (!activeProfile.supportedWidgetTypes.includes(widgetType)) {
      logAction(`Widget type '${widgetType}' is not supported by the active DeviceProfile`, "WARN");
      return false;
    }
    const width = 120;
    const height = 80;
    const x = Math.max(0, Math.round(((activeRotation.width - width) / 2) / snapGridSize) * snapGridSize);
    const y = Math.max(0, Math.round(((activeRotation.height - height) / 2) / snapGridSize) * snapGridSize);
    const result = editorApplication.addWidget(sceneId, widgetType, { x, y, width, height });
    if (!result.changed) {
      logAction("Add Widget failed", "WARN");
      return false;
    }
    const createdId = result.createdIds?.[0];
    if (createdId) {
      setSelectedIds([createdId]);
      setSelection({ id: createdId, label: defaultWidgetName(widgetType), kind: "widget", nodeType: widgetType, detail: "Visible" });
    }
    logAction(`Widget added: ${widgetType}`, "EVENT");
    return true;
  };

  const deleteSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
    const result = widgetSelection
      ? activeScene?.id ? editorApplication.deleteSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
      : editorApplication.deleteSelection(selectedIds);
    if (!result.changed) return false;
    setSelection(null);
    setSelectedIds([]);
    logAction("Selection deleted", "EVENT");
    return true;
  };

  const duplicateSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    const widgetSelection = selectedIds.every((id) => resolveCanonicalNode(project, id)?.kind === "widget");
    const result = widgetSelection
      ? activeScene?.id ? editorApplication.duplicateSelectionInScene(activeScene.id, selectedWidgetIds) : { changed: false }
      : editorApplication.duplicateSelection(selectedIds);
    if (!result.changed) return false;
    const createdIds = result.createdIds ?? [];
    if (createdIds.length) {
      const origin = selectedIds[0] ? resolveCanonicalNode(project, selectedIds[0]) : undefined;
      const originName = origin && "name" in origin.node ? String(origin.node.name) : "";
      setSelectedIds([...createdIds]);
      setSelection({
        id: createdIds[0],
        label: createdIds.length > 1 ? `${createdIds.length} items selected` : `${originName} Copy`,
        kind: widgetSelection ? "widget" : origin?.kind ?? "canvas",
        nodeType: origin?.widget?.widgetType,
      });
    }
    logAction("Selection duplicated", "EVENT");
    return true;
  };

  const changeWidgetZOrder = (operation: ZOrderOperation): boolean => {
    const node = resolvedSelection;
    if (!node?.widget || !node.scene || activeScene?.id !== node.scene.id) return false;
    if (node.widget.locked) {
      logAction(`${node.widget.name} is locked; z-order command blocked`, "WARN");
      return false;
    }
    const updates = calculateZOrderUpdates(node.scene.widgets, node.widget.id, operation);
    if (!updates) return false;
    const result = editorApplication.setWidgetZIndicesInScene(node.scene.id, updates, `Widget ${operation}`);
    if (result.changed) logAction(`Widget ${operation} executed`, "EVENT");
    return result.changed;
  };

  const executeEditorDescriptor = (commandId: EditorCommandId) => {
    let changed = false;
    if (commandId === "project.add-theme-project") changed = addThemeProject();
    else if (commandId === "theme.add-rotation") changed = addRotation();
    else if (commandId === "rotation.add-scene") changed = addScene();
    else if (commandId.startsWith("scene.add-widget:")) changed = addWidget(commandId.slice("scene.add-widget:".length));
    else if (commandId === "widget.bring-forward" || commandId === "widget.send-backward" || commandId === "widget.bring-to-front" || commandId === "widget.send-to-back") changed = changeWidgetZOrder(commandId.replace("widget.", "") as ZOrderOperation);
    else if (commandId === "canvas.delete-selection") changed = deleteSelectionCommand();
    else if (commandId === "widget.open-properties") {
      activatePanel("properties");
      logAction("Properties panel opened", "EVENT");
      setContextMenu(null);
      return;
    }
    if (changed) logAction(`${commandId} executed`, "EVENT");
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
      setDeploymentStatus("Built · verifying…");
      const verified = await verifyDeploymentPackage(built);
      setDeploymentStatus(verified.verified ? "Built · checksum verified" : "Blocked · integrity failed");
      logAction(verified.verified ? `Package verified · ${verified.manifest.assetIds.length} asset record(s)` : "Package verification failed", verified.verified ? "INFO" : "ERROR");
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
    const nextIds = orderSelectionIds(activeScene?.widgets ?? [], selectIds(selectedIds, node.id, additive));
    setSelectedIds(nextIds);
    if (!nextIds.length) {
      setSelection(null);
    } else if (additive && selectedIds.includes(node.id)) {
      const firstId = nextIds[0];
      const first = resolveCanonicalNode(project, firstId)?.widget;
      setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
    } else {
      setSelection({ id: node.id, label: node.label, kind, nodeType, detail: node.detail });
    }
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
          <button type="button" className="tree-label" onClick={(event) => selectNode(node, event.shiftKey || isCanonicalModifier(event))} disabled={node.disabled}>
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
  const canonicalGeometry = (widget: Widget): Geometry => widget.geometry;
  const previewGeometry = (widget: Widget): Geometry => geometryOverrides[widget.id] ?? widget.geometry;
  const snapGridSize = Number.isFinite(savedSettings.snapGridSize) && savedSettings.snapGridSize > 0 ? savedSettings.snapGridSize : DEFAULT_GRID_SIZE;
  const readCanvasViewport = (): CanvasViewport | undefined => {
    const element = canvasScreenRef.current;
    if (!element) return undefined;
    const bounds = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    const borderLeft = Number.parseFloat(styles.borderLeftWidth) || 0;
    const borderRight = Number.parseFloat(styles.borderRightWidth) || 0;
    const borderTop = Number.parseFloat(styles.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0;
    return { left: bounds.left + borderLeft, top: bounds.top + borderTop, width: Math.max(0, bounds.width - borderLeft - borderRight), height: Math.max(0, bounds.height - borderTop - borderBottom) };
  };
  const selectedWidgetIds = selectedIds.filter((id) => canvasWidgets.some((widget) => widget.id === id));
  const selectedEditableWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id) && !widget.locked);
  const canvasTransform = { zoom: zoom / 100, pan, sceneWidth: canvasWidth, sceneHeight: canvasHeight };
  const canvasFrame = canvasViewportSize.width > 0 && canvasViewportSize.height > 0
    ? getCanvasViewFrame({ left: 0, top: 0, width: canvasViewportSize.width, height: canvasViewportSize.height }, canvasTransform)
    : undefined;
  const canvasLayerStyle = canvasFrame
    ? { position: "absolute" as const, left: `${canvasFrame.x}px`, top: `${canvasFrame.y}px`, width: `${canvasFrame.width}px`, height: `${canvasFrame.height}px` }
    : { position: "absolute" as const, inset: 0 };

  const toCanvasPoint = (event: { clientX: number; clientY: number }): CanvasPoint => {
    const viewport = readCanvasViewport();
    if (!viewport || viewport.width <= 0 || viewport.height <= 0) return { x: 0, y: 0 };
    return screenToCanvas({ x: event.clientX, y: event.clientY }, viewport, canvasTransform);
  };

  useEffect(() => {
    const element = canvasScreenRef.current;
    if (!element) return;
    const updateViewport = () => {
      const viewport = readCanvasViewport();
      if (viewport) setCanvasViewportSize({ width: viewport.width, height: viewport.height });
    };
    updateViewport();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateViewport);
    observer?.observe(element);
    window.addEventListener("resize", updateViewport);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  const captureCanvasPointer = (pointerId: number) => {
    activePointerIdRef.current = pointerId;
    try { canvasScreenRef.current?.setPointerCapture(pointerId); } catch { /* Pointer capture can fail after browser cancellation. */ }
  };

  // Both the React state and a ref track the interaction mode: pointer event
  // handlers read the ref so they never observe a stale render's state
  // (stale reads are what made a capture-loss event revert a just-committed
  // pan, INT-41).
  const updateCanvasPointer = (state: CanvasInteractionState) => {
    canvasPointerRef.current = state;
    setCanvasPointer(state);
  };

  const releaseCanvasPointer = (pointerId: number) => {
    if (activePointerIdRef.current === pointerId) activePointerIdRef.current = null;
    try {
      if (canvasScreenRef.current?.hasPointerCapture(pointerId)) canvasScreenRef.current.releasePointerCapture(pointerId);
    } catch { /* Pointer capture may already be released. */ }
  };

  const resetCanvasClickSuppression = () => {
    window.setTimeout(() => { suppressCanvasClickRef.current = false; }, 0);
  };

  const setGeometryPreview = (updates: Record<string, Geometry>) => {
    geometryOverridesRef.current = updates;
    setGeometryOverrides(updates);
  };

  const clearGeometryPreview = () => {
    geometryOverridesRef.current = {};
    setGeometryOverrides({});
    setSnapGuides([]);
  };

  const commitGeometryCommand = (sceneId: string | undefined, updates: Readonly<Record<string, Geometry>>, label: string) => {
    const result = sceneId ? editorApplication.setWidgetGeometriesInScene(sceneId, updates, label) : { changed: false };
    if (result.changed) logAction(`${label} committed`, "EVENT");
    clearGeometryPreview();
  };

  const cancelCanvasInteraction = () => {
    const active = canvasPointerRef.current;
    if (active.mode === "idle") {
      clearGeometryPreview();
      return;
    }
    if (activePointerIdRef.current !== null) releaseCanvasPointer(active.pointerId);
    if (active.mode === "panning") setPan(active.initialPan);
    clearGeometryPreview();
    updateCanvasPointer({ mode: "idle" });
    suppressCanvasClickRef.current = true;
    resetCanvasClickSuppression();
  };

  const beginCanvasMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasAvailable || (event.button !== 0 && event.button !== 1)) return;
    if (event.button === 1 || canvasTool === "pan") {
      event.preventDefault();
      captureCanvasPointer(event.pointerId);
      updateCanvasPointer({ mode: "panning", pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, initialPan: pan });
      return;
    }
    if ((event.target as HTMLElement).closest(".canvas-widget, .resize-handle")) return;
    event.preventDefault();
    captureCanvasPointer(event.pointerId);
    const start = toCanvasPoint(event);
    updateCanvasPointer({ mode: "marquee", pointerId: event.pointerId, start, screenStart: { x: event.clientX, y: event.clientY }, rect: { x: start.x, y: start.y, width: 0, height: 0 }, additive: event.shiftKey || isCanonicalModifier(event), baseSelection: selectedIds });
  };

  const beginWidgetMove = (widget: Widget, event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // With the Pan tool active a drag starting on a widget pans the canvas
    // (CV-01); the event must bubble to the stage's pan handler.
    if (canvasTool === "pan") return;
    event.preventDefault();
    event.stopPropagation();
    const selected = selectedWidgetIds.includes(widget.id) ? selectedWidgetIds : [widget.id];
    const editable = selected.map((id) => canvasWidgets.find((candidate) => candidate.id === id)).filter((candidate): candidate is Widget => Boolean(candidate && !candidate.locked));
    if (!editable.length) {
      selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: "Locked" });
      logAction(`${widget.name} is locked; geometry command blocked`, "WARN");
      return;
    }
    if (!selectedWidgetIds.includes(widget.id)) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.visible ? "Visible" : "Hidden" });
    captureCanvasPointer(event.pointerId);
    const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
    updateCanvasPointer({ mode: "drag", pointerId: event.pointerId, widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), screenStart: { x: event.clientX, y: event.clientY }, initial, initialBounds: getBounds(Object.values(initial)) ?? undefined });
  };

  const beginWidgetResize = (widget: Widget, handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    // Only the primary button starts a resize; the Pan tool pans instead.
    if (event.button !== 0 || canvasTool === "pan") return;
    event.preventDefault();
    event.stopPropagation();
    const selected = selectedWidgetIds.includes(widget.id) ? selectedWidgetIds : [widget.id];
    const editable = selected.map((id) => canvasWidgets.find((candidate) => candidate.id === id)).filter((candidate): candidate is Widget => Boolean(candidate && !candidate.locked));
    if (!editable.length) {
      logAction(`${widget.name} is locked; resize blocked`, "WARN");
      return;
    }
    if (!selectedWidgetIds.includes(widget.id)) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: "Selected" });
    captureCanvasPointer(event.pointerId);
    const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
    updateCanvasPointer({ mode: "resize", pointerId: event.pointerId, widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), screenStart: { x: event.clientX, y: event.clientY }, initial, initialBounds: getBounds(Object.values(initial)) ?? undefined, handle });
  };

  const beginSelectionResize = (handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || canvasTool === "pan") return;
    event.preventDefault();
    event.stopPropagation();
    const editable = selectedEditableWidgets;
    if (!editable.length) return;
    captureCanvasPointer(event.pointerId);
    const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
    updateCanvasPointer({ mode: "resize", pointerId: event.pointerId, widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), screenStart: { x: event.clientX, y: event.clientY }, initial, initialBounds: getBounds(Object.values(initial)) ?? undefined, handle });
  };

  const resizeSnapEndEdges = (handle: ResizeHandle | undefined) => ({ x: Boolean(handle && handle.includes("e")), y: Boolean(handle && handle.includes("s")) });

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = canvasPointerRef.current;
    if (pointer.mode === "idle" || event.pointerId !== pointer.pointerId) return;
    if (pointer.mode === "panning") {
      const distance = Math.hypot(event.clientX - pointer.start.x, event.clientY - pointer.start.y);
      if (exceedsPointerDragThreshold(distance)) suppressCanvasClickRef.current = true;
      // pan is stored in §4.2 Canvas units; the screen delta is divided by
      // fitScale so the content follows the cursor 1:1.
      const frameScale = canvasFrame?.scale;
      const factor = frameScale && frameScale > 0 ? frameScale : 1;
      setPan({ x: pointer.initialPan.x + (event.clientX - pointer.start.x) / factor, y: pointer.initialPan.y + (event.clientY - pointer.start.y) / factor });
      return;
    }
    const current = toCanvasPoint(event);
    const screenDistance = Math.hypot(event.clientX - pointer.screenStart.x, event.clientY - pointer.screenStart.y);
    if (pointer.mode === "marquee") {
      if (!exceedsPointerDragThreshold(screenDistance)) return;
      updateCanvasPointer({ ...pointer, rect: normalizeRect(pointer.start, current) });
      suppressCanvasClickRef.current = true;
      return;
    }
    const delta = { x: current.x - pointer.start.x, y: current.y - pointer.start.y };
    if (!exceedsPointerDragThreshold(screenDistance)) return;
    const initialBounds = pointer.initialBounds ?? getBounds(Object.values(pointer.initial));
    if (!initialBounds) return;
    const snapConfiguration = { enabled: snapEnabled, gridSize: snapGridSize, threshold: DEFAULT_SNAP_THRESHOLD };
    const otherWidgets = canvasWidgets.filter((widget) => !pointer.widgetIds.includes(widget.id) && widget.visible && widget.enabled);
    let updates: Record<string, Geometry> = {};
    if (pointer.mode === "drag") {
      const movedBounds = moveGeometry(initialBounds, delta);
      const snapped = snapGeometryWithTargets(movedBounds, snapConfiguration, otherWidgets);
      const snapDelta = { x: snapped.geometry.x - movedBounds.x, y: snapped.geometry.y - movedBounds.y };
      updates = Object.fromEntries(pointer.widgetIds.map((widgetId) => [widgetId, moveGeometry(pointer.initial[widgetId], { x: delta.x + snapDelta.x, y: delta.y + snapDelta.y })]));
      setSnapGuides(snapped.guides);
    } else {
      const resizedBounds = resizeGeometry(initialBounds, pointer.handle ?? "se", delta);
      const snapped = snapGeometryWithTargets(resizedBounds, snapConfiguration, otherWidgets, resizeSnapEndEdges(pointer.handle));
      updates = Object.fromEntries(pointer.widgetIds.map((widgetId) => {
        const next = transformGeometryWithinBounds(pointer.initial[widgetId], initialBounds, snapped.geometry);
        return [widgetId, { ...next, width: Math.max(10, next.width), height: Math.max(10, next.height) }];
      }));
      setSnapGuides(snapped.guides);
    }
    setGeometryPreview(updates);
    suppressCanvasClickRef.current = true;
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pointer = canvasPointerRef.current;
    if (pointer.mode === "idle" || event.pointerId !== pointer.pointerId) return;
    if (pointer.mode === "marquee") {
      const moved = exceedsPointerDragThreshold(Math.hypot(event.clientX - pointer.screenStart.x, event.clientY - pointer.screenStart.y));
      if (moved) {
        const nextIds = marqueeSelection(canvasWidgets, normalizeRect(pointer.start, toCanvasPoint(event)), { baseSelection: pointer.baseSelection, additive: pointer.additive, mode: "intersect" });
        setSelectedIds(nextIds);
        const first = nextIds[0] ? canvasWidgets.find((widget) => widget.id === nextIds[0]) : undefined;
        setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
        suppressCanvasClickRef.current = true;
        resetCanvasClickSuppression();
      }
      // Commit to idle BEFORE releasing capture: the synchronous
      // lostpointercapture event then sees an idle interaction and cannot
      // revert the just-completed gesture (INT-41).
      updateCanvasPointer({ mode: "idle" });
      releaseCanvasPointer(event.pointerId);
      return;
    }
    if (pointer.mode === "panning") {
      updateCanvasPointer({ mode: "idle" });
      releaseCanvasPointer(event.pointerId);
      resetCanvasClickSuppression();
      return;
    }
    const finalPoint = toCanvasPoint(event);
    const finalDelta = { x: finalPoint.x - pointer.start.x, y: finalPoint.y - pointer.start.y };
    const initialBounds = pointer.initialBounds ?? getBounds(Object.values(pointer.initial));
    if (initialBounds && exceedsPointerDragThreshold(Math.hypot(event.clientX - pointer.screenStart.x, event.clientY - pointer.screenStart.y))) {
      const snapConfiguration = { enabled: snapEnabled, gridSize: snapGridSize, threshold: DEFAULT_SNAP_THRESHOLD };
      const otherWidgets = canvasWidgets.filter((widget) => !pointer.widgetIds.includes(widget.id) && widget.visible && widget.enabled);
      const previewBounds = pointer.mode === "drag" ? moveGeometry(initialBounds, finalDelta) : resizeGeometry(initialBounds, pointer.handle ?? "se", finalDelta);
      const snapped = pointer.mode === "drag"
        ? snapGeometryWithTargets(previewBounds, snapConfiguration, otherWidgets)
        : snapGeometryWithTargets(previewBounds, snapConfiguration, otherWidgets, resizeSnapEndEdges(pointer.handle));
      const finalGeometry = pointer.mode === "drag"
        ? Object.fromEntries(pointer.widgetIds.map((widgetId) => [widgetId, moveGeometry(pointer.initial[widgetId], { x: finalDelta.x + snapped.geometry.x - previewBounds.x, y: finalDelta.y + snapped.geometry.y - previewBounds.y })]))
        : Object.fromEntries(pointer.widgetIds.map((widgetId) => {
          const next = transformGeometryWithinBounds(pointer.initial[widgetId], initialBounds, snapped.geometry);
          return [widgetId, { ...next, width: Math.max(10, next.width), height: Math.max(10, next.height) }];
        }));
      if (Object.keys(finalGeometry).length) commitGeometryCommand(activeScene?.id, finalGeometry, pointer.mode === "drag" ? "Move widget" : "Resize widget");
    } else {
      clearGeometryPreview();
    }
    updateCanvasPointer({ mode: "idle" });
    releaseCanvasPointer(event.pointerId);
    resetCanvasClickSuppression();
  };

  const handleCanvasPointerCancel = () => cancelCanvasInteraction();

  const handleCanvasClick = () => {
    if (suppressCanvasClickRef.current || canvasTool === "pan") {
      suppressCanvasClickRef.current = false;
      return;
    }
    clearSelection();
  };

  const handleCanvasKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (isCanvasKeyboardExcludedTarget(target)) return;
    const modifier = isCanonicalModifier(event);
    if (event.key === "Escape") {
      if (canvasPointer.mode !== "idle") {
        event.preventDefault();
        cancelCanvasInteraction();
      }
      return;
    }
    if (event.key.toLowerCase() === "a" && modifier) {
      event.preventDefault();
      const allIds = orderSelectionIds(canvasWidgets, canvasWidgets.map((widget) => widget.id));
      setSelectedIds(allIds);
      const first = allIds[0] ? canvasWidgets.find((widget) => widget.id === allIds[0]) : undefined;
      setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteSelectionCommand();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) || !selectedWidgetIds.length) return;
    const step = calculateNudgeStep(snapGridSize, { shift: event.shiftKey, modifier, alt: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
    if (step === null) return;
    event.preventDefault();
    const delta = { x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0 };
    const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
    if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");
  };

  useEffect(() => {
    const cancelOnBlur = () => cancelCanvasInteraction();
    window.addEventListener("blur", cancelOnBlur);
    // Fallback when pointer capture failed (INT-70): a pointer released
    // outside the canvas still ends the interaction instead of stranding it.
    const cancelOnWindowPointerUp = (event: PointerEvent) => {
      const active = canvasPointerRef.current;
      if (active.mode !== "idle" && activePointerIdRef.current === event.pointerId) cancelCanvasInteraction();
    };
    window.addEventListener("pointerup", cancelOnWindowPointerUp);
    return () => {
      window.removeEventListener("blur", cancelOnBlur);
      window.removeEventListener("pointerup", cancelOnWindowPointerUp);
    };
  });

  useEffect(() => {
    if (canvasPointer.mode !== "idle") cancelCanvasInteraction();
    else clearGeometryPreview();
    return () => { geometryOverridesRef.current = {}; };
  }, [activeDocument, activeRotation?.id, activeScene?.id]);

  useEffect(() => () => {
    geometryOverridesRef.current = {};
    if (activePointerIdRef.current !== null) releaseCanvasPointer(activePointerIdRef.current);
  }, []);

  const selectionGeometryWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id));
  const selectionBounds = getBounds(selectionGeometryWidgets.map(previewGeometry));

  const renderSnapGuide = (guide: SnapGuide) => <div key={`${guide.axis}-${guide.kind}-${guide.position}-${guide.widgetId ?? "grid"}`} className={`snap-guide snap-guide-${guide.axis} snap-guide-${guide.kind}`} style={guide.axis === "x" ? { left: `${(guide.position / canvasWidth) * 100}%` } : { top: `${(guide.position / canvasHeight) * 100}%` }} aria-hidden="true" />;

  const renderCanvasWidget = (widget: Widget) => {
    // Canonical corrections §8: invisible widgets are NOT rendered. They stay
    // selectable through the Explorer and show their selection bounds.
    if (!widget.visible) return null;
    const geometry = previewGeometry(widget);
    const selected = selectedIds.includes(widget.id);
    const style = { left: `${(geometry.x / canvasWidth) * 100}%`, top: `${(geometry.y / canvasHeight) * 100}%`, width: `${(geometry.width / canvasWidth) * 100}%`, height: `${(geometry.height / canvasHeight) * 100}%`, zIndex: widget.zIndex };
    const handles: ResizeHandle[] = ["n", "e", "s", "w", "nw", "ne", "sw", "se"];
    return <div key={widget.id} className={`canvas-widget ${selected ? "is-selected" : ""} ${widget.locked ? "is-locked" : ""}`} style={style} role="button" tabIndex={0} aria-label={`${widget.name} ${widget.widgetType}`} onPointerDown={(event) => beginWidgetMove(widget, event)} onClick={(event) => { event.stopPropagation(); if (!suppressCanvasClickRef.current) selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }, event.shiftKey || isCanonicalModifier(event)); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }); }}><span>{widget.name}</span><small>{widget.widgetType}{widget.locked ? " · locked" : ""}</small>{selected && selectedWidgetIds.length === 1 && !widget.locked && handles.map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize ${widget.name} ${handle}`} onPointerDown={(event) => beginWidgetResize(widget, handle, event)} />)}</div>;
  };

  const menuItems: Record<MenuKey, MenuItem[]> = {
    File: [
      { label: "New Project", shortcut: "Ctrl+N", onClick: createProject },
      { label: "Open Project", onClick: openProject },
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
      ...(activeProfile?.supportedWidgetTypes ?? []).map((widgetType) => ({ label: `Add ${defaultWidgetName(widgetType)} Widget`, disabled: !activeScene?.id, onClick: () => addWidget(widgetType) })),
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
    const selectedScenes = selectedIds.map((id) => resolveCanonicalNode(project, id)?.scene?.id);
    const sceneId = selectedScenes[0];
    if (!sceneId || selectedScenes.some((candidate) => candidate !== sceneId) || sceneId !== activeScene?.id) {
      logAction("Geometry edit blocked: selection is not scoped to active Scene", "WARN");
      return;
    }
    const updates: Record<string, Geometry> = {};
    selectedIds.forEach((id) => {
      const widget = resolveCanonicalNode(project, id)?.widget;
      if (!widget || widget.locked) return;
      updates[id] = { ...canonicalGeometry(widget), [field]: Math.max(field === "width" || field === "height" ? 10 : 0, value) };
    });
    if (!Object.keys(updates).length) {
      logAction("Geometry edit blocked: selection is locked or not a Widget", "WARN");
      return;
    }
    const result = editorApplication.setWidgetGeometriesInScene(sceneId, updates, `Set widget ${field}`);
    if (result.changed) logAction(`Set widget ${field}`, "EVENT");
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
            <section className="property-section"><div className="property-section-title">Geometry / Layer</div><div className="geometry-editor"><label>X<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).x : undefined) : canonicalGeometry(widget).x} disabled={canvasPointer.mode !== "idle" || multi || widget.locked} onChange={(event) => commitSelectionGeometryField("x", Number(event.target.value))} /></label><label>Y<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).y : undefined) : canonicalGeometry(widget).y} disabled={canvasPointer.mode !== "idle" || multi || widget.locked} onChange={(event) => commitSelectionGeometryField("y", Number(event.target.value))} /></label><label>W<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).width : undefined) : canonicalGeometry(widget).width} disabled={canvasPointer.mode !== "idle" || multi || widget.locked} onChange={(event) => commitSelectionGeometryField("width", Number(event.target.value))} /></label><label>H<input type={multi ? "text" : "number"} value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).height : undefined) : canonicalGeometry(widget).height} disabled={canvasPointer.mode !== "idle" || multi || widget.locked} onChange={(event) => commitSelectionGeometryField("height", Number(event.target.value))} /></label></div><PropertyRow label="Locked" value={multi ? valueFor((current) => current.widget?.locked) : String(widget.locked)} /><PropertyRow label="Visible" value={multi ? valueFor((current) => current.widget?.visible) : String(widget.visible)} /><PropertyRow label="Z-order" value={String(widget.zIndex)} /></section>
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
    Canvas: <><h3>Canvas</h3><p>Canvas preferences are application UI defaults and do not change runtime semantics.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.showGrid} onChange={(event) => setSettingsDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> Show grid by default</label><label className="settings-check"><span>Snap grid size</span><input className="settings-number" type="number" min="1" step="1" value={settingsDraft.snapGridSize} onChange={(event) => setSettingsDraft((current) => ({ ...current, snapGridSize: Math.max(1, Number(event.target.value) || DEFAULT_GRID_SIZE) }))} /></label></>,
    Assets: <><h3>Assets</h3><p>Asset Browser is a depot/library view. Resources, Scene Content and Unsupported Files remain separate.</p><div className="settings-value">Preview mode <strong>Profile-supported</strong></div></>,
    Simulator: <><h3>Simulator</h3><p>Simulator consumes canonical DeviceProfile runtime state and settings registries.</p><div className="settings-value">Rule system <strong>Canonical evaluator</strong></div></>,
    Validation: <><h3>Validation</h3><p>Validation issues are sourced from the shared validation service.</p><div className="settings-value">Severity <strong>Profile-aware</strong></div></>,
    Export: <><h3>Export</h3><p>Export scope is controlled by canonical Resources + Used + Default asset rules.</p><div className="settings-value">Format conversion <strong>Not in V1</strong></div></>,
    Shortcuts: <><h3>Shortcuts</h3><p>Confirmed shortcuts are shown by the command registry; Proposed shortcuts are not presented as settled product behavior.</p><div className="shortcut-list"><span>Ctrl+S <strong>Save</strong></span><span>Ctrl+Z <strong>Undo</strong></span><span>R <strong>90° rotation</strong></span></div></>,
  };

  return (
    <div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)} onKeyDown={handleCanvasKeyDown}>
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
            <div className={`canvas-stage ${gridVisible ? "show-grid" : ""} ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={() => { if (!suppressCanvasClickRef.current) clearSelection(); setContextMenu(null); }}><div className="canvas-rail-label">{viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}</div><div className="device-canvas-wrap" onClick={(event) => event.stopPropagation()}><div className="device-frame" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}><div className="device-frame-header"><span>DISPLAY</span><span>{activeRotation ? `R${activeRotation.angle} · ${canvasWidth} × ${canvasHeight}` : "No rotation selected"}</span></div><div className="device-screen" ref={canvasScreenRef} tabIndex={0} onClick={handleCanvasClick} onPointerDown={beginCanvasMarquee} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerCancel={handleCanvasPointerCancel} onLostPointerCapture={handleCanvasPointerCancel} onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
      const point = toCanvasPoint(event);
      const hitId = canvasAvailable ? hitTest(point, canvasWidgets) : null;
      if (hitId) {
        const hitWidget = canvasWidgets.find((widget) => widget.id === hitId);
        if (hitWidget) selectNode({ id: hitWidget.id, label: hitWidget.name, kind: hitWidget.widgetType, nodeType: hitWidget.widgetType, detail: hitWidget.locked ? "Locked" : "Visible" });
        setContextMenu({ x: event.clientX, y: event.clientY, kind: "widget" });
      } else if (activeScene) {
        setContextMenu({ x: event.clientX, y: event.clientY, kind: "scene" });
      } else {
        setContextMenu(null);
      }
    }}><div className="canvas-widget-layer" style={canvasLayerStyle}>{canvasAvailable && snapGuides.map(renderSnapGuide)}{canvasAvailable && selectionBounds && <div className="selection-bounds" style={{ left: `${(selectionBounds.x / canvasWidth) * 100}%`, top: `${(selectionBounds.y / canvasHeight) * 100}%`, width: `${(selectionBounds.width / canvasWidth) * 100}%`, height: `${(selectionBounds.height / canvasHeight) * 100}%` }}>{selectedWidgetIds.length > 1 && selectedEditableWidgets.length > 0 && (["n", "e", "s", "w", "nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize selection ${handle}`} onPointerDown={(event) => beginSelectionResize(handle, event)} />)}</div>}{canvasAvailable && canvasWidgets.map(renderCanvasWidget)}{canvasPointer.mode === "marquee" && <div className="selection-marquee" style={{ left: `${(canvasPointer.rect.x / canvasWidth) * 100}%`, top: `${(canvasPointer.rect.y / canvasHeight) * 100}%`, width: `${(canvasPointer.rect.width / canvasWidth) * 100}%`, height: `${(canvasPointer.rect.height / canvasHeight) * 100}%` }} />}{(!canvasAvailable || canvasWidgets.length === 0) && <div className="canvas-empty-state"><span className="empty-glyph">◇</span><strong>{!activeProfile ? "DeviceProfile unavailable" : activeScene?.name ?? (hasThemeProject ? "Select a Scene or Widget" : "No Theme Project")}</strong><span>{!activeProfile ? "Register the canonical DeviceProfile before editing this display." : activeScene ? "Scene contains no widgets." : "Create or select a canonical Rotation and Scene to begin canvas editing."}</span></div>}</div></div><div className="device-frame-footer"><span>ASPECT LOCKED</span><span>R{activeRotation?.angle ?? 0}</span></div></div></div><div className="canvas-overlay-note">{activeScene ? `${activeScene.name} · ${canvasWidgets.length} widget(s)` : "Canvas shell · select a canonical Rotation or Scene"}</div></div>
            <div className="canvas-context-bar"><div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}</div><div className="context-actions"><button type="button" className="context-action" disabled={!activeScene?.id || !activeProfile?.supportedWidgetTypes.length} onClick={() => addWidget(activeProfile?.supportedWidgetTypes[0] ?? "")} title={activeScene?.id ? "Add a widget to the active Scene" : "Requires an active Scene"}>Add Widget</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={duplicateSelectionCommand} title={selectedWidgetIds.length ? "Duplicate selected widget" : "Requires a selected widget"}>Duplicate</button><button type="button" className="context-action" disabled title="Requires a selected widget">Align</button><button type="button" className="context-action" disabled title="Requires a selected widget">Lock</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={deleteSelectionCommand} title={selectedWidgetIds.length ? "Delete selected widget" : "Requires a selected widget"}>Delete</button></div></div>
          </section>
          {rightVisible && <div className="splitter" role="separator" aria-label="Resize right panel" onPointerDown={(event) => beginResize("right", event)} />}
          {activeRightPanel && renderPanelContainer(activeRightPanel, activeRightPanel === "properties" ? renderProperties() : renderSimulator())}
        </div>
        {consoleVisible && <section className="console-panel" aria-label="Console and validation">{renderConsole()}</section>}
        {floatingPanels.map((panel) => renderPanelContainer(panel, panel === "explorer" ? renderExplorer() : panel === "assets" ? renderAssets() : panel === "properties" ? renderProperties() : panel === "simulator" ? renderSimulator() : renderConsole()))}
      </main>

      {contextMenu && commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).length > 0 && <div className="editor-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).map((command) => <button type="button" key={command.id} onClick={() => executeEditorDescriptor(command.id)}><span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}</div>}

      <footer className="statusbar"><span><span className="status-led" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span><span>{profileStatus} · Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span><span>{deploymentStatus} · Document: {documentSnapshot.isDirty ? "dirty" : "clean"} · Browser core · Tauri shell reserved</span></footer>

      {bindingModal && <div className="settings-backdrop" role="presentation" onClick={() => setBindingModal(null)}><section className="binding-dialog" role="dialog" aria-modal="true" aria-labelledby="binding-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">CANONICAL PRESENTATION</span><h2 id="binding-title">Binding Editor</h2></div><button type="button" className="panel-action" aria-label="Close Binding Editor" onClick={() => setBindingModal(null)}>×</button></header><div className="binding-layout"><div className="binding-context-card"><span className="context-icon has-selection">◇</span><div><strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Binding is evaluated inside the active Scene</small></div></div><div className="binding-section"><div className="property-section-title">Bindings</div>{bindingWidget?.bindings.length ? bindingWidget.bindings.map((binding, index) => { const evaluation = bindingEvaluations[index]; return <div className="binding-card" key={binding.id}><div className="binding-card-head"><strong>{binding.action}</strong><span className={evaluation?.matched ? "binding-true" : "binding-false"}>{evaluation?.matched ? "TRUE" : "FALSE"}</span></div><div className="binding-condition-list">{binding.conditions.map((condition, conditionIndex) => { const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === condition.stateId); return <div className="binding-condition" key={`${binding.id}-${conditionIndex}`}><span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? condition.stateId}</span><code>{condition.operator} {String(condition.value)}</code></div>; })}</div><small>Target widget: {evaluation?.widgetId ?? binding.widgetId} · content/style: {binding.contentId ?? "presentation"}</small></div>; }) : <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No bindings on this widget</strong><span>Binding records remain in the canonical Widget model; this surface does not invent scene selection rules.</span></div>}</div><div className="binding-section"><div className="property-section-title">DeviceProfile Registry</div><div className="binding-registry-grid"><div><strong>Runtime States</strong>{profileStates.length ? profileStates.map((state) => <span key={state.id}>{state.displayName}<small>{state.type}</small></span>) : <em>Empty registry</em>}</div><div><strong>Runtime Settings</strong>{profileSettings.length ? profileSettings.map((setting) => <span key={setting.id}>{setting.displayName}<small>{setting.type}</small></span>) : <em>Empty registry</em>}</div></div></div></div><footer className="settings-footer"><span>Positive/negative conditions and actions are constrained by the active DeviceProfile.</span><div><button type="button" className="settings-button-secondary" disabled title="Command-backed binding creation is the next UI command phase">Add Binding</button><button type="button" className="settings-button-primary" onClick={() => setBindingModal(null)}>Close</button></div></footer></section></div>}
      {settingsOpen && <div className="settings-backdrop" role="presentation" onClick={() => setSettingsOpen(false)}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(event) => event.stopPropagation()}><header className="settings-header"><div><span className="panel-kicker">APPLICATION PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" className="panel-action" aria-label="Close Settings" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>×</button></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{settingsCategories.map((category) => <button key={category} type="button" className={settingsCategory === category ? "active" : ""} onClick={() => setSettingsCategory(category)}>{category}</button>)}</nav><div className="settings-content">{settingsContent[settingsCategory]}</div></div><footer className="settings-footer"><span>Program settings only · Project/Theme/Runtime settings stay in their canonical contexts.</span><div><button type="button" className="settings-button-secondary" onClick={() => { setSettingsDraft(savedSettings); setSettingsOpen(false); }}>Cancel</button><button type="button" className="settings-button-primary" onClick={() => { setSavedSettings(settingsDraft); setSettingsOpen(false); logAction("Program Settings saved"); }}>Save / Apply &amp; Close</button></div></footer></section></div>}
    </div>
  );
}
