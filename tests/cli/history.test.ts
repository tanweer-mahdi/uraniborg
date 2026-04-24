import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runHistoryCommand } from "../../src/cli/commands/history.js";
import { createRunManifest, writeRunManifest } from "../../src/run/manifest.js";
import { resolveRunArtifactPaths } from "../../src/run/artifact-store.js";

describe("runHistoryCommand", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
  });

  it("reports when no runs are available", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-history-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const output: string[] = [];

    await runHistoryCommand({
      resolvePaths() {
        return {
          homeDirectory,
          appHomeDirectory: path.join(homeDirectory, ".uraniborg"),
          configFile: path.join(homeDirectory, ".uraniborg", "config.json"),
          vendorDirectory: path.join(homeDirectory, ".uraniborg", "vendor"),
          feynmanRuntimeDirectory: path.join(
            homeDirectory,
            ".uraniborg",
            "vendor",
            "feynman"
          ),
          feynmanRuntimeManifestFile: path.join(
            homeDirectory,
            ".uraniborg",
            "vendor",
            "feynman",
            "runtime.json"
          ),
          runsDirectory: path.join(homeDirectory, ".uraniborg", "runs")
        };
      },
      writeLine(message) {
        output.push(message);
      }
    });

    expect(output).toEqual(["No Uraniborg runs are available."]);
  });

  it("lists prior runs with identifiers timestamps and status", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-history-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const output: string[] = [];

    await mkdir(runsDirectory, { recursive: true });

    const olderRun = resolveRunArtifactPaths(runsDirectory, "run-older");
    const newerRun = resolveRunArtifactPaths(runsDirectory, "run-newer");

    await mkdir(olderRun.runDirectory, { recursive: true });
    await mkdir(newerRun.runDirectory, { recursive: true });

    await writeRunManifest(
      olderRun.manifestFile,
      {
        ...createRunManifest({
          runId: "run-older",
          slug: "older",
          title: "Older",
          sourceInputPath: "/tmp/older.md",
          iterationsPlanned: 2,
          selectedModels: {
            review: "review-model",
            refine: "refine-model"
          },
          artifactPaths: olderRun,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "failed",
        phase: "failed",
        updatedAt: "2026-04-24T00:05:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:05:00.000Z",
          resumeFromStatus: "review_running"
        }
      }
    );
    await writeRunManifest(
      newerRun.manifestFile,
      {
        ...createRunManifest({
          runId: "run-newer",
          slug: "newer",
          title: "Newer",
          sourceInputPath: "/tmp/newer.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "review-model",
            refine: "refine-model"
          },
          artifactPaths: newerRun,
          createdAt: "2026-04-24T01:00:00.000Z"
        }),
        status: "finished",
        phase: "completed",
        iterationsCompleted: 1,
        updatedAt: "2026-04-24T01:05:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T01:05:00.000Z"
        }
      }
    );

    await runHistoryCommand({
      resolvePaths() {
        return {
          homeDirectory,
          appHomeDirectory: path.join(homeDirectory, ".uraniborg"),
          configFile: path.join(homeDirectory, ".uraniborg", "config.json"),
          vendorDirectory: path.join(homeDirectory, ".uraniborg", "vendor"),
          feynmanRuntimeDirectory: path.join(
            homeDirectory,
            ".uraniborg",
            "vendor",
            "feynman"
          ),
          feynmanRuntimeManifestFile: path.join(
            homeDirectory,
            ".uraniborg",
            "vendor",
            "feynman",
            "runtime.json"
          ),
          runsDirectory
        };
      },
      writeLine(message) {
        output.push(message);
      }
    });

    expect(output[0]).toContain("run-newer");
    expect(output[0]).toContain("finished");
    expect(output[1]).toContain("run-older");
    expect(output[1]).toContain("failed");
  });
});
