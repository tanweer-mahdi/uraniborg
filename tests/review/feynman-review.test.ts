import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  createFreshReviewWorkspace,
  createNodeReviewFilesystem,
  createReviewCommandContract,
  executeReviewAndNormalize,
  normalizeReviewArtifact,
  writeIterationReviewInput
} from "../../src/review/feynman-review.js";
import { createRunManifest, readRunManifest, writeRunManifest } from "../../src/run/manifest.js";
import { resolveRunArtifactPaths } from "../../src/run/artifact-store.js";
import type {
  FeynmanCommandExecution,
  FeynmanCommandRunner
} from "../../src/review/feynman-bootstrap.js";

describe("review workspace", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
  });

  it("creates a fresh iteration-local workspace and removes stale files", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const iterationDirectory = path.join(temporaryRoot, "iter-1");
    const staleReviewFile = path.join(
      iterationDirectory,
      "feynman-review",
      "outputs",
      "stale-review.md"
    );

    await mkdir(path.dirname(staleReviewFile), { recursive: true });
    await writeFile(staleReviewFile, "stale\n", "utf8");

    const workspace = await createFreshReviewWorkspace(iterationDirectory);

    expect(workspace).toEqual({
      workspaceDirectory: path.join(iterationDirectory, "feynman-review"),
      sessionDirectory: path.join(iterationDirectory, "feynman-review", "session"),
      workspaceInputFile: path.join(iterationDirectory, "feynman-review", "input.md"),
      outputsDirectory: path.join(iterationDirectory, "feynman-review", "outputs")
    });
    await expect(access(staleReviewFile)).rejects.toThrow();
    await expect(access(workspace.sessionDirectory)).resolves.toBeUndefined();
  });

  it("builds the exact review invocation contract around the isolated workspace", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const workspace = await createFreshReviewWorkspace(
      path.join(temporaryRoot, "run", "iter-2")
    );

    expect(
      createReviewCommandContract({
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        reviewModel: "openai/gpt-5.4",
        reviewWorkspace: workspace
      })
    ).toEqual({
      executablePath: "/tmp/vendor/feynman/bin/feynman",
      args: [
        "review",
        "input.md",
        "--model",
        "openai/gpt-5.4",
        "--cwd",
        workspace.workspaceDirectory,
        "--session-dir",
        workspace.sessionDirectory,
        "--new-session"
      ]
    });
  });

  it("writes iter-N/input.md from current.md and copies it into the isolated workspace", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const currentDraftFile = path.join(temporaryRoot, "current.md");
    const iterationInputFile = path.join(temporaryRoot, "iter-1", "input.md");

    await mkdir(path.dirname(iterationInputFile), { recursive: true });
    await writeFile(currentDraftFile, "# Current draft\n", "utf8");

    const workspace = await createFreshReviewWorkspace(path.join(temporaryRoot, "iter-1"));

    const contents = await writeIterationReviewInput({
      currentDraftFile,
      iterationInputFile,
      reviewWorkspace: workspace
    });

    expect(contents).toBe("# Current draft\n");
    await expect(readFile(iterationInputFile, "utf8")).resolves.toBe("# Current draft\n");
    await expect(readFile(workspace.workspaceInputFile, "utf8")).resolves.toBe(
      "# Current draft\n"
    );
  });

  it("captures review output, discovers the unique new artifact, and normalizes it", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const runArtifacts = resolveRunArtifactPaths(temporaryRoot, "2026-run");
    const workspace = await createFreshReviewWorkspace(
      path.join(runArtifacts.runDirectory, "iter-1")
    );
    const manifest = createReviewRunningManifest(runArtifacts);

    await mkdir(path.join(runArtifacts.runDirectory, "iter-1"), { recursive: true });
    await writeRunManifest(
      runArtifacts.manifestFile,
      manifest,
      createNodeReviewFilesystem()
    );

    const runner = createRunner(async () => {
      await mkdir(workspace.outputsDirectory, { recursive: true });
      await writeFile(
        path.join(workspace.outputsDirectory, "draft-review.md"),
        "peer review\n",
        "utf8"
      );
    });

    const result = await executeReviewAndNormalize(
      {
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        reviewModel: "openai/gpt-5.4",
        reviewWorkspace: workspace,
        reviewLogFile: path.join(runArtifacts.runDirectory, "iter-1", "review.log"),
        normalizedReviewFile: path.join(runArtifacts.runDirectory, "iter-1", "review.md"),
        manifestPath: runArtifacts.manifestFile,
        iterationNumber: 1,
        failureTimestamp: "2026-04-23T08:00:00.000Z"
      },
      runner,
      createNodeReviewFilesystem()
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("Expected review execution to succeed.");
    }

    await expect(readFile(result.value.normalizedReviewFile, "utf8")).resolves.toBe(
      "peer review\n"
    );
    await expect(readFile(result.value.reviewLogFile, "utf8")).resolves.toContain(
      "--session-dir"
    );
    await expect(readFile(runArtifacts.manifestFile, "utf8")).resolves.toContain(
      "\"status\": \"review_running\""
    );
  });

  it("fails closed on a non-zero review exit and persists failed state", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const runArtifacts = resolveRunArtifactPaths(temporaryRoot, "2026-run");
    const manifest = createReviewRunningManifest(runArtifacts);

    await mkdir(path.join(runArtifacts.runDirectory, "iter-1"), { recursive: true });
    await writeRunManifest(
      runArtifacts.manifestFile,
      manifest,
      createNodeReviewFilesystem()
    );

    const workspace = await createFreshReviewWorkspace(
      path.join(runArtifacts.runDirectory, "iter-1")
    );
    const runner: FeynmanCommandRunner = {
      async run(
        executablePath: string,
        args: readonly string[]
      ): Promise<FeynmanCommandExecution> {
        return {
          executablePath,
          args,
          exitCode: 7,
          stdout: "",
          stderr: "review failed\n"
        };
      }
    };

    const result = await executeReviewAndNormalize(
      {
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        reviewModel: "openai/gpt-5.4",
        reviewWorkspace: workspace,
        reviewLogFile: path.join(runArtifacts.runDirectory, "iter-1", "review.log"),
        normalizedReviewFile: path.join(runArtifacts.runDirectory, "iter-1", "review.md"),
        manifestPath: runArtifacts.manifestFile,
        iterationNumber: 1,
        failureTimestamp: "2026-04-23T08:00:00.000Z"
      },
      runner,
      createNodeReviewFilesystem()
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected review execution to fail.");
    }
    expect(result.error.code).toBe("review_process_failed");

    const updatedManifest = await readRunManifest(
      runArtifacts.manifestFile,
      createNodeReviewFilesystem()
    );

    expect(updatedManifest.status).toBe("failed");
    expect(updatedManifest.lastError?.code).toBe("review_process_failed");
  });

  it("fails closed when artifact attribution remains ambiguous", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const runArtifacts = resolveRunArtifactPaths(temporaryRoot, "2026-run");
    const manifest = createReviewRunningManifest(runArtifacts);

    await mkdir(path.join(runArtifacts.runDirectory, "iter-1"), { recursive: true });
    await writeRunManifest(
      runArtifacts.manifestFile,
      manifest,
      createNodeReviewFilesystem()
    );

    const workspace = await createFreshReviewWorkspace(
      path.join(runArtifacts.runDirectory, "iter-1")
    );
    const runner = createRunner(async () => {
      await mkdir(workspace.outputsDirectory, { recursive: true });
      await writeFile(
        path.join(workspace.outputsDirectory, "a-review.md"),
        "first\n",
        "utf8"
      );
      await writeFile(
        path.join(workspace.outputsDirectory, "b-review.md"),
        "second\n",
        "utf8"
      );
    });

    const result = await executeReviewAndNormalize(
      {
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        reviewModel: "openai/gpt-5.4",
        reviewWorkspace: workspace,
        reviewLogFile: path.join(runArtifacts.runDirectory, "iter-1", "review.log"),
        normalizedReviewFile: path.join(runArtifacts.runDirectory, "iter-1", "review.md"),
        manifestPath: runArtifacts.manifestFile,
        iterationNumber: 1,
        failureTimestamp: "2026-04-23T08:00:00.000Z"
      },
      runner,
      createNodeReviewFilesystem()
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected review execution to fail.");
    }
    expect(result.error.code).toBe("review_artifact_ambiguous");

    const updatedManifest = await readRunManifest(
      runArtifacts.manifestFile,
      createNodeReviewFilesystem()
    );

    expect(updatedManifest.status).toBe("failed");
    expect(updatedManifest.lastError?.code).toBe("review_artifact_ambiguous");
  });

  it("rejects empty normalized review artifacts", async () => {
    const temporaryRoot = await createTemporaryRoot(temporaryRoots);
    const externalReviewFile = path.join(temporaryRoot, "draft-review.md");
    const normalizedReviewFile = path.join(temporaryRoot, "review.md");

    await writeFile(externalReviewFile, " \n", "utf8");

    const result = await normalizeReviewArtifact({
      externalReviewFile,
      normalizedReviewFile
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected normalization to fail.");
    }
    expect(result.error.code).toBe("review_artifact_unusable");
  });
});

