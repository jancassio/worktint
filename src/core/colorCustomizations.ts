import type { PaletteColor } from './palette';

export interface ChromeToggles {
  titleBar: boolean;
  activityBar: boolean;
  statusBar: boolean;
  editorTabs: boolean;
}

export const WORKTINT_KEYS: string[] = [
  'titleBar.activeBackground',
  'titleBar.activeForeground',
  'titleBar.inactiveBackground',
  'titleBar.inactiveForeground',
  'activityBar.background',
  'activityBar.foreground',
  'statusBar.background',
  'statusBar.foreground',
  'tab.activeBorderTop',
];

export function buildCustomizations(color: PaletteColor, t: ChromeToggles): Record<string, string> {
  const out: Record<string, string> = {};
  if (t.titleBar) {
    out['titleBar.activeBackground'] = color.background;
    out['titleBar.activeForeground'] = color.foreground;
    out['titleBar.inactiveBackground'] = color.background;
    out['titleBar.inactiveForeground'] = color.foreground;
  }
  if (t.activityBar) {
    out['activityBar.background'] = color.background;
    out['activityBar.foreground'] = color.foreground;
  }
  if (t.statusBar) {
    out['statusBar.background'] = color.background;
    out['statusBar.foreground'] = color.foreground;
  }
  if (t.editorTabs) {
    out['tab.activeBorderTop'] = color.accent;
  }
  return out;
}

export function mergeCustomizations(
  existing: Record<string, string>,
  ours: Record<string, string>,
): Record<string, string> {
  return { ...existing, ...ours };
}

export function restoreCustomizations(
  current: Record<string, string>,
  prior: Record<string, string | undefined>,
): Record<string, string> {
  const out = { ...current };
  for (const [k, v] of Object.entries(prior)) {
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}
