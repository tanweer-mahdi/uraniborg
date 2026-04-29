## Why

Uraniborg's current revision-configuration change corrected some naming and visibility problems, but it still implemented the wrong provider contract for the most important preset. The reference architecture in [provider-interop-architecture.md](/Users/shahmahdihasan/uraniborg/provider-interop-architecture.md) treats OpenAI/Codex as the ChatGPT subscription-backed Codex path, not as the OpenAI Platform API. That architecture requires a browser-initiated OAuth-style login flow, bearer-token credential handling, account-context metadata, and the canonical base endpoint `https://chatgpt.com/backend-api`.

The current change instead modeled `OpenAI/Codex` as an OpenAI Platform API preset with API-key setup against `https://api.openai.com/v1`. That is not a small implementation bug. It means the current proposal, design, schema, guided setup flow, and readiness model all encode the wrong boundary for revision configuration. If Uraniborg continues from that baseline, the durable operator contract will harden around the wrong auth regime and the wrong provider identity.

There is now an additional correction requirement: the current branch has already introduced a pre-correction `version: 2` revision schema. Even if that schema has not shipped broadly, Uraniborg needs explicit migration and classification rules so branch-local or pre-release configs written by the current implementation are not silently misinterpreted as valid OpenAI/Codex revision setup.

This change therefore needs to be widened. It must align revision configuration not only around provider identity, but also around provider-specific credential bootstrap for the revision flow itself. Inference execution, request composition, streaming, and transport behavior remain out of scope for this change.

## What Changes

- Replace the current provider-aware-but-API-key-centric revision contract with a provider-bootstrap-aware revision contract.
- Introduce a corrected revision config schema version that can distinguish:
  - legacy endpoint-centric `version: 1` config
  - the pre-correction provider-aware `version: 2` config written by the current branch
  - the corrected provider-bootstrap-aware schema written by this change
- Define a bundled first-party revision provider catalog with architecture-oriented internal identities and product-facing labels:
  - `OpenAI/Codex`
  - `Claude`
  - `Gemini`
  - `Manual OpenAI-compatible`
- Redefine the `OpenAI/Codex` preset so it follows the architecture document:
  - canonical base endpoint `https://chatgpt.com/backend-api`
  - browser-initiated OAuth-style login flow
  - Pi `AuthStorage`-managed bearer-token credential storage/reference rather than API-key setup
  - account-context metadata captured as part of durable revision readiness
- Require Uraniborg to reuse Pi primitives for revision provider auth/bootstrap rather than creating a parallel OAuth implementation:
  - Pi `AuthStorage` for secure credential persistence and refresh
  - Pi `ModelRegistry` for provider-aware auth/model resolution
  - Pi's built-in `openai-codex` OAuth provider and Codex transport implementation where applicable
- Keep the operator-facing `Claude`, `Gemini`, and `Manual OpenAI-compatible` setup flows provider-centric, but only present auth-acquisition paths that Uraniborg can actually complete in guided setup for this change.
- Update `uraniborg init` and `uraniborg revision --setup` so revision setup branches by provider/profile and auth/bootstrap path rather than treating every provider as endpoint-plus-API-key.
- Update `uraniborg doctor` so revision readiness distinguishes:
  - missing provider/profile
  - invalid provider/auth combination
  - missing or stale managed credential reference
  - missing required account or project context metadata
  - missing default revision model
- Keep `uraniborg revision --config` and revision-side `uraniborg models` intentionally minimal:
  - show only the active revision provider/profile
  - show only the default revision model
- Define migration behavior for both old config families:
  - normalize legacy `version: 1` endpoint-centric configs
  - normalize compatible pre-correction `version: 2` configs where possible
  - explicitly classify pre-correction OpenAI/Codex `version: 2` configs as stale/incompatible because the auth regime and endpoint contract changed materially
- Continue to defer inference execution concerns, including request composition, provider headers, streaming, retries, session continuity, live model discovery, and broader provider runtime orchestration.

## Capabilities

### New Capabilities

- `revision-configuration`: provider-bootstrap-aware operator workflows and migration-safe configuration visibility for Uraniborg-owned revision setup.

### Modified Capabilities

- `environment-setup`: revise guided setup and readiness semantics so revision setup is validated as provider-specific durable configuration plus required credential bootstrap state.
- `model-selection`: keep revision-side model visibility minimal while ensuring `models` reflects the corrected provider/profile contract and does not misrepresent stale configuration as valid revision setup.

## Impact

- Affects Uraniborg config schema, normalization, and persistence semantics in `src/types/app-config.ts` and `src/config/app-config.ts`.
- Affects provider catalog and provider-policy metadata in `src/config/revision-profiles.ts` or equivalent provider-contract modules.
- Affects operator-facing CLI flows in `src/cli/commands/init.ts`, `src/cli/commands/revision-setup.ts`, `src/cli/commands/revision.ts`, `src/cli/commands/models.ts`, and `src/cli/commands/doctor.ts`.
- Requires Pi-backed revision credential/bootstrap integration for `OpenAI/Codex`, including browser-login initiation, callback/state validation, secure token storage/reference through Pi `AuthStorage`, and provider-context metadata capture.
- Requires adding and wiring Pi dependencies into Uraniborg rather than implementing a parallel Uraniborg-owned OAuth store or callback server.
- Requires spec deltas for `revision-configuration`, `environment-setup`, and `model-selection`.
- Requires focused tests for corrected schema parsing, managed-credential bootstrap, migration from legacy and pre-correction configs, secret-safe reporting, and revision readiness classification.
- Intentionally does not change run creation semantics, run-time request execution, Feynman-owned remediation flows, or the separate inference-focused OpenSpec work that will follow later.
