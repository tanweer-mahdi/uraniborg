## Context

Uraniborg is moving to an npm-first distribution model, but its review-side dependency remains Feynman and Feynman is not part of this package's ownership boundary. The packaging contract therefore needs to do three things at once: keep the CLI distribution minimal, make the Feynman prerequisite explicit, and preserve a deterministic production layout that can be released manually across the supported platform matrix.

The current canonical specs still reflect runtime-centric assumptions about how review-side readiness is obtained. This change narrows the distribution contract without changing Uraniborg into a standalone service or introducing a second product surface.

## Goals / Non-Goals

**Goals:**
- Ship Uraniborg as an npm-distributed CLI package.
- Keep the runtime package minimal and production-oriented.
- Make Feynman an explicit external prerequisite with capability-first compatibility checks.
- Define a clean build/release layout that is deterministic and supportable.
- Gate release manually and target only macOS arm64/x64, Linux x64, and Windows x64.
- Make the install contract explicit around `npm install -g uraniborg` followed by `uraniborg doctor`.

**Non-Goals:**
- Introducing a standalone Uraniborg service, daemon, or browser UI.
- Bundling or provisioning Feynman inside Uraniborg's npm package.
- Redesigning run semantics, review semantics, or revision semantics beyond the prerequisite/inspection contract.
- Automating public release publication without a manual approval gate.

## Decisions

### 1. Npm is the distribution boundary and the package is CLI-only

Uraniborg will be distributed as an npm package whose supported user-facing surface is the CLI. The package should not imply a standalone runtime contract beyond launching the command-line application and checking prerequisites.

Alternatives considered:

- Publish a package that also exposes a separate application or service contract.
  Rejected because it expands the product surface beyond the locked decisions and complicates release/support.
- Keep distribution implicit and rely on source checkout only.
  Rejected because it leaves packaging, release, and install behavior undefined.

### 2. Build output must be clean and production-oriented

The published artifact should contain only what the CLI needs at runtime: compiled output, package metadata, and the minimal runtime assets required by the executable path. Development sources, tests, specs, and build-time scaffolding should stay out of the runtime package.

For this change, the production build contract is concrete:

- use a dedicated production TypeScript build configuration, such as `tsconfig.build.json`, rather than narrowing the broad dev/typecheck config
- emit a clean runtime tree under `dist/`
- use `dist/cli/main.js` as the canonical built CLI entrypoint
- exclude tests from production emit entirely
- prefer excluding source maps from the published tarball

The production build configuration must be isolated from local development and verification workflows. Local development should remain source-oriented, typechecking should continue to validate source and tests with no emit, and tests should continue to run against the source/test graph rather than the production `dist/` layout. Packaging must therefore be solved by adding a production emit path, not by making the main project configuration too narrow for dev tooling or tests.

The published tarball should be allowlist-based and should ship only:

- `dist/**`
- `package.json`
- `README.md`
- `LICENSE`

Emitted `.d.ts` files may remain inside `dist/`, but they do not imply a supported importable API.

Alternatives considered:

- Ship a broad source tree and let npm ignore files do the filtering.
  Rejected because it makes runtime contents harder to reason about and easier to bloat.
- Ship a full repo snapshot in the package tarball.
  Rejected because it violates the minimal-runtime goal and increases support noise.

### 3. Feynman is an explicit external prerequisite

Uraniborg should validate a compatible Feynman installation at runtime and during preflight rather than provisioning a bundled Feynman runtime. The compatibility check must be capability-first: the package cares whether the Feynman command contracts Uraniborg already invokes can be executed and parsed reliably, not whether a particular internal install path exists.

Compatibility validation must not happen during `npm install`. It happens:

- at runtime prerequisite checks such as `doctor`, `models`, and `run` preflight
- during maintainer-side release validation

Compatibility validation is distinct from review readiness. A compatible Feynman installation may still have incomplete review-model, AlphaXiv, or web-search readiness. In those cases Uraniborg must surface readiness issues rather than misclassifying the installation as incompatible.

The canonical compatibility probe surface for this change is the Feynman command surface Uraniborg already invokes through `doctor`:

- runtime discovery and version introspection
- review model discovery command contract
- AlphaXiv status command contract
- web-search status command contract

The compatibility question is only:

- can Uraniborg invoke those commands successfully when expected
- can Uraniborg parse the outputs and failure shapes it depends on

The compatibility question is not:

- whether review models are configured
- whether AlphaXiv is ready
- whether web search is ready

Version range remains confidence metadata, not the sole runtime gate:

- in-range + compatibility probes pass -> `ready`
- out-of-range + compatibility probes pass -> `warning`, allow execution
- compatibility probe failure -> `action-required`, block execution

Alternatives considered:

- Continue to embed or provision Feynman inside Uraniborg.
  Rejected because the locked decision is to treat Feynman as external.
- Keep only a version check on an assumed path.
  Rejected because capability-first compatibility is the clearer contract and avoids path-centric coupling.

### 4. Release is manually gated and platform-matrix limited

Release publication should require a manual gate and validate the npm package against macOS arm64/x64, Linux x64, and Windows x64 only. This keeps the release surface aligned with the intended support matrix and avoids accidental broadening.

Alternatives considered:

- Fully automate publication for every build.
  Rejected because the locked decision requires manual gating.
- Support a wider matrix by default.
  Rejected because it increases build and validation cost without a product requirement for additional targets.

### 5. Install contract is prerequisite-driven and explicit

The packaging change must encode the public install contract explicitly:

- install via `npm install -g uraniborg`
- then run `uraniborg doctor`
- Node.js is a prerequisite
- Feynman is a prerequisite
- Uraniborg does not bundle or provision Feynman

This contract belongs in package-facing docs and must match observed runtime behavior.

## Risks / Trade-offs

- [External prerequisite increases first-run friction] -> Mitigation: make prerequisite failures explicit and give direct install/expose guidance.
- [Minimal runtime packaging can omit needed assets] -> Mitigation: use an allowlist-based production bundle and smoke-test the published tarball.
- [Manual release slows publication] -> Mitigation: keep the gate narrow and automated checks deterministic so the manual step is only an approval boundary.
- [Platform matrix drift] -> Mitigation: validate each supported platform in release checks and keep the matrix fixed in the spec.
- [Capability-first compatibility can be harder to implement than a simple version check] -> Mitigation: define the required command probe set once and reuse it in doctor, models, and preflight checks.

## Migration Plan

1. Lock the packaging and prerequisite spec deltas before changing build scripts.
2. Introduce the production build layout and package allowlist.
3. Add publishable package metadata and dependency classification cleanup.
4. Add the external Feynman compatibility/prerequisite checks to the CLI.
5. Update install/package-facing docs so the prerequisite contract is explicit.
6. Add release validation tasks and smoke checks, then publish only after the manual gate passes.

Rollback strategy:

- Keep the release pipeline reversible by retaining the previous published package until the new tarball and compatibility checks have been verified.
- If a platform-specific artifact regresses, pause publication for that target without changing the CLI contract.

## Open Questions

- What exact npm package name and scope should be published for the CLI distribution?