async function createTemporaryRoot(temporaryRoots: string[]): Promise<string> {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-review-"));
  temporaryRoots.push(temporaryRoot);
  return temporaryRoot;
}

function createReviewRunningManifest(runArtifacts: ReturnType<typeof resolveRunArtifactPaths>) {
  return {
    ...createRunManifest({
      runId: "2026-run",
      slug: "draft",
      title: "Draft",
      sourceInputPath: "/tmp/draft.md",
      iterationsPlanned: 2,
      selectedModels: {
        review: "openai/gpt-5.4",
        refine: "gpt-5.4"
      },
      artifactPaths: runArtifacts,
      createdAt: "2026-04-23T07:59:00.000Z"
    }),
    status: "review_running" as const,
    phase: "review" as const,
    updatedAt: "2026-04-23T07:59:30.000Z",
    phaseMetadata: {
      currentIteration: 1,
      currentPhaseStartedAt: "2026-04-23T07:59:30.000Z"
    }
  };
}

function createRunner(
  onRun: () => Promise<void>
): FeynmanCommandRunner {
  return {
    async run(
      executablePath: string,
      args: readonly string[]
    ): Promise<FeynmanCommandExecution> {
      await onRun();

      return {
        executablePath,
        args,
        exitCode: 0,
        stdout: "review complete\n",
        stderr: ""
      };
    }
  };
}
