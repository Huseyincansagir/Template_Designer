import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createEmptyProject } from "../Domain/factories";
import { CommandHistory } from "../Core/commands";
import { InMemoryDocumentStore } from "../Core/document-store";
import { createEditorApplication, defaultWidgetName, type MutationResult } from "../Core/editor-application";
import { buildDeploymentPackage, verifyDeploymentPackage } from "../Core/export";
import { evaluateActiveSceneBindings, evaluateBinding, selectActiveScene } from "../Core/runtime";
import { validateProject } from "../Core/validation";
import { LocalStorageProjectStorage } from "../Infrastructure/project-storage";
import { LocalStorageProgramSettings, defaultProgramSettings, type ProgramSettings } from "../Infrastructure/program-settings-storage";
import type { Asset, Binding, Geometry, PrimitiveValue, Project, Rotation, RuntimeContext, RuntimeSettingDefinition, RuntimeStateDefinition, RuntimeValueType, Scene, ThemeProject, ThemeProjectGroup, Widget, WidgetType } from "../Domain/models";
import { DEFAULT_GRID_SIZE, DEFAULT_SNAP_THRESHOLD, calculateNudgeStep, calculateZOrderUpdates, exceedsPointerDragThreshold, getBounds, getCanvasViewFrame, hitTest, isCanonicalModifier, isCanvasKeyboardExcludedTarget, marqueeSelection, moveGeometry, normalizeRect, orderSelectionIds, resizeGeometry, screenToCanvas, selectIds, snapGeometryWithTargets, transformGeometryWithinBounds, type CanvasPoint, type CanvasRect, type CanvasViewport, type ResizeHandle, type SnapGuide, type ZOrderOperation } from "./canvas-interaction";
import { commandsForSelection, type EditorCommandId } from "./editor-commands";
import type { PanelId, PanelMode, SelectionKind } from "./editor-types";
import { activateDockedPanel, defaultPanelLayout, floatingPanels as getFloatingPanels, setPanelLayoutMode } from "./panel-manager";
import { canonicalShortcuts, matchShortcut, shortcutDisplay, shortcutRegistry } from "./shortcut-registry";
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
  time: string;
};

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
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

function collectTreeNodeIds(project: Project): string[] {
  const ids = [project.id];
  for (const group of project.themeProjectGroups) {
    ids.push(group.id);
    for (const theme of group.themeProjects) {
      ids.push(theme.id);
      for (const rotation of theme.rotations) ids.push(rotation.id);
    }
  }
  return ids;
}

type GeometryFieldProps = {  label: string;
  field: keyof Geometry;
  value: string | number;
  multi: boolean;
  disabled: boolean;
  min: number;
  max: number;
  onCommit: (field: keyof Geometry, value: number) => void;
};

/**
 * Draft-per-field geometry input: commits exactly once on blur or Enter,
 * treats an empty field as "pending" (never 0), rejects non-numeric input
 * with visible feedback, and clamps to [min, max] with feedback.
 */
function GeometryField({ label, field, value, multi, disabled, min, max, onCommit }: GeometryFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setFeedback("invalid value — reverted");
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setFeedback(clamped !== parsed ? `clamped to ${clamped}` : null);
    onCommit(field, clamped);
  };
  return (
    <label className={`geometry-field ${feedback ? "has-feedback" : ""}`}>
      <span className="geometry-field-label">{label}<small>scene units</small></span>
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? (multi ? "" : String(value))}
        placeholder={multi ? "*" : undefined}
        disabled={disabled}
        aria-label={`${label} in scene units`}
        aria-describedby={feedback ? `geometry-feedback-${label}` : undefined}
        onChange={(event) => { setDraft(event.target.value); setFeedback(null); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") { setDraft(null); setFeedback(null); (event.target as HTMLInputElement).blur(); }
        }}
      />
      {feedback && <span className="geometry-feedback" id={`geometry-feedback-${label}`} role="status">{feedback}</span>}
    </label>
  );
}

/**
 * Coerces raw simulator input to the declared RuntimeValueType (INT-55):
 * integer/number inputs become numbers, invalid or empty input becomes
 * null (unset) instead of a string that can never match a condition.
 */
function coerceRuntimeInput(raw: string, type: RuntimeValueType): PrimitiveValue | null {
  if (raw.trim() === "") return null;
  if (type === "integer") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === "number") {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return raw;
}

function coerceBindingDraftValue(raw: string, type: RuntimeValueType): PrimitiveValue | null {
  if (type === "boolean") return raw === "true";
  return coerceRuntimeInput(raw, type);
}

function renderRuntimeInput(
  definition: RuntimeStateDefinition | RuntimeSettingDefinition,
  current: PrimitiveValue | null | undefined,
  onChange: (value: PrimitiveValue | null) => void,
) {
  if (definition.type === "boolean") {
    return <input type="checkbox" checked={current === true} onChange={(event) => onChange(event.target.checked)} />;
  }
  if (definition.type === "enum" && definition.enumValues) {
    return (
      <select value={current == null ? "" : String(current)} onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}>
        <option value="">Unset</option>
        {definition.enumValues.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    );
  }
  return (
    <input
      type={definition.type === "integer" || definition.type === "number" ? "number" : "text"}
      step={definition.type === "number" ? "any" : "1"}
      value={current == null ? "" : String(current)}
      placeholder="Unset"
      onChange={(event) => onChange(coerceRuntimeInput(event.target.value, definition.type))}
    />
  );
}

type DraftNumberFieldProps = {
  value: string | number;
  disabled: boolean;
  min: number;
  max: number;
  ariaLabel: string;
  onCommit: (value: number) => void;
};

/** Draft-per-field numeric input shared by non-geometry properties (zIndex, priority). */
function DraftNumberField({ value, disabled, min, max, ariaLabel, onCommit }: DraftNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setFeedback("invalid — reverted");
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setFeedback(clamped !== parsed ? `clamped to ${clamped}` : null);
    onCommit(clamped);
  };
  return (
    <span className={`draft-number-field ${feedback ? "has-feedback" : ""}`}>
      <input
        type="text"
        inputMode="numeric"
        value={draft ?? String(value)}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => { setDraft(event.target.value); setFeedback(null); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") { setDraft(null); setFeedback(null); (event.target as HTMLInputElement).blur(); }
        }}
      />
      {feedback && <small className="geometry-feedback" role="status">{feedback}</small>}
    </span>
  );
}

type DraftTextFieldProps = {
  value: string;
  disabled: boolean;
  placeholder?: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
};

