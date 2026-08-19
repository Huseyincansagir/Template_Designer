import { describe, expect, it } from "vitest";
import { chromium, type Page } from "playwright";

const APP = "http://127.0.0.1:1420/";

type Box = { left: number; top: number; right: number; bottom: number };

function overlapArea(a: Box, b: Box): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

async function serverUp(): Promise<boolean> {
  try {
    const response = await fetch(APP, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function leakIntoProperties(page: Page) {
  return page.evaluate(() => {
    const props = document.querySelector("[data-panel='properties']");
    const canvas = document.querySelector(".canvas-workspace");
    if (!props || !canvas) return { error: "missing-panels", offenders: [], gap: 0 };
    const pr = props.getBoundingClientRect();
    const offenders: { cls: string; x: number; y: number }[] = [];
    const visit = (el: Element) => {
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.right, pr.right) - Math.max(r.left, pr.left));
      const y = Math.max(0, Math.min(r.bottom, pr.bottom) - Math.max(r.top, pr.top));
      if (x > 1 && y > 1) {
        offenders.push({ cls: (el.className?.toString() ?? "").slice(0, 80), x: Math.round(x), y: Math.round(y) });
      }
      for (const child of el.children) visit(child);
    };
    visit(canvas);
    return {
      error: "",
      offenders,
      gap: Math.round(pr.left - canvas.getBoundingClientRect().right),
      properties: { left: pr.left, top: pr.top, right: pr.right, bottom: pr.bottom },
      canvas: (() => {
        const r = canvas.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      })(),
    };
  });
}

async function seedScene(page: Page) {
  await page.locator(".menu-bar .menu-button", { hasText: /^File$/ }).click();
  await page.getByRole("button", { name: /New Project/ }).click();
  await page.getByLabel("New project name").fill("Layout overlap");
  await page.getByRole("button", { name: "Create Project" }).click();
  await page.getByRole("button", { name: "+ Scene" }).click();
  const kit = page.getByRole("button", { name: "Display kit" });
  if (await kit.count()) await kit.click();
}

describe("live shell: canvas must not cover Properties", () => {
  it("keeps R0 and R90 device chrome out of the Properties dock at 1280×720", async () => {
    if (!(await serverUp())) {
      throw new Error("Vite is not running at 127.0.0.1:1420. Start `npm run dev` and re-run this test — a CSS read cannot prove overlap.");
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    try {
      await page.goto(APP, { waitUntil: "networkidle" });
      await page.waitForSelector(".app-shell");
      await seedScene(page);

      const portrait = await leakIntoProperties(page);
      expect(portrait.error, portrait.error).toBe("");
      expect(portrait.gap, "canvas column must sit left of Properties").toBeGreaterThanOrEqual(0);
      expect(portrait.offenders, `R0 leaked into Properties: ${JSON.stringify(portrait.offenders)}`).toEqual([]);
      expect(overlapArea(portrait.canvas, portrait.properties)).toBe(0);

      await page.getByRole("button", { name: "R90", exact: true }).click();
      await page.waitForTimeout(50);
      const landscape = await leakIntoProperties(page);
      expect(landscape.error).toBe("");
      expect(landscape.gap).toBeGreaterThanOrEqual(0);
      expect(landscape.offenders, `R90 leaked into Properties: ${JSON.stringify(landscape.offenders)}`).toEqual([]);
      expect(overlapArea(landscape.canvas, landscape.properties)).toBe(0);
    } finally {
      await context.close();
      await browser.close();
    }
  }, 60_000);
});
