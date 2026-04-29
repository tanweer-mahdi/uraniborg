import { describe, expect, it } from "vitest";

import {
  loadParsedUraniborgConfig,
  loadSetupSeedUraniborgConfig,
  loadUraniborgConfig,
  parseUraniborgConfig,
  resolveRevisionSetupReadiness,
  resolveUraniborgConfigSecrets,
  saveUraniborgConfig
} from "../../src/config/app-config.js";
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
  it("accepts a valid refine configuration with a stored API key", () => {
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

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.timeoutMs).toBe(60000);
      expect(result.value.refine.defaults.temperature).toBe(0.1);
    }
  });

  it("accepts a legacy refine configuration with an API key env var", () => {
    const result = parseUraniborgConfig({
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKeyEnvVar: "OPENAI_API_KEY"
        },
        defaults: {
          model: "gpt-5",
          temperature: 0.1
        }
      }
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.timeoutMs).toBe(60000);
      expect(result.value.refine.defaults.temperature).toBe(0.1);
    }
  });

  it("rejects malformed config input", () => {
    const result = parseUraniborgConfig({
      version: 2
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("config_invalid_schema");
    }
  });

  it("classifies preview OpenAI/Codex version 2 config as stale", () => {
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

  it("classifies preview Claude version 2 config as stale", () => {
    const result = parseUraniborgConfig({
      version: 2,
      revision: {
        providerFamily: "claude",
        profileId: "claude",
        authClass: "api-key",
        credentialSource: {
          type: "env-var",
          envVar: "ANTHROPIC_API_KEY"
        },
        endpoint: {
          timeoutMs: 60000
        },
        defaults: {
          model: "claude-sonnet-4-5",
          temperature: 0.2
        }
      }
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
      expect(result.error.message).toContain("Claude");
    }
  });

  it("classifies current API-key-based Gemini config as stale", () => {
    const result = parseUraniborgConfig(
      createTestUraniborgConfig({
        profileId: "gemini-direct",
        credentialBinding: {
          type: "env-var",
          envVar: "GEMINI_API_KEY"
        },
        model: "gemini-2.5-pro"
      })
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("config_stale_revision_setup");
      expect(result.error.message).toContain("Gemini");
    }
  });
});

describe("resolveUraniborgConfigSecrets", () => {
  it("uses a stored API key directly", () => {
    const config = createStoredSecretConfig();

    const result = resolveUraniborgConfigSecrets(config, {});

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.apiKey).toBe("stored-secret");
    }
  });

  it("resolves the configured API key env var", () => {
    const config = createEnvVarConfig();

    const result = resolveUraniborgConfigSecrets(config, {
      OPENAI_API_KEY: "secret-key"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.apiKey).toBe("secret-key");
    }
  });

  it("fails when the API key env var is missing", () => {
    const config = createEnvVarConfig();

    const result = resolveUraniborgConfigSecrets(config, {});

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("secret_missing");
    }
  });
});

