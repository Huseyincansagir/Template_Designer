import { describe, expect, it } from "vitest";
import type { Widget } from "../src/Domain/models";
import {
  canvasToScreen,
  containsPoint,
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

  it("chooses the nearest snap candidate and exposes a guide", () => {
    const candidate = { x: 13, y: 13, width: 20, height: 20 };
    const other = widget("target", { x: 34, y: 40, width: 20, height: 20 });
    const result = snapGeometryWithTargets(candidate, { enabled: true, gridSize: 10, threshold: 6 }, [other]);
    expect(result.geometry.x).toBe(14);
    expect(result.guides.some((guide) => guide.axis === "x" && guide.kind === "edge" && guide.widgetId === "target")).toBe(true);
  });
});
