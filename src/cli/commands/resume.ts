import {
  cancel,
  confirm,
  isCancel,
  select,
  text
} from "@clack/prompts";
import type { Command } from "commander";

import {
  ensureUraniborgAppHome,
  loadUraniborgConfig,
  resolveUraniborgPaths
} from "../../config/index.js";
import { resumeRunLifecycle } from "../../loop/index.js";
import { readRunManifest, resolveRunArtifactPaths } from "../../run/index.js";
import {
  createNodeFeynmanCommandRunner,
  getPinnedFeynmanAlphaStatus,
  getPinnedFeynmanSearchStatus,
  inspectPinnedFeynmanRuntime,
  listPinnedFeynmanModels
} from "../../review/index.js";
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
  const runner = dependencies.runner ?? createNodeFeynmanCommandRunner();
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

  try {
    manifest = await readRunManifest(manifestPath, dependencies.filesystem);
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
      inspectRuntime: dependencies.inspectRuntime ?? inspectPinnedFeynmanRuntime,
      listModels: dependencies.listModels ?? listPinnedFeynmanModels,
      getAlphaStatus: dependencies.getAlphaStatus ?? getPinnedFeynmanAlphaStatus,
      getSearchStatus: dependencies.getSearchStatus ?? getPinnedFeynmanSearchStatus,
      runner,
      launcher: dependencies.launcher,
      writeLine
    }
  );

  await executeWithProcessCancellation(async (signal) => {
    await resumeRunLifecycle(
      {
        runId,
        config: preparedEnvironment.config,
        runsDirectory: preparedEnvironment.paths.runsDirectory,
        reviewExecutablePath: preparedEnvironment.runtimeStatus.executablePath
      },
      {
        clock: dependencies.clock,
        filesystem: dependencies.filesystem,
        httpClient: dependencies.httpClient,
        runner,
        signal,
        writeLine
      }
    );
  });
}
