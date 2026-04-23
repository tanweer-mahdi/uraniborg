import type { Command } from "commander";

import { createNotImplementedError } from "./shared.js";

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .argument("<file>", "Markdown draft file to improve.")
    .description("Create and execute a new Uraniborg run.")
    .action(() => {
      throw createNotImplementedError("run");
    });
}
