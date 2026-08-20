import { describe, expect, it } from "vitest";
import { chromium } from "playwright";

const APP = "http://127.0.0.1:1420/";

async function serverUp(): Promise<boolean> {
  try {
    const response = await fetch(APP, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

describe("live EN 81 cabin snapshots", () => {
  it("opens the example and paints media faces on the device", async () => {
    if (!(await serverUp())) {
      throw new Error("Vite is not running at 127.0.0.1:1420. Start `npm run dev`.");
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    try {
      await page.goto(`${APP}?t=${Date.now()}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".app-shell");
      await page.locator(".menu-bar .menu-button", { hasText: /^File$/ }).click();
      await page.getByRole("button", { name: "Open EN 81 Cabin Example" }).click();
      const confirm = page.getByRole("button", { name: "Discard & Open" });
      if (await confirm.count()) await confirm.click();
      await page.waitForTimeout(2000);

      const video = page.locator("video.media-face").first();
      await video.waitFor({ state: "visible", timeout: 20_000 });
      const playback = await video.evaluate(async (node: HTMLVideoElement) => {
        try { await node.play(); } catch { /* autoplay may already be running */ }
        const t0 = node.currentTime;
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        return { paused: node.paused, t0, t1: node.currentTime, duration: node.duration, w: node.videoWidth };
      });
      expect(playback.duration).toBeGreaterThan(2);
      expect(playback.paused).toBe(false);
      expect(playback.t1).toBeGreaterThan(playback.t0);
      expect(playback.w).toBeGreaterThan(200);

      const seyah = await page.evaluate(() => {
        const faces = [...document.querySelectorAll(".canvas-widget img.media-face, .canvas-widget video.media-face")].map((el) => {
          const r = el.getBoundingClientRect();
          const img = el as HTMLImageElement;
          return { w: r.width, h: r.height, nw: img.naturalWidth || (el as HTMLVideoElement).videoWidth || 0 };
        });
        const frame = document.querySelector(".device-frame")?.getBoundingClientRect();
        const stage = document.querySelector("[data-testid='canvas-stage']")?.getBoundingClientRect();
        return {
          faces,
          frameH: frame?.height ?? 0,
          stageH: stage?.height ?? 0,
          title: document.querySelector(".document-tab-main")?.textContent ?? "",
        };
      });
      expect(seyah.title).toMatch(/EN 81/);
      expect(seyah.frameH).toBeGreaterThan(seyah.stageH * 0.45);
      expect(seyah.faces.some((face) => face.h > 40 && face.nw > 0), `Seyir faces: ${JSON.stringify(seyah.faces)}`).toBe(true);

      await page.getByRole("tab", { name: /Yangın/ }).click();
      await page.waitForTimeout(300);
      const fire = await page.evaluate(() => [...document.querySelectorAll(".canvas-widget img.media-face")].map((img) => img.getBoundingClientRect().height));
      expect(Math.max(0, ...fire), `Yangın face heights ${JSON.stringify(fire)}`).toBeGreaterThan(40);

      await page.getByRole("button", { name: "Seyir" }).first().click();
      await page.getByRole("button", { name: "Simulator" }).first().click();
      await page.waitForTimeout(400);
      const previewOn = await page.locator(".mode-button.active", { hasText: "Preview" }).count();
      expect(previewOn, "Simulator must switch the canvas to Preview").toBeGreaterThan(0);
      await page.getByLabel("Simulator floor").selectOption("5");
      await page.waitForTimeout(200);
      const digits = await page.evaluate(() => [...document.querySelectorAll(".digit-face")].map((img) => ({
        h: img.getBoundingClientRect().height,
        alt: (img as HTMLImageElement).alt,
      })));
      expect(digits.some((digit) => digit.h > 20 && digit.alt === "5"), `digit faces ${JSON.stringify(digits)}`).toBe(true);
      const arrows = await page.evaluate(() => [...document.querySelectorAll(".arrow-face")].map((img) => img.getBoundingClientRect().height));
      expect(Math.max(0, ...arrows), `arrow faces ${JSON.stringify(arrows)}`).toBeGreaterThan(20);

      await page.locator(".sim-input-row").filter({ hasText: /^Fire/ }).locator("input[type=checkbox]").check();
      await page.getByRole("button", { name: "Evaluate" }).click();
      await page.waitForTimeout(300);
      const fireScene = await page.evaluate(() => document.querySelector(".canvas-rail-label")?.textContent ?? "");
      expect(fireScene).toMatch(/Yangın|FIRE|PREVIEW/i);
      const fireText = await page.locator(".widget-render-text.is-warning").first().textContent();
      expect(fireText ?? "").toMatch(/YANGIN|FIRE/i);
    } finally {
      await context.close();
      await browser.close();
    }
  }, 60_000);
});
