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

		// Debug: Dump workspace data
		this.addCommand({
			id: 'debug-dump-workspace-data',
			name: 'Debug: Dump current workspace data',
			callback: async () => {
				const workspacePlugin = this.getWorkspacePlugin();
				if (!workspacePlugin || !workspacePlugin.activeWorkspace) {
					new Notice('No active workspace');
					return;
				}

				const name = workspacePlugin.activeWorkspace;
				const workspace = workspacePlugin.workspaces[name];
				const folderState = await this.app.loadLocalStorage('file-explorer-unfold');

				console.log('═══════════════════════════════════════════');
				console.log('🔍 WORKSPACE DEBUG DUMP');
				console.log('═══════════════════════════════════════════');
				console.log(`Workspace Name: "${name}"`);
				console.log(`\nSettings:`);
				console.log(`  - Remember layout: ${this.settings.rememberNavigationLayout}`);
				console.log(`  - Maintain across workspaces: ${this.settings.maintainLayoutAcrossWorkspaces}`);
				console.log(`\nCurrent folder state (localStorage):`, folderState);
				console.log(`\nStored workspace data:`, workspace?.['workspace-navigator:data']);
				console.log(`\nFull workspace object:`, workspace);
				console.log(`\nAll workspaces:`, Object.keys(workspacePlugin.workspaces));
				console.log('═══════════════════════════════════════════');

				new Notice(`Workspace data dumped to console (Ctrl+Shift+I)`);
			}
		});

		// Debug: Export diagnostics to file
		this.addCommand({
			id: 'debug-export-diagnostics',
			name: 'Debug: Export diagnostics to file',
			callback: async () => {
				const workspacePlugin = this.getWorkspacePlugin();
				if (!workspacePlugin) {
					new Notice('Workspaces core plugin is not enabled');
					return;
				}

				const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
				const fileName = `workspace-navigator-debug-${timestamp}.md`;

				// Gather all diagnostic info
				const currentWorkspace = workspacePlugin.activeWorkspace || 'None';
				const folderState = await this.app.loadLocalStorage('file-explorer-unfold');
				const allWorkspaces = Object.keys(workspacePlugin.workspaces);

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
					const ws = workspacePlugin.workspaces[wsName];
					const navData = ws?.['workspace-navigator:data'];

					report += `### ${wsName}\n\n`;

					if (navData?.folderExpandState) {
						report += `**Stored folder state:**\n\`\`\`json\n${JSON.stringify(navData.folderExpandState, null, 2)}\n\`\`\`\n\n`;
					} else {
						report += `**Stored folder state:** None\n\n`;
					}

					report += `**Full workspace-navigator:data:**\n\`\`\`json\n${JSON.stringify(navData, null, 2)}\n\`\`\`\n\n`;
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

		// Hook into workspace save/load to inject folder expansion state
		const workspacePlugin = this.getWorkspacePlugin();
		if (workspacePlugin) {
			// Store the original methods
			const originalSave = workspacePlugin.saveWorkspace.bind(workspacePlugin);
			const originalLoad = workspacePlugin.loadWorkspace.bind(workspacePlugin);

			// Wrap saveWorkspace to inject folder expansion state into workspace data
			workspacePlugin.saveWorkspace = async (name: string) => {
				if (!name) return;

				this.debug(`🔵 SAVE WORKSPACE: "${name}"`);

				// Save the workspace first
				const result = originalSave(name);

				// Then inject our folder expansion state into the workspace data
				if (this.settings.rememberNavigationLayout) {
					const folderState = await this.app.loadLocalStorage('file-explorer-unfold');
					this.debug(`  📂 Current folder state:`, folderState);

					if (folderState && workspacePlugin.workspaces[name]) {
						// Store in workspace data using a custom property
						if (!workspacePlugin.workspaces[name]['workspace-navigator:data']) {
							workspacePlugin.workspaces[name]['workspace-navigator:data'] = {};
						}
						workspacePlugin.workspaces[name]['workspace-navigator:data'].folderExpandState = folderState;
						workspacePlugin.saveData();
						this.debug(`  ✅ Folder state saved to workspace data`);
					} else {
						this.debug(`  ⚠️ No folder state to save or workspace doesn't exist`);
					}
				} else {
					this.debug(`  ⏭️ Skip: Remember navigation layout is disabled`);
				}

				return result;
			};

			// Wrap loadWorkspace to restore folder expansion state from workspace data
			workspacePlugin.loadWorkspace = async (name: string) => {
				if (!name) return;

				this.debug(`🟢 LOAD WORKSPACE: "${name}"`);
				this.debug(`  Settings: rememberLayout=${this.settings.rememberNavigationLayout}, maintainLayout=${this.settings.maintainLayoutAcrossWorkspaces}`);

				this.beforeWorkspaceLoad(name);

				// CRITICAL: Update localStorage BEFORE calling originalLoad
				// The file explorer reads from localStorage when changeLayout rebuilds it
				if (this.settings.rememberNavigationLayout && !this.settings.maintainLayoutAcrossWorkspaces) {
					const workspace = workspacePlugin.workspaces[name];
					const storedState = workspace?.['workspace-navigator:data']?.folderExpandState;

					this.debug(`  📂 Stored folder state:`, storedState);

					if (workspace && storedState) {
						const currentState = await this.app.loadLocalStorage('file-explorer-unfold');
						this.debug(`  📂 Current folder state (before restore):`, currentState);

						await this.app.saveLocalStorage('file-explorer-unfold', storedState);

						const afterState = await this.app.loadLocalStorage('file-explorer-unfold');
						this.debug(`  📂 Folder state (after restore):`, afterState);
						this.debug(`  ✅ Folder state restored BEFORE loading workspace`);
					} else {
						this.debug(`  ⚠️ No stored folder state found in workspace data`);
					}
				} else {
					this.debug(`  ⏭️ Skip restore: rememberLayout=${this.settings.rememberNavigationLayout}, maintainLayout=${this.settings.maintainLayoutAcrossWorkspaces}`);
				}

				// Now call originalLoad - it will rebuild the file explorer and read from the updated localStorage
				const result = originalLoad(name);

				// Call afterWorkspaceLoad after a delay to ensure layout has changed
				setTimeout(() => {
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
