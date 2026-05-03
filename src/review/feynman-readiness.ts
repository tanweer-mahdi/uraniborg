import type {
  FeynmanCommandExecution,
  FeynmanRuntimeCandidate,
  FeynmanRuntimeStatus
} from "./feynman-bootstrap.js";
import {
  createAlphaLoginRemediationAction,
  createModelLoginRemediationAction,
  createSearchConfigurationRemediationAction,
  createSetupRemediationAction,
  type FeynmanRemediationAction
} from "./feynman-remediation.js";

export type FeynmanReadinessTier = "required" | "recommended";

export type FeynmanReadinessCheckCode =
  | "runtime"
  | "review_models"
  | "selected_review_model"
  | "alphaxiv"
  | "web_search";

export interface ReviewModelCatalog {
  ready: boolean;
  models: readonly string[];
  details: readonly string[];
  remediation?: FeynmanRemediationAction | undefined;
}

export interface FeynmanReadinessCheck {
  code: FeynmanReadinessCheckCode;
  tier: FeynmanReadinessTier;
  ready: boolean;
  summary: string;
  details: readonly string[];
  remediation?: FeynmanRemediationAction | undefined;
}

export interface FeynmanReadinessReport {
  checks: readonly FeynmanReadinessCheck[];
  requiredReady: boolean;
  recommendedReady: boolean;
  reviewModels: readonly string[];
}

export interface ClassifyFeynmanReadinessInput {
  runtimeStatus: FeynmanRuntimeStatus;
  modelListExecution?: FeynmanCommandExecution | undefined;
  selectedReviewModel?: string | undefined;
  alphaStatusExecution?: FeynmanCommandExecution | undefined;
  searchStatusExecution?: FeynmanCommandExecution | undefined;
}

export function classifyFeynmanReadiness(
  input: ClassifyFeynmanReadinessInput
): FeynmanReadinessReport {
  const checks: FeynmanReadinessCheck[] = [
    createRuntimeReadinessCheck(input.runtimeStatus)
  ];
  let reviewModels: readonly string[] = [];

  if (input.modelListExecution !== undefined) {
    const modelCatalog = parseReviewModelCatalog(
      input.modelListExecution,
      input.selectedReviewModel
    );
    reviewModels = modelCatalog.models;
    checks.push(createReviewModelsReadinessCheck(modelCatalog));

    if (typeof input.selectedReviewModel === "string") {
      checks.push(
        createSelectedReviewModelReadinessCheck(
          input.selectedReviewModel,
          modelCatalog
        )
      );
    }
  }

  if (input.alphaStatusExecution !== undefined) {
    checks.push(
      createRecommendedCapabilityCheck(
        "alphaxiv",
        input.alphaStatusExecution
      )
    );
  }

  if (input.searchStatusExecution !== undefined) {
    checks.push(
      createRecommendedCapabilityCheck(
        "web_search",
        input.searchStatusExecution
      )
    );
  }

  return {
    checks,
    requiredReady: checks
      .filter((check) => check.tier === "required")
      .every((check) => check.ready),
    recommendedReady: checks
      .filter((check) => check.tier === "recommended")
      .every((check) => check.ready),
    reviewModels
  };
}

export function createRuntimeReadinessCheck(
  status: FeynmanRuntimeStatus
): FeynmanReadinessCheck {
  if (status.ready) {
    const compatibilityWarning =
      status.compatibility?.status === "warning"
        ? status.compatibility.summary
        : undefined;

    return {
      code: "runtime",
      tier: "required",
      ready: true,
      summary: `Compatible Feynman runtime is ready at ${status.executablePath}.`,
      details: [
        ...(typeof status.detectedVersion === "string"
          ? [`Version: ${status.detectedVersion}`]
          : []),
        ...(typeof compatibilityWarning === "string"
          ? [compatibilityWarning]
          : []),
        ...status.warnings
      ]
    };
  }

  if (status.code === "runtime_missing") {
    return {
      code: "runtime",
      tier: "required",
      ready: false,
      summary: "No compatible Feynman runtime was found on PATH.",
      details: [
        "Install Feynman and ensure a compatible `feynman` executable is available on PATH before running Uraniborg."
      ]
    };
  }

  return {
    code: "runtime",
    tier: "required",
    ready: false,
    summary: "Discovered Feynman runtimes are incompatible with Uraniborg.",
    details: describeIncompatibleCandidates(status.candidates)
  };
}

