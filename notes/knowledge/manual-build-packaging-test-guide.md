# Manual Build And Packaging Test Guide

This guide explains how to manually test Uraniborg's TypeScript build and npm packaging layer. It assumes you know Python packaging concepts such as virtual environments, wheels, entrypoints, lockfiles, and testing installed artifacts, but are new to JavaScript and TypeScript.

## Mental Model

For this repo, the rough Python-to-npm mapping is:

| Python concept | npm / TypeScript equivalent |
| --- | --- |
| `pyproject.toml` | `package.json` |
| `poetry.lock`, `uv.lock`, pinned requirements | `package-lock.json` |
| source tree, for example `src/package_name/` | `src/` |
| build backend creating a wheel | `tsc -p tsconfig.build.json` creating `dist/` |
| wheel contents | npm tarball from `npm pack` |
| console script entrypoint | `bin` field in `package.json` |
| install wheel into clean venv and run CLI | install packed `.tgz` into temp npm project and run `npx uraniborg` |

The critical packaging contract is:

- local development runs source with `npm run dev`
- typechecking checks source and tests with no JavaScript output
- tests run from source/test files
- production build emits runtime JavaScript under `dist/`
- npm package ships only `dist/**`, `package.json`, `README.md`, and `LICENSE`
- installed package exposes the `uraniborg` CLI command

## Files To Know

### `package.json`

This is the central npm package file. It defines:

- package metadata such as `name`, `version`, `license`, and `engines`
- CLI entrypoint under `bin`
- package contents allowlist under `files`
- commands under `scripts`
- runtime dependencies under `dependencies`
- development/test/build dependencies under `devDependencies`

The important CLI contract is:

```json
{
  "bin": {
    "uraniborg": "./dist/cli/main.js"
  }
}
```

That file must exist after production build.

### `tsconfig.json`

This is the broad TypeScript config used for development and typechecking. It includes source and tests. It is not the production packaging emit config.

### `tsconfig.build.json`

This is the isolated production build config. It extends `tsconfig.json`, but narrows emit to runtime source under `src/` and writes compiled output to `dist/`.

### `dist/`

This is generated build output. Treat it like a wheel build directory. It is not the source of truth.

### `scripts/validate-package.mjs`

This checks the npm tarball contents produced by `npm pack --dry-run --json`.

### `scripts/smoke-installed-shim.mjs`

This creates a package tarball, installs it into a temporary npm project, and runs the installed `uraniborg` CLI command.

## Recommended Full Manual Test

Run this from the repository root:

```bash
npm run release:check
```

Purpose:

- runs the complete local release gate for the build and packaging layer
- this is the closest equivalent to "build the wheel, inspect it, install it into a clean environment, and run the console script"

What it runs:

```text
npm run typecheck
npm run test
npm run build
npm run package:check
npm run smoke:built
npm run smoke:installed
npm run smoke:doctor
npm run smoke:models
```

Passing result:

- command exits with status `0`
- tests report all test files and tests passing
- package check says the dry-run allowlist is valid
- built CLI prints help
- installed shim smoke prints help
- `doctor` and `models` run non-interactively

Important:

- `smoke:doctor` and `smoke:models` use your actual local machine configuration and external Feynman installation.
- If Feynman is missing or not configured, those commands may report prerequisite or readiness failures. That is useful signal, but it means your local environment is not release-smoke-ready.

## Step-By-Step Manual Test

Use this sequence if you want to understand each layer separately.

### 1. Install Dependencies

```bash
npm install
```

Purpose:

- installs the dependency graph described by `package.json` and `package-lock.json`
- similar to preparing a Python dev environment from a lockfile

What it tests:

- npm can resolve and install the project dependencies
- `package-lock.json` is consistent with `package.json`

Passing result:

- command exits with status `0`
- `node_modules/` exists

Common failure meaning:

- dependency resolution failure means `package.json` and `package-lock.json` may be inconsistent
- native install failures usually mean local Node/npm/platform issues

### 2. Check Static Types

