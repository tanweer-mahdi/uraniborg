# TypeScript npm Build Configs

This note explains the standard files and scripts used to build a TypeScript npm package. It assumes you already understand Python distribution concepts such as `pyproject.toml`, lockfiles, source packages, wheels, test environments, and publish validation.

## Prerequisite Files And Directories

### `package.json`

`package.json` is closest to a mix of `pyproject.toml` metadata, dependency declarations, entrypoint declarations, and task scripts.

It usually defines:

- package identity: `name`, `version`, `description`, `license`, `repository`
- runtime entrypoints: `main`, `types`, `bin`, and sometimes `exports`
- dependency groups: `dependencies`, `devDependencies`, `peerDependencies`
- npm scripts: `build`, `typecheck`, `test`, `dev`, `prepack`, `pack:dry-run`
- package allowlist: `files`

For a CLI package, `bin` is the important distribution contract. It tells npm which built file should become the installed command shim.

```json
{
  "bin": {
    "uraniborg": "./dist/cli/main.js"
  }
}
```

That path must exist after the production build, not only during local development.

### `package-lock.json`

`package-lock.json`, when present, is the npm lockfile. It pins the exact resolved dependency tree for repeatable installs, similar in spirit to a committed `uv.lock`, `poetry.lock`, or fully resolved requirements lock.

Applications almost always commit it. Libraries and CLI packages often commit it too when they want reproducible development, CI, and release validation.

The lockfile is not a substitute for correct dependency classification. Runtime imports still belong in `dependencies`; test runners, TypeScript, linters, and build-only tooling usually belong in `devDependencies`.

### `tsconfig.json`

`tsconfig.json` is the TypeScript compiler configuration. In many projects it is optimized for local development and editor behavior, not necessarily for publishing.

It commonly enables strictness:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

For development, it may include `src/**/*.ts`, `tests/**/*.ts`, config files, and tooling scripts so the editor and typechecker see the whole workspace.

That is useful locally, but dangerous if the same config emits production artifacts: tests and internal tooling can accidentally be compiled into `dist/`.

### `tsconfig.build.json`

`tsconfig.build.json` is a production emit config. It should be narrower than the main `tsconfig.json`.

It usually:

- extends `tsconfig.json`
- includes only runtime source files
- excludes tests, fixtures, generated temp data, and local scripts
- sets the production output directory
- emits declaration files if the package exposes TypeScript types

Think of this as the difference between a Python development environment that can run tests and tooling versus the package build backend that decides what lands in the wheel.

### `src/` Entrypoint

`src/` contains the TypeScript source code that should compile into runtime JavaScript.

For a CLI package, a common shape is:

```text
src/
  cli/
    main.ts
  index.ts
```

The built CLI target might be:

```text
dist/
  cli/
    main.js
```

The source entrypoint and package entrypoint must line up through the build config. If `package.json` says `bin` is `./dist/cli/main.js`, the build must actually create `dist/cli/main.js`.

### `dist/`

`dist/` is the production build output. It is analogous to generated wheel contents or a build artifact directory, not source of truth.

For npm packages, `dist/` often contains:

- compiled `.js`
- type declarations `.d.ts`
- optionally source maps, if the package deliberately ships them

Tests, fixtures, TypeScript source, OpenSpec files, notes, and internal scripts should not appear in `dist/` unless there is an explicit package contract requiring them.

### `tests/`

`tests/` contains unit, integration, and package validation tests. Tests should typecheck and run during development and CI, but they should not be emitted into the production package build.

The usual pattern is:

- `tsconfig.json` includes tests for editor/typecheck coverage
- `tsconfig.build.json` excludes tests for production emit
- the test runner compiles or transpiles tests separately

### `README.md` And `LICENSE`

`README.md` and `LICENSE` are package-facing files. npm displays README content on the package page, and many users and scanners expect the license file to be present in the tarball.

For CLI packages, the README should document:

