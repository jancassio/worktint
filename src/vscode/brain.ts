import type { Assignments } from "../core/colorAssigner";

export interface MementoLike {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): void | Thenable<void>;
}

export interface WriteRecord {
	keys: string[];
	prior: Record<string, string | undefined>;
	addedExcludeLine: boolean;
}

export interface RepoState {
	assignments: Assignments;
	overrides: Record<string, number>;
	writes: Record<string, WriteRecord>;
	trackedAck?: boolean;
}

const PREFIX = "worktint.repo:";

export class Brain {
	constructor(private memento: MementoLike) {}

	getRepoState(gitCommonDir: string): RepoState {
		return (
			this.memento.get<RepoState>(PREFIX + gitCommonDir) ?? {
				assignments: {},
				overrides: {},
				writes: {},
			}
		);
	}

	setRepoState(gitCommonDir: string, state: RepoState): void {
		this.memento.update(PREFIX + gitCommonDir, state);
	}
}
