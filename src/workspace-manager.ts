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
	private logFilePath: string;
	private debugEnabled: () => boolean;

	constructor(app: App, debugEnabled: () => boolean) {
		this.app = app;
		this.debugEnabled = debugEnabled;
		this.sessionStart = new Date().toISOString();

		// Create unique filename in plugin data directory (not vault root)
		const timestamp = this.sessionStart.replace(/[:.]/g, '-').slice(0, -5);
		const configDir = this.app.vault.configDir;
		this.logFilePath = `${configDir}/plugins/workspace-navigator/logs/dev-log-${timestamp}.md`;

		this.log('# Workspace Navigator Development Log');
		this.log(`**Session Started:** ${new Date().toLocaleString()}\n`);
	}

	log(message: string) {
		// Only log if debug mode is enabled
		if (!this.debugEnabled()) return;

		const timestamp = new Date().toISOString();
		const entry = `[${timestamp}] ${message}`;
		this.logs.push(entry);
		console.log(`[WorkspaceManager] ${message}`);
	}

	async save() {
		if (this.logs.length === 0) return;

		try {
			const content = this.logs.join('\n');
			const adapter = this.app.vault.adapter;

			// Ensure logs directory exists
			const logsDir = this.logFilePath.substring(0, this.logFilePath.lastIndexOf('/'));
			if (!(await adapter.exists(logsDir))) {
				await adapter.mkdir(logsDir);
			}

			// Write log file using adapter (for config directory access)
			await adapter.write(this.logFilePath, content);
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
		group?: string;       // Group name for categorization
		icon?: string;        // Lucide icon name (e.g., 'folder', 'star')
		iconColor?: string;   // CSS color for the icon
		nameColor?: string;   // CSS color for the name
		nameBold?: boolean;   // Bold name
		nameItalic?: boolean; // Italic name
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
	/** Group icons (group name -> Lucide icon name) */
	groupIcons?: Record<string, string>;
	/** Group icon colors (group name -> CSS color) */
	groupIconColors?: Record<string, string>;
	/** Group text colors (group name -> CSS color) */
	groupColors?: Record<string, string>;
	/** Group text bold (group name -> true if bold) */
	groupBold?: Record<string, boolean>;
	/** Group text italic (group name -> true if italic) */
	groupItalic?: Record<string, boolean>;
	/** Collapsed groups (group name -> true if collapsed) */
	collapsedGroups?: Record<string, boolean>;
	/** Manual workspace order per group (group name -> ordered workspace names) */
	workspaceOrder?: Record<string, string[]>;
	/** Manual group order (ordered group names) */
	groupOrder?: string[];
}

/**
 * Standalone workspace manager - no dependency on core Workspaces plugin
 */
export class WorkspaceManager {
	app: App;
	storage: WorkspacesStorage;
	logger: WorkspaceLogger;
	private debugEnabled: () => boolean;

	constructor(app: App, initialStorage?: WorkspacesStorage, debugEnabled?: () => boolean) {
		this.app = app;
		this.storage = initialStorage || {
			workspaces: {},
			activeWorkspace: null,
			version: '2.0.0'
		};

		// Default to false if no callback provided
		this.debugEnabled = debugEnabled || (() => false);

		// Initialize logger with debug callback
		if (!globalLogger) {
			globalLogger = new WorkspaceLogger(app, this.debugEnabled);
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
	 * Get workspace group
	 */
	getWorkspaceGroup(name: string): string | null {
		const workspace = this.getWorkspace(name);
		return workspace?.metadata?.group || null;
	}

	/**
	 * Set workspace group
	 */
	setWorkspaceGroup(name: string, group: string | null): void {
		const workspace = this.getWorkspace(name);
		if (!workspace) return;

		if (!workspace.metadata) {
			workspace.metadata = {};
		}

		if (group) {
			workspace.metadata.group = group;
		} else {
			delete workspace.metadata.group;
		}
	}

	/**
	 * Get all unique group names (alphabetically sorted)
	 * Includes groups from groupOrder that may be empty (no workspaces assigned)
	 */
	getGroups(): string[] {
		const groups = new Set<string>();

		// Add groups that have workspaces assigned
		for (const name of this.getWorkspaceNames()) {
			const group = this.getWorkspaceGroup(name);
			if (group) {
				groups.add(group);
			}
		}

		// Also add groups from groupOrder (these may be empty but explicitly created)
		if (this.storage.groupOrder) {
			for (const groupName of this.storage.groupOrder) {
				// Skip the special "No Group" pseudo-group
				if (groupName !== '\x00nogroup') {
					groups.add(groupName);
				}
			}
		}

		return Array.from(groups).sort((a, b) =>
			a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
		);
	}

	/**
	 * Get all unique group names with manual order applied
	 */
	getGroupsOrdered(useManualOrder: boolean): string[] {
		const groups = this.getGroups(); // Get alphabetically sorted groups

		if (!useManualOrder) {
			return groups;
		}

		const savedOrder = this.storage.groupOrder || [];
		if (savedOrder.length === 0) {
			return groups;
		}

		// Sort by saved order, putting unknown groups at the end
		const orderMap = new Map(savedOrder.map((name, idx) => [name, idx]));
		return groups.sort((a, b) => {
			const orderA = orderMap.has(a) ? orderMap.get(a)! : Infinity;
			const orderB = orderMap.has(b) ? orderMap.get(b)! : Infinity;
			if (orderA === orderB) {
				// Both unknown, sort alphabetically
				return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
			}
			return orderA - orderB;
		});
	}

	/**
	 * Get all groups including "No Group" pseudo-group, with manual order applied
	 * Returns '\x00nogroup' for ungrouped workspaces if any exist
	 */
	getAllGroupsOrdered(useManualOrder: boolean): string[] {
		const namedGroups = this.getGroupsOrdered(useManualOrder);
		const hasUngrouped = this.getWorkspacesByGroup(null).length > 0;

		if (!hasUngrouped) {
			return namedGroups;
		}

		// Include '\x00nogroup' in the ordering
		const allGroups = [...namedGroups];

		if (!useManualOrder) {
			// Default: "No Group" at the end
			allGroups.push('\x00nogroup');
			return allGroups;
		}

		const savedOrder = this.storage.groupOrder || [];
		const noGroupIndex = savedOrder.indexOf('\x00nogroup');

		if (noGroupIndex === -1) {
			// Not in saved order yet, put at end
			allGroups.push('\x00nogroup');
		} else {
			// Insert at saved position
			const orderMap = new Map(savedOrder.map((name, idx) => [name, idx]));

			// Find where to insert '\x00nogroup' based on its order position
			let insertIndex = allGroups.length;
			for (let i = 0; i < allGroups.length; i++) {
				const groupOrder = orderMap.get(allGroups[i]);
				if (groupOrder !== undefined && groupOrder > noGroupIndex) {
					insertIndex = i;
					break;
				}
			}
			allGroups.splice(insertIndex, 0, '\x00nogroup');
		}

		return allGroups;
	}

	/**
	 * Get workspaces by group (null for ungrouped)
	 */
	getWorkspacesByGroup(group: string | null): string[] {
		return this.getWorkspaceNames().filter(name => {
			const workspaceGroup = this.getWorkspaceGroup(name);
			return group === null ? !workspaceGroup : workspaceGroup === group;
		});
	}

	/**
	 * Get group icon
	 */
	getGroupIcon(group: string): string | null {
		return this.storage.groupIcons?.[group] || null;
	}

	/**
	 * Set group icon
	 */
	setGroupIcon(group: string, icon: string | null): void {
		if (!this.storage.groupIcons) {
			this.storage.groupIcons = {};
		}

		if (icon) {
			this.storage.groupIcons[group] = icon;
		} else {
			delete this.storage.groupIcons[group];
		}
	}

	/**
	 * Get group icon color
	 */
	getGroupIconColor(group: string): string | null {
		return this.storage.groupIconColors?.[group] || null;
	}

	/**
	 * Set group icon color
	 */
	setGroupIconColor(group: string, color: string | null): void {
		if (!this.storage.groupIconColors) {
			this.storage.groupIconColors = {};
		}

		if (color) {
			this.storage.groupIconColors[group] = color;
		} else {
			delete this.storage.groupIconColors[group];
		}
	}

	// Single source of truth for the per-group style maps. Driving the bulk
	// rename/delete/prune operations off this table means a new style facet only
	// needs to be added in one place, and none can be forgotten (the historical
	// source of style/order drift bugs).
	private static readonly GROUP_STYLE_MAP_KEYS = [
		'groupIcons', 'groupIconColors', 'groupColors',
		'groupBold', 'groupItalic', 'collapsedGroups',
	] as const;

	/** The live per-group style map objects that currently exist on storage. */
	private groupStyleMaps(): Array<Record<string, unknown>> {
		const out: Array<Record<string, unknown>> = [];
		for (const key of WorkspaceManager.GROUP_STYLE_MAP_KEYS) {
			const map = this.storage[key] as Record<string, unknown> | undefined;
			if (map) out.push(map);
		}
		return out;
	}

	/**
	 * Rename a group (updates all workspaces and transfers style data)
	 */
	renameGroup(oldName: string, newName: string): void {
		if (!oldName || !newName || oldName === newName) return;

		// Update all workspaces in this group
		for (const workspaceName of this.getWorkspacesByGroup(oldName)) {
			this.setWorkspaceGroup(workspaceName, newName);
		}

		// Update manual order: replace oldName with newName in place so the
		// group keeps its position (and no ghost of oldName lingers in the order).
		if (this.storage.groupOrder) {
			const idx = this.storage.groupOrder.indexOf(oldName);
			if (idx !== -1) {
				if (this.storage.groupOrder.includes(newName)) {
					// Target name already in the order — just drop the old entry
					this.storage.groupOrder.splice(idx, 1);
				} else {
					this.storage.groupOrder[idx] = newName;
				}
			}
		}

		// Migrate the manual workspace ordering, which is keyed by group name
		// (getOrderKey returns the group name for a named group). Without this,
		// the renamed group's manual workspace order is silently lost and the
		// old key lingers as an orphan.
		if (this.storage.workspaceOrder && this.storage.workspaceOrder[oldName] !== undefined) {
			this.storage.workspaceOrder[newName] = this.storage.workspaceOrder[oldName];
			delete this.storage.workspaceOrder[oldName];
		}

		// Transfer every style facet (icon, icon color, text color, bold, italic,
		// collapsed) to the new name. Driven by the style-map table so no facet
		// can be missed. Values are only present when "set" (setters delete on
		// null/false), so a plain move is equivalent to the old per-facet logic.
		for (const map of this.groupStyleMaps()) {
			if (map[oldName] !== undefined) {
				map[newName] = map[oldName];
				delete map[oldName];
			}
		}
	}

	/**
	 * Delete a group entirely. Single source of truth for group deletion so
	 * every UI path (sidebar, switcher modal) behaves identically: ungroup the
	 * workspaces, remove the group from the manual order, and clear ALL of its
	 * styling. Previously each view did a partial subset of this, which left
	 * the group lingering in groupOrder (and thus reappearing) or leaked
	 * orphaned style data.
	 */
	deleteGroup(groupName: string): void {
		if (!groupName || groupName === '\x00nogroup') return;

		// Move every workspace in this group back to ungrouped
		for (const workspaceName of this.getWorkspacesByGroup(groupName)) {
			this.setWorkspaceGroup(workspaceName, null);
		}

		// Remove from the manual order
		if (this.storage.groupOrder) {
			this.storage.groupOrder = this.storage.groupOrder.filter(g => g !== groupName);
		}

		// Drop the group's manual workspace ordering (its workspaces are now
		// ungrouped); otherwise the entry orphans and a future same-named group
		// would inherit a stale order.
		if (this.storage.workspaceOrder) {
			delete this.storage.workspaceOrder[groupName];
		}

		// Clear every style facet (table-driven)
		for (const map of this.groupStyleMaps()) {
			delete map[groupName];
		}
	}

	/**
	 * Remove leftover group styling/order data for groups that no longer exist
	 * (no workspaces assigned AND not in the manual order). This cleans up
	 * vaults corrupted by older delete/rename bugs that left ghosts behind.
	 * Note: legitimately-empty groups (present in groupOrder) are preserved —
	 * only truly dead residue is removed. Returns the count of entries removed.
	 */
	pruneOrphanedGroupData(): number {
		const valid = new Set(this.getGroups());
		let removed = 0;

		for (const map of this.groupStyleMaps()) {
			for (const key of Object.keys(map)) {
				if (key === '\x00nogroup') continue;
				if (!valid.has(key)) {
					delete map[key];
					removed++;
				}
			}
		}

		// Dedupe the manual order (drop repeated entries); keep the '\x00nogroup'
		// positional marker and any valid group (including empty ones).
		if (this.storage.groupOrder) {
			const seen = new Set<string>();
			const cleaned = this.storage.groupOrder.filter(g => {
				if (seen.has(g)) return false;
				seen.add(g);
				return true;
			});
			removed += this.storage.groupOrder.length - cleaned.length;
			this.storage.groupOrder = cleaned;
		}

		return removed;
	}

	/**
	 * Get group color
	 */
	getGroupColor(group: string): string | null {
		return this.storage.groupColors?.[group] || null;
	}

	/**
	 * Set group color
	 */
	setGroupColor(group: string, color: string | null): void {
		if (!this.storage.groupColors) {
			this.storage.groupColors = {};
		}

		if (color) {
			this.storage.groupColors[group] = color;
		} else {
			delete this.storage.groupColors[group];
		}
	}

	/**
	 * Get group bold
	 */
	getGroupBold(group: string): boolean {
		return this.storage.groupBold?.[group] || false;
	}

	/**
	 * Set group bold
	 */
	setGroupBold(group: string, bold: boolean): void {
		if (!this.storage.groupBold) {
			this.storage.groupBold = {};
		}

		if (bold) {
			this.storage.groupBold[group] = true;
		} else {
			delete this.storage.groupBold[group];
		}
	}

	/**
	 * Get group italic
	 */
	getGroupItalic(group: string): boolean {
		return this.storage.groupItalic?.[group] || false;
	}

	/**
	 * Set group italic
	 */
	setGroupItalic(group: string, italic: boolean): void {
		if (!this.storage.groupItalic) {
			this.storage.groupItalic = {};
		}

		if (italic) {
			this.storage.groupItalic[group] = true;
		} else {
			delete this.storage.groupItalic[group];
		}
	}

	/**
	 * Check if a group is collapsed
	 */
	isGroupCollapsed(group: string): boolean {
		return this.storage.collapsedGroups?.[group] || false;
	}

	/**
	 * Set group collapsed state
	 */
	setGroupCollapsed(group: string, collapsed: boolean): void {
		if (!this.storage.collapsedGroups) {
			this.storage.collapsedGroups = {};
		}

		if (collapsed) {
			this.storage.collapsedGroups[group] = true;
		} else {
			delete this.storage.collapsedGroups[group];
		}
	}

	/**
	 * Toggle group collapsed state
	 */
	toggleGroupCollapsed(group: string): boolean {
		const newState = !this.isGroupCollapsed(group);
		this.setGroupCollapsed(group, newState);
		return newState;
	}

	// ───────────────────────────────────────────────────────────────────
	// Group Order Management (for manual sorting)
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Get saved group order
	 */
	getGroupOrder(): string[] {
		// Return a copy: callers (and reorder helpers) splice the result, and we
		// don't want them mutating persisted state through the getter.
		return [...(this.storage.groupOrder || [])];
	}

	/**
	 * Set group order
	 */
	setGroupOrder(order: string[]): void {
		this.storage.groupOrder = order;
	}

	/**
	 * Move group to a specific position relative to another group
	 */
	moveGroupRelativeTo(groupName: string, targetGroup: string, position: 'before' | 'after'): void {
		// Get current order (or initialize from alphabetical)
		let order = this.getGroupOrder();
		if (order.length === 0) {
			order = [...this.getGroups()];
		}

		// Remove group from current position
		const currentIndex = order.indexOf(groupName);
		if (currentIndex !== -1) {
			order.splice(currentIndex, 1);
		}

		// Find target position
		let targetIndex = order.indexOf(targetGroup);
		if (targetIndex === -1) {
			targetIndex = order.length;
		} else if (position === 'after') {
			targetIndex++;
		}

		// Insert at new position
		order.splice(targetIndex, 0, groupName);
		this.setGroupOrder(order);

		this.logger.log(`Moved group "${groupName}" ${position} "${targetGroup}"`);
	}

	// Note: group-order cleanup is handled by pruneOrphanedGroupData(), which
	// correctly preserves the '\x00nogroup' sentinel position. (An older
	// cleanupGroupOrder() filtered against getGroups() — which excludes the
	// sentinel — and so silently discarded the No-Group's saved placement; it
	// was unused and has been removed.)

	// ───────────────────────────────────────────────────────────────────
	// Workspace Order Management (for manual sorting)
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Get the order key for a group (use "__ungrouped__" for null group)
	 */
	private getOrderKey(group: string | null): string {
		return group || '__ungrouped__';
	}

	/**
	 * Get workspace order for a group
	 */
	getWorkspaceOrder(group: string | null): string[] {
		// Return a copy (see getGroupOrder) so callers can't splice persisted state.
		const key = this.getOrderKey(group);
		return [...(this.storage.workspaceOrder?.[key] || [])];
	}

	/**
	 * Set workspace order for a group
	 */
	setWorkspaceOrder(group: string | null, order: string[]): void {
		if (!this.storage.workspaceOrder) {
			this.storage.workspaceOrder = {};
		}
		const key = this.getOrderKey(group);
		this.storage.workspaceOrder[key] = order;
	}

	/**
	 * Get workspaces by group with manual order applied
	 * Falls back to alphabetical if no manual order is set
	 */
	getWorkspacesByGroupOrdered(group: string | null, useManualOrder: boolean): string[] {
		const workspaces = this.getWorkspacesByGroup(group);

		if (!useManualOrder) {
			return workspaces; // Already sorted alphabetically
		}

		const savedOrder = this.getWorkspaceOrder(group);
		if (savedOrder.length === 0) {
			return workspaces; // No saved order, use alphabetical
		}

		// Sort by saved order, putting unknown workspaces at the end
		const orderMap = new Map(savedOrder.map((name, idx) => [name, idx]));
		return workspaces.sort((a, b) => {
			const orderA = orderMap.has(a) ? orderMap.get(a)! : Infinity;
			const orderB = orderMap.has(b) ? orderMap.get(b)! : Infinity;
			if (orderA === orderB) {
				// Both unknown, sort alphabetically
				return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
			}
			return orderA - orderB;
		});
	}

	/**
	 * Reorder a workspace within its group
	 * @param workspaceName The workspace to move
	 * @param targetIndex The new index within the group
	 */
	reorderWorkspace(workspaceName: string, targetIndex: number): void {
		const group = this.getWorkspaceGroup(workspaceName);
		const workspaces = this.getWorkspacesByGroup(group);

		// Get current order (or initialize from alphabetical)
		let order = this.getWorkspaceOrder(group);
		if (order.length === 0) {
			order = [...workspaces];
		}

		// Remove workspace from current position
		const currentIndex = order.indexOf(workspaceName);
		if (currentIndex !== -1) {
			order.splice(currentIndex, 1);
		}

		// Insert at new position
		const clampedIndex = Math.max(0, Math.min(targetIndex, order.length));
		order.splice(clampedIndex, 0, workspaceName);

		// Save new order
		this.setWorkspaceOrder(group, order);
		this.logger.log(`Reordered "${workspaceName}" to index ${clampedIndex} in group "${group || '(ungrouped)'}"`);
	}

	/**
	 * Move workspace to a specific position relative to another workspace
	 * @param workspaceName The workspace to move
	 * @param targetWorkspace The workspace to position relative to
	 * @param position 'before' or 'after' the target
	 */
	moveWorkspaceRelativeTo(workspaceName: string, targetWorkspace: string, position: 'before' | 'after'): void {
		const targetGroup = this.getWorkspaceGroup(targetWorkspace);
		const sourceGroup = this.getWorkspaceGroup(workspaceName);

		// If moving between groups, update the group first
		if (sourceGroup !== targetGroup) {
			this.setWorkspaceGroup(workspaceName, targetGroup);
			// Remove from old group's order
			const oldOrder = this.getWorkspaceOrder(sourceGroup);
			const oldIndex = oldOrder.indexOf(workspaceName);
			if (oldIndex !== -1) {
				oldOrder.splice(oldIndex, 1);
				this.setWorkspaceOrder(sourceGroup, oldOrder);
			}
		}

		// Get target group's order
		let order = this.getWorkspaceOrder(targetGroup);
		if (order.length === 0) {
			order = [...this.getWorkspacesByGroup(targetGroup)];
		}

		// Remove workspace from current position in this group
		const currentIndex = order.indexOf(workspaceName);
		if (currentIndex !== -1) {
			order.splice(currentIndex, 1);
		}

		// Find target position
		let targetIndex = order.indexOf(targetWorkspace);
		if (targetIndex === -1) {
			targetIndex = order.length;
		} else if (position === 'after') {
			targetIndex++;
		}

		// Insert at new position
		order.splice(targetIndex, 0, workspaceName);
		this.setWorkspaceOrder(targetGroup, order);

		this.logger.log(`Moved "${workspaceName}" ${position} "${targetWorkspace}" in group "${targetGroup || '(ungrouped)'}"`);
	}

	/**
	 * Clean up workspace order data (remove deleted workspaces, add missing ones)
	 */
	cleanupWorkspaceOrder(): void {
		if (!this.storage.workspaceOrder) return;

		const allWorkspaces = new Set(Object.keys(this.storage.workspaces));

		for (const key of Object.keys(this.storage.workspaceOrder)) {
			const order = this.storage.workspaceOrder[key];
			// Remove workspaces that no longer exist
			this.storage.workspaceOrder[key] = order.filter(name => allWorkspaces.has(name));
		}
	}

	/**
	 * Get workspace icon
	 */
	getWorkspaceIcon(name: string): string | null {
		const workspace = this.getWorkspace(name);
		return workspace?.metadata?.icon || null;
	}

	/**
	 * Set workspace icon (Lucide icon name)
	 */
	setWorkspaceIcon(name: string, icon: string | null, color?: string | null): void {
		const workspace = this.getWorkspace(name);
		if (!workspace) return;

		if (!workspace.metadata) {
			workspace.metadata = {};
		}

		if (icon) {
			workspace.metadata.icon = icon;
		} else {
			delete workspace.metadata.icon;
		}

		if (color) {
			workspace.metadata.iconColor = color;
		} else {
			delete workspace.metadata.iconColor;
		}
	}

	/**
	 * Get workspace icon color
	 */
	getWorkspaceIconColor(name: string): string | null {
		const workspace = this.getWorkspace(name);
		return workspace?.metadata?.iconColor || null;
	}

	/**
	 * Get workspace name style
	 */
	getWorkspaceNameStyle(name: string): { color?: string; bold?: boolean; italic?: boolean } {
		const workspace = this.getWorkspace(name);
		return {
			color:  workspace?.metadata?.nameColor || undefined,
			bold:   workspace?.metadata?.nameBold || false,
			italic: workspace?.metadata?.nameItalic || false,
		};
	}

	/**
	 * Set workspace name style
	 */
	setWorkspaceNameStyle(name: string, style: { color?: string | null; bold?: boolean; italic?: boolean }): void {
		const workspace = this.getWorkspace(name);
		if (!workspace) return;

		if (!workspace.metadata) {
			workspace.metadata = {};
		}

		if (style.color) {
			workspace.metadata.nameColor = style.color;
		} else if (style.color === null) {
			delete workspace.metadata.nameColor;
		}

		workspace.metadata.nameBold = style.bold || false;
		workspace.metadata.nameItalic = style.italic || false;

		// Clean up if all false/undefined
		if (!workspace.metadata.nameBold) delete workspace.metadata.nameBold;
		if (!workspace.metadata.nameItalic) delete workspace.metadata.nameItalic;
	}

	/**
	 * Clear all style data (icon, colors, formatting) from all workspaces
	 */
	clearAllStyles(): void {
		for (const name of this.getWorkspaceNames()) {
			const workspace = this.getWorkspace(name);
			if (workspace?.metadata) {
				delete workspace.metadata.icon;
				delete workspace.metadata.iconColor;
				delete workspace.metadata.nameColor;
				delete workspace.metadata.nameBold;
				delete workspace.metadata.nameItalic;
			}
		}
		this.logger.log('Cleared all workspace styles');
	}

	/**
	 * Save current workspace layout
	 * @returns true if this was a new workspace, false if updating existing
	 */
	async saveWorkspace(name: string, saveFolderState: boolean = false): Promise<boolean> {
		this.logger.log(`\n### SAVE WORKSPACE: "${name}"`);
		this.logger.log(`- Save folder state: ${saveFolderState}`);

		if (!name || name.trim() === '') {
			this.logger.log('❌ ERROR: Workspace name cannot be empty');
			new Notice('Workspace name cannot be empty');
			return false;
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

			// Store workspace data (preserve existing metadata for existing workspaces)
			const isNewWorkspace = !this.storage.workspaces[name];
			const existingMetadata = this.storage.workspaces[name]?.metadata;
			this.storage.workspaces[name] = {
				layout: layout,
				lastSaved: Date.now(),
				folderExpandState: folderExpandState,
				metadata: existingMetadata
			};

			// Set as active workspace
			this.storage.activeWorkspace = name;

			this.logger.log(`✅ Successfully saved workspace "${name}"`);
			await this.logger.save();

			// Return whether this was a new workspace (for default group assignment)
			return isNewWorkspace;

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

		// Update workspace order to preserve position (for manual sort order)
		if (this.storage.workspaceOrder) {
			for (const key of Object.keys(this.storage.workspaceOrder)) {
				const order: string[] = this.storage.workspaceOrder[key];
				const index = order.indexOf(oldName);
				if (index !== -1) {
					order[index] = newName;
					this.logger.log(`- Updated workspace order in group "${key}"`);
				}
			}
		}

		// Trigger workspace rename event
		this.app.workspace.trigger('workspace-rename', newName, oldName);

		this.logger.log(`✅ Successfully renamed workspace`);
		this.logger.save();
	}

	/**
	 * Duplicate a workspace
	 */
	duplicateWorkspace(sourceName: string, newName: string): void {
		this.logger.log(`\n### DUPLICATE WORKSPACE: "${sourceName}" → "${newName}"`);

		if (!this.hasWorkspace(sourceName)) {
			this.logger.log(`❌ ERROR: Source workspace "${sourceName}" not found`);
			new Notice(`Workspace "${sourceName}" not found`);
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

		// Deep copy the source workspace data
		const sourceWorkspace = this.storage.workspaces[sourceName];
		this.storage.workspaces[newName] = {
			layout: JSON.parse(JSON.stringify(sourceWorkspace.layout)),
			lastSaved: Date.now(),
			folderExpandState: sourceWorkspace.folderExpandState ?
				JSON.parse(JSON.stringify(sourceWorkspace.folderExpandState)) : undefined,
			metadata: sourceWorkspace.metadata ?
				JSON.parse(JSON.stringify(sourceWorkspace.metadata)) : undefined
		};

		this.logger.log(`✅ Successfully duplicated workspace to "${newName}"`);
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
	// Cross-Workspace Note Search
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Extract all open file paths from a workspace layout
	 * Recursively traverses the layout structure to find all leaves with file state
	 */
	getOpenFilesInLayout(layout: any): string[] {
		const files: string[] = [];

		const traverse = (node: any) => {
			if (!node) return;

			// Check various places where file path might be stored
			// Obsidian stores it as state.state.file for markdown views
			if (node.state?.state?.file) {
				files.push(node.state.state.file);
			}
			// Also check direct state.file (older format or other view types)
			if (node.state?.file) {
				files.push(node.state.file);
			}

			// Traverse children array (for splits/tabs)
			if (node.children && Array.isArray(node.children)) {
				for (const child of node.children) {
					traverse(child);
				}
			}

			// Traverse main area
			if (node.main) {
				traverse(node.main);
			}

			// Traverse left/right sidebars
			if (node.left) traverse(node.left);
			if (node.right) traverse(node.right);
		};

		traverse(layout);
		return files;
	}

	/**
	 * Get all open files in a specific workspace
	 */
	getOpenFilesInWorkspace(workspaceName: string): string[] {
		const workspace = this.getWorkspace(workspaceName);
		if (!workspace?.layout) return [];
		return this.getOpenFilesInLayout(workspace.layout);
	}

	/**
	 * Find all workspaces that have a specific file open
	 * @param filePath The file path to search for
	 * @param excludeWorkspace Optional workspace to exclude (e.g., current workspace)
	 * @returns Array of workspace names that have the file open
	 */
	getWorkspacesWithFile(filePath: string, excludeWorkspace?: string): string[] {
		const workspaces: string[] = [];

		for (const name of this.getWorkspaceNames()) {
			if (excludeWorkspace && name === excludeWorkspace) continue;

			const openFiles = this.getOpenFilesInWorkspace(name);
			if (openFiles.includes(filePath)) {
				workspaces.push(name);
			}
		}

		return workspaces;
	}

	/**
	 * Add a file to a workspace's layout (in the main editor area)
	 * This modifies the stored layout so the file will be open when the workspace is loaded
	 */
	addFileToWorkspace(workspaceName: string, filePath: string): boolean {
		const workspace = this.getWorkspace(workspaceName);
		if (!workspace?.layout) return false;

		// Find the main editor area and add a new leaf
		const addToMain = (node: any): boolean => {
			if (!node) return false;

			// If this is a tabs container in the main area, add the file as a new tab
			if (node.type === 'tabs' && node.children && Array.isArray(node.children)) {
				// Create a new leaf for the file
				const newLeaf = {
					id: this.generateLeafId(),
					type: 'leaf',
					state: {
						type: 'markdown',
						state: {
							file: filePath,
							mode: 'source',
							source: false
						}
					}
				};
				node.children.push(newLeaf);
				// Set as active tab
				node.currentTab = node.children.length - 1;
				return true;
			}

			// Traverse children
			if (node.children && Array.isArray(node.children)) {
				for (const child of node.children) {
					if (addToMain(child)) return true;
				}
			}

			return false;
		};

		// Try to add to main area first
		if (workspace.layout.main && addToMain(workspace.layout.main)) {
			this.logger.log(`Added file "${filePath}" to workspace "${workspaceName}"`);
			return true;
		}

		this.logger.log(`Failed to add file "${filePath}" to workspace "${workspaceName}"`);
		return false;
	}

	/**
	 * Generate a unique leaf ID (similar to Obsidian's format)
	 */
	private generateLeafId(): string {
		return Math.random().toString(36).substring(2, 15);
	}

	/**
	 * Remove a file from a workspace's layout
	 * This modifies the stored layout so the file will no longer be open when the workspace is loaded
	 */
	removeFileFromWorkspace(workspaceName: string, filePath: string): boolean {
		const workspace = this.getWorkspace(workspaceName);
		if (!workspace?.layout) return false;

		let removed = false;

		const removeFromNode = (node: any, parent: any, childIndex: number): boolean => {
			if (!node) return false;

			// If this is a leaf with the target file, mark for removal
			if (node.type === 'leaf' && node.state?.state?.file === filePath) {
				return true; // Signal to parent to remove this child
			}

			// If this is a tabs/split container, process children
			if (node.children && Array.isArray(node.children)) {
				for (let i = node.children.length - 1; i >= 0; i--) {
					if (removeFromNode(node.children[i], node, i)) {
						node.children.splice(i, 1);
						removed = true;

						// Adjust currentTab if needed
						if (node.currentTab !== undefined) {
							if (node.currentTab >= node.children.length) {
								node.currentTab = Math.max(0, node.children.length - 1);
							}
						}
					}
				}
			}

			return false;
		};

		// Process main area
		if (workspace.layout.main) {
			removeFromNode(workspace.layout.main, null, -1);
		}

		// Process left sidebar
		if (workspace.layout.left) {
			removeFromNode(workspace.layout.left, null, -1);
		}

		// Process right sidebar
		if (workspace.layout.right) {
			removeFromNode(workspace.layout.right, null, -1);
		}

		if (removed) {
			this.logger.log(`Removed file "${filePath}" from workspace "${workspaceName}"`);
		}

		return removed;
	}

	/**
	 * Remove a file from all workspaces
	 * @returns Array of workspace names where the file was removed
	 */
	removeFileFromAllWorkspaces(filePath: string): string[] {
		const removedFrom: string[] = [];

		for (const name of this.getWorkspaceNames()) {
			if (this.removeFileFromWorkspace(name, filePath)) {
				removedFrom.push(name);
			}
		}

		return removedFrom;
	}

	/**
	 * Reorder a file within a workspace's layout (move relative to another file)
	 * @param workspaceName The workspace to modify
	 * @param filePath The file to move
	 * @param targetFilePath The file to position relative to
	 * @param insertBefore If true, insert before target; otherwise insert after
	 */
	reorderFileInWorkspace(workspaceName: string, filePath: string, targetFilePath: string, insertBefore: boolean): boolean {
		const workspace = this.getWorkspace(workspaceName);
		if (!workspace?.layout) return false;

		// Find the tabs container that has both files and reorder within it
		const reorderInNode = (node: any): boolean => {
			if (!node) return false;

			// If this is a tabs container, check if it has both files
			if (node.type === 'tabs' && node.children && Array.isArray(node.children)) {
				let sourceIndex = -1;
				let targetIndex = -1;

				for (let i = 0; i < node.children.length; i++) {
					const child = node.children[i];
					const childFile = child.state?.state?.file || child.state?.file;
					if (childFile === filePath) sourceIndex = i;
					if (childFile === targetFilePath) targetIndex = i;
				}

				if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex !== targetIndex) {
					// Remove from current position
					const [movedChild] = node.children.splice(sourceIndex, 1);

					// Adjust target index if source was before target
					if (sourceIndex < targetIndex) {
						targetIndex--;
					}

					// Insert at new position
					const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
					node.children.splice(insertIndex, 0, movedChild);

					// Update currentTab if needed
					if (node.currentTab !== undefined) {
						node.currentTab = insertIndex;
					}

					return true;
				}
			}

			// Traverse children
			if (node.children && Array.isArray(node.children)) {
				for (const child of node.children) {
					if (reorderInNode(child)) return true;
				}
			}

			return false;
		};

		// Try main area first
		if (workspace.layout.main && reorderInNode(workspace.layout.main)) {
			this.logger.log(`Reordered file "${filePath}" ${insertBefore ? 'before' : 'after'} "${targetFilePath}" in workspace "${workspaceName}"`);
			return true;
		}

		// Try sidebars
		if (workspace.layout.left && reorderInNode(workspace.layout.left)) return true;
		if (workspace.layout.right && reorderInNode(workspace.layout.right)) return true;

		return false;
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

	// ───────────────────────────────────────────────────────────────────
	// Import from Obsidian Core Workspaces Plugin
	// ───────────────────────────────────────────────────────────────────

	/**
	 * Import workspaces from Obsidian's core Workspaces plugin
	 * Reads from .obsidian/workspaces.json in the vault
	 * @param overwrite If true, clears ALL existing workspaces first, then imports
	 * @returns Object with counts of imported, skipped, and failed workspaces
	 */
	async importFromCorePlugin(overwrite: boolean = false): Promise<{
		imported: string[];
		skipped:  string[];
		failed:   string[];
	}> {
		this.logger.log(`\n### IMPORT FROM CORE WORKSPACES PLUGIN`);
		this.logger.log(`- Overwrite existing: ${overwrite}`);

		const result = {
			imported: [] as string[],
			skipped:  [] as string[],
			failed:   [] as string[]
		};

		try {
			// Read the core workspaces.json file
			// Note: .obsidian files are not in the vault tree, must use adapter
			const configDir  = this.app.vault.configDir;
			const configPath = `${configDir}/workspaces.json`;

			this.logger.log(`- Looking for: ${configPath}`);

			// Check if file exists using adapter (not vault API)
			const exists = await this.app.vault.adapter.exists(configPath);
			if (!exists) {
				this.logger.log(`❌ ERROR: workspaces.json not found`);
				new Notice('No core workspaces.json found. Is the Workspaces plugin enabled?');
				return result;
			}

			// Read the file content using adapter
			const content = await this.app.vault.adapter.read(configPath);
			const coreData = JSON.parse(content);

			this.logger.log(`- Found core workspaces data`);
			this.logger.log(`\`\`\`json\n${JSON.stringify(Object.keys(coreData.workspaces || {}), null, 2)}\n\`\`\``);

			// Check if there are workspaces to import
			if (!coreData.workspaces || Object.keys(coreData.workspaces).length === 0) {
				this.logger.log(`⚠️ No workspaces found in core plugin`);
				new Notice('No workspaces found in core Workspaces plugin');
				return result;
			}

			// If overwrite mode, clear ALL existing workspaces first
			if (overwrite) {
				const existingNames = Object.keys(this.storage.workspaces);
				this.logger.log(`- Overwrite mode: clearing ${existingNames.length} existing workspaces`);
				this.storage.workspaces = {};
				// Don't clear activeWorkspace yet - we'll set it to first imported workspace

				// Clearing workspaces orphans their group/order/style data; prune it
				// so the imported set starts from a clean slate.
				this.pruneOrphanedGroupData();
				this.cleanupWorkspaceOrder();
			}

			// Import each workspace
			for (const [name, layout] of Object.entries(coreData.workspaces)) {
				try {
					// Validate workspace name
					if (!name || typeof name !== 'string' || name.trim() === '') {
						this.logger.log(`❌ Skipping invalid workspace name: "${name}"`);
						result.failed.push(name || '(empty)');
						continue;
					}

					// Validate layout structure (must be an object with main property)
					if (!layout || typeof layout !== 'object') {
						this.logger.log(`❌ Invalid layout for "${name}": not an object`);
						result.failed.push(name);
						continue;
					}

					const layoutObj = layout as Record<string, any>;
					if (!layoutObj.main) {
						this.logger.log(`❌ Invalid layout for "${name}": missing 'main' property`);
						result.failed.push(name);
						continue;
					}

					// Check if workspace already exists (only relevant in non-overwrite mode)
					if (this.hasWorkspace(name)) {
						this.logger.log(`- Skipping existing workspace: "${name}"`);
						result.skipped.push(name);
						continue;
					}

					// Create workspace data structure
					this.storage.workspaces[name] = {
						layout:     layout,
						lastSaved:  Date.now()
					};

					result.imported.push(name);
					this.logger.log(`✅ Imported workspace: "${name}"`);

				} catch (err) {
					this.logger.log(`❌ Failed to import workspace "${name}": ${err}`);
					result.failed.push(name);
				}
			}

			this.logger.log(`\n### IMPORT COMPLETE`);
			this.logger.log(`- Imported: ${result.imported.length}`);
			this.logger.log(`- Skipped:  ${result.skipped.length}`);
			this.logger.log(`- Failed:   ${result.failed.length}`);

			// Set first imported workspace as active if we imported any
			if (result.imported.length > 0) {
				this.storage.activeWorkspace = result.imported[0];
				this.logger.log(`- Set active workspace to: "${result.imported[0]}"`);
			}

			await this.logger.save();

		} catch (err) {
			this.logger.log(`❌ ERROR reading workspaces.json: ${err}`);
			new Notice(`Failed to read core workspaces: ${err}`);
		}

		return result;
	}
}
