import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../src/Domain/factories";
import { createEditorApplication } from "../src/Core/editor-application";
import { InMemoryDocumentStore } from "../src/Core/document-store";
import type { Project, Widget } from "../src/Domain/models";
import { calculateAlignUpdates, calculateDistributeUpdates,
  calculateNudgeStep,
  calculateZOrderUpdates,
  canvasToScreen,
  detectKeyboardPlatform,
  containsPoint,
  exceedsPointerDragThreshold,
  getCanvasViewFrame,
  getBounds,
  hitTest,
  intersects,
  isCanonicalModifier,
  isCanvasKeyboardExcludedTarget,
  marqueeSelection,
  normalizeRect,
  orderSelectionIds,
  resizeGeometry,
  screenToCanvas,
  snapGeometry,
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

  it("uses the same centered frame for horizontal and vertical letterboxing", () => {
    const horizontal = getCanvasViewFrame({ left: 0, top: 0, width: 1000, height: 400 }, { zoom: 1, pan: { x: 0, y: 0 }, sceneWidth: 500, sceneHeight: 250 });
    expect(horizontal).toEqual({ x: 100, y: 0, width: 800, height: 400, scale: 1.6 });
    const vertical = getCanvasViewFrame({ left: 0, top: 0, width: 800, height: 1000 }, { zoom: 1, pan: { x: 0, y: 0 }, sceneWidth: 500, sceneHeight: 250 });
    expect(vertical).toEqual({ x: 0, y: 300, width: 800, height: 400, scale: 1.6 });
  });

  it("round-trips scene points at zoom 2 and zoom 0.5 with fractional pan", () => {
    const viewport = { left: 15, top: 25, width: 901, height: 733 };
    const point = { x: 173.25, y: 492.75 };
    for (const zoom of [2, 0.5]) {
      const transform = { zoom, pan: { x: 12.5, y: -7.25 }, sceneWidth: 720, sceneHeight: 1280 };
      const screen = canvasToScreen(point, viewport, transform);
      expect(screenToCanvas(screen, viewport, transform).x).toBeCloseTo(point.x, 10);
      expect(screenToCanvas(screen, viewport, transform).y).toBeCloseTo(point.y, 10);
    }
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
    expect(marqueeSelection(widgets, marquee, { mode: "intersect" })).toEqual(["touching"]);
  });

  it("implements intersect marquee only and rejects contains and unknown modes explicitly", () => {
    const widgets = [
      widget("contained", { x: 10, y: 10, width: 20, height: 20 }),
      widget("partial", { x: 25, y: 10, width: 20, height: 20 }),
      widget("corner", { x: 30, y: 30, width: 10, height: 10 }),
      widget("base", { x: 80, y: 80, width: 10, height: 10 }),
    ];
    const marquee = { x: 10, y: 10, width: 20, height: 20 };
    expect(marqueeSelection(widgets, marquee)).toEqual(["contained", "partial", "corner"]);
    expect(marqueeSelection(widgets, { x: 0, y: 0, width: 10, height: 10 }, { mode: "intersect" })).toEqual(["contained"]);
    expect(marqueeSelection(widgets, marquee, { baseSelection: ["base"], additive: true })).toEqual(["contained", "partial", "corner", "base"]);
    expect(() => marqueeSelection(widgets, marquee, { mode: "contains" })).toThrow(RangeError);
    expect(() => marqueeSelection(widgets, marquee, { mode: "unsupported" as "intersect" })).toThrow(RangeError);
  });

  it("resizes from every direction without negative dimensions", () => {
    const initial = { x: 20, y: 30, width: 40, height: 50 };
    expect(resizeGeometry(initial, "n", { x: 0, y: 10 })).toEqual({ x: 20, y: 40, width: 40, height: 40 });
    expect(resizeGeometry(initial, "e", { x: 10, y: 0 })).toEqual({ x: 20, y: 30, width: 50, height: 50 });
    expect(resizeGeometry(initial, "s", { x: 0, y: 10 })).toEqual({ x: 20, y: 30, width: 40, height: 60 });
    expect(resizeGeometry(initial, "w", { x: 10, y: 0 })).toEqual({ x: 30, y: 30, width: 30, height: 50 });
    expect(resizeGeometry(initial, "se", { x: 10, y: 20 })).toEqual({ x: 20, y: 30, width: 50, height: 70 });
    expect(resizeGeometry(initial, "nw", { x: 10, y: 10 })).toEqual({ x: 30, y: 40, width: 30, height: 40 });
    expect(resizeGeometry(initial, "ne", { x: 10, y: 10 })).toEqual({ x: 20, y: 40, width: 50, height: 40 });
    expect(resizeGeometry(initial, "sw", { x: 10, y: 10 })).toEqual({ x: 30, y: 30, width: 30, height: 60 });
    expect(resizeGeometry(initial, "se", { x: 100, y: 100 })).toEqual({ x: 20, y: 30, width: 140, height: 150 });
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
    expect(calculateNudgeStep(12, { shift: false, modifier: false })).toBe(12);
    expect(calculateNudgeStep(12, { shift: false, modifier: true })).toBe(1.2);
    expect(calculateNudgeStep(12, { shift: true, modifier: true })).toBe(60);
    expect(calculateNudgeStep(12, { shift: false, modifier: true, alt: true })).toBeNull();
    expect(snapGeometry({ x: 13, y: 25, width: 24, height: 26 }, true, 12)).toEqual({ x: 12, y: 24, width: 24, height: 24 });
  });

  it("rejects ambiguous and wrong-platform Mod combinations instead of degrading to plain Arrow", () => {
    // Windows/Linux: Ctrl = Mod. Meta alone, or Ctrl+Meta together, must not move.
    expect(calculateNudgeStep(10, { shift: false, modifier: true, ctrlKey: true, metaKey: false, platform: "windows" })).toBe(1);
    expect(calculateNudgeStep(10, { shift: false, modifier: false, ctrlKey: false, metaKey: true, platform: "windows" })).toBeNull();
    expect(calculateNudgeStep(10, { shift: false, modifier: false, ctrlKey: true, metaKey: true, platform: "windows" })).toBeNull();
    // macOS: Meta = Mod. Ctrl alone must not move.
    expect(calculateNudgeStep(10, { shift: false, modifier: false, ctrlKey: false, metaKey: true, platform: "mac" })).toBe(1);
    expect(calculateNudgeStep(10, { shift: false, modifier: false, ctrlKey: true, metaKey: false, platform: "mac" })).toBeNull();
    expect(calculateNudgeStep(10, { shift: true, modifier: false, ctrlKey: true, metaKey: true, platform: "mac" })).toBeNull();
  });

  it("applies the §4.2 pan × fitScale term in the view frame", () => {
    const viewport = { left: 0, top: 0, width: 1000, height: 1000 };
    const frame = getCanvasViewFrame(viewport, { zoom: 2, pan: { x: 10, y: -5 }, sceneWidth: 500, sceneHeight: 500 });
    expect(frame).toEqual({ x: -460, y: -520, width: 2000, height: 2000, scale: 4 });
    const noPan = getCanvasViewFrame({ left: 0, top: 0, width: 1000, height: 400 }, { zoom: 1, pan: { x: 25, y: 0 }, sceneWidth: 500, sceneHeight: 250 });
    expect(noPan).toEqual({ x: 140, y: 0, width: 800, height: 400, scale: 1.6 });
  });

  it("snaps east/south resize handles through the moving edge", () => {
    const candidate = { x: 10, y: 10, width: 20, height: 20 };
    const target = widget("target", { x: 40, y: 100, width: 20, height: 20 });
    const result = snapGeometryWithTargets(candidate, { enabled: true, gridSize: 10, threshold: 6 }, [target], { x: true, y: true });
    // End x = 30 snaps to grid 30 (distance 0) and end y = 30 is beyond threshold of any target → width changes, height unchanged.
    expect(result.geometry.x).toBe(10);
    expect(result.geometry.width).toBe(20);
    expect(result.geometry.height).toBe(20);
    const gridOnly = snapGeometryWithTargets({ x: 10, y: 10, width: 26, height: 26 }, { enabled: true, gridSize: 10, threshold: 6 }, [], { x: true, y: true });
    expect(gridOnly.geometry).toEqual({ x: 10, y: 10, width: 30, height: 30 });
  });

  it("normalizes platform Mod semantics without treating both modifiers as interchangeable", () => {
    expect(detectKeyboardPlatform("MacIntel")).toBe("mac");
    expect(detectKeyboardPlatform("Win32")).toBe("windows");
    expect(detectKeyboardPlatform("Linux x86_64")).toBe("linux");
    expect(isCanonicalModifier({ metaKey: true, ctrlKey: false }, "mac")).toBe(true);
    expect(isCanonicalModifier({ metaKey: false, ctrlKey: true }, "mac")).toBe(false);
    expect(isCanonicalModifier({ metaKey: false, ctrlKey: true }, "windows")).toBe(true);
    expect(isCanonicalModifier({ metaKey: true, ctrlKey: false }, "linux")).toBe(false);
    expect(isCanvasKeyboardExcludedTarget({ tagName: "input" })).toBe(true);
    expect(isCanvasKeyboardExcludedTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isCanvasKeyboardExcludedTarget({ tagName: "select" })).toBe(true);
    expect(isCanvasKeyboardExcludedTarget({ tagName: "div", isContentEditable: true })).toBe(true);
    expect(isCanvasKeyboardExcludedTarget({ tagName: "div", isContentEditable: false })).toBe(false);
  });

  it("excludes invisible widgets from hit acquisition while retaining them in bounds-capable data", () => {
    const widgets = [
      widget("visible", { x: 0, y: 0, width: 40, height: 40 }, { zIndex: 1 }),
      widget("invisible", { x: 0, y: 0, width: 40, height: 40 }, { visible: false, zIndex: 2 }),
    ];
    expect(hitTest({ x: 20, y: 20 }, widgets)).toBe("visible");
    expect(marqueeSelection(widgets, { x: 0, y: 0, width: 40, height: 40 }, { mode: "intersect" })).toEqual(["visible"]);
    expect(getBounds(widgets.map((candidate) => candidate.geometry))).toEqual({ x: 0, y: 0, width: 40, height: 40 });
  });

  it("applies the six-unit snap threshold and grid pass priority", () => {
    const target = widget("target", { x: 20, y: 100, width: 20, height: 20 });
    expect(snapGeometryWithTargets({ x: 94.01, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(100);
    expect(snapGeometryWithTargets({ x: 94, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(100);
    expect(snapGeometryWithTargets({ x: 93.99, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 100, threshold: 6 }, [target]).geometry.x).toBe(93.99);
    expect(snapGeometryWithTargets({ x: 13, y: 0, width: 10, height: 10 }, { enabled: true, gridSize: 10, threshold: 6 }, [widget("edge", { x: 14, y: 100, width: 10, height: 10 })]).geometry.x).toBe(10);
  });

  it("calculates all four deterministic z-order operations through normalized renumbering", () => {
    const widgets = [
      widget("back", { x: 0, y: 0, width: 10, height: 10 }, { zIndex: 10 }),
      widget("middle", { x: 20, y: 0, width: 10, height: 10 }, { zIndex: 20 }),
      widget("front", { x: 40, y: 0, width: 10, height: 10 }, { zIndex: 30 }),
    ];
    // Renumbering normalizes the whole stack (back 10→0, middle 20→1,
    // front 30→2) and then applies the requested swap.
    expect(calculateZOrderUpdates(widgets, "middle", "bring-forward")).toEqual({ back: 0, middle: 2, front: 1 });
    expect(calculateZOrderUpdates(widgets, "middle", "send-backward")).toEqual({ back: 1, middle: 0, front: 2 });
    expect(calculateZOrderUpdates(widgets, "middle", "bring-to-front")).toEqual({ back: 0, middle: 2, front: 1 });
    expect(calculateZOrderUpdates(widgets, "middle", "send-to-back")).toEqual({ middle: 0, back: 1, front: 2 });
    expect(calculateZOrderUpdates(widgets, "front", "bring-forward")).toBeNull();
    expect(calculateZOrderUpdates(widgets, "back", "send-backward")).toBeNull();
  });

  it("normalizes equal-z stacks without leapfrogging and respects locks", () => {
    const tied = [
      widget("a", { x: 0, y: 0, width: 10, height: 10 }, { zIndex: 5 }),
      widget("b", { x: 10, y: 0, width: 10, height: 10 }, { zIndex: 5 }),
      widget("c", { x: 20, y: 0, width: 10, height: 10 }, { zIndex: 5 }),
    ];
    // Doc order a, b, c → stacking a(0), b(1), c(2); bring-forward b swaps with c only.
    expect(calculateZOrderUpdates(tied, "b", "bring-forward")).toEqual({ a: 0, b: 2, c: 1 });
    const locked = [
      widget("a", { x: 0, y: 0, width: 10, height: 10 }, { zIndex: 0 }),
      widget("b", { x: 10, y: 0, width: 10, height: 10 }, { zIndex: 1, locked: true }),
    ];
    expect(calculateZOrderUpdates(locked, "b", "bring-to-front")).toBeNull();
    // A locked sibling keeps its zIndex while the unlocked widget renumbers around it.
    expect(calculateZOrderUpdates(locked, "a", "bring-to-front")).toEqual({ a: 1 });
  });

  it("rejects malformed geometry at the application mutation boundary", () => {
    const project = projectWithTwoScenes();
    const { store, editor } = setupEditor(project);
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
      expect(editor.setWidgetGeometriesInScene("scene-a", { w1: geometry }).changed).toBe(false);
    }
    expect(store.getCurrent()).toEqual(project);
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
    expect(duplicateEditor.setWidgetGeometriesInScene("scene-a", { w1: valid }).changed).toBe(false);
  });
});

describe("Alignment and distribution (D4-21)", () => {
  const box = (id: string, x: number, y: number, width = 40, height = 20) => ({ id, geometry: { x, y, width, height } });

  it("aligns to the selection bounding box without resizing", () => {
    const widgets = [box("a", 0, 0, 40, 20), box("b", 100, 50, 60, 30)];
    const left = calculateAlignUpdates(widgets, "left");
    expect(left).toEqual({ b: { x: 0, y: 50, width: 60, height: 30 } });
    const right = calculateAlignUpdates(widgets, "right");
    // Bounding box right edge is 160; a keeps its size and moves to 120.
    expect(right).toEqual({ a: { x: 120, y: 0, width: 40, height: 20 } });
    const top = calculateAlignUpdates(widgets, "top");
    expect(top).toEqual({ b: { x: 100, y: 0, width: 60, height: 30 } });
    const bottom = calculateAlignUpdates(widgets, "bottom");
    expect(bottom).toEqual({ a: { x: 0, y: 60, width: 40, height: 20 } });
    // Every operation preserves width and height.
    for (const updates of [left, right, top, bottom]) {
      for (const [id, geometry] of Object.entries(updates ?? {})) {
        const original = widgets.find((widget) => widget.id === id);
        expect(geometry.width).toBe(original?.geometry.width);
        expect(geometry.height).toBe(original?.geometry.height);
      }
    }
  });

  it("centres on the bounding box midline and rounds to whole scene units", () => {
    const widgets = [box("a", 0, 0, 40, 20), box("b", 0, 0, 61, 21)];
    const centred = calculateAlignUpdates(widgets, "horizontal-center");
    // Bounding box is 61 wide, so a moves to (61-40)/2 = 10.5 -> 11 (rounded).
    expect(centred?.a.x).toBe(11);
    expect(Number.isInteger(centred?.a.x)).toBe(true);
    const middled = calculateAlignUpdates(widgets, "vertical-middle");
    expect(Number.isInteger(middled?.a.y)).toBe(true);
  });

  it("refuses an alignment that would change nothing and needs two widgets", () => {
    expect(calculateAlignUpdates([box("a", 0, 0)], "left")).toBeNull();
    // Already flush left.
    expect(calculateAlignUpdates([box("a", 10, 0), box("b", 10, 40)], "left")).toBeNull();
  });

  it("distributes with equal edge-to-edge gaps and fixed outer widgets", () => {
    const widgets = [box("a", 0, 0, 20, 10), box("b", 35, 0, 20, 10), box("c", 100, 0, 20, 10)];
    const updates = calculateDistributeUpdates(widgets, "horizontal");
    // Span 0..120 = 120, occupied 60, so each of the two gaps is 30.
    expect(updates).toEqual({ b: { x: 50, y: 0, width: 20, height: 10 } });
    const positions = [0, updates?.b.x ?? 35, 100];
    expect(positions[1] - (positions[0] + 20)).toBe(30);
    expect(positions[2] - (positions[1] + 20)).toBe(30);
  });

  it("refuses distribution that cannot preserve the outer widgets", () => {
    expect(calculateDistributeUpdates([box("a", 0, 0), box("b", 10, 0)], "horizontal")).toBeNull();
    // Three 40-wide widgets inside a 60-wide span cannot be spread.
    expect(calculateDistributeUpdates([box("a", 0, 0, 40, 10), box("b", 5, 0, 40, 10), box("c", 20, 0, 40, 10)], "horizontal")).toBeNull();
  });

  it("distributes vertically on the same rules", () => {
    const widgets = [box("a", 0, 0, 10, 20), box("b", 0, 30, 10, 20), box("c", 0, 100, 10, 20)];
    const updates = calculateDistributeUpdates(widgets, "vertical");
    expect(updates).toEqual({ b: { x: 0, y: 50, width: 10, height: 20 } });
  });
});
