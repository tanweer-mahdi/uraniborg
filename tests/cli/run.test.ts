import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  prepareRunEnvironment,
  runRunCommand,
  type RunPrompts
} from "../../src/cli/commands/run.js";
import { readRunManifest } from "../../src/run/manifest.js";
import { createOperationCancelledError } from "../../src/types/cancellation.js";
import type {
  FeynmanCommandExecution,
  FeynmanCommandRunner,
  FeynmanRuntimeStatus
} from "../../src/review/index.js";
import { ok } from "../../src/types/result.js";

describe("runRunCommand", () => {
  const temporaryRoots: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryRoots.map(async (temporaryRoot) => {
        await rm(temporaryRoot, { recursive: true, force: true });
      })
    );
    temporaryRoots.length = 0;
  });

  it("executes a one-iteration non-interactive run and writes canonical artifacts", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-run-"));
    temporaryRoots.push(temporaryRoot);

    const sourceFile = path.join(temporaryRoot, "idea.md");
    await writeFile(sourceFile, "# Draft\n\nInitial argument.\n", "utf8");

    const homeDirectory = path.join(temporaryRoot, "home");
    const runner = createReviewRunner();
    const outputs: string[] = [];

    await runRunCommand(
      sourceFile,
      {
        iterations: "1",
        reviewModel: "openai/gpt-5.4",
        refineModel: "gpt-5.4",
        nonInteractive: true
      },
      {
        cwd: temporaryRoot,
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
            runsDirectory: path.join(homeDirectory, ".uraniborg", "runs")
          };
        },
        async loadConfig() {
          return ok({
            version: 1,
            refine: {
              endpoint: {
                baseUrl: "https://api.example.com/v1",
                apiKeyEnvVar: "OPENAI_API_KEY",
                apiKey: "secret",
                timeoutMs: 60000
              },
              defaults: {
                model: "gpt-5.4",
                temperature: 0.2
              }
            }
          });
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
          return createExecution({
            args: ["model", "list"],
            stdout: JSON.stringify(["openai/gpt-5.4"])
          });
        },
        async getAlphaStatus() {
          return createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv ready"
          });
        },
        async getSearchStatus() {
          return createExecution({
            args: ["search", "status"],
            stdout: "Web search ready"
          });
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
        httpClient: {
          async fetch() {
            return {
              ok: true,
              status: 200,
              async text() {
                return JSON.stringify({
                  id: "resp-1",
                  model: "gpt-5.4",
                  choices: [
                    {
                      message: {
                        content: `=== REFINED_DRAFT ===
# Draft

Improved argument.

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Clarify the core claim

## Rejected reviewer points
- Add invented experiment
Reason: Unsupported by available material

## Changes made
- Rewrote the abstract and framing

## Open issues
- Evaluation remains incomplete

## Regression guards
- Do not add unsupported quantitative claims`
                      }
                    }
                  ]
                });
              }
            };
          }
        },
        runner,
        clock: {
          now() {
            return new Date("2026-04-24T00:00:00.000Z");
          }
        },
        writeLine(message) {
          outputs.push(message);
        }
      }
    );

    const runDirectory = path.join(
      homeDirectory,
      ".uraniborg",
      "runs",
      "2026-04-24T00-00-00Z-idea"
    );
    const manifest = await readRunManifest(path.join(runDirectory, "run.json"));

    expect(manifest.status).toBe("finished");
    expect(manifest.iterationsCompleted).toBe(1);
    await expect(readFile(path.join(runDirectory, "original.md"), "utf8")).resolves.toContain(
      "Initial argument."
    );
    await expect(readFile(path.join(runDirectory, "current.md"), "utf8")).resolves.toContain(
      "Improved argument."
    );
    await expect(readFile(path.join(runDirectory, "final.md"), "utf8")).resolves.toContain(
      "Improved argument."
    );
    await expect(
      readFile(path.join(runDirectory, "information-highway.md"), "utf8")
    ).resolves.toContain("## Iteration 1");
    await expect(
      readFile(path.join(runDirectory, "iter-1", "review.md"), "utf8")
    ).resolves.toContain("peer review");
    await expect(
      readFile(path.join(runDirectory, "iter-1", "refine.log"), "utf8")
    ).resolves.toContain("=== REQUEST BODY ===");
    expect(outputs).toContain("Run complete.");
  });

  it("rejects non-markdown input before creating run artifacts", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-run-"));
    temporaryRoots.push(temporaryRoot);

    const sourceFile = path.join(temporaryRoot, "idea.txt");
    await writeFile(sourceFile, "plain text", "utf8");

    await expect(
      runRunCommand(
        sourceFile,
        {
          nonInteractive: true
        },
        {
          cwd: temporaryRoot
        }
      )
    ).rejects.toThrow("Run input must be a Markdown file.");
  });

  it("persists cancelled state when review execution is interrupted", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-run-"));
    temporaryRoots.push(temporaryRoot);

    const sourceFile = path.join(temporaryRoot, "idea.md");
    await writeFile(sourceFile, "# Draft\n\nInitial argument.\n", "utf8");

    const homeDirectory = path.join(temporaryRoot, "home");

    await expect(
      runRunCommand(
        sourceFile,
        {
          iterations: "1",
          reviewModel: "openai/gpt-5.4",
          refineModel: "gpt-5.4",
          nonInteractive: true
        },
        {
          cwd: temporaryRoot,
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
              runsDirectory: path.join(homeDirectory, ".uraniborg", "runs")
            };
          },
          async loadConfig() {
            return ok({
              version: 1,
              refine: {
                endpoint: {
                  baseUrl: "https://api.example.com/v1",
                  apiKeyEnvVar: "OPENAI_API_KEY",
                  apiKey: "secret",
                  timeoutMs: 60000
                },
                defaults: {
                  model: "gpt-5.4",
                  temperature: 0.2
                }
              }
            });
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
            return createExecution({
              args: ["model", "list"],
              stdout: JSON.stringify(["openai/gpt-5.4"])
            });
          },
          async getAlphaStatus() {
            return createExecution({
              args: ["alpha", "status"],
              stdout: "AlphaXiv ready"
            });
          },
          async getSearchStatus() {
            return createExecution({
              args: ["search", "status"],
              stdout: "Web search ready"
            });
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
          runner: {
            async run(): Promise<FeynmanCommandExecution> {
              throw createOperationCancelledError(
                "Pinned Feynman command cancelled."
              );
            }
          },
          clock: {
            now() {
              return new Date("2026-04-24T00:00:00.000Z");
            }
          },
          writeLine() {
            return undefined;
          }
        }
      )
    ).rejects.toThrow("Uraniborg run cancelled. Resume with:");

    const runDirectory = path.join(
      homeDirectory,
      ".uraniborg",
      "runs",
      "2026-04-24T00-00-00Z-idea"
    );
    const manifest = await readRunManifest(path.join(runDirectory, "run.json"));

    expect(manifest.status).toBe("cancelled");
    expect(manifest.phaseMetadata.resumeFromStatus).toBe("review_running");
    await expect(
      readFile(path.join(runDirectory, "iter-1", "review.log"), "utf8")
    ).resolves.toContain("Pinned Feynman command cancelled.");
  });

  it("carries information-highway memory and iteration input forward across multiple iterations", async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), "uraniborg-run-"));
    temporaryRoots.push(temporaryRoot);

    const sourceFile = path.join(temporaryRoot, "idea.md");
    await writeFile(sourceFile, "# Draft\n\nInitial argument.\n", "utf8");

    const homeDirectory = path.join(temporaryRoot, "home");
    const requestBodies: string[] = [];
    let reviewInvocationCount = 0;

    await runRunCommand(
      sourceFile,
      {
        iterations: "2",
        reviewModel: "openai/gpt-5.4",
        refineModel: "gpt-5.4",
        nonInteractive: true
      },
      {
        cwd: temporaryRoot,
        environment: {
          OPENAI_API_KEY: "secret"
        },
        resolvePaths() {
          return createPaths(homeDirectory);
        },
        async loadConfig() {
          return ok(createResolvedConfig());
        },
        async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
          return createReadyRuntimeStatus(homeDirectory);
        },
        async listModels() {
          return createExecution({
            args: ["model", "list"],
            stdout: JSON.stringify(["openai/gpt-5.4"])
          });
        },
        async getAlphaStatus() {
          return createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv ready"
          });
        },
        async getSearchStatus() {
          return createExecution({
            args: ["search", "status"],
            stdout: "Web search ready"
          });
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
        httpClient: {
          async fetch(_requestUrl, init) {
            requestBodies.push(init.body);
            const iterationNumber = requestBodies.length;

            return {
              ok: true,
              status: 200,
              async text() {
                return JSON.stringify({
                  id: `resp-${iterationNumber}`,
                  model: "gpt-5.4",
                  choices: [
                    {
                      message: {
                        content: `=== REFINED_DRAFT ===
# Draft

Iteration ${iterationNumber} revision.

=== CHANGE_SUMMARY ===
## Accepted reviewer points
- Address review point ${iterationNumber}

## Rejected reviewer points
- Reject unsupported ask ${iterationNumber}
Reason: Unsupported by available material

## Changes made
- Applied iteration ${iterationNumber} revision

## Open issues
- Open issue ${iterationNumber}

## Regression guards
- Guard ${iterationNumber}`
                      }
                    }
                  ]
                });
              }
            };
          }
        },
        runner: {
          async run(
            executablePath: string,
            args: readonly string[]
          ): Promise<FeynmanCommandExecution> {
            reviewInvocationCount += 1;
            const cwdIndex = args.indexOf("--cwd");
            const workspaceDirectory =
              cwdIndex >= 0 ? args[cwdIndex + 1] : undefined;

            if (typeof workspaceDirectory !== "string") {
              throw new Error("Expected --cwd in review invocation.");
            }

            const outputsDirectory = path.join(workspaceDirectory, "outputs");
            await mkdir(outputsDirectory, { recursive: true });
            await writeFile(
              path.join(outputsDirectory, `idea-${reviewInvocationCount}-review.md`),
              `peer review ${reviewInvocationCount}\n`,
              "utf8"
            );

            return {
              executablePath,
              args,
              exitCode: 0,
              stdout: "review complete\n",
              stderr: ""
            };
          }
        },
        clock: {
          now() {
            return new Date("2026-04-24T00:00:00.000Z");
          }
        },
        writeLine() {
          return undefined;
        }
      }
    );

    const runDirectory = path.join(
      homeDirectory,
      ".uraniborg",
      "runs",
      "2026-04-24T00-00-00Z-idea"
    );

    expect(requestBodies).toHaveLength(2);
    expect(requestBodies[0]).toContain("INFORMATION_HIGHWAY\\n");
    expect(requestBodies[1]).toContain("## Iteration 1");
    expect(requestBodies[1]).toContain("Guard 1");
    await expect(
      readFile(path.join(runDirectory, "iter-2", "input.md"), "utf8")
    ).resolves.toContain("Iteration 1 revision.");
    await expect(
      readFile(path.join(runDirectory, "information-highway.md"), "utf8")
    ).resolves.toContain("## Iteration 2");
    await expect(readFile(path.join(runDirectory, "final.md"), "utf8")).resolves.toContain(
      "Iteration 2 revision."
    );
  });
});

