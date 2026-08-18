import type { DeviceProfile, Project, Theme } from "./models";

export const foundationDeviceProfile: DeviceProfile = {
  id: "foundation-profile",
  name: "Foundation Device Profile",
  display: { width: 720, height: 1280 },
  supportedWidgetTypes: ["background", "text", "image", "video", "direction", "floor", "media-slide"],
  supportedMediaTypes: ["image", "video", "audio", "font"],
  runtimeStates: [],
  runtimeSettings: [],
};

export function createEmptyTheme(): Theme {
  return {
    id: "theme-foundation",
    name: "Untitled Theme",
    rotations: [],
  };
}

export function createEmptyProject(name = "Untitled Project"): Project {
  return {
    id: "project-foundation",
    schemaVersion: 1,
    name,
    deviceProfileId: foundationDeviceProfile.id,
    themes: [createEmptyTheme()],
    assets: [],
    metadata: {},
  };
}
