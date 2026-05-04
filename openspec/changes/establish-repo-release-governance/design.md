## Context

Uraniborg has reached its first npm-published baseline as `@perpetual-lm/uraniborg@0.1.0`. The repository still contains product code, tests, OpenSpec artifacts, historical notes, session handoffs, UAT material, and exploratory documents in one working tree. That is acceptable for development, but publication must be governed by deterministic package contents and CI gates instead of by a manually curated publish-only branch.

The local and remote default branch have been migrated from `master` to `main`. Future governance work should assume `main` is the protected integration branch.

## Goals / Non-Goals

**Goals:**
- Make `main` the single protected source-of-truth branch for reviewed development.
- Run repeatable CI gates on pull requests and pushes to `main`.
- Publish npm releases only from an explicit tag or GitHub Release event after the release gate passes.
- Keep the npm tarball minimal through `package.json` `files` and automated package validation.
- Preserve OpenSpec and durable knowledge documents in the repository without allowing them into the published npm artifact.
- Prefer npm Trusted Publishing so CI does not depend on long-lived npm tokens.

**Non-Goals:**
- Create a long-lived publish-only branch with a different repository shape.
- Create a long-lived test-only branch.
- Remove OpenSpec as the development source of truth.
- Change Uraniborg runtime behavior or package CLI semantics.
- Delete historical branches or notes without a separate cleanup decision.

## Decisions

1. Use `main` as the protected integration branch.
   - Rationale: This matches common GitHub/npm project practice and gives CI/CD one clear source branch.
   - Alternative considered: Keep `master`. Rejected because the user explicitly wants a deliberate `main` migration.

2. Use short-lived work branches, not long-lived purpose branches.
   - Rationale: `feature/*`, `fix/*`, `spec/*`, and temporary `release/*` branches keep changes reviewable without creating divergent source trees.
   - Alternative considered: Maintain separate publish and test branches. Rejected because those branches become stale copies and make it harder to prove what source produced a package.

3. Treat `package.json` `files` plus `npm pack --dry-run` validation as the package boundary.
   - Rationale: npm packages already provide a standard allowlist mechanism, and the repo has a validator enforcing the publish surface.
   - Alternative considered: Physically remove docs/specs from a publish branch. Rejected because it duplicates state and weakens traceability.

4. Split CI into pull-request validation and release publishing.
   - Rationale: PR validation should prove code quality; release publishing should additionally prove package installability and publish from an explicit release intent.
   - Alternative considered: Publish automatically on every merge to `main`. Rejected because version selection and external release timing should remain deliberate.

5. Prefer npm Trusted Publishing with GitHub Actions OIDC.
   - Rationale: Trusted publishing avoids long-lived npm tokens and can attach provenance for public packages.
   - Alternative considered: Store `NPM_TOKEN` as a GitHub secret. Accepted only as a fallback if Trusted Publishing is unavailable.

6. Keep external-prerequisite smoke tests explicit.
   - Rationale: Uraniborg depends on an external Feynman runtime for review-side behavior, so CI must either install/configure that prerequisite for full release smoke tests or run a clearly named reduced smoke gate.
   - Alternative considered: Skip prerequisite-dependent smoke tests silently. Rejected because it would make release validation ambiguous.

## Risks / Trade-offs

- Existing remote branches may still target `master` or carry stale assumptions -> keep `origin/master` temporarily, then delete or archive it only after confirming no open work depends on it.
- CI may fail on prerequisite-dependent `doctor` and `models` smoke tests if GitHub runners lack Feynman -> separate source/package checks from full release smoke checks or add explicit CI setup for Feynman.
- Trusted Publishing requires npm package-side configuration -> document setup and keep token fallback disabled unless explicitly needed.
- GitHub branch protection is partly repository configuration, not code -> document required settings and make workflow names stable so protection rules can target them.
- Current OpenSpec canonical specs may have schema drift -> keep this change focused on governance and avoid using unrelated spec validation failures as release blockers unless the governance spec requires them.

## Migration Plan

1. Commit and merge the npm packaging baseline into the default branch.
2. Tag the published baseline as `v0.1.0`.
3. Rename the local and remote default branch from `master` to `main`.
4. Add CI workflow for PRs and pushes to `main`.
5. Add release workflow for tag or GitHub Release driven npm publication.
6. Configure npm Trusted Publishing for the package and workflow path.
7. Enable branch protection on `main` with required CI checks.
8. Review stale branches and historical notes in a separate cleanup pass.
