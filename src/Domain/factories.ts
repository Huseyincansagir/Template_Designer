import type { DeviceProfile, Project, Rotation, RotationAngle, ThemeProject, ThemeProjectGroup } from "./models";

/**
 * The Foundation Device Profile is the shipped demonstration profile. Its
 * runtime registries are profile-defined data (not hard-coded UI state), so
 * every profile-driven surface (Simulator, Binding evaluation, validation)
 * has real content to exercise against.
 */
export const foundationDeviceProfile: DeviceProfile = {
  id: "foundation-profile",
  name: "Foundation Device Profile",
  display: { width: 720, height: 1280 },
  supportedRotations: [0, 90, 180, 270],
  supportedWidgetTypes: ["media", "digit", "direction", "warning", "text"],
  supportedMediaTypes: ["image", "video", "audio"],
  supportedFormats: ["png", "jpg", "jpeg", "mp4", "mp3", "wav"],
  runtimeStates: [
    { id: "fire", displayName: "Fire", type: "boolean", category: "safety", simulator: true },
    { id: "floor", displayName: "Floor", type: "integer", category: "position", operators: ["equals", "not-equals", "greater-than", "less-than"], simulator: true },
    { id: "door_state", displayName: "Door State", type: "enum", category: "position", enumValues: ["closed", "opening", "opening-completed"], simulator: true },
    { id: "service_state", displayName: "Service State", type: "enum", category: "service", enumValues: ["normal", "service_out", "overload"], simulator: true },
  ],
  runtimeSettings: [
    { id: "language", displayName: "Language", type: "enum", enumValues: ["en", "tr"], defaultValue: "en", persistence: "persistent" },
  ],
  languages: ["en", "tr"],
  fonts: ["firmware-default"],
  digitStyles: ["digit-default"],
  defaultDigitStyleId: "digit-default",
  directionStyles: ["direction-default", "direction-up", "direction-down"],
  audioCapabilities: {
    supportsBackgroundMusic: true,
    supportsAnnouncement: true,
    supportsMediaAudio: true,
    supportsDucking: true,
    supportsOverride: true,
    maxPriority: 100,
  },
  videoCapabilities: {
    maxConcurrentDecode: 1,
    maxWidth: 1920,
    maxHeight: 1080,
    supportedCodecs: ["h264"],
  },
};

function newId(prefix: string): string {
  return `${prefix}-${typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

function rotationDimensions(display: DeviceProfile["display"], angle: RotationAngle): Pick<Rotation, "width" | "height"> {
  return angle === 90 || angle === 270
    ? { width: display.height, height: display.width }
    : { width: display.width, height: display.height };
}

/**
 * Canonical scaffold: a Theme Project must contain exactly the four
 * Rotation/Form variants R0, R90, R180 and R270 (DOMAIN_MODEL_V1 §Theme
 * Project). Dimensions are sourced from the DeviceProfile display, with the
 * R90/R270 width/height swap.
 */
export function createThemeProject(
  name = "New Theme Project",
  display: DeviceProfile["display"] = foundationDeviceProfile.display,
): ThemeProject {
  const angles: readonly RotationAngle[] = [0, 90, 180, 270];
  return {
    id: newId("theme"),
    name,
    rotations: angles.map((angle) => ({
      id: newId("rotation"),
      angle,
      ...rotationDimensions(display, angle),
      scenes: [],
    })),
    resources: [],
  };
}

export function createEmptyThemeProjectGroup(): ThemeProjectGroup {
  return {
    id: newId("theme-group"),
    name: "Untitled Theme Group",
    themeProjects: [createThemeProject()],
  };
}

/**
 * A new project boots into a canonically shaped hierarchy (one Theme Project
 * Group containing one Theme Project with all four required rotations) so the
 * editing loop — rotation → scene → widget — is immediately reachable.
 */
export function createEmptyProject(name = "Untitled Project"): Project {
  return {
    id: newId("project"),
    schemaVersion: 1,
    name,
    deviceProfileId: foundationDeviceProfile.id,
    themeProjectGroups: [createEmptyThemeProjectGroup()],
    assets: [],
    metadata: {},
  };
}