- install command
- prerequisites
- first command to run after install
- basic usage
- troubleshooting path

### npm Files Allowlist

The `files` field in `package.json` is the npm package allowlist. It defines what should be included when `npm pack` creates the tarball.

A minimal CLI package often uses:

```json
{
  "files": [
    "dist/**",
    "README.md",
    "LICENSE"
  ]
}
```

`package.json` is always included by npm, so it does not need to be listed.

Use an allowlist rather than relying only on `.npmignore`. It is safer because new repo files are excluded by default unless intentionally added.

## Different Purposes

### Local Dev Execution

Local dev execution optimizes for fast feedback. It may run TypeScript directly with a loader or dev runner instead of building first.

Example script shapes:

```json
{
  "scripts": {
    "dev": "tsx src/cli/main.ts"
  }
}
```

This is convenient, but it does not prove the npm package works. It bypasses the built `dist/` entrypoint and npm command shim.

### Typechecking

Typechecking proves the TypeScript program is valid. It does not need to emit JavaScript.

Example:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

This should usually cover both runtime code and tests. It is the broad static safety gate.

### Tests

Tests prove behavior. They should run against public contracts and boundary behavior, not private implementation details.

Example:

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Tests may execute TypeScript directly through the test runner. That is fine for behavior validation, but it still does not replace a production build or package smoke test.

### Production Emit

Production emit creates the JavaScript and declaration files that users will receive.

Example:

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json"
  }
}
```

This should be narrow and deterministic. It should produce exactly the runtime tree expected by `package.json`.

### Package Validation

Package validation proves the installable npm artifact is correct, not just the source tree.

Useful checks include:

- `npm pack --dry-run`
- inspect the tarball file list
- verify the `bin` target exists
- run the built CLI directly with `node dist/cli/main.js`
- install the packed tarball into a temp project and run the installed command

This is similar to testing a built wheel in a clean virtual environment instead of only running tests from the source checkout.

## Why Production Build Config Isolation Matters

A single TypeScript config often has conflicting jobs:

- editors need to see source, tests, configs, and scripts
- test runners need test files and fixtures
- production packages need only runtime files
- npm needs stable built entrypoints matching `package.json`

If one config tries to do all of this, packages commonly ship accidental artifacts:

- compiled tests under `dist/tests`
- fixture data or local scripts
- source files not meant for users
- CLI entrypoints nested under the wrong path, such as `dist/src/cli/main.js`
- missing `.d.ts` files for exported APIs

Production build isolation makes the package contract mechanical. The build config says what can be emitted; the npm allowlist says what can be packed; package validation proves the result.

## Small Practical Example

Development config:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Production build config:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "sourceMap": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests/**", "**/*.test.ts", "**/*.spec.ts"]
}
```

Package scripts and allowlist:

```json
{
  "bin": {
    "uraniborg": "./dist/cli/main.js"
  },
  "files": [
    "dist/**",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "dev": "tsx src/cli/main.ts",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "build": "tsc -p tsconfig.build.json",
    "pack:dry-run": "npm pack --dry-run"
  }
}
```

Expected package layout after `npm run build`:

```text
dist/
  cli/
    main.js
    main.d.ts
  index.js
  index.d.ts
```

The important invariant is simple: the published package should contain the built runtime contract, not the development workspace.

## Practical Checklist

Before publishing or treating a package as installable:

- `package.json` points `bin`, `main`, `types`, or `exports` at files produced by the build.
- Runtime imports are listed in `dependencies`.
- TypeScript, test runners, linters, and local tooling are listed in `devDependencies`.
- `tsconfig.json` supports local typechecking.
- `tsconfig.build.json` emits only production runtime files.
- `dist/` contains the expected entrypoints and declarations.
- `files` allowlists only package-facing artifacts.
- `npm pack --dry-run` shows no tests, notes, OpenSpec files, local scripts, or source-only planning artifacts.
- A clean install smoke test can run the packaged CLI or library entrypoint.

