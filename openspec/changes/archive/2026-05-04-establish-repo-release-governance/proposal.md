## Why

Uraniborg now has a published npm package, but the repository still lacks branch governance, CI enforcement, and an automated/semi-automated release path tied to a known source baseline. This change establishes the standard repo controls needed to publish future versions from reviewed code instead of local manual state.

## What Changes

- Establish `main` as the default integration branch and document short-lived branch conventions for feature, fix, spec, and release work.
- Add CI gates for pull requests and pushes to the default branch, covering install, typecheck, tests, build, package validation, and CLI smoke checks.
- Add a release workflow that publishes npm versions from an explicit tag or GitHub Release event only after the same release gate passes.
- Prefer npm Trusted Publishing/OIDC for CI-based publishing, with token-based publishing treated as a fallback only.
- Preserve a developer-rich repository while keeping npm package contents minimal through `package.json` allowlisting and package validation.
- Add cleanup rules for stale branches and historical notes without making a separate publish-only source branch.

## Capabilities

### New Capabilities
- `repository-release-governance`: Covers default branch policy, PR/test gates, release workflow triggers, npm publishing authority, provenance, and repository content boundaries.

### Modified Capabilities
- `npm-packaging-distribution`: Replace the local manual-only release gate with a CI-enforced release gate that still requires an explicit release/tag trigger before npm publication.

## Impact

- Adds GitHub Actions workflows under `.github/workflows/`.
- Updates `package.json` release metadata and npm publish configuration where needed.
- May add maintainer documentation for branch policy, release process, and stale artifact cleanup.
- Does not change the runtime CLI behavior or broaden npm package contents beyond the existing production allowlist.
