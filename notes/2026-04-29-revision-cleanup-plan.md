# Revision Cleanup Plan - 2026-04-29

This note captures the stale and low-value code paths identified after the `align-revision-config-with-provider-interop` and `add-claude-gemini-pi-auth` changes landed in the working tree.

## Safe Now

These items are stale without carrying compatibility value and can be removed immediately.

- `src/config/app-config.ts`
  - remove dead `inferLegacyProfileId(...)`
  - collapse preview profile mapping for the only still-live preview branch: `manual-openai-compatible`
- `src/cli/commands/revision-setup.ts`
  - remove deprecated `claude-api` / `gemini-direct` branches from the default revision API-key env-var helper
- `src/config/index.ts`
  - prune internal barrel exports that have no current callers:
    - `createNodeConfigReadWriter`
    - `resolveRevisionSetupReadiness`
    - `resolveUraniborgConfigSecrets`
    - `UraniborgRevisionManagedCredentialState`
- `src/types/index.ts`
  - prune type barrel exports that have no current callers:
    - `UraniborgConfigLoadErrorCode`
    - `UraniborgRevisionAuthConfig`
    - `UraniborgRevisionEndpointConfig`
    - `UraniborgRevisionProfileSelection`
    - `UraniborgRevisionProviderContext`
    - `UraniborgRefineEndpointConfig`
- `src/config/revision-profiles.ts`
  - stop exporting `REVISION_PROFILES`; it is only used internally
- `package.json`
  - remove the direct `@modelcontextprotocol/sdk` dependency; it is not imported anywhere in `src/` or `tests/` and already arrives transitively through Pi dependencies

## Defer

These paths look retired, but still provide compatibility for stale config parsing, setup-seed loading, or current runtime reads.

- legacy stored profile ids `claude-api` and `gemini-direct`
- preview `version: 2` schema and normalization helpers
- stale browser-auth normalization helpers for legacy OpenAI/Codex, Claude, and Gemini configs
- `adc` / `ambient` handling kept only so stale Gemini direct configs still parse
- mirrored `refine.endpoint.apiKey` and `apiKeyEnvVar` compatibility fields while runtime execution still reads the `refine` mirror

These should not be removed until Uraniborg explicitly drops legacy config compatibility and migrates runtime consumers away from the `refine` mirror.

## Artifact Cleanup

These are not code removals, but the repo should reconcile them once the code cleanup is stable.

- `openspec/changes/align-revision-config-with-provider-interop/design.md`
  - still describes Claude and Gemini as API-key-first active profiles
- `openspec/changes/align-revision-config-with-provider-interop/tasks.md`
  - still leaves broad regression tasks open even though later work covered part of the behavior
- completed OpenSpec change folders and superseded handoff notes
  - archive when the branch is ready, do not delete ad hoc

## Suggested Commit Order

1. Remove dead revision helpers and unused exports/dependencies.
2. Reconcile stale OpenSpec bookkeeping and archive-ready artifacts.
3. Only after a deliberate legacy-support decision, remove compatibility paths tied to old stored configs.
