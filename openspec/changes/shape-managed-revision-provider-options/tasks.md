## 1. Managed Option Shaping

- [x] 1.1 Introduce provider-aware managed execution option shaping before calling Pi `completeSimple(...)`.
- [x] 1.2 Omit `temperature` for OpenAI/Codex managed refinement requests while preserving existing behavior for other currently supported managed providers.

## 2. Verification

- [x] 2.1 Add regression tests ensuring managed OpenAI/Codex refinement execution does not pass `temperature`.
- [x] 2.2 Run `npm run typecheck`, `npm test`, and `openspec validate shape-managed-revision-provider-options`.
