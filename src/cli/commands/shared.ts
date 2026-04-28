import {
  cancel,
  confirm,
  isCancel,
  select,
  text
} from "@clack/prompts";

import {
  createSearchConfigurationRemediationAction,
  describeFeynmanRemediationAction,
  launchFeynmanRemediationAction,
  type FeynmanInteractiveLauncher,
  type FeynmanRemediationAction,
  type FeynmanSearchProvider
} from "../../review/index.js";
import { createOperationCancelledError } from "../../types/cancellation.js";
import { writeInfo } from "../../ui/output.js";

export interface RemediationPrompts {
  confirm: typeof confirm;
  cancel: typeof cancel;
  isCancel: typeof isCancel;
  select?: typeof select;
  text?: typeof text;
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
  executablePath?: string | undefined;
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
    isCancel,
    select,
    text
  };
  const writeLine = options.dependencies.writeLine ?? writeInfo;

  for (const action of actions) {
    if (options.executablePath === undefined) {
      writeLine(
        `${action.reason} Run \`${describeFeynmanRemediationAction(action)}\` from a compatible Feynman installation once it is available on PATH.`
      );
      continue;
    }

    const response = await prompts.confirm({
      message: `${action.reason} ${buildRemediationPromptQuestion(action)}`,
      initialValue: action.promptInitialValue ?? true
    });

    if (prompts.isCancel(response)) {
      prompts.cancel("Skipped Feynman remediation.");
      return;
    }

    if (response !== true) {
      continue;
    }

    const resolvedAction = await resolveRemediationAction(action, prompts);
    const actionLabel = describeRemediationOutcomeLabel(resolvedAction);

    writeLine(
      `Launching ${actionLabel} via the selected Feynman runtime...`
    );

    const launchResult = await launchFeynmanRemediationAction(
      options.executablePath,
      resolvedAction,
      options.dependencies.launcher
    );

    if (launchResult.exitCode === 0) {
      writeLine(`${actionLabel} completed successfully.`);
      continue;
    }

    writeLine(
      `${actionLabel} did not complete successfully. Review the Feynman prompt and rerun the command if more setup is still required.`
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
        : action.kind === "search_configure"
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

async function resolveRemediationAction(
  action: FeynmanRemediationAction,
  prompts: RemediationPrompts
): Promise<FeynmanRemediationAction> {
  if (action.kind !== "search_configure" || typeof action.provider === "string") {
    return action;
  }

  const selectPrompt = prompts.select ?? select;
  const textPrompt = prompts.text ?? text;

  const providerResponse = await selectPrompt({
    message: "Which web-search provider should Feynman configure?",
    options: [
      {
        value: "auto",
        label: "auto",
        hint: "Use Feynman's automatic provider selection."
      },
      {
        value: "perplexity",
        label: "perplexity",
        hint: "Configure the Perplexity web-search provider."
      },
      {
        value: "exa",
        label: "exa",
        hint: "Configure the Exa web-search provider."
      },
      {
        value: "gemini",
        label: "gemini",
        hint: "Configure the Gemini web-search provider."
      }
    ],
    initialValue: "auto"
  });

  if (prompts.isCancel(providerResponse)) {
    prompts.cancel("Skipped Feynman remediation.");
    throw new Error("Feynman remediation cancelled.");
  }

  if (!isFeynmanSearchProvider(providerResponse)) {
    throw new Error("Selected web-search provider is not supported.");
  }

  const provider = providerResponse;

  if (provider === "auto") {
    return createSearchConfigurationRemediationAction(action.reason, {
      provider,
      promptInitialValue: action.promptInitialValue
    });
  }

  const apiKeyResponse = await textPrompt({
    message: `API key for ${provider} (optional if Feynman already has one configured)`,
    defaultValue: "",
    validate() {
      return undefined;
    }
  });

  if (prompts.isCancel(apiKeyResponse)) {
    prompts.cancel("Skipped Feynman remediation.");
    throw new Error("Feynman remediation cancelled.");
  }

  const apiKey = apiKeyResponse.trim();

  return createSearchConfigurationRemediationAction(action.reason, {
    provider,
    ...(apiKey.length > 0 ? { apiKey } : {}),
    promptInitialValue: action.promptInitialValue
  });
}

function isFeynmanSearchProvider(
  value: unknown
): value is FeynmanSearchProvider {
  return (
    value === "auto" ||
    value === "perplexity" ||
    value === "exa" ||
    value === "gemini"
  );
}

function buildRemediationPromptQuestion(
  action: FeynmanRemediationAction
): string {
  switch (action.kind) {
    case "install_or_expose_runtime":
      return "Run Feynman setup now once a compatible runtime is available?";
    case "setup":
      return "Launch Feynman setup now?";
    case "model_login":
      return `Launch Feynman model login${typeof action.provider === "string" ? ` for "${action.provider}"` : ""} now?`;
    case "alpha_login":
      return "Launch Feynman AlphaXiv login now?";
    case "search_configure":
      return "Configure Feynman web-search providers now?";
  }
}

function describeRemediationOutcomeLabel(
  action: FeynmanRemediationAction
): string {
  switch (action.kind) {
    case "install_or_expose_runtime":
    case "setup":
      return "Feynman setup";
    case "model_login":
      return typeof action.provider === "string"
        ? `Feynman model login for "${action.provider}"`
        : "Feynman model login";
    case "alpha_login":
      return "Feynman AlphaXiv login";
    case "search_configure":
      return typeof action.provider === "string"
        ? `Feynman web-search provider configuration for "${action.provider}"`
        : "Feynman web-search provider configuration";
  }
}
