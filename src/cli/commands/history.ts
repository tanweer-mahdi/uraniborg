import { readdir } from "node:fs/promises";
import path from "node:path";

import type { Command } from "commander";

import { resolveUraniborgPaths } from "../../config/index.js";
import {
  openRunSnapshot,
  type HistoryViewerDependencies,
  type OpenRunSnapshotResult
} from "../../history-viewer/index.js";
import { readRunManifest, type RunManifest } from "../../run/index.js";
import { writeInfo } from "../../ui/output.js";

export interface HistoryCommandDependencies {
  filesystem?: {
    readdir: (directoryPath: string) => Promise<readonly string[]>;
  };
  readManifest?: typeof readRunManifest;
  resolvePaths?: typeof resolveUraniborgPaths;
  writeLine?: (message: string) => void;
  viewer?: HistoryViewerDependencies;
  openRunSnapshot?: (
    runId: string,
    dependencies?: HistoryViewerDependencies
  ) => Promise<OpenRunSnapshotResult>;
}

export interface HistoryEntry {
  runId: string;
  createdAt: string;
  status: string;
  progress: string;
  title: string;
}

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("List prior Uraniborg runs.")
    .option("--web <runId>", "Open a selected run as a local HTML snapshot.")
    .action(async (options: { web?: string }) => {
      if (options.web !== undefined) {
        await runHistoryWebCommand(options.web);
        return;
      }

      await runHistoryCommand();
    });
}

export async function runHistoryCommand(
  dependencies: HistoryCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const entries = await collectHistoryEntries(dependencies);

  if (entries.length === 0) {
    writeLine("No Uraniborg runs are available.");
    return;
  }

  for (const entry of entries) {
    writeLine(formatHistoryLine(entry));
  }
}

export async function runHistoryWebCommand(
  runId: string,
  dependencies: HistoryCommandDependencies = {}
): Promise<OpenRunSnapshotResult> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const openSnapshot = dependencies.openRunSnapshot ?? openRunSnapshot;
  const result = await openSnapshot(runId, {
    ...dependencies.viewer,
    ...(dependencies.resolvePaths === undefined
      ? {}
      : {
          resolvePaths: dependencies.resolvePaths
        })
  });

  writeLine(`Generated run snapshot: ${result.snapshotFile}`);

  if (result.browser.opened) {
    writeLine(`Opened run snapshot: ${result.snapshotUrl}`);
  } else {
    writeLine(`Open manually: ${result.snapshotUrl}`);
    writeLine(`Browser launch failed: ${result.browser.message}`);
  }

  return result;
}

export async function collectHistoryEntries(
  dependencies: HistoryCommandDependencies = {}
): Promise<readonly HistoryEntry[]> {
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
      return [];
    }

    throw error;
  }

  const manifests = await Promise.all(
    [...runDirectories].map(async (runId) =>
      readManifestFn(path.join(paths.runsDirectory, runId, "run.json"))
    )
  );

  return manifests
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((manifest) => toHistoryEntry(manifest));
}

export function formatHistoryLine(entry: HistoryEntry): string {
  return `${entry.runId} | ${entry.createdAt} | ${entry.status} | ${entry.progress} | ${entry.title}`;
}

function toHistoryEntry(manifest: RunManifest): HistoryEntry {
  return {
    runId: manifest.runId,
    createdAt: manifest.createdAt,
    status: manifest.status,
    progress: `${manifest.iterationsCompleted}/${manifest.iterationsPlanned}`,
    title: manifest.title
  };
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
