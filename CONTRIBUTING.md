# Contributing

## Branches

`main` is the protected integration branch and the source of truth for reviewed development and release automation. Use short-lived branches for work:

- `feat/<name>` for product features
- `fix/<name>` for defects
- `spec/<name>` for OpenSpec-only changes
- `release/<version>` only when a release needs stabilization before merging to `main`

Do not maintain a separate publish-only or test-only branch. The npm package surface is controlled by `package.json` `files` and `scripts/validate-package.mjs`.

## Pull Requests

Pull requests should target `main`. Before requesting review, run:

```bash
npm run typecheck
npm run test
npm run build
npm run package:check
```

GitHub CI runs the same source and package checks on Node 20 and Node 24. Keep workflow names stable because branch protection rules depend on them.

## Branch Protection

Configure `main` in GitHub repository settings with:

- require a pull request before merging
- require status checks to pass before merging
- require the `CI / Node 20.x` and `CI / Node 24.x` checks
- disallow direct pushes except for explicit maintainer emergency recovery

## Releases

The local full release gate is:

```bash
npm run release:check
```

This includes Feynman-dependent `doctor` and `models` smoke checks, so it should be run from a maintainer machine with the external review runtime configured.

The GitHub publish workflow runs the CI-safe package release gate:

```bash
npm run release:ci
```

That gate validates source, tests, production build output, package allowlist, `npm pack --dry-run`, the built CLI entrypoint, and the installed npm shim. It does not assume the GitHub runner has the local external Feynman setup.

To publish a new version:

1. Merge the release-ready PR into `main`.
2. Bump `package.json` and `package-lock.json` to the intended semver version in a reviewed PR.
3. Run `npm run release:check` locally.
4. Create and push an annotated tag, for example `git tag -a v0.1.1 -m "Release v0.1.1"` and `git push origin v0.1.1`.
5. Publish a GitHub Release for that tag.
6. Confirm the `Publish` workflow succeeds and the npm version appears under `@perpetual-lm/uraniborg`.

Use npm Trusted Publishing for GitHub Actions. Configure the trusted publisher for package `@perpetual-lm/uraniborg`, repository `tanweer-mahdi/uraniborg`, workflow `.github/workflows/publish.yml`, and release event publishing. Use a long-lived `NPM_TOKEN` only as a documented fallback.

If a bad version is published, do not rewrite tags. Publish a fixed patch version and deprecate the bad npm version with a clear message if needed.
