import {
  cancel,
  confirm,
  isCancel,
  select,
  text
} from "@clack/prompts";
import { readFile } from "node:fs/promises";
import type { Command } from "commander";

import {
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  isMarkdownFilePath,
  loadUraniborgConfig,
  resolvePathFromCwd,
  resolveUraniborgPaths,
  type RevisionAuthClient
} from "../../config/index.js";
import { executeRunLifecycle, type RunExecutionDependencies } from "../../loop/index.js";
import {
  collectFeynmanRuntimeSnapshot,
  classifyFeynmanReadiness,
  createNodeFeynmanCommandRunner,
  createSerializedFeynmanCommandRunner,
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  inspectFeynmanRuntime,
  listFeynmanModels,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanReadinessReport,
  type FeynmanRuntimeStatus
} from "../../review/index.js";
import type { ResolvedUraniborgConfig } from "../../types/app-config.js";
import { writeInfo } from "../../ui/output.js";
import type { RunLifecycleEventSink } from "../../ui/interactive.js";
import {
  executeWithProcessCancellation,
  promptAndRunRemediations,
  type RemediationPrompts,
  type SharedRemediationDependencies
} from "./shared.js";

const MIN_ITERATION_COUNT = 1;
const MAX_ITERATION_COUNT = 10;

export interface RunCommandOptions {
  iterations?: string | undefined;
  reviewModel?: string | undefined;
  refineModel?: string | undefined;
  nonInteractive?: boolean | undefined;
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .argument("<file>", "Markdown draft file to improve.")
    .option(
      "--iterations <count>",
      `Number of review/refine iterations (${MIN_ITERATION_COUNT}-${MAX_ITERATION_COUNT}).`
    )
    .option("--review-model <model>", "Review model exposed by external Feynman.")
    .option(
      "--refine-model <model>",
      "Revision model name for the active revision profile."
    )
    .option(
      "--non-interactive",
      "Use defaults and provided options instead of interactive prompts."
    )
    .description("Create and execute a new Uraniborg run.")
    .action(async (file: string, options: RunCommandOptions) => {
      await runRunCommand(file, options);
    });
}

export interface RunCommandDependencies
  extends SharedRemediationDependencies,
    RunExecutionDependencies {
  environment?: NodeJS.ProcessEnv;
  cwd?: string;
  prompts?: RunPrompts;
  readFile?: (filePath: string) => Promise<string>;
  resolvePaths?: typeof resolveUraniborgPaths;
  ensureAppHome?: typeof ensureUraniborgAppHome;
  loadConfig?: typeof loadUraniborgConfig;
  authClient?: RevisionAuthClient;
  inspectRuntime?: typeof inspectFeynmanRuntime;
  listModels?: typeof listFeynmanModels;
  getAlphaStatus?: typeof getFeynmanAlphaStatus;
  getSearchStatus?: typeof getFeynmanSearchStatus;
  runner?: FeynmanCommandRunner;
  writeLine?: (message: string) => void;
  eventSink?: RunLifecycleEventSink | undefined;
}

export interface RunPrompts extends RemediationPrompts {
  confirm: typeof confirm;
  select: typeof select;
  text: typeof text;
}

interface PreparedRunInput {
  sourcePath: string;
  sourceContents: string;
  iterationCount: number;
}

interface PreparedRunEnvironment {
  config: ResolvedUraniborgConfig;
  runtimeStatus: FeynmanRuntimeStatus;
  readinessReport: FeynmanReadinessReport;
  reviewModels: readonly string[];
  selectedModels: {
    review: string;
    refine: string;
  };
  paths: ReturnType<typeof resolveUraniborgPaths>;
}

