import {
  appendInformationHighwayIteration,
  createInitialInformationHighway,
  type InformationHighwayError
} from "../memory/index.js";
import {
  executeRefinement,
  type ExecutedRefinement,
  type RefineError,
  type RefineHttpClient
} from "../refine/index.js";
import type { RevisionAuthClient } from "../config/revision-auth.js";
import {
  createFreshReviewWorkspace,
  executeReviewAndNormalize,
  writeIterationReviewInput,
  type FeynmanCommandRunner,
  type ReviewFilesystem
} from "../review/index.js";
import {
  createRunConfigSnapshot,
  createRunId,
  createRunManifest,
  createTimestampedRunDirectory,
  deriveRunTitleFromSourcePath,
  ensureIterationDirectory,
  readRunManifest,
  readArtifactFile,
  resolveRunArtifactPaths,
  slugifyRunLabel,
  transitionRunManifest,
  writeArtifactFile,
  writeRunConfigSnapshot,
  writeRunManifest,
  type IterationArtifactPaths,
  type RunManifest,
  type RunManifestSelectedModels,
  type RunStatus
} from "../run/index.js";
import { createOperationCancelledError, isOperationCancelledError } from "../types/cancellation.js";
import type { ResolvedUraniborgConfig } from "../types/app-config.js";

export interface RunExecutionClock {
  now: () => Date;
}

export interface ExecuteRunLifecycleInput {
  sourcePath: string;
  sourceContents: string;
  iterationCount: number;
  selectedModels: RunManifestSelectedModels;
  config: ResolvedUraniborgConfig;
  runsDirectory: string;
  reviewExecutablePath: string;
}

export interface ResumeRunLifecycleInput {
  runId: string;
  config: ResolvedUraniborgConfig;
  runsDirectory: string;
  reviewExecutablePath: string;
}

export interface RunExecutionDependencies {
  clock?: RunExecutionClock | undefined;
  filesystem?: ReviewFilesystem | undefined;
  httpClient?: RefineHttpClient | undefined;
  authClient?: RevisionAuthClient | undefined;
  runner?: FeynmanCommandRunner | undefined;
  signal?: AbortSignal | undefined;
  writeLine?: ((message: string) => void) | undefined;
}

export interface ExecuteRunLifecycleResult {
  manifest: RunManifest;
  finalDraftFile: string;
}

type IterationStartStatus =
  | "initialized"
  | "review_running"
  | "review_complete"
  | "refine_running"
  | "refine_complete"
  | "memory_update"
  | "iteration_complete";

export async function executeRunLifecycle(
  input: ExecuteRunLifecycleInput,
  dependencies: RunExecutionDependencies = {}
): Promise<ExecuteRunLifecycleResult> {
  const filesystem = dependencies.filesystem;
  const clock = dependencies.clock ?? {
    now: () => new Date()
  };
  const writeLine = dependencies.writeLine ?? (() => {});
  const createdAt = clock.now().toISOString();
  const title = deriveRunTitleFromSourcePath(input.sourcePath);
  const slug = slugifyRunLabel(title);
  const runId = createRunId(clock.now(), slug);
  const artifactPaths = await createTimestampedRunDirectory(
    input.runsDirectory,
    runId,
    filesystem
  );

  const manifest = createRunManifest({
    runId,
    slug,
    title,
    sourceInputPath: input.sourcePath,
    iterationsPlanned: input.iterationCount,
    selectedModels: input.selectedModels,
    artifactPaths,
    createdAt
  });
  const configSnapshot = createRunConfigSnapshot({
    config: input.config,
    sourcePath: input.sourcePath,
    title,
    slug,
    iterationCount: input.iterationCount,
    selectedModels: input.selectedModels
  });

  await writeRunManifest(artifactPaths.manifestFile, manifest, filesystem);
  await writeRunConfigSnapshot(
    artifactPaths.configSnapshotFile,
    configSnapshot,
    filesystem
  );
  await writeArtifactFile(
    artifactPaths.originalDraftFile,
    input.sourceContents,
    filesystem
  );
  await writeArtifactFile(
    artifactPaths.currentDraftFile,
    input.sourceContents,
    filesystem
  );
  await writeArtifactFile(
    artifactPaths.informationHighwayFile,
    createInitialInformationHighway(),
    filesystem
  );

  writeLine(`Starting run: ${runId}`);

  return continueRunLifecycle(
    {
      manifestPath: artifactPaths.manifestFile,
      runDirectory: artifactPaths.runDirectory,
      currentDraftFile: artifactPaths.currentDraftFile,
      informationHighwayFile: artifactPaths.informationHighwayFile,
      finalDraftFile: artifactPaths.finalDraftFile,
      totalIterations: input.iterationCount,
      startIteration: 1,
      startStatus: "initialized",
      reviewExecutablePath: input.reviewExecutablePath,
      selectedModels: input.selectedModels,
      config: input.config
    },
    dependencies
  );
}

