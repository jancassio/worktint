# Worktint — Design Spec

**Date:** 2026-07-01
**Status:** Approved for planning
**Target editor:** VS Codium (VS Code–compatible; distributed via Open VSX)

---

## 1. Summary

Worktint is a VS Codium / VS Code extension that helps developers working with **multiple git worktrees of the same repository** tell their windows apart at a glance.

It stays completely dormant during ordinary solo work and only activates when a repository has **more than one worktree**. When active, it gives each worktree a **stable, unique, theme-appropriate color** rendered through two layers:

- **Layer 1 — status-bar indicator:** always on, renders entirely from extension code, writes **no files** and leaves **zero git footprint**.
- **Layer 2 — chrome tint:** optional (default on), tints window chrome (title bar, activity bar, status bar, editor-tab accent) by writing workspace settings, which are kept out of version control automatically.

The guiding promise: **install it and forget it — it lights up only when you have parallel worktrees, and it never dirties `git status`.**

## 2. Positioning

The "color VS Code windows per repo/branch/worktree" space already has entrants (Peacock, Git Repo Window Colors, Themetree, Git Worktree Color, Git Worktree UI Variants). Worktint's defensible wedge is the **intersection nobody nails cleanly**:

- **Zero config** — no rules, no manual color-picking; works the instant a second worktree appears.
- **Zero git footprint** — never dirties `git status`, never asks the user to edit `.gitignore` by hand.
- **Deterministic, curated, theme-aware palettes** — stable and accessible, never random, never ugly.

Peacock is manual and writes into the repo. Several worktree tools are automatic but still lean on user rules or leave settings-file residue. Worktint's story — _"automatic, and it never touches your repo"_ — is clean and ownable.

## 3. Approaches considered

- **Global/user-settings coloring** — _rejected._ The user `settings.json` is a single file shared by every window; `workbench.colorCustomizations` there cannot hold distinct per-window colors, so simultaneously open worktree windows would stomp each other.
- **Pure `.vscode/settings.json` (Peacock-style) as the whole product** — _rejected as the sole mechanism._ It dirties git and, for Peacock, requires manual color selection.
- **Chosen: private "brain" (extension storage) + two render layers.** Extension-private storage decides and remembers colors; a status-bar item renders the always-on cue with no files; workspace settings render the optional chrome tint, hidden from git via `.git/info/exclude`.

## 4. Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Brain (globalState — private, no repo files)             │
│  • worktree path -> assigned palette slot (stable, unique)│
│  • record of exactly which settings keys WE wrote         │
│  • per-worktree/user toggles & overrides                  │
└───────────────┬───────────────────────┬──────────────────┘
                │                        │
      ┌─────────▼─────────┐    ┌─────────▼──────────────────┐
      │ Layer 1: Status   │    │ Layer 2: Chrome tint        │
      │ bar item (always) │    │ (optional, default on)      │
      │ • colored dot     │    │ • writes workbench.color-   │
      │ • branch label    │    │   Customizations to         │
      │ • zero files      │    │   .vscode/settings.json     │
      └───────────────────┘    │ • hides it via              │
                               │   .git/info/exclude         │
                               └─────────────────────────────┘