describe("prepareRunEnvironment", () => {
  it("reports incompatible runtime failures without launching remediation", async () => {
    const lines: string[] = [];
    const launchedCommands: Array<{
      executablePath: string;
      args: readonly string[];
    }> = [];
    await expect(
      prepareRunEnvironment(
        {
          reviewModel: "openai/gpt-5.4",
          refineModel: "gpt-5.4"
        },
        {
          environment: {
            OPENAI_API_KEY: "secret"
          },
          interactive: true,
          prompts: createInteractivePrompts([true]),
          resolvePaths() {
            return createPaths("/tmp/alice");
          },
          async ensureAppHome(paths) {
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
          async loadConfig() {
            return ok(createResolvedConfig());
          },
          async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
            return {
              ready: false,
              code: "runtime_incompatible",
              warnings: [],
              candidates: [
                {
                  executablePath: "/tmp/alice/.local/bin/feynman",
                  compatible: false,
                  failureCode: "version_unreadable",
                  details: ["Exit code: 0", "stdout: not-a-version"]
                }
              ]
            };
          },
          async listModels() {
            throw new Error("listModels should not run when runtime is incompatible");
          },
          async getAlphaStatus() {
            throw new Error("getAlphaStatus should not run when runtime is incompatible");
          },
          async getSearchStatus() {
            throw new Error("getSearchStatus should not run when runtime is incompatible");
          },
          runner: createReviewRunner(),
          launcher: {
            async launch(executablePath, args) {
              launchedCommands.push({
                executablePath,
                args
              });

              return {
                exitCode: 0
              };
            }
          },
          writeLine(message) {
            lines.push(message);
          }
        }
      )
    ).rejects.toThrow("Discovered Feynman runtimes are incompatible with Uraniborg.");

    expect(launchedCommands).toEqual([]);
    expect(lines).not.toContain(
      "Launching Feynman setup via the selected Feynman runtime..."
    );
  });

  it("warns on recommended readiness gaps without blocking non-interactive preflight", async () => {
    const lines: string[] = [];

    const prepared = await prepareRunEnvironment(
      {
        reviewModel: "openai/gpt-5.4",
        refineModel: "gpt-5.4",
        nonInteractive: true
      },
      {
        environment: {
          OPENAI_API_KEY: "secret"
        },
        interactive: false,
        prompts: createInteractivePrompts([]),
        resolvePaths() {
          return createPaths("/tmp/alice");
        },
        async ensureAppHome(paths) {
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
        async loadConfig() {
          return ok(createResolvedConfig());
        },
        async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
          return createReadyRuntimeStatus("/tmp/alice");
        },
        async listModels() {
          return createExecution({
            args: ["model", "list"],
            stdout: JSON.stringify(["openai/gpt-5.4"])
          });
        },
        async getAlphaStatus() {
          return createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv not configured"
          });
        },
        async getSearchStatus() {
          return createExecution({
            args: ["search", "status"],
            stdout: "Web search not configured"
          });
        },
        runner: createReviewRunner(),
        launcher: {
          async launch() {
            return {
              exitCode: 0
            };
          }
        },
        writeLine(message) {
          lines.push(message);
        }
      }
    );

    expect(prepared.selectedModels).toEqual({
      review: "openai/gpt-5.4",
      refine: "gpt-5.4"
    });
    expect(prepared.readinessReport.requiredReady).toBe(true);
    expect(prepared.readinessReport.recommendedReady).toBe(false);
    expect(lines).toContain(
      "[warn] AlphaXiv is not configured. Latest-paper and paper-metadata access may be weaker."
    );
    expect(lines).toContain(
      "[warn] Web search is not configured. Latest web research coverage may be weaker."
    );
  });
});

