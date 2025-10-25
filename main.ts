// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

import { Plugin, Notice, setIcon } from 'obsidian';
import { WorkspaceNavigatorSettings, DEFAULT_SETTINGS, WorkspaceNavigatorSettingTab } from './settings';
import { WorkspaceSwitcherModal } from './workspace-modal';
import { WorkspaceManager, WorkspacesStorage } from './workspace-manager';

// ───────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ───────────────────────────────────────────────────────────────────────────────

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
	workspaceManager:      WorkspaceManager;
	statusBarItem:         HTMLElement | null = null;
	navigationLayouts:     Map<string, NavigationLayoutState> = new Map();
	isLoadingWorkspace:    boolean = false;

	// ─────────────────────────────────────────────────────────────────
	// Debug Logging
	// ─────────────────────────────────────────────────────────────────

	debug(message: string, ...args: any[]) {
		if (this.settings.debugMode) {
			console.log(`[Workspace Navigator] ${message}`, ...args);
		}
	}

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

		// Initialize workspace manager with saved storage
		const workspaceStorage: WorkspacesStorage = data?.workspaceStorage || {
			workspaces: {},
			activeWorkspace: null,
			version: '2.0.0'
		};
		this.workspaceManager = new WorkspaceManager(this.app, workspaceStorage);

		// Restore navigation layouts from saved data
		if (data?.navigationLayouts) {
			this.navigationLayouts = new Map(Object.entries(data.navigationLayouts));
		}
	}

	async saveSettings() {
		// Include workspace manager storage in saved data
		const dataToSave = {
			...this.settings,
			workspaceStorage: this.workspaceManager.getStorage(),
			navigationLayouts: Object.fromEntries(this.navigationLayouts)
		};
		await this.saveData(dataToSave);
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Manager Access (Standalone Implementation)
	// ─────────────────────────────────────────────────────────────────

	getWorkspaceManager(): WorkspaceManager {
		return this.workspaceManager;
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
				const workspaceName = this.workspaceManager.getActiveWorkspace();
				if (!workspaceName) {
					new Notice('No active workspace');
					return;
				}

				await this.saveNavigationLayout(workspaceName);
				await this.workspaceManager.saveWorkspace(workspaceName);
				new Notice(`Saved workspace: ${workspaceName}`);
			}
		});

		// Debug: Dump workspace data
		this.addCommand({
			id: 'debug-dump-workspace-data',
			name: 'Debug: Dump current workspace data',
			callback: async () => {
				const name = this.workspaceManager.getActiveWorkspace();
				if (!name) {
					new Notice('No active workspace');
					return;
				}

				const workspace = this.workspaceManager.getWorkspace(name);
				const folderState = await this.app.loadLocalStorage('file-explorer-unfold');

				console.log('═══════════════════════════════════════════');
				console.log('🔍 WORKSPACE DEBUG DUMP');
				console.log('═══════════════════════════════════════════');
				console.log(`Workspace Name: "${name}"`);
				console.log(`\nSettings:`);
				console.log(`  - Remember layout: ${this.settings.rememberNavigationLayout}`);
				console.log(`  - Maintain across workspaces: ${this.settings.maintainLayoutAcrossWorkspaces}`);
				console.log(`\nCurrent folder state (localStorage):`, folderState);
				console.log(`\nStored workspace data:`, workspace);
				console.log(`\nAll workspaces:`, this.workspaceManager.getWorkspaceNames());
				console.log('═══════════════════════════════════════════');

				new Notice(`Workspace data dumped to console (Ctrl+Shift+I)`);
			}
		});

		// Debug: Export diagnostics to file
		this.addCommand({
			id: 'debug-export-diagnostics',
			name: 'Debug: Export diagnostics to file',
			callback: async () => {
				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
				const fileName = `workspace-navigator-debug-${timestamp}.md`;

				// Gather all diagnostic info
				const currentWorkspace = this.workspaceManager.getActiveWorkspace() || 'None';
				const folderState = await this.app.loadLocalStorage('file-explorer-unfold');
				const allWorkspaces = this.workspaceManager.getWorkspaceNames();

				// Build diagnostic report
				let report = `# Workspace Navigator Debug Report\n\n`;
				report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
				report += `---\n\n`;

				// Settings
				report += `## Settings\n\n`;
				report += `- **Remember navigation layout:** ${this.settings.rememberNavigationLayout}\n`;
				report += `- **Maintain layout across workspaces:** ${this.settings.maintainLayoutAcrossWorkspaces}\n`;
				report += `- **Auto-save on switch:** ${this.settings.autoSaveOnSwitch}\n`;
				report += `- **Sort alphabetically:** ${this.settings.sortWorkspacesAlphabetically}\n`;
				report += `- **Debug mode:** ${this.settings.debugMode}\n\n`;

				// Current state
				report += `## Current State\n\n`;
				report += `- **Active workspace:** ${currentWorkspace}\n`;
				report += `- **Current folder state (localStorage):**\n\`\`\`json\n${JSON.stringify(folderState, null, 2)}\n\`\`\`\n\n`;

				// All workspaces
				report += `## All Workspaces\n\n`;
				report += `Total: ${allWorkspaces.length}\n\n`;

				for (const wsName of allWorkspaces) {
					const ws = this.workspaceManager.getWorkspace(wsName);

					report += `### ${wsName}\n\n`;

					if (ws?.folderExpandState) {
						report += `**Stored folder state:**\n\`\`\`json\n${JSON.stringify(ws.folderExpandState, null, 2)}\n\`\`\`\n\n`;
					} else {
						report += `**Stored folder state:** None\n\n`;
					}

					report += `**Full workspace data:**\n\`\`\`json\n${JSON.stringify(ws, null, 2)}\n\`\`\`\n\n`;
					report += `---\n\n`;
				}

				// Navigation layouts
				report += `## Navigation Layouts (Sidebar State)\n\n`;
				if (this.navigationLayouts.size > 0) {
					for (const [wsName, layout] of this.navigationLayouts.entries()) {
						report += `### ${wsName}\n\`\`\`json\n${JSON.stringify(layout, null, 2)}\n\`\`\`\n\n`;
					}
				} else {
					report += `No navigation layouts stored.\n\n`;
				}

				// Save to vault root
				await this.app.vault.create(fileName, report);
				new Notice(`Debug report saved to ${fileName}`);

				// Also copy to clipboard
				await navigator.clipboard.writeText(report);
				new Notice('Also copied to clipboard!');
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

		// Listen for workspace open event to restore navigation layout
		this.registerEvent(
			(this.app.workspace as any).on('workspace-open', async (workspaceName: string) => {
				this.debug(`🟢 Workspace opened: ${workspaceName}`);
				await this.afterWorkspaceLoad(workspaceName);
			})
		);
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
	async loadWorkspace(name: string) {
		const restoreFolderState = this.settings.rememberNavigationLayout &&
		                           !this.settings.maintainLayoutAcrossWorkspaces;

		this.beforeWorkspaceLoad(name);
		await this.workspaceManager.loadWorkspace(name, restoreFolderState);
		await this.saveSettings(); // Save after loading
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
			this.statusBarItem.addEventListener('click', async (evt: MouseEvent) => {
				// Shift+Click to save current workspace
				if (evt.shiftKey) {
					const workspaceName = this.workspaceManager.getActiveWorkspace();
					if (workspaceName) {
						await this.saveNavigationLayout(workspaceName);
						await this.workspaceManager.saveWorkspace(workspaceName);
						await this.saveSettings();
						new Notice(`Saved workspace: ${workspaceName}`);
					}
					return;
				}

				// Regular click opens modal
				new WorkspaceSwitcherModal(this.app, this).open();
			});
		}

		// Update text
		const textEl = this.statusBarItem.querySelector('.workspace-navigator-text');
		if (textEl) {
			const workspaceName = this.workspaceManager.getActiveWorkspace() || 'No workspace';
			textEl.setText(workspaceName);
		}
	}
}
