## 1. Spec And Contract Lockdown

- [x] 1.1 Tighten the npm packaging/distribution capability spec and delta specs to reflect the locked decisions: npm-first CLI-only distribution, no standalone distribution contract, explicit Node and external Feynman prerequisites, clean production build layout, minimal publish surface, and supported platform matrix.
- [x] 1.2 Encode the capability-first compatibility contract explicitly: compatibility probe surface comes from Uraniborg's `doctor` Feynman command integrations, out-of-range but probe-valid runtimes warn and continue, and readiness content remains separate from compatibility.

## 2. Production Build Layout

- [x] 2.1 Add an isolated production build configuration, such as `tsconfig.build.json`, that extends the broad dev/typecheck config but overrides production-only emit settings so runtime source under `src/` emits to a clean `dist/` tree with `dist/cli/main.js` as the canonical CLI entrypoint. Keep local development, typechecking, and tests source-oriented: `npm run dev` must continue to execute `src/cli/main.ts`, `npm run typecheck` must continue to validate source plus tests with `--noEmit`, and test execution must not depend on the production `dist/` layout. Production emit must exclude tests, Vitest config, notes, OpenSpec artifacts, and other development-only files.
- [x] 2.2 Add publishable npm metadata and scripts: remove `private`, fix `bin`, add required package metadata, and add an allowlist so the tarball ships only `dist/**`, `package.json`, `README.md`, and `LICENSE`.
- [x] 2.3 Reclassify dependencies so runtime dependencies remain in `dependencies` and test/type-only tooling moves to `devDependencies`.

## 3. External Prerequisite Contract

- [x] 3.1 Centralize the Feynman compatibility probe surface used by `doctor`, `models`, and `run` preflight so compatibility is based on successful invocation and parseability of the existing doctor-side Feynman commands.
- [x] 3.2 Implement the compatibility status model explicitly: in-range + probe-valid -> ready, out-of-range + probe-valid -> warning and continue, probe failure -> action-required and block.
- [x] 3.3 Surface explicit prerequisite/install guidance when Feynman is missing or incompatible, and keep compatibility failures distinct from review-model, AlphaXiv, and web-search readiness failures.

## 4. Install Contract And Release Validation

- [x] 4.1 Update package-facing docs so the install contract is explicit: `npm install -g uraniborg`, then `uraniborg doctor`, with Node and external Feynman called out as prerequisites and non-bundling stated clearly.
- [x] 4.2 Add release-validation tasks for `typecheck`, `test`, `build`, `npm pack --dry-run`, tarball allowlist inspection, built-entrypoint smoke, installed-shim smoke, and non-interactive `doctor` / `models` smoke.
- [x] 4.3 Add regression tests for production build layout, npm metadata correctness, package contents allowlist, compatibility status classification, prerequisite failure messaging, and supported-platform assumptions where locally testable.
