import { mkdir, stat } from "node:fs/promises";

import type { UraniborgPaths } from "../types/app-home.js";

export type FilesystemEntryKind = "missing" | "directory" | "file" | "other";

export interface FilesystemEntryStatus {
  kind: FilesystemEntryKind;
  path: string;
}

export interface UraniborgAppHomeStatus {
  paths: UraniborgPaths;
  appHome: FilesystemEntryStatus;
  vendor: FilesystemEntryStatus;
  feynmanRuntime: FilesystemEntryStatus;
  runs: FilesystemEntryStatus;
  isLayoutValid: boolean;
}

export interface AppHomeFilesystem {
  mkdir: (directoryPath: string) => Promise<void>;
  stat: (entryPath: string) => Promise<FilesystemEntryKind>;
}

export function createNodeAppHomeFilesystem(): AppHomeFilesystem {
  return {
    async mkdir(directoryPath: string): Promise<void> {
      await mkdir(directoryPath, { recursive: true });
    },
    async stat(entryPath: string): Promise<FilesystemEntryKind> {
      try {
        const entry = await stat(entryPath);

        if (entry.isDirectory()) {
          return "directory";
        }

        if (entry.isFile()) {
          return "file";
        }

        return "other";
      } catch (error) {
        if (isNodeErrorWithCode(error, "ENOENT")) {
          return "missing";
        }

        throw error;
      }
    }
  };
}

export async function inspectUraniborgAppHome(
  paths: UraniborgPaths,
  filesystem: AppHomeFilesystem = createNodeAppHomeFilesystem()
): Promise<UraniborgAppHomeStatus> {
  const appHome = await inspectEntry(paths.appHomeDirectory, filesystem);
  const vendor = await inspectEntry(paths.vendorDirectory, filesystem);
  const feynmanRuntime = await inspectEntry(
    paths.feynmanRuntimeDirectory,
    filesystem
  );
  const runs = await inspectEntry(paths.runsDirectory, filesystem);

  return {
    paths,
    appHome,
    vendor,
    feynmanRuntime,
    runs,
    isLayoutValid:
      appHome.kind === "directory" &&
      vendor.kind === "directory" &&
      feynmanRuntime.kind === "directory" &&
      runs.kind === "directory"
  };
}

export async function ensureUraniborgAppHome(
  paths: UraniborgPaths,
  filesystem: AppHomeFilesystem = createNodeAppHomeFilesystem()
): Promise<UraniborgAppHomeStatus> {
  await filesystem.mkdir(paths.appHomeDirectory);
  await filesystem.mkdir(paths.vendorDirectory);
  await filesystem.mkdir(paths.feynmanRuntimeDirectory);
  await filesystem.mkdir(paths.runsDirectory);

  return inspectUraniborgAppHome(paths, filesystem);
}

async function inspectEntry(
  entryPath: string,
  filesystem: AppHomeFilesystem
): Promise<FilesystemEntryStatus> {
  return {
    path: entryPath,
    kind: await filesystem.stat(entryPath)
  };
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
