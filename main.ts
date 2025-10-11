// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

import { Plugin, Notice, setIcon } from 'obsidian';
import { WorkspaceNavigatorSettings, DEFAULT_SETTINGS, WorkspaceNavigatorSettingTab } from './settings';
import { WorkspaceSwitcherModal } from './workspace-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ───────────────────────────────────────────────────────────────────────────────

interface WorkspacePluginInstance {
	workspaces: Record<string, any>;
	activeWorkspace: string | null;
	saveWorkspace(name: string): void;
	loadWorkspace(name: string): void;
	setActiveWorkspace(name: string): void;
	saveData(): void;
}

interface NavigationLayoutState {
	leftSidebarOpen:    boolean;
	rightSidebarOpen:   boolean;
	leftSidebarTab:     string | null;
	rightSidebarTab:    string | null;
	leftSidebarWidth:   number | null;
	rightSidebarWidth:  number | null;
	// Note: folderExpandState is stored directly in workspace data, not here
}

// ───────────────────────────────────────────────────────────────────────────────
// Main Plugin Class
// ───────────────────────────────────────────────────────────────────────────────

export default class WorkspaceNavigator extends Plugin {
	settings:              WorkspaceNavigatorSettings;
	statusBarItem:         HTMLElement | null = null;
	navigationLayouts:     Map<string, NavigationLayoutState> = new Map();
	isLoadingWorkspace:    boolean = false;

	// ─────────────────────────────────────────────────────────────────
	// Plugin Lifecycle
	// ─────────────────────────────────────────────────────────────────

	async onload() {
		console.log('Loading Workspace Navigator plugin');

		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new WorkspaceNavigatorSettingTab(this.app, this));

		// Register commands
		this.registerCommands();

