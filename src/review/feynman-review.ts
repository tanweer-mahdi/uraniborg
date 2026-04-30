import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  runFeynmanCommand,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner
} from "./feynman-bootstrap.js";
import { transitionRunManifest } from "../run/state-machine.js";
import { writeArtifactFile, type RunFilesystem } from "../run/artifact-store.js";
import { err, ok, type Result } from "../types/result.js";

export const REVIEW_WORKSPACE_DIRECTORY_NAME = "feynman-review";
export const REVIEW_WORKSPACE_INPUT_FILENAME = "input.md";
export const REVIEW_SESSION_DIRECTORY_NAME = "session";
export const REVIEW_OUTPUTS_DIRECTORY_NAME = "outputs";

export interface ReviewWorkspacePaths {
  workspaceDirectory: string;
  sessionDirectory: string;
  workspaceInputFile: string;
  outputsDirectory: string;
}

export interface ReviewArtifactSnapshot {
  reviewArtifacts: readonly string[];
}

export interface ReviewCommandContract {
  executablePath: string;
  args: readonly string[];
}

export interface ReviewSuccess {
  execution: FeynmanCommandExecution;
  reviewWorkspace: ReviewWorkspacePaths;
  normalizedReviewFile: string;
  externalReviewFile: string;
  reviewLogFile: string;
}

export type ReviewFailureCode =
  | "review_process_failed"
  | "review_artifact_missing"
  | "review_artifact_ambiguous"
  | "review_artifact_unusable";

export interface ReviewFailure {
  code: ReviewFailureCode;
  message: string;
  details?: readonly string[] | undefined;
  exitCode?: number | undefined;
}

export interface ReviewFilesystem extends RunFilesystem {
  copyFile: (sourcePath: string, destinationPath: string) => Promise<void>;
  listDirectory: (directoryPath: string) => Promise<readonly string[]>;
  removeDirectory: (directoryPath: string) => Promise<void>;
}

export interface ExecuteReviewInput {
  executablePath: string;
  reviewModel: string;
  reviewWorkspace: ReviewWorkspacePaths;
  reviewLogFile: string;
  normalizedReviewFile: string;
  manifestPath: string;
  iterationNumber: number;
  failureTimestamp: string;
  signal?: AbortSignal | undefined;
}

export function createNodeReviewFilesystem(): ReviewFilesystem {
  return {
    async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
      await copyFile(sourcePath, destinationPath);
    },
    async listDirectory(directoryPath: string): Promise<readonly string[]> {
      return readdir(directoryPath);
    },
    async mkdir(directoryPath: string): Promise<void> {
      await mkdir(directoryPath, { recursive: true });
    },
    async readFile(filePath: string): Promise<string> {
      return readFile(filePath, "utf8");
    },
    async removeDirectory(directoryPath: string): Promise<void> {
      await rm(directoryPath, { recursive: true, force: true });
    },
    async rename(sourcePath: string, targetPath: string): Promise<void> {
      await rename(sourcePath, targetPath);
    },
    async writeFile(filePath: string, contents: string): Promise<void> {
      await writeFile(filePath, contents, "utf8");
    }
  };
}

export async function createFreshReviewWorkspace(
  iterationDirectory: string,
  filesystem: ReviewFilesystem = createNodeReviewFilesystem()
): Promise<ReviewWorkspacePaths> {
  const workspaceDirectory = path.join(
    iterationDirectory,
    REVIEW_WORKSPACE_DIRECTORY_NAME
  );
  const sessionDirectory = path.join(workspaceDirectory, REVIEW_SESSION_DIRECTORY_NAME);
  const workspaceInputFile = path.join(
    workspaceDirectory,
    REVIEW_WORKSPACE_INPUT_FILENAME
  );
  const outputsDirectory = path.join(workspaceDirectory, REVIEW_OUTPUTS_DIRECTORY_NAME);

  await filesystem.removeDirectory(workspaceDirectory);
  await filesystem.mkdir(workspaceDirectory);
  await filesystem.mkdir(sessionDirectory);

  return {
    workspaceDirectory,
    sessionDirectory,
    workspaceInputFile,
    outputsDirectory
  };
}

export function createReviewCommandContract(input: {
  executablePath: string;
  reviewModel: string;
  reviewWorkspace: ReviewWorkspacePaths;
}): ReviewCommandContract {
  return {
    executablePath: input.executablePath,
    args: [
      "review",
      REVIEW_WORKSPACE_INPUT_FILENAME,
      "--model",
      input.reviewModel,
      "--cwd",
      input.reviewWorkspace.workspaceDirectory,
      "--session-dir",
      input.reviewWorkspace.sessionDirectory,
      "--new-session"
    ]
  };
}

