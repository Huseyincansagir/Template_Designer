import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../src/Domain/factories";
import { createEditorApplication } from "../src/Core/editor-application";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import type { Project, Widget } from "../src/Domain/models";
import {
  calculateNudgeStep,
  calculateZOrderUpdates,
  canvasToScreen,
  containsPoint,
  exceedsPointerDragThreshold,
  getBounds,
  hitTest,
  intersects,
  marqueeSelection,
  normalizeRect,
  orderSelectionIds,
  resizeGeometry,
  screenToCanvas,
  snapGeometryWithTargets,
  transformGeometryWithinBounds,
} from "../src/App/canvas-interaction";

function widget(id: string, geometry: Widget["geometry"], overrides: Partial<Widget> = {}): Widget {
  return {
    id,
    name: id,
    widgetType: "text",
    enabled: true,
    visible: true,
    locked: false,
    geometry,
    zIndex: 0,
    bindings: [],
    ...overrides,
  };
}

describe("Canvas interaction foundation", () => {
  it("round-trips screen and Canvas coordinates with aspect-ratio letterboxing", () => {
    const viewport = { left: 100, top: 50, width: 1000, height: 800 };
    const transform = { zoom: 1, pan: { x: 0, y: 0 }, sceneWidth: 500, sceneHeight: 250 };
    const sceneCenter = { x: 250, y: 125 };
    const screenCenter = canvasToScreen(sceneCenter, viewport, transform);
    expect(screenCenter).toEqual({ x: 600, y: 450 });
    expect(screenToCanvas(screenCenter, viewport, transform)).toEqual(sceneCenter);
  });

  it("accounts for zoom and pan in the centralized conversion model", () => {
    const viewport = { left: 0, top: 0, width: 1000, height: 1000 };
    const transform = { zoom: 2, pan: { x: 10, y: -5 }, sceneWidth: 500, sceneHeight: 500 };
    const point = { x: 125, y: 220 };
    expect(screenToCanvas(canvasToScreen(point, viewport, transform), viewport, transform)).toEqual(point);
  });

  it("uses inclusive hit-test boundaries and topmost z-order", () => {
    const widgets = [
      widget("bottom", { x: 10, y: 10, width: 50, height: 50 }, { zIndex: 1 }),
      widget("top", { x: 20, y: 20, width: 50, height: 50 }, { zIndex: 2 }),
    ];
    expect(containsPoint(widgets[0].geometry, { x: 10, y: 10 })).toBe(true);
    expect(hitTest({ x: 25, y: 25 }, widgets)).toBe("top");
    expect(hitTest({ x: 200, y: 200 }, widgets)).toBeNull();
  });

  it("uses later Scene document order for equal z-order", () => {
    const widgets = [
      widget("first", { x: 0, y: 0, width: 30, height: 30 }),
      widget("second", { x: 0, y: 0, width: 30, height: 30 }),
    ];
    expect(hitTest({ x: 10, y: 10 }, widgets)).toBe("second");
  });

  it("keeps selection unique and ordered by Scene document order", () => {
    const widgets = [widget("a", { x: 0, y: 0, width: 10, height: 10 }), widget("b", { x: 20, y: 0, width: 10, height: 10 })];
    expect(orderSelectionIds(widgets, ["b", "a", "b"])).toEqual(["a", "b"]);
  });

  it("selects inclusive marquee intersections and excludes hidden/disabled widgets", () => {
    const widgets = [
      widget("touching", { x: 20, y: 20, width: 10, height: 10 }),
      widget("hidden", { x: 30, y: 30, width: 10, height: 10 }, { visible: false }),
      widget("disabled", { x: 30, y: 30, width: 10, height: 10 }, { enabled: false }),
    ];
    const marquee = normalizeRect({ x: 0, y: 0 }, { x: 20, y: 30 });
    expect(intersects(marquee, widgets[0].geometry)).toBe(true);
    expect(marqueeSelection(widgets, marquee)).toEqual(["touching"]);
  });

  it("resizes from every direction without negative dimensions", () => {
    const initial = { x: 20, y: 30, width: 40, height: 50 };
    expect(resizeGeometry(initial, "se", { x: 10, y: 20 })).toEqual({ x: 20, y: 30, width: 50, height: 70 });
    expect(resizeGeometry(initial, "nw", { x: 100, y: 100 })).toEqual({ x: 50, y: 70, width: 10, height: 10 });
  });

  it("transforms multi-selection geometry through a bounding-box resize", () => {
    const initialBounds = getBounds([
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 50, y: 40, width: 10, height: 10 },
    ]);
    expect(initialBounds).toEqual({ x: 10, y: 10, width: 50, height: 40 });
    expect(transformGeometryWithinBounds({ x: 50, y: 40, width: 10, height: 10 }, initialBounds!, { x: 10, y: 10, width: 100, height: 80 })).toEqual({ x: 90, y: 70, width: 20, height: 20 });
  });

  it("uses snap pass priority and exposes the winning guide", () => {
    const candidate = { x: 13, y: 13, width: 20, height: 20 };
    const other = widget("target", { x: 14, y: 40, width: 20, height: 20 });
    const result = snapGeometryWithTargets(candidate, { enabled: true, gridSize: 10, threshold: 6 }, [other]);
    expect(result.geometry.x).toBe(10);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.kind === "grid")).toBe(true);
  });
});


