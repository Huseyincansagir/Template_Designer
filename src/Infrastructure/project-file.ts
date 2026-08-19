import type { Project } from "../Domain/models";
import { migrateLoadedProject } from "../Domain/migration";
import { isLoadableProject } from "./project-storage";

/**
 * Platform-neutral project *file* boundary, distinct from `ProjectStorage`
 * (the single autosave slot). This is how a project leaves or enters the
 * machine: a portable, versioned JSON document the designer can back up, hand
 * to a colleague or archive next to the deployment package.
 *
 * The browser build writes/reads through a download and a file input. The
 * Tauri build can implement the same interface with native save/open dialogs
 * without any UI change.
 */
export interface ProjectFileGateway {
  readonly kind: "browser-download" | "native-dialog";
  /** Writes the canonical project document out under a file name derived from its name. */
  exportProject(project: Project): Promise<string>;
  /** Reads a project document back; resolves undefined when the user cancels. */
  importProject(): Promise<ProjectImportResult | undefined>;
}

export type ProjectImportResult =
  | { readonly ok: true; readonly project: Project; readonly fileName: string }
  | { readonly ok: false; readonly fileName: string; readonly reason: string };

export const PROJECT_FILE_EXTENSION = "tdproj.json";

/** `My Template` → `my-template.tdproj.json`; never empty, never path-bearing. */
export function projectFileName(projectName: string): string {
  const slug = projectName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "template-designer-project"}.${PROJECT_FILE_EXTENSION}`;
}

/**
 * Parses a project file. A file that parses as JSON but is not a structurally
 * complete project is rejected with a reason instead of being opened — opening
 * it would crash the editor with no recovery path (the same bar
 * `ProjectStorage.load` applies to the autosave slot).
 */
export function parseProjectFile(raw: string): { readonly ok: true; readonly project: Project } | { readonly ok: false; readonly reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "the file is not valid JSON" };
  }
  if (!isLoadableProject(parsed)) {
    return { ok: false, reason: "the file is not a complete Template Designer project document" };
  }
  return { ok: true, project: migrateLoadedProject(parsed) };
}

export class BrowserProjectFileGateway implements ProjectFileGateway {
  readonly kind = "browser-download" as const;

  constructor(private readonly documentRef: Document, private readonly urlFactory: typeof URL = URL) {}

  async exportProject(project: Project): Promise<string> {
    const fileName = projectFileName(project.name);
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const href = this.urlFactory.createObjectURL(blob);
    const anchor = this.documentRef.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    anchor.style.display = "none";
    this.documentRef.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can cancel the download in some engines; one turn
    // of the event loop is enough for the navigation to start.
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.urlFactory.revokeObjectURL(href);
    return fileName;
  }

  importProject(): Promise<ProjectImportResult | undefined> {
    return new Promise((resolve) => {
      const input = this.documentRef.createElement("input");
      input.type = "file";
      input.accept = ".json,application/json";
      input.style.display = "none";
      let settled = false;
      const finish = (result: ProjectImportResult | undefined) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(result);
      };
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          finish(undefined);
          return;
        }
        void file.text().then((raw) => {
          const parsed = parseProjectFile(raw);
          finish(parsed.ok ? { ok: true, project: parsed.project, fileName: file.name } : { ok: false, fileName: file.name, reason: parsed.reason });
        }).catch(() => finish({ ok: false, fileName: file.name, reason: "the file could not be read" }));
      });
      input.addEventListener("cancel", () => finish(undefined));
      this.documentRef.body.appendChild(input);
      input.click();
    });
  }
}

export class NativeProjectFileGateway implements ProjectFileGateway {
  readonly kind = "native-dialog" as const;
  private readonly inner: BrowserProjectFileGateway;
  constructor(documentRef: Document, urlFactory: typeof URL = URL) {
    this.inner = new BrowserProjectFileGateway(documentRef, urlFactory);
  }
  exportProject(project: Project): Promise<string> {
    return this.inner.exportProject(project);
  }
  importProject(): Promise<ProjectImportResult | undefined> {
    return this.inner.importProject();
  }
}

export function createProjectFileGateway(documentRef: Document | undefined, runtime: unknown = typeof window === "undefined" ? undefined : window): ProjectFileGateway | undefined {
  if (!documentRef) return undefined;
  return isTauriShell(runtime) ? new NativeProjectFileGateway(documentRef) : new BrowserProjectFileGateway(documentRef);
}

function isTauriShell(runtime: unknown): boolean {
  return Boolean(runtime && typeof runtime === "object" && "__TAURI_INTERNALS__" in runtime);
}
