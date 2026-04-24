import { describe, expect, it } from "vitest";

import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { ok } from "../../src/types/result.js";
import type {
  FeynmanCommandExecution,
  FeynmanRuntimeStatus
} from "../../src/review/index.js";
import type { UraniborgAppHomeStatus } from "../../src/config/index.js";

describe("runDoctorCommand", () => {
  it("reports recommended capability gaps and surfaces feynman doctor diagnostics", async () => {
    const lines: string[] = [];

    await runDoctorCommand({
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
          stdout: "AlphaXiv not configured"
        });
      },
      async getSearchStatus() {
        return createExecution({
          args: ["search", "status"],
          stdout: "Web search ready"
        });
      },
      async getDoctorOutput() {
        return createExecution({
          args: ["doctor"],
          stdout: "Review provider diagnostics"
        });
      },
      async loadConfig() {
        return ok({
          version: 1,
          refine: {
            endpoint: {
              baseUrl: "https://api.example.com/v1",
              apiKeyEnvVar: "OPENAI_API_KEY",
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
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[warn] AlphaXiv is not configured. Latest-paper and paper-metadata access may be weaker. [recommended]"
    );
    expect(lines).toContain("Feynman Diagnostics");
    expect(lines).toContain("  Review provider diagnostics");
    expect(lines).toContain(
      "[warn] Uraniborg can run, but recommended Feynman research capabilities are missing."
    );
  });
});

function createAppHomeStatus(): UraniborgAppHomeStatus {
  return {
    paths: {
      homeDirectory: "/tmp/alice",
      appHomeDirectory: "/tmp/alice/.uraniborg",
      configFile: "/tmp/alice/.uraniborg/config.json",
      vendorDirectory: "/tmp/alice/.uraniborg/vendor",
      feynmanRuntimeDirectory: "/tmp/alice/.uraniborg/vendor/feynman",
      feynmanRuntimeManifestFile: "/tmp/alice/.uraniborg/vendor/feynman/runtime.json",
      runsDirectory: "/tmp/alice/.uraniborg/runs"
    },
    appHome: {
      kind: "directory",
      path: "/tmp/alice/.uraniborg"
    },
    vendor: {
      kind: "directory",
      path: "/tmp/alice/.uraniborg/vendor"
    },
    feynmanRuntime: {
      kind: "directory",
      path: "/tmp/alice/.uraniborg/vendor/feynman"
    },
    runs: {
      kind: "directory",
      path: "/tmp/alice/.uraniborg/runs"
    },
    isLayoutValid: true
  };
}

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
