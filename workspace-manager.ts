import { App, Notice } from 'obsidian';

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE MANAGER - Standalone Implementation
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// Development Logging
// ───────────────────────────────────────────────────────────────────────────

class WorkspaceLogger {
	private app: App;
	private logs: string[] = [];
	private sessionStart: string;
	private logFileName: string;
	private logFile: any = null;

	constructor(app: App) {
		this.app = app;
		this.sessionStart = new Date().toISOString();

		// Create unique filename for this session
		const timestamp = this.sessionStart.replace(/[:.]/g, '-').slice(0, -5);
		this.logFileName = `workspace-dev-log-${timestamp}.md`;

		this.log('# Workspace Navigator Development Log');
		this.log(`**Session Started:** ${new Date().toLocaleString()}\n`);
	}

	log(message: string) {
		const timestamp = new Date().toISOString();
		const entry = `[${timestamp}] ${message}`;
		this.logs.push(entry);
		console.log(`[WorkspaceManager] ${message}`);
	}

	logOperation(operation: string, details: any) {
		this.log(`\n## ${operation}`);
		this.log(`\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``);
	}

	async save() {
		if (this.logs.length === 0) return;

		try {
			const content = this.logs.join('\n');

			// Try to get existing file
			this.logFile = this.app.vault.getAbstractFileByPath(this.logFileName);

			if (this.logFile) {
				// Update existing file
				await this.app.vault.modify(this.logFile, content);
			} else {
				// Create new file
				this.logFile = await this.app.vault.create(this.logFileName, content);
			}
		} catch (err) {
			console.error('[WorkspaceLogger] Failed to save log:', err);
		}
	}
}

let globalLogger: WorkspaceLogger | null = null;

/**
 * Interface for a saved workspace
 */
export interface WorkspaceData {
	/** The workspace layout (panes, tabs, etc.) */
	layout: any;
	/** Timestamp when workspace was last saved */
	lastSaved: number;
	/** Folder expansion state from file explorer */
	folderExpandState?: any;
	/** Optional metadata */
	metadata?: {
		description?: string;
		tags?: string[];
	};
}

/**
 * Storage structure for all workspaces
 */
export interface WorkspacesStorage {
	/** Map of workspace name to workspace data */
	workspaces: Record<string, WorkspaceData>;
	/** Currently active workspace name */
	activeWorkspace: string | null;
	/** Plugin version for migration purposes */
	version: string;
}

/**
 * Standalone workspace manager - no dependency on core Workspaces plugin
 */
export class WorkspaceManager {
	app: App;
	storage: WorkspacesStorage;
	logger: WorkspaceLogger;

	constructor(app: App, initialStorage?: WorkspacesStorage) {
		this.app = app;
		this.storage = initialStorage || {
			workspaces: {},
			activeWorkspace: null,
			version: '2.0.0'
		};

		// Initialize logger
		if (!globalLogger) {
			globalLogger = new WorkspaceLogger(app);
		}
		this.logger = globalLogger;

		this.logger.log(`WorkspaceManager initialized with ${Object.keys(this.storage.workspaces).length} workspaces`);
	}

	async saveLog() {
		await this.logger.save();
	}

	// ───────────────────────────────────────────────────────────────────
	// Workspace CRUD Operations
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Get list of all workspace names
	 */
	getWorkspaceNames(): string[] {
		return Object.keys(this.storage.workspaces).sort((a, b) => {
			// Natural sort for workspace names
			return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
		});
	}

	/**
	 * Check if a workspace exists
	 */
	hasWorkspace(name: string): boolean {
		return name in this.storage.workspaces;
	}

	/**
	 * Get workspace data
	 */
	getWorkspace(name: string): WorkspaceData | null {
		return this.storage.workspaces[name] || null;
	}

	/**
	 * Save current workspace layout
	 */
	async saveWorkspace(name: string, saveFolderState: boolean = false): Promise<void> {
		this.logger.log(`\n### SAVE WORKSPACE: "${name}"`);
		this.logger.log(`- Save folder state: ${saveFolderState}`);

		if (!name || name.trim() === '') {
			this.logger.log('❌ ERROR: Workspace name cannot be empty');
			new Notice('Workspace name cannot be empty');
			return;
		}

		try {
			// Get current layout from Obsidian
			const layout = this.app.workspace.getLayout();
			this.logger.log(`- Layout captured (${JSON.stringify(layout).length} bytes)`);

			// Optionally get folder expansion state
			let folderExpandState = undefined;
			if (saveFolderState) {
				// Try to get folder state from localStorage
				folderExpandState = await this.app.loadLocalStorage('file-explorer-unfold');

				// If null, check if file explorer plugin is loaded
				if (folderExpandState === null) {
					const fileExplorer = (this.app as any).internalPlugins?.plugins?.['file-explorer'];
					this.logger.log(`⚠️ WARNING: Folder state is null from localStorage`);
					this.logger.log(`- File Explorer plugin enabled: ${!!fileExplorer}`);
					this.logger.log(`- File Explorer plugin loaded: ${fileExplorer?.enabled}`);

					// Try to get it directly from file explorer if available
					if (fileExplorer?.enabled) {
						const fileExplorerView = fileExplorer.instance;
						if (fileExplorerView?.tree) {
							// Get expanded folders from the tree
							const expanded: string[] = [];
							const checkNode = (node: any) => {
								if (node.collapsed === false && node.file?.path) {
									expanded.push(node.file.path);
								}
								if (node.children) {
									for (const child of node.children) {
										checkNode(child);
									}
								}
							};
							if (fileExplorerView.tree.root) {
								checkNode(fileExplorerView.tree.root);
							}
							if (expanded.length > 0) {
								folderExpandState = expanded;
								this.logger.log(`- Extracted folder state from file explorer tree: ${expanded.length} folders`);
							}
						}
					}
				}

				this.logger.log(`- Folder state captured:`);
				this.logger.log(`\`\`\`json\n${JSON.stringify(folderExpandState, null, 2)}\n\`\`\``);
			} else {
				this.logger.log(`- Folder state NOT saved (saveFolderState=false)`);
			}

			// Store workspace data
			this.storage.workspaces[name] = {
				layout: layout,
				lastSaved: Date.now(),
				folderExpandState: folderExpandState
			};

			// Set as active workspace
			this.storage.activeWorkspace = name;

			this.logger.log(`✅ Successfully saved workspace "${name}"`);
			await this.logger.save();

		} catch (error) {
			this.logger.log(`❌ ERROR saving workspace: ${error.message}`);
			this.logger.log(`\`\`\`\n${error.stack}\n\`\`\``);
			await this.logger.save();
			console.error('Failed to save workspace:', error);
			new Notice(`Failed to save workspace: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Load a workspace layout
	 */
	async loadWorkspace(name: string, restoreFolderState: boolean = false): Promise<void> {
		this.logger.log(`\n### LOAD WORKSPACE: "${name}"`);
		this.logger.log(`- Restore folder state: ${restoreFolderState}`);

		const workspace = this.getWorkspace(name);
		if (!workspace) {
			this.logger.log(`❌ ERROR: Workspace "${name}" not found`);
			await this.logger.save();
			new Notice(`Workspace "${name}" not found`);
			return;
		}

		try {
			this.logger.log(`- Workspace last saved: ${new Date(workspace.lastSaved).toLocaleString()}`);
			this.logger.log(`- Has folder state: ${!!workspace.folderExpandState}`);

			// Restore folder expansion state BEFORE changing layout
			// (changeLayout will rebuild file explorer and read from localStorage)
			if (restoreFolderState) {
				if (workspace.folderExpandState) {
					this.logger.log(`- Restoring folder state to localStorage:`);
					this.logger.log(`\`\`\`json\n${JSON.stringify(workspace.folderExpandState, null, 2)}\n\`\`\``);
					await this.app.saveLocalStorage('file-explorer-unfold', workspace.folderExpandState);
				} else {
					// Clear folder state if workspace has none saved
					this.logger.log(`- Clearing folder state (workspace has no saved state)`);
					await this.app.saveLocalStorage('file-explorer-unfold', null);
				}
			} else {
				this.logger.log(`- Folder state NOT restored (restoreFolderState=false)`);
			}

			// Apply the layout to Obsidian
			this.logger.log(`- Applying layout to Obsidian...`);

			// Wrap changeLayout in try-catch to handle plugin errors gracefully
			try {
				await this.app.workspace.changeLayout(workspace.layout);
			} catch (layoutError) {
				// Log the error but don't fail the whole operation
				// Some plugins (like Templater) may throw errors during layout change
				this.logger.log(`⚠️ WARNING: Error during layout change (continuing anyway):`);
				this.logger.log(`\`\`\`\n${layoutError.message}\n${layoutError.stack}\n\`\`\``);
				console.warn('[WorkspaceManager] Error during layout change:', layoutError);
			}

			// After layout change, force file explorer to refresh from localStorage
			const fileExplorer = (this.app as any).internalPlugins?.plugins?.['file-explorer'];
			if (fileExplorer?.enabled && restoreFolderState) {
				this.logger.log(`- Forcing file explorer refresh...`);
				const fileExplorerView = fileExplorer.instance;
				if (fileExplorerView?.tree) {
					// Collapse all folders first
					const collapseAll = (node: any) => {
						if (node.file?.path && node.setCollapsed) {
							node.setCollapsed(true);
						}
						if (node.children) {
							for (const child of node.children) {
								collapseAll(child);
							}
						}
					};

					// Then expand only the saved ones
					const expandSaved = (node: any) => {
						if (node.file?.path && workspace.folderExpandState?.includes(node.file.path)) {
							node.setCollapsed(false);
							this.logger.log(`  - Expanded: ${node.file.path}`);
						}
						if (node.children) {
							for (const child of node.children) {
								expandSaved(child);
							}
						}
					};

					if (fileExplorerView.tree.root) {
						collapseAll(fileExplorerView.tree.root);
						if (workspace.folderExpandState) {
							expandSaved(fileExplorerView.tree.root);
						}
					}
				}
			}

			// Set as active workspace
			this.storage.activeWorkspace = name;

			// Trigger workspace change event
			this.app.workspace.trigger('workspace-open', name);

			this.logger.log(`✅ Successfully loaded workspace "${name}"`);
			await this.logger.save();

		} catch (error) {
			this.logger.log(`❌ ERROR loading workspace: ${error.message}`);
			this.logger.log(`\`\`\`\n${error.stack}\n\`\`\``);
			await this.logger.save();
			console.error('Failed to load workspace:', error);
			new Notice(`Failed to load workspace: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Delete a workspace
	 */
	deleteWorkspace(name: string): void {
		this.logger.log(`\n### DELETE WORKSPACE: "${name}"`);

		if (!this.hasWorkspace(name)) {
			this.logger.log(`❌ ERROR: Workspace "${name}" not found`);
			new Notice(`Workspace "${name}" not found`);
			return;
		}

		delete this.storage.workspaces[name];

		// If this was the active workspace, clear it
		if (this.storage.activeWorkspace === name) {
			this.storage.activeWorkspace = null;
			this.logger.log(`- Cleared active workspace`);
		}

		// Trigger workspace delete event
		this.app.workspace.trigger('workspace-delete', name);

		this.logger.log(`✅ Successfully deleted workspace "${name}"`);
		this.logger.save();
	}

	/**
	 * Rename a workspace
	 */
	renameWorkspace(oldName: string, newName: string): void {
		this.logger.log(`\n### RENAME WORKSPACE: "${oldName}" → "${newName}"`);

		if (!this.hasWorkspace(oldName)) {
			this.logger.log(`❌ ERROR: Workspace "${oldName}" not found`);
			new Notice(`Workspace "${oldName}" not found`);
			return;
		}

		if (this.hasWorkspace(newName)) {
			this.logger.log(`❌ ERROR: Workspace "${newName}" already exists`);
			new Notice(`Workspace "${newName}" already exists`);
			return;
		}

		if (!newName || newName.trim() === '') {
			this.logger.log(`❌ ERROR: New workspace name cannot be empty`);
			new Notice('Workspace name cannot be empty');
			return;
		}

		// Copy workspace data to new name
		this.storage.workspaces[newName] = this.storage.workspaces[oldName];
		delete this.storage.workspaces[oldName];

		// Update active workspace if it was renamed
		if (this.storage.activeWorkspace === oldName) {
			this.storage.activeWorkspace = newName;
			this.logger.log(`- Updated active workspace to "${newName}"`);
		}

		// Trigger workspace rename event
		this.app.workspace.trigger('workspace-rename', newName, oldName);

		this.logger.log(`✅ Successfully renamed workspace`);
		this.logger.save();
	}

	// ───────────────────────────────────────────────────────────────────
	// Active Workspace Management
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Get the currently active workspace name
	 */
	getActiveWorkspace(): string | null {
		return this.storage.activeWorkspace;
	}

	/**
	 * Set the active workspace (without loading it)
	 */
	setActiveWorkspace(name: string): void {
		if (this.hasWorkspace(name)) {
			this.storage.activeWorkspace = name;
		}
	}

	// ───────────────────────────────────────────────────────────────────
	// Storage Management
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Get the entire storage object for serialization
	 */
	getStorage(): WorkspacesStorage {
		return this.storage;
	}

	/**
	 * Load storage from saved data
	 */
	loadStorage(storage: WorkspacesStorage): void {
		this.storage = storage;
	}
}