describe("loadUraniborgConfig", () => {
  it("loads, validates, and resolves a config file with a stored API key", async () => {
    const readWriter = createMemoryReadWriter(
      JSON.stringify({
        version: 1,
        refine: {
          endpoint: {
            baseUrl: "https://api.example.com/v1",
            apiKey: "stored-secret"
          },
          defaults: {
            model: "gpt-5"
          }
        }
      })
    );

    const result = await loadUraniborgConfig("/tmp/config.json", {}, readWriter);

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.apiKey).toBe("stored-secret");
      expect(result.value.refine.endpoint.timeoutMs).toBe(60000);
    }
  });

  it("loads, validates, and resolves a config file", async () => {
    const readWriter = createMemoryReadWriter(
      JSON.stringify({
        version: 1,
        refine: {
          endpoint: {
            baseUrl: "https://api.example.com/v1",
            apiKeyEnvVar: "OPENAI_API_KEY"
          },
          defaults: {
            model: "gpt-5"
          }
        }
      })
    );

    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      { OPENAI_API_KEY: "secret-key" },
      readWriter
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.defaults.temperature).toBe(0.2);
      expect(result.value.refine.endpoint.timeoutMs).toBe(60000);
    }
  });

  it("loads parsed config without requiring the API key env var", async () => {
    const readWriter = createMemoryReadWriter(
      JSON.stringify({
        version: 1,
        refine: {
          endpoint: {
            baseUrl: "https://api.example.com/v1",
            apiKeyEnvVar: "OPENAI_API_KEY"
          },
          defaults: {
            model: "gpt-5"
          }
        }
      })
    );

    const result = await loadParsedUraniborgConfig(
      "/tmp/config.json",
      readWriter
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.apiKeyEnvVar).toBe("OPENAI_API_KEY");
    }
  });

  it("fails with config_not_found when the config file is missing", async () => {
    const readWriter: UraniborgConfigReadWriter = {
      async readFile(): Promise<string> {
        throw createNodeError("ENOENT", "Missing config.");
      },
      async writeFile(): Promise<void> {}
    };

    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      { OPENAI_API_KEY: "secret-key" },
      readWriter
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("config_not_found");
    }
  });

  it("fails with config_invalid_json when the file is not valid JSON", async () => {
    const result = await loadUraniborgConfig(
      "/tmp/config.json",
      { OPENAI_API_KEY: "secret-key" },
      createMemoryReadWriter("{invalid")
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("config_invalid_json");
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

    await saveUraniborgConfig(
      "/tmp/config.json",
      createTestUraniborgConfig({
        profileId: "manual-openai-compatible",
        credentialBinding: {
          type: "stored-secret",
          apiKey: "stored-secret"
        },
        model: "gpt-5",
        timeoutMs: 1000,
        baseUrl: "https://api.openai.com/v1"
      }),
      readWriter
    );

    expect(writes).toEqual([
      `${JSON.stringify(
        {
          version: 3,
          revision: createTestUraniborgConfig({
            profileId: "manual-openai-compatible",
            credentialBinding: {
              type: "stored-secret",
              apiKey: "stored-secret"
            },
            model: "gpt-5",
            timeoutMs: 1000,
            baseUrl: "https://api.openai.com/v1"
          }).revision
        },
        null,
        2
      )}\n`
    ]);
  });

  it("creates a version 3 setup seed from stale preview OpenAI/Codex config", async () => {
    const result = await loadSetupSeedUraniborgConfig(
      "/tmp/config.json",
      createMemoryReadWriter(
        JSON.stringify({
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
      )
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.version).toBe(3);
      expect(result.value.revision.profile.id).toBe("openai-codex-chatgpt");
      expect(result.value.revision.auth.class).toBe("oauth");
      expect(result.value.revision.auth.acquisition).toBe("browser-login");
      expect(result.value.revision.defaults.model).toBe("gpt-4.1");
      expect(result.value.revision.endpoint.timeoutMs).toBe(45000);
    }
  });

  it("creates a setup seed from stale Claude config", async () => {
    const result = await loadSetupSeedUraniborgConfig(
      "/tmp/config.json",
      createMemoryReadWriter(
        JSON.stringify({
          version: 3,
          revision: createTestUraniborgConfig({
            profileId: "claude-api",
            credentialBinding: {
              type: "env-var",
              envVar: "ANTHROPIC_API_KEY"
            },
            model: "claude-sonnet-4-5"
          }).revision
        })
      )
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.revision.profile.id).toBe("claude-browser");
      expect(result.value.revision.auth.class).toBe("oauth");
      expect(result.value.revision.credentialBinding).toEqual({
        type: "pi-auth-storage",
        providerId: "anthropic"
      });
    }
  });

  it("checks Gemini Pi-managed revision readiness with required project context", async () => {
    const config = createTestUraniborgConfig({
      profileId: "gemini-cloud-code-assist",
      credentialBinding: {
        type: "pi-auth-storage",
        providerId: "google-gemini-cli"
      },
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

  it("checks Pi-managed revision readiness separately from runtime execution", async () => {
    const config = createTestUraniborgConfig({
      profileId: "openai-codex-chatgpt",
      credentialBinding: {
        type: "pi-auth-storage",
        providerId: "openai-codex"
      },
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

function createMemoryReadWriter(fileContents: string): UraniborgConfigReadWriter {
  return {
    async readFile(): Promise<string> {
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

function createStoredSecretConfig(): UraniborgConfig {
  return createTestUraniborgConfig({
    profileId: "manual-openai-compatible",
    credentialBinding: {
      type: "stored-secret",
      apiKey: "stored-secret"
    },
    model: "gpt-5",
    timeoutMs: 5000,
    baseUrl: "https://api.openai.com/v1"
  });
}

function createEnvVarConfig(): UraniborgConfig {
  return createTestUraniborgConfig({
    profileId: "manual-openai-compatible",
    credentialBinding: {
      type: "env-var",
      envVar: "OPENAI_API_KEY"
    },
    model: "gpt-5",
    timeoutMs: 5000,
    baseUrl: "https://api.openai.com/v1"
  });
}
