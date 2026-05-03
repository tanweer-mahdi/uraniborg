# Uraniborg Packaging Decisions

This note is the concise reference for the locked packaging decisions on `feat/node-bin-packaging`.

The full rationale lives in:

- [openspec/changes/npm-packaging-distribution/proposal.md](../openspec/changes/npm-packaging-distribution/proposal.md)
- [openspec/changes/npm-packaging-distribution/design.md](../openspec/changes/npm-packaging-distribution/design.md)
- [notes/uraniborg-npm-release-gate.md](./uraniborg-npm-release-gate.md)

## Locked Decisions

1. Feynman is an external prerequisite. Uraniborg does not bundle or provision it.
2. npm is the first distribution channel in scope.
3. Uraniborg is distributed as a CLI-only package.
4. Node.js is an explicit prerequisite. No standalone distribution contract is part of this change.
5. The production build must emit a clean runtime-oriented `dist/` layout, and tests must not be emitted into production artifacts.
6. The published npm package must be minimal and must exclude development artifacts such as tests, notes, OpenSpec files, and internal workflow materials.
7. Releases are manually gated in this phase. CI may validate but does not auto-publish yet.
8. First-class support is limited to:
   - macOS arm64
   - macOS x64
   - Linux x64
   - Windows x64
9. Feynman compatibility is capability-first. Version range is confidence metadata, not the sole runtime gate.
10. Public install and troubleshooting docs must be explicit about prerequisites and should start from `npm install -g uraniborg` followed by `uraniborg doctor`.
