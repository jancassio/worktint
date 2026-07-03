import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@vscode/test-cli";

// Build a throwaway git repo with a linked worktree so the extension sees a
// ">1 worktree" repo and opens the linked worktree as the test workspace.
function git(cwd, ...args) {
	execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
}

const mainRepo = mkdtempSync(join(tmpdir(), "worktint-main-"));
execFileSync("git", ["init", mainRepo], { stdio: "ignore" });
git(mainRepo, "config", "user.email", "worktint-test@example.com");
git(mainRepo, "config", "user.name", "Worktint Test");
git(mainRepo, "commit", "--allow-empty", "-m", "init");

const worktreeParent = mkdtempSync(join(tmpdir(), "worktint-wt-"));
const linkedWorktree = join(worktreeParent, "feature");
git(mainRepo, "worktree", "add", "-b", "feature", linkedWorktree);

export default defineConfig({
	files: "dist-test/test/**/*.test.js",
	workspaceFolder: linkedWorktree,
	// Disable workspace trust so the extension activates without a modal prompt
	// that would hang the headless run.
	launchArgs: ["--disable-workspace-trust"],
	mocha: { timeout: 30000 },
});
