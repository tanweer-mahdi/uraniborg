import { describe, expect, it } from "vitest";

import {
  inspectPinnedFeynmanRuntime,
  loadPinnedFeynmanRuntimeManifest,
  parseFeynmanVersion,
  resolvePinnedFeynmanExecutablePath,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanRuntimeFilesystem
} from "../../src/review/feynman-bootstrap.js";

describe("loadPinnedFeynmanRuntimeManifest", () => {
  it("loads the pinned runtime manifest from the runtime directory", async () => {
    const manifest = await loadPinnedFeynmanRuntimeManifest(
      "/tmp/runtime.json",
      createRuntimeFilesystem({
        "/tmp/runtime.json": JSON.stringify({
          version: "1.2.3",
          executableRelativePath: "bin/feynman"
        })
      })
    );

    expect(manifest).toEqual({
      version: "1.2.3",
      executableRelativePath: "bin/feynman"
    });
  });
});

describe("resolvePinnedFeynmanExecutablePath", () => {
  it("defaults to a bin/feynman executable path on posix systems", () => {
    expect(
      resolvePinnedFeynmanExecutablePath(
        {
          feynmanRuntimeDirectory: "/tmp/vendor/feynman"
        },
        { version: "1.2.3" },
        "darwin"
      )
    ).toBe("/tmp/vendor/feynman/bin/feynman");
  });
});

describe("inspectPinnedFeynmanRuntime", () => {
  it("reports a ready runtime when the manifest, binary, and version all match", async () => {
    const filesystem = createRuntimeFilesystem({
      "/tmp/vendor/feynman/runtime.json": JSON.stringify({
        version: "1.2.3"
      })
    });
    filesystem.executables.add("/tmp/vendor/feynman/bin/feynman");
    const runner = createRunner([
      {
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "feynman 1.2.3\n",
        stderr: ""
      }
    ]);

    const status = await inspectPinnedFeynmanRuntime(
      {
        feynmanRuntimeDirectory: "/tmp/vendor/feynman",
        feynmanRuntimeManifestFile: "/tmp/vendor/feynman/runtime.json"
      },
      {},
      runner,
      filesystem,
      "darwin"
    );

    expect(status.ready).toBe(true);
    expect(status.code).toBe("ready");
    expect(status.detectedVersion).toBe("1.2.3");
    expect(status.warnings).toEqual([]);
  });

  it("warns when a conflicting global feynman is available on PATH", async () => {
    const filesystem = createRuntimeFilesystem({
      "/tmp/vendor/feynman/runtime.json": JSON.stringify({
        version: "1.2.3"
      })
    });
    filesystem.executables.add("/tmp/vendor/feynman/bin/feynman");
    filesystem.executables.add("/usr/local/bin/feynman");
    const runner = createRunner([
      {
        executablePath: "/tmp/vendor/feynman/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "feynman 1.2.3\n",
        stderr: ""
      },
      {
        executablePath: "/usr/local/bin/feynman",
        args: ["--version"],
        exitCode: 0,
        stdout: "feynman 9.9.9\n",
        stderr: ""
      }
    ]);

    const status = await inspectPinnedFeynmanRuntime(
      {
        feynmanRuntimeDirectory: "/tmp/vendor/feynman",
        feynmanRuntimeManifestFile: "/tmp/vendor/feynman/runtime.json"
      },
      {
        PATH: "/usr/local/bin"
      },
      runner,
      filesystem,
      "darwin"
    );

    expect(status.ready).toBe(true);
    expect(status.warnings).toEqual([
      "Global feynman on PATH (/usr/local/bin/feynman, version 9.9.9) differs from pinned runtime version 1.2.3. Uraniborg will continue using the pinned runtime."
    ]);
  });

  it("fails when the runtime manifest is missing", async () => {
    const status = await inspectPinnedFeynmanRuntime(
      {
        feynmanRuntimeDirectory: "/tmp/vendor/feynman",
        feynmanRuntimeManifestFile: "/tmp/vendor/feynman/runtime.json"
      },
      {},
      createRunner([]),
      createRuntimeFilesystem({}),
      "darwin"
    );

    expect(status.ready).toBe(false);
    expect(status.code).toBe("manifest_missing");
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

function createRuntimeFilesystem(
  files: Record<string, string>
): MemoryRuntimeFilesystem {
  return {
    executables: new Set<string>(),
    async readFile(filePath: string): Promise<string> {
      const fileContents = files[filePath];

      if (typeof fileContents !== "string") {
        const error = new Error(`Missing file: ${filePath}`) as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }

      return fileContents;
    },
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
