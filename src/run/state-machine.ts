import { ok, err, type Result } from "../types/result.js";

import {
  readRunManifest,
  writeRunManifest,
  type RunManifest,
  type RunManifestError,
  type RunPhase,
  type RunStatus
} from "./manifest.js";
import type { RunFilesystem } from "./artifact-store.js";

export interface RunManifestTransition {
  nextStatus: RunStatus;
  nextPhase: RunPhase;
  updatedAt: string;
  currentIteration?: number | undefined;
  iterationsCompleted?: number | undefined;
  lastError?: RunManifest["lastError"];
}

export async function transitionRunManifest(
  manifestPath: string,
  expectedCurrentStatuses: readonly RunStatus[],
  transition: RunManifestTransition,
  filesystem?: RunFilesystem
): Promise<Result<RunManifest, RunManifestError>> {
  const manifest = await readRunManifest(manifestPath, filesystem);

  if (!expectedCurrentStatuses.includes(manifest.status)) {
    return err({
      code: "state_ownership_violation",
      message: `Cannot transition run from "${manifest.status}" when ownership requires one of: ${expectedCurrentStatuses.join(", ")}.`
    });
  }

  const nextManifest: RunManifest = {
    ...manifest,
    status: transition.nextStatus,
    phase: transition.nextPhase,
    updatedAt: transition.updatedAt,
    iterationsCompleted:
      transition.iterationsCompleted ?? manifest.iterationsCompleted,
    phaseMetadata: {
      currentIteration:
        transition.currentIteration ?? manifest.phaseMetadata.currentIteration,
      currentPhaseStartedAt: transition.updatedAt
    },
    ...(transition.lastError !== undefined
      ? { lastError: transition.lastError }
      : {})
  };

  await writeRunManifest(manifestPath, nextManifest, filesystem);

  return ok(nextManifest);
}
