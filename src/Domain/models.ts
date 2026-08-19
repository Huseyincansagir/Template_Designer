export type Id = string;

export type RotationAngle = 0 | 90 | 180 | 270;
export type RuntimeValueType = "boolean" | "integer" | "number" | "string" | "enum";
export type PrimitiveValue = string | number | boolean;

// Semantic widget types are intentionally distinct from media types.
// DeviceProfile may expose additional semantic widget types in future profiles.
export type WidgetType =
  | "media"
  | "digit"
  | "direction"
  | "warning"
  | "text"
  | (string & {});

export type MediaType = "image" | "video" | "audio";
export type VisualMediaType = Exclude<MediaType, "audio">;
export type ConditionSource = "state" | "setting";
export type ConditionOperator =
  | "equals"
  | "not-equals"
  | "greater-than"
  | "less-than"
  | "contains";
export type ConditionMode = "all" | "any";

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeStateDefinition {
  id: Id;
  displayName: string;
  type: RuntimeValueType;
  category: string;
  description?: string;
  enumValues?: readonly string[];
  operators?: readonly ConditionOperator[];
  simulator: boolean;
}

export interface RuntimeSettingDefinition {
  id: Id;
  displayName: string;
  type: RuntimeValueType;
  enumValues?: readonly string[];
  operators?: readonly ConditionOperator[];
  options?: readonly string[];
  defaultValue?: PrimitiveValue;
  persistence?: "volatile" | "persistent";
  affectedCapabilities?: readonly string[];
}

export interface AudioCapabilities {
  channels?: readonly string[];
  supportsBackgroundMusic?: boolean;
  supportsAnnouncement?: boolean;
  supportsMediaAudio?: boolean;
  supportsDucking?: boolean;
  supportsOverride?: boolean;
  maxPriority?: number;
}

export interface VideoCapabilities {
  maxConcurrentDecode?: number;
  maxWidth?: number;
  maxHeight?: number;
  supportedCodecs?: readonly string[];
}

export interface DeviceProfile {
  id: Id;
  name: string;
  display: {
    width: number;
    height: number;
  };
  supportedRotations?: readonly RotationAngle[];
  supportedWidgetTypes: readonly WidgetType[];
  supportedMediaTypes: readonly MediaType[];
  supportedFormats?: readonly string[];
  runtimeStates: readonly RuntimeStateDefinition[];
  runtimeSettings: readonly RuntimeSettingDefinition[];
  languages?: readonly string[];
  fonts?: readonly string[];
  digitStyles?: readonly string[];
  defaultDigitStyleId?: Id;
  directionStyles?: readonly string[];
  defaultAssetIds?: readonly Id[];
  audioCapabilities?: AudioCapabilities;
  videoCapabilities?: VideoCapabilities;
}

export interface Condition {
  source?: ConditionSource;
  stateId: Id;
  operator: ConditionOperator;
  value: PrimitiveValue;
  negated?: boolean;
}

export interface Binding {
  id: Id;
  widgetId: Id;
  conditions: readonly Condition[];
  conditionMode?: ConditionMode;
  action:
    | "show"
    | "hide"
    | "play"
    | "pause"
    | "stop"
    | "restart"
    | "continue"
    | "select-content"
    | "select-style";
  contentId?: Id;
}

export interface MediaSlideContent {
  mediaType: VisualMediaType;
  assetId: Id;
  duration: number;
  loop?: boolean;
  repeatCount?: number;
  audioAssetId?: Id;
  volume?: number;
  continuePlayback?: boolean;
}

export interface Widget {
  id: Id;
  name: string;
  widgetType: WidgetType;
  enabled: boolean;
  visible: boolean;
  locked: boolean;
  geometry: Geometry;
  zIndex: number;
  bindings: readonly Binding[];
  assetIds?: readonly Id[];
  mediaType?: VisualMediaType;
  audioAssetId?: Id;
  mediaSlide?: MediaSlideContent;
  content?: Readonly<Record<string, unknown>>;
  style?: Readonly<Record<string, unknown>>;
}

export interface Scene {
  id: Id;
  name: string;
  widgets: readonly Widget[];
  priority: number;
  enabled?: boolean;
  activationConditions: readonly Condition[];
  activationConditionMode?: ConditionMode;
}

export interface Rotation {
  id: Id;
  angle: RotationAngle;
  width: number;
  height: number;
  scenes: readonly Scene[];
}

export interface FloorMappingEntry {
  firmwareValue: PrimitiveValue;
  displayValue: string;
  digitStyleId?: Id;
}

export interface FloorMapping {
  id: Id;
  entries: readonly FloorMappingEntry[];
}

export interface ThemeProject {
  id: Id;
  name: string;
  rotations: readonly Rotation[];
  resources: readonly Id[];
  defaultAssetIds?: readonly Id[];
  floorMappings?: readonly FloorMapping[];
  themeDefaults?: Readonly<Record<string, unknown>>;
}

export interface ThemeProjectGroup {
  id: Id;
  name: string;
  themeProjects: readonly ThemeProject[];
}

export interface Asset {
  id: Id;
  name: string;
  sourcePath: string;
  /**
   * Absent means the semantic type is not assigned yet. An imported file first
   * exists as a Resource with no type; it becomes usable once a type the active
   * DeviceProfile supports is chosen, and stays unassigned when the profile does
   * not support its format (WIDGET_SYSTEM_QUESTIONNAIRE_V1:225-233). Discarding
   * such a file at import instead would lose it silently.
   */
  mediaType?: MediaType;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface Project {
  id: Id;
  schemaVersion: number;
  name: string;
  deviceProfileId: Id;
  themeProjectGroups: readonly ThemeProjectGroup[];
  assets: readonly Asset[];
  defaultAssetIds?: readonly Id[];
  projectSettings?: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, string>>;
}

export interface RuntimeContext {
  values: Readonly<Record<Id, PrimitiveValue | null | undefined>>;
  settings?: Readonly<Record<Id, PrimitiveValue | null | undefined>>;
  /** Larger sequence means the Scene became active later at runtime. */
  sceneActivationOrder?: Readonly<Record<Id, number>>;
}

export interface RuntimeEvaluation {
  activeSceneId?: Id;
  activeScene?: Scene;
  candidates: readonly {
    sceneId: Id;
    priority: number;
    activationOrder: number;
    matched: boolean;
  }[];
}

export interface BindingEvaluation {
  bindingId: Id;
  widgetId: Id;
  matched: boolean;
  action: Binding["action"];
  contentId?: Id;
}

export interface PackageManifest {
  schemaVersion: number;
  packageId: Id;
  packageVersion: number;
  projectId: Id;
  projectName: string;
  deviceProfileId: Id;
  themeProjectIds: readonly Id[];
  resourceAssetIds: readonly Id[];
  usedAssetIds: readonly Id[];
  defaultAssetIds: readonly Id[];
  assetIds: readonly Id[];
}

export interface DeploymentFile {
  path: string;
  kind: "manifest" | "theme" | "layout" | "asset";
  content: string;
  assetId?: Id;
}

export interface DeploymentPackage {
  id: Id;
  schemaVersion: number;
  manifest: PackageManifest;
  files: readonly DeploymentFile[];
  projectId: Id;
  integrity: {
    algorithm: "sha256";
    checksum: string;
  };
  verified: boolean;
}

// V1 has SD Card as the deployment target. Additional transports remain future infrastructure.
export type DeploymentTargetKind = "sd-card";

export interface DeploymentTarget {
  id: Id;
  kind: DeploymentTargetKind;
  displayName: string;
}
