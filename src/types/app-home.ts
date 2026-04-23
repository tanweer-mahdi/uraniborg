export const URANIBORG_APP_DIRECTORY_NAME = ".uraniborg";
export const URANIBORG_CONFIG_FILENAME = "config.json";
export const URANIBORG_VENDOR_DIRECTORY_NAME = "vendor";
export const URANIBORG_FEYNMAN_DIRECTORY_NAME = "feynman";
export const URANIBORG_FEYNMAN_RUNTIME_MANIFEST_FILENAME = "runtime.json";
export const URANIBORG_RUNS_DIRECTORY_NAME = "runs";

export interface UraniborgPathResolutionOptions {
  homeDirectory?: string;
  appDirectoryName?: string;
}

export interface UraniborgPaths {
  homeDirectory: string;
  appHomeDirectory: string;
  configFile: string;
  vendorDirectory: string;
  feynmanRuntimeDirectory: string;
  feynmanRuntimeManifestFile: string;
  runsDirectory: string;
}
