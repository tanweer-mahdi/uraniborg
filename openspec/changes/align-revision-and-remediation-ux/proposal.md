## Why

Recent UAT showed that Uraniborg's setup and remediation surfaces are functionally close but still operator-hostile in a few critical places. The current flow leaks raw subprocess outcomes, routes web-search remediation to the wrong Feynman command, and keeps using `init`/`refinement` language after setup has become an ongoing revision-configuration task rather than a one-time bootstrap step.

The next change should lock a cleaner operator contract before more UX drift accumulates. Uraniborg needs dedicated web-search provider configuration through Feynman-owned commands, curated remediation output, and a revision-focused command surface that reflects how users actually manage the revision model over time.

## What Changes

- Route web-search remediation through a dedicated Feynman-owned search-provider configuration path instead of generic `feynman setup`.
- Let Uraniborg collect a web-search provider and optional API key, then launch `feynman search set ...` without mutating Feynman-owned configuration directly.
- Keep web-search provider management available even when `doctor` already reports a configured search endpoint, so users can add or change providers later.
- Replace raw remediation completion/failure fragments with curated operator-facing messages in the default CLI path.
- Add a `revision` command family with `revision --setup` for guided configuration and `revision --config` for viewing current revision configuration.
- Keep `uraniborg init` supported as a compatibility entry point while shifting operator-facing terminology from `refinement` to `revision` across CLI surfaces.
- Explicitly defer a full verbose/debug remediation mode and any internal `refine.*` schema renaming.

## Capabilities

### New Capabilities
- `revision-configuration`: operator-facing commands and terminology for viewing and updating Uraniborg-owned revision configuration.

### Modified Capabilities
- `environment-setup`: change review-side remediation and optional capability guidance so web-search configuration uses dedicated Feynman search commands with curated default output.

## Impact

- Affects CLI behavior in `doctor`, shared remediation prompting/launching, `init`, and new `revision` command registration.
- Adds or changes review-side remediation plumbing under `src/review/` for web-search provider configuration.
- Requires operator-facing copy updates across setup, readiness, model visibility, and run guidance text.
- Requires focused tests for remediation routing, redacted configuration display, backward-compatible `init` behavior, and operator-facing terminology.
