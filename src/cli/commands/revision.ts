import type { Command } from "commander";

import {
  ensureUraniborgAppHome,
  loadParsedUraniborgConfig,
  loadUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import type {
  ResolvedUraniborgConfig,
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
  loadResolvedConfig?: typeof loadUraniborgConfig;
  loadParsedConfig?: typeof loadParsedUraniborgConfig;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
}

interface RevisionConfigReport {
  configFilePath: string;
  resolvedConfigResult: Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>;
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
  const loadResolvedConfig =
    dependencies.loadResolvedConfig ?? loadUraniborgConfig;
  const loadParsedConfig =
    dependencies.loadParsedConfig ?? loadParsedUraniborgConfig;

  const paths = resolvePaths();
  await ensureAppHome(paths);

  const [resolvedConfigResult, parsedConfigResult] = await Promise.all([
    loadResolvedConfig(paths.configFile, dependencies.environment),
    loadParsedConfig(paths.configFile)
  ]);

  return {
    configFilePath: paths.configFile,
    resolvedConfigResult,
    parsedConfigResult
  };
}

function renderRevisionConfigReport(
  report: RevisionConfigReport
): readonly string[] {
  const lines: string[] = ["Revision Configuration"];

  if (report.resolvedConfigResult.ok) {
    lines.push("[ok] Revision setup is ready.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(
      `Endpoint: ${report.resolvedConfigResult.value.refine.endpoint.baseUrl}`
    );
    lines.push(
      `Default model: ${report.resolvedConfigResult.value.refine.defaults.model}`
    );
    lines.push("API key: stored in Uraniborg config (redacted)");

    return lines;
  }

  if (report.parsedConfigResult.ok) {
    lines.push("[fail] Revision setup is incomplete.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(
      `Endpoint: ${report.parsedConfigResult.value.refine.endpoint.baseUrl}`
    );
    lines.push(
      `Default model: ${report.parsedConfigResult.value.refine.defaults.model}`
    );
    lines.push(formatApiKeyStatus(report.parsedConfigResult.value));
    lines.push(`  ${report.resolvedConfigResult.error.message}`);

    for (const detail of report.resolvedConfigResult.error.details ?? []) {
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

function formatApiKeyStatus(config: UraniborgConfig): string {
  if (typeof config.refine.endpoint.apiKey === "string") {
    return "API key: stored in Uraniborg config (redacted)";
  }

  if (typeof config.refine.endpoint.apiKeyEnvVar === "string") {
    return `API key: sourced from environment variable "${config.refine.endpoint.apiKeyEnvVar}"`;
  }

  return "API key: not configured";
}
