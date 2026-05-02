import { describe, expect, it } from "vitest";

import {
  loadParsedUraniborgConfig,
  loadSetupSeedUraniborgConfig,
  loadUraniborgConfig,
  parseUraniborgConfig,
  resolveRevisionSetupReadiness,
  saveUraniborgConfig
} from "../../src/config/app-config.js";
import { URANIBORG_DEFAULT_REVISION_GUIDANCE_PROMPT } from "../../src/refine/refinement.js";
import type {
  UraniborgConfig,
  UraniborgConfigReadWriter
} from "../../src/types/app-config.js";
import {
  createResolvedTestUraniborgConfig,
  createTestUraniborgConfig
} from "../helpers/uraniborg-config.js";
import { ok } from "../../src/types/result.js";

describe("parseUraniborgConfig", () => {
  it("accepts a valid current browser-login-backed config", () => {
    const result = parseUraniborgConfig(
      createTestUraniborgConfig({
        profileId: "openai-codex-chatgpt",
        model: "gpt-5.4",
        providerContext: {
          accountId: "acct_123"
        }
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision.profile.id).toBe("openai-codex-chatgpt");
      expect(result.value.revision.auth.class).toBe("oauth");
      expect(result.value.revision.credentialBinding.type).toBe("pi-auth-storage");
    }
  });

  it("rejects version 1 config as stale", () => {
    const result = parseUraniborgConfig({
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKey: "secret-key"
        },
        defaults: {
          model: "gpt-5",
          temperature: 0.1
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
    }
  });

  it("rejects version 2 preview config as stale", () => {
    const result = parseUraniborgConfig({
      version: 2,
      revision: {
        providerFamily: "openai-codex",
        profileId: "openai-codex",
        authClass: "api-key",
        credentialSource: {
          type: "env-var",
          envVar: "OPENAI_API_KEY"
        },
        endpoint: {
          timeoutMs: 60000
        },
        defaults: {
          model: "gpt-5",
          temperature: 0.2
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
    }
  });

  it("rejects deprecated manual-compatible revision config as stale", () => {
    const result = parseUraniborgConfig({
      version: 3,
      revision: {
        profile: {
          id: "manual-openai-compatible",
          family: "openai-compatible",
          label: "Manual OpenAI-compatible"
        },
        auth: {
          class: "api-key",
          acquisition: "env-var"
        },
        credentialBinding: {
          type: "env-var",
          envVar: "OPENAI_API_KEY"
        },
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          timeoutMs: 60000
        },
        defaults: {
          model: "gpt-5.4",
          temperature: 0.2
        }
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
    }
  });
});

describe("loadUraniborgConfig", () => {
  it("loads a valid current config and resolves Pi-managed runtime", async () => {
    const readWriter = createMemoryReadWriter({
      "/tmp/config.json": JSON.stringify(
        createTestUraniborgConfig({
          profileId: "openai-codex-chatgpt",
          model: "gpt-5.4",
          providerContext: {
            accountId: "acct_123"
          }
        })
      )
    });

    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      {},
      readWriter,
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during config load.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "openai-codex",
            accountId: "acct_123"
          });
        }
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision.runtime.kind).toBe("pi-managed");
      expect(result.value.revision.runtime.providerId).toBe("openai-codex");
      expect(result.value.revision.instructionPrompt).toEqual({
        source: "default",
        effectiveInstruction: URANIBORG_DEFAULT_REVISION_GUIDANCE_PROMPT
      });
    }
  });

  it("loads a valid custom revision prompt file into the resolved config", async () => {
    const readWriter = createMemoryReadWriter({
      "/tmp/config.json": JSON.stringify(
        createTestUraniborgConfig({
          profileId: "claude-browser",
          model: "claude-sonnet-4-5",
          instructionPrompt: {
            sourceFile: "/tmp/prompts/revision.md"
          }
        })
      ),
      "/tmp/prompts/revision.md": "Focus on argument flow.\nReject vague reviewer asks.\n"
    });

    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      {},
      readWriter,
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during config load.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "anthropic"
          });
        }
      }
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision.instructionPrompt).toEqual({
        source: "file",
        configuredPath: "/tmp/prompts/revision.md",
        effectiveInstruction:
          "Focus on argument flow.\nReject vague reviewer asks."
      });
    }
  });

  it("fails loudly when the configured custom revision prompt file cannot be read", async () => {
    const readWriter = createMemoryReadWriter({
      "/tmp/config.json": JSON.stringify(
        createTestUraniborgConfig({
          profileId: "claude-browser",
          model: "claude-sonnet-4-5",
          instructionPrompt: {
            sourceFile: "/tmp/prompts/missing.md"
          }
        })
      )
    });

    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      {},
      readWriter,
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during config load.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "anthropic"
          });
        }
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("revision_instruction_prompt_unreadable");
    }
  });

  it("fails with config_not_found when the config file is missing", async () => {
    const readWriter: UraniborgConfigReadWriter = {
      async readFile(): Promise<string> {
        throw createNodeError("ENOENT", "Missing config.");
      },
      async writeFile(): Promise<void> {}
    };

    const result = await loadUraniborgConfig("/tmp/config.json", {}, readWriter);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config_not_found");
    }
  });

  it("loads parsed config without requiring runtime credential resolution", async () => {
    const readWriter = createMemoryReadWriter({
      "/tmp/config.json": JSON.stringify(
        createTestUraniborgConfig({
          profileId: "claude-browser",
          model: "claude-sonnet-4-5"
        })
      )
    });

    const result = await loadParsedUraniborgConfig("/tmp/config.json", readWriter);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.revision.credentialBinding.providerId).toBe("anthropic");
    }
  });

  it("persists config JSON with stable formatting", async () => {
    const writes: string[] = [];
    const readWriter: UraniborgConfigReadWriter = {
      async readFile(): Promise<string> {
        return "";
      },
      async writeFile(_configFilePath: string, contents: string): Promise<void> {
        writes.push(contents);
      }
    };

    const config = createTestUraniborgConfig({
      profileId: "claude-browser",
      model: "claude-sonnet-4-5"
    });

    await saveUraniborgConfig("/tmp/config.json", config, readWriter);

    expect(writes).toEqual([
      `${JSON.stringify(
        {
          version: 3,
          revision: config.revision
        },
        null,
        2
      )}\n`
    ]);
  });

  it("keeps stale setup-seed loads rejected so setup can restart cleanly", async () => {
    const result = await loadSetupSeedUraniborgConfig(
      "/tmp/config.json",
      createMemoryReadWriter({
        "/tmp/config.json": JSON.stringify({
          version: 2,
          revision: {
            providerFamily: "openai-codex",
            profileId: "openai-codex",
            authClass: "api-key",
            credentialSource: {
              type: "env-var",
              envVar: "OPENAI_API_KEY"
            },
            endpoint: {
              timeoutMs: 45000
            },
            defaults: {
              model: "gpt-4.1",
              temperature: 0.7
            }
          }
        })
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
    }
  });
});

