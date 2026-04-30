## Why

Uraniborg now has Pi-backed revision identity and auth/bootstrap for `OpenAI/Codex`, `Claude`, and `Gemini`, but the iterative refinement runtime still executes as if every revision provider were an OpenAI-compatible `chat/completions` endpoint plus API key. That leaves the core loop unable to honestly run the provider contracts the configuration layer now advertises.

## What Changes

- Add a provider-neutral revision execution layer that keeps Uraniborg responsible for prompt assembly, output parsing, artifact writes, and state transitions while delegating provider-specific auth and transport shaping to Pi.
- Introduce a dedicated revision-provider-execution capability that defines runtime credential resolution, adapter behavior, sanitized logging, and manual OpenAI-compatible fallback rules.
- Update the iterative run contract so the refinement step executes through the revision execution layer instead of assuming direct endpoint-plus-API-key HTTP.
- Update run recovery requirements so resume correctness continues to rely on local artifacts and manifest state rather than provider conversation/session state.
- Update model visibility and selection requirements so revision model reporting and run-time selection reflect the active revision profile and runtime readiness, not just a stored endpoint string.
- Update environment and doctor readiness requirements so managed revision profiles are validated as executable through Pi-backed runtime resolution, while `manual-openai-compatible` remains the explicit API-key fallback.

## Capabilities

### New Capabilities
- `revision-provider-execution`: Provider-neutral revision runtime execution, including Pi-managed auth resolution, adapter boundaries, sanitized request/response telemetry, and manual compatible fallback behavior.

### Modified Capabilities
- `iterative-draft-run`: The refinement step changes from direct OpenAI-compatible HTTP execution to provider-neutral revision execution while preserving the deterministic artifact loop.
- `run-recovery-and-history`: Resume semantics must explicitly remain independent of provider-side session continuity and reconstructable from local manifest state and artifacts.
- `model-selection`: Revision model visibility and run-time refine model selection must reflect the active revision profile and execution path rather than only endpoint configuration.
- `environment-setup`: Doctor and preflight readiness must validate executable revision runtime state for Pi-managed profiles and manual-compatible fallback.

## Impact

- Affected code:
  - `src/refine/`
  - `src/loop/run-execution.ts`
  - `src/run/manifest.ts`
  - `src/config/`
  - `src/cli/commands/run.ts`
  - `src/cli/commands/models.ts`
  - `src/cli/commands/doctor.ts`
- Affected dependencies and systems:
  - Pi `AuthStorage`
  - Pi `ModelRegistry`
  - provider-specific Pi execution/runtime helpers
- Affected operator behavior:
  - managed revision profiles become runnable through the iterative loop
  - run snapshots and diagnostics become profile-aware instead of API-key-endpoint-centric
