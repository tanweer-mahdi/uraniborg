import { readdir } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { resolveUraniborgPaths } from "../../config/index.js";
import { readRunManifest, type RunManifest } from "../../run/index.js";
import { writeInfo } from "../../ui/output.js";

export interface HistoryCommandDependencies {
  filesystem?: {
    readdir: (directoryPath: string) => Promise<readonly string[]>;
  };
  readManifest?: typeof readRunManifest;
  resolvePaths?: typeof resolveUraniborgPaths;
  writeLine?: (message: string) => void;
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("List prior Uraniborg runs.")
    .action(async () => {
      await runHistoryCommand();
    });
}

export async function runHistoryCommand(
  dependencies: HistoryCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const paths = (dependencies.resolvePaths ?? resolveUraniborgPaths)();
  const filesystem = dependencies.filesystem ?? {
    async readdir(directoryPath: string): Promise<readonly string[]> {
      return readdir(directoryPath);
    }
  };
  const readManifestFn = dependencies.readManifest ?? readRunManifest;

  let runDirectories: readonly string[];

  try {
    runDirectories = await filesystem.readdir(paths.runsDirectory);
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      writeLine("No Uraniborg runs are available.");
      return;
    }

    throw error;
  }

  if (runDirectories.length === 0) {
    writeLine("No Uraniborg runs are available.");
    return;
  }

  const manifests = await Promise.all(
    [...runDirectories].map(async (runId) => {
      const manifest = await readManifestFn(
        path.join(paths.runsDirectory, runId, "run.json")
      );

      return manifest;
    })
  );

  const sortedManifests = manifests.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );

  for (const manifest of sortedManifests) {
    writeLine(formatHistoryLine(manifest));
  }
}

function formatHistoryLine(manifest: RunManifest): string {
  return `${manifest.runId} | ${manifest.createdAt} | ${manifest.status} | ${manifest.iterationsCompleted}/${manifest.iterationsPlanned} | ${manifest.title}`;
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
