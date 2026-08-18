export type Id = string;

export type RotationAngle = 0 | 90 | 180 | 270;
export type RuntimeValueType = "boolean" | "integer" | "number" | "string" | "enum";

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
  simulator: boolean;
}

export interface RuntimeSettingDefinition {
  id: Id;
  displayName: string;
  type: RuntimeValueType;
  options?: readonly string[];
  defaultValue?: string | number | boolean;
  persistence?: "volatile" | "persistent";
}

export interface DeviceProfile {
  id: Id;
  name: string;
  display: {
    width: number;
    height: number;
  };
  supportedWidgetTypes: readonly WidgetType[];
  supportedMediaTypes: readonly MediaType[];
  supportedFormats?: readonly string[];
  runtimeStates: readonly RuntimeStateDefinition[];
  runtimeSettings: readonly RuntimeSettingDefinition[];
  languages?: readonly string[];
  digitStyles?: readonly string[];
  directionStyles?: readonly string[];
  audioCapabilities?: Readonly<Record<string, unknown>>;
  videoCapabilities?: Readonly<Record<string, unknown>>;
}

export interface Condition {
  stateId: Id;
  operator: "equals" | "not-equals" | "greater-than" | "less-than" | "contains";
  value: string | number | boolean;
}

export interface Binding {
  id: Id;
  widgetId: Id;
  condition: Condition;
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
  content?: Readonly<Record<string, unknown>>;
  style?: Readonly<Record<string, unknown>>;
}

export interface Scene {
  id: Id;
  name: string;
  widgets: readonly Widget[];
  priority: number;
  activationConditions: readonly Condition[];
}

export interface Rotation {
  id: Id;
  angle: RotationAngle;
  width: number;
  height: number;
  scenes: readonly Scene[];
}

export interface ThemeProject {
  id: Id;
  name: string;
  rotations: readonly Rotation[];
  resources: readonly Id[];
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
  mediaType: MediaType;
  metadata?: Readonly<Record<string, string | number>>;
}

export interface FloorMappingEntry {
  firmwareValue: string | number;
  displayValue: string;
  digitStyleId?: Id;
}

export interface FloorMapping {
  id: Id;
  entries: readonly FloorMappingEntry[];
}

export interface Project {
  id: Id;
  schemaVersion: number;
  name: string;
  deviceProfileId: Id;
  themeProjectGroups: readonly ThemeProjectGroup[];
  assets: readonly Asset[];
  projectSettings?: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, string>>;
}

export interface DeploymentPackage {
  id: Id;
  schemaVersion: number;
  manifest: Readonly<Record<string, string>>;
  projectId: Id;
  integrity?: {
    algorithm: "sha256";
    checksum: string;
  };
}

// V1 has SD Card as the deployment target. Additional transports remain future infrastructure.
export type DeploymentTargetKind = "sd-card";

export interface DeploymentTarget {
  id: Id;
  kind: DeploymentTargetKind;
  displayName: string;
}