export async function writeIterationReviewInput(input: {
  currentDraftFile: string;
  iterationInputFile: string;
  reviewWorkspace: ReviewWorkspacePaths;
  filesystem?: ReviewFilesystem;
}): Promise<string> {
  const filesystem = input.filesystem ?? createNodeReviewFilesystem();
  const currentDraftContents = await filesystem.readFile(input.currentDraftFile);

  await writeArtifactFile(input.iterationInputFile, currentDraftContents, filesystem);
  await filesystem.copyFile(
    input.iterationInputFile,
    input.reviewWorkspace.workspaceInputFile
  );

  return currentDraftContents;
}

export async function snapshotReviewArtifacts(
  reviewWorkspace: ReviewWorkspacePaths,
  filesystem: ReviewFilesystem = createNodeReviewFilesystem()
): Promise<ReviewArtifactSnapshot> {
  const reviewArtifacts = await listReviewArtifacts(
    reviewWorkspace.outputsDirectory,
    filesystem
  );

  return {
    reviewArtifacts
  };
}

export async function executeReviewAndNormalize(
  input: ExecuteReviewInput,
  runner?: FeynmanCommandRunner,
  filesystem: ReviewFilesystem = createNodeReviewFilesystem()
): Promise<Result<ReviewSuccess, ReviewFailure>> {
  const snapshot = await snapshotReviewArtifacts(input.reviewWorkspace, filesystem);
  const command = createReviewCommandContract({
    executablePath: input.executablePath,
    reviewModel: input.reviewModel,
    reviewWorkspace: input.reviewWorkspace
  });
  const execution = await runFeynmanCommand(
    command.executablePath,
    command.args,
    {
      signal: input.signal
    },
    runner
  );

  await writeArtifactFile(
    input.reviewLogFile,
    formatReviewLog(command, execution),
    filesystem
  );

  if (execution.exitCode !== 0) {
    const providerMessage = extractProviderReviewFailureMessage(execution.stderr);
    const failure = createReviewFailure({
      code: "review_process_failed",
      message:
        providerMessage ??
        `Pinned Feynman review exited with code ${execution.exitCode} during iteration ${input.iterationNumber}.`,
      details: execution.stderr.trim().length > 0 ? [execution.stderr.trim()] : undefined,
      exitCode: execution.exitCode
    });

    await persistReviewFailure(
      input.manifestPath,
      input.iterationNumber,
      failure,
      input.failureTimestamp,
      filesystem
    );

    return err(failure);
  }

  const reviewArtifactResult = await discoverNewReviewArtifact(
    input.reviewWorkspace,
    snapshot,
    filesystem
  );

  if (!reviewArtifactResult.ok) {
    await persistReviewFailure(
      input.manifestPath,
      input.iterationNumber,
      reviewArtifactResult.error,
      input.failureTimestamp,
      filesystem
    );

    return reviewArtifactResult;
  }

  const normalizedReviewResult = await normalizeReviewArtifact({
    externalReviewFile: reviewArtifactResult.value,
    normalizedReviewFile: input.normalizedReviewFile,
    filesystem
  });

  if (!normalizedReviewResult.ok) {
    await persistReviewFailure(
      input.manifestPath,
      input.iterationNumber,
      normalizedReviewResult.error,
      input.failureTimestamp,
      filesystem
    );

    return normalizedReviewResult;
  }

  return ok({
    execution,
    reviewWorkspace: input.reviewWorkspace,
    normalizedReviewFile: input.normalizedReviewFile,
    externalReviewFile: reviewArtifactResult.value,
    reviewLogFile: input.reviewLogFile
  });
}

function extractProviderReviewFailureMessage(stderr: string): string | undefined {
  const trimmedStderr = stderr.trim();

  if (trimmedStderr.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmedStderr) as unknown;
    const message = extractMessageFromUnknown(parsed);

    if (typeof message === "string" && message.trim().length > 0) {
      return message.trim();
    }
  } catch {
    // Fall through to plain-text extraction.
  }

  const firstNonEmptyLine = trimmedStderr
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstNonEmptyLine;
}

