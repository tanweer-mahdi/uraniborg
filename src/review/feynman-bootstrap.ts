import { access, constants } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { createOperationCancelledError } from "../types/cancellation.js";

export interface FeynmanCommandExecution {
  executablePath: string;
  args: readonly string[];
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface FeynmanCommandRunner {
  run: (
    executablePath: string,
    args: readonly string[],
    options?: {
      signal?: AbortSignal | undefined;
    }
  ) => Promise<FeynmanCommandExecution>;
}

export interface FeynmanRuntimeFilesystem {
  isExecutable: (filePath: string) => Promise<boolean>;
}

export type FeynmanRuntimeStatusCode =
  | "ready"
  | "runtime_missing"
  | "runtime_incompatible";

export type FeynmanRuntimeCandidateFailureCode =
  | "version_command_failed"
  | "version_unreadable";

export interface FeynmanRuntimeCandidate {
  executablePath: string;
  compatible: boolean;
  detectedVersion?: string | undefined;
  failureCode?: FeynmanRuntimeCandidateFailureCode | undefined;
  details: readonly string[];
}

export interface FeynmanRuntimeStatus {
  ready: boolean;
  code: FeynmanRuntimeStatusCode;
  executablePath?: string | undefined;
  detectedVersion?: string | undefined;
  warnings: readonly string[];
  candidates: readonly FeynmanRuntimeCandidate[];
}

export function createNodeFeynmanRuntimeFilesystem(): FeynmanRuntimeFilesystem {
  return {
    async isExecutable(filePath: string): Promise<boolean> {
      try {
        await access(filePath, constants.X_OK);
        return true;
      } catch (error) {
        if (
          isNodeErrorWithCode(error, "ENOENT") ||
          isNodeErrorWithCode(error, "EACCES")
        ) {
          return false;
        }

        throw error;
      }
    }
  };
}

export function createNodeFeynmanCommandRunner(): FeynmanCommandRunner {
  return {
    async run(
      executablePath: string,
      args: readonly string[],
      options?: {
        signal?: AbortSignal | undefined;
      }
    ): Promise<FeynmanCommandExecution> {
      return new Promise((resolve, reject) => {
        const child = spawn(executablePath, args, {
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";
        let settled = false;

        const finalizeReject = (error: Error): void => {
          if (settled) {
            return;
          }

          settled = true;
          cleanupAbortListener();
          reject(error);
        };

        const finalizeResolve = (execution: FeynmanCommandExecution): void => {
          if (settled) {
            return;
          }

          settled = true;
          cleanupAbortListener();
          resolve(execution);
        };

        const abortListener = (): void => {
          child.kill("SIGTERM");
          finalizeReject(
            createOperationCancelledError("Feynman command cancelled.")
          );
        };
        const cleanupAbortListener = (): void => {
          options?.signal?.removeEventListener("abort", abortListener);
        };

        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
        });

        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });

        if (options?.signal?.aborted) {
          abortListener();
          return;
        }

        options?.signal?.addEventListener("abort", abortListener, { once: true });

        child.on("error", (error) => {
          finalizeReject(error);
        });
        child.on("close", (exitCode) => {
          finalizeResolve({
            executablePath,
            args,
            exitCode: exitCode ?? -1,
            stdout,
            stderr
          });
        });
      });
    }
  };
}

