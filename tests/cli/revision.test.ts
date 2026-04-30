import { describe, expect, it } from "vitest";

import {
  runRevisionCommand,
  runRevisionConfigCommand
} from "../../src/cli/commands/revision.js";
import type { RevisionSetupDependencies } from "../../src/cli/commands/revision-setup.js";
import type { UraniborgAppHomeStatus } from "../../src/config/index.js";
import { err, ok } from "../../src/types/result.js";
import type { UraniborgConfig } from "../../src/types/app-config.js";
import { createTestUraniborgConfig } from "../helpers/uraniborg-config.js";

describe("runRevisionCommand", () => {
  it("runs the guided revision setup flow through `revision --setup`", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;
    let loginAttempts = 0;

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
      }
    );

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

  it("uses Pi-backed browser login when OpenAI/Codex is selected", async () => {
    const promptsAsked: string[] = [];
    let savedConfig: UraniborgConfig | undefined;
    let loginAttempts = 0;

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
      }
    );

    expect(promptsAsked).toEqual([
      "Which revision provider profile should Uraniborg use?",
      "Default revision model"
    ]);
    expect(loginAttempts).toBe(1);
    expect(savedConfig?.refine.endpoint.baseUrl).toBe(
      "https://chatgpt.com/backend-api"
    );
  });

  it("uses Pi-backed browser login when Claude is selected", async () => {
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
      }
    );

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

  it("does not write config when Gemini browser login lacks project context", async () => {
    let savedConfig: UraniborgConfig | undefined;

    await expect(
      runRevisionCommand(
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
          authClient: {
            async loginManagedCredential(providerId) {
              expect(providerId).toBe("google-gemini-cli");
              return {
                providerId: "google-gemini-cli"
              };
            },
            async resolveManagedCredential() {
              throw new Error("Managed credential resolution should not run in this test.");
            }
          },
          prompts: createPromptHarness(
            {
              selectAnswers: ["gemini-cloud-code-assist"],
              textAnswers: []
            },
            []
          )
        }
      )
    ).rejects.toThrow(
      'Pi login for "google-gemini-cli" did not produce the required provider context "projectId".'
    );

    expect(savedConfig).toBeUndefined();
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

  it("does not write config when OpenAI/Codex browser login fails", async () => {
    let savedConfig: UraniborgConfig | undefined;

    await expect(
      runRevisionCommand(
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
        authClient: {
            async loginManagedCredential() {
              throw new Error("Browser login failed.");
            },
            async resolveManagedCredential() {
              throw new Error("Managed credential resolution should not run in this test.");
            }
          },
          prompts: createPromptHarness(
            {
              selectAnswers: ["openai-codex-chatgpt"],
              textAnswers: []
            },
            []
          )
        }
      )
    ).rejects.toThrow("Browser login failed.");

    expect(savedConfig).toBeUndefined();
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
      async loadRevisionReadiness() {
        return ok(
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
      },
      async loadParsedConfig() {
        return ok(
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
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain("[ok] Revision setup is ready.");
    expect(lines).toContain("Active profile: OpenAI/Codex");
    expect(lines).toContain("Default model: gpt-5.4");
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
      async loadRevisionReadiness() {
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