function extractMessageFromUnknown(input: unknown): string | undefined {
  if (typeof input === "string") {
    return input;
  }

  if (typeof input !== "object" || input === null) {
    return undefined;
  }

  const candidate = input as Record<string, unknown>;
  const directMessage = candidate["detail"] ?? candidate["message"] ?? candidate["error"];

  if (typeof directMessage === "string") {
    return directMessage;
  }

  return undefined;
}

export async function discoverNewReviewArtifact(
  reviewWorkspace: ReviewWorkspacePaths,
  snapshot: ReviewArtifactSnapshot,
  filesystem: ReviewFilesystem = createNodeReviewFilesystem()
): Promise<Result<string, ReviewFailure>> {
  const currentReviewArtifacts = await listReviewArtifacts(
    reviewWorkspace.outputsDirectory,
    filesystem
  );
  const previousArtifacts = new Set(snapshot.reviewArtifacts);
  const newReviewArtifacts = currentReviewArtifacts.filter(
    (filePath) => !previousArtifacts.has(filePath)
  );

  if (newReviewArtifacts.length === 0) {
    return err(
      createReviewFailure({
        code: "review_artifact_missing",
        message:
          "Pinned Feynman review completed without producing a new outputs/*-review.md artifact."
      })
    );
  }

  if (newReviewArtifacts.length > 1) {
    return err(
      createReviewFailure({
        code: "review_artifact_ambiguous",
        message:
          "Pinned Feynman review produced multiple new outputs/*-review.md artifacts, so attribution is ambiguous.",
        details: newReviewArtifacts
      })
    );
  }

  const discoveredArtifact = newReviewArtifacts[0];

  if (discoveredArtifact === undefined) {
    return err(
      createReviewFailure({
        code: "review_artifact_missing",
        message:
          "Pinned Feynman review completed without producing a uniquely attributable review artifact."
      })
    );
  }

  return ok(discoveredArtifact);
}

export async function normalizeReviewArtifact(input: {
  externalReviewFile: string;
  normalizedReviewFile: string;
  filesystem?: ReviewFilesystem;
}): Promise<Result<string, ReviewFailure>> {
  const filesystem = input.filesystem ?? createNodeReviewFilesystem();
  const reviewContents = await filesystem.readFile(input.externalReviewFile);

  if (reviewContents.trim().length === 0) {
    return err(
      createReviewFailure({
        code: "review_artifact_unusable",
        message: `Pinned Feynman review artifact "${input.externalReviewFile}" was empty or whitespace-only.`
      })
    );
  }

  await writeArtifactFile(input.normalizedReviewFile, reviewContents, filesystem);

  return ok(input.normalizedReviewFile);
}

export async function persistReviewFailure(
  manifestPath: string,
  iterationNumber: number,
  failure: ReviewFailure,
  failureTimestamp: string,
  filesystem: ReviewFilesystem = createNodeReviewFilesystem()
): Promise<void> {
  const transitionResult = await transitionRunManifest(
    manifestPath,
    ["review_running"],
    {
      nextStatus: "failed",
      nextPhase: "failed",
      currentIteration: iterationNumber,
      updatedAt: failureTimestamp,
      lastError: {
        code: failure.code,
        message: failure.message,
        timestamp: failureTimestamp
      }
    },
    filesystem
  );

  if (!transitionResult.ok) {
    throw new Error(transitionResult.error.message);
  }
}

async function listReviewArtifacts(
  outputsDirectory: string,
  filesystem: ReviewFilesystem
): Promise<readonly string[]> {
  try {
    const entries = await filesystem.listDirectory(outputsDirectory);

    return entries
      .filter((entry) => entry.endsWith("-review.md"))
      .map((entry) => path.join(outputsDirectory, entry))
      .sort();
  } catch (error) {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return [];
    }

    throw error;
  }
}

function formatReviewLog(
  command: ReviewCommandContract,
  execution: FeynmanCommandExecution
): string {
  return [
    `$ ${command.executablePath} ${command.args.join(" ")}`,
    `exitCode: ${execution.exitCode}`,
    "",
    "=== STDOUT ===",
    execution.stdout,
    "=== STDERR ===",
    execution.stderr
  ].join("\n");
}

function createReviewFailure(input: ReviewFailure): ReviewFailure {
  return {
    code: input.code,
    message: input.message,
    ...(input.details !== undefined ? { details: input.details } : {}),
    ...(input.exitCode !== undefined ? { exitCode: input.exitCode } : {})
  };
}

function isNodeErrorWithCode(
  error: unknown,
  code: string
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}
