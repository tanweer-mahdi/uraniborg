import { spawn } from "node:child_process";

import type { FeynmanCommandRunner } from "./feynman-bootstrap.js";
import {
  getFeynmanSearchSetCommand,
  getFeynmanModelLoginCommand,
  getFeynmanSetupCommand,
  runFeynmanAlphaLogin,
  runFeynmanModelLogin,
  runFeynmanSearchSet,
  runFeynmanSetup
} from "./feynman-models.js";
import type { FeynmanSearchProvider } from "./feynman-models.js";

export type FeynmanRemediationKind =
  | "install_or_expose_runtime"
  | "setup"
  | "model_login"
  | "alpha_login"
  | "search_configure";

export interface FeynmanRemediationAction {
  kind: FeynmanRemediationKind;
  reason: string;
  provider?: string | undefined;
  apiKey?: string | undefined;
  promptInitialValue?: boolean | undefined;
}

export interface FeynmanInteractiveLauncher {
  launch: (
    executablePath: string,
    args: readonly string[]
  ) => Promise<{ exitCode: number }>;
}

export function createRuntimeInstallRemediationAction(
  reason: string
): FeynmanRemediationAction {
  return {
    kind: "install_or_expose_runtime",
    reason
  };
}

export function createSetupRemediationAction(
  reason: string
): FeynmanRemediationAction {
  return {
    kind: "setup",
    reason
  };
}

export function createModelLoginRemediationAction(
  provider: string,
  reason: string
): FeynmanRemediationAction {
  return {
    kind: "model_login",
    provider,
    reason
  };
}

export function createAlphaLoginRemediationAction(
  reason: string
): FeynmanRemediationAction {
  return {
    kind: "alpha_login",
    reason
  };
}

export function createSearchConfigurationRemediationAction(
  reason: string,
  options: {
    provider?: FeynmanSearchProvider | undefined;
    apiKey?: string | undefined;
    promptInitialValue?: boolean | undefined;
  } = {}
): FeynmanRemediationAction {
  return {
    kind: "search_configure",
    reason,
    ...(typeof options.provider === "string"
      ? { provider: options.provider }
      : {}),
    ...(typeof options.apiKey === "string" ? { apiKey: options.apiKey } : {}),
    ...(typeof options.promptInitialValue === "boolean"
      ? { promptInitialValue: options.promptInitialValue }
      : {})
  };
}

export function getFeynmanRemediationCommand(
  action: FeynmanRemediationAction
): readonly string[] {
  switch (action.kind) {
    case "install_or_expose_runtime":
    case "setup":
      return getFeynmanSetupCommand();
    case "model_login":
      return getFeynmanModelLoginCommand(action.provider ?? "");
    case "alpha_login":
      return ["alpha", "login"];
    case "search_configure":
      return isFeynmanSearchProvider(action.provider)
        ? getFeynmanSearchSetCommand(action.provider, action.apiKey)
        : ["search", "set", "<provider>", "[api-key]"];
  }
}

export function describeFeynmanRemediationAction(
  action: FeynmanRemediationAction
): string {
  return `feynman ${getFeynmanRemediationCommand(action).join(" ")}`;
}

export function createNodeFeynmanInteractiveLauncher(): FeynmanInteractiveLauncher {
  return {
    async launch(
      executablePath: string,
      args: readonly string[]
    ): Promise<{ exitCode: number }> {
      return new Promise((resolve, reject) => {
        const child = spawn(executablePath, args, {
          stdio: "inherit"
        });

        child.on("error", reject);
        child.on("close", (exitCode) => {
          resolve({
            exitCode: exitCode ?? -1
          });
        });
      });
    }
  };
}

export async function launchFeynmanRemediationAction(
  executablePath: string,
  action: FeynmanRemediationAction,
  launcher: FeynmanInteractiveLauncher = createNodeFeynmanInteractiveLauncher()
): Promise<{ exitCode: number }> {
  if (action.kind === "search_configure" && !isFeynmanSearchProvider(action.provider)) {
    throw new Error(
      "Web-search remediation requires a provider before launch."
    );
  }

  return launcher.launch(executablePath, getFeynmanRemediationCommand(action));
}

export async function runCapturedFeynmanRemediationAction(
  executablePath: string,
  action: FeynmanRemediationAction,
  runner: FeynmanCommandRunner
) {
  switch (action.kind) {
    case "install_or_expose_runtime":
    case "setup":
      return runFeynmanSetup(executablePath, runner);
    case "model_login":
      return runFeynmanModelLogin(executablePath, action.provider ?? "", runner);
    case "alpha_login":
      return runFeynmanAlphaLogin(executablePath, runner);
    case "search_configure":
      if (!isFeynmanSearchProvider(action.provider)) {
        throw new Error(
          "Web-search remediation requires a provider before execution."
        );
      }

      return runFeynmanSearchSet(
        executablePath,
        action.provider,
        action.apiKey,
        runner
      );
  }
}

function isFeynmanSearchProvider(
  value: string | undefined
): value is FeynmanSearchProvider {
  return (
    value === "auto" ||
    value === "perplexity" ||
    value === "exa" ||
    value === "gemini"
  );
}
