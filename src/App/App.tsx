import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createEmptyProject } from "../Domain/factories";
import { CommandHistory } from "../Core/commands";
import { InMemoryDocumentStore } from "../Core/document-store";
import { createEditorApplication, defaultWidgetName, type MutationResult } from "../Core/editor-application";
import { createDeploymentService } from "../Core/deployment-service";
import { SDCardTarget } from "../Infrastructure/sd-card-target";
import { createRemovableStorageAdapter } from "../Infrastructure/tauri-removable-storage";
import type { RemovableVolume } from "../Core/removable-storage";
import type { SdDeploymentResult, SdDeploymentStage } from "../Core/deployment-service";
import { evaluateActiveSceneBindings, evaluateBinding, selectActiveScene } from "../Core/runtime";
import { validateProject } from "../Core/validation";
import { MAX_BINDING_PRIORITY, MIN_BINDING_PRIORITY } from "../Domain/models";
import { stableSerialize } from "../Core/serialize";
import { createStableId } from "../Domain/identity";
import { LocalStorageProjectStorage } from "../Infrastructure/project-storage";
import { createAssetImportSource } from "../Infrastructure/asset-import";
import { createProjectFileGateway } from "../Infrastructure/project-file";
import { LocalStorageWorkspaceSession } from "../Infrastructure/workspace-session-storage";
import { LocalStorageProgramSettings, defaultProgramSettings, type ProgramSettings } from "../Infrastructure/program-settings-storage";
import type { Asset, Binding, Condition, ConditionMode, ConditionOperator, DeploymentPackage, FloorMapping, FloorMappingEntry, Geometry, MediaSlideContent, MediaSlideItem, MediaType, PrimitiveValue, Project, Rotation, RotationAngle, RuntimeContext, RuntimeSettingDefinition, RuntimeStateDefinition, RuntimeValueType, Scene, ThemeProject, ThemeProjectGroup, VisualMediaType, Widget, WidgetType } from "../Domain/models";
import { DEFAULT_GRID_SIZE, DEFAULT_SNAP_THRESHOLD, calculateAlignUpdates, calculateDistributeUpdates, calculateNudgeStep, calculateZOrderUpdates, exceedsPointerDragThreshold, getBounds, getCanvasViewFrame, hitTest, isCanonicalModifier, isCanvasKeyboardExcludedTarget, marqueeSelection, moveGeometry, normalizeRect, orderSelectionIds, resizeGeometry, screenToCanvas, selectIds, snapGeometryWithTargets, transformGeometryWithinBounds, type CanvasPoint, type CanvasRect, type CanvasViewport, type AlignOperation, type DistributeOperation, type ResizeHandle, type SnapGuide, type ZOrderOperation } from "./canvas-interaction";
import { commandsForSelection, describeSelectionRefusal, type EditorCommandId, type SelectionOperation } from "./editor-commands";
import type { PanelId, PanelMode, SelectionKind } from "./editor-types";
import { activateDockedPanel, defaultPanelLayout, floatingPanels as getFloatingPanels, setPanelLayoutMode } from "./panel-manager";
import { canonicalShortcuts, matchShortcut, shortcutDisplay, shortcutRegistry } from "./shortcut-registry";
import type { DeviceProfileRegistry } from "./profile-registry";

type ViewMode = "design" | "preview";
type CanvasTool = "select" | "pan";
type MenuKey = "File" | "Edit" | "View" | "Project" | "Theme" | "Scene" | "Widget" | "Asset" | "Tools";
type AssetCategory = "depot" | "resources" | "scene" | "unsupported";
type SettingsCategory = "General" | "Appearance" | "Editor" | "Canvas" | "Assets" | "Audio" | "Simulator" | "Validation" | "Export" | "Shortcuts";
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
  title?: string;
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

const menuKeys: MenuKey[] = ["File", "Edit", "View", "Project", "Theme", "Scene", "Widget", "Asset", "Tools"];
const settingsCategories: SettingsCategory[] = ["General", "Appearance", "Editor", "Canvas", "Assets", "Audio", "Simulator", "Validation", "Export", "Shortcuts"];
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
          detail: `Priority ${scene.priority}${scene.enabled === false ? " · disabled" : ""}${scene.activationConditions.length ? ` · ${scene.activationConditions.length} condition(s)` : ""}`,
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
      <strong className={muted ? "property-muted" : undefined} title={value}>{value}</strong>
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

/**
 * Maps a validation issue path such as
 * `themeProjectGroups[0].themeProjects[1].rotations[2].scenes[0].widgets[3].geometry`
 * onto the stable ID of the deepest node it names, so the Validation tab can
 * take the designer straight to the offending object (D5-20).
 */
function resolveValidationTarget(project: Project, path: string | undefined): string | undefined {
  if (!path) return undefined;
  const assetIndex = /^assets\[(\d+)\]/.exec(path);
  if (assetIndex) return project.assets[Number(assetIndex[1])]?.id;
  const indices = [...path.matchAll(/(themeProjectGroups|themeProjects|rotations|scenes|widgets)\[(\d+)\]/g)];
  if (!indices.length) return project.id;
  let target: string | undefined = project.id;
  let group = project.themeProjectGroups[0];
  let theme = group?.themeProjects[0];
  let rotation = theme?.rotations[0];
  let scene = rotation?.scenes[0];
  for (const [, key, raw] of indices) {
    const index = Number(raw);
    if (key === "themeProjectGroups") { group = project.themeProjectGroups[index]; target = group?.id ?? target; }
    else if (key === "themeProjects") { theme = group?.themeProjects[index]; target = theme?.id ?? target; }
    else if (key === "rotations") { rotation = theme?.rotations[index]; target = rotation?.id ?? target; }
    else if (key === "scenes") { scene = rotation?.scenes[index]; target = scene?.id ?? target; }
    else if (key === "widgets") { target = scene?.widgets[index]?.id ?? target; }
  }
  return target;
}
function collectTreeNodeIds(project: Project): string[] {
  const ids = [project.id, "assets"];
  for (const asset of project.assets) ids.push(asset.id);
  for (const group of project.themeProjectGroups) {
    ids.push(group.id);
    for (const theme of group.themeProjects) {
      ids.push(theme.id);
      for (const rotation of theme.rotations) {
        ids.push(rotation.id);
        for (const scene of rotation.scenes) {
          ids.push(scene.id);
          for (const widget of scene.widgets) ids.push(widget.id);
        }
      }
    }
  }
  return ids;
}

/** Counts every canonical reference to an Asset so a delete can explain its impact. */
function countAssetReferences(project: Project, assetId: string): number {
  let count = 0;
  if (project.defaultAssetIds?.includes(assetId)) count += 1;
  for (const group of project.themeProjectGroups) {
    for (const theme of group.themeProjects) {
      count += theme.resources.filter((id) => id === assetId).length;
      count += (theme.defaultAssetIds ?? []).filter((id) => id === assetId).length;
      for (const rotation of theme.rotations) {
        for (const scene of rotation.scenes) {
          for (const widget of scene.widgets) {
            count += (widget.assetIds ?? []).filter((id) => id === assetId).length;
            if (widget.audioAssetId === assetId) count += 1;
            count += (widget.mediaSlide?.items ?? []).filter((item) => item.assetId === assetId).length;
            if (widget.mediaSlide?.audioAssetId === assetId) count += 1;
            count += widget.bindings.filter((binding) => binding.contentId === assetId).length;
          }
        }
      }
    }
  }
  return count;
}

/** Default names stay unique so identically-named scenes/widgets never
 *  make the runtime context ambiguous (final-workflow finding). */
function uniqueDefaultName(base: string, existing: readonly string[]): string {
  if (!existing.includes(base)) return base;
  let counter = 2;
  while (existing.includes(`${base} ${counter}`)) counter += 1;
  return `${base} ${counter}`;
}

