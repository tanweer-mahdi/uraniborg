import { describe, expect, it } from "vitest";

import { nextProgressState } from "../../src/tui/progress-state.js";

describe("nextProgressState", () => {
  it("records live phase transitions", () => {
    const initial = {
      runId: "(pending)",
      status: "preparing" as const,
      message: "Preparing"
    };

    const started = nextProgressState(initial, {
      type: "run-started",
      runId: "run-1"
    });
    const phased = nextProgressState(started, {
      type: "phase-started",
      runId: "run-1",
      iteration: 2,
      totalIterations: 3,
      phase: "refine"
    });

    expect(phased.runId).toBe("run-1");
    expect(phased.status).toBe("running");
    expect(phased.iteration).toBe(2);
    expect(phased.totalIterations).toBe(3);
    expect(phased.phase).toBe("refine");
  });

  it("keeps failure classes distinct with artifact pointers", () => {
    const failed = nextProgressState(
      {
        runId: "run-1",
        status: "running",
        iteration: 1,
        totalIterations: 2,
        phase: "refine"
      },
      {
        type: "run-failed",
        runId: "run-1",
        iteration: 1,
        failureKind: "refinement-output-contract-failure",
        message: "Refinement output did not match the contract.",
        pointers: ["/tmp/refine.response.txt", "/tmp/refine.log"]
      }
    );

    expect(failed.status).toBe("failed");
    expect(failed.failureKind).toBe("refinement-output-contract-failure");
    expect(failed.pointers).toEqual([
      "/tmp/refine.response.txt",
      "/tmp/refine.log"
    ]);
  });

  it("records final draft location on completion", () => {
    const completed = nextProgressState(
      {
        runId: "run-1",
        status: "running"
      },
      {
        type: "run-completed",
        runId: "run-1",
        finalDraftFile: "/tmp/final.md"
      }
    );

    expect(completed.status).toBe("completed");
    expect(completed.finalDraftFile).toBe("/tmp/final.md");
  });
});
