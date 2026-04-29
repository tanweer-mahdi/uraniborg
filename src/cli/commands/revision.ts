import type { Command } from "commander";

import {
  ensureUraniborgAppHome,
  loadParsedUraniborgConfig,
  loadRevisionSetupReadiness,
  resolveUraniborgPaths
} from "../../config/index.js";
import { getRevisionProfileLabel } from "../../config/revision-profiles.js";
import type {
  UraniborgConfig,
  UraniborgConfigLoadError
} from "../../types/app-config.js";
import type { Result } from "../../types/result.js";
import { writeInfo } from "../../ui/output.js";
import {
  runGuidedRevisionSetup,
  type RevisionSetupDependencies
} from "./revision-setup.js";

export interface RevisionCommandOptions {
  setup?: boolean | undefined;
  config?: boolean | undefined;
}

export interface RevisionCommandDependencies extends RevisionSetupDependencies {
  loadRevisionReadiness?: typeof loadRevisionSetupReadiness;
  loadParsedConfig?: typeof loadParsedUraniborgConfig;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
}

interface RevisionConfigReport {
  configFilePath: string;
  readinessResult: Result<UraniborgConfig, UraniborgConfigLoadError>;
  parsedConfigResult: Result<UraniborgConfig, UraniborgConfigLoadError>;
}

export function registerRevisionCommand(program: Command): void {
  program
    .command("revision")
    .description("View or update Uraniborg revision configuration.")
    .option("--setup", "Run the guided revision setup flow.")
    .option("--config", "Show the current revision configuration.")
    .action(async (options: RevisionCommandOptions) => {
      await runRevisionCommand(options);
    });
}

export async function runRevisionCommand(
  options: RevisionCommandOptions,
  dependencies: RevisionCommandDependencies = {}
): Promise<void> {
  if ((options.setup ?? false) === (options.config ?? false)) {
    throw new Error(
      'Choose exactly one of `--setup` or `--config` when running `uraniborg revision`.'
    );
  }

  if (options.setup) {
    await runGuidedRevisionSetup(dependencies);
    return;
  }

  await runRevisionConfigCommand(dependencies);
}

export async function runRevisionConfigCommand(
  dependencies: RevisionCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const report = await collectRevisionConfigReport(dependencies);

  for (const line of renderRevisionConfigReport(report)) {
    writeLine(line);
  }
}

async function collectRevisionConfigReport(
  dependencies: RevisionCommandDependencies
): Promise<RevisionConfigReport> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const loadRevisionReadiness =
    dependencies.loadRevisionReadiness ?? loadRevisionSetupReadiness;
  const loadParsedConfig =
    dependencies.loadParsedConfig ?? loadParsedUraniborgConfig;

  const paths = resolvePaths();
  await ensureAppHome(paths);

  const [readinessResult, parsedConfigResult] = await Promise.all([
    loadRevisionReadiness(paths.configFile, dependencies.environment),
    loadParsedConfig(paths.configFile)
  ]);

  return {
    configFilePath: paths.configFile,
    readinessResult,
    parsedConfigResult
  };
}

function renderRevisionConfigReport(
  report: RevisionConfigReport
): readonly string[] {
  const lines: string[] = ["Revision Configuration"];

  if (report.readinessResult.ok) {
    lines.push("[ok] Revision setup is ready.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(formatActiveProfileLine(report.readinessResult.value));
    lines.push(formatDefaultModelLine(report.readinessResult.value));

    return lines;
  }

  if (report.parsedConfigResult.ok) {
    lines.push("[fail] Revision setup is incomplete.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(formatActiveProfileLine(report.parsedConfigResult.value));
    lines.push(formatDefaultModelLine(report.parsedConfigResult.value));
    lines.push(`  ${report.readinessResult.error.message}`);

    for (const detail of report.readinessResult.error.details ?? []) {
      lines.push(`  ${detail}`);
    }

    lines.push(
      "  Run `uraniborg revision --setup` or `uraniborg init` to update revision configuration."
    );

    return lines;
  }

  lines.push("[fail] Revision setup is incomplete.");
  lines.push(`Config: ${report.configFilePath}`);
  lines.push(`  ${report.parsedConfigResult.error.message}`);

  for (const detail of report.parsedConfigResult.error.details ?? []) {
    lines.push(`  ${detail}`);
  }

  lines.push(
    "  Run `uraniborg revision --setup` or `uraniborg init` to create revision configuration."
  );

  return lines;
}

function formatActiveProfileLine(
  config: Pick<UraniborgConfig, "revision">
): string {
  return `Active profile: ${getRevisionProfileLabel(config.revision.profile.id)}`;
}

function formatDefaultModelLine(
  config: Pick<UraniborgConfig, "revision">
): string {
  return `Default model: ${config.revision.defaults.model}`;
}
