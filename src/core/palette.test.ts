import { describe, expect, it } from "bun:test";
import { DARK_PALETTE, LIGHT_PALETTE, selectPalette } from "./palette";

describe("palette", () => {
	it("has 8 colors each", () => {
		expect(LIGHT_PALETTE.length).toBe(8);
		expect(DARK_PALETTE.length).toBe(8);
	});
	it("every entry has bg/fg/accent hex", () => {
		for (const c of [...LIGHT_PALETTE, ...DARK_PALETTE]) {
			for (const v of [c.background, c.foreground, c.accent]) {
				expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
			}
		}
	});
	it("selects dark set for dark/HC, light for light/HC-light", () => {
		expect(selectPalette("dark")).toBe(DARK_PALETTE);
		expect(selectPalette("highContrast")).toBe(DARK_PALETTE);
		expect(selectPalette("light")).toBe(LIGHT_PALETTE);
		expect(selectPalette("highContrastLight")).toBe(LIGHT_PALETTE);
	});
});
