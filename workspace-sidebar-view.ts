// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE NAVIGATOR SIDEBAR VIEW
// Tree view in left sidebar showing all workspaces organized by groups
// ═══════════════════════════════════════════════════════════════════════════════

import { ItemView, WorkspaceLeaf, Menu, setIcon, Notice } from 'obsidian';
import WorkspaceNavigator from './main';
import { WorkspaceStyleModal, WorkspaceStyleResult, GroupStylePickerModal, GroupStyleResult } from './workspace-modal';
import { createConfirmationDialog } from './confirm-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────────────────────────────────────

export const VIEW_TYPE_WORKSPACE_NAVIGATOR = 'workspace-navigator-view';
const NO_GROUP_KEY = '\x00nogroup';

// ───────────────────────────────────────────────────────────────────────────────
// Sidebar View Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceNavigatorView extends ItemView {
	plugin:              WorkspaceNavigator;
	containerEl:         HTMLElement;
	treeContainer:       HTMLElement;
	collapsedGroups:     Set<string> = new Set();
	collapsedWorkspaces: Set<string> = new Set();

	// Drag state
	draggedItem:       string | null = null;
	draggedType:       'workspace' | 'group' | null = null;
	dragIndicator:     HTMLElement | null = null;

	// File drag state
	draggedFile:          string | null = null;
	draggedFileWorkspace: string | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: WorkspaceNavigator) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_WORKSPACE_NAVIGATOR;
	}

	getDisplayText(): string {
		return 'Workspaces';
	}

	getIcon(): string {
		return 'layout-template';
	}

	// ─────────────────────────────────────────────────────────────────
	// Lifecycle
	// ─────────────────────────────────────────────────────────────────

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('workspace-navigator-sidebar');

		// Header with actions
		const header = container.createDiv('workspace-sidebar-header');
		this.createHeaderActions(header);

		// Tree container
		this.treeContainer = container.createDiv('workspace-sidebar-tree');

		// Start with all workspaces collapsed
		const workspaces = this.plugin.getWorkspaceManager().getWorkspaceNames();
		for (const ws of workspaces) {
			this.collapsedWorkspaces.add(ws);
		}

		// Render initial tree
		this.renderTree();
	}

	async onClose() {
		// Cleanup
	}

	// ─────────────────────────────────────────────────────────────────
	// Header Actions
	// ─────────────────────────────────────────────────────────────────

	createHeaderActions(header: HTMLElement) {
		const actionsContainer = header.createDiv('workspace-sidebar-actions');

		// Add group button
		const addGroupBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-action-btn' });
		setIcon(addGroupBtn, 'folder-plus');
		addGroupBtn.setAttribute('aria-label', 'Create new group');
		addGroupBtn.addEventListener('click', () => this.createNewGroup());

		// Add workspace button
		const addWorkspaceBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-action-btn' });
		setIcon(addWorkspaceBtn, 'plus');
		addWorkspaceBtn.setAttribute('aria-label', 'Create new workspace');
		addWorkspaceBtn.addEventListener('click', () => this.createNewWorkspace());

		// Expand/Collapse groups button
		const expandGroupsBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-action-btn' });
		this.updateExpandGroupsButton(expandGroupsBtn);
		expandGroupsBtn.addEventListener('click', () => {
			this.toggleAllGroups();
			this.updateExpandGroupsButton(expandGroupsBtn);
		});

		// Expand/Collapse workspaces (files) button
		const expandWorkspacesBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-action-btn' });
		this.updateExpandWorkspacesButton(expandWorkspacesBtn);
		expandWorkspacesBtn.addEventListener('click', () => {
			this.toggleAllWorkspaceFiles();
			this.updateExpandWorkspacesButton(expandWorkspacesBtn);
		});

		// Settings button
		const settingsBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-action-btn' });
		setIcon(settingsBtn, 'settings');
		settingsBtn.setAttribute('aria-label', 'Open plugin settings');
		settingsBtn.addEventListener('click', () => {
			(this.app as any).setting.open();
			(this.app as any).setting.openTabById('workspace-navigator');
		});
	}

	updateExpandGroupsButton(btn: HTMLElement) {
		const groups = this.plugin.getWorkspaceManager().getGroups();
		const anyCollapsed = groups.some(g => this.collapsedGroups.has(g)) ||
		                     this.collapsedGroups.has(NO_GROUP_KEY);

		btn.empty();
		if (anyCollapsed) {
			setIcon(btn, 'chevrons-down');
			btn.setAttribute('aria-label', 'Expand all groups');
		} else {
			setIcon(btn, 'chevrons-up');
			btn.setAttribute('aria-label', 'Collapse all groups');
		}
	}

	updateExpandWorkspacesButton(btn: HTMLElement) {
		const workspaces = this.plugin.getWorkspaceManager().getWorkspaceNames();
		const anyCollapsed = workspaces.some(ws => this.collapsedWorkspaces.has(ws));

		btn.empty();
		if (anyCollapsed) {
			setIcon(btn, 'unfold-vertical');
			btn.setAttribute('aria-label', 'Expand all workspace files');
		} else {
			setIcon(btn, 'fold-vertical');
			btn.setAttribute('aria-label', 'Collapse all workspace files');
		}
	}

	toggleAllGroups() {
		const groups      = this.plugin.getWorkspaceManager().getGroups();
		const anyCollapsed = groups.some(g => this.collapsedGroups.has(g)) ||
		                     this.collapsedGroups.has(NO_GROUP_KEY);

		if (anyCollapsed) {
			// Expand all
			this.collapsedGroups.clear();
		} else {
			// Collapse all
			for (const g of groups) {
				this.collapsedGroups.add(g);
			}
			this.collapsedGroups.add(NO_GROUP_KEY);
		}

		this.renderTree();
	}

	toggleAllWorkspaceFiles() {
		const workspaces = this.plugin.getWorkspaceManager().getWorkspaceNames();
		const anyCollapsed = workspaces.some(ws => this.collapsedWorkspaces.has(ws));

		if (anyCollapsed) {
			// Expand all
			this.collapsedWorkspaces.clear();
		} else {
			// Collapse all
			for (const ws of workspaces) {
				this.collapsedWorkspaces.add(ws);
			}
		}

		this.renderTree();
	}

	// ─────────────────────────────────────────────────────────────────
	// Tree Rendering
	// ─────────────────────────────────────────────────────────────────

	renderTree() {
		this.treeContainer.empty();

		const workspaceManager = this.plugin.getWorkspaceManager();
		const useManualOrder   = this.plugin.settings.manualSortOrder;
		const activeWorkspace  = workspaceManager.getActiveWorkspace();

		// Get all groups (including NO_GROUP_KEY if there are ungrouped workspaces)
		// This method handles both manual and alphabetical ordering
		const allGroups = workspaceManager.getAllGroupsOrdered(useManualOrder);

		// Render each group
		for (const groupName of allGroups) {
			this.renderGroup(groupName, activeWorkspace, useManualOrder);
		}

		// If no groups at all, still show ungrouped workspaces
		if (allGroups.length === 0) {
			const ungrouped = workspaceManager.getWorkspacesByGroup(null);
			if (ungrouped.length > 0) {
				this.renderGroup(NO_GROUP_KEY, activeWorkspace, useManualOrder);
			}
		}
	}

	renderGroup(groupName: string, activeWorkspace: string | null, useManualOrder: boolean) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const isNoGroup        = groupName === NO_GROUP_KEY;
		const displayName      = isNoGroup ? 'No Group' : groupName;
		const isCollapsed      = this.collapsedGroups.has(groupName);

		// Get workspaces in this group
		const workspaces = isNoGroup
			? workspaceManager.getWorkspacesByGroup(null)
			: workspaceManager.getWorkspacesByGroup(groupName);

		// Skip empty non-"No Group" groups
		if (workspaces.length === 0 && !isNoGroup) return;

		// Group container
		const groupContainer = this.treeContainer.createDiv('workspace-sidebar-group');
		groupContainer.dataset.groupName = groupName;

		// Group header
		const groupHeader = groupContainer.createDiv('workspace-sidebar-group-header');
		groupHeader.dataset.groupName = groupName;

		// Make draggable if manual order
		if (useManualOrder && !isNoGroup) {
			groupHeader.draggable = true;
			groupHeader.addEventListener('dragstart', (evt) => this.onGroupDragStart(evt, groupName));
			groupHeader.addEventListener('dragend', () => this.onDragEnd());
		}

		// Drop target for groups
		groupHeader.addEventListener('dragover', (evt) => this.onGroupDragOver(evt, groupName));
		groupHeader.addEventListener('drop', (evt) => this.onGroupDrop(evt, groupName));
		groupHeader.addEventListener('dragleave', (evt) => this.onDragLeave(evt));

		// Chevron
		const chevron = groupHeader.createSpan('workspace-sidebar-chevron');
		setIcon(chevron, isCollapsed ? 'chevron-right' : 'chevron-down');
		chevron.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.toggleGroup(groupName);
		});

		// Group icon
		const iconSpan = groupHeader.createSpan('workspace-sidebar-group-icon');
		const groupIcon = workspaceManager.getGroupIcon(groupName);
		if (groupIcon) {
			setIcon(iconSpan, groupIcon);
			const iconColor = workspaceManager.getGroupIconColor(groupName);
			if (iconColor) iconSpan.style.color = iconColor;
		} else {
			setIcon(iconSpan, 'folder');
			iconSpan.style.opacity = '0.4';
		}

		// Group name
		const nameSpan = groupHeader.createSpan('workspace-sidebar-group-name');
		nameSpan.textContent = displayName;

		// Apply group text styling
		const groupColor  = workspaceManager.getGroupColor(groupName);
		const groupBold   = workspaceManager.getGroupBold(groupName);
		const groupItalic = workspaceManager.getGroupItalic(groupName);
		if (groupColor) nameSpan.style.color = groupColor;
		if (groupBold) nameSpan.style.fontWeight = 'bold';
		if (groupItalic) nameSpan.style.fontStyle = 'italic';

		// Count badge for collapsed groups
		if (isCollapsed) {
			const countBadge = groupHeader.createSpan('workspace-sidebar-count');
			countBadge.textContent = `(${workspaces.length})`;
		}

		// Action buttons container
		const actionsContainer = groupHeader.createDiv('workspace-sidebar-group-actions');

		// Edit button (pencil)
		const editBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-item-btn' });
		setIcon(editBtn, 'pencil');
		editBtn.setAttribute('aria-label', isNoGroup ? 'Edit ungrouped style' : 'Edit group');
		editBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.editGroup(groupName);
		});

		// Delete button (trash) - only for named groups
		if (!isNoGroup) {
			const deleteBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-item-btn workspace-sidebar-delete-btn' });
			setIcon(deleteBtn, 'trash-2');
			deleteBtn.setAttribute('aria-label', 'Delete group');
			deleteBtn.addEventListener('click', (evt) => {
				evt.stopPropagation();
				this.deleteGroup(groupName);
			});
		}

		// Context menu for group
		groupHeader.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
			this.showGroupContextMenu(evt, groupName);
		});

		// Click to toggle
		groupHeader.addEventListener('click', () => this.toggleGroup(groupName));

		// Workspaces container (collapsible)
		if (!isCollapsed) {
			const workspacesContainer = groupContainer.createDiv('workspace-sidebar-workspaces');

			// Get workspaces with proper ordering (handles both manual and alphabetical)
			const realGroup = isNoGroup ? null : groupName;
			const sortedWorkspaces = workspaceManager.getWorkspacesByGroupOrdered(realGroup, useManualOrder);

			for (const wsName of sortedWorkspaces) {
				this.renderWorkspaceItem(workspacesContainer, wsName, activeWorkspace, useManualOrder, groupName);
			}
		}
	}

	renderWorkspaceItem(
		container:       HTMLElement,
		workspaceName:   string,
		activeWorkspace: string | null,
		useManualOrder:  boolean,
		groupName:       string
	) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const isActive         = workspaceName === activeWorkspace;

		// Workspace container (holds header + files)
		const wsContainer = container.createDiv('workspace-sidebar-ws-container');
		wsContainer.dataset.workspaceName = workspaceName;

		// Workspace header row
		const item = wsContainer.createDiv('workspace-sidebar-item');
		item.dataset.workspaceName = workspaceName;
		if (isActive) item.addClass('is-active');

		// Make draggable if manual order
		if (useManualOrder) {
			item.draggable = true;
			item.addEventListener('dragstart', (evt) => this.onWorkspaceDragStart(evt, workspaceName));
			item.addEventListener('dragend', () => this.onDragEnd());
		}

		// Drop target
		item.addEventListener('dragover', (evt) => this.onWorkspaceDragOver(evt, workspaceName, groupName));
		item.addEventListener('drop', (evt) => this.onWorkspaceDrop(evt, workspaceName, groupName));
		item.addEventListener('dragleave', (evt) => this.onDragLeave(evt));

		// Get open files for this workspace
		const openFiles = workspaceManager.getOpenFilesInWorkspace(workspaceName);
		const isWsCollapsed = this.collapsedWorkspaces.has(workspaceName);

		// Chevron for expanding/collapsing files list (only if has files)
		if (openFiles.length > 0) {
			const chevron = item.createSpan('workspace-sidebar-ws-chevron');
			setIcon(chevron, isWsCollapsed ? 'chevron-right' : 'chevron-down');
			chevron.addEventListener('click', (evt) => {
				evt.stopPropagation();
				this.toggleWorkspaceFiles(workspaceName);
			});
		} else {
			// Spacer for alignment when no files
			item.createSpan('workspace-sidebar-ws-chevron-spacer');
		}

		// Icon (always show - default if not set)
		const iconSpan = item.createSpan('workspace-sidebar-item-icon');
		const wsIcon   = workspaceManager.getWorkspaceIcon(workspaceName);
		if (wsIcon) {
			setIcon(iconSpan, wsIcon);
			const iconColor = workspaceManager.getWorkspaceIconColor(workspaceName);
			if (iconColor) iconSpan.style.color = iconColor;
		} else {
			// Default icon for workspaces without a custom icon
			setIcon(iconSpan, 'layout-dashboard');
			iconSpan.style.opacity = '0.4';
		}

		// Name
		const nameSpan = item.createSpan('workspace-sidebar-item-name');
		nameSpan.textContent = workspaceName;

		// Apply workspace text styling
		const wsStyle = workspaceManager.getWorkspaceNameStyle(workspaceName);
		if (wsStyle.color) nameSpan.style.color = wsStyle.color;
		if (wsStyle.bold) nameSpan.style.fontWeight = 'bold';
		if (wsStyle.italic) nameSpan.style.fontStyle = 'italic';

		// File count badge
		if (openFiles.length > 0) {
			const countBadge = item.createSpan('workspace-sidebar-file-count');
			countBadge.textContent = `(${openFiles.length})`;
		}

		// Action buttons container
		const actionsContainer = item.createDiv('workspace-sidebar-item-actions');

		// Edit button (pencil)
		const editBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-item-btn' });
		setIcon(editBtn, 'pencil');
		editBtn.setAttribute('aria-label', 'Edit workspace');
		editBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.editWorkspace(workspaceName);
		});

		// Delete button (trash)
		const deleteBtn = actionsContainer.createEl('button', { cls: 'workspace-sidebar-item-btn workspace-sidebar-delete-btn' });
		setIcon(deleteBtn, 'trash-2');
		deleteBtn.setAttribute('aria-label', 'Delete workspace');
		deleteBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.deleteWorkspace(workspaceName);
		});

		// Click to switch workspace
		item.addEventListener('click', async (evt) => {
			// Don't switch if clicking on action buttons or chevron
			if ((evt.target as HTMLElement).closest('.workspace-sidebar-item-actions')) return;
			if ((evt.target as HTMLElement).closest('.workspace-sidebar-ws-chevron')) return;

			// Save current workspace before switching if auto-save is enabled
			if (this.plugin.settings.autoSaveOnSwitch) {
				const current = workspaceManager.getActiveWorkspace();
				if (current) {
					await this.plugin.saveNavigationLayout(current);
					const saveFolderState = this.plugin.settings.rememberNavigationLayout;
					await workspaceManager.saveWorkspace(current, saveFolderState);
				}
			}

			await this.plugin.loadWorkspace(workspaceName);
			new Notice(`Switched to: ${workspaceName}`);
			this.renderTree();
		});

		// Context menu
		item.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
			this.showWorkspaceContextMenu(evt, workspaceName);
		});

		// Set up as drop target for files
		this.setupWorkspaceDropTarget(item, workspaceName);

		// Render open files list (if expanded and has files)
		if (openFiles.length > 0 && !isWsCollapsed) {
			const filesContainer = wsContainer.createDiv('workspace-sidebar-files');

			for (let i = 0; i < openFiles.length; i++) {
				this.renderFileItem(filesContainer, openFiles[i], workspaceName, isActive, i);
			}
		}
	}

	renderFileItem(container: HTMLElement, filePath: string, workspaceName: string, isActiveWorkspace: boolean, fileIndex: number) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const fileName = filePath.split('/').pop() || filePath;
		const baseName = fileName.replace(/\.md$/, '');

		const fileItem = container.createDiv('workspace-sidebar-file-item');
		fileItem.dataset.filePath = filePath;
		fileItem.dataset.workspaceName = workspaceName;
		fileItem.dataset.fileIndex = String(fileIndex);

		// Make draggable
		fileItem.draggable = true;
		fileItem.addEventListener('dragstart', (evt) => this.onFileDragStart(evt, filePath, workspaceName));
		fileItem.addEventListener('dragend', () => this.onDragEnd());

		// Drop target for reordering within same workspace
		fileItem.addEventListener('dragover', (evt) => this.onFileDragOver(evt, filePath, workspaceName));
		fileItem.addEventListener('drop', (evt) => this.onFileDrop(evt, filePath, workspaceName));
		fileItem.addEventListener('dragleave', (evt) => {
			fileItem.removeClass('drop-above', 'drop-below');
		});

		// File icon
		const iconSpan = fileItem.createSpan('workspace-sidebar-file-icon');
		setIcon(iconSpan, 'file-text');

		// File name
		const nameSpan = fileItem.createSpan('workspace-sidebar-file-name');
		nameSpan.textContent = baseName;
		nameSpan.setAttribute('aria-label', filePath);

		// Check if file exists in other workspaces
		const otherWorkspaces = workspaceManager.getWorkspacesWithFile(filePath, workspaceName);
		if (otherWorkspaces.length > 0) {
			const dupIndicator = fileItem.createSpan('workspace-sidebar-file-dup');
			if (otherWorkspaces.length === 1) {
				setIcon(dupIndicator, 'layers');
			} else {
				dupIndicator.textContent = `${otherWorkspaces.length + 1}`;
			}
			dupIndicator.setAttribute('aria-label', `Also in: ${otherWorkspaces.join(', ')}`);
		}

		// Click to open file (only in active workspace)
		if (isActiveWorkspace) {
			fileItem.addClass('is-clickable');
			fileItem.addEventListener('click', async (evt) => {
				// Don't open if dragging
				if (this.draggedFile) return;
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (file) {
					await this.app.workspace.openLinkText(filePath, '', false);
				}
			});
		}

		// Context menu for file
		fileItem.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
			this.showFileContextMenu(evt, filePath, workspaceName);
		});
	}

	onFileDragOver(evt: DragEvent, targetFilePath: string, targetWorkspace: string) {
		if (!this.draggedFile) return;

		// If same workspace, allow reordering
		if (this.draggedFileWorkspace === targetWorkspace && this.draggedFile !== targetFilePath) {
			evt.preventDefault();
			evt.dataTransfer!.dropEffect = 'move';

			const fileItem = (evt.target as HTMLElement).closest('.workspace-sidebar-file-item') as HTMLElement;
			if (!fileItem) return;

			const rect   = fileItem.getBoundingClientRect();
			const middle = rect.top + rect.height / 2;

			fileItem.removeClass('drop-above', 'drop-below');
			if (evt.clientY < middle) {
				fileItem.addClass('drop-above');
			} else {
				fileItem.addClass('drop-below');
			}
		}
	}

	onFileDrop(evt: DragEvent, targetFilePath: string, targetWorkspace: string) {
		evt.preventDefault();

		if (!this.draggedFile || !this.draggedFileWorkspace) return;

		const fileItem = (evt.target as HTMLElement).closest('.workspace-sidebar-file-item') as HTMLElement;
		if (fileItem) {
			fileItem.removeClass('drop-above', 'drop-below');
		}

		// Reordering within same workspace
		if (this.draggedFileWorkspace === targetWorkspace && this.draggedFile !== targetFilePath) {
			const workspaceManager = this.plugin.getWorkspaceManager();

			const rect   = fileItem?.getBoundingClientRect();
			const middle = rect ? rect.top + rect.height / 2 : 0;
			const insertBefore = evt.clientY < middle;

			workspaceManager.reorderFileInWorkspace(targetWorkspace, this.draggedFile, targetFilePath, insertBefore);
			this.plugin.saveSettings();
			this.renderTree();
		}
	}

	showFileContextMenu(evt: MouseEvent, filePath: string, workspaceName: string) {
		const menu = new Menu();
		const workspaceManager = this.plugin.getWorkspaceManager();
		const fileName = filePath.split('/').pop() || filePath;

		// Remove from this workspace
		menu.addItem((item) => {
			item.setTitle('Remove from this workspace')
				.setIcon('x')
				.onClick(async () => {
					workspaceManager.removeFileFromWorkspace(workspaceName, filePath);
					await this.plugin.saveSettings();
					this.renderTree();
					new Notice(`Removed "${fileName}" from ${workspaceName}`);
				});
		});

		// Check other workspaces
		const otherWorkspaces = workspaceManager.getWorkspacesWithFile(filePath, workspaceName);
		if (otherWorkspaces.length > 0) {
			menu.addItem((item) => {
				item.setTitle(`Remove from other workspaces (${otherWorkspaces.length})`)
					.setIcon('x-circle')
					.onClick(async () => {
						for (const ws of otherWorkspaces) {
							workspaceManager.removeFileFromWorkspace(ws, filePath);
						}
						await this.plugin.saveSettings();
						this.renderTree();
						new Notice(`Removed "${fileName}" from ${otherWorkspaces.length} other workspace(s)`);
					});
			});
		}

		// Copy to workspace submenu
		const allWorkspaces = workspaceManager.getWorkspaceNames().filter(ws => ws !== workspaceName);
		if (allWorkspaces.length > 0) {
			menu.addSeparator();
			menu.addItem((item) => {
				item.setTitle('Copy to workspace')
					.setIcon('copy');
			});
			const lastItem = (menu as any).items[(menu as any).items.length - 1];
			const submenu = (lastItem as any).setSubmenu();

			for (const ws of allWorkspaces) {
				const alreadyHas = workspaceManager.getOpenFilesInWorkspace(ws).includes(filePath);
				submenu.addItem((subItem: any) => {
					subItem.setTitle(ws + (alreadyHas ? ' ✓' : ''))
						.setDisabled(alreadyHas)
						.onClick(async () => {
							workspaceManager.addFileToWorkspace(ws, filePath);
							await this.plugin.saveSettings();
							this.renderTree();
							new Notice(`Copied "${fileName}" to ${ws}`);
						});
				});
			}
		}

		menu.showAtMouseEvent(evt);
	}

	toggleWorkspaceFiles(workspaceName: string) {
		if (this.collapsedWorkspaces.has(workspaceName)) {
			this.collapsedWorkspaces.delete(workspaceName);
		} else {
			this.collapsedWorkspaces.add(workspaceName);
		}
		this.renderTree();
	}

	// ─────────────────────────────────────────────────────────────────
	// Group Toggle
	// ─────────────────────────────────────────────────────────────────

	toggleGroup(groupName: string) {
		if (this.collapsedGroups.has(groupName)) {
			this.collapsedGroups.delete(groupName);
		} else {
			this.collapsedGroups.add(groupName);
		}
		this.renderTree();

		// Update expand/collapse button in header
		const btn = this.containerEl.querySelector('.workspace-sidebar-action-btn:nth-child(3)') as HTMLElement;
		if (btn) this.updateExpandGroupsButton(btn);
	}

	// ─────────────────────────────────────────────────────────────────
	// Context Menus
	// ─────────────────────────────────────────────────────────────────

	showGroupContextMenu(evt: MouseEvent, groupName: string) {
		const menu      = new Menu();
		const isNoGroup = groupName === NO_GROUP_KEY;

		// Edit group
		menu.addItem((item) => {
			item.setTitle(isNoGroup ? 'Edit ungrouped style' : 'Edit group')
				.setIcon('pencil')
				.onClick(() => this.editGroup(groupName));
		});

		if (!isNoGroup) {
			// Rename group (inline)
			menu.addItem((item) => {
				item.setTitle('Rename')
					.setIcon('text-cursor-input')
					.onClick(() => this.renameGroupInline(groupName));
			});

			menu.addSeparator();

			// Delete group
			menu.addItem((item) => {
				item.setTitle('Delete group')
					.setIcon('trash')
					.onClick(() => this.deleteGroup(groupName));
			});
		}

		menu.showAtMouseEvent(evt);
	}

	showWorkspaceContextMenu(evt: MouseEvent, workspaceName: string) {
		const menu             = new Menu();
		const workspaceManager = this.plugin.getWorkspaceManager();
		const isActive         = workspaceName === workspaceManager.getActiveWorkspace();

		// Switch to workspace
		if (!isActive) {
			menu.addItem((item) => {
				item.setTitle('Switch to workspace')
					.setIcon('arrow-right')
					.onClick(async () => {
						await this.plugin.loadWorkspace(workspaceName);
						new Notice(`Switched to: ${workspaceName}`);
						this.renderTree();
					});
			});
		}

		// Save workspace
		menu.addItem((item) => {
			item.setTitle('Save workspace')
				.setIcon('save')
				.onClick(async () => {
					if (isActive) {
						await this.plugin.saveNavigationLayout(workspaceName);
					}
					const saveFolderState = this.plugin.settings.rememberNavigationLayout;
					await workspaceManager.saveWorkspace(workspaceName, saveFolderState);
					await this.plugin.saveSettings();
					new Notice(`Saved: ${workspaceName}`);
				});
		});

		// Edit workspace
		menu.addItem((item) => {
			item.setTitle('Edit workspace')
				.setIcon('pencil')
				.onClick(() => this.editWorkspace(workspaceName));
		});

		// Rename workspace (inline)
		menu.addItem((item) => {
			item.setTitle('Rename')
				.setIcon('text-cursor-input')
				.onClick(() => this.renameWorkspaceInline(workspaceName));
		});

		menu.addSeparator();

		// Duplicate workspace
		menu.addItem((item) => {
			item.setTitle('Duplicate')
				.setIcon('copy')
				.onClick(() => this.duplicateWorkspace(workspaceName));
		});

		// Move to group submenu
		const groups = workspaceManager.getGroups();
		if (groups.length > 0) {
			menu.addItem((item) => {
				item.setTitle('Move to group')
					.setIcon('folder')
					.onClick(() => {}); // Submenu handled below
			});
			const lastItem = (menu as any).items[(menu as any).items.length - 1];
			const submenu  = (lastItem as any).setSubmenu();

			// No group option
			submenu.addItem((subItem: any) => {
				subItem.setTitle('(No group)')
					.onClick(async () => {
						workspaceManager.setWorkspaceGroup(workspaceName, null);
						await this.plugin.saveSettings();
						this.renderTree();
					});
			});

			for (const group of groups) {
				submenu.addItem((subItem: any) => {
					subItem.setTitle(group)
						.onClick(async () => {
							workspaceManager.setWorkspaceGroup(workspaceName, group);
							await this.plugin.saveSettings();
							this.renderTree();
						});
				});
			}
		}

		menu.addSeparator();

		// Delete workspace
		menu.addItem((item) => {
			item.setTitle('Delete workspace')
				.setIcon('trash')
				.onClick(() => this.deleteWorkspace(workspaceName));
		});

		menu.showAtMouseEvent(evt);
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Actions
	// ─────────────────────────────────────────────────────────────────

	async createNewWorkspace() {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Generate unique name
		let baseName = 'New Workspace';
		let name     = baseName;
		let counter  = 1;
		while (workspaceManager.hasWorkspace(name)) {
			counter++;
			name = `${baseName} ${counter}`;
		}

		// Save current layout as new workspace
		const saveFolderState = this.plugin.settings.rememberNavigationLayout;
		await workspaceManager.saveWorkspace(name, saveFolderState);

		// Apply default group if set
		if (this.plugin.settings.defaultGroup) {
			workspaceManager.setWorkspaceGroup(name, this.plugin.settings.defaultGroup);
		}

		await this.plugin.saveSettings();
		this.plugin.refreshWorkspaceCommands();
		this.renderTree();

		new Notice(`Created workspace: ${name}`);

		// Start inline rename
		setTimeout(() => this.renameWorkspaceInline(name), 100);
	}

	async createNewGroup() {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Generate unique name
		let baseName = 'New Group';
		let name     = baseName;
		let counter  = 1;
		const groups = workspaceManager.getGroups();
		while (groups.includes(name)) {
			counter++;
			name = `${baseName} ${counter}`;
		}

		// Create the group by adding it to the order (groups are implicit,
		// but we add to order so it shows up even when empty)
		const order = workspaceManager.getGroupOrder();
		order.push(name);
		workspaceManager.setGroupOrder(order);

		// Set a default icon so the group is distinguishable
		workspaceManager.setGroupIcon(name, 'folder');

		await this.plugin.saveSettings();
		this.renderTree();

		new Notice(`Created group: ${name}`);

		// Start inline rename
		setTimeout(() => this.renameGroupInline(name), 100);
	}

	editWorkspace(workspaceName: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const wsStyle = workspaceManager.getWorkspaceNameStyle(workspaceName);

		const currentStyle: WorkspaceStyleResult = {
			group:      workspaceManager.getWorkspaceGroup(workspaceName) || '',
			icon:       workspaceManager.getWorkspaceIcon(workspaceName) || '',
			iconColor:  workspaceManager.getWorkspaceIconColor(workspaceName) || '',
			nameColor:  wsStyle.color || '',
			nameBold:   wsStyle.bold || false,
			nameItalic: wsStyle.italic || false,
		};

		new WorkspaceStyleModal(
			this.app,
			this.plugin,
			workspaceName,
			currentStyle,
			async (style) => {
				// Apply style
				workspaceManager.setWorkspaceGroup(workspaceName, style.group || null);
				workspaceManager.setWorkspaceIcon(workspaceName, style.icon || null, style.iconColor || null);
				workspaceManager.setWorkspaceNameStyle(workspaceName, {
					color:  style.nameColor || null,
					bold:   style.nameBold,
					italic: style.nameItalic
				});

				// Handle rename
				if (style.newName && style.newName !== workspaceName) {
					workspaceManager.renameWorkspace(workspaceName, style.newName);
					this.plugin.refreshWorkspaceCommands();
				}

				await this.plugin.saveSettings();
				this.plugin.updateStatusBar();
				this.renderTree();
			}
		).open();
	}

	editGroup(groupName: string) {
		new GroupStylePickerModal(
			this.app,
			this.plugin,
			groupName,
			async (result) => {
				const workspaceManager = this.plugin.getWorkspaceManager();

				// Apply styles
				workspaceManager.setGroupIcon(groupName, result.icon);
				workspaceManager.setGroupIconColor(groupName, result.iconColor);
				workspaceManager.setGroupColor(groupName, result.textColor);
				workspaceManager.setGroupBold(groupName, result.textBold);
				workspaceManager.setGroupItalic(groupName, result.textItalic);

				// Handle rename
				if (result.newName && result.newName !== groupName && groupName !== NO_GROUP_KEY) {
					workspaceManager.renameGroup(groupName, result.newName);
				}

				await this.plugin.saveSettings();
				this.renderTree();
			}
		).open();
	}

	renameWorkspaceInline(workspaceName: string) {
		const item = this.treeContainer.querySelector(
			`.workspace-sidebar-item[data-workspace-name="${CSS.escape(workspaceName)}"]`
		) as HTMLElement;
		if (!item) return;

		const nameSpan = item.querySelector('.workspace-sidebar-item-name') as HTMLElement;
		if (!nameSpan) return;

		// Add renaming class to keep buttons visible
		item.addClass('is-renaming');

		// Create input
		const input     = document.createElement('input');
		input.type      = 'text';
		input.value     = workspaceName;
		input.className = 'workspace-sidebar-rename-input';

		// Replace name span with input
		nameSpan.replaceWith(input);
		input.focus();
		input.select();

		let isFinishing = false;
		const finishRename = async () => {
			if (isFinishing) return;
			isFinishing = true;

			const newName = input.value.trim();
			if (newName && newName !== workspaceName) {
				const workspaceManager = this.plugin.getWorkspaceManager();
				if (!workspaceManager.hasWorkspace(newName)) {
					workspaceManager.renameWorkspace(workspaceName, newName);
					await this.plugin.saveSettings();
					this.plugin.refreshWorkspaceCommands();
					this.plugin.updateStatusBar();

					// Update collapsed state for the renamed workspace
					if (this.collapsedWorkspaces.has(workspaceName)) {
						this.collapsedWorkspaces.delete(workspaceName);
						this.collapsedWorkspaces.add(newName);
					}

					new Notice(`Renamed to: ${newName}`);
				} else {
					new Notice(`Workspace "${newName}" already exists`);
				}
			}
			this.renderTree();
		};

		input.addEventListener('blur', finishRename);
		input.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter') {
				evt.preventDefault();
				input.blur();
			} else if (evt.key === 'Escape') {
				evt.preventDefault();
				isFinishing = true;
				this.renderTree();
			}
		}, true);
	}

	renameGroupInline(groupName: string) {
		const header = this.treeContainer.querySelector(
			`.workspace-sidebar-group-header[data-group-name="${CSS.escape(groupName)}"]`
		) as HTMLElement;
		if (!header) return;

		const nameSpan = header.querySelector('.workspace-sidebar-group-name') as HTMLElement;
		if (!nameSpan) return;

		// Add renaming class to keep buttons visible
		header.addClass('is-renaming');

		// Create input
		const input     = document.createElement('input');
		input.type      = 'text';
		input.value     = groupName;
		input.className = 'workspace-sidebar-rename-input';

		// Replace name span with input
		nameSpan.replaceWith(input);
		input.focus();
		input.select();

		let isFinishing = false;
		const finishRename = async () => {
			if (isFinishing) return;
			isFinishing = true;

			const newName = input.value.trim();
			if (newName && newName !== groupName) {
				const workspaceManager = this.plugin.getWorkspaceManager();
				const groups           = workspaceManager.getGroups();
				if (!groups.includes(newName)) {
					workspaceManager.renameGroup(groupName, newName);
					await this.plugin.saveSettings();

					// Update collapsed state for the renamed group
					if (this.collapsedGroups.has(groupName)) {
						this.collapsedGroups.delete(groupName);
						this.collapsedGroups.add(newName);
					}

					new Notice(`Renamed group to: ${newName}`);
				} else {
					new Notice(`Group "${newName}" already exists`);
				}
			}
			this.renderTree();
		};

		input.addEventListener('blur', finishRename);
		input.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter') {
				evt.preventDefault();
				input.blur();
			} else if (evt.key === 'Escape') {
				evt.preventDefault();
				isFinishing = true;
				this.renderTree();
			}
		}, true);
	}

	duplicateWorkspace(workspaceName: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Generate unique name
		let newName = `${workspaceName} (copy)`;
		let counter = 2;
		while (workspaceManager.hasWorkspace(newName)) {
			newName = `${workspaceName} (copy ${counter})`;
			counter++;
		}

		workspaceManager.duplicateWorkspace(workspaceName, newName);

		// Duplicate navigation layout if exists
		const layout = this.plugin.navigationLayouts.get(workspaceName);
		if (layout) {
			this.plugin.navigationLayouts.set(newName, JSON.parse(JSON.stringify(layout)));
		}

		this.plugin.saveSettings();
		this.plugin.refreshWorkspaceCommands();
		this.renderTree();

		new Notice(`Duplicated to: ${newName}`);
	}

	deleteWorkspace(workspaceName: string) {
		const doDelete = async () => {
			const workspaceManager = this.plugin.getWorkspaceManager();
			workspaceManager.deleteWorkspace(workspaceName);
			this.plugin.navigationLayouts.delete(workspaceName);
			await this.plugin.saveSettings();
			this.plugin.updateStatusBar();
			this.renderTree();
			new Notice(`Deleted: ${workspaceName}`);
		};

		if (this.plugin.settings.showDeleteConfirmation) {
			createConfirmationDialog(this.app, {
				title:    'Delete Workspace?',
				text:     `Are you sure you want to delete "${workspaceName}"? This cannot be undone.`,
				cta:      'Delete',
				onAccept: doDelete
			});
		} else {
			doDelete();
		}
	}

	deleteGroup(groupName: string) {
		createConfirmationDialog(this.app, {
			title:   'Delete Group?',
			text:    `Delete group "${groupName}"? Workspaces will be moved to "No Group".`,
			cta:     'Delete',
			onAccept: async () => {
				const workspaceManager = this.plugin.getWorkspaceManager();

				// Move all workspaces in this group to ungrouped
				const workspaces = workspaceManager.getWorkspacesByGroup(groupName);
				for (const ws of workspaces) {
					workspaceManager.setWorkspaceGroup(ws, null);
				}

				// Remove group from order
				const order = workspaceManager.getGroupOrder();
				const idx   = order.indexOf(groupName);
				if (idx !== -1) {
					order.splice(idx, 1);
					workspaceManager.setGroupOrder(order);
				}

				// Clear group styling
				workspaceManager.setGroupIcon(groupName, null);
				workspaceManager.setGroupIconColor(groupName, null);
				workspaceManager.setGroupColor(groupName, null);
				workspaceManager.setGroupBold(groupName, false);
				workspaceManager.setGroupItalic(groupName, false);

				await this.plugin.saveSettings();
				this.renderTree();
				new Notice(`Deleted group: ${groupName}`);
			}
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag & Drop - Workspaces
	// ─────────────────────────────────────────────────────────────────

	onWorkspaceDragStart(evt: DragEvent, workspaceName: string) {
		this.draggedItem = workspaceName;
		this.draggedType = 'workspace';
		evt.dataTransfer?.setData('text/plain', workspaceName);
		(evt.target as HTMLElement).addClass('is-dragging');
	}

	onWorkspaceDragOver(evt: DragEvent, targetWorkspace: string, targetGroup: string) {
		if (this.draggedType !== 'workspace' || this.draggedItem === targetWorkspace) return;

		evt.preventDefault();
		evt.dataTransfer!.dropEffect = 'move';

		// Show drop indicator
		const target = evt.target as HTMLElement;
		const item   = target.closest('.workspace-sidebar-item') as HTMLElement;
		if (!item) return;

		const rect   = item.getBoundingClientRect();
		const middle = rect.top + rect.height / 2;

		item.removeClass('drop-above', 'drop-below');
		if (evt.clientY < middle) {
			item.addClass('drop-above');
		} else {
			item.addClass('drop-below');
		}
	}

	onWorkspaceDrop(evt: DragEvent, targetWorkspace: string, targetGroup: string) {
		evt.preventDefault();
		if (this.draggedType !== 'workspace' || !this.draggedItem || this.draggedItem === targetWorkspace) return;

		const workspaceManager = this.plugin.getWorkspaceManager();
		const target           = evt.target as HTMLElement;
		const item             = target.closest('.workspace-sidebar-item') as HTMLElement;

		if (!item) return;

		const rect     = item.getBoundingClientRect();
		const middle   = rect.top + rect.height / 2;
		const insertBefore = evt.clientY < middle;

		// Move workspace relative to target
		const position = insertBefore ? 'before' : 'after';
		workspaceManager.moveWorkspaceRelativeTo(this.draggedItem, targetWorkspace, position);

		this.plugin.saveSettings();
		this.renderTree();
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag & Drop - Groups
	// ─────────────────────────────────────────────────────────────────

	onGroupDragStart(evt: DragEvent, groupName: string) {
		this.draggedItem = groupName;
		this.draggedType = 'group';
		evt.dataTransfer?.setData('text/plain', groupName);
		(evt.target as HTMLElement).addClass('is-dragging');
	}

	onGroupDragOver(evt: DragEvent, targetGroup: string) {
		// Allow workspace drops onto groups
		if (this.draggedType === 'workspace') {
			evt.preventDefault();
			evt.dataTransfer!.dropEffect = 'move';

			const header = (evt.target as HTMLElement).closest('.workspace-sidebar-group-header');
			if (header) {
				header.addClass('drop-target');
			}
			return;
		}

		// Group reordering
		if (this.draggedType !== 'group' || this.draggedItem === targetGroup) return;
		if (targetGroup === NO_GROUP_KEY) return; // Can't reorder with No Group

		evt.preventDefault();
		evt.dataTransfer!.dropEffect = 'move';

		const header = (evt.target as HTMLElement).closest('.workspace-sidebar-group-header') as HTMLElement;
		if (!header) return;

		const rect   = header.getBoundingClientRect();
		const middle = rect.top + rect.height / 2;

		header.removeClass('drop-above', 'drop-below');
		if (evt.clientY < middle) {
			header.addClass('drop-above');
		} else {
			header.addClass('drop-below');
		}
	}

	onGroupDrop(evt: DragEvent, targetGroup: string) {
		evt.preventDefault();

		const workspaceManager = this.plugin.getWorkspaceManager();

		// Workspace dropped onto group
		if (this.draggedType === 'workspace' && this.draggedItem) {
			const realGroup = targetGroup === NO_GROUP_KEY ? null : targetGroup;
			workspaceManager.setWorkspaceGroup(this.draggedItem, realGroup);
			this.plugin.saveSettings();
			this.renderTree();
			return;
		}

		// Group reordering
		if (this.draggedType !== 'group' || !this.draggedItem || this.draggedItem === targetGroup) return;
		if (targetGroup === NO_GROUP_KEY) return;

		const header = (evt.target as HTMLElement).closest('.workspace-sidebar-group-header') as HTMLElement;
		if (!header) return;

		const rect       = header.getBoundingClientRect();
		const middle     = rect.top + rect.height / 2;
		const insertBefore = evt.clientY < middle;

		const position = insertBefore ? 'before' : 'after';
		workspaceManager.moveGroupRelativeTo(this.draggedItem, targetGroup, position);
		this.plugin.saveSettings();
		this.renderTree();
	}

	onDragLeave(evt: DragEvent) {
		const target = evt.target as HTMLElement;
		target.removeClass('drop-above', 'drop-below', 'drop-target');

		const item = target.closest('.workspace-sidebar-item, .workspace-sidebar-group-header');
		if (item) {
			item.removeClass('drop-above', 'drop-below', 'drop-target');
		}
	}

	onDragEnd() {
		this.draggedItem = null;
		this.draggedType = null;
		this.draggedFile = null;
		this.draggedFileWorkspace = null;

		// Clean up all drag styling
		this.treeContainer.querySelectorAll('.is-dragging, .drop-above, .drop-below, .drop-target, .drop-file-target').forEach(el => {
			el.removeClass('is-dragging', 'drop-above', 'drop-below', 'drop-target', 'drop-file-target');
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag & Drop - Files
	// ─────────────────────────────────────────────────────────────────

	onFileDragStart(evt: DragEvent, filePath: string, workspaceName: string) {
		this.draggedFile = filePath;
		this.draggedFileWorkspace = workspaceName;
		evt.dataTransfer?.setData('text/plain', filePath);
		(evt.target as HTMLElement).addClass('is-dragging');
	}

	// Add drop handling to workspace items for file drops
	setupWorkspaceDropTarget(item: HTMLElement, workspaceName: string) {
		item.addEventListener('dragover', (evt) => {
			if (!this.draggedFile || this.draggedFileWorkspace === workspaceName) return;

			evt.preventDefault();
			evt.dataTransfer!.dropEffect = 'copy';
			item.addClass('drop-file-target');
		});

		item.addEventListener('dragleave', (evt) => {
			item.removeClass('drop-file-target');
		});

		item.addEventListener('drop', (evt) => {
			evt.preventDefault();
			item.removeClass('drop-file-target');

			if (!this.draggedFile || this.draggedFileWorkspace === workspaceName) return;

			const workspaceManager = this.plugin.getWorkspaceManager();
			const filePath = this.draggedFile;
			const sourceWorkspace = this.draggedFileWorkspace;
			const fileName = filePath.split('/').pop() || filePath;

			// Check if already in target workspace
			if (workspaceManager.getOpenFilesInWorkspace(workspaceName).includes(filePath)) {
				new Notice(`"${fileName}" is already in ${workspaceName}`);
				return;
			}

			// Check if holding shift for move (otherwise copy)
			const isMove = evt.shiftKey;

			if (isMove && sourceWorkspace) {
				workspaceManager.removeFileFromWorkspace(sourceWorkspace, filePath);
				new Notice(`Moved "${fileName}" to ${workspaceName}`);
			} else {
				new Notice(`Copied "${fileName}" to ${workspaceName}`);
			}

			workspaceManager.addFileToWorkspace(workspaceName, filePath);
			this.plugin.saveSettings();
			this.renderTree();
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// Public Refresh Method
	// ─────────────────────────────────────────────────────────────────

	refresh() {
		this.renderTree();
	}

	/**
	 * Update collapsed state when a workspace is renamed
	 */
	onWorkspaceRenamed(oldName: string, newName: string) {
		if (this.collapsedWorkspaces.has(oldName)) {
			this.collapsedWorkspaces.delete(oldName);
			this.collapsedWorkspaces.add(newName);
		}
		this.renderTree();
	}

	/**
	 * Update collapsed state when a group is renamed
	 */
	onGroupRenamed(oldName: string, newName: string) {
		if (this.collapsedGroups.has(oldName)) {
			this.collapsedGroups.delete(oldName);
			this.collapsedGroups.add(newName);
		}
		this.renderTree();
	}
}
