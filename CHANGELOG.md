# Changelog

All notable changes to the "Worktint" extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/jancassio/worktint/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/jancassio/worktint/releases/tag/v0.0.1
