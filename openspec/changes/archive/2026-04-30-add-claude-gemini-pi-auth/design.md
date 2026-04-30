## Context

The repository already completed the first corrective step for revision setup: Uraniborg now has a `version: 3` revision config, a Pi-backed revision auth bridge, and a browser-login implementation for `OpenAI/Codex`. `Claude` and `Gemini` still sit on the older side of that boundary. They are represented as provider-aware profiles, but guided setup still treats them as secret-entry flows instead of using the Pi-managed OAuth implementations described in [provider-interop-architecture.md](/Users/shahmahdihasan/uraniborg/provider-interop-architecture.md).

The architecture document is now specific enough to implement those paths without source-diving during implementation. It names the exact Pi provider identities and contracts that matter:

- Claude browser login maps to Pi provider `anthropic`
- Gemini browser login maps to Pi provider `google-gemini-cli`
- Gemini browser login produces provider-owned `projectId` context that must be present for readiness
- Pi `AuthStorage` owns OAuth persistence, refresh, and locking behavior

The design therefore extends the existing revision-auth/bootstrap model rather than introducing another credential system.

## Goals / Non-Goals

**Goals:**

- Make product-facing `Claude` revision setup use Pi's built-in `anthropic` browser-login flow.
- Make product-facing `Gemini` revision setup use Pi's built-in `google-gemini-cli` browser-login flow.
- Persist only Uraniborg-owned revision intent and Pi-aligned credential bindings in Uraniborg config, while keeping token material in Pi `AuthStorage`.
- Capture and validate required provider context, especially Gemini `projectId`, as part of revision readiness.
- Keep `init`, `revision --setup`, `doctor`, `revision --config`, and revision-side `models` aligned with the corrected provider/bootstrap contract.
- Add explicit stale-config handling for pre-browser-auth Claude and Gemini revision profiles.

**Non-Goals:**

- Implement `google-antigravity` as an exposed Uraniborg revision profile in this change.
- Implement Vertex, ADC, or enterprise Gemini variants.
- Build new OAuth callback servers, token stores, or refresh logic outside Pi.
- Add live model discovery or broader revision execution/runtime changes.
- Redesign the existing OpenAI/Codex Pi-auth path.

## Decisions

### 1. Product-facing Claude and Gemini move to browser-login-backed revision profiles

Uraniborg will no longer treat the product-facing `Claude` and `Gemini` presets as API-key-first setup flows. Instead:

- `Claude` maps to a Pi-backed browser-login profile bound to provider id `anthropic`
- `Gemini` maps to a Pi-backed browser-login profile bound to provider id `google-gemini-cli`

The implementation should introduce stable internal revision profile ids that reflect those contracts, for example:

- `claude-browser`
- `gemini-cloud-code-assist`

Alternatives considered:

- Keep `claude-api` and `gemini-direct` as the primary product-facing profiles and add browser auth as optional secondary paths.
  - Rejected because the user requested the browser-login mechanism as the intended Claude/Gemini path, and keeping the old profiles primary would preserve the same contract drift this change is meant to remove.
- Expose `google-antigravity` immediately as a second Gemini browser-login preset.
  - Rejected for this change because it expands both operator surface area and migration complexity before the default `google-gemini-cli` path is stable.

### 2. The existing revision-auth layer becomes the only Uraniborg-to-Pi auth seam

Uraniborg should extend `src/config/revision-auth.ts` rather than spreading Pi OAuth logic across CLI commands. That layer should provide the minimal primitives needed by setup and readiness code:

- launch Pi login for a specific revision provider
- inspect whether Pi has auth for that provider
- read provider-specific non-secret context from Pi-managed credentials
- classify Pi credential-state failures into deterministic Uraniborg-facing readiness states

Alternatives considered:

- Let each CLI command call Pi `AuthStorage` and `ModelRegistry` directly.
  - Rejected because it would duplicate provider-specific branching and make migration/readiness behavior harder to keep consistent.
- Persist a second Uraniborg-owned OAuth metadata file to avoid reading Pi state directly.
  - Rejected because it would duplicate source-of-truth state and create drift between Uraniborg config and Pi auth storage.

