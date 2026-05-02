import {
  cancel,
  confirm,
  isCancel,
  select,
  text
} from "@clack/prompts";
import type { Command } from "commander";

import {
  createRevisionAuthClient,
  ensureUraniborgAppHome,
  loadUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import { resumeRunLifecycle } from "../../loop/index.js";
import {
  readRunConfigSnapshot,
  readRunManifest,
  resolveRunArtifactPaths
} from "../../run/index.js";
import {
  createSerializedFeynmanCommandRunner,
  createNodeFeynmanCommandRunner,
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  inspectFeynmanRuntime,
  listFeynmanModels,
  type FeynmanRuntimeStatus
} from "../../review/index.js";
import type { ResolvedUraniborgConfig } from "../../types/app-config.js";
import { writeInfo } from "../../ui/output.js";
import {
  prepareRunEnvironment,
  type RunCommandDependencies
} from "./run.js";
import { executeWithProcessCancellation } from "./shared.js";

interface ResumeCommandOptions {
  nonInteractive?: boolean | undefined;
}

export function registerResumeCommand(program: Command): void {
  program
    .command("resume")
    .argument("<run-id>", "Run identifier to resume.")
    .option(
      "--non-interactive",
      "Use persisted model selections and skip interactive remediation prompts."
    )
    .description("Resume an interrupted Uraniborg run.")
    .action(async (runId: string, options: ResumeCommandOptions) => {
      await runResumeCommand(runId, options);
    });
}

export async function runResumeCommand(
  runId: string,
  options: ResumeCommandOptions,
  dependencies: RunCommandDependencies = {}
): Promise<void> {
  const writeLine = dependencies.writeLine ?? writeInfo;
  const authClient = dependencies.authClient ?? createRevisionAuthClient();
  const runner = createSerializedFeynmanCommandRunner(
    dependencies.runner ?? createNodeFeynmanCommandRunner()
  );
  const interactive =
    dependencies.interactive ?? !(options.nonInteractive ?? false);
  const prompts = dependencies.prompts ?? {
    cancel,
    confirm,
    isCancel,
    select,
    text
  };
  const paths = (dependencies.resolvePaths ?? resolveUraniborgPaths)();
  const manifestPath = resolveRunArtifactPaths(paths.runsDirectory, runId).manifestFile;

  let manifest;
  let configSnapshot;

  try {
    manifest = await readRunManifest(manifestPath, dependencies.filesystem);
    configSnapshot = await readRunConfigSnapshot(
      resolveRunArtifactPaths(paths.runsDirectory, runId).configSnapshotFile,
      dependencies.filesystem
    );
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Run "${runId}" could not be loaded: ${error.message}`
        : `Run "${runId}" could not be loaded.`
    );
  }

  if (manifest.status === "finished") {
    throw new Error(`Run "${runId}" is already finished and cannot be resumed.`);
  }

  const preparedEnvironment = await prepareRunEnvironment(
    {
      reviewModel: manifest.selectedModels.review,
      refineModel: manifest.selectedModels.refine,
      nonInteractive: options.nonInteractive
    },
    {
      environment: dependencies.environment,
      interactive,
      prompts,
      resolvePaths: dependencies.resolvePaths ?? resolveUraniborgPaths,
      ensureAppHome: dependencies.ensureAppHome ?? ensureUraniborgAppHome,
      loadConfig: dependencies.loadConfig ?? loadUraniborgConfig,
      authClient,
      inspectRuntime: dependencies.inspectRuntime ?? inspectFeynmanRuntime,
      listModels: dependencies.listModels ?? listFeynmanModels,
      getAlphaStatus: dependencies.getAlphaStatus ?? getFeynmanAlphaStatus,
      getSearchStatus: dependencies.getSearchStatus ?? getFeynmanSearchStatus,
      runner,
      launcher: dependencies.launcher,
      writeLine
    }
  );

  const resumedConfig = applySnapshottedRevisionInstruction(
    preparedEnvironment.config,
    configSnapshot.revisionPrompt
  );

  await executeWithProcessCancellation(async (signal) => {
    await resumeRunLifecycle(
      {
        runId,
        config: resumedConfig,
        runsDirectory: preparedEnvironment.paths.runsDirectory,
        reviewExecutablePath: requireRuntimeExecutablePath(
          preparedEnvironment.runtimeStatus
        )
      },
      {
        clock: dependencies.clock,
        filesystem: dependencies.filesystem,
        authClient,
        runner,
        signal,
        writeLine,
        eventSink: dependencies.eventSink
      }
    );
  });
}

function applySnapshottedRevisionInstruction(
  config: ResolvedUraniborgConfig,
  revisionPrompt: {
    source: "default" | "file";
    configuredPath?: string | undefined;
    effectiveInstruction: string;
  }
): ResolvedUraniborgConfig {
  return {
    ...config,
    revision: {
      ...config.revision,
      instructionPrompt: {
        source: revisionPrompt.source,
        ...(revisionPrompt.configuredPath === undefined
          ? {}
          : {
              configuredPath: revisionPrompt.configuredPath
            }),
        effectiveInstruction: revisionPrompt.effectiveInstruction
      }
    }
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
