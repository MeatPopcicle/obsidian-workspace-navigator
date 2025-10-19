// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin:     WorkspaceNavigator;
	workspaces: string[];

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
		super.onClose();
	}

	// ─────────────────────────────────────────────────────────────────
	// Get list of workspaces (sorted if enabled)
	// ─────────────────────────────────────────────────────────────────

	getItems(): string[] {
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return [];
		}

		const workspaces = Object.keys(workspacePlugin.workspaces);

		// Sort alphabetically if enabled
		if (this.plugin.settings.sortWorkspacesAlphabetically) {
			return workspaces.sort((a, b) => {
				// Natural sort for numbers: "Workspace 2" comes before "Workspace 10"
				return a.localeCompare(b, undefined, {
					numeric: true,
					sensitivity: 'base'
				});
			});
		}

		return workspaces;
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

		// Add active workspace indicator (checkmark)
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (workspacePlugin && workspaceName === workspacePlugin.activeWorkspace) {
			const activeIndicator = el.createSpan('workspace-active-indicator');
			activeIndicator.setAttribute('aria-label', 'Active workspace');
			activeIndicator.style.color = 'var(--interactive-accent)';
			activeIndicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`;
			el.addClass('is-active');
		}

		// Create delete button
		const deleteBtn = el.createSpan('workspace-delete-btn');
		deleteBtn.setAttribute('aria-label', 'Delete workspace');
		deleteBtn.style.color = 'var(--text-muted)';
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;
		deleteBtn.addEventListener('mouseenter', () => {
			deleteBtn.style.color = 'var(--text-error)';
		});
		deleteBtn.addEventListener('mouseleave', () => {
			deleteBtn.style.color = 'var(--text-muted)';
		});
		deleteBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.deleteWorkspace(workspaceName);
		});

		// Create rename button
		const renameBtn = el.createSpan('workspace-rename-btn');
		renameBtn.setAttribute('aria-label', 'Rename workspace');
		renameBtn.style.color = 'var(--text-muted)';
		renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path fill="currentColor" d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
		renameBtn.addEventListener('mouseenter', () => {
			renameBtn.style.color = 'var(--text-accent-hover)';
		});
		renameBtn.addEventListener('mouseleave', () => {
			renameBtn.style.color = 'var(--text-muted)';
		});
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

		// If already in edit mode, cancel
		if (el.contentEditable === 'true') {
			el.textContent = el.dataset.workspaceName || '';
			el.contentEditable = 'false';
			el.removeClass('is-renaming');
			return;
		}

		// Enter edit mode
		el.addClass('is-renaming');
		el.contentEditable = 'true';

		// Select all text
		const selection = window.getSelection();
		const range = document.createRange();
		if (selection) {
			selection.removeAllRanges();
			range.selectNodeContents(el);
			range.collapse(false);
			selection.addRange(range);
		}
		el.focus();

		// Handle blur (cancel edit)
		el.onblur = () => {
			if (el.contentEditable === 'true') {
				el.textContent = el.dataset.workspaceName || '';
				el.contentEditable = 'false';
				el.removeClass('is-renaming');
			}
		};

		// Handle Enter key (confirm rename)
		el.onkeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.handleRename(el);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				el.textContent = el.dataset.workspaceName || '';
				el.contentEditable = 'false';
				el.removeClass('is-renaming');
				el.blur();
			}
		};
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace rename
	// ─────────────────────────────────────────────────────────────────

	handleRename(el: HTMLElement): void {
		const oldName = el.dataset.workspaceName;
		const newName = el.textContent?.trim();

		if (!oldName || !newName || oldName === newName) {
			el.contentEditable = 'false';
			el.removeClass('is-renaming');
			return;
		}

		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		// Check if new name already exists
		if (workspacePlugin.workspaces[newName]) {
			new Notice(`Workspace "${newName}" already exists`);
			el.textContent = oldName;
			el.contentEditable = 'false';
			el.removeClass('is-renaming');
			return;
		}

		// Perform the rename
		workspacePlugin.workspaces[newName] = workspacePlugin.workspaces[oldName];
		delete workspacePlugin.workspaces[oldName];

		// If this is the active workspace, update it
		if (workspacePlugin.activeWorkspace === oldName) {
			workspacePlugin.setActiveWorkspace(newName);
		}

		// Rename navigation layout data
		const layout = this.plugin.navigationLayouts.get(oldName);
		if (layout) {
			this.plugin.navigationLayouts.delete(oldName);
			this.plugin.navigationLayouts.set(newName, layout);
		}

		// Save changes
		workspacePlugin.saveData();
		this.plugin.saveSettings();

		// Trigger rename event
		this.app.workspace.trigger('workspace-rename', newName, oldName);

		// Exit edit mode
		el.contentEditable = 'false';
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
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

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
			workspacePlugin.deleteWorkspace(workspaceName);

			// Delete navigation layout data
			this.plugin.navigationLayouts.delete(workspaceName);
			this.plugin.saveSettings();

			// Trigger delete event
			this.app.workspace.trigger('workspace-delete', workspaceName);

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

	createNewWorkspace(): void {
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		// Get workspace name from input
		const inputEl = (this as any).inputEl as HTMLInputElement;
		const workspaceName = inputEl?.value?.trim();

		if (!workspaceName) {
			new Notice('Please enter a workspace name');
			return;
		}

		// Check if workspace already exists
		if (workspacePlugin.workspaces[workspaceName]) {
			new Notice(`Workspace "${workspaceName}" already exists`);
			return;
		}

		// Create the new workspace from current layout
		workspacePlugin.saveWorkspace(workspaceName);
		workspacePlugin.setActiveWorkspace(workspaceName);

		new Notice(`Created workspace: ${workspaceName}`);

		// Close the modal
		this.close();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	async onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		// Check for modifier keys
		const shiftKey = evt.shiftKey && !evt.altKey;
		const altKey = evt.altKey && !evt.shiftKey;

		// Handle Shift+Enter: Save current, switch to selected, and close
		if (shiftKey) {
			const currentWorkspace = workspacePlugin.activeWorkspace;
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				workspacePlugin.saveWorkspace(currentWorkspace);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			workspacePlugin.setActiveWorkspace(workspace);
			this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			this.close();
			return;
		}

		// Handle Alt+Enter: Save current AND switch
		if (altKey) {
			const currentWorkspace = workspacePlugin.activeWorkspace;
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				workspacePlugin.saveWorkspace(currentWorkspace);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			return;
		}

		// Handle regular Enter: Just switch (with auto-save if enabled)
		if (this.plugin.settings.autoSaveOnSwitch) {
			const currentWorkspace = workspacePlugin.activeWorkspace;
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				workspacePlugin.saveWorkspace(currentWorkspace);
			}
		}

		// Load the selected workspace
		this.plugin.loadWorkspace(workspace);
		new Notice(`Switched to workspace: ${workspace}`);
	}
}
