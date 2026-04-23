import { access, constants, readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { z } from "zod";

import type { UraniborgPaths } from "../types/app-home.js";

const pinnedFeynmanRuntimeManifestSchema = z.object({
  version: z.string().trim().min(1),
  executableRelativePath: z.string().trim().min(1).optional()
});

export interface PinnedFeynmanRuntimeManifest {
  version: string;
  executableRelativePath?: string | undefined;
}

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
    args: readonly string[]
  ) => Promise<FeynmanCommandExecution>;
}

export interface FeynmanRuntimeFilesystem {
  readFile: (filePath: string) => Promise<string>;
  isExecutable: (filePath: string) => Promise<boolean>;
}

export type PinnedFeynmanRuntimeStatusCode =
  | "ready"
  | "manifest_missing"
  | "manifest_invalid"
  | "executable_missing"
  | "version_unreadable"
  | "version_mismatch";

export interface PinnedFeynmanRuntimeStatus {
  ready: boolean;
  code: PinnedFeynmanRuntimeStatusCode;
  manifestPath: string;
  executablePath: string;
  expectedVersion?: string | undefined;
  detectedVersion?: string | undefined;
  warnings: string[];
}

export function createNodeFeynmanRuntimeFilesystem(): FeynmanRuntimeFilesystem {
  return {
    async readFile(filePath: string): Promise<string> {
      return readFile(filePath, "utf8");
    },
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
      args: readonly string[]
    ): Promise<FeynmanCommandExecution> {
      return new Promise((resolve, reject) => {
        const child = spawn(executablePath, args, {
          stdio: ["ignore", "pipe", "pipe"]
        });
        let stdout = "";
        let stderr = "";

        child.stdout.setEncoding("utf8");
        child.stdout.on("data", (chunk: string) => {
          stdout += chunk;
        });

        child.stderr.setEncoding("utf8");
        child.stderr.on("data", (chunk: string) => {
          stderr += chunk;
        });

        child.on("error", reject);
        child.on("close", (exitCode) => {
          resolve({
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

export async function loadPinnedFeynmanRuntimeManifest(
  manifestPath: string,
  filesystem: FeynmanRuntimeFilesystem = createNodeFeynmanRuntimeFilesystem()
): Promise<PinnedFeynmanRuntimeManifest | null> {
  try {
    const fileContents = await filesystem.readFile(manifestPath);
    const parsedJson = JSON.parse(fileContents) as unknown;
    const parsedManifest =
      pinnedFeynmanRuntimeManifestSchema.safeParse(parsedJson);

    return parsedManifest.success ? parsedManifest.data : null;
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return null;
    }

    throw error;
  }
}

export function resolvePinnedFeynmanExecutablePath(
  paths: Pick<UraniborgPaths, "feynmanRuntimeDirectory">,
  manifest: PinnedFeynmanRuntimeManifest,
  platform: NodeJS.Platform = process.platform
): string {
  const executableRelativePath =
    manifest.executableRelativePath ?? getDefaultExecutableRelativePath(platform);

  return path.join(paths.feynmanRuntimeDirectory, executableRelativePath);
}

export async function inspectPinnedFeynmanRuntime(
  paths: Pick<UraniborgPaths, "feynmanRuntimeDirectory" | "feynmanRuntimeManifestFile">,
  environment: NodeJS.ProcessEnv = process.env,
  runner: FeynmanCommandRunner = createNodeFeynmanCommandRunner(),
  filesystem: FeynmanRuntimeFilesystem = createNodeFeynmanRuntimeFilesystem(),
  platform: NodeJS.Platform = process.platform
): Promise<PinnedFeynmanRuntimeStatus> {
  const manifest = await loadPinnedFeynmanRuntimeManifest(
    paths.feynmanRuntimeManifestFile,
    filesystem
  );

  if (manifest === null) {
    return {
      ready: false,
      code: "manifest_missing",
      manifestPath: paths.feynmanRuntimeManifestFile,
      executablePath: path.join(
        paths.feynmanRuntimeDirectory,
        getDefaultExecutableRelativePath(platform)
      ),
      warnings: []
    };
  }

  const executablePath = resolvePinnedFeynmanExecutablePath(paths, manifest, platform);
  const executableExists = await filesystem.isExecutable(executablePath);

  if (!executableExists) {
    return {
      ready: false,
      code: "executable_missing",
      manifestPath: paths.feynmanRuntimeManifestFile,
      executablePath,
      expectedVersion: manifest.version,
      warnings: []
    };
  }

  const versionResult = await runner.run(executablePath, ["--version"]);
  const detectedVersion = parseFeynmanVersion(versionResult.stdout);

  if (detectedVersion === null) {
    return {
      ready: false,
      code: "version_unreadable",
      manifestPath: paths.feynmanRuntimeManifestFile,
      executablePath,
      expectedVersion: manifest.version,
      warnings: []
    };
  }

  if (detectedVersion !== manifest.version) {
    return {
      ready: false,
      code: "version_mismatch",
      manifestPath: paths.feynmanRuntimeManifestFile,
      executablePath,
      expectedVersion: manifest.version,
      detectedVersion,
      warnings: []
    };
  }

  const warnings = await collectPathConflictWarnings(
    executablePath,
    detectedVersion,
    environment,
    runner,
    filesystem,
    platform
  );

  return {
    ready: true,
    code: "ready",
    manifestPath: paths.feynmanRuntimeManifestFile,
    executablePath,
    expectedVersion: manifest.version,
    detectedVersion,
    warnings
  };
}

export async function runPinnedFeynmanCommand(
  executablePath: string,
  args: readonly string[],
  runner: FeynmanCommandRunner = createNodeFeynmanCommandRunner()
): Promise<FeynmanCommandExecution> {
  return runner.run(executablePath, args);
}

export function parseFeynmanVersion(output: string): string | null {
  const versionMatch = output.match(/\b\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?\b/);
  return versionMatch?.[0] ?? null;
}

async function collectPathConflictWarnings(
  pinnedExecutablePath: string,
  pinnedVersion: string,
  environment: NodeJS.ProcessEnv,
  runner: FeynmanCommandRunner,
  filesystem: FeynmanRuntimeFilesystem,
  platform: NodeJS.Platform
): Promise<string[]> {
  const globalFeynmanPath = await findExecutableOnPath(
    "feynman",
    environment["PATH"],
    filesystem,
    platform
  );

  if (globalFeynmanPath === null || globalFeynmanPath === pinnedExecutablePath) {
    return [];
  }

  const globalVersionResult = await runner.run(globalFeynmanPath, ["--version"]);
  const globalVersion = parseFeynmanVersion(globalVersionResult.stdout);

  if (globalVersion === null || globalVersion === pinnedVersion) {
    return [];
  }

  return [
    `Global feynman on PATH (${globalVersionPathFragment(
      globalFeynmanPath,
      globalVersion
    )}) differs from pinned runtime version ${pinnedVersion}. Uraniborg will continue using the pinned runtime.`
  ];
}

async function findExecutableOnPath(
  executableName: string,
  environmentPath: string | undefined,
  filesystem: FeynmanRuntimeFilesystem,
  platform: NodeJS.Platform
): Promise<string | null> {
  if (typeof environmentPath !== "string" || environmentPath.length === 0) {
    return null;
  }

  const executableNames =
    platform === "win32"
      ? [`${executableName}.exe`, `${executableName}.cmd`, executableName]
      : [executableName];

  for (const pathEntry of environmentPath.split(path.delimiter)) {
    if (pathEntry.length === 0) {
      continue;
    }

    for (const candidateName of executableNames) {
      const candidatePath = path.join(pathEntry, candidateName);

      if (await filesystem.isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function getDefaultExecutableRelativePath(platform: NodeJS.Platform): string {
  return platform === "win32" ? path.join("bin", "feynman.exe") : path.join("bin", "feynman");
}

function globalVersionPathFragment(
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
