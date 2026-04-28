import type { Command } from "commander";

import {
  runGuidedRevisionSetup,
  type RevisionSetupDependencies
} from "./revision-setup.js";

export type InitCommandDependencies = RevisionSetupDependencies;

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Configure Uraniborg-owned revision defaults.")
    .action(async () => {
      await runInitCommand();
    });
}

export async function runInitCommand(
  dependencies: InitCommandDependencies = {}
): Promise<void> {
  await runGuidedRevisionSetup(dependencies);
}