export async function resumeRunLifecycle(
  input: ResumeRunLifecycleInput,
  dependencies: RunExecutionDependencies = {}
): Promise<ExecuteRunLifecycleResult> {
  const writeLine = dependencies.writeLine ?? (() => {});
  const artifactPaths = resolveRunArtifactPaths(input.runsDirectory, input.runId);
  const manifest = await readRunManifest(artifactPaths.manifestFile, dependencies.filesystem);
  const startStatus = resolveResumeStartStatus(manifest);

  if (manifest.status === "failed" || manifest.status === "cancelled") {
    await reopenInterruptedRun(
      artifactPaths.manifestFile,
      startStatus,
      dependencies.clock?.now().toISOString() ?? new Date().toISOString(),
      dependencies.filesystem
    );
  }

  writeLine(`Resuming run: ${input.runId}`);

  return continueRunLifecycle(
    {
      manifestPath: artifactPaths.manifestFile,
      runDirectory: artifactPaths.runDirectory,
      currentDraftFile: artifactPaths.currentDraftFile,
      informationHighwayFile: artifactPaths.informationHighwayFile,
      finalDraftFile: artifactPaths.finalDraftFile,
      totalIterations: manifest.iterationsPlanned,
      startIteration: manifest.phaseMetadata.currentIteration,
      startStatus,
      reviewExecutablePath: input.reviewExecutablePath,
      selectedModels: manifest.selectedModels,
      config: input.config
    },
    dependencies
  );
}

async function continueRunLifecycle(
  input: {
    manifestPath: string;
    runDirectory: string;
    currentDraftFile: string;
    informationHighwayFile: string;
    finalDraftFile: string;
    totalIterations: number;
    startIteration: number;
    startStatus: IterationStartStatus;
    reviewExecutablePath: string;
    selectedModels: RunManifestSelectedModels;
    config: ResolvedUraniborgConfig;
  },
  dependencies: RunExecutionDependencies
): Promise<ExecuteRunLifecycleResult> {
  const filesystem = dependencies.filesystem;
  const clock = dependencies.clock ?? {
    now: () => new Date()
  };
  const writeLine = dependencies.writeLine ?? (() => {});

  try {
    for (
      let iterationNumber = input.startIteration;
      iterationNumber <= input.totalIterations;
      iterationNumber += 1
    ) {
      await executeSingleIteration(
        {
          manifestPath: input.manifestPath,
          runDirectory: input.runDirectory,
          currentDraftFile: input.currentDraftFile,
          informationHighwayFile: input.informationHighwayFile,
          finalDraftFile: input.finalDraftFile,
          totalIterations: input.totalIterations,
          iterationNumber,
          startingStatus:
            iterationNumber === input.startIteration
              ? input.startStatus
              : "iteration_complete",
          reviewExecutablePath: input.reviewExecutablePath,
          selectedModels: input.selectedModels,
          config: input.config
        },
        {
          clock,
          filesystem,
          httpClient: dependencies.httpClient,
          authClient: dependencies.authClient,
          runner: dependencies.runner,
          signal: dependencies.signal,
          writeLine
        }
      );
    }
  } catch (error) {
    if (
      await persistRunCancellationIfNeeded(
        input.manifestPath,
        clock.now().toISOString(),
        error,
        filesystem
      )
    ) {
      const cancelledManifest = await readRunManifest(input.manifestPath, filesystem);
      throw createOperationCancelledError(
        `Uraniborg run cancelled. Resume with: uraniborg resume ${cancelledManifest.runId}`
      );
    }

    throw error;
  }

  const finalManifest = await readRunManifest(input.manifestPath, filesystem);

  writeLine("Run complete.");
  writeLine(`Final draft: ${input.finalDraftFile}`);

  return {
    manifest: finalManifest,
    finalDraftFile: input.finalDraftFile
  };
}

