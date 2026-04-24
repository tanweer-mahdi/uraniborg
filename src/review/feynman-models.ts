import {
  runFeynmanCommand,
  type FeynmanCommandExecution,
  type FeynmanCommandRunner
} from "./feynman-bootstrap.js";

export async function getFeynmanVersion(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(executablePath, ["--version"], undefined, runner);
}

export async function listFeynmanModels(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(executablePath, ["model", "list"], undefined, runner);
}

export async function getFeynmanAlphaStatus(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(
    executablePath,
    ["alpha", "status"],
    undefined,
    runner
  );
}

export async function getFeynmanSearchStatus(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(
    executablePath,
    ["search", "status"],
    undefined,
    runner
  );
}

export async function runFeynmanSetup(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(
    executablePath,
    getFeynmanSetupCommand(),
    undefined,
    runner
  );
}

export async function runFeynmanModelLogin(
  executablePath: string,
  provider: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(
    executablePath,
    getFeynmanModelLoginCommand(provider),
    undefined,
    runner
  );
}

export async function runFeynmanAlphaLogin(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(executablePath, ["alpha", "login"], undefined, runner);
}

export async function runFeynmanDoctor(
  executablePath: string,
  runner?: FeynmanCommandRunner
): Promise<FeynmanCommandExecution> {
  return runFeynmanCommand(
    executablePath,
    getFeynmanDoctorCommand(),
    undefined,
    runner
  );
}

export function getFeynmanSetupCommand(): readonly string[] {
  return ["setup"];
}

export function getFeynmanModelLoginCommand(
  provider: string
): readonly string[] {
  return ["model", "login", provider];
}

export function getFeynmanDoctorCommand(): readonly string[] {
  return ["doctor"];
}
