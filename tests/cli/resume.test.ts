import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runResumeCommand } from "../../src/cli/commands/resume.js";
import { createRunManifest, readRunManifest, writeRunManifest } from "../../src/run/manifest.js";
import {
  resolveIterationArtifactPaths,
  resolveRunArtifactPaths
} from "../../src/run/artifact-store.js";
import type { FeynmanRuntimeStatus } from "../../src/review/index.js";
import { ok } from "../../src/types/result.js";
import { createResolvedTestUraniborgConfig } from "../helpers/uraniborg-config.js";

describe("runResumeCommand", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
  });

  it("repairs memory update from existing iteration artifacts", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "2026-04-24T00-00-00Z-idea"
    );
    const iterationArtifacts = resolveIterationArtifactPaths(
      runArtifacts.runDirectory,
      1
    );

    await mkdir(iterationArtifacts.iterationDirectory, { recursive: true });
    await writeFile(runArtifacts.originalDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.currentDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.informationHighwayFile, "", "utf8");
    await writeFile(
      iterationArtifacts.refinedDraftFile,
      "# Draft\n\nImproved.\n",
      "utf8"
    );
    await writeFile(
      iterationArtifacts.changesFile,
      `## Accepted reviewer points
- Clarify the claim

## Rejected reviewer points
- Add unsupported benchmark
Reason: Not available

## Changes made
- Reframed the introduction

## Open issues
- Evaluation remains thin

## Regression guards
- Do not invent numbers`,
      "utf8"
    );

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "2026-04-24T00-00-00Z-idea",
          slug: "idea",
          title: "Idea",
          sourceInputPath: "/tmp/idea.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "memory_update",
        phase: "memory",
        updatedAt: "2026-04-24T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:10:00.000Z"
        }
      }
    );

    await runResumeCommand(
      "2026-04-24T00-00-00Z-idea",
      {
        nonInteractive: true
      },
      {
        environment: {
          OPENAI_API_KEY: "secret"
        },
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
        async loadConfig() {
          return ok(createResolvedConfig());
        },
        async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
          return {
            ready: true,
            code: "ready",
            executablePath: "/tmp/feynman",
            detectedVersion: "1.2.3",
            warnings: [],
            candidates: [
              {
                executablePath: "/tmp/feynman",
                compatible: true,
                detectedVersion: "1.2.3",
                details: ["Version: 1.2.3"]
              }
            ]
          };
        },
        async listModels() {
          return {
            executablePath: "/tmp/feynman",
            args: ["model", "list"],
            exitCode: 0,
            stdout: JSON.stringify(["openai/gpt-5.4"]),
            stderr: ""
          };
        },
        async getAlphaStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["alpha", "status"],
            exitCode: 0,
            stdout: "AlphaXiv ready",
            stderr: ""
          };
        },
        async getSearchStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["search", "status"],
            exitCode: 0,
            stdout: "Web search ready",
            stderr: ""
          };
        },
        async ensureAppHome(paths) {
          await mkdir(paths.appHomeDirectory, { recursive: true });
          await mkdir(paths.vendorDirectory, { recursive: true });
          await mkdir(paths.feynmanRuntimeDirectory, { recursive: true });
          await mkdir(paths.runsDirectory, { recursive: true });

          return {
            paths,
            appHome: {
              kind: "directory",
              path: paths.appHomeDirectory
            },
            vendor: {
              kind: "directory",
              path: paths.vendorDirectory
            },
            feynmanRuntime: {
              kind: "directory",
              path: paths.feynmanRuntimeDirectory
            },
            runs: {
              kind: "directory",
              path: paths.runsDirectory
            },
            isLayoutValid: true
          };
        },
        writeLine() {
          return undefined;
        }
      }
    );

    const manifest = await readRunManifest(runArtifacts.manifestFile);

    expect(manifest.status).toBe("finished");
    expect(manifest.iterationsCompleted).toBe(1);
    await expect(
      readRunManifest(runArtifacts.manifestFile)
    ).resolves.toMatchObject({
      status: "finished"
    });
  });

  it("rejects resume for finished runs", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "2026-04-24T00-00-00Z-idea"
    );

    await mkdir(runArtifacts.runDirectory, { recursive: true });

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "2026-04-24T00-00-00Z-idea",
          slug: "idea",
          title: "Idea",
          sourceInputPath: "/tmp/idea.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "finished",
        phase: "completed",
        iterationsCompleted: 1,
        updatedAt: "2026-04-24T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:10:00.000Z"
        }
      }
    );

    await expect(
      runResumeCommand(
        "2026-04-24T00-00-00Z-idea",
        {
          nonInteractive: true
        },
        {
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
          writeLine() {
            return undefined;
          }
        }
      )
    ).rejects.toThrow("already finished");
  });

  it("rejects resume for failed runs without a recorded resumable phase", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "2026-04-24T00-00-00Z-idea"
    );

    await mkdir(runArtifacts.runDirectory, { recursive: true });

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "2026-04-24T00-00-00Z-idea",
          slug: "idea",
          title: "Idea",
          sourceInputPath: "/tmp/idea.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "failed",
        phase: "failed",
        updatedAt: "2026-04-24T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:10:00.000Z"
        },
        lastError: {
          code: "review_failed",
          message: "Review failed.",
          timestamp: "2026-04-24T00:10:00.000Z"
        }
      }
    );

    await expect(
      runResumeCommand(
        "2026-04-24T00-00-00Z-idea",
        {
          nonInteractive: true
        },
        {
          environment: {
            OPENAI_API_KEY: "secret"
          },
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
          async loadConfig() {
            return ok(createResolvedConfig());
          },
          async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
            return {
              ready: true,
              code: "ready",
              executablePath: "/tmp/feynman",
              detectedVersion: "1.2.3",
              warnings: [],
              candidates: [
                {
                  executablePath: "/tmp/feynman",
                  compatible: true,
                  detectedVersion: "1.2.3",
                  details: ["Version: 1.2.3"]
                }
              ]
            };
          },
          async listModels() {
            return {
              executablePath: "/tmp/feynman",
              args: ["model", "list"],
              exitCode: 0,
              stdout: JSON.stringify(["openai/gpt-5.4"]),
              stderr: ""
            };
          },
          async getAlphaStatus() {
            return {
              executablePath: "/tmp/feynman",
              args: ["alpha", "status"],
              exitCode: 0,
              stdout: "AlphaXiv ready",
              stderr: ""
            };
          },
          async getSearchStatus() {
            return {
              executablePath: "/tmp/feynman",
              args: ["search", "status"],
              exitCode: 0,
              stdout: "Web search ready",
              stderr: ""
            };
          },
          async ensureAppHome(paths) {
            await mkdir(paths.appHomeDirectory, { recursive: true });
            await mkdir(paths.vendorDirectory, { recursive: true });
            await mkdir(paths.feynmanRuntimeDirectory, { recursive: true });
            await mkdir(paths.runsDirectory, { recursive: true });

            return {
              paths,
              appHome: {
                kind: "directory",
                path: paths.appHomeDirectory
              },
              vendor: {
                kind: "directory",
                path: paths.vendorDirectory
              },
              feynmanRuntime: {
                kind: "directory",
                path: paths.feynmanRuntimeDirectory
              },
              runs: {
                kind: "directory",
                path: paths.runsDirectory
              },
              isLayoutValid: true
            };
          },
          writeLine() {
            return undefined;
          }
        }
      )
    ).rejects.toThrow("does not record a resumable phase");
  });

  it("resumes a failed memory-update run using the recorded resumable phase", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "2026-04-24T00-00-00Z-idea"
    );
    const iterationArtifacts = resolveIterationArtifactPaths(
      runArtifacts.runDirectory,
      1
    );

    await mkdir(iterationArtifacts.iterationDirectory, { recursive: true });
    await writeFile(runArtifacts.originalDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.currentDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.informationHighwayFile, "", "utf8");
    await writeFile(
      iterationArtifacts.refinedDraftFile,
      "# Draft\n\nImproved.\n",
      "utf8"
    );
    await writeFile(
      iterationArtifacts.changesFile,
      `## Accepted reviewer points
- Clarify the claim

## Rejected reviewer points
- Add unsupported benchmark
Reason: Not available

## Changes made
- Reframed the introduction

## Open issues
- Evaluation remains thin

## Regression guards
- Do not invent numbers`,
      "utf8"
    );

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "2026-04-24T00-00-00Z-idea",
          slug: "idea",
          title: "Idea",
          sourceInputPath: "/tmp/idea.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "failed",
        phase: "failed",
        updatedAt: "2026-04-24T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:10:00.000Z",
          resumeFromStatus: "memory_update"
        },
        lastError: {
          code: "run_cancelled",
          message: "Interrupted during memory update.",
          timestamp: "2026-04-24T00:10:00.000Z"
        }
      }
    );

    await runResumeCommand(
      "2026-04-24T00-00-00Z-idea",
      {
        nonInteractive: true
      },
      {
        environment: {
          OPENAI_API_KEY: "secret"
        },
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
        async loadConfig() {
          return ok(createResolvedConfig());
        },
        async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
          return {
            ready: true,
            code: "ready",
            executablePath: "/tmp/feynman",
            detectedVersion: "1.2.3",
            warnings: [],
            candidates: [
              {
                executablePath: "/tmp/feynman",
                compatible: true,
                detectedVersion: "1.2.3",
                details: ["Version: 1.2.3"]
              }
            ]
          };
        },
        async listModels() {
          return {
            executablePath: "/tmp/feynman",
            args: ["model", "list"],
            exitCode: 0,
            stdout: JSON.stringify(["openai/gpt-5.4"]),
            stderr: ""
          };
        },
        async getAlphaStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["alpha", "status"],
            exitCode: 0,
            stdout: "AlphaXiv ready",
            stderr: ""
          };
        },
        async getSearchStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["search", "status"],
            exitCode: 0,
            stdout: "Web search ready",
            stderr: ""
          };
        },
        async ensureAppHome(paths) {
          await mkdir(paths.appHomeDirectory, { recursive: true });
          await mkdir(paths.vendorDirectory, { recursive: true });
          await mkdir(paths.feynmanRuntimeDirectory, { recursive: true });
          await mkdir(paths.runsDirectory, { recursive: true });

          return {
            paths,
            appHome: {
              kind: "directory",
              path: paths.appHomeDirectory
            },
            vendor: {
              kind: "directory",
              path: paths.vendorDirectory
            },
            feynmanRuntime: {
              kind: "directory",
              path: paths.feynmanRuntimeDirectory
            },
            runs: {
              kind: "directory",
              path: paths.runsDirectory
            },
            isLayoutValid: true
          };
        },
        writeLine() {
          return undefined;
        }
      }
    );

    await expect(
      readRunManifest(runArtifacts.manifestFile)
    ).resolves.toMatchObject({
      status: "finished",
      iterationsCompleted: 1
    });
  });

  it("resumes a cancelled memory-update run using the recorded resumable phase", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const homeDirectory = path.join(temporaryRoot, "home");
    const runsDirectory = path.join(homeDirectory, ".uraniborg", "runs");
    const runArtifacts = resolveRunArtifactPaths(
      runsDirectory,
      "2026-04-24T00-00-00Z-idea"
    );
    const iterationArtifacts = resolveIterationArtifactPaths(
      runArtifacts.runDirectory,
      1
    );

    await mkdir(iterationArtifacts.iterationDirectory, { recursive: true });
    await writeFile(runArtifacts.originalDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.currentDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.informationHighwayFile, "", "utf8");
    await writeFile(
      iterationArtifacts.refinedDraftFile,
      "# Draft\n\nImproved after cancellation.\n",
      "utf8"
    );
    await writeFile(
      iterationArtifacts.changesFile,
      `## Accepted reviewer points
- Clarify the claim

## Rejected reviewer points
- Add unsupported benchmark
Reason: Not available

## Changes made
- Reframed the introduction

## Open issues
- Evaluation remains thin

## Regression guards
- Do not invent numbers`,
      "utf8"
    );

    await writeRunManifest(
      runArtifacts.manifestFile,
      {
        ...createRunManifest({
          runId: "2026-04-24T00-00-00Z-idea",
          slug: "idea",
          title: "Idea",
          sourceInputPath: "/tmp/idea.md",
          iterationsPlanned: 1,
          selectedModels: {
            review: "openai/gpt-5.4",
            refine: "gpt-5.4"
          },
          artifactPaths: runArtifacts,
          createdAt: "2026-04-24T00:00:00.000Z"
        }),
        status: "cancelled",
        phase: "cancelled",
        updatedAt: "2026-04-24T00:10:00.000Z",
        phaseMetadata: {
          currentIteration: 1,
          currentPhaseStartedAt: "2026-04-24T00:10:00.000Z",
          resumeFromStatus: "memory_update"
        },
        lastError: {
          code: "run_cancelled",
          message: "Interrupted during memory update.",
          timestamp: "2026-04-24T00:10:00.000Z"
        }
      }
    );

    await runResumeCommand(
      "2026-04-24T00-00-00Z-idea",
      {
        nonInteractive: true
      },
      {
        environment: {
          OPENAI_API_KEY: "secret"
        },
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
        async loadConfig() {
          return ok(createResolvedConfig());
        },
        async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
          return {
            ready: true,
            code: "ready",
            executablePath: "/tmp/feynman",
            detectedVersion: "1.2.3",
            warnings: [],
            candidates: [
              {
                executablePath: "/tmp/feynman",
                compatible: true,
                detectedVersion: "1.2.3",
                details: ["Version: 1.2.3"]
              }
            ]
          };
        },
        async listModels() {
          return {
            executablePath: "/tmp/feynman",
            args: ["model", "list"],
            exitCode: 0,
            stdout: JSON.stringify(["openai/gpt-5.4"]),
            stderr: ""
          };
        },
        async getAlphaStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["alpha", "status"],
            exitCode: 0,
            stdout: "AlphaXiv ready",
            stderr: ""
          };
        },
        async getSearchStatus() {
          return {
            executablePath: "/tmp/feynman",
            args: ["search", "status"],
            exitCode: 0,
            stdout: "Web search ready",
            stderr: ""
          };
        },
        async ensureAppHome(paths) {
          await mkdir(paths.appHomeDirectory, { recursive: true });
          await mkdir(paths.vendorDirectory, { recursive: true });
          await mkdir(paths.feynmanRuntimeDirectory, { recursive: true });
          await mkdir(paths.runsDirectory, { recursive: true });

          return {
            paths,
            appHome: {
              kind: "directory",
              path: paths.appHomeDirectory
            },
            vendor: {
              kind: "directory",
              path: paths.vendorDirectory
            },
            feynmanRuntime: {
              kind: "directory",
              path: paths.feynmanRuntimeDirectory
            },
            runs: {
              kind: "directory",
              path: paths.runsDirectory
            },
            isLayoutValid: true
          };
        },
        writeLine() {
          return undefined;
        }
      }
    );

    await expect(
      readRunManifest(runArtifacts.manifestFile)
    ).resolves.toMatchObject({
      status: "finished",
      iterationsCompleted: 1
    });
  });
});

function createResolvedConfig() {
  return createResolvedTestUraniborgConfig({
    profileId: "manual-openai-compatible",
    binding: {
      type: "env-var",
      envVar: "OPENAI_API_KEY",
      resolvedApiKey: "secret"
    },
    model: "gpt-5.4",
    baseUrl: "https://api.example.com/v1"
  });
}
