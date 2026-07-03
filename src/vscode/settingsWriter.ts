import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import {
	buildCustomizations,
	type ChromeToggles,
	mergeCustomizations,
	restoreCustomizations,
	WORKTINT_KEYS,
} from "../core/colorCustomizations";
import { ensureLine, removeLine } from "../core/excludeFile";
import type { PaletteColor } from "../core/palette";
import type { WriteRecord } from "./brain";

const CUSTOMIZATIONS = "colorCustomizations";
const EXCLUDE_LINE = ".vscode/settings.json";

export function isSettingsTracked(worktreePath: string): boolean {
	try {
		execFileSync(
			"git",
			["-C", worktreePath, "ls-files", "--error-unmatch", EXCLUDE_LINE],
			{
				stdio: "ignore",
			},
		);
		return true;
	} catch {
		return false;
	}
}

export class SettingsWriter {
	async applyChrome(
		color: PaletteColor,
		toggles: ChromeToggles,
		gitCommonDir: string,
	): Promise<WriteRecord> {
		const cfg = vscode.workspace.getConfiguration("workbench");
		const current = {
			...(cfg.get<Record<string, string>>(CUSTOMIZATIONS) ?? {}),
		};
		const prior: Record<string, string | undefined> = {};
		for (const k of WORKTINT_KEYS) prior[k] = current[k];

		const ours = buildCustomizations(color, toggles);
		await cfg.update(
			CUSTOMIZATIONS,
			mergeCustomizations(current, ours),
			vscode.ConfigurationTarget.Workspace,
		);

		const addedExcludeLine = this.ensureExcluded(gitCommonDir);
		return { keys: Object.keys(ours), prior, addedExcludeLine };
	}

	async revertChrome(record: WriteRecord, gitCommonDir: string): Promise<void> {
		const cfg = vscode.workspace.getConfiguration("workbench");
		const current = {
			...(cfg.get<Record<string, string>>(CUSTOMIZATIONS) ?? {}),
		};
		const restored = restoreCustomizations(current, record.prior);
		await cfg.update(
			CUSTOMIZATIONS,
			Object.keys(restored).length ? restored : undefined,
			vscode.ConfigurationTarget.Workspace,
		);
		if (record.addedExcludeLine) this.removeExcluded(gitCommonDir);
	}

	private excludePath(gitCommonDir: string): string {
		return path.join(gitCommonDir, "info", "exclude");
	}

	private ensureExcluded(gitCommonDir: string): boolean {
		const p = this.excludePath(gitCommonDir);
		const prev = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
		const next = ensureLine(prev, EXCLUDE_LINE);
		if (next === prev) return false;
		fs.mkdirSync(path.dirname(p), { recursive: true });
		fs.writeFileSync(p, next);
		return true;
	}

	private removeExcluded(gitCommonDir: string): void {
		const p = this.excludePath(gitCommonDir);
		if (!fs.existsSync(p)) return;
		fs.writeFileSync(p, removeLine(fs.readFileSync(p, "utf8"), EXCLUDE_LINE));
	}
}
