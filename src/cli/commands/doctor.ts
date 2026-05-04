import type { Command } from "commander";

import {
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  loadUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import { getRevisionProfileLabel } from "../../config/revision-profiles.js";
import {
  collectFeynmanRuntimeSnapshot,
  createSearchConfigurationRemediationAction,
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
import type { Result } from "../../types/result.js";
import type {
  ResolvedUraniborgConfig,
  UraniborgConfig,
  UraniborgConfigLoadError
} from "../../types/app-config.js";
import type { UraniborgAppHomeStatus } from "../../config/index.js";
import { writeInfo } from "../../ui/output.js";
import {
  promptAndRunRemediations,
  type SharedRemediationDependencies
} from "./shared.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Validate Uraniborg environment readiness.")
    .action(async () => {
      await runDoctorCommand();
    });
}

export interface DoctorCommandDependencies extends SharedRemediationDependencies {
  resolvePaths?: typeof resolveUraniborgPaths;
  ensureAppHome?: typeof ensureUraniborgAppHome;
  inspectRuntime?: typeof inspectFeynmanRuntime;
  listModels?: typeof listFeynmanModels;
  getAlphaStatus?: typeof getFeynmanAlphaStatus;
  getSearchStatus?: typeof getFeynmanSearchStatus;
  loadConfig?: typeof loadUraniborgConfig;
  authClient?: ReturnType<typeof createRevisionAuthClient>;
  writeLine?: (message: string) => void;
  environment?: NodeJS.ProcessEnv;
  runner?: FeynmanCommandRunner;
}

export interface DoctorReport {
  appHomeStatus: UraniborgAppHomeStatus;
  runtimeStatus: FeynmanRuntimeStatus;
  readinessReport: FeynmanReadinessReport;
  revisionConfigResult: Result<ResolvedUraniborgConfig, UraniborgConfigLoadError>;
}

export async function runDoctorCommand(
  dependencies: DoctorCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const report = await collectDoctorReport(dependencies);

  for (const line of renderDoctorReport(report)) {
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

  const webSearchCheck = report.readinessReport.checks.find(
    (check) => check.code === "web_search"
  );

  if (report.runtimeStatus.ready && webSearchCheck?.ready) {
    await promptAndRunRemediations({
      executablePath: report.runtimeStatus.executablePath,
      actions: [
        createSearchConfigurationRemediationAction(
          "Manage web-search providers for fresher web research coverage.",
          {
            promptInitialValue: false
          }
        )
      ],
      dependencies: {
        interactive: dependencies.interactive ?? isInteractiveTerminal(),
        launcher: dependencies.launcher,
        prompts: dependencies.prompts,
        writeLine
      }
    });
  }
}

export async function collectDoctorReport(
  dependencies: DoctorCommandDependencies = {}
): Promise<DoctorReport> {
  const resolvePaths = dependencies.resolvePaths ?? resolveUraniborgPaths;
  const ensureAppHome = dependencies.ensureAppHome ?? ensureUraniborgAppHome;
  const inspectRuntime = dependencies.inspectRuntime ?? inspectFeynmanRuntime;
  const listModels = dependencies.listModels ?? listFeynmanModels;
  const getAlphaStatus =
    dependencies.getAlphaStatus ?? getFeynmanAlphaStatus;
  const getSearchStatus =
    dependencies.getSearchStatus ?? getFeynmanSearchStatus;
  const loadConfig = dependencies.loadConfig ?? loadUraniborgConfig;
  const runner = createSerializedFeynmanCommandRunner(
    dependencies.runner ?? createNodeFeynmanCommandRunner()
  );
  const authClient = dependencies.authClient ?? createRevisionAuthClient();

  const paths = resolvePaths();
  const appHomeStatus = await ensureAppHome(paths);
  const snapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime,
    listModels,
    getAlphaStatus,
    getSearchStatus,
    runner,
    includeReviewModels: true,
    includeCapabilities: true
  });

  const revisionConfigResult = await loadConfig(
    paths.configFile,
    dependencies.environment,
    undefined,
    authClient
  );

  return {
    appHomeStatus,
    runtimeStatus: snapshot.runtimeStatus,
    readinessReport: snapshot.readinessReport,
    revisionConfigResult
  };
}

export function renderDoctorReport(report: DoctorReport): readonly string[] {
  const lines: string[] = [
    "Filesystem",
    formatStatusLine(
      report.appHomeStatus.isLayoutValid,
      `App home layout is ready at ${report.appHomeStatus.paths.appHomeDirectory}.`,
      `App home layout is not valid at ${report.appHomeStatus.paths.appHomeDirectory}.`
    ),
    `  runs: ${report.appHomeStatus.runs.kind} (${report.appHomeStatus.runs.path})`,
    "",
    "Review Runtime"
  ];

  for (const check of report.readinessReport.checks) {
    const prefix = check.ready ? "[ok]" : check.tier === "recommended" ? "[warn]" : "[fail]";

    lines.push(
      `${prefix} ${check.summary} [${check.tier}]`
    );

    for (const detail of selectVisibleDoctorDetails(check.code, check.details)) {
      lines.push(`  ${detail}`);
    }
  }

  lines.push("", "Revision Runtime");

  if (report.revisionConfigResult.ok) {
    lines.push(
      formatStatusLine(
        true,
        `Revision runtime is ready. Profile: ${getRevisionProfileLabel(report.revisionConfigResult.value.revision.profile.id)}. Model: ${report.revisionConfigResult.value.revision.defaults.model}.`,
        ""
      )
    );
  } else {
    lines.push(
      formatStatusLine(false, "", report.revisionConfigResult.error.message)
    );

    for (const detail of report.revisionConfigResult.error.details ?? []) {
      lines.push(`  ${detail}`);
    }
  }

  lines.push("", "Summary");

  const blockingIssues =
    !report.appHomeStatus.isLayoutValid ||
    !report.readinessReport.requiredReady ||
    !report.revisionConfigResult.ok;

  if (blockingIssues) {
    lines.push("[fail] Uraniborg has blocking environment issues.");
  } else if (!report.readinessReport.recommendedReady) {
    lines.push("[warn] Uraniborg can run, but recommended research capabilities are missing.");
  } else {
    lines.push("[ok] Uraniborg environment is ready.");
  }

  return lines;
}

function selectVisibleDoctorDetails(
  code: string,
  details: readonly string[]
): readonly string[] {
  if (code === "runtime") {
    return details.filter(
      (detail) =>
        detail.startsWith("Version:") ||
        detail.startsWith("Multiple compatible") ||
        detail.startsWith("Feynman version") ||
        detail.startsWith("Install Feynman") ||
        detail.startsWith("Candidate:") ||
        detail.includes("probe failed")
    );
  }

  if (code === "review_models") {
    return details.filter((detail) => detail.startsWith("Models:"));
  }

  return [];
}

function formatStatusLine(
  ready: boolean,
  successMessage: string,
  failureMessage: string
): string {
  return ready ? `[ok] ${successMessage}` : `[fail] ${failureMessage}`;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}
