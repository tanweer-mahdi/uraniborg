import {
  cancel,
  confirm,
  isCancel
} from "@clack/prompts";

import {
  describeFeynmanRemediationAction,
  launchFeynmanRemediationAction,
  type FeynmanInteractiveLauncher,
  type FeynmanRemediationAction
} from "../../review/index.js";
import { createOperationCancelledError } from "../../types/cancellation.js";
import { writeInfo } from "../../ui/output.js";

export interface RemediationPrompts {
  confirm: typeof confirm;
  cancel: typeof cancel;
  isCancel: typeof isCancel;
}

export interface SharedRemediationDependencies {
  interactive?: boolean;
  launcher?: FeynmanInteractiveLauncher | undefined;
  prompts?: RemediationPrompts | undefined;
  writeLine?: ((message: string) => void) | undefined;
}

export function createNotImplementedError(commandName: string): Error {
  return new Error(`Command "${commandName}" is not implemented yet.`);
}

export async function executeWithProcessCancellation<T>(
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const abortController = new AbortController();
  const abortOperation = (): void => {
    if (!abortController.signal.aborted) {
      abortController.abort(createOperationCancelledError("Operation cancelled."));
    }
  };

  process.once("SIGINT", abortOperation);
  process.once("SIGTERM", abortOperation);

  try {
    return await operation(abortController.signal);
  } finally {
    process.removeListener("SIGINT", abortOperation);
    process.removeListener("SIGTERM", abortOperation);
  }
}

export async function promptAndRunRemediations(options: {
  executablePath: string;
  actions: readonly FeynmanRemediationAction[];
  dependencies: SharedRemediationDependencies;
}): Promise<void> {
  const actions = dedupeRemediationActions(options.actions);

  if (!options.dependencies.interactive || actions.length === 0) {
    return;
  }

  const prompts = options.dependencies.prompts ?? {
    confirm,
    cancel,
    isCancel
  };
  const writeLine = options.dependencies.writeLine ?? writeInfo;

  for (const action of actions) {
    const response = await prompts.confirm({
      message: `${action.reason} Launch ${describeFeynmanRemediationAction(action)} now?`,
      initialValue: true
    });

    if (prompts.isCancel(response)) {
      prompts.cancel("Skipped Feynman remediation.");
      return;
    }

    if (response !== true) {
      continue;
    }

    writeLine(
      `Launching ${describeFeynmanRemediationAction(action)} via pinned runtime...`
    );

    const launchResult = await launchFeynmanRemediationAction(
      options.executablePath,
      action,
      options.dependencies.launcher
    );

    writeLine(
      `Finished ${describeFeynmanRemediationAction(action)} with exit code ${launchResult.exitCode}.`
    );
  }
}

function dedupeRemediationActions(
  actions: readonly FeynmanRemediationAction[]
): readonly FeynmanRemediationAction[] {
  const seen = new Set<string>();
  const deduped: FeynmanRemediationAction[] = [];

  for (const action of actions) {
    const key =
      action.kind === "model_login"
        ? `${action.kind}:${action.provider ?? ""}`
        : action.kind;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(action);
  }

  return deduped;
}
