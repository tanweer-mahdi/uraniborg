import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DoctorReport } from "../../src/cli/commands/doctor.js";
import type { ModelsReport } from "../../src/cli/commands/models.js";
import type { RevisionConfigReport } from "../../src/cli/commands/revision.js";
import { ModelsScreen } from "../../src/tui/screens/models.js";
import { RevisionConfigScreen } from "../../src/tui/screens/revision-config.js";
import { createAlphaLoginRemediationAction } from "../../src/review/index.js";
import type { UraniborgConfig } from "../../src/types/app-config.js";
import { err, ok } from "../../src/types/result.js";
import {
  createAppHomeStatus,
  createBrowserConfig,
  createResolvedBrowserConfig,
  createReadyReadinessReport,
  createReadyRuntimeStatus,
  flushInk
} from "./helpers.js";

describe("readiness routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders incomplete revision guidance in the models route", async () => {
    const app = render(
      <ModelsScreen loadReport={async () => createIncompleteModelsReport()} />
    );
    await flushInk();

    expect(app.lastFrame()).toContain("Revision Runtime");
    expect(app.lastFrame()).toContain("Revision runtime is stale.");
    expect(app.lastFrame()).toContain("Run `uraniborg revision --setup` again.");

    app.unmount();
  });

  it("renders revision-config readiness guidance", async () => {
    const onRevisionSetupRequested = vi.fn();
    const app = render(
      <RevisionConfigScreen
        onRevisionSetupRequested={onRevisionSetupRequested}
        loadSnapshot={async () => ({
          doctorReport: createDoctorReport(),
          modelsReport: createIncompleteModelsReport(),
          revisionReport: createIncompleteRevisionConfigReport()
        })}
      />
    );
    await flushInk();

    expect(app.lastFrame()).toContain("Config Sections");
    expect(app.lastFrame()).toContain("Revision Provider");

    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();

    expect(app.lastFrame()).toContain("incomplete");

    app.stdin.write("\r");
    await flushInk();

    expect(onRevisionSetupRequested).toHaveBeenCalledTimes(1);

    app.unmount();
  });

  it("renders cleaned capability summaries in config instead of raw process diagnostics", async () => {
    const app = render(
      <RevisionConfigScreen
        loadSnapshot={async () => ({
          doctorReport: createReadyConfigDoctorReport(),
          modelsReport: createIncompleteModelsReport(),
          revisionReport: createIncompleteRevisionConfigReport()
        })}
      />
    );
    await flushInk();

    app.stdin.write("\u001B[B");
    await flushInk();

    expect(app.lastFrame()).toContain("AlphaXiv is ready.");
    expect(app.lastFrame()).toContain("Logged in as Tanweer Mahdi Hasan.");
    expect(app.lastFrame()).not.toContain("Exit code:");
    expect(app.lastFrame()).not.toContain("stdout:");

    app.stdin.write("\u001B[B");
    await flushInk();

    expect(app.lastFrame()).toContain("Web search is ready.");
    expect(app.lastFrame()).toContain("Managed by: pi-web-access");
    expect(app.lastFrame()).toContain("Search route: Gemini");
    expect(app.lastFrame()).toContain("Request route: gemini");
    expect(app.lastFrame()).not.toContain("Exit code:");
    expect(app.lastFrame()).not.toContain("stdout:");

    app.unmount();
  });

  it("renders custom revision prompt path and guidance preview", async () => {
    const app = render(
      <RevisionConfigScreen
        loadSnapshot={async () => ({
          doctorReport: createReadyConfigDoctorReport(),
          modelsReport: createIncompleteModelsReport(),
          revisionReport: createReadyCustomPromptRevisionConfigReport()
        })}
      />
    );
    await flushInk();

    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();

    expect(app.lastFrame()).toContain("Revision prompt: custom guidance file");
    expect(app.lastFrame()).toContain("Prompt path: /tmp/prompts/revision.md");
    expect(app.lastFrame()).toContain("Focus on argument flow.");

    app.unmount();
  });

  it("saves a canonical absolute custom revision prompt path from the TUI", async () => {
    const saveConfig = vi.fn(
      async (_configFilePath: string, _config: UraniborgConfig) => undefined
    );
    const app = render(
      <RevisionConfigScreen
        cwd="/tmp/workspace"
        saveConfig={saveConfig}
        loadSnapshot={async () => ({
          doctorReport: createReadyConfigDoctorReport(),
          modelsReport: createIncompleteModelsReport(),
          revisionReport: createDefaultRevisionConfigReport()
        })}
      />
    );
    await flushInk();

    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();

    app.stdin.write("notes/revision.md");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();

    expect(saveConfig).toHaveBeenCalledTimes(1);
    const savedCall = saveConfig.mock.calls[0];

    expect(savedCall?.[0]).toBe("/tmp/alice/.uraniborg/config.json");
    expect(savedCall?.[1].revision.instructionPrompt).toEqual({
      sourceFile: "/tmp/workspace/notes/revision.md"
    });

    app.unmount();
  });
});

