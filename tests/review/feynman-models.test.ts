import { describe, expect, it } from "vitest";

import {
  getFeynmanAlphaStatus,
  getFeynmanDoctorCommand,
  getFeynmanModelLoginCommand,
  getFeynmanSearchStatus,
  getFeynmanSetupCommand,
  getFeynmanVersion,
  listFeynmanModels,
  runFeynmanAlphaLogin,
  runFeynmanDoctor,
  runFeynmanModelLogin,
  runFeynmanSetup
} from "../../src/review/feynman-models.js";
import type {
  FeynmanCommandExecution,
  FeynmanCommandRunner
} from "../../src/review/feynman-bootstrap.js";

describe("feynman status primitives", () => {
  it("invoke the exact executable path with the expected arguments", async () => {
    const calls: Array<{ executablePath: string; args: readonly string[] }> = [];
    const runner: FeynmanCommandRunner = {
      async run(
        executablePath: string,
        args: readonly string[]
      ): Promise<FeynmanCommandExecution> {
        calls.push({
          executablePath,
          args
        });

        return {
          executablePath,
          args,
          exitCode: 0,
          stdout: "",
          stderr: ""
        };
      }
    };
    const executablePath = "/usr/local/bin/feynman";

    await getFeynmanVersion(executablePath, runner);
    await listFeynmanModels(executablePath, runner);
    await getFeynmanAlphaStatus(executablePath, runner);
    await getFeynmanSearchStatus(executablePath, runner);
    await runFeynmanSetup(executablePath, runner);
    await runFeynmanModelLogin(executablePath, "openai", runner);
    await runFeynmanAlphaLogin(executablePath, runner);
    await runFeynmanDoctor(executablePath, runner);

    expect(calls).toEqual([
      {
        executablePath,
        args: ["--version"]
      },
      {
        executablePath,
        args: ["model", "list"]
      },
      {
        executablePath,
        args: ["alpha", "status"]
      },
      {
        executablePath,
        args: ["search", "status"]
      },
      {
        executablePath,
        args: ["setup"]
      },
      {
        executablePath,
        args: ["model", "login", "openai"]
      },
      {
        executablePath,
        args: ["alpha", "login"]
      },
      {
        executablePath,
        args: ["doctor"]
      }
    ]);
  });

  it("exposes stable remediation command builders", () => {
    expect(getFeynmanSetupCommand()).toEqual(["setup"]);
    expect(getFeynmanModelLoginCommand("anthropic")).toEqual([
      "model",
      "login",
      "anthropic"
    ]);
    expect(getFeynmanDoctorCommand()).toEqual(["doctor"]);
  });
});
