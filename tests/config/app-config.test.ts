import { describe, expect, it } from "vitest";

import {
  loadParsedUraniborgConfig,
  loadUraniborgConfig,
  parseUraniborgConfig,
  resolveUraniborgConfigSecrets,
  saveUraniborgConfig
} from "../../src/config/app-config.js";
import type {
  UraniborgConfig,
  UraniborgConfigReadWriter
} from "../../src/types/app-config.js";

describe("parseUraniborgConfig", () => {
  it("accepts a valid refine configuration", () => {
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
});

describe("resolveUraniborgConfigSecrets", () => {
  it("resolves the configured API key env var", () => {
    const config: UraniborgConfig = {
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKeyEnvVar: "OPENAI_API_KEY",
          timeoutMs: 5000
        },
        defaults: {
          model: "gpt-5",
          temperature: 0.2
        }
      }
    };

    const result = resolveUraniborgConfigSecrets(config, {
      OPENAI_API_KEY: "secret-key"
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.refine.endpoint.apiKey).toBe("secret-key");
    }
  });

  it("fails when the API key env var is missing", () => {
    const config: UraniborgConfig = {
      version: 1,
      refine: {
        endpoint: {
          baseUrl: "https://api.example.com/v1",
          apiKeyEnvVar: "OPENAI_API_KEY",
          timeoutMs: 5000
        },
        defaults: {
          model: "gpt-5",
          temperature: 0.2
        }
      }
    };

    const result = resolveUraniborgConfigSecrets(config, {});

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error.code).toBe("secret_missing");
    }
  });
});

describe("loadUraniborgConfig", () => {
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
      {
        version: 1,
        refine: {
          endpoint: {
            baseUrl: "https://api.example.com/v1",
            apiKeyEnvVar: "OPENAI_API_KEY",
            timeoutMs: 1000
          },
          defaults: {
            model: "gpt-5",
            temperature: 0.2
          }
        }
      },
      readWriter
    );

    expect(writes).toEqual([
      `${JSON.stringify(
        {
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://api.example.com/v1",
              apiKeyEnvVar: "OPENAI_API_KEY",
              timeoutMs: 1000
            },
            defaults: {
              model: "gpt-5",
              temperature: 0.2
            }
          }
        },
        null,
        2
      )}\n`
    ]);
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
