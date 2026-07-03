import * as vscode from "vscode";
import type { ChromeToggles } from "../core/colorCustomizations";

export interface WorktintConfig {
	chromeEnabled: boolean;
	toggles: ChromeToggles;
	indicatorEnabled: boolean;
}

export function readConfig(): WorktintConfig {
	const c = vscode.workspace.getConfiguration("worktint");
	return {
		chromeEnabled: c.get("chrome.enabled", true),
		indicatorEnabled: c.get("statusBarIndicator.enabled", true),
		toggles: {
			titleBar: c.get("chrome.titleBar", true),
			activityBar: c.get("chrome.activityBar", true),
			statusBar: c.get("chrome.statusBar", true),
			editorTabs: c.get("chrome.editorTabs", true),
		},
	};
}