function createIncompleteModelsReport(): ModelsReport {
  const config = createBrowserConfig();

  return {
    runtimeStatus: createReadyRuntimeStatus(),
    readinessReport: createReadyReadinessReport(),
    readinessConfigResult: ok(config),
    parsedConfigResult: ok(config),
    runtimeConfigResult: err({
      code: "config_stale_revision_setup",
      message: "Revision runtime is stale.",
      details: ["Run `uraniborg revision --setup` again."]
    }),
    availableRevisionModels: []
  };
}

function createIncompleteRevisionConfigReport(): RevisionConfigReport {
  const config = createBrowserConfig();

  return {
    configFilePath: "/tmp/alice/.uraniborg/config.json",
    readinessResult: err({
      code: "config_stale_revision_setup",
      message: "Revision runtime is stale.",
      details: ["Run `uraniborg revision --setup` again."]
    }),
    parsedConfigResult: ok(config)
  };
}

function createDefaultRevisionConfigReport(): RevisionConfigReport {
  const config = createBrowserConfig();

  return {
    configFilePath: "/tmp/alice/.uraniborg/config.json",
    readinessResult: ok(createResolvedBrowserConfig()),
    parsedConfigResult: ok(config)
  };
}

function createReadyCustomPromptRevisionConfigReport(): RevisionConfigReport {
  const parsedConfig = createBrowserConfig({
    instructionPrompt: {
      sourceFile: "/tmp/prompts/revision.md"
    }
  });
  const resolvedConfig = createResolvedBrowserConfig({
    instructionPrompt: {
      sourceFile: "/tmp/prompts/revision.md"
    }
  });

  return {
    configFilePath: "/tmp/alice/.uraniborg/config.json",
    readinessResult: ok({
      ...resolvedConfig,
      revision: {
        ...resolvedConfig.revision,
        instructionPrompt: {
          source: "file",
          configuredPath: "/tmp/prompts/revision.md",
          effectiveInstruction:
            "Focus on argument flow.\nReject vague reviewer asks."
        }
      }
    }),
    parsedConfigResult: ok(parsedConfig)
  };
}

function createDoctorReport(): DoctorReport {
  return {
    appHomeStatus: createAppHomeStatus(),
    runtimeStatus: createReadyRuntimeStatus(),
    readinessReport: {
      ...createReadyReadinessReport(),
      checks: [
        ...createReadyReadinessReport().checks.map((check) =>
          check.code === "alphaxiv"
            ? {
                ...check,
                ready: false,
                summary: "AlphaXiv is not configured.",
                remediation: createAlphaLoginRemediationAction(
                  "Configure AlphaXiv access."
                )
              }
            : check
        )
      ],
      recommendedReady: false
    },
    revisionConfigResult: err({
      code: "config_stale_revision_setup",
      message: "Revision runtime is stale.",
      details: ["Run `uraniborg revision --setup` again."]
    })
  };
}

function createReadyConfigDoctorReport(): DoctorReport {
  return {
    appHomeStatus: createAppHomeStatus(),
    runtimeStatus: createReadyRuntimeStatus(),
    readinessReport: {
      ...createReadyReadinessReport(),
      checks: [
        ...createReadyReadinessReport().checks.map((check) => {
          if (check.code === "alphaxiv") {
            return {
              ...check,
              details: [
                "Exit code: 0",
                "stdout: alphaXiv logged in as Tanweer Mahdi Hasan"
              ]
            };
          }

          if (check.code === "web_search") {
            return {
              ...check,
              details: [
                "Exit code: 0",
                "stdout: Managed by: pi-web-access Search route: Gemini Request route: gemini Search workflow: none Perplexity API configured: no Exa API configured: no Gemini API configured: yes Browser profile: default Chromium profile Config path: /Users/shahmahdihasan/.feynman/web-search.json"
              ]
            };
          }

          return check;
        })
      ]
    },
    revisionConfigResult: err({
      code: "config_stale_revision_setup",
      message: "Revision runtime is stale.",
      details: ["Run `uraniborg revision --setup` again."]
    })
  };
}
