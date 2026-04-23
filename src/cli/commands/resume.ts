import type { Command } from "commander";

import { createNotImplementedError } from "./shared.js";

export function registerResumeCommand(program: Command): void {
  program
    .command("resume")
    .argument("<run-id>", "Run identifier to resume.")
    .description("Resume an interrupted Uraniborg run.")
    .action(() => {
      throw createNotImplementedError("resume");
    });
}
