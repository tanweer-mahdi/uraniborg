## 1. Missing Feynman Guidance

- [ ] 1.1 Identify the existing missing-Feynman readiness/remediation path used by `uraniborg doctor`.
- [ ] 1.2 Add a single shared install command string for `npm install -g @companion-ai/feynman@latest`.
- [ ] 1.3 Ensure `uraniborg doctor` renders the exact install command when runtime status is `runtime_missing`.

## 2. Regression Coverage

- [ ] 2.1 Add or update a doctor test for the no-Feynman-on-`PATH` case that asserts the exact install command is visible.
- [ ] 2.2 Add or preserve coverage showing incompatible discovered runtimes remain compatibility failures rather than missing-runtime failures.

## 3. Validation

- [ ] 3.1 Run focused doctor/readiness tests covering the changed path.
- [ ] 3.2 Run `npm run typecheck`.
- [ ] 3.3 Run `openspec validate add-doctor-feynman-install-command`.
