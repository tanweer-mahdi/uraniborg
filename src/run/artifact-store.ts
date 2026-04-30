import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveIterationDirectory, resolveRunDirectory } from "../config/paths.js";

export interface RunFilesystem {
  mkdir: (directoryPath: string) => Promise<void>;
  readFile: (filePath: string) => Promise<string>;
  rename: (sourcePath: string, targetPath: string) => Promise<void>;
  writeFile: (filePath: string, contents: string) => Promise<void>;
}

export interface RunArtifactPaths {
  runDirectory: string;
  manifestFile: string;
  configSnapshotFile: string;
  originalDraftFile: string;
  currentDraftFile: string;
  finalDraftFile: string;
  informationHighwayFile: string;
}

export interface IterationArtifactPaths {
  iterationDirectory: string;
  inputFile: string;
  reviewFile: string;
  refinedDraftFile: string;
  changesFile: string;
  reviewLogFile: string;
  refineLogFile: string;
  refineResponseFile: string;
}

export function createNodeRunFilesystem(): RunFilesystem {
  return {
    async mkdir(directoryPath: string): Promise<void> {
      await mkdir(directoryPath, { recursive: true });
    },
    async readFile(filePath: string): Promise<string> {
      return readFile(filePath, "utf8");
    },
    async rename(sourcePath: string, targetPath: string): Promise<void> {
      await rename(sourcePath, targetPath);
    },
    async writeFile(filePath: string, contents: string): Promise<void> {
      await writeFile(filePath, contents, "utf8");
    }
  };
}

export function resolveRunArtifactPaths(
  runsDirectory: string,
  runId: string
): RunArtifactPaths {
  const runDirectory = resolveRunDirectory({ runsDirectory }, runId);

  return {
    runDirectory,
    manifestFile: path.join(runDirectory, "run.json"),
    configSnapshotFile: path.join(runDirectory, "config.snapshot.json"),
    originalDraftFile: path.join(runDirectory, "original.md"),
    currentDraftFile: path.join(runDirectory, "current.md"),
    finalDraftFile: path.join(runDirectory, "final.md"),
    informationHighwayFile: path.join(runDirectory, "information-highway.md")
  };
}

export function resolveIterationArtifactPaths(
  runDirectory: string,
  iterationNumber: number
): IterationArtifactPaths {
  const iterationDirectory = resolveIterationDirectory(runDirectory, iterationNumber);

  return {
    iterationDirectory,
    inputFile: path.join(iterationDirectory, "input.md"),
    reviewFile: path.join(iterationDirectory, "review.md"),
    refinedDraftFile: path.join(iterationDirectory, "refined.md"),
    changesFile: path.join(iterationDirectory, "changes.md"),
    reviewLogFile: path.join(iterationDirectory, "review.log"),
    refineLogFile: path.join(iterationDirectory, "refine.log"),
    refineResponseFile: path.join(iterationDirectory, "refine.response.txt")
  };
}

export async function createTimestampedRunDirectory(
  runsDirectory: string,
  runId: string,
  filesystem: RunFilesystem = createNodeRunFilesystem()
): Promise<RunArtifactPaths> {
  const artifactPaths = resolveRunArtifactPaths(runsDirectory, runId);
  await filesystem.mkdir(artifactPaths.runDirectory);
  return artifactPaths;
}

export async function ensureIterationDirectory(
  runDirectory: string,
  iterationNumber: number,
  filesystem: RunFilesystem = createNodeRunFilesystem()
): Promise<IterationArtifactPaths> {
  const artifactPaths = resolveIterationArtifactPaths(runDirectory, iterationNumber);
  await filesystem.mkdir(artifactPaths.iterationDirectory);
  return artifactPaths;
}

export async function writeArtifactFile(
  filePath: string,
  contents: string,
  filesystem: RunFilesystem = createNodeRunFilesystem()
): Promise<void> {
  await writeAtomically(filePath, contents, filesystem);
}

export async function readArtifactFile(
  filePath: string,
  filesystem: RunFilesystem = createNodeRunFilesystem()
): Promise<string> {
  return filesystem.readFile(filePath);
}

async function writeAtomically(
  filePath: string,
  contents: string,
  filesystem: RunFilesystem
): Promise<void> {
  const temporaryPath = `${filePath}.tmp`;
  await filesystem.writeFile(temporaryPath, contents);
  await filesystem.rename(temporaryPath, filePath);
}
