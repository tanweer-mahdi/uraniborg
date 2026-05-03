import {
  inspectFeynmanRuntime,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner,
  type FeynmanRuntimeStatus
} from "./feynman-bootstrap.js";
import {
  applyCompatibilityToRuntimeStatus,
  collectFeynmanCompatibilitySnapshot,
  type FeynmanCompatibilityReport
} from "./feynman-compatibility.js";
import {
  getFeynmanAlphaStatus,
  getFeynmanSearchStatus,
  listFeynmanModels
} from "./feynman-models.js";
import {
  classifyFeynmanReadiness,
  type FeynmanReadinessReport
} from "./feynman-readiness.js";

export interface FeynmanRuntimeSnapshot {
  runtimeStatus: FeynmanRuntimeStatus;
  modelListExecution?: FeynmanCommandExecution | undefined;
  alphaStatusExecution?: FeynmanCommandExecution | undefined;
  searchStatusExecution?: FeynmanCommandExecution | undefined;
  compatibilityReport: FeynmanCompatibilityReport;
  readinessReport: FeynmanReadinessReport;
}

export interface FeynmanRuntimeSnapshotOptions {
  environment?: NodeJS.ProcessEnv | undefined;
  inspectRuntime?: typeof inspectFeynmanRuntime;
  listModels?: typeof listFeynmanModels;
  getAlphaStatus?: typeof getFeynmanAlphaStatus;
  getSearchStatus?: typeof getFeynmanSearchStatus;
  runner?: FeynmanCommandRunner;
  includeReviewModels?: boolean | undefined;
  includeCapabilities?: boolean | undefined;
  selectedReviewModel?: string | undefined;
}

export function createSerializedFeynmanCommandRunner(
  runner: FeynmanCommandRunner
): FeynmanCommandRunner {
  let tail = Promise.resolve();

  return {
    async run(executablePath, args, options) {
      const execute = async (): Promise<FeynmanCommandExecution> =>
        runner.run(executablePath, args, options);
      const result = tail.then(execute, execute);
      tail = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    }
  };
}

export async function collectFeynmanRuntimeSnapshot(
  options: FeynmanRuntimeSnapshotOptions = {}
): Promise<FeynmanRuntimeSnapshot> {
  const inspectRuntime = options.inspectRuntime ?? inspectFeynmanRuntime;
  const listModels = options.listModels ?? listFeynmanModels;
  const getAlphaStatus = options.getAlphaStatus ?? getFeynmanAlphaStatus;
  const getSearchStatus = options.getSearchStatus ?? getFeynmanSearchStatus;
  const includeReviewModels =
    options.includeReviewModels ?? options.selectedReviewModel !== undefined;
  const includeCapabilities = options.includeCapabilities ?? false;

  const inspectedRuntimeStatus = await inspectRuntime(
    options.environment,
    options.runner
  );
  const compatibilitySnapshot = await collectFeynmanCompatibilitySnapshot(
    inspectedRuntimeStatus,
    {
      listModels,
      getAlphaStatus,
      getSearchStatus,
      runner: options.runner
    }
  );
  const runtimeStatus = applyCompatibilityToRuntimeStatus(
    inspectedRuntimeStatus,
    compatibilitySnapshot.compatibilityReport
  );
  let modelListExecution: FeynmanCommandExecution | undefined;
  let alphaStatusExecution: FeynmanCommandExecution | undefined;
  let searchStatusExecution: FeynmanCommandExecution | undefined;

  if (runtimeStatus.ready) {
    const runtimeExecutablePath = runtimeStatus.executablePath;

    if (runtimeExecutablePath === undefined) {
      throw new Error("Ready Feynman runtime did not include an executable path.");
    }

    if (includeReviewModels) {
      modelListExecution =
        compatibilitySnapshot.modelListExecution ??
        (await listModels(runtimeExecutablePath, options.runner));
    }

    if (includeCapabilities) {
      alphaStatusExecution =
        compatibilitySnapshot.alphaStatusExecution ??
        (await getAlphaStatus(runtimeExecutablePath, options.runner));
      searchStatusExecution =
        compatibilitySnapshot.searchStatusExecution ??
        (await getSearchStatus(runtimeExecutablePath, options.runner));
    }
  }

  return {
    runtimeStatus,
    modelListExecution,
    alphaStatusExecution,
    searchStatusExecution,
    compatibilityReport: compatibilitySnapshot.compatibilityReport,
    readinessReport: classifyFeynmanReadiness({
      runtimeStatus,
      modelListExecution,
      selectedReviewModel: options.selectedReviewModel,
      alphaStatusExecution,
      searchStatusExecution
    })
  };
}
