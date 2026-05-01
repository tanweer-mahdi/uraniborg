# Ink TUI Usage

Uraniborg now treats the Ink terminal UI as the primary interactive surface.

## Default behavior

- `uraniborg` opens the dashboard in an interactive TTY
- `uraniborg run <file>` opens `Run Setup` with the file preselected
- `uraniborg revision --setup`, `uraniborg revision --config`, `uraniborg doctor`, `uraniborg models`, `uraniborg history`, and `uraniborg resume <run-id>` deep-link into their matching Ink routes

## Bypassing Ink

Use `--no-ui` when you want Uraniborg to behave like a plain CLI instead of a stateful terminal app.

Typical cases:

- shell scripts
- CI
- piped output
- parallel experiment runs
- debugging a non-TUI path

Examples:

```bash
uraniborg --no-ui doctor
uraniborg run draft.md --no-ui --non-interactive --review-model openai-codex/gpt-5.2 --refine-model gpt-5.2 --iterations 1
```

Ink is also bypassed automatically when stdin or stdout is not attached to an interactive TTY, or when `--help` / `--version` is requested.
