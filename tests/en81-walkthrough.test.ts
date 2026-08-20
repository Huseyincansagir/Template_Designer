import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { chromium, type Page } from "playwright";

const APP = "http://127.0.0.1:1420/";
const shots = resolve(__dirname, "../qa-live");

async function serverUp(): Promise<boolean> {
  try {
    const response = await fetch(APP, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function openCabinExample(page: Page): Promise<void> {
  await page.goto(`${APP}?t=${Date.now()}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  await page.locator(".menu-bar .menu-button", { hasText: /^File$/ }).click();
  await page.getByRole("button", { name: "Open EN 81 Cabin Example" }).click();
  const confirm = page.getByRole("button", { name: "Discard & Open" });
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => (document.querySelector(".document-tab-main")?.textContent ?? "").includes("EN 81"), { timeout: 15_000 });
}

function simControl(page: Page, label: RegExp) {
  return page.locator(".sim-input-row").filter({ hasText: label });
}

async function shot(page: Page, name: string): Promise<void> {
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: resolve(shots, name), fullPage: true });
}

describe("EN 81 cabin walkthrough", () => {
  it("plays the cabin video and verifies each scene and simulator input", async () => {
    if (!(await serverUp())) {
      throw new Error("Vite is not running at 127.0.0.1:1420. Start `npm run dev`.");
    }
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    await context.addInitScript(() => localStorage.clear());
    const page = await context.newPage();
    try {
      await openCabinExample(page);

      const video = page.locator("video.media-face").first();
      await video.waitFor({ state: "visible", timeout: 20_000 });
      const playback = await video.evaluate(async (node: HTMLVideoElement) => {
        if (node.readyState < 2) {
          await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error("video loadeddata timeout")), 12_000);
            node.addEventListener("loadeddata", () => { window.clearTimeout(timer); resolve(); }, { once: true });
            node.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error(node.error?.message ?? "video error")); }, { once: true });
          });
        }
        try {
          await node.play();
        } catch (error) {
          return { error: String(error), paused: node.paused, duration: node.duration, ready: node.readyState, width: node.videoWidth, height: node.videoHeight, t0: 0, t1: 0 };
        }
        const t0 = node.currentTime;
        await new Promise((resolve) => window.setTimeout(resolve, 900));
        return {
          error: "",
          paused: node.paused,
          duration: node.duration,
          ready: node.readyState,
          width: node.videoWidth,
          height: node.videoHeight,
          t0,
          t1: node.currentTime,
        };
      });
      expect(playback.error, `video play failed: ${JSON.stringify(playback)}`).toBe("");
      expect(playback.duration, `duration ${playback.duration}`).toBeGreaterThan(2);
      expect(playback.paused, `paused after play ${JSON.stringify(playback)}`).toBe(false);
      expect(playback.t1, `currentTime did not advance ${JSON.stringify(playback)}`).toBeGreaterThan(playback.t0);
      expect(playback.width).toBeGreaterThan(200);
      expect(playback.height).toBeGreaterThan(100);
      await shot(page, "walk-01-seyir-playing.png");

      const seyahFaces = await page.evaluate(() => {
        const videoBox = document.querySelector("video.media-face")?.getBoundingClientRect();
        const digits = [...document.querySelectorAll(".digit-face")].map((img) => ({ h: img.getBoundingClientRect().height, alt: (img as HTMLImageElement).alt }));
        const arrows = [...document.querySelectorAll(".arrow-face")].map((img) => ({ h: img.getBoundingClientRect().height, alt: (img as HTMLImageElement).alt }));
        return { videoH: videoBox?.height ?? 0, digits, arrows };
      });
      expect(seyahFaces.videoH).toBeGreaterThan(80);
      expect(seyahFaces.digits.some((digit) => digit.h > 20)).toBe(true);
      expect(seyahFaces.arrows.some((arrow) => arrow.h > 20)).toBe(true);

      await page.getByRole("button", { name: "Simulator" }).first().click();
      expect(await page.locator(".mode-button.active", { hasText: "Preview" }).count()).toBeGreaterThan(0);
      await page.getByLabel("Simulator floor").selectOption("5");
      await simControl(page, /^Direction/).locator("select").selectOption("down");
      await page.waitForTimeout(300);
      const floor5 = await page.evaluate(() => ({
        digits: [...document.querySelectorAll(".digit-face")].map((img) => (img as HTMLImageElement).alt),
        arrows: [...document.querySelectorAll(".arrow-face")].map((img) => (img as HTMLImageElement).alt),
        rail: document.querySelector(".canvas-rail-label")?.textContent ?? "",
      }));
      expect(floor5.digits).toContain("5");
      expect(floor5.arrows).toContain("down");
      expect(floor5.rail).toMatch(/PREVIEW · Seyir/i);
      await shot(page, "walk-02-sim-floor5-down.png");

      await simControl(page, /^Fire/).locator("input[type=checkbox]").check();
      await page.getByRole("button", { name: "Evaluate" }).click();
      await page.waitForTimeout(300);
      const fire = await page.evaluate(() => ({
        rail: document.querySelector(".canvas-rail-label")?.textContent ?? "",
        warning: [...document.querySelectorAll(".widget-render-text.is-warning")].map((node) => node.textContent ?? ""),
        images: [...document.querySelectorAll("img.media-face")].map((img) => img.getBoundingClientRect().height),
        active: document.querySelector(".active-scene-card strong")?.textContent ?? "",
      }));
      expect(fire.rail).toMatch(/Yangın/i);
      expect(fire.active).toMatch(/Yangın/i);
      expect(fire.warning.some((text) => /YANGIN|FIRE/i.test(text))).toBe(true);
      expect(Math.max(0, ...fire.images)).toBeGreaterThan(40);
      await shot(page, "walk-03-yangin.png");

      await simControl(page, /^Fire/).locator("input[type=checkbox]").uncheck();
      await simControl(page, /^Service State/).locator("select").selectOption("overload");
      await page.getByRole("button", { name: "Evaluate" }).click();
      await page.waitForTimeout(300);
      const overload = await page.evaluate(() => ({
        rail: document.querySelector(".canvas-rail-label")?.textContent ?? "",
        warning: [...document.querySelectorAll(".widget-render-text.is-warning")].map((node) => node.textContent ?? ""),
        active: document.querySelector(".active-scene-card strong")?.textContent ?? "",
      }));
      expect(overload.rail).toMatch(/Aşırı yük|OVERLOAD/i);
      expect(overload.active).toMatch(/Aşırı yük/i);
      expect(overload.warning.some((text) => /AŞIRI|OVERLOAD/i.test(text))).toBe(true);
      await shot(page, "walk-04-asiri-yuk.png");

      await simControl(page, /^Service State/).locator("select").selectOption("service_out");
      await page.getByRole("button", { name: "Evaluate" }).click();
      await page.waitForTimeout(300);
      const out = await page.evaluate(() => ({
        rail: document.querySelector(".canvas-rail-label")?.textContent ?? "",
        warning: [...document.querySelectorAll(".widget-render-text.is-warning")].map((node) => node.textContent ?? ""),
        active: document.querySelector(".active-scene-card strong")?.textContent ?? "",
      }));
      expect(out.rail).toMatch(/Girilmez/i);
      expect(out.active).toMatch(/Girilmez/i);
      expect(out.warning.some((text) => /GİRİLMEZ|DO NOT ENTER|OUT OF SERVICE|SERVİS/i.test(text))).toBe(true);
      await shot(page, "walk-05-girilmez.png");

      await page.locator(".sim-button", { hasText: /^Reset$/ }).click();
      await page.getByRole("button", { name: "R90", exact: true }).click();
      await page.locator(".mode-button", { hasText: /^Design$/ }).click();
      await page.getByRole("tab", { name: "Properties" }).click();
      await page.locator("video.media-face").first().waitFor({ state: "visible", timeout: 10_000 });
      const landscape = await page.evaluate(() => {
        const frame = document.querySelector(".device-frame")?.getBoundingClientRect();
        const props = document.querySelector("[data-panel='properties']")?.getBoundingClientRect();
        const videoBox = document.querySelector("video.media-face")?.getBoundingClientRect();
        const overlap = frame && props
          ? Math.max(0, Math.min(frame.right, props.right) - Math.max(frame.left, props.left)) * Math.max(0, Math.min(frame.bottom, props.bottom) - Math.max(frame.top, props.top))
          : -1;
        return {
          frameW: frame?.width ?? 0,
          frameH: frame?.height ?? 0,
          videoW: videoBox?.width ?? 0,
          videoH: videoBox?.height ?? 0,
          overlap,
          title: document.querySelector(".canvas-rail-label")?.textContent ?? "",
        };
      });
      expect(landscape.frameW).toBeGreaterThan(landscape.frameH);
      expect(landscape.videoW).toBeGreaterThan(40);
      expect(landscape.overlap).toBe(0);
      await shot(page, "walk-06-r90.png");

      await page.getByRole("tab", { name: "Assets" }).click();
      await page.waitForSelector(".asset-list .asset-thumb img", { timeout: 10_000 });
      await page.waitForFunction(() => [...document.querySelectorAll(".asset-thumb img")].filter((img) => (img as HTMLImageElement).naturalWidth > 0).length > 8, { timeout: 10_000 });
      const thumbs = await page.evaluate(() => [...document.querySelectorAll(".asset-thumb img")].map((img) => ({
        nw: (img as HTMLImageElement).naturalWidth,
        w: img.getBoundingClientRect().width,
      })));
      expect(thumbs.filter((thumb) => thumb.nw > 0 && thumb.w > 8).length).toBeGreaterThan(8);
      await shot(page, "walk-07-assets.png");
    } finally {
      await context.close();
      await browser.close();
    }
  }, 90_000);
});