export async function inspectFeynmanRuntime(
  environment: NodeJS.ProcessEnv = process.env,
  runner: FeynmanCommandRunner = createNodeFeynmanCommandRunner(),
  filesystem: FeynmanRuntimeFilesystem = createNodeFeynmanRuntimeFilesystem(),
  platform: NodeJS.Platform = process.platform
): Promise<FeynmanRuntimeStatus> {
  const executablePaths = await findFeynmanExecutablesOnPath(
    "feynman",
    environment["PATH"],
    filesystem,
    platform
  );

  if (executablePaths.length === 0) {
    return {
      ready: false,
      code: "runtime_missing",
      warnings: [],
      candidates: []
    };
  }

  const candidates: FeynmanRuntimeCandidate[] = [];

  for (const executablePath of executablePaths) {
    candidates.push(await inspectRuntimeCandidate(executablePath, runner));
  }
  const compatibleCandidates = candidates.filter((candidate) => candidate.compatible);
  const selectedCandidate = compatibleCandidates[0];

  if (selectedCandidate === undefined) {
    return {
      ready: false,
      code: "runtime_incompatible",
      warnings: [],
      candidates
    };
  }

  const warnings =
    compatibleCandidates.length > 1
      ? [
          `Multiple compatible feynman runtimes were found on PATH. Uraniborg selected ${formatRuntimePathFragment(selectedCandidate.executablePath, selectedCandidate.detectedVersion ?? "unknown")} because it appeared first.`
        ]
      : [];

  return {
    ready: true,
    code: "ready",
    executablePath: selectedCandidate.executablePath,
    detectedVersion: selectedCandidate.detectedVersion,
    warnings,
    candidates
  };
}

export async function runFeynmanCommand(
  executablePath: string,
  args: readonly string[],
  options?: {
    signal?: AbortSignal | undefined;
  },
  runner: FeynmanCommandRunner = createNodeFeynmanCommandRunner()
): Promise<FeynmanCommandExecution> {
  return runner.run(executablePath, args, options);
}

export function parseFeynmanVersion(output: string): string | null {
  const versionMatch = output.match(/\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/);
  return versionMatch?.[0] ?? null;
}

export async function findFeynmanExecutablesOnPath(
  executableName: string,
  environmentPath: string | undefined,
  filesystem: FeynmanRuntimeFilesystem,
  platform: NodeJS.Platform
): Promise<readonly string[]> {
  if (typeof environmentPath !== "string" || environmentPath.length === 0) {
    return [];
  }

  const executableNames =
    platform === "win32"
      ? [`${executableName}.exe`, `${executableName}.cmd`, executableName]
      : [executableName];
  const discoveredPaths: string[] = [];
  const seen = new Set<string>();

  for (const pathEntry of environmentPath.split(path.delimiter)) {
    if (pathEntry.length === 0) {
      continue;
    }

    for (const candidateName of executableNames) {
      const candidatePath = path.join(pathEntry, candidateName);

      if (seen.has(candidatePath)) {
        continue;
      }

      seen.add(candidatePath);

      if (await filesystem.isExecutable(candidatePath)) {
        discoveredPaths.push(candidatePath);
      }
    }
  }

  return discoveredPaths;
}

async function inspectRuntimeCandidate(
  executablePath: string,
  runner: FeynmanCommandRunner
): Promise<FeynmanRuntimeCandidate> {
  try {
    const execution = await runner.run(executablePath, ["--version"]);
    const detectedVersion = parseFeynmanVersion(
      `${execution.stdout}\n${execution.stderr}`
    );

    if (execution.exitCode !== 0) {
      return {
        executablePath,
        compatible: false,
        failureCode: "version_command_failed",
        details: collectExecutionDetails(execution)
      };
    }

    if (detectedVersion === null) {
      return {
        executablePath,
        compatible: false,
        failureCode: "version_unreadable",
        details: collectExecutionDetails(execution)
      };
    }

    return {
      executablePath,
      compatible: true,
      detectedVersion,
      details: [`Version: ${detectedVersion}`]
    };
  } catch (error) {
    return {
      executablePath,
      compatible: false,
      failureCode: "version_command_failed",
      details: [error instanceof Error ? error.message : "Unknown version failure."]
    };
  }
}

function collectExecutionDetails(
  execution: FeynmanCommandExecution
): readonly string[] {
  const stdout = execution.stdout.trim();
  const stderr = execution.stderr.trim();

  return [
    `Exit code: ${execution.exitCode}`,
    ...(stdout.length > 0 ? [`stdout: ${collapseWhitespace(stdout)}`] : []),
    ...(stderr.length > 0 ? [`stderr: ${collapseWhitespace(stderr)}`] : [])
  ];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatRuntimePathFragment(
  executablePath: string,
  version: string
): string {
  return `${executablePath}, version ${version}`;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
