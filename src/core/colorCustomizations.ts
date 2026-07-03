import type { PaletteColor } from "./palette";

export interface ChromeToggles {
	titleBar: boolean;
	activityBar: boolean;
	statusBar: boolean;
	editorTabs: boolean;
}

export const WORKTINT_KEYS: string[] = [
	"titleBar.activeBackground",
	"titleBar.activeForeground",
	"titleBar.inactiveBackground",
	"titleBar.inactiveForeground",
	"activityBar.background",
	"activityBar.foreground",
	"statusBar.background",
	"statusBar.foreground",
	"tab.activeBorderTop",
];

export function buildCustomizations(
	color: PaletteColor,
	t: ChromeToggles,
): Record<string, string> {
	const out: Record<string, string> = {};
	if (t.titleBar) {
		out["titleBar.activeBackground"] = color.background;
		out["titleBar.activeForeground"] = color.foreground;
		out["titleBar.inactiveBackground"] = color.background;
		out["titleBar.inactiveForeground"] = color.foreground;
	}
	if (t.activityBar) {
		out["activityBar.background"] = color.background;
		out["activityBar.foreground"] = color.foreground;
	}
	if (t.statusBar) {
		out["statusBar.background"] = color.background;
		out["statusBar.foreground"] = color.foreground;
	}
	if (t.editorTabs) {
		out["tab.activeBorderTop"] = color.accent;
	}
	return out;
}

export function mergeCustomizations(
	existing: Record<string, string>,
	ours: Record<string, string>,
): Record<string, string> {
	return { ...existing, ...ours };
}

// Iterate WORKTINT_KEYS (not Object.entries(prior)) so restore is robust when
// `prior` has been round-tripped through JSON storage, which silently drops keys
// whose value is `undefined`. Any Worktint key with no recorded prior value is
// deleted; any with a recorded value is put back exactly.
export function restoreCustomizations(
	current: Record<string, string>,
	prior: Record<string, string | undefined>,
): Record<string, string> {
	const out = { ...current };
	for (const k of WORKTINT_KEYS) {
		const v = prior[k];
		if (v === undefined) delete out[k];
		else out[k] = v;
	}
	return out;
}
