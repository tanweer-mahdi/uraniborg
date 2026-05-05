import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HistoryEntry } from "../../src/cli/commands/history.js";
import { HistoryScreen } from "../../src/tui/screens/history.js";
import {
  RunDetailScreen,
  type RunDetailViewModel
} from "../../src/tui/screens/run-detail.js";
import {
  RunSetupScreen,
  type RunSetupSnapshot
} from "../../src/tui/screens/run-setup.js";
import { flushInk } from "./helpers.js";
import { createResolvedBrowserConfig } from "./helpers.js";

describe("history and run routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the empty history state", async () => {
    const app = render(
      <HistoryScreen onOpenRun={() => {}} loadEntries={async () => []} />
    );
    await flushInk();

    expect(app.lastFrame()).toContain("No Uraniborg runs are available.");

    app.unmount();
  });

  it("renders structured wide history rows without pipe-delimited labels", async () => {
    const app = render(
      <HistoryScreen
        onOpenRun={() => {}}
        loadEntries={async () => createHistoryEntries()}
        terminalWidth={120}
      />
    );
    await flushInk();

    const frame = app.lastFrame() ?? "";

    expect(frame).toContain("Status");
    expect(frame).toContain("Prog");
    expect(frame).toContain("Created");
    expect(frame).toContain("Title");
    expect(frame).toContain("Run ID");
    expect(frame).toContain("finished");
    expect(frame).toContain("1/1");
    expect(frame).toContain("First Draft Review");
    expect(frame).toContain("run-1");
    expect(frame).not.toContain("run-1 | finished");

    app.unmount();
  });

  it("renders compact readable history rows in narrow terminals", async () => {
    const app = render(
      <HistoryScreen
        onOpenRun={() => {}}
        loadEntries={async () => createHistoryEntries()}
        terminalWidth={48}
      />
    );
    await flushInk();

    const frame = app.lastFrame() ?? "";

    expect(frame).toContain("First Draft Review");
    expect(frame).toContain("finished 1/1");
    expect(frame).toContain("2026-05-01T00:00:00.000Z run-1");
    expect(frame).toContain("Failed Revision");
    expect(frame).toContain("failed 1/2");
    expect(frame).not.toContain("Status");
    expect(frame).not.toContain("run-1 | finished");

    app.unmount();
  });

  it("opens the selected history run after keyboard navigation", async () => {
    const onOpenRun = vi.fn();
    const app = render(
      <HistoryScreen
        onOpenRun={onOpenRun}
        loadEntries={async () => createHistoryEntries()}
        terminalWidth={120}
      />
    );
    await flushInk();

    app.stdin.write("\u001B[B");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();

    expect(onOpenRun).toHaveBeenCalledTimes(1);
    expect(onOpenRun).toHaveBeenCalledWith("run-2");

    app.unmount();
  });

  it("renders run detail artifact indexes and resume intent context", async () => {
    const onResumeRequested = vi.fn();
    const app = render(
      <RunDetailScreen
        runId="run-1"
        resumeRequested={true}
        onResumeRequested={onResumeRequested}
        loadDetail={async () => createRunDetail()}
      />
    );
    await flushInk();

    expect(app.lastFrame()).toContain("opened from resume intent");
    expect(app.lastFrame()).toContain("/tmp/run-1/run.json");
    expect(app.lastFrame()).toContain("/tmp/run-1/iter-1/review.md");

    app.stdin.write("\r");
    await flushInk();

    expect(onResumeRequested).toHaveBeenCalledTimes(1);
    expect(onResumeRequested).toHaveBeenCalledWith("run-1");

    app.unmount();
  });

  it("requires explicit launch from run setup before starting the run", async () => {
    const onStartRun = vi.fn();
    const app = render(
      <RunSetupScreen
        initialSourcePath="/tmp/draft.md"
        onStartRun={onStartRun}
        loadSnapshot={async () => createRunSetupSnapshot()}
      />
    );
    await flushInk();

    expect(app.lastFrame()).not.toContain(
      "Press Enter to start the draft iteration loop."
    );

    for (let index = 0; index < 4; index += 1) {
      app.stdin.write("\r");
      await flushInk();
      expect(onStartRun).not.toHaveBeenCalled();
    }

    expect(app.lastFrame()).toContain(
      "Press Enter to start the draft iteration loop."
    );
    expect(app.lastFrame()).toContain("✓ openai-codex/gpt-5.2");
    expect(app.lastFrame()).toContain("✓ gpt-5.2");

    app.stdin.write("\r");
    await flushInk();

    expect(onStartRun).toHaveBeenCalledTimes(1);
    expect(onStartRun).toHaveBeenCalledWith({
      sourcePath: "/tmp/draft.md",
      iterations: 1,
      reviewModel: "openai-codex/gpt-5.2",
      refineModel: "gpt-5.2"
    });

    app.unmount();
  });

  it("preselects the configured revision default model instead of the first available model", async () => {
    const onStartRun = vi.fn();
    const app = render(
      <RunSetupScreen
        initialSourcePath="/tmp/draft.md"
        onStartRun={onStartRun}
        loadSnapshot={async () => ({
          state: "ready",
          requiredIssues: [],
          warnings: [],
          reviewModels: ["openai-codex/gpt-5.2"],
          refineModels: [
            "claude-3-7-sonnet-20250219",
            "claude-sonnet-4-5"
          ],
          config: createResolvedBrowserConfig({
            profileId: "claude-browser",
            model: "claude-sonnet-4-5"
          })
        })}
      />
    );
    await flushInk();

    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();
    app.stdin.write("\r");
    await flushInk();

    expect(onStartRun).toHaveBeenCalledTimes(1);
    expect(onStartRun).toHaveBeenCalledWith({
      sourcePath: "/tmp/draft.md",
      iterations: 1,
      reviewModel: "openai-codex/gpt-5.2",
      refineModel: "claude-sonnet-4-5"
    });

    app.unmount();
  });

  it("treats typed source-path letters as input instead of navigation", async () => {
    const app = render(
      <RunSetupScreen
        onStartRun={() => {}}
        loadSnapshot={async () => createRunSetupSnapshot()}
      />
    );
    await flushInk();

    app.stdin.write("d");
    await flushInk();

    expect(app.lastFrame()).toContain("Source Draft");
    expect(app.lastFrame()).toContain("d");
    expect(app.lastFrame()).not.toContain("Doctor");

    app.unmount();
  });
});

