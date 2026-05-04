## ADDED Requirements

### Requirement: Default Branch Governance
The repository SHALL use `main` as the protected integration branch for reviewed development and release automation.

#### Scenario: Pull requests target the integration branch
- **WHEN** a contributor opens a product, spec, or release-governance pull request
- **THEN** the pull request targets `main` unless a temporary release branch has been explicitly created for stabilization

#### Scenario: Legacy default branch is not authoritative
- **WHEN** both `main` and a legacy `master` branch exist
- **THEN** release automation, branch protection, and maintainer documentation treat `main` as the authoritative default branch

### Requirement: Short-Lived Work Branches
The repository SHALL use short-lived work branches for implementation, fixes, specs, and release stabilization instead of long-lived publish-only or test-only source branches.

#### Scenario: Feature work is isolated
- **WHEN** a contributor starts product or spec work
- **THEN** the work occurs on a short-lived branch named with a clear prefix such as `feature/`, `feat/`, `fix/`, `spec/`, or `release/`

#### Scenario: Publish branch is not required
- **WHEN** Uraniborg prepares an npm release
- **THEN** the release process uses the reviewed source tree on `main` plus npm package allowlisting rather than a separate branch containing only publishable files

### Requirement: Pull Request CI Gate
The repository SHALL run a repeatable CI gate for pull requests and updates to `main` before changes are considered merge-ready.

#### Scenario: Source validation runs
- **WHEN** CI evaluates a pull request or push to `main`
- **THEN** CI installs dependencies with a lockfile-based command and runs typechecking and the automated test suite

#### Scenario: Package validation runs
- **WHEN** CI evaluates a pull request or push to `main`
- **THEN** CI builds the production package, validates the npm package allowlist, and runs a built CLI entrypoint smoke check

### Requirement: Explicit Release Publishing Authority
The repository SHALL publish npm packages only from an explicit release trigger after the release gate passes.

#### Scenario: Pull request cannot publish
- **WHEN** CI runs for a pull request
- **THEN** the workflow validates the package but does not publish to npm

#### Scenario: Release trigger can publish
- **WHEN** a maintainer creates an approved version tag or publishes a GitHub Release
- **THEN** the release workflow runs the release gate before invoking `npm publish`

#### Scenario: Failed release gate blocks publication
- **WHEN** any required release-gate step fails
- **THEN** the workflow stops before publishing to npm

### Requirement: Trusted NPM Publishing
The repository SHALL prefer npm Trusted Publishing for CI-based npm publication.

#### Scenario: Trusted publisher is configured
- **WHEN** the release workflow publishes from GitHub Actions
- **THEN** it uses OIDC-based trusted publishing where available instead of a long-lived npm automation token

#### Scenario: Token fallback is explicit
- **WHEN** trusted publishing is unavailable
- **THEN** any token-based fallback is documented, scoped to publishing, stored as a repository secret, and not used by pull request workflows

### Requirement: Repository Content Boundaries
The repository SHALL distinguish development artifacts from npm package artifacts without requiring a separate source branch.

#### Scenario: Development artifacts remain in the repo
- **WHEN** maintainers keep OpenSpec changes, notes, knowledge documents, or historical handoff material in the repository
- **THEN** those files may remain available for development and audit purposes

#### Scenario: Development artifacts are excluded from npm
- **WHEN** the npm package is packed or published
- **THEN** package allowlisting and validation exclude source, tests, OpenSpec artifacts, notes, and other development-only files unless a future spec explicitly changes the package surface