```bash
npm run typecheck
```

Purpose:

- runs TypeScript's compiler as a static checker
- no JavaScript files are emitted

What it tests:

- source and tests satisfy strict TypeScript contracts
- imports and exports line up
- optional values, indexed access, and config shapes are type-safe

Python analogy:

- closest to a strict `mypy` or `pyright` gate over both package code and tests

Passing result:

- command exits with status `0`
- no TypeScript errors are printed

### 3. Run Automated Tests

```bash
npm run test
```

Purpose:

- runs the Vitest test suite

What it tests:

- pure logic behavior
- CLI command behavior with fakes/mocks
- Ink TUI component behavior
- packaging metadata/build config/tarball regression checks
- Feynman compatibility classification behavior

Python analogy:

- Vitest is the runner, similar to `pytest`
- individual tests may be unit tests, integration-style tests, or component tests

Passing result:

- command exits with status `0`
- output reports all test files and tests passing

### 4. Clean Generated Output

```bash
npm run clean
```

Purpose:

- removes generated `dist/` and `coverage/`
- ensures the next build is not accidentally relying on stale files

What it tests:

- the cross-platform clean script works

Python analogy:

- similar to deleting `build/`, `dist/`, and generated coverage before rebuilding a wheel

Passing result:

- command exits with status `0`
- `dist/` is removed if it existed

### 5. Build Production Output

```bash
npm run build
```

Purpose:

- compiles TypeScript runtime source into production JavaScript under `dist/`
- uses `tsconfig.build.json`

What it tests:

- isolated production build config works
- runtime source emits without tests or OpenSpec/notes files
- package entrypoint exists at `dist/cli/main.js`

Passing result:

- command exits with status `0`
- `dist/cli/main.js` exists
- no `dist/src/` directory should be present
- no compiled tests should be present

Useful inspection commands:

```bash
test -f dist/cli/main.js
find dist -maxdepth 3 -type f | sort | sed -n '1,120p'
find dist -path '*/tests/*' -o -path 'dist/src/*'
```

Expected:

- first command exits `0`
- second command shows built runtime files under `dist/cli`, `dist/review`, `dist/tui`, etc.
- third command should print nothing

### 6. Run Built CLI Directly

```bash
npm run smoke:built
```

Equivalent direct command:

```bash
node dist/cli/main.js --help
```

Purpose:

- verifies the built production entrypoint starts

What it tests:

- `dist/cli/main.js` exists
- Node can execute it
- runtime imports resolve from built output
- CLI help renders

Python analogy:

- similar to running a console script module from a built wheel before publishing

Passing result:

- command exits with status `0`
- output contains `Usage: uraniborg`

### 7. Inspect NPM Tarball Contents

```bash
npm run package:check
```

Purpose:

- runs `npm pack --dry-run --json`
- checks the package file list against the allowlist

What it tests:

- package includes `dist/cli/main.js`
- package includes `README.md`, `LICENSE`, and `package.json`
- package excludes `src/`, `tests/`, `openspec/`, `notes/`, `scripts/`, TypeScript configs, lockfile, and source maps

Python analogy:

- similar to inspecting wheel contents to make sure tests, local docs, and dev scaffolding were not accidentally included

Passing result:

```text
Package dry-run allowlist is valid with <N> packed files.
```

If this fails:

- inspect the listed unexpected files
- check `package.json` `files`
- check that `npm run build` was run from a clean `dist/`

### 8. Create A Real Local NPM Tarball

```bash
npm pack
```

Purpose:

- creates the actual `.tgz` package artifact in the repo root

What it tests:

- npm can create the package tarball from current files
- this is the package artifact that would be installed or published

Passing result:

- command exits with status `0`
- a file like `uraniborg-0.1.0.tgz` appears

Clean up after inspection:

```bash
rm -f uraniborg-*.tgz
```

### 9. Test Installed Command Shim

```bash
npm run smoke:installed
```

Purpose:

- creates an npm tarball
- creates a temporary npm project
- installs the tarball into that project
- runs `npx uraniborg --help`

