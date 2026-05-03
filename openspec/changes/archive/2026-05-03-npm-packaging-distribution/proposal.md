## Why

Uraniborg needs a clear npm distribution contract so the CLI can be installed and released predictably without implying that Feynman is bundled or owned by the package. The current behavior is mostly runtime-oriented; this change locks the packaging boundary, the external prerequisite contract, and the release surface before implementation drifts.

## What Changes

- Publish Uraniborg as an npm-first distribution.
- Keep the package CLI-only and do not introduce any standalone distribution contract in this change.
- Define a clean production build layout with a minimal runtime package.
- Treat Feynman as an explicit external prerequisite and fail with clear guidance when it is missing or incompatible.
- Require capability-first Feynman compatibility checks instead of assuming a bundled or pinned runtime, and allow out-of-range versions to proceed with warning when required command contracts still validate successfully.
- Define a clean publish surface that excludes tests, notes, OpenSpec artifacts, and other internal workflow files from the npm tarball.
- Keep release publication manually gated and validate the package against the supported platform matrix: macOS arm64/x64, Linux x64, and Windows x64.
- Make the install contract explicit: `npm install -g uraniborg`, then `uraniborg doctor`, with Node and Feynman called out as prerequisites.

## Locked Decision Summary

- Feynman stays external to Uraniborg.
- npm is the first distribution channel.
- Uraniborg remains CLI-only.
- Node.js is an explicit prerequisite.
- Production build output must be clean and runtime-oriented.
- Published package contents must be minimal.
- Releases stay manually gated in this phase.
- Support is limited to macOS arm64/x64, Linux x64, and Windows x64.
- Feynman compatibility is capability-first.
- Install docs must be explicit about prerequisites and begin with `npm install -g uraniborg`, then `uraniborg doctor`.

## Capabilities

### New Capabilities
- `npm-packaging-distribution`: npm packaging, build layout, install contract, and release policy for Uraniborg's CLI distribution.

### Modified Capabilities
- `environment-setup`: replace bundled/pinned Feynman assumptions with an external prerequisite and explicit install/compatibility guidance.
- `iterative-draft-run`: make run preflight fail clearly when the external Feynman prerequisite is missing or incompatible.
- `model-selection`: make review-model discovery and remediation work against the external Feynman prerequisite rather than a bundled runtime.

## Impact

- Affected code: packaging metadata, build scripts, CLI entrypoints, environment checks, model discovery, run preflight, and prerequisite/install documentation.
- Affected systems: npm publication workflow, external Feynman prerequisite handling, supported-platform validation, and operator-facing support/debug flows.
