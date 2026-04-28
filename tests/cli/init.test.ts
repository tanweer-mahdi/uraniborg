import { describe, expect, it } from "vitest";

import {
  runInitCommand,
  type InitCommandDependencies
} from "../../src/cli/commands/init.js";
import { err, ok } from "../../src/types/result.js";
import type { UraniborgConfig } from "../../src/types/app-config.js";

describe("runInitCommand", () => {
  it("prompts only for base URL, API key, and model on first run", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;

    await runInitCommand({
      resolvePaths() {
        return {
          homeDirectory: "/tmp/alice",
          appHomeDirectory: "/tmp/alice/.uraniborg",
          configFile: "/tmp/alice/.uraniborg/config.json",
          vendorDirectory: "/tmp/alice/.uraniborg/vendor",
          feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
          feynmanRuntimeManifestFile: "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
          runsDirectory: "/tmp/alice/.uraniborg/runs"
        };
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
        return err({
          code: "config_not_found",
          message: "missing"
        });
      },
      async saveConfig(_configFilePath, config) {
        savedConfig = config;
      },
      prompts: createPromptHarness([
        "https://api.example.com/v1",
        "secret-key",
        "gpt-5.4"
      ], promptsAsked)
    });

    expect(promptsAsked).toEqual([
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

  it("preserves hidden advanced settings from an existing config", async () => {
    let savedConfig: UraniborgConfig | undefined;

    await runInitCommand({
      resolvePaths() {
        return {
          homeDirectory: "/tmp/alice",
          appHomeDirectory: "/tmp/alice/.uraniborg",
          configFile: "/tmp/alice/.uraniborg/config.json",
          vendorDirectory: "/tmp/alice/.uraniborg/vendor",
          feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
          feynmanRuntimeManifestFile: "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
          runsDirectory: "/tmp/alice/.uraniborg/runs"
        };
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
        return ok({
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://legacy.example.com/v1",
              apiKeyEnvVar: "OPENAI_API_KEY",
              timeoutMs: 45000
            },
            defaults: {
              model: "gpt-4.1",
              temperature: 0.7,
              maxOutputTokens: 2000
            }
          }
        });
      },
      async saveConfig(_configFilePath, config) {
        savedConfig = config;
      },
      prompts: createPromptHarness([
        "https://api.example.com/v1",
        "secret-key",
        "gpt-5.4"
      ], [])
    });

    expect(savedConfig).toEqual({
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret-key",
          timeoutMs: 45000
        },
        defaults: {
          model: "gpt-5.4",
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      }
    });
  });
});

function createPromptHarness(
  answers: string[],
  promptsAsked: string[]
): NonNullable<InitCommandDependencies["prompts"]> {
  const remainingAnswers = [...answers];

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
    async text(options) {
      promptsAsked.push(options.message);
      const answer = remainingAnswers.shift();

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
