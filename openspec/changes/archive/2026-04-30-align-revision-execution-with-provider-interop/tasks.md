## 1. Runtime Design Seams

- [x] 1.1 Introduce a revision execution adapter contract that separates Uraniborg prompt/parse ownership from provider-specific runtime transport and auth handling.
- [x] 1.2 Add execution-time revision runtime resolution in `src/config/` so managed profiles no longer flow through API-key-only secret resolution.
- [x] 1.3 Preserve the existing manual-compatible HTTP execution path as an explicit adapter implementation.

## 2. Managed Revision Execution

- [x] 2.1 Implement Pi-backed runtime execution for `openai-codex-chatgpt`.
- [x] 2.2 Implement Pi-backed runtime execution for `claude-browser`.
- [x] 2.3 Implement Pi-backed runtime execution for `gemini-cloud-code-assist`.
- [x] 2.4 Normalize managed execution results into Uraniborg-owned parsed output and sanitized log metadata.

## 3. Run Loop and Snapshot Integration

- [x] 3.1 Update the refinement step to call the revision execution layer instead of directly issuing OpenAI-compatible HTTP requests for all profiles.
- [x] 3.2 Update run snapshot and manifest-writing logic to record revision runtime identity, auth path, and non-secret provider context where applicable.
- [x] 3.3 Keep resume behavior reconstructable from local artifacts and manifest state without relying on persisted provider-side session ids.

## 4. CLI Readiness and Model UX

- [x] 4.1 Update `run` preflight to block on revision-runtime executability rather than API-key-only secret resolution for managed profiles.
- [x] 4.2 Update `doctor` output to report active-profile runtime executability for managed and manual-compatible profiles.
- [x] 4.3 Update `models` output and refine-model selection flow so revision reporting is profile-aware and runtime-readiness-aware.

## 5. Verification

- [x] 5.1 Add unit tests for revision runtime resolution, adapter selection, and sanitized log shaping.
- [x] 5.2 Add integration-style tests for managed profile refinement execution, manual-compatible fallback, and run preflight failures.
- [x] 5.3 Add resume/regression tests covering `refine_running` recovery without persisted provider session state.
- [x] 5.4 Run `npm run typecheck`, `npm test`, and `openspec validate align-revision-execution-with-provider-interop`.
