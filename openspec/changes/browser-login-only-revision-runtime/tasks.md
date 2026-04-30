## 1. Spec Contract Tightening

- [x] 1.1 Update canonical spec deltas to remove manual-compatible revision runtime and legacy config compatibility requirements.
- [x] 1.2 Document explicit rerun-setup behavior for unsupported older revision configs.

## 2. Config And Type Cleanup

- [x] 2.1 Remove legacy revision profile ids, provider families, auth classes, acquisitions, and credential binding variants that are no longer supported.
- [x] 2.2 Remove legacy config parsing and passive normalization for `version: 1`, `version: 2`, and deprecated stored revision profiles.
- [x] 2.3 Remove endpoint override and manual-compatible runtime fields from config resolution and run snapshot surfaces.

## 3. Runtime And CLI Cleanup

- [x] 3.1 Remove manual-compatible refinement execution and keep Pi-managed revision execution only.
- [x] 3.2 Remove API-key/env-var/ADC branches from guided revision setup and related operator-facing flows.
- [x] 3.3 Update `doctor`, `models`, `run`, and `resume` behavior to assume only supported browser-login-backed revision providers.

## 4. Test Cleanup

- [x] 4.1 Remove or rewrite tests that rely on manual-compatible or deprecated revision profiles and auth modes.
- [x] 4.2 Update shared test helpers to model only supported revision providers.

## 5. Validation

- [x] 5.1 Run `npm run typecheck`.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Run `openspec validate browser-login-only-revision-runtime`.