export async function runRunCommand(
  file: string,
  options: RunCommandOptions,
  dependencies: RunCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const interactive =
    dependencies.interactive ?? !(options.nonInteractive ?? false);
  const prompts = dependencies.prompts ?? {
    cancel,
    confirm,
    isCancel,
    select,
    text
  };
  const runner = createSerializedFeynmanCommandRunner(
    dependencies.runner ?? createNodeFeynmanCommandRunner()
  );

  const preparedInput = await prepareRunInput(
    file,
    options,
    {
      cwd: dependencies.cwd ?? process.cwd(),
      interactive,
      prompts,
      readFile: dependencies.readFile ?? (async (filePath) => readFile(filePath, "utf8"))
    }
  );

  const preparedEnvironment = await prepareRunEnvironment(options, {
    environment: dependencies.environment,
    interactive,
    prompts,
    resolvePaths: dependencies.resolvePaths ?? resolveUraniborgPaths,
    ensureAppHome: dependencies.ensureAppHome ?? ensureUraniborgAppHome,
    loadConfig: dependencies.loadConfig ?? loadUraniborgConfig,
    authClient: dependencies.authClient ?? createRevisionAuthClient(),
    inspectRuntime: dependencies.inspectRuntime ?? inspectFeynmanRuntime,
    listModels: dependencies.listModels ?? listFeynmanModels,
    getAlphaStatus: dependencies.getAlphaStatus ?? getFeynmanAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus ?? getFeynmanSearchStatus,
    runner,
    launcher: dependencies.launcher,
    writeLine
  });

  await executeWithProcessCancellation(async (signal) => {
    await executeRunLifecycle(
      {
        sourcePath: preparedInput.sourcePath,
        sourceContents: preparedInput.sourceContents,
        iterationCount: preparedInput.iterationCount,
        selectedModels: preparedEnvironment.selectedModels,
        config: preparedEnvironment.config,
        runsDirectory: preparedEnvironment.paths.runsDirectory,
        reviewExecutablePath: requireRuntimeExecutablePath(
          preparedEnvironment.runtimeStatus
        )
      },
      {
        clock: dependencies.clock,
        filesystem: dependencies.filesystem,
        authClient: dependencies.authClient,
        runner,
        signal,
        writeLine,
        eventSink: dependencies.eventSink
      }
    );
  });
}