This decision also carries an explicit operator-facing trade-off: consent-screen branding comes from the OAuth client registrations bundled with Pi's built-in providers, not from Uraniborg. As a result, users may see upstream-tool or provider-native branding such as `Claude Code` or `Codex` during browser login even though the login was launched from Uraniborg.

Alternative considered:

- Register Uraniborg-owned OAuth clients so the browser consent screen shows Uraniborg branding.
  - Rejected for this change because it would require Uraniborg to stop relying purely on Pi built-ins and to take on provider-specific OAuth app registration, redirect-uri management, and long-term client maintenance.

### 3. Config writes remain all-or-nothing after successful provider bootstrap

The setup flow should keep its current all-or-nothing durability rule and extend it to Claude and Gemini browser auth:

1. User selects revision provider
2. Uraniborg launches the provider-specific Pi browser-login flow
3. Uraniborg validates the resulting Pi credential state and required provider context
4. Uraniborg prompts for or confirms the default revision model
5. Only then does Uraniborg write the updated `version: 3` config

If login is cancelled, state validation fails, or Gemini project discovery fails, Uraniborg must not write a partial revision profile.

Alternatives considered:

- Write the selected provider before login starts and patch the rest afterward.
  - Rejected because it would leave misleading partial config behind on failed or cancelled logins.

### 4. Existing API-key-based Claude and Gemini revision configs are treated as stale

This change should classify existing Claude/Gemini revision configs that point at the older API-key-based profile families as stale and require guided re-setup. Passive reads may still preserve the raw data for display and migration messaging, but `doctor`, `models`, and `revision --config` must not treat those configs as healthy browser-login-backed revision setup.

The intent is the same as the earlier OpenAI/Codex correction: once the durable contract changes from secret entry to Pi-managed browser auth, silent normalization becomes misleading.

Alternatives considered:

- Auto-convert `claude-api` and `gemini-direct` to the new browser-login profiles without re-authentication.
  - Rejected because there is no valid Pi-managed OAuth credential binding to infer from an API-key-only record.
- Preserve API-key Claude and Gemini as equally supported profiles under the same product-facing labels.
  - Rejected because it would make readiness semantics ambiguous and undermine the move to Pi-backed browser auth.

### 5. Gemini browser login is implemented only for `google-gemini-cli`, with `projectId` as required readiness state

For Gemini, the first-class browser-login implementation is Pi provider `google-gemini-cli`. Uraniborg should treat the resulting `projectId` as mandatory provider context:

- setup is incomplete if `projectId` is missing
- `doctor` should report missing project context distinctly from generic auth failure
- Uraniborg config may persist the non-secret `projectId` as provider context, but token material stays in Pi

Alternatives considered:

- Hide `projectId` entirely inside Pi and treat any successful login as complete.
  - Rejected because the architecture and Pi implementation both treat project context as part of the usable credential contract.
- Treat `google-antigravity` and `google-gemini-cli` as interchangeable.
  - Rejected because they have different provider ids, callback URIs, and endpoint defaults.

## Risks / Trade-offs

- [Risk] Existing users with working Claude or Gemini API-key config will need to rerun revision setup. → Mitigation: classify those configs explicitly as stale and point users to rerun `init` or `revision --setup`, while preserving the manual compatible profile as an API-key escape hatch.
- [Risk] Gemini browser login may fail because Pi cannot discover or provision `projectId` for the current account tier. → Mitigation: surface Pi's failure as provider-context-specific setup guidance and avoid writing partial config.
- [Risk] Pi credential inspection could become provider-specific branching spread across the codebase. → Mitigation: keep all Pi credential-state reads and provider-context extraction inside the revision-auth seam.
- [Risk] The new change could overfit to one Pi implementation detail and make future Gemini variants harder to add. → Mitigation: keep the durable config split between provider id, acquisition mode, credential binding, and provider context so future variants can add profiles without rewriting the whole schema.
- [Trade-off] Deferring `google-antigravity` keeps the change focused, but it means Uraniborg will not expose every Pi Gemini OAuth variant immediately. → Mitigation: document the deferral explicitly in the design and architecture notes so a follow-on change can add it cleanly.
- [Trade-off] Reusing Pi built-in OAuth providers means consent screens may show upstream-tool branding instead of `Uraniborg`. → Mitigation: document the behavior explicitly and treat Uraniborg-branded consent as a separate future decision requiring first-party OAuth client registration.