async function executeSingleIteration(
  input: {
    manifestPath: string;
    runDirectory: string;
    currentDraftFile: string;
    informationHighwayFile: string;
    finalDraftFile: string;
    totalIterations: number;
    iterationNumber: number;
    startingStatus: IterationStartStatus;
    reviewExecutablePath: string;
    selectedModels: RunManifestSelectedModels;
    config: ResolvedUraniborgConfig;
  },
  dependencies: {
    clock: RunExecutionClock;
    writeLine: (message: string) => void;
    filesystem?: ReviewFilesystem | undefined;
    httpClient?: RefineHttpClient | undefined;
    authClient?: RevisionAuthClient | undefined;
    runner?: FeynmanCommandRunner | undefined;
    signal?: AbortSignal | undefined;
  }
): Promise<void> {
  const iterationArtifacts = await ensureIterationDirectory(
    input.runDirectory,
    input.iterationNumber,
    dependencies.filesystem
  );

  if (shouldRunReviewPhase(input.startingStatus)) {
    await executeReviewPhase(input, iterationArtifacts, dependencies);
  }

  if (shouldRunRefinePhase(input.startingStatus)) {
    await executeRefinePhase(input, iterationArtifacts, dependencies);
  }

  if (shouldRunMemoryPhase(input.startingStatus)) {
    await executeMemoryPhase(input, iterationArtifacts, dependencies);
  }
}

async function executeReviewPhase(
  input: {
    manifestPath: string;
    runDirectory: string;
    currentDraftFile: string;
    totalIterations: number;
    iterationNumber: number;
    startingStatus: IterationStartStatus;
    reviewExecutablePath: string;
    selectedModels: RunManifestSelectedModels;
  },
  iterationArtifacts: IterationArtifactPaths,
  dependencies: {
    clock: RunExecutionClock;
    writeLine: (message: string) => void;
    filesystem?: ReviewFilesystem | undefined;
    runner?: FeynmanCommandRunner | undefined;
    signal?: AbortSignal | undefined;
  }
): Promise<void> {
  dependencies.writeLine(
    `Iteration ${input.iterationNumber}/${input.totalIterations}: review`
  );

  if (input.startingStatus === "initialized") {
    await requireTransition(
      input.manifestPath,
      ["initialized"],
      {
        nextStatus: "review_running",
        nextPhase: "review",
        currentIteration: input.iterationNumber,
        updatedAt: dependencies.clock.now().toISOString()
      },
      dependencies.filesystem
    );
  }

  if (input.startingStatus === "iteration_complete") {
    await requireTransition(
      input.manifestPath,
      ["iteration_complete"],
      {
        nextStatus: "review_running",
        nextPhase: "review",
        currentIteration: input.iterationNumber,
        updatedAt: dependencies.clock.now().toISOString()
      },
      dependencies.filesystem
    );
  }

  throwIfCancelled(dependencies.signal);

  try {
    const reviewWorkspace = await createFreshReviewWorkspace(
      iterationArtifacts.iterationDirectory,
      dependencies.filesystem
    );

    await writeIterationReviewInput(
      dependencies.filesystem === undefined
        ? {
            currentDraftFile: input.currentDraftFile,
            iterationInputFile: iterationArtifacts.inputFile,
            reviewWorkspace
          }
        : {
            currentDraftFile: input.currentDraftFile,
            iterationInputFile: iterationArtifacts.inputFile,
            reviewWorkspace,
            filesystem: dependencies.filesystem
          }
    );

    const reviewResult = await executeReviewAndNormalize(
      {
        executablePath: input.reviewExecutablePath,
        reviewModel: input.selectedModels.review,
        reviewWorkspace,
        reviewLogFile: iterationArtifacts.reviewLogFile,
        normalizedReviewFile: iterationArtifacts.reviewFile,
        manifestPath: input.manifestPath,
        iterationNumber: input.iterationNumber,
        failureTimestamp: dependencies.clock.now().toISOString(),
        signal: dependencies.signal
      },
      dependencies.runner,
      dependencies.filesystem
    );

    if (!reviewResult.ok) {
      throw new Error(reviewResult.error.message);
    }
  } catch (error) {
    if (isOperationCancelledError(error)) {
      await writeArtifactFile(
        iterationArtifacts.reviewLogFile,
        formatCancelledPhaseLog("review", error),
        dependencies.filesystem
      );
    }

    throw error;
  }

  await requireTransition(
    input.manifestPath,
    ["review_running"],
    {
      nextStatus: "review_complete",
      nextPhase: "review",
      currentIteration: input.iterationNumber,
      updatedAt: dependencies.clock.now().toISOString()
    },
    dependencies.filesystem
  );
}

