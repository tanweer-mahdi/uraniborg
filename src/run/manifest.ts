import { z } from "zod";

import { readArtifactFile, writeArtifactFile } from "./artifact-store.js";
import type { RunArtifactPaths, RunFilesystem } from "./artifact-store.js";
import { URANIBORG_DEFAULT_REVISION_GUIDANCE_PROMPT } from "../refine/refinement.js";
import type { ResolvedUraniborgConfig } from "../types/app-config.js";

export const RUN_STATUSES = [
  "initialized",
  "review_running",
  "review_complete",
  "refine_running",
  "refine_complete",
  "memory_update",
  "iteration_complete",
  "finished",
  "failed",
  "cancelled"
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export type RunPhase =
  | "initialization"
  | "review"
  | "refinement"
  | "memory"
  | "iteration"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunManifestError {
  code:
    | "manifest_invalid_json"
    | "manifest_invalid_schema"
    | "state_ownership_violation";
  message: string;
}

export interface RunManifestLastError {
  code: string;
  message: string;
  timestamp: string;
}

export interface RunManifestPhaseMetadata {
  currentIteration: number;
  currentPhaseStartedAt: string;
  resumeFromStatus?: RunStatus | undefined;
}

export interface RunManifestSelectedModels {
  review: string;
  refine: string;
}

export interface RunManifest {
  runId: string;
  slug: string;
  title: string;
  status: RunStatus;
  phase: RunPhase;
  createdAt: string;
  updatedAt: string;
  sourceInputPath: string;
  iterationsPlanned: number;
  iterationsCompleted: number;
  selectedModels: RunManifestSelectedModels;
  artifactPaths: RunArtifactPaths;
  phaseMetadata: RunManifestPhaseMetadata;
  lastError?: RunManifestLastError | undefined;
}

export interface RunConfigSnapshot {
  input: {
    sourcePath: string;
    title: string;
    slug: string;
  };
  iterationCount: number;
  selectedModels: RunManifestSelectedModels;
  resolvedDefaults: {
    model: string;
    temperature: number;
    maxOutputTokens?: number | undefined;
  };
  revisionRuntime: {
    profileId: string;
    profileLabel: string;
    authClass: string;
    acquisition: string;
    credentialBindingType: string;
    baseUrl: string;
    timeoutMs: number;
    providerContext?: {
      accountId?: string | undefined;
      projectId?: string | undefined;
    } | undefined;
  };
  revisionPrompt: {
    source: "default" | "file";
    configuredPath?: string | undefined;
    effectiveInstruction: string;
  };
}

const runManifestSchema: z.ZodType<RunManifest> = z.object({
  runId: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(RUN_STATUSES),
  phase: z.enum([
    "initialization",
    "review",
    "refinement",
    "memory",
    "iteration",
    "completed",
    "failed",
    "cancelled"
  ]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sourceInputPath: z.string().min(1),
  iterationsPlanned: z.number().int().positive(),
  iterationsCompleted: z.number().int().min(0),
  selectedModels: z.object({
    review: z.string().min(1),
    refine: z.string().min(1)
  }),
  artifactPaths: z.object({
    runDirectory: z.string().min(1),
    manifestFile: z.string().min(1),
    configSnapshotFile: z.string().min(1),
    originalDraftFile: z.string().min(1),
    currentDraftFile: z.string().min(1),
    finalDraftFile: z.string().min(1),
    informationHighwayFile: z.string().min(1)
  }),
  phaseMetadata: z.object({
    currentIteration: z.number().int().min(1),
    currentPhaseStartedAt: z.string().datetime(),
    resumeFromStatus: z.enum(RUN_STATUSES).optional()
  }),
  lastError: z
    .object({
      code: z.string().min(1),
      message: z.string().min(1),
      timestamp: z.string().datetime()
    })
    .optional()
});

const runConfigSnapshotSchema = z.object({
  input: z.object({
    sourcePath: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().min(1)
  }),
  iterationCount: z.number().int().positive(),
  selectedModels: z.object({
    review: z.string().min(1),
    refine: z.string().min(1)
  }),
  resolvedDefaults: z.object({
    model: z.string().min(1),
    temperature: z.number(),
    maxOutputTokens: z.number().int().positive().optional()
  }),
  revisionRuntime: z.object({
    profileId: z.string().min(1),
    profileLabel: z.string().min(1),
    authClass: z.string().min(1),
    acquisition: z.string().min(1),
    credentialBindingType: z.string().min(1),
    baseUrl: z.string().min(1),
    timeoutMs: z.number().int().positive(),
    providerContext: z
      .object({
        accountId: z.string().min(1).optional(),
        projectId: z.string().min(1).optional()
      })
      .optional()
  }),
  revisionPrompt: z
    .object({
      source: z.enum(["default", "file"]),
      configuredPath: z.string().min(1).optional(),
      effectiveInstruction: z.string().min(1)
    })
    .optional()
});

export function createRunManifest(input: {
  runId: string;
  slug: string;
  title: string;
  sourceInputPath: string;
  iterationsPlanned: number;
  selectedModels: RunManifestSelectedModels;
  artifactPaths: RunArtifactPaths;
  createdAt: string;
}): RunManifest {
  return {
    runId: input.runId,
    slug: input.slug,
    title: input.title,
    status: "initialized",
    phase: "initialization",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    sourceInputPath: input.sourceInputPath,
    iterationsPlanned: input.iterationsPlanned,
    iterationsCompleted: 0,
    selectedModels: input.selectedModels,
    artifactPaths: input.artifactPaths,
    phaseMetadata: {
      currentIteration: 1,
      currentPhaseStartedAt: input.createdAt
    }
  };
}

export function createRunConfigSnapshot(input: {
  config: ResolvedUraniborgConfig;
  sourcePath: string;
  title: string;
  slug: string;
  iterationCount: number;
  selectedModels: RunManifestSelectedModels;
}): RunConfigSnapshot {
  return {
    input: {
      sourcePath: input.sourcePath,
      title: input.title,
      slug: input.slug
    },
    iterationCount: input.iterationCount,
    selectedModels: input.selectedModels,
    resolvedDefaults: {
      model: input.config.refine.defaults.model,
      temperature: input.config.refine.defaults.temperature,
      ...(typeof input.config.refine.defaults.maxOutputTokens === "number"
        ? { maxOutputTokens: input.config.refine.defaults.maxOutputTokens }
        : {})
    },
    revisionRuntime: {
      profileId: input.config.revision.profile.id,
      profileLabel: input.config.revision.profile.label,
      authClass: input.config.revision.auth.class,
      acquisition: input.config.revision.auth.acquisition,
      credentialBindingType: input.config.revision.credentialBinding.type,
      baseUrl: input.config.refine.endpoint.baseUrl,
      timeoutMs: input.config.refine.endpoint.timeoutMs,
      ...(input.config.revision.providerContext === undefined
        ? {}
        : {
            providerContext: input.config.revision.providerContext
          })
    },
    revisionPrompt: {
      source: input.config.revision.instructionPrompt.source,
      ...(input.config.revision.instructionPrompt.configuredPath === undefined
        ? {}
        : {
            configuredPath: input.config.revision.instructionPrompt.configuredPath
          }),
      effectiveInstruction:
        input.config.revision.instructionPrompt.effectiveInstruction
    }
  };
}

export async function readRunManifest(
  manifestPath: string,
  filesystem?: RunFilesystem
): Promise<RunManifest> {
  const fileContents = await readArtifactFile(manifestPath, filesystem);
  const parsedJson = parseJson(fileContents, manifestPath);
  const parsedManifest = runManifestSchema.safeParse(parsedJson);

  if (!parsedManifest.success) {
    throw createManifestError(
      "manifest_invalid_schema",
      `Run manifest schema is invalid at "${manifestPath}".`
    );
  }

  return parsedManifest.data;
}

export async function writeRunManifest(
  manifestPath: string,
  manifest: RunManifest,
  filesystem?: RunFilesystem
): Promise<void> {
  const serializedManifest = JSON.stringify(manifest, null, 2);
  await writeArtifactFile(manifestPath, `${serializedManifest}\n`, filesystem);
}

export async function writeRunConfigSnapshot(
  snapshotPath: string,
  snapshot: RunConfigSnapshot,
  filesystem?: RunFilesystem
): Promise<void> {
  const serializedSnapshot = JSON.stringify(snapshot, null, 2);
  await writeArtifactFile(snapshotPath, `${serializedSnapshot}\n`, filesystem);
}

export async function readRunConfigSnapshot(
  snapshotPath: string,
  filesystem?: RunFilesystem
): Promise<RunConfigSnapshot> {
  const fileContents = await readArtifactFile(snapshotPath, filesystem);
  const parsedJson = parseJson(fileContents, snapshotPath);
  const parsedSnapshot = runConfigSnapshotSchema.safeParse(parsedJson);

  if (!parsedSnapshot.success) {
    throw createManifestError(
      "manifest_invalid_schema",
      `Run config snapshot schema is invalid at "${snapshotPath}".`
    );
  }

  return {
    ...parsedSnapshot.data,
    revisionPrompt:
      parsedSnapshot.data.revisionPrompt ?? {
        source: "default",
        effectiveInstruction: URANIBORG_DEFAULT_REVISION_GUIDANCE_PROMPT
      }
  };
}

function parseJson(fileContents: string, manifestPath: string): unknown {
  try {
    return JSON.parse(fileContents) as unknown;
  } catch {
    throw createManifestError(
      "manifest_invalid_json",
      `Run manifest is not valid JSON at "${manifestPath}".`
    );
  }
}

function createManifestError(
  code: RunManifestError["code"],
  message: string
): Error & { code: RunManifestError["code"] } {
  return Object.assign(new Error(message), { code });
}
