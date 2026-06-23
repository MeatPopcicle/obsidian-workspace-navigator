// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, Modal, Setting, Notice, TextComponent, setIcon } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { WorkspaceStyleModal, WorkspaceStyleResult } from './workspace-modal';
import { renderGroupHeader, setGroupDragging, GroupHeaderConfig } from './group-header';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Editor Modal
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceEditorModal extends Modal {
	plugin:           WorkspaceNavigator;
	collapsedGroups:  Set<string> = new Set();
	draggedWorkspace: string | null = null;
	draggedGroup:     string | null = null;
	draggedElement:   HTMLElement | null = null;
	dragGhost:        HTMLElement | null = null;

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.addClass('workspace-editor-modal');

		// Set modal width directly on the element
		modalEl.style.width = '700px';
		modalEl.style.maxWidth = '90vw';

		// Title
		contentEl.createEl('h2', { text: 'Manage Workspaces' });

		// Add new workspace section
		this.renderNewWorkspaceSection(contentEl);

		// Separator
		contentEl.createEl('hr');

		// Workspace list
		this.renderWorkspaceList(contentEl);

		// Set up drag handlers
		this.setupDragHandlers();
	}

	onClose() {
		const { contentEl } = this;
		this.cleanupDrag();
		// Remove event listeners
		if ((this as any)._dragMouseMove) {
			document.removeEventListener('mousemove', (this as any)._dragMouseMove);
		}
		if ((this as any)._dragMouseUp) {
			document.removeEventListener('mouseup', (this as any)._dragMouseUp);
		}
		contentEl.empty();
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag-and-drop handlers
	// ─────────────────────────────────────────────────────────────────

	private setupDragHandlers(): void {
		const onMouseMove = (evt: MouseEvent) => {
			if (!this.draggedWorkspace && !this.draggedGroup) return;

			// Move ghost to follow cursor
			if (this.dragGhost) {
				this.dragGhost.style.left = `${evt.clientX + 10}px`;
				this.dragGhost.style.top = `${evt.clientY - 10}px`;
			}

			// Hide ghost temporarily to find element underneath
			if (this.dragGhost) {
				this.dragGhost.style.pointerEvents = 'none';
			}
			const target = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement;
			if (this.dragGhost) {
				this.dragGhost.style.pointerEvents = '';
			}

			// Remove all drag states first
			this.modalEl.querySelectorAll('.drag-over, .drop-target-above, .drop-target-below').forEach(e => {
				e.removeClass('drag-over', 'drop-target-above', 'drop-target-below');
			});

			// If dragging a group, only show indicators on other group headers
			if (this.draggedGroup) {
				const groupHeader = target?.closest('.workspace-editor-group-header') as HTMLElement;
				if (groupHeader && groupHeader !== this.draggedElement) {
					const rect = groupHeader.getBoundingClientRect();
					const midY = rect.top + rect.height / 2;
					const insertBefore = evt.clientY < midY;

					if (insertBefore) {
						groupHeader.addClass('drop-target-above');
					} else {
						groupHeader.addClass('drop-target-below');
					}

					(this as any)._dropTarget = {
						group: groupHeader.dataset.groupName,
						insertBefore: insertBefore
					};
				} else {
					(this as any)._dropTarget = null;
				}
				return;
			}

			// Check if hovering over a workspace setting item
			const settingItem = target?.closest('.setting-item') as HTMLElement;
			const groupHeader = target?.closest('.workspace-editor-group-header') as HTMLElement;

			if (settingItem && settingItem !== this.draggedElement) {
				// Show drop indicator
				const rect = settingItem.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				const insertBefore = evt.clientY < midY;

				if (insertBefore) {
					settingItem.addClass('drop-target-above');
				} else {
					settingItem.addClass('drop-target-below');
				}

				// Get workspace name from the setting
				const nameSpan = settingItem.querySelector('.setting-item-name span:last-child') as HTMLElement;
				const workspaceName = nameSpan?.textContent?.replace(' ✓', '').trim();
				if (workspaceName) {
					(this as any)._dropTarget = {
						workspace: workspaceName,
						insertBefore: insertBefore
					};
				}
			} else if (groupHeader) {
				groupHeader.addClass('drag-over');
				(this as any)._dropTarget = null;
			} else {
				(this as any)._dropTarget = null;
			}
		};

		const onMouseUp = async (evt: MouseEvent) => {
			const workspaceManager = this.plugin.getWorkspaceManager();
			const useManualOrder = this.plugin.settings.manualSortOrder;
			let moved = false;

			// Handle group dragging
			if (this.draggedGroup) {
				const dropTarget = (this as any)._dropTarget;
				if (dropTarget?.group && useManualOrder && dropTarget.group !== this.draggedGroup) {
					const position = dropTarget.insertBefore ? 'before' : 'after';
					workspaceManager.moveGroupRelativeTo(this.draggedGroup, dropTarget.group, position);
					await this.plugin.saveSettings();
					moved = true;
				}

				if (moved) {
					this.onOpen();
				}

				this.cleanupDrag();
				return;
			}

			// Handle workspace dragging
			if (!this.draggedWorkspace) {
				this.cleanupDrag();
				return;
			}

			// Check if we have a drop target (dropping near a workspace)
			const dropTarget = (this as any)._dropTarget;
			if (dropTarget?.workspace) {
				const targetGroup = workspaceManager.getWorkspaceGroup(dropTarget.workspace);
				const currentGroup = workspaceManager.getWorkspaceGroup(this.draggedWorkspace);

				if (currentGroup !== targetGroup) {
					// Moving between groups
					const position = dropTarget.insertBefore ? 'before' : 'after';
					if (useManualOrder) {
						workspaceManager.moveWorkspaceRelativeTo(this.draggedWorkspace, dropTarget.workspace, position);
					} else {
						workspaceManager.setWorkspaceGroup(this.draggedWorkspace, targetGroup);
					}
					await this.plugin.saveSettings();

					const groupDisplay = targetGroup || 'No Group';
					new Notice(`Moved "${this.draggedWorkspace}" to ${groupDisplay}`);
					moved = true;
				} else if (useManualOrder && this.draggedWorkspace !== dropTarget.workspace) {
					// Reordering within the same group
					const position = dropTarget.insertBefore ? 'before' : 'after';
					workspaceManager.moveWorkspaceRelativeTo(this.draggedWorkspace, dropTarget.workspace, position);
					await this.plugin.saveSettings();
					moved = true;
				}
			} else {
				// Check if dropped on a group header
				if (this.dragGhost) {
					this.dragGhost.style.pointerEvents = 'none';
				}
				const target = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement;
				if (this.dragGhost) {
					this.dragGhost.style.pointerEvents = '';
				}

				const groupHeader = target?.closest('.workspace-editor-group-header') as HTMLElement;
				if (groupHeader && groupHeader.dataset.groupName) {
					const groupName = groupHeader.dataset.groupName;
					const isNoGroup = groupName === '\x00nogroup';
					const targetGroup = isNoGroup ? null : groupName;
					const currentGroup = workspaceManager.getWorkspaceGroup(this.draggedWorkspace);

					if (currentGroup !== targetGroup) {
						workspaceManager.setWorkspaceGroup(this.draggedWorkspace, targetGroup);
						await this.plugin.saveSettings();

						const groupDisplay = targetGroup || 'No Group';
						new Notice(`Moved "${this.draggedWorkspace}" to ${groupDisplay}`);
						moved = true;
					}
				}
			}

			// Refresh if moved
			if (moved) {
				this.onOpen();
			}

			// Clean up drag state
			this.cleanupDrag();
		};

		// onOpen() doubles as the list-refresh path and is re-invoked many times
		// over the modal's life. Remove any previously-registered global handlers
		// before adding new ones, or each refresh leaks another document-level
		// mousemove/mouseup pair (onClose would only ever remove the last).
		if ((this as any)._dragMouseMove) {
			document.removeEventListener('mousemove', (this as any)._dragMouseMove);
		}
		if ((this as any)._dragMouseUp) {
			document.removeEventListener('mouseup', (this as any)._dragMouseUp);
		}

		// Store handlers for cleanup
		(this as any)._dragMouseMove = onMouseMove;
		(this as any)._dragMouseUp = onMouseUp;

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	private createDragGhost(workspaceName: string): void {
		this.dragGhost = document.createElement('div');
		this.dragGhost.addClass('workspace-drag-ghost');

		// Add grip handle icon
		const handleSpan = document.createElement('span');
		handleSpan.addClass('workspace-drag-ghost-handle');
		setIcon(handleSpan, 'grip-vertical');
		this.dragGhost.appendChild(handleSpan);

		// Add workspace name
		const nameSpan = document.createElement('span');
		nameSpan.textContent = workspaceName;
		this.dragGhost.appendChild(nameSpan);

		document.body.appendChild(this.dragGhost);
	}

	private cleanupDrag(): void {
		if (this.draggedElement) {
			this.draggedElement.removeClass('is-dragging');
		}
		if (this.dragGhost) {
			this.dragGhost.remove();
			this.dragGhost = null;
		}
		this.draggedWorkspace = null;
		this.draggedGroup = null;
		this.draggedElement = null;
		(this as any)._dropTarget = null;
		document.body.removeClass('workspace-dragging');
		this.modalEl.querySelectorAll('.drag-over, .drop-target-above, .drop-target-below').forEach(e => {
			e.removeClass('drag-over', 'drop-target-above', 'drop-target-below');
		});
	}

	// ─────────────────────────────────────────────────────────────────
	// New Workspace Section
	// ─────────────────────────────────────────────────────────────────

	renderNewWorkspaceSection(containerEl: HTMLElement) {
		const workspaceManager = this.plugin.getWorkspaceManager();

		let newNameInput: TextComponent;

		new Setting(containerEl)
			.setName('Save current layout as new workspace')
			.setDesc('Enter a name for the new workspace')
			.addText(text => {
				newNameInput = text;
				text.setPlaceholder('New workspace name');
			})
			.addButton(button => button
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					const name = newNameInput.getValue().trim();

					if (!name) {
						new Notice('Please enter a workspace name');
						return;
					}

					if (workspaceManager.hasWorkspace(name)) {
						new Notice(`Workspace "${name}" already exists`);
						return;
					}

					// Save current layout as new workspace
					const saveFolderState = this.plugin.settings.rememberNavigationLayout;
					await workspaceManager.saveWorkspace(name, saveFolderState);
					await this.plugin.saveSettings();

					// Register command for the new workspace
					this.plugin.refreshWorkspaceCommands();

					new Notice(`Created workspace: ${name}`);
					newNameInput.setValue('');

					// Refresh the list
					this.onOpen();
				}));
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace List
	// ─────────────────────────────────────────────────────────────────

	renderWorkspaceList(containerEl: HTMLElement) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const workspaces       = workspaceManager.getWorkspaceNames();
		const activeWorkspace  = workspaceManager.getActiveWorkspace();

		if (workspaces.length === 0) {
			containerEl.createEl('p', {
				text: 'No workspaces yet. Save your current layout as a new workspace above.',
				cls:  'workspace-editor-empty'
			});
			return;
		}

		const listEl = containerEl.createDiv('workspace-editor-list');

		// Get groups and check if we should show grouping
		const useManualOrder = this.plugin.settings.manualSortOrder;
		const groups = workspaceManager.getGroupsOrdered(useManualOrder);
		const hasNamedGroups = groups.length > 0;

		if (hasNamedGroups) {
			// Render workspaces organized by group
			for (const group of groups) {
				this.renderGroupSection(listEl, group, activeWorkspace);
			}

			// Render ungrouped workspaces at the end
			const ungrouped = workspaceManager.getWorkspacesByGroupOrdered(null, useManualOrder);
			if (ungrouped.length > 0) {
				this.renderGroupSection(listEl, null, activeWorkspace);
			}
		} else {
			// No groups - render flat list with manual order support
			const orderedWorkspaces = workspaceManager.getWorkspacesByGroupOrdered(null, useManualOrder);
			for (const name of orderedWorkspaces) {
				this.renderWorkspaceItem(listEl, name, name === activeWorkspace);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Group Section
	// ─────────────────────────────────────────────────────────────────

	renderGroupSection(containerEl: HTMLElement, group: string | null, activeWorkspace: string | null) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const groupKey     = group || '\x00nogroup';
		const displayName  = group || 'No Group';
		const isCollapsed  = this.collapsedGroups.has(groupKey);
		const useManualOrder = this.plugin.settings.manualSortOrder;
		const workspaces   = workspaceManager.getWorkspacesByGroupOrdered(group, useManualOrder);

		// Group header - use shared utility with inline styles
		const header = containerEl.createDiv('workspace-editor-group-header');

		const config: GroupHeaderConfig = {
			groupName:        groupKey,
			isCollapsed,
			useManualOrder,
			workspaceManager,
			onToggleCollapse: (gn) => {
				if (this.collapsedGroups.has(gn)) {
					this.collapsedGroups.delete(gn);
				} else {
					this.collapsedGroups.add(gn);
				}
				this.onOpen();
			},
			onEditClick:   () => {}, // Not used in editor modal
			onRenameClick: () => {}, // Not used in editor modal
			onDeleteClick: () => {}, // Not used in editor modal
			onDragStart:   (evt, gn, c) => {
				this.draggedGroup   = group;
				this.draggedElement = header;
				setGroupDragging(header, true);
				document.body.addClass('workspace-dragging');
				this.createDragGhost(displayName);
				if (this.dragGhost) {
					this.dragGhost.style.left = `${evt.clientX + 10}px`;
					this.dragGhost.style.top  = `${evt.clientY - 10}px`;
				}
			},
		};

		renderGroupHeader(header, config);

		// Render workspaces if not collapsed
		if (!isCollapsed) {
			for (const name of workspaces) {
				this.renderWorkspaceItem(containerEl, name, name === activeWorkspace);
			}
		}
	}

	renderWorkspaceItem(containerEl: HTMLElement, name: string, isActive: boolean) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const setting    = new Setting(containerEl);
		const hasGroups  = workspaceManager.getGroups().length > 0;

		// Add drag handle if groups exist or manual sort is enabled
		const useManualOrder = this.plugin.settings.manualSortOrder;
		if (hasGroups || useManualOrder) {
			const dragHandle = document.createElement('span');
			dragHandle.addClass('workspace-editor-drag-handle');
			setIcon(dragHandle, 'grip-vertical');
			dragHandle.setAttribute('aria-label', 'Drag to reorder or move to group');

			dragHandle.addEventListener('mousedown', (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.draggedWorkspace = name;
				this.draggedElement = setting.settingEl;
				setting.settingEl.addClass('is-dragging');
				document.body.addClass('workspace-dragging');
				this.createDragGhost(name);
				// Position ghost at cursor
				if (this.dragGhost) {
					this.dragGhost.style.left = `${evt.clientX + 10}px`;
					this.dragGhost.style.top = `${evt.clientY - 10}px`;
				}
			});

			// Insert drag handle at the beginning of the setting
			setting.settingEl.insertBefore(dragHandle, setting.settingEl.firstChild);
		}

		// Build name with icon and styling
		const nameEl = document.createDocumentFragment();

		const icon      = workspaceManager.getWorkspaceIcon(name);
		const iconColor = workspaceManager.getWorkspaceIconColor(name);

		const iconSpan = document.createElement('span');
		iconSpan.className = 'workspace-editor-icon';
		if (icon) {
			setIcon(iconSpan, icon);
			if (iconColor) {
				iconSpan.style.color = iconColor;
			}
		} else {
			// Default icon for workspaces without a custom icon
			setIcon(iconSpan, 'layout-grid');
			iconSpan.style.opacity = '0.4';
		}
		nameEl.appendChild(iconSpan);
		nameEl.appendChild(document.createTextNode(' '));

		// Create name span with styling
		const nameSpan = document.createElement('span');
		nameSpan.textContent = name;

		const nameStyle = workspaceManager.getWorkspaceNameStyle(name);
		if (nameStyle.color) nameSpan.style.color = nameStyle.color;
		if (nameStyle.bold) nameSpan.style.fontWeight = 'bold';
		if (nameStyle.italic) nameSpan.style.fontStyle = 'italic';

		nameEl.appendChild(nameSpan);

		if (isActive) {
			nameEl.appendChild(document.createTextNode(' ✓'));
		}

		// Name with active indicator
		setting.nameEl.empty();
		setting.nameEl.appendChild(nameEl);
		if (isActive) {
			setting.setDesc('Currently active');
		}

		// Load button
		setting.addExtraButton(button => button
			.setIcon('log-in')
			.setTooltip('Load workspace')
			.onClick(async () => {
				await this.plugin.loadWorkspace(name);
				new Notice(`Loaded workspace: ${name}`);
				this.close();
			}));

		// Edit button (pencil - opens full editor modal)
		setting.addExtraButton(button => button
			.setIcon('pencil')
			.setTooltip('Edit workspace')
			.onClick(() => {
				this.showStyleDialog(name);
			}));

		// Clone button
		setting.addExtraButton(button => button
			.setIcon('copy')
			.setTooltip('Clone workspace')
			.onClick(async () => {
				await this.cloneWorkspace(name);
			}));

		// Delete button
		setting.addExtraButton(button => button
			.setIcon('trash')
			.setTooltip('Delete workspace')
			.onClick(() => {
				this.deleteWorkspace(name);
			}));
	}

	// ─────────────────────────────────────────────────────────────────
	// Workspace Operations
	// ─────────────────────────────────────────────────────────────────

	showStyleDialog(name: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const currentGroup = workspaceManager.getWorkspaceGroup(name) || '';
		const currentIcon  = workspaceManager.getWorkspaceIcon(name) || '';
		const currentColor = workspaceManager.getWorkspaceIconColor(name) || '';
		const nameStyle    = workspaceManager.getWorkspaceNameStyle(name);

		const currentStyle: WorkspaceStyleResult = {
			group:      currentGroup,
			icon:       currentIcon,
			iconColor:  currentColor,
			nameColor:  nameStyle.color || '',
			nameBold:   nameStyle.bold || false,
			nameItalic: nameStyle.italic || false,
		};

		const modal = new WorkspaceStyleModal(this.app, this.plugin, name, currentStyle, async (newStyle: WorkspaceStyleResult) => {
			let finalName = name;

			// Handle rename if name changed
			if (newStyle.newName && newStyle.newName !== name) {
				if (workspaceManager.hasWorkspace(newStyle.newName)) {
					new Notice(`Workspace "${newStyle.newName}" already exists`);
					return;
				}
				workspaceManager.renameWorkspace(name, newStyle.newName);

				// Migrate navigation layout data
				const layout = this.plugin.navigationLayouts.get(name);
				if (layout) {
					this.plugin.navigationLayouts.delete(name);
					this.plugin.navigationLayouts.set(newStyle.newName, layout);
				}
				finalName = newStyle.newName;
			}

			// Apply styles to finalName
			workspaceManager.setWorkspaceGroup(finalName, newStyle.group || null);
			workspaceManager.setWorkspaceIcon(finalName, newStyle.icon || null, newStyle.iconColor || null);
			workspaceManager.setWorkspaceNameStyle(finalName, {
				color:  newStyle.nameColor || null,
				bold:   newStyle.nameBold,
				italic: newStyle.nameItalic,
			});
			await this.plugin.saveSettings();

			// Update the status bar
			this.plugin.updateStatusBar();

			// Refresh the workspace list and sidebar
			this.onOpen();
			this.plugin.refreshSidebarView();

			new Notice(`Updated "${finalName}"`);
		});
		modal.open();
	}

	async cloneWorkspace(sourceName: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Generate unique name
		let newName = `${sourceName} (copy)`;
		let counter = 2;
		while (workspaceManager.hasWorkspace(newName)) {
			newName = `${sourceName} (copy ${counter})`;
			counter++;
		}

		// Duplicate workspace
		workspaceManager.duplicateWorkspace(sourceName, newName);

		// Duplicate navigation layout if exists
		const layout = this.plugin.navigationLayouts.get(sourceName);
		if (layout) {
			this.plugin.navigationLayouts.set(newName, JSON.parse(JSON.stringify(layout)));
		}

		await this.plugin.saveSettings();
		new Notice(`Cloned to: ${newName}`);

		// Refresh list
		this.onOpen();
	}

	deleteWorkspace(name: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();

		const doDelete = async () => {
			workspaceManager.deleteWorkspace(name);
			this.plugin.navigationLayouts.delete(name);
			await this.plugin.saveSettings();

			new Notice(`Deleted workspace: ${name}`);
			this.onOpen(); // Refresh list
		};

		if (this.plugin.settings.showDeleteConfirmation) {
			createConfirmationDialog(this.app, {
				title:    'Delete Workspace',
				text:     `Are you sure you want to delete "${name}"?`,
				cta:      'Delete',
				onAccept: doDelete
			});
		} else {
			doDelete();
		}
	}
}
