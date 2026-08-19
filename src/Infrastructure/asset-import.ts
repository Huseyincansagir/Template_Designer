import type { MediaType } from "../Domain/models";
import type { AssetDraft } from "../Core/editor-application";

/**
 * Platform-neutral asset import boundary.
 *
 * The V1 deployment package carries a *logical* asset record, not media bytes
 * (`Core/export.ts` emits `*.asset.json` with `binary: false`, and AGENTS.md
 * puts binary materialization in the deployment adapter). So importing an
 * asset means registering that logical record: a display name, a source path
 * the deployment adapter can later resolve, a media type and metadata.
 *
 * The UI depends only on this interface. The browser build implements it with
 * a file input; the Tauri desktop build can implement the same interface with
 * a native dialog that yields real absolute paths, without any UI change.
 */
export type PickedAsset = {
  readonly draft: AssetDraft;
  /** Session bytes for editor snapshots. Not part of the project document. */
  readonly blob?: Blob;
};

export interface AssetImportSource {
  /** Human-readable name of the transport, shown to the user so the mechanism is never implied. */
  readonly kind: "browser-file-input" | "native-dialog";
  /** Resolves with picked logical records (and session blobs), or an empty array when the user cancels. */
  pick(options?: AssetPickOptions): Promise<readonly PickedAsset[]>;
}

export type AssetPickOptions = {
  /** File extensions the active DeviceProfile supports, e.g. ["png","mp4"]. */
  readonly acceptedExtensions?: readonly string[];
  /** Directory prefix recorded in `sourcePath` so the deployment adapter can resolve it later. */
  readonly sourcePrefix?: string;
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "avi", "mkv", "webm"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "aac", "flac", "m4a"];

export function extensionOf(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/**
 * Media type is derived from the file itself (MIME first, extension second),
 * never guessed from the UI context: a designer who imports an mp3 into an
 * image slot must get an audio asset and a validation message, not a silently
 * mislabelled record.
 */
export function inferMediaType(fileName: string, mimeType?: string): MediaType | undefined {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  const extension = extensionOf(fileName);
  if (IMAGE_EXTENSIONS.includes(extension)) return "image";
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
  return undefined;
}

/** Strips the extension for the default display name; the stable ID is unrelated. */
export function displayNameOf(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "");
  const withoutExtension = base.replace(/\.[A-Za-z0-9]+$/, "");
  return (withoutExtension.trim() || base.trim()) || "Asset";
}

type PickedFileLike = {
  readonly name: string;
  readonly type?: string;
  readonly size?: number;
  /** Non-standard Chromium/Electron field; present only in some shells. */
  readonly path?: string;
};

/**
 * Converts a picked file into a logical asset record. Exported so the same
 * rules are testable without a DOM and reused by every import source.
 */
export function draftsFromFiles(files: ReadonlyArray<PickedFileLike>, options: AssetPickOptions = {}): readonly AssetDraft[] {
  return files.map((file) => toAssetDraft(file, options));
}

export function pickedFromFiles(files: ReadonlyArray<File>, options: AssetPickOptions = {}): readonly PickedAsset[] {
  return files.map((file) => ({ draft: toAssetDraft(file, options), blob: file }));
}

export function isFileDrag(dataTransfer: { types?: Iterable<string> } | null | undefined): boolean {
  if (!dataTransfer?.types) return false;
  return Array.from(dataTransfer.types).includes("Files");
}

export function toAssetDraft(file: PickedFileLike, options: AssetPickOptions = {}): AssetDraft {
  // A file whose media type cannot be inferred is still imported, with no type
  // assigned. Silently dropping it lost the file and contradicted
  // WIDGET_SYSTEM_QUESTIONNAIRE_V1:225-233, which requires the resource to
  // exist first and receive its semantic type afterwards (F7c).
  const mediaType = inferMediaType(file.name, file.type);
  const prefix = options.sourcePrefix?.replace(/[\\/]+$/, "");
  const relative = file.name.replace(/^.*[\\/]/, "");
  const sourcePath = file.path && file.path.trim().length > 0
    ? file.path
    : prefix
      ? `${prefix}/${relative}`
      : relative;
  return {
    name: displayNameOf(file.name),
    sourcePath,
    ...(mediaType ? { mediaType } : {}),
    metadata: {
      originalFileName: relative,
      contentType: file.type ?? "",
      sizeBytes: typeof file.size === "number" && Number.isFinite(file.size) ? file.size : 0,
      // The browser transport cannot read a real filesystem path; recording
      // that fact keeps the package honest about what it can resolve.
      resolvedPath: Boolean(file.path && file.path.trim().length > 0),
      typeInferred: Boolean(mediaType),
    },
  };
}

/**
 * Browser import source: a transient `<input type="file">`. It yields real
 * file names, MIME types and sizes but — by browser security design — no
 * filesystem path, which is exactly why `sourcePath` is recorded relative and
 * `metadata.resolvedPath` is false.
 */
export class BrowserFileAssetImportSource implements AssetImportSource {
  readonly kind = "browser-file-input" as const;

  constructor(private readonly documentRef: Document) {}

  pick(options: AssetPickOptions = {}): Promise<readonly PickedAsset[]> {
    return new Promise((resolve) => {
      const input = this.documentRef.createElement("input");
      input.type = "file";
      input.multiple = true;
      if (options.acceptedExtensions?.length) {
        input.accept = options.acceptedExtensions.map((extension) => `.${extension.replace(/^\./, "")}`).join(",");
      }
      input.style.display = "none";
      let settled = false;
      const onWindowFocus = () => {
        window.setTimeout(() => finish([]), 400);
      };
      const finish = (picked: readonly PickedAsset[]) => {
        if (settled) return;
        settled = true;
        window.removeEventListener("focus", onWindowFocus);
        input.remove();
        resolve(picked);
      };
      input.addEventListener("change", () => {
        const files = Array.from(input.files ?? []);
        finish(pickedFromFiles(files, options));
      });
      // A cancelled dialog fires `cancel` in modern browsers; the focus
      // fallback keeps the promise from leaking in older engines that omit it.
      input.addEventListener("cancel", () => finish([]));
      window.addEventListener("focus", onWindowFocus);
      this.documentRef.body.appendChild(input);
      input.click();
    });
  }
}

/**
 * True inside the Tauri webview. The OS file picker is native there, and
 * WebView2 exposes `File.path` so `toAssetDraft` can record a real absolute
 * path for the deployment adapter to copy.
 */
export function isTauriRuntime(globalObject: unknown = typeof window === "undefined" ? undefined : window): boolean {
  return Boolean(globalObject && typeof globalObject === "object" && "__TAURI_INTERNALS__" in globalObject);
}

/**
 * Same picker as the browser source, but labelled honestly: in the desktop
 * shell the dialog is the OS picker and picked files carry a real path.
 */
export class NativeWebviewAssetImportSource implements AssetImportSource {
  readonly kind = "native-dialog" as const;
  private readonly inner: BrowserFileAssetImportSource;
  constructor(documentRef: Document) {
    this.inner = new BrowserFileAssetImportSource(documentRef);
  }
  pick(options?: AssetPickOptions): Promise<readonly PickedAsset[]> {
    return this.inner.pick(options);
  }
}

export function createAssetImportSource(documentRef: Document | undefined, runtime: unknown = typeof window === "undefined" ? undefined : window): AssetImportSource | undefined {
  if (!documentRef) return undefined;
  return isTauriRuntime(runtime) ? new NativeWebviewAssetImportSource(documentRef) : new BrowserFileAssetImportSource(documentRef);
}
