// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice, Scope } from 'obsidian';
import WorkspaceNavigator from './main';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin:     WorkspaceNavigator;
	workspaces: string[];
	scope:      Scope;

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Type workspace name...');

		// Set up custom key bindings
		this.scope = new Scope();
		this.setupScope();

		// Add instructions if enabled
		if (plugin.settings.showInstructions) {
			this.setInstructions([
				{ command: '↵', purpose: 'switch to workspace' },
				{ command: 'ctrl ↵', purpose: 'rename' },
				{ command: 'esc', purpose: 'cancel' }
			]);
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Set up keyboard shortcuts
	// ─────────────────────────────────────────────────────────────────

	setupScope(): void {
		// Ctrl+Enter to rename workspace
		this.scope.register(['Ctrl'], 'Enter', (evt) => {
			evt.preventDefault();
			this.onRenameClick(evt);
			return false;
		});
	}

	onOpen(): void {
		super.onOpen();
		// Push our custom scope
		(this.app as any).keymap.pushScope(this.scope);
	}

	onClose(): void {
		// Pop our custom scope
		(this.app as any).keymap.popScope(this.scope);
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

		// Create rename button
		const renameBtn = el.createSpan('workspace-rename-btn');
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
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	async onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		// Auto-save current workspace if enabled
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
