// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR PLUGIN
// ═══════════════════════════════════════════════════════════════════════════════

import { Plugin, Notice, setIcon, WorkspaceLeaf } from 'obsidian';
import { WorkspaceNavigatorSettings, DEFAULT_SETTINGS, WorkspaceNavigatorSettingTab } from './settings';
import { WorkspaceSwitcherModal, WorkspacePickerModal } from './workspace-modal';
import { WorkspaceEditorModal } from './workspace-editor';
import { WorkspaceManager, WorkspacesStorage } from './workspace-manager';
import { createConfirmationDialog } from './confirm-modal';
import { WorkspaceNavigatorView, VIEW_TYPE_WORKSPACE_NAVIGATOR } from './workspace-sidebar-view';

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
	settings:                    WorkspaceNavigatorSettings;
	workspaceManager:            WorkspaceManager;
	statusBarItem:               HTMLElement | null = null;
	navigationLayouts:           Map<string, NavigationLayoutState> = new Map();
	isLoadingWorkspace:          boolean = false;
	autoSaveTimeout:             NodeJS.Timeout | null = null;
	private saveQueue:           Promise<void> = Promise.resolve();
	private workspaceCommandIds: Set<string> = new Set();

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
		// Load settings
		await this.loadSettings();

		// Add settings tab
		this.addSettingTab(new WorkspaceNavigatorSettingTab(this.app, this));

		// Register the sidebar view
		this.registerView(
			VIEW_TYPE_WORKSPACE_NAVIGATOR,
			(leaf) => new WorkspaceNavigatorView(leaf, this)
		);

		// Register commands
		this.registerCommands();

		// Register file menu (right-click on tab) context menu
		this.registerFileMenu();

		// Add ribbon icon to open sidebar view
		this.addRibbonIcon('layout-template', 'Open workspace navigator', () => {
			this.activateSidebarView();
		});

		// Set up status bar and tab indicators
		this.app.workspace.onLayoutReady(() => {
			this.updateStatusBar();
			this.updateTabIndicators();
			this.registerWorkspaceEvents();

			// Set initial workspace data attribute if there's an active workspace
			const activeWorkspace = this.workspaceManager.getActiveWorkspace();
			if (activeWorkspace) {
				this.updateWorkspaceDataAttribute(activeWorkspace);
			}
		});
	}

	async onunload() {
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

		// Clean up sidebar view
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_WORKSPACE_NAVIGATOR);
	}

	// ─────────────────────────────────────────────────────────────────
	// Sidebar View Management
	// ─────────────────────────────────────────────────────────────────

	async activateSidebarView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_NAVIGATOR);

		if (leaves.length > 0) {
			// View already exists, reveal it
			leaf = leaves[0];
		} else {
			// Create new leaf in right sidebar
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type:   VIEW_TYPE_WORKSPACE_NAVIGATOR,
					active: true,
				});
			}
		}

		// Reveal the leaf
		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Refresh the sidebar view if it's open
	 */
	refreshSidebarView() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_NAVIGATOR);
		for (const leaf of leaves) {
			const view = leaf.view as WorkspaceNavigatorView;
			if (view && typeof view.refresh === 'function') {
				view.refresh();
			}
		}
	}

	/**
	 * Notify sidebar that a workspace was renamed (preserves collapsed state)
	 */
	notifySidebarWorkspaceRenamed(oldName: string, newName: string) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_NAVIGATOR);
		for (const leaf of leaves) {
			const view = leaf.view as WorkspaceNavigatorView;
			if (view && typeof view.onWorkspaceRenamed === 'function') {
				view.onWorkspaceRenamed(oldName, newName);
			}
		}
	}

	/**
	 * Notify sidebar that a group was renamed (preserves collapsed state)
	 */
	notifySidebarGroupRenamed(oldName: string, newName: string) {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_WORKSPACE_NAVIGATOR);
		for (const leaf of leaves) {
			const view = leaf.view as WorkspaceNavigatorView;
			if (view && typeof view.onGroupRenamed === 'function') {
				view.onGroupRenamed(oldName, newName);
			}
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

		// One-time cleanup of orphaned group data left by older delete/rename
		// bugs (ghost groups, dead style entries). Safe: preserves empty groups.
		const pruned = this.workspaceManager.pruneOrphanedGroupData();
		if (pruned > 0) {
			this.workspaceManager.logger.log(`[loadSettings] Pruned ${pruned} orphaned group data entr(ies)`);
		}

		// Log what we loaded to file
		this.workspaceManager.logger.log(`[loadSettings] data?.workspaceStorage exists: ${!!data?.workspaceStorage}`);
		this.workspaceManager.logger.log(`[loadSettings] data?.workspaceStorage?.groupOrder: ${JSON.stringify(data?.workspaceStorage?.groupOrder)}`);
		this.workspaceManager.logger.log(`[loadSettings] workspaceStorage.groupOrder: ${JSON.stringify(workspaceStorage.groupOrder)}`);
		this.workspaceManager.logger.log(`[loadSettings] workspaceStorage.groupIcons: ${JSON.stringify(workspaceStorage.groupIcons)}`);
		await this.workspaceManager.saveLog();

		// Restore navigation layouts from saved data
		if (data?.navigationLayouts) {
			this.navigationLayouts = new Map(Object.entries(data.navigationLayouts));
		}
	}

	async saveSettings() {
		// Capture stack trace for debugging
		const stack = new Error().stack;

		// Serialize saves to prevent race conditions
		this.saveQueue = this.saveQueue.then(async () => {
			// Include workspace manager storage in saved data
			const storage = this.workspaceManager.getStorage();
			this.workspaceManager.logger.log(`[saveSettings] CALLED FROM:\n${stack}`);
			this.workspaceManager.logger.log(`[saveSettings] storage.groupOrder: ${JSON.stringify(storage.groupOrder)}`);
			this.workspaceManager.logger.log(`[saveSettings] storage.groupIcons: ${JSON.stringify(storage.groupIcons)}`);

			const dataToSave = {
				...this.settings,
				workspaceStorage: storage,
				navigationLayouts: Object.fromEntries(this.navigationLayouts)
			};
			this.workspaceManager.logger.log(`[saveSettings] dataToSave.workspaceStorage.groupOrder: ${JSON.stringify(dataToSave.workspaceStorage?.groupOrder)}`);
			await this.workspaceManager.saveLog();

			await this.saveData(dataToSave);

			// Auto-backup if enabled
			if (this.settings.autoBackupEnabled) {
				await this.writeBackup(dataToSave);
			}
		}).catch(err => {
			console.error('[Workspace Navigator] Failed to save settings:', err);
		});
		return this.saveQueue;
	}

	/**
	 * Write backup file to specified path
	 */
	private async writeBackup(data: any): Promise<void> {
		try {
			const backupPath = this.settings.autoBackupPath || (this.app.vault.adapter as any).basePath;
			const vaultName  = this.app.vault.getName();
			const safeVaultName = vaultName.replace(/[^a-zA-Z0-9_-]/g, '_');
			const fileName   = `workspace-navigator-backup-${safeVaultName}.json`;
			const fullPath   = `${backupPath}/${fileName}`;

			// Use Node.js fs for absolute paths outside vault
			const fs = require('fs').promises;
			await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');

			this.debug(`Backup written to: ${fullPath}`);
		} catch (err) {
			console.error('[Workspace Navigator] Failed to write backup:', err);
		}
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

		// Open sidebar navigator
		this.addCommand({
			id: 'open-sidebar-navigator',
			name: 'Open sidebar navigator',
			callback: () => {
				this.activateSidebarView();
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

				// Register commands for imported workspaces
				if (result.imported.length > 0) {
					this.refreshWorkspaceCommands();
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

						// Register commands for imported workspaces
						if (result.imported.length > 0) {
							this.refreshWorkspaceCommands();
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
				report += `- **Manual sort order:** ${this.settings.manualSortOrder}\n`;
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

		// Send note to another workspace (without switching)
		this.addCommand({
			id: 'send-note-to-workspace',
			name: 'Send current note to another workspace',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file');
					return;
				}

				new WorkspacePickerModal(
					this.app,
					this,
					activeFile.path,
					false,  // don't follow
					async (targetWorkspace) => {
						const success = this.workspaceManager.addFileToWorkspace(targetWorkspace, activeFile.path);
						if (success) {
							await this.saveSettings();
							new Notice(`Sent "${activeFile.basename}" to workspace "${targetWorkspace}"`);
						} else {
							new Notice(`Failed to add file to workspace "${targetWorkspace}"`);
						}
					}
				).open();
			}
		});

		// Send note to another workspace and switch to it
		this.addCommand({
			id: 'send-note-to-workspace-and-switch',
			name: 'Send current note to another workspace and switch',
			callback: () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file');
					return;
				}

				new WorkspacePickerModal(
					this.app,
					this,
					activeFile.path,
					true,  // follow
					async (targetWorkspace) => {
						const success = this.workspaceManager.addFileToWorkspace(targetWorkspace, activeFile.path);
						if (success) {
							await this.saveSettings();
							new Notice(`Sent "${activeFile.basename}" to workspace "${targetWorkspace}"`);
							// Switch to the target workspace
							await this.loadWorkspace(targetWorkspace);
							new Notice(`Switched to workspace: ${targetWorkspace}`);
						} else {
							new Notice(`Failed to add file to workspace "${targetWorkspace}"`);
						}
					}
				).open();
			}
		});

		// Register workspace-specific switch commands
		this.registerWorkspaceCommands();
	}

	// ─────────────────────────────────────────────────────────────────
	// File Context Menu (Right-click on tab)
	// ─────────────────────────────────────────────────────────────────

	registerFileMenu() {
		// Add "Send to workspace" submenu to file tab context menu
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file, source, leaf) => {
				// Only show if we have other workspaces to send to
				const activeWorkspace = this.workspaceManager.getActiveWorkspace();
				const otherWorkspaces = this.workspaceManager.getWorkspaceNames()
					.filter(name => name !== activeWorkspace);

				if (otherWorkspaces.length === 0) return;

				menu.addSeparator();

				// Add submenu for "Send to workspace" (move - closes tab here)
				menu.addItem((item) => {
					item.setTitle('Send to workspace')
						.setIcon('send')
						.onClick(() => {
							new WorkspacePickerModal(
								this.app,
								this,
								file.path,
								false,
								async (targetWorkspace) => {
									const success = this.workspaceManager.addFileToWorkspace(targetWorkspace, file.path);
									if (success) {
										// Close the tab in current workspace
										if (leaf) {
											leaf.detach();
										}
										await this.saveSettings();
										new Notice(`Moved "${file.name}" to workspace "${targetWorkspace}"`);
									} else {
										new Notice(`Failed to add file to workspace "${targetWorkspace}"`);
									}
								}
							).open();
						});
				});

				// Add submenu for "Send to workspace and switch"
				menu.addItem((item) => {
					item.setTitle('Send to workspace and switch')
						.setIcon('arrow-right-to-line')
						.onClick(() => {
							new WorkspacePickerModal(
								this.app,
								this,
								file.path,
								true,
								async (targetWorkspace) => {
									const success = this.workspaceManager.addFileToWorkspace(targetWorkspace, file.path);
									if (success) {
										// Close the tab in current workspace
										if (leaf) {
											leaf.detach();
										}
										await this.saveSettings();
										new Notice(`Moved "${file.name}" to workspace "${targetWorkspace}"`);
										// Switch to workspace
										await this.loadWorkspace(targetWorkspace);
									} else {
										new Notice(`Failed to add file to workspace "${targetWorkspace}"`);
									}
								}
							).open();
						});
				});

				// Check if file is open in other workspaces (stored layouts)
				// Also consider current workspace if the file is currently open (live state)
				let workspacesWithFile = this.workspaceManager.getWorkspacesWithFile(file.path);

				// If current workspace isn't in the list but we're looking at a tab with this file,
				// add current workspace to the count (live state not yet saved)
				if (activeWorkspace && !workspacesWithFile.includes(activeWorkspace)) {
					workspacesWithFile = [activeWorkspace, ...workspacesWithFile];
				}

				const otherWorkspacesWithFile = workspacesWithFile.filter(w => w !== activeWorkspace);

				if (otherWorkspacesWithFile.length > 0) {
					// Add "Close in other workspaces" option (keeps current tab open)
					menu.addItem((item) => {
						item.setTitle(`Close in other workspaces (${otherWorkspacesWithFile.length})`)
							.setIcon('x')
							.onClick(async () => {
								let removedCount = 0;
								for (const ws of otherWorkspacesWithFile) {
									if (this.workspaceManager.removeFileFromWorkspace(ws, file.path)) {
										removedCount++;
									}
								}

								await this.saveSettings();
								this.updateTabIndicators();

								new Notice(`Closed "${file.name}" in ${removedCount} other workspace(s)`);
							});
					});
				}

				if (workspacesWithFile.length > 1) {
					// Add "Close in all workspaces" option (including current)
					menu.addItem((item) => {
						item.setTitle(`Close in all workspaces (${workspacesWithFile.length})`)
							.setIcon('x-circle')
							.onClick(async () => {
								const removedFrom = this.workspaceManager.removeFileFromAllWorkspaces(file.path);

								// Also close the current tab
								if (leaf) {
									leaf.detach();
								}

								await this.saveSettings();
								this.updateTabIndicators();

								new Notice(`Closed "${file.name}" in ${removedFrom.length} workspace(s)`);
							});
					});
				}
			})
		);
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace-Specific Commands
	// ─────────────────────────────────────────────────────────────────

	/**
	 * Register commands to switch to specific workspaces
	 * These are updated whenever workspaces change
	 */
	registerWorkspaceCommands() {
		const workspaces = this.workspaceManager.getWorkspaceNames();

		for (const name of workspaces) {
			const commandId = `switch-to-workspace-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

			// Skip if already registered
			if (this.workspaceCommandIds.has(commandId)) {
				continue;
			}

			this.addCommand({
				id:   commandId,
				name: `Switch to workspace: ${name}`,
				callback: async () => {
					await this.loadWorkspace(name);
					new Notice(`Switched to workspace: ${name}`);
				}
			});

			this.workspaceCommandIds.add(commandId);
		}
	}

	/**
	 * Refresh workspace commands (call when workspaces are added/renamed/deleted)
	 */
	refreshWorkspaceCommands() {
		// Note: Obsidian doesn't provide a way to remove commands at runtime
		// New workspaces will get commands added, but removed/renamed ones
		// will have orphaned commands until plugin reload
		this.registerWorkspaceCommands();
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Event Handling
	// ─────────────────────────────────────────────────────────────────

	registerWorkspaceEvents() {
		// Listen for workspace changes
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.updateStatusBar();
				this.updateTabIndicators();

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
			setIcon(icon, 'layout-template');

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

		// Update text (icons only shown in modal, not status bar)
		const textEl = this.statusBarItem.querySelector('.workspace-navigator-text') as HTMLElement;
		if (textEl) {
			const workspaceName = this.workspaceManager.getActiveWorkspace();
			const displayName   = workspaceName || 'No workspace';
			textEl.setText(displayName);
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Tab Indicators (show when file is open in other workspaces)
	// ─────────────────────────────────────────────────────────────────

	updateTabIndicators() {
		const activeWorkspace = this.workspaceManager.getActiveWorkspace();
		if (!activeWorkspace) return;

		// Iterate through all leaves
		this.app.workspace.iterateAllLeaves((leaf: any) => {
			// Only process markdown leaves with a file
			const file = leaf.view?.file;
			if (!file) return;

			const tabHeader = leaf.tabHeaderEl;
			if (!tabHeader) return;

			// Check if this file is open in other workspaces
			const otherWorkspaces = this.workspaceManager.getWorkspacesWithFile(
				file.path,
				activeWorkspace
			);

			// Remove existing indicator
			const existingIndicator = tabHeader.querySelector('.workspace-tab-indicator');
			if (existingIndicator) {
				existingIndicator.remove();
			}

			// Add indicator if file is in other workspaces
			if (otherWorkspaces.length > 0) {
				const indicator = document.createElement('div');
				indicator.addClass('workspace-tab-indicator');

				// Show count if more than one
				if (otherWorkspaces.length > 1) {
					indicator.textContent = otherWorkspaces.length.toString();
				} else {
					setIcon(indicator, 'layers');
				}

				// Set tooltip (aria-label only, remove any title from setIcon)
				indicator.removeAttribute('title');
				indicator.setAttribute('aria-label', `Also open in: ${otherWorkspaces.join(', ')}`);

				// Insert after the icon, before the title
				const tabHeaderInner = tabHeader.querySelector('.workspace-tab-header-inner');
				if (tabHeaderInner) {
					tabHeaderInner.insertBefore(indicator, tabHeaderInner.firstChild);
				} else {
					tabHeader.appendChild(indicator);
				}
			}
		});
	}
}
