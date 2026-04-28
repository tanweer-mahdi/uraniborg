import { describe, expect, it } from "vitest";

import {
  findFeynmanExecutablesOnPath,
  inspectFeynmanRuntime,
  parseFeynmanVersion,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanRuntimeFilesystem
} from "../../src/review/feynman-bootstrap.js";

describe("findFeynmanExecutablesOnPath", () => {
  it("returns executable candidates in PATH order", async () => {
    const filesystem = createRuntimeFilesystem();
    filesystem.executables.add("/usr/local/bin/feynman");
    filesystem.executables.add("/opt/homebrew/bin/feynman");

    await expect(
      findFeynmanExecutablesOnPath(
        "feynman",
        "/usr/local/bin:/opt/homebrew/bin",
        filesystem,
        "darwin"
      )
    ).resolves.toEqual([
      "/usr/local/bin/feynman",
      "/opt/homebrew/bin/feynman"
    ]);
  });
});

describe("inspectFeynmanRuntime", () => {
  it("selects the first compatible runtime discovered on PATH", async () => {
    const filesystem = createRuntimeFilesystem();
    filesystem.executables.add("/usr/local/bin/feynman");
    filesystem.executables.add("/opt/homebrew/bin/feynman");
    const runner = createRunner([
      {
        executablePath: "/usr/local/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "feynman 1.2.3\n",
        stderr: ""
      },
      {
        executablePath: "/opt/homebrew/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "feynman 1.3.0\n",
        stderr: ""
      }
    ]);

    const status = await inspectFeynmanRuntime(
      {
        PATH: "/usr/local/bin:/opt/homebrew/bin"
      },
      runner,
      filesystem,
      "darwin"
    );

    expect(status).toEqual({
      ready: true,
      code: "ready",
      executablePath: "/usr/local/bin/feynman",
      detectedVersion: "1.2.3",
      warnings: [
        "Multiple compatible feynman runtimes were found on PATH. Uraniborg selected /usr/local/bin/feynman, version 1.2.3 because it appeared first."
      ],
      candidates: [
        {
          executablePath: "/usr/local/bin/feynman",
          compatible: true,
          detectedVersion: "1.2.3",
          details: ["Version: 1.2.3"]
        },
        {
          executablePath: "/opt/homebrew/bin/feynman",
          compatible: true,
          detectedVersion: "1.3.0",
          details: ["Version: 1.3.0"]
        }
      ]
    });
  });

  it("reports runtime_missing when PATH contains no feynman executable", async () => {
    await expect(
      inspectFeynmanRuntime(
        {
          PATH: "/usr/local/bin"
        },
        createRunner([]),
        createRuntimeFilesystem(),
        "darwin"
      )
    ).resolves.toEqual({
      ready: false,
      code: "runtime_missing",
      warnings: [],
      candidates: []
    });
  });

  it("reports runtime_incompatible when discovered candidates fail compatibility checks", async () => {
    const filesystem = createRuntimeFilesystem();
    filesystem.executables.add("/usr/local/bin/feynman");
    const runner = createRunner([
      {
        executablePath: "/usr/local/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "not-a-version\n",
        stderr: ""
      }
    ]);

    const status = await inspectFeynmanRuntime(
      {
        PATH: "/usr/local/bin"
      },
      runner,
      filesystem,
      "darwin"
    );

    expect(status.ready).toBe(false);
    expect(status.code).toBe("runtime_incompatible");
    expect(status.candidates).toEqual([
      {
        executablePath: "/usr/local/bin/feynman",
        compatible: false,
        failureCode: "version_unreadable",
        details: ["Exit code: 0", "stdout: not-a-version"]
      }
    ]);
  });
});

describe("parseFeynmanVersion", () => {
  it("extracts a semantic version from CLI output", () => {
    expect(parseFeynmanVersion("feynman 1.2.3\n")).toBe("1.2.3");
    expect(parseFeynmanVersion("not-a-version")).toBeNull();
  });
});

interface MemoryRuntimeFilesystem extends FeynmanRuntimeFilesystem {
  executables: Set<string>;
}

function createRuntimeFilesystem(): MemoryRuntimeFilesystem {
  return {
    executables: new Set<string>(),
    async isExecutable(filePath: string): Promise<boolean> {
      return this.executables.has(filePath);
    }
  };
}

function createRunner(
  executions: FeynmanCommandExecution[]
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
