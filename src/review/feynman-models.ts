import {
  runPinnedFeynmanCommand,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner
} from "./feynman-bootstrap.js";

export async function getPinnedFeynmanVersion(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(executablePath, ["--version"], undefined, runner);
}

export async function listPinnedFeynmanModels(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    ["model", "list"],
    undefined,
    runner
  );
}

export async function getPinnedFeynmanAlphaStatus(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    ["alpha", "status"],
    undefined,
    runner
  );
}

export async function getPinnedFeynmanSearchStatus(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    ["search", "status"],
    undefined,
    runner
  );
}

export async function runPinnedFeynmanSetup(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    getPinnedFeynmanSetupCommand(),
    undefined,
    runner
  );
}

export async function runPinnedFeynmanModelLogin(
  executablePath: string,
  provider: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    getPinnedFeynmanModelLoginCommand(provider),
    undefined,
    runner
  );
}

export async function runPinnedFeynmanAlphaLogin(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    ["alpha", "login"],
    undefined,
    runner
  );
}

export async function runPinnedFeynmanDoctor(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runPinnedFeynmanCommand(
    executablePath,
    getPinnedFeynmanDoctor(),
    undefined,
    runner
  );
}

export function getPinnedFeynmanSetupCommand(): readonly string[] {
  return ["setup"];
}

export function getPinnedFeynmanModelLoginCommand(
  provider: string
): readonly string[] {
  return ["model", "login", provider];
}

export function getPinnedFeynmanDoctor(): readonly string[] {
  return ["doctor"];
}
