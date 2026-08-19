import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createDeviceProfileRegistry } from "../src/App/profile-registry";
import { activateDockedPanel, defaultPanelLayout, defaultPanelLayoutForViewport, floatingPanels } from "../src/App/panel-manager";
import { intersects, normalizeRect, snapGeometry } from "../src/App/canvas-interaction";
import { foundationDeviceProfile } from "../src/Domain/factories";

describe("UI Phase 2 foundations", () => {
  it("resolves profiles through the injected registry", () => {
    const registry = createDeviceProfileRegistry([foundationDeviceProfile]);
    expect(registry.get(foundationDeviceProfile.id)?.display).toEqual(foundationDeviceProfile.display);
    expect(registry.get("unknown-profile")).toBeUndefined();
    expect(registry.list()).toHaveLength(1);
  });

  it("keeps panel layout state separate and docks panels without destroying siblings", () => {
    const next = activateDockedPanel(defaultPanelLayout, "assets");
    expect(next.assets).toBe("docked");
    expect(next.explorer).toBe("docked"); // real tab stack: the sibling stays docked
    expect(floatingPanels({ ...next, simulator: "floating" })).toEqual(["simulator"]);
  });

  it("normalizes marquee geometry, tests intersections and snaps widget geometry", () => {
    const marquee = normalizeRect({ x: 80, y: 90 }, { x: 10, y: 20 });
    expect(marquee).toEqual({ x: 10, y: 20, width: 70, height: 70 });
    expect(intersects(marquee, { x: 40, y: 40, width: 20, height: 20 })).toBe(true);
    expect(snapGeometry({ x: 13, y: 27, width: 42, height: 49 }, true, 10)).toEqual({ x: 10, y: 30, width: 40, height: 50 });
  });

  it("ships a profile with real runtime registries for the Simulator surfaces", () => {
    expect(foundationDeviceProfile.runtimeStates.length).toBeGreaterThan(0);
    expect(foundationDeviceProfile.runtimeSettings.length).toBeGreaterThan(0);
  });

  it("collapses the console at 1280×720 so the device frame keeps height", () => {
    expect(defaultPanelLayoutForViewport(1280, 720).console).toBe("collapsed");
    expect(defaultPanelLayoutForViewport(1920, 1080).console).toBe("docked");
  });

  it("imports OS files on Explorer, Assets and Theme Resources and refuses canvas drop", () => {
    const app = readFileSync(resolve("src/App/App.tsx"), "utf8");
    expect(app).toContain("handleShellDrop");
    expect(app).toContain("Canvas is not an import target");
    expect(app).toContain("data-theme-resources");
    expect(app).toContain("data-node-id");
    expect(app).not.toMatch(/acceptedExtensions:\s*activeProfile/);
    expect(app).toContain("title={node.detail");
  });

  it("assigns the flexible row of the canvas workspace to the device stage", () => {
    const css = readFileSync(resolve(__dirname, "../src/App/app.css"), "utf8");
    expect(css).toMatch(/\.canvas-workspace\s*\{[^}]*grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)\s+auto/);
    const app = readFileSync(resolve(__dirname, "../src/App/App.tsx"), "utf8");
    expect(app).toContain("renderEditorChrome()");
    expect(app).not.toContain("renderCanvasNavigator()");
    expect(app).toContain("data-testid=\"canvas-stage\"");
    expect(app).toContain("deploy-dialog");
    expect(app).not.toContain("SDCardTarget");
    expect(app).not.toContain("writePackage");
    expect(app).toContain("placeWidgetType");
    expect(app).toContain("addDisplayKit");
    expect(app).toContain("enterPlaceMode");
    expect(app).toContain("assetPreviews");
    expect(app).toContain("activatePanel(\"simulator\")");
  });
});