async function executeRefinePhase(
  input: {
    manifestPath: string;
    currentDraftFile: string;
    informationHighwayFile: string;
    totalIterations: number;
    iterationNumber: number;
    startingStatus: IterationStartStatus;
    selectedModels: RunManifestSelectedModels;
    config: ResolvedUraniborgConfig;
  },
  iterationArtifacts: IterationArtifactPaths,
  dependencies: {
    clock: RunExecutionClock;
    writeLine: (message: string) => void;
    filesystem?: ReviewFilesystem | undefined;
    httpClient?: RefineHttpClient | undefined;
    authClient?: RevisionAuthClient | undefined;
    signal?: AbortSignal | undefined;
  }
): Promise<void> {
  dependencies.writeLine(
    `Iteration ${input.iterationNumber}/${input.totalIterations}: refine`
  );

  if (input.startingStatus !== "refine_running") {
    await requireTransition(
      input.manifestPath,
      ["review_complete"],
      {
        nextStatus: "refine_running",
        nextPhase: "refinement",
        currentIteration: input.iterationNumber,
        updatedAt: dependencies.clock.now().toISOString()
      },
      dependencies.filesystem
    );
  }

  throwIfCancelled(dependencies.signal);

  const [currentDraft, peerReview, informationHighway] = await Promise.all([
    readArtifactFile(input.currentDraftFile, dependencies.filesystem),
    readArtifactFile(iterationArtifacts.reviewFile, dependencies.filesystem),
    readArtifactFile(input.informationHighwayFile, dependencies.filesystem)
  ]);

  const refinementResult = await executeRefinement(
    {
      currentDraft,
      peerReview,
      informationHighway,
      config: input.config,
      model: input.selectedModels.refine,
      signal: dependencies.signal
    },
    {
      httpClient: dependencies.httpClient,
      authClient: dependencies.authClient
    }
  );

  if (!refinementResult.ok) {
    if (refinementResult.error.code === "refine_cancelled") {
      await writeArtifactFile(
        iterationArtifacts.refineLogFile,
        formatCancelledRefinementLog(refinementResult.error),
        dependencies.filesystem
      );
      throw createOperationCancelledError(refinementResult.error.message);
    }

    const surfacedRefinementError = await createSurfacedRefinementError(
      refinementResult.error,
      iterationArtifacts,
      dependencies.filesystem
    );

    await writeArtifactFile(
      iterationArtifacts.refineLogFile,
      formatRefinementFailureLog(surfacedRefinementError, iterationArtifacts),
      dependencies.filesystem
    );
    await persistRunFailure(
      input.manifestPath,
      ["refine_running"],
      input.iterationNumber,
      surfacedRefinementError,
      dependencies.clock.now().toISOString(),
      dependencies.filesystem
    );
    throw new Error(surfacedRefinementError.message);
  }

  await writeArtifactFile(
    iterationArtifacts.refineLogFile,
    formatRefinementLog(refinementResult.value),
    dependencies.filesystem
  );
  await writeArtifactFile(
    iterationArtifacts.refinedDraftFile,
    refinementResult.value.parsedOutput.refinedDraft,
    dependencies.filesystem
  );
  await writeArtifactFile(
    iterationArtifacts.changesFile,
    refinementResult.value.parsedOutput.changeSummary,
    dependencies.filesystem
  );

  await requireTransition(
    input.manifestPath,
    ["refine_running"],
    {
      nextStatus: "refine_complete",
      nextPhase: "refinement",
      currentIteration: input.iterationNumber,
      updatedAt: dependencies.clock.now().toISOString()
    },
    dependencies.filesystem
  );
}

