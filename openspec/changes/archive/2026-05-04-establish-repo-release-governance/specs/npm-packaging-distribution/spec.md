## MODIFIED Requirements

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
