## Context

The current revision-configuration change corrected Uraniborg's CLI naming and made revision setup provider-aware at a superficial level, but it still preserved the wrong underlying contract. The implementation currently treats every guided revision setup path as some form of endpoint-plus-credential-plus-model, and it models `OpenAI/Codex` as the OpenAI Platform API with API-key auth.

That diverges from the repository's reference architecture in [provider-interop-architecture.md](/Users/shahmahdihasan/uraniborg/provider-interop-architecture.md). The architecture is explicit that:

- OpenAI/Codex is the ChatGPT subscription-backed Codex path.
- It is a separate provider family from the OpenAI Platform API.
- It uses an OAuth-style bearer-token flow or equivalent subscription-backed token acquisition.
- Its canonical base endpoint is `https://chatgpt.com/backend-api`.
- It requires account-context metadata beyond a generic API key.

The same architecture also keeps provider family, auth mode, credential storage, endpoint normalization, request composition, and transport behavior as separate concerns. Uraniborg's current revision contract still collapses too many of those concerns into one operator prompt flow, so it cannot represent the correct durable setup state for browser-login-backed revision providers.

This corrective pass changes the revision-configuration contract again before it hardens further. It intentionally remains on the configuration side of the boundary:

- in scope: provider identity, auth/bootstrap path, durable credential reference, setup UX, readiness classification, migration rules, and read-only revision visibility
- out of scope: request composition, live inference transport, streaming, retries, provider event normalization, and run-time session orchestration

The corrective design also needs to account for a new migration wrinkle: the current branch has already introduced a pre-correction `version: 2` provider-aware schema that still encodes the wrong OpenAI/Codex contract. Uraniborg therefore needs to read three classes of config safely:

- legacy endpoint-centric `version: 1`
- pre-correction provider-aware `version: 2`
- corrected provider-bootstrap-aware `version: 3`

## Goals / Non-Goals

**Goals**

- Align `OpenAI/Codex` revision setup with the architecture document's ChatGPT subscription-backed contract.
- Treat provider-specific credential bootstrap as part of revision configuration, not as an inference-layer afterthought.
- Reuse Pi's existing OAuth, credential persistence, and provider-registry primitives instead of introducing Uraniborg-owned equivalents.
- Keep the operator-facing revision catalog product-friendly while keeping stored profile identities architecture-oriented and stable.
- Preserve minimal operator-facing visibility in `revision --config` and `models`.
- Add explicit migration and stale-config handling for both legacy `version: 1` and pre-correction `version: 2` configs.
- Keep inference execution semantics unchanged in this change.

**Non-Goals**

- Implement provider-native request composition, streaming adapters, retry policy, or transport selection.
- Introduce full provider-profile management UX such as multiple saved profiles, switching, deletion, or inventory commands.
- Add live remote model discovery or remote model validation to `models`.
- Redesign run creation, run manifests, prompt construction, or revision execution semantics.
- Implement every possible provider auth path immediately.
- Turn Uraniborg into the long-term owner of a general provider registry. The change only aligns Uraniborg's revision config contract to that architecture.

## Decisions

### 1. The corrected durable revision schema becomes `version: 3`

The current branch already uses `version: 2` for a provider-aware schema that still encodes the wrong OpenAI/Codex contract. Reusing `version: 2` would make it impossible to distinguish:

- a pre-correction config that points OpenAI/Codex at `https://api.openai.com/v1` with API-key auth
- a corrected config that points OpenAI/Codex at `https://chatgpt.com/backend-api` with managed OAuth credentials

This change therefore introduces a corrected `version: 3` schema. Uraniborg must:

- read `version: 1`, `version: 2`, and `version: 3`
- write only `version: 3`
- avoid rewriting `version: 1` or `version: 2` during passive reads
- upgrade to `version: 3` only after a successful guided setup completion

Rationale:

- creates an explicit boundary between the incorrect preview schema and the corrected contract
- gives `doctor` and guided setup a way to classify stale configuration accurately
- avoids silent misinterpretation of branch-local configs

### 2. Stored revision profile IDs are architecture-oriented; UI labels remain product-facing

The first operator-facing catalog continues to use the user-approved labels:

- `OpenAI/Codex`
- `Claude`
- `Gemini`
- `Manual OpenAI-compatible`

The stored internal profile IDs should remain stable architecture-oriented identifiers, for example:

