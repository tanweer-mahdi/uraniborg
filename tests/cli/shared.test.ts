import { describe, expect, it } from "vitest";

import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { promptAndRunRemediations } from "../../src/cli/commands/shared.js";
import {
  createSearchConfigurationRemediationAction,
  type FeynmanCommandExecution,
  type FeynmanRuntimeStatus
} from "../../src/review/index.js";
import { ok } from "../../src/types/result.js";
import type { UraniborgAppHomeStatus } from "../../src/config/index.js";

describe("promptAndRunRemediations", () => {
  it("launches the dedicated web-search command after provider selection", async () => {
    const launchedCommands: Array<{
      executablePath: string;
      args: readonly string[];
    }> = [];
    const lines: string[] = [];

    await promptAndRunRemediations({
      executablePath: "/tmp/alice/.local/bin/feynman",
      actions: [
        createSearchConfigurationRemediationAction(
          "Configure web-search providers for fresher web research coverage."
        )
      ],
      dependencies: {
        interactive: true,
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
        prompts: createSearchPrompts({
          confirmResponses: [true],
          selectResponses: ["exa"],
          textResponses: [""]
        }),
        writeLine(message) {
          lines.push(message);
        }
      }
    });

    expect(launchedCommands).toEqual([
      {
        executablePath: "/tmp/alice/.local/bin/feynman",
        args: ["search", "set", "exa"]
      }
    ]);
    expect(lines).toContain(
      'Launching Feynman web-search provider configuration for "exa" via the selected Feynman runtime...'
    );
    expect(lines).toContain(
      'Feynman web-search provider configuration for "exa" completed successfully.'
    );
    expect(lines.some((line) => line.includes("exit code"))).toBe(false);
  });

  it("reports remediation failure without raw process metadata", async () => {
    const lines: string[] = [];

    await promptAndRunRemediations({
      executablePath: "/tmp/alice/.local/bin/feynman",
      actions: [
        createSearchConfigurationRemediationAction(
          "Configure web-search providers for fresher web research coverage."
        )
      ],
      dependencies: {
        interactive: true,
        launcher: {
          async launch() {
            return {
              exitCode: 1
            };
          }
        },
        prompts: createSearchPrompts({
          confirmResponses: [true],
          selectResponses: ["auto"],
          textResponses: []
        }),
        writeLine(message) {
          lines.push(message);
        }
      }
    });

    expect(lines).toContain(
      "Feynman web-search provider configuration for \"auto\" did not complete successfully. Review the Feynman prompt and rerun the command if more setup is still required."
    );
    expect(lines.some((line) => line.includes("exit code"))).toBe(false);
    expect(lines.some((line) => line.includes("stdout"))).toBe(false);
    expect(lines.some((line) => line.includes("stderr"))).toBe(false);
  });
});

describe("runDoctorCommand", () => {
  it("offers proactive web-search provider management when search is already ready", async () => {
    const confirmMessages: string[] = [];
    const confirmInitialValues: boolean[] = [];

    await runDoctorCommand({
      interactive: true,
      resolvePaths() {
        return createPaths();
      },
      async ensureAppHome() {
        return createAppHomeStatus();
      },
      async inspectRuntime() {
        return createReadyRuntimeStatus();
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
      async loadConfig() {
        return ok({
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://api.example.com/v1",
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
      prompts: {
        async confirm(options) {
          confirmMessages.push(options.message);
          confirmInitialValues.push(options.initialValue ?? false);
          return false;
        },
        cancel() {
          return undefined;
        },
        isCancel(_value: unknown): _value is symbol {
          return false;
        },
        async select<Value>(options: {
          options: readonly { value: Value }[];
        }): Promise<symbol | Value> {
          throw new Error("Search provider selection should not run when confirmation is declined.");
        },
        async text() {
          throw new Error("API key prompt should not run when confirmation is declined.");
        }
      }
    });

    expect(confirmMessages).toContain(
      "Manage web-search providers for fresher web research coverage. Configure Feynman web-search providers now?"
    );
    expect(confirmInitialValues).toContain(false);
  });
});

function createSearchPrompts(options: {
  confirmResponses: boolean[];
  selectResponses: string[];
  textResponses: string[];
}) {
  const remainingConfirmResponses = [...options.confirmResponses];
  const remainingSelectResponses = [...options.selectResponses];
  const remainingTextResponses = [...options.textResponses];

  return {
    async confirm() {
      const response = remainingConfirmResponses.shift();

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
    async select<Value>(options: {
      options: readonly { value: Value }[];
    }): Promise<symbol | Value> {
      const response = remainingSelectResponses.shift();

      if (typeof response !== "string") {
        throw new Error("Unexpected select prompt.");
      }

      const matchedOption = options.options.find(
        (option) => option.value === response
      );

      if (matchedOption === undefined) {
        throw new Error(`Unexpected select value "${response}".`);
      }

      return matchedOption.value;
    },
    async text() {
      const response = remainingTextResponses.shift();

      if (typeof response !== "string") {
        throw new Error("Unexpected text prompt.");
      }

      return response;
    }
  };
}

function createPaths() {
  return {
    homeDirectory: "/tmp/alice",
    appHomeDirectory: "/tmp/alice/.uraniborg",
    configFile: "/tmp/alice/.uraniborg/config.json",
    vendorDirectory: "/tmp/alice/.uraniborg/vendor",
    feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
    feynmanRuntimeManifestFile: "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
    runsDirectory: "/tmp/alice/.uraniborg/runs"
  };
}

function createAppHomeStatus(): UraniborgAppHomeStatus {
  const paths = createPaths();

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
}

function createReadyRuntimeStatus(): FeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    executablePath: "/tmp/alice/.local/bin/feynman",
    detectedVersion: "1.2.3",
    warnings: [],
    candidates: [
      {
        executablePath: "/tmp/alice/.local/bin/feynman",
        compatible: true,
        detectedVersion: "1.2.3",
        details: ["Version: 1.2.3"]
      }
    ]
  };
}

function createExecution(options: {
  args: readonly string[];
  stdout: string;
  stderr?: string;
  exitCode?: number;
}): FeynmanCommandExecution {
  return {
    executablePath: "/tmp/alice/.local/bin/feynman",
    args: options.args,
    exitCode: options.exitCode ?? 0,
    stdout: options.stdout,
    stderr: options.stderr ?? ""
  };
}
