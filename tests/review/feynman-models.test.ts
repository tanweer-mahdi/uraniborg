import { describe, expect, it } from "vitest";

import {
  getPinnedFeynmanAlphaStatus,
  getPinnedFeynmanDoctor,
  getPinnedFeynmanModelLoginCommand,
  getPinnedFeynmanSearchStatus,
  getPinnedFeynmanSetupCommand,
  getPinnedFeynmanVersion,
  listPinnedFeynmanModels,
  runPinnedFeynmanAlphaLogin,
  runPinnedFeynmanDoctor,
  runPinnedFeynmanModelLogin,
  runPinnedFeynmanSetup
} from "../../src/review/feynman-models.js";
import type {
  FeynmanCommandExecution,
  FeynmanCommandRunner
} from "../../src/review/feynman-bootstrap.js";

describe("pinned feynman status primitives", () => {
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
    const executablePath = "/tmp/vendor/feynman/bin/feynman";

    await getPinnedFeynmanVersion(executablePath, runner);
    await listPinnedFeynmanModels(executablePath, runner);
    await getPinnedFeynmanAlphaStatus(executablePath, runner);
    await getPinnedFeynmanSearchStatus(executablePath, runner);
    await runPinnedFeynmanSetup(executablePath, runner);
    await runPinnedFeynmanModelLogin(executablePath, "openai", runner);
    await runPinnedFeynmanAlphaLogin(executablePath, runner);
    await runPinnedFeynmanDoctor(executablePath, runner);

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
    expect(getPinnedFeynmanSetupCommand()).toEqual(["setup"]);
    expect(getPinnedFeynmanModelLoginCommand("anthropic")).toEqual([
      "model",
      "login",
      "anthropic"
    ]);
    expect(getPinnedFeynmanDoctor()).toEqual(["doctor"]);
  });
});