- `openai-codex-chatgpt`
- `claude-api`
- `gemini-direct`
- `manual-openai-compatible`

The display label is what the operator sees. The stored ID is what Uraniborg uses for durable compatibility and migration logic.

Rationale:

- keeps operator UX understandable
- avoids persisting labels whose wording may evolve
- gives the config model enough precision to represent distinct provider variants without exposing that complexity in every CLI surface

### 3. Revision configuration owns bootstrap state references, while Pi owns OAuth credential persistence

The previous revision schema treated `authClass` and `credentialSource` as sufficient. That is not enough for a browser-login-backed provider. The corrected durable contract must be able to represent that guided revision setup has completed a provider-specific credential bootstrap and persisted a usable managed credential reference.

Uraniborg must not interpret this as permission to build a second OAuth storage system. Pi already provides the primitives this architecture expects:

- `AuthStorage` for secure credential persistence, refresh participation, and login/logout lifecycle
- `ModelRegistry` for provider-aware auth and model resolution
- built-in OAuth providers, including `openai-codex`

Accordingly:

- Uraniborg owns the revision config that points at a selected provider/profile and a Pi-managed credential binding
- Pi owns the actual OAuth token material and refresh lifecycle
- Uraniborg may persist a stable reference or provider identity in its own config, but it must not duplicate Pi's token store in a second Uraniborg-managed secret file

The corrected normalized revision model should separate at least these concerns:

- `profile`
  - provider family
  - provider variant/profile ID
  - operator-facing label
- `auth`
  - auth class such as `api-key`, `oauth`, or `adc`
  - acquisition mode such as `prompt-secret`, `env-var`, `browser-login`, or `ambient`
- `credentialBinding`
  - inline stored secret
  - environment-variable reference
  - Pi `AuthStorage` OAuth provider reference
  - ADC/ambient marker with any required context metadata
- `providerContext`
  - account identifier where required
  - project identifier or tenant context where required
- `endpoint`
  - fixed or override policy
  - canonical base URL
  - operator override only where the selected profile permits it
- `defaults`
  - default revision model
  - preserved advanced defaults such as timeout and temperature

Rationale:

- matches the architectural boundary the repo already established
- allows setup completeness and readiness to mean something provider-accurate
- keeps execution-specific transport behavior out of the config contract

### 4. `OpenAI/Codex` is browser-login-only in guided setup

For this change, `OpenAI/Codex` must no longer appear as an API-key-based guided setup path. Its provider contract is:

- provider family: OpenAI/Codex through ChatGPT subscription
- canonical base endpoint: `https://chatgpt.com/backend-api`
- auth class: `oauth`
- acquisition mode: `browser-login`
- credential binding: managed OAuth credential reference
- required provider context: account identifier metadata
- endpoint policy: fixed, not operator-overridable in the preset

Guided setup requirements for `OpenAI/Codex`:

1. The user selects `OpenAI/Codex`.
2. Uraniborg initiates a browser-based login flow.
3. The login flow validates callback state and uses PKCE or an equivalent provider-approved protection mechanism.
4. Pi's built-in `openai-codex` OAuth flow handles callback exchange and returns credential material through Pi's login path.
5. Pi `AuthStorage` stores access/refresh token state rather than the main Uraniborg config file.
6. Uraniborg persists only the provider/profile selection plus the minimal Pi-aligned credential binding/account-context metadata required for revision readiness in `version: 3` config.
7. Setup is not reported as complete unless the Pi-managed credential state and required account metadata are both available.

The setup flow must never ask the operator for an API key when the chosen profile is `OpenAI/Codex`.

Rationale:

- directly matches the architecture document
- keeps the provider identity and auth regime coherent
- avoids another round of operator-visible migration for the same preset

### 5. `Claude`, `Gemini`, and `Manual OpenAI-compatible` remain provider-centric but do not overclaim setup support

The corrected change should preserve the product-facing catalog, but guided acquisition support must be honest about what Uraniborg can currently complete.

Day-one expectations for this change:

- `Claude`
  - stored profile ID should reflect the direct API contract, for example `claude-api`
  - guided setup may remain API-key-based for now
  - the schema must still be able to represent a future OAuth-backed Claude variant without breaking compatibility
