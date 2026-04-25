## 1. Serialized Feynman Access

- [x] 1.1 Add a shared review-side runtime collector that resolves a compatible Feynman runtime and gathers readiness facts through serialized subprocess access
- [x] 1.2 Remove parallel Feynman subprocess probing from runtime discovery and command readiness collection paths
- [x] 1.3 Reuse the serialized runtime collector in `doctor`, `models`, `run`, and `resume`

## 2. Command Contract Alignment

- [x] 2.1 Update `uraniborg doctor` to render curated runtime and recommended-capability status without raw subprocess fragments
- [x] 2.2 Update `uraniborg models` to remain model-focused while consuming the same serialized runtime facts for shared readiness information
- [x] 2.3 Keep run and resume preflight behavior aligned with the shared serialized readiness path

## 3. Validation And Acceptance

- [x] 3.1 Add regression coverage proving Uraniborg does not overlap Feynman subprocess launches during discovery and readiness collection
- [x] 3.2 Add command-level tests for consistent `doctor`/`models` readiness facts and curated default output
- [ ] 3.3 Update UAT-facing notes and session handoff context for the Feynman corruption RCA and the Uraniborg-side mitigation
