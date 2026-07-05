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
		const worktreeParent = fs.mkdtempSync(
			path.join(os.tmpdir(), "worktint-tracked-wt-"),
		);
		execFileSync(
			"git",
			[
				"-C",
				repo,
				"worktree",
				"add",
				"-b",
				"tracked-feature",
				path.join(worktreeParent, "tracked-feature"),
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

	test("resetAll only reverts the current worktree's record, not other worktrees'", async () => {
		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		assert.ok(folder, "a workspace folder is open");
		const info = detectWorktree(folder as string, fs);
		assert.ok(info?.isMultiWorktree, "workspace is multi-worktree");
		if (!info) return;

		// Snapshot right before *this* controller's own activation — the ambient
		// shared workspace isn't guaranteed pristine (e.g. a stray theme-change
		// event can make the real singleton controller re-apply chrome in the
		// background), so assert against what this controller itself recorded
		// as "prior", not an assumed-clean baseline.
		const before = { ...workbenchColors() };
		const brain = new Brain(fakeMemento());
		const controller = new Controller(brain);
		await controller.activate(folder as string);

		// Fabricate a second worktree's recorded write, with a bogus "prior" that
		// must NEVER end up written into the real (current) worktree's config.
		const state = brain.getRepoState(info.gitCommonDir);
		state.writes["/fake/other-worktree"] = {
			keys: ["statusBar.background", "statusBar.foreground"],
			prior: {
				"statusBar.background": "#bogus1",
				"statusBar.foreground": "#bogus2",
			},
			addedExcludeLine: false,
		};
		brain.setRepoState(info.gitCommonDir, state);

		await controller.resetAll();
		controller.dispose();

		assert.deepStrictEqual(
			{ ...workbenchColors() },
			before,
			"config was restored to this controller's own recorded prior, not overwritten with the other worktree's bogus prior",
		);
	});

	test("adding a linked worktree reactivates chrome via the watcher, without a manual call", async () => {
		const before = { ...workbenchColors() };

		const soloRepo = fs.mkdtempSync(path.join(os.tmpdir(), "worktint-watch-"));
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
		assert.ok(info && !info.isMultiWorktree, "starts as a solo repo");
		if (!info) return;
		const gitCommonDir = info.gitCommonDir;

		const brain = new Brain(fakeMemento());
		const controller = new Controller(brain);
		await controller.activate(soloRepo);
		assert.ok(
			!fs.existsSync(path.join(soloRepo, ".vscode", "settings.json")),
			"starts dormant with a single worktree",
		);

		try {
			// The worktree watcher (a recursive FileSystemWatcher rooted at the
			// external git-common-dir) arms asynchronously in the VS Code host,
			// with no "ready" signal. Give it a beat to arm before we create
			// worktrees/<name>/, otherwise on a loaded CI runner git can win the
			// race and the onDidCreate is missed, timing out the waitFor below.
			await new Promise((resolve) => setTimeout(resolve, 1000));

			const worktreeParent = fs.mkdtempSync(
				path.join(os.tmpdir(), "worktint-watch-wt-"),
			);
			execFileSync(
				"git",
				[
					"-C",
					soloRepo,
					"worktree",
					"add",
					"-b",
					"watch-feature",
					path.join(worktreeParent, "linked"),
				],
				{ stdio: "ignore" },
			);

			// The watcher fires asynchronously; check *this test's own* brain
			// state (not the shared workspace config, which can be touched in
			// the background by the real singleton controller on an unrelated
			// theme-change event) for an unambiguous, race-free signal.
			await waitFor(
				() => brain.getRepoState(gitCommonDir).writes[soloRepo] !== undefined,
				15000,
			);
		} finally {
			controller.dispose();
			await vscode.workspace
				.getConfiguration("workbench")
				.update(
					"colorCustomizations",
					Object.keys(before).length ? before : undefined,
					vscode.ConfigurationTarget.Workspace,
				);
		}
	});

	test("concurrent activate() calls settle without corrupting the recorded prior", async () => {
		const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		assert.ok(folder, "a workspace folder is open");
		const info = detectWorktree(folder as string, fs);
		assert.ok(info?.isMultiWorktree, "workspace is multi-worktree");
		if (!info) return;

		// Self-referential like the resetAll test above: don't assume the
		// ambient shared config is pristine going in.
		const before = { ...workbenchColors() };

		const brain = new Brain(fakeMemento());
		const controller = new Controller(brain);

		await Promise.all([
			controller.activate(folder as string),
			controller.activate(folder as string),
			controller.activate(folder as string),
		]);

		assert.match(workbenchColors()["statusBar.background"] ?? "", HEX);

		await controller.resetThisWorktree();
		controller.dispose();

		assert.deepStrictEqual(
			{ ...workbenchColors() },
			before,
			"concurrent activations didn't corrupt the recorded 'prior' — a full reset restores exactly what was there before",
		);
	});
});
