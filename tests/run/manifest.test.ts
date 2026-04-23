import { describe, expect, it } from "vitest";

import {
  createRunConfigSnapshot,
  createRunManifest,
  readRunManifest,
  writeRunConfigSnapshot,
  writeRunManifest
} from "../../src/run/manifest.js";
import { transitionRunManifest } from "../../src/run/state-machine.js";
import type { RunFilesystem } from "../../src/run/artifact-store.js";

describe("run manifest", () => {
  it("creates the initial initialized manifest shape", () => {
    const manifest = createRunManifest({
      runId: "2026-04-21T18-15-00Z-scaling-laws",
      slug: "scaling-laws",
      title: "Scaling Laws",
      sourceInputPath: "/work/scaling-laws.md",
      iterationsPlanned: 3,
      selectedModels: {
        review: "review-model",
        refine: "refine-model"
      },
      artifactPaths: {
        runDirectory: "/tmp/runs/run-1",
        manifestFile: "/tmp/runs/run-1/run.json",
        configSnapshotFile: "/tmp/runs/run-1/config.snapshot.json",
        originalDraftFile: "/tmp/runs/run-1/original.md",
        currentDraftFile: "/tmp/runs/run-1/current.md",
        finalDraftFile: "/tmp/runs/run-1/final.md",
        informationHighwayFile: "/tmp/runs/run-1/information-highway.md"
      },
      createdAt: "2026-04-21T18:15:00.000Z"
    });

    expect(manifest.status).toBe("initialized");
    expect(manifest.phase).toBe("initialization");
    expect(manifest.phaseMetadata.currentIteration).toBe(1);
  });

  it("writes and reads manifests through the artifact filesystem", async () => {
    const memoryFilesystem = createMemoryRunFilesystem();
    const manifestPath = "/tmp/runs/run-1/run.json";

    await writeRunManifest(
      manifestPath,
      createRunManifest({
        runId: "run-1",
        slug: "run-1",
        title: "Run 1",
        sourceInputPath: "/tmp/input.md",
        iterationsPlanned: 1,
        selectedModels: {
          review: "review-model",
          refine: "refine-model"
        },
        artifactPaths: {
          runDirectory: "/tmp/runs/run-1",
          manifestFile: manifestPath,
          configSnapshotFile: "/tmp/runs/run-1/config.snapshot.json",
          originalDraftFile: "/tmp/runs/run-1/original.md",
          currentDraftFile: "/tmp/runs/run-1/current.md",
          finalDraftFile: "/tmp/runs/run-1/final.md",
          informationHighwayFile: "/tmp/runs/run-1/information-highway.md"
        },
        createdAt: "2026-04-21T18:15:00.000Z"
      }),
      memoryFilesystem
    );

    const manifest = await readRunManifest(manifestPath, memoryFilesystem);

    expect(manifest.runId).toBe("run-1");
    expect(manifest.selectedModels.review).toBe("review-model");
  });

  it("creates config snapshots without storing resolved secrets", () => {
    const snapshot = createRunConfigSnapshot({
      config: {
        version: 1,
        refine: {
          endpoint: {
            baseUrl: "https://api.example.com/v1",
            apiKeyEnvVar: "OPENAI_API_KEY",
            apiKey: "secret",
            timeoutMs: 60000
          },
          defaults: {
            model: "gpt-5",
            temperature: 0.2
          }
        }
      },
      sourcePath: "/work/draft.md",
      title: "Draft",
      slug: "draft",
      iterationCount: 3,
      selectedModels: {
        review: "review-model",
        refine: "refine-model"
      }
    });

    expect(snapshot.refineEndpoint).toEqual({
      baseUrl: "https://api.example.com/v1",
      apiKeyEnvVar: "OPENAI_API_KEY",
      timeoutMs: 60000
    });
  });

  it("persists config snapshots as JSON artifacts", async () => {
    const memoryFilesystem = createMemoryRunFilesystem();

    await writeRunConfigSnapshot(
      "/tmp/runs/run-1/config.snapshot.json",
      {
        input: {
          sourcePath: "/work/draft.md",
          title: "Draft",
          slug: "draft"
        },
        iterationCount: 2,
        selectedModels: {
          review: "review-model",
          refine: "refine-model"
        },
        resolvedDefaults: {
          model: "gpt-5",
          temperature: 0.2
        },
        refineEndpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKeyEnvVar: "OPENAI_API_KEY",
          timeoutMs: 60000
        }
      },
      memoryFilesystem
    );

    expect(
      memoryFilesystem.files.get("/tmp/runs/run-1/config.snapshot.json")
    ).toContain("\"iterationCount\": 2");
  });
});

describe("run state machine", () => {
  it("transitions the manifest only when the current state matches the owner expectation", async () => {
    const memoryFilesystem = createMemoryRunFilesystem();
    const manifestPath = "/tmp/runs/run-1/run.json";

    await writeRunManifest(
      manifestPath,
      createRunManifest({
        runId: "run-1",
        slug: "run-1",
        title: "Run 1",
        sourceInputPath: "/tmp/input.md",
        iterationsPlanned: 2,
        selectedModels: {
          review: "review-model",
          refine: "refine-model"
        },
        artifactPaths: {
          runDirectory: "/tmp/runs/run-1",
          manifestFile: manifestPath,
          configSnapshotFile: "/tmp/runs/run-1/config.snapshot.json",
          originalDraftFile: "/tmp/runs/run-1/original.md",
          currentDraftFile: "/tmp/runs/run-1/current.md",
          finalDraftFile: "/tmp/runs/run-1/final.md",
          informationHighwayFile: "/tmp/runs/run-1/information-highway.md"
        },
        createdAt: "2026-04-21T18:15:00.000Z"
      }),
      memoryFilesystem
    );

    const successResult = await transitionRunManifest(
      manifestPath,
      ["initialized"],
      {
        nextStatus: "review_running",
        nextPhase: "review",
        updatedAt: "2026-04-21T18:20:00.000Z"
      },
      memoryFilesystem
    );

    expect(successResult.ok).toBe(true);

    const failureResult = await transitionRunManifest(
      manifestPath,
      ["initialized"],
      {
        nextStatus: "review_complete",
        nextPhase: "review",
        updatedAt: "2026-04-21T18:25:00.000Z"
      },
      memoryFilesystem
    );

    expect(failureResult.ok).toBe(false);

    if (!failureResult.ok) {
      expect(failureResult.error.code).toBe("state_ownership_violation");
    }
  });
});

function createMemoryRunFilesystem(): RunFilesystem & { files: Map<string, string> } {
  const files = new Map<string, string>();

  return {
    files,
    async mkdir(): Promise<void> {},
    async readFile(filePath: string): Promise<string> {
      const value = files.get(filePath);

      if (typeof value !== "string") {
        throw new Error(`Missing file: ${filePath}`);
      }

      return value;
    },
    async rename(sourcePath: string, targetPath: string): Promise<void> {
      const value = files.get(sourcePath);

      if (typeof value !== "string") {
        throw new Error(`Missing file: ${sourcePath}`);
      }

      files.set(targetPath, value);
      files.delete(sourcePath);
    },
    async writeFile(filePath: string, contents: string): Promise<void> {
      files.set(filePath, contents);
    }
  };
}
