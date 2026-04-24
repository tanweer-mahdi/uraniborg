## 1. Runtime Contract Revision

- [ ] 1.1 Replace pinned-runtime-only assumptions in setup, doctor, models, and run-preflight modules with compatible Feynman runtime discovery
- [ ] 1.2 Implement compatibility validation and deterministic runtime selection when one or more `feynman` installations are available, and report the exact runtime Uraniborg selected
- [ ] 1.3 Update review-side remediation flows so missing or incompatible Feynman is reported without attempting to launch a Uraniborg-managed binary path

## 2. Refinement Setup Redesign

- [ ] 2.1 Redesign `uraniborg init` so the normal first-run path asks only for an OpenAI-compatible base URL, an API key, and a model name
- [ ] 2.2 Remove env-var-name prompts and hide timeout, temperature, max-output-token, and similar advanced refinement knobs from the default first-run path
- [ ] 2.3 Update refinement readiness logic so setup is only marked complete when required base URL, model, and API key inputs are available

## 3. Command Surface Alignment

- [ ] 3.1 Update `uraniborg doctor` output to report operational readiness for discovered Feynman runtime and runnable refinement setup
- [ ] 3.2 Update `uraniborg models` to show discovered review-model availability and configured refine base-URL/model readiness
- [ ] 3.3 Update run preflight to block on missing compatible Feynman or incomplete refinement setup while preserving recommended-only research warnings

## 4. Validation And Acceptance

- [ ] 4.1 Update automated tests to cover discovered-runtime readiness, missing/incompatible Feynman handling, deterministic multi-install selection reporting, and incomplete refinement setup
- [ ] 4.2 Add acceptance coverage for first-run `init` completing a runnable refinement configuration using only base URL, API key, and model name in the basic path
- [ ] 4.3 Re-run and update the UAT setup journey documentation to reflect the new first-run contract and command expectations
