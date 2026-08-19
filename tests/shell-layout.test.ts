import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../src/App/app.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    expect(frame).toMatch(/width:\s*auto/);
    expect(frame).toMatch(/height:\s*auto/);
    expect(frame).toMatch(/max-width:\s*calc\(100% - 24px\)/);
    expect(frame).toMatch(/max-height:\s*calc\(100% - 16px\)/);
    expect(frame).not.toMatch(/(?:^|;)\s*height:\s*calc\(/);

    const wrap = rule(".device-canvas-wrap");
    expect(wrap).toMatch(/overflow:\s*hidden/);
    expect(wrap).toMatch(/min-width:\s*0/);
  });

  it("keeps docked Properties above leaked canvas content", () => {
    const panel = rule(".tool-panel");
    expect(panel).toMatch(/z-index:\s*2/);
    expect(panel).toMatch(/isolation:\s*isolate/);
    expect(panel).toMatch(/overflow:\s*hidden/);
  });
});
