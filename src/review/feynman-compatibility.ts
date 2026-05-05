import type {
  FeynmanCommandExecution,
  FeynmanRuntimeStatus
} from "./feynman-bootstrap.js";
import {
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  listFeynmanModels
} from "./feynman-models.js";
import { FEYNMAN_NPM_INSTALL_COMMAND } from "./feynman-remediation.js";
import type { FeynmanCommandRunner } from "./feynman-bootstrap.js";

export const TESTED_FEYNMAN_VERSION_RANGE = ">=0.2.0 <2.0.0";

export type FeynmanCompatibilityStatus =
  | "ready"
  | "warning"
  | "action-required";

export type FeynmanCompatibilityProbeCode =
  | "review_model_discovery"
  | "alphaxiv_status"
  | "web_search_status";

export interface FeynmanCompatibilityProbeResult {
  code: FeynmanCompatibilityProbeCode;
  execution?: FeynmanCommandExecution | undefined;
  valid: boolean;
  details: readonly string[];
}

export interface FeynmanCompatibilityReport {
  status: FeynmanCompatibilityStatus;
  summary: string;
  warnings: readonly string[];
  details: readonly string[];
  probes: readonly FeynmanCompatibilityProbeResult[];
}

export interface FeynmanCompatibilityProbeOptions {
  listModels?: typeof listFeynmanModels;
  getAlphaStatus?: typeof getFeynmanAlphaStatus;
  getSearchStatus?: typeof getFeynmanSearchStatus;
  runner?: FeynmanCommandRunner | undefined;
}

export interface FeynmanCompatibilityProbeExecutions {
  modelListExecution?: FeynmanCommandExecution | undefined;
  alphaStatusExecution?: FeynmanCommandExecution | undefined;
  searchStatusExecution?: FeynmanCommandExecution | undefined;
}

export interface FeynmanCompatibilityProbeSnapshot
  extends FeynmanCompatibilityProbeExecutions {
  compatibilityReport: FeynmanCompatibilityReport;
}

export async function collectFeynmanCompatibilitySnapshot(
  runtimeStatus: FeynmanRuntimeStatus,
  options: FeynmanCompatibilityProbeOptions = {}
): Promise<FeynmanCompatibilityProbeSnapshot> {
  if (!runtimeStatus.ready || runtimeStatus.executablePath === undefined) {
    return {
      compatibilityReport: createRuntimeUnavailableCompatibilityReport(
        runtimeStatus
      )
    };
  }

  const executablePath = runtimeStatus.executablePath;
  const listModels = options.listModels ?? listFeynmanModels;
  const getAlphaStatus = options.getAlphaStatus ?? getFeynmanAlphaStatus;
  const getSearchStatus = options.getSearchStatus ?? getFeynmanSearchStatus;
  const modelListProbe = await runProbe("review_model_discovery", () =>
    listModels(executablePath, options.runner)
  );
  const alphaStatusProbe = await runProbe("alphaxiv_status", () =>
    getAlphaStatus(executablePath, options.runner)
  );
  const searchStatusProbe = await runProbe("web_search_status", () =>
    getSearchStatus(executablePath, options.runner)
  );
  const probes = [modelListProbe, alphaStatusProbe, searchStatusProbe];
  const invalidProbes = probes.filter((probe) => !probe.valid);

  if (invalidProbes.length > 0) {
    return {
      modelListExecution: modelListProbe.execution,
      alphaStatusExecution: alphaStatusProbe.execution,
      searchStatusExecution: searchStatusProbe.execution,
      compatibilityReport: {
        status: "action-required",
        summary:
          "Discovered Feynman runtime failed required command-contract compatibility probes.",
        warnings: [],
        details: invalidProbes.flatMap((probe) => [
          `${formatProbeCode(probe.code)} probe failed.`,
          ...probe.details.map((detail) => `  ${detail}`)
        ]),
        probes
      }
    };
  }

  const outOfRangeWarning = createOutOfRangeVersionWarning(
    runtimeStatus.detectedVersion
  );

  if (outOfRangeWarning !== null) {
    return {
      modelListExecution: modelListProbe.execution,
      alphaStatusExecution: alphaStatusProbe.execution,
      searchStatusExecution: searchStatusProbe.execution,
      compatibilityReport: {
        status: "warning",
        summary:
          "Feynman compatibility probes passed, but the detected version is outside Uraniborg's tested range.",
        warnings: [outOfRangeWarning],
        details: [
          `Detected version: ${runtimeStatus.detectedVersion ?? "unknown"}`,
          `Tested range: ${TESTED_FEYNMAN_VERSION_RANGE}`
        ],
        probes
      }
    };
  }

  return {
    modelListExecution: modelListProbe.execution,
    alphaStatusExecution: alphaStatusProbe.execution,
    searchStatusExecution: searchStatusProbe.execution,
    compatibilityReport: {
      status: "ready",
      summary: "Feynman compatibility probes passed.",
      warnings: [],
      details: [
        `Detected version: ${runtimeStatus.detectedVersion ?? "unknown"}`
      ],
      probes
    }
  };
}

