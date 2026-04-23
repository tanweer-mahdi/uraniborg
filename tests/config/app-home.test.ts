import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isMarkdownFilePath,
  resolveIterationDirectory,
  resolvePathFromCwd,
  resolveRunDirectory,
  resolveUraniborgPaths
} from "../../src/config/paths.js";

describe("resolveUraniborgPaths", () => {
  it("resolves the app-home layout from the provided home directory", () => {
    const paths = resolveUraniborgPaths({
      homeDirectory: "/tmp/alice"
    });

    expect(paths).toEqual({
      homeDirectory: "/tmp/alice",
      appHomeDirectory: "/tmp/alice/.uraniborg",
      configFile: "/tmp/alice/.uraniborg/config.json",
      vendorDirectory: "/tmp/alice/.uraniborg/vendor",
      feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
      feynmanRuntimeManifestFile:
        "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
      runsDirectory: "/tmp/alice/.uraniborg/runs"
    });
  });

  it("allows the app directory name to be overridden for tests and fixtures", () => {
    const paths = resolveUraniborgPaths({
      homeDirectory: "/tmp/alice",
      appDirectoryName: ".uraniborg-test"
    });

    expect(paths.appHomeDirectory).toBe("/tmp/alice/.uraniborg-test");
    expect(paths.configFile).toBe("/tmp/alice/.uraniborg-test/config.json");
  });
});

describe("run and file helpers", () => {
  it("derives run and iteration directories from a run id", () => {
    const paths = resolveUraniborgPaths({
      homeDirectory: "/tmp/alice"
    });
    const runDirectory = resolveRunDirectory(paths, "20260423-paper-revision");

    expect(runDirectory).toBe(
      "/tmp/alice/.uraniborg/runs/20260423-paper-revision"
    );
    expect(resolveIterationDirectory(runDirectory, 3)).toBe(
      "/tmp/alice/.uraniborg/runs/20260423-paper-revision/iter-3"
    );
  });

  it("resolves user input paths relative to the working directory", () => {
    expect(resolvePathFromCwd("draft.md", "/work")).toBe("/work/draft.md");
    expect(resolvePathFromCwd("/work/draft.md", "/elsewhere")).toBe(
      path.normalize("/work/draft.md")
    );
  });

  it("accepts markdown files and rejects other extensions", () => {
    expect(isMarkdownFilePath("draft.md")).toBe(true);
    expect(isMarkdownFilePath("draft.MD")).toBe(true);
    expect(isMarkdownFilePath("draft.txt")).toBe(false);
  });
});