function createExecution(options: {
  args: readonly string[];
  stdout: string;
  stderr?: string;
  exitCode?: number;
}): FeynmanCommandExecution {
  return {
    executablePath: "/tmp/feynman",
    args: options.args,
    exitCode: options.exitCode ?? 0,
    stdout: options.stdout,
    stderr: options.stderr ?? ""
  };
}

function createReadyRuntimeStatus(
  homeDirectory: string
): FeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    executablePath: path.join(
      homeDirectory,
      ".uraniborg",
      "vendor",
      "feynman",
      "bin",
      "feynman"
    ),
    detectedVersion: "1.2.3",
    warnings: [],
    candidates: [
      {
        executablePath: path.join(
          homeDirectory,
          ".uraniborg",
          "vendor",
          "feynman",
          "bin",
          "feynman"
        ),
        compatible: true,
        detectedVersion: "1.2.3",
        details: ["Version: 1.2.3"]
      }
    ]
  };
}

function createPaths(homeDirectory: string) {
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
}

function createResolvedConfig() {
  return {
    version: 1 as const,
    refine: {
      endpoint: {
        baseUrl: "https://api.example.com/v1",
        apiKeyEnvVar: "OPENAI_API_KEY",
        apiKey: "secret",
        timeoutMs: 60000
      },
      defaults: {
        model: "gpt-5.4",
        temperature: 0.2
      }
    }
  };
}

