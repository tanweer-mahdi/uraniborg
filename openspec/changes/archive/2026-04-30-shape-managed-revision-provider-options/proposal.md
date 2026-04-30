## Why

UAT showed that after fixing managed refinement failure classification, OpenAI/Codex now surfaces a provider-authored error directly:

- `{"detail":"Unsupported parameter: temperature"}`

This means Uraniborg’s Pi-managed revision execution path is still passing a generic option set into all providers, even when a provider/runtime does not support a given field.

The immediate known incompatibility is OpenAI/Codex rejecting `temperature`. Uraniborg should shape managed execution options per provider capability instead of assuming one generic option bundle fits every Pi-managed provider.

## What Changes

- Add provider-aware shaping for Pi-managed revision execution options.
- Omit unsupported fields for the OpenAI/Codex managed runtime path, specifically `temperature`.
- Preserve existing managed execution behavior for providers that can still accept the generic options currently used.
- Keep the operator-facing error handling from prior changes intact.

## Capabilities

### Modified Capabilities
- `iterative-draft-run`: managed revision execution must only send provider-compatible runtime options rather than a single unfiltered option set across all Pi-managed providers.

## Impact

- Affected code:
  - `src/refine/execution.ts`
  - managed refinement execution tests
- Affected operator behavior:
  - managed OpenAI/Codex revision requests no longer fail on unsupported `temperature`
