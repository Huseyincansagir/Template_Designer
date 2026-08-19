import type { MediaType } from "../Domain/models";

/** Session-only editor preview. Never stored in the project or the package. */
export type AssetPreview = {
  readonly src: string;
  readonly poster?: string;
  readonly kind: "image" | "video" | "audio";
};

export function revokeAssetPreview(preview: AssetPreview | undefined): void {
  if (!preview) return;
  if (preview.src.startsWith("blob:")) URL.revokeObjectURL(preview.src);
}

function captureVideoPoster(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(undefined);
      return;
    }
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const finish = (poster?: string) => {
      video.removeAttribute("src");
      video.load();
      resolve(poster);
    };
    video.onerror = () => finish(undefined);
    video.onseeked = () => {
      try {
        if (!video.videoWidth || !video.videoHeight) {
          finish(undefined);
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          finish(undefined);
          return;
        }
        context.drawImage(video, 0, 0);
        finish(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finish(undefined);
      }
    };
    video.onloadeddata = () => {
      try {
        const mark = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(0.12, video.duration * 0.02) : 0;
        video.currentTime = mark;
      } catch {
        finish(undefined);
      }
    };
    video.src = src;
  });
}

export async function editorPreviewFromBlob(blob: Blob, mediaType?: MediaType): Promise<AssetPreview | undefined> {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return undefined;
  const src = URL.createObjectURL(blob);
  if (mediaType === "audio") return { src, kind: "audio" };
  if (mediaType === "video") {
    const poster = await captureVideoPoster(src);
    return { src, poster, kind: "video" };
  }
  if (mediaType === "image") return { src, kind: "image" };
  const mime = blob.type.toLowerCase();
  if (mime.startsWith("video/")) {
    const poster = await captureVideoPoster(src);
    return { src, poster, kind: "video" };
  }
  if (mime.startsWith("audio/")) return { src, kind: "audio" };
  return { src, kind: "image" };
}

export function displaySrcForPreview(preview: AssetPreview | undefined): string | undefined {
  if (!preview || preview.kind === "audio") return undefined;
  return preview.poster ?? preview.src;
}