		// Set up status bar
		this.app.workspace.onLayoutReady(() => {
			this.updateStatusBar();
			this.registerWorkspaceEvents();
		});
	}

	async onunload() {
		console.log('Unloading Workspace Navigator plugin');
		// Clean up status bar
		if (this.statusBarItem) {
			this.statusBarItem.remove();
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Settings Management
	// ─────────────────────────────────────────────────────────────────

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);

		// Restore navigation layouts from saved data
		if (data?.navigationLayouts) {
			this.navigationLayouts = new Map(Object.entries(data.navigationLayouts));
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Plugin Access
	// ─────────────────────────────────────────────────────────────────

	getWorkspacePlugin(): WorkspacePluginInstance | null {
		// Access the core workspaces plugin
		const workspacePlugin = (this.app as any).internalPlugins?.getPluginById?.('workspaces');

		if (!workspacePlugin || !workspacePlugin.enabled) {
			return null;
		}

		return workspacePlugin.instance as WorkspacePluginInstance;
	}

	// ─────────────────────────────────────────────────────────────────
	// Command Registration
	// ─────────────────────────────────────────────────────────────────

	registerCommands() {
		// Open workspace switcher
		this.addCommand({
			id: 'open-workspace-switcher',
			name: 'Open workspace switcher',
			callback: () => {
				new WorkspaceSwitcherModal(this.app, this).open();
			}
		});

		// Save current workspace
		this.addCommand({
			id: 'save-current-workspace',
			name: 'Save current workspace',
			callback: async () => {
				const workspacePlugin = this.getWorkspacePlugin();
				if (!workspacePlugin || !workspacePlugin.activeWorkspace) {
					new Notice('No active workspace');
					return;
				}

				const workspaceName = workspacePlugin.activeWorkspace;
				await this.saveNavigationLayout(workspaceName);
				workspacePlugin.saveWorkspace(workspaceName);
				new Notice(`Saved workspace: ${workspaceName}`);
			}
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Event Handling
	// ─────────────────────────────────────────────────────────────────

	registerWorkspaceEvents() {
		// Listen for workspace changes
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.updateStatusBar();
			})
		);

		// Hook into workspace save/load to inject folder expansion state
		const workspacePlugin = this.getWorkspacePlugin();
		if (workspacePlugin) {
			// Store the original methods
			const originalSave = workspacePlugin.saveWorkspace.bind(workspacePlugin);
			const originalLoad = workspacePlugin.loadWorkspace.bind(workspacePlugin);

			// Wrap saveWorkspace to inject folder expansion state into workspace data
			workspacePlugin.saveWorkspace = async (name: string) => {
				if (!name) return;

				// Save the workspace first
				const result = originalSave(name);

				// Then inject our folder expansion state into the workspace data
				if (this.settings.rememberNavigationLayout) {
					const folderState = await this.app.loadLocalStorage('file-explorer-unfold');
					if (folderState && workspacePlugin.workspaces[name]) {
						// Store in workspace data using a custom property
						if (!workspacePlugin.workspaces[name]['workspace-navigator:data']) {
							workspacePlugin.workspaces[name]['workspace-navigator:data'] = {};
						}
						workspacePlugin.workspaces[name]['workspace-navigator:data'].folderExpandState = folderState;
						workspacePlugin.saveData();
					}
				}

				return result;
			};

			// Wrap loadWorkspace to restore folder expansion state from workspace data
			workspacePlugin.loadWorkspace = async (name: string) => {
				if (!name) return;

				this.beforeWorkspaceLoad(name);
				const result = originalLoad(name);

				// Restore folder state from workspace data
				setTimeout(async () => {
					if (this.settings.rememberNavigationLayout && !this.settings.maintainLayoutAcrossWorkspaces) {
						const workspace = workspacePlugin.workspaces[name];
						if (workspace && workspace['workspace-navigator:data']?.folderExpandState) {
							await this.app.saveLocalStorage('file-explorer-unfold', workspace['workspace-navigator:data'].folderExpandState);
						}
					}

					this.afterWorkspaceLoad(name);
				}, 300);

				return result;
			};
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Navigation Layout Memory System
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Capture current navigation layout state (sidebar state only)
	 * Note: Folder expansion state is handled via workspace data injection
	 */
	async getCurrentNavigationLayout(): Promise<NavigationLayoutState> {
		const workspace = this.app.workspace;
		const leftSplit  = workspace.leftSplit;
		const rightSplit = workspace.rightSplit;

		return {
			leftSidebarOpen:   leftSplit?.collapsed === false,
			rightSidebarOpen:  rightSplit?.collapsed === false,
			leftSidebarTab:    (leftSplit as any)?.getActiveLeaf?.()?.getViewState?.()?.type || null,
			rightSidebarTab:   (rightSplit as any)?.getActiveLeaf?.()?.getViewState?.()?.type || null,
			leftSidebarWidth:  leftSplit ? (leftSplit as any).containerEl?.offsetWidth : null,
			rightSidebarWidth: rightSplit ? (rightSplit as any).containerEl?.offsetWidth : null,
		};
	}

	/**
	 * Save navigation layout for a workspace
	 */
	async saveNavigationLayout(workspaceName: string) {
		if (!this.settings.rememberNavigationLayout) {
			return;
		}

		const layout = await this.getCurrentNavigationLayout();
		this.navigationLayouts.set(workspaceName, layout);

		// Persist to plugin data
		await this.saveData({
			...this.settings,
			navigationLayouts: Object.fromEntries(this.navigationLayouts)
		});
	}

	/**
	 * Restore navigation layout for a workspace (sidebar state only)
	 * Note: Folder expansion state is handled via workspace data injection
	 */
	async restoreNavigationLayout(workspaceName: string) {
		if (!this.settings.rememberNavigationLayout || this.settings.maintainLayoutAcrossWorkspaces) {
			return;
		}

		const layout = this.navigationLayouts.get(workspaceName);
		if (!layout) {
			return;
		}

		const workspace = this.app.workspace;
		const leftSplit  = workspace.leftSplit;
		const rightSplit = workspace.rightSplit;

		// Restore sidebar states
		if (leftSplit) {
			if (layout.leftSidebarOpen && leftSplit.collapsed) {
				workspace.leftSplit.expand();
			} else if (!layout.leftSidebarOpen && !leftSplit.collapsed) {
				workspace.leftSplit.collapse();
			}
		}

		if (rightSplit) {
			if (layout.rightSidebarOpen && rightSplit.collapsed) {
				workspace.rightSplit.expand();
			} else if (!layout.rightSidebarOpen && !rightSplit.collapsed) {
				workspace.rightSplit.collapse();
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Loading Hooks
	// ─────────────────────────────────────────────────────────────────

	async beforeWorkspaceLoad(name: string) {
		this.isLoadingWorkspace = true;
	}

	async afterWorkspaceLoad(name: string) {
		// Restore sidebar states (folder state is handled via workspace data injection)
		await this.restoreNavigationLayout(name);
		this.isLoadingWorkspace = false;
		this.updateStatusBar();
	}

	/**
	 * Public method to load a workspace with navigation handling
	 */
	loadWorkspace(name: string) {
		const workspacePlugin = this.getWorkspacePlugin();
		if (!workspacePlugin) {
			new Notice('Workspaces core plugin is not enabled');
			return;
		}

		workspacePlugin.loadWorkspace(name);
	}

	// ─────────────────────────────────────────────────────────────────
	// Status Bar UI
	// ─────────────────────────────────────────────────────────────────

	updateStatusBar() {
		if (!this.settings.showStatusBar) {
			if (this.statusBarItem) {
				this.statusBarItem.remove();
				this.statusBarItem = null;
			}
			return;
		}

		if (!this.statusBarItem) {
			this.statusBarItem = this.addStatusBarItem();
			this.statusBarItem.addClass('workspace-navigator-status');

			// Add icon
			const icon = this.statusBarItem.createSpan('workspace-navigator-icon');
			setIcon(icon, 'layout-dashboard');

			// Add text element
			this.statusBarItem.createSpan('workspace-navigator-text');

			// Add click handler
			this.statusBarItem.addEventListener('click', () => {
				new WorkspaceSwitcherModal(this.app, this).open();
			});
		}

		// Update text
		const textEl = this.statusBarItem.querySelector('.workspace-navigator-text');
		if (textEl) {
			const workspacePlugin = this.getWorkspacePlugin();
			const workspaceName = workspacePlugin?.activeWorkspace || 'No workspace';
			textEl.setText(workspaceName);
		}
	}
}
