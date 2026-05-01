import { Command } from "commander";

import { registerDoctorCommand } from "./commands/doctor.js";
import { registerHistoryCommand } from "./commands/history.js";
import { registerInitCommand } from "./commands/init.js";
import { registerModelsCommand } from "./commands/models.js";
import { registerRevisionCommand } from "./commands/revision.js";
import { registerResumeCommand } from "./commands/resume.js";
import { registerRunCommand } from "./commands/run.js";
import { writeError } from "../ui/output.js";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("uraniborg")
    .description("Run deterministic draft review and revision loops. Interactive TTY sessions launch the Ink UI by default.")
    .showHelpAfterError()
    .showSuggestionAfterError();

  program.addHelpText(
    "after",
    `
Interactive UI:
  uraniborg launches the Ink UI by default in interactive TTY sessions.
  Use --no-ui to bypass Ink and keep the plain command execution path for
  automation, scripting, pipes, or parallel experiment runs.
`
  );

  registerInitCommand(program);
  registerRevisionCommand(program);
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
