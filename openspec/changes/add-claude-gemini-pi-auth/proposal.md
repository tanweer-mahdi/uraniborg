## Why

Uraniborg's current revision setup is only Pi-backed for `OpenAI/Codex`. The updated [provider-interop-architecture.md](/Users/shahmahdihasan/uraniborg/provider-interop-architecture.md) now captures enough concrete Pi behavior for Claude and Gemini to stop treating them as API-key-only presets and to implement their real browser-login-backed setup paths without inventing new auth machinery.

This needs to happen now because the revision config contract has already been realigned around provider identity and bootstrap semantics. Leaving `Claude` and `Gemini` on endpoint-plus-secret setup while the architecture now specifies Pi-backed browser login would keep the operator experience and the durable config model inconsistent.

## What Changes

- Extend revision provider setup so `Claude` uses Pi's built-in `anthropic` OAuth provider and browser-login flow instead of remaining API-key-only in guided setup.
- Extend revision provider setup so `Gemini` uses Pi's built-in `google-gemini-cli` OAuth provider and Cloud Code Assist browser-login flow instead of remaining direct-API-key-only in guided setup.
- Add the required durable revision profile and credential-binding semantics for Pi-managed Claude and Gemini OAuth credentials, including required provider context such as Gemini `projectId`.
- Update `uraniborg init`, `uraniborg revision --setup`, and revision readiness checks so Claude and Gemini setup completeness means Pi-managed browser login has succeeded and the required provider context is present.
- Update `uraniborg doctor`, `uraniborg revision --config`, and revision-side `uraniborg models` so they report Claude and Gemini revision setup using the corrected provider/profile contract and do not misrepresent incomplete or stale Pi auth state as healthy configuration.
- Add migration and compatibility behavior so existing API-key-based Claude and Gemini revision configs are either normalized into the new provider-aware shape where valid or explicitly flagged for re-setup when the auth regime has changed materially.
- Add focused tests for Claude and Gemini browser-login bootstrap, cancellation and state-validation failures, config-write behavior, readiness classification, and operator-visible reporting.
- Defer `google-antigravity` and Vertex-style Gemini enterprise auth as follow-on variants rather than bundling them into this first Claude/Gemini browser-login change.

## Capabilities

### New Capabilities
- `revision-provider-auth`: provider-specific browser-login bootstrap, durable credential-binding semantics, and readiness rules for Uraniborg-owned revision setup

### Modified Capabilities
- `environment-setup`: refine setup and doctor flows must treat Claude and Gemini browser login as Pi-managed provider bootstrap rather than API-key-only config
- `model-selection`: revision-side model/config visibility must reflect the active Claude or Gemini browser-login-backed profile without exposing secret or low-level Pi auth detail

## Impact

- Affects revision profile metadata, config schema normalization, and migration logic in `src/types/app-config.ts`, `src/config/app-config.ts`, and `src/config/revision-profiles.ts`.
- Affects the Pi integration layer in `src/config/revision-auth.ts` so it can drive the built-in `anthropic` and `google-gemini-cli` OAuth providers and inspect their managed credential state.
- Affects operator-facing CLI flows in `src/cli/commands/init.ts`, `src/cli/commands/revision-setup.ts`, `src/cli/commands/revision.ts`, `src/cli/commands/models.ts`, and `src/cli/commands/doctor.ts`.
- Requires spec deltas for `revision-provider-auth`, `environment-setup`, and `model-selection`.
- Requires focused tests for Pi-backed Claude and Gemini login flows, readiness classification, config migration, and reporting behavior.
