## Why

When `uraniborg doctor` cannot find Feynman on `PATH`, the current failure explains that Feynman is missing but does not give the user the exact install command. The next-step guidance should be immediately actionable for a new npm-installed user.

## What Changes

- Update missing-Feynman doctor guidance to include the exact command `npm install -g @companion-ai/feynman@latest`.
- Keep the existing distinction between missing Feynman, incompatible Feynman, and optional readiness gaps.
- Add regression coverage so the command is rendered when no Feynman runtime is discovered.

## Capabilities

### New Capabilities

### Modified Capabilities
- `environment-setup`: Add a precise doctor remediation command for the missing external Feynman prerequisite case.

## Impact

- Affects `uraniborg doctor` output for the `runtime_missing` / no-Feynman-on-`PATH` case.
- May touch the shared Feynman readiness/remediation text if doctor renders details from that layer.
- Does not install Feynman automatically and does not alter compatibility probing.
