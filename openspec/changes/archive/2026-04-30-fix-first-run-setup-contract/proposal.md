## Why

UAT showed that Uraniborg's first-run setup contract is wrong in two important ways: it hard-requires a vendored Feynman runtime under `~/.uraniborg/vendor/feynman`, and it treats `init` as complete even when refinement is still not runnable. Those behaviors create artificial bootstrap blockers and a misleading setup journey for a core product path.

The next change should lock a more realistic first-run contract before implementation resumes. Uraniborg needs to work with a compatible user-available Feynman installation, and `init` needs to guide the user to an operational refinement configuration rather than collecting low-level internal fields that still leave setup incomplete.

## What Changes

- **BREAKING** Remove the requirement that Uraniborg must provision and run Feynman only from `~/.uraniborg/vendor/feynman`.
- Replace pinned-runtime-only behavior with a compatibility-based runtime contract: Uraniborg discovers a compatible Feynman installation, validates it, and explains remediation when it is missing or incompatible.
- Redefine `doctor` around operational readiness for both review and refinement, including clear reporting for missing Feynman, incompatible Feynman, missing refinement credentials, and incomplete refinement setup.
- Redesign `init` as a minimal first-run refinement setup flow that asks only for an OpenAI-compatible base URL, an API key, and a model name in the normal path.
- Tighten `models` and `run` preflight so they reflect the revised runtime-discovery contract and the revised refinement-readiness contract.
- Preserve Uraniborg's separation of ownership: Uraniborg still does not own Feynman internals, but it also no longer requires a Uraniborg-managed Feynman install location.
- Explicitly defer packaging/bin-path cleanup, run/resume execution fixes, and non-setup copy polish unless they are required by the revised setup contract.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `environment-setup`: change first-run bootstrap from pinned-runtime provisioning to compatible Feynman runtime discovery plus operational refinement setup.
- `model-selection`: change refinement model visibility and setup expectations so v1 uses a minimal base-URL, API-key, and model-name contract rather than provider-routing or env-var-name configuration.
- `iterative-draft-run`: change run preflight to validate discovered Feynman compatibility and runnable refinement setup instead of a pinned-runtime-only contract.

## Impact

- Affects CLI setup and readiness flows in `doctor`, `init`, `models`, and `run`.
- Changes the expected contents and semantics of `~/.uraniborg/config.json`.
- Removes the assumption that `~/.uraniborg/vendor/feynman` is required for normal operation.
- Requires updated readiness, onboarding, and UAT expectations across the setup journey.