export function applyCompatibilityToRuntimeStatus(
  runtimeStatus: FeynmanRuntimeStatus,
  compatibilityReport: FeynmanCompatibilityReport
): FeynmanRuntimeStatus {
  if (!runtimeStatus.ready) {
    return {
      ...runtimeStatus,
      compatibility: compatibilityReport
    };
  }

  if (compatibilityReport.status === "action-required") {
    return {
      ...runtimeStatus,
      ready: false,
      code: "runtime_incompatible",
      warnings: [],
      compatibility: compatibilityReport,
      candidates: runtimeStatus.candidates.map((candidate) =>
        candidate.executablePath === runtimeStatus.executablePath
          ? {
              ...candidate,
              compatible: false,
              failureCode: "compatibility_probe_failed",
              details: compatibilityReport.details
            }
          : candidate
      )
    };
  }

  return {
    ...runtimeStatus,
    warnings: [...runtimeStatus.warnings, ...compatibilityReport.warnings],
    compatibility: compatibilityReport
  };
}

function createRuntimeUnavailableCompatibilityReport(
  runtimeStatus: FeynmanRuntimeStatus
): FeynmanCompatibilityReport {
  if (runtimeStatus.code === "runtime_missing") {
    return {
      status: "action-required",
      summary: "No compatible Feynman runtime was found on PATH.",
      warnings: [],
      details: [
        `Install Feynman with \`${FEYNMAN_NPM_INSTALL_COMMAND}\`, then ensure a compatible \`feynman\` executable is available on PATH.`
      ],
      probes: []
    };
  }

  return {
    status: "action-required",
    summary: "Discovered Feynman runtimes are incompatible with Uraniborg.",
    warnings: [],
    details: runtimeStatus.candidates.flatMap((candidate) => [
      `Candidate: ${candidate.executablePath}`,
      ...candidate.details.map((detail) => `  ${detail}`)
    ]),
    probes: []
  };
}

async function runProbe(
  code: FeynmanCompatibilityProbeCode,
  execute: () => Promise<FeynmanCommandExecution>
): Promise<FeynmanCompatibilityProbeResult> {
  try {
    const execution = await execute();
    return {
      code,
      execution,
      valid: isParseableCommandContractExecution(execution),
      details: collectExecutionDetails(execution)
    };
  } catch (error) {
    return {
      code,
      valid: false,
      details: [
        error instanceof Error ? error.message : "Unknown Feynman probe failure."
      ]
    };
  }
}

function isParseableCommandContractExecution(
  execution: FeynmanCommandExecution
): boolean {
  if (execution.exitCode === 0) {
    return true;
  }

  return `${execution.stdout}\n${execution.stderr}`.trim().length > 0;
}

function createOutOfRangeVersionWarning(
  version: string | undefined
): string | null {
  if (typeof version !== "string") {
    return null;
  }

  if (isVersionInTestedRange(version)) {
    return null;
  }

  return `Feynman version ${version} is outside Uraniborg's tested range ${TESTED_FEYNMAN_VERSION_RANGE}; command-contract probes passed, so execution will continue with caution.`;
}

function isVersionInTestedRange(version: string): boolean {
  const parsed = parseVersionTuple(version);

  if (parsed === null) {
    return false;
  }

  if (parsed.major === 1) {
    return true;
  }

  if (parsed.major !== 0) {
    return false;
  }

  return parsed.minor >= 2;
}

function parseVersionTuple(
  version: string
): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+][A-Za-z0-9.-]+)?$/u);

  if (match === null) {
    return null;
  }

  const major = Number.parseInt(match[1] ?? "", 10);
  const minor = Number.parseInt(match[2] ?? "", 10);
  const patch = Number.parseInt(match[3] ?? "", 10);

  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch)
  ) {
    return null;
  }

  return {
    major,
    minor,
    patch
  };
}

function collectExecutionDetails(
  execution: FeynmanCommandExecution
): readonly string[] {
  const stdout = execution.stdout.trim();
  const stderr = execution.stderr.trim();

  return [
    `Exit code: ${execution.exitCode}`,
    ...(stdout.length > 0 ? [`stdout: ${collapseWhitespace(stdout)}`] : []),
    ...(stderr.length > 0 ? [`stderr: ${collapseWhitespace(stderr)}`] : [])
  ];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatProbeCode(code: FeynmanCompatibilityProbeCode): string {
  switch (code) {
    case "review_model_discovery":
      return "Review model discovery";
    case "alphaxiv_status":
      return "AlphaXiv status";
    case "web_search_status":
      return "Web search status";
  }
}
