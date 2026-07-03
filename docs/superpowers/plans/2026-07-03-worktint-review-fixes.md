# Worktint Code-Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 1 Critical + 4 Important findings from the 2026-07-03 code review of the merged Worktint MVP (range `016871b..fc35685`), without touching the 6 Minor findings (deferred to a later pass).

**Architecture:** All fixes land in the existing three layers — a new pure decision function in `src/core/*` (bun-unit-testable), small edits to the `src/vscode/*` adapter (`brain.ts`), and the bulk of the behavior change in `src/controller.ts` + `src/extension.ts`. No new files besides the one pure module and its test, and one new integration-test block appended to the existing suite.

**Tech Stack:** TypeScript, Bun (`bun test` for `src/core` + `src/vscode`), `@vscode/test-electron` via `vscode-test` (integration), Biome (lint).

## Global Constraints

- Toolchain is Bun; unit tests run via `bun run test:unit` (= `bun test src/core src/vscode`), integration via `bun run test:integration` (builds first via `pretest:integration`).
- `src/core/*` must stay framework-free (no `vscode` import) so it stays bun-unit-testable.
- Typecheck (`bunx tsc --noEmit`) and lint (`biome check`) must stay clean after every task.
- Do not touch the 6 Minor findings in this plan (tracked separately in memory `worktint-review-followups`).
- Commit after each task (small, reviewable diffs), following the repo's existing commit style (`fix(core): ...`, `test: ...`, seen in `git log`).

---

### Task 1: Extract the tracked-settings guard decision into a pure, unit-tested function

**Files:**
- Create: `src/core/trackedGuard.ts`
- Test: `src/core/trackedGuard.test.ts`

**Interfaces:**
- Produces: `TrackedChoice` (type `"enabled" | "statusBarOnly"`), `evaluateTrackedGuard(isTracked: boolean, trackedChoice: TrackedChoice | undefined): { needsPrompt: boolean; applyChrome: boolean }`, `resolveTrackedChoice(promptAnswer: string | undefined): TrackedChoice`. Task 2 imports all three from `./core/trackedGuard` (relative to `src/controller.ts`) and `../core/trackedGuard` (relative to `src/vscode/brain.ts`).

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/trackedGuard.test.ts
import { describe, expect, it } from "bun:test";
import { evaluateTrackedGuard, resolveTrackedChoice } from "./trackedGuard";

describe("evaluateTrackedGuard", () => {
	it("applies chrome without prompting when the file isn't tracked", () => {
		expect(evaluateTrackedGuard(false, undefined)).toEqual({
			needsPrompt: false,
			applyChrome: true,
		});
	});
	it("prompts when tracked and no choice has been recorded yet", () => {
		expect(evaluateTrackedGuard(true, undefined)).toEqual({
			needsPrompt: true,
			applyChrome: false,
		});
	});
	it("applies chrome without re-prompting once 'enabled' is recorded", () => {
		expect(evaluateTrackedGuard(true, "enabled")).toEqual({
			needsPrompt: false,
			applyChrome: true,
		});
	});
	it("withholds chrome without re-prompting once 'statusBarOnly' is recorded", () => {
		expect(evaluateTrackedGuard(true, "statusBarOnly")).toEqual({
			needsPrompt: false,
			applyChrome: false,
		});
	});
});

