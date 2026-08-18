export type Id = string;

export type RotationAngle = 0 | 90 | 180 | 270;
export type RuntimeValueType = "boolean" | "integer" | "number" | "string" | "enum";
export type WidgetType = "background" | "text" | "image" | "video" | "direction" | "floor" | "media-slide";
export type MediaType = "image" | "video" | "audio" | "font";

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
  runtimeStates: readonly RuntimeStateDefinition[];
  runtimeSettings: readonly RuntimeSettingDefinition[];
}

export interface Condition {
  stateId: Id;
  operator: "equals" | "not-equals" | "greater-than" | "less-than" | "contains";
  value: string | number | boolean;
  priority: number;
}

export interface Binding {
  id: Id;
  widgetId: Id;
  condition: Condition;
  contentId?: Id;
}

export interface Widget {
  id: Id;
  name: string;
  widgetType: WidgetType;
  enabled: boolean;
  geometry: Geometry;
  zIndex: number;
  bindings: readonly Binding[];
  content?: Record<string, unknown>;
}

export interface Scene {
  id: Id;
  name: string;
  widgets: readonly Widget[];
  priority: number;
}

export interface Rotation {
  id: Id;
  angle: RotationAngle;
  width: number;
  height: number;
  scenes: readonly Scene[];
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
}

export interface FloorMapping {
  id: Id;
  entries: readonly FloorMappingEntry[];
}

export interface Theme {
  id: Id;
  name: string;
  rotations: readonly Rotation[];
  floorMapping?: FloorMapping;
}

export interface Project {
  id: Id;
  schemaVersion: number;
  name: string;
  deviceProfileId: Id;
  themes: readonly Theme[];
  assets: readonly Asset[];
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

export type DeploymentTargetKind = "sd-card" | "wifi";

export interface DeploymentTarget {
  id: Id;
  kind: DeploymentTargetKind;
  displayName: string;
}
