import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";

import { RunProgressScreen } from "../../src/tui/screens/run-progress.js";

describe("RunProgressScreen", () => {
  it("renders live progress state", () => {
    const app = render(
      <RunProgressScreen
        progress={{
          runId: "run-1",
          status: "running",
          iteration: 2,
          totalIterations: 3,
          phase: "refine",
          message: "Iteration 2/3: refine"
        }}
      />
    );

    expect(app.lastFrame()).toContain("Run: run-1");
    expect(app.lastFrame()).toContain("Iteration: 2/3");
    expect(app.lastFrame()).toContain("Phase: refine");

    app.unmount();
  });

  it.each([
    "review-failure",
    "refinement-execution-failure",
    "refinement-output-contract-failure",
    "memory-update-failure"
  ] as const)(
    "renders the %s failure state with artifact pointers",
    (failureKind) => {
      const app = render(
        <RunProgressScreen
          progress={{
            runId: "run-1",
            status: "failed",
            failureKind,
            message: "Run failed.",
            pointers: ["/tmp/one.log", "/tmp/two.txt"]
          }}
        />
      );

      expect(app.lastFrame()).toContain(failureKind);
      expect(app.lastFrame()).toContain("/tmp/one.log");
      expect(app.lastFrame()).toContain("/tmp/two.txt");

      app.unmount();
    }
  );
});
