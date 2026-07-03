import { fnv1a } from "./hash";

export type Assignments = Record<string, number>;

export function preferredSlot(
	worktreePath: string,
	paletteSize: number,
): number {
	return fnv1a(worktreePath) % paletteSize;
}

export function assignSlot(
	worktreePath: string,
	existing: Assignments,
	paletteSize: number,
	override?: number,
): number {
	if (override !== undefined)
		return ((override % paletteSize) + paletteSize) % paletteSize;
	if (existing[worktreePath] !== undefined) return existing[worktreePath];

	const taken = new Set(
		Object.entries(existing)
			.filter(([k]) => k !== worktreePath)
			.map(([, v]) => v),
	);
	let slot = preferredSlot(worktreePath, paletteSize);
	for (let i = 0; i < paletteSize; i++) {
		if (!taken.has(slot)) return slot;
		slot = (slot + 1) % paletteSize;
	}
	return preferredSlot(worktreePath, paletteSize); // all taken: accept a duplicate
}
