import { spawn } from "node:child_process";

import type { FeynmanCommandRunner } from "./feynman-bootstrap.js";
import {
  getFeynmanModelLoginCommand,
  getFeynmanSetupCommand,
  runFeynmanAlphaLogin,
  runFeynmanModelLogin,
  runFeynmanSetup
} from "./feynman-models.js";

export type FeynmanRemediationKind =
  | "install_or_expose_runtime"
  | "setup"
  | "model_login"
  | "alpha_login";

export interface FeynmanRemediationAction {
  kind: FeynmanRemediationKind;
  reason: string;
  provider?: string | undefined;
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
  }
}
