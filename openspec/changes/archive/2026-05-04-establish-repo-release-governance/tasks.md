## 1. Baseline And Branch Migration

- [x] 1.1 Verify PR #3 packaging baseline is merged into the default branch and `v0.1.0` points at the merge commit that represents the published npm package.
- [x] 1.2 Verify local `main`, `origin/main`, and GitHub repository default branch all agree on `main`.
- [x] 1.3 Decide and execute the legacy `master` branch cleanup policy after confirming no open work depends on `origin/master`.

## 2. Package Release Metadata

- [x] 2.1 Add npm package metadata required for a trustworthy public package page: `repository`, `homepage`, `bugs`, `keywords`, and `publishConfig.access`.
- [x] 2.2 Validate that package metadata changes do not broaden the published tarball beyond the existing allowlist.

## 3. Pull Request CI

- [x] 3.1 Add a GitHub Actions CI workflow for pull requests and pushes to `main` using lockfile-based dependency installation.
- [x] 3.2 Run typecheck, Vitest tests, production build, package allowlist validation, npm pack dry-run, and built-entrypoint smoke in CI.
- [x] 3.3 Use a Node version matrix that covers the supported minimum and current stable runtime without duplicating release-only platform checks.

## 4. Release Publishing Workflow

- [x] 4.1 Add a release workflow that can publish only from an explicit version tag or GitHub Release event, never from pull requests.
- [x] 4.2 Configure the release workflow for npm Trusted Publishing with OIDC permissions and document the required npm-side trusted publisher setup.
- [x] 4.3 Run the full release gate before `npm publish`, with external Feynman-dependent smoke checks either provisioned explicitly or documented as manual/local release smokes.
- [x] 4.4 Ensure the publish command uses public scoped-package publishing semantics for `@perpetual-lm/uraniborg`.

## 5. Maintainer Documentation And Enforcement

- [x] 5.1 Add concise maintainer documentation for branch naming, PR requirements, release triggers, tagging, and publish rollback expectations.
- [x] 5.2 Configure or document required GitHub branch protection for `main`, including required CI checks before merge.
- [x] 5.3 Document that package contents are governed by `package.json` `files` and package validation, not by a separate publish-only branch.

## 6. Validation

- [x] 6.1 Run `npm run release:check` locally after workflow and metadata changes.
- [x] 6.2 Run OpenSpec validation for `establish-repo-release-governance`.
- [x] 6.3 Confirm the working tree contains no generated `dist/` or tarball artifacts intended for publication commits.