- `Gemini`
  - stored profile ID should reflect the direct Gemini API path, for example `gemini-direct`
  - guided setup may remain API-key-based for now
  - the schema must leave room for future OAuth-based and ADC-based Gemini variants with required project context
- `Manual OpenAI-compatible`
  - remains an endpoint-override-driven compatible profile
  - stays API-key-based in guided setup for this change

What matters is that Uraniborg no longer implies that these presets are just raw endpoint strings. Provider identity comes first, and guided acquisition support is a separate declared property of the profile metadata.

Rationale:

- fixes the OpenAI/Codex divergence without forcing this change to build every future auth path at once
- preserves a clean provider-centric contract for later work
- keeps guided setup limited to flows Uraniborg can honestly finish

### 6. Pi `AuthStorage` is the managed OAuth credential store

For browser-login-backed revision providers, the main Uraniborg config file must not embed access tokens, refresh tokens, or raw bearer material. Instead, Uraniborg must reuse Pi `AuthStorage` as the managed credential store and keep only the non-secret revision configuration and any required provider context in Uraniborg config.

The Pi-backed credential path must satisfy these design requirements:

- secure-at-rest filesystem permissions
- separation of secret token material from main config JSON
- explicit state for access token, refresh token if applicable, expiry, and provider/account metadata
- deterministic error modes when a referenced credential is missing, unreadable, expired without refresh support, or malformed
- no logging of bearer tokens, refresh tokens, or authorization headers

The implementation path for this change is not a fresh Uraniborg store. It is:

- use Pi `AuthStorage.login("openai-codex", ...)` or the equivalent Pi `openai-codex` OAuth provider path for guided login
- let Pi persist and refresh OAuth material
- use Pi `ModelRegistry` for provider-aware auth/model resolution where Uraniborg needs to inspect or validate revision readiness
- keep Uraniborg's own config focused on revision intent and durable operator choices

This change therefore narrows an earlier ambiguity: Uraniborg must integrate with Pi's existing auth system, not create a second one.

Rationale:

- matches the architecture's credential-handling expectations
- avoids turning the main config into a token dump
- makes `doctor` and setup failure modes more precise
- avoids duplicating already-solved Feynman/Pi OAuth behavior

### 7. `doctor` validates provider bootstrap completeness, while `revision --config` and `models` stay intentionally minimal

Operator-facing visibility splits into two responsibilities:

- `doctor` explains readiness
- `revision --config` and `models` show the configured revision choice

`doctor` must classify provider-aware revision readiness in this order:

1. unreadable or invalid config
2. stale pre-correction `version: 2` OpenAI/Codex config
3. missing provider/profile
4. invalid auth class or acquisition mode for the selected profile
5. missing credential binding
6. missing or unreadable Pi-managed credential state
7. missing required provider context such as account or project ID
8. missing default revision model
9. invalid endpoint override where the chosen profile permits one

`revision --config` output remains intentionally minimal:

- active revision provider/profile
- default revision model

`models` revision-side output remains intentionally minimal:

- active revision provider/profile
- default revision model

Neither surface should show:

- timeout
- temperature
- max output tokens
- credential source details
- endpoint overrides
- Pi credential details

Those details are preserved in config or used by readiness logic, but they are not part of the operator-facing visibility contract for this change.

Rationale:

- preserves the product decision already made for these surfaces
- prevents config display from becoming a secret-adjacent or low-signal dump
- keeps readiness detail in the surface intended for diagnosis

### 8. Migration must distinguish safe normalization from stale incompatible configs

The corrected design must define three migration paths.

#### 8.1 Legacy `version: 1`

Legacy endpoint-centric configs remain readable through normalization:

- recognized direct API endpoints map to their matching provider profile
- unknown compatible endpoints map to `manual-openai-compatible`
- inline API keys map to stored-secret credential bindings
- environment-variable API keys map to env-var credential bindings

#### 8.2 Pre-correction `version: 2`

The current branch's provider-aware schema remains readable, but its contents must be classified carefully:

- `Claude`, `Gemini`, and `Manual OpenAI-compatible` entries may normalize into corrected `version: 3` in-memory form where their profile/auth contract remains compatible
- `OpenAI/Codex` entries that point to `https://api.openai.com/v1` or use API-key auth must be treated as stale/incompatible, not silently upgraded

For stale pre-correction OpenAI/Codex config:

