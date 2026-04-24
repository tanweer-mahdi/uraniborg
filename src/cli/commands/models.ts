import type { Command } from "commander";

import {
  loadParsedUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import {
  classifyFeynmanReadiness,
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
    .description("Show review and refinement model availability.")
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
  loadConfig?: typeof loadParsedUraniborgConfig;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
  runner?: FeynmanCommandRunner;
}

interface ModelsReport {
  runtimeStatus: FeynmanRuntimeStatus;
  readinessReport: FeynmanReadinessReport;
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
  const loadConfig = dependencies.loadConfig ?? loadParsedUraniborgConfig;

  const paths = resolvePaths();
  const runtimeStatus = await inspectRuntime(
    dependencies.environment,
    dependencies.runner
  );
  let readinessReport = classifyFeynmanReadiness({
    runtimeStatus
  });

  if (runtimeStatus.ready) {
    const runtimeExecutablePath = runtimeStatus.executablePath;

    if (runtimeExecutablePath === undefined) {
      throw new Error("Ready Feynman runtime did not include an executable path.");
    }

    const [modelListExecution, alphaStatusExecution, searchStatusExecution] =
      await Promise.all([
        listModels(runtimeExecutablePath, dependencies.runner),
        getAlphaStatus(runtimeExecutablePath, dependencies.runner),
        getSearchStatus(runtimeExecutablePath, dependencies.runner)
      ]);

    readinessReport = classifyFeynmanReadiness({
      runtimeStatus,
      modelListExecution,
      alphaStatusExecution,
      searchStatusExecution
    });
  }

  const parsedConfigResult = await loadConfig(paths.configFile);

  return {
    runtimeStatus,
    readinessReport,
    parsedConfigResult
  };
}

export function renderModelsReport(report: ModelsReport): readonly string[] {
  const lines: string[] = ["Review Models"];

  const reviewModelsCheck = report.readinessReport.checks.find(
    (check) => check.code === "review_models"
  );

  if (!report.runtimeStatus.ready) {
    lines.push(`[fail] ${report.readinessReport.checks[0]?.summary ?? "Pinned runtime is not ready."}`);
  } else if (reviewModelsCheck?.ready) {
    lines.push(
      `[ok] ${report.readinessReport.reviewModels.length} review model${report.readinessReport.reviewModels.length === 1 ? "" : "s"} available through pinned Feynman.`
    );

    for (const model of report.readinessReport.reviewModels) {
      lines.push(`- ${model}`);
    }
  } else {
    lines.push(
      `[fail] ${reviewModelsCheck?.summary ?? "Review model discovery is not ready through the pinned Feynman runtime."}`
    );

    for (const detail of reviewModelsCheck?.details ?? []) {
      lines.push(`  ${detail}`);
    }
  }

  lines.push("", "Refinement");

  if (report.parsedConfigResult.ok) {
    lines.push(
      `[ok] Default refine model: ${report.parsedConfigResult.value.refine.defaults.model}`
    );
    lines.push(
      `Endpoint: ${report.parsedConfigResult.value.refine.endpoint.baseUrl}`
    );
    lines.push(
      `API key env var: ${report.parsedConfigResult.value.refine.endpoint.apiKeyEnvVar}`
    );
  } else {
    lines.push(`[fail] ${report.parsedConfigResult.error.message}`);

    for (const detail of report.parsedConfigResult.error.details ?? []) {
      lines.push(`  ${detail}`);
    }
  }

  const recommendedChecks = report.readinessReport.checks.filter(
    (check) => check.tier === "recommended"
  );

  if (recommendedChecks.length > 0) {
    lines.push("", "Recommended Capabilities");

    for (const check of recommendedChecks) {
      lines.push(check.ready ? `[ok] ${check.summary}` : `[warn] ${check.summary}`);
    }
  }

  return lines;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
