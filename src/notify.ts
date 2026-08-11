// ═══════════════════════════════════════════════════════════════════════════════
// NOTICE WRAPPER
// Copied from the obsidian-ui-kit-demo reference implementation (rulebook rule 6:
// glyph prefix distinguishes success/error, errors linger longer). Until the
// shared kit lands in obsidian-core-utilities, the demo is the source of truth.
// ═══════════════════════════════════════════════════════════════════════════════

import { Notice } from "obsidian";

const PREFIX: Record<string, string> = { success: "✓ ", error: "✗ ", info: "" };

export function notify(message: string, kind: "success" | "error" | "info" = "info"): void {
	new Notice(PREFIX[kind] + message, kind === "error" ? 8000 : 4000);
}

export function notifyProgress(label: string) {
	const notice = new Notice(`${label}…`, 0);
	return {
		update(done: number, total: number): void {
			notice.setMessage(`${label}: ${done}/${total}`);
		},
		finish(message: string): void {
			notice.setMessage(`✓ ${message}`);
			window.setTimeout(() => notice.hide(), 2000);
		},
		fail(message: string): void {
			notice.setMessage(`✗ ${message}`);
			window.setTimeout(() => notice.hide(), 8000);
		},
	};
}