describe("resolveRevisionSetupReadiness", () => {
  it("checks Gemini Pi-managed revision readiness with required project context", async () => {
    const config = createTestUraniborgConfig({
      profileId: "gemini-cloud-code-assist",
      model: "gemini-2.5-pro",
      providerContext: {
        projectId: "project-123"
      }
    });

    const result = await resolveRevisionSetupReadiness(
      config,
      {},
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during readiness checks.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "google-gemini-cli",
            projectId: "project-123"
          });
        }
      }
    );

    expect(result.ok).toBe(true);
  });

  it("fails when required provider context is missing", async () => {
    const config = createTestUraniborgConfig({
      profileId: "openai-codex-chatgpt",
      model: "gpt-5.4"
    });

    const result = await resolveRevisionSetupReadiness(
      config,
      {},
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during readiness checks.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "openai-codex",
            accountId: "acct_test"
          });
        }
      }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("provider_context_missing");
    }
  });

  it("checks Pi-managed revision readiness separately from runtime execution", async () => {
    const config = createTestUraniborgConfig({
      profileId: "openai-codex-chatgpt",
      model: "gpt-5.4",
      providerContext: {
        accountId: "acct_test"
      }
    });

    const result = await resolveRevisionSetupReadiness(
      config,
      {},
      {
        async loginManagedCredential() {
          throw new Error("Login should not run during readiness checks.");
        },
        async resolveManagedCredential() {
          return ok({
            providerId: "openai-codex",
            accountId: "acct_test"
          });
        }
      }
    );

    expect(result.ok).toBe(true);
  });
});

function createMemoryReadWriter(
  files: Record<string, string>
): UraniborgConfigReadWriter {
  return {
    async readFile(configFilePath: string): Promise<string> {
      const fileContents = files[configFilePath];

      if (fileContents === undefined) {
        throw createNodeError("ENOENT", `Missing file at ${configFilePath}.`);
      }

      return fileContents;
    },
    async writeFile(): Promise<void> {}
  };
}

function createNodeError(
  code: string,
  message: string
): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}
