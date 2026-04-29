import type { Command } from "commander";

import {
  loadParsedUraniborgConfig,
  loadRevisionSetupReadiness,
  resolveUraniborgPaths
} from "../../config/index.js";
import { getRevisionProfileLabel } from "../../config/revision-profiles.js";
import {
  collectFeynmanRuntimeSnapshot,
  createNodeFeynmanCommandRunner,
  createSerializedFeynmanCommandRunner,
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  inspectFeynmanRuntime,
  listFeynmanModels,
  type FeynmanCommandRunner,
  type FeynmanReadinessReport,
  type FeynmanRuntimeStatus
} from "../../review/index.js";
import type {
  UraniborgConfig,
  UraniborgConfigLoadError
} from "../../types/app-config.js";
import type { Result } from "../../types/result.js";
import { writeInfo } from "../../ui/output.js";
import {
  promptAndRunRemediations,
  type SharedRemediationDependencies
} from "./shared.js";

export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("Show review and revision model availability.")
    .action(async () => {
      await runModelsCommand();
    });
}

export interface ModelsCommandDependencies extends SharedRemediationDependencies {
  resolvePaths?: typeof resolveUraniborgPaths;
  inspectRuntime?: typeof inspectFeynmanRuntime;
  listModels?: typeof listFeynmanModels;
  getAlphaStatus?: typeof getFeynmanAlphaStatus;
  getSearchStatus?: typeof getFeynmanSearchStatus;
  loadConfig?: typeof loadRevisionSetupReadiness;
  loadParsedConfig?: typeof loadParsedUraniborgConfig;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
  runner?: FeynmanCommandRunner;
}

interface ModelsReport {
  runtimeStatus: FeynmanRuntimeStatus;
  readinessReport: FeynmanReadinessReport;
  readinessConfigResult: Result<UraniborgConfig, UraniborgConfigLoadError>;
  parsedConfigResult: Result<UraniborgConfig, UraniborgConfigLoadError>;
}

export async function runModelsCommand(
  dependencies: ModelsCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const report = await collectModelsReport(dependencies);

  for (const line of renderModelsReport(report)) {
    writeLine(line);
  }

  const actions = report.readinessReport.checks.flatMap((check) =>
    check.remediation === undefined ? [] : [check.remediation]
  );

  await promptAndRunRemediations({
    executablePath: report.runtimeStatus.executablePath,
    actions,
    dependencies: {
      interactive: dependencies.interactive ?? isInteractiveTerminal(),
      launcher: dependencies.launcher,
      prompts: dependencies.prompts,
      writeLine
    }
  });
}

export async function collectModelsReport(
  dependencies: ModelsCommandDependencies = {}
): Promise<ModelsReport> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const inspectRuntime = dependencies.inspectRuntime ?? inspectFeynmanRuntime;
  const listModels = dependencies.listModels ?? listFeynmanModels;
  const getAlphaStatus =
    dependencies.getAlphaStatus ?? getFeynmanAlphaStatus;
  const getSearchStatus =
    dependencies.getSearchStatus ?? getFeynmanSearchStatus;
  const loadConfig = dependencies.loadConfig ?? loadRevisionSetupReadiness;
  const loadParsedConfig =
    dependencies.loadParsedConfig ?? loadParsedUraniborgConfig;
  const runner = createSerializedFeynmanCommandRunner(
    dependencies.runner ?? createNodeFeynmanCommandRunner()
  );

  const paths = resolvePaths();
  const snapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime,
    listModels,
    getAlphaStatus,
    getSearchStatus,
    runner,
    includeReviewModels: true
  });

  const [readinessConfigResult, parsedConfigResult] = await Promise.all([
    loadConfig(paths.configFile, dependencies.environment, undefined),
    loadParsedConfig(paths.configFile)
  ]);

  return {
    runtimeStatus: snapshot.runtimeStatus,
    readinessReport: snapshot.readinessReport,
    readinessConfigResult,
    parsedConfigResult
  };
}

export function renderModelsReport(report: ModelsReport): readonly string[] {
  const lines: string[] = ["Review Runtime"];

  const reviewModelsCheck = report.readinessReport.checks.find(
    (check) => check.code === "review_models"
  );

  if (!report.runtimeStatus.ready) {
    lines.push(
      `[fail] ${report.readinessReport.checks[0]?.summary ?? "Compatible Feynman runtime is not ready."}`
    );
  } else if (reviewModelsCheck?.ready) {
    lines.push(
      `[ok] Using ${report.runtimeStatus.executablePath}${typeof report.runtimeStatus.detectedVersion === "string" ? ` (version ${report.runtimeStatus.detectedVersion})` : ""}.`
    );
    lines.push(
      `[ok] ${report.readinessReport.reviewModels.length} review model${report.readinessReport.reviewModels.length === 1 ? "" : "s"} available through the selected Feynman runtime.`
    );

    for (const model of report.readinessReport.reviewModels) {
      lines.push(`- ${model}`);
    }
  } else {
    lines.push(
      `[fail] ${reviewModelsCheck?.summary ?? "Review model discovery is not ready through the selected Feynman runtime."}`
    );
  }

  lines.push("", "Revision");

  if (report.readinessConfigResult.ok) {
    lines.push(
      `[ok] Revision setup is ready.`
    );
    lines.push(`Active profile: ${getRevisionProfileLabel(report.readinessConfigResult.value.revision.profile.id)}`);
    lines.push(`Default model: ${report.readinessConfigResult.value.revision.defaults.model}`);
  } else if (report.parsedConfigResult.ok) {
    lines.push(`[fail] ${report.readinessConfigResult.error.message}`);
    lines.push(`Active profile: ${getRevisionProfileLabel(report.parsedConfigResult.value.revision.profile.id)}`);
    lines.push(`Default model: ${report.parsedConfigResult.value.revision.defaults.model}`);

    for (const detail of report.readinessConfigResult.error.details ?? []) {
      lines.push(`  ${detail}`);
    }
  } else {
    lines.push(`[fail] ${report.parsedConfigResult.error.message}`);

    for (const detail of report.parsedConfigResult.error.details ?? []) {
      lines.push(`  ${detail}`);
    }
  }

  return lines;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
