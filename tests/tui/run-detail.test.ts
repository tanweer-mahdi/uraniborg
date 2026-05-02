import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createRunConfigSnapshot,
  createRunManifest,
  writeRunConfigSnapshot,
  writeRunManifest
} from "../../src/run/manifest.js";
import { resolveRunArtifactPaths } from "../../src/run/artifact-store.js";
import { collectRunDetail } from "../../src/tui/screens/run-detail.js";
import { createResolvedTestUraniborgConfig } from "../helpers/uraniborg-config.js";

describe("collectRunDetail", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
  });

  it("returns run summary plus top-level and per-iteration artifact indexes", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-run-detail-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(runsDirectory, "run-1");

    await mkdir(runArtifacts.runDirectory, { recursive: true });

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "run-1",
          slug: "run-1",
          title: "Run 1",
          sourceInputPath: "/tmp/draft.md",
          iterationsPlanned: 2,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-05-01T00:00:00.000Z"
        }),
        status: "failed",
        phase: "failed",
        updatedAt: "2026-05-01T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 2,
          currentPhaseStartedAt: "2026-05-01T00:10:00.000Z",
          resumeFromStatus: "refine_running"
        },
        lastError: {
          code: "refine_output_invalid",
          message: "Refinement output did not match the contract.",
          timestamp: "2026-05-01T00:10:00.000Z"
        }
      }
    );
    await writeRunConfigSnapshot(
      runArtifacts.configSnapshotFile,
      createRunConfigSnapshot({
        config: createResolvedTestUraniborgConfig({
          profileId: "openai-codex-chatgpt",
          binding: {
            type: "pi-auth-storage",
            providerId: "openai-codex"
          },
          model: "gpt-5.4",
          providerContext: {
            accountId: "acct_123"
          }
        }),
        sourcePath: "/tmp/draft.md",
        title: "Run 1",
        slug: "run-1",
        iterationCount: 2,
        selectedModels: {
          review: "openai/gpt-5.4",
          refine: "gpt-5.4"
        }
      })
    );

    vi.stubEnv("HOME", homeDirectory);

    const detail = await collectRunDetail("run-1");

    expect(detail.runId).toBe("run-1");
    expect(detail.resumable).toBe(true);
    expect(detail.topLevelArtifacts).toContain(runArtifacts.manifestFile);
    expect(detail.iterationArtifacts).toHaveLength(2);
    expect(detail.iterationArtifacts[0]?.files.some((filePath) => filePath.endsWith("review.md"))).toBe(true);
    expect(detail.lastError).toContain("Refinement output did not match the contract.");
  });
});
