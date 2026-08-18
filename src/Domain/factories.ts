import type { DeviceProfile, Project, ThemeProjectGroup } from "./models";

export const foundationDeviceProfile: DeviceProfile = {
  id: "foundation-profile",
  name: "Foundation Device Profile",
  display: { width: 720, height: 1280 },
  supportedRotations: [0, 90, 180, 270],
  supportedWidgetTypes: ["media", "digit", "direction", "warning", "text"],
  supportedMediaTypes: ["image", "video", "audio"],
  supportedFormats: [],
  runtimeStates: [],
  runtimeSettings: [],
  languages: [],
  digitStyles: [],
  directionStyles: [],
};

export function createEmptyThemeProjectGroup(): ThemeProjectGroup {
  return {
    id: "theme-group-foundation",
    name: "Untitled Theme Group",
    themeProjects: [],
  };
}

export function createEmptyProject(name = "Untitled Project"): Project {
  return {
    id: "project-foundation",
    schemaVersion: 1,
    name,
    deviceProfileId: foundationDeviceProfile.id,
    themeProjectGroups: [createEmptyThemeProjectGroup()],
    assets: [],
    metadata: {},
  };
}