describe("resolveTrackedChoice", () => {
	it("maps 'Enable anyway' to 'enabled'", () => {
		expect(resolveTrackedChoice("Enable anyway")).toBe("enabled");
	});
	it("maps 'Status bar only' to 'statusBarOnly'", () => {
		expect(resolveTrackedChoice("Status bar only")).toBe("statusBarOnly");
	});
	it("maps a dismissed prompt (undefined) to 'statusBarOnly'", () => {
		expect(resolveTrackedChoice(undefined)).toBe("statusBarOnly");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/trackedGuard.test.ts`
Expected: FAIL — `Cannot find module './trackedGuard'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/trackedGuard.ts
export type TrackedChoice = "enabled" | "statusBarOnly";

export interface TrackedGuardResult {
	needsPrompt: boolean;
	applyChrome: boolean;
}

export function evaluateTrackedGuard(
	isTracked: boolean,
	trackedChoice: TrackedChoice | undefined,
): TrackedGuardResult {
	if (!isTracked) return { needsPrompt: false, applyChrome: true };
	if (trackedChoice === "enabled") return { needsPrompt: false, applyChrome: true };
	if (trackedChoice === "statusBarOnly") return { needsPrompt: false, applyChrome: false };
	return { needsPrompt: true, applyChrome: false };
}

export function resolveTrackedChoice(promptAnswer: string | undefined): TrackedChoice {
	return promptAnswer === "Enable anyway" ? "enabled" : "statusBarOnly";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/core/trackedGuard.test.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/trackedGuard.ts src/core/trackedGuard.test.ts
git commit -m "feat(core): add pure tracked-settings guard decision function"
```

---

### Task 2: Fix Critical — persist and honor the tracked-settings choice every render

**Files:**
- Modify: `src/vscode/brain.ts` (`RepoState.trackedAck` → `RepoState.trackedChoice`)
- Modify: `src/controller.ts:104-114` (render's tracked-file guard)
- Modify: `src/test/integration/activation.test.ts` (append regression test)

**Interfaces:**
- Consumes: `evaluateTrackedGuard`, `resolveTrackedChoice`, `TrackedChoice` from Task 1.

- [ ] **Step 1: Update `RepoState` to store the decision, not just an ack flag**

In `src/vscode/brain.ts`, add the import and replace the field:

```typescript
import type { Assignments } from "../core/colorAssigner";
import type { TrackedChoice } from "../core/trackedGuard";
```

```typescript
export interface RepoState {
	assignments: Assignments;
	overrides: Record<string, number>;
	writes: Record<string, WriteRecord>;
	trackedChoice?: TrackedChoice;
}
```

(Remove the old `trackedAck?: boolean;` line entirely.)

- [ ] **Step 2: Write the failing integration test**

Append to `src/test/integration/activation.test.ts` (after the `"single-worktree repo stays dormant"` test, still inside the `suite(...)` block), and add the import:

```typescript
import { evaluateTrackedGuard } from "../../core/trackedGuard";
```

(Only needed if you want to assert against it directly; the test below only needs `Controller`/`Brain`/`detectWorktree`, already imported.)

```typescript
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
		["-C", repo, "worktree", "add", "-b", "tracked-feature", path.join(repo, "..", "tracked-feature")],
		{ stdio: "ignore" },
	);

	const info = detectWorktree(repo, fs);
	assert.ok(info?.isMultiWorktree, "repo is multi-worktree");
	assert.ok(info, "repo detected");
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test:integration`
Expected: FAIL on the new test — with the current code, `state.trackedChoice` doesn't exist yet (TypeScript compile error under `bun run build:test`, since `brain.ts` hasn't been updated in Task 2 Step 1... actually Step 1 already updates `brain.ts` first). Given Step 1 already ran, the type exists; the test should compile but FAIL the assertion because `Controller` still reads `state.trackedAck` (which no longer exists on the type, so this is actually a compile error in `controller.ts` at this point — expected, since Step 1 removed the field it depends on). Expected failure mode: `bun run build:test` / `pretest:integration` fails with `Property 'trackedAck' does not exist on type 'RepoState'`.

- [ ] **Step 4: Fix the render() guard to use the persisted choice**

In `src/controller.ts`, add the import:

```typescript
import { evaluateTrackedGuard, resolveTrackedChoice } from "./core/trackedGuard";
```

Replace the guard block (currently lines 104-114):

```typescript
		// Tracked-file guard: don't silently dirty a committed .vscode/settings.json.
		if (isSettingsTracked(info.worktreePath) && !state.trackedAck) {
			const choice = await vscode.window.showWarningMessage(
				"Worktint: this repo tracks .vscode/settings.json. Chrome coloring would modify a tracked file.",
				"Enable anyway",
				"Status bar only",
			);
			state.trackedAck = true;
			this.brain.setRepoState(info.gitCommonDir, state);
			if (choice !== "Enable anyway") return;
		}
```

with:

```typescript
		// Tracked-file guard: don't silently dirty a committed .vscode/settings.json.
		// The user's choice is persisted and re-checked on *every* render, not just
		// the first time — a later full activation (theme/config change, reload)
		// must keep honoring "Status bar only" instead of falling through to apply.
		const tracked = isSettingsTracked(info.worktreePath);
		let guard = evaluateTrackedGuard(tracked, state.trackedChoice);
		if (guard.needsPrompt) {
			const choice = await vscode.window.showWarningMessage(
				"Worktint: this repo tracks .vscode/settings.json. Chrome coloring would modify a tracked file.",
				"Enable anyway",
				"Status bar only",
			);
			state.trackedChoice = resolveTrackedChoice(choice);
			this.brain.setRepoState(info.gitCommonDir, state);
			guard = evaluateTrackedGuard(tracked, state.trackedChoice);
		}
		if (!guard.applyChrome) {
			if (existing) {
				await this.writer.revertChrome(existing, info.gitCommonDir);
				delete state.writes[info.worktreePath];
				this.brain.setRepoState(info.gitCommonDir, state);
			}
			return;
		}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:integration`
Expected: PASS — all tests including the new one.

- [ ] **Step 6: Run unit tests and typecheck**

Run: `bun run test:unit && bunx tsc --noEmit && bun run lint`
Expected: all clean (25 + 7 = 32 unit tests pass).

- [ ] **Step 7: Commit**

```bash
git add src/vscode/brain.ts src/controller.ts src/test/integration/activation.test.ts
git commit -m "fix(controller): persist and honor the tracked-settings guard choice every render"
```

---

### Task 3: Fix Important — `resetAll` cross-contaminates worktrees

**Files:**
- Modify: `src/controller.ts:188-201` (`resetAll`)
- Modify: `src/test/integration/activation.test.ts` (append regression test)

- [ ] **Step 1: Write the failing integration test**

Append to `src/test/integration/activation.test.ts`:

```typescript
test("resetAll only reverts the current worktree's record, not other worktrees'", async () => {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	assert.ok(folder, "a workspace folder is open");
	const info = detectWorktree(folder, fs);
	assert.ok(info?.isMultiWorktree, "workspace is multi-worktree");
	if (!info) return;

	const brain = new Brain(fakeMemento());
	const controller = new Controller(brain);
	await controller.activate(folder);

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

	for (const key of WORKTINT_KEYS) {
		assert.strictEqual(
			workbenchColors()[key],
			undefined,
			`${key} was cleared, not overwritten with the other worktree's bogus prior`,
		);
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration`
Expected: FAIL — final `workbenchColors()` contains `"statusBar.background": "#bogus1"` / `"statusBar.foreground": "#bogus2"` because the current buggy loop reverts the fabricated `/fake/other-worktree` record last, writing its bogus prior into the real (shared) workspace config.

- [ ] **Step 3: Fix `resetAll`**

Replace the method body in `src/controller.ts` (currently lines 188-201):

```typescript
	async resetAll(): Promise<void> {
		const info = this.info;
		if (!info) return;
		const state = this.brain.getRepoState(info.gitCommonDir);
		for (const record of Object.values(state.writes)) {
			await this.writer.revertChrome(record, info.gitCommonDir);
		}
		this.brain.setRepoState(info.gitCommonDir, {
			assignments: {},
			overrides: {},
			writes: {},
		});
		this.indicator.hide();
	}
```

with:

```typescript
	async resetAll(): Promise<void> {
		const info = this.info;
		if (!info) return;
		const state = this.brain.getRepoState(info.gitCommonDir);
		// Only the current window can actually revert its own on-disk
		// settings.json (workbench config always targets *this* workspace).
		// Other worktrees' writes can't be undone from here — just drop their
		// brain-state records so this window stops tracking them.
		const current = state.writes[info.worktreePath];
		if (current) await this.writer.revertChrome(current, info.gitCommonDir);
		this.brain.setRepoState(info.gitCommonDir, {
			assignments: {},
			overrides: {},
			writes: {},
		});
		this.indicator.hide();
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:integration`
Expected: PASS — all tests.

- [ ] **Step 5: Run unit tests and typecheck**

Run: `bun run test:unit && bunx tsc --noEmit && bun run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/controller.ts src/test/integration/activation.test.ts
git commit -m "fix(controller): resetAll no longer cross-contaminates other worktrees' recorded state"
```

---

### Task 4: Fix Important — watcher misses linked worktrees

**Files:**
- Modify: `src/controller.ts` (`doActivate`/`activate`, new `watchWorktrees` method)
- Modify: `src/extension.ts:40-48` (remove the workspace-relative watcher)
- Modify: `src/test/integration/activation.test.ts` (append regression test)

**Context:** `vscode.workspace.createFileSystemWatcher("**/.git/worktrees/**")` in `extension.ts` is resolved relative to open workspace folders. When the open folder is a *linked* worktree (the common case for parallel windows), its `.git` is a *file*, not a directory — the real `worktrees` directory lives under the *main* checkout's `.git`, outside the linked worktree's folder tree, so the glob never matches there. `Controller` already computes the absolute `info.gitCommonDir` in `detectWorktree`; the watcher must be rooted there instead.

- [ ] **Step 1: Write the failing integration test**

Append to `src/test/integration/activation.test.ts`:

```typescript
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

	const controller = new Controller(new Brain(fakeMemento()));
	await controller.activate(soloRepo);
	assert.ok(
		!fs.existsSync(path.join(soloRepo, ".vscode", "settings.json")),
		"starts dormant with a single worktree",
	);

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

	try {
		await waitFor(
			() => typeof workbenchColors()["statusBar.background"] === "string",
			15000,
		);
		assert.match(workbenchColors()["statusBar.background"], HEX);
	} finally {
		controller.dispose();
		// Restore the shared workspace config so later tests aren't affected —
		// this test's Controller wrote chrome into the one real open workspace.
		await vscode.workspace
			.getConfiguration("workbench")
			.update(
				"colorCustomizations",
				Object.keys(before).length ? before : undefined,
				vscode.ConfigurationTarget.Workspace,
			);
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration`
Expected: FAIL — `waitFor` times out after 15s because nothing reactivates `controller` when the linked worktree is added; the extension-level watcher (in `extension.ts`) is scoped to the *shared test workspace* folder, not `soloRepo`, and this test's standalone `Controller` has no watcher at all yet.

- [ ] **Step 3: Give `Controller` its own absolute-path watcher**

In `src/controller.ts`, add a `watchWorktrees` private method and wire it into activation. First, add a field:

```typescript
	private titleBarPrompted = false;
```

stays as-is; add nothing new to fields yet (the watcher disposable goes through the existing `subscriptions` array).

Modify the top of the activate method (currently named `activate`, lines 40-49) — insert the watcher registration right after the `!info` early return, so it covers both the dormant (single-worktree) and active (multi-worktree) branches:

```typescript
	async activate(folderPath: string): Promise<void> {
		this.clearSubscriptions();
		const info = detectWorktree(folderPath, fs);
		this.info = info;
		this.color = undefined;

		if (!info) {
			this.indicator.hide();
			return;
		}

		this.subscriptions.push(this.watchWorktrees(info.gitCommonDir, folderPath));

		if (!info.isMultiWorktree) {
```

(The rest of the `!info.isMultiWorktree` branch and everything after is unchanged.)

Add the new private method (place it near `clearSubscriptions`, e.g. right before it):

```typescript
	private watchWorktrees(
		gitCommonDir: string,
		folderPath: string,
	): vscode.Disposable {
		// Rooted at the absolute git-common-dir (not workspace-relative) so this
		// fires for linked worktrees too — their common dir lives outside their
		// own folder tree.
		const watcher = vscode.workspace.createFileSystemWatcher(
			new vscode.RelativePattern(gitCommonDir, "worktrees/**"),
		);
		const reactivate = () => void this.activate(folderPath);
		watcher.onDidCreate(reactivate);
		watcher.onDidDelete(reactivate);
		return watcher;
	}
```

- [ ] **Step 4: Remove the now-redundant workspace-relative watcher from `extension.ts`**

In `src/extension.ts`, delete this block entirely (currently lines 40-48):

```typescript
	// Re-evaluate when worktrees are added/removed under the git common dir.
	if (folder) {
		const watcher = vscode.workspace.createFileSystemWatcher(
			"**/.git/worktrees/**",
		);
		watcher.onDidCreate(() => controller?.activate(folder));
		watcher.onDidDelete(() => controller?.activate(folder));
		context.subscriptions.push(watcher);
	}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:integration`
Expected: PASS — all tests. (This test polls a real filesystem watcher; if it's flaky in your environment, re-run once before assuming a real regression — see note in Task summary below.)

- [ ] **Step 6: Run unit tests and typecheck**

Run: `bun run test:unit && bunx tsc --noEmit && bun run lint`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add src/controller.ts src/extension.ts src/test/integration/activation.test.ts
git commit -m "fix(controller): watch worktrees by absolute git-common-dir so linked worktrees see add/remove"
```

---

### Task 5: Fix Important — no re-entrancy guard on `activate`

**Files:**
- Modify: `src/controller.ts` (serialize `activate` calls)
- Modify: `src/test/integration/activation.test.ts` (append regression test)

**Context:** `activate` is invoked from many async sources (config change, theme change, the new worktree watcher, commands). Overlapping runs each call `clearSubscriptions()` and read/mutate their own local `RepoState` object before writing it back with `setRepoState` — the last one to finish wins and can persist a `prior` value that was actually another in-flight run's already-applied color, corrupting future resets.

- [ ] **Step 1: Write the failing integration test**

Append to `src/test/integration/activation.test.ts`:

```typescript
test("concurrent activate() calls settle without corrupting the recorded prior", async () => {
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	assert.ok(folder, "a workspace folder is open");
	const info = detectWorktree(folder, fs);
	assert.ok(info?.isMultiWorktree, "workspace is multi-worktree");
	if (!info) return;

	const brain = new Brain(fakeMemento());
	const controller = new Controller(brain);

	await Promise.all([
		controller.activate(folder),
		controller.activate(folder),
		controller.activate(folder),
	]);

	assert.match(workbenchColors()["statusBar.background"] ?? "", HEX);
	const state = brain.getRepoState(info.gitCommonDir);
	assert.strictEqual(
		typeof state.assignments[folder],
		"number",
		"exactly one slot recorded for the worktree",
	);

	await controller.resetThisWorktree();
	controller.dispose();

	for (const key of WORKTINT_KEYS) {
		assert.strictEqual(
			workbenchColors()[key],
			undefined,
			`${key} was fully restored — a corrupted 'prior' from an overlapping run would leave this set`,
		);
	}
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:integration`
Expected: FAIL (or flaky-pass) — three overlapping `activate()` runs each independently snapshot "prior" from whatever the config looks like *at that moment*, so one run can record another run's already-applied color as its own "prior"; `resetThisWorktree()` then restores that wrong color instead of clearing it, so one or more `WORKTINT_KEYS` remain set to a hex value instead of `undefined`.

- [ ] **Step 3: Serialize `activate` behind a queue**

In `src/controller.ts`, add a field:

```typescript
	private titleBarPrompted = false;
	private activationQueue: Promise<void> = Promise.resolve();
```

Rename the existing `activate` method to `doActivate` (keep its body exactly as-is, including the watcher line added in Task 4), and add a new thin `activate` wrapper above it:

```typescript
	async activate(folderPath: string): Promise<void> {
		const run = this.activationQueue.then(() => this.doActivate(folderPath));
		// Keep the queue moving even if this run rejects, so one failure
		// doesn't wedge every subsequent activation.
		this.activationQueue = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private async doActivate(folderPath: string): Promise<void> {
		this.clearSubscriptions();
		const info = detectWorktree(folderPath, fs);
		this.info = info;
		this.color = undefined;

		if (!info) {
			this.indicator.hide();
			return;
		}

		this.subscriptions.push(this.watchWorktrees(info.gitCommonDir, folderPath));

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
			vscode.window.onDidChangeActiveColorTheme(
				() => void this.activate(folderPath),
			),
		);
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:integration`
Expected: PASS — all tests, deterministically (run it 2-3 times to confirm it's not a coincidental pass).

- [ ] **Step 5: Run unit tests and typecheck**

Run: `bun run test:unit && bunx tsc --noEmit && bun run lint`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add src/controller.ts src/test/integration/activation.test.ts
git commit -m "fix(controller): serialize activate() so overlapping calls can't corrupt recorded state"
```

---

### Task 6: Fix Important — fire-and-forget `activate()` swallows I/O failures

**Files:**
- Modify: `src/controller.ts` (add `activateSafely` + output channel)
- Modify: `src/extension.ts` (route fire-and-forget call sites through it)

**Context:** `void controller.activate(...)` (in `extension.ts`) and `() => void this.activate(folderPath)` (theme-change listener, worktree watcher) turn any rejected promise — e.g. an unwritable `.git/info/exclude` — into an unhandled rejection with no user-visible signal. There's no reliable, portable way to force a real fs failure in the test-electron sandbox for an automated regression test (permission tricks differ between root/non-root CI and OS), so this task is verified by typecheck/lint/full-suite-green plus a manual code read, not a new automated test — call this out explicitly when reporting back.

- [ ] **Step 1: Add a safe wrapper and output channel to `Controller`**

Add a field (alongside `indicator`, `writer`):

```typescript
	private indicator = new StatusBarIndicator();
	private writer = new SettingsWriter();
	private output = vscode.window.createOutputChannel("Worktint");
```

Add a public method (near `activate`):

```typescript
	/** Fire-and-forget activation that reports failures instead of dropping them. */
	activateSafely(folderPath: string): void {
		void this.activate(folderPath).catch((err) => {
			const message = err instanceof Error ? err.message : String(err);
			this.output.appendLine(`activate failed: ${message}`);
			void vscode.window.showWarningMessage(
				`Worktint: failed to update window chrome (${message}). See the "Worktint" output channel for details.`,
			);
		});
	}
```

Dispose the channel in `dispose()`:

```typescript
	dispose(): void {
		this.clearSubscriptions();
		this.indicator.dispose();
		this.output.dispose();
	}
```

- [ ] **Step 2: Route `Controller`'s own fire-and-forget call sites through it**

In `doActivate`, replace:

```typescript
			vscode.window.onDidChangeActiveColorTheme(
				() => void this.activate(folderPath),
			),
```

with:

```typescript
			vscode.window.onDidChangeActiveColorTheme(
				() => this.activateSafely(folderPath),
			),
```

In `watchWorktrees`, replace:

```typescript
		const reactivate = () => void this.activate(folderPath);
```

with:

```typescript
		const reactivate = () => this.activateSafely(folderPath);
```

- [ ] **Step 3: Route `extension.ts`'s fire-and-forget call sites through it**

In `src/extension.ts`, replace all three fire-and-forget calls:

```typescript
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (folder) void controller.activate(folder);
```

→

```typescript
	const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (folder) controller.activateSafely(folder);
```

```typescript
		vscode.commands.registerCommand("worktint.toggleChrome", async () => {
			const c = vscode.workspace.getConfiguration("worktint");
			await c.update(
				"chrome.enabled",
				!c.get("chrome.enabled", true),
				vscode.ConfigurationTarget.Global,
			);
			if (folder) void controller?.activate(folder);
		}),
```

→

```typescript
		vscode.commands.registerCommand("worktint.toggleChrome", async () => {
			const c = vscode.workspace.getConfiguration("worktint");
			await c.update(
				"chrome.enabled",
				!c.get("chrome.enabled", true),
				vscode.ConfigurationTarget.Global,
			);
			if (folder) controller?.activateSafely(folder);
		}),
```

```typescript
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("worktint") && folder)
				void controller?.activate(folder);
		}),
```

→

```typescript
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("worktint") && folder)
				controller?.activateSafely(folder);
		}),
```

- [ ] **Step 4: Run the full suite**

Run: `bun run test:unit && bunx tsc --noEmit && bun run lint && bun run test:integration`
Expected: all clean, no regressions (this task is glue-code only, all prior tests should still pass unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/controller.ts src/extension.ts
git commit -m "fix(controller): surface activate() failures via output channel + warning instead of dropping them"
```

---

## Post-plan: update memory

Once all 6 tasks are committed, update the two memory files by hand (not part of the automated plan):
- `worktint-review-followups.md`: mark Critical + the 4 Important items as fixed, keep the 6 Minor items as the remaining open list.
- `worktint-project.md`: update the "Open follow-ups" line to reflect only the Minor items remain.
