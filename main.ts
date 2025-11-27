// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

import { Plugin, Notice, setIcon } from 'obsidian';
import { WorkspaceNavigatorSettings, DEFAULT_SETTINGS, WorkspaceNavigatorSettingTab } from './settings';
import { WorkspaceSwitcherModal } from './workspace-modal';
import { WorkspaceEditorModal } from './workspace-editor';
import { WorkspaceManager, WorkspacesStorage } from './workspace-manager';
import { createConfirmationDialog } from './confirm-modal';

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
	autoSaveTimeout:       NodeJS.Timeout | null = null;
	private saveQueue:     Promise<void> = Promise.resolve();

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
		console.log(`[Workspace Navigator v${this.manifest.version}] Plugin loaded`);

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

			// Set initial workspace data attribute if there's an active workspace
			const activeWorkspace = this.workspaceManager.getActiveWorkspace();
			if (activeWorkspace) {
				this.updateWorkspaceDataAttribute(activeWorkspace);
			}
		});
	}

	async onunload() {
		console.log('Unloading Workspace Navigator plugin');

		// Save development log before unloading
		await this.workspaceManager.saveLog();

		// Clean up CSS data attribute
		this.updateWorkspaceDataAttribute(null);

		// Clean up auto-save timeout
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
			this.autoSaveTimeout = null;
		}

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

		// Initialize workspace manager with saved storage and debug callback
		const workspaceStorage: WorkspacesStorage = data?.workspaceStorage || {
			workspaces: {},
			activeWorkspace: null,
			version: '2.0.0'
		};
		this.workspaceManager = new WorkspaceManager(
			this.app,
			workspaceStorage,
			() => this.settings.debugMode
		);

		// Restore navigation layouts from saved data
		if (data?.navigationLayouts) {
			this.navigationLayouts = new Map(Object.entries(data.navigationLayouts));
		}
	}

	async saveSettings() {
		// Serialize saves to prevent race conditions
		this.saveQueue = this.saveQueue.then(async () => {
			// Include workspace manager storage in saved data
			const dataToSave = {
				...this.settings,
				workspaceStorage: this.workspaceManager.getStorage(),
				navigationLayouts: Object.fromEntries(this.navigationLayouts)
			};
			await this.saveData(dataToSave);
		}).catch(err => {
			console.error('[Workspace Navigator] Failed to save settings:', err);
		});
		return this.saveQueue;
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

		// Open workspace editor (manage workspaces)
		this.addCommand({
			id: 'open-workspace-editor',
			name: 'Manage workspaces',
			callback: () => {
				new WorkspaceEditorModal(this.app, this).open();
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
				const saveFolderState = this.settings.rememberNavigationLayout;
				await this.workspaceManager.saveWorkspace(workspaceName, saveFolderState);
				new Notice(`Saved workspace: ${workspaceName}`);
			}
		});

		// Duplicate current workspace
		this.addCommand({
			id: 'duplicate-current-workspace',
			name: 'Duplicate current workspace',
			callback: () => {
				const workspaceName = this.workspaceManager.getActiveWorkspace();
				if (!workspaceName) {
					new Notice('No active workspace');
					return;
				}

				// Generate a unique name for the duplicate
				let newName = `${workspaceName} (copy)`;
				let counter = 2;
				while (this.workspaceManager.hasWorkspace(newName)) {
					newName = `${workspaceName} (copy ${counter})`;
					counter++;
				}

				// Duplicate the workspace
				this.workspaceManager.duplicateWorkspace(workspaceName, newName);

				// Also duplicate navigation layout data if it exists
				const layout = this.navigationLayouts.get(workspaceName);
				if (layout) {
					this.navigationLayouts.set(newName, JSON.parse(JSON.stringify(layout)));
				}

				this.saveSettings();

				new Notice(`Duplicated workspace to: ${newName}`);
			}
		});

		// Import from Obsidian Core Workspaces plugin
		this.addCommand({
			id: 'import-from-core-workspaces',
			name: 'Import workspaces from Obsidian core plugin',
			callback: async () => {
				const result = await this.workspaceManager.importFromCorePlugin(false);
				await this.saveSettings();

				if (result.imported.length > 0) {
					new Notice(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`);
				}
				if (result.skipped.length > 0) {
					new Notice(`Skipped ${result.skipped.length} existing workspace(s)`);
				}
				if (result.imported.length === 0 && result.skipped.length === 0) {
					new Notice('No workspaces to import');
				}
			}
		});

		// Import from Obsidian Core Workspaces plugin (with overwrite)
		this.addCommand({
			id: 'import-from-core-workspaces-overwrite',
			name: 'Import workspaces from Obsidian core plugin (overwrite existing)',
			callback: () => {
				const existingCount = this.workspaceManager.getWorkspaceNames().length;

				createConfirmationDialog(this.app, {
					title:   'Overwrite All Workspaces?',
					text:    `This will DELETE all ${existingCount} existing workspace(s) and replace them with workspaces from the core plugin. This cannot be undone.`,
					cta:     'Delete & Import',
					onAccept: async () => {
						const result = await this.workspaceManager.importFromCorePlugin(true);
						await this.saveSettings();

						if (result.imported.length > 0) {
							new Notice(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`);
						}
						if (result.imported.length === 0) {
							new Notice('No workspaces to import');
						}
					}
				});
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

				// Save to plugin data directory (not vault root)
				const configDir = this.app.vault.configDir;
				const logsDir = `${configDir}/plugins/workspace-navigator/logs`;
				const filePath = `${logsDir}/${fileName}`;
				const adapter = this.app.vault.adapter;

				// Ensure logs directory exists
				if (!(await adapter.exists(logsDir))) {
					await adapter.mkdir(logsDir);
				}

				await adapter.write(filePath, report);
				new Notice(`Debug report saved to plugin logs folder`);

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

				// Auto-save on layout change if enabled
				if (this.settings.autoSaveOnLayoutChange) {
					this.handleAutoSaveOnLayoutChange();
				}
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

	/**
	 * Handle auto-save on layout change with debouncing
	 */
	handleAutoSaveOnLayoutChange(): void {
		// Don't save during workspace loading
		if (this.isLoadingWorkspace) {
			return;
		}

		// Get active workspace
		const workspaceName = this.workspaceManager.getActiveWorkspace();
		if (!workspaceName) {
			return;
		}

		// Debounce: Clear any pending save
		if (this.autoSaveTimeout) {
			clearTimeout(this.autoSaveTimeout);
		}

		// Schedule save after 2 seconds of no layout changes
		this.autoSaveTimeout = setTimeout(async () => {
			this.debug(`💾 Auto-saving workspace "${workspaceName}" after layout change`);

			try {
				await this.saveNavigationLayout(workspaceName);
				const saveFolderState = this.settings.rememberNavigationLayout;
				await this.workspaceManager.saveWorkspace(workspaceName, saveFolderState);
				await this.saveSettings();
			} catch (error) {
				console.error('[Workspace Navigator] Auto-save failed:', error);
			}
		}, 2000);
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
			leftSidebarOpen:   leftSplit && leftSplit.collapsed === false,
			rightSidebarOpen:  rightSplit && rightSplit.collapsed === false,
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
		if (leftSplit && typeof leftSplit.collapsed !== 'undefined') {
			if (layout.leftSidebarOpen && leftSplit.collapsed) {
				workspace.leftSplit.expand();
			} else if (!layout.leftSidebarOpen && !leftSplit.collapsed) {
				workspace.leftSplit.collapse();
			}
		}

		if (rightSplit && typeof rightSplit.collapsed !== 'undefined') {
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

		// Set CSS data attribute for workspace-specific styling
		this.updateWorkspaceDataAttribute(name);
	}

	/**
	 * Update body data-workspace-name attribute for CSS theming
	 */
	updateWorkspaceDataAttribute(workspaceName: string | null) {
		const body = document.body;

		if (workspaceName) {
			body.setAttribute('data-workspace-name', workspaceName);
			this.debug(`Set data-workspace-name="${workspaceName}"`);
		} else {
			body.removeAttribute('data-workspace-name');
			this.debug('Removed data-workspace-name attribute');
		}
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
						const saveFolderState = this.settings.rememberNavigationLayout;
						await this.workspaceManager.saveWorkspace(workspaceName, saveFolderState);
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
