import { describe, expect, it } from "vitest";

import {
  classifyFeynmanReadiness,
  createRecommendedCapabilityCheck,
  parseReviewModelCatalog
} from "../../src/review/feynman-readiness.js";
import type {
  FeynmanCommandExecution,
  PinnedFeynmanRuntimeStatus
} from "../../src/review/index.js";

describe("classifyFeynmanReadiness", () => {
  it("treats runtime and review models as required while alpha and web search remain recommended", () => {
    const report = classifyFeynmanReadiness({
      runtimeStatus: createReadyRuntimeStatus(),
      modelListExecution: createExecution({
        args: ["model", "list"],
        stdout: JSON.stringify(["openai/gpt-5.4", "anthropic/claude-3.7"])
      }),
      alphaStatusExecution: createExecution({
        args: ["alpha", "status"],
        stdout: "AlphaXiv not configured"
      }),
      searchStatusExecution: createExecution({
        args: ["search", "status"],
        stdout: "Web search ready"
      })
    });

    expect(report.requiredReady).toBe(true);
    expect(report.recommendedReady).toBe(false);
    expect(report.reviewModels).toEqual([
      "openai/gpt-5.4",
      "anthropic/claude-3.7"
    ]);

    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "pinned_runtime",
          tier: "required",
          ready: true
        }),
        expect.objectContaining({
          code: "review_models",
          tier: "required",
          ready: true
        }),
        expect.objectContaining({
          code: "alphaxiv",
          tier: "recommended",
          ready: false,
          remediation: expect.objectContaining({
            kind: "alpha_login"
          })
        }),
        expect.objectContaining({
          code: "web_search",
          tier: "recommended",
          ready: true
        })
      ])
    );
  });

  it("blocks on a selected review model that is not available and infers provider login remediation", () => {
    const report = classifyFeynmanReadiness({
      runtimeStatus: createReadyRuntimeStatus(),
      modelListExecution: createExecution({
        args: ["model", "list"],
        stdout: JSON.stringify(["anthropic/claude-3.7"])
      }),
      selectedReviewModel: "openai/gpt-5.4"
    });

    expect(report.requiredReady).toBe(false);
    expect(report.recommendedReady).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "selected_review_model",
          ready: false,
          remediation: expect.objectContaining({
            kind: "model_login",
            provider: "openai"
          })
        })
      ])
    );
  });

  it("turns a runtime failure into a blocking required check with setup remediation", () => {
    const runtimeStatus: PinnedFeynmanRuntimeStatus = {
      ready: false,
      code: "manifest_missing",
      manifestPath: "/tmp/.uraniborg/vendor/feynman/runtime.json",
      executablePath: "/tmp/.uraniborg/vendor/feynman/bin/feynman",
      warnings: []
    };

    const report = classifyFeynmanReadiness({
      runtimeStatus
    });

    expect(report.requiredReady).toBe(false);
    expect(report.checks).toEqual([
      expect.objectContaining({
        code: "pinned_runtime",
        tier: "required",
        ready: false,
        remediation: expect.objectContaining({
          kind: "setup"
        })
      })
    ]);
  });

  it("parses review models from nested machine-readable catalog output", () => {
    const catalog = parseReviewModelCatalog(
      createExecution({
        args: ["model", "list"],
        stdout: JSON.stringify({
          data: [
            {
              id: "openai/gpt-5.4"
            },
            {
              availableModels: [
                {
                  slug: "anthropic/claude-3.7"
                }
              ]
            }
          ]
        })
      })
    );

    expect(catalog.ready).toBe(true);
    expect(catalog.models).toEqual([
      "openai/gpt-5.4",
      "anthropic/claude-3.7"
    ]);
  });

  it("interprets JSON capability status output for recommended checks", () => {
    const readyCheck = createRecommendedCapabilityCheck(
      "alphaxiv",
      createExecution({
        args: ["alpha", "status"],
        stdout: JSON.stringify({
          session: {
            authenticated: true
          }
        })
      })
    );
    const notReadyCheck = createRecommendedCapabilityCheck(
      "web_search",
      createExecution({
        args: ["search", "status"],
        stdout: JSON.stringify({
          providers: {
            configured: false
          }
        })
      })
    );

    expect(readyCheck.ready).toBe(true);
    expect(notReadyCheck.ready).toBe(false);
    expect(notReadyCheck.remediation).toEqual(
      expect.objectContaining({
        kind: "setup"
      })
    );
  });
});

function createReadyRuntimeStatus(): PinnedFeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    manifestPath: "/tmp/.uraniborg/vendor/feynman/runtime.json",
    executablePath: "/tmp/.uraniborg/vendor/feynman/bin/feynman",
    expectedVersion: "1.2.3",
    detectedVersion: "1.2.3",
    warnings: []
  };
}

function createExecution(options: {
  args: readonly string[];
  stdout: string;
  stderr?: string;
  exitCode?: number;
}): FeynmanCommandExecution {
  return {
    executablePath: "/tmp/.uraniborg/vendor/feynman/bin/feynman",
    args: options.args,
    exitCode: options.exitCode ?? 0,
    stdout: options.stdout,
    stderr: options.stderr ?? ""
  };
}
