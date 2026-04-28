import { describe, expect, it } from "vitest";

import {
  collectFeynmanRuntimeSnapshot,
  createSerializedFeynmanCommandRunner,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanRuntimeStatus
} from "../../src/review/index.js";

describe("createSerializedFeynmanCommandRunner", () => {
  it("prevents overlapping feynman command execution", async () => {
    let inFlight = 0;
    let overlapDetected = false;

    const baseRunner: FeynmanCommandRunner = {
      async run(executablePath, args) {
        inFlight += 1;

        if (inFlight > 1) {
          overlapDetected = true;
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        inFlight -= 1;

        return {
          executablePath,
          args,
          exitCode: 0,
          stdout: "ok",
          stderr: ""
        };
      }
    };

    const runner = createSerializedFeynmanCommandRunner(baseRunner);

    await Promise.all([
      runner.run("/tmp/feynman", ["--version"]),
      runner.run("/tmp/feynman", ["model", "list"]),
      runner.run("/tmp/feynman", ["alpha", "status"])
    ]);

    expect(overlapDetected).toBe(false);
  });
});

describe("collectFeynmanRuntimeSnapshot", () => {
  it("collects review-model and capability probes in sequence", async () => {
    const calls: string[] = [];

    const runtimeStatus: FeynmanRuntimeStatus = {
      ready: true,
      code: "ready",
      executablePath: "/tmp/feynman",
      detectedVersion: "1.2.3",
      warnings: [],
      candidates: [
        {
          executablePath: "/tmp/feynman",
          compatible: true,
          detectedVersion: "1.2.3",
          details: ["Version: 1.2.3"]
        }
      ]
    };

    const runner = createSerializedFeynmanCommandRunner({
      async run(executablePath, args): Promise<FeynmanCommandExecution> {
        calls.push(args.join(" "));

        return {
          executablePath,
          args,
          exitCode: 0,
          stdout:
            args[0] === "model"
              ? JSON.stringify(["openai/gpt-5.4"])
              : args[0] === "alpha"
                ? "AlphaXiv ready"
                : "Web search ready",
          stderr: ""
        };
      }
    });

    const snapshot = await collectFeynmanRuntimeSnapshot({
      inspectRuntime: async () => runtimeStatus,
      runner,
      includeReviewModels: true,
      includeCapabilities: true
    });

    expect(calls).toEqual([
      "model list",
      "alpha status",
      "search status"
    ]);
    expect(snapshot.readinessReport.requiredReady).toBe(true);
    expect(snapshot.readinessReport.recommendedReady).toBe(true);
  });
});
