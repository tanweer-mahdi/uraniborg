# Uraniborg npm Release Gate

This document is the release gate for distributing Uraniborg as an npm package.

It is authoritative for the current packaging decision set:

- Feynman is an external prerequisite.
- Uraniborg is npm-first, but CLI-only.
- Node.js is a hard prerequisite.
- The runtime package must stay minimal.
- The production build layout must be clean and stable.
- Releases are manually gated.
- Supported platforms are explicit and limited.
- Feynman compatibility is capability-first, not version-string-first.
- Installation docs must be prerequisite-driven and explicit.

## Locked Decisions

These decisions are locked for the first packaging change:

1. Feynman is an external prerequisite and is not bundled or provisioned by Uraniborg.
2. npm is the first and only distribution channel in scope for this change.
3. Uraniborg is distributed as a CLI-only package.
4. Node.js is an explicit prerequisite; no standalone distribution contract is introduced here.
5. The production build must emit a clean runtime-oriented `dist/` layout and must not emit tests into production artifacts.
6. The published package must be minimal and must exclude development artifacts such as tests, notes, OpenSpec files, and internal workflow materials.
7. Releases are manually gated; CI may validate but does not auto-publish in this phase.
8. The first-class support matrix is macOS arm64/x64, Linux x64, and Windows x64.
9. Feynman compatibility is capability-first, with version range treated as confidence metadata rather than the sole gate.
10. Public install and troubleshooting docs must be explicit about prerequisites and must start from `npm install -g uraniborg` followed by `uraniborg doctor`.

## 1. Release Goal

Ship a small CLI package that installs cleanly, exposes a working `uraniborg` binary, and fails fast when prerequisites are missing.

The package must not bundle or imply ownership of Feynman. Uraniborg should discover and validate a compatible Feynman runtime on the host system and surface precise guidance when that prerequisite is absent or incomplete.

## 2. Release Principles

- CLI-only package. No library promise.
- Minimal runtime dependencies only.
- Clear separation between runtime dependencies and development/test tooling.
- No silent normalization of unsupported environments.
- No automatic publication. Every release is manually approved.
- If any gate fails, the release does not proceed.

## 3. Supported Platform Matrix

The release must explicitly support only the platforms validated by the runtime:

- macOS
- Linux
- Windows

The package is only considered release-ready when the following hold on all supported platforms:

- Node.js `>= 20`
- npm installed and functional
- a compatible Feynman runtime is present and discoverable
- shell/terminal behavior works in interactive and non-interactive modes

Unsupported or unverified combinations must fail with a clear prerequisite message.

## 4. Packaging Contract

### Required package shape

- The package must expose exactly one user-facing binary: `uraniborg`.
- The binary must point at the emitted production entrypoint, not the TypeScript source tree.
- The package must include only what is needed to run the CLI.
- The package must not publish tests, notes, OpenSpec artifacts, or internal work-in-progress files.

### Required metadata

- `private` must be `false` for a publishable release candidate.
- `bin` must resolve to the real built entrypoint.
- `files` must whitelist the publish set.
- `license` must be present.
- `repository`, `bugs`, and `homepage` should be present.
- `publishConfig` should be explicit if public publishing is intended.

### Dependency classification

Runtime dependencies belong in `dependencies`.

Development-only and test-only packages belong in `devDependencies`.

The release gate must reject packaging if type-only or test-only packages are left in runtime dependencies.

## 5. Build Checks

The build gate must pass before packaging work is considered ready.

### Commands

```bash
npm run typecheck
npm run test
npm run build
```

### Acceptance criteria

- TypeScript compiles with no errors.
- Tests pass.
- The build emits the expected production layout.
- The build does not require manual patching of generated artifacts.

### Build layout checks

Verify the compiled output contains the production CLI entrypoint at the intended path.

The release gate must confirm:

- the `bin` target matches the emitted file
- the emitted file has a valid Node shebang or is reachable through the package shim
- the build output is stable across repeated runs

## 6. Packaging Checks

Run a dry-run pack before any publish decision.

### Command

```bash
npm pack --dry-run
```

### Required outcomes

- The tarball includes only runtime files required to execute Uraniborg.
- The tarball does not include `tests/`, `notes/`, `openspec/`, or other internal planning artifacts.
- The tarball does not include source files unless they are intentionally part of the runtime contract.
- The tarball size is small and explainable.
- The tarball contents are stable enough to inspect manually.

### Pack inspection checklist

Inspect the pack output for:

- `package.json`
- the compiled CLI entrypoint
- any required runtime assets
- README and license files if intended for publication

Reject the release if the pack includes:

- test artifacts
- session logs
- OpenSpec drafts or archives
- internal notes
- accidental source-only dependencies
- generated files that are not required at runtime

## 7. Smoke Tests

Smoke tests must prove the installed binary works as a user would invoke it.

### Minimum smoke commands

