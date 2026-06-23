// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, Modal } from 'obsidian';

// ───────────────────────────────────────────────────────────────────────────────
// Confirmation Dialog Interface
// ───────────────────────────────────────────────────────────────────────────────

interface ConfirmationDialogParams {
	cta:      string;
	onAccept: () => Promise<void> | void;
	text:     string;
	title:    string;
}

// ───────────────────────────────────────────────────────────────────────────────
// Confirmation Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class ConfirmationModal extends Modal {
	constructor(app: App, config: ConfirmationDialogParams) {
		super(app);

		this.modalEl.addClass('workspace-delete-confirm-modal');

		const { cta, onAccept, text, title } = config;

		// Modal title
		this.contentEl.createEl('h3', { text: title });

		// Confirmation text
		this.contentEl.createEl('p', {
			text: text,
			attr: { id: 'workspace-delete-confirm-dialog' }
		});

		// Buttons
		this.contentEl.createDiv('modal-button-container', (buttonsEl) => {
			// Cancel button
			buttonsEl
				.createEl('button', { text: 'Cancel' })
				.addEventListener('click', () => this.close());

			// Confirm button
			const btnSubmit = buttonsEl.createEl('button', {
				text: cta,
				cls:  'mod-cta',
				attr: { type: 'submit' }
			});

			let accepting = false;
			btnSubmit.addEventListener('click', async () => {
				// Guard against a double-click firing onAccept twice before close().
				if (accepting) return;
				accepting = true;
				btnSubmit.disabled = true;
				// finally{} ensures the modal always closes, even if onAccept throws —
				// otherwise a thrown handler would leave the dialog wedged open.
				try {
					await onAccept();
				} finally {
					this.close();
				}
			});

			// Focus the confirm button after a short delay
			setTimeout(() => {
				btnSubmit.focus();
			}, 50);
		});
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Helper Function
// ───────────────────────────────────────────────────────────────────────────────

export function createConfirmationDialog(
	app:    App,
	config: ConfirmationDialogParams
): void {
	new ConfirmationModal(app, config).open();
}
