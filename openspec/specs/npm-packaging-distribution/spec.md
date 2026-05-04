## Purpose

Define the npm packaging and distribution contract for Uraniborg as a CLI-only package with explicit prerequisites, a clean production build layout, and gated release validation.

## Requirements

### Requirement: CLI-Only NPM Distribution
The system SHALL distribute Uraniborg as an npm package whose supported interactive surface is the CLI and not a standalone application or daemon contract.

#### Scenario: Package installs as a CLI
- **WHEN** a user installs Uraniborg from npm
- **THEN** the installed package exposes the command-line entrypoint and does not require a separate Uraniborg service to run

#### Scenario: No standalone contract is introduced
- **WHEN** the package is published
- **THEN** it does not define a separate standalone runtime or background-service contract in addition to the CLI

### Requirement: Explicit Install Contract
The system SHALL document and preserve an explicit install contract for the npm package.

#### Scenario: Install path is explicit
- **WHEN** a user reads the install instructions for Uraniborg
- **THEN** the instructions begin with `npm install -g uraniborg` followed by `uraniborg doctor`

#### Scenario: Prerequisites are explicit
- **WHEN** a user reads the install or troubleshooting instructions
- **THEN** the instructions explicitly state that Node.js and a compatible Feynman installation are prerequisites and that Uraniborg does not bundle or provision Feynman

### Requirement: Clean Production Build Layout
The system SHALL publish a clean production build layout that separates source, build output, and runtime package contents, and SHALL keep the runtime package minimal.

#### Scenario: Runtime package omits development files
- **WHEN** Uraniborg builds the publishable npm artifact
- **THEN** the package contains only the files required for the CLI to execute and excludes tests, spec artifacts, and other development-only files

#### Scenario: Production output is deterministic
- **WHEN** the build pipeline produces a release artifact
- **THEN** the output layout is stable enough to inspect and reproduce without relying on the source tree at runtime

#### Scenario: Canonical CLI entrypoint is stable
- **WHEN** Uraniborg emits the production build
- **THEN** the canonical built CLI entrypoint is `dist/cli/main.js`

#### Scenario: Production build config is isolated from local workflows
- **WHEN** Uraniborg adds the production build configuration for npm distribution
- **THEN** the production build uses a dedicated emit configuration and does not narrow or repurpose the broad local development, typecheck, or test configuration

#### Scenario: Local workflows remain source-oriented
- **WHEN** packaging support is implemented
- **THEN** local development continues to execute source directly, typechecking continues to validate source and tests with no emit, and test execution does not depend on the production `dist/` layout

#### Scenario: Published tarball is minimal
- **WHEN** Uraniborg prepares the npm package tarball
- **THEN** the package includes only `dist/**`, `package.json`, `README.md`, and `LICENSE`, with emitted `.d.ts` files allowed inside `dist/`

### Requirement: Explicit External Feynman Prerequisite
The system SHALL treat Feynman as an explicit external prerequisite for review-side functionality and SHALL surface clear install or expose guidance when a compatible Feynman installation is missing or unavailable.

#### Scenario: Missing prerequisite blocks review-dependent commands
- **WHEN** Uraniborg starts on a machine without a compatible Feynman installation
- **THEN** the command reports the missing prerequisite and tells the user how to install or expose Feynman before continuing

#### Scenario: Incompatible prerequisite is reported clearly
- **WHEN** Uraniborg finds a Feynman installation that does not satisfy the required capabilities
- **THEN** the command reports the compatibility failure against that installation instead of pretending that a bundled runtime exists

### Requirement: Capability-First Feynman Compatibility
The system SHALL determine Feynman readiness by required capabilities and compatibility checks rather than by assuming a pinned bundled install path.

#### Scenario: Compatible installation is accepted
- **WHEN** Uraniborg discovers an external Feynman installation whose capabilities satisfy the review-side contract
- **THEN** Uraniborg uses that installation for review-side commands

#### Scenario: Out-of-range but probe-valid installation warns and continues
- **WHEN** Uraniborg discovers an external Feynman installation outside the tested version range and the required compatibility probes still validate successfully
- **THEN** Uraniborg marks the installation as warning-level compatible, explains that the version is outside the tested range, and still allows execution

#### Scenario: Compatibility probes are command-contract based
- **WHEN** Uraniborg validates a discovered Feynman installation
- **THEN** it judges compatibility by whether the existing doctor-side Feynman command surface can be invoked and parsed successfully, not by the semantic readiness content of review models, AlphaXiv, or web-search configuration

#### Scenario: Compatibility check is deterministic
- **WHEN** more than one Feynman installation is available
- **THEN** Uraniborg selects the compatible installation deterministically and reports which installation it will use

### Requirement: Manual Gated Release Matrix
The system SHALL publish the npm package only after an explicit maintainer release trigger and a passing CI-enforced release gate, and SHALL validate that package against the supported platform matrix of macOS arm64/x64, Linux x64, and Windows x64 where the release environment can exercise those platforms.

#### Scenario: Release requires explicit maintainer intent
- **WHEN** a release build is ready
- **THEN** publication waits for an approved version tag or GitHub Release event before the package is made available

#### Scenario: Release gate runs before publication
- **WHEN** the release workflow receives an approved release trigger
- **THEN** it runs typecheck, tests, production build, package allowlist validation, package dry-run, built-entrypoint smoke, installed-shim smoke, and configured non-interactive CLI smoke checks before invoking `npm publish`

#### Scenario: Release matrix is limited
- **WHEN** the release pipeline validates a release candidate
- **THEN** it validates the npm package only against macOS arm64/x64, Linux x64, and Windows x64

#### Scenario: External prerequisite smoke is explicit
- **WHEN** a release smoke check depends on external Feynman capabilities
- **THEN** the workflow either provisions the prerequisite explicitly or labels the check as a local/manual prerequisite smoke outside the automated publish gate
