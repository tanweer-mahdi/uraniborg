import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("npm package metadata", () => {
  it("keeps the CLI package publishable and allowlist-based", async () => {
    const packageJson = await readJsonFile("package.json");

    expect(packageJson["private"]).toBeUndefined();
    expect(packageJson["bin"]).toEqual({
      uraniborg: "./dist/cli/main.js"
    });
    expect(packageJson["files"]).toEqual(["dist/**", "README.md", "LICENSE"]);
  });

  it("keeps runtime and development dependencies classified separately", async () => {
    const packageJson = await readJsonFile("package.json");
    const dependencies = readRecord(packageJson["dependencies"]);
    const devDependencies = readRecord(packageJson["devDependencies"]);

    expect(dependencies["@types/react"]).toBeUndefined();
    expect(dependencies["ink-testing-library"]).toBeUndefined();
    expect(devDependencies["@types/react"]).toBe("^19.2.14");
    expect(devDependencies["ink-testing-library"]).toBe("^4.0.0");
  });
});

describe("production build config", () => {
  it("uses an isolated runtime-only emit config", async () => {
    const buildConfig = await readJsonFile("tsconfig.build.json");

    expect(buildConfig["extends"]).toBe("./tsconfig.json");
    expect(buildConfig["compilerOptions"]).toEqual(
      expect.objectContaining({
        rootDir: "src",
        outDir: "dist",
        sourceMap: false
      })
    );
    expect(buildConfig["include"]).toEqual(["src/**/*.ts", "src/**/*.tsx"]);
    expect(buildConfig["exclude"]).toEqual(
      expect.arrayContaining(["tests", "vitest.config.ts", "openspec", "notes"])
    );
  });

  it("preserves source-oriented dev typecheck and test scripts", async () => {
    const packageJson = await readJsonFile("package.json");
    const scripts = readRecord(packageJson["scripts"]);

    expect(scripts["dev"]).toBe("tsx src/cli/main.ts");
    expect(scripts["typecheck"]).toBe("tsc --noEmit --project tsconfig.json");
    expect(scripts["test"]).toBe("vitest run");
    expect(scripts["build"]).toBe("tsc --project tsconfig.build.json");
  });
});

describe("package contents", () => {
  it("passes the tarball allowlist validator", () => {
    const buildResult = spawnSync("npm", ["run", "build"], {
      encoding: "utf8"
    });
    const result = spawnSync("node", ["scripts/validate-package.mjs"], {
      encoding: "utf8"
    });

    expect(buildResult.status).toBe(0);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Package dry-run allowlist is valid");
  }, 15000);
});

async function readJsonFile(filePath: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

  if (!isRecord(parsed)) {
    throw new Error(`Expected ${filePath} to contain a JSON object.`);
  }

  return parsed;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected object value.");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return true;
}
