import type { Command } from "commander";

import { createNotImplementedError } from "./shared.js";

export function registerHistoryCommand(program: Command): void {
  program
    .command("history")
    .description("List prior Uraniborg runs.")
    .action(() => {
      throw createNotImplementedError("history");
    });
}
