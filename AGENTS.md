# Repository Guidelines

## Project Structure & Module Organization
- Source lives in `src/` (or language root), tests in `tests/`, scripts in `scripts/`, docs in `docs/`, assets in `assets/`.
- Config files (e.g., `package.json`, `pyproject.toml`, `Cargo.toml`, `Makefile`) define commands and tooling. Prefer using these over ad‑hoc scripts.
- Example paths: `src/module/feature/`, `tests/unit/`, `tests/integration/`, `.github/workflows/` for CI.

## Build, Test, and Development Commands
- Install deps: use the project’s manager if present
  - Node: `npm ci` or `pnpm i --frozen-lockfile`
  - Python: `pip install -r requirements.txt` or `uv/poetry`
  - Rust: `cargo fetch`  ·  .NET: `dotnet restore`
- Build: `make build` or the ecosystem default (e.g., `npm run build`, `cargo build --release`).
- Test: `make test`, `npm test`, `pytest -q`, `dotnet test`, `cargo test`.
- Local run: `make dev`/`npm run dev`/`python -m <pkg>` as defined in config.

## Coding Style & Naming Conventions
- Use the formatters defined by the repo (e.g., `prettier`, `eslint --fix`, `black`, `ruff`, `rustfmt`, `gofmt`). Run before committing.
- Naming: PascalCase for types/classes, camelCase for functions/vars, SNAKE_CASE for constants. Files: language‑idiomatic (`kebab-case.ts`, `snake_case.py`).
- Keep functions small, pure when possible; prefer composition over inheritance.

## Testing Guidelines
- Place unit tests near code (`src/**/__tests__` or `tests/unit`) and integration tests in `tests/integration`.
- Naming: `*.spec.ts`, `test_*.py`, `*_test.go`, `FooTests.cs` as per language norms.
- Aim for meaningful coverage; add tests for new behavior and bug fixes. Run the full test suite locally.

## Commit & Pull Request Guidelines
- Commits: imperative, scoped messages. Prefer Conventional Commits if already used (e.g., `feat: add XYZ`).
- PRs: include purpose, scope, screenshots (for UI), and linked issues. Keep diffs focused and small. Note breaking changes and migration steps.

## Security & Configuration Tips
- Do not commit secrets. Use `.env.local` and add an example file (`.env.example`).
- Validate input, handle errors explicitly, and pin critical dependencies. Rotate keys on compromise.

## Agent‑Specific Instructions
- Keep patches minimal and targeted; update only related files.
- Use repo commands, not custom scripts; prefer `apply_patch` for edits.
- Avoid destructive ops; never rewrite history unless requested.