export function parseReviewModelCatalog(
  execution: FeynmanCommandExecution,
  selectedReviewModel?: string
): ReviewModelCatalog {
  const details = collectExecutionDetails(execution);
  const models = extractReviewModels(execution.stdout);

  if (execution.exitCode === 0 && models.length > 0) {
    return {
      ready: true,
      models,
      details
    };
  }

  const provider =
    inferProviderFromText(`${execution.stdout}\n${execution.stderr}`) ??
    inferProviderFromSelectedModel(selectedReviewModel);

  return {
    ready: false,
    models,
    details,
    remediation:
      typeof provider === "string"
        ? createModelLoginRemediationAction(
            provider,
            `Restore review-model access for provider "${provider}".`
          )
        : createSetupRemediationAction(
            "Complete Feynman setup so review models can be discovered."
          )
  };
}

export function createReviewModelsReadinessCheck(
  catalog: ReviewModelCatalog
): FeynmanReadinessCheck {
  if (catalog.ready) {
    return {
      code: "review_models",
      tier: "required",
      ready: true,
      summary: `Review model discovery is ready with ${catalog.models.length} available model${catalog.models.length === 1 ? "" : "s"}.`,
      details:
        catalog.models.length > 0
          ? [`Models: ${catalog.models.join(", ")}`]
          : catalog.details
    };
  }

  return {
    code: "review_models",
    tier: "required",
    ready: false,
    summary:
      "Review model discovery is not ready through the selected Feynman runtime.",
    details: catalog.details,
    remediation: catalog.remediation
  };
}

export function createSelectedReviewModelReadinessCheck(
  selectedReviewModel: string,
  catalog: ReviewModelCatalog
): FeynmanReadinessCheck {
  if (catalog.ready && catalog.models.includes(selectedReviewModel)) {
    return {
      code: "selected_review_model",
      tier: "required",
      ready: true,
      summary: `Selected review model "${selectedReviewModel}" is ready.`,
      details: []
    };
  }

  const provider = inferProviderFromSelectedModel(selectedReviewModel);

  return {
    code: "selected_review_model",
    tier: "required",
    ready: false,
    summary: `Selected review model "${selectedReviewModel}" is not available through the selected Feynman runtime.`,
    details:
      catalog.models.length > 0
        ? [`Available models: ${catalog.models.join(", ")}`]
        : catalog.details,
    remediation:
      typeof provider === "string"
        ? createModelLoginRemediationAction(
            provider,
            `Restore access to the selected review model "${selectedReviewModel}".`
          )
        : catalog.remediation
  };
}

export function createRecommendedCapabilityCheck(
  code: "alphaxiv" | "web_search",
  execution: FeynmanCommandExecution
): FeynmanReadinessCheck {
  const ready = interpretCapabilityStatus(code, execution);
  const details = collectExecutionDetails(execution);

  if (ready) {
    return {
      code,
      tier: "recommended",
      ready: true,
      summary:
        code === "alphaxiv" ? "AlphaXiv is ready." : "Web search is ready.",
      details
    };
  }

  return {
    code,
    tier: "recommended",
    ready: false,
    summary:
      code === "alphaxiv"
        ? "AlphaXiv is not configured. Latest-paper and paper-metadata access may be weaker."
        : "Web search is not configured. Latest web research coverage may be weaker.",
    details,
    remediation:
      code === "alphaxiv"
        ? createAlphaLoginRemediationAction(
            "Configure AlphaXiv access for stronger paper discovery."
          )
        : createSearchConfigurationRemediationAction(
            "Configure web-search providers for fresher web research coverage."
          )
  };
}

function describeIncompatibleCandidates(
  candidates: readonly FeynmanRuntimeCandidate[]
): readonly string[] {
  return candidates.flatMap((candidate) => [
    `Candidate: ${candidate.executablePath}`,
    ...candidate.details.map((detail) => `  ${detail}`)
  ]);
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

function extractReviewModels(stdout: string): readonly string[] {
  const trimmedOutput = stdout.trim();

  if (trimmedOutput.length === 0) {
    return [];
  }

  const fromJson = extractReviewModelsFromJson(trimmedOutput);
  if (fromJson.length > 0) {
    return fromJson;
  }

  const matches = new Set<string>();

  for (const line of trimmedOutput.split(/\r?\n/u)) {
    for (const match of line.matchAll(
      /\b([A-Za-z0-9._-]+\/[A-Za-z0-9._:+-]+)\b/g
    )) {
      const value = match[1];

      if (typeof value === "string") {
        matches.add(value);
      }
    }
  }

  return [...matches];
}

function extractReviewModelsFromJson(stdout: string): readonly string[] {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    return extractReviewModelsFromUnknown(parsed);
  } catch {
    return [];
  }
}

