import { describe, expect, it } from "vitest";
import { dataUrlToBlob, displaySrcForPreview, storedPreviewRecord, type AssetPreview } from "../src/App/asset-preview";
import { pickedFromFiles } from "../src/Infrastructure/asset-import";
import { MemoryEditorPreviewStore } from "../src/Infrastructure/editor-preview-store";

describe("editor asset previews", () => {
  it("prefers a video poster over the raw blob URL", () => {
    const preview: AssetPreview = { src: "blob:video", poster: "data:image/jpeg;base64,xx", kind: "video" };
    expect(displaySrcForPreview(preview)).toBe("data:image/jpeg;base64,xx");
  });

  it("uses the blob URL for still images and nothing for audio", () => {
    expect(displaySrcForPreview({ src: "blob:image", kind: "image" })).toBe("blob:image");
    expect(displaySrcForPreview({ src: "blob:audio", kind: "audio" })).toBeUndefined();
    expect(displaySrcForPreview(undefined)).toBeUndefined();
  });

  it("keeps the File blob next to the logical draft on import", () => {
    const file = new File(["fake-png"], "logo.png", { type: "image/png" });
    const picked = pickedFromFiles([file], { sourcePrefix: "assets" });
    expect(picked).toHaveLength(1);
    expect(picked[0]?.draft.name).toBe("logo");
    expect(picked[0]?.draft.mediaType).toBe("image");
    expect(picked[0]?.blob).toBe(file);
  });

  it("round-trips a data URL into a typed blob", async () => {
    const blob = dataUrlToBlob("data:image/png;base64,aGVsbG8=");
    expect(blob?.type).toBe("image/png");
    expect(await blob?.text()).toBe("hello");
  });

  it("stores original image bytes and a video poster, never audio", () => {
    const png = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    const image = storedPreviewRecord("p1", "a1", { src: "blob:x", kind: "image" }, png);
    expect(image).toMatchObject({ projectId: "p1", assetId: "a1", kind: "image", mime: "image/png" });
    expect(image?.blob).toBe(png);

    const poster = "data:image/jpeg;base64,aGVsbG8=";
    const video = storedPreviewRecord("p1", "a2", { src: "blob:v", poster, kind: "video" }, new Blob(["mp4"], { type: "video/mp4" }));
    expect(video?.kind).toBe("video");
    expect(video?.mime).toBe("image/jpeg");
    expect(storedPreviewRecord("p1", "a3", { src: "blob:a", kind: "audio" }, new Blob(["wav"]))).toBeUndefined();
  });
});

describe("editor preview store", () => {
  it("keeps snapshots per project and restores only requested assets", async () => {
    const store = new MemoryEditorPreviewStore();
    const alpha = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    await store.put({ projectId: "p1", assetId: "logo", kind: "image", mime: "image/png", blob: alpha });
    await store.put({ projectId: "p1", assetId: "loop", kind: "video", mime: "image/jpeg", blob: new Blob(["jpg"], { type: "image/jpeg" }) });
    await store.put({ projectId: "p2", assetId: "logo", kind: "image", mime: "image/png", blob: new Blob(["other"]) });

    const forP1 = await store.getForProject("p1", ["logo", "missing"]);
    expect(forP1).toHaveLength(1);
    expect(forP1[0]?.assetId).toBe("logo");
    expect(forP1[0]?.blob).toBe(alpha);

    expect((await store.get("p2", "logo"))?.blob).not.toBe(alpha);
    await store.delete("p1", ["logo"]);
    expect(await store.get("p1", "logo")).toBeUndefined();
    expect(await store.get("p1", "loop")).toBeDefined();
  });
});