async function executeMemoryPhase(
  input: {
    manifestPath: string;
    currentDraftFile: string;
    informationHighwayFile: string;
    finalDraftFile: string;
    totalIterations: number;
    iterationNumber: number;
    startingStatus: IterationStartStatus;
  },
  iterationArtifacts: IterationArtifactPaths,
  dependencies: {
    clock: RunExecutionClock;
    writeLine: (message: string) => void;
    filesystem?: ReviewFilesystem | undefined;
    signal?: AbortSignal | undefined;
  }
): Promise<void> {
  dependencies.writeLine(
    `Iteration ${input.iterationNumber}/${input.totalIterations}: memory update`
  );

  if (input.startingStatus !== "memory_update") {
    await requireTransition(
      input.manifestPath,
      ["refine_complete"],
      {
        nextStatus: "memory_update",
        nextPhase: "memory",
        currentIteration: input.iterationNumber,
        updatedAt: dependencies.clock.now().toISOString()
      },
      dependencies.filesystem
    );
  }

  const resumeArtifacts = await loadMemoryResumeArtifacts(
    input.startingStatus,
    input.manifestPath,
    iterationArtifacts,
    dependencies.filesystem
  );

  throwIfCancelled(dependencies.signal);

  const memoryUpdateResult = appendInformationHighwayIteration({
    existingContents: resumeArtifacts.informationHighway,
    iterationNumber: input.iterationNumber,
    changeSummary: resumeArtifacts.changeSummary
  });

  if (!memoryUpdateResult.ok) {
    await persistRunFailure(
      input.manifestPath,
      ["memory_update"],
      input.iterationNumber,
      memoryUpdateResult.error,
      dependencies.clock.now().toISOString(),
      dependencies.filesystem
    );
    throw new Error(memoryUpdateResult.error.message);
  }

  throwIfCancelled(dependencies.signal);

  await writeArtifactFile(
    input.informationHighwayFile,
    memoryUpdateResult.value,
    dependencies.filesystem
  );

  await writeArtifactFile(
    input.currentDraftFile,
    resumeArtifacts.refinedDraft,
    dependencies.filesystem
  );

  if (input.iterationNumber < input.totalIterations) {
    await requireTransition(
      input.manifestPath,
      ["memory_update"],
      {
        nextStatus: "iteration_complete",
        nextPhase: "iteration",
        currentIteration: input.iterationNumber + 1,
        iterationsCompleted: input.iterationNumber,
        updatedAt: dependencies.clock.now().toISOString()
      },
      dependencies.filesystem
    );
    dependencies.writeLine(
      `Iteration ${input.iterationNumber}/${input.totalIterations}: memory updated`
    );
    return;
  }

  await writeArtifactFile(
    input.finalDraftFile,
    resumeArtifacts.refinedDraft,
    dependencies.filesystem
  );
  await requireTransition(
    input.manifestPath,
    ["memory_update"],
    {
      nextStatus: "finished",
      nextPhase: "completed",
      currentIteration: input.iterationNumber,
      iterationsCompleted: input.iterationNumber,
      updatedAt: dependencies.clock.now().toISOString()
    },
    dependencies.filesystem
  );
  dependencies.writeLine(
    `Iteration ${input.iterationNumber}/${input.totalIterations}: memory updated`
  );
}

async function loadMemoryResumeArtifacts(
  startingStatus: IterationStartStatus,
  manifestPath: string,
  iterationArtifacts: IterationArtifactPaths,
  filesystem?: ReviewFilesystem
): Promise<{
  refinedDraft: string;
  changeSummary: string;
  informationHighway: string;
}> {
  if (startingStatus === "memory_update") {
    const repairedArtifacts = await tryReadMemoryArtifacts(
      iterationArtifacts,
      manifestPath,
      filesystem
    );

    if (repairedArtifacts !== null) {
      return repairedArtifacts;
    }

    throw new Error(
      'Run is in "memory_update" but required refinement artifacts are missing, so memory repair cannot proceed.'
    );
  }

  return readMemoryArtifacts(iterationArtifacts, manifestPath, filesystem);
}

async function tryReadMemoryArtifacts(
  iterationArtifacts: IterationArtifactPaths,
  manifestPath: string,
  filesystem?: ReviewFilesystem
): Promise<
  | {
      refinedDraft: string;
      changeSummary: string;
      informationHighway: string;
    }
  | null
> {
  try {
    return await readMemoryArtifacts(iterationArtifacts, manifestPath, filesystem);
  } catch {
    return null;
  }
}