type GeometryFieldProps = {
  /** Identity of the object being edited; a change discards any pending draft. */
  scope: string;  label: string;
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
function GeometryField({ label, field, value, multi, disabled, min, max, scope, onCommit }: GeometryFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape abandons the draft synchronously: blur() fires commit() from the
  // same render, where `draft` still holds the typed text, so the abandon
  // decision must travel through a ref, not through state (S3-01).
  const discardRef = useRef(false);
  // Identity guard (defensive, no reproduced defect). A pending draft belongs to
  // ONE object, but React reuses this component instance across selection
  // changes. Today every selection change goes through a pointer interaction
  // that blurs and commits first, and the keyboard paths are excluded while an
  // input has focus, so the stale-draft state is not currently reachable -
  // A/B testing showed no behavioural difference. It is kept because React
  // scheduling is not a stable contract and a future selection path that does
  // not blur would otherwise show one object`s pending text against another.
  useEffect(() => {
    discardRef.current = false;
    setDraft(null);
    setFeedback(null);
  }, [scope]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const commit = () => {
    if (discardRef.current) {
      discardRef.current = false;
      setDraft(null);
      setFeedback(null);
      return;
    }
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
    // A completed commit releases focus so the next Ctrl+Z targets the
    // application, not the (now canonical) text field (S3-02).
    inputRef.current?.blur();
  };
  return (
    <label className={`geometry-field ${feedback ? "has-feedback" : ""}`}>
      <span className="geometry-field-label">{label}<small>scene units</small></span>
      <input
        ref={inputRef}
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
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { discardRef.current = true; setDraft(null); setFeedback(null); inputRef.current?.blur(); }
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

/**
 * Operators that can actually match a value of this type. A DeviceProfile may
 * narrow this further via `operators`; when it declares none, offering all five
 * let a designer pick `contains` for a boolean - valid per the schema, but a
 * condition that can never be true (F14).
 */
export function operatorsForType(type: RuntimeValueType, declared?: readonly ConditionOperator[]): readonly ConditionOperator[] {
  if (declared?.length) return declared;
  if (type === "boolean") return ["equals", "not-equals"];
  if (type === "enum") return ["equals", "not-equals"];
  if (type === "string") return ["equals", "not-equals", "contains"];
  return ["equals", "not-equals", "greater-than", "less-than"];
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
  /** Identity of the object being edited; a change discards any pending draft. */
  scope: string;
  value: string | number;
  disabled: boolean;
  min: number;
  max: number;
  ariaLabel: string;
  /** Refuse fractions instead of letting the Core silently reject them (D5-01). */
  integer?: boolean;
  /** Decimal places the domain accepts; a finer value is reported, not silently rounded. */
  decimals?: number;
  step?: number;
  onCommit: (value: number) => void;
};

/** Draft-per-field numeric input shared by non-geometry properties (zIndex, priority, durations). */
function DraftNumberField({ value, disabled, min, max, ariaLabel, integer = false, decimals, scope, onCommit }: DraftNumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const discardRef = useRef(false);
  // Identity guard (defensive, no reproduced defect). A pending draft belongs to
  // ONE object, but React reuses this component instance across selection
  // changes. Today every selection change goes through a pointer interaction
  // that blurs and commits first, and the keyboard paths are excluded while an
  // input has focus, so the stale-draft state is not currently reachable -
  // A/B testing showed no behavioural difference. It is kept because React
  // scheduling is not a stable contract and a future selection path that does
  // not blur would otherwise show one object`s pending text against another.
  useEffect(() => {
    discardRef.current = false;
    setDraft(null);
    setFeedback(null);
  }, [scope]);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const commit = () => {
    if (discardRef.current) {
      discardRef.current = false;
      setDraft(null);
      setFeedback(null);
      return;
    }
    if (draft === null) return;
    setDraft(null);
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setFeedback("invalid — reverted");
      return;
    }
    if (integer && !Number.isInteger(parsed)) {
      setFeedback("whole numbers only — reverted");
      return;
    }
    if (decimals !== undefined) {
      const factor = 10 ** decimals;
      if (Math.round(parsed * factor) !== parsed * factor) {
        setFeedback(`${decimals} decimal place${decimals === 1 ? "" : "s"} only — reverted`);
        return;
      }
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    setFeedback(clamped !== parsed ? `clamped to ${clamped}` : null);
    onCommit(clamped);
    inputRef.current?.blur();
  };
  return (
    <span className={`draft-number-field ${feedback ? "has-feedback" : ""}`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={draft ?? String(value)}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => { setDraft(event.target.value); setFeedback(null); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { discardRef.current = true; setDraft(null); setFeedback(null); inputRef.current?.blur(); }
        }}
      />
      {feedback && <small className="geometry-feedback" role="status">{feedback}</small>}
    </span>
  );
}

type DraftTextFieldProps = {
  /** Identity of the object being edited; a change discards any pending draft. */
  scope: string;
  value: string;
  disabled: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** Changing this token moves focus into the field and selects it (F2 rename). */
  focusToken?: string | null;
  onCommit: (value: string) => void;
};

/** Draft-per-field text input for rename surfaces: commit once on blur/Enter, Escape reverts. */
function DraftTextField({ value, disabled, placeholder, ariaLabel, focusToken, scope, onCommit }: DraftTextFieldProps) {
  // The draft carries the identity it was typed for, so the check happens at
  // commit time rather than depending on effect ordering. Defensive: no
  // cross-object commit was reproducible - every selection change currently
  // blurs first, which commits the pending text to the object it was typed for.
  const [draft, setDraft] = useState<{ text: string; scope: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const discardRef = useRef(false);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    if (!focusToken || disabled) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusToken, disabled]);
  const commit = () => {
    if (discardRef.current) {
      discardRef.current = false;
      setDraft(null);
      setFeedback(null);
      return;
    }
    if (draft === null) return;
    setDraft(null);
    if (draft.scope !== scope) return;
    const trimmed = draft.text.trim();
    if (trimmed.length === 0) {
      setFeedback("name cannot be empty — reverted");
      return;
    }
    if (trimmed === value) {
      inputRef.current?.blur();
      return;
    }
    onCommit(trimmed);
    inputRef.current?.blur();
  };
  return (
    <span className="draft-text-field">
      <input
        ref={inputRef}
        type="text"
        value={draft && draft.scope === scope ? draft.text : value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => { setDraft({ text: event.target.value, scope }); setFeedback(null); }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Escape") { discardRef.current = true; setDraft(null); setFeedback(null); inputRef.current?.blur(); }
        }}
      />
      {feedback && <small className="geometry-feedback" role="status">{feedback}</small>}
    </span>
  );
}

export function App({ profileRegistry }: { profileRegistry: DeviceProfileRegistry }) {
  const projectStorage = useMemo(() => typeof window === "undefined" ? undefined : new LocalStorageProjectStorage(window.localStorage), []);
  const assetImportSource = useMemo(() => typeof document === "undefined" ? undefined : createAssetImportSource(document), []);
  const projectFileGateway = useMemo(() => typeof document === "undefined" ? undefined : createProjectFileGateway(document), []);
  const workspaceSessionStorage = useMemo(() => typeof window === "undefined" ? undefined : new LocalStorageWorkspaceSession(window.localStorage), []);
  // Boot outcome is captured, not swallowed: a stored project that failed the
  // load gate must be REPORTED, with its raw payload preserved, instead of
  // silently becoming a blank scaffold (D3-10).
  const bootOutcome = useMemo(() => projectStorage?.read() ?? { status: "empty" as const }, [projectStorage]);
  const documentStore = useMemo(() => {
    const store = new InMemoryDocumentStore(new CommandHistory(), projectStorage);
    store.open(bootOutcome.status === "loaded" ? bootOutcome.project : createEmptyProject());
    return store;
  }, [projectStorage, bootOutcome]);
  const documentSubscribe = useMemo(() => (listener: () => void) => documentStore.subscribe(listener), [documentStore]);
  const documentSnapshotReader = useMemo(() => () => documentStore.getSnapshot(), [documentStore]);
  const documentSnapshot = useSyncExternalStore(documentSubscribe, documentSnapshotReader, documentSnapshotReader);
  const project = documentSnapshot.project ?? createEmptyProject();
  const bootSession = workspaceSessionStorage?.load(project.id);
  const restoredSessionZoom = bootSession && bootSession.zoom >= 50 && bootSession.zoom <= 200 ? bootSession.zoom : 100;
  const [panelModes, setPanelModes] = useState<Record<PanelId, PanelMode>>(() => ({ ...defaultPanelLayout }));
  const [leftDockTab, setLeftDockTab] = useState<"explorer" | "assets">(bootSession?.leftDockTab ?? "explorer");
  const [rightDockTab, setRightDockTab] = useState<"properties" | "simulator">(bootSession?.rightDockTab ?? "properties");
  const clampPanelWidth = (preferred: number) => {
    const viewportWidth = typeof window === "undefined" ? 1440 : window.innerWidth;
    return Math.round(Math.min(preferred, Math.max(220, viewportWidth * 0.18)));
  };
  const [leftWidth, setLeftWidth] = useState(() => clampPanelWidth(286));
  const [rightWidth, setRightWidth] = useState(() => clampPanelWidth(298));
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
  const [zoom, setZoom] = useState(restoredSessionZoom);
  const [pan, setPan] = useState<CanvasPoint>({ x: 0, y: 0 });
  const [consoleTab, setConsoleTab] = useState<"console" | "validation" | "deployment">("console");
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([
    { level: "INFO", message: "Foundation shell initialized", time: new Date().toLocaleTimeString([], { hour12: false }) },
  ]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => Object.fromEntries((bootSession?.expandedNodeIds ?? []).map((id) => [id, true])));
  const [assetCategory, setAssetCategory] = useState<AssetCategory>("depot");
  const [assetSearch, setAssetSearch] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>("General");
  const [bindingModal, setBindingModal] = useState<BindingModalState>(null);
  const [clipboard, setClipboard] = useState<{ widgets: Widget[]; cut: boolean } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmRequest | null>(null);
  const [duplicateMode, setDuplicateMode] = useState(false);
  const [bindingDraft, setBindingDraft] = useState<{ stateId: string; operator: string; value: string; negated: boolean; action: string; conditionMode: ConditionMode; contentId: string; targetBindingId: string; priority: number }>({ stateId: "", operator: "equals", value: "", negated: false, action: "show", conditionMode: "all", contentId: "", targetBindingId: "", priority: MIN_BINDING_PRIORITY });
  const editorApplication = useMemo(() => createEditorApplication(documentStore), [documentStore]);
  const commandHistory = documentStore.history;
  const [runtimeValues, setRuntimeValues] = useState<Record<string, PrimitiveValue | null>>({});
  const [runtimeSettings, setRuntimeSettings] = useState<Record<string, PrimitiveValue | null>>({});
  const [simulationStatus, setSimulationStatus] = useState<"idle" | "running" | "paused">("idle");
  const [deploymentStatus, setDeploymentStatus] = useState("Not built");
  // Identity of the document the last package was built from. A build result
  // only describes THAT document (F9).
  const [builtFrom, setBuiltFrom] = useState<string | null>(null);
  const [lastPackage, setLastPackage] = useState<DeploymentPackage | null>(null);
  // Deployment is a destructive operation on someone's card, so its whole state
  // is explicit: which targets were detected, which one the user chose, what
  // stage the pipeline reached, and the last result verbatim.
  const [sdVolumes, setSdVolumes] = useState<readonly RemovableVolume[]>([]);
  const [sdTransport, setSdTransport] = useState<string>("unknown");
  const [sdDetectError, setSdDetectError] = useState<string | null>(null);
  const [sdSelectedId, setSdSelectedId] = useState<string | null>(null);
  const [sdStage, setSdStage] = useState<SdDeploymentStage | null>(null);
  const [sdResult, setSdResult] = useState<SdDeploymentResult | null>(null);
  const [sdBusy, setSdBusy] = useState(false);
  const [storageAdapterReady, setStorageAdapterReady] = useState(false);
  // The removable-storage adapter exists only inside the Tauri shell. In a
  // browser the service reports 'no transport configured' and the UI says so,
  // rather than offering a deployment that cannot happen.
  const storageAdapterRef = useRef<Awaited<ReturnType<typeof createRemovableStorageAdapter>>>(undefined);
  const deploymentService = useMemo(
    () => createDeploymentService([new SDCardTarget()], storageAdapterRef.current),
    [storageAdapterReady],
  );
  const [geometryOverrides, setGeometryOverrides] = useState<Record<string, Geometry>>({});
  const [canvasPointer, setCanvasPointer] = useState<CanvasInteractionState>({ mode: "idle" });
  const canvasPointerRef = useRef<CanvasInteractionState>({ mode: "idle" });
  const [snapGuides, setSnapGuides] = useState<readonly SnapGuide[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; kind: SelectionKind } | null>(null);
  const [canvasViewportSize, setCanvasViewportSize] = useState({ width: 0, height: 0 });
  // Explicit navigation state. Deriving the edited Theme/Rotation/Scene from
  // the Explorer selection made the canvas show the FIRST theme whenever the
  // selection did not resolve to one (L-11), and left Scene switching with no
  // control surface at all (L-09/L-10). Navigation is UI state — it never
  // enters the document — but it is now explicit, switchable and reconciled.
  // The restored session applies only to the SAME project, so a different
  const [activeThemeId, setActiveThemeId] = useState<string | null>(bootSession?.activeThemeId ?? null);
  const [activeRotationAngle, setActiveRotationAngle] = useState<RotationAngle>(bootSession?.activeRotationAngle ?? 0);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(bootSession?.activeSceneId ?? null);
  const [renameRequestId, setRenameRequestId] = useState<string | null>(null);
  const [newProjectDraft, setNewProjectDraft] = useState<{ name: string; profileId: string } | null>(null);
  const [sceneConditionDraft, setSceneConditionDraft] = useState<{ stateId: string; operator: string; value: string; negated: boolean }>({ stateId: "", operator: "equals", value: "", negated: false });
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
  // Every Theme Project in document order, so the Theme switcher and the
  // active-theme fallback share one list.
  const allThemes = useMemo(() => groups.flatMap((currentGroup) => currentGroup.themeProjects), [groups]);
  const activeTheme = allThemes.find((theme) => theme.id === activeThemeId) ?? allThemes[0];
  // Rotation is keyed by ANGLE, not id: every Theme Project has exactly the
  // four canonical angles, so R90 stays R90 when the designer switches theme.
  const activeRotationNode = activeTheme?.rotations.find((rotation) => rotation.angle === activeRotationAngle) ?? activeTheme?.rotations[0];
  const activeSceneNode = activeRotationNode?.scenes.find((scene) => scene.id === activeSceneId) ?? activeRotationNode?.scenes[0];
  const runtimeRotation = activeRotationNode;
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
  // The registry decides what the Simulator exposes and how it is grouped:
  // `simulatorSupport: false` means the device supplies that state, not the designer.
  const simulatorStates = profileStates.filter((state) => state.simulatorSupport);
  const hiddenStateCount = profileStates.length - simulatorStates.length;
  const simulatorStateGroups = useMemo(() => {
    const groups = new Map<string, RuntimeStateDefinition[]>();
    for (const state of simulatorStates) {
      const key = state.category?.trim() || "general";
      groups.set(key, [...(groups.get(key) ?? []), state]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [activeProfile?.id, profileStates.length]);
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

  /**
   * Preview Mode evaluates the runtime; it is an inspection surface. Editing
   * commands refuse there and say so, instead of silently mutating a document
   * the designer believes is read-only (D5-19).
   */
  const blockedInPreview = (command: string): boolean => {
    if (viewMode !== "preview") return false;
    logAction(`${command} is not available in Preview Mode - switch to Design Mode to edit`, "WARN");
    return true;
  };
  const undo = () => {
    if (documentStore.undo()) logAction("> undo()", "EVENT");
  };

  const redo = () => {
    if (documentStore.redo()) logAction("> redo()", "EVENT");
  };

  // Selection reconciliation (INT-25/Scenario F): after undo/redo (or any
  // project change) a selection that no longer resolves is cleared, stale
  // ids are pruned, and the selection LABEL is re-derived from the canonical
  // node so an undone rename can never leave a stale header (S3-03).
  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => Boolean(resolveCanonicalNode(project, id)));
      return next.length === current.length ? current : next;
    });
    setSelection((current) => {
      if (!current) return current;
      const resolved = resolveCanonicalNode(project, current.id);
      if (!resolved) return null;
      const label = "name" in resolved.node ? String(resolved.node.name) : current.label;
      return label === current.label ? current : { ...current, label };
    });
  }, [project]);

  const createProject = (name = "Untitled Project", profileId = project.deviceProfileId) => {
    cancelCanvasInteraction();
    const profile = profileRegistry.get(profileId) ?? availableProfiles[0];
    const nextProject = createEmptyProject(name, profile);
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
    setActiveThemeId(null);
    setActiveRotationAngle(0);
    setActiveSceneId(null);
    clearGeometryPreview();
    logAction(`New document created · ${nextProject.name} · ${profile?.name ?? profileId}`, "EVENT");
  };

  const requestNewProject = () => {
    setNewProjectDraft({ name: "Untitled Project", profileId: project.deviceProfileId });
    setMenuOpen(null);
  };

  const confirmNewProject = () => {
    const draft = newProjectDraft;
    if (!draft) return;
    const create = () => {
      setNewProjectDraft(null);
      createProject(draft.name.trim() || "Untitled Project", draft.profileId);
    };
    if (documentSnapshot.isDirty && savedSettings.confirmDestructive) {
      setNewProjectDraft(null);
      setConfirmState({
        title: "New Project",
        message: "The current project has unsaved changes. Creating a new project discards them.",
        confirmLabel: "Discard & Create",
        onConfirm: () => createProject(draft.name.trim() || "Untitled Project", draft.profileId),
      });
      return;
    }
    create();
  };

  const saveDocument = () => {
    try {
      documentStore.save();
      logAction("Project saved", "EVENT");
    } catch (error) {
      logAction(`Save failed: ${error instanceof Error ? error.message : "storage unavailable"}`, "ERROR");
    }
  };

  const performOpenProject = (): boolean => {
    if (!projectStorage) return false;
    const outcome = projectStorage.read();
    if (outcome.status === "empty") {
      logAction("Revert to Saved: no saved project found in local storage", "WARN");
      return false;
    }
    if (outcome.status === "rejected") {
      logAction(`Revert to Saved refused: ${outcome.reason}${outcome.backupKey ? ` (payload preserved under '${outcome.backupKey}')` : ""}`, "ERROR");
      return false;
    }
    applyOpenedProject(outcome.project, "Project reverted to the last saved state");
    // The reverted document IS the persisted one, so it is clean again.
    documentStore.save();
    return true;
  };

  const openProject = (): boolean => {
    if (blockedInPreview("Revert to Saved")) return false;
    if (!projectStorage) {
      logAction("Revert to Saved is unavailable in this build", "WARN");
      return false;
    }
    if (documentSnapshot.isDirty && savedSettings.confirmDestructive) {
      setConfirmState({
        title: "Revert to Saved",
        message: "Reload the last saved project from local storage? Every change since the last Save is discarded.",
        confirmLabel: "Discard & Revert",
        onConfirm: () => { performOpenProject(); },
      });
      return true;
    }
    return performOpenProject();
  };

  // ---- Asset lifecycle -----------------------------------------------------

  const importAssets = async (): Promise<boolean> => {
    if (!assetImportSource) {
      logAction("Asset import is unavailable in this build", "WARN");
      return false;
    }
    const drafts = await assetImportSource.pick({
      acceptedExtensions: activeProfile?.supportedFormats,
      sourcePrefix: "assets",
    });
    if (!drafts.length) {
      logAction("Asset import cancelled", "WARN");
      return false;
    }
    const existingNames = project.assets.map((asset) => asset.name);
    const named = drafts.map((draft) => {
      const name = uniqueDefaultName(draft.name, existingNames);
      existingNames.push(name);
      return { ...draft, name };
    });
    const result = editorApplication.addAssets(named);
    if (!result.changed) {
      logAction("Asset import produced no valid asset record", "WARN");
      return false;
    }
    const createdIds = result.createdIds ?? [];
    setLeftDockTab("assets");
    activatePanel("assets");
    setAssetCategory("depot");
    if (createdIds.length === 1) {
      const asset = project.assets.find((candidate) => candidate.id === createdIds[0]);
      setSelectedIds([createdIds[0]]);
      setSelection({ id: createdIds[0], label: named[0].name, kind: "asset", detail: asset?.mediaType ?? named[0].mediaType });
    }
    // Every picked file is now imported; the ones whose format the profile
    // cannot classify arrive without a semantic type and are reported, not
    // dropped (F7c).
    const unassigned = named.filter((draft) => !draft.mediaType);
    logAction(`${createdIds.length} asset(s) imported via ${assetImportSource.kind}`, "EVENT");
    if (unassigned.length) {
      setAssetCategory("unsupported");
      logAction(`${unassigned.length} of them have no media type yet (${unassigned.map((draft) => draft.name).join(", ")}) — assign one in Properties, or delete them. They are listed under Unsupported Files.`, "WARN");
    }
    return true;
  };

  const deleteAssetsCommand = (assetIds: readonly string[]): boolean => {
    if (blockedInPreview("Delete Asset")) return false;
    if (!assetIds.length) return false;
    const usage = assetIds.map((assetId) => ({ assetId, uses: countAssetReferences(project, assetId) }));
    const referenced = usage.filter((entry) => entry.uses > 0);
    const run = () => {
      const result = editorApplication.removeAssets(assetIds);
      if (!result.changed) {
        logAction("Delete Asset failed: the asset is no longer in the project", "WARN");
        return false;
      }
      setSelection((current) => current && assetIds.includes(current.id) ? null : current);
      setSelectedIds((current) => current.filter((id) => !assetIds.includes(id)));
      logAction(`${assetIds.length} asset(s) deleted${referenced.length ? " with their references cleared" : ""}`, "EVENT");
      return true;
    };
    if (referenced.length && savedSettings.confirmDestructive) {
      setConfirmState({
        title: "Delete Asset",
        message: `${referenced.length} of ${assetIds.length} asset(s) are still referenced (${referenced.reduce((total, entry) => total + entry.uses, 0)} reference(s)). Deleting clears those references so the project stays valid. This is undoable.`,
        confirmLabel: "Delete & Clear References",
        onConfirm: run,
      });
      return true;
    }
    return run();
  };

  // ---- Project files -------------------------------------------------------

  const exportProjectFile = async (): Promise<boolean> => {
    if (!projectFileGateway) {
      logAction("Export Project File is unavailable in this build", "WARN");
      return false;
    }
    try {
      const fileName = await projectFileGateway.exportProject(project);
      logAction(`Project exported to ${fileName}`, "EVENT");
      return true;
    } catch (error) {
      logAction(`Export Project File failed: ${error instanceof Error ? error.message : "unknown error"}`, "ERROR");
      return false;
    }
  };

  const applyOpenedProject = (opened: Project, origin: string) => {
    cancelCanvasInteraction();
    // An imported document is NOT the persisted one, so it starts dirty and the
    // designer has to Save deliberately (D3-02).
    documentStore.adopt(opened);
    setSelection(null);
    setSelectedIds([]);
    setViewMode("design");
    setExpandedNodes({});
    setRuntimeValues({});
    setRuntimeSettings({});
    setSimulationStatus("idle");
    setDeploymentStatus("Not built");
    setClipboard(null);
    setActiveThemeId(null);
    setActiveRotationAngle(0);
    setActiveSceneId(null);
    clearGeometryPreview();
    logAction(origin, "EVENT");
  };

  const importProjectFile = async (): Promise<boolean> => {
    if (!projectFileGateway) {
      logAction("Import Project File is unavailable in this build", "WARN");
      return false;
    }
    const load = async () => {
      const result = await projectFileGateway.importProject();
      if (!result) {
        logAction("Import Project File cancelled", "WARN");
        return;
      }
      if (!result.ok) {
        logAction(`Import Project File refused '${result.fileName}': ${result.reason}`, "ERROR");
        return;
      }
      applyOpenedProject(result.project, `Project imported from ${result.fileName}`);
    };
    if (documentSnapshot.isDirty && savedSettings.confirmDestructive) {
      setConfirmState({
        title: "Import Project File",
        message: "The current project has unsaved changes. Importing another project discards them.",
        confirmLabel: "Discard & Import",
        onConfirm: () => { void load(); },
      });
      return true;
    }
    await load();
    return true;
  };

  const addThemeProjectGroupCommand = (): boolean => {
    const name = uniqueDefaultName("New Theme Group", groups.map((currentGroup) => currentGroup.name));
    const result = editorApplication.addThemeProjectGroup(name);
    if (!result.changed) return false;
    const createdId = result.createdIds?.[0];
    if (createdId) {
      setExpandedNodes((current) => ({ ...current, [project.id]: true, [createdId]: true }));
      setSelectedIds([createdId]);
      setSelection({ id: createdId, label: name, kind: "theme-group", detail: "0 theme projects" });
    }
    logAction("Theme Project Group added", "EVENT");
    return true;
  };

  const addThemeProject = (): boolean => {
    const groupId = resolvedSelection?.group?.id ?? group?.id;
    if (!groupId) return false;
    const result = editorApplication.addThemeProject(groupId, uniqueDefaultName("New Theme Project", allThemes.map((theme) => theme.name)), activeProfile?.display);
    if (result.changed) {
      const createdId = result.createdIds?.[0];
      if (createdId) {
        setExpandedNodes((current) => ({ ...current, [groupId]: true, [createdId]: true }));
        // Navigation follows creation: otherwise the canvas keeps showing the
        // previous theme while the inspector shows the new one (found live).
        setActiveThemeId(createdId);
        setActiveSceneId(null);
        setSelectedIds([createdId]);
        const created = resolveCanonicalNode(documentStore.getCurrent() ?? project, createdId)?.theme;
        setSelection({ id: createdId, label: created?.name ?? "New Theme Project", kind: "theme" });
      }
      logAction("Theme Project added", "EVENT");
    }
    return result.changed;
  };

  const addScene = (): boolean => {
    if (blockedInPreview("Add Scene")) return false;
    // Navigation is authoritative: Add Scene targets the Rotation / Form the
    // canvas is showing, so it works from the switcher, the menu and the tree.
    const rotationId = activeRotationNode?.id ?? resolvedSelection?.rotation?.id;
    if (!rotationId) {
      logAction("Add Scene blocked: no Rotation / Form is active", "WARN");
      return false;
    }
    const rotation = resolveCanonicalNode(project, rotationId)?.rotation;
    const name = uniqueDefaultName("New Scene", rotation?.scenes.map((scene) => scene.name) ?? []);
    const result = editorApplication.addScene(rotationId, name);
    if (result.changed) {
      const createdId = result.createdIds?.[0];
      if (createdId) {
        setExpandedNodes((current) => ({ ...current, [rotationId]: true }));
        setActiveSceneId(createdId);
        setSelectedIds([createdId]);
        setSelection({ id: createdId, label: name, kind: "scene", detail: "Priority 0" });
      }
      logAction("Scene added", "EVENT");
    }
    return result.changed;
  };

  const addWidget = (widgetType: string): boolean => {
    if (blockedInPreview("Add Widget")) return false;
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
    // Cascade the insertion point so repeated Add Widget never stacks
    // identical boxes on top of each other (S4-01): each new widget steps
    // by the snap grid from the scene centre, wrapping after 8 steps.
    const cascade = (activeScene?.widgets.length ?? 0) % 8;
    const x = Math.max(0, Math.round((((activeRotation.width - width) / 2) + cascade * snapGridSize) / snapGridSize) * snapGridSize);
    const y = Math.max(0, Math.round((((activeRotation.height - height) / 2) + cascade * snapGridSize) / snapGridSize) * snapGridSize);
    const name = uniqueDefaultName(defaultWidgetName(widgetType), activeScene.widgets.map((widget) => widget.name));
    const result = editorApplication.addWidget(sceneId, widgetType, { x, y, width, height }, name);
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
      setSelection({ id: createdId, label: name, kind: "widget", nodeType: widgetType, detail: "Visible" });
    }
    logAction(`Widget added: ${widgetType}`, "EVENT");
    return true;
  };

  // ---- Widget configuration (type-specific half of a Widget) ---------------

  const configureWidget = (patch: Parameters<typeof editorApplication.setWidgetConfiguration>[2], label: string, target?: { sceneId: string; widgetId: string }): boolean => {
    if (blockedInPreview("Widget configuration")) return false;
    const sceneId = target?.sceneId ?? activeScene?.id;
    const widget = target ? resolveCanonicalNode(project, target.widgetId)?.widget : resolvedSelection?.widget;
    if (!sceneId || !widget || (!target && resolvedSelection?.scene?.id !== sceneId)) {
      logAction("Widget configuration requires a single selected widget in the active Scene", "WARN");
      return false;
    }
    const result = editorApplication.setWidgetConfiguration(sceneId, widget.id, patch);
    if (result.changed) logAction(`${label} · ${widget.name}`, "EVENT");
    else logAction(`${label} rejected: the value is not valid for this widget`, "WARN");
    return result.changed;
  };

  const setWidgetContentValue = (key: string, value: unknown, target?: { sceneId: string; widgetId: string }): boolean => {
    const widget = target ? resolveCanonicalNode(project, target.widgetId)?.widget : resolvedSelection?.widget;
    if (!widget) return false;
    const nextContent = { ...(widget.content ?? {}) } as Record<string, unknown>;
    if (value === undefined || value === "" || value === null) delete nextContent[key];
    else nextContent[key] = value;
    return configureWidget({ content: Object.keys(nextContent).length ? nextContent : undefined }, `Set ${key}`);
  };

  const setWidgetStyleValue = (key: string, value: unknown, target?: { sceneId: string; widgetId: string }): boolean => {
    const widget = target ? resolveCanonicalNode(project, target.widgetId)?.widget : resolvedSelection?.widget;
    if (!widget) return false;
    const nextStyle = { ...(widget.style ?? {}) } as Record<string, unknown>;
    if (value === undefined || value === "" || value === null) delete nextStyle[key];
    else nextStyle[key] = value;
    return configureWidget({ style: Object.keys(nextStyle).length ? nextStyle : undefined }, `Set ${key}`);
  };

  const changeWidgetType = (widgetType: string): boolean => {
    if (blockedInPreview("Change Widget Type")) return false;
    const widget = resolvedSelection?.widget;
    if (!widget || widget.widgetType === widgetType) return false;
    if (!activeProfile?.supportedWidgetTypes.includes(widgetType)) {
      logAction(`Widget type '${widgetType}' is not supported by the active DeviceProfile`, "WARN");
      return false;
    }
    const run = () => configureWidget({ widgetType }, `Change widget type to ${widgetType}`);
    // Changing type discards the previous type's content/style, so the user is
    // told before the data goes (it stays undoable either way).
    if ((widget.content || widget.style || widget.mediaSlide) && savedSettings.confirmDestructive) {
      setConfirmState({
        title: "Change Widget Type",
        message: `Changing '${widget.name}' from ${widget.widgetType} to ${widgetType} clears its ${widget.widgetType}-specific configuration. Geometry, z-order and bindings are kept. This is undoable.`,
        confirmLabel: "Change Type",
        onConfirm: run,
      });
      return true;
    }
    return run();
  };

  const setWidgetAssetIds = (assetIds: readonly string[]): boolean => configureWidget({ assetIds }, "Set asset references");

  // ---- Media sequence (ordered) --------------------------------------------
  // Each edit replaces the whole sequence in ONE undoable command, so a reorder
  // is a single history step rather than a remove followed by an insert.

  const commitSequence = (widget: Widget, items: readonly MediaSlideItem[], label: string): boolean => {
    const slide = widget.mediaSlide;
    if (items.length === 0) return configureWidget({ mediaSlide: undefined }, "Clear media sequence");
    const next: MediaSlideContent = {
      ...(slide ?? {}),
      items,
    };
    return configureWidget({ mediaSlide: next }, label);
  };

  const appendSequenceItem = (widget: Widget, assetId: string): boolean => {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (!asset || !asset.mediaType || asset.mediaType === "audio") {
      logAction("A media sequence entry needs an image or video asset with an assigned type", "WARN");
      return false;
    }
    const item: MediaSlideItem = { id: createStableId("media-item"), mediaType: asset.mediaType, assetId, duration: 5 };
    return commitSequence(widget, [...(widget.mediaSlide?.items ?? []), item], `Append ${asset.name} to the media sequence`);
  };

  const removeSequenceItem = (widget: Widget, itemId: string): boolean =>
    commitSequence(widget, (widget.mediaSlide?.items ?? []).filter((item) => item.id !== itemId), "Remove media sequence entry");

  const updateSequenceItem = (widget: Widget, itemId: string, patch: Partial<MediaSlideItem>): boolean =>
    commitSequence(widget, (widget.mediaSlide?.items ?? []).map((item) => item.id === itemId ? { ...item, ...patch } : item), "Edit media sequence entry");

  const moveSequenceItem = (widget: Widget, itemId: string, direction: 1 | -1): boolean => {
    const items = [...(widget.mediaSlide?.items ?? [])];
    const from = items.findIndex((item) => item.id === itemId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= items.length) return false;
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    return commitSequence(widget, items, `Move media sequence entry to position ${to + 1}`);
  };

  // ---- Scene lifecycle & activation ---------------------------------------

  const duplicateSceneCommand = (sceneId: string | undefined): boolean => {
    if (blockedInPreview("Duplicate Scene")) return false;
    if (!sceneId) return false;
    const result = editorApplication.duplicateSelection([sceneId]);
    if (!result.changed) {
      logAction("Duplicate Scene failed", "WARN");
      return false;
    }
    const createdId = result.createdIds?.[0];
    if (createdId) {
      setActiveSceneId(createdId);
      setSelectedIds([createdId]);
      setSelection({ id: createdId, label: `${resolveCanonicalNode(project, sceneId)?.scene?.name ?? "Scene"} Copy`, kind: "scene" });
    }
    logAction("Scene duplicated", "EVENT");
    return true;
  };

  const moveActiveScene = (direction: 1 | -1): boolean => {
    if (blockedInPreview("Move Scene")) return false;
    const rotation = activeRotationNode;
    const sceneId = activeSceneNode?.id;
    if (!rotation || !sceneId) return false;
    const fromIndex = rotation.scenes.findIndex((scene) => scene.id === sceneId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= rotation.scenes.length) {
      logAction(direction < 0 ? "The Scene is already first" : "The Scene is already last", "WARN");
      return false;
    }
    const result = editorApplication.moveScene(rotation.id, sceneId, toIndex);
    if (result.changed) logAction(`Scene moved to position ${toIndex + 1}`, "EVENT");
    return result.changed;
  };

  const commitSceneActivation = (conditions: readonly Condition[], mode: ConditionMode | undefined): boolean => {
    if (blockedInPreview("Scene activation")) return false;
    const sceneId = resolvedSelection?.scene?.id ?? activeSceneNode?.id;
    if (!sceneId) return false;
    const result = editorApplication.setSceneActivation(sceneId, conditions, mode);
    if (result.changed) logAction(`Scene activation updated · ${conditions.length} condition(s) · ${mode ?? "all"}`, "EVENT");
    else logAction("Scene activation rejected: the condition is incomplete", "WARN");
    return result.changed;
  };

  const addSceneCondition = (): boolean => {
    const scene = resolvedSelection?.scene ?? activeSceneNode;
    if (!scene || !sceneConditionDraft.stateId) {
      logAction("Add Activation Condition: choose a DeviceProfile runtime reference first", "WARN");
      return false;
    }
    const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === sceneConditionDraft.stateId);
    if (!definition) return false;
    // Picking a boolean runtime reference means "when it holds": an empty
    // draft must not silently commit "false" (found live).
    const rawValue = definition.type === "boolean" && sceneConditionDraft.value === "" ? "true" : sceneConditionDraft.value;
    const value = coerceBindingDraftValue(rawValue, definition.type);
    if (value === null) {
      logAction("Add Activation Condition: the value does not match the runtime reference type", "WARN");
      return false;
    }
    const isSetting = profileSettings.some((candidate) => candidate.id === definition.id);
    const condition: Condition = {
      ...(isSetting ? { source: "setting" as const } : {}),
      stateId: sceneConditionDraft.stateId,
      operator: sceneConditionDraft.operator as Condition["operator"],
      value,
      ...(sceneConditionDraft.negated ? { negated: true } : {}),
    };
    const changed = commitSceneActivation([...scene.activationConditions, condition], scene.activationConditionMode ?? "all");
    if (changed) setSceneConditionDraft({ stateId: "", operator: "equals", value: "", negated: false });
    return changed;
  };

  const removeSceneCondition = (index: number): boolean => {
    const scene = resolvedSelection?.scene ?? activeSceneNode;
    if (!scene) return false;
    return commitSceneActivation(scene.activationConditions.filter((_, current) => current !== index), scene.activationConditionMode ?? "all");
  };

  const setThemeResources = (themeId: string, assetIds: readonly string[]): boolean => {
    const result = editorApplication.setThemeResources(themeId, assetIds);
    if (result.changed) logAction(`Theme resources updated · ${assetIds.length} asset(s)`, "EVENT");
    return result.changed;
  };

  const duplicateThemeCommand = (themeId: string | undefined): boolean => {
    if (blockedInPreview("Duplicate Theme Project")) return false;
    if (!themeId) return false;
    const result = editorApplication.duplicateSelection([themeId]);
    if (!result.changed) {
      logAction("Duplicate Theme Project failed", "WARN");
      return false;
    }
    const createdId = result.createdIds?.[0];
    if (createdId) {
      setActiveThemeId(createdId);
      setActiveSceneId(null);
      setSelectedIds([createdId]);
      setSelection({ id: createdId, label: `${resolveCanonicalNode(project, themeId)?.theme?.name ?? "Theme"} Copy`, kind: "theme" });
    }
    logAction("Theme Project duplicated with all four rotations", "EVENT");
    return true;
  };

  /** Deletes one named node from a menu without depending on the current selection. */
  const deleteNodeCommand = (nodeId: string | undefined, kindLabel: string): boolean => {
    if (blockedInPreview("Delete")) return false;
    if (!nodeId) return false;
    const resolved = resolveCanonicalNode(project, nodeId);
    if (!resolved) return false;
    if (resolved.kind === "rotation") {
      logAction("Delete refused: a Theme Project must keep exactly Rotation/Form R0, R90, R180 and R270.", "WARN");
      return false;
    }
    const label = "name" in resolved.node ? String(resolved.node.name) : kindLabel;
    const run = () => {
      const result = editorApplication.deleteSelection([nodeId]);
      if (!result.changed) {
        logAction(`Delete refused: ${kindLabel} '${label}' cannot be removed (a project must keep at least one Theme Project Group).`, "WARN");
        return false;
      }
      setSelection((current) => current?.id === nodeId ? null : current);
      setSelectedIds((current) => current.filter((id) => id !== nodeId));
      logAction(`${kindLabel} deleted: ${label}`, "EVENT");
      return true;
    };
    if (savedSettings.confirmDestructive) {
      setConfirmState({ title: `Delete ${kindLabel}`, message: `Delete ${kindLabel} '${label}' and everything inside it? This is undoable.`, confirmLabel: "Delete", onConfirm: run });
      return true;
    }
    return run();
  };

  /** Zoom to fit: clears pan and returns to the 100% baseline the frame is sized for. */
  const zoomToFit = () => {
    setPan({ x: 0, y: 0 });
    setZoom(100);
    logAction("Canvas fitted to the device frame", "EVENT");
    setMenuOpen(null);
  };

  const deselectAll = () => {
    if (!selectedIds.length) return;
    setSelection(null);
    setSelectedIds([]);
    logAction("Selection cleared", "EVENT");
    setMenuOpen(null);
  };

  /** Records the active DeviceProfile version, clearing a drift warning. */
  const adoptProfileVersion = (): boolean => {
    if (!activeProfile) return false;
    const result = editorApplication.adoptDeviceProfileVersion(activeProfile.version);
    if (result.changed) logAction(`DeviceProfile version recorded as ${activeProfile.version}`, "EVENT");
    setMenuOpen(null);
    return result.changed;
  };

  const resetZoom = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
    logAction("Zoom reset to 100%", "EVENT");
    setMenuOpen(null);
  };

  /** F2 / Edit ▸ Rename: reveals Properties and focuses the canonical Name field. */
  const requestRename = () => {
    if (!selection) return;
    activatePanel("properties");
    setRenameRequestId(selection.id);
    setMenuOpen(null);
  };

  const performDeleteSelection = (): boolean => {
    if (blockedInPreview("Delete")) return false;
    if (!selectedIds.length) return false;
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    const allAssets = kinds.length > 0 && kinds.every((kind) => kind === "asset");
    if (allAssets) {
      const result = editorApplication.removeAssets(selectedIds);
      if (!result.changed) return false;
      setSelection(null);
      setSelectedIds([]);
      logAction(`${selectedIds.length} asset(s) deleted with their references cleared`, "EVENT");
      return true;
    }
    if (kinds.some((kind) => kind === "asset")) {
      logAction("Delete blocked: mixed asset and hierarchy selection. Select assets only or hierarchy nodes only.", "WARN");
      return false;
    }
    if (kinds.some((kind) => kind === "rotation")) {
      logAction("Delete refused: a Theme Project must keep exactly Rotation/Form R0, R90, R180 and R270.", "WARN");
      return false;
    }
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

  /**
   * Reads the shared refusal policy (`describeSelectionRefusal`) so the menu
   * affordance and the runtime refusal can never drift (D2-05/D2-06/D2-09).
   */
  const selectionRefusal = (operation: SelectionOperation): string | undefined => {
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    if (selectedIds.length && !kinds.length) return "The selection no longer resolves to a canonical object";
    return describeSelectionRefusal(kinds, operation, groups.length);
  };

  const deleteSelectionCommand = (): boolean => {
    if (blockedInPreview("Delete")) return false;
    if (!selectedIds.length) return false;
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    // Refusals are reported BEFORE the confirmation prompt: asking the user to
    // confirm a delete that the Core will refuse is misleading (D2-05/D2-09).
    if (kinds.some((kind) => kind === "rotation")) {
      logAction("Delete refused: a Theme Project must keep exactly Rotation/Form R0, R90, R180 and R270.", "WARN");
      return false;
    }
    if (kinds.some((kind) => kind === "theme-group") && groups.length === 1) {
      logAction("Delete refused: a project must keep at least one Theme Project Group.", "WARN");
      return false;
    }
    if (kinds.length > 0 && kinds.every((kind) => kind === "asset")) return deleteAssetsCommand(selectedIds);
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
    if (blockedInPreview("Duplicate")) return false;
    if (!selectedIds.length) return false;
    const kinds = selectedIds.map((id) => resolveCanonicalNode(project, id)?.kind).filter((kind): kind is SelectionKind => Boolean(kind));
    if (kinds.some((kind) => kind === "rotation")) {
      logAction("Duplicate refused: duplicating a Rotation / Form would break the canonical four (R0/R90/R180/R270).", "WARN");
      return false;
    }
    if (kinds.some((kind) => kind === "asset")) {
      logAction("Duplicate is not defined for Assets — import the file again or reuse the same asset.", "WARN");
      return false;
    }
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
    if (blockedInPreview("Paste")) return false;
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
    const target = profileRegistry.get(profileId);
    if (!target) {
      logAction(`Device Profile '${profileId}' is not registered`, "WARN");
      return false;
    }
    if (target.id === project.deviceProfileId) return false;
    const run = () => {
      // The display geometry travels with the switch: leaving stale Rotation
      // dimensions behind silently corrupts every scene-unit coordinate (L-18).
      const result = editorApplication.setProjectDeviceProfile(target.id, target.display, target.version);
      if (result.changed) logAction(`Device Profile switched to ${target.name} · rotations re-dimensioned to ${target.display.width} × ${target.display.height}`, "EVENT");
      return result.changed;
    };
    const unsupportedTypes = [...new Set(allThemes.flatMap((theme) => theme.rotations.flatMap((rotation) => rotation.scenes.flatMap((scene) => scene.widgets.map((widget) => widget.widgetType)))))]
      .filter((widgetType) => !target.supportedWidgetTypes.includes(widgetType));
    const message = [
      `Every Rotation / Form is re-dimensioned to ${target.display.width} × ${target.display.height} (R90/R270 swapped) and widgets are clamped back inside the display.`,
      unsupportedTypes.length ? `Widget type(s) ${unsupportedTypes.join(", ")} are not supported by ${target.name} and will be reported by validation.` : "",
      "This is undoable.",
    ].filter(Boolean).join(" ");
    if (savedSettings.confirmDestructive) {
      setConfirmState({ title: "Switch Device Profile", message, confirmLabel: "Switch Profile", onConfirm: run });
      return true;
    }
    return run();
  };

  const toggleWidgetProperty = (property: "locked" | "visible" | "enabled"): boolean => {
    if (blockedInPreview("Widget toggle")) return false;
    const sceneId = activeScene?.id;
    const selected = activeScene?.widgets.filter((widget) => selectedWidgetIds.includes(widget.id)) ?? [];
    if (!sceneId || !selected.length) {
      logAction("Toggle requires a selected widget in the active Scene", "WARN");
      return false;
    }
    const allSet = selected.every((widget) => widget[property]);
    const result = editorApplication.setWidgetsPropertiesInScene(sceneId, selected.map((widget) => widget.id), { [property]: !allSet });
    if (result.changed) logAction(`${property === "locked" ? (allSet ? "Unlock" : "Lock") : property === "visible" ? (allSet ? "Hide" : "Show") : allSet ? "Disable" : "Enable"} applied to ${selected.length} widget(s)`, "EVENT");
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

  /**
   * Renames an EXPLICIT node. The previous version resolved its target from the
   * ambient `selection` at commit time; naming the target instead removes that
   * dependency, so a commit is correct regardless of when it is dispatched.
   * No mis-target was reproducible - this closes the hazard, not a live defect.
   */
  const renameNodeById = (nodeId: string, name: string): boolean => {
    const result = editorApplication.renameNode(nodeId, name);
    if (result.changed) {
      setSelection((current) => current && current.id === nodeId ? { ...current, label: name.trim() } : current);
      logAction(`Renamed to ${name.trim()}`, "EVENT");
    }
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
    // `source` MUST be recorded: a runtime SETTING validated against the state
    // registry is reported as UNKNOWN_RUNTIME_REFERENCE and can never match
    // (D5-10). The Binding editor offers settings, so it must label them.
    const isSetting = profileSettings.some((candidate) => candidate.id === definition.id);
    const condition: Condition = {
      ...(isSetting ? { source: "setting" as const } : {}),
      stateId: bindingDraft.stateId,
      operator: bindingDraft.operator as Condition["operator"],
      value,
      ...(bindingDraft.negated ? { negated: true } : {}),
    };
    // "Add condition to selected binding" extends an existing rule instead of
    // creating a second single-condition binding (D5-11).
    if (bindingDraft.targetBindingId) {
      const target = widget.bindings.find((binding) => binding.id === bindingDraft.targetBindingId);
      if (!target) {
        logAction("Add Binding: the target binding no longer exists", "WARN");
        return false;
      }
      const nextBindings = widget.bindings.map((binding) => binding.id === target.id ? { ...binding, conditions: [...binding.conditions, condition] } : binding);
      const extended = editorApplication.replaceWidgetBindings(sceneId, widget.id, nextBindings);
      if (extended.changed) {
        logAction(`Condition added to binding ${target.action}`, "EVENT");
        setBindingDraft((current) => ({ ...current, stateId: "", value: "", negated: false }));
      }
      return extended.changed;
    }
    const binding: Binding = {
      id: createStableId("binding"),
      widgetId: widget.id,
      conditions: [condition],
      conditionMode: bindingDraft.conditionMode,
      action: bindingDraft.action as Binding["action"],
      priority: bindingDraft.priority,
      ...(bindingDraft.contentId ? { contentId: bindingDraft.contentId } : {}),
    };
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, [...widget.bindings, binding]);
    if (result.changed) {
      logAction(`Binding added: ${bindingDraft.stateId} → ${bindingDraft.action}`, "EVENT");
      setBindingDraft({ stateId: "", operator: "equals", value: "", negated: false, action: "show", conditionMode: "all", contentId: "", targetBindingId: "", priority: MIN_BINDING_PRIORITY });
    }
    return result.changed;
  };

  /** Binding priority 0-15; higher wins when several bindings match one widget. */
  const setBindingPriority = (bindingId: string, priority: number): boolean => {
    const resolved = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId) : undefined;
    const sceneId = resolved?.scene?.id;
    const widget = resolved?.widget;
    if (!sceneId || !widget) return false;
    if (!Number.isInteger(priority) || priority < MIN_BINDING_PRIORITY || priority > MAX_BINDING_PRIORITY) {
      logAction(`Binding priority must be a whole number from ${MIN_BINDING_PRIORITY} through ${MAX_BINDING_PRIORITY}`, "WARN");
      return false;
    }
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, widget.bindings.map((binding) => binding.id === bindingId ? { ...binding, priority } : binding));
    if (result.changed) logAction(`Binding priority set to ${priority}`, "EVENT");
    return result.changed;
  };

  const setBindingConditionMode = (bindingId: string, mode: ConditionMode): boolean => {
    const resolved = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId) : undefined;
    const sceneId = resolved?.scene?.id;
    const widget = resolved?.widget;
    if (!sceneId || !widget) return false;
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, widget.bindings.map((binding) => binding.id === bindingId ? { ...binding, conditionMode: mode } : binding));
    if (result.changed) logAction(`Binding condition mode set to ${mode}`, "EVENT");
    return result.changed;
  };

  const removeBindingCondition = (bindingId: string, index: number): boolean => {
    const resolved = bindingModal ? resolveCanonicalNode(project, bindingModal.widgetId) : undefined;
    const sceneId = resolved?.scene?.id;
    const widget = resolved?.widget;
    const binding = widget?.bindings.find((candidate) => candidate.id === bindingId);
    if (!sceneId || !widget || !binding) return false;
    if (binding.conditions.length <= 1) {
      logAction("A binding requires at least one condition — remove the whole binding instead", "WARN");
      return false;
    }
    const result = editorApplication.replaceWidgetBindings(sceneId, widget.id, widget.bindings.map((candidate) => candidate.id === bindingId ? { ...candidate, conditions: candidate.conditions.filter((_, current) => current !== index) } : candidate));
    if (result.changed) logAction("Binding condition removed", "EVENT");
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

  /** Multi-selection alignment / distribution: one undoable geometry command. */
  const alignSelection = (operation: AlignOperation | DistributeOperation, kind: "align" | "distribute"): boolean => {
    if (blockedInPreview(kind === "align" ? "Align" : "Distribute")) return false;
    const sceneId = activeScene?.id;
    const editable = selectedEditableWidgets;
    const minimum = kind === "align" ? 2 : 3;
    if (!sceneId || editable.length < minimum) {
      logAction(`${kind === "align" ? "Align" : "Distribute"} needs at least ${minimum} unlocked widgets in the active Scene`, "WARN");
      return false;
    }
    const updates = kind === "align"
      ? calculateAlignUpdates(editable, operation as AlignOperation)
      : calculateDistributeUpdates(editable, operation as DistributeOperation);
    if (!updates) {
      logAction(kind === "align" ? "Selection is already aligned" : "Selection cannot be distributed: the widgets already overlap more than their span allows", "WARN");
      return false;
    }
    commitGeometryCommand(sceneId, updates, kind === "align" ? `Align ${operation}` : `Distribute ${operation}`);
    return true;
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
    else if (commandId === "project.add-theme-group") changed = addThemeProjectGroupCommand();
    else if (commandId === "theme.duplicate") changed = duplicateThemeCommand(resolvedSelection?.theme?.id ?? activeTheme?.id);
    else if (commandId === "theme.delete") changed = deleteNodeCommand(resolvedSelection?.theme?.id ?? activeTheme?.id, "Theme Project");
    else if (commandId === "scene.duplicate") changed = duplicateSceneCommand(resolvedSelection?.scene?.id ?? activeSceneNode?.id);
    else if (commandId === "scene.delete") changed = deleteNodeCommand(resolvedSelection?.scene?.id ?? activeSceneNode?.id, "Scene");
    else if (commandId === "scene.move-earlier") changed = moveActiveScene(-1);
    else if (commandId === "scene.move-later") changed = moveActiveScene(1);
    else if (commandId === "asset.import") { setContextMenu(null); void importAssets(); return; }
    else if (commandId === "asset.delete") changed = deleteAssetsCommand(selectedAssetIds.length ? selectedAssetIds : resolvedSelection?.asset ? [resolvedSelection.asset.id] : []);
    else if (commandId === "node.rename") { requestRename(); setContextMenu(null); return; }
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
    // Commands that open a confirmation have not executed yet; their own
    // handler logs the outcome once the user decides (F24).
    if (changed && !confirmState) logAction(`${commandId} executed`, "EVENT");
    setContextMenu(null);
  };

  /**
   * Packaging goes through the application service, which owns the adapter
   * plane. The editor never learns which transport is configured, per the
   * AGENTS.md UI -> Service -> Adapter chain (F16).
   */
  const buildAndVerifyPackage = async () => {
    if (!activeProfile) {
      setDeploymentStatus("Blocked · DeviceProfile unavailable");
      logAction("Package build blocked: the active DeviceProfile is not registered", "ERROR");
      return;
    }
    if (!validation.valid) {
      setDeploymentStatus("Blocked · validation failed");
      activatePanel("console");
      setConsoleTab("validation");
      validation.issues.filter((issue) => issue.severity === "error").forEach((issue) => logAction(`${issue.code}: ${issue.message}`, "ERROR"));
      return;
    }
    setDeploymentStatus("Building…");
    const outcome = await deploymentService.buildVerified(project, activeProfile);
    if (outcome.status === "blocked") {
      setBuiltFrom(null);
      setDeploymentStatus("Blocked · export error");
      logAction(`Package build blocked (${outcome.code}): ${outcome.reason}`, "ERROR");
      return;
    }
    setBuiltFrom(stableSerialize(project));
    setDeploymentStatus("Built · checksum verified");
    logAction(`Package verified · ${outcome.package.manifest.assetIds.length} asset record(s) · ${outcome.package.files.length} file(s)`, "INFO");
    setLastPackage(outcome.package);
    setSdResult(null);
    const transports = deploymentService.targets();
    logAction(transports.length ? `Transports available: ${transports.map((target) => target.displayName).join(", ")}` : "No deployment transport is configured in this build", transports.length ? "INFO" : "WARN");
  };

  // ---- SD-card deployment --------------------------------------------------

  const detectSdTargets = async (): Promise<boolean> => {
    setSdBusy(true);
    try {
      const outcome = await deploymentService.detectTargets();
      setSdVolumes(outcome.volumes);
      setSdTransport(outcome.transport);
      setSdDetectError(outcome.error ?? null);
      // Only a removable volume may be auto-highlighted, and only when it is the
      // single candidate. Anything else must be chosen deliberately.
      const removable = outcome.volumes.filter((volume) => volume.removable && !volume.readOnly);
      setSdSelectedId(removable.length === 1 ? removable[0].id : null);
      if (outcome.error) logAction(`Target detection: ${outcome.error}`, "WARN");
      else logAction(`${outcome.volumes.length} volume(s) detected · ${removable.length} writable removable target(s) · transport ${outcome.transport}`, "EVENT");
      return removable.length > 0;
    } finally {
      setSdBusy(false);
    }
  };

  const deployToSdCard = async (): Promise<boolean> => {
    const volume = sdVolumes.find((candidate) => candidate.id === sdSelectedId);
    if (!lastPackage) {
      logAction("Deployment needs a verified package — run Build & Verify Package first", "WARN");
      return false;
    }
    if (!volume) {
      logAction("Deployment needs an explicitly selected target", "WARN");
      return false;
    }
    setSdBusy(true);
    setSdResult(null);
    setDeploymentStatus(`Deploying to ${volume.mountPath}…`);
    try {
      const result = await deploymentService.deployToSdCard(lastPackage, volume, {
        onStage: (stage) => setSdStage(stage),
        onProgress: (progress) => setDeploymentStatus(`Writing ${progress.writtenFiles}/${progress.totalFiles} file(s) to ${volume.mountPath}…`),
      });
      setSdResult(result);
      if (result.status === "verified") {
        setDeploymentStatus(`Deployed · ${volume.mountPath} · ${result.writtenFiles} file(s) verified`);
        logAction(`Deployment verified on ${volume.mountPath}: ${result.writtenFiles} file(s), ${result.writtenBytes} byte(s) read back and compared`, "INFO");
        return true;
      }
      // A failed deployment never reads as done, and always says which stage.
      setDeploymentStatus(`Deployment failed · ${result.stage} · ${volume.mountPath}`);
      logAction(`Deployment failed at ${result.stage} (${result.code}): ${result.message} — ${result.remediation}`, "ERROR");
      if (result.partial) logAction(`${result.partial.writtenFiles} file(s) had already been written; the card is in an incomplete state and must not be used`, "ERROR");
      return false;
    } finally {
      setSdBusy(false);
      setSdStage(null);
    }
  };

  const ejectSdTarget = async (): Promise<boolean> => {
    if (!sdSelectedId) return false;
    const report = await deploymentService.ejectTarget(sdSelectedId);
    if (report.ok) {
      logAction("Target ejected safely", "EVENT");
      void detectSdTargets();
      return true;
    }
    // 'Unsupported' is the honest answer where the platform gives no reliable
    // mechanism; it is reported as a limitation, not as a failed attempt.
    logAction(`${report.unsupported ? "Safe eject is not available in this build" : "Eject failed"} (${report.code}): ${report.message}`, report.unsupported ? "WARN" : "ERROR");
    return false;
  };

  /** Writes the last verified package through the configured transport. */
  const writePackage = async () => {
    if (!lastPackage) {
      logAction("Write requires a verified package — run Build & Verify first", "WARN");
      return;
    }
    const target = deploymentService.targets()[0];
    if (!target) {
      logAction("No deployment transport is configured in this build", "WARN");
      return;
    }
    setDeploymentStatus(`Writing to ${target.displayName}…`);
    const outcome = await deploymentService.write(lastPackage, target.id);
    if (outcome.status === "written") {
      setDeploymentStatus(`Written · ${outcome.target.displayName} · verified`);
      logAction(`Package written and verified on ${outcome.target.displayName}`, "INFO");
      return;
    }
    // The transport's own refusal, surfaced verbatim: V1 has no native SD-card
    // write, and the product says so instead of implying success.
    setDeploymentStatus(`Blocked · ${target.displayName} unavailable`);
    logAction(`Write to ${target.displayName} unavailable (${outcome.code}): ${outcome.reason}`, "ERROR");
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
    setLeftWidth(clampPanelWidth(286));
    setRightWidth(clampPanelWidth(298));
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
    if (!canonical) {
      // Synthetic grouping rows carry no canonical identity; selecting one
      // used to leave the inspector on its empty state while the tree showed
      // a selected row (L-05).
      logAction(`${node.kind} is a grouping row and cannot be selected`, "WARN");
      return;
    }
    syncNavigationTo(canonical);
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

  /** Validation tab -> editor: select the accused node and reveal it. */
  const revealValidationTarget = (nodeId: string) => {
    const resolved = resolveCanonicalNode(project, nodeId);
    if (!resolved) {
      logAction("The reported object no longer exists in the project", "WARN");
      return;
    }
    syncNavigationTo(resolved);
    setSelectedIds([nodeId]);
    setSelection({
      id: nodeId,
      label: "name" in resolved.node ? String(resolved.node.name) : resolved.kind === "rotation" ? `R${resolved.rotation?.angle}` : nodeId,
      kind: resolved.kind,
      nodeType: resolved.widget?.widgetType,
      detail: resolved.kind === "widget" ? (resolved.widget?.locked ? "Locked" : resolved.widget?.visible ? "Visible" : "Hidden") : resolved.kind === "scene" ? `Priority ${resolved.scene?.priority}` : resolved.kind === "rotation" ? `${resolved.rotation?.width} × ${resolved.rotation?.height}` : `reported by validation`,
    });
    setExpandedNodes((current) => ({
      ...current,
      [project.id]: true,
      ...(resolved.group ? { [resolved.group.id]: true } : {}),
      ...(resolved.theme ? { [resolved.theme.id]: true } : {}),
      ...(resolved.rotation ? { [resolved.rotation.id]: true } : {}),
      ...(resolved.scene ? { [resolved.scene.id]: true } : {}),
      ...(resolved.asset ? { assets: true } : {}),
    }));
    activatePanel("properties");
    logAction(`Validation target selected: ${"name" in resolved.node ? String(resolved.node.name) : nodeId}`, "EVENT");
  };
  const clearSelection = () => {
    setSelection(null);
    setSelectedIds([]);
    logAction("Canvas selection cleared");
  };

  // ---- Navigation (Theme / Rotation / Scene) -------------------------------
  // Navigation is explicit UI state. Selecting a node in any surface pulls
  // navigation along, and the switchers set it directly, so the canvas always
  // shows the context the designer last pointed at.

  const navigateToTheme = (themeId: string) => {
    setActiveThemeId(themeId);
    setActiveSceneId(null);
    setMenuOpen(null);
  };

  const navigateToRotation = (angle: RotationAngle) => {
    setActiveRotationAngle(angle);
    setActiveSceneId(null);
    setMenuOpen(null);
  };

  const navigateToScene = (sceneId: string) => {
    setActiveSceneId(sceneId);
    setMenuOpen(null);
  };

  const syncNavigationTo = (resolved: ResolvedNode | undefined) => {
    if (!resolved) return;
    if (resolved.theme) setActiveThemeId(resolved.theme.id);
    if (resolved.rotation) setActiveRotationAngle(resolved.rotation.angle);
    if (resolved.scene) setActiveSceneId(resolved.scene.id);
  };

  const stepScene = (direction: 1 | -1) => {
    const scenes = activeRotationNode?.scenes ?? [];
    if (scenes.length < 2) {
      logAction(scenes.length === 0 ? "No Scene in the active Rotation / Form" : "The active Rotation / Form has a single Scene", "WARN");
      return;
    }
    const index = scenes.findIndex((scene) => scene.id === activeSceneNode?.id);
    const next = scenes[(((index < 0 ? 0 : index) + direction) + scenes.length) % scenes.length];
    navigateToScene(next.id);
    logAction(`Scene: ${next.name}`, "EVENT");
  };

  const stepRotation = (direction: 1 | -1) => {
    const angles = (activeTheme?.rotations ?? []).map((rotation) => rotation.angle);
    if (angles.length < 2) return;
    const index = angles.indexOf(activeRotationNode?.angle ?? angles[0]);
    const next = angles[(((index < 0 ? 0 : index) + direction) + angles.length) % angles.length];
    navigateToRotation(next);
    logAction(`Rotation / Form: R${next}`, "EVENT");
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

  // Declared before the Explorer tree, which is their first use: as consts they
  // are in a temporal dead zone until this point, and using them earlier crashed
  // the whole App to the error boundary (caught only by a live run).
  const assetTypeLabel = (mediaType: string | undefined) => mediaType ?? "type not assigned";
  const assetGlyph = (mediaType: string | undefined) => mediaType === "audio" ? "♫" : mediaType === "video" ? "▶" : mediaType === "image" ? "▧" : "⊘";
  const themeResourceCount = new Set(groups.flatMap((currentGroup) => currentGroup.themeProjects.flatMap((theme) => theme.resources))).size;
  const projectTree: TreeNode = {
    id: project.id,
    label: project.name,
    kind: "Project",
    detail: `Schema v${project.schemaVersion} · ${activeProfile?.name ?? project.deviceProfileId}`,
    children: [
      ...groups.map((currentGroup) => ({
        id: currentGroup.id,
        label: currentGroup.name,
        kind: "Theme Project Group",
        detail: `${currentGroup.themeProjects.length} theme project${currentGroup.themeProjects.length === 1 ? "" : "s"}`,
        children: getThemeNodes(currentGroup),
      })),
      {
        // Real Assets subtree: every child resolves to a canonical Asset, so
        // selecting one opens a real inspector. The container itself carries no
        // canonical identity and is therefore not selectable (L-05).
        id: "assets",
        label: "Assets",
        kind: "Assets",
        disabled: true,
        detail: `${project.assets.length} asset${project.assets.length === 1 ? "" : "s"} · ${themeResourceCount} theme resource${themeResourceCount === 1 ? "" : "s"}`,
        children: project.assets.map((asset) => ({
          id: asset.id,
          label: asset.name,
          kind: "Asset",
          nodeType: asset.mediaType ?? "unassigned",
          detail: `${assetTypeLabel(asset.mediaType)} · ${countAssetReferences(project, asset.id) > 0 ? `${countAssetReferences(project, asset.id)} reference(s)` : "unused"}`,
        })),
      },
    ],
  };

  const activeRotation = activeRotationNode;
  const activeScene = activeSceneNode;
  const canvasWidgets = activeScene?.widgets ?? [];
  // Preview Mode evaluates the runtime: the runtime-active Scene is rendered
  // with its bindings applied. Design Mode edits the Explorer-selected Scene.
  const previewActive = viewMode === "preview" && Boolean(runtime.activeScene);
  const displayedWidgets = previewActive && runtime.activeScene ? runtime.activeScene.widgets : canvasWidgets;
  const bindingEffects = useMemo(() => {
    const effects: Record<string, { hidden?: boolean; playback?: Binding["action"]; contentId?: string; decidedBy?: string }> = {};
    if (!activeProfile) return effects;
    for (const widget of displayedWidgets) {
      // Product decision: binding priority is an integer 0-15, independent of
      // Scene priority. Higher wins; document order breaks a tie; an absent
      // priority is the lowest level, so it never outranks an explicit one.
      const matched = widget.bindings
        .map((binding, index) => ({ binding, index, evaluation: evaluateBinding(binding, runtimeContext, activeProfile) }))
        .filter((entry) => entry.evaluation.matched)
        .sort((left, right) => (left.binding.priority ?? MIN_BINDING_PRIORITY) - (right.binding.priority ?? MIN_BINDING_PRIORITY) || left.index - right.index);
      for (const { binding } of matched) {
        const current = effects[widget.id] ?? {};
        const decidedBy = `priority ${binding.priority ?? MIN_BINDING_PRIORITY}`;
        if (binding.action === "hide") effects[widget.id] = { ...current, hidden: true, decidedBy };
        else if (binding.action === "show") effects[widget.id] = { ...current, hidden: false, decidedBy };
        else if (binding.action === "play" || binding.action === "pause" || binding.action === "stop" || binding.action === "restart" || binding.action === "continue") {
          effects[widget.id] = { ...current, playback: binding.action, decidedBy };
        }
        if (binding.contentId) effects[widget.id] = { ...(effects[widget.id] ?? {}), contentId: binding.contentId, decidedBy };
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
  const selectedAssetIds = selectedIds.filter((id) => project.assets.some((asset) => asset.id === id));
  const selectedSceneWidgets = activeScene?.widgets.filter((widget) => selectedWidgetIds.includes(widget.id)) ?? [];
  const selectedWidgetsAllLocked = selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((widget) => widget.locked);
  const selectedWidgetsAllVisible = selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((widget) => widget.visible);
  const selectedWidgetsAllEnabled = selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((widget) => widget.enabled);
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

  const clampGeometryToScene = (geometry: Geometry): Geometry => {
    if (!activeRotation) return geometry;
    const width = Math.min(geometry.width, activeRotation.width);
    const height = Math.min(geometry.height, activeRotation.height);
    return {
      ...geometry,
      width,
      height,
      x: Math.min(Math.max(0, geometry.x), Math.max(0, activeRotation.width - width)),
      y: Math.min(Math.max(0, geometry.y), Math.max(0, activeRotation.height - height)),
    };
  };

  const commitGeometryCommand = (sceneId: string | undefined, updates: Readonly<Record<string, Geometry>>, label: string) => {
    // Scene-bounds clamp (S1-04): a committed geometry can never strand a
    // widget outside the active Rotation's logical space.
    const clamped = Object.fromEntries(Object.entries(updates).map(([id, geometry]) => [id, clampGeometryToScene(geometry)]));
    const result = sceneId ? editorApplication.setWidgetGeometriesInScene(sceneId, clamped, label) : { changed: false };
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
    // Interactive elements inside the device surface (widgets, handles and
    // the empty-state Add Widget button) must receive their own pointer
    // events; marquee only starts on truly empty canvas (S2-01).
    if ((event.target as HTMLElement).closest(".canvas-widget, .resize-handle, .canvas-empty-state, button")) return;
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
    // NOTE: pointer capture is acquired LAZILY when the drag threshold is
    // crossed (S1-01): capturing on pointerdown retargets the terminating
    // click to the device screen, which cleared the selection on every
    // plain widget click.
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
    const initial = Object.fromEntries(editable.map((candidate) => [candidate.id, previewGeometry(candidate)]));
    updateCanvasPointer({ mode: "resize", pointerId: event.pointerId, widgetIds: editable.map((candidate) => candidate.id), start: toCanvasPoint(event), screenStart: { x: event.clientX, y: event.clientY }, initial, initialBounds: getBounds(Object.values(initial)) ?? undefined, handle });
  };

  const beginSelectionResize = (handle: ResizeHandle, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || canvasTool === "pan") return;
    event.preventDefault();
    event.stopPropagation();
    const editable = selectedEditableWidgets;
    if (!editable.length) return;
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
    // Lazy capture (S1-01): only a real drag/resize takes pointer capture,
    // so the click of a plain tap lands on the widget, not the device screen.
    if (!canvasScreenRef.current?.hasPointerCapture(pointer.pointerId)) captureCanvasPointer(pointer.pointerId);
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
      if (Object.keys(finalGeometry).length) {
        // A committed gesture suppresses its terminating click even when an
        // out-of-viewport pointermove was lost (S1-04).
        suppressCanvasClick();
        commitGeometryCommand(activeScene?.id, finalGeometry, pointer.mode === "drag" ? "Move widget" : "Resize widget");
      }
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
    // If focus is outside the dialog (e.g. the button that opened it), the
    // next Tab must land INSIDE it (found live: the first Tab escaped to the
    // document tab strip).
    if (!container.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
      return;
    }
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
    // Modal/menu handling comes FIRST so Escape cancels dialogs even when
    // focus is inside one of their text inputs (found live: Escape in the
    // Settings number input silently did nothing).
    if (confirmState) return;
    if (newProjectDraft) {
      if (event.key === "Escape") { event.preventDefault(); setNewProjectDraft(null); }
      if (event.key === "Enter" && !isCanvasKeyboardExcludedTarget(target)) { event.preventDefault(); confirmNewProject(); }
      return;
    }
    if (settingsOpen) {
      if (event.key === "Escape") { event.preventDefault(); cancelSettings(); }
      // Enter commits the dialog from any of its fields (D3-08); a text field
      // still gets its native key first because we only act on plain Enter.
      if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); saveSettings(); }
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
    // Text inputs keep native editing semantics for C/X/V/A/Z/Y/arrows, but
    // Save and New Project have no native input meaning and must work from
    // any focus (Scenario E: after committing a field, Ctrl+S still saves).
    const excluded = isCanvasKeyboardExcludedTarget(target);
    if (excluded && descriptor?.id !== "save" && descriptor?.id !== "new") return;
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
    if ((descriptor?.id === "redo" || descriptor?.id === "redo-alt") && !pointerActive) { event.preventDefault(); redo(); return; }
    if (descriptor?.id === "save" && !pointerActive) { event.preventDefault(); saveDocument(); return; }
    if (descriptor?.id === "new" && !pointerActive) { event.preventDefault(); requestNewProject(); return; }
    if (descriptor?.id === "copy" && !pointerActive) { event.preventDefault(); copySelection(); return; }
    if (descriptor?.id === "cut" && !pointerActive) { event.preventDefault(); cutSelection(); return; }
    if (descriptor?.id === "paste" && !pointerActive) { event.preventDefault(); pasteSelection(); return; }
    if (descriptor?.id === "select-all" && !pointerActive) { event.preventDefault(); selectAllCommand(); return; }
    if (descriptor?.id === "rename" && !pointerActive) { event.preventDefault(); requestRename(); return; }
    if (descriptor?.id === "zoom-reset" && !pointerActive) { event.preventDefault(); resetZoom(); return; }
    // Navigation family (Alt+Arrow): `calculateNudgeStep` refuses Alt, so these
    // can never be confused with a geometry nudge.
    if (descriptor?.id === "scene-next" && !pointerActive) { event.preventDefault(); stepScene(1); return; }
    if (descriptor?.id === "scene-previous" && !pointerActive) { event.preventDefault(); stepScene(-1); return; }
    if (descriptor?.id === "rotation-next" && !pointerActive) { event.preventDefault(); stepRotation(1); return; }
    if (descriptor?.id === "rotation-previous" && !pointerActive) { event.preventDefault(); stepRotation(-1); return; }
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

  // A package describes the document it was built from. Once that document
  // changes, the verified claim is no longer true, so it is withdrawn rather
  // than left standing (F9).
  useEffect(() => {
    if (!builtFrom) return;
    if (stableSerialize(project) === builtFrom) return;
    setBuiltFrom(null);
    setLastPackage(null);
    setSdResult(null);
    setDeploymentStatus("Not built · project changed since the last package");
    logAction("Package status withdrawn: the project changed after it was built and verified", "WARN");
  }, [project, builtFrom]);

  // Navigation reconciliation: a deleted or undone Theme/Scene must not leave
  // the canvas pointing at a node that no longer exists.
  useEffect(() => {
    if (activeThemeId && !allThemes.some((theme) => theme.id === activeThemeId)) setActiveThemeId(null);
    if (activeSceneId && !(activeRotationNode?.scenes ?? []).some((scene) => scene.id === activeSceneId)) setActiveSceneId(null);
  }, [project, activeThemeId, activeSceneId, activeRotationNode?.id]);

  useEffect(() => {
    let cancelled = false;
    void createRemovableStorageAdapter().then((adapter) => {
      if (cancelled) return;
      storageAdapterRef.current = adapter;
      setStorageAdapterReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Boot recovery notice: reported once, with the preserved backup key so the
  // rejected payload can be inspected rather than assumed lost.
  useEffect(() => {
    if (bootOutcome.status === "rejected") {
      logAction(`Stored project not loaded: ${bootOutcome.reason}. A new blank project was created${bootOutcome.backupKey ? `; the rejected data is preserved under '${bootOutcome.backupKey}'` : ""}.`, "ERROR");
      setConsoleTab("console");
    } else if (bootOutcome.status === "loaded") {
      logAction("Saved project restored from local storage", "EVENT");
    }
  }, [bootOutcome]);
  // Workspace session persistence: the designer's context (Theme / Rotation /
  // Scene, zoom, panel tabs, expanded nodes) survives a reload. It is keyed by
  // project id and never enters the canonical document (D3-06).
  useEffect(() => {
    if (!workspaceSessionStorage) return;
    if (!savedSettings.restoreSession) {
      workspaceSessionStorage.clear();
      return;
    }
    workspaceSessionStorage.save({
      projectId: project.id,
      activeThemeId: activeTheme?.id ?? null,
      activeRotationAngle: activeRotationNode?.angle ?? 0,
      activeSceneId: activeSceneNode?.id ?? null,
      zoom,
      leftDockTab,
      rightDockTab,
      expandedNodeIds: Object.entries(expandedNodes).filter(([, open]) => open).map(([id]) => id),
    });
  }, [workspaceSessionStorage, savedSettings.restoreSession, project.id, activeTheme?.id, activeRotationNode?.angle, activeSceneNode?.id, zoom, leftDockTab, rightDockTab, expandedNodes]);

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
    // Guards the user-confirmed destroy from re-triggering the request.
    const allowCloseRef = { current: false };
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (allowCloseRef.current) return;
          if (!documentSnapshot.isDirty) return;
          event.preventDefault();
          setConfirmState({
            title: "Unsaved changes",
            message: "The project has unsaved changes. Closing the application discards them.",
            confirmLabel: "Discard & Close",
            onConfirm: () => {
              allowCloseRef.current = true;
              void appWindow.destroy();
            },
          });
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

  /**
   * Type-aware widget body. A display template is text, digits, direction
   * glyphs and media — rendering every type as the same labelled rectangle
   * made Preview useless for checking a template (L-21/D5-16). Design Mode
   * shows the authored value; Preview Mode substitutes the runtime value that
   * the widget's declared source state provides.
   */
  const renderWidgetBody = (widget: Widget, effect: { hidden?: boolean; playback?: Binding["action"]; contentId?: string } | undefined) => {
    const language = typeof runtimeSettings.language === "string" ? runtimeSettings.language : undefined;
    const byLanguage = (widget.content?.textByLanguage ?? {}) as Record<string, unknown>;
    const localized = language && typeof byLanguage[language] === "string" ? String(byLanguage[language]) : undefined;
    const authoredText = typeof widget.content?.text === "string" ? widget.content.text : "";
    const text = localized ?? authoredText;
    const sourceStateId = typeof widget.content?.sourceStateId === "string" ? widget.content.sourceStateId : undefined;
    const sourceValue = sourceStateId ? runtimeValues[sourceStateId] : undefined;
    if (widget.widgetType === "text" || widget.widgetType === "warning") {
      return text
        ? <span className={`widget-render widget-render-text ${widget.widgetType === "warning" ? "is-warning" : ""}`}>{text}</span>
        : <span className="widget-render widget-render-empty">{widget.name}<small>no text set</small></span>;
    }
    if (widget.widgetType === "digit") {
      const mapping = activeTheme?.floorMappings?.find((candidate) => candidate.id === widget.content?.floorMappingId);
      const mapped = mapping?.entries.find((entry) => String(entry.firmwareValue) === String(sourceValue))?.displayValue;
      const shown = previewActive
        ? mapped ?? (sourceValue === undefined || sourceValue === null ? "--" : String(sourceValue))
        : mapped ?? (sourceStateId ? `[${sourceStateId}]` : "88");
      return <span className="widget-render widget-render-digit" title={sourceStateId ? `Value source: ${sourceStateId}` : "No value source selected"}>{shown}</span>;
    }
    if (widget.widgetType === "direction") {
      const style = String(widget.style?.directionStyleId ?? activeProfile?.directionStyles?.[0] ?? "");
      const raw = previewActive && sourceValue !== undefined && sourceValue !== null ? String(sourceValue).toLowerCase() : style.toLowerCase();
      const glyph = raw.includes("up") ? "▲" : raw.includes("down") ? "▼" : "◆";
      return <span className="widget-render widget-render-direction" title={style ? `Direction style: ${style}` : "Profile default direction style"}>{glyph}</span>;
    }
    if (widget.widgetType === "media") {
      const assetId = effect?.contentId ?? widget.mediaSlide?.items[0]?.assetId ?? widget.assetIds?.[0];
      const asset = assetId ? project.assets.find((candidate) => candidate.id === assetId) : undefined;
      return (
        <span className="widget-render widget-render-media">
          <span className="widget-render-media-glyph">{assetGlyph(asset?.mediaType ?? widget.mediaType ?? "image")}</span>
          <strong>{asset?.name ?? (assetId ? `${assetId} (unresolved)` : "No asset")}</strong>
          <small>{widget.mediaType ?? "type not set"}{widget.mediaSlide ? ` · ${widget.mediaSlide.items.length} entr${widget.mediaSlide.items.length === 1 ? "y" : "ies"}${widget.mediaSlide.loop ? " · loop" : ""}` : ""}{previewActive && effect?.playback ? ` · ${effect.playback}` : ""}</small>
        </span>
      );
    }
    return <span className="widget-render widget-render-empty">{widget.name}<small>{widget.widgetType}</small></span>;
  };

  const renderCanvasWidget = (widget: Widget) => {
    // Canonical corrections §8: invisible widgets are NOT rendered. They stay
    // selectable through the Explorer and show their selection bounds.
    const effect = bindingEffects[widget.id];
    const effectiveVisible = previewActive && effect?.hidden === true ? false : widget.visible;
    if (!effectiveVisible) return null;
    // `enabled: false` means the widget exists in the layout but the runtime
    // does not present it; Preview honours that, Design Mode marks it (D5-03).
    if (previewActive && !widget.enabled) return null;
    const geometry = previewGeometry(widget);
    const selected = selectedIds.includes(widget.id);
    const style = { left: `${(geometry.x / canvasWidth) * 100}%`, top: `${(geometry.y / canvasHeight) * 100}%`, width: `${(geometry.width / canvasWidth) * 100}%`, height: `${(geometry.height / canvasHeight) * 100}%`, zIndex: widget.zIndex };
    const handles: ResizeHandle[] = ["n", "e", "s", "w", "nw", "ne", "sw", "se"];
    return <div key={widget.id} className={`canvas-widget widget-type-${widget.widgetType} ${selected ? "is-selected" : ""} ${widget.locked ? "is-locked" : ""} ${widget.enabled ? "" : "is-disabled-widget"} ${previewActive ? "is-preview" : ""}`} style={style} role="button" tabIndex={0} aria-label={`${widget.name} ${widget.widgetType}${widget.enabled ? "" : " disabled"}`} onPointerDown={(event) => beginWidgetMove(widget, event)} onClick={(event) => { event.stopPropagation(); if (isCanvasClickSuppressed()) { consumeCanvasClickSuppression(); return; } selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }, event.shiftKey || isCanonicalModifier(event)); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") selectNode({ id: widget.id, label: widget.name, kind: widget.widgetType, nodeType: widget.widgetType, detail: widget.locked ? "Locked" : "Visible" }); }}>{renderWidgetBody(widget, effect)}{!previewActive && <small className="canvas-widget-tag">{widget.name}{widget.locked ? " · locked" : ""}{widget.enabled ? "" : " · disabled"}</small>}{selected && selectedWidgetIds.length === 1 && !widget.locked && !previewActive && handles.map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize ${widget.name} ${handle}`} onPointerDown={(event) => beginWidgetResize(widget, handle, event)} />)}</div>;
  };

  const shortcutFor = (id: string): string | undefined => {
    const descriptor = canonicalShortcuts.find((candidate) => candidate.id === id);
    return descriptor ? shortcutDisplay(descriptor) : undefined;
  };

  const menuItems: Record<MenuKey, MenuItem[]> = {
    File: [
      { label: "New Project…", shortcut: shortcutFor("new"), onClick: requestNewProject },
      { label: "Revert to Saved", disabled: !projectStorage, title: projectStorage ? "Discard changes and reload the last saved project from local storage" : "Local storage is unavailable in this build", onClick: openProject },
      { label: "Import Project File…", disabled: !projectFileGateway, title: projectFileGateway ? "Open a portable .tdproj.json project document" : "File access is unavailable in this build", onClick: () => { void importProjectFile(); } },
      { label: "Export Project File…", disabled: !projectFileGateway, title: projectFileGateway ? "Write the project out as a portable .tdproj.json document" : "File access is unavailable in this build", onClick: () => { void exportProjectFile(); } },
      { label: "Save", shortcut: shortcutFor("save"), title: documentSnapshot.isDirty ? "Save changes to local storage" : "Already saved — writes the current state again", onClick: saveDocument },
    ],
    Edit: [
      { label: "Undo", shortcut: shortcutFor("undo"), disabled: !commandHistory.canUndo, title: commandHistory.canUndo ? undefined : "No commands to undo", onClick: undo },
      { label: "Redo", shortcut: shortcutFor("redo"), disabled: !commandHistory.canRedo, title: commandHistory.canRedo ? undefined : "No commands to redo", onClick: redo },
      { label: "Cut", shortcut: shortcutFor("cut"), disabled: !selectedWidgetIds.length, title: selectedWidgetIds.length ? undefined : "Requires a selected widget", onClick: cutSelection },
      { label: "Copy", shortcut: shortcutFor("copy"), disabled: !selectedWidgetIds.length, title: selectedWidgetIds.length ? undefined : "Requires a selected widget", onClick: copySelection },
      { label: "Paste", shortcut: shortcutFor("paste"), disabled: !clipboard, title: clipboard ? undefined : "Nothing copied", onClick: pasteSelection },
      { label: "Select All in Scene", shortcut: shortcutFor("select-all"), disabled: !canvasWidgets.length, title: canvasWidgets.length ? undefined : "The active Scene has no widget", onClick: selectAllCommand },
      { label: "Deselect All", disabled: !selectedIds.length, title: selectedIds.length ? "Clear the selection without changing the document" : "Nothing selected", onClick: deselectAll },
      { label: "Rename Selection", shortcut: shortcutFor("rename"), disabled: !selection, title: selection ? "Focus the Name field in Properties" : "Nothing selected", onClick: requestRename },
      { label: "Delete Selection", shortcut: "Delete", disabled: Boolean(selectionRefusal("delete")), title: selectionRefusal("delete"), onClick: deleteSelectionCommand },
      { label: "Reset Layout", onClick: resetLayout },
    ],
    View: [
      { label: "Project Explorer", onClick: () => activatePanel("explorer") },
      { label: "Asset Browser", onClick: () => activatePanel("assets") },
      { label: "Properties", onClick: () => activatePanel("properties") },
      { label: "Simulator", onClick: () => activatePanel("simulator") },
      { label: "Console / Output", onClick: () => activatePanel("console") },
      { label: "Zoom to Fit", disabled: zoom === 100 && pan.x === 0 && pan.y === 0, title: "Clear the pan and return to the size the device frame is drawn at", onClick: zoomToFit },
      { label: "Zoom to 100%", shortcut: shortcutFor("zoom-reset"), disabled: zoom === 100 && pan.x === 0 && pan.y === 0, onClick: resetZoom },
      { label: "Next Rotation / Form", shortcut: shortcutFor("rotation-next"), onClick: () => stepRotation(1) },
      { label: "Next Scene", shortcut: shortcutFor("scene-next"), onClick: () => stepScene(1) },
      { label: "Reset Layout", onClick: resetLayout },
    ],
    Project: [
      { label: "Validate Project", onClick: () => { activatePanel("console"); setConsoleTab("validation"); if (validation.valid) logAction("Project validation passed"); else validation.issues.forEach((issue) => logAction(`${issue.code}: ${issue.message}`, issue.severity === "error" ? "ERROR" : "WARN")); } },
      { label: "Add Theme Project Group", onClick: addThemeProjectGroupCommand },
      { label: "Adopt Active Profile Version", disabled: !activeProfile || project.deviceProfileVersion === activeProfile.version, title: activeProfile ? (project.deviceProfileVersion === activeProfile.version ? `Already recorded as version ${activeProfile.version}` : `Record ${activeProfile.name} version ${activeProfile.version} after reviewing bindings and activation conditions`) : "No DeviceProfile is active", onClick: adoptProfileVersion },
      ...availableProfiles.map((profile) => ({ label: `Device Profile: ${profile.name} (${profile.display.width}×${profile.display.height})`, disabled: profile.id === project.deviceProfileId, title: profile.id === project.deviceProfileId ? "Active DeviceProfile" : "Switch profile and re-dimension every Rotation / Form", onClick: () => setDeviceProfile(profile.id) })),
      { label: "Build & Verify Package", onClick: () => { void buildAndVerifyPackage(); } },
      { label: "Deploy to SD Card…", title: "Detect removable targets, then write and verify the package", onClick: () => { activatePanel("console"); setConsoleTab("deployment"); void detectSdTargets(); } },
    ],
    Theme: [
      { label: "Add Theme Project", disabled: groups.length === 0, title: groups.length === 0 ? "Add a Theme Project Group first" : undefined, onClick: addThemeProject },
      { label: "Duplicate Theme Project", disabled: !activeTheme, title: activeTheme ? `Duplicate ${activeTheme.name} with all four rotations` : "No Theme Project", onClick: () => duplicateThemeCommand(activeTheme?.id) },
      { label: "Delete Theme Project", disabled: !activeTheme, title: activeTheme ? `Delete ${activeTheme.name}` : "No Theme Project", onClick: () => deleteNodeCommand(activeTheme?.id, "Theme Project") },
    ],
    Scene: [
      { label: "Add Scene", disabled: !activeRotationNode, title: activeRotationNode ? `Add a Scene to R${activeRotationNode.angle}` : "No Rotation / Form is active", onClick: addScene },
      { label: "Duplicate Scene", disabled: !activeSceneNode, title: activeSceneNode ? `Duplicate ${activeSceneNode.name}` : "No active Scene", onClick: () => duplicateSceneCommand(activeSceneNode?.id) },
      { label: "Move Scene Earlier", disabled: !activeSceneNode || (activeRotationNode?.scenes.findIndex((scene) => scene.id === activeSceneNode?.id) ?? 0) <= 0, onClick: () => moveActiveScene(-1) },
      { label: "Move Scene Later", disabled: !activeSceneNode || (activeRotationNode?.scenes.findIndex((scene) => scene.id === activeSceneNode?.id) ?? -1) >= (activeRotationNode?.scenes.length ?? 0) - 1, onClick: () => moveActiveScene(1) },
      { label: "Edit Scene Activation", disabled: !activeSceneNode, title: activeSceneNode ? "Select the Scene and open its activation rule in Properties" : "No active Scene", onClick: () => { if (activeSceneNode) selectNode({ id: activeSceneNode.id, label: activeSceneNode.name, kind: "Scene", detail: `Priority ${activeSceneNode.priority}` }); activatePanel("properties"); } },
      { label: "Hide All Widgets", disabled: !activeScene?.id || canvasWidgets.length === 0, onClick: () => setAllWidgetsVisibility(false) },
      { label: "Show All Widgets", disabled: !activeScene?.id || canvasWidgets.length === 0, onClick: () => setAllWidgetsVisibility(true) },
      { label: "Delete Scene", disabled: !activeSceneNode, title: activeSceneNode ? `Delete ${activeSceneNode.name} and every widget in it` : "No active Scene", onClick: () => deleteNodeCommand(activeSceneNode?.id, "Scene") },
      { label: "Test Scene in Simulator", disabled: !activeSceneNode, onClick: () => { activatePanel("simulator"); traceRuntime(); } },
    ],
    Widget: [
      ...(activeProfile?.supportedWidgetTypes ?? []).map((widgetType) => ({ label: `Add ${defaultWidgetName(widgetType)} Widget`, disabled: !activeScene?.id, title: activeScene?.id ? undefined : "Requires an active Scene", onClick: () => addWidget(widgetType) })),
      { label: selectedWidgetsAllLocked ? "Unlock Selection" : "Lock Selection", disabled: !selectedWidgetIds.length, onClick: () => toggleWidgetProperty("locked") },
      { label: selectedWidgetsAllVisible ? "Hide Selection" : "Show Selection", disabled: !selectedWidgetIds.length, onClick: () => toggleWidgetProperty("visible") },
      { label: selectedWidgetsAllEnabled ? "Disable Selection" : "Enable Selection", disabled: !selectedWidgetIds.length, title: selectedWidgetIds.length ? "A disabled widget stays in the layout but the runtime does not present it" : "Requires a selected widget", onClick: () => toggleWidgetProperty("enabled") },
      { label: "Align Left", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("left", "align") },
      { label: "Align Horizontal Centres", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("horizontal-center", "align") },
      { label: "Align Right", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("right", "align") },
      { label: "Align Top", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("top", "align") },
      { label: "Align Vertical Middles", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("vertical-middle", "align") },
      { label: "Align Bottom", disabled: selectedEditableWidgets.length < 2, title: selectedEditableWidgets.length < 2 ? "Requires at least 2 unlocked widgets" : undefined, onClick: () => alignSelection("bottom", "align") },
      { label: "Distribute Horizontally", disabled: selectedEditableWidgets.length < 3, title: selectedEditableWidgets.length < 3 ? "Requires at least 3 unlocked widgets" : "Equal edge-to-edge gaps; the outermost widgets keep their position", onClick: () => alignSelection("horizontal", "distribute") },
      { label: "Distribute Vertically", disabled: selectedEditableWidgets.length < 3, title: selectedEditableWidgets.length < 3 ? "Requires at least 3 unlocked widgets" : "Equal edge-to-edge gaps; the outermost widgets keep their position", onClick: () => alignSelection("vertical", "distribute") },
      { label: "Bring To Front", disabled: !resolvedSelection?.widget, onClick: () => changeWidgetZOrder("bring-to-front") },
      { label: "Send To Back", disabled: !resolvedSelection?.widget, onClick: () => changeWidgetZOrder("send-to-back") },
      { label: "Duplicate Selection", disabled: Boolean(selectionRefusal("duplicate")), title: selectionRefusal("duplicate"), onClick: duplicateSelectionCommand },
      { label: "Duplicate Mode (click to place)", disabled: !selectedWidgetIds.length, title: selectedWidgetIds.length ? "Click the canvas to place a copy; Esc exits" : "Requires a selected widget in the active Scene", onClick: enterDuplicateMode },
      { label: "Delete Selection", disabled: Boolean(selectionRefusal("delete")), title: selectionRefusal("delete"), onClick: deleteSelectionCommand },
      { label: "Binding Editor", disabled: !resolvedSelection?.widget, title: resolvedSelection?.widget ? undefined : "Requires a single selected widget", onClick: () => setBindingModal({ widgetId: resolvedSelection?.widget?.id ?? "" }) },
    ],
    Asset: [
      { label: "Import Asset…", disabled: !assetImportSource, title: assetImportSource ? "Register image, video or audio files in the project" : "Asset import is unavailable in this build", onClick: () => { void importAssets(); } },
      { label: "Open Asset Browser", onClick: () => activatePanel("assets") },
      { label: "Delete Selected Asset", disabled: !selectedAssetIds.length, title: selectedAssetIds.length ? "Delete the asset and clear every reference to it" : "Select an asset in the Asset Browser", onClick: () => deleteAssetsCommand(selectedAssetIds) },
      { label: "Theme Resources", disabled: !activeTheme, title: activeTheme ? "Select the Theme Project and edit which assets ship with it" : "No Theme Project", onClick: () => { if (activeTheme) selectNode({ id: activeTheme.id, label: activeTheme.name, kind: "Theme Project" }); activatePanel("properties"); } },
    ],
    Tools: [
      { label: "Diagnostics", onClick: () => activatePanel("console") },
      { label: "Program Settings", onClick: () => setSettingsOpen(true) },
    ],
  };

  const renderCanvasNavigator = () => {
    const rotations = activeTheme?.rotations ?? [];
    const scenes = activeRotationNode?.scenes ?? [];
    const sceneIndex = scenes.findIndex((scene) => scene.id === activeSceneNode?.id);
    return (
      <div className="canvas-navigator" aria-label="Theme, rotation and scene navigation">
        <div className="navigator-row">
          <label className="navigator-field">
            <span>Theme</span>
            <select aria-label="Active Theme Project" value={activeTheme?.id ?? ""} disabled={allThemes.length === 0} onChange={(event) => navigateToTheme(event.target.value)}>
              {allThemes.length === 0 ? <option value="">No Theme Project</option> : allThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
            </select>
          </label>
          <div className="rotation-switcher" role="group" aria-label="Rotation / Form">
            {rotations.length === 0 ? <span className="navigator-empty">No rotations</span> : rotations.map((rotation) => (
              <button
                key={rotation.id}
                type="button"
                className={rotation.angle === activeRotationNode?.angle ? "active" : ""}
                aria-pressed={rotation.angle === activeRotationNode?.angle}
                title={`Rotation / Form R${rotation.angle} · ${rotation.width} × ${rotation.height} · ${rotation.scenes.length} scene(s)`}
                onClick={() => navigateToRotation(rotation.angle)}
              >R{rotation.angle}</button>
            ))}
          </div>
          <span className="navigator-dims" title="Active Rotation / Form logical size in scene units">{activeRotationNode ? `${activeRotationNode.width} × ${activeRotationNode.height}` : "—"}</span>
          <span className="navigator-spacer" />
          <span className="navigator-scene-count">{scenes.length} scene{scenes.length === 1 ? "" : "s"}</span>
        </div>
        <div className="scene-switcher-row">
          <div className="scene-switcher" role="tablist" aria-label="Scenes in the active Rotation / Form">
            {scenes.map((scene) => {
              const isActive = scene.id === activeSceneNode?.id;
              const runtimeCandidate = runtime.activeSceneId === scene.id;
              return (
                <button
                  key={scene.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`scene-tab ${isActive ? "active" : ""} ${scene.enabled === false ? "is-scene-disabled" : ""}`}
                  title={`${scene.name} · priority ${scene.priority} · ${scene.widgets.length} widget(s)${scene.enabled === false ? " · disabled" : ""}${scene.activationConditions.length ? ` · ${scene.activationConditions.length} activation condition(s)` : " · always eligible"}`}
                  onClick={() => selectNode({ id: scene.id, label: scene.name, kind: "Scene", detail: `Priority ${scene.priority}` })}
                >
                  <strong>{scene.name}</strong>
                  <small>{scene.widgets.length}{scene.enabled === false ? " · off" : ""}{runtimeCandidate ? " · live" : ""}</small>
                </button>
              );
            })}
            {scenes.length === 0 && <span className="navigator-empty">This Rotation / Form has no Scene yet</span>}
          </div>
          <div className="scene-switcher-actions">
            <button type="button" className="small-action" disabled={!activeRotationNode} title="Add a Scene to the active Rotation / Form" onClick={addScene}>+ Scene</button>
            <button type="button" className="small-action" disabled={sceneIndex <= 0} aria-label="Move active Scene earlier" title="Move the active Scene earlier (activation order tie-break)" onClick={() => moveActiveScene(-1)}>↑</button>
            <button type="button" className="small-action" disabled={sceneIndex < 0 || sceneIndex >= scenes.length - 1} aria-label="Move active Scene later" title="Move the active Scene later" onClick={() => moveActiveScene(1)}>↓</button>
            <button type="button" className="small-action" disabled={!activeSceneNode} title="Duplicate the active Scene with all of its widgets" onClick={() => duplicateSceneCommand(activeSceneNode?.id)}>Duplicate</button>
          </div>
        </div>
      </div>
    );
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
  const sceneAssetIds = new Set(groups.flatMap((currentGroup) => currentGroup.themeProjects.flatMap((theme) => theme.rotations.flatMap((rotation) => rotation.scenes.flatMap((scene) => scene.widgets.flatMap((widget) => [...(widget.assetIds ?? []), ...(widget.audioAssetId ? [widget.audioAssetId] : []), ...(widget.mediaSlide ? [...widget.mediaSlide.items.map((item) => item.assetId), ...(widget.mediaSlide.audioAssetId ? [widget.mediaSlide.audioAssetId] : [])] : [])]))))));
  const supportedFormatSet = new Set((activeProfile?.supportedFormats ?? []).map((format) => format.toLowerCase()));
  // "Unsupported" is a real, derived category: an asset whose extension the
  // active DeviceProfile does not declare (the exact ASSET_FORMAT_UNSUPPORTED
  // rule). It is no longer a hardcoded empty list (L-04/D1-06).
  const unsupportedAssetIds = new Set(
    [
      // An asset with no semantic type cannot be used by a widget yet, so it
      // belongs here rather than being invisible (F7c).
      ...project.assets.filter((asset) => !asset.mediaType).map((asset) => asset.id),
      ...(supportedFormatSet.size === 0
      ? []
      : project.assets.filter((asset) => {
        const extension = /\.([a-z0-9]+)$/i.exec(asset.sourcePath)?.[1].toLowerCase();
        return Boolean(extension) && !supportedFormatSet.has(extension as string);
      }).map((asset) => asset.id)),
    ],
  );
  const assetCountFor = (category: AssetCategory): number => category === "depot"
    ? project.assets.length
    : category === "resources"
      ? project.assets.filter((asset) => resourceAssetIds.has(asset.id)).length
      : category === "scene"
        ? project.assets.filter((asset) => sceneAssetIds.has(asset.id)).length
        : project.assets.filter((asset) => unsupportedAssetIds.has(asset.id)).length;
  const assetsForCategory = assetCategory === "depot"
    ? project.assets
    : assetCategory === "resources"
      ? project.assets.filter((asset) => resourceAssetIds.has(asset.id))
      : assetCategory === "scene"
        ? project.assets.filter((asset) => sceneAssetIds.has(asset.id))
        : project.assets.filter((asset) => unsupportedAssetIds.has(asset.id));
  const filteredAssets = assetsForCategory.filter((asset) => asset.name.toLowerCase().includes(assetSearch.toLowerCase()) || assetTypeLabel(asset.mediaType).toLowerCase().includes(assetSearch.toLowerCase()) || asset.sourcePath.toLowerCase().includes(assetSearch.toLowerCase()));
  const renderAssets = () => (
    <>
      {renderPanelHeader("assets", "LIBRARY", "Asset Browser")}
      {renderDockTabs("left")}
      <div className="asset-toolbar">
        <button type="button" className="small-action primary-action" disabled={!assetImportSource} title={assetImportSource ? `Import media files into the project (${assetImportSource.kind})` : "Asset import is unavailable in this build"} onClick={() => { void importAssets(); }}>Import…</button>
        <button type="button" className="small-action" disabled={!selectedAssetIds.length} title={selectedAssetIds.length ? "Delete the selected asset and clear its references" : "Select an asset first"} onClick={() => deleteAssetsCommand(selectedAssetIds)}>Delete</button>
        <span className="asset-toolbar-note">{project.assets.length} asset{project.assets.length === 1 ? "" : "s"}</span>
      </div>
      <div className="asset-search"><input aria-label="Search assets" placeholder="Search name, type or path" value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} /></div>
      <div className="asset-category-list">{assetCategories.map((category) => <button key={category.id} type="button" className={assetCategory === category.id ? "active" : ""} onClick={() => setAssetCategory(category.id)}><span>{category.id === "depot" ? "▱" : category.id === "resources" ? "▤" : category.id === "scene" ? "◈" : "⊘"}</span>{category.label}<small>{assetCountFor(category.id)}</small></button>)}</div>
      <div className="asset-list">
        {filteredAssets.length > 0 ? filteredAssets.map((asset) => {
          const uses = countAssetReferences(project, asset.id);
          return (
            <button type="button" className={`asset-row ${selectedIds.includes(asset.id) ? "is-selected" : ""}`} key={asset.id} aria-current={selectedIds.includes(asset.id) ? "true" : undefined} onClick={() => selectNode({ id: asset.id, label: asset.name, kind: "Asset", detail: `${assetTypeLabel(asset.mediaType)} · ${uses > 0 ? `${uses} reference(s)` : "unused"}` })}>
              <span className="asset-type">{assetGlyph(asset.mediaType)}</span>
              <span><strong>{asset.name}</strong><small>{assetTypeLabel(asset.mediaType)} · {asset.sourcePath}</small></span>
              <span className={`asset-usage ${uses > 0 ? "is-used" : ""}`} title={uses > 0 ? `${uses} canonical reference(s)` : "Not referenced by any Theme resource, Widget or Binding"}>{uses > 0 ? `×${uses}` : "unused"}</span>
            </button>
          );
        }) : <div className="asset-empty"><span className="empty-panel-icon">{assetCategory === "unsupported" ? "⊘" : "▱"}</span><strong>{project.assets.length === 0 ? "No assets in this project yet" : assetSearch ? "No asset matches the search" : assetCategory === "depot" ? "Asset Depot is empty" : assetCategory === "unsupported" ? "Every asset format is supported by the active DeviceProfile" : assetCategory === "resources" ? "No asset is declared as a Theme resource" : "No asset is referenced by a Scene widget"}</strong><span>{project.assets.length === 0 ? "Use Import… to register image, video or audio files. The package carries logical asset records; binary media is materialized by the deployment adapter." : assetCategory === "resources" ? "Select a Theme Project and tick assets in Theme Resources to ship them with the theme." : assetCategory === "scene" ? "Assign an asset to a widget in Properties → Media to make it Scene Content." : "Assets appear in the Depot as soon as they are imported."}</span>{project.assets.length === 0 && assetImportSource ? <button type="button" className="context-action" onClick={() => { void importAssets(); }}>Import Asset</button> : null}</div>}
      </div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Depot lists every imported asset. Resources, Scene Content and Unsupported are derived from canonical references.</span></div>
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
      updates[id] = clampGeometryToScene({ ...canonicalGeometry(widget), [field]: value });
    });
    if (!Object.keys(updates).length) {
      logAction("Geometry edit blocked: selection is locked or not a Widget", "WARN");
      return;
    }
    const result = editorApplication.setWidgetGeometriesInScene(sceneId, updates, `Set widget ${field}`);
    if (result.changed) logAction(`Set widget ${field}`, "EVENT");
  };

  const assetsOfType = (mediaType?: MediaType): readonly Asset[] => mediaType ? project.assets.filter((asset) => asset.mediaType === mediaType) : project.assets;

  const renderAssetSelect = (label: string, value: string | undefined, mediaType: MediaType | undefined, onChange: (assetId: string | undefined) => void, hint?: string) => {
    const options = assetsOfType(mediaType);
    return (
      <div className="property-row property-row-edit">
        <span>{label}</span>
        <select
          aria-label={label}
          value={value ?? ""}
          disabled={options.length === 0}
          title={options.length === 0 ? `No ${mediaType ?? "media"} asset is imported yet — use Asset Browser → Import…` : hint}
          onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        >
          <option value="">{options.length === 0 ? `No ${mediaType ?? "media"} asset imported` : "None"}</option>
          {options.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          {value && !options.some((asset) => asset.id === value) && <option value={value}>{`${value} (unresolved)`}</option>}
        </select>
      </div>
    );
  };

  /** Type-specific content/style editor. Every field maps to a canonical `content`/`style` key. */
  const renderWidgetContentSection = (widget: Widget) => {
    // Captured at render time so a commit arriving after the selection moved
    // still writes to the widget the designer was editing.
    const contentTarget = activeScene?.id ? { sceneId: activeScene.id, widgetId: widget.id } : undefined;
    const languages = activeProfile?.languages ?? [];
    const stateOptions = activeProfile?.runtimeStates ?? [];
    const textValue = typeof widget.content?.text === "string" ? widget.content.text : "";
    const byLanguage = (widget.content?.textByLanguage ?? {}) as Record<string, unknown>;
    if (widget.widgetType === "text" || widget.widgetType === "warning") {
      return (
        <section className="property-section">
          <div className="property-section-title">{widget.widgetType === "text" ? "Text" : "Warning"}</div>
          <div className="property-row property-row-edit"><span>{widget.widgetType === "text" ? "Text" : "Message"}</span><DraftTextField scope={`${widget.id}:text`} value={textValue} disabled={false} placeholder="Not set" ariaLabel={`${widget.widgetType} content text`} onCommit={(value) => setWidgetContentValue("text", value, contentTarget)} /></div>
          {languages.length > 1 && languages.map((language) => (
            <div className="property-row property-row-edit" key={language}>
              <span>Text · {language}</span>
              <DraftTextField
                scope={`${widget.id}:lang:${language}`}
                value={typeof byLanguage[language] === "string" ? String(byLanguage[language]) : ""}
                disabled={false}
                placeholder="Falls back to Text"
                ariaLabel={`${widget.widgetType} text for ${language}`}
                onCommit={(value) => {
                  const next = { ...byLanguage } as Record<string, unknown>;
                  if (value.trim() === "") delete next[language];
                  else next[language] = value;
                  setWidgetContentValue("textByLanguage", Object.keys(next).length ? next : undefined, contentTarget);
                }}
              />
            </div>
          ))}
          <p className="property-note">DeviceProfile languages: {languages.length ? languages.join(", ") : "none declared"}. A language without its own text falls back to Text.</p>
        </section>
      );
    }
    if (widget.widgetType === "digit") {
      const styles = activeProfile?.digitStyles ?? [];
      const mappings = activeTheme?.floorMappings ?? [];
      return (
        <section className="property-section">
          <div className="property-section-title">Digit</div>
          <div className="property-row property-row-edit">
            <span>Digit Style</span>
            <select aria-label="Digit style" value={String(widget.style?.digitStyleId ?? "")} disabled={styles.length === 0} onChange={(event) => setWidgetStyleValue("digitStyleId", event.target.value)}>
              <option value="">{activeProfile?.defaultDigitStyleId ? `Profile default (${activeProfile.defaultDigitStyleId})` : "Profile default"}</option>
              {styles.map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
          </div>
          <div className="property-row property-row-edit">
            <span>Value Source</span>
            <select aria-label="Digit runtime value source" value={String(widget.content?.sourceStateId ?? "")} onChange={(event) => setWidgetContentValue("sourceStateId", event.target.value)}>
              <option value="">Not bound</option>
              {stateOptions.map((state) => <option key={state.id} value={state.id}>{state.displayName} ({state.type})</option>)}
            </select>
          </div>
          <div className="property-row property-row-edit">
            <span>Floor Mapping</span>
            <select aria-label="Floor mapping" value={String(widget.content?.floorMappingId ?? "")} disabled={mappings.length === 0} title={mappings.length === 0 ? "This Theme Project declares no Floor Mapping" : undefined} onChange={(event) => setWidgetContentValue("floorMappingId", event.target.value)}>
              <option value="">{mappings.length === 0 ? "No Floor Mapping in this theme" : "Raw firmware value"}</option>
              {mappings.map((mapping) => <option key={mapping.id} value={mapping.id}>{mapping.id} ({mapping.entries.length} entries)</option>)}
            </select>
          </div>
        </section>
      );
    }
    if (widget.widgetType === "direction") {
      const styles = activeProfile?.directionStyles ?? [];
      return (
        <section className="property-section">
          <div className="property-section-title">Direction</div>
          <div className="property-row property-row-edit">
            <span>Direction Style</span>
            <select aria-label="Direction style" value={String(widget.style?.directionStyleId ?? "")} disabled={styles.length === 0} onChange={(event) => setWidgetStyleValue("directionStyleId", event.target.value)}>
              <option value="">Profile default</option>
              {styles.map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
          </div>
          <div className="property-row property-row-edit">
            <span>Value Source</span>
            <select aria-label="Direction runtime value source" value={String(widget.content?.sourceStateId ?? "")} onChange={(event) => setWidgetContentValue("sourceStateId", event.target.value)}>
              <option value="">Not bound</option>
              {stateOptions.map((state) => <option key={state.id} value={state.id}>{state.displayName} ({state.type})</option>)}
            </select>
          </div>
        </section>
      );
    }
    return null;
  };

  /** Media capability + Media Slide editor; the Media Slide is only valid on the media widget type. */
  const renderWidgetMediaSection = (widget: Widget) => {
    const visualTypes = (activeProfile?.supportedMediaTypes ?? []).filter((mediaType): mediaType is VisualMediaType => mediaType !== "audio");
    const slide = widget.mediaSlide;
    // Only visual assets the profile supports can enter the sequence.
    const appendableAssets = project.assets.filter((asset) => asset.mediaType !== undefined && asset.mediaType !== "audio" && visualTypes.includes(asset.mediaType as VisualMediaType));
    const isMedia = widget.widgetType === "media";
    return (
      <section className="property-section">
        <div className="property-section-title">Media / Assets</div>
        {isMedia && (
          <div className="property-row property-row-edit">
            <span>Visual Type</span>
            <select aria-label="Media visual type" value={widget.mediaType ?? ""} onChange={(event) => configureWidget({ mediaType: (event.target.value || undefined) as VisualMediaType | undefined }, "Set media type")}>
              <option value="">Not selected</option>
              {visualTypes.map((mediaType) => <option key={mediaType} value={mediaType}>{mediaType}</option>)}
            </select>
          </div>
        )}
        {isMedia && (
          <>
            {/* A Media Slide is an ORDERED MEDIA SEQUENCE: entries may mix Image
                and Video in any order, and each entry carries its own dwell time. */}
            <div className="property-row"><span>Media Sequence</span><strong>{slide ? `${slide.items.length} entr${slide.items.length === 1 ? "y" : "ies"} · ${slide.items.reduce((total, item) => total + item.duration, 0).toFixed(1)}s total` : "Not configured"}</strong></div>
            {slide && slide.items.length > 0 && (
              <ol className="sequence-list">
                {slide.items.map((item, index) => {
                  const asset = project.assets.find((candidate) => candidate.id === item.assetId);
                  return (
                    <li key={item.id}>
                      <span className="sequence-index">{index + 1}</span>
                      <span className="sequence-body">
                        <strong>{assetGlyph(item.mediaType)} {asset?.name ?? `${item.assetId} (unresolved)`}</strong>
                        <small>{item.mediaType}{item.loop ? " · loop" : ""}{item.repeatCount ? ` · ×${item.repeatCount}` : ""}</small>
                      </span>
                      <DraftNumberField scope={`${widget.id}:seq:${item.id}`} value={String(item.duration)} disabled={false} min={0} max={3600} decimals={1} ariaLabel={`Entry ${index + 1} duration in seconds`} onCommit={(value) => updateSequenceItem(widget, item.id, { duration: Math.round(value * 10) / 10 })} />
                      <span className="sequence-actions">
                        <button type="button" className="small-action" disabled={index === 0} aria-label={`Move entry ${index + 1} earlier`} title="Move earlier in the sequence" onClick={() => moveSequenceItem(widget, item.id, -1)}>↑</button>
                        <button type="button" className="small-action" disabled={index === slide.items.length - 1} aria-label={`Move entry ${index + 1} later`} title="Move later in the sequence" onClick={() => moveSequenceItem(widget, item.id, 1)}>↓</button>
                        <button type="button" className="reference-remove" aria-label={`Remove entry ${index + 1}`} title="Remove this entry" onClick={() => removeSequenceItem(widget, item.id)}>×</button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
            <div className="property-row property-row-edit">
              <span>Append Entry</span>
              <select
                aria-label="Append media sequence entry"
                value=""
                disabled={appendableAssets.length === 0}
                title={appendableAssets.length === 0 ? `No ${visualTypes.join(" or ")} asset is imported yet — use Asset Browser → Import…` : "Appends to the end of the ordered sequence"}
                onChange={(event) => { if (event.target.value) appendSequenceItem(widget, event.target.value); }}
              >
                <option value="">{appendableAssets.length === 0 ? "No image or video asset imported" : "Choose an asset…"}</option>
                {appendableAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.mediaType})</option>)}
              </select>
            </div>
            {slide && (
              <>
                <div className="property-row property-row-edit"><span>Loop Sequence</span><input type="checkbox" aria-label="Loop the media sequence" checked={slide.loop === true} onChange={(event) => configureWidget({ mediaSlide: { ...slide, loop: event.target.checked } }, "Set sequence loop")} /></div>
                <div className="property-row property-row-edit"><span>Repeat Sequence</span><DraftNumberField scope={`${widget.id}:seqrepeat`} value={String(slide.repeatCount ?? 0)} disabled={false} min={0} max={999} integer ariaLabel="Media sequence repeat count" onCommit={(value) => configureWidget({ mediaSlide: { ...slide, repeatCount: value } }, "Set sequence repeat count")} /></div>
                {renderAssetSelect("Sequence Audio", slide.audioAssetId, "audio", (assetId) => configureWidget({ mediaSlide: { ...slide, audioAssetId: assetId } }, "Set sequence audio"))}
              </>
            )}
            <div className="property-row property-row-edit">
              <span>Visual Type</span>
              <select aria-label="Media visual type" value={widget.mediaType ?? ""} onChange={(event) => configureWidget({ mediaType: (event.target.value || undefined) as VisualMediaType | undefined }, "Set media type")}>
                <option value="">Not selected</option>
                {visualTypes.map((mediaType) => <option key={mediaType} value={mediaType}>{mediaType}</option>)}
              </select>
            </div>
            {renderAssetSelect("Attached Audio", widget.audioAssetId, "audio", (assetId) => configureWidget({ audioAssetId: assetId }, "Set attached audio"))}
          </>
        )}
        <div className="property-row property-row-edit">
          <span>Add Asset Reference</span>
          <select aria-label="Add asset reference" value="" disabled={project.assets.length === 0} title={project.assets.length === 0 ? "No asset is imported yet — use Asset Browser → Import…" : undefined} onChange={(event) => { if (event.target.value) setWidgetAssetIds([...(widget.assetIds ?? []), event.target.value]); }}>
            <option value="">{project.assets.length === 0 ? "No asset imported" : "Choose an asset…"}</option>
            {project.assets.filter((asset) => !(widget.assetIds ?? []).includes(asset.id)).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.mediaType})</option>)}
          </select>
        </div>
        {(widget.assetIds ?? []).length > 0 ? (
          <ul className="reference-list">
            {(widget.assetIds ?? []).map((assetId, index) => {
              const asset = project.assets.find((candidate) => candidate.id === assetId);
              return (
                <li key={`${assetId}-${index}`}>
                  <span>{assetGlyph(asset?.mediaType ?? "image")} {asset?.name ?? `${assetId} (unresolved)`}</span>
                  <button type="button" className="reference-remove" aria-label={`Remove asset reference ${asset?.name ?? assetId}`} onClick={() => setWidgetAssetIds((widget.assetIds ?? []).filter((_, current) => current !== index))}>×</button>
                </li>
              );
            })}
          </ul>
        ) : <p className="property-note">No asset reference. Asset references are exported as Scene Content.</p>}
      </section>
    );
  };

  /** Scene activation rule editor: the runtime uses this to pick the active Scene. */
  const renderSceneActivationSection = (scene: Scene) => {
    const definitions = [...profileStates, ...profileSettings];
    const draftDefinition = definitions.find((candidate) => candidate.id === sceneConditionDraft.stateId);
    const operators = draftDefinition ? operatorsForType(draftDefinition.type, draftDefinition.operators) : ["equals", "not-equals"];
    return (
      <section className="property-section">
        <div className="property-section-title">Scene Activation</div>
        <div className="property-row property-row-edit">
          <span>Match</span>
          <select aria-label="Activation condition mode" value={scene.activationConditionMode ?? "all"} onChange={(event) => commitSceneActivation(scene.activationConditions, event.target.value as ConditionMode)}>
            <option value="all">All conditions (AND)</option>
            <option value="any">Any condition (OR)</option>
          </select>
        </div>
        {scene.activationConditions.length === 0
          ? <p className="property-note">No condition: this Scene is always eligible and wins only by priority and order.</p>
          : (
            <ul className="reference-list">
              {scene.activationConditions.map((condition, index) => {
                const definition = definitions.find((candidate) => candidate.id === condition.stateId);
                return (
                  <li key={`${condition.stateId}-${index}`}>
                    <span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? `${condition.stateId} (unresolved)`} <code>{condition.operator} {String(condition.value)}</code>{condition.source === "setting" ? " · setting" : ""}</span>
                    <button type="button" className="reference-remove" aria-label={`Remove activation condition ${index + 1}`} onClick={() => removeSceneCondition(index)}>×</button>
                  </li>
                );
              })}
            </ul>
          )}
        <div className="condition-draft">
          <select aria-label="Activation runtime reference" value={sceneConditionDraft.stateId} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, stateId: event.target.value, operator: "equals" }))}>
            <option value="">Runtime reference…</option>
            {profileStates.map((state) => <option key={state.id} value={state.id}>{state.displayName} · state</option>)}
            {profileSettings.map((setting) => <option key={setting.id} value={setting.id}>{setting.displayName} · setting</option>)}
          </select>
          <select aria-label="Activation operator" value={sceneConditionDraft.operator} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, operator: event.target.value }))}>
            {operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}
          </select>
          {draftDefinition?.type === "boolean"
            ? <select aria-label="Activation value" value={sceneConditionDraft.value || "true"} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, value: event.target.value }))}><option value="true">true</option><option value="false">false</option></select>
            : draftDefinition?.type === "enum" && draftDefinition.enumValues
              ? <select aria-label="Activation value" value={sceneConditionDraft.value} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, value: event.target.value }))}><option value="">value…</option>{draftDefinition.enumValues.map((value) => <option key={value} value={value}>{value}</option>)}</select>
              : <input aria-label="Activation value" placeholder="value" value={sceneConditionDraft.value} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, value: event.target.value }))} />}
          <label className="condition-negate"><input type="checkbox" checked={sceneConditionDraft.negated} onChange={(event) => setSceneConditionDraft((current) => ({ ...current, negated: event.target.checked }))} /> NOT</label>
          <button type="button" className="small-action" disabled={!sceneConditionDraft.stateId} onClick={addSceneCondition}>Add</button>
        </div>
      </section>
    );
  };

  /**
   * Floor Mapping editor. A floor identifier is a symbolic Unicode string
   * (product decision): `1`, `G`, `B2`, `Restaurant`, `North` and localized
   * identifiers are all valid, so the field is free text, never a picker over a
   * fixed alphabet. Identifiers are compared in NFC, so a composed and a
   * decomposed spelling of the same identifier are rejected as a duplicate.
   */
  const renderFloorMappingSection = (theme: ThemeProject) => {
    const mappings = theme.floorMappings ?? [];
    const commit = (next: readonly FloorMapping[], label: string) => {
      const result = editorApplication.setThemeFloorMappings(theme.id, next);
      if (result.changed) logAction(label, "EVENT");
      else logAction("Floor mapping rejected: an identifier is empty or duplicated, or a display value is missing", "WARN");
      return result.changed;
    };
    const patchEntry = (mappingId: string, entryIndex: number, patch: Partial<FloorMappingEntry>) => commit(
      mappings.map((mapping) => mapping.id === mappingId
        ? { ...mapping, entries: mapping.entries.map((entry, index) => index === entryIndex ? { ...entry, ...patch } : entry) }
        : mapping),
      "Floor mapping entry updated",
    );
    return (
      <section className="property-section">
        <div className="property-section-title">Floor Mappings</div>
        <p className="property-note">A floor identifier is a symbolic value the firmware reports — <code>1</code>, <code>G</code>, <code>B2</code>, <code>Restaurant</code> — not a fixed A–Z list. Unicode and localized identifiers are accepted.</p>
        {mappings.length === 0 && <p className="property-note">No Floor Mapping. A Digit widget without one shows the raw firmware value.</p>}
        {mappings.map((mapping) => (
          <div className="floor-mapping" key={mapping.id}>
            <div className="floor-mapping-head">
              <strong>{mapping.id}</strong>
              <span className="floor-mapping-actions">
                <button type="button" className="small-action" title="Append an entry to this mapping" onClick={() => commit(mappings.map((candidate) => candidate.id === mapping.id ? { ...candidate, entries: [...candidate.entries, { firmwareValue: `F${candidate.entries.length + 1}`, displayValue: `${candidate.entries.length + 1}` }] } : candidate), "Floor mapping entry added")}>+ Entry</button>
                <button type="button" className="reference-remove" aria-label={`Remove floor mapping ${mapping.id}`} title="Remove this mapping" onClick={() => commit(mappings.filter((candidate) => candidate.id !== mapping.id), "Floor mapping removed")}>×</button>
              </span>
            </div>
            {mapping.entries.length === 0
              ? <p className="property-note">No entry yet.</p>
              : (
                <ul className="floor-entry-list">
                  {mapping.entries.map((entry, index) => (
                    <li key={`${mapping.id}-${index}`}>
                      <DraftTextField scope={`${mapping.id}:${index}:firmware`} value={String(entry.firmwareValue)} disabled={false} placeholder="firmware id" ariaLabel={`Firmware identifier ${index + 1}`} onCommit={(value) => patchEntry(mapping.id, index, { firmwareValue: value })} />
                      <span className="floor-arrow" aria-hidden="true">→</span>
                      <DraftTextField scope={`${mapping.id}:${index}:display`} value={entry.displayValue} disabled={false} placeholder="shown" ariaLabel={`Display value ${index + 1}`} onCommit={(value) => patchEntry(mapping.id, index, { displayValue: value })} />
                      <select aria-label={`Digit style for entry ${index + 1}`} value={entry.digitStyleId ?? ""} onChange={(event) => patchEntry(mapping.id, index, { digitStyleId: event.target.value || undefined })}>
                        <option value="">Mapping default</option>
                        {(activeProfile?.digitStyles ?? []).map((style) => <option key={style} value={style}>{style}</option>)}
                      </select>
                      <button type="button" className="reference-remove" aria-label={`Remove entry ${index + 1}`} onClick={() => commit(mappings.map((candidate) => candidate.id === mapping.id ? { ...candidate, entries: candidate.entries.filter((_, current) => current !== index) } : candidate), "Floor mapping entry removed")}>×</button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        ))}
        <button type="button" className="property-inline-action" onClick={() => commit([...mappings, { id: createStableId("floor-mapping"), entries: [] }], "Floor mapping added")}>Add Floor Mapping</button>
      </section>
    );
  };

  const renderThemeResourcesSection = (theme: ThemeProject) => (
    <section className="property-section">
      <div className="property-section-title">Theme Resources</div>
      <PropertyRow label="Rotations" value={String(theme.rotations.length)} />
      <PropertyRow label="Floor Mappings" value={String(theme.floorMappings?.length ?? 0)} />
      {project.assets.length === 0
        ? <p className="property-note">No asset is imported. Resources declare which assets ship with this Theme Project (manifest resourceAssetIds).</p>
        : (
          <ul className="reference-list checkbox-list">
            {project.assets.map((asset) => (
              <li key={asset.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={theme.resources.includes(asset.id)}
                    aria-label={`Ship ${asset.name} with ${theme.name}`}
                    onChange={(event) => setThemeResources(theme.id, event.target.checked ? [...theme.resources, asset.id] : theme.resources.filter((id) => id !== asset.id))}
                  />
                  <span>{assetGlyph(asset.mediaType)} {asset.name}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
    </section>
  );

  const renderProperties = () => {
    const draftScope = selectedIds.length ? selectedIds.join("|") : selection?.id ?? "document";
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
    // The advertised maximum must be the value the scene-bounds clamp will
    // NOT alter, otherwise the "clamped to N" feedback reports a number the
    // command then changes again (D5-02).
    const geometryBound = (field: keyof Geometry): number => {
      const rotationWidth = activeRotation?.width ?? 0;
      const rotationHeight = activeRotation?.height ?? 0;
      const widgets = selectedCanonical.map((current) => current.widget).filter((candidate): candidate is Widget => Boolean(candidate));
      if (!widgets.length) return field === "x" || field === "width" ? rotationWidth : rotationHeight;
      const limits = widgets.map((candidate) => {
        const geometry = canonicalGeometry(candidate);
        if (field === "x") return rotationWidth - geometry.width;
        if (field === "y") return rotationHeight - geometry.height;
        if (field === "width") return rotationWidth - geometry.x;
        return rotationHeight - geometry.y;
      });
      return Math.max(0, Math.min(...limits));
    };
    return (
      <>
        {renderPanelHeader("properties", "INSPECTOR", "Properties")}
        {renderDockTabs("right")}
        <div className="inspector-context"><span className={`context-icon ${selection ? "has-selection" : ""}`}>{selection ? "◇" : "□"}</span><div><strong>{multi ? `${selectedIds.length} items selected` : selection?.label ?? "Document Properties"}</strong><small>{multi ? `${selectedIds.length} objects in the active Scene` : selection ? (selection.detail ?? `${selection.nodeType ?? selection.kind} · canonical object`) : "Nothing selected · Document properties"}</small></div></div>
        {selection && node ? <div className="properties-scroll">
          <section className="property-section"><div className="property-section-title">Identity</div>{multi ? <PropertyRow label="Name" value="*" /> : "name" in node.node ? <div className="property-row property-row-edit"><span>Name</span><DraftTextField scope={draftScope} value={String(node.node.name)} disabled={false} ariaLabel="Display name" focusToken={renameRequestId === selection.id ? renameRequestId : null} onCommit={(value) => renameNodeById(node.node.id, value)} /></div> : <PropertyRow label="Name" value={selection.label} muted />}<PropertyRow label="Type" value={multi ? valueFor((current) => current.widget?.widgetType ?? current.kind) : (widget?.widgetType ?? selection.nodeType ?? selection.kind)} /><PropertyRow label="Stable ID" value={multi ? valueFor((current) => String(current.node.id)) : selection.id} muted /></section>
          <section className="property-section"><div className="property-section-title">Canonical Context</div><PropertyRow label="Source" value="Canonical Project Model" /><div className="property-row property-row-edit"><span>Device Profile</span><select aria-label="Device Profile" title={availableProfiles.length < 2 ? "Only one DeviceProfile is registered" : undefined} value={project.deviceProfileId} disabled={availableProfiles.length < 2} onChange={(event) => setDeviceProfile(event.target.value)}>{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></div><PropertyRow label="Validation" value={issueCount > 0 ? `${issueCount} issue(s)` : validation.valid ? "Valid" : "Review project"} muted /></section>
          {widget && <>
            <section className="property-section"><div className="property-section-title">Widget</div>{multi ? <PropertyRow label="Widget Type" value={valueFor((current) => current.widget?.widgetType)} /> : <div className="property-row property-row-edit"><span>Widget Type</span><select aria-label="Widget type" value={widget.widgetType} onChange={(event) => changeWidgetType(event.target.value)}>{(activeProfile?.supportedWidgetTypes ?? []).map((widgetType) => <option key={widgetType} value={widgetType}>{defaultWidgetName(widgetType)}</option>)}{!(activeProfile?.supportedWidgetTypes ?? []).includes(widget.widgetType) && <option value={widget.widgetType}>{widget.widgetType} (unsupported)</option>}</select></div>}<div className="property-row property-row-edit"><span>Visible</span><input type="checkbox" aria-label="Widget visible" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.visible) : widget.visible} onChange={() => toggleWidgetProperty("visible")} /></div><div className="property-row property-row-edit"><span>Enabled</span><input type="checkbox" aria-label="Widget enabled" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.enabled) : widget.enabled} onChange={() => toggleWidgetProperty("enabled")} /></div><div className="property-row property-row-edit"><span>Geometry Lock</span><input type="checkbox" aria-label="Widget geometry lock" checked={multi ? selectedSceneWidgets.length > 0 && selectedSceneWidgets.every((current) => current.locked) : widget.locked} onChange={() => toggleWidgetProperty("locked")} /></div></section>
            <section className="property-section"><div className="property-section-title">Geometry / Layer</div><div className="geometry-editor"><GeometryField scope={`${draftScope}:x`} label="X" field="x" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).x : undefined) : canonicalGeometry(widget).x} multi={multi} disabled={!geometryEditable} min={0} max={geometryBound("x")} onCommit={commitSelectionGeometryField} /><GeometryField scope={`${draftScope}:y`} label="Y" field="y" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).y : undefined) : canonicalGeometry(widget).y} multi={multi} disabled={!geometryEditable} min={0} max={geometryBound("y")} onCommit={commitSelectionGeometryField} /><GeometryField scope={`${draftScope}:w`} label="W" field="width" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).width : undefined) : canonicalGeometry(widget).width} multi={multi} disabled={!geometryEditable} min={10} max={geometryBound("width")} onCommit={commitSelectionGeometryField} /><GeometryField scope={`${draftScope}:h`} label="H" field="height" value={multi ? valueFor((current) => current.widget ? canonicalGeometry(current.widget).height : undefined) : canonicalGeometry(widget).height} multi={multi} disabled={!geometryEditable} min={10} max={geometryBound("height")} onCommit={commitSelectionGeometryField} /></div><div className="property-row property-row-edit"><span>Z-order</span><DraftNumberField scope={`${draftScope}:z`} value={multi ? valueFor((current) => current.widget?.zIndex) : String(widget.zIndex)} disabled={false} min={-100000} max={100000} ariaLabel="Widget z-order" onCommit={(value) => { const sceneId = activeScene?.id; if (!sceneId || !selectedWidgetIds.length) return; const result = editorApplication.setWidgetsPropertiesInScene(sceneId, selectedWidgetIds, { zIndex: value }); if (result.changed) logAction(`Set widget zIndex to ${value}`, "EVENT"); }} /></div></section>
            <section className="property-section"><div className="property-section-title">Presentation</div><PropertyRow label="Bindings" value={String(widget.bindings.length)} /><PropertyRow label="Asset References" value={String(widget.assetIds?.length ?? 0)} /><PropertyRow label="Media Type" value={widget.mediaType ?? "None"} /><PropertyRow label="Media Slide" value={widget.mediaSlide ? `${widget.mediaSlide.items.length} entr${widget.mediaSlide.items.length === 1 ? "y" : "ies"} · ${widget.mediaSlide.items.reduce((total, item) => total + item.duration, 0).toFixed(1)}s` : "None"} /><button type="button" className="property-inline-action" onClick={() => setBindingModal({ widgetId: widget.id })}>Open Binding Editor</button></section>
            {!multi && renderWidgetContentSection(widget)}
            {!multi && renderWidgetMediaSection(widget)}
          </>}
          {node.kind === "scene" && node.scene && <><section className="property-section"><div className="property-section-title">Scene Runtime</div><div className="property-row property-row-edit"><span>Priority</span><DraftNumberField scope={`${draftScope}:priority`} value={String(node.scene.priority)} disabled={false} min={0} max={10} integer ariaLabel="Scene priority" onCommit={(value) => { const result = editorApplication.setSceneProperties(node.scene!.id, { priority: value }); if (result.changed) logAction(`Scene priority set to ${value}`, "EVENT"); }} /></div><div className="property-row property-row-edit"><span>Enabled</span><input type="checkbox" aria-label="Scene enabled" checked={node.scene.enabled !== false} onChange={(event) => { const result = editorApplication.setSceneProperties(node.scene!.id, { enabled: event.target.checked }); if (result.changed) logAction(`Scene ${event.target.checked ? "enabled" : "disabled"}`, "EVENT"); }} /></div><PropertyRow label="Widgets" value={String(node.scene.widgets.length)} /></section>{renderSceneActivationSection(node.scene)}</>}
          {node.kind === "rotation" && node.rotation && <section className="property-section"><div className="property-section-title">Rotation / Form</div><PropertyRow label="Angle" value={`R${node.rotation.angle}`} /><PropertyRow label="Display" value={`${node.rotation.width} × ${node.rotation.height}`} /><PropertyRow label="Scenes" value={String(node.rotation.scenes.length)} /><p className="property-note">Every Theme Project carries exactly R0, R90, R180 and R270. Dimensions come from the DeviceProfile display; a Rotation / Form cannot be added or deleted.</p></section>}
          {node.kind === "theme" && node.theme && <>{renderThemeResourcesSection(node.theme)}{renderFloorMappingSection(node.theme)}</>}
          {node.asset && <section className="property-section"><div className="property-section-title">Asset</div><div className="property-row property-row-edit"><span>Media Type</span><select aria-label="Asset media type" value={node.asset.mediaType ?? ""} onChange={(event) => { const next = event.target.value === "" ? undefined : event.target.value as MediaType; const result = editorApplication.setAssetProperties(node.asset!.id, { mediaType: next }); if (result.changed) logAction(next ? `Asset media type set to ${next}` : "Asset media type cleared", "EVENT"); }}><option value="">Not assigned</option>{(activeProfile?.supportedMediaTypes ?? ["image", "video", "audio"]).map((mediaType) => <option key={mediaType} value={mediaType}>{mediaType}</option>)}</select></div><div className="property-row property-row-edit"><span>Source Path</span><DraftTextField scope={`${draftScope}:source`} value={node.asset.sourcePath} disabled={false} ariaLabel="Asset source path" onCommit={(value) => { const result = editorApplication.setAssetProperties(node.asset!.id, { sourcePath: value }); if (result.changed) logAction("Asset source path updated", "EVENT"); }} /></div><PropertyRow label="References" value={countAssetReferences(project, node.asset.id) > 0 ? `${countAssetReferences(project, node.asset.id)} reference(s)` : "unused"} /><PropertyRow label="Stable ID" value={node.asset.id} muted /><button type="button" className="property-inline-action" onClick={() => deleteAssetsCommand([node.asset!.id])}>Delete Asset</button><p className="property-note">The package carries a logical asset record; binary media is materialized by the deployment adapter.</p></section>}
          {multi && <div className="multi-selection-note"><strong>Multi-selection</strong><span>Same values show their value; different values show `*`. Geometry fields remain read-only when a selected widget is locked.</span></div>}
        </div> : <div className="properties-scroll"><section className="property-section"><div className="property-section-title">Document</div><div className="property-row property-row-edit"><span>Project Name</span><DraftTextField scope={`document:${project.id}`} value={project.name} disabled={false} ariaLabel="Project name" onCommit={(value) => { const result = editorApplication.renameNode(project.id, value); if (result.changed) logAction(`Project renamed to ${value}`, "EVENT"); }} /></div><div className="property-row property-row-edit"><span>Device Profile</span><select aria-label="Document device profile" value={project.deviceProfileId} onChange={(event) => setDeviceProfile(event.target.value)}>{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.display.width}×{profile.display.height}</option>)}{!activeProfile && <option value={project.deviceProfileId}>{project.deviceProfileId} (not registered)</option>}</select></div><PropertyRow label="Display" value={activeProfile ? `${activeProfile.display.width} × ${activeProfile.display.height}` : "unavailable"} /><PropertyRow label="Theme Projects" value={String(allThemes.length)} /><PropertyRow label="Assets" value={String(project.assets.length)} /><PropertyRow label="Schema" value={`v${project.schemaVersion}`} muted /><PropertyRow label="Validation" value={validation.valid ? `Valid · ${validation.issues.length} note(s)` : `${validation.issues.filter((issue) => issue.severity === "error").length} error(s)`} muted /></section><section className="property-section"><div className="property-section-title">Next Step</div><p className="property-note">{!activeProfile ? "The saved DeviceProfile is not registered in this build. Pick a registered profile above; every Rotation / Form is re-dimensioned to it." : allThemes.length === 0 ? "Add a Theme Project, then a Scene, then widgets." : !activeSceneNode ? "Add a Scene to the active Rotation / Form to start placing widgets." : "Select an object in the Explorer, the canvas or the Scene tabs to inspect and edit it."}</p></section></div>}
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
      <div className="simulator-toolbar"><button type="button" className="sim-button primary" onClick={() => { setSimulationStatus("running"); traceRuntime(); }} title="Re-evaluate Scene activation and bindings against the current inputs and write the trace to the Console">Evaluate</button><button type="button" className="sim-button" onClick={resetSimulator} title="Clear every runtime state and reseed DeviceProfile setting defaults">Reset</button><span className="sim-status">{runtime.activeScene ? "ACTIVE" : "NO MATCH"}</span><span className="sim-note">V1 evaluates rules; timed media playback is device-runtime behaviour and is not simulated.</span></div>
      <div className="simulator-scroll">
        <section className="sim-section"><div className="property-section-title">Runtime States · DeviceProfile</div>{simulatorStates.length === 0 ? <div className="sim-empty">{profileStates.length === 0 ? "No state registry entries in active DeviceProfile." : `The active DeviceProfile marks none of its ${profileStates.length} runtime state(s) as simulator inputs.`}</div> : simulatorStateGroups.map(([category, states]) => <div className="sim-group" key={category}><div className="sim-group-title">{category}</div>{states.map((state) => { const current = runtimeValues[state.id]; return <label className="sim-input-row" key={state.id} title={state.description ?? `${state.displayName} (${state.type})`}><span>{state.displayName}<small>{state.type}</small></span>{renderRuntimeInput(state, current, (value) => setRuntimeValues((values) => value === null ? (() => { const next = { ...values }; delete next[state.id]; return next; })() : { ...values, [state.id]: value }))}</label>; })}</div>)}{hiddenStateCount > 0 && <p className="property-note">{hiddenStateCount} runtime state(s) are declared but not marked as simulator inputs, so the device supplies them and this panel does not.</p>}</section>
        <section className="sim-section"><div className="property-section-title">Runtime Settings · DeviceProfile</div>{profileSettings.length === 0 ? <div className="sim-empty">No runtime settings in active DeviceProfile.</div> : profileSettings.map((setting) => { const current = runtimeSettings[setting.id]; return <label className="sim-input-row" key={setting.id}><span>{setting.displayName}<small>{setting.type}</small></span>{renderRuntimeInput(setting, current, (value) => setRuntimeSettings((values) => value === null ? (() => { const next = { ...values }; delete next[setting.id]; return next; })() : { ...values, [setting.id]: value }))}</label>; })}</section>
        <section className="sim-section"><div className="property-section-title">Active Scene</div><div className="sim-empty">{`Evaluation context: R${runtimeRotation?.angle ?? "—"} · ${runtimeRotation?.scenes.length ?? 0} scene(s)`}</div><div className="active-scene-card"><strong>{runtime.activeScene?.name ?? "No active Scene"}</strong><span>{runtime.activeScene ? `Priority ${runtime.activeScene.priority}` : "Runtime inputs are empty"}</span></div>{runtime.candidates.length === 0 ? <div className="sim-empty">This Rotation / Form has no Scene to evaluate.</div> : runtime.candidates.map((candidate) => { const scene = runtimeRotation?.scenes.find((current) => current.id === candidate.sceneId); const reason = !scene ? "" : scene.enabled === false ? "disabled" : scene.activationConditions.length === 0 ? "always eligible" : candidate.matched ? `${scene.activationConditions.length} condition(s) met` : `${scene.activationConditionMode ?? "all"} of ${scene.activationConditions.length} condition(s) not met`; return <div className={`sim-row ${candidate.sceneId === runtime.activeSceneId ? "is-active-row" : ""}`} key={candidate.sceneId}><span>{scene?.name ?? candidate.sceneId}<small>priority {candidate.priority} · order {candidate.activationOrder} · {reason}</small></span><strong>{candidate.sceneId === runtime.activeSceneId ? "ACTIVE" : candidate.matched ? "MATCH" : "skip"}</strong></div>; })}</section>
        <section className="sim-section"><div className="property-section-title">Active Bindings</div>{activeBindings.length === 0 ? <div className="sim-empty">No bindings in the active Scene.</div> : activeBindings.map((evaluation) => <div className="sim-row" key={evaluation.bindingId}><span>{evaluation.widgetId}</span><strong>{evaluation.action} · {evaluation.matched ? "TRUE" : "FALSE"}</strong></div>)}</section>
      </div>
      <div className="panel-footnote"><span className="footnote-mark">i</span><span>Simulator consumes DeviceProfile, Scene selection and active-scene bindings; it does not invent Custom State.</span></div>
    </>
  );

  /**
   * SD-card deployment panel.
   *
   * It never offers a write it cannot perform: with no native transport it says
   * so, with no removable target it says so, and a non-removable volume is
   * listed but refused with its reason rather than hidden. The stage line and
   * the result are shown verbatim, including a partial write.
   */
  const renderDeployment = () => {
    const nativeTransport = deploymentService.storageKind === "native-tauri";
    const selected = sdVolumes.find((volume) => volume.id === sdSelectedId);
    const probeless = selected && lastPackage ? deploymentService.preflight(lastPackage, selected, undefined) : undefined;
    const formatBytes = (bytes: number | undefined) => bytes === undefined ? "unknown" : bytes >= 1_073_741_824 ? `${(bytes / 1_073_741_824).toFixed(1)} GB` : bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${bytes} B`;
    return (
      <div className="deployment-panel">
        <ol className="deployment-stages" aria-label="Deployment pipeline">
          {(["preflight", "write", "verify", "complete"] as SdDeploymentStage[]).map((stage) => (
            <li key={stage} className={sdStage === stage ? "active" : sdResult?.status === "verified" ? "done" : sdResult?.status === "failed" && sdResult.stage === stage ? "failed" : ""}>{stage}</li>
          ))}
        </ol>
        {!nativeTransport && (
          <div className="deployment-notice">
            <strong>No removable-storage transport in this build</strong>
            <span>Writing to a card needs the desktop shell. The web build has no filesystem access, so detection and writing are unavailable here — the package can still be built, verified and exported as a file.</span>
          </div>
        )}
        <div className="deployment-actions">
          <button type="button" className="small-action" disabled={sdBusy || !nativeTransport} title={nativeTransport ? "Enumerate removable volumes" : "Requires the desktop build"} onClick={() => { void detectSdTargets(); }}>Detect Targets</button>
          <button type="button" className="small-action primary-action" disabled={sdBusy || !nativeTransport || !lastPackage || !selected || !selected.removable || selected.readOnly} title={!lastPackage ? "Run Build & Verify Package first" : !selected ? "Select a target" : selected.removable ? (selected.readOnly ? "The selected volume is read-only" : `Write and verify on ${selected.mountPath}`) : "The selected volume is not removable and will be refused"} onClick={() => { void deployToSdCard(); }}>Deploy &amp; Verify</button>
          <button type="button" className="small-action" disabled={sdBusy || !nativeTransport || !selected} title="Attempt a safe removal" onClick={() => { void ejectSdTarget(); }}>Safe Eject</button>
          <span className="deployment-meta">Transport: {sdTransport}{lastPackage ? ` · package ${lastPackage.files.length} file(s)` : " · no package built"}</span>
        </div>
        {sdDetectError && <div className="deployment-notice is-error"><strong>Detection failed</strong><span>{sdDetectError}</span></div>}
        {nativeTransport && sdVolumes.length === 0 && !sdDetectError && <div className="deployment-notice"><strong>No SD card / removable target detected.</strong><span>Insert a card and choose Detect Targets. A card that is still mounting is reported as not ready and skipped, so if it was only just inserted, detect again.</span></div>}
        {sdVolumes.length > 0 && (
          <table className="deployment-targets">
            <thead><tr><th scope="col">Target</th><th scope="col">Volume</th><th scope="col">Filesystem</th><th scope="col">Free</th><th scope="col">Capacity</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {sdVolumes.map((volume) => {
                const eligible = volume.removable && !volume.readOnly;
                return (
                  <tr key={volume.id} className={volume.id === sdSelectedId ? "is-selected" : ""}>
                    <td>
                      <label className="deployment-target-choice">
                        <input type="radio" name="sd-target" checked={volume.id === sdSelectedId} disabled={!eligible} aria-label={`Select ${volume.mountPath}`} onChange={() => setSdSelectedId(volume.id)} />
                        <span>{volume.mountPath}</span>
                      </label>
                    </td>
                    <td>{volume.volumeName}</td>
                    <td>{volume.fileSystem ?? "unknown"}</td>
                    <td>{formatBytes(volume.freeBytes)}</td>
                    <td>{formatBytes(volume.totalBytes)}</td>
                    <td className={eligible ? "is-eligible" : "is-refused"}>{volume.removable ? (volume.readOnly ? "read-only" : "removable") : "fixed disk — refused"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {probeless && probeless.findings.length > 0 && (
          <ul className="deployment-findings">
            {probeless.findings.map((finding) => (
              <li key={finding.code} className={finding.severity}>
                <strong>{finding.code}</strong> {finding.message} <em>{finding.remediation}</em>
              </li>
            ))}
          </ul>
        )}
        {sdResult && (
          <div className={`deployment-result ${sdResult.status === "verified" ? "is-ok" : "is-error"}`}>
            {sdResult.status === "verified" ? (
              <>
                <strong>Deployed and verified</strong>
                <span>{sdResult.writtenFiles} file(s), {sdResult.writtenBytes} byte(s) written to {sdResult.rootPath} and read back byte-for-byte.</span>
              </>
            ) : (
              <>
                <strong>Failed at {sdResult.stage} · {sdResult.code}</strong>
                <span>{sdResult.message}</span>
                <span className="deployment-remediation">{sdResult.remediation}</span>
                {sdResult.partial && <span className="deployment-partial">{sdResult.partial.writtenFiles} file(s) had already been written. The card is incomplete and must not be used.</span>}
                {sdResult.verified && sdResult.verified.some((detail) => !detail.ok) && (
                  <ul className="deployment-findings">
                    {sdResult.verified.filter((detail) => !detail.ok).map((detail) => <li key={detail.path} className="error"><strong>{detail.path}</strong> {detail.reason}</li>)}
                  </ul>
                )}
              </>
            )}
          </div>
        )}
        <p className="deployment-footnote">The V1 package carries logical asset records (<code>*.asset.json</code>, <code>binary: false</code>); binary media copying is a separate adapter step. Safe eject is reported as unavailable rather than simulated.</p>
      </div>
    );
  };

  const renderConsole = () => (
    <>
      <div className="console-tabs"><button type="button" className={consoleTab === "console" ? "active" : ""} onClick={() => setConsoleTab("console")}>Console</button><button type="button" className={consoleTab === "validation" ? "active" : ""} onClick={() => setConsoleTab("validation")}>Validation <span className="tab-count">{validation.issues.length}</span></button><button type="button" className={consoleTab === "deployment" ? "active" : ""} onClick={() => { setConsoleTab("deployment"); if (sdTransport === "unknown") void detectSdTargets(); }}>Deployment</button><span className="console-spacer" /><span className="console-scope">Package: {deploymentStatus}</span><button type="button" className="panel-action" title="Float console" onClick={() => setPanelMode("console", "floating")}>⤢</button><button type="button" className="panel-action" title="Collapse console" aria-label="Collapse console" onClick={() => collapsePanel("console")}>−</button></div>
      <div className="console-body">{consoleTab === "deployment" ? renderDeployment() : consoleTab === "console" ? <div className="console-entry-list">{consoleEntries.map((entry, index) => <div className="console-entry" key={`${entry.time}-${entry.message}-${index}`}><span className="console-time">{entry.time || "—"}</span><span className={`console-level ${entry.level.toLowerCase()}`}>{entry.level}</span><span className="console-info">{entry.message}</span></div>)}<span className="console-muted">Command, validation, export and runtime traces appear here.</span></div> : <div className="console-entry-list"><div className="console-entry"><span className={`validation-dot ${validation.valid ? "ok" : "error"}`} /><span className="console-info">{validation.valid ? "No blocking foundation issues" : `${validation.issues.length} validation issue(s)`}</span></div><span className="console-muted">Each issue lists the problem, its location and the action that resolves it.</span>{validation.issues.map((issue) => { const targetId = resolveValidationTarget(project, issue.path); const target = targetId ? resolveCanonicalNode(project, targetId) : undefined; return <div className="console-entry validation-issue" key={`${issue.code}-${issue.path ?? ""}`}><span className={`console-level ${issue.severity}`}>{issue.severity.toUpperCase()}</span><span className="console-info"><strong className="validation-code">{issue.code}</strong> {target ? <button type="button" className="validation-goto" title={`Select ${"name" in target.node ? String(target.node.name) : targetId} in the editor`} onClick={() => revealValidationTarget(targetId as string)}>{"name" in target.node ? String(target.node.name) : (target.kind === "rotation" ? `R${target.rotation?.angle}` : targetId)}</button> : issue.path ? <code className="validation-path">{issue.path}</code> : null} {issue.message}{issue.remediation ? <em className="validation-remediation"> &rarr; {issue.remediation}</em> : null}</span></div>; })}</div>}</div>
    </>
  );

  const renderPanelContainer = (panel: PanelId, content: ReactNode) => panelModes[panel] === "closed" ? null : panelModes[panel] === "floating" ? <div className={`floating-tool-panel floating-${panel}`} data-panel={panel}>{content}</div> : <aside className="tool-panel">{content}</aside>;

  const settingsContent: Record<SettingsCategory, ReactNode> = {
    General: <><h3>General</h3><p>Application-level behavior stays separate from Project, Theme and Runtime settings.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.confirmDestructive} onChange={(event) => setSettingsDraft((current) => ({ ...current, confirmDestructive: event.target.checked }))} /> Confirm destructive commands</label></>,
    Appearance: <><h3>Appearance</h3><p>Neutral surfaces, restrained teal accent and compact Windows desktop density are canonical.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.compactDensity} onChange={(event) => setSettingsDraft((current) => ({ ...current, compactDensity: event.target.checked }))} /> Use compact panel density</label></>,
    Editor: <><h3>Editor</h3><p>Editor defaults apply to the UI shell only; domain geometry remains canonical.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.restoreSession} onChange={(event) => setSettingsDraft((current) => ({ ...current, restoreSession: event.target.checked }))} /> Restore the last Theme / Rotation / Scene, zoom and panels on reload</label><div className="settings-value">Shortcut registry <strong>Canonical table + Alt navigation family</strong></div></>,
    Canvas: <><h3>Canvas</h3><p>Canvas preferences are application UI defaults and do not change runtime semantics.</p><label className="settings-check"><input type="checkbox" checked={settingsDraft.showGrid} onChange={(event) => setSettingsDraft((current) => ({ ...current, showGrid: event.target.checked }))} /> Show grid by default</label><label className="settings-check"><span>Snap grid size</span><input className="settings-number" type="number" min="1" step="1" value={settingsDraft.snapGridSize} onChange={(event) => setSettingsDraft((current) => ({ ...current, snapGridSize: Math.max(1, Number(event.target.value) || DEFAULT_GRID_SIZE) }))} /><small className="settings-unit">scene units</small></label></>,
    Assets: <><h3>Assets</h3><p>Asset Browser is a depot/library view. Resources, Scene Content and Unsupported Files remain separate.</p><div className="settings-value">Preview mode <strong>Profile-supported</strong></div></>,
    Audio: <><h3>Audio</h3><p>Audio channel modelling is an <strong>open product decision</strong>. The specification states three separately modelled channels in one document and five in another, and its runtime-setting defaults disagree on both values and keys — including within a single document.</p><p className="property-note">Status: <strong>firmware specification confirmation required</strong>. No channel count is assumed, so this build exposes no channel, mixing or default-volume control rather than guessing one. A Media Sequence may carry one attached audio asset, which is the only audio behaviour every document agrees on.</p></>,
    Simulator: <><h3>Simulator</h3><p>Simulator consumes canonical DeviceProfile runtime state and settings registries.</p><div className="settings-value">Rule system <strong>Canonical evaluator</strong></div></>,
    Validation: <><h3>Validation</h3><p>Validation issues are sourced from the shared validation service.</p><div className="settings-value">Severity <strong>Profile-aware</strong></div></>,
    Export: <><h3>Export</h3><p>Export scope is controlled by canonical Resources + Used + Default asset rules.</p><div className="settings-value">Format conversion <strong>Not in V1</strong></div></>,
    Shortcuts: <><h3>Shortcuts</h3><p>Every binding the application listens for, read from the one command registry, so an advertised shortcut can never drift from its handler.</p><div className="shortcut-list">{canonicalShortcuts.map((descriptor) => <span key={descriptor.id}>{shortcutDisplay(descriptor)} <strong>{descriptor.label}</strong></span>)}</div><p className="property-note">Select All applies to the widgets of the active Scene. Delete and Backspace are equivalent. Arrow nudges by the snap grid, Ctrl+Arrow by a tenth of it, Ctrl+Shift+Arrow by five times it; Shift+Arrow alone does not move a widget. Alt+Arrow navigates Scenes and Rotation / Forms and never moves geometry.</p></>,
  };

  return (
    <div className="app-shell" onClick={() => menuOpen && setMenuOpen(null)}>
      <header className="application-bar">
        <div className="brand-block"><span className="brand-mark">TD</span><div><strong>Template Designer</strong><span className="muted">Design Studio · Foundation</span></div></div>
        <nav className="menu-bar" aria-label="Application menu">{menuKeys.map((menu) => <div key={menu} className="menu-item-wrap"><button type="button" className={`menu-button ${menuOpen === menu ? "is-open" : ""}`} aria-haspopup="menu" aria-expanded={menuOpen === menu} onClick={(event) => { event.stopPropagation(); setMenuOpen((current) => current === menu ? null : menu); }}>{menu}</button>{menuOpen === menu && <div className="menu-popover" onClick={(event) => event.stopPropagation()}>{menuItems[menu].map((item) => <button key={item.label} type="button" className="menu-command" disabled={item.disabled} title={item.title} onClick={item.onClick}><span>{item.label}</span>{item.shortcut && <kbd>{item.shortcut}</kbd>}</button>)}</div>}</div>)}</nav>
        <div className="topbar-actions"><span className="mode-chip"><span className="live-dot" /> {viewMode === "design" ? "Design Mode" : "Preview Mode"}</span><span className={`mode-chip ${documentSnapshot.isDirty ? "is-dirty" : "is-clean"}`}>{documentSnapshot.isDirty ? "Unsaved changes" : "Saved"}</span><button type="button" className="toolbar-button primary" onClick={requestNewProject}>New Project</button><button type="button" className="toolbar-button" disabled={!commandHistory.canUndo || canvasPointer.mode !== "idle"} onClick={undo} title={commandHistory.canUndo ? "Undo last command" : "No commands to undo"}>Undo</button><button type="button" className="toolbar-button" disabled={!commandHistory.canRedo || canvasPointer.mode !== "idle"} onClick={redo} title={commandHistory.canRedo ? "Redo last command" : "No commands to redo"}>Redo</button><button type="button" className="toolbar-button settings-button" onClick={() => setSettingsOpen(true)} title="Program Settings">⚙ Settings</button></div>
      </header>

      <div className="document-tabs" aria-label="Open documents"><div className="document-tab-list"><div className="document-tab active"><button type="button" className="document-tab-main" onClick={() => logAction(`${project.name} is the open document`, "EVENT")}><span className="document-tab-icon">▧</span><span>{project.name}</span>{documentSnapshot.isDirty && <span className="dirty-indicator" title="Unsaved changes" />}</button><button type="button" className="tab-close" aria-label="The open document cannot be closed" title="The open document cannot be closed; use New Project" onClick={() => logAction("The open document cannot be closed; use New Project", "WARN")} disabled>×</button></div></div><span className="document-tab-note">Single document foundation · {documentSnapshot.isDirty ? "Dirty" : "Clean"}</span><div className="tab-actions"><button type="button" className="icon-button" title="Reset layout" onClick={resetLayout}>↺</button></div></div>

      <main className="workspace-stack" style={{ gridTemplateRows: workspaceRows }}>
        <div className="editor-workspace" style={{ gridTemplateColumns: editorColumns }}>
          {activeLeftPanel && renderPanelContainer(activeLeftPanel, activeLeftPanel === "explorer" ? renderExplorer() : renderAssets())}
          {leftVisible && <div className="splitter" role="separator" aria-label="Resize left panel" aria-orientation="vertical" aria-valuenow={leftWidth} aria-valuemin={220} aria-valuemax={420} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setLeftWidth((current) => Math.min(420, Math.max(220, current - 8))); } if (event.key === "ArrowRight") { event.preventDefault(); setLeftWidth((current) => Math.min(420, Math.max(220, current + 8))); } }} onPointerDown={(event) => beginResize("left", event)} />}
          <section className="canvas-workspace" aria-label="Canvas editor">
            <div className="studio-toolbar"><div className="tool-group"><button type="button" className={`studio-tool ${canvasTool === "select" ? "active" : ""}`} onClick={() => setCanvasTool("select")} title="Select tool">↖ <span>Select</span></button><button type="button" className={`studio-tool ${canvasTool === "pan" ? "active" : ""}`} onClick={() => setCanvasTool("pan")} title="Pan tool">✥ <span>Pan</span></button><span className="tool-divider" /><button type="button" className={`studio-tool ${gridVisible ? "active" : ""}`} onClick={() => setGridVisible((current) => !current)} title="Toggle grid">▦ <span>Grid</span></button><button type="button" className={`studio-tool ${snapEnabled ? "active" : ""}`} onClick={() => setSnapEnabled((current) => !current)} title="Toggle snap">⌁ <span>Snap</span></button></div><div className="tool-group"><button type="button" className={`mode-button ${viewMode === "design" ? "active" : ""}`} onClick={() => setViewMode("design")}>Design</button><button type="button" className={`mode-button ${viewMode === "preview" ? "active" : ""}`} onClick={() => setViewMode("preview")}>Preview</button><span className="tool-divider" /><button type="button" className="zoom-button" aria-label="Zoom out" title="Zoom out" disabled={zoom <= MIN_ZOOM} onClick={() => setZoom((current) => Math.max(MIN_ZOOM, current - 10))}>−</button><span className="zoom-readout">{zoom}%</span><button type="button" className="zoom-button" aria-label="Zoom in" title="Zoom in" disabled={zoom >= MAX_ZOOM} onClick={() => setZoom((current) => Math.min(MAX_ZOOM, current + 10))}>+</button></div></div>
            {renderCanvasNavigator()}
            <div className={`canvas-stage ${canvasTool === "pan" ? "pan-mode" : ""}`} onClick={() => { if (!isCanvasClickSuppressed()) clearSelection(); setContextMenu(null); }}><div className="canvas-rail-label">{duplicateMode ? "DUPLICATE MODE · click to place · Esc exits" : viewMode === "design" ? "DESIGN STUDIO" : previewActive ? `RUNTIME PREVIEW - ${runtime.activeScene?.name ?? ""}` : "RUNTIME PREVIEW - NO SCENE ACTIVATES"}</div>{viewMode === "preview" && !previewActive && <div className="preview-inactive-note" role="status"><strong>No Scene activates with the current runtime inputs</strong><span>{runtime.candidates.length === 0 ? "This Rotation / Form has no Scene." : `${runtime.candidates.length} Scene(s) were evaluated and none matched. Set the runtime states in the Simulator, or relax a Scene Activation rule.`}</span><span className="preview-inactive-hint">The canvas below still shows the Design Mode layout; it is not a runtime result.</span></div>}<div className="device-canvas-wrap" onClick={(event) => event.stopPropagation()}><div className="device-frame" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}><div className="device-frame-header"><span>DISPLAY</span><span>{activeRotation ? `R${activeRotation.angle} · ${canvasWidth} × ${canvasHeight}` : "No rotation selected"}</span></div><div className="device-screen" ref={canvasScreenRef} tabIndex={0} onClick={(event) => handleCanvasClick(event)} onPointerDown={beginCanvasMarquee} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerCancel={handleCanvasPointerCancel} onLostPointerCapture={handleCanvasPointerCaptureLost} onContextMenu={(event) => {
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
    }}><div className="canvas-widget-layer" style={canvasLayerStyle}>{canvasAvailable && snapGuides.map(renderSnapGuide)}{canvasAvailable && selectionBounds && <div className="selection-bounds" style={{ left: `${(selectionBounds.x / canvasWidth) * 100}%`, top: `${(selectionBounds.y / canvasHeight) * 100}%`, width: `${(selectionBounds.width / canvasWidth) * 100}%`, height: `${(selectionBounds.height / canvasHeight) * 100}%` }}>{selectedWidgetIds.length > 1 && selectedEditableWidgets.length > 0 && (["n", "e", "s", "w", "nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => <button type="button" key={handle} className={`resize-handle handle-${handle}`} aria-label={`Resize selection ${handle}`} onPointerDown={(event) => beginSelectionResize(handle, event)} />)}</div>}{canvasAvailable && displayedWidgets.map(renderCanvasWidget)}{canvasPointer.mode === "marquee" && <div className="selection-marquee" style={{ left: `${(canvasPointer.rect.x / canvasWidth) * 100}%`, top: `${(canvasPointer.rect.y / canvasHeight) * 100}%`, width: `${(canvasPointer.rect.width / canvasWidth) * 100}%`, height: `${(canvasPointer.rect.height / canvasHeight) * 100}%` }} />}{(!canvasAvailable || displayedWidgets.length === 0) && <div className="canvas-empty-state"><span className="empty-glyph">◇</span><strong>{!activeProfile ? "DeviceProfile unavailable" : activeScene?.name ?? (hasThemeProject ? "Select a Scene or Widget" : "No Theme Project")}</strong><span>{!activeProfile ? "The saved DeviceProfile is not registered in this build. Choose a registered profile to continue." : activeScene ? "Scene contains no widgets." : "Create or select a canonical Rotation and Scene to begin canvas editing."}</span>{!activeProfile ? availableProfiles.map((profile) => <button type="button" key={profile.id} className="context-action" onClick={(event) => { event.stopPropagation(); setDeviceProfile(profile.id); }}>Use {profile.name}</button>) : activeScene?.id && activeProfile?.supportedWidgetTypes.length ? <button type="button" className="context-action" onClick={(event) => { event.stopPropagation(); addWidget(activeProfile.supportedWidgetTypes[0]); }}>Add Widget</button> : activeRotation && !activeScene ? <button type="button" className="context-action" onClick={(event) => { event.stopPropagation(); addScene(); }}>Add Scene</button> : !hasThemeProject ? <button type="button" className="context-action" onClick={(event) => { event.stopPropagation(); addThemeProject(); }}>Add Theme Project</button> : null}</div>}</div></div><div className="device-frame-footer"><span>ASPECT LOCKED</span><span>{activeRotation ? `R${activeRotation.angle}` : "—"}</span></div></div></div><div className="canvas-overlay-note">{previewActive && runtime.activeScene ? `Preview · ${runtime.activeScene.name} · ${displayedWidgets.length} widget(s)` : activeScene ? `${activeScene.name} · ${canvasWidgets.length} widget(s)` : "Canvas shell · select a canonical Rotation or Scene"}</div></div>
            <div className="canvas-context-bar"><div className="context-selection"><span className="selection-dot" />{activeSelectionLabel}{viewMode === "design" && runtime.activeScene && resolvedSelection?.scene?.id !== runtime.activeScene.id && <span className="context-runtime-note">Runtime would activate: {runtime.activeScene.name}</span>}</div><div className="context-actions"><button type="button" className="context-action" disabled={!activeScene?.id || !activeProfile?.supportedWidgetTypes.length} onClick={() => addWidget(activeProfile?.supportedWidgetTypes[0] ?? "")} title={activeScene?.id ? `Add a ${defaultWidgetName(activeProfile?.supportedWidgetTypes[0] ?? "widget")} widget to ${activeScene.name} - use the Widget menu for another type` : "Requires an active Scene"}>Add Widget</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={duplicateSelectionCommand} title={selectedWidgetIds.length ? "Duplicate selected widget" : "Requires a selected widget"}>Duplicate</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={() => toggleWidgetProperty("locked")} title={selectedWidgetIds.length ? (selectedWidgetsAllLocked ? "Unlock selected widget(s)" : "Lock selected widget(s)") : "Requires a selected widget"}>{selectedWidgetsAllLocked ? "Unlock" : "Lock"}</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={() => toggleWidgetProperty("visible")} title={selectedWidgetIds.length ? (selectedWidgetsAllVisible ? "Hide selected widget(s)" : "Show selected widget(s)") : "Requires a selected widget"}>{selectedWidgetsAllVisible ? "Hide" : "Show"}</button><button type="button" className="context-action" disabled={!selectedWidgetIds.length} onClick={deleteSelectionCommand} title={selectedWidgetIds.length ? "Delete selected widget" : "Requires a selected widget"}>Delete</button></div></div>
          </section>
          {rightVisible && <div className="splitter" role="separator" aria-label="Resize right panel" aria-orientation="vertical" aria-valuenow={rightWidth} aria-valuemin={220} aria-valuemax={420} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setRightWidth((current) => Math.min(420, Math.max(220, current - 8))); } if (event.key === "ArrowRight") { event.preventDefault(); setRightWidth((current) => Math.min(420, Math.max(220, current + 8))); } }} onPointerDown={(event) => beginResize("right", event)} />}
          {activeRightPanel && renderPanelContainer(activeRightPanel, activeRightPanel === "properties" ? renderProperties() : renderSimulator())}
        </div>
        {consoleVisible && <section className="console-panel" aria-label="Console and validation">{renderConsole()}</section>}
        {floatingPanels.map((panel) => renderPanelContainer(panel, panel === "explorer" ? renderExplorer() : panel === "assets" ? renderAssets() : panel === "properties" ? renderProperties() : panel === "simulator" ? renderSimulator() : renderConsole()))}
      </main>

      {contextMenu && commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).length > 0 && <div className="editor-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>{commandsForSelection(contextMenu.kind, { widgetTypes: activeProfile?.supportedWidgetTypes }).map((command) => <button type="button" key={command.id} onClick={() => executeEditorDescriptor(command.id)}><span>{command.label}</span>{command.shortcut && <kbd>{command.shortcut}</kbd>}</button>)}</div>}

      <footer className="statusbar"><span><span className={`status-led ${validation.valid ? "" : "is-error"}`} aria-hidden="true" /> {validation.valid ? "No blocking foundation issues" : "Foundation validation requires attention"}</span><span aria-live="polite">{profileStatus} · Selection: {activeSelectionLabel} · Zoom {zoom}% · {snapEnabled ? "Snap on" : "Snap off"} · {gridVisible ? "Grid on" : "Grid off"}</span><span>{deploymentStatus} · Document: {documentSnapshot.isDirty ? "dirty" : "clean"} · Browser core · Tauri shell reserved</span></footer>

      {bindingModal && <div className="settings-backdrop" role="presentation"><section className="binding-dialog" role="dialog" aria-modal="true" aria-labelledby="binding-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">CANONICAL PRESENTATION</span><h2 id="binding-title">Binding Editor</h2></div><button type="button" className="panel-action" aria-label="Close Binding Editor" onClick={() => setBindingModal(null)}>×</button></header><div className="binding-layout"><div className="binding-context-card"><span className="context-icon has-selection">◇</span><div><strong>{bindingWidget?.name ?? "Widget"}</strong><small>{bindingWidget?.widgetType ?? "Unknown"} · Evaluated against the current runtime context</small></div></div><div className="binding-section"><div className="property-section-title">Bindings</div>{bindingWidget?.bindings.length ? bindingWidget.bindings.map((binding, index) => { const evaluation = bindingEvaluations[index]; return <div className="binding-card" key={binding.id}><div className="binding-card-head"><strong>{binding.action}</strong><span className="binding-card-actions"><span className={evaluation?.matched ? "binding-true" : "binding-false"}>{evaluation?.matched ? "TRUE" : "FALSE"}</span><button type="button" className="binding-remove" aria-label="Remove binding" title="Remove binding" onClick={() => removeBinding(binding.id)}>×</button></span></div><div className="binding-condition-list">{binding.conditions.map((condition, conditionIndex) => { const definition = [...profileStates, ...profileSettings].find((candidate) => candidate.id === condition.stateId); return <div className="binding-condition" key={`${binding.id}-${conditionIndex}`}><span>{condition.negated ? "NOT " : ""}{definition?.displayName ?? condition.stateId}</span><code>{condition.operator} {String(condition.value)}</code>{binding.conditions.length > 1 && <button type="button" className="reference-remove" aria-label={`Remove condition ${conditionIndex + 1}`} onClick={() => removeBindingCondition(binding.id, conditionIndex)}>x</button>}</div>; })}</div><label className="binding-mode-row"><span>Priority</span><select aria-label={`Priority for ${binding.action} binding`} value={String(binding.priority ?? MIN_BINDING_PRIORITY)} onChange={(event) => setBindingPriority(binding.id, Number(event.target.value))}>{Array.from({ length: MAX_BINDING_PRIORITY - MIN_BINDING_PRIORITY + 1 }, (_, offset) => MIN_BINDING_PRIORITY + offset).map((level) => <option key={level} value={level}>{level}</option>)}</select></label><label className="binding-mode-row"><span>Match</span><select aria-label={`Condition mode for ${binding.action} binding`} value={binding.conditionMode ?? "all"} onChange={(event) => setBindingConditionMode(binding.id, event.target.value as ConditionMode)}><option value="all">All (AND)</option><option value="any">Any (OR)</option></select></label><small>Target widget: {evaluation?.widgetId ?? binding.widgetId} · content/style: {binding.contentId ? (project.assets.find((asset) => asset.id === binding.contentId)?.name ?? `${binding.contentId} (unresolved)`) : "presentation"}</small></div>; }) : <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No bindings on this widget</strong><span>Add a binding below from DeviceProfile-defined states and settings.</span></div>}</div><div className="binding-section"><div className="property-section-title">Add Binding</div>{[...profileStates, ...profileSettings].length === 0 ? <div className="binding-empty"><span className="empty-panel-icon">⌘</span><strong>No DeviceProfile runtime registry</strong><span>The active DeviceProfile declares no runtime states or settings, so no condition can be authored.</span></div> : <div className="binding-authoring"><label className="binding-field"><span>When</span><select aria-label="Binding state" value={bindingDraft.stateId} onChange={(event) => setBindingDraft((current) => ({ ...current, stateId: event.target.value }))}><option value="">Select state…</option>{[...profileStates, ...profileSettings].map((definition) => <option key={definition.id} value={definition.id}>{definition.displayName} ({definition.type})</option>)}</select></label><label className="binding-field"><span>Operator</span><select aria-label="Binding operator" value={bindingDraft.operator} onChange={(event) => setBindingDraft((current) => ({ ...current, operator: event.target.value }))}>{(bindingDraftDefinition ? operatorsForType(bindingDraftDefinition.type, bindingDraftDefinition.operators) : ["equals", "not-equals"]).map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label><label className="binding-field"><span>Value</span>{bindingDraftDefinition?.type === "boolean" ? <input type="checkbox" aria-label="Binding value" checked={bindingDraft.value === "true"} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.checked ? "true" : "false" }))} /> : bindingDraftDefinition?.type === "enum" ? <select aria-label="Binding value" value={bindingDraft.value} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.value }))}><option value="">Select value…</option>{(bindingDraftDefinition.enumValues ?? []).map((enumValue) => <option key={enumValue} value={enumValue}>{enumValue}</option>)}</select> : <input aria-label="Binding value" type={bindingDraftDefinition?.type === "integer" || bindingDraftDefinition?.type === "number" ? "number" : "text"} step={bindingDraftDefinition?.type === "number" ? "any" : "1"} value={bindingDraft.value} onChange={(event) => setBindingDraft((current) => ({ ...current, value: event.target.value }))} />}</label><label className="binding-field binding-field-check"><span>Negate</span><input type="checkbox" aria-label="Negate condition" checked={bindingDraft.negated} onChange={(event) => setBindingDraft((current) => ({ ...current, negated: event.target.checked }))} /></label><label className="binding-field"><span>Action</span><select aria-label="Binding action" value={bindingDraft.action} onChange={(event) => setBindingDraft((current) => ({ ...current, action: event.target.value }))}>{["show", "hide", "play", "pause", "stop", "restart", "continue", "select-content", "select-style"].map((action) => <option key={action} value={action}>{action}</option>)}</select></label><label className="binding-field"><span>Priority</span><select aria-label="Binding priority" value={String(bindingDraft.priority)} disabled={Boolean(bindingDraft.targetBindingId)} title={`Integer ${MIN_BINDING_PRIORITY}-${MAX_BINDING_PRIORITY}. Higher wins when several bindings match this widget. Independent of Scene priority.`} onChange={(event) => setBindingDraft((current) => ({ ...current, priority: Number(event.target.value) }))}>{Array.from({ length: MAX_BINDING_PRIORITY - MIN_BINDING_PRIORITY + 1 }, (_, offset) => MIN_BINDING_PRIORITY + offset).map((level) => <option key={level} value={level}>{level}</option>)}</select></label><label className="binding-field"><span>Match</span><select aria-label="Binding condition mode" value={bindingDraft.conditionMode} disabled={Boolean(bindingDraft.targetBindingId)} onChange={(event) => setBindingDraft((current) => ({ ...current, conditionMode: event.target.value as ConditionMode }))}><option value="all">All (AND)</option><option value="any">Any (OR)</option></select></label>{(bindingDraft.action === "select-content" || bindingDraft.action === "select-style") && <label className="binding-field"><span>Content Asset</span><select aria-label="Binding content asset" value={bindingDraft.contentId} disabled={project.assets.length === 0} title={project.assets.length === 0 ? "No asset is imported yet - use Asset Browser Import" : undefined} onChange={(event) => setBindingDraft((current) => ({ ...current, contentId: event.target.value }))}><option value="">{project.assets.length === 0 ? "No asset imported" : "Select asset..."}</option>{project.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} ({asset.mediaType})</option>)}</select></label>}<label className="binding-field"><span>Add to</span><select aria-label="Add condition to existing binding" value={bindingDraft.targetBindingId} onChange={(event) => setBindingDraft((current) => ({ ...current, targetBindingId: event.target.value }))}><option value="">New binding</option>{(bindingWidget?.bindings ?? []).map((binding) => <option key={binding.id} value={binding.id}>{binding.action} ({binding.conditions.length} condition{binding.conditions.length === 1 ? "" : "s"})</option>)}</select></label><button type="button" className="settings-button-primary" disabled={!bindingDraft.stateId || ((bindingDraft.action === "select-content" || bindingDraft.action === "select-style") && !bindingDraft.contentId && !bindingDraft.targetBindingId)} onClick={addBinding}>{bindingDraft.targetBindingId ? "Add Condition" : "Add Binding"}</button></div>}</div><div className="binding-section"><div className="property-section-title">DeviceProfile Registry</div><div className="binding-registry-grid"><div><strong>Runtime States</strong>{profileStates.length ? profileStates.map((state) => <span key={state.id}>{state.displayName}<small>{state.type}</small></span>) : <em>Empty registry</em>}</div><div><strong>Runtime Settings</strong>{profileSettings.length ? profileSettings.map((setting) => <span key={setting.id}>{setting.displayName}<small>{setting.type}</small></span>) : <em>Empty registry</em>}</div></div></div></div><footer className="settings-footer"><span>Positive/negative conditions and actions are constrained by the active DeviceProfile.</span><div><button type="button" autoFocus className="settings-button-primary" onClick={() => setBindingModal(null)}>Close</button></div></footer></section></div>}
      {settingsOpen && <div className="settings-backdrop" role="presentation"><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">APPLICATION PREFERENCES</span><h2 id="settings-title">Settings</h2></div><button type="button" className="panel-action" aria-label="Close Settings" onClick={cancelSettings}>×</button></header><div className="settings-layout"><nav className="settings-nav" aria-label="Settings categories">{settingsCategories.map((category) => <button key={category} type="button" className={settingsCategory === category ? "active" : ""} onClick={() => setSettingsCategory(category)}>{category}</button>)}</nav><div className="settings-content">{settingsContent[settingsCategory]}</div></div><footer className="settings-footer"><span>Program settings only · Project/Theme/Runtime settings stay in their canonical contexts.</span><div><button type="button" autoFocus className="settings-button-secondary" onClick={cancelSettings}>Cancel</button><button type="button" className="settings-button-primary" onClick={saveSettings}>Save / Apply &amp; Close</button></div></footer></section></div>}

      {newProjectDraft && <div className="settings-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="new-project-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">PROJECT</span><h2 id="new-project-title">New Project</h2></div></header><div className="confirm-body"><label className="dialog-field"><span>Project name</span><input autoFocus aria-label="New project name" value={newProjectDraft.name} onChange={(event) => setNewProjectDraft((current) => current ? { ...current, name: event.target.value } : current)} /></label><label className="dialog-field"><span>Device Profile</span><select aria-label="New project device profile" value={newProjectDraft.profileId} onChange={(event) => setNewProjectDraft((current) => current ? { ...current, profileId: event.target.value } : current)}>{availableProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} · {profile.display.width}×{profile.display.height}</option>)}</select></label><p className="dialog-note">The project is created with one Theme Project Group, one Theme Project and the canonical four Rotation / Form variants sized from the chosen display.</p></div><footer className="settings-footer"><div><button type="button" className="settings-button-secondary" onClick={() => setNewProjectDraft(null)}>Cancel</button><button type="button" className="settings-button-primary" onClick={confirmNewProject}>Create Project</button></div></footer></section></div>}

      {confirmState && <div className="settings-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onKeyDown={trapModalFocus}><header className="settings-header"><div><span className="panel-kicker">CONFIRMATION</span><h2 id="confirm-title">{confirmState.title}</h2></div></header><div className="confirm-body"><p>{confirmState.message}</p></div><footer className="settings-footer"><div><button type="button" autoFocus className="settings-button-secondary" onClick={() => setConfirmState(null)}>Cancel</button><button type="button" className="settings-button-primary" onClick={() => { const action = confirmState.onConfirm; setConfirmState(null); action(); }}>{confirmState.confirmLabel}</button></div></footer></section></div>}
    </div>
  );
}
