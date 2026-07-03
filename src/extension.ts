import * as vscode from "vscode";
import { Controller } from "./controller";
import { Brain } from "./vscode/brain";

let controller: Controller | undefined;

export function activate(context: vscode.ExtensionContext): void {
	const brain = new Brain(context.globalState);
	controller = new Controller(brain);

	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (folder) void controller.activate(folder);

	context.subscriptions.push(
		vscode.commands.registerCommand("worktint.pickColor", () =>
			controller?.pickColor(),
		),
		vscode.commands.registerCommand("worktint.resetWorktree", () =>
			controller?.resetThisWorktree(),
		),
		vscode.commands.registerCommand("worktint.resetAll", () =>
			controller?.resetAll(),
		),
		vscode.commands.registerCommand("worktint.toggleChrome", async () => {
			const c = vscode.workspace.getConfiguration("worktint");
			await c.update(
				"chrome.enabled",
				!c.get("chrome.enabled", true),
				vscode.ConfigurationTarget.Global,
			);
			if (folder) void controller?.activate(folder);
		}),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("worktint") && folder)
				void controller?.activate(folder);
		}),
		{ dispose: () => controller?.dispose() },
	);
}

export function deactivate(): void {
	controller?.dispose();
}