async function readMemoryArtifacts(
  iterationArtifacts: IterationArtifactPaths,
  manifestPath: string,
  filesystem?: ReviewFilesystem
): Promise<{
  refinedDraft: string;
  changeSummary: string;
  informationHighway: string;
}> {
  const manifest = await readRunManifest(manifestPath, filesystem);
  const [refinedDraft, changeSummary, informationHighway] = await Promise.all([
    readArtifactFile(iterationArtifacts.refinedDraftFile, filesystem),
    readArtifactFile(iterationArtifacts.changesFile, filesystem),
    readArtifactFile(manifest.artifactPaths.informationHighwayFile, filesystem)
  ]);

  return {
    refinedDraft,
    changeSummary,
    informationHighway
  };
}

async function requireTransition(
  manifestPath: string,
  expectedCurrentStatuses: readonly RunManifest["status"][],
  transition: Parameters<typeof transitionRunManifest>[2],
  filesystem?: ReviewFilesystem
): Promise<RunManifest> {
  const result = await transitionRunManifest(
    manifestPath,
    expectedCurrentStatuses,
    transition,
    filesystem
  );

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return result.value;
}

async function persistRunFailure(
  manifestPath: string,
  expectedCurrentStatuses: readonly RunManifest["status"][],
  iterationNumber: number,
  error: RefineError | InformationHighwayError,
  failureTimestamp: string,
  filesystem?: ReviewFilesystem
): Promise<void> {
  const transitionResult = await transitionRunManifest(
    manifestPath,
    expectedCurrentStatuses,
    {
      nextStatus: "failed",
      nextPhase: "failed",
      currentIteration: iterationNumber,
      updatedAt: failureTimestamp,
      lastError: {
        code: error.code,
        message: error.message,
        timestamp: failureTimestamp
      }
    },
    filesystem
  );

  if (!transitionResult.ok) {
    throw new Error(transitionResult.error.message);
  }
}

async function persistRunCancellationIfNeeded(
  manifestPath: string,
  cancellationTimestamp: string,
  error: unknown,
  filesystem?: ReviewFilesystem
): Promise<boolean> {
  if (!isOperationCancelledError(error)) {
    return false;
  }

  const manifest = await readRunManifest(manifestPath, filesystem);

  if (manifest.status === "finished" || manifest.status === "failed" || manifest.status === "cancelled") {
    return false;
  }

  const transitionResult = await transitionRunManifest(
    manifestPath,
    [manifest.status],
    {
      nextStatus: "cancelled",
      nextPhase: "cancelled",
      currentIteration: manifest.phaseMetadata.currentIteration,
      iterationsCompleted: manifest.iterationsCompleted,
      updatedAt: cancellationTimestamp,
      lastError: {
        code: "run_cancelled",
        message:
          error instanceof Error ? error.message : "Uraniborg run cancelled.",
        timestamp: cancellationTimestamp
      }
    },
    filesystem
  );

  if (!transitionResult.ok) {
    throw new Error(transitionResult.error.message);
  }

  return true;
}

async function reopenInterruptedRun(
  manifestPath: string,
  resumeStatus: IterationStartStatus,
  updatedAt: string,
  filesystem?: ReviewFilesystem
): Promise<void> {
  const transitionResult = await transitionRunManifest(
    manifestPath,
    ["failed", "cancelled"],
    {
      nextStatus: resumeStatus,
      nextPhase: phaseForStatus(resumeStatus),
      updatedAt
    },
    filesystem
  );

  if (!transitionResult.ok) {
    throw new Error(transitionResult.error.message);
  }
}

function resolveResumeStartStatus(manifest: RunManifest): IterationStartStatus {
  if (manifest.status === "finished") {
    throw new Error(`Run "${manifest.runId}" is already finished and cannot be resumed.`);
  }

  if (manifest.status === "failed" || manifest.status === "cancelled") {
    const resumeFromStatus = manifest.phaseMetadata.resumeFromStatus;

    if (resumeFromStatus === undefined || !isIterationStartStatus(resumeFromStatus)) {
      throw new Error(
        `Run "${manifest.runId}" is ${manifest.status} and does not record a resumable phase.`
      );
    }

    return resumeFromStatus;
  }

  if (!isIterationStartStatus(manifest.status)) {
    throw new Error(`Run "${manifest.runId}" is in unsupported state "${manifest.status}".`);
  }

  return manifest.status;
}

function isIterationStartStatus(status: RunStatus): status is IterationStartStatus {
  return (
    status === "initialized" ||
    status === "review_running" ||
    status === "review_complete" ||
    status === "refine_running" ||
    status === "refine_complete" ||
    status === "memory_update" ||
    status === "iteration_complete"
  );
}

