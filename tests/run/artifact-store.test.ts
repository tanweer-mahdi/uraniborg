import { describe, expect, it } from "vitest";

import {
  createTimestampedRunDirectory,
  ensureIterationDirectory,
  resolveIterationArtifactPaths,
  resolveRunArtifactPaths,
  type RunFilesystem
} from "../../src/run/artifact-store.js";

describe("artifact store", () => {
  it("resolves the canonical run artifact paths", () => {
    expect(resolveRunArtifactPaths("/tmp/runs", "2026-run")).toEqual({
      runDirectory: "/tmp/runs/2026-run",
      manifestFile: "/tmp/runs/2026-run/run.json",
      configSnapshotFile: "/tmp/runs/2026-run/config.snapshot.json",
      originalDraftFile: "/tmp/runs/2026-run/original.md",
      currentDraftFile: "/tmp/runs/2026-run/current.md",
      finalDraftFile: "/tmp/runs/2026-run/final.md",
      informationHighwayFile: "/tmp/runs/2026-run/information-highway.md"
    });
  });

  it("resolves the canonical iteration artifact paths", () => {
    expect(
      resolveIterationArtifactPaths("/tmp/runs/2026-run", 2)
    ).toEqual({
      iterationDirectory: "/tmp/runs/2026-run/iter-2",
      inputFile: "/tmp/runs/2026-run/iter-2/input.md",
      reviewFile: "/tmp/runs/2026-run/iter-2/review.md",
      refinedDraftFile: "/tmp/runs/2026-run/iter-2/refined.md",
      changesFile: "/tmp/runs/2026-run/iter-2/changes.md",
      reviewLogFile: "/tmp/runs/2026-run/iter-2/review.log",
      refineLogFile: "/tmp/runs/2026-run/iter-2/refine.log"
    });
  });

  it("creates run and iteration directories through the filesystem boundary", async () => {
    const mkdirCalls: string[] = [];
    const filesystem: RunFilesystem = {
      async mkdir(directoryPath: string): Promise<void> {
        mkdirCalls.push(directoryPath);
      },
      async readFile(): Promise<string> {
        return "";
      },
      async rename(): Promise<void> {},
      async writeFile(): Promise<void> {}
    };

    await createTimestampedRunDirectory("/tmp/runs", "2026-run", filesystem);
    await ensureIterationDirectory("/tmp/runs/2026-run", 3, filesystem);

    expect(mkdirCalls).toEqual([
      "/tmp/runs/2026-run",
      "/tmp/runs/2026-run/iter-3"
    ]);
  });
});