async function prepareRunInput(
  file: string,
  options: RunCommandOptions,
  dependencies: {
    cwd: string;
    interactive: boolean;
    prompts: RunPrompts;
    readFile: (filePath: string) => Promise<string>;
  }
): Promise<PreparedRunInput> {
  const sourcePath = resolvePathFromCwd(file, dependencies.cwd);

  if (!isMarkdownFilePath(sourcePath)) {
    throw new Error(
      `Run input must be a Markdown file. Received "${sourcePath}".`
    );
  }

  let sourceContents: string;

  try {
    sourceContents = await dependencies.readFile(sourcePath);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Run input could not be read from "${sourcePath}": ${error.message}`
        : `Run input could not be read from "${sourcePath}".`
    );
  }

  const iterationCount = await resolveIterationCount(
    options.iterations,
    dependencies
  );

  return {
    sourcePath,
    sourceContents,
    iterationCount
  };
}

async function resolveIterationCount(
  requestedIterations: string | undefined,
  dependencies: {
    interactive: boolean;
    prompts: RunPrompts;
  }
): Promise<number> {
  if (typeof requestedIterations === "string") {
    return parseIterationCount(requestedIterations);
  }

  if (!dependencies.interactive) {
    return 1;
  }

  const response = await dependencies.prompts.text({
    message: "How many iterations?",
    defaultValue: "1",
    validate(value) {
      try {
        parseIterationCount(value);
        return undefined;
      } catch (error) {
        return error instanceof Error ? error.message : "Enter a valid iteration count.";
      }
    }
  });

  if (dependencies.prompts.isCancel(response)) {
    dependencies.prompts.cancel("Uraniborg run cancelled.");
    throw new Error("Uraniborg run cancelled.");
  }

  return parseIterationCount(response);
}

export async function prepareRunEnvironment(
  options: RunCommandOptions,
  dependencies: {
    environment?: NodeJS.ProcessEnv | undefined;
    interactive: boolean;
    prompts: RunPrompts;
    resolvePaths: typeof resolveUraniborgPaths;
    ensureAppHome: typeof ensureUraniborgAppHome;
    loadConfig: typeof loadUraniborgConfig;
    authClient?: RevisionAuthClient | undefined;
    inspectRuntime: typeof inspectFeynmanRuntime;
    listModels: typeof listFeynmanModels;
    getAlphaStatus: typeof getFeynmanAlphaStatus;
    getSearchStatus: typeof getFeynmanSearchStatus;
    runner: FeynmanCommandRunner;
    launcher: RunCommandDependencies["launcher"];
    writeLine: (message: string) => void;
  }
): Promise<PreparedRunEnvironment> {
  const authClient = dependencies.authClient ?? createRevisionAuthClient();
  const paths = dependencies.resolvePaths();

  await dependencies.ensureAppHome(paths);

  dependencies.writeLine("Uraniborg checks the discovered review runtime...");

  let runtimeSnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner
  });
  let runtimeStatus = runtimeSnapshot.runtimeStatus;
  const runtimeReadiness = runtimeSnapshot.readinessReport;

  await promptAndRunRemediations({
    executablePath: runtimeStatus.executablePath,
    actions:
      runtimeStatus.ready === false
        ? runtimeReadiness.checks.flatMap((check) =>
            check.remediation === undefined ? [] : [check.remediation]
          )
        : [],
    dependencies: {
      interactive: dependencies.interactive,
      launcher: dependencies.launcher,
      prompts: dependencies.prompts,
      writeLine: dependencies.writeLine
    }
  });

  runtimeSnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner
  });
  runtimeStatus = runtimeSnapshot.runtimeStatus;

  if (!runtimeStatus.ready) {
    throw new Error(
      runtimeSnapshot.readinessReport.checks[0]?.summary ??
        "Compatible Feynman runtime is not ready."
    );
  }

  dependencies.writeLine(
    `Using Feynman runtime: ${requireRuntimeExecutablePath(runtimeStatus)}${typeof runtimeStatus.detectedVersion === "string" ? ` (version ${runtimeStatus.detectedVersion})` : ""}.`
  );
  for (const warning of runtimeStatus.warnings) {
    dependencies.writeLine(`[warn] ${warning}`);
  }

  dependencies.writeLine("Uraniborg checks revision setup...");

  const configResult = await dependencies.loadConfig(
    paths.configFile,
    dependencies.environment,
    undefined,
    authClient
  );

  if (!configResult.ok) {
    throw new Error(
      `${configResult.error.message} Run \`uraniborg revision --setup\` or \`uraniborg init\` to configure revision defaults.`
    );
  }

  let discoverySnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner,
    includeReviewModels: true
  });
  let modelListExecution = discoverySnapshot.modelListExecution;
  let discoveryReadiness = discoverySnapshot.readinessReport;

  await promptAndRunRemediations({
    executablePath: runtimeStatus.executablePath,
    actions: discoveryReadiness.checks.flatMap((check) =>
      check.remediation === undefined ? [] : [check.remediation]
    ),
    dependencies: {
      interactive: dependencies.interactive,
      launcher: dependencies.launcher,
      prompts: dependencies.prompts,
      writeLine: dependencies.writeLine
    }
  });

  discoverySnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner,
    includeReviewModels: true
  });
  modelListExecution = discoverySnapshot.modelListExecution;
  discoveryReadiness = discoverySnapshot.readinessReport;

  if (!discoveryReadiness.requiredReady || discoveryReadiness.reviewModels.length === 0) {
    throw new Error(
      discoveryReadiness.checks.find((check) => check.code === "review_models")
        ?.summary ?? "Review model discovery is not ready."
    );
  }

  const reviewModel = await selectReviewModel(
    discoveryReadiness.reviewModels,
    options.reviewModel,
    {
      interactive: dependencies.interactive,
      prompts: dependencies.prompts
    }
  );
  const refineModel = await selectRefineModel(
    configResult.value,
    authClient,
    options.refineModel,
    {
      interactive: dependencies.interactive,
      prompts: dependencies.prompts
    }
  );

  let readinessSnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner,
    includeReviewModels: true,
    includeCapabilities: true,
    selectedReviewModel: reviewModel
  });
  let readinessReport = readinessSnapshot.readinessReport;

  await promptAndRunRemediations({
    executablePath: runtimeStatus.executablePath,
    actions: readinessReport.checks.flatMap((check) =>
      check.remediation === undefined ? [] : [check.remediation]
    ),
    dependencies: {
      interactive: dependencies.interactive,
      launcher: dependencies.launcher,
      prompts: dependencies.prompts,
      writeLine: dependencies.writeLine
    }
  });

  readinessSnapshot = await collectFeynmanRuntimeSnapshot({
    environment: dependencies.environment,
    inspectRuntime: dependencies.inspectRuntime,
    listModels: dependencies.listModels,
    getAlphaStatus: dependencies.getAlphaStatus,
    getSearchStatus: dependencies.getSearchStatus,
    runner: dependencies.runner,
    includeReviewModels: true,
    includeCapabilities: true,
    selectedReviewModel: reviewModel
  });
  readinessReport = readinessSnapshot.readinessReport;

  if (!readinessReport.requiredReady) {
    const requiredFailure = readinessReport.checks.find(
      (check) => check.tier === "required" && !check.ready
    );
    throw new Error(requiredFailure?.summary ?? "Run preflight failed.");
  }

  const recommendedFailures = readinessReport.checks.filter(
    (check) => check.tier === "recommended" && !check.ready
  );

  if (recommendedFailures.length > 0) {
    for (const check of recommendedFailures) {
      dependencies.writeLine(`[warn] ${check.summary}`);
    }

    if (dependencies.interactive) {
      const response = await dependencies.prompts.confirm({
        message:
          "Recommended Feynman research capabilities are missing. Continue anyway?",
        initialValue: true
      });

      if (dependencies.prompts.isCancel(response) || response !== true) {
        dependencies.prompts.cancel("Uraniborg run cancelled.");
        throw new Error("Uraniborg run cancelled.");
      }
    }
  }

  return {
    config: configResult.value,
    runtimeStatus,
    readinessReport,
    reviewModels: discoveryReadiness.reviewModels,
    selectedModels: {
      review: reviewModel,
      refine: refineModel
    },
    paths
  };
}