function shouldRunReviewPhase(startingStatus: IterationStartStatus): boolean {
  return (
    startingStatus === "initialized" ||
    startingStatus === "review_running" ||
    startingStatus === "iteration_complete"
  );
}

function shouldRunRefinePhase(startingStatus: IterationStartStatus): boolean {
  return (
    startingStatus === "initialized" ||
    startingStatus === "review_running" ||
    startingStatus === "review_complete" ||
    startingStatus === "iteration_complete" ||
    startingStatus === "refine_running"
  );
}

function shouldRunMemoryPhase(startingStatus: IterationStartStatus): boolean {
  return (
    startingStatus === "initialized" ||
    startingStatus === "review_running" ||
    startingStatus === "review_complete" ||
    startingStatus === "refine_running" ||
    startingStatus === "iteration_complete" ||
    startingStatus === "refine_complete" ||
    startingStatus === "memory_update"
  );
}

function phaseForStatus(status: IterationStartStatus): RunManifest["phase"] {
  switch (status) {
    case "initialized":
      return "initialization";
    case "review_running":
    case "review_complete":
      return "review";
    case "refine_running":
    case "refine_complete":
      return "refinement";
    case "memory_update":
      return "memory";
    case "iteration_complete":
      return "iteration";
  }
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw createOperationCancelledError("Operation cancelled.");
  }
}

function formatRefinementLog(executedRefinement: ExecutedRefinement): string {
  return [
    `Provider: ${executedRefinement.provider}`,
    `Model: ${executedRefinement.model}`,
    ...(typeof executedRefinement.responseId === "string"
      ? [`Response ID: ${executedRefinement.responseId}`]
      : []),
    ...(typeof executedRefinement.stopReason === "string"
      ? [`Stop reason: ${executedRefinement.stopReason}`]
      : []),
    "",
    "=== REQUEST ===",
    executedRefinement.requestLog,
    "",
    "=== RESPONSE ===",
    executedRefinement.responseLog
  ].join("\n");
}

function formatRefinementFailureLog(
  error: RefineError,
  iterationArtifacts?: IterationArtifactPaths
): string {
  return [
    ...(typeof error.provider === "string" ? [`Provider: ${error.provider}`] : []),
    ...(typeof error.model === "string" ? [`Model: ${error.model}`] : []),
    ...(typeof error.responseId === "string" ? [`Response ID: ${error.responseId}`] : []),
    ...(typeof error.stopReason === "string" ? [`Stop reason: ${error.stopReason}`] : []),
    `Error code: ${error.code}`,
    `Message: ${error.message}`,
    ...(typeof error.status === "number" ? [`HTTP status: ${error.status}`] : []),
    ...(typeof iterationArtifacts?.refineResponseFile === "string" &&
    typeof error.rawOutput === "string"
      ? [`Malformed response artifact: ${iterationArtifacts.refineResponseFile}`]
      : []),
    ...(error.details !== undefined && error.details.length > 0
      ? ["Details:", ...error.details]
      : []),
    ...(typeof error.requestLog === "string"
      ? ["", "=== REQUEST ===", error.requestLog]
      : []),
    ...(typeof error.responseLog === "string"
      ? ["", "=== RESPONSE ===", error.responseLog]
      : [])
  ].join("\n");
}

function formatCancelledPhaseLog(phase: "review" | "refinement", error: unknown): string {
  return [
    `Phase: ${phase}`,
    `Message: ${error instanceof Error ? error.message : "Operation cancelled."}`
  ].join("\n");
}

function formatCancelledRefinementLog(error: RefineError): string {
  return [
    `Error code: ${error.code}`,
    `Message: ${error.message}`
  ].join("\n");
}

async function createSurfacedRefinementError(
  error: RefineError,
  iterationArtifacts: IterationArtifactPaths,
  filesystem?: ReviewFilesystem
): Promise<RefineError> {
  if (error.code !== "refine_output_invalid" || typeof error.rawOutput !== "string") {
    return error;
  }

  await writeArtifactFile(
    iterationArtifacts.refineResponseFile,
    error.rawOutput,
    filesystem
  );

  return {
    ...error,
    message: `${error.message} See ${iterationArtifacts.refineResponseFile} for the raw refinement response.`
  };
}
