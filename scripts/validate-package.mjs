#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const allowedFiles = new Set(["package.json", "README.md", "LICENSE"]);
const allowedPrefixes = ["dist/"];
const forbiddenPrefixes = [
  "dist/src/",
  "src/",
  "tests/",
  "openspec/",
  "notes/",
  "scripts/"
];
const forbiddenExact = new Set([
  "tsconfig.json",
  "tsconfig.build.json",
  "vitest.config.ts",
  "package-lock.json"
]);

const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const packEntries = JSON.parse(result.stdout);
const firstEntry = packEntries[0];

if (firstEntry === undefined || !Array.isArray(firstEntry.files)) {
  throw new Error("npm pack --dry-run did not return a file list.");
}

const filePaths = firstEntry.files.map((file) => file.path);
const unexpectedFiles = filePaths.filter((filePath) => {
  if (allowedFiles.has(filePath)) {
    return false;
  }

  return !allowedPrefixes.some((prefix) => filePath.startsWith(prefix));
});
const forbiddenFiles = filePaths.filter(
  (filePath) =>
    forbiddenExact.has(filePath) ||
    filePath.endsWith(".map") ||
    forbiddenPrefixes.some((prefix) => filePath.startsWith(prefix))
);

if (unexpectedFiles.length > 0 || forbiddenFiles.length > 0) {
  console.error("Package tarball contains unexpected files.");

  for (const filePath of [...unexpectedFiles, ...forbiddenFiles]) {
    console.error(`- ${filePath}`);
  }

  process.exit(1);
}

if (!filePaths.includes("dist/cli/main.js")) {
  console.error("Package tarball does not include dist/cli/main.js.");
  process.exit(1);
}

if (!filePaths.includes("dist/history-viewer/snapshot.js")) {
  console.error("Package tarball does not include dist/history-viewer/snapshot.js.");
  process.exit(1);
}

console.log(
  `Package dry-run allowlist is valid with ${filePaths.length} packed files.`
);
