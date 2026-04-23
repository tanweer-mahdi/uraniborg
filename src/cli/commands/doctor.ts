import type { Command } from "commander";

import { createNotImplementedError } from "./shared.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Validate Uraniborg environment readiness.")
    .action(() => {
      throw createNotImplementedError("doctor");
    });
}
