import * as assert from "node:assert";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { Controller } from "../../controller";
import { WORKTINT_KEYS } from "../../core/colorCustomizations";
import { detectWorktree } from "../../core/worktree";
import { Brain, type MementoLike } from "../../vscode/brain";

const EXTENSION_ID = "jancassio.worktint";
const HEX = /^#[0-9a-fA-F]{6}$/;
const EXCLUDE_LINE = ".vscode/settings.json";

function workbenchColors(): Record<string, string> {
	return (
		vscode.workspace
			.getConfiguration("workbench")
			.get<Record<string, string>>("colorCustomizations") ?? {}
	);
}

function excludeHasLine(gitCommonDir: string): boolean {
	const p = path.join(gitCommonDir, "info", "exclude");
	if (!fs.existsSync(p)) return false;
	return fs.readFileSync(p, "utf8").split("\n").includes(EXCLUDE_LINE);
}

async function waitFor(
	predicate: () => boolean,
	timeoutMs = 10000,
): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error("waitFor: condition not met before timeout");
		}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
}

function fakeMemento(): MementoLike {
	const store = new Map<string, unknown>();
	return {
		get: (key: string) => store.get(key) as never,
		update: (key: string, value: unknown) => {
			store.set(key, value);
		},
	};
}

suite("Worktint activation", () => {
	test("extension activates", async () => {
		const ext = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(ext, "extension is installed");
		await ext.activate();
		assert.ok(ext.isActive, "extension is active");
	});

	test("multi-worktree workspace gets a chrome tint and an exclude line", async () => {
		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		assert.ok(folder, "a workspace folder is open");

		const info = detectWorktree(folder, fs);
		assert.ok(
			info?.isMultiWorktree,
			"workspace is a linked worktree of a multi-worktree repo",
		);

		// Activation applies chrome asynchronously (fire-and-forget); wait for the write.
		await waitFor(
			() => typeof workbenchColors()["statusBar.background"] === "string",
		);
		assert.match(workbenchColors()["statusBar.background"], HEX);

		assert.ok(
			excludeHasLine(info.gitCommonDir),
			".vscode/settings.json is hidden via .git/info/exclude",
		);
	});

	test("resetWorktree restores colors and removes the exclude line", async () => {
		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		assert.ok(folder, "a workspace folder is open");
		const info = detectWorktree(folder, fs);
		assert.ok(info, "workspace is a worktree");

		await vscode.commands.executeCommand("worktint.resetWorktree");

		await waitFor(
			() => workbenchColors()["statusBar.background"] === undefined,
		);
		for (const key of WORKTINT_KEYS) {
			assert.strictEqual(
				workbenchColors()[key],
				undefined,
				`${key} was removed`,
			);
		}

		assert.ok(!excludeHasLine(info.gitCommonDir), "exclude line was removed");
	});

	test("single-worktree repo stays dormant (no writes)", async () => {
		const soloRepo = fs.mkdtempSync(path.join(os.tmpdir(), "worktint-solo-"));
		execFileSync("git", ["init", soloRepo], { stdio: "ignore" });
		execFileSync("git", ["-C", soloRepo, "config", "user.email", "t@t"], {
			stdio: "ignore",
		});
		execFileSync("git", ["-C", soloRepo, "config", "user.name", "T"], {
			stdio: "ignore",
		});
		execFileSync(
			"git",
			["-C", soloRepo, "commit", "--allow-empty", "-m", "init"],
			{ stdio: "ignore" },
		);

		const info = detectWorktree(soloRepo, fs);
		assert.ok(info && !info.isMultiWorktree, "solo repo is not multi-worktree");

		const controller = new Controller(new Brain(fakeMemento()));
		await controller.activate(soloRepo);
		controller.dispose();

		assert.ok(
			!fs.existsSync(path.join(soloRepo, ".vscode", "settings.json")),
			"no .vscode/settings.json written for a dormant repo",
		);
		assert.ok(
			!excludeHasLine(info.gitCommonDir),
			"no exclude line written for a dormant repo",
		);
	});

	test("a previously chosen 'Status bar only' is honored on a later activation", async () => {
		const repo = fs.mkdtempSync(path.join(os.tmpdir(), "worktint-tracked-"));
		execFileSync("git", ["init", repo], { stdio: "ignore" });
		execFileSync("git", ["-C", repo, "config", "user.email", "t@t"], {
			stdio: "ignore",
		});
		execFileSync("git", ["-C", repo, "config", "user.name", "T"], {
			stdio: "ignore",
		});
		fs.mkdirSync(path.join(repo, ".vscode"));
		fs.writeFileSync(path.join(repo, ".vscode", "settings.json"), "{}\n");
		execFileSync("git", ["-C", repo, "add", ".vscode/settings.json"], {
			stdio: "ignore",
		});
		execFileSync("git", ["-C", repo, "commit", "-m", "init"], {
			stdio: "ignore",
		});
		execFileSync(
			"git",
			[
				"-C",
				repo,
				"worktree",
				"add",
				"-b",
				"tracked-feature",
				path.join(repo, "..", "tracked-feature"),
			],
			{ stdio: "ignore" },
		);

		const info = detectWorktree(repo, fs);
		assert.ok(info?.isMultiWorktree, "repo is multi-worktree");
		if (!info) return;

		const before = { ...workbenchColors() };

		const brain = new Brain(fakeMemento());
		brain.setRepoState(info.gitCommonDir, {
			assignments: {},
			overrides: {},
			writes: {},
			trackedChoice: "statusBarOnly",
		});

		const controller = new Controller(brain);
		await controller.activate(repo);
		controller.dispose();

		assert.deepStrictEqual(
			{ ...workbenchColors() },
			before,
			"chrome was not applied to a tracked settings.json once 'Status bar only' was chosen",
		);
	});
});
