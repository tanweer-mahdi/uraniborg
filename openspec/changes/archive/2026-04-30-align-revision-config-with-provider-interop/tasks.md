## 1. Corrected Revision Schema And Provider Contracts

- [x] 1.1 Introduce the corrected `version: 3` revision config schema in `src/types/app-config.ts` and `src/config/app-config.ts` instead of continuing to write the pre-correction `version: 2` contract
- [x] 1.2 Refactor the revision profile catalog so stored profile IDs are architecture-oriented, provider labels remain `OpenAI/Codex`, `Claude`, `Gemini`, and `Manual OpenAI-compatible`, and each profile declares canonical base URL policy, endpoint override policy, auth classes, and guided acquisition modes
- [x] 1.3 Expand the normalized in-memory revision model so it separates provider profile, auth class, acquisition mode, credential binding, provider-context metadata, default model, and preserved advanced defaults
- [x] 1.4 Implement dual-read-plus-preview compatibility for legacy `version: 1`, pre-correction `version: 2`, and corrected `version: 3` configs without rewriting files during passive reads
- [x] 1.5 Classify pre-correction `version: 2` OpenAI/Codex configs that use the OpenAI Platform API or API-key auth as stale/incompatible and require guided re-setup rather than silent normalization
- [x] 1.6 Preserve advanced defaults such as `timeoutMs`, `temperature`, and `maxOutputTokens` across normalization and successful setup rewrites while keeping them out of `revision --config` and `models`

## 2. Pi Auth Integration And Browser Login Bootstrap

- [x] 2.1 Add Pi dependencies and introduce a narrow revision-auth integration layer that reuses Pi `AuthStorage`, Pi `ModelRegistry`, and the built-in `openai-codex` OAuth provider instead of creating a Uraniborg-owned OAuth store
- [x] 2.2 Implement the `OpenAI/Codex` browser-initiated login bootstrap flow through Pi `AuthStorage.login(...)`, including browser launch, callback/state validation, PKCE or equivalent verifier protection, and Pi-managed token persistence
- [x] 2.3 Capture and persist the required OpenAI/Codex account-context metadata alongside the Pi-managed provider binding so revision readiness can validate the provider contract
- [x] 2.4 Ensure failed, cancelled, or partial browser-login attempts do not write partial `version: 3` revision config and do not leave stale Uraniborg-side revision state behind
- [x] 2.5 Prevent guided setup from ever offering API-key acquisition for the `OpenAI/Codex` profile

## 3. Guided Revision Setup Redesign

- [x] 3.1 Refactor `uraniborg init` and `uraniborg revision --setup` to share one provider-bootstrap-aware revision setup flow
- [x] 3.2 Update the shared setup flow so provider selection drives auth/acquisition branching rather than endpoint-first prompts
- [x] 3.3 Implement the corrected `OpenAI/Codex` setup branch that completes browser login before asking for or confirming the default revision model
- [x] 3.4 Keep `Claude`, `Gemini`, and `Manual OpenAI-compatible` guided setup flows limited to auth-acquisition modes Uraniborg can actually complete in this change
- [x] 3.5 Support operator-managed endpoint override only for the manual compatible profile and keep preset provider endpoints subordinate to profile identity
- [x] 3.6 Write corrected `version: 3` config only after the entire guided setup completes successfully, including migration from legacy `version: 1` and compatible pre-correction `version: 2` configs

## 4. Revision Readiness And Operator Reporting

- [x] 4.1 Update revision readiness evaluation so `doctor` distinguishes stale pre-correction config, missing credential binding, unreadable Pi-managed credential state, missing provider context, missing default model, and invalid endpoint override
- [x] 4.2 Update `uraniborg revision --config` so it shows only the active revision provider/profile and default revision model while withholding credential, endpoint, and advanced-default detail
- [x] 4.3 Update `uraniborg models` so revision-side visibility shows only the active revision provider/profile and default revision model and does not present stale/incomplete config as healthy current setup
- [x] 4.4 Update operator-facing setup, migration, and readiness messages so they consistently use `revision` terminology and explicitly instruct rerunning setup when a stale pre-correction OpenAI/Codex config is detected

## 5. Tests And Validation

- [ ] 5.1 Add unit tests for `version: 1`, pre-correction `version: 2`, and corrected `version: 3` schema parsing, normalization, and stale-config classification
- [ ] 5.2 Add focused tests for Pi-auth-backed browser-login bootstrap success, callback validation failure, user cancellation, no-partial-write behavior, and Pi-credential-state resolution
- [ ] 5.3 Add CLI tests for corrected `init`, `revision --setup`, `revision --config`, `doctor`, and `models` behavior across `OpenAI/Codex`, `Claude`, `Gemini`, and `Manual OpenAI-compatible`
- [ ] 5.4 Add regression tests that compatible older configs remain readable, stale OpenAI/Codex preview configs are rejected with actionable guidance, and successful setup upgrades older configs to corrected `version: 3`
- [x] 5.5 Run `openspec validate align-revision-config-with-provider-interop` and the relevant TypeScript test suites after implementation
