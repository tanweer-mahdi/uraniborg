import path from "node:path";
import { homedir } from "node:os";

import {
  URANIBORG_APP_DIRECTORY_NAME,
  URANIBORG_CONFIG_FILENAME,
  URANIBORG_FEYNMAN_DIRECTORY_NAME,
  URANIBORG_FEYNMAN_RUNTIME_MANIFEST_FILENAME,
  URANIBORG_RUNS_DIRECTORY_NAME,
  URANIBORG_VENDOR_DIRECTORY_NAME,
  type UraniborgPathResolutionOptions,
  type UraniborgPaths
} from "../types/app-home.js";

export function resolveUraniborgPaths(
  options: UraniborgPathResolutionOptions = {}
): UraniborgPaths {
  const homeDirectory = options.homeDirectory ?? homedir();
  const appDirectoryName =
    options.appDirectoryName ?? URANIBORG_APP_DIRECTORY_NAME;
  const appHomeDirectory = path.resolve(homeDirectory, appDirectoryName);
  const vendorDirectory = path.join(
    appHomeDirectory,
    URANIBORG_VENDOR_DIRECTORY_NAME
  );
  const feynmanRuntimeDirectory = path.join(
    vendorDirectory,
    URANIBORG_FEYNMAN_DIRECTORY_NAME
  );
  const feynmanRuntimeManifestFile = path.join(
    feynmanRuntimeDirectory,
    URANIBORG_FEYNMAN_RUNTIME_MANIFEST_FILENAME
  );
  const runsDirectory = path.join(appHomeDirectory, URANIBORG_RUNS_DIRECTORY_NAME);
  const configFile = path.join(appHomeDirectory, URANIBORG_CONFIG_FILENAME);

  return {
    homeDirectory,
    appHomeDirectory,
    configFile,
    vendorDirectory,
    feynmanRuntimeDirectory,
    feynmanRuntimeManifestFile,
    runsDirectory
  };
}

export function resolveRunDirectory(
  paths: Pick<UraniborgPaths, "runsDirectory">,
  runId: string
): string {
  return path.join(paths.runsDirectory, runId);
}

export function resolveIterationDirectory(
  runDirectory: string,
  iterationNumber: number
): string {
  return path.join(runDirectory, `iter-${iterationNumber}`);
}

export function resolvePathFromCwd(inputPath: string, cwd: string): string {
  return path.isAbsolute(inputPath)
    ? path.normalize(inputPath)
    : path.resolve(cwd, inputPath);
}

export function isMarkdownFilePath(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".md";
}