function requireRuntimeExecutablePath(
  runtimeStatus: FeynmanRuntimeStatus
): string {
  const runtimeExecutablePath = runtimeStatus.executablePath;

  if (runtimeStatus.ready && typeof runtimeExecutablePath === "string") {
    return runtimeExecutablePath;
  }

  throw new Error("Ready Feynman runtime did not include an executable path.");
}

async function selectReviewModel(
  reviewModels: readonly string[],
  requestedReviewModel: string | undefined,
  dependencies: {
    interactive: boolean;
    prompts: RunPrompts;
  }
): Promise<string> {
  const sortedModels = [...reviewModels].sort((left, right) =>
    left.localeCompare(right)
  );

  if (typeof requestedReviewModel === "string") {
    if (!sortedModels.includes(requestedReviewModel)) {
      throw new Error(
        `Selected review model "${requestedReviewModel}" is not available. Available models: ${sortedModels.join(", ")}`
      );
    }

    return requestedReviewModel;
  }

  if (!dependencies.interactive) {
    if (sortedModels.length === 1) {
      const onlyModel = sortedModels[0];

      if (typeof onlyModel === "string") {
        return onlyModel;
      }
    }

    throw new Error(
      "Non-interactive runs require --review-model when more than one review model is available."
    );
  }

  const response = await dependencies.prompts.select({
    message: "Which review model?",
    options: sortedModels.map((model) => ({
      value: model,
      label: model
    }))
  });

  if (dependencies.prompts.isCancel(response)) {
    dependencies.prompts.cancel("Uraniborg run cancelled.");
    throw new Error("Uraniborg run cancelled.");
  }

  return response;
}

async function selectRefineModel(
  config: ResolvedUraniborgConfig,
  authClient: RevisionAuthClient,
  requestedRefineModel: string | undefined,
  dependencies: {
    interactive: boolean;
    prompts: RunPrompts;
  }
): Promise<string> {
  const availableModels = [
    ...(authClient.listAvailableModelIds?.(
      config.revision.runtime.providerId
    ) ?? [])
  ].sort((left, right) => left.localeCompare(right));

  if (availableModels.length === 0) {
    throw new Error(
      `No revision models are currently available for "${config.revision.profile.label}".`
    );
  }

  if (typeof requestedRefineModel === "string" && requestedRefineModel.trim().length > 0) {
    const modelId = requestedRefineModel.trim();

    if (!availableModels.includes(modelId)) {
      throw new Error(
        `Selected revision model "${modelId}" is not available for "${config.revision.profile.label}". Available models: ${availableModels.join(", ")}`
      );
    }

    return modelId;
  }

  if (!dependencies.interactive) {
    if (availableModels.includes(config.refine.defaults.model)) {
      return config.refine.defaults.model;
    }

    throw new Error(
      `Non-interactive runs require --refine-model when the configured default model "${config.refine.defaults.model}" is not available for "${config.revision.profile.label}".`
    );
  }

  const response = await dependencies.prompts.select({
    message: `Which revision model for ${config.revision.profile.label}?`,
    options: availableModels.map((model) => ({
      value: model,
      label: model
    })),
    ...(availableModels.includes(config.refine.defaults.model)
      ? {
          initialValue: config.refine.defaults.model
        }
      : {})
  });

  if (dependencies.prompts.isCancel(response)) {
    dependencies.prompts.cancel("Uraniborg run cancelled.");
    throw new Error("Uraniborg run cancelled.");
  }

  return response;
}

function parseIterationCount(input: string): number {
  const parsed = Number.parseInt(input, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error("Iteration count must be an integer.");
  }

  if (parsed < MIN_ITERATION_COUNT || parsed > MAX_ITERATION_COUNT) {
    throw new Error(
      `Iteration count must be between ${MIN_ITERATION_COUNT} and ${MAX_ITERATION_COUNT}.`
    );
  }

  return parsed;
}