Run the smoke tests against the emitted production entrypoint for the current packaging layout. During implementation, this should resolve to the canonical built CLI path, for example `dist/cli/main.js`.

```bash
node <built-cli-entrypoint> --help
node <built-cli-entrypoint> --version
node <built-cli-entrypoint> doctor --no-ui
node <built-cli-entrypoint> models --no-ui
```

If the published binary path changes, run the same checks through the installed shim:

```bash
uraniborg --help
uraniborg --version
uraniborg doctor --no-ui
uraniborg models --no-ui
```

### Optional run-path smoke

If a safe fixture is available, validate the main run path with a minimal draft file and a non-interactive invocation.

Acceptance criteria:

- CLI help renders successfully.
- Version output renders successfully.
- Non-interactive commands exit cleanly.
- The binary does not require a TTY for help or diagnostic output.

## 8. Feynman Compatibility Checks

Feynman is an external prerequisite and must be validated before release.

The release gate must verify capability-first compatibility, not only version matching.

### Required checks

- Feynman executable discovery succeeds on the target platform.
- The discovered runtime exposes the capabilities Uraniborg needs.
- Review model discovery works.
- Model availability checks work.
- AlphaXiv support is detectable when expected.
- Web search support is detectable when expected.
- Remediation commands are available or fail with explicit guidance.

### Compatibility policy

Treat Feynman as compatible only when its observed capabilities satisfy Uraniborg's needs.

Do not rely on:

- version strings alone
- implied defaults
- undocumented command behavior

If a capability is absent, Uraniborg must report the missing prerequisite directly and refuse to claim readiness.

## 9. Runtime Expectations

The package must clearly state and verify the runtime prerequisites:

- Node.js `>= 20`
- npm
- compatible Feynman runtime on `PATH` or through the supported discovery mechanism
- a terminal environment suitable for interactive and non-interactive CLI operation

The install docs must not imply that Uraniborg bundles Feynman.

The docs must also distinguish:

- install-time prerequisites
- first-run setup prerequisites
- optional capabilities

## 10. Release Readiness Gate

A release candidate is publish-ready only if all of the following are true:

- build checks pass
- packaging checks pass
- smoke tests pass
- supported platforms are verified
- Feynman compatibility checks pass
- binary path is correct
- dependency classification is clean
- package metadata is complete
- docs match the real runtime contract
- the release has explicit human approval

## 11. Manual Release Procedure

### Pre-release

1. Run the build gate.
2. Run the pack dry-run.
3. Review the pack contents manually.
4. Run smoke tests on each supported platform or a representative matrix.
5. Confirm prerequisite docs match the observed runtime contract.
6. Confirm the release notes and version bump are correct.

### Publish

1. Tag the release in git.
2. Publish the package manually.
3. Verify the published artifact installs and runs.
4. Record the release outcome in the project history.

### Post-release

1. Verify the install path from a clean environment.
2. Verify the binary shim works.
3. Verify the documented prerequisite path still matches reality.

## 12. Rollback Considerations

If a bad package is published:

1. Stop promoting the release immediately.
2. Determine whether the issue is:
   - packaging metadata
   - broken binary path
   - missing runtime files
   - prerequisite detection failure
   - platform-specific regression
3. If npm unpublish is no longer appropriate or possible, publish a corrected patch release immediately.
4. Record the incident, the broken version, the corrected version, and the exact failed release gate in the release history.
5. Add or tighten the missing gate so the same failure cannot recur silently.

The release is not considered recovered until:

- a corrected package installs cleanly
- the binary shim works
- prerequisite checks behave as documented
- the affected supported platform has been revalidated

- Prefer a follow-up patch release over assuming the prior package can be repaired in place.
- Do not rely on undocumented package-manager behavior for rollback.
- If the issue is a packaging defect, cut a new patch with corrected metadata and build layout.
- If the issue is a runtime compatibility defect, update the prerequisite docs and compatibility checks before the next publish.
- If the issue is a security or broken-install problem, stop releases until the gate is restored.

Rollback planning must assume that users may already have installed the broken version.

## 13. Failure Conditions

The release must be blocked if any of the following are true:

- `private` is still enabled
- the bin path does not match the emitted build output
- the tarball includes internal notes or specs
- runtime dependencies include test-only packages
- Feynman is missing or capability-incomplete
- the package does not install cleanly on the supported platform matrix
- the docs still describe the wrong runtime contract
- the release was not manually reviewed

## 14. Operator Checklist

Before approving a release, the operator must be able to answer yes to all of the following:

- Is Node `>= 20` installed?
- Is Feynman installed and discoverable?
- Does the package build cleanly?
- Does the packed tarball contain only the intended runtime surface?
- Does the installed binary launch correctly?
- Do the docs describe the actual runtime contract?
- Are the supported platforms explicit?
- Was the release manually reviewed?

If any answer is no, do not publish.
