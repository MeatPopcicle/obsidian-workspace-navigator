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
}

interface NavigationLayoutState {
	leftSidebarOpen:    boolean;
	rightSidebarOpen:   boolean;
	leftSidebarTab:     string | null;
	rightSidebarTab:    string | null;
	leftSidebarWidth:   number | null;
	rightSidebarWidth:  number | null;
	folderExpandState:  string | null;  // File explorer folder expansion state
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

		// Monitor workspace loading via the core plugin
		const workspacePlugin = this.getWorkspacePlugin();
		if (workspacePlugin) {
			// Store the original loadWorkspace method
			const originalLoad = workspacePlugin.loadWorkspace.bind(workspacePlugin);

			// Wrap it to add our navigation layout handling
			workspacePlugin.loadWorkspace = (name: string) => {
				this.beforeWorkspaceLoad(name);
				const result = originalLoad(name);
				this.afterWorkspaceLoad(name);
				return result;
			};
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Navigation Layout Memory System
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Capture current navigation layout state
	 */
	async getCurrentNavigationLayout(): Promise<NavigationLayoutState> {
		const workspace = this.app.workspace;
		const leftSplit  = workspace.leftSplit;
		const rightSplit = workspace.rightSplit;

		// Capture folder expansion state using Obsidian API
		const folderExpandState = await this.app.loadLocalStorage('file-explorer-unfold');

		return {
			leftSidebarOpen:   leftSplit?.collapsed === false,
			rightSidebarOpen:  rightSplit?.collapsed === false,
			leftSidebarTab:    (leftSplit as any)?.getActiveLeaf?.()?.getViewState?.()?.type || null,
			rightSidebarTab:   (rightSplit as any)?.getActiveLeaf?.()?.getViewState?.()?.type || null,
			leftSidebarWidth:  leftSplit ? (leftSplit as any).containerEl?.offsetWidth : null,
			rightSidebarWidth: rightSplit ? (rightSplit as any).containerEl?.offsetWidth : null,
			folderExpandState: folderExpandState,
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
	 * Restore navigation layout for a workspace
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

		// Restore folder expansion state FIRST (before sidebars)
		// This ensures the file explorer has the correct state before being shown
		if (layout.folderExpandState) {
			await this.app.saveLocalStorage('file-explorer-unfold', layout.folderExpandState);
		}

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

		// Save current workspace's navigation layout
		const workspacePlugin = this.getWorkspacePlugin();
		if (workspacePlugin?.activeWorkspace && this.settings.rememberNavigationLayout) {
			await this.saveNavigationLayout(workspacePlugin.activeWorkspace);
		}
	}

	async afterWorkspaceLoad(name: string) {
		// Wait for workspace layout to fully load
		// The core workspace plugin loads its layout data, we need to restore AFTER that
		setTimeout(async () => {
			await this.restoreNavigationLayout(name);
			this.isLoadingWorkspace = false;
			this.updateStatusBar();
		}, 250);
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
