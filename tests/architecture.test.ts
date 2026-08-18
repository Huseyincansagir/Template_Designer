import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
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

  it("keeps Core independent of React and Tauri", () => {
    const core = sourceFiles(join(process.cwd(), "src/Core"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    expect(core).not.toMatch(/from\s+["']react["']/);
    expect(core).not.toMatch(/from\s+["']@tauri-apps\//);
    expect(core).not.toMatch(/from\s+["']@tauri-apps\/api["']/);
  });
});
