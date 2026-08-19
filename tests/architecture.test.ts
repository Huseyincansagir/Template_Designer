import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      // `.tsx` matters: the entire UI layer lives in App.tsx, so a scan that
      // only collected `.ts` would silently read nothing.
      return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
    });
}

describe("architecture boundaries", () => {
  it("keeps Domain independent of React and Tauri", () => {
    const domain = sourceFiles(join(process.cwd(), "src/Domain"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(domain).not.toMatch(/from\s+["']react["']/);
    expect(domain).not.toMatch(/from\s+["']@tauri-apps\//);
    expect(domain).not.toMatch(/from\s+["']@tauri-apps\/api["']/);
  });

  it("does not put editor snapshot bytes in the deployment package", () => {
    const exported = readFileSync(join(process.cwd(), "src/Core/export.ts"), "utf8");
    expect(exported).toMatch(/binary:\s*false/);
    expect(exported).not.toMatch(/editorPreview|IndexedDB|createObjectURL/);
    const core = sourceFiles(join(process.cwd(), "src/Core")).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(core).not.toMatch(/editor-preview-store/);
  });

  it("keeps Core independent of React and Tauri", () => {
    const core = sourceFiles(join(process.cwd(), "src/Core"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(core).not.toMatch(/from\s+["']react["']/);
    expect(core).not.toMatch(/from\s+["']@tauri-apps\//);
    expect(core).not.toMatch(/from\s+["']@tauri-apps\/api["']/);
  });

  /**
   * Every command the canonical application layer publishes must be reachable
   * by a real user. A method that only tests call is a capability the product
   * cannot use — that class of gap (orphaned `addRotation`, `moveWidget`,
   * `editWidgetProperties`, unscoped `setWidgetGeometries`, `executeCommand`)
   * was the single most common finding of the product-completion audit, so it
   * is now enforced instead of re-discovered.
   *
   * `execute` is the mutation primitive every other command composes and is
   * deliberately exempt.
   */
  it("publishes no EditorApplication command without a UI caller", () => {
    const source = readFileSync(join(process.cwd(), "src/Core/editor-application.ts"), "utf8");
    const ui = sourceFiles(join(process.cwd(), "src/App"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    const classBody = source.slice(source.indexOf("export class EditorApplication"));
    const methods = [...classBody.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*)\(/gm)]
      .map((match) => match[1])
      .filter((name) => !["constructor", "execute"].includes(name));

    expect(methods.length).toBeGreaterThan(15);
    const orphans = methods.filter((name) => !new RegExp(`\\.${name}\\(`).test(ui));
    expect(orphans, `orphaned commands with no UI entry point: ${orphans.join(", ")}`).toEqual([]);
  });

  /**
   * The exactly-four-rotations rule has no Add Rotation command to repair a
   * broken set, so no code path may create or delete a Rotation.
   */
  it("exposes no command that can add or remove a Rotation", () => {
    const core = readFileSync(join(process.cwd(), "src/Core/editor-application.ts"), "utf8");
    const commands = readFileSync(join(process.cwd(), "src/App/editor-commands.ts"), "utf8");

    expect(core).not.toMatch(/\baddRotation\b/);
    expect(core).toMatch(/containsRotationId/);
    // Delete and duplicate must both consult the guard.
    expect((core.match(/containsRotationId\(current, ids\)/g) ?? []).length).toBe(2);
    // No descriptor may offer a rotation a delete or duplicate entry.
    const rotationDescriptors = [...commands.matchAll(/\{[^}]*supportedSelectionKinds:[^}]*"rotation"[^}]*\}/g)].map((match) => match[0]);
    expect(rotationDescriptors.length).toBeGreaterThan(0);
    for (const descriptor of rotationDescriptors) {
      expect(descriptor).not.toMatch(/id:\s*"(canvas\.delete-selection|theme\.delete|scene\.delete|[a-z.]*duplicate[a-z.]*)"/);
    }
  });

  /**
   * Identity is generated in exactly one module. There were three inline
   * generators - Core used `crypto.randomUUID()` bare (which throws where it is
   * unavailable), Domain guarded it with one fallback and the UI with another -
   * so a single document could carry ids in three shapes and one path could
   * hard-crash where the others degraded.
   */
  it("generates stable IDs in exactly one module", () => {
    const identityModule = join(process.cwd(), "src/Domain/identity.ts");
    const others = [
      ...sourceFiles(join(process.cwd(), "src/Domain")),
      ...sourceFiles(join(process.cwd(), "src/Core")),
      ...sourceFiles(join(process.cwd(), "src/App")),
      ...sourceFiles(join(process.cwd(), "src/Infrastructure")),
    ].filter((file) => file !== identityModule);

    const offenders = others.filter((file) => /crypto\s*\.\s*randomUUID|Math\s*\.\s*random\s*\(\s*\)\s*\.\s*toString\s*\(\s*36/.test(readFileSync(file, "utf8")));
    expect(offenders.map((file) => file.replace(process.cwd(), "")), "inline id generation outside Domain/identity.ts").toEqual([]);
    // And the one module that may do it, does.
    expect(readFileSync(identityModule, "utf8")).toMatch(/randomUUID/);
  });

  it("Preview Mode guards every document mutation the UI can fire (D5-19)", () => {
    const app = readFileSync(join(process.cwd(), "src/App/App.tsx"), "utf8");
    for (const command of [
      "Undo", "Redo", "Delete", "Duplicate", "Paste",
      "Add Theme Project Group", "Add Theme Project", "Add Scene", "Add Widget",
      "Widget configuration", "Change Widget Type", "Scene activation",
      "Duplicate Scene", "Duplicate Theme Project", "Move Scene",
      "Widget toggle", "Z-order",
      "Delete Asset", "Import Asset", "Change Device Profile", "Rename",
      "Floor mapping", "Revert to Saved", "Duplicate Mode",
    ]) {
      expect(app, command).toContain(`blockedInPreview("${command}")`);
    }
    expect(app).toMatch(/blockedInPreview\(visible \? "Show All" : "Hide All"\)/);
    expect(app).toMatch(/blockedInPreview\(kind === "align" \? "Align" : "Distribute"\)/);
    expect(app).toMatch(/if \(viewMode === "preview"\) \{\s*logAction\("Preview Mode evaluates the runtime/);
    expect(app).toMatch(/const beginCanvasMarquee[\s\S]*if \(viewMode === "preview"\) return/);
    expect(app).toMatch(/const beginWidgetResize[\s\S]*viewMode === "preview"\) return/);
    expect(app).toMatch(/const beginSelectionResize[\s\S]*viewMode === "preview"\) return/);
  });

  it("does not ship the Phase-0 SDCardTarget stub as a deployment transport", () => {
    const infrastructure = sourceFiles(join(process.cwd(), "src/Infrastructure"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    const app = readFileSync(join(process.cwd(), "src/App/App.tsx"), "utf8");
    const core = readFileSync(join(process.cwd(), "src/Core/deployment-service.ts"), "utf8");
    expect(infrastructure).not.toMatch(/SD_CARD_DEPLOYMENT_NOT_IMPLEMENTED|reserved for a later phase/);
    expect(app).not.toMatch(/new SDCardTarget\s*\(/);
    expect(app).not.toMatch(/\bwritePackage\b/);
    expect(core).not.toMatch(/\btargets\s*\(/);
    expect(core).not.toMatch(/async write\(/);
  });

  it("chrome navigation selects the node it shows (L-11)", () => {
    const app = readFileSync(join(process.cwd(), "src/App/App.tsx"), "utf8");
    expect(app).toMatch(/const navigateToTheme[\s\S]*setSelectedIds\(theme \? \[theme\.id\] : \[\]\)[\s\S]*kind: "theme"/);
    expect(app).toMatch(/const navigateToRotation[\s\S]*setSelectedIds\(rotation \? \[rotation\.id\] : \[\]\)[\s\S]*kind: "rotation"/);
    expect(app).toMatch(/const navigateToScene[\s\S]*setSelectedIds\(scene \? \[scene\.id\] : \[\]\)[\s\S]*kind: "scene"/);
  });
});