import { describe, expect, it } from "bun:test";
import { type Assignments, assignSlot, preferredSlot } from "./colorAssigner";

describe("assignSlot", () => {
	it("returns override when given", () => {
		expect(assignSlot("/r/a", {}, 8, 5)).toBe(5);
	});
	it("is deterministic with no collisions", () => {
		const s = preferredSlot("/r/a", 8);
		expect(assignSlot("/r/a", {}, 8)).toBe(s);
	});
	it("probes to the next free slot on collision", () => {
		const pref = preferredSlot("/r/a", 8);
		const existing: Assignments = { "/r/other": pref };
		expect(assignSlot("/r/a", existing, 8)).toBe((pref + 1) % 8);
	});
	it("reuses an already-recorded assignment", () => {
		const existing: Assignments = { "/r/a": 3 };
		expect(assignSlot("/r/a", existing, 8)).toBe(3);
	});
});
