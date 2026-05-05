import { describe, expect, it } from "vitest";

import { runDoctorCommand } from "../../src/cli/commands/doctor.js";
import { err, ok } from "../../src/types/result.js";
import type {
  FeynmanCommandExecution,
  FeynmanRuntimeStatus
} from "../../src/review/index.js";
import type { UraniborgAppHomeStatus } from "../../src/config/index.js";
import { createResolvedTestUraniborgConfig } from "../helpers/uraniborg-config.js";

describe("runDoctorCommand", () => {
  it("shows the exact Feynman install command when no runtime is found on PATH", async () => {
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
      async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
        return {
          ready: false,
          code: "runtime_missing",
          warnings: [],
          candidates: []
        };
      },
      async listModels() {
        throw new Error("Model discovery should not run without a runtime.");
      },
      async getAlphaStatus() {
        throw new Error("AlphaXiv status should not run without a runtime.");
      },
      async getSearchStatus() {
        throw new Error("Web-search status should not run without a runtime.");
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
              accountId: "acct_123"
            }
          })
        );
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[fail] No compatible Feynman runtime was found on PATH. [required]"
    );
    expect(lines).toContain(
      "  Install Feynman with `npm install -g @companion-ai/feynman@latest`, then ensure a compatible `feynman` executable is available on PATH before running Uraniborg."
    );
  });

  it("reports incompatible discovered runtimes without classifying them as missing from PATH", async () => {
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
      async inspectRuntime(): Promise<FeynmanRuntimeStatus> {
        return {
          ready: false,
          code: "runtime_incompatible",
          warnings: [],
          candidates: [
            {
              executablePath: "/tmp/feynman",
              compatible: false,
              failureCode: "version_unreadable",
              details: ["stdout: not-a-version"]
            }
          ]
        };
      },
      async listModels() {
        throw new Error("Model discovery should not run for incompatible runtime.");
      },
      async getAlphaStatus() {
        throw new Error("AlphaXiv status should not run for incompatible runtime.");
      },
      async getSearchStatus() {
        throw new Error("Web-search status should not run for incompatible runtime.");
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
              accountId: "acct_123"
            }
          })
        );
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[fail] Discovered Feynman runtimes are incompatible with Uraniborg. [required]"
    );
    expect(lines).toContain("  Candidate: /tmp/feynman");
    expect(lines).not.toContain(
      "[fail] No compatible Feynman runtime was found on PATH. [required]"
    );
  });

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
              accountId: "acct_123"
            }
          })
        );
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain(
      "[warn] AlphaXiv is not configured. Latest-paper and paper-metadata access may be weaker. [recommended]"
    );
    expect(lines).toContain(
      "[warn] Uraniborg can run, but recommended research capabilities are missing."
    );
    expect(lines.some((line) => line.includes("Exit code:"))).toBe(false);
    expect(lines.some((line) => line.includes("stdout:"))).toBe(false);
    expect(lines.some((line) => line.includes("stderr:"))).toBe(false);
  });

  it("reports missing Gemini project context as a revision readiness failure", async () => {
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
          message: 'Revision provider context "projectId" is missing for "Gemini".',
          details: [
            "Run `uraniborg revision --setup` again to refresh the Pi-backed revision login state."
          ]
        });
      },
      writeLine(message) {
        lines.push(message);
      }
    });

    expect(lines).toContain('[fail] Revision provider context "projectId" is missing for "Gemini".');
    expect(lines).toContain(
      "  Run `uraniborg revision --setup` again to refresh the Pi-backed revision login state."
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
