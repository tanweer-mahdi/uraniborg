import { Command } from "commander";

import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerInitCommand } from "./commands/init.js";
import { registerModelsCommand } from "./commands/models.js";
import { registerResumeCommand } from "./commands/resume.js";
import { registerRunCommand } from "./commands/run.js";
import { writeError } from "../ui/output.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("uraniborg")
    .description("Run deterministic draft review and refinement loops.")
    .showHelpAfterError()
    .showSuggestionAfterError();

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerModelsCommand(program);
  registerRunCommand(program);
  registerResumeCommand(program);
  registerHistoryCommand(program);

  return program;
}

export async function runCli(argv: readonly string[]): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Uraniborg CLI failure.";
    writeError(message);
    process.exitCode = 1;
  }
}
