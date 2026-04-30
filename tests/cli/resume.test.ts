import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-ai", async () => {
  const actual = await vi.importActual<typeof import("@mariozechner/pi-ai")>(
    "@mariozechner/pi-ai"
  );

  return {
    ...actual,
    completeSimple: vi.fn()
  };
});

import { runResumeCommand } from "../../src/cli/commands/resume.js";
import { createRunManifest, readRunManifest, writeRunManifest } from "../../src/run/manifest.js";
import {
  resolveIterationArtifactPaths,
  resolveRunArtifactPaths
} from "../../src/run/artifact-store.js";
import type { FeynmanRuntimeStatus } from "../../src/review/index.js";
import { ok } from "../../src/types/result.js";
import { createResolvedTestUraniborgConfig } from "../helpers/uraniborg-config.js";
import { completeSimple } from "@mariozechner/pi-ai";

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

  it("resumes a failed refine-running managed revision without persisted provider session state", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-resume-"));
    temporaryRoots.push(temporaryRoot);

    const completeSimpleMock = vi.mocked(completeSimple);
    completeSimpleMock.mockResolvedValueOnce({
      role: "assistant",
      content: [
        {
          type: "text",
          text: `=== REFINED_DRAFT ===
# Draft

Managed revision improvement.

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Tighten the main claim

## Rejected reviewer points
- Add unsupported benchmark
Reason: Not available

## Changes made
- Reworked the framing

## Open issues
- Evaluation still needs evidence

## Regression guards
- Do not invent numbers`
        }
      ],
      api: "anthropic-messages",
      provider: "anthropic",
      model: "claude-sonnet-4-5",
      responseId: "msg_resume_1",
      usage: {
        input: 10,
        output: 20,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 30,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0
        }
      },
      stopReason: "stop",
      timestamp: Date.now()
    });

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
    let availableModelsCallCount = 0;
    let resolveManagedModelCallCount = 0;

    await mkdir(iterationArtifacts.iterationDirectory, { recursive: true });
    await writeFile(runArtifacts.originalDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.currentDraftFile, "# Draft\n\nInitial.\n", "utf8");
    await writeFile(runArtifacts.informationHighwayFile, "", "utf8");
    await writeFile(
      iterationArtifacts.reviewFile,
      "Peer review: tighten the main claim.\n",
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
            refine: "claude-sonnet-4-5"
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
          resumeFromStatus: "refine_running"
        },
        lastError: {
          code: "run_cancelled",
          message: "Interrupted during refinement.",
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
          return ok(
            createResolvedTestUraniborgConfig({
              profileId: "claude-browser",
              binding: {
                type: "pi-auth-storage",
                providerId: "anthropic"
              },
              providerContext: {
                accountId: "acct_123"
              },
              model: "claude-sonnet-4-5"
            })
          );
        },
        authClient: {
          async loginManagedCredential() {
            throw new Error("Resume should not trigger browser login.");
          },
          async resolveManagedCredential() {
            throw new Error("Resume should not resolve managed credential state directly.");
          },
          async resolveManagedModel(providerId, modelId) {
            resolveManagedModelCallCount += 1;
            expect(providerId).toBe("anthropic");
            expect(modelId).toBe("claude-sonnet-4-5");

            return ok({
              providerId,
              model: {
                id: modelId,
                name: modelId,
                provider: providerId,
                api: "anthropic-messages",
                baseUrl: "https://api.anthropic.com",
                input: ["text"],
                reasoning: true,
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0
                },
                contextWindow: 200000,
                maxTokens: 8192
              },
              apiKey: "oauth-token",
              headers: {
                "x-test": "managed"
              }
            });
          },
          listAvailableModelIds() {
            availableModelsCallCount += 1;
            return ["claude-sonnet-4-5"];
          }
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

    expect(availableModelsCallCount).toBe(1);
    expect(resolveManagedModelCallCount).toBe(1);
    expect(completeSimpleMock).toHaveBeenCalledTimes(1);
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
