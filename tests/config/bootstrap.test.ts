import { describe, expect, it } from "vitest";

import {
  ensureUraniborgAppHome,
  inspectUraniborgAppHome,
  type AppHomeFilesystem,
  type FilesystemEntryKind
} from "../../src/config/app-home.js";
import { resolveUraniborgPaths } from "../../src/config/paths.js";

describe("ensureUraniborgAppHome", () => {
  it("creates the expected app-home directories without deleting runs", async () => {
    const createdDirectories: string[] = [];
    const entryKinds = new Map<string, FilesystemEntryKind>();
    const filesystem: AppHomeFilesystem = {
      async mkdir(directoryPath: string): Promise<void> {
        createdDirectories.push(directoryPath);
        entryKinds.set(directoryPath, "directory");
      },
      async stat(entryPath: string): Promise<FilesystemEntryKind> {
        return entryKinds.get(entryPath) ?? "missing";
      }
    };
    const paths = resolveUraniborgPaths({
      homeDirectory: "/tmp/alice"
    });

    const status = await ensureUraniborgAppHome(paths, filesystem);

    expect(createdDirectories).toEqual([
      "/tmp/alice/.uraniborg",
      "/tmp/alice/.uraniborg/vendor",
      "/tmp/alice/.uraniborg/vendor/feynman",
      "/tmp/alice/.uraniborg/runs"
    ]);
    expect(status.isLayoutValid).toBe(true);
  });
});

describe("inspectUraniborgAppHome", () => {
  it("reports invalid layout when any required directory is missing", async () => {
    const entryKinds = new Map<string, FilesystemEntryKind>([
      ["/tmp/alice/.uraniborg", "directory"],
      ["/tmp/alice/.uraniborg/vendor", "directory"],
      ["/tmp/alice/.uraniborg/vendor/feynman", "missing"],
      ["/tmp/alice/.uraniborg/runs", "directory"]
    ]);
    const filesystem: AppHomeFilesystem = {
      async mkdir(): Promise<void> {},
      async stat(entryPath: string): Promise<FilesystemEntryKind> {
        return entryKinds.get(entryPath) ?? "missing";
      }
    };
    const paths = resolveUraniborgPaths({
      homeDirectory: "/tmp/alice"
    });

    const status = await inspectUraniborgAppHome(paths, filesystem);

    expect(status.isLayoutValid).toBe(false);
    expect(status.feynmanRuntime.kind).toBe("missing");
  });
});