What it tests:

- npm package installs in a clean project
- `bin` entry creates a runnable command shim
- installed package has all runtime dependencies it needs
- users can invoke `uraniborg` through npm's command path

Python analogy:

- closest to creating a wheel, installing it into a fresh virtual environment, and running the installed console script

Passing result:

- command exits with status `0`
- output contains `Usage: uraniborg`
- output ends with `Installed npm shim smoke passed.`

### 10. Run Doctor Smoke

```bash
npm run smoke:doctor
```

Equivalent direct command:

```bash
node dist/cli/main.js --no-ui doctor
```

Purpose:

- runs the built CLI's environment check non-interactively

What it tests:

- built CLI can read/create Uraniborg app home
- external Feynman can be discovered on `PATH`
- Feynman compatibility probes can run
- revision runtime config can be inspected

Passing result:

- command exits with status `0`
- output contains `Filesystem`, `Review Runtime`, `Revision Runtime`, and `Summary`

Interpreting failures:

- `No compatible Feynman runtime was found on PATH` means install/expose Feynman
- compatibility probe failures mean Uraniborg can find Feynman but cannot rely on the command contracts it needs
- review-model, AlphaXiv, or web-search warnings are readiness/setup issues, not package build failures by themselves

### 11. Run Models Smoke

```bash
npm run smoke:models
```

Equivalent direct command:

```bash
node dist/cli/main.js --no-ui models
```

Purpose:

- verifies built CLI can inspect review and revision model availability

What it tests:

- external Feynman model discovery works
- compatibility-valid Feynman can still report model readiness separately
- revision runtime model listing works for the configured profile

Passing result:

- command exits with status `0`
- output includes `Review Runtime`
- if configured, output includes review model IDs and revision model IDs

## Testing A Global Install Manually

Use this only if you want to test the global CLI path directly.

### 1. Build And Pack

```bash
npm run build
npm pack
```

### 2. Install Globally From Local Tarball

```bash
npm install -g ./uraniborg-0.1.0.tgz
```

Purpose:

- tests the same global install shape users get from `npm install -g uraniborg`

### 3. Run Installed CLI

```bash
uraniborg --help
uraniborg doctor
uraniborg models
```

Purpose:

- verifies the globally installed command shim works outside the source checkout

### 4. Clean Up

```bash
npm uninstall -g uraniborg
rm -f uraniborg-*.tgz
```

## Quick Failure Triage

### `dist/cli/main.js` is missing

Likely issue:

- production build config is wrong
- `rootDir` or `outDir` is wrong
- `npm run build` was not run

Check:

```bash
npm run build
find dist -maxdepth 3 -type f | sort | sed -n '1,120p'
```

### Package contains `src/`, `tests/`, `notes/`, or `openspec/`

Likely issue:

- `package.json` `files` allowlist is too broad
- stale generated files exist under `dist/`

Check:

```bash
npm run clean
npm run build
npm run package:check
```

### Installed `uraniborg` command is missing

Likely issue:

- `package.json` `bin` is wrong
- built file does not exist at the `bin` path

Check:

```bash
node dist/cli/main.js --help
npm run smoke:installed
```

### `doctor` fails but `--help` works

Likely issue:

- package/build layer is probably okay
- local environment prerequisite is failing
- external Feynman may be missing, incompatible, or not configured

Check:

```bash
which feynman
feynman --version
node dist/cli/main.js --no-ui doctor
```

### Tests pass but package smoke fails

Likely issue:

- source tests are not enough to prove package installability
- package allowlist, built output, or `bin` shim is wrong

Check:

```bash
npm run build
npm run package:check
npm run smoke:installed
```

## Minimum Command Set

If you only have time for one command:

```bash
npm run release:check
```

If you want the shortest useful manual sequence:

```bash
npm install
npm run typecheck
npm run test
npm run build
npm run package:check
npm run smoke:installed
```

Add these when validating against the real local Feynman setup:

```bash
npm run smoke:doctor
npm run smoke:models
```
