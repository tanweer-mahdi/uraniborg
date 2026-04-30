import { describe, expect, it } from "vitest";

import {
  runInitCommand,
  type InitCommandDependencies
} from "../../src/cli/commands/init.js";
import { err, ok } from "../../src/types/result.js";
import type { UraniborgConfig } from "../../src/types/app-config.js";
import { createTestUraniborgConfig } from "../helpers/uraniborg-config.js";

describe("runInitCommand", () => {
  it("prompts only for profile and model on first run", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;
    let loginAttempts = 0;

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
      authClient: {
        async loginManagedCredential(providerId) {
          loginAttempts += 1;
          expect(providerId).toBe("openai-codex");
          return {
            providerId: "openai-codex",
            accountId: "acct_test"
          };
        },
        async resolveManagedCredential() {
          throw new Error("Managed credential resolution should not run in this test.");
        }
      },
      prompts: createPromptHarness(
        {
          selectAnswers: ["openai-codex-chatgpt"],
          textAnswers: ["gpt-5.4"]
        },
        promptsAsked
      )
    });

    expect(promptsAsked).toEqual([
      "Which revision provider profile should Uraniborg use?",
      "Default revision model"
    ]);
    expect(loginAttempts).toBe(1);
    expect(savedConfig).toEqual(
      createTestUraniborgConfig({
        profileId: "openai-codex-chatgpt",
        credentialBinding: {
          type: "pi-auth-storage",
          providerId: "openai-codex"
        },
        model: "gpt-5.4",
        providerContext: {
          accountId: "acct_test"
        }
      })
    );
  });

  it("preserves hidden advanced settings from an existing config", async () => {
    let savedConfig: UraniborgConfig | undefined;
    let loginAttempts = 0;

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
        return ok(
          createTestUraniborgConfig({
            profileId: "openai-codex-chatgpt",
            model: "gpt-4.1",
            temperature: 0.7,
            maxOutputTokens: 2000,
            timeoutMs: 45000,
            providerContext: {
              accountId: "acct_existing"
            }
          })
        );
      },
      async saveConfig(_configFilePath, config) {
        savedConfig = config;
      },
      authClient: {
        async loginManagedCredential(providerId) {
          loginAttempts += 1;
          expect(providerId).toBe("openai-codex");
          return {
            providerId: "openai-codex",
            accountId: "acct_next"
          };
        },
        async resolveManagedCredential() {
          throw new Error("Managed credential resolution should not run in this test.");
        }
      },
      prompts: createPromptHarness(
        {
          selectAnswers: ["openai-codex-chatgpt"],
          textAnswers: ["gpt-5.4"]
        },
        []
      )
    });

    expect(loginAttempts).toBe(1);
    expect(savedConfig).toEqual(
      createTestUraniborgConfig({
        profileId: "openai-codex-chatgpt",
        credentialBinding: {
          type: "pi-auth-storage",
          providerId: "openai-codex"
        },
        model: "gpt-5.4",
        temperature: 0.7,
        maxOutputTokens: 2000,
        timeoutMs: 45000,
        providerContext: {
          accountId: "acct_next"
        }
      })
    );
  });

  it("runs Pi-managed Claude browser login during init", async () => {
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
      authClient: {
        async loginManagedCredential(providerId) {
          expect(providerId).toBe("anthropic");
          return {
            providerId: "anthropic"
          };
        },
        async resolveManagedCredential() {
          throw new Error("Managed credential resolution should not run in this test.");
        }
      },
      prompts: createPromptHarness(
        {
          selectAnswers: ["claude-browser"],
          textAnswers: ["claude-sonnet-4-5"]
        },
        []
      )
    });

    expect(savedConfig).toEqual(
      createTestUraniborgConfig({
        profileId: "claude-browser",
        credentialBinding: {
          type: "pi-auth-storage",
          providerId: "anthropic"
        },
        model: "claude-sonnet-4-5"
      })
    );
  });
});

function createPromptHarness(
  answers: {
    selectAnswers: string[];
    textAnswers: string[];
  },
  promptsAsked: string[]
): NonNullable<InitCommandDependencies["prompts"]> {
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