- passive reads do not rewrite the file
- `doctor` reports that revision setup must be rerun because the provider contract changed
- `revision --config` and `models` must not present that stale config as a healthy current OpenAI/Codex setup

#### 8.3 Corrected `version: 3`

All new guided revision setup writes only `version: 3`.

Rationale:

- preserves backward safety
- avoids inventing a fake migration from API-key OpenAI to ChatGPT OAuth
- makes the corrective upgrade path explicit and understandable

## Data Model Sketch

An illustrative corrected `version: 3` revision config shape:

```json
{
  "version": 3,
  "revision": {
    "profile": {
      "id": "openai-codex-chatgpt",
      "family": "openai-codex",
      "label": "OpenAI/Codex"
    },
    "auth": {
      "class": "oauth",
      "acquisition": "browser-login"
    },
    "credentialBinding": {
      "type": "pi-auth-storage",
      "providerId": "openai-codex"
    },
    "providerContext": {
      "accountId": "acct_..."
    },
    "endpoint": {
      "baseUrl": "https://chatgpt.com/backend-api",
      "overrideAllowed": false,
      "timeoutMs": 300000
    },
    "defaults": {
      "model": "codex-...",
      "temperature": 0.2
    }
  }
}
```

Illustrative corrected direct-API config for `Claude`:

```json
{
  "version": 3,
  "revision": {
    "profile": {
      "id": "claude-api",
      "family": "claude",
      "label": "Claude"
    },
    "auth": {
      "class": "api-key",
      "acquisition": "env-var"
    },
    "credentialBinding": {
      "type": "env-var",
      "envVar": "ANTHROPIC_API_KEY"
    },
    "endpoint": {
      "baseUrl": "https://api.anthropic.com",
      "overrideAllowed": false,
      "timeoutMs": 300000
    },
    "defaults": {
      "model": "claude-..."
    }
  }
}
```

These examples are illustrative of the contract shape. Exact field names can vary as long as the semantic separation remains intact and the resulting schema is deterministic.

## Risks / Trade-offs

- `[Correction increases near-term scope]` → accepted, because the current schema would otherwise harden the wrong provider contract.
- `[Pi integration increases dependency and wiring scope]` → accepted, because the architecture explicitly forbids rebuilding parallel auth infrastructure where Pi already provides it.
- `[Supporting three config generations increases loader complexity]` → isolate normalization logic and cover it with explicit regression tests.
- `[Claude and Gemini remain only partially bootstrap-aware in guided setup]` → document that distinction clearly in provider metadata so Uraniborg does not claim support it does not have.
- `[Operators with pre-correction OpenAI/Codex configs will need to rerun setup]` → surface that explicitly and avoid pretending an API-key config can be migrated into ChatGPT OAuth automatically.

## Migration Plan

1. Define the corrected `version: 3` revision schema and normalized in-memory revision model.
2. Add provider metadata that separates display labels, stable profile IDs, endpoint policy, auth class, and guided acquisition capabilities.
3. Implement config loaders for:
   - `version: 1`
   - pre-correction `version: 2`
   - corrected `version: 3`
4. Classify stale pre-correction OpenAI/Codex `version: 2` configs as requiring guided re-setup.
5. Add Pi-backed browser-login bootstrap for `OpenAI/Codex` through Pi `AuthStorage` and the built-in `openai-codex` OAuth provider.
6. Update `init` and `revision --setup` to write only corrected `version: 3` config on successful completion.
7. Update `doctor`, `revision --config`, and `models` to consume the corrected normalized revision view.
8. Add regression coverage for:
   - `version: 1` normalization
   - compatible `version: 2` normalization
   - stale `version: 2` OpenAI/Codex handling
   - successful and cancelled browser login flows
   - no passive rewrite during reads
   - successful upgrade writeback on setup completion

Rollback strategy:

- if the Pi-backed browser-login integration is not ready, Uraniborg should not ship the incorrect OpenAI/Codex API-key path as a substitute
- the safe fallback is to keep reading existing config generations while withholding corrected `version: 3` write paths for the affected profile until the browser-login setup path is complete

## Open Questions

- Should the first `OpenAI/Codex` browser-login implementation prefer a local loopback callback handler, or does the provider environment require an equivalent browser-return mechanism with a different callback strategy? This does not change the requirement that the flow be browser-initiated by Uraniborg, but it affects implementation detail and test harness design.
