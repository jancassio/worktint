import { describe, expect, it } from "bun:test";
import {
	buildCustomizations,
	mergeCustomizations,
	restoreCustomizations,
	WORKTINT_KEYS,
} from "./colorCustomizations";

const color = {
	background: "#238636",
	foreground: "#ffffff",
	accent: "#3fb950",
};
const allOn = {
	titleBar: true,
	activityBar: true,
	statusBar: true,
	editorTabs: true,
};

describe("buildCustomizations", () => {
	it("emits title/activity/status/tab keys when all on", () => {
		const c = buildCustomizations(color, allOn);
		expect(c["titleBar.activeBackground"]).toBe("#238636");
		expect(c["activityBar.background"]).toBe("#238636");
		expect(c["statusBar.background"]).toBe("#238636");
		expect(c["tab.activeBorderTop"]).toBe("#3fb950");
	});
	it("omits disabled elements", () => {
		const c = buildCustomizations(color, { ...allOn, titleBar: false });
		expect(c["titleBar.activeBackground"]).toBeUndefined();
	});
});

describe("merge/restore round-trip", () => {
	it("merge keeps user keys, restore removes ours and puts prior back", () => {
		const existing: Record<string, string> = { "editor.background": "#000000" };
		const ours = buildCustomizations(color, allOn);
		const merged = mergeCustomizations(existing, ours);
		expect(merged["editor.background"]).toBe("#000000");
		const prior: Record<string, string | undefined> = {};
		for (const k of WORKTINT_KEYS) prior[k] = existing[k];
		const restored = restoreCustomizations(merged, prior);
		expect(restored).toEqual(existing);
	});

	it("still removes our keys when prior was JSON round-tripped (undefined dropped)", () => {
		// globalState serializes to JSON, which strips keys whose value is
		// `undefined` — so a `prior` recorded for a fresh workspace comes back `{}`.
		const existing: Record<string, string> = { "editor.background": "#000000" };
		const ours = buildCustomizations(color, allOn);
		const merged = mergeCustomizations(existing, ours);
		const priorAfterJson: Record<string, string | undefined> = JSON.parse(
			JSON.stringify({
				...Object.fromEntries(WORKTINT_KEYS.map((k) => [k, existing[k]])),
			}),
		);
		expect(priorAfterJson).toEqual({});
		const restored = restoreCustomizations(merged, priorAfterJson);
		expect(restored).toEqual(existing);
	});
});
