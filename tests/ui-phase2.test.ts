import { describe, expect, it } from "vitest";
import { createDeviceProfileRegistry } from "../src/App/profile-registry";
import { activateDockedPanel, defaultPanelLayout, floatingPanels } from "../src/App/panel-manager";
import { intersects, normalizeRect, snapGeometry, updateWidgetGeometries } from "../src/App/canvas-interaction";
import { createEmptyProject, foundationDeviceProfile } from "../src/Domain/factories";

describe("UI Phase 2 foundations", () => {
  it("resolves profiles through the injected registry", () => {
    const registry = createDeviceProfileRegistry([foundationDeviceProfile]);
    expect(registry.get(foundationDeviceProfile.id)?.display).toEqual(foundationDeviceProfile.display);
    expect(registry.get("unknown-profile")).toBeUndefined();
    expect(registry.list()).toHaveLength(1);
  });

  it("keeps panel layout state separate and activates sibling dock tabs", () => {
    const next = activateDockedPanel(defaultPanelLayout, "assets");
    expect(next.assets).toBe("docked");
    expect(next.explorer).toBe("collapsed");
    expect(floatingPanels({ ...next, simulator: "floating" })).toEqual(["simulator"]);
  });

  it("normalizes marquee geometry, tests intersections and snaps widget geometry", () => {
    const marquee = normalizeRect({ x: 80, y: 90 }, { x: 10, y: 20 });
    expect(marquee).toEqual({ x: 10, y: 20, width: 70, height: 70 });
    expect(intersects(marquee, { x: 40, y: 40, width: 20, height: 20 })).toBe(true);
    expect(snapGeometry({ x: 13, y: 27, width: 42, height: 49 }, true, 10)).toEqual({ x: 10, y: 30, width: 40, height: 50 });
  });

  it("updates canonical widget geometry without changing unrelated nodes", () => {
    const project = createEmptyProject();
    const next = updateWidgetGeometries(project, { "missing-widget": { x: 10, y: 10, width: 20, height: 20 } });
    expect(next.themeProjectGroups).toEqual(project.themeProjectGroups);
    expect(next.id).toBe(project.id);
  });
});
