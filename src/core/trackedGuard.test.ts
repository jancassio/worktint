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
