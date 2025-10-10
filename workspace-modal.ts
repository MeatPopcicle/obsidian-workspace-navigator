// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, Notice } from 'obsidian';
import WorkspaceNavigator from './main';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin: WorkspaceNavigator;
	workspaces: string[];

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;
		this.setPlaceholder('Type workspace name...');

		// Add instructions if enabled
		if (plugin.settings.showInstructions) {
			this.setInstructions([
				{ command: '↵', purpose: 'switch to workspace' },
				{ command: 'esc', purpose: 'cancel' }
			]);
		}
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
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): void {
		const workspacePlugin = this.plugin.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		// Auto-save current workspace if enabled
		if (this.plugin.settings.autoSaveOnSwitch) {
			const currentWorkspace = workspacePlugin.activeWorkspace;
			if (currentWorkspace) {
				this.plugin.saveNavigationLayout(currentWorkspace);
				workspacePlugin.saveWorkspace(currentWorkspace);
			}
		}

		// Load the selected workspace
		this.plugin.loadWorkspace(workspace);
		new Notice(`Switched to workspace: ${workspace}`);
	}
}
