import { describe, expect, it } from "vitest";

import {
  collectFeynmanCompatibilitySnapshot,
  collectFeynmanRuntimeSnapshot,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanRuntimeStatus
} from "../../src/review/index.js";

describe("collectFeynmanCompatibilitySnapshot", () => {
  it("treats parseable readiness failures as compatibility-valid command contracts", async () => {
    const snapshot = await collectFeynmanCompatibilitySnapshot(
      createReadyRuntimeStatus("1.2.3"),
      {
        runner: createRunner([
          createExecution({
            args: ["model", "list"],
            exitCode: 1,
            stderr: "login required for openai"
          }),
          createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv not configured"
          }),
          createExecution({
            args: ["search", "status"],
            stdout: "Web search not configured"
          })
        ])
      }
    );

    expect(snapshot.compatibilityReport.status).toBe("ready");
  });

  it("warns and continues when an out-of-range runtime passes command-contract probes", async () => {
    const snapshot = await collectFeynmanCompatibilitySnapshot(
      createReadyRuntimeStatus("2.0.0"),
      {
        runner: createRunner([
          createExecution({
            args: ["model", "list"],
            stdout: JSON.stringify(["openai/gpt-5.4"])
          }),
          createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv ready"
          }),
          createExecution({
            args: ["search", "status"],
            stdout: "Web search ready"
          })
        ])
      }
    );

    expect(snapshot.compatibilityReport.status).toBe("warning");
    expect(snapshot.compatibilityReport.warnings[0]).toContain(
      "outside Uraniborg's tested range"
    );
  });

  it("requires action when a probe failure shape is not parseable", async () => {
    const snapshot = await collectFeynmanCompatibilitySnapshot(
      createReadyRuntimeStatus("1.2.3"),
      {
        runner: createRunner([
          createExecution({
            args: ["model", "list"],
            exitCode: 1,
            stdout: "",
            stderr: ""
          }),
          createExecution({
            args: ["alpha", "status"],
            stdout: "AlphaXiv ready"
          }),
          createExecution({
            args: ["search", "status"],
            stdout: "Web search ready"
          })
        ])
      }
    );

    expect(snapshot.compatibilityReport.status).toBe("action-required");
  });
});

describe("collectFeynmanRuntimeSnapshot", () => {
  it("keeps compatibility separate from review-model readiness", async () => {
    const snapshot = await collectFeynmanRuntimeSnapshot({
      inspectRuntime: async () => createReadyRuntimeStatus("1.2.3"),
      runner: createRunner([
        createExecution({
          args: ["model", "list"],
          exitCode: 1,
          stderr: "login required for openai"
        }),
        createExecution({
          args: ["alpha", "status"],
          stdout: "AlphaXiv ready"
        }),
        createExecution({
          args: ["search", "status"],
          stdout: "Web search ready"
        })
      ]),
      includeReviewModels: true
    });

    expect(snapshot.compatibilityReport.status).toBe("ready");
    expect(snapshot.readinessReport.requiredReady).toBe(false);
    expect(
      snapshot.readinessReport.checks.find(
        (check) => check.code === "review_models"
      )
    ).toEqual(
      expect.objectContaining({
        ready: false
      })
    );
  });
});

function createReadyRuntimeStatus(version: string): FeynmanRuntimeStatus {
  return {
    ready: true,
    code: "ready",
    executablePath: "/tmp/feynman",
    detectedVersion: version,
    warnings: [],
    candidates: [
      {
        executablePath: "/tmp/feynman",
        compatible: true,
        detectedVersion: version,
        details: [`Version: ${version}`]
      }
    ]
  };
}

function createExecution(options: {
  args: readonly string[];
  stdout?: string | undefined;
  stderr?: string | undefined;
  exitCode?: number | undefined;
}): FeynmanCommandExecution {
  return {
    executablePath: "/tmp/feynman",
    args: options.args,
    exitCode: options.exitCode ?? 0,
    stdout: options.stdout ?? "",
    stderr: options.stderr ?? ""
  };
}

function createRunner(
  executions: readonly FeynmanCommandExecution[]
): FeynmanCommandRunner {
  const remainingExecutions = [...executions];

  return {
    async run(
      executablePath: string,
      args: readonly string[]
    ): Promise<FeynmanCommandExecution> {
      const nextExecution = remainingExecutions.shift();

      if (
        nextExecution === undefined ||
        nextExecution.executablePath !== executablePath ||
        !haveEqualArgs(nextExecution.args, args)
      ) {
        throw new Error(
          `Unexpected feynman invocation: ${executablePath} ${args.join(" ")}`
        );
      }

      return nextExecution;
    }
  };
}

function haveEqualArgs(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
