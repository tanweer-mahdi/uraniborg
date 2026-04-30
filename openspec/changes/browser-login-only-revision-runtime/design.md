## Context

The current codebase still contains three broad classes of no-longer-supported revision behavior:

1. Legacy config parsing and normalization
   - `version: 1` endpoint/API-key configs
   - `version: 2` preview configs
   - deprecated stored profile ids such as `claude-api` and `gemini-direct`

2. Manual-compatible runtime execution
   - endpoint-plus-API-key refinement transport
   - env-var / stored-secret credential binding
   - manual endpoint visibility in models/doctor/run snapshot surfaces

3. Setup and type-system branches for unsupported auth modes
   - API-key acquisition
   - env-var acquisition
   - ADC / ambient auth
   - endpoint override support

These branches no longer belong to the product contract. They should be removed instead of preserved as compatibility scaffolding.

## Goals / Non-Goals

**Goals**

- Make Uraniborg's revision contract browser-login-only for `OpenAI/Codex`, `Claude`, and `Gemini`.
- Remove legacy config parsing and passive normalization for non-supported revision contracts.
- Remove manual-compatible revision execution and related readiness/reporting paths.
- Tighten tests and config types so unsupported auth modes are unrepresentable.

**Non-Goals**

- Changing the review-side Feynman contract
- Adding new revision providers
- Changing the prompt contract or iterative run artifact structure
- Archiving notes/spec artifacts; that work is already separate

## Decisions

### 1. Revision config becomes current-contract-only

Uraniborg will only accept the current revision config contract for these profile ids:

- `openai-codex-chatgpt`
- `claude-browser`
- `gemini-cloud-code-assist`

Older config generations are no longer normalized. They are rejected as invalid/stale setup.

### 2. Revision auth becomes OAuth browser-login only

The only supported revision auth class is:

- `oauth`

The only supported acquisition is:

- `browser-login`

Credential binding becomes:

- `pi-auth-storage`

ADC, env-var, prompt-secret, and stored-secret revision bindings are removed.

### 3. Revision execution becomes Pi-managed only

All supported revision execution goes through the managed provider path.

The manual-compatible HTTP execution layer is removed.

### 4. Endpoint override is removed

Revision provider identity is fixed to the supported Pi-backed contracts. Uraniborg no longer exposes or stores custom revision endpoint overrides.

### 5. Legacy config rejection is explicit

If a user has an older Uraniborg revision config, the system should fail clearly and instruct them to rerun `uraniborg revision --setup`.

This is preferable to retaining silent normalization of unsupported contracts.

## Risks / Trade-offs

- [Risk] Existing local configs created before this cleanup will stop loading.  
  Mitigation: fail with explicit rerun-setup guidance.

- [Trade-off] This removes backward compatibility in favor of a cleaner and more honest product surface.  
  This is intentional and matches the stated product boundary.

- [Risk] Tests and helper fixtures currently encode old profile ids and auth modes.  
  Mitigation: remove or rewrite those tests as part of the same change.

## Migration Plan

1. Tighten canonical specs to browser-login-only revision support.
2. Remove legacy profile ids and unsupported auth/acquisition types from type and profile definitions.
3. Remove legacy config parsing and manual secret resolution.
4. Remove manual-compatible refinement execution and simplify to Pi-managed execution.
5. Update CLI setup/readiness/model-selection flows to support only the three active browser-login-backed profiles.
6. Rewrite tests to the supported contract.

Rollback strategy:

- restore the legacy config parsers and manual-compatible runtime path
- restore the removed profile/auth definitions
- revert the stricter spec deltas
