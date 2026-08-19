import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isLoadableProject } from "../src/Infrastructure/project-storage";
import { parseProjectFile } from "../src/Infrastructure/project-file";

const fixture = resolve(__dirname, "../docs/fixtures/en81-cabin/en81-cabin.tdproj.json");

describe("EN 81 cabin fixture", () => {
  it("is a complete four-rotation Theme Project with EN 81 scenes", () => {
    const parsed = parseProjectFile(readFileSync(fixture, "utf8"));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(isLoadableProject(parsed.project)).toBe(true);
    const theme = parsed.project.themeProjectGroups[0]?.themeProjects[0];
    expect(theme?.name).toBe("EN 81 Kabin");
    expect(theme?.rotations.map((rotation) => rotation.angle)).toEqual([0, 90, 180, 270]);
    expect(theme?.rotations[0]).toMatchObject({ width: 720, height: 1280 });
    expect(theme?.rotations[1]).toMatchObject({ width: 1280, height: 720 });
    for (const rotation of theme?.rotations ?? []) {
      const names = rotation.scenes.map((scene) => scene.name);
      expect(names).toEqual(["Seyir", "Yangın", "Aşırı yük", "Girilmez", "Deprem"]);
      expect(rotation.scenes.find((scene) => scene.name === "Deprem")?.enabled).toBe(false);
      expect(rotation.scenes.find((scene) => scene.name === "Yangın")?.activationConditions[0]).toMatchObject({ stateId: "fire", value: true });
      expect(rotation.scenes.find((scene) => scene.name === "Aşırı yük")?.activationConditions[0]).toMatchObject({ stateId: "service_state", value: "overload" });
      expect(rotation.scenes.find((scene) => scene.name === "Girilmez")?.activationConditions[0]).toMatchObject({ stateId: "service_state", value: "service_out" });
      const types = new Set(rotation.scenes[0]?.widgets.map((widget) => widget.widgetType));
      expect(types.has("media")).toBe(true);
      expect(types.has("digit")).toBe(true);
      expect(types.has("direction")).toBe(true);
    }
    expect(parsed.project.assets.length).toBeGreaterThanOrEqual(16);
    expect(parsed.project.assets.some((asset) => asset.name === "digit-8")).toBe(true);
    expect(parsed.project.assets.some((asset) => asset.name === "arrow-up")).toBe(true);
  });
});
