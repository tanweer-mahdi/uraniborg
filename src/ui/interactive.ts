export type InteractiveReadinessState =
  | "ready"
  | "action-required"
  | "stale"
  | "warning";

export const INTERACTIVE_READINESS_PRECEDENCE: readonly InteractiveReadinessState[] =
  ["stale", "action-required", "warning", "ready"] as const;

export type RunLifecyclePhase = "review" | "refine" | "memory";

export type RunFailureKind =
  | "review-failure"
  | "refinement-execution-failure"
  | "refinement-output-contract-failure"
  | "memory-update-failure";

export type RunLifecycleEvent =
  | {
      type: "run-started";
      runId: string;
    }
  | {
      type: "run-resumed";
      runId: string;
    }
  | {
      type: "phase-started";
      runId: string;
      iteration: number;
      totalIterations: number;
      phase: RunLifecyclePhase;
    }
  | {
      type: "run-completed";
      runId: string;
      finalDraftFile: string;
    }
  | {
      type: "run-failed";
      runId: string;
      iteration: number;
      failureKind: RunFailureKind;
      message: string;
      pointers: readonly string[];
    };

export interface RunLifecycleEventSink {
  onEvent: (event: RunLifecycleEvent) => void;
}

export function resolveInteractiveReadinessState(
  states: readonly InteractiveReadinessState[]
): InteractiveReadinessState {
  for (const candidate of INTERACTIVE_READINESS_PRECEDENCE) {
    if (states.includes(candidate)) {
      return candidate;
    }
  }

  return "ready";
}
