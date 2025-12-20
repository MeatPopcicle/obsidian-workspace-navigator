// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, Modal, Setting, Notice, TextComponent, setIcon } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { StylePickerModal, WorkspaceStyleResult } from './workspace-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Editor Modal
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceEditorModal extends Modal {
	plugin:           WorkspaceNavigator;
	collapsedGroups:  Set<string> = new Set();
	draggedWorkspace: string | null = null;
	draggedElement:   HTMLElement | null = null;

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
			if (!this.draggedWorkspace) return;

			// Find element under cursor
			const target = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement;

			// Remove all drag-over states first
			this.modalEl.querySelectorAll('.drag-over').forEach(e => e.removeClass('drag-over'));

			// Check if hovering over a group header
			const groupHeader = target?.closest('.workspace-editor-group-header') as HTMLElement;
			if (groupHeader) {
				groupHeader.addClass('drag-over');
			}
		};

		const onMouseUp = async (evt: MouseEvent) => {
			if (!this.draggedWorkspace) return;

			const target = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement;
			const groupHeader = target?.closest('.workspace-editor-group-header') as HTMLElement;

			if (groupHeader && groupHeader.dataset.groupName) {
				const workspaceManager = this.plugin.getWorkspaceManager();
				const groupName = groupHeader.dataset.groupName;
				const isNoGroup = groupName === '\x00nogroup';
				const targetGroup = isNoGroup ? null : groupName;
				const currentGroup = workspaceManager.getWorkspaceGroup(this.draggedWorkspace);

				// Only update if group is different
				if (currentGroup !== targetGroup) {
					workspaceManager.setWorkspaceGroup(this.draggedWorkspace, targetGroup);
					await this.plugin.saveSettings();

					const groupDisplay = targetGroup || 'No Group';
					new Notice(`Moved "${this.draggedWorkspace}" to ${groupDisplay}`);

					// Refresh the list
					this.onOpen();
				}
			}

			// Clean up drag state
			this.cleanupDrag();
		};

		// Store handlers for cleanup
		(this as any)._dragMouseMove = onMouseMove;
		(this as any)._dragMouseUp = onMouseUp;

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	}

	private cleanupDrag(): void {
		if (this.draggedElement) {
			this.draggedElement.removeClass('is-dragging');
		}
		this.draggedWorkspace = null;
		this.draggedElement = null;
		document.body.removeClass('workspace-dragging');
		this.modalEl.querySelectorAll('.drag-over').forEach(e => e.removeClass('drag-over'));
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
		const groups = workspaceManager.getGroups();
		const hasNamedGroups = groups.length > 0;

		if (hasNamedGroups) {
			// Render workspaces organized by group
			for (const group of groups) {
				this.renderGroupSection(listEl, group, activeWorkspace);
			}

			// Render ungrouped workspaces at the end
			const ungrouped = workspaceManager.getWorkspacesByGroup(null);
			if (ungrouped.length > 0) {
				this.renderGroupSection(listEl, null, activeWorkspace);
			}
		} else {
			// No groups - render flat list
			for (const name of workspaces) {
				this.renderWorkspaceItem(listEl, name, name === activeWorkspace);
			}
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Group Section
	// ─────────────────────────────────────────────────────────────────

	renderGroupSection(containerEl: HTMLElement, group: string | null, activeWorkspace: string | null) {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const groupKey = group || '\x00nogroup';
		const displayName = group || 'No Group';
		const isCollapsed = this.collapsedGroups.has(groupKey);
		const workspaces = workspaceManager.getWorkspacesByGroup(group);

		// Group header
		const header = containerEl.createDiv('workspace-editor-group-header');
		header.dataset.groupName = groupKey;

		// Collapse/expand chevron
		const chevron = header.createSpan('workspace-editor-group-chevron');
		chevron.innerHTML = isCollapsed
			? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z"/></svg>`
			: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z"/></svg>`;
		chevron.addEventListener('click', () => {
			if (isCollapsed) {
				this.collapsedGroups.delete(groupKey);
			} else {
				this.collapsedGroups.add(groupKey);
			}
			this.onOpen(); // Refresh
		});

		// Group icon if set
		const groupIcon = workspaceManager.getGroupIcon(groupKey);
		if (groupIcon) {
			const iconSpan = header.createSpan('workspace-editor-group-icon');
			setIcon(iconSpan, groupIcon);
			const iconColor = workspaceManager.getGroupIconColor(groupKey);
			if (iconColor) {
				iconSpan.style.color = iconColor;
			}
		}

		// Group name
		const nameSpan = header.createSpan('workspace-editor-group-name');
		nameSpan.textContent = displayName;
		const groupColor = workspaceManager.getGroupColor(groupKey);
		if (groupColor) {
			nameSpan.style.color = groupColor;
		}

		// Workspace count
		const countSpan = header.createSpan('workspace-editor-group-count');
		countSpan.textContent = `(${workspaces.length})`;

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
		const showStyles = this.plugin.settings.showStyleButton;
		const hasGroups  = workspaceManager.getGroups().length > 0;

		// Add drag handle if groups exist
		if (hasGroups) {
			const dragHandle = document.createElement('span');
			dragHandle.addClass('workspace-editor-drag-handle');
			setIcon(dragHandle, 'grip-vertical');
			dragHandle.setAttribute('aria-label', 'Drag to move to group');

			dragHandle.addEventListener('mousedown', (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.draggedWorkspace = name;
				this.draggedElement = setting.settingEl;
				setting.settingEl.addClass('is-dragging');
				document.body.addClass('workspace-dragging');
			});

			// Insert drag handle at the beginning of the setting
			setting.settingEl.insertBefore(dragHandle, setting.settingEl.firstChild);
		}

		// Build name with icon and styling (only if enabled)
		const nameEl = document.createDocumentFragment();

		if (showStyles) {
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
		}

		// Create name span with optional styling
		const nameSpan = document.createElement('span');
		nameSpan.textContent = name;

		if (showStyles) {
			const nameStyle = workspaceManager.getWorkspaceNameStyle(name);
			if (nameStyle.color) nameSpan.style.color = nameStyle.color;
			if (nameStyle.bold) nameSpan.style.fontWeight = 'bold';
			if (nameStyle.italic) nameSpan.style.fontStyle = 'italic';
		}
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

		// Style button (only if enabled in settings)
		if (this.plugin.settings.showStyleButton) {
			setting.addExtraButton(button => button
				.setIcon('palette')
				.setTooltip('Style workspace')
				.onClick(() => {
					this.showStyleDialog(name);
				}));
		}

		// Rename button
		setting.addExtraButton(button => button
			.setIcon('pencil')
			.setTooltip('Rename workspace')
			.onClick(() => {
				this.showRenameDialog(name);
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

		const modal = new StylePickerModal(this.app, this.plugin, name, currentStyle, async (newStyle) => {
			workspaceManager.setWorkspaceGroup(name, newStyle.group || null);
			workspaceManager.setWorkspaceIcon(name, newStyle.icon || null, newStyle.iconColor || null);
			workspaceManager.setWorkspaceNameStyle(name, {
				color:  newStyle.nameColor || null,
				bold:   newStyle.nameBold,
				italic: newStyle.nameItalic,
			});
			await this.plugin.saveSettings();

			// Update the status bar
			this.plugin.updateStatusBar();

			// Refresh the workspace list
			this.onOpen();

			new Notice(`Updated style for "${name}"`);
		});
		modal.open();
	}

	showRenameDialog(oldName: string) {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Create a simple rename modal
		const renameModal = new Modal(this.app);
		renameModal.titleEl.setText('Rename Workspace');

		let newNameInput: TextComponent;

		new Setting(renameModal.contentEl)
			.setName('New name')
			.addText(text => {
				newNameInput = text;
				text.setValue(oldName);
				text.inputEl.select();
			});

		new Setting(renameModal.contentEl)
			.addButton(button => button
				.setButtonText('Cancel')
				.onClick(() => {
					renameModal.close();
				}))
			.addButton(button => button
				.setButtonText('Rename')
				.setCta()
				.onClick(async () => {
					const newName = newNameInput.getValue().trim();

					if (!newName) {
						new Notice('Please enter a name');
						return;
					}

					if (newName === oldName) {
						renameModal.close();
						return;
					}

					if (workspaceManager.hasWorkspace(newName)) {
						new Notice(`Workspace "${newName}" already exists`);
						return;
					}

					// Perform rename
					workspaceManager.renameWorkspace(oldName, newName);

					// Rename navigation layout data
					const layout = this.plugin.navigationLayouts.get(oldName);
					if (layout) {
						this.plugin.navigationLayouts.delete(oldName);
						this.plugin.navigationLayouts.set(newName, layout);
					}

					await this.plugin.saveSettings();
					new Notice(`Renamed to: ${newName}`);

					renameModal.close();
					this.onOpen(); // Refresh list
				}));

		renameModal.open();
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
