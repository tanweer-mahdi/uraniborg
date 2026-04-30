## Context

The managed revision runtime path currently builds one shared options object for `completeSimple(...)` and passes it to all Pi-managed providers.

That shared object currently includes:

- `apiKey`
- optional `headers`
- optional `signal`
- `temperature`
- optional `maxTokens`

UAT showed that OpenAI/Codex rejects `temperature` for the managed runtime path. Since Uraniborg is the direct caller supplying that option, the incompatibility sits at Uraniborg’s provider-option shaping boundary, not at the prompt contract or artifact layer.

## Goals / Non-Goals

**Goals:**

- Make Pi-managed revision execution provider-aware for request options.
- Stop sending `temperature` to OpenAI/Codex managed refinement requests.
- Preserve other managed provider behavior unless the change is required for the known compatibility fix.

**Non-Goals:**

- Add a full dynamic capability-negotiation layer across all providers.
- Redesign model selection or auth/bootstrap.
- Change the manual-compatible execution path.

## Decisions

### 1. Managed execution options are shaped by provider id before calling Pi

Instead of constructing one shared option set inline, Uraniborg should build managed runtime options through a provider-aware helper.

The first required rule is:

- for provider id `openai-codex`, omit `temperature`

Other shared options may remain if they are not known to break the provider.

### 2. The Codex fix should be narrow and explicit

The change should not invent speculative compatibility rules for other providers. It should codify the observed incompatibility:

- OpenAI/Codex managed refinement requests must not include `temperature`

This keeps the fix aligned with the current UAT evidence while leaving room for later provider-option shaping if other incompatibilities appear.

### 3. The provider-aware shaping seam should still be reusable

Even though the immediate rule is Codex-specific, the code should be structured as a provider-aware option builder rather than an inline one-off mutation. That keeps the next compatibility fix local and obvious.

## Risks / Trade-offs

- [Risk] Another provider may also reject one of the currently shared options. → Mitigation: keep the shaping helper provider-aware so later rules can be added locally.
- [Trade-off] The first pass is evidence-driven and narrow, not a complete provider capability model. → This is acceptable because the current need is a concrete UAT-unblocking fix.

## Migration Plan

1. Introduce a managed-option shaping helper in the Pi-managed revision execution path.
2. Omit `temperature` for `openai-codex`.
3. Add regression tests ensuring Codex-managed execution does not receive `temperature`.

Rollback strategy:

- revert the provider-specific shaping helper and restore the shared managed option object
- no config/schema rollback is required
