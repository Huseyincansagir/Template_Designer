import { describe, expect, it } from "vitest";
import { displaySrcForPreview, type AssetPreview } from "../src/App/asset-preview";
import { pickedFromFiles } from "../src/Infrastructure/asset-import";

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
});
