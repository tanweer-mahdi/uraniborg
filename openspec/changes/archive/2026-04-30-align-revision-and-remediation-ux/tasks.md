## 1. Remediation UX Alignment

- [x] 1.1 Add a dedicated web-search remediation action and map it to the Feynman-owned search-provider command path
- [x] 1.2 Implement an interactive web-search provider setup flow that collects provider choice and optional API key before launching Feynman configuration
- [x] 1.3 Replace raw default remediation completion and failure fragments with curated operator-facing messages
- [x] 1.4 Keep an explicit web-search provider management path available even when search status is already healthy

## 2. Revision Command Surface

- [x] 2.1 Add a `revision` command family with `revision --setup` routed to the guided configuration flow
- [x] 2.2 Implement `revision --config` with redacted configuration rendering and missing-config guidance
- [x] 2.3 Keep `uraniborg init` backward compatible by routing it through the same guided revision setup path

## 3. Operator-Facing Terminology Sweep

- [x] 3.1 Replace `refinement` with `revision` across operator-facing setup, readiness, model, and run-guidance text
- [x] 3.2 Preserve internal `refine.*` schema and implementation names while updating only user-facing rendering

## 4. Validation

- [x] 4.1 Add tests for web-search remediation routing, provider-input handling, and curated default remediation output
- [x] 4.2 Add tests for `revision --setup`, `revision --config`, backward-compatible `init`, and redacted config display
- [x] 4.3 Re-run focused CLI and host-shell validation for `doctor`, `init`, `revision --setup`, `revision --config`, and `models`