function createInteractivePrompts(
  confirmResponses: boolean[]
): RunPrompts {
  const remainingResponses = [...confirmResponses];

  return {
    async confirm() {
      const response = remainingResponses.shift();

      if (typeof response !== "boolean") {
        throw new Error("Unexpected confirmation prompt.");
      }

      return response;
    },
    cancel() {
      return undefined;
    },
    isCancel(_value: unknown): _value is symbol {
      return false;
    },
    async select() {
      throw new Error("Select prompt was not expected.");
    },
    async text() {
      throw new Error("Text prompt was not expected.");
    }
  };
}

function createReviewRunner(): FeynmanCommandRunner {
  return {
    async run(
      executablePath: string,
      args: readonly string[]
    ): Promise<FeynmanCommandExecution> {
      const cwdIndex = args.indexOf("--cwd");
      const workspaceDirectory =
        cwdIndex >= 0 ? args[cwdIndex + 1] : undefined;

      if (typeof workspaceDirectory !== "string") {
        throw new Error("Expected --cwd in review invocation.");
      }

      const outputsDirectory = path.join(workspaceDirectory, "outputs");
      await mkdir(outputsDirectory, { recursive: true });
      await writeFile(
        path.join(outputsDirectory, "idea-review.md"),
        "peer review\n",
        "utf8"
      );

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
