import { App, Notice } from 'obsidian';

// ═══════════════════════════════════════════════════════════════════════════
// WORKSPACE MANAGER - Standalone Implementation
// ═══════════════════════════════════════════════════════════════════════════

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

	constructor(app: App, initialStorage?: WorkspacesStorage) {
		this.app = app;
		this.storage = initialStorage || {
			workspaces: {},
			activeWorkspace: null,
			version: '2.0.0'
		};
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
		if (!name || name.trim() === '') {
			new Notice('Workspace name cannot be empty');
			return;
		}

		try {
			// Get current layout from Obsidian
			const layout = this.app.workspace.getLayout();

			// Optionally get folder expansion state
			let folderExpandState = undefined;
			if (saveFolderState) {
				folderExpandState = await this.app.loadLocalStorage('file-explorer-unfold');
			}

			// Store workspace data
			this.storage.workspaces[name] = {
				layout: layout,
				lastSaved: Date.now(),
				folderExpandState: folderExpandState
			};

			// Set as active workspace
			this.storage.activeWorkspace = name;

		} catch (error) {
			console.error('Failed to save workspace:', error);
			new Notice(`Failed to save workspace: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Load a workspace layout
	 */
	async loadWorkspace(name: string, restoreFolderState: boolean = false): Promise<void> {
		const workspace = this.getWorkspace(name);
		if (!workspace) {
			new Notice(`Workspace "${name}" not found`);
			return;
		}

		try {
			// Restore folder expansion state BEFORE changing layout
			// (changeLayout will rebuild file explorer and read from localStorage)
			if (restoreFolderState && workspace.folderExpandState) {
				await this.app.saveLocalStorage('file-explorer-unfold', workspace.folderExpandState);
			}

			// Apply the layout to Obsidian
			await this.app.workspace.changeLayout(workspace.layout);

			// Set as active workspace
			this.storage.activeWorkspace = name;

			// Trigger workspace change event
			this.app.workspace.trigger('workspace-open', name);

		} catch (error) {
			console.error('Failed to load workspace:', error);
			new Notice(`Failed to load workspace: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Delete a workspace
	 */
	deleteWorkspace(name: string): void {
		if (!this.hasWorkspace(name)) {
			new Notice(`Workspace "${name}" not found`);
			return;
		}

		delete this.storage.workspaces[name];

		// If this was the active workspace, clear it
		if (this.storage.activeWorkspace === name) {
			this.storage.activeWorkspace = null;
		}

		// Trigger workspace delete event
		this.app.workspace.trigger('workspace-delete', name);
	}

	/**
	 * Rename a workspace
	 */
	renameWorkspace(oldName: string, newName: string): void {
		if (!this.hasWorkspace(oldName)) {
			new Notice(`Workspace "${oldName}" not found`);
			return;
		}

		if (this.hasWorkspace(newName)) {
			new Notice(`Workspace "${newName}" already exists`);
			return;
		}

		if (!newName || newName.trim() === '') {
			new Notice('Workspace name cannot be empty');
			return;
		}

		// Copy workspace data to new name
		this.storage.workspaces[newName] = this.storage.workspaces[oldName];
		delete this.storage.workspaces[oldName];

		// Update active workspace if it was renamed
		if (this.storage.activeWorkspace === oldName) {
			this.storage.activeWorkspace = newName;
		}

		// Trigger workspace rename event
		this.app.workspace.trigger('workspace-rename', newName, oldName);
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
