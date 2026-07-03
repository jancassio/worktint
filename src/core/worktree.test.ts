import { describe, expect, it } from "bun:test";
import { detectWorktree, type FsLike, parseGitFile } from "./worktree";

function fakeFs(tree: Record<string, string | "DIR" | string[]>): FsLike {
	return {
		existsSync: (p) => p in tree,
		statSync: (p) => ({
			isDirectory: () => tree[p] === "DIR" || Array.isArray(tree[p]),
			isFile: () => typeof tree[p] === "string",
		}),
		readFileSync: (p) => tree[p] as string,
		readdirSync: (p) => (Array.isArray(tree[p]) ? (tree[p] as string[]) : []),
	};
}

describe("parseGitFile", () => {
	it("reads the gitdir path", () => {
		expect(parseGitFile("gitdir: /r/.git/worktrees/featA\n")).toBe(
			"/r/.git/worktrees/featA",
		);
	});
	it("returns null when absent", () => {
		expect(parseGitFile("nonsense")).toBeNull();
	});
});

describe("detectWorktree", () => {
	it("linked worktree with siblings -> multi", () => {
		const fs = fakeFs({
			"/r/wtA": "DIR",
			"/r/wtA/.git": "gitdir: /r/main/.git/worktrees/wtA",
			"/r/main/.git": "DIR",
			"/r/main/.git/worktrees": ["wtA"],
		});
		const info = detectWorktree("/r/wtA", fs);
		expect(info?.gitCommonDir).toBe("/r/main/.git");
		expect(info?.isMultiWorktree).toBe(true);
		expect(info?.worktreePath).toBe("/r/wtA");
	});

	it("main checkout, no linked worktrees -> not multi", () => {
		const fs = fakeFs({ "/r/main": "DIR", "/r/main/.git": "DIR" });
		const info = detectWorktree("/r/main", fs);
		expect(info?.isMultiWorktree).toBe(false);
	});

	it("non-git folder -> null", () => {
		const fs = fakeFs({ "/tmp/x": "DIR" });
		expect(detectWorktree("/tmp/x", fs)).toBeNull();
	});
});
