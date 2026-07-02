import * as vscode from 'vscode';
import * as fs from 'fs';
import { detectWorktree, type WorktreeInfo } from './core/worktree';
import { assignSlot } from './core/colorAssigner';
import { selectPalette, type ThemeKind, type PaletteColor } from './core/palette';
import type { ChromeToggles } from './core/colorCustomizations';
import { Brain, type RepoState } from './vscode/brain';
import { SettingsWriter, isSettingsTracked } from './vscode/settingsWriter';
import { StatusBarIndicator } from './vscode/statusBarIndicator';
import { readConfig } from './vscode/config';
import { getBranch, onBranchChange } from './vscode/gitBranch';

function themeKind(): ThemeKind {
  switch (vscode.window.activeColorTheme.kind) {
    case vscode.ColorThemeKind.Light:
      return 'light';
    case vscode.ColorThemeKind.HighContrast:
      return 'highContrast';
    case vscode.ColorThemeKind.HighContrastLight:
      return 'highContrastLight';
    default:
      return 'dark';
  }
}

export class Controller {
  private indicator = new StatusBarIndicator();
  private writer = new SettingsWriter();
  private info: WorktreeInfo | null = null;
  private color: PaletteColor | undefined;
  private subscriptions: vscode.Disposable[] = [];
  private titleBarPrompted = false;

  constructor(private brain: Brain) {}

  async activate(folderPath: string): Promise<void> {
    this.clearSubscriptions();
    const info = detectWorktree(folderPath, fs);
    this.info = info;
    this.color = undefined;

    if (!info) {
      this.indicator.hide();
      return;
    }

    if (!info.isMultiWorktree) {
      // Repo dropped back to a single worktree — clean up anything we applied here.
      const state = this.brain.getRepoState(info.gitCommonDir);
      const existing = state.writes[info.worktreePath];
      if (existing) {
        await this.writer.revertChrome(existing, info.gitCommonDir);
        delete state.writes[info.worktreePath];
        this.brain.setRepoState(info.gitCommonDir, state);
      }
      this.indicator.hide();
      return;
    }

    const palette = selectPalette(themeKind());
    const state = this.brain.getRepoState(info.gitCommonDir);
    const slot = assignSlot(
      info.worktreePath,
      state.assignments,
      palette.length,
      state.overrides[info.worktreePath],
    );
    state.assignments[info.worktreePath] = slot;
    this.color = palette[slot];
    this.brain.setRepoState(info.gitCommonDir, state);

    await this.render(state);

    this.subscriptions.push(
      onBranchChange(info.worktreePath, () => void this.renderIndicator()),
      vscode.window.onDidChangeActiveColorTheme(() => void this.activate(folderPath)),
    );
  }

  private async render(state: RepoState): Promise<void> {
    await this.renderIndicator();

    const info = this.info;
    if (!info || !this.color) return;
    const cfg = readConfig();

    const existing = state.writes[info.worktreePath];

    if (!cfg.chromeEnabled) {
      if (existing) {
        await this.writer.revertChrome(existing, info.gitCommonDir);
        delete state.writes[info.worktreePath];
        this.brain.setRepoState(info.gitCommonDir, state);
      }
      return;
    }

    // Tracked-file guard: don't silently dirty a committed .vscode/settings.json.
    if (isSettingsTracked(info.worktreePath) && !state.trackedAck) {
      const choice = await vscode.window.showWarningMessage(
        'Worktint: this repo tracks .vscode/settings.json. Chrome coloring would modify a tracked file.',
        'Enable anyway',
        'Status bar only',
      );
      state.trackedAck = true;
      this.brain.setRepoState(info.gitCommonDir, state);
      if (choice !== 'Enable anyway') return;
    }

    // Revert any previous write first so the recorded "prior" stays the user's true state.
    if (existing) {
      await this.writer.revertChrome(existing, info.gitCommonDir);
      delete state.writes[info.worktreePath];
    }

    const record = await this.writer.applyChrome(this.color, this.effectiveToggles(cfg.toggles), info.gitCommonDir);
    state.writes[info.worktreePath] = record;
    this.brain.setRepoState(info.gitCommonDir, state);
  }

  private effectiveToggles(toggles: ChromeToggles): ChromeToggles {
    const style = vscode.workspace.getConfiguration('window').get<string>('titleBarStyle');
    if (toggles.titleBar && style !== 'custom') {
      if (!this.titleBarPrompted) {
        this.titleBarPrompted = true;
        void vscode.window
          .showInformationMessage(
            'Worktint: set window.titleBarStyle to "custom" to also tint the title bar.',
            'Set it',
          )
          .then((c) => {
            if (c === 'Set it') {
              void vscode.workspace
                .getConfiguration('window')
                .update('titleBarStyle', 'custom', vscode.ConfigurationTarget.Global);
            }
          });
      }
      return { ...toggles, titleBar: false };
    }
    return toggles;
  }

  private async renderIndicator(): Promise<void> {
    const info = this.info;
    const cfg = readConfig();
    if (!info || !this.color || !cfg.indicatorEnabled) {
      this.indicator.hide();
      return;
    }
    const branch = await getBranch(info.worktreePath);
    this.indicator.render(this.color, branch, `Worktint · ${info.worktreePath}\nBranch: ${branch}`);
  }

  async resetThisWorktree(): Promise<void> {
    const info = this.info;
    if (!info) return;
    const state = this.brain.getRepoState(info.gitCommonDir);
    const record = state.writes[info.worktreePath];
    if (record) await this.writer.revertChrome(record, info.gitCommonDir);
    delete state.writes[info.worktreePath];
    delete state.assignments[info.worktreePath];
    delete state.overrides[info.worktreePath];
    this.brain.setRepoState(info.gitCommonDir, state);
    this.indicator.hide();
  }

  async resetAll(): Promise<void> {
    const info = this.info;
    if (!info) return;
    const state = this.brain.getRepoState(info.gitCommonDir);
    for (const record of Object.values(state.writes)) {
      await this.writer.revertChrome(record, info.gitCommonDir);
    }
    this.brain.setRepoState(info.gitCommonDir, { assignments: {}, overrides: {}, writes: {} });
    this.indicator.hide();
  }

  async pickColor(): Promise<void> {
    const info = this.info;
    if (!info) return;
    const palette = selectPalette(themeKind());
    const picked = await vscode.window.showQuickPick(
      palette.map((c, i) => ({ label: `$(circle-filled) Color ${i + 1}`, description: c.background, index: i })),
      { placeHolder: 'Pick a color for this worktree' },
    );
    if (!picked) return;
    const state = this.brain.getRepoState(info.gitCommonDir);
    state.overrides[info.worktreePath] = picked.index;
    this.brain.setRepoState(info.gitCommonDir, state);
    await this.activate(info.worktreePath);
  }

  private clearSubscriptions(): void {
    for (const d of this.subscriptions) d.dispose();
    this.subscriptions = [];
  }

  dispose(): void {
    this.clearSubscriptions();
    this.indicator.dispose();
  }
}
