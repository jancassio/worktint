# Contributing to Worktint

Thanks for considering a contribution. Worktint is a small, focused extension —
please keep changes scoped and tested.

## Toolchain

This project uses [Bun](https://bun.sh), not npm. Install Bun first, then:

```bash
bun install
```

## Common tasks

| Task | Command |
| --- | --- |
| Build the extension | `bun run build` |
| Run unit tests | `bun run test:unit` |
| Run integration tests | `bun run test:integration` |
| Lint | `bun run lint` |
| Type-check | `bun run typecheck` |

`test:unit` runs `bun test src/core src/vscode` — fast, framework-free tests.
`test:integration` uses `@vscode/test-electron`, which launches a real VS Code
instance, so it needs a display (or a virtual one like `xvfb` in CI).

## Running and debugging

Open the project in VS Code (or Codium) and press **F5**. This launches an
Extension Development Host with Worktint loaded, using the `Run Extension`
configuration in `.vscode/launch.json`. Set breakpoints in `src/` as usual.

## Architecture

- `src/core/` — pure, framework-free logic (no `vscode` import). Fully
  unit-tested with `bun test`. If you add logic here, add or update tests
  alongside it.
- `src/vscode/` — thin adapters that call the `vscode` API. Kept minimal so
  the interesting behavior lives in `core/` where it's easy to test.
- `src/controller.ts` — orchestrates `core/` and `vscode/` together.
- `src/extension.ts` — the extension's entry point (`activate`/`deactivate`).

When adding a feature, prefer putting the decision-making logic in `core/`
and only touching `vscode/`/`controller.ts` for wiring.

## Before opening a pull request

Make sure the following all pass:

```bash
bun run typecheck
bun run lint
bun run test:unit
bun run test:integration
```

- Keep `src/core/` framework-free — no `import ... from "vscode"` there.
- Add or update unit tests for any change to `src/core/`.
- Update `README.md` or the changelog if user-facing behavior changes.

## Commit style

Use short, imperative commit subjects, optionally scoped, e.g.:

```
fix(controller): serialize activate() so overlapping calls can't corrupt state
feat(core): add support for detached-HEAD worktrees
docs: clarify Bun setup in README
```

Keep commits focused — one logical change per commit — and prefer a small
number of clear commits over a single large one.

## Reporting bugs / requesting features

Please use the issue templates under `.github/ISSUE_TEMPLATE/` when filing
an issue. For security issues, see [SECURITY.md](SECURITY.md) instead of
opening a public issue.