```

### Units (each independently testable)

| Unit                 | Responsibility                                                                                              | Depends on                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `worktreeDetector`   | Locate git common dir; determine whether repo has >1 worktree; identify current worktree path               | filesystem only                         |
| `colorAssigner`      | Map worktree path -> palette slot (deterministic seed + per-repo collision probing); honor manual overrides | brain (pure data)                       |
| `paletteProvider`    | Provide light/dark preset palettes and select by theme kind                                                 | VS Code theme kind                      |
| `settingsWriter`     | Merge/restore `workbench.colorCustomizations` at Workspace scope without clobbering user values             | VS Code config API + brain              |
| `excludeEditor`      | Ensure `.vscode/settings.json` is listed in `.git/info/exclude`; detect tracked-file case                   | filesystem + git binary (opportunistic) |
| `statusBarIndicator` | Render colored dot + branch label + tooltip                                                                 | VS Code status bar API                  |
| `brain`              | Persist assignments, recorded writes, overrides, toggles                                                    | `globalState`                           |

**Design rule:** the brain and all pure logic (detection parsing, hash→slot assignment, collision probing, palette selection, exclude-file editing, colorCustomizations merge/restore) live in **framework-free modules** so they are unit-testable without an editor host.

## 5. Activation & worktree detection

- Trigger on folder open, and re-evaluate on git-dir changes via a `FileSystemWatcher`.
- Walk up from the opened folder to find `.git`:
  - `.git` is a **directory** → git common dir = that `.git`.
  - `.git` is a **file** containing `gitdir: …/worktrees/<id>` → git common dir = that path with `/worktrees/<id>` stripped.
- **Activate only if `<common-dir>/worktrees/` exists and is non-empty** (repo has more than one worktree). Otherwise remain fully dormant: no status bar item, no writes, no prompts.
- Re-evaluate when worktrees are added/removed so the extension lights up and darkens live.
- **Edge case — bare repositories:** a bare repo has no main working tree, so ">1 worktree" means ≥2 entries under `worktrees/`. For the common non-bare case, a non-empty `worktrees/` directory already implies >1 worktree (main + at least one linked).
- Branch name for the label comes from VS Code's **built-in Git extension API** (reactive to branch switches); no git-binary spawn on the common path.

## 6. Color assignment

- **Seed = worktree root path** — always present, stable, survives branch switches and detached HEAD. (Branch is displayed as a label but is _not_ used to compute color, which sidesteps the missing-branch problem.)
- **Preferred slot** = `hash(path) % paletteSize` — deterministic, so a given worktree tends to get the same color everywhere.
- **Uniqueness guarantee:** among worktrees _of the same repository_, if the preferred slot is already assigned to another worktree, probe to the next free slot and **persist** the assignment in the brain. Result: fully deterministic in the no-collision case, but never two identical colors within one repo.
- **Manual override:** a _Pick color for this worktree_ command pins a worktree to a chosen palette slot; stored in the brain and preferred over the computed slot.

## 7. Palettes (theme-aware, curated)

- Two hand-tuned preset palettes: **light-optimized** and **dark-optimized**, ~8–12 colors each. Every entry carries a matching **readable foreground** color.
- Select the active set from `window.activeColorTheme.kind` (Light / Dark / High-Contrast; High-Contrast maps to the nearest set). Re-apply on theme change.
- **Deferred to Pro:** deriving a palette from the active theme's actual accent colors ("smart palette").

## 8. Layer 1 — status-bar indicator (always-on, zero files)

- A `StatusBarItem` showing `● feature/login`, where the dot (`$(circle-filled)`) foreground is tinted to the worktree's palette color. (Status-bar item _foreground_ accepts arbitrary hex; _background_ is intentionally not used because VS Code restricts it to error/warning theme colors.)
- Tooltip: worktree name, branch, path, assigned color.
- This layer always works — even in repositories where chrome writes are declined — with no `.vscode` write and no git footprint.

## 9. Layer 2 — chrome tint (optional, default on)

- Writes `workbench.colorCustomizations` for the enabled elements — title bar, activity bar, status bar, editor-tab accent — to the worktree's `.vscode/settings.json` via `ConfigurationTarget.Workspace`.
- **Never clobbers the user:** read existing customizations, merge only Worktint's keys, and record in the brain exactly which keys/values were set so reset restores prior state precisely.
- **Keep git clean:** ensure `.vscode/settings.json` is listed in `.git/info/exclude` (local, untracked, shared across worktrees via the common git dir); the tracked `.gitignore` is never modified.
- **Edge case — already tracked:** if `.vscode/settings.json` is already committed, `.git/info/exclude` cannot hide it. Detect this (one opportunistic `git ls-files` check) and show a **one-time notification**: _"This repo tracks `.vscode/settings.json`; chrome coloring would modify it. Enable anyway / keep status-bar-only."_ Default is the safe choice (status-bar-only).
- **`window.titleBarStyle`:** title-bar tinting requires `custom`. If title-bar tinting is enabled but the style isn't `custom`, prompt once to set it (user-global); if declined, skip the title bar and note it. Other elements are unaffected.

## 10. Settings surface (zero-setup, but adjustable)

Sensible defaults; every option is optional.

| Setting                               | Default | Purpose                                 |
| ------------------------------------- | ------- | --------------------------------------- |
| `worktint.chrome.enabled`             | `true`  | Master toggle for the chrome-tint layer |
| `worktint.chrome.titleBar`            | `true`  | Tint the title bar                      |
| `worktint.chrome.activityBar`         | `true`  | Tint the activity bar                   |
| `worktint.chrome.statusBar`           | `true`  | Tint the status bar                     |
| `worktint.chrome.editorTabs`          | `true`  | Tint the active editor-tab accent       |
| `worktint.statusBarIndicator.enabled` | `true`  | Show the status-bar dot + branch label  |

Commands:

- _Worktint: Pick color for this worktree_
- _Worktint: Reset this worktree_
- _Worktint: Reset all_
- _Worktint: Toggle chrome coloring_

## 11. Lifecycle & cleanup

- **Apply** on activation, branch change, and theme change.
- **Reset** removes only Worktint's keys, restores prior values recorded in the brain, and removes the `.git/info/exclude` line if Worktint added it.
- If a repo's worktree count drops back to 1, Worktint stops managing that window and offers to clean up any prior writes.

## 12. Error handling

- No git / not a worktree repo → dormant and silent.
- Read-only filesystem or write failure → fall back to status-bar-only and notify once.
- Git extension absent → still function using filesystem detection; the label falls back to the worktree folder name.

## 13. Testing strategy

- **Pure unit tests (no VS Code host):** worktree detection/parsing, hash→slot assignment + collision probing, palette selection by theme kind, `.git/info/exclude` editing, `colorCustomizations` merge/restore.
- **Integration tests (`@vscode/test-electron`):** activation gating (dormant at 1 worktree, active at >1), config writes at Workspace scope, reset restoring prior state.

## 14. Out of scope for MVP (YAGNI / deferred to Pro)

- Smart palette derived from theme accent colors (**Pro**).
- Licensing / paywall infrastructure.
- Coloring non-worktree repositories.
- Multi-root `.code-workspace` handling.
- Color synchronization across machines.

---

## 15. Implementation progress (living)

**Branch:** `feat/worktint-mvp` · **Plan:** `docs/superpowers/plans/2026-07-02-worktint.md` · **Toolchain:** Bun (install + `bun build` + `bun test`) with `@vscode/test-electron`/`@vscode/test-cli` for integration tests, and **Biome** for lint/format (`biome.json`, recommended rules). Commands: unit tests `bun run test:unit` (= `bun test src/core src/vscode` — scoped so bare `bun test` doesn't try to load the `vscode`-importing integration specs or `dist-test/`); integration tests `bun run test:integration`; build `bun run build`; typecheck `bunx tsc --noEmit`; lint `bun run lint` (fix: `bun run lint:fix`). All are currently green. New/edited source must keep `bun run lint` clean (Biome defaults: tabs, double quotes, `node:` import protocol).

**Done (committed, TDD, 25 unit tests + 4 integration tests green):**

- Task 0 — Scaffolding: `package.json`, `tsconfig.json` (module/resolution = `node16`), `.gitignore`, `.vscode-test.mjs`, `.vscode/launch.json`, minimal `src/extension.ts`; deps installed.
- Task 1 — `src/core/hash.ts` (`fnv1a`).
- Task 2 — `src/core/worktree.ts` (`parseGitFile`, `detectWorktree(folderPath, FsLike)` → `WorktreeInfo`).
- Task 3 — `src/core/colorAssigner.ts` (`preferredSlot`, `assignSlot` with collision probing).
- Task 4 — `src/core/palette.ts` (`LIGHT_PALETTE`/`DARK_PALETTE` 8 each, `selectPalette`).
- Task 5 — `src/core/colorCustomizations.ts` (`buildCustomizations`, `mergeCustomizations`, `restoreCustomizations`, `WORKTINT_KEYS`).
- Task 6 — `src/core/excludeFile.ts` (`hasLine`, `ensureLine`, `removeLine`).
- Task 7 — `src/vscode/brain.ts` (`Brain` over `MementoLike`; `RepoState`, `WriteRecord`).
- Task 8 — `src/vscode/{config,gitBranch,statusBarIndicator,settingsWriter}.ts`. Note: `SettingsWriter.applyChrome(color, toggles, gitCommonDir)` (dropped the unused `worktreePath` param from the plan); `isSettingsTracked(worktreePath)` exported.
- Task 9 — `src/controller.ts` (`Controller`: `activate`, `resetThisWorktree`, `resetAll`, `pickColor`, `dispose`). Adds: cleanup when a repo drops to 1 worktree; revert-before-reapply so recorded `prior` stays the user's true state; title-bar keys only written when `window.titleBarStyle === 'custom'`.
- Task 10 — Wired `src/extension.ts` (value import of `vscode`): `Brain(context.globalState)` + `Controller`, `activate(workspaceFolders[0])`, the 4 commands, `onDidChangeConfiguration` re-activate, and a `**/.git/worktrees/**` `FileSystemWatcher`. Build + typecheck + lint clean. The interactive F5 smoke test is now covered by Task 11's automated equivalent.
- Task 11 — Integration tests (`@vscode/test-electron`, VS Code 1.127.0): `tsconfig.test.json` (emit to `dist-test`, `rootDir: src`, `include: ["src/test"]`, mocha types) and `src/test/integration/activation.test.ts` with 4 tests — activation, multi-worktree write + exclude line, `resetWorktree` restore + exclude removal, and single-worktree dormancy. The multi-worktree fixture is built in `.vscode-test.mjs` and opened via `workspaceFolder` (`--disable-workspace-trust`, 30s mocha timeout); the dormant case drives a fresh `Controller` against a temp solo repo. **Uncovered and fixed a real reset bug:** `WriteRecord.prior` (a `Record<string, string | undefined>`) loses its `undefined` entries when `globalState` serializes to JSON, so a fresh-workspace reset left the colors applied; `restoreCustomizations` now iterates `WORKTINT_KEYS` rather than `Object.entries(prior)`, deleting any key with no recorded prior value (commit `097ab25`, with a JSON-round-trip regression unit test).

- Task 12 — `README.md` (activation rule, two layers, zero-footprint promise, path-seeded deterministic colors, settings + commands tables, requirements, dev commands, scope). Final self-check green: 25 unit + 4 integration tests, `bun run build`, `bunx tsc --noEmit`, and `bun run lint` all clean.

**Status: MVP complete.** All plan tasks (0–12) are done and committed on `feat/worktint-mvp`. Out of scope for this release: smart-from-theme palette, licensing, non-worktree repo coloring, multi-root workspaces, cross-machine sync, and publishing to Open VSX.
