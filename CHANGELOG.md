# Changelog

All notable changes to the "Worktint" extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0](https://github.com/jancassio/worktint/compare/worktint-v0.0.1...worktint-v0.1.0) (2026-07-04)


### Features

* controller orchestrating detection, assignment, layers, reset ([e0cc358](https://github.com/jancassio/worktint/commit/e0cc3588bc61d34bdc4cdba17847c84f51c07b50))
* **core:** add fnv1a stable hash ([1175f71](https://github.com/jancassio/worktint/commit/1175f717c2f8b2bec218c8a5ecc21bde4c6c848a))
* **core:** add pure tracked-settings guard decision function ([fd9cdc7](https://github.com/jancassio/worktint/commit/fd9cdc7fde57d67493b9e9ec341bb87efdd5591d))
* **core:** color customization build/merge/restore ([9913527](https://github.com/jancassio/worktint/commit/9913527abdeef36b1ad0cfe4597b77c74ea12533))
* **core:** curated light/dark palettes ([22fff8a](https://github.com/jancassio/worktint/commit/22fff8a20d66ee511965748d66f28645b6959c87))
* **core:** deterministic slot assignment with collision probing ([18d068d](https://github.com/jancassio/worktint/commit/18d068de31e564752d8daf9891db10c952c2cd00))
* **core:** git worktree detection ([93e6e2b](https://github.com/jancassio/worktint/commit/93e6e2bdeb76e092a0748d2e6574aeb3cb248b97))
* **core:** idempotent .git/info/exclude line editing ([f6fb574](https://github.com/jancassio/worktint/commit/f6fb574502062591da13b98c03273ef727fbcbe2))
* globalState-backed brain store ([c85344d](https://github.com/jancassio/worktint/commit/c85344dbd5540d0540f1934e8906e82f414707f3))
* VS Code adapters (config, git branch, status bar, settings writer) ([99fa6ab](https://github.com/jancassio/worktint/commit/99fa6ab0619d1f631e11d0dfc6ff040530b7fc80))
* wire extension activation, commands, watchers ([538a8c2](https://github.com/jancassio/worktint/commit/538a8c28e1abcbdaec5e5248ab1ebc364241b39f))


### Bug Fixes

* **controller:** persist and honor the tracked-settings guard choice every render ([119ea41](https://github.com/jancassio/worktint/commit/119ea41cdf61b12a94a6ac2ab5f16f061758d7a9))
* **controller:** resetAll no longer cross-contaminates other worktrees' recorded state ([6fcab44](https://github.com/jancassio/worktint/commit/6fcab442006e35aca76f8ce96c5542e8558c09ff))
* **controller:** serialize activate() so overlapping calls can't corrupt state ([3b7ef2f](https://github.com/jancassio/worktint/commit/3b7ef2fcbe592db4a08a8860c9840ccc8ef57feb))
* **controller:** surface activate() failures via output channel + warning instead of dropping them ([d3b5d00](https://github.com/jancassio/worktint/commit/d3b5d00e483d8772db1116ce74c93037b2ed0e63))
* **controller:** watch worktrees by absolute git-common-dir so linked worktrees see add/remove ([b13e129](https://github.com/jancassio/worktint/commit/b13e1293361e112d4353a97dd3f21f65ccda95b6))
* **core:** restore only Worktint keys so reset survives JSON round-trip ([097ab25](https://github.com/jancassio/worktint/commit/097ab2569e028a94c1dd0e68225340b186bee5f0))

## [0.0.1] - 2026-07-03

Initial MVP release.

### Added

- Dormant-by-default activation: Worktint stays fully inactive until a
  repository has more than one git worktree, and cleans up automatically when
  it drops back to a single worktree.
- Always-on status-bar indicator showing a colored dot and the current
  branch name, with zero files written and zero git footprint.
- Optional chrome tint that colors the title bar, activity bar, status bar,
  and the active editor-tab accent via `workbench.colorCustomizations`.
- Zero git footprint for the chrome tint: settings are written to the
  worktree's `.vscode/settings.json` and hidden from git via
  `.git/info/exclude`, never touching a tracked `.gitignore`. If
  `.vscode/settings.json` is already tracked, Worktint warns once and falls
  back to the status-bar indicator only.
- Deterministic, theme-aware color assignment seeded from each worktree's
  root path, with curated light and dark palettes (8 colors each) and
  collision probing.
- Four commands: `Worktint: Pick color for this worktree`,
  `Worktint: Reset this worktree`, `Worktint: Reset all`, and
  `Worktint: Toggle chrome coloring`.
- Six settings under the `worktint.*` namespace:
  `worktint.chrome.enabled`, `worktint.chrome.titleBar`,
  `worktint.chrome.activityBar`, `worktint.chrome.statusBar`,
  `worktint.chrome.editorTabs`, and `worktint.statusBarIndicator.enabled`.

[0.0.1]: https://github.com/jancassio/worktint/releases/tag/v0.0.1
