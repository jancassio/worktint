import { describe, expect, it } from "bun:test";
import { Brain, type MementoLike } from "./brain";

function fakeMemento(): MementoLike {
	const store = new Map<string, unknown>();
	return {
		get: <T>(k: string): T | undefined => store.get(k) as T | undefined,
		update: (k, v) => {
			store.set(k, v);
		},
	};
}

describe("Brain", () => {
	it("returns an empty state for an unknown repo", () => {
		const b = new Brain(fakeMemento());
		expect(b.getRepoState("/r/.git")).toEqual({
			assignments: {},
			overrides: {},
			writes: {},
		});
	});
	it("persists and reloads repo state", () => {
		const m = fakeMemento();
		const b = new Brain(m);
		const s = b.getRepoState("/r/.git");
		s.assignments["/r/wtA"] = 3;
		b.setRepoState("/r/.git", s);
		expect(new Brain(m).getRepoState("/r/.git").assignments["/r/wtA"]).toBe(3);
	});
});
