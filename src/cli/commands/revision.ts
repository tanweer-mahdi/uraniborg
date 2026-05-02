import type { Command } from "commander";

import {
  ensureUraniborgAppHome,
  loadParsedUraniborgConfig,
  loadRevisionSetupReadiness,
  resolveUraniborgPaths
} from "../../config/index.js";
import { getRevisionProfileLabel } from "../../config/revision-profiles.js";
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
  loadRevisionReadiness?: typeof loadRevisionSetupReadiness;
  loadParsedConfig?: typeof loadParsedUraniborgConfig;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
}

export interface RevisionConfigReport {
  configFilePath: string;
  readinessResult: Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>;
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

export async function collectRevisionConfigReport(
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

export function renderRevisionConfigReport(
  report: RevisionConfigReport
): readonly string[] {
  const lines: string[] = ["Revision Configuration"];

  if (report.readinessResult.ok) {
    lines.push("[ok] Revision setup is ready.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(formatActiveProfileLine(report.readinessResult.value));
    lines.push(formatDefaultModelLine(report.readinessResult.value));
    lines.push(...renderRevisionInstructionReport(report));

    return lines;
  }

  if (report.parsedConfigResult.ok) {
    lines.push("[fail] Revision setup is incomplete.");
    lines.push(`Config: ${report.configFilePath}`);
    lines.push(formatActiveProfileLine(report.parsedConfigResult.value));
    lines.push(formatDefaultModelLine(report.parsedConfigResult.value));
    lines.push(...renderRevisionInstructionReport(report));
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
  config: {
    revision: {
      profile: Pick<UraniborgConfig["revision"]["profile"], "id">;
    };
  }
): string {
  return `Active profile: ${getRevisionProfileLabel(config.revision.profile.id)}`;
}

function formatDefaultModelLine(
  config: {
    revision: {
      defaults: Pick<UraniborgConfig["revision"]["defaults"], "model">;
    };
  }
): string {
  return `Default model: ${config.revision.defaults.model}`;
}

export function renderRevisionInstructionReport(
  report: RevisionConfigReport
): readonly string[] {
  if (report.readinessResult.ok) {
    return formatRevisionInstructionLines(report.readinessResult.value);
  }

  if (!report.parsedConfigResult.ok) {
    return ["Revision prompt: Uraniborg default guidance"];
  }

  const lines = formatConfiguredPromptPathLines(report.parsedConfigResult.value);

  if (report.readinessResult.error.code !== "revision_instruction_prompt_unreadable") {
    return lines;
  }

  return [
    ...lines,
    report.readinessResult.error.message,
    ...(report.readinessResult.error.details ?? []).map((detail) => `  ${detail}`)
  ];
}

function formatRevisionInstructionLines(
  config: Pick<ResolvedUraniborgConfig, "revision">
): readonly string[] {
  if (config.revision.instructionPrompt.source === "default") {
    return ["Revision prompt: Uraniborg default guidance"];
  }

  return [
    "Revision prompt: custom guidance file",
    `Prompt path: ${config.revision.instructionPrompt.configuredPath ?? "unknown"}`,
    "Custom guidance preview:",
    ...indentLines(
      previewInstruction(config.revision.instructionPrompt.effectiveInstruction)
    )
  ];
}

function formatConfiguredPromptPathLines(
  config: Pick<UraniborgConfig, "revision">
): readonly string[] {
  const configuredPath = config.revision.instructionPrompt?.sourceFile;

  if (configuredPath === undefined) {
    return ["Revision prompt: Uraniborg default guidance"];
  }

  return [
    "Revision prompt: custom guidance file",
    `Prompt path: ${configuredPath}`,
    "Custom guidance preview: unavailable until the prompt file is readable."
  ];
}

function previewInstruction(instruction: string): readonly string[] {
  const lines = instruction
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6);

  if (lines.length === 0) {
    return ["(empty)"];
  }

  return lines;
}

function indentLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => `  ${line}`);
}
