import { describe, expect, it } from "vitest";

import {
  runRevisionCommand,
  runRevisionConfigCommand
} from "../../src/cli/commands/revision.js";
import type { RevisionSetupDependencies } from "../../src/cli/commands/revision-setup.js";
import type { UraniborgAppHomeStatus } from "../../src/config/index.js";
import { err, ok } from "../../src/types/result.js";
import type { UraniborgConfig } from "../../src/types/app-config.js";

describe("runRevisionCommand", () => {
  it("runs the guided revision setup flow through `revision --setup`", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;

    await runRevisionCommand(
      {
        setup: true
      },
      {
        resolvePaths() {
          return createPaths();
        },
        async ensureAppHome(paths) {
          return createAppHomeStatus(paths);
        },
        async loadConfig() {
          return err({
            code: "config_not_found",
            message: "missing"
          });
        },
        async saveConfig(_configFilePath, config) {
          savedConfig = config;
        },
        prompts: createPromptHarness(
          {
            selectAnswers: ["manual"],
            textAnswers: ["https://api.example.com/v1", "secret-key", "gpt-5.4"]
          },
          promptsAsked
        )
      }
    );

    expect(promptsAsked).toEqual([
      "Which revision provider should Uraniborg use?",
      "OpenAI-compatible revision endpoint URL",
      "Revision API key",
      "Default revision model"
    ]);
    expect(savedConfig).toEqual({
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret-key",
          timeoutMs: 60000
        },
        defaults: {
          model: "gpt-5.4",
          temperature: 0.2
        }
      }
    });
  });

  it("uses the built-in endpoint when ChatGPT is selected", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;

    await runRevisionCommand(
      {
        setup: true
      },
      {
        resolvePaths() {
          return createPaths();
        },
        async ensureAppHome(paths) {
          return createAppHomeStatus(paths);
        },
        async loadConfig() {
          return err({
            code: "config_not_found",
            message: "missing"
          });
        },
        async saveConfig(_configFilePath, config) {
          savedConfig = config;
        },
        prompts: createPromptHarness(
          {
            selectAnswers: ["chatgpt"],
            textAnswers: ["secret-key", "gpt-5.4"]
          },
          promptsAsked
        )
      }
    );

    expect(promptsAsked).toEqual([
      "Which revision provider should Uraniborg use?",
      "Revision API key",
      "Default revision model"
    ]);
    expect(savedConfig?.refine.endpoint.baseUrl).toBe(
      "https://api.openai.com/v1"
    );
  });

  it("requires exactly one revision command mode", async () => {
    await expect(
      runRevisionCommand(
        {},
        {
          resolvePaths() {
            return createPaths();
          }
        }
      )
    ).rejects.toThrow(
      "Choose exactly one of `--setup` or `--config` when running `uraniborg revision`."
    );
  });
});

describe("runRevisionConfigCommand", () => {
  it("shows redacted ready revision configuration", async () => {
    const lines: string[] = [];

    await runRevisionConfigCommand({
      resolvePaths() {
        return createPaths();
      },
      async ensureAppHome(paths) {
        return createAppHomeStatus(paths);
      },
      async loadResolvedConfig() {
        return ok({
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://api.example.com/v1",
              apiKey: "super-secret",
              timeoutMs: 60000
            },
            defaults: {
              model: "gpt-5.4",
              temperature: 0.2
            }
          }
        });
      },
      async loadParsedConfig() {
        return ok({
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://api.example.com/v1",
              apiKey: "super-secret",
              timeoutMs: 60000
            },
            defaults: {
              model: "gpt-5.4",
              temperature: 0.2
            }
          }
        });
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain("[ok] Revision setup is ready.");
    expect(lines).toContain("Endpoint: https://api.example.com/v1");
    expect(lines).toContain("Default model: gpt-5.4");
    expect(lines).toContain("API key: stored in Uraniborg config (redacted)");
    expect(lines.some((line) => line.includes("super-secret"))).toBe(false);
  });

  it("guides the user when revision configuration is missing", async () => {
    const lines: string[] = [];

    await runRevisionConfigCommand({
      resolvePaths() {
        return createPaths();
      },
      async ensureAppHome(paths) {
        return createAppHomeStatus(paths);
      },
      async loadResolvedConfig() {
        return err({
          code: "config_not_found",
          message: "Uraniborg config was not found at \"/tmp/alice/.uraniborg/config.json\"."
        });
      },
      async loadParsedConfig() {
        return err({
          code: "config_not_found",
          message: "Uraniborg config was not found at \"/tmp/alice/.uraniborg/config.json\"."
        });
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain("[fail] Revision setup is incomplete.");
    expect(lines).toContain(
      "  Run `uraniborg revision --setup` or `uraniborg init` to create revision configuration."
    );
  });
});

function createPromptHarness(
  answers: {
    selectAnswers: string[];
    textAnswers: string[];
  },
  promptsAsked: string[]
): NonNullable<RevisionSetupDependencies["prompts"]> {
  const remainingSelectAnswers = [...answers.selectAnswers];
  const remainingTextAnswers = [...answers.textAnswers];

  return {
    intro() {
      return undefined;
    },
    outro() {
      return undefined;
    },
    cancel() {
      return undefined;
    },
    async select(options) {
      promptsAsked.push(options.message);
      const answer = remainingSelectAnswers.shift();

      if (typeof answer !== "string") {
        throw new Error(`No answer queued for prompt "${options.message}".`);
      }

      const matchedOption = options.options.find(
        (option) => option.value === answer
      );

      if (matchedOption === undefined) {
        throw new Error(`Unsupported select answer "${answer}".`);
      }

      return matchedOption.value;
    },
    async text(options) {
      promptsAsked.push(options.message);
      const answer = remainingTextAnswers.shift();

      if (typeof answer !== "string") {
        throw new Error(`No answer queued for prompt "${options.message}".`);
      }

      return answer;
    },
    isCancel(_value: unknown): _value is symbol {
      return false;
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

function createAppHomeStatus(
  paths: ReturnType<typeof createPaths>
): UraniborgAppHomeStatus {
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