function createRunDetail(): RunDetailViewModel {
  return {
    runId: "run-1",
    title: "Run 1",
    status: "failed",
    createdAt: "2026-05-01T00:00:00.000Z",
    sourceInputPath: "/tmp/draft.md",
    selectedModels: {
      review: "openai-codex/gpt-5.2",
      refine: "gpt-5.2"
    },
    revisionPrompt: {
      source: "default"
    },
    iterationsPlanned: 2,
    iterationsCompleted: 1,
    currentIteration: 2,
    lastError: "Refinement output did not match the contract.",
    resumable: true,
    topLevelArtifacts: [
      "/tmp/run-1/run.json",
      "/tmp/run-1/current.md"
    ],
    iterationArtifacts: [
      {
        iteration: 1,
        files: [
          "/tmp/run-1/iter-1/review.md",
          "/tmp/run-1/iter-1/refine.log"
        ]
      }
    ]
  };
}

function createHistoryEntries(): readonly HistoryEntry[] {
  return [
    {
      runId: "run-1",
      createdAt: "2026-05-01T00:00:00.000Z",
      status: "finished",
      progress: "1/1",
      title: "First Draft Review"
    },
    {
      runId: "run-2",
      createdAt: "2026-05-02T00:00:00.000Z",
      status: "failed",
      progress: "1/2",
      title: "Failed Revision"
    }
  ];
}

function createRunSetupSnapshot(): RunSetupSnapshot {
  return {
    state: "ready",
    requiredIssues: [],
    warnings: [],
    reviewModels: ["openai-codex/gpt-5.2"],
    refineModels: ["gpt-5.2"]
  };
}
