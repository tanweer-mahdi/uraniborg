import type { RunLifecycleEvent } from "../ui/interactive.js";
import type { RunProgressViewModel } from "./screens/run-progress.js";

export function nextProgressState(
  current: RunProgressViewModel,
  event: RunLifecycleEvent
): RunProgressViewModel {
  switch (event.type) {
    case "run-started":
      return {
        runId: event.runId,
        status: "running",
        message: `Starting run: ${event.runId}`
      };
    case "run-resumed":
      return {
        runId: event.runId,
        status: "running",
        message: `Resuming run: ${event.runId}`
      };
    case "phase-started":
      return {
        ...current,
        runId: event.runId,
        status: "running",
        iteration: event.iteration,
        totalIterations: event.totalIterations,
        phase: event.phase,
        message: `Iteration ${event.iteration}/${event.totalIterations}: ${event.phase}`
      };
    case "run-failed":
      return {
        ...current,
        runId: event.runId,
        status: "failed",
        iteration: event.iteration,
        failureKind: event.failureKind,
        message: event.message,
        pointers: event.pointers
      };
    case "run-completed":
      return {
        ...current,
        runId: event.runId,
        status: "completed",
        finalDraftFile: event.finalDraftFile,
        message: `Run complete. Final draft: ${event.finalDraftFile}`
      };
  }
}
