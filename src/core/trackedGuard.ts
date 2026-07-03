export type TrackedChoice = "enabled" | "statusBarOnly";

export interface TrackedGuardResult {
	needsPrompt: boolean;
	applyChrome: boolean;
}

export function evaluateTrackedGuard(
	isTracked: boolean,
	trackedChoice: TrackedChoice | undefined,
): TrackedGuardResult {
	if (!isTracked) return { needsPrompt: false, applyChrome: true };
	if (trackedChoice === "enabled")
		return { needsPrompt: false, applyChrome: true };
	if (trackedChoice === "statusBarOnly")
		return { needsPrompt: false, applyChrome: false };
	return { needsPrompt: true, applyChrome: false };
}

export function resolveTrackedChoice(
	promptAnswer: string | undefined,
): TrackedChoice {
	return promptAnswer === "Enable anyway" ? "enabled" : "statusBarOnly";
}
