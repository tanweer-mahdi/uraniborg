import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { runRunCommand } from "../../src/cli/commands/run.js";
import { readRunManifest } from "../../src/run/manifest.js";
import { createOperationCancelledError } from "../../src/types/cancellation.js";
import type {
  FeynmanCommandExecution,
  FeynmanCommandRunner,
  PinnedFeynmanRuntimeStatus
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
        async inspectRuntime(): Promise<PinnedFeynmanRuntimeStatus> {
          return {
            ready: true,
            code: "ready",
            manifestPath: path.join(
              homeDirectory,
              ".uraniborg",
              "vendor",
              "feynman",
              "runtime.json"
            ),
            executablePath: "/tmp/feynman",
            expectedVersion: "1.2.3",
            detectedVersion: "1.2.3",
            warnings: []
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
          async inspectRuntime(): Promise<PinnedFeynmanRuntimeStatus> {
            return {
              ready: true,
              code: "ready",
              manifestPath: path.join(
                homeDirectory,
                ".uraniborg",
                "vendor",
                "feynman",
                "runtime.json"
              ),
              executablePath: "/tmp/feynman",
              expectedVersion: "1.2.3",
              detectedVersion: "1.2.3",
              warnings: []
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
