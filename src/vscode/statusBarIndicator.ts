import * as vscode from 'vscode';
import type { PaletteColor } from '../core/palette';

export class StatusBarIndicator {
  private item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  render(color: PaletteColor, label: string, tooltip: string): void {
    this.item.text = `$(circle-filled) ${label}`;
    this.item.color = color.accent;
    this.item.tooltip = tooltip;
    this.item.show();
  }

  hide(): void {
    this.item.hide();
  }

  dispose(): void {
    this.item.dispose();
  }
}
