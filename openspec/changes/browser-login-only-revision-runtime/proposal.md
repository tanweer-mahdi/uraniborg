## Why

Uraniborg's current runtime and config surface still preserves compatibility for legacy endpoint/API-key revision contracts and a `manual-openai-compatible` execution path.

That no longer matches the intended product boundary:

- revision auth is browser-login-only
- only the Pi-backed provider contracts documented in `provider-interop-architecture.md` are supported
- only `OpenAI/Codex`, `Claude`, and `Gemini` are supported revision providers
- Uraniborg no longer supports arbitrary revision endpoints, API-key-based revision auth, or ambient credential paths

Retaining the old compatibility surface increases code size, weakens operator clarity, and keeps stale config/runtime branches alive even though they are no longer part of the product.

## What Changes

- Remove support for legacy revision config shapes and passive normalization of old endpoint/API-key configs.
- Remove the `manual-openai-compatible` revision profile and all API-key/ADC-based revision auth strategies.
- Remove manual-compatible refinement execution and require Pi-managed revision execution for all supported providers.
- Update operator-facing and canonical spec surfaces to describe only browser-login-backed `OpenAI/Codex`, `Claude`, and `Gemini`.

## Capabilities

### Modified Capabilities

- `environment-setup`
- `revision-configuration`
- `revision-provider-auth`
- `revision-provider-execution`
- `iterative-draft-run`
- `model-selection`
- `run-recovery-and-history`

## Impact

- Affected code:
  - config schema and normalization
  - revision profile registry
  - guided revision setup
  - managed/manual refinement execution split
  - run snapshot and readiness surfaces
  - tests built around legacy/manual-compatible behavior
- Affected operator behavior:
  - old revision configs will no longer load as compatible current setup
  - users must use Pi-backed browser login for supported revision providers