function extractReviewModelsFromUnknown(input: unknown): readonly string[] {
  if (Array.isArray(input)) {
    return dedupeStrings(
      input.flatMap((entry) => [...extractReviewModelsFromUnknown(entry)])
    );
  }

  if (typeof input === "string") {
    return isLikelyReviewModelId(input) ? [input.trim()] : [];
  }

  if (!isRecord(input)) {
    return [];
  }

  const directValues = [
    input["id"],
    input["name"],
    input["model"],
    input["slug"]
  ]
    .filter((value): value is string => typeof value === "string")
    .filter((value) => isLikelyReviewModelId(value));

  const nestedCollections = [
    input["models"],
    input["availableModels"],
    input["items"],
    input["data"]
  ];

  return dedupeStrings([
    ...directValues.map((value) => value.trim()),
    ...nestedCollections.flatMap((entry) => [
      ...extractReviewModelsFromUnknown(entry)
    ])
  ]);
}

function isLikelyReviewModelId(value: string): boolean {
  return /^[A-Za-z0-9._-]+\/[A-Za-z0-9._:+-]+$/u.test(value.trim());
}

function interpretCapabilityStatus(
  code: "alphaxiv" | "web_search",
  execution: FeynmanCommandExecution
): boolean {
  if (execution.exitCode !== 0) {
    return false;
  }

  const combinedOutput = `${execution.stdout}\n${execution.stderr}`.trim();

  if (combinedOutput.length === 0) {
    return false;
  }

  const jsonResult = interpretCapabilityStatusFromJson(code, combinedOutput);
  if (jsonResult !== null) {
    return jsonResult;
  }

  const normalized = combinedOutput.toLowerCase();

  const negativePattern =
    /\b(not configured|not authenticated|not logged in|missing|unavailable|disabled|no providers|no provider|not ready|setup required|login required|error|failed)\b/u;
  if (negativePattern.test(normalized)) {
    return false;
  }

  const positivePattern =
    /\b(ready|configured|authenticated|logged in|enabled|available|ok)\b/u;
  return positivePattern.test(normalized);
}

function interpretCapabilityStatusFromJson(
  code: "alphaxiv" | "web_search",
  output: string
): boolean | null {
  try {
    const parsed = JSON.parse(output) as unknown;

    if (!isRecord(parsed)) {
      return null;
    }

    const fieldNames =
      code === "alphaxiv"
        ? ["ready", "authenticated", "loggedIn", "enabled", "available"]
        : ["ready", "configured", "enabled", "available"];

    for (const fieldName of fieldNames) {
      const value = findBooleanLikeField(parsed, fieldName);

      if (typeof value === "boolean") {
        return value;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function findBooleanLikeField(
  input: Record<string, unknown>,
  fieldName: string
): boolean | null {
  if (typeof input[fieldName] === "boolean") {
    return input[fieldName];
  }

  for (const value of Object.values(input)) {
    if (isRecord(value)) {
      const nestedResult = findBooleanLikeField(value, fieldName);

      if (typeof nestedResult === "boolean") {
        return nestedResult;
      }
    }
  }

  return null;
}

function inferProviderFromSelectedModel(model?: string): string | null {
  if (typeof model !== "string") {
    return null;
  }

  const separatorIndex = model.indexOf("/");
  return separatorIndex > 0 ? model.slice(0, separatorIndex) : null;
}

function inferProviderFromText(output: string): string | null {
  const normalized = output.toLowerCase();
  const knownProviders = [
    "openai",
    "anthropic",
    "google",
    "xai",
    "mistral",
    "deepseek",
    "openrouter"
  ];

  for (const provider of knownProviders) {
    if (normalized.includes(provider)) {
      return provider;
    }
  }

  return null;
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
