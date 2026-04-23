import type { Command } from "commander";

import { createNotImplementedError } from "./shared.js";

export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("Show review and refinement model availability.")
    .action(() => {
      throw createNotImplementedError("models");
    });
}