/** Draft-per-field text input for rename surfaces: commit once on blur/Enter, Escape reverts. */
function DraftTextField({ value, disabled, placeholder, ariaLabel, onCommit }: DraftTextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const trimmed = draft.trim();
    if (trimmed.length === 0 || trimmed === value) return;
    onCommit(trimmed);
  };
  return (
    <input
      type="text"
      value={draft ?? value}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") { setDraft(null); (event.target as HTMLInputElement).blur(); }
      }}
    />
  );
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
  const [leftDockTab, setLeftDockTab] = useState<"explorer" | "assets">("explorer");
  const [rightDockTab, setRightDockTab] = useState<"properties" | "simulator">("properties");
  const [leftWidth, setLeftWidth] = useState(286);
  const [rightWidth, setRightWidth] = useState(298);
  const [menuOpen, setMenuOpen] = useState<MenuKey | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("design");
  const [canvasTool, setCanvasTool] = useState<CanvasTool>("select");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const settingsStorage = useMemo(() => typeof window === "undefined" ? undefined : new LocalStorageProgramSettings(window.localStorage), []);
  const [settingsDraft, setSettingsDraft] = useState<ProgramSettings>(() => settingsStorage?.load() ?? { ...defaultProgramSettings });
  const [savedSettings, setSavedSettings] = useState<ProgramSettings>(() => settingsStorage?.load() ?? { ...defaultProgramSettings });
  const [gridVisible, setGridVisible] = useState(() => settingsStorage?.load().showGrid ?? true);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState<CanvasPoint>({ x: 0, y: 0 });
  const [consoleTab, setConsoleTab] = useState<"console" | "validation">("console");
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    { level: "INFO", message: "Foundation shell initialized", time: "" },
  ]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("depot");
  const [assetSearch, setAssetSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("General");
  const [bindingModal, setBindingModal] = useState<BindingModalState>(null);
  const [clipboard, setClipboard] = useState<{ widgets: Widget[]; cut: boolean } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmRequest | null>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [bindingDraft, setBindingDraft] = useState<{ stateId: string; operator: string; value: string; negated: boolean; action: string }>({ stateId: "", operator: "equals", value: "", negated: false, action: "show" });
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
  const suppressCanvasClicksUntilRef = useRef(0);

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
  // Explicit Scene activation order: document order is the V1 simulator's
  // tie-break (runtime activation-order tracking arrives with the real
  // simulator transport, recorded as deferred).
  const sceneActivationOrder = useMemo(() => {
    const order: Record<string, number> = {};
    (runtimeRotation?.scenes ?? []).forEach((scene, index) => { order[scene.id] = index; });
    return order;
  }, [runtimeRotation]);
  const runtimeContext: RuntimeContext = { values: runtimeValues, settings: runtimeSettings, sceneActivationOrder };
  const runtime = useMemo(() => activeProfile ? selectActiveScene(runtimeRotation?.scenes ?? [], runtimeContext, activeProfile) : { activeSceneId: undefined, activeScene: undefined, candidates: [] }, [runtimeRotation, activeProfile, runtimeValues, runtimeSettings]);
  const activeBindings = useMemo(() => activeProfile && runtime.activeScene ? evaluateActiveSceneBindings(runtime.activeScene, runtimeContext, activeProfile) : [], [runtime.activeScene, activeProfile, runtimeValues, runtimeSettings]);
  const bindingWidget = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId)?.widget : undefined;
  const profileStates = activeProfile?.runtimeStates ?? [];
  const profileSettings = activeProfile?.runtimeSettings ?? [];
  const bindingDraftDefinition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === bindingDraft.stateId);
  const bindingEvaluations = useMemo(() => bindingWidget && activeProfile ? bindingWidget.bindings.map((binding) => evaluateBinding(binding, runtimeContext, activeProfile)) : [], [bindingWidget, activeProfile, runtimeValues, runtimeSettings]);
  const activeLeftPanel = leftDockTab === "explorer" && panelModes.explorer === "docked" ? "explorer"
    : leftDockTab === "assets" && panelModes.assets === "docked" ? "assets"
      : panelModes.explorer === "docked" ? "explorer"
        : panelModes.assets === "docked" ? "assets" : null;
  const activeRightPanel = rightDockTab === "properties" && panelModes.properties === "docked" ? "properties"
    : rightDockTab === "simulator" && panelModes.simulator === "docked" ? "simulator"
      : panelModes.properties === "docked" ? "properties"
        : panelModes.simulator === "docked" ? "simulator" : null;
  const leftVisible = activeLeftPanel !== null;
  const rightVisible = activeRightPanel !== null;
  const consoleVisible = panelModes.console === "docked";
  const floatingPanels = getFloatingPanels(panelModes);
  const workspaceRows = consoleVisible ? "minmax(0, 1fr) 156px" : "minmax(0, 1fr) 0px";
  const editorColumns = `${leftVisible ? `${leftWidth}px` : "0px"} ${leftVisible ? "5px" : "0px"} minmax(0, 1fr) ${rightVisible ? "5px" : "0px"} ${rightVisible ? `${rightWidth}px` : "0px"}`;

  const logAction = (message: string, level: ConsoleEntry["level"] = "INFO") => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setConsoleEntries((current) => [...current.slice(-199), { level, message, time }]);
    setMenuOpen(null);
  };

  const undo = () => {
    if (documentStore.undo()) logAction("> undo()", "EVENT");
  };

  const redo = () => {
    if (documentStore.redo()) logAction("> redo()", "EVENT");
  };

  // Selection reconciliation (INT-25/Scenario F): after undo/redo (or any
  // project change) a selection that no longer resolves is cleared, and
  // stale ids are pruned — no surface may keep pointing at a deleted node.
  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => Boolean(resolveCanonicalNode(project, id)));
      return next.length === current.length ? current : next;
    });
    setSelection((current) => {
      if (!current) return current;
      return resolveCanonicalNode(project, current.id) ? current : null;
    });
  }, [project]);

  const createProject = () => {
    cancelCanvasInteraction();
    const nextProject = createEmptyProject("Untitled Project");
    documentStore.create(nextProject);
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setExpandedNodes({});
    setRuntimeValues({});
    setRuntimeSettings({});
    setSimulationStatus("idle");
    setDeploymentStatus("Not built");
    setClipboard(null);
    clearGeometryPreview();
    logAction("New document created", "EVENT");
  };

  const requestNewProject = () => {
    if (documentSnapshot.isDirty && savedSettings.confirmDestructive) {
      setConfirmState({
        title: "New Project",
        message: "The current project has unsaved changes. Creating a new project discards them.",
        confirmLabel: "Discard & Create",
        onConfirm: () => createProject(),
      });
      return;
    }
    createProject();
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
    setExpandedNodes({});
    setRuntimeValues({});
    setRuntimeSettings({});
    setSimulationStatus("idle");
    setDeploymentStatus("Not built");
    setClipboard(null);
    clearGeometryPreview();
    logAction("Project opened from storage", "EVENT");
    return true;
  };

  const addThemeProject = (): boolean => {
    const groupId = resolvedSelection?.group?.id ?? group?.id;
    if (!groupId) return false;
    const result = editorApplication.addThemeProject(groupId);
    if (result.changed) {
      const createdId = result.createdIds?.[0];
      if (createdId) {
        setExpandedNodes((current) => ({ ...current, [groupId]: true, [createdId]: true }));
        setSelectedIds([createdId]);
        setSelection({ id: createdId, label: "New Theme Project", kind: "theme" });
      }
      logAction("Theme Project added", "EVENT");
    }
    return result.changed;
  };

  const addRotation = (): boolean => {
    const themeId = resolvedSelection?.theme?.id;
    if (!themeId || !activeProfile) return false;
    const result = editorApplication.addRotation(themeId, 0, activeProfile.display);
    if (result.changed) {
      const createdId = result.createdIds?.[0];
      if (createdId) {
        setExpandedNodes((current) => ({ ...current, [themeId]: true, [createdId]: true }));
        setSelectedIds([createdId]);
        setSelection({ id: createdId, label: "R0", kind: "rotation", detail: `${activeProfile.display.width} × ${activeProfile.display.height}` });
      }
      logAction("Rotation added", "EVENT");
    }
    return result.changed;
  };

  const addScene = (): boolean => {
    const rotationId = resolvedSelection?.rotation?.id;
    if (!rotationId) return false;
    const result = editorApplication.addScene(rotationId);
    if (result.changed) {
      const createdId = result.createdIds?.[0];
      if (createdId) {
        setExpandedNodes((current) => ({ ...current, [rotationId]: true }));
        setSelectedIds([createdId]);
        setSelection({ id: createdId, label: "New Scene", kind: "scene", detail: "Priority 0" });
      }
      logAction("Scene added", "EVENT");
    }
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
      // Expand the parent Scene (and its Rotation) so the new widget is
      // immediately visible in the Explorer (Scenario C: parent expands when
      // necessary).
      const parent = resolveCanonicalNode(project, sceneId);
      setExpandedNodes((current) => ({
        ...current,
        ...(parent?.scene ? { [parent.scene.id]: true } : {}),
        ...(parent?.rotation ? { [parent.rotation.id]: true } : {}),
      }));
      setSelectedIds([createdId]);
      setSelection({ id: createdId, label: defaultWidgetName(widgetType), kind: "widget", nodeType: widgetType, detail: "Visible" });
    }
    logAction(`Widget added: ${widgetType}`, "EVENT");
    return true;
  };

  const performDeleteSelection = (): boolean => {
    if (!selectedIds.length) return false;
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    const allWidgets = kinds.length > 0 && kinds.every((kind) => kind === "widget");
    if (kinds.some((kind) => kind === "widget") && !allWidgets) {
      logAction("Delete blocked: mixed widget and container selection. Select widgets only or containers only.", "WARN");
      return false;
    }
    if (allWidgets) {
      const sceneWidgetIds = selectedWidgetIds;
      const dropped = selectedIds.length - sceneWidgetIds.length;
      if (dropped > 0) logAction(`${dropped} selected widget(s) outside the active Scene ignored`, "WARN");
      if (!sceneWidgetIds.length || !activeScene?.id) return false;
      const result = editorApplication.deleteSelectionInScene(activeScene.id, sceneWidgetIds);
      if (!result.changed) return false;
    } else {
      const result = editorApplication.deleteSelection(selectedIds);
      if (!result.changed) {
        logAction("Delete refused: a project must keep at least one Theme Project Group", "WARN");
        return false;
      }
    }
    setSelection(null);
    setSelectedIds([]);
    canvasScreenRef.current?.focus();
    logAction("Selection deleted", "EVENT");
    return true;
  };

  const deleteSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    if (savedSettings.confirmDestructive) {
      setConfirmState({
        title: "Delete Selection",
        message: selectedIds.length > 1 ? `Delete ${selectedIds.length} selected item(s)? This is undoable.` : "Delete the selected item? This is undoable.",
        confirmLabel: "Delete",
        onConfirm: () => performDeleteSelection(),
      });
      return true;
    }
    return performDeleteSelection();
  };

  const duplicateSelectionCommand = (): boolean => {
    if (!selectedIds.length) return false;
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    const allWidgets = kinds.length > 0 && kinds.every((kind) => kind === "widget");
    if (kinds.some((kind) => kind === "widget") && !allWidgets) {
      logAction("Duplicate blocked: mixed widget and container selection.", "WARN");
      return false;
    }
    let result: MutationResult;
    if (allWidgets) {
      const sceneWidgetIds = selectedWidgetIds;
      const dropped = selectedIds.length - sceneWidgetIds.length;
      if (dropped > 0) logAction(`${dropped} selected widget(s) outside the active Scene ignored`, "WARN");
      result = activeScene?.id ? editorApplication.duplicateSelectionInScene(activeScene.id, sceneWidgetIds) : { changed: false };
    } else {
      result = editorApplication.duplicateSelection(selectedIds);
    }
    if (!result.changed) return false;
    const createdIds = result.createdIds ?? [];
    if (createdIds.length) {
      const origin = selectedIds[0] ? resolveCanonicalNode(project, selectedIds[0]) : undefined;
      const originName = origin && "name" in origin.node ? String(origin.node.name) : "";
      setSelectedIds([...createdIds]);
      setSelection({
        id: createdIds[0],
        label: createdIds.length > 1 ? `${createdIds.length} items selected` : `${originName} Copy`,
        kind: allWidgets ? "widget" : origin?.kind ?? "canvas",
        nodeType: origin?.widget?.widgetType,
      });
    }
    logAction("Selection duplicated", "EVENT");
    return true;
  };

  const copySelection = (): boolean => {
    if (!selectedWidgetIds.length || !activeScene) {
      logAction("Copy requires a selected widget in the active Scene", "WARN");
      return false;
    }
    const definitions = activeScene.widgets.filter((widget) => selectedWidgetIds.includes(widget.id));
    setClipboard({ widgets: structuredClone(definitions), cut: false });
    logAction(`${definitions.length} widget(s) copied`, "EVENT");
    return true;
  };

  const cutSelection = (): boolean => {
    if (!copySelection()) return false;
    setClipboard((current) => current ? { ...current, cut: true } : current);
    if (!performDeleteSelection()) {
      setClipboard(null);
      return false;
    }
    logAction("Widgets cut", "EVENT");
    return true;
  };

  const pasteSelection = (): boolean => {
    if (!clipboard || !clipboard.widgets.length || !activeScene?.id) {
      logAction("Paste requires a copied widget and an active Scene", "WARN");
      return false;
    }
    const result = editorApplication.insertWidgetCopies(activeScene.id, clipboard.widgets);
    if (!result.changed) return false;
    const createdIds = result.createdIds ?? [];
    if (createdIds.length) {
      setSelectedIds([...createdIds]);
      setSelection({ id: createdIds[0], label: createdIds.length > 1 ? `${createdIds.length} items selected` : `${clipboard.widgets[0].name} Copy`, kind: "widget", nodeType: clipboard.widgets[0].widgetType });
    }
    logAction(`${createdIds.length} widget(s) pasted`, "EVENT");
    if (clipboard.cut) setClipboard(null);
    return true;
  };

  const setDeviceProfile = (profileId: string): boolean => {
    const result = editorApplication.setProjectDeviceProfile(profileId);
    if (result.changed) logAction(`Device Profile switched to ${profileId}`, "EVENT");
    return result.changed;
  };

  const toggleWidgetProperty = (property: "locked" | "visible" | "enabled"): boolean => {
    const sceneId = activeScene?.id;
    const selected = activeScene?.widgets.filter((widget) => selectedWidgetIds.includes(widget.id)) ?? [];
    if (!sceneId || !selected.length) {
      logAction("Toggle requires a selected widget in the active Scene", "WARN");
      return false;
    }
    const allSet = selected.every((widget) => widget[property]);
    const result = editorApplication.setWidgetsPropertiesInScene(sceneId, selected.map((widget) => widget.id), { [property]: !allSet });
    if (result.changed) logAction(`${property === "locked" ? (allSet ? "Unlock" : "Lock") : property === "visible" ? (allSet ? "Show" : "Hide") : allSet ? "Disable" : "Enable"} applied to ${selected.length} widget(s)`, "EVENT");
    return result.changed;
  };

  const setAllWidgetsVisibility = (visible: boolean): boolean => {
    const sceneId = activeScene?.id;
    if (!sceneId || !canvasWidgets.length) {
      logAction("Hide/Show All requires a Scene with widgets", "WARN");
      return false;
    }
    const result = editorApplication.setWidgetsVisibilityInScene(sceneId, canvasWidgets.map((widget) => widget.id), visible);
    if (result.changed) logAction(visible ? "Show All executed" : "Hide All executed", "EVENT");
    return result.changed;
  };

  const renameSelectedNode = (name: string): boolean => {
    if (!selection) return false;
    const result = editorApplication.renameNode(selection.id, name);
    if (result.changed) {
      // Keep the selection label in sync with the renamed node (INT-24):
      // the snapshot must not stay stale after a rename.
      setSelection((current) => current && current.id === selection.id ? { ...current, label: name.trim() } : current);
      logAction(`Renamed to ${name.trim()}`, "EVENT");
    }
    return result.changed;
  };

  const enterDuplicateMode = (): boolean => {
    if (!selectedWidgetIds.length || !activeScene?.id) {
      logAction("Duplicate Mode requires a selected widget in the active Scene", "WARN");
      return false;
    }
    setDuplicateMode(true);
    logAction("Duplicate Mode: click the canvas to place copies · Esc exits", "EVENT");
    return true;
  };

  const addBinding = (): boolean => {
    const resolved = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId) : undefined;
    const sceneId = resolved?.scene?.id;
    const widget = resolved?.widget;
    if (!sceneId || !widget || !bindingDraft.stateId) {
      logAction("Add Binding: select a DeviceProfile state and a widget first", "WARN");
      return false;
    }
    const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === bindingDraft.stateId);
    if (!definition) {
      logAction("Add Binding: the selected state is not defined by the active DeviceProfile", "WARN");
      return false;
    }
    const value = coerceBindingDraftValue(bindingDraft.value, definition.type);
    if (value === null) {
      logAction("Add Binding: the condition value does not match its DeviceProfile type", "WARN");
      return false;
    }
    const binding: Binding = {
      id: `binding-${typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
      widgetId: widget.id,
      conditions: [{ stateId: bindingDraft.stateId, operator: bindingDraft.operator as Binding["conditions"][number]["operator"], value, negated: bindingDraft.negated || undefined }],
      action: bindingDraft.action as Binding["action"],
    };
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, [...widget.bindings, binding]);
    if (result.changed) {
      logAction(`Binding added: ${bindingDraft.stateId} → ${bindingDraft.action}`, "EVENT");
      setBindingDraft({ stateId: "", operator: "equals", value: "", negated: false, action: "show" });
    }
    return result.changed;
  };

  const removeBinding = (bindingId: string): boolean => {
    const resolved = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId) : undefined;
    const sceneId = resolved?.scene?.id;
    const widget = resolved?.widget;
    if (!sceneId || !widget) return false;
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, widget.bindings.filter((binding) => binding.id !== bindingId));
    if (result.changed) logAction("Binding removed", "EVENT");
    return result.changed;
  };

  const changeWidgetZOrder = (operation: ZOrderOperation): boolean => {    const node = resolvedSelection;
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
    else if (commandId === "widget.lock-toggle") changed = toggleWidgetProperty("locked");
    else if (commandId === "widget.hide-toggle") changed = toggleWidgetProperty("visible");
    else if (commandId === "widget.duplicate-mode") changed = enterDuplicateMode();
    else if (commandId === "scene.hide-all") changed = setAllWidgetsVisibility(false);
    else if (commandId === "scene.show-all") changed = setAllWidgetsVisibility(true);
    else if (commandId === "canvas.delete-selection") changed = deleteSelectionCommand();
    else if (commandId === "widget.open-properties" || commandId === "widget.add-binding") {
      activatePanel("properties");
      if (commandId === "widget.add-binding" && resolvedSelection?.widget) setBindingModal({ widgetId: resolvedSelection.widget.id });
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
    if (panel === "explorer" || panel === "assets") setLeftDockTab(panel);
    if (panel === "properties" || panel === "simulator") setRightDockTab(panel);
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
    let moved = false;
    const move = (moveEvent: PointerEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = Math.min(420, Math.max(220, startWidth + (side === "left" ? delta : -delta)));
      moved = moved || nextWidth !== startWidth;
      if (side === "left") setLeftWidth(nextWidth);
      else setRightWidth(nextWidth);
    };
    const stop = () => {
      cleanup();
      // No-movement clicks must not claim a resize (INT-48).
      if (moved) logAction(`${side === "left" ? "Explorer" : "Properties"} splitter resized`);
    };
    const cancel = () => cleanup();
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  const selectNode = (node: TreeNode, additive = false) => {
    if (node.disabled) return;
    const canonical = resolveCanonicalNode(project, node.id);
    const normalizedKind = node.kind.toLowerCase();
    const kind: SelectionKind = canonical?.kind ?? (normalizedKind.includes("resource") || normalizedKind.includes("unsupported") ? "asset" : "canvas");
    const nodeType = canonical?.widget?.widgetType ?? node.nodeType ?? node.kind;
    const nextIds = orderSelectionIds(activeScene?.widgets ?? [], selectIds(selectedIds, node.id, additive));
    setSelectedIds(nextIds);
    // Selecting a widget from the Canvas expands its Scene/Rotation, and
    // selecting a container node reveals its children, so every surface
    // shows the same selection without dead-end collapsed nodes.
    if (canonical?.widget) {
      setExpandedNodes((current) => ({
        ...current,
        ...(canonical.scene ? { [canonical.scene.id]: true } : {}),
        ...(canonical.rotation ? { [canonical.rotation.id]: true } : {}),
      }));
    } else if (canonical && node.children && node.children.length > 0) {
      setExpandedNodes((current) => ({ ...current, [node.id]: true }));
    }
    if (!nextIds.length) {
      setSelection(null);
    } else if (additive && selectedIds.includes(node.id)) {
      const firstId = nextIds[0];
      const first = resolveCanonicalNode(project, firstId)?.widget;
      setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
    } else {
      setSelection({ id: node.id, label: node.label, kind, nodeType, detail: node.detail });
    }
    logAction(`${node.kind} selected: ${node.label}`, "EVENT");
  };

  const clearSelection = () => {
    setSelection(null);
    setSelectedIds([]);
    logAction("Canvas selection cleared");
  };

  const toggleExpanded = (nodeId: string) => setExpandedNodes((current) => ({ ...current, [nodeId]: !current[nodeId] }));

  const renderTreeNode = (node: TreeNode, depth = 0): ReactNode => {
    const expanded = expandedNodes[node.id] ?? depth < 4;
    const isSelected = selectedIds.includes(node.id);
    const icon = node.kind === "Scene" ? "◈" : node.kind === "Widget" ? "◇" : node.kind === "Rotation / Form" ? "▧" : node.kind === "Project" ? "▣" : node.kind === "Resources" ? "▤" : "▱";
    return (
      <li key={node.id} className={`tree-node ${node.disabled ? "is-disabled" : ""}`}>
        <div className={`tree-row ${isSelected ? "is-selected" : ""}`} style={{ paddingLeft: `${10 + depth * 15}px` }} onContextMenu={(event) => { event.preventDefault(); selectNode(node); setContextMenu({ x: event.clientX, y: event.clientY, kind: resolveCanonicalNode(project, node.id)?.kind ?? "canvas" }); }}>
          {node.children && node.children.length > 0 ? (
            <button type="button" className="tree-expander" aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`} aria-expanded={expanded} onClick={() => toggleExpanded(node.id)}>{expanded ? "▾" : "▸"}</button>
          ) : <span className="tree-expander-placeholder" />}
          <button type="button" className="tree-label" aria-current={isSelected ? "true" : undefined} onClick={(event) => selectNode(node, event.shiftKey || isCanonicalModifier(event))} disabled={node.disabled}>
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
  // Preview Mode evaluates the runtime: the runtime-active Scene is rendered
  // with its bindings applied. Design Mode edits the Explorer-selected Scene.
  const previewActive = viewMode === "preview" && Boolean(runtime.activeScene);
  const displayedWidgets = previewActive && runtime.activeScene ? runtime.activeScene.widgets : canvasWidgets;
  const bindingEffects = useMemo(() => {
    const effects: Record<string, { hidden?: boolean; playback?: Binding["action"]; contentId?: string }> = {};
    if (!activeProfile) return effects;
    for (const widget of displayedWidgets) {
      for (const binding of widget.bindings) {
        const evaluation = evaluateBinding(binding, runtimeContext, activeProfile);
        if (!evaluation.matched) continue;
        const current = effects[widget.id] ?? {};
        if (binding.action === "hide") effects[widget.id] = { ...current, hidden: true };
        else if (binding.action === "show") effects[widget.id] = { ...current, hidden: false };
        else if (binding.action === "play" || binding.action === "pause" || binding.action === "stop" || binding.action === "restart" || binding.action === "continue") {
          effects[widget.id] = { ...current, playback: binding.action };
        }
        if (binding.contentId) effects[widget.id] = { ...effects[widget.id] ?? {}, contentId: binding.contentId };
      }
    }
    return effects;
  }, [displayedWidgets, runtimeValues, runtimeSettings, activeProfile]);
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
  const selectedSceneWidgets = activeScene?.widgets.filter((widget) => selectedWidgetIds.includes(widget.id)) ?? [];
  const selectedWidgetsAllLocked = selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((widget) => widget.locked);
  const selectedWidgetsAllVisible = selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((widget) => widget.visible);
  const selectedEditableWidgets = canvasWidgets.filter((widget) => selectedWidgetIds.includes(widget.id) && !widget.locked);
  const canvasTransform = { zoom: zoom / 100, pan, sceneWidth: canvasWidth, sceneHeight: canvasHeight };
  const canvasFrame = canvasViewportSize.width > 0 && canvasViewportSize.height > 0
    ? getCanvasViewFrame({ left: 0, top: 0, width: canvasViewportSize.width, height: canvasViewportSize.height }, canvasTransform)
    : undefined;
  const canvasLayerStyle = canvasFrame
    ? {
      position: "absolute" as const,
      left: `${canvasFrame.x}px`,
      top: `${canvasFrame.y}px`,
      width: `${canvasFrame.width}px`,
      height: `${canvasFrame.height}px`,
      // Scene-unit grid rendered INSIDE the device surface (CV-05/L-20):
      // it matches snapGridSize and pans/zooms with the content.
      ...(gridVisible && snapGridSize > 0 && canvasWidth > 0 && canvasHeight > 0
        ? {
          backgroundImage: "linear-gradient(var(--grid-major) 1px, transparent 1px), linear-gradient(90deg, var(--grid-major) 1px, transparent 1px)",
          backgroundSize: `${(snapGridSize / canvasWidth) * 100}% ${(snapGridSize / canvasHeight) * 100}%`,
        }
        : {}),
    }
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

  // Click suppression is timestamp-based so it is immune to click-vs-timer
  // ordering races: a gesture suppresses the click that ends it no matter
  // when the browser dispatches that click.
  const suppressCanvasClick = () => {
    suppressCanvasClicksUntilRef.current = Date.now() + 600;
  };
  const isCanvasClickSuppressed = () => Date.now() < suppressCanvasClicksUntilRef.current;
  const consumeCanvasClickSuppression = () => {
    suppressCanvasClicksUntilRef.current = 0;
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
    suppressCanvasClick();
  };

  const beginCanvasMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasAvailable || (event.button !== 0 && event.button !== 1)) return;
    if (viewMode === "preview") return;
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
    if (viewMode === "preview") {
      logAction("Preview Mode evaluates the runtime; geometry editing stays in Design Mode", "WARN");
      return;
    }
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
    if (event.button !== 0 || canvasTool === "pan" || viewMode === "preview") return;
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
      if (exceedsPointerDragThreshold(distance)) suppressCanvasClick();
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
      suppressCanvasClick();
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
    suppressCanvasClick();
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
        suppressCanvasClick();
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
  };

  const handleCanvasPointerCancel = () => cancelCanvasInteraction();

  /**
   * Capture-loss handling (INT-41): a capture loss AFTER a committed
   * pointerup sees an idle interaction and no-ops. A capture loss while the
   * gesture is still active first tries to RE-ACQUIRE capture (spurious
   * browser releases); only if re-acquisition fails is the gesture cancelled.
   */
  const handleCanvasPointerCaptureLost = () => {
    const active = canvasPointerRef.current;
    if (active.mode === "idle") return;
    const element = canvasScreenRef.current;
    const pointerId = activePointerIdRef.current;
    if (element && pointerId !== null) {
      try { element.setPointerCapture(pointerId); } catch { /* re-acquire failed */ }
    }
    if (!element || pointerId === null || !element.hasPointerCapture(pointerId)) cancelCanvasInteraction();
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isCanvasClickSuppressed() || canvasTool === "pan") {
      consumeCanvasClickSuppression();
      return;
    }
    if (duplicateMode) {
      const sceneId = activeScene?.id;
      if (!sceneId || !selectedWidgetIds.length) return;
      const point = toCanvasPoint(event);
      const result = editorApplication.duplicateWidgetsAt(sceneId, selectedWidgetIds, point);
      if (result.changed) {
        const createdIds = result.createdIds ?? [];
        if (createdIds.length) {
          setSelectedIds([...createdIds]);
          setSelection({ id: createdIds[0], label: createdIds.length > 1 ? `${createdIds.length} items selected` : "Placed copy", kind: "widget", nodeType: activeScene.widgets.find((widget) => widget.id === createdIds[0])?.widgetType });
        }
        logAction("Duplicate placed at click point", "EVENT");
      }
      return;
    }
    clearSelection();
  };

  const cancelSettings = () => {
    setSettingsDraft({ ...savedSettings });
    setSettingsOpen(false);
  };

  const saveSettings = () => {
    setSavedSettings({ ...settingsDraft });
    settingsStorage?.save(settingsDraft);
    setSettingsOpen(false);
    logAction("Program Settings saved", "EVENT");
  };

  const trapModalFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const container = event.currentTarget;
    const focusables = Array.from(container.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]")).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("tabindex") !== "-1");
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const selectAllCommand = () => {
    const allIds = orderSelectionIds(canvasWidgets, canvasWidgets.map((widget) => widget.id));
    setSelectedIds(allIds);
    const first = allIds[0] ? canvasWidgets.find((widget) => widget.id === allIds[0]) : undefined;
    setSelection(first ? { id: first.id, label: first.name, kind: "widget", nodeType: first.widgetType, detail: first.locked ? "Locked" : first.visible ? "Visible" : "Hidden" } : null);
    logAction(`Select All · ${allIds.length} widget(s) in the active Scene`, "EVENT");
  };

  // Global keyboard surface (INT-31): the handler lives at window level so
  // Delete/Arrows/Ctrl+A keep working after focus drops to the body. Text
  // inputs are excluded; mutation keys are blocked mid-gesture (INT-38/39).
  const handleGlobalKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const descriptor = matchShortcut(event, shortcutRegistry);
    // Text inputs keep native editing semantics for C/X/V/A/Z/Y/arrows, but
    // Save and New Project have no native input meaning and must work from
    // any focus (Scenario E: after committing a field, Ctrl+S still saves).
    const excluded = isCanvasKeyboardExcludedTarget(target);
    if (excluded && descriptor?.id !== "save" && descriptor?.id !== "new") return;
    if (confirmState) return;
    if (settingsOpen) {
      if (event.key === "Escape") { event.preventDefault(); cancelSettings(); }
      return;
    }
    if (bindingModal) {
      if (event.key === "Escape") { event.preventDefault(); setBindingModal(null); }
      return;
    }
    if (menuOpen) {
      if (event.key === "Escape") { event.preventDefault(); setMenuOpen(null); }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (duplicateMode) {
        setDuplicateMode(false);
        logAction("Duplicate mode exited", "EVENT");
        return;
      }
      if (canvasPointerRef.current.mode !== "idle") cancelCanvasInteraction();
      else if (contextMenu) setContextMenu(null);
      return;
    }
    const pointerActive = canvasPointerRef.current.mode !== "idle";
    if (descriptor?.id === "undo" && !pointerActive) { event.preventDefault(); undo(); return; }
    if (descriptor?.id === "redo" && !pointerActive) { event.preventDefault(); redo(); return; }
    if (descriptor?.id === "save" && !pointerActive) { event.preventDefault(); saveDocument(); return; }
    if (descriptor?.id === "new" && !pointerActive) { event.preventDefault(); requestNewProject(); return; }
    if (descriptor?.id === "copy" && !pointerActive) { event.preventDefault(); copySelection(); return; }
    if (descriptor?.id === "cut" && !pointerActive) { event.preventDefault(); cutSelection(); return; }
    if (descriptor?.id === "paste" && !pointerActive) { event.preventDefault(); pasteSelection(); return; }
    if (descriptor?.id === "select-all" && !pointerActive) { event.preventDefault(); selectAllCommand(); return; }
    if ((descriptor?.id === "delete" || descriptor?.id === "delete-backspace") && !pointerActive) {
      event.preventDefault();
      deleteSelectionCommand();
      canvasScreenRef.current?.focus();
      return;
    }
    if (!pointerActive && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key) && selectedWidgetIds.length) {
      const modifier = isCanonicalModifier(event);
      const step = calculateNudgeStep(snapGridSize, { shift: event.shiftKey, modifier, alt: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey });
      if (step === null) return;
      event.preventDefault();
      const delta = { x: event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, y: event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0 };
      const updates = Object.fromEntries(selectedEditableWidgets.map((widget) => [widget.id, moveGeometry(widget.geometry, delta)]));
      if (Object.keys(updates).length) commitGeometryCommand(activeScene?.id, updates, "Nudge widget");
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  });

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
  }, [activeRotation?.id, activeScene?.id]);

  // Cross-scene selection pruning (M-07/INT-18): widget ids outside the
  // active Scene are dropped so commands can never silently subset.
  useEffect(() => {
    const sceneWidgetIds = new Set(activeScene?.widgets.map((widget) => widget.id) ?? []);
    setSelectedIds((current) => {
      const next = current.filter((id) => {
        const kind = resolveCanonicalNode(project, id)?.kind;
        return kind !== "widget" || sceneWidgetIds.has(id);
      });
      return next.length === current.length ? current : next;
    });
    setSelection((current) => {
      if (!current || current.kind !== "widget") return current;
      return sceneWidgetIds.has(current.id) ? current : null;
    });
  }, [activeScene?.id, project]);

  // Program settings consumers (ST-02/INT-11/12): every saved setting is
  // wired to a real effect.
  useEffect(() => { setGridVisible(savedSettings.showGrid); }, [savedSettings.showGrid]);
  useEffect(() => {
    document.body.classList.toggle("relaxed-density", !savedSettings.compactDensity);
    return () => document.body.classList.remove("relaxed-density");
  }, [savedSettings.compactDensity]);

  // Runtime settings seed their DeviceProfile defaults (INT-57).
  useEffect(() => {
    setRuntimeSettings((current) => {
      const next = { ...current };
      for (const setting of activeProfile?.runtimeSettings ?? []) {
        if (next[setting.id] === undefined && setting.defaultValue !== undefined) next[setting.id] = setting.defaultValue;
      }
      return next;
    });
  }, [activeProfile?.id]);

  // Dirty-state close guards (INT-02): beforeunload for the browser build,
  // Tauri onCloseRequested for the desktop shell.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!documentSnapshot.isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [documentSnapshot.isDirty]);

  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        unlisten = await getCurrentWindow().onCloseRequested(async (event) => {
          if (documentSnapshot.isDirty) event.preventDefault();
        });
      } catch {
        // Not running under a Tauri shell.
      }
    })();
    return () => { unlisten?.(); };
  }, [documentSnapshot.isDirty]);

  // Binding modal lifecycle (INT-59): a modal can never outlive its widget.
  useEffect(() => {
    if (bindingModal && !bindingWidget) {
      setBindingModal(null);
      logAction("Binding Editor closed: the widget no longer exists", "WARN");
    }
  }, [bindingModal, bindingWidget]);

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
    const effect = bindingEffects[widget.id];
    const effectiveVisible = previewActive && effect?.hidden === true ? false : widget.visible;
    if (!effectiveVisible) return null;
    const geometry = previewGeometry(widget);
    const selected = selectedIds.includes(widget.id);
    const style = { left: `${(geometry.x / canvasWidth) * 100}%`, top: `${(geometry.y / canvasHeight) * 100}%`, width: `${(geometry.width / canvasWidth) * 100}%`, height: `${(geometry.height / canvasHeight) * 100}%`, zIndex: widget.zIndex };
    const handles: ResizeHandle[] = ["n", "e", "s", "w", "nw", "ne", "sw", "se"];
    return <div key={widget.id} className={`canvas-widget ${selected ? "is-selected" : ""} ${widget.locked ? "is-locked" : ""}`} style={style} role="button" tabIndex={0} aria-label={`${widget.name} ${widget.widgetType}`} onPointerDown={(event) => beginWidgetMove(widget, event)} onClick={(event) => { event.stopPropagation(); if (isCanvasClickSuppressed()) { consumeCanvasClickSuppression(); return; } selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }, event.shiftKey || isCanonicalModifier(event)); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }); }}><span>{widget.name}</span><small>{widget.widgetType}{widget.locked ? " · locked" : ""}{previewActive && effect?.playback ? ` · ${effect.playback}` : ""}</small>{selected && selectedWidgetIds.length === 1 && !widget.locked && !previewActive && handles.map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize ${widget.name} ${handle}`} onPointerDown={(event) => beginWidgetResize(widget, handle, event)} />)}</div>;
  };

  const shortcutFor = (id: string): string | undefined => {
    const descriptor = canonicalShortcuts.find((candidate) => candidate.id === id);
    return descriptor ? shortcutDisplay(descriptor) : undefined;
  };

  const menuItems: Record<MenuKey, MenuItem[]> = {
    File: [
      { label: "New Project", shortcut: shortcutFor("new"), onClick: requestNewProject },
      { label: "Open Project", onClick: openProject },
      { label: "Save", shortcut: shortcutFor("save"), disabled: !documentSnapshot.isDirty, onClick: saveDocument },
    ],
    Edit: [
      { label: "Undo", shortcut: shortcutFor("undo"), disabled: !commandHistory.canUndo, onClick: undo },
      { label: "Redo", shortcut: shortcutFor("redo"), disabled: !commandHistory.canRedo, onClick: redo },
      { label: "Cut", shortcut: shortcutFor("cut"), disabled: !selectedWidgetIds.length, onClick: cutSelection },
      { label: "Copy", shortcut: shortcutFor("copy"), disabled: !selectedWidgetIds.length, onClick: copySelection },
      { label: "Paste", shortcut: shortcutFor("paste"), disabled: !clipboard, onClick: pasteSelection },
      { label: "Delete Selection", shortcut: "Delete", disabled: !selectedIds.length, onClick: deleteSelectionCommand },
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
      { label: "Validate Project", onClick: () => { if (validation.valid) logAction("Project validation passed"); else validation.issues.forEach((issue) => logAction(`${issue.code}: ${issue.message}`, issue.severity === "error" ? "ERROR" : "WARN")); } },
      ...availableProfiles.map((profile) => ({ label: `Device Profile: ${profile.name}`, disabled: profile.id === project.deviceProfileId, onClick: () => setDeviceProfile(profile.id) })),
      { label: "Build & Verify Package", onClick: () => { void buildAndVerifyPackage(); } },
    ],
    Theme: [
      { label: "Add Theme Project", onClick: addThemeProject },
      { label: "Add Rotation", disabled: !resolvedSelection?.theme, onClick: addRotation },
    ],
    Scene: [
      { label: "Add Scene", disabled: !resolvedSelection?.rotation, onClick: addScene },
      { label: "Hide All Widgets", disabled: !activeScene?.id || canvasWidgets.length === 0, onClick: () => setAllWidgetsVisibility(false) },
      { label: "Show All Widgets", disabled: !activeScene?.id || canvasWidgets.length === 0, onClick: () => setAllWidgetsVisibility(true) },
      { label: "Delete Selection", disabled: !selectedIds.length, onClick: deleteSelectionCommand },
      { label: "Test Scene", onClick: () => activatePanel("simulator") },
    ],
    Widget: [
      ...(activeProfile?.supportedWidgetTypes ?? []).map((widgetType) => ({ label: `Add ${defaultWidgetName(widgetType)} Widget`, disabled: !activeScene?.id, onClick: () => addWidget(widgetType) })),
      { label: selectedWidgetsAllLocked ? "Unlock Selection" : "Lock Selection", disabled: !selectedWidgetIds.length, onClick: () => toggleWidgetProperty("locked") },
      { label: selectedWidgetsAllVisible ? "Hide Selection" : "Show Selection", disabled: !selectedWidgetIds.length, onClick: () => toggleWidgetProperty("visible") },
      { label: "Duplicate Selection", disabled: !selectedIds.length, onClick: duplicateSelectionCommand },
      { label: "Duplicate Mode (click to place)", disabled: !selectedWidgetIds.length, onClick: enterDuplicateMode },
      { label: "Delete Selection", disabled: !selectedIds.length, onClick: deleteSelectionCommand },
      { label: "Binding Editor", disabled: !resolvedSelection?.widget, onClick: () => setBindingModal({ widgetId: resolvedSelection?.widget?.id ?? "" }) },
    ],
    Tools: [
      { label: "Diagnostics", onClick: () => activatePanel("console") },
      { label: "Program Settings", onClick: () => setSettingsOpen(true) },
    ],
  };

  const renderPanelHeader = (panel: PanelId, kicker: string, title: string) => (
    <div className="panel-heading">
      <div><span className="panel-kicker">{kicker}</span><strong>{title}</strong></div>
      <div className="panel-header-actions">
        <button type="button" className="panel-action" title="Float panel (fixed position in V1)" aria-label={`Float ${title}`} onClick={() => setPanelMode(panel, "floating")}>⤢</button>
        <button type="button" className="panel-action" title="Collapse panel" aria-label={`Collapse ${title}`} onClick={() => collapsePanel(panel)}>−</button>
        <button type="button" className="panel-action" title="Close panel (reopen via View menu)" aria-label={`Close ${title}`} onClick={() => setPanelMode(panel, "closed")}>×</button>
      </div>
    </div>
  );

  const renderDockTabs = (side: "left" | "right") => {
    const tabs: [PanelId, string][] = side === "left" ? [["explorer", "Explorer"], ["assets", "Assets"]] : [["properties", "Properties"], ["simulator", "Simulator"]];
    const activeTab = side === "left" ? leftDockTab : rightDockTab;
    return <div className="panel-dock-tabs" role="tablist" aria-label={side === "left" ? "Left panels" : "Right panels"}>{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? "active" : ""} onClick={() => activatePanel(id)}>{label}</button>)}</div>;
  };

  const renderExplorer = () => (
    <>
      {renderPanelHeader("explorer", "NAVIGATION", "Project Explorer")}
      {renderDockTabs("left")}
      <div className="explorer-toolbar"><button type="button" className="small-action" onClick={() => setExpandedNodes(Object.fromEntries(collectTreeNodeIds(project).map((id) => [id, true])))}>Expand</button><button type="button" className="small-action" onClick={() => setExpandedNodes({})}>Collapse</button><span className="explorer-source">MODEL VIEW</span></div>
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
      {renderDockTabs("left")}
      <div className="asset-search"><input aria-label="Search assets" placeholder="Search depot" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} /></div>
      <div className="asset-category-list">{assetCategories.map((category) => <button key={category.id} type="button" className={assetCategory === category.id ? "active" : ""} onClick={() => setAssetCategory(category.id)}><span>{category.id === "depot" ? "▱" : category.id === "resources" ? "▤" : category.id === "scene" ? "◈" : "⊘"}</span>{category.label}<small>{category.id === "depot" ? 0 : category.id === "resources" ? project.assets.filter((asset) => resourceAssetIds.has(asset.id)).length : category.id === "scene" ? project.assets.filter((asset) => sceneAssetIds.has(asset.id)).length : 0}</small></button>)}</div>
      <div className="asset-list">
        {filteredAssets.length > 0 ? filteredAssets.map((asset) => <button type="button" className="asset-row" key={asset.id} onClick={() => selectNode({ id: asset.id, label: asset.name, kind: "Asset", detail: asset.mediaType })}><span className="asset-type">{asset.mediaType === "audio" ? "♫" : asset.mediaType === "video" ? "▶" : "▧"}</span><span><strong>{asset.name}</strong><small>{asset.mediaType} · {asset.id}</small></span></button>) : <div className="asset-empty"><span className="empty-panel-icon">{assetCategory === "unsupported" ? "⊘" : "▱"}</span><strong>{assetCategory === "depot" ? "Asset Depot is empty" : assetCategory === "unsupported" ? "Unsupported Files is empty" : "No assets in this scope"}</strong><span>{assetCategory === "depot" ? "Depot library content is not Project Resources and unused depot assets are not exported." : assetCategory === "unsupported" ? "Unsupported files cannot become widgets or enter normal export." : "Project Resources and Scene Content are derived from canonical references."}</span></div>}
      </div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Asset Depot, Resources, Scene Content and Unsupported Files remain separate surfaces.</span></div>
    </>
  );

  // GeometryField pre-validates and clamps with visible feedback; this commit
  // path applies exactly one undoable command across the whole selection
  // (multi-select `*` apply-to-all, corrections §9).
  const commitSelectionGeometryField = (field: keyof Geometry, value: number) => {
    if (!Number.isFinite(value)) {
      logAction(`Geometry edit rejected: ${field} must be a finite number`, "WARN");
      return;
    }
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
      updates[id] = { ...canonicalGeometry(widget), [field]: value };
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
    const geometryEditable = canvasPointer.mode === "idle" && selectedCanonical.some((current) => Boolean(current.widget && !current.widget.locked));
    return (
      <>
        {renderPanelHeader("properties", "INSPECTOR", "Properties")}
        {renderDockTabs("right")}
        <div className="inspector-context"><span className={`context-icon ${selection ? "has-selection" : ""}`}>{selection ? "◇" : "□"}</span><div><strong>{multi ? `${selectedIds.length} items selected` : selection?.label ?? "Document Properties"}</strong><small>{selection?.detail ?? "Nothing selected · Project context"}</small></div></div>
        {selection && node ? <div className="properties-scroll">
          <section className="property-section"><div className="property-section-title">Identity</div>{multi ? <PropertyRow label="Name" value="*" /> : "name" in node.node ? <div className="property-row property-row-edit"><span>Name</span><DraftTextField value={String(node.node.name)} disabled={false} ariaLabel="Display name" onCommit={renameSelectedNode} /></div> : <PropertyRow label="Name" value={selection.label} muted />}<PropertyRow label="Type" value={multi ? valueFor((current) => current.widget?.widgetType ?? current.kind) : (widget?.widgetType ?? selection.nodeType ?? selection.kind)} /><PropertyRow label="Stable ID" value={multi ? valueFor((current) => String(current.node.id)) : selection.id} muted /></section>
          <section className="property-section"><div className="property-section-title">Canonical Context</div><PropertyRow label="Source" value="Canonical Project Model" /><div className="property-row property-row-edit"><span>Device Profile</span><select aria-label="Device Profile" value={project.deviceProfileId} disabled={availableProfiles.length < 2} onChange={(event) => setDeviceProfile(event.target.value)}>{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div><PropertyRow label="Validation" value={issueCount > 0 ? `${issueCount} issue(s)` : validation.valid ? "Valid" : "Review project"} muted /></section>
          {widget && <>
            <section className="property-section"><div className="property-section-title">Widget</div><PropertyRow label="Widget Type" value={multi ? valueFor((current) => current.widget?.widgetType) : widget.widgetType} /><div className="property-row property-row-edit"><span>Visible</span><input type="checkbox" aria-label="Widget visible" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.visible) : widget.visible} onChange={() => toggleWidgetProperty("visible")} /></div><div className="property-row property-row-edit"><span>Enabled</span><input type="checkbox" aria-label="Widget enabled" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.enabled) : widget.enabled} onChange={() => toggleWidgetProperty("enabled")} /></div><div className="property-row property-row-edit"><span>Geometry Lock</span><input type="checkbox" aria-label="Widget geometry lock" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.locked) : widget.locked} onChange={() => toggleWidgetProperty("locked")} /></div></section>
            <section className="property-section"><div className="property-section-title">Geometry / Layer</div><div className="geometry-editor"><GeometryField label="X" field="x" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).x : undefined) : canonicalGeometry(widget).x} multi={multi} disabled={!geometryEditable} min={0} max={activeRotation?.width ?? 0} onCommit={commitSelectionGeometryField} /><GeometryField label="Y" field="y" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).y : undefined) : canonicalGeometry(widget).y} multi={multi} disabled={!geometryEditable} min={0} max={activeRotation?.height ?? 0} onCommit={commitSelectionGeometryField} /><GeometryField label="W" field="width" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).width : undefined) : canonicalGeometry(widget).width} multi={multi} disabled={!geometryEditable} min={10} max={activeRotation?.width ?? 0} onCommit={commitSelectionGeometryField} /><GeometryField label="H" field="height" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).height : undefined) : canonicalGeometry(widget).height} multi={multi} disabled={!geometryEditable} min={10} max={activeRotation?.height ?? 0} onCommit={commitSelectionGeometryField} /></div><div className="property-row property-row-edit"><span>Z-order</span><DraftNumberField value={multi ? valueFor((current) => current.widget?.zIndex) : String(widget.zIndex)} disabled={false} min={-100000} max={100000} ariaLabel="Widget z-order" onCommit={(value) => { const sceneId = activeScene?.id; if (!sceneId || !selectedWidgetIds.length) return; const result = editorApplication.setWidgetsPropertiesInScene(sceneId, selectedWidgetIds, { zIndex: value }); if (result.changed) logAction(`Set widget zIndex to ${value}`, "EVENT"); }} /></div></section>
            <section className="property-section"><div className="property-section-title">Presentation</div><PropertyRow label="Bindings" value={String(widget.bindings.length)} /><PropertyRow label="Asset References" value={String(widget.assetIds?.length ?? 0)} /><PropertyRow label="Media Type" value={widget.mediaType ?? "None"} /><PropertyRow label="Media Slide" value={widget.mediaSlide ? "Configured" : "None"} /><button type="button" className="property-inline-action" onClick={() => setBindingModal({ widgetId: widget.id })}>Open Binding Editor</button></section>
            {widget.widgetType === "digit" && <section className="property-section"><div className="property-section-title">Digit</div><PropertyRow label="Style" value={String(widget.style?.digitStyleId ?? "Profile default / unresolved")} /><PropertyRow label="Floor Mapping" value={String(widget.content?.floorMappingId ?? "Not selected")} /></section>}
            {widget.widgetType === "direction" && <section className="property-section"><div className="property-section-title">Direction</div><PropertyRow label="Style" value={String(widget.style?.directionStyleId ?? "Profile default / unresolved")} /><PropertyRow label="Variant" value={String(widget.content?.variant ?? "Profile-defined")} /></section>}
            {widget.widgetType === "media" && <section className="property-section"><div className="property-section-title">Media</div><PropertyRow label="Visual" value={widget.mediaType ?? "Not selected"} /><PropertyRow label="Attached Audio" value={widget.audioAssetId ?? "None"} muted /></section>}
          </>}
          {node.scene && <section className="property-section"><div className="property-section-title">Scene Runtime</div><div className="property-row property-row-edit"><span>Priority</span><DraftNumberField value={String(node.scene.priority)} disabled={false} min={0} max={10} ariaLabel="Scene priority" onCommit={(value) => { const result = editorApplication.setSceneProperties(node.scene!.id, { priority: value }); if (result.changed) logAction(`Scene priority set to ${value}`, "EVENT"); }} /></div><div className="property-row property-row-edit"><span>Enabled</span><input type="checkbox" aria-label="Scene enabled" checked={node.scene.enabled !== false} onChange={(event) => { const result = editorApplication.setSceneProperties(node.scene!.id, { enabled: event.target.checked }); if (result.changed) logAction(`Scene ${event.target.checked ? "enabled" : "disabled"}`, "EVENT"); }} /></div><PropertyRow label="Activation Conditions" value={`${node.scene.activationConditions.length} · ${node.scene.activationConditionMode ?? "all"}`} /><PropertyRow label="Widgets" value={String(node.scene.widgets.length)} /></section>}
          {node.rotation && <section className="property-section"><div className="property-section-title">Rotation / Form</div><PropertyRow label="Angle" value={`R${node.rotation.angle}`} /><PropertyRow label="Display" value={`${node.rotation.width} × ${node.rotation.height}`} /><PropertyRow label="Scenes" value={String(node.rotation.scenes.length)} /></section>}
          {node.theme && <section className="property-section"><div className="property-section-title">Theme Project</div><PropertyRow label="Rotations" value={String(node.theme.rotations.length)} /><PropertyRow label="Resources" value={String(node.theme.resources.length)} /><PropertyRow label="Floor Mappings" value={String(node.theme.floorMappings?.length ?? 0)} /></section>}
          {node.asset && <section className="property-section"><div className="property-section-title">Asset</div><PropertyRow label="Media Type" value={node.asset.mediaType} /><PropertyRow label="Source" value={node.asset.sourcePath} /><PropertyRow label="Stable ID" value={node.asset.id} muted /></section>}
          {multi && <div className="multi-selection-note"><strong>Multi-selection</strong><span>Same values show their value; different values show `*`. Geometry fields remain read-only when a selected widget is locked.</span></div>}
        </div> : <div className="properties-empty"><span className="empty-panel-icon">□</span><strong>Select a canonical item to inspect</strong><span>Project, Theme Group, Theme, Rotation, Scene, Asset and profile-defined Widget selections resolve from the Project Model.</span></div>}
        <div className="panel-footnote"><span className="footnote-mark">i</span><span>Properties is a model view; edits must flow through commands and profile capability checks.</span></div>
      </>
    );
  };

  const traceRuntime = () => {
    if (!runtime.activeScene) {
      logAction("Runtime trace: no active Scene for the current inputs", "EVENT");
      return;
    }
    logAction(`[Runtime] ${runtime.activeScene.name} active · priority ${runtime.activeScene.priority}`, "EVENT");
    for (const evaluation of activeBindings) {
      logAction(`[Binding] ${evaluation.widgetId} · ${evaluation.action} → ${evaluation.matched ? "TRUE" : "FALSE"}`, "EVENT");
    }
  };

  const resetSimulator = () => {
    setSimulationStatus("idle");
    setRuntimeValues({});
    setRuntimeSettings(Object.fromEntries((activeProfile?.runtimeSettings ?? []).map((setting) => [setting.id, setting.defaultValue ?? null])));
    logAction("Simulator reset", "EVENT");
  };

  const renderSimulator = () => (
    <>
      {renderPanelHeader("simulator", "TEST STUDIO", "Simulator")}
      {renderDockTabs("right")}
      <div className="simulator-toolbar"><button type="button" className="sim-button primary" onClick={() => { setSimulationStatus("running"); traceRuntime(); }}>▶ Run</button><button type="button" className="sim-button" disabled={simulationStatus !== "running"} onClick={() => { setSimulationStatus("paused"); logAction("Simulator paused", "EVENT"); }}>Ⅱ Pause</button><button type="button" className="sim-button" disabled={simulationStatus === "idle"} onClick={traceRuntime}>Step</button><button type="button" className="sim-button" onClick={resetSimulator}>↺ Reset</button><span className="sim-status">{simulationStatus.toUpperCase()}</span></div>
      <div className="simulator-scroll">
        <section className="sim-section"><div className="property-section-title">Runtime States · DeviceProfile</div>{profileStates.length === 0 ? <div className="sim-empty">No state registry entries in active DeviceProfile.</div> : profileStates.map((state) => { const current = runtimeValues[state.id]; return <label className="sim-input-row" key={state.id}><span>{state.displayName}<small>{state.type}</small></span>{renderRuntimeInput(state, current, (value) => setRuntimeValues((values) => value === null ? (() => { const next = { ...values }; delete next[state.id]; return next; })() : { ...values, [state.id]: value }))}</label>; })}</section>
        <section className="sim-section"><div className="property-section-title">Runtime Settings · DeviceProfile</div>{profileSettings.length === 0 ? <div className="sim-empty">No runtime settings in active DeviceProfile.</div> : profileSettings.map((setting) => { const current = runtimeSettings[setting.id]; return <label className="sim-input-row" key={setting.id}><span>{setting.displayName}<small>{setting.type}</small></span>{renderRuntimeInput(setting, current, (value) => setRuntimeSettings((values) => value === null ? (() => { const next = { ...values }; delete next[setting.id]; return next; })() : { ...values, [setting.id]: value }))}</label>; })}</section>
        <section className="sim-section"><div className="property-section-title">Active Scene</div><div className="sim-empty">{`Evaluation context: R${runtimeRotation?.angle ?? "—"} · ${runtimeRotation?.scenes.length ?? 0} scene(s)`}</div><div className="active-scene-card"><strong>{runtime.activeScene?.name ?? "No active Scene"}</strong><span>{runtime.activeScene ? `Priority ${runtime.activeScene.priority}` : "Runtime inputs are empty"}</span></div>{runtime.candidates.map((candidate) => <div className="sim-row" key={candidate.sceneId}><span>{candidate.sceneId}</span><strong>{candidate.matched ? "MATCH" : "skip"}</strong></div>)}</section>
        <section className="sim-section"><div className="property-section-title">Active Bindings</div>{activeBindings.length === 0 ? <div className="sim-empty">No bindings in the active Scene.</div> : activeBindings.map((evaluation) => <div className="sim-row" key={evaluation.bindingId}><span>{evaluation.widgetId}</span><strong>{evaluation.action} · {evaluation.matched ? "TRUE" : "FALSE"}</strong></div>)}</section>
      </div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Simulator consumes DeviceProfile, Scene selection and active-scene bindings; it does not invent Custom State.</span></div>
    </>
  );

  const renderConsole = () => (
    <>
      <div className="console-tabs"><button type="button" className={consoleTab === "console" ? "active" : ""} onClick={() => setConsoleTab("console")}>Console</button><button type="button" className={consoleTab === "validation" ? "active" : ""} onClick={() => setConsoleTab("validation")}>Validation <span className="tab-count">{validation.issues.length}</span></button><span className="console-spacer" /><span className="console-scope">Package: {deploymentStatus}</span><button type="button" className="panel-action" title="Float console" onClick={() => setPanelMode("console", "floating")}>⤢</button><button type="button" className="panel-action" title="Collapse console" aria-label="Collapse console" onClick={() => collapsePanel("console")}>−</button></div>
      <div className="console-body">{consoleTab === "console" ? <div className="console-entry-list">{consoleEntries.map((entry, index) => <div className="console-entry" key={`${entry.time}-${entry.message}-${index}`}><span className="console-time">{entry.time || "—"}</span><span className={`console-level ${entry.level.toLowerCase()}`}>{entry.level}</span><span className="console-info">{entry.message}</span></div>)}<span className="console-muted">Command, validation, export and runtime traces appear here.</span></div> : <div className="console-entry-list"><div className="console-entry"><span className={`validation-dot ${validation.valid ? "ok" : "error"}`} /><span className="console-info">{validation.valid ? "No blocking foundation issues" : `${validation.issues.length} validation issue(s)`}</span></div><span className="console-muted">Publish readiness is not evaluated by the Phase 0 foundation.</span>{validation.issues.map((issue) => <div className="console-entry" key={issue.code}><span className={`console-level ${issue.severity}`}>{issue.severity.toUpperCase()}</span><span className="console-info">{issue.message}</span></div>)}</div>}</div>
    </>
  );

  const renderPanelContainer = (panel: PanelId, content: ReactNode) => panelModes[panel] === "closed" ? null : panelModes[panel] === "floating" ? <div className={`floating-tool-panel floating-${panel}`} data-panel={panel}>{content}</div> : <aside className="tool-panel">{content}</aside>;

  const settingsContent: Record<SettingsCategory, ReactNode> = {
    General: <><h3>General</h3><p>Application-level behavior stays separate from Project, Theme and Runtime settings.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmDestructive: event.target.checked }))} /> Confirm destructive commands</label></>,
    Appearance: <><h3>Appearance</h3><p>Neutral surfaces, restrained teal accent and compact Windows desktop density are canonical.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.compactDensity} onChange={(event) => setSettingsDraft((current) => ({ ...current, compactDensity: event.target.checked }))} /> Use compact panel density</label></>,
    Editor: <><h3>Editor</h3><p>Editor defaults apply to the UI shell only; domain geometry remains canonical.</p><div className="settings-value">Shortcut registry <strong>Foundation</strong></div></>,
    Canvas: <><h3>Canvas</h3><p>Canvas preferences are application UI defaults and do not change runtime semantics.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.showGrid} onChange={(event) => setSettingsDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> Show grid by default</label><label className="settings-check"><span>Snap grid size</span><input className="settings-number" type="number" min="1" step="1" value={settingsDraft.snapGridSize} onChange={(event) => setSettingsDraft((current) => ({ ...current, snapGridSize: Math.max(1, Number(event.target.value) || DEFAULT_GRID_SIZE) }))} /><small className="settings-unit">scene units</small></label></>,
    Assets: <><h3>Assets</h3><p>Asset Browser is a depot/library view. Resources, Scene Content and Unsupported Files remain separate.</p><div className="settings-value">Preview mode <strong>Profile-supported</strong></div></>,
    Simulator: <><h3>Simulator</h3><p>Simulator consumes canonical DeviceProfile runtime state and settings registries.</p><div className="settings-value">Rule system <strong>Canonical evaluator</strong></div></>,
    Validation: <><h3>Validation</h3><p>Validation issues are sourced from the shared validation service.</p><div className="settings-value">Severity <strong>Profile-aware</strong></div></>,
    Export: <><h3>Export</h3><p>Export scope is controlled by canonical Resources + Used + Default asset rules.</p><div className="settings-value">Format conversion <strong>Not in V1</strong></div></>,
    Shortcuts: <><h3>Shortcuts</h3><p>Confirmed shortcuts are shown by the command registry; Proposed shortcuts are not presented as settled product behavior.</p><div className="shortcut-list">{canonicalShortcuts.filter((descriptor) => !["delete-backspace", "escape"].includes(descriptor.id)).map((descriptor) => <span key={descriptor.id}>{shortcutDisplay(descriptor)} <strong>{descriptor.label}</strong></span>)}</div></>,
  };

  return (
    <div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)}>
      <header className="application-bar">
        <div className="brand-block"><span className="brand-mark">TD</span><div><strong>Template Designer</strong><span className="muted">Design Studio · Foundation</span></div></div>
        <nav className="menu-bar" aria-label="Application menu">{menuKeys.map((menu) => <div key={menu} className="menu-item-wrap"><button type="button" className={`menu-button ${menuOpen === menu ? "is-open" : ""}`} aria-haspopup="menu" aria-expanded={menuOpen === menu} onClick={(event) => { event.stopPropagation(); setMenuOpen((current) => current === menu ? null : menu); }}>{menu}</button>{menuOpen === menu && <div className="menu-popover" onClick={(event) => event.stopPropagation()}>{menuItems[menu].map((item) => <button key={item.label} type="button" className="menu-command" disabled={item.disabled} onClick={item.onClick}><span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button>)}</div>}</div>)}</nav>
        <div className="topbar-actions"><span className="mode-chip"><span className="live-dot" /> {viewMode === "design" ? "Design Mode" : "Preview Mode"}</span><span className={`mode-chip ${documentSnapshot.isDirty ? "is-dirty" : "is-clean"}`}>{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}</span><button type="button" className="toolbar-button primary" onClick={requestNewProject}>New Project</button><button type="button" className="toolbar-button" disabled={!commandHistory.canUndo || canvasPointer.mode !== "idle"} onClick={undo} title={commandHistory.canUndo ? "Undo last command" : "No commands to undo"}>Undo</button><button type="button" className="toolbar-button" disabled={!commandHistory.canRedo || canvasPointer.mode !== "idle"} onClick={redo} title={commandHistory.canRedo ? "Redo last command" : "No commands to redo"}>Redo</button><button type="button" className="toolbar-button settings-button" onClick={() => setSettingsOpen(true)} title="Program Settings">⚙ Settings</button></div>
      </header>

      <div className="document-tabs" aria-label="Open documents"><div className="document-tab-list"><div className="document-tab active"><button type="button" className="document-tab-main" onClick={() => logAction(`${project.name} is the open document`, "EVENT")}><span className="document-tab-icon">▧</span><span>{project.name}</span>{documentSnapshot.isDirty && <span className="dirty-indicator" title="Unsaved changes" />}</button><button type="button" className="tab-close" aria-label="The open document cannot be closed" onClick={() => logAction("The open document cannot be closed; use New Project", "WARN")} disabled>×</button></div></div><span className="document-tab-note">Single document foundation · {documentSnapshot.isDirty ? "Dirty" : "Clean"}</span><div className="tab-actions"><button type="button" className="icon-button" title="Reset layout" onClick={resetLayout}>↺</button></div></div>

      <main className="workspace-stack" style={{ gridTemplateRows: workspaceRows }}>
        <div className="editor-workspace" style={{ gridTemplateColumns: editorColumns }}>
          {activeLeftPanel && renderPanelContainer(activeLeftPanel, activeLeftPanel === "explorer" ? renderExplorer() : renderAssets())}
          {leftVisible && <div className="splitter" role="separator" aria-label="Resize left panel" aria-orientation="vertical" aria-valuenow={leftWidth} aria-valuemin={220} aria-valuemax={420} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setLeftWidth((current) => Math.min(420, Math.max(220, current - 8))); } if (event.key === "ArrowRight") { event.preventDefault(); setLeftWidth((current) => Math.min(420, Math.max(220, current + 8))); } }} onPointerDown={(event) => beginResize("left", event)} />}
          <section className="canvas-workspace" aria-label="Canvas editor">
            <div className="studio-toolbar"><div className="tool-group"><button type="button" className={`studio-tool ${canvasTool === "select" ? "active" : ""}`} onClick={() => setCanvasTool("select")} title="Select tool">↖ <span>Select</span></button><button type="button" className={`studio-tool ${canvasTool === "pan" ? "active" : ""}`} onClick={() => setCanvasTool("pan")} title="Pan tool">✥ <span>Pan</span></button><span className="tool-divider" /><button type="button" className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button><button type="button" className={`studio-tool ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((current) => !current)} title="Toggle snap">⌁ <span>Snap</span></button></div><div className="tool-group"><button type="button" className={`mode-button ${viewMode === "design" ? "active" : ""}`} onClick={() => setViewMode("design")}>Design</button><button type="button" className={`mode-button ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button><span className="tool-divider" /><button type="button" className="zoom-button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 10))}>−</button><span className="zoom-readout">{zoom}%</span><button type="button" className="zoom-button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 10))}>+</button></div></div>
            <div className={`canvas-stage ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={() => { if (!isCanvasClickSuppressed()) clearSelection(); setContextMenu(null); }}><div className="canvas-rail-label">{duplicateMode ? "DUPLICATE MODE · click to place · Esc exits" : viewMode === "design" ? "DESIGN STUDIO" : "RUNTIME PREVIEW"}</div><div className="device-canvas-wrap" onClick={(event) => event.stopPropagation()}><div className="device-frame" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}><div className="device-frame-header"><span>DISPLAY</span><span>{activeRotation ? `R${activeRotation.angle} · ${canvasWidth} × ${canvasHeight}` : "No rotation selected"}</span></div><div className="device-screen" ref={canvasScreenRef} tabIndex={0} onClick={(event) => handleCanvasClick(event)} onPointerDown={beginCanvasMarquee} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerCancel={handleCanvasPointerCancel} onLostPointerCapture={handleCanvasPointerCaptureLost} onContextMenu={(event) => {
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
    }}><div className="canvas-widget-layer" style={canvasLayerStyle}>{canvasAvailable && snapGuides.map(renderSnapGuide)}{canvasAvailable && selectionBounds && <div className="selection-bounds" style={{ left: `${(selectionBounds.x / canvasWidth) * 100}%`, top: `${(selectionBounds.y / canvasHeight) * 100}%`, width: `${(selectionBounds.width / canvasWidth) * 100}%`, height: `${(selectionBounds.height / canvasHeight) * 100}%` }}>{selectedWidgetIds.length > 1 && selectedEditableWidgets.length > 0 && (["n", "e", "s", "w", "nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize selection ${handle}`} onPointerDown={(event) => beginSelectionResize(handle, event)} />)}</div>}{canvasAvailable && displayedWidgets.map(renderCanvasWidget)}{canvasPointer.mode === "marquee" && <div className="selection-marquee" style={{ left: `${(canvasPointer.rect.x / canvasWidth) * 100}%`, top: `${(canvasPointer.rect.y / canvasHeight) * 100}%`, width: `${(canvasPointer.rect.width / canvasWidth) * 100}%`, height: `${(canvasPointer.rect.height / canvasHeight) * 100}%` }} />}{(!canvasAvailable || displayedWidgets.length === 0) && <div className="canvas-empty-state"><span className="empty-glyph">◇</span><strong>{!activeProfile ? "DeviceProfile unavailable" : activeScene?.name ?? (hasThemeProject ? "Select a Scene or Widget" : "No Theme Project")}</strong><span>{!activeProfile ? "Register the canonical DeviceProfile before editing this display." : activeScene ? "Scene contains no widgets." : "Create or select a canonical Rotation and Scene to begin canvas editing."}</span></div>}</div></div><div className="device-frame-footer"><span>ASPECT LOCKED</span><span>{activeRotation ? `R${activeRotation.angle}` : "—"}</span></div></div></div><div className="canvas-overlay-note">{previewActive && runtime.activeScene ? `Preview · ${runtime.activeScene.name} · ${displayedWidgets.length} widget(s)` : activeScene ? `${activeScene.name} · ${canvasWidgets.length} widget(s)` : "Canvas shell · select a canonical Rotation or Scene"}</div></div>
            <div className="canvas-context-bar"><div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}{viewMode === "design" && runtime.activeScene && !resolvedSelection?.scene && <span className="context-runtime-note">Runtime would activate: {runtime.activeScene.name}</span>}</div><div className="context-actions"><button type="button" className="context-action" disabled={!activeScene?.id || !activeProfile?.supportedWidgetTypes.length} onClick={() => addWidget(activeProfile?.supportedWidgetTypes[0] ?? "")} title={activeScene?.id ? "Add a widget to the active Scene" : "Requires an active Scene"}>Add Widget</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={duplicateSelectionCommand} title={selectedWidgetIds.length ? "Duplicate selected widget" : "Requires a selected widget"}>Duplicate</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={() => toggleWidgetProperty("locked")} title={selectedWidgetIds.length ? (selectedWidgetsAllLocked ? "Unlock selected widget(s)" : "Lock selected widget(s)") : "Requires a selected widget"}>{selectedWidgetsAllLocked ? "Unlock" : "Lock"}</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={() => toggleWidgetProperty("visible")} title={selectedWidgetIds.length ? (selectedWidgetsAllVisible ? "Hide selected widget(s)" : "Show selected widget(s)") : "Requires a selected widget"}>{selectedWidgetsAllVisible ? "Hide" : "Show"}</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={deleteSelectionCommand} title={selectedWidgetIds.length ? "Delete selected widget" : "Requires a selected widget"}>Delete</button></div></div>
          </section>
          {rightVisible && <div className="splitter" role="separator" aria-label="Resize right panel" aria-orientation="vertical" aria-valuenow={rightWidth} aria-valuemin={220} aria-valuemax={420} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setRightWidth((current) => Math.min(420, Math.max(220, current - 8))); } if (event.key === "ArrowRight") { event.preventDefault(); setRightWidth((current) => Math.min(420, Math.max(220, current + 8))); } }} onPointerDown={(event) => beginResize("right", event)} />}
          {activeRightPanel && renderPanelContainer(activeRightPanel, activeRightPanel === "properties" ? renderProperties() : renderSimulator())}
        </div>
        {consoleVisible && <section className="console-panel" aria-label="Console and validation">{renderConsole()}</section>}
        {floatingPanels.map((panel) => renderPanelContainer(panel, panel === "explorer" ? renderExplorer() : panel === "assets" ? renderAssets() : panel === "properties" ? renderProperties() : panel === "simulator" ? renderSimulator() : renderConsole()))}
      </main>

      {contextMenu && commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).length > 0 && <div className="editor-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).map((command) => <button type="button" key={command.id} onClick={() => executeEditorDescriptor(command.id)}><span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}</div>}

      <footer className="statusbar"><span><span className={`status-led ${validation.valid ? "" : "is-error"}`} aria-hidden="true" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span><span aria-live="polite">{profileStatus} · Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span><span>{deploymentStatus} · Document: {documentSnapshot.isDirty ? "dirty" : "clean"} · Browser core · Tauri shell reserved</span></footer>

      {bindingModal && <div className="settings-backdrop" role="presentation"><section className="binding-dialog" role="dialog" aria-modal="true" aria-labelledby="binding-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">CANONICAL PRESENTATION</span><h2 id="binding-title">Binding Editor</h2></div><button type="button" className="panel-action" aria-label="Close Binding Editor" onClick={() => setBindingModal(null)}>×</button></header><div className="binding-layout"><div className="binding-context-card"><span className="context-icon has-selection">◇</span><div><strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Evaluated against the current runtime context</small></div></div><div className="binding-section"><div className="property-section-title">Bindings</div>{bindingWidget?.bindings.length ? bindingWidget.bindings.map((binding, index) => { const evaluation = bindingEvaluations[index]; return <div className="binding-card" key={binding.id}><div className="binding-card-head"><strong>{binding.action}</strong><span className="binding-card-actions"><span className={evaluation?.matched ? "binding-true" : "binding-false"}>{evaluation?.matched ? "TRUE" : "FALSE"}</span><button type="button" className="binding-remove" aria-label="Remove binding" title="Remove binding" onClick={() => removeBinding(binding.id)}>×</button></span></div><div className="binding-condition-list">{binding.conditions.map((condition, conditionIndex) => { const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === condition.stateId); return <div className="binding-condition" key={`${binding.id}-${conditionIndex}`}><span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? condition.stateId}</span><code>{condition.operator} {String(condition.value)}</code></div>; })}</div><small>Target widget: {evaluation?.widgetId ?? binding.widgetId} · content/style: {binding.contentId ?? "presentation"}</small></div>; }) : <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No bindings on this widget</strong><span>Add a binding below from DeviceProfile-defined states and settings.</span></div>}</div><div className="binding-section"><div className="property-section-title">Add Binding</div>{[...profileStates, ...profileSettings].length === 0 ? <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No DeviceProfile runtime registry</strong><span>The active DeviceProfile declares no runtime states or settings, so no condition can be authored.</span></div> : <div className="binding-authoring"><label className="binding-field"><span>When</span><select aria-label="Binding state" value={bindingDraft.stateId} onChange={(event) => setBindingDraft((current) => ({ ...current, stateId: event.target.value }))}><option value="">Select state…</option>{[...profileStates, ...profileSettings].map((definition) => <option key={definition.id} value={definition.id}>{definition.displayName} ({definition.type})</option>)}</select></label><label className="binding-field"><span>Operator</span><select aria-label="Binding operator" value={bindingDraft.operator} onChange={(event) => setBindingDraft((current) => ({ ...current, operator: event.target.value }))}>{["equals", "not-equals", "greater-than", "less-than", "contains"].map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label><label className="binding-field"><span>Value</span>{bindingDraftDefinition?.type === "boolean" ? <input type="checkbox" aria-label="Binding value" checked={bindingDraft.value === "true"} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.checked ? "true" : "false" }))} /> : bindingDraftDefinition?.type === "enum" ? <select aria-label="Binding value" value={bindingDraft.value} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.value }))}><option value="">Select value…</option>{(bindingDraftDefinition.enumValues ?? []).map((enumValue) => <option key={enumValue} value={enumValue}>{enumValue}</option>)}</select> : <input aria-label="Binding value" type={bindingDraftDefinition?.type === "integer" || bindingDraftDefinition?.type === "number" ? "number" : "text"} step={bindingDraftDefinition?.type === "number" ? "any" : "1"} value={bindingDraft.value} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.value }))} />}</label><label className="binding-field binding-field-check"><span>Negate</span><input type="checkbox" aria-label="Negate condition" checked={bindingDraft.negated} onChange={(event) => setBindingDraft((current) => ({ ...current, negated: event.target.checked }))} /></label><label className="binding-field"><span>Action</span><select aria-label="Binding action" value={bindingDraft.action} onChange={(event) => setBindingDraft((current) => ({ ...current, action: event.target.value }))}>{["show", "hide", "play", "pause", "stop", "restart", "continue", "select-content", "select-style"].map((action) => <option key={action} value={action}>{action}</option>)}</select></label><button type="button" className="settings-button-primary" disabled={!bindingDraft.stateId} onClick={addBinding}>Add Binding</button></div>}</div><div className="binding-section"><div className="property-section-title">DeviceProfile Registry</div><div className="binding-registry-grid"><div><strong>Runtime States</strong>{profileStates.length ? profileStates.map((state) => <span key={state.id}>{state.displayName}<small>{state.type}</small></span>) : <em>Empty registry</em>}</div><div><strong>Runtime Settings</strong>{profileSettings.length ? profileSettings.map((setting) => <span key={setting.id}>{setting.displayName}<small>{setting.type}</small></span>) : <em>Empty registry</em>}</div></div></div></div><footer className="settings-footer"><span>Positive/negative conditions and actions are constrained by the active DeviceProfile.</span><div><button type="button" className="settings-button-secondary" disabled title="Command-backed binding creation is the next UI command phase">Add Binding</button><button type="button" className="settings-button-primary" onClick={() => setBindingModal(null)}>Close</button></div></footer></section></div>}
      {settingsOpen && <div className="settings-backdrop" role="presentation"><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">APPLICATION PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" className="panel-action" aria-label="Close Settings" onClick={cancelSettings}>×</button></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{settingsCategories.map((category) => <button key={category} type="button" className={settingsCategory === category ? "active" : ""} onClick={() => setSettingsCategory(category)}>{category}</button>)}</nav><div className="settings-content">{settingsContent[settingsCategory]}</div></div><footer className="settings-footer"><span>Program settings only · Project/Theme/Runtime settings stay in their canonical contexts.</span><div><button type="button" className="settings-button-secondary" onClick={cancelSettings}>Cancel</button><button type="button" className="settings-button-primary" onClick={saveSettings}>Save / Apply &amp; Close</button></div></footer></section></div>}

      {confirmState && <div className="settings-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">CONFIRMATION</span><h2 id="confirm-title">{confirmState.title}</h2></div></header><div className="confirm-body"><p>{confirmState.message}</p></div><footer className="settings-footer"><div><button type="button" className="settings-button-secondary" onClick={() => setConfirmState(null)}>Cancel</button><button type="button" className="settings-button-primary" onClick={() => { const action = confirmState.onConfirm; setConfirmState(null); action(); }}>{confirmState.confirmLabel}</button></div></footer></section></div>}
    </div>
  );
}
