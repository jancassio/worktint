import { describe, expect, it } from "bun:test";
import { ensureLine, hasLine, removeLine } from "./excludeFile";

const LINE = ".vscode/settings.json";

describe("excludeFile", () => {
	it("ensure adds line once (idempotent)", () => {
		const once = ensureLine("", LINE);
		expect(hasLine(once, LINE)).toBe(true);
		expect(ensureLine(once, LINE)).toBe(once);
	});
	it("ensure preserves existing content and trailing newline", () => {
		expect(ensureLine("*.log\n", LINE)).toBe("*.log\n.vscode/settings.json\n");
	});
	it("remove deletes only that line", () => {
		const start = "*.log\n.vscode/settings.json\n";
		expect(removeLine(start, LINE)).toBe("*.log\n");
	});
	it("does not match substrings", () => {
		expect(hasLine(".vscode/settings.jsonx\n", LINE)).toBe(false);
	});
});
