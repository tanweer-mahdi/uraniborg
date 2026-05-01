import { resolvePathFromCwd } from "../config/index.js";
import type { TuiLaunchIntent } from "./types.js";

export interface InteractiveBootstrapInput {
  argv: readonly string[];
  cwd: string;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
}

export interface InteractiveBootstrapResult {
  launchIntent?: TuiLaunchIntent | undefined;
  sanitizedArgv: readonly string[];
}

export function resolveInteractiveBootstrap(
  input: InteractiveBootstrapInput
): InteractiveBootstrapResult {
  const originalArgs = input.argv.slice(2);
  const sanitizedArgv = stripNoUiFlag(input.argv);
  const args = sanitizedArgv.slice(2);

  if (!input.stdinIsTTY || !input.stdoutIsTTY) {
    return { sanitizedArgv };
  }

  if (includesAny(originalArgs, ["--help", "-h", "--version", "-V", "--no-ui"])) {
    return { sanitizedArgv };
  }

  if (args.includes("--non-interactive")) {
    return { sanitizedArgv };
  }

  const launchIntent = resolveTuiLaunchIntent(args, input.cwd);

  return {
    sanitizedArgv,
    ...(launchIntent === undefined ? {} : { launchIntent })
  };
}

function resolveTuiLaunchIntent(
  args: readonly string[],
  cwd: string
): TuiLaunchIntent | undefined {
  const [command, ...rest] = args;

  if (command === undefined) {
    return {
      route: {
        kind: "dashboard"
      }
    };
  }

  switch (command) {
    case "doctor":
      return {
        route: {
          kind: "doctor"
        }
      };
    case "models":
      return {
        route: {
          kind: "models"
        }
      };
    case "history":
      return {
        route: {
          kind: "history"
        }
      };
    case "init":
      return {
        route: {
          kind: "revision-setup"
        }
      };
    case "revision":
      if (rest.includes("--setup")) {
        return {
          route: {
            kind: "revision-setup"
          }
        };
      }

      if (rest.includes("--config")) {
        return {
          route: {
            kind: "revision-config"
          }
        };
      }

      return undefined;
    case "resume": {
      const runId = firstNonFlag(rest);

      if (runId === undefined) {
        return undefined;
      }

      return {
        route: {
          kind: "run-detail",
          runId,
          resumeRequested: true
        }
      };
    }
    case "run": {
      const sourceFile = firstNonFlag(rest);

      return {
        route: {
          kind: "run-setup",
          ...(sourceFile === undefined
            ? {}
            : {
                sourcePath: resolvePathFromCwd(sourceFile, cwd)
              })
        }
      };
    }
    default:
      return undefined;
  }
}

function stripNoUiFlag(argv: readonly string[]): readonly string[] {
  return argv.filter((argument) => argument !== "--no-ui");
}

function includesAny(
  values: readonly string[],
  candidates: readonly string[]
): boolean {
  return candidates.some((candidate) => values.includes(candidate));
}

function firstNonFlag(values: readonly string[]): string | undefined {
  return values.find((value) => !value.startsWith("-"));
}
