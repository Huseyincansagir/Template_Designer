import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = dirname(fileURLToPath(import.meta.url));
const project = JSON.parse(readFileSync(join(root, "en81-cabin.tdproj.json"), "utf8"));
const files = {
  [project.assets.find((a) => a.name === "Kabin arka plan").id]: { path: join(root, "arkaplan.png"), mime: "image/png", kind: "image" },
  [project.assets.find((a) => a.name === "Yangın işareti").id]: { path: join(root, "yangin.jpg"), mime: "image/jpeg", kind: "image" },
  [project.assets.find((a) => a.name === "Girilmez işareti").id]: { path: join(root, "girilmez.jpg"), mime: "image/jpeg", kind: "image" },
  [project.assets.find((a) => a.name === "Aşırı yük işareti").id]: { path: join(root, "asiri-yuk.jpg"), mime: "image/jpeg", kind: "image" },
  [project.assets.find((a) => a.name === "Deprem işareti").id]: { path: join(root, "deprem.jpg"), mime: "image/jpeg", kind: "image" },
  [project.assets.find((a) => a.name === "Kabin video").id]: { path: join(root, "kabin.jpg"), mime: "image/jpeg", kind: "video" },
};

const records = Object.entries(files).map(([assetId, spec]) => ({
  assetId,
  kind: spec.kind,
  mime: spec.mime,
  b64: readFileSync(spec.path).toString("base64"),
}));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(({ json, session }) => {
  localStorage.setItem("template-designer.project.v1", json);
  localStorage.removeItem("template-designer.session.v1");
}, { json: JSON.stringify(project), session: null });

const page = await context.newPage();
await page.goto("http://127.0.0.1:1420/", { waitUntil: "networkidle" });
await page.waitForSelector(".app-shell");

await page.evaluate(async ({ projectId, records }) => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open("template-designer.editor-previews.v1", 1);
    request.onupgradeneeded = () => {
      const next = request.result;
      if (!next.objectStoreNames.contains("previews")) {
        const store = next.createObjectStore("previews", { keyPath: ["projectId", "assetId"] });
        store.createIndex("projectId", "projectId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const tx = db.transaction("previews", "readwrite");
  const store = tx.objectStore("previews");
  for (const record of records) {
    const binary = Uint8Array.from(atob(record.b64), (char) => char.charCodeAt(0));
    store.put({
      projectId,
      assetId: record.assetId,
      kind: record.kind,
      mime: record.mime,
      blob: new Blob([binary], { type: record.mime }),
    });
  }
  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}, { projectId: project.id, records });

await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector(".app-shell");
const title = await page.locator(".document-tab-main span").first().textContent();
const scenes = await page.locator(".scene-tab").count();
console.log("loaded", title, "scene tabs", scenes);
await page.screenshot({ path: join(root, "preview-r0.png") });
await page.getByRole("button", { name: "R90", exact: true }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: join(root, "preview-r90.png") });
await browser.close();
