import { describe, expect, it } from "vitest";

import { runModelsCommand } from "../../src/cli/commands/models.js";
import { err, ok } from "../../src/types/result.js";
import type {
  FeynmanCommandExecution,
  FeynmanRuntimeStatus
} from "../../src/review/index.js";
import {
  createResolvedTestUraniborgConfig,
  createTestUraniborgConfig
} from "../helpers/uraniborg-config.js";

describe("runModelsCommand", () => {
  it("shows review model remediation guidance and configured revision defaults", async () => {
    const lines: string[] = [];

    await runModelsCommand({
      interactive: false,
      resolvePaths() {
        return {
          homeDirectory: "/tmp/alice",
          appHomeDirectory: "/tmp/alice/.uraniborg",
          configFile: "/tmp/alice/.uraniborg/config.json",
          vendorDirectory: "/tmp/alice/.uraniborg/vendor",
          feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
          feynmanRuntimeManifestFile:
            "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
          runsDirectory: "/tmp/alice/.uraniborg/runs"
        };
      },
      async inspectRuntime() {
        return createReadyRuntimeStatus();
      },
      async listModels() {
        return createExecution({
          args: ["model", "list"],
          exitCode: 1,
          stdout: "",
          stderr: "login required for openai"
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
      async loadConfig() {
        return ok(
          createResolvedTestUraniborgConfig({
            profileId: "openai-codex-chatgpt",
            binding: {
              type: "pi-auth-storage",
              providerId: "openai-codex"
            },
            model: "gpt-5",
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
            model: "gpt-5",
            providerContext: {
              accountId: "acct_test"
            }
          })
        );
      },
      authClient: {
        async loginManagedCredential() {
          throw new Error("Login should not run in models reporting.");
        },
        async resolveManagedCredential() {
          throw new Error("Managed credential resolution should not run in models reporting.");
        },
        listAvailableModelIds() {
          return ["gpt-5", "gpt-5.4"];
        }
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[fail] Review model discovery is not ready through the selected Feynman runtime."
    );
    expect(lines).toContain("[ok] Revision runtime is ready.");
    expect(lines).toContain("Active profile: OpenAI/Codex");
    expect(lines).toContain("Default model: gpt-5");
    expect(lines).toContain("Runtime auth: Pi-managed (openai-codex)");
    expect(lines).toContain("- gpt-5");
    expect(lines.some((line) => line.includes("Recommended Capabilities"))).toBe(
      false
    );
    expect(lines.some((line) => line.includes("AlphaXiv"))).toBe(false);
    expect(lines.some((line) => line.includes("Web search"))).toBe(false);
    expect(lines.some((line) => line.includes("Exit code:"))).toBe(false);
    expect(lines.some((line) => line.includes("stdout:"))).toBe(false);
    expect(lines.some((line) => line.includes("stderr:"))).toBe(false);
  });

  it("surfaces incomplete Gemini browser-login setup without exposing Pi internals", async () => {
    const lines: string[] = [];

    await runModelsCommand({
      interactive: false,
      resolvePaths() {
        return {
          homeDirectory: "/tmp/alice",
          appHomeDirectory: "/tmp/alice/.uraniborg",
          configFile: "/tmp/alice/.uraniborg/config.json",
          vendorDirectory: "/tmp/alice/.uraniborg/vendor",
          feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
          feynmanRuntimeManifestFile:
            "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
          runsDirectory: "/tmp/alice/.uraniborg/runs"
        };
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
        return err({
          code: "provider_context_missing",
          message: 'Revision provider context "projectId" is missing for "Gemini".'
        });
      },
      async loadParsedConfig() {
        return ok(
          createTestUraniborgConfig({
            profileId: "gemini-cloud-code-assist",
            credentialBinding: {
              type: "pi-auth-storage",
              providerId: "google-gemini-cli"
            },
            model: "gemini-2.5-pro"
          })
        );
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain('[fail] Revision provider context "projectId" is missing for "Gemini".');
    expect(lines).toContain("Active profile: Gemini");
    expect(lines.some((line) => line.includes("google-gemini-cli"))).toBe(false);
  });
});

function createReadyRuntimeStatus(): FeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    executablePath: "/tmp/alice/.uraniborg/vendor/feynman/bin/feynman",
    detectedVersion: "1.2.3",
    warnings: [],
    candidates: [
      {
        executablePath: "/tmp/alice/.uraniborg/vendor/feynman/bin/feynman",
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
    executablePath: "/tmp/alice/.uraniborg/vendor/feynman/bin/feynman",
    args: options.args,
    exitCode: options.exitCode ?? 0,
    stdout: options.stdout,
    stderr: options.stderr ?? ""
  };
}
