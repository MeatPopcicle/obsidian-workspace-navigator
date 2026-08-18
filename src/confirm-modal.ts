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

		this.modalEl.addClass('wn-delete-confirm-modal', 'wn-root');

		const { cta, onAccept, text, title } = config;

		// Modal title
		this.contentEl.createEl('h3', { text: title });

		// Confirmation text
		this.contentEl.createEl('p', {
			text: text,
			attr: { id: 'wn-delete-confirm-dialog' }
		});

		// Buttons
		this.contentEl.createDiv('modal-button-container', (buttonsEl) => {
			// Cancel button
			buttonsEl
				.createEl('button', { text: 'Cancel' })
				.addEventListener('click', () => this.close());

			// Confirm button — red danger CTA (every use of this modal is a
			// destructive action, per the UI rulebook's confirmation contract)
			const btnSubmit = buttonsEl.createEl('button', {
				text: cta,
				cls:  'mod-warning',
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
// Typed-Name Confirmation Modal (tier-2, catastrophic bulk operations)
// The danger CTA stays disabled until the exact required text is typed.
// Idiom from the ui-kit reference implementation (rulebook rule 7).
// ───────────────────────────────────────────────────────────────────────────────

interface TypedConfirmationDialogParams extends ConfirmationDialogParams {
	requiredText: string;
}

export class TypedConfirmationModal extends Modal {
	constructor(app: App, config: TypedConfirmationDialogParams) {
		super(app);

		this.modalEl.addClass('wn-delete-confirm-modal', 'wn-root');

		const { cta, onAccept, text, title, requiredText } = config;

		this.contentEl.createEl('h3', { text: title });
		this.contentEl.createEl('p', { text: text });
		this.contentEl.createEl('p', {
			cls:  'wn-typed-confirm-hint',
			text: `Type ${requiredText} to confirm.`
		});

		const input = this.contentEl.createEl('input', {
			cls:  'wn-typed-confirm-input',
			attr: { type: 'text', placeholder: requiredText }
		});

		this.contentEl.createDiv('modal-button-container', (buttonsEl) => {
			buttonsEl
				.createEl('button', { text: 'Cancel' })
				.addEventListener('click', () => this.close());

			const btnSubmit = buttonsEl.createEl('button', {
				text: cta,
				cls:  'mod-warning',
				attr: { type: 'submit' }
			});
			btnSubmit.disabled = true;

			input.addEventListener('input', () => {
				btnSubmit.disabled = input.value !== requiredText;
			});
			input.addEventListener('keydown', (evt) => {
				if (evt.key === 'Enter' && !btnSubmit.disabled) btnSubmit.click();
			});

			let accepting = false;
			btnSubmit.addEventListener('click', async () => {
				if (accepting) return;
				accepting = true;
				btnSubmit.disabled = true;
				try {
					await onAccept();
				} finally {
					this.close();
				}
			});

			setTimeout(() => input.focus(), 50);
		});
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ───────────────────────────────────────────────────────────────────────────────

export function createConfirmationDialog(
	app:    App,
	config: ConfirmationDialogParams
): void {
	new ConfirmationModal(app, config).open();
}

export function createTypedConfirmationDialog(
	app:    App,
	config: TypedConfirmationDialogParams
): void {
	new TypedConfirmationModal(app, config).open();
}
