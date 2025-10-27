// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { createPopper, Instance as PopperInstance } from '@popperjs/core';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin:     WorkspaceNavigator;
	workspaces: string[];
	popper:     PopperInstance | null = null;

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Type workspace name...');

		// Add instructions if enabled
		if (plugin.settings.showInstructions) {
			this.setInstructions([
				{ command: '↵', purpose: 'switch' },
				{ command: 'shift ↵', purpose: 'save & switch' },
				{ command: 'alt ↵', purpose: 'save & switch' },
				{ command: 'ctrl ↵', purpose: 'rename' },
				{ command: 'shift ⌫', purpose: 'delete' },
				{ command: 'esc', purpose: 'cancel' }
			]);
		}
	}

	onOpen(): void {
		super.onOpen();

		// Position modal above status bar using Popper
		const statusBar = document.body.querySelector('.workspace-navigator-status');
		if (statusBar) {
			this.popper = createPopper(statusBar as HTMLElement, this.modalEl, {
				placement: 'top-start',
				modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
			});
		}

		// Add custom keyboard handlers directly to the input element
		// This way we don't interfere with the modal's default arrow key handling
		const inputEl = (this as any).inputEl as HTMLInputElement;
		if (inputEl) {
			inputEl.addEventListener('keydown', (evt: KeyboardEvent) => {
				// Ctrl+Enter to rename
				if (evt.ctrlKey && evt.key === 'Enter') {
					evt.preventDefault();
					evt.stopPropagation();
					this.onRenameClick(evt);
					return;
				}

				// Shift+Delete to delete
				if (evt.shiftKey && evt.key === 'Delete') {
					evt.preventDefault();
					evt.stopPropagation();
					this.deleteWorkspace();
					return;
				}
			});
		}
	}

	onClose(): void {
		// Cleanup popper instance
		if (this.popper) {
			this.popper.destroy();
			this.popper = null;
		}
		super.onClose();
	}

	// ─────────────────────────────────────────────────────────────────
	// Get list of workspaces (sorted if enabled)
	// ─────────────────────────────────────────────────────────────────

	getItems(): string[] {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Workspace manager already sorts alphabetically with natural sort
		return workspaceManager.getWorkspaceNames();
	}

	// ─────────────────────────────────────────────────────────────────
	// Get display text for workspace
	// ─────────────────────────────────────────────────────────────────

	getItemText(workspace: string): string {
		return workspace;
	}

	// ─────────────────────────────────────────────────────────────────
	// Render suggestion with rename button
	// ─────────────────────────────────────────────────────────────────

	renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
		super.renderSuggestion(item, el);

		const workspaceName = item.item;

		// Add data attribute for rename functionality
		el.dataset.workspaceName = workspaceName;
		el.addClass('workspace-suggestion-item');
		el.style.position = 'relative';
		el.style.padding = '5px 6rem 5px 2rem';

		// Wrap the text content in a span for rename functionality
		const textContent = el.textContent || '';
		el.empty();
		const textSpan = el.createSpan('workspace-name-text');
		textSpan.textContent = textContent;

		// Add active workspace indicator (checkmark)
		const workspaceManager = this.plugin.getWorkspaceManager();
		const activeWorkspace = workspaceManager.getActiveWorkspace();
		if (activeWorkspace && workspaceName === activeWorkspace) {
			const activeIndicator = el.createDiv('workspace-active-indicator');
			activeIndicator.setAttribute('aria-label', 'Active workspace');
			activeIndicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`;
			el.addClass('is-active');
		}

		// Create delete button
		const deleteBtn = el.createDiv('workspace-delete-btn');
		deleteBtn.setAttribute('aria-label', 'Delete workspace');
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;
		deleteBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.deleteWorkspace(workspaceName);
		});

		// Create rename button
		const renameBtn = el.createDiv('workspace-rename-btn');
		renameBtn.setAttribute('aria-label', 'Rename workspace');
		renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
		renameBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onRenameClick(evt, el);
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle rename click
	// ─────────────────────────────────────────────────────────────────

	onRenameClick(evt: MouseEvent | KeyboardEvent, el?: HTMLElement): void {
		if (!el) {
			// Get currently selected item
			const selectedItem = (this as any).chooser.selectedItem;
			const suggestions = (this as any).chooser.suggestions;
			if (selectedItem >= 0 && selectedItem < suggestions.length) {
				el = suggestions[selectedItem];
			}
		}

		if (!el) return;

		evt.stopPropagation();

		// Find the text span
		const textSpan = el.querySelector('.workspace-name-text') as HTMLElement;
		if (!textSpan) return;

		// If already in edit mode with input, finish editing
		const existingInput = el.querySelector('.workspace-rename-input') as HTMLInputElement;
		if (existingInput) {
			this.handleRename(el, existingInput);
			return;
		}

		// Enter edit mode - create an input field
		el.addClass('is-renaming');

		// Create input element
		const input = document.createElement('input');
		input.type = 'text';
		input.value = el.dataset.workspaceName || '';
		input.className = 'workspace-rename-input';

		// Replace text span with input
		textSpan.style.display = 'none';
		el.appendChild(input);
		input.focus();
		input.select();

		// Handle blur (cancel edit)
		input.onblur = () => {
			if (input.parentElement) {
				input.remove();
				textSpan.style.display = '';
				el.removeClass('is-renaming');
			}
		};

		// Handle Enter key
		input.onkeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				e.stopPropagation();
				this.handleRename(el, input);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				input.remove();
				textSpan.style.display = '';
				el.removeClass('is-renaming');
			}
		};
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace rename
	// ─────────────────────────────────────────────────────────────────

	async handleRename(el: HTMLElement, input: HTMLInputElement): Promise<void> {
		const oldName = el.dataset.workspaceName;
		const newName = input.value.trim();

		console.log('[Rename] oldName:', oldName, 'newName:', newName);

		const textSpan = el.querySelector('.workspace-name-text') as HTMLElement;

		if (!oldName || !newName || oldName === newName) {
			input.remove();
			if (textSpan) textSpan.style.display = '';
			el.removeClass('is-renaming');
			return;
		}

		const workspaceManager = this.plugin.getWorkspaceManager();

		// Check if new name already exists
		if (workspaceManager.hasWorkspace(newName)) {
			new Notice(`Workspace "${newName}" already exists`);
			input.value = oldName;
			input.focus();
			input.select();
			return;
		}

		// Perform the rename
		workspaceManager.renameWorkspace(oldName, newName);

		// Rename navigation layout data
		const layout = this.plugin.navigationLayouts.get(oldName);
		if (layout) {
			this.plugin.navigationLayouts.delete(oldName);
			this.plugin.navigationLayouts.set(newName, layout);
		}

		// Save changes
		await this.plugin.saveSettings();

		// Exit edit mode
		input.remove();
		if (textSpan) {
			textSpan.textContent = newName;
			textSpan.style.display = '';
		}
		el.removeClass('is-renaming');
		el.dataset.workspaceName = newName;

		// Update suggestions to show new name
		(this as any).updateSuggestions();

		new Notice(`Renamed workspace to "${newName}"`);
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace deletion
	// ─────────────────────────────────────────────────────────────────

	deleteWorkspace(workspaceName?: string): void {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// If no workspace name provided, use the currently selected one
		if (!workspaceName) {
			const selectedItem = (this as any).chooser.selectedItem;
			const suggestions = (this as any).chooser.values;
			if (selectedItem >= 0 && selectedItem < suggestions.length) {
				workspaceName = suggestions[selectedItem].item;
			}
		}

		if (!workspaceName) return;

		const doDelete = () => {
			// Delete the workspace
			workspaceManager.deleteWorkspace(workspaceName);

			// Delete navigation layout data
			this.plugin.navigationLayouts.delete(workspaceName);
			this.plugin.saveSettings();

			// Update the suggestions list
			(this as any).updateSuggestions();

			new Notice(`Deleted workspace: ${workspaceName}`);
		};

		// Show confirmation dialog if enabled
		if (this.plugin.settings.showDeleteConfirmation) {
			createConfirmationDialog(this.app, {
				title:    'Delete Workspace',
				text:     `Are you sure you want to delete the workspace "${workspaceName}"?`,
				cta:      'Delete',
				onAccept: doDelete
			});
		} else {
			doDelete();
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle empty state (no matches found)
	// ─────────────────────────────────────────────────────────────────

	onNoSuggestion(): void {
		// Clear suggestions
		(this as any).chooser.setSuggestions(null);
		(this as any).chooser.addMessage('No matching workspace found.');

		// Add "Create new workspace" button
		const el = (this as any).chooser.containerEl.querySelector('.suggestion-empty');
		if (el) {
			el.createEl('button', {
				text: 'Create new workspace',
				cls:  'mod-cta'
			}).addEventListener('click', () => {
				this.createNewWorkspace();
			});
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Create new workspace
	// ─────────────────────────────────────────────────────────────────

	async createNewWorkspace(): Promise<void> {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Get workspace name from input
		const inputEl = (this as any).inputEl as HTMLInputElement;
		const workspaceName = inputEl?.value?.trim();

		if (!workspaceName) {
			new Notice('Please enter a workspace name');
			return;
		}

		// Check if workspace already exists
		if (workspaceManager.hasWorkspace(workspaceName)) {
			new Notice(`Workspace "${workspaceName}" already exists`);
			return;
		}

		// Create the new workspace from current layout
		const saveFolderState = this.plugin.settings.rememberNavigationLayout;
		await workspaceManager.saveWorkspace(workspaceName, saveFolderState);
		await this.plugin.saveSettings();

		new Notice(`Created workspace: ${workspaceName}`);

		// Close the modal
		this.close();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	async onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Check for modifier keys
		const shiftKey = evt.shiftKey && !evt.altKey;
		const altKey = evt.altKey && !evt.shiftKey;

		// Handle Shift+Enter: Save current, switch to selected, and close
		if (shiftKey) {
			const currentWorkspace = workspaceManager.getActiveWorkspace();
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				const saveFolderState = this.plugin.settings.rememberNavigationLayout;
				await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			await this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			this.close();
			return;
		}

		// Handle Alt+Enter: Save current AND switch
		if (altKey) {
			const currentWorkspace = workspaceManager.getActiveWorkspace();
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				const saveFolderState = this.plugin.settings.rememberNavigationLayout;
				await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			await this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			return;
		}

		// Handle regular Enter: Just switch (with auto-save if enabled)
		if (this.plugin.settings.autoSaveOnSwitch) {
			const currentWorkspace = workspaceManager.getActiveWorkspace();
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				const saveFolderState = this.plugin.settings.rememberNavigationLayout;
				await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
			}
		}

		// Load the selected workspace
		await this.plugin.loadWorkspace(workspace);
		new Notice(`Switched to workspace: ${workspace}`);
	}
}
