import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../src/App/app.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`));
  expect(match, `missing CSS rule ${selector}`).toBeTruthy();
  return match?.[1] ?? "";
}

describe("shell layout containment (UI-D-0024)", () => {
  it("clips the canvas column and zeros min-content on the stage", () => {
    const workspace = rule(".canvas-workspace");
    expect(workspace).toMatch(/overflow:\s*hidden/);
    expect(workspace).toMatch(/min-width:\s*0/);
    expect(workspace).toMatch(/isolation:\s*isolate/);

    const stage = rule(".canvas-stage");
    expect(stage).toMatch(/min-width:\s*0/);
    expect(stage).toMatch(/overflow:\s*hidden/);
  });

  it("sizes the device frame by max-width/max-height, not a definite 100% height", () => {
    const frame = rule(".device-frame");
    expect(frame).toMatch(/max-width:\s*calc\(100% - 24px\)/);
    expect(frame).toMatch(/max-height:\s*calc\(100% - 16px\)/);
    expect(frame).not.toMatch(/(?:^|;)\s*height:\s*calc\(/);
    const app = readFileSync(resolve(__dirname, "../src/App/App.tsx"), "utf8");
    expect(app).toContain("min(calc(100cqw - 24px), calc((100cqh - 16px) * ${canvasWidth} / ${canvasHeight}))");

    const wrap = rule(".device-canvas-wrap");
    expect(wrap).toMatch(/overflow:\s*hidden/);
    expect(wrap).toMatch(/min-width:\s*0/);
  });

  it("lets media snapshot faces fill the widget box", () => {
    expect(rule(".canvas-widget > .widget-render")).toMatch(/position:\s*absolute/);
    expect(rule(".canvas-widget > .widget-render")).toMatch(/inset:\s*0/);
    const mediaFace = rule(".canvas-widget img.media-face, .canvas-widget video.media-face");
    expect(mediaFace).toMatch(/object-fit:\s*cover/);
    expect(mediaFace).toMatch(/height:\s*100%/);
    expect(mediaFace).toMatch(/pointer-events:\s*auto/);
  });

  it("keeps docked Properties above leaked canvas content", () => {
    const panel = rule(".tool-panel");
    expect(panel).toMatch(/z-index:\s*2/);
    expect(panel).toMatch(/isolation:\s*isolate/);
    expect(panel).toMatch(/overflow:\s*hidden/);
  });
});
