import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateRunSnapshot,
  openRunSnapshot
} from "../../src/history-viewer/index.js";
import {
  resolveIterationArtifactPaths,
  resolveRunArtifactPaths
} from "../../src/run/artifact-store.js";
import { createRunManifest, writeRunManifest } from "../../src/run/manifest.js";
import type { UraniborgPaths } from "../../src/types/app-home.js";

describe("history viewer snapshots", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
    vi.restoreAllMocks();
  });

  it("generates a focused selected-run reader snapshot with sanitized Markdown", async () => {
    const fixture = await createRunFixture();
    await writeSelectedRunArtifacts(fixture);
    await writeOtherRunArtifact(fixture);

    const result = await generateRunSnapshot("run-selected", {
      now: () => new Date("2026-05-06T00:00:00.000Z"),
      resolvePaths: () => fixture.paths
    });
    const snapshot = await readFile(result.snapshotFile, "utf8");
    const originalMarkdown = await readFile(
      fixture.selectedArtifacts.originalDraftFile,
      "utf8"
    );

    expect(result.snapshotUrl).toMatch(/^file:\/\//);
    expect(result.snapshotFile).toContain("viewer-snapshots");
    expect(snapshot).toContain("<h2>Summary</h2>");
    expect(snapshot).toContain("run-selected");
    expect(snapshot).toContain("Selected Run");
    expect(snapshot).toContain("review-model");
    expect(snapshot).toContain("refine-model");
    expect(snapshot).toContain('for="panel-original">Original</label>');
    expect(snapshot).toContain("<p>Iteration 1</p>");
    expect(snapshot).toContain('for="panel-iteration-1-review">Review</label>');
    expect(snapshot).toContain('for="panel-iteration-1-refined">Refined</label>');
    expect(snapshot).toContain('for="panel-final-refined">Refined</label>');
    expect(snapshot).toContain("<h1>Selected Draft</h1>");
    expect(snapshot).toContain("<h2>Review</h2>");
    expect(snapshot).toContain("<h2>Refined</h2>");
    expect(snapshot).toContain("<table>");
    expect(snapshot).toContain('id="panel-summary"');
    expect(snapshot).toContain('id="panel-original"');
    expect(snapshot).toContain("reader-toggle");
    expect(snapshot).toContain(".reader-panel {\n  display: none;");
    expect(snapshot).not.toContain("<script>");
    expect(snapshot).not.toContain("<div onclick=");
    expect(snapshot).not.toContain("other run secret");
    expect(snapshot).not.toContain("run.json");
    expect(snapshot).not.toContain("config.snapshot.json");
    expect(snapshot).not.toContain("input.md");
    expect(snapshot).not.toContain("current.md");
    expect(snapshot).not.toContain("information-highway.md");
    expect(snapshot).not.toContain("review.log");
    expect(snapshot).not.toContain("changes.md");
    expect(snapshot).not.toContain("refine.log");
    expect(snapshot).not.toContain("refine.response.txt");
    expect(snapshot).not.toContain("Original draft");
    expect(snapshot).not.toContain("Final draft");
    expect(snapshot).not.toContain("Top-Level Artifacts");
    expect(snapshot).not.toContain("fetch(");
    expect(snapshot).not.toContain("https://");
    expect(snapshot).not.toContain("<link");
    expect(snapshot).not.toContain("<script src=");
    expect(originalMarkdown).toContain("<script>alert('x')</script>");
  });

  it("rejects symlink escapes and marks large reader previews explicitly", async () => {
    const fixture = await createRunFixture();
    await writeSelectedRunArtifacts(fixture);

    const outsideSecretFile = path.join(fixture.temporaryRoot, "outside-secret.txt");
    await writeFile(outsideSecretFile, "outside secret", "utf8");
    await rm(fixture.selectedArtifacts.originalDraftFile);
    await symlink(
      outsideSecretFile,
      fixture.selectedArtifacts.originalDraftFile
    );
    await writeFile(
      fixture.selectedArtifacts.finalDraftFile,
      "x".repeat(300 * 1024),
      "utf8"
    );

    const result = await generateRunSnapshot("run-selected", {
      now: () => new Date("2026-05-06T00:00:00.000Z"),
      resolvePaths: () => fixture.paths
    });
    const snapshot = await readFile(result.snapshotFile, "utf8");

    expect(snapshot).toContain(
      "Preview rejected because the reader document resolves outside the selected run directory."
    );
    expect(snapshot).not.toContain("outside secret");
    expect(snapshot).toContain("Preview truncated at 262144 bytes.");
  });

  it("reports missing runs without generating an unrelated snapshot", async () => {
    const fixture = await createRunFixture();

    await expect(
      generateRunSnapshot("missing-run", {
        resolvePaths: () => fixture.paths
      })
    ).rejects.toThrow('Run "missing-run" was not found.');
  });

  it("keeps generated snapshots available when browser opening fails", async () => {
    const fixture = await createRunFixture();
    await writeSelectedRunArtifacts(fixture);
    const browserLauncher = {
      open: vi.fn().mockRejectedValue(new Error("no browser"))
    };

    const result = await openRunSnapshot("run-selected", {
      browserLauncher,
      now: () => new Date("2026-05-06T00:00:00.000Z"),
      resolvePaths: () => fixture.paths
    });
    const snapshot = await readFile(result.snapshotFile, "utf8");

    expect(browserLauncher.open).toHaveBeenCalledWith(result.snapshotUrl);
    expect(result.browser).toEqual({
      opened: false,
      message: "no browser"
    });
    expect(snapshot).toContain("run-selected");
  });

  async function createRunFixture(): Promise<{
    paths: UraniborgPaths;
    selectedArtifacts: ReturnType<typeof resolveRunArtifactPaths>;
    temporaryRoot: string;
  }> {
    const temporaryRoot = await mkdtemp(
      path.join(tmpdir(), "uraniborg-history-viewer-")
    );
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const appHomeDirectory = path.join(homeDirectory, ".uraniborg");
    const runsDirectory = path.join(appHomeDirectory, "runs");
    const paths: UraniborgPaths = {
      homeDirectory,
      appHomeDirectory,
      configFile: path.join(appHomeDirectory, "config.json"),
      vendorDirectory: path.join(appHomeDirectory, "vendor"),
      feynmanRuntimeDirectory: path.join(appHomeDirectory, "vendor", "feynman"),
      feynmanRuntimeManifestFile: path.join(
        appHomeDirectory,
        "vendor",
        "feynman",
        "runtime.json"
      ),
      runsDirectory
    };
    const selectedArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "run-selected"
    );

    await mkdir(selectedArtifacts.runDirectory, { recursive: true });
    await mkdir(resolveRunArtifactPaths(runsDirectory, "run-other").runDirectory, {
      recursive: true
    });

    return {
      paths,
      selectedArtifacts,
      temporaryRoot
    };
  }

  async function writeSelectedRunArtifacts(input: {
    selectedArtifacts: ReturnType<typeof resolveRunArtifactPaths>;
  }): Promise<void> {
    await writeRunManifest(
      input.selectedArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "run-selected",
          slug: "selected",
          title: "Selected Run",
          sourceInputPath: "/tmp/selected.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "review-model",
            refine: "refine-model"
          },
          artifactPaths: input.selectedArtifacts,
          createdAt: "2026-05-06T00:00:00.000Z"
        }),
        status: "failed",
        phase: "failed",
        iterationsCompleted: 0,
        updatedAt: "2026-05-06T00:05:00.000Z",
        lastError: {
          code: "refine_failed",
          message: "Refinement failed.",
          timestamp: "2026-05-06T00:05:00.000Z"
        }
      }
    );
    await writeFile(
      input.selectedArtifacts.configSnapshotFile,
      "{\"revisionRuntime\":{\"profileId\":\"test\"}}\n",
      "utf8"
    );
    await writeFile(
      input.selectedArtifacts.originalDraftFile,
      [
        "# Selected Draft",
        "",
        "| A | B |",
        "| - | - |",
        "| 1 | 2 |",
        "",
        "<script>alert('x')</script>",
        "<div onclick=\"bad()\">raw html</div>"
      ].join("\n"),
      "utf8"
    );
    await writeFile(input.selectedArtifacts.currentDraftFile, "Current\n", "utf8");
    await writeFile(input.selectedArtifacts.finalDraftFile, "Final\n", "utf8");
    await writeFile(
      input.selectedArtifacts.informationHighwayFile,
      "Memory\n",
      "utf8"
    );

    const iterationArtifacts = resolveIterationArtifactPaths(
      input.selectedArtifacts.runDirectory,
      1
    );

    await mkdir(iterationArtifacts.iterationDirectory, { recursive: true });
    await writeFile(iterationArtifacts.inputFile, "Input\n", "utf8");
    await writeFile(iterationArtifacts.reviewFile, "## Review\n", "utf8");
    await writeFile(iterationArtifacts.reviewLogFile, "review log\n", "utf8");
    await writeFile(iterationArtifacts.refinedDraftFile, "Refined\n", "utf8");
    await writeFile(iterationArtifacts.changesFile, "Changes\n", "utf8");
    await writeFile(iterationArtifacts.refineLogFile, "refine log\n", "utf8");
    await writeFile(
      iterationArtifacts.refineResponseFile,
      "response\n",
      "utf8"
    );
  }

  async function writeOtherRunArtifact(input: {
    paths: UraniborgPaths;
  }): Promise<void> {
    const otherArtifacts = resolveRunArtifactPaths(
      input.paths.runsDirectory,
      "run-other"
    );

    await writeFile(otherArtifacts.originalDraftFile, "other run secret", "utf8");
  }
});
