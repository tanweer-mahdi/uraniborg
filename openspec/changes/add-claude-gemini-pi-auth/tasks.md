## 1. Revision Profile And Config Contract

- [x] 1.1 Replace the current `Claude` and `Gemini` revision profile metadata with browser-login-backed profile definitions that map to Pi provider ids `anthropic` and `google-gemini-cli`
- [x] 1.2 Extend the normalized revision config model so Claude and Gemini browser-login profiles persist Pi-managed credential bindings and required non-secret provider context such as Gemini `projectId`
- [x] 1.3 Implement stale-config classification and passive-read compatibility for older API-key-based Claude and Gemini revision records

## 2. Pi Auth Integration

- [x] 2.1 Extend the revision-auth integration layer to launch Pi `AuthStorage.login(...)` for `anthropic` and `google-gemini-cli`
- [x] 2.2 Add provider-specific Pi credential inspection helpers for Claude and Gemini, including Gemini `projectId` extraction and readiness classification
- [x] 2.3 Ensure cancelled, failed, or incomplete Claude and Gemini browser-login flows do not write partial Uraniborg revision config

## 3. Guided Setup And Reporting

- [x] 3.1 Update the shared `init` and `revision --setup` flow so selecting `Claude` or `Gemini` runs the correct Pi browser-login bootstrap before writing config
- [x] 3.2 Update `doctor` to report Claude and Gemini Pi-managed credential failures and missing Gemini project context with provider-specific remediation guidance
- [x] 3.3 Update `revision --config` and revision-side `models` so they display the active Claude or Gemini browser-login-backed profile and default model without exposing Pi credential internals

## 4. Tests And Validation

- [x] 4.1 Add unit tests for Claude and Gemini profile normalization, stale-config classification, and browser-auth-backed config persistence
- [x] 4.2 Add focused tests for Claude and Gemini Pi login success, cancellation, callback/state failure handling, Gemini project-context enforcement, and no-partial-write behavior
- [x] 4.3 Add CLI tests for `init`, `revision --setup`, `doctor`, `revision --config`, and `models` across Claude and Gemini browser-login flows
- [x] 4.4 Run `openspec validate add-claude-gemini-pi-auth` and the relevant TypeScript test suites after implementation