describe("Canvas canonical remediation regressions", () => {
  function projectWithTwoScenes(): Project {
    const base = createEmptyProject("Canvas Fixture");
    const sceneA = {
      id: "scene-a",
      name: "Scene A",
      widgets: [widget("w1", { x: 10, y: 10, width: 40, height: 20 }, { zIndex: 10 }), widget("w2", { x: 80, y: 10, width: 40, height: 20 }, { zIndex: 20 })],
      priority: 0,
      activationConditions: [],
    };
    const sceneB = {
      id: "scene-b",
      name: "Scene B",
      widgets: [widget("other", { x: 10, y: 10, width: 40, height: 20 }, { zIndex: 0 })],
      priority: 1,
      activationConditions: [],
    };
    return {
      ...base,
      themeProjectGroups: [{
        ...base.themeProjectGroups[0],
        themeProjects: [{
          id: "theme-fixture",
          name: "Theme Fixture",
          resources: [],
          rotations: [{ id: "rotation-fixture", angle: 0, width: 720, height: 1280, scenes: [sceneA, sceneB] }],
        }],
      }],
    };
  }

  function setupEditor(project: Project) {
    const store = new InMemoryDocumentStore();
    store.open(project);
    return { store, editor: createEditorApplication(store) };
  }

  it("treats 3.99 and 4 CSS px as click, and only 4.01 as drag", () => {
    expect(exceedsPointerDragThreshold(3.99)).toBe(false);
    expect(exceedsPointerDragThreshold(4)).toBe(false);
    expect(exceedsPointerDragThreshold(4.01)).toBe(true);
  });

  it("uses canonical nudge modifiers and leaves Shift+Arrow unbound", () => {
    expect(calculateNudgeStep(10, { shift: false, modifier: false })).toBe(10);
    expect(calculateNudgeStep(10, { shift: false, modifier: true })).toBe(1);
    expect(calculateNudgeStep(10, { shift: true, modifier: true })).toBe(50);
    expect(calculateNudgeStep(10, { shift: true, modifier: false })).toBeNull();
  });

  it("excludes invisible widgets from hit acquisition while retaining them in bounds-capable data", () => {
    const widgets = [
      widget("visible", { x: 0, y: 0, width: 40, height: 40 }, { zIndex: 1 }),
      widget("invisible", { x: 0, y: 0, width: 40, height: 40 }, { visible: false, zIndex: 2 }),
    ];
    expect(hitTest({ x: 20, y: 20 }, widgets)).toBe("visible");
    expect(marqueeSelection(widgets, { x: 0, y: 0, width: 40, height: 40 })).toEqual(["visible"]);
    expect(getBounds(widgets.map((candidate) => candidate.geometry))).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("applies the six-unit snap threshold and grid pass priority", () => {
    const target = widget("target", { x: 20, y: 100, width: 20, height: 20 });
    expect(snapGeometryWithTargets({ x: 94.01, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(100);
    expect(snapGeometryWithTargets({ x: 94, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(100);
    expect(snapGeometryWithTargets({ x: 93.99, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(93.99);
    expect(snapGeometryWithTargets({ x: 13, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 10, threshold: 6 }, [widget("edge", { x: 14, y: 100, width: 10, height: 10 })]).geometry.x).toBe(10);
  });

  it("calculates all four deterministic z-order operations", () => {
    const widgets = [
      widget("back", { x: 0, y: 0, width: 10, height: 10 }, { zIndex: 10 }),
      widget("middle", { x: 20, y: 0, width: 10, height: 10 }, { zIndex: 20 }),
      widget("front", { x: 40, y: 0, width: 10, height: 10 }, { zIndex: 30 }),
    ];
    expect(calculateZOrderUpdates(widgets, "middle", "bring-forward")).toEqual({ middle: 30, front: 20 });
    expect(calculateZOrderUpdates(widgets, "middle", "send-backward")).toEqual({ middle: 10, back: 20 });
    expect(calculateZOrderUpdates(widgets, "middle", "bring-to-front")).toEqual({ middle: 31 });
    expect(calculateZOrderUpdates(widgets, "middle", "send-to-back")).toEqual({ middle: 9 });
  });

  it("rejects malformed geometry at the application mutation boundary", () => {
    const { store, editor } = setupEditor(projectWithTwoScenes());
    const valid = { x: 10, y: 10, width: 40, height: 20 };
    const malformed = [
      { ...valid, x: Number.NaN },
      { ...valid, y: Number.POSITIVE_INFINITY },
      { ...valid, width: -1 },
      { ...valid, height: -1 },
      { ...valid, width: 0 },
      { ...valid, height: 0 },
    ];
    for (const geometry of malformed) {
      expect(editor.setWidgetGeometries({ w1: geometry }).changed).toBe(false);
      expect(editor.setWidgetGeometriesInScene("scene-a", { w1: geometry }).changed).toBe(false);
    }
    expect(store.getCurrent()).toEqual(projectWithTwoScenes());
    expect(store.undo()).toBe(false);
  });

  it("rejects wrong-scene, missing-widget, and duplicate-ID scoped mutations", () => {
    const project = projectWithTwoScenes();
    const { editor } = setupEditor(project);
    const valid = { x: 12, y: 12, width: 42, height: 22 };
    expect(editor.setWidgetGeometriesInScene("wrong-scene", { w1: valid }).changed).toBe(false);
    expect(editor.setWidgetGeometriesInScene("scene-a", { missing: valid }).changed).toBe(false);

    const duplicateProject: Project = {
      ...project,
      themeProjectGroups: project.themeProjectGroups.map((group) => ({
        ...group,
        themeProjects: group.themeProjects.map((theme) => ({
          ...theme,
          rotations: theme.rotations.map((rotation) => ({
            ...rotation,
            scenes: rotation.scenes.map((scene) => scene.id === "scene-b" ? { ...scene, widgets: [widget("w1", { x: 0, y: 0, width: 20, height: 20 })] } : scene),
          })),
        })),
      })),
    };
    const { editor: duplicateEditor } = setupEditor(duplicateProject);
    expect(duplicateEditor.setWidgetGeometries({ w1: valid }).changed).toBe(false);
    expect(duplicateEditor.setWidgetGeometriesInScene("scene-a", { w1: valid }).changed).toBe(false);
  });
});
