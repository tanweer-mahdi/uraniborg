#!/usr/bin/env node

import { launchInteractiveApp } from "../tui/entry.js";
import { resolveInteractiveBootstrap } from "../tui/intent.js";
import { runCli } from "./program.js";

const bootstrapResult = resolveInteractiveBootstrap({
  argv: process.argv,
  cwd: process.cwd(),
  stdinIsTTY: Boolean(process.stdin.isTTY),
  stdoutIsTTY: Boolean(process.stdout.isTTY)
});

if (bootstrapResult.launchIntent !== undefined) {
  await launchInteractiveApp(bootstrapResult.launchIntent);
} else {
  await runCli(bootstrapResult.sanitizedArgv);
}
