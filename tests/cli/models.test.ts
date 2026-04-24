import { describe, expect, it } from "vitest";

import { runModelsCommand } from "../../src/cli/commands/models.js";
import { ok } from "../../src/types/result.js";
import type {
  FeynmanCommandExecution,
  FeynmanRuntimeStatus
} from "../../src/review/index.js";

describe("runModelsCommand", () => {
  it("shows review model remediation guidance and configured refine defaults", async () => {
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
          stdout: "AlphaXiv ready"
        });
      },
      async getSearchStatus() {
        return createExecution({
          args: ["search", "status"],
          stdout: "Web search not configured"
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
              model: "gpt-5",
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
              timeoutMs: 60000
            },
            defaults: {
              model: "gpt-5",
              temperature: 0.2
            }
          }
        });
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[fail] Review model discovery is not ready through the selected Feynman runtime."
    );
    expect(lines).toContain("[ok] Refinement setup is ready.");
    expect(lines).toContain("Endpoint: https://api.example.com/v1");
    expect(lines).toContain("Default model: gpt-5");
    expect(lines).toContain(
      "[warn] Web search is not configured. Latest web research coverage may be weaker."
    );
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
