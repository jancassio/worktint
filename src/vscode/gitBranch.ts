import * as path from "node:path";
import * as vscode from "vscode";

interface GitRepository {
	rootUri: vscode.Uri;
	state: { HEAD?: { name?: string }; onDidChange: vscode.Event<void> };
}
interface GitAPI {
	repositories: GitRepository[];
}

function getGitApi(): GitAPI | undefined {
	const ext = vscode.extensions.getExtension("vscode.git");
	return ext?.isActive ? ext.exports.getAPI(1) : undefined;
}

function findRepo(worktreePath: string): GitRepository | undefined {
	return getGitApi()?.repositories.find(
		(r) => r.rootUri.fsPath === worktreePath,
	);
}

export async function getBranch(worktreePath: string): Promise<string> {
	const ext = vscode.extensions.getExtension("vscode.git");
	if (ext && !ext.isActive) await ext.activate();
	return (
		findRepo(worktreePath)?.state.HEAD?.name ?? path.basename(worktreePath)
	);
}

export function onBranchChange(
	worktreePath: string,
	cb: () => void,
): vscode.Disposable {
	const repo = findRepo(worktreePath);
	return repo ? repo.state.onDidChange(cb) : new vscode.Disposable(() => {});
}
