#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const temporaryDirectory = mkdtempSync(
  path.join(tmpdir(), "uraniborg-pack-smoke-")
);

try {
  run("npm", ["pack", "--pack-destination", temporaryDirectory]);

  const tarballName = readdirSync(temporaryDirectory).find((fileName) =>
    fileName.endsWith(".tgz")
  );

  if (tarballName === undefined) {
    throw new Error("npm pack did not produce a tarball.");
  }

  const tarball = path.join(temporaryDirectory, tarballName);
  const projectDirectory = path.join(temporaryDirectory, "project");

  mkdirSync(projectDirectory);
  run("npm", ["init", "-y"], { cwd: projectDirectory });
  run("npm", ["install", tarball], { cwd: projectDirectory });
  run("npx", ["uraniborg", "--help"], { cwd: projectDirectory });

  console.log("Installed npm shim smoke passed.");
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
