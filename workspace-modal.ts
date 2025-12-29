// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice, Scope, Modal, Setting, setIcon } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { createPopper, Instance as PopperInstance } from '@popperjs/core';
import { renderGroupHeader, setGroupDropTarget, setGroupDragging, GroupHeaderConfig } from './group-header';

// ───────────────────────────────────────────────────────────────────────────────
// Lucide Icons (same icon set used by Obsidian)
// ───────────────────────────────────────────────────────────────────────────────

// Common Lucide icons - these are SVG-based and rendered via setIcon()
const LUCIDE_ICONS: string[] = [
	// Layouts & UI
	'layout-grid', 'layout-template', 'layout-dashboard', 'layout-list',
	'panels-top-left', 'panel-left', 'panel-right', 'columns',
	'grid-2x2', 'grid-3x3', 'square', 'squares',

	// Files & Folders
	'folder', 'folder-open', 'file', 'file-text',
	'files', 'folder-tree', 'archive', 'package',

	// Objects
	'home', 'building', 'building-2', 'briefcase',
	'book', 'book-open', 'bookmark', 'library',
	'notebook', 'clipboard', 'calendar', 'inbox',

	// Tools & Actions
	'settings', 'wrench', 'hammer', 'pencil',
	'brush', 'palette', 'scissors', 'eraser',
	'search', 'filter', 'sliders', 'toggles',

	// Development
	'code', 'code-2', 'terminal', 'terminal-square',
	'braces', 'brackets', 'git-branch', 'git-merge',
	'database', 'server', 'cpu', 'hard-drive',

	// Symbols
	'star', 'heart', 'flag', 'bookmark',
	'tag', 'hash', 'at-sign', 'circle',
	'triangle', 'hexagon', 'octagon', 'diamond',

	// Nature & Objects
	'sun', 'moon', 'cloud', 'zap',
	'flame', 'droplet', 'leaf', 'tree',
	'mountain', 'globe', 'compass', 'map',

	// Communication
	'mail', 'message-square', 'message-circle', 'phone',
	'send', 'share', 'link', 'paperclip',

	// Media
	'image', 'camera', 'video', 'music',
	'play', 'headphones', 'mic', 'radio',

	// People & Social
	'user', 'users', 'user-circle', 'contact',
	'smile', 'crown', 'award', 'trophy',

	// Misc
	'lightbulb', 'rocket', 'target', 'crosshair',
	'shield', 'lock', 'key', 'eye',
	'clock', 'timer', 'hourglass', 'activity',
];

// ───────────────────────────────────────────────────────────────────────────────
// Preset Colors
// ───────────────────────────────────────────────────────────────────────────────

const PRESET_COLORS = [
	{ color: '#ef4444', name: 'red' },
	{ color: '#f97316', name: 'orange' },
	{ color: '#eab308', name: 'yellow' },
	{ color: '#22c55e', name: 'green' },
	{ color: '#14b8a6', name: 'teal' },
	{ color: '#3b82f6', name: 'blue' },
	{ color: '#8b5cf6', name: 'purple' },
	{ color: '#ec4899', name: 'pink' },
	{ color: '#6b7280', name: 'gray' },
	{ color: '#ffffff', name: 'white' },
];

// ───────────────────────────────────────────────────────────────────────────────
// Style Result Interface
// ───────────────────────────────────────────────────────────────────────────────

export interface WorkspaceStyleResult {
	group:      string;  // Group name for categorization
	icon:       string;  // Lucide icon name (e.g., 'folder', 'star')
	iconColor:  string;
	nameColor:  string;
	nameBold:   boolean;
	nameItalic: boolean;
	newName?:   string;  // Optional: new name if workspace was renamed
}

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Style Modal (single workspace editor)
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceStyleModal extends Modal {
	plugin:        WorkspaceNavigator;
	workspaceName: string;
	currentStyle:  WorkspaceStyleResult;
	onSubmit:      (style: WorkspaceStyleResult) => void;

	constructor(app: App, plugin: WorkspaceNavigator, workspaceName: string, currentStyle: WorkspaceStyleResult, onSubmit: (style: WorkspaceStyleResult) => void) {
		super(app);
		this.plugin        = plugin;
		this.workspaceName = workspaceName;
		this.currentStyle  = currentStyle;
		this.onSubmit      = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('workspace-style-picker');

		contentEl.createEl('h3', { text: 'Edit Workspace' });

		// State
		let renameValue     = this.workspaceName;
		let groupValue      = this.currentStyle.group;
		let iconValue       = this.currentStyle.icon;
		let iconColorValue  = this.currentStyle.iconColor;
		let nameColorValue  = this.currentStyle.nameColor;
		let nameBoldValue   = this.currentStyle.nameBold;
		let nameItalicValue = this.currentStyle.nameItalic;

		const workspaceManager = this.plugin.getWorkspaceManager();
		const existingGroups   = workspaceManager.getGroups();

		// Preview update function (defined early, elements created later)
		let iconPreview: HTMLElement;
		let namePreview: HTMLElement;
		const updatePreview = () => {
			if (!iconPreview || !namePreview) return;
			iconPreview.empty();
			if (iconValue) {
				setIcon(iconPreview, iconValue);
				iconPreview.style.color = iconColorValue || '';
			}
			namePreview.textContent = renameValue || this.workspaceName;
			namePreview.style.color      = nameColorValue || '';
			namePreview.style.fontWeight = nameBoldValue ? 'bold' : '';
			namePreview.style.fontStyle  = nameItalicValue ? 'italic' : '';
		};

		// ─────────────────────────────────────────────────────────────
		// Preview (at top)
		// ─────────────────────────────────────────────────────────────
		const previewContainer = contentEl.createDiv('workspace-style-preview-container');
		iconPreview = previewContainer.createSpan('workspace-style-preview-icon');
		namePreview = previewContainer.createSpan('workspace-style-preview-name');

		// Initialize preview
		if (iconValue) {
			setIcon(iconPreview, iconValue);
			if (iconColorValue) iconPreview.style.color = iconColorValue;
		}
		namePreview.textContent = renameValue;
		if (nameColorValue) namePreview.style.color = nameColorValue;
		if (nameBoldValue) namePreview.style.fontWeight = 'bold';
		if (nameItalicValue) namePreview.style.fontStyle = 'italic';

		// ─────────────────────────────────────────────────────────────
		// General Card (Name & Group)
		// ─────────────────────────────────────────────────────────────
		const generalCard = contentEl.createDiv('workspace-style-card');
		generalCard.createDiv({ cls: 'workspace-style-card-label', text: 'General' });

		new Setting(generalCard)
			.setName('Name')
			.addText(text => {
				text.setValue(this.workspaceName);
				text.onChange(value => {
					renameValue = value.trim();
					updatePreview();
				});
			});

		new Setting(generalCard)
			.setName('Group')
			.addDropdown(dropdown => {
				dropdown.addOption('', '(None)');
				for (const group of existingGroups) {
					dropdown.addOption(group, group);
				}
				dropdown.setValue(groupValue || '');
				dropdown.onChange(value => {
					groupValue = value;
				});
			})
			.addText(text => {
				text.setPlaceholder('or new...');
				text.onChange(value => {
					if (value.trim()) {
						groupValue = value.trim();
					}
				});
			});

		// ─────────────────────────────────────────────────────────────
		// Icon Card
		// ─────────────────────────────────────────────────────────────
		const iconCard = contentEl.createDiv('workspace-style-card');
		iconCard.createDiv({ cls: 'workspace-style-card-label', text: 'Icon' });

		const grid = iconCard.createDiv('workspace-icon-grid');

		// No icon button
		const noIconBtn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
		noIconBtn.textContent = '✕';
		noIconBtn.setAttribute('aria-label', 'No icon');
		if (!iconValue) noIconBtn.addClass('is-selected');
		noIconBtn.addEventListener('click', () => {
			grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			noIconBtn.addClass('is-selected');
			iconValue = '';
			updatePreview();
		});

		for (const iconName of LUCIDE_ICONS) {
			const btn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
			setIcon(btn, iconName);
			btn.setAttribute('aria-label', iconName);
			if (iconName === iconValue) btn.addClass('is-selected');
			btn.addEventListener('click', () => {
				grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				btn.addClass('is-selected');
				iconValue = iconName;
				updatePreview();
			});
		}

		// Icon Color
		new Setting(iconCard)
			.setName('Color')
			.then(setting => {
				const swatches = setting.controlEl.createDiv('workspace-color-swatches');
				for (const { color, name } of PRESET_COLORS) {
					const swatch = swatches.createEl('button', { cls: 'workspace-color-swatch' });
					swatch.style.backgroundColor = color;
					swatch.setAttribute('aria-label', name);
					if (color === iconColorValue) swatch.addClass('is-selected');
					swatch.addEventListener('click', () => {
						swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
						swatch.addClass('is-selected');
						iconColorValue = color;
						updatePreview();
					});
				}
				const noColor = swatches.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
				noColor.textContent = '✕';
				noColor.setAttribute('aria-label', 'No color');
				if (!iconColorValue) noColor.addClass('is-selected');
				noColor.addEventListener('click', () => {
					swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
					noColor.addClass('is-selected');
					iconColorValue = '';
					updatePreview();
				});
			});

		// ─────────────────────────────────────────────────────────────
		// Name Style Card
		// ─────────────────────────────────────────────────────────────
		const nameCard = contentEl.createDiv('workspace-style-card');
		nameCard.createDiv({ cls: 'workspace-style-card-label', text: 'Name Style' });

		new Setting(nameCard)
			.setName('Color')
			.then(setting => {
				const swatches = setting.controlEl.createDiv('workspace-color-swatches');
				for (const { color, name } of PRESET_COLORS) {
					const swatch = swatches.createEl('button', { cls: 'workspace-color-swatch' });
					swatch.style.backgroundColor = color;
					swatch.setAttribute('aria-label', name);
					if (color === nameColorValue) swatch.addClass('is-selected');
					swatch.addEventListener('click', () => {
						swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
						swatch.addClass('is-selected');
						nameColorValue = color;
						updatePreview();
					});
				}
				const noColor = swatches.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
				noColor.textContent = '✕';
				noColor.setAttribute('aria-label', 'No color');
				if (!nameColorValue) noColor.addClass('is-selected');
				noColor.addEventListener('click', () => {
					swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
					noColor.addClass('is-selected');
					nameColorValue = '';
					updatePreview();
				});
			});

		new Setting(nameCard)
			.setName('Format')
			.addToggle(toggle => toggle
				.setValue(nameBoldValue)
				.setTooltip('Bold')
				.onChange(value => {
					nameBoldValue = value;
					updatePreview();
				}))
			.addToggle(toggle => toggle
				.setValue(nameItalicValue)
				.setTooltip('Italic')
				.onChange(value => {
					nameItalicValue = value;
					updatePreview();
				}))
			.then(setting => {
				// Add labels after toggles
				const controls = setting.controlEl;
				const toggles = controls.querySelectorAll('.checkbox-container');
				if (toggles[0]) {
					const label = document.createElement('span');
					label.textContent = 'B';
					label.style.fontWeight = 'bold';
					label.style.marginRight = '12px';
					toggles[0].after(label);
				}
				if (toggles[1]) {
					const label = document.createElement('span');
					label.textContent = 'I';
					label.style.fontStyle = 'italic';
					toggles[1].after(label);
				}
			});

		// ─────────────────────────────────────────────────────────────
		// Action buttons
		// ─────────────────────────────────────────────────────────────
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Clear All')
				.onClick(() => {
					this.onSubmit({
						group: '', icon: '', iconColor: '', nameColor: '',
						nameBold: false, nameItalic: false
					});
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					this.onSubmit({
						group:      groupValue,
						icon:       iconValue,
						iconColor:  iconColorValue,
						nameColor:  nameColorValue,
						nameBold:   nameBoldValue,
						nameItalic: nameItalicValue,
						newName:    renameValue !== this.workspaceName ? renameValue : undefined
					});
					this.close();
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Group Style Picker Modal (Option A layout - matches WorkspaceStyleModal)
// ───────────────────────────────────────────────────────────────────────────────

export interface GroupStyleResult {
	newName?:   string | null;
	icon:       string | null;
	iconColor:  string | null;
	textColor:  string | null;
	textBold:   boolean;
	textItalic: boolean;
}

export class GroupStylePickerModal extends Modal {
	plugin:    WorkspaceNavigator;
	groupName: string;
	onSubmit:  (result: GroupStyleResult) => void;

	constructor(app: App, plugin: WorkspaceNavigator, groupName: string, onSubmit: (result: GroupStyleResult) => void) {
		super(app);
		this.plugin    = plugin;
		this.groupName = groupName;
		this.onSubmit  = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('workspace-style-picker');

		const isNoGroup   = this.groupName === '\x00nogroup';
		const displayName = isNoGroup ? 'No Group' : this.groupName;
		contentEl.createEl('h3', { text: isNoGroup ? 'Edit Ungrouped Style' : 'Edit Group' });

		const workspaceManager = this.plugin.getWorkspaceManager();

		// State
		let renameValue     = isNoGroup ? '' : this.groupName;
		let iconValue       = workspaceManager.getGroupIcon(this.groupName) || '';
		let iconColorValue  = workspaceManager.getGroupIconColor(this.groupName) || '';
		let textColorValue  = workspaceManager.getGroupColor(this.groupName) || '';
		let textBoldValue   = workspaceManager.getGroupBold(this.groupName) || false;
		let textItalicValue = workspaceManager.getGroupItalic(this.groupName) || false;

		// Preview update function (defined early, elements created later)
		let iconPreview: HTMLElement;
		let namePreview: HTMLElement;
		const updatePreview = () => {
			if (!iconPreview || !namePreview) return;
			iconPreview.empty();
			if (iconValue) {
				setIcon(iconPreview, iconValue);
				iconPreview.style.color = iconColorValue || '';
			}
			namePreview.textContent = renameValue || displayName;
			namePreview.style.color      = textColorValue || '';
			namePreview.style.fontWeight = textBoldValue ? 'bold' : '';
			namePreview.style.fontStyle  = textItalicValue ? 'italic' : '';
		};

		// ─────────────────────────────────────────────────────────────
		// Preview (at top)
		// ─────────────────────────────────────────────────────────────
		const previewContainer = contentEl.createDiv('workspace-style-preview-container');
		iconPreview = previewContainer.createSpan('workspace-style-preview-icon');
		namePreview = previewContainer.createSpan('workspace-style-preview-name');

		// Initialize preview
		if (iconValue) {
			setIcon(iconPreview, iconValue);
			if (iconColorValue) iconPreview.style.color = iconColorValue;
		}
		namePreview.textContent = renameValue || displayName;
		if (textColorValue) namePreview.style.color = textColorValue;
		if (textBoldValue) namePreview.style.fontWeight = 'bold';
		if (textItalicValue) namePreview.style.fontStyle = 'italic';

		// ─────────────────────────────────────────────────────────────
		// General Card (Name)
		// ─────────────────────────────────────────────────────────────
		const generalCard = contentEl.createDiv('workspace-style-card');
		generalCard.createDiv({ cls: 'workspace-style-card-label', text: 'General' });

		new Setting(generalCard)
			.setName('Name')
			.addText(text => {
				text.setValue(isNoGroup ? '' : this.groupName);
				text.setPlaceholder(isNoGroup ? 'Enter group name...' : '');
				text.onChange(value => {
					renameValue = value.trim();
					updatePreview();
				});
			});

		// ─────────────────────────────────────────────────────────────
		// Icon Card
		// ─────────────────────────────────────────────────────────────
		const iconCard = contentEl.createDiv('workspace-style-card');
		iconCard.createDiv({ cls: 'workspace-style-card-label', text: 'Icon' });

		const grid = iconCard.createDiv('workspace-icon-grid');

		// No icon button
		const noIconBtn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
		noIconBtn.textContent = '✕';
		noIconBtn.setAttribute('aria-label', 'No icon');
		if (!iconValue) noIconBtn.addClass('is-selected');
		noIconBtn.addEventListener('click', () => {
			grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			noIconBtn.addClass('is-selected');
			iconValue = '';
			updatePreview();
		});

		for (const iconName of LUCIDE_ICONS) {
			const btn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
			setIcon(btn, iconName);
			btn.setAttribute('aria-label', iconName);
			if (iconName === iconValue) btn.addClass('is-selected');
			btn.addEventListener('click', () => {
				grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				btn.addClass('is-selected');
				iconValue = iconName;
				updatePreview();
			});
		}

		// Icon Color
		new Setting(iconCard)
			.setName('Color')
			.then(setting => {
				const swatches = setting.controlEl.createDiv('workspace-color-swatches');
				for (const { color, name } of PRESET_COLORS) {
					const swatch = swatches.createEl('button', { cls: 'workspace-color-swatch' });
					swatch.style.backgroundColor = color;
					swatch.setAttribute('aria-label', name);
					if (color === iconColorValue) swatch.addClass('is-selected');
					swatch.addEventListener('click', () => {
						swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
						swatch.addClass('is-selected');
						iconColorValue = color;
						updatePreview();
					});
				}
				const noColor = swatches.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
				noColor.textContent = '✕';
				noColor.setAttribute('aria-label', 'No color');
				if (!iconColorValue) noColor.addClass('is-selected');
				noColor.addEventListener('click', () => {
					swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
					noColor.addClass('is-selected');
					iconColorValue = '';
					updatePreview();
				});
			});

		// ─────────────────────────────────────────────────────────────
		// Name Style Card
		// ─────────────────────────────────────────────────────────────
		const nameCard = contentEl.createDiv('workspace-style-card');
		nameCard.createDiv({ cls: 'workspace-style-card-label', text: 'Name Style' });

		new Setting(nameCard)
			.setName('Color')
			.then(setting => {
				const swatches = setting.controlEl.createDiv('workspace-color-swatches');
				for (const { color, name } of PRESET_COLORS) {
					const swatch = swatches.createEl('button', { cls: 'workspace-color-swatch' });
					swatch.style.backgroundColor = color;
					swatch.setAttribute('aria-label', name);
					if (color === textColorValue) swatch.addClass('is-selected');
					swatch.addEventListener('click', () => {
						swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
						swatch.addClass('is-selected');
						textColorValue = color;
						updatePreview();
					});
				}
				const noColor = swatches.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
				noColor.textContent = '✕';
				noColor.setAttribute('aria-label', 'No color');
				if (!textColorValue) noColor.addClass('is-selected');
				noColor.addEventListener('click', () => {
					swatches.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
					noColor.addClass('is-selected');
					textColorValue = '';
					updatePreview();
				});
			});

		new Setting(nameCard)
			.setName('Format')
			.addToggle(toggle => toggle
				.setValue(textBoldValue)
				.setTooltip('Bold')
				.onChange(value => {
					textBoldValue = value;
					updatePreview();
				}))
			.addToggle(toggle => toggle
				.setValue(textItalicValue)
				.setTooltip('Italic')
				.onChange(value => {
					textItalicValue = value;
					updatePreview();
				}))
			.then(setting => {
				// Add labels after toggles
				const controls = setting.controlEl;
				const toggles = controls.querySelectorAll('.checkbox-container');
				if (toggles[0]) {
					const label = document.createElement('span');
					label.textContent = 'B';
					label.style.fontWeight = 'bold';
					label.style.marginRight = '12px';
					toggles[0].after(label);
				}
				if (toggles[1]) {
					const label = document.createElement('span');
					label.textContent = 'I';
					label.style.fontStyle = 'italic';
					toggles[1].after(label);
				}
			});

		// ─────────────────────────────────────────────────────────────
		// Action buttons
		// ─────────────────────────────────────────────────────────────
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Clear All')
				.onClick(() => {
					this.onSubmit({
						newName:    null,
						icon:       null,
						iconColor:  null,
						textColor:  null,
						textBold:   false,
						textItalic: false,
					});
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					const isNoGroup = this.groupName === '\x00nogroup';
					// For "No Group", if user enters a name, that becomes newName
					// For named groups, newName is set only if changed
					const hasNewName = isNoGroup
						? (renameValue && renameValue.length > 0)
						: (renameValue !== this.groupName);

					this.onSubmit({
						newName:    hasNewName ? renameValue : null,
						icon:       iconValue || null,
						iconColor:  iconColorValue || null,
						textColor:  textColorValue || null,
						textBold:   textBoldValue,
						textItalic: textItalicValue,
					});
					this.close();
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Picker Modal (for "Send note to workspace" feature)
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspacePickerModal extends FuzzySuggestModal<string> {
	plugin:    WorkspaceNavigator;
	filePath:  string;
	follow:    boolean;
	onSelect:  (workspaceName: string) => void;

	constructor(
		app: App,
		plugin: WorkspaceNavigator,
		filePath: string,
		follow: boolean,
		onSelect: (workspaceName: string) => void
	) {
		super(app);
		this.plugin   = plugin;
		this.filePath = filePath;
		this.follow   = follow;
		this.onSelect = onSelect;

		const fileName = filePath.split('/').pop() || 'file';
		const action = follow ? 'Send & switch' : 'Send';
		this.setPlaceholder(`${action}: "${fileName}" to workspace...`);
	}

	getItems(): string[] {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const activeWorkspace = workspaceManager.getActiveWorkspace();

		// Return all workspaces except the current one
		return workspaceManager.getWorkspaceNames().filter(name => name !== activeWorkspace);
	}

	getItemText(workspace: string): string {
		return workspace;
	}

	renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const workspaceName = item.item;

		el.addClass('workspace-picker-item');

		// Check if this workspace already has the file open
		const openFiles = workspaceManager.getOpenFilesInWorkspace(workspaceName);
		const alreadyHasFile = openFiles.includes(this.filePath);

		if (alreadyHasFile) {
			el.addClass('workspace-picker-disabled');
		}

		// Add icon if workspace has custom icon
		const icon = workspaceManager.getWorkspaceIcon(workspaceName);
		if (icon) {
			const iconSpan = el.createSpan('workspace-picker-icon');
			setIcon(iconSpan, icon);
			const iconColor = workspaceManager.getWorkspaceIconColor(workspaceName);
			if (iconColor) iconSpan.style.color = iconColor;
		}

		// Workspace name
		const nameSpan = el.createSpan('workspace-picker-name');
		nameSpan.textContent = workspaceName;

		// Apply name styling
		const nameStyle = workspaceManager.getWorkspaceNameStyle(workspaceName);
		if (nameStyle.color) nameSpan.style.color = nameStyle.color;
		if (nameStyle.bold) nameSpan.style.fontWeight = 'bold';
		if (nameStyle.italic) nameSpan.style.fontStyle = 'italic';

		// Show indicator if file is already in this workspace (use layers icon like tab indicators)
		if (alreadyHasFile) {
			const indicator = el.createSpan('workspace-picker-has-file');
			setIcon(indicator, 'layers');
			indicator.setAttribute('aria-label', 'File already open in this workspace');
		}

		// Show group if applicable
		const group = workspaceManager.getWorkspaceGroup(workspaceName);
		if (group) {
			const groupSpan = el.createSpan('workspace-picker-group');
			groupSpan.textContent = group;
		}
	}

	onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): void {
		// Check if file is already open in this workspace
		const workspaceManager = this.plugin.getWorkspaceManager();
		const openFiles = workspaceManager.getOpenFilesInWorkspace(workspace);
		if (openFiles.includes(this.filePath)) {
			new Notice(`File is already open in "${workspace}"`);
			return;
		}

		this.onSelect(workspace);
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin:             WorkspaceNavigator;
	workspaces:         string[];
	popper:             PopperInstance | null = null;
	private lastRenderedGroup: string | null | undefined = undefined;
	private draggedWorkspace: string | null = null;
	private draggedGroup:     string | null = null;
	private draggedElement:   HTMLElement | null = null;
	private dragGhost:        HTMLElement | null = null;
	private isRenaming:       boolean = false;  // Flag to prevent selection during rename

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;

		// Add class for transparent modal if enabled in settings
		this.modalEl.addClass('workspace-switcher-modal');
		if (plugin.settings.transparentModal) {
			this.modalEl.addClass('workspace-switcher-modal-transparent');
		}

		this.setPlaceholder('Type workspace name...');

		// Add instructions if enabled
		if (plugin.settings.showInstructions) {
			this.setInstructions([
				{ command: '↵', purpose: 'switch' },
				{ command: 'shift ↵', purpose: 'save & switch' },
				{ command: 'alt ↵', purpose: 'save & switch' },
				{ command: 'ctrl ↵', purpose: 'rename' },
				{ command: 'ctrl d', purpose: 'duplicate' },
				{ command: 'shift ⌫', purpose: 'delete' },
				{ command: 'esc', purpose: 'cancel' }
			]);
		}

		// ═══════════════════════════════════════════════════════════════
		// Replace scope with custom one - just like original plugin
		// ═══════════════════════════════════════════════════════════════
		this.scope = new Scope();
		this.setupScope();
	}

	setupScope(): void {
		// Escape to close modal
		this.scope.register([], 'Escape', (evt: KeyboardEvent) => {
			this.close();
			return false;
		});

		// Arrow keys for navigation
		this.scope.register([], 'ArrowDown', (evt: KeyboardEvent) => {
			(this as any).chooser.setSelectedItem((this as any).chooser.selectedItem + 1, evt);
			return false;
		});

		this.scope.register([], 'ArrowUp', (evt: KeyboardEvent) => {
			(this as any).chooser.setSelectedItem((this as any).chooser.selectedItem - 1, evt);
			return false;
		});

		// Register Enter to handle both rename and workspace switching
		this.scope.register([], 'Enter', (evt: KeyboardEvent) => {
			return this.useSelectedItem(evt);
		});

		// Ctrl+Enter for rename
		this.scope.register(['Ctrl'], 'Enter', (evt: KeyboardEvent) => {
			evt.preventDefault();
			this.onRenameClick(evt);
			return false;
		});

		// Ctrl+D for duplicate
		this.scope.register(['Ctrl'], 'd', (evt: KeyboardEvent) => {
			evt.preventDefault();
			this.duplicateWorkspace();
			return false;
		});

		// Shift+Delete for delete
		this.scope.register(['Shift'], 'Delete', (evt: KeyboardEvent) => {
			evt.preventDefault();
			this.deleteWorkspace();
			return false;
		});

		// Shift+Enter for save & switch
		this.scope.register(['Shift'], 'Enter', (evt: KeyboardEvent) => {
			return this.useSelectedItem(evt);
		});

		// Alt+Enter for save & switch
		this.scope.register(['Alt'], 'Enter', (evt: KeyboardEvent) => {
			return this.useSelectedItem(evt);
		});
	}

	useSelectedItem(evt: KeyboardEvent): boolean {
		const targetEl = (evt as any).composedPath ? (evt as any).composedPath()[0] as HTMLElement : evt.target as HTMLElement;

		// If we're editing a contentEditable element, handle rename
		if (targetEl && targetEl.contentEditable === 'true') {
			// Check if this is a group header rename (just blur to trigger save)
			if (targetEl.closest('.workspace-group-header')) {
				evt.preventDefault();
				targetEl.blur();
				return false;
			}
			// Otherwise it's a workspace rename
			this.handleRename(targetEl);
			return false;
		}

		// Otherwise, proceed with normal item selection
		const selectedItem = (this as any).chooser.selectedItem;
		const values = (this as any).chooser.values;

		if (selectedItem >= 0 && selectedItem < values.length) {
			const item = values[selectedItem];
			this.selectSuggestion(item, evt);
			return false;
		}

		return false;
	}

	open(): void {
		// Push custom scope - just like original plugin
		(this.app as any).keymap.pushScope(this.scope);
		super.open();
	}

	// Override selectSuggestion to prevent selection during rename mode or right-click
	selectSuggestion(value: FuzzyMatch<string>, evt: MouseEvent | KeyboardEvent): void {
		// Check if this is a right-click - never select on right-click
		if (evt instanceof MouseEvent && evt.button === 2) {
			return;
		}

		// Check if any item is in rename mode
		const renamingItem = this.modalEl.querySelector('.workspace-suggestion-item.is-renaming');
		if (renamingItem) {
			// Don't select - we're in rename mode
			return;
		}

		// Check if a group header is in rename mode
		const renamingGroup = this.modalEl.querySelector('.workspace-group-header.is-renaming');
		if (renamingGroup) {
			return;
		}

		// Proceed with normal selection
		super.selectSuggestion(value, evt);
	}

	onOpen(): void {
		super.onOpen();

		// Reset group tracking for headers
		this.lastRenderedGroup = undefined;

		// Hide search box if disabled in settings
		if (!this.plugin.settings.showSearchBox) {
			const inputEl = (this as any).inputEl as HTMLInputElement;
			if (inputEl?.parentElement) {
				inputEl.parentElement.style.display = 'none';
			}
		}

		// Position modal above status bar using Popper
		const statusBar = document.body.querySelector('.workspace-navigator-status');
		if (statusBar) {
			this.popper = createPopper(statusBar as HTMLElement, this.modalEl, {
				placement: 'top-start',
				modifiers: [{ name: 'offset', options: { offset: [0, 10] } }]
			});
		}

		// Add action buttons footer
		this.createActionButtons();

		// Set up global mouse handlers for drag-and-drop
		this.setupDragHandlers();
	}

	// ─────────────────────────────────────────────────────────────────
	// Action buttons (top-right and bottom-right)
	// ─────────────────────────────────────────────────────────────────

	private topActionsEl: HTMLElement | null = null;
	private bottomActionsEl: HTMLElement | null = null;

	private createActionButtons(): void {
		// Remove existing if present
		if (this.topActionsEl) this.topActionsEl.remove();
		if (this.bottomActionsEl) this.bottomActionsEl.remove();

		// Get the suggestion container to position relative to it
		const resultsContainer = this.modalEl.querySelector('.prompt-results');
		if (!resultsContainer) return;

		// ─────────────────────────────────────────────────────────────
		// Top-right: Expand/Collapse All
		// ─────────────────────────────────────────────────────────────
		const topActions = document.createElement('div');
		topActions.className = 'workspace-actions-top';

		const expandCollapseBtn = document.createElement('button');
		expandCollapseBtn.className = 'workspace-action-btn btn-expand-collapse';
		this.updateExpandCollapseButton(expandCollapseBtn);
		expandCollapseBtn.addEventListener('click', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.toggleAllGroups(expandCollapseBtn);
		});
		topActions.appendChild(expandCollapseBtn);

		resultsContainer.insertBefore(topActions, resultsContainer.firstChild);
		this.topActionsEl = topActions;

		// ─────────────────────────────────────────────────────────────
		// Bottom-right: + Group, + Workspace
		// ─────────────────────────────────────────────────────────────
		const bottomActions = document.createElement('div');
		bottomActions.className = 'workspace-actions-bottom';

		// + Group button
		const addGroupBtn = document.createElement('button');
		addGroupBtn.className = 'workspace-action-btn btn-add-group';
		const groupIcon = document.createElement('span');
		setIcon(groupIcon, 'folder-plus');
		addGroupBtn.appendChild(groupIcon);
		addGroupBtn.appendChild(document.createTextNode('Group'));
		addGroupBtn.setAttribute('aria-label', 'Create a new group');
		addGroupBtn.addEventListener('click', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.openNewGroupModal();
		});
		bottomActions.appendChild(addGroupBtn);

		// + Workspace button
		const addWorkspaceBtn = document.createElement('button');
		addWorkspaceBtn.className = 'workspace-action-btn btn-add-workspace';
		const workspaceIcon = document.createElement('span');
		setIcon(workspaceIcon, 'file-plus');
		addWorkspaceBtn.appendChild(workspaceIcon);
		addWorkspaceBtn.appendChild(document.createTextNode('Workspace'));
		addWorkspaceBtn.setAttribute('aria-label', 'Save current layout as new workspace');
		addWorkspaceBtn.addEventListener('click', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			this.openNewWorkspaceModal();
		});
		bottomActions.appendChild(addWorkspaceBtn);

		resultsContainer.appendChild(bottomActions);
		this.bottomActionsEl = bottomActions;
	}

	private updateExpandCollapseButton(btn: HTMLElement): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const allGroups = workspaceManager.getAllGroupsOrdered(this.plugin.settings.manualSortOrder);

		// Check if any group is collapsed
		const anyCollapsed = allGroups.some(g => workspaceManager.isGroupCollapsed(g));

		// Clear and rebuild button content (icon only)
		btn.empty();

		if (anyCollapsed) {
			setIcon(btn, 'chevrons-up');
			btn.setAttribute('aria-label', 'Expand all groups');
		} else {
			setIcon(btn, 'chevrons-down');
			btn.setAttribute('aria-label', 'Collapse all groups');
		}
	}

	private toggleAllGroups(btn: HTMLElement): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const allGroups = workspaceManager.getAllGroupsOrdered(this.plugin.settings.manualSortOrder);

		// Check if any group is collapsed
		const anyCollapsed = allGroups.some(g => workspaceManager.isGroupCollapsed(g));

		// If any collapsed, expand all; otherwise collapse all
		const newState = !anyCollapsed;
		for (const group of allGroups) {
			workspaceManager.setGroupCollapsed(group, newState);
		}

		// Save and refresh
		this.plugin.saveSettings();
		this.lastRenderedGroup = undefined;
		(this as any).updateSuggestions();

		// Re-add action buttons (updateSuggestions clears the container)
		this.createActionButtons();
	}

	private openNewGroupModal(): void {
		// Use GroupStylePickerModal with empty name - user fills it in
		const modal = new GroupStylePickerModal(this.app, this.plugin, '', async (result) => {
			if (!result.newName || !result.newName.trim()) {
				new Notice('Group name is required');
				return;
			}

			const trimmedName = result.newName.trim();
			const workspaceManager = this.plugin.getWorkspaceManager();

			// Check if group already exists
			if (workspaceManager.getGroups().includes(trimmedName)) {
				new Notice(`Group "${trimmedName}" already exists`);
				return;
			}

			// Create group with styling
			if (result.icon) workspaceManager.setGroupIcon(trimmedName, result.icon);
			if (result.iconColor) workspaceManager.setGroupIconColor(trimmedName, result.iconColor);
			if (result.textColor) workspaceManager.setGroupColor(trimmedName, result.textColor);
			if (result.textBold) workspaceManager.setGroupBold(trimmedName, true);
			if (result.textItalic) workspaceManager.setGroupItalic(trimmedName, true);

			await this.plugin.saveSettings();
			new Notice(`Created group "${trimmedName}"`);

			// Refresh
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();
		});
		modal.open();
	}

	private openNewWorkspaceModal(): void {
		// Use WorkspaceStyleModal with empty name - user fills it in
		const modal = new WorkspaceStyleModal(
			this.app,
			this.plugin,
			'',  // Empty name for new workspace
			{
				group: this.plugin.settings.defaultGroup || '',
				icon: '',
				iconColor: '',
				nameColor: '',
				nameBold: false,
				nameItalic: false,
			},
			async (result) => {
				const newName = result.newName?.trim();
				if (!newName) {
					new Notice('Workspace name is required');
					return;
				}

				const workspaceManager = this.plugin.getWorkspaceManager();

				// Check if workspace already exists
				if (workspaceManager.hasWorkspace(newName)) {
					new Notice(`Workspace "${newName}" already exists`);
					return;
				}

				// Save current layout as new workspace
				await workspaceManager.saveWorkspace(newName, this.plugin.settings.rememberNavigationLayout);

				// Apply styling
				if (result.group) workspaceManager.setWorkspaceGroup(newName, result.group);
				if (result.icon) workspaceManager.setWorkspaceIcon(newName, result.icon, result.iconColor);
				if (result.nameColor || result.nameBold || result.nameItalic) {
					workspaceManager.setWorkspaceNameStyle(newName, {
						color: result.nameColor || undefined,
						bold: result.nameBold,
						italic: result.nameItalic,
					});
				}

				await this.plugin.saveSettings();
				new Notice(`Created workspace "${newName}"`);

				// Refresh
				this.lastRenderedGroup = undefined;
				(this as any).updateSuggestions();
			}
		);
		modal.open();
	}

	// ─────────────────────────────────────────────────────────────────
	// Drag-and-drop handlers
	// ─────────────────────────────────────────────────────────────────

	private setupDragHandlers(): void {
		const onMouseMove = (evt: MouseEvent) => {
			if (!this.dragGhost) return;
			if (!this.draggedWorkspace && !this.draggedGroup) return;

			// Move ghost to follow cursor
			this.dragGhost.style.left = `${evt.clientX + 10}px`;
			this.dragGhost.style.top = `${evt.clientY - 10}px`;

			// Find element underneath (ghost already has pointerEvents: 'none')
			const target = document.elementFromPoint(evt.clientX, evt.clientY) as HTMLElement;

			// Remove previous drop-target styling (inline styles for theme-proofing)
			this.modalEl.querySelectorAll('.workspace-group-header, .workspace-suggestion-item').forEach(e => {
				(e as HTMLElement).style.boxShadow = '';
			});
			this.modalEl.querySelectorAll('.drag-over').forEach(e => {
				e.removeClass('drag-over');
			});

			// If dragging a group, only show indicators on other group headers
			if (this.draggedGroup) {
				const groupHeader = target?.closest('.workspace-group-header') as HTMLElement;
				if (groupHeader && groupHeader !== this.draggedElement) {
					const rect = groupHeader.getBoundingClientRect();
					const midY = rect.top + rect.height / 2;
					const insertBefore = evt.clientY < midY;

					// Use inline styles for drop indicator (theme-proof)
					if (insertBefore) {
						groupHeader.style.boxShadow = 'inset 0 2px 0 0 var(--interactive-accent)';
					} else {
						groupHeader.style.boxShadow = 'inset 0 -2px 0 0 var(--interactive-accent)';
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

			// Dragging a workspace
			const workspaceItem = target?.closest('.workspace-suggestion-item') as HTMLElement;
			const groupHeader = target?.closest('.workspace-group-header') as HTMLElement;

			if (workspaceItem && workspaceItem !== this.draggedElement) {
				// Show drop indicator as inline style (theme-proof)
				const rect = workspaceItem.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				const insertBefore = evt.clientY < midY;

				if (insertBefore) {
					workspaceItem.style.boxShadow = 'inset 0 2px 0 0 var(--interactive-accent)';
				} else {
					workspaceItem.style.boxShadow = 'inset 0 -2px 0 0 var(--interactive-accent)';
				}

				// Store drop target info
				(this as any)._dropTarget = {
					workspace: workspaceItem.dataset.workspaceName,
					insertBefore: insertBefore
				};
			} else if (groupHeader) {
				// Highlight group header
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
					this.lastRenderedGroup = undefined;
					(this as any).updateSuggestions();
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
				// Get the group of the target workspace
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

				const groupHeader = target?.closest('.workspace-group-header') as HTMLElement;
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
				this.lastRenderedGroup = undefined;
				(this as any).updateSuggestions();
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

	private createDragGhost(el: HTMLElement, workspaceName: string): void {
		this.dragGhost = document.createElement('div');
		this.dragGhost.addClass('workspace-drag-ghost');

		// Inline structural styles (theme-proof)
		this.dragGhost.style.position      = 'fixed';
		this.dragGhost.style.zIndex        = '10000';
		this.dragGhost.style.display       = 'flex';
		this.dragGhost.style.alignItems    = 'center';
		this.dragGhost.style.gap           = '6px';
		this.dragGhost.style.padding       = '6px 12px';
		this.dragGhost.style.background    = 'var(--background-primary)';
		this.dragGhost.style.border        = '1px solid var(--interactive-accent)';
		this.dragGhost.style.borderRadius  = '4px';
		this.dragGhost.style.boxShadow     = '0 4px 12px rgba(0, 0, 0, 0.3)';
		this.dragGhost.style.fontSize      = 'var(--font-ui-small)';
		this.dragGhost.style.pointerEvents = 'none';
		this.dragGhost.style.whiteSpace    = 'nowrap';

		// Add workspace name only (no handle needed)
		const nameSpan = document.createElement('span');
		nameSpan.textContent = workspaceName;
		this.dragGhost.appendChild(nameSpan);

		document.body.appendChild(this.dragGhost);
	}

	private cleanupDrag(): void {
		if (this.draggedElement) {
			this.draggedElement.removeClass('is-dragging');
			this.draggedElement.style.opacity = '';  // Clear group dragging opacity
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
		// Clear both CSS classes and inline styles
		this.modalEl.querySelectorAll('.drag-over').forEach(e => {
			e.removeClass('drag-over');
		});
		this.modalEl.querySelectorAll('.workspace-group-header, .workspace-suggestion-item').forEach(e => {
			(e as HTMLElement).style.boxShadow = '';
		});
	}

	private startWorkspaceDrag(evt: MouseEvent, workspaceName: string, el: HTMLElement): void {
		this.draggedWorkspace = workspaceName;
		this.draggedElement   = el;
		el.addClass('is-dragging');
		document.body.addClass('workspace-dragging');
		this.createDragGhost(el, workspaceName);
		this.dragGhost!.style.left = `${evt.clientX + 10}px`;
		this.dragGhost!.style.top  = `${evt.clientY - 10}px`;
	}

	onClose(): void {
		// Pop custom scope
		(this.app as any).keymap.popScope(this.scope);

		// Cleanup drag handlers
		if ((this as any)._dragMouseMove) {
			document.removeEventListener('mousemove', (this as any)._dragMouseMove);
		}
		if ((this as any)._dragMouseUp) {
			document.removeEventListener('mouseup', (this as any)._dragMouseUp);
		}
		this.cleanupDrag();

		// Cleanup popper instance
		if (this.popper) {
			this.popper.destroy();
			this.popper = null;
		}
		super.onClose();
	}

	// ─────────────────────────────────────────────────────────────────
	// Get list of workspaces (sorted by group, then alphabetically)
	// ─────────────────────────────────────────────────────────────────

	getItems(): string[] {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const useManualOrder   = this.plugin.settings.manualSortOrder;
		const allGroups        = workspaceManager.getAllGroupsOrdered(useManualOrder);
		const hasNamedGroups   = workspaceManager.getGroups().length > 0;
		const result: string[] = [];

		// Add workspaces by group (including '\x00nogroup' for ungrouped)
		for (const group of allGroups) {
			const isNoGroup = group === '\x00nogroup';

			// Only show "No Group" header if there are named groups
			if (isNoGroup && !hasNamedGroups) {
				// No named groups, just add ungrouped workspaces without header
				const workspaces = workspaceManager.getWorkspacesByGroupOrdered(null, useManualOrder);
				result.push(...workspaces);
				continue;
			}

			if (workspaceManager.isGroupCollapsed(group)) {
				// Add a placeholder for collapsed group (will render header only)
				result.push(`\x00collapsed:${group}`);
			} else {
				// For '\x00nogroup', get ungrouped workspaces (null group)
				const actualGroup = isNoGroup ? null : group;
				const workspaces = workspaceManager.getWorkspacesByGroupOrdered(actualGroup, useManualOrder);
				result.push(...workspaces);
			}
		}

		return result;
	}

	/**
	 * Check if an item is a collapsed group placeholder
	 */
	private isCollapsedGroupPlaceholder(item: string): string | null {
		if (item.startsWith('\x00collapsed:')) {
			return item.substring('\x00collapsed:'.length);
		}
		return null;
	}

	/**
	 * Get the group for a workspace (used for rendering headers)
	 */
	private getWorkspaceGroup(name: string): string | null {
		return this.plugin.getWorkspaceManager().getWorkspaceGroup(name);
	}

	// ─────────────────────────────────────────────────────────────────
	// Get display text for workspace
	// ─────────────────────────────────────────────────────────────────

	getItemText(workspace: string): string {
		// For collapsed group placeholders, return the group name for search
		const collapsedGroup = this.isCollapsedGroupPlaceholder(workspace);
		if (collapsedGroup) {
			return collapsedGroup === '\x00nogroup' ? 'No Group' : collapsedGroup;
		}
		return workspace;
	}

	// ─────────────────────────────────────────────────────────────────
	// Render suggestion with rename button
	// ─────────────────────────────────────────────────────────────────

	renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Check if this is a collapsed group placeholder
		const collapsedGroup = this.isCollapsedGroupPlaceholder(item.item);
		if (collapsedGroup) {
			// Render collapsed group header only (no workspace item)
			this.lastRenderedGroup = collapsedGroup === '\x00nogroup' ? null : collapsedGroup;
			el.empty();
			el.addClass('workspace-group-header', 'is-collapsed');
			this.renderGroupHeaderElement(el, collapsedGroup, true);
			return;
		}

		// Normal workspace item
		super.renderSuggestion(item, el);

		const workspaceName = item.item;

		// Check if we need to add a group header
		const currentGroup = workspaceManager.getWorkspaceGroup(workspaceName);
		const hasNamedGroups = workspaceManager.getGroups().length > 0;

		if (currentGroup !== this.lastRenderedGroup) {
			this.lastRenderedGroup = currentGroup;

			// Only show "No Group" header if there are named groups
			const shouldShowHeader = currentGroup !== null || hasNamedGroups;

			if (shouldShowHeader) {
				const header = document.createElement('div');
				header.addClass('workspace-group-header');

				// Use '\x00nogroup' as internal key for "No Group"
				const groupKey = currentGroup || '\x00nogroup';
				this.renderGroupHeaderElement(header, groupKey, false);

				el.parentElement?.insertBefore(header, el);
			}
		}

		// Add data attribute for rename functionality
		el.dataset.workspaceName = workspaceName;
		el.addClass('workspace-suggestion-item');

		// Right-click triggers quick inline rename
		// Intercept mousedown for right-click to prevent FuzzySuggestModal from handling it
		el.addEventListener('mousedown', (evt) => {
			if (evt.button === 2) {  // Right-click
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation();
			}
		}, true);  // Capture phase

		el.addEventListener('contextmenu', (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
			this.onRenameClick(evt, el);
		}, true);  // Capture phase

		// Prevent selection when in rename mode (all mouse events)
		const preventSelectionInRenameMode = (evt: MouseEvent) => {
			if (el.hasClass('is-renaming')) {
				evt.preventDefault();
				evt.stopPropagation();
				evt.stopImmediatePropagation();
			}
		};
		el.addEventListener('mousedown', preventSelectionInRenameMode, true);
		el.addEventListener('mouseup', preventSelectionInRenameMode, true);
		el.addEventListener('click', preventSelectionInRenameMode, true);

		// ─────────────────────────────────────────────────────────────────
		// Inline structural styles (theme-proof)
		// ─────────────────────────────────────────────────────────────────
		el.style.position   = 'relative';
		el.style.padding    = '5px 75px 5px 38px';  // Right padding for 2 buttons (edit + delete)
		el.style.minHeight  = '28px';
		el.style.display    = 'flex';
		el.style.alignItems = 'center';

		// Apply card styling to all workspaces when groups exist (including "No Group")
		if (hasNamedGroups) {
			el.addClass('in-group');
			el.style.backgroundColor = 'var(--background-secondary)';
			el.style.borderLeft      = '1px solid var(--background-modifier-border)';
			el.style.borderRight     = '1px solid var(--background-modifier-border)';
			el.style.borderRadius    = '0';
			el.style.margin          = '0';

			// Check if this is the last workspace in the group (for card bottom styling)
			const useManualOrder  = this.plugin.settings.manualSortOrder;
			const groupWorkspaces = workspaceManager.getWorkspacesByGroupOrdered(currentGroup, useManualOrder);
			const isLastInGroup   = groupWorkspaces[groupWorkspaces.length - 1] === workspaceName;
			if (isLastInGroup) {
				el.addClass('in-group-last');
				el.style.borderBottom  = '1px solid var(--background-modifier-border)';
				el.style.borderRadius  = '0 0 6px 6px';
				el.style.marginBottom  = '4px';
			}
		}

		// Wrap the text content in a span for rename functionality
		const textContent = el.textContent || '';
		el.empty();

		// Add drag handle for moving workspace between groups (only show if groups exist)
		const hasGroups = workspaceManager.getGroups().length > 0;

		if (hasGroups) {
			const dragHandle = el.createDiv('workspace-drag-handle');
			dragHandle.setAttribute('aria-label', 'Drag to move to group');
			// Inline structural styles (hidden but positioned for potential use)
			dragHandle.style.display        = 'none';  // Hidden - drag from row instead
			dragHandle.style.position       = 'absolute';
			dragHandle.style.left           = '5px';
			dragHandle.style.top            = '50%';
			dragHandle.style.transform      = 'translateY(-50%)';
			dragHandle.style.alignItems     = 'center';
			dragHandle.style.justifyContent = 'center';
			dragHandle.style.width          = '20px';
			dragHandle.style.height         = '20px';
			setIcon(dragHandle, 'grip-vertical');

			dragHandle.addEventListener('mousedown', (evt) => {
				evt.preventDefault();
				evt.stopPropagation();
				this.startWorkspaceDrag(evt, workspaceName, el);
			});
		}

		// Also allow dragging from entire row when groups exist
		if (hasNamedGroups) {
			el.addEventListener('mousedown', (evt) => {
				// Only start drag on left click, not on buttons
				if (evt.button !== 0) return;
				const target = evt.target as HTMLElement;
				if (target.closest('button') || target.closest('.workspace-action-btn')) return;

				evt.preventDefault();
				this.startWorkspaceDrag(evt, workspaceName, el);
			});
		}

		// Add workspace icon column (with custom icon or default)
		const icon      = workspaceManager.getWorkspaceIcon(workspaceName);
		const iconColor = workspaceManager.getWorkspaceIconColor(workspaceName);

		const iconSpan = el.createSpan('workspace-icon-column');
		// Inline structural styles (theme-proof, fixed px)
		iconSpan.style.display        = 'inline-flex';
		iconSpan.style.alignItems     = 'center';
		iconSpan.style.justifyContent = 'center';
		iconSpan.style.width          = '24px';
		iconSpan.style.marginRight    = '6px';  // Match group header flex gap
		iconSpan.style.verticalAlign  = 'middle';

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

		// Theme-proof icon SVG size
		const svg = iconSpan.querySelector('svg');
		if (svg) {
			(svg as SVGElement).style.width  = '16px';
			(svg as SVGElement).style.height = '16px';
		}

		const textSpan = el.createSpan('workspace-name-text');
		textSpan.textContent = textContent;
		// Inline structural style (theme-proof)
		textSpan.style.display = 'inline-block';

		// Apply name styling
		const nameStyle = workspaceManager.getWorkspaceNameStyle(workspaceName);
		if (nameStyle.color) textSpan.style.color = nameStyle.color;
		if (nameStyle.bold) textSpan.style.fontWeight = 'bold';
		if (nameStyle.italic) textSpan.style.fontStyle = 'italic';

		// Add active workspace indicator (left border accent via CSS class)
		const activeWorkspace = workspaceManager.getActiveWorkspace();
		if (activeWorkspace && workspaceName === activeWorkspace) {
			el.addClass('is-active');
		}

		// Create delete button
		const deleteBtn = el.createDiv('workspace-delete-btn');
		deleteBtn.setAttribute('aria-label', 'Delete workspace');
		// Inline structural styles (theme-proof, fixed px)
		deleteBtn.style.position  = 'absolute';
		deleteBtn.style.top       = '50%';
		deleteBtn.style.transform = 'translateY(-50%)';
		deleteBtn.style.right     = '11px';
		deleteBtn.style.padding   = '2px';
		deleteBtn.style.cursor    = 'pointer';
		deleteBtn.style.fill      = 'var(--text-muted)';
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;
		deleteBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.deleteWorkspace(workspaceName);
		});
		deleteBtn.addEventListener('mouseenter', () => { deleteBtn.style.fill = 'var(--text-error)'; });
		deleteBtn.addEventListener('mouseleave', () => { deleteBtn.style.fill = 'var(--text-muted)'; });

		// Note: Duplicate button removed from UI but duplicateWorkspace() method still available
		// Can be re-enabled by uncommenting this block:
		// const duplicateBtn = el.createDiv('workspace-duplicate-btn');
		// duplicateBtn.setAttribute('aria-label', 'Duplicate workspace');
		// duplicateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 6V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3c0 .552-.45 1-1.007 1H4.007A1.001 1.001 0 0 1 3 21l.003-14c0-.552.45-1 1.007-1H7zM5.003 8L5 20h10V8H5.003zM9 6h8v10h2V4H9v2z"/></svg>`;
		// duplicateBtn.addEventListener('click', (evt) => {
		// 	evt.stopPropagation();
		// 	this.duplicateWorkspace(workspaceName);
		// });

		// Create edit button (pencil - opens editor modal)
		const editBtn = el.createDiv('workspace-rename-btn');
		editBtn.setAttribute('aria-label', 'Edit workspace');
		// Inline structural styles (theme-proof, fixed px)
		editBtn.style.position  = 'absolute';
		editBtn.style.top       = '50%';
		editBtn.style.transform = 'translateY(-50%)';
		editBtn.style.right     = '32px';
		editBtn.style.padding   = '2px';
		editBtn.style.cursor    = 'pointer';
		editBtn.style.fill      = 'var(--text-muted)';
		editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
		editBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onIconClick(workspaceName);
		});
		editBtn.addEventListener('mouseenter', () => { editBtn.style.fill = 'var(--text-accent-hover)'; });
		editBtn.addEventListener('mouseleave', () => { editBtn.style.fill = 'var(--text-muted)'; });
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle rename click
	// ─────────────────────────────────────────────────────────────────

	onRenameClick(evt: MouseEvent | KeyboardEvent, el?: HTMLElement): void {
		if (!el) {
			const selectedItem = (this as any).chooser.selectedItem;
			const suggestions = (this as any).chooser.suggestions;
			if (selectedItem >= 0 && selectedItem < suggestions.length) {
				el = suggestions[selectedItem];
			}
		}

		if (!el) return;
		evt.stopPropagation();

		const textSpan = el.querySelector('.workspace-name-text') as HTMLElement;
		if (!textSpan) return;

		// If already in rename mode, save the rename (don't cancel)
		if (textSpan.contentEditable === 'true') {
			// Save rename and exit rename mode
			this.handleRename(textSpan);
			return;
		}

		// Enter rename mode
		el.addClass('is-renaming');
		textSpan.contentEditable = 'true';

		// Select all text
		const selection = window.getSelection();
		const range = document.createRange();
		if (selection) {
			selection.removeAllRanges();
			range.selectNodeContents(textSpan);
			range.collapse(false);
			selection.addRange(range);
		}
		textSpan.focus();

		// Handle blur - save rename (not cancel)
		textSpan.onblur = () => {
			// Small delay to allow click events to process first
			setTimeout(() => {
				if (textSpan.contentEditable === 'true') {
					this.handleRename(textSpan);
				}
			}, 50);
		};
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace rename (called from onChooseItem when Enter is pressed)
	// ─────────────────────────────────────────────────────────────────

	async handleRename(textSpan: HTMLElement): Promise<void> {
		const el = textSpan.closest('.workspace-suggestion-item') as HTMLElement;
		if (!el) return;

		const oldName = el.dataset.workspaceName;
		const newName = textSpan.textContent?.trim();

		if (!oldName || !newName || oldName === newName) {
			textSpan.textContent = oldName || '';
			textSpan.contentEditable = 'false';
			el.removeClass('is-renaming');
			return;
		}

		const workspaceManager = this.plugin.getWorkspaceManager();

		// Check if new name already exists
		if (workspaceManager.hasWorkspace(newName)) {
			new Notice(`Workspace "${newName}" already exists`);
			textSpan.textContent = oldName;
			textSpan.focus();
			return;
		}

		// Perform the rename
		workspaceManager.renameWorkspace(oldName, newName);

		// Rename navigation layout data
		const layout = this.plugin.navigationLayouts.get(oldName);
		if (layout) {
			this.plugin.navigationLayouts.delete(oldName);
			this.plugin.navigationLayouts.set(newName, layout);
		}

		// Save changes
		await this.plugin.saveSettings();

		// Exit edit mode
		textSpan.contentEditable = 'false';
		el.removeClass('is-renaming');
		el.dataset.workspaceName = newName;

		// Update suggestions to show new name
		(this as any).updateSuggestions();

		new Notice(`Renamed workspace to "${newName}"`);
	}


	// ─────────────────────────────────────────────────────────────────
	// Handle workspace deletion
	// ─────────────────────────────────────────────────────────────────

	deleteWorkspace(workspaceName?: string): void {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// If no workspace name provided, use the currently selected one
		if (!workspaceName) {
			const selectedItem = (this as any).chooser.selectedItem;
			const suggestions = (this as any).chooser.values;
			if (selectedItem >= 0 && selectedItem < suggestions.length) {
				workspaceName = suggestions[selectedItem].item;
			}
		}

		if (!workspaceName) return;

		const doDelete = () => {
			// Delete the workspace
			workspaceManager.deleteWorkspace(workspaceName);

			// Delete navigation layout data
			this.plugin.navigationLayouts.delete(workspaceName);
			this.plugin.saveSettings();

			// Update the suggestions list
			(this as any).updateSuggestions();

			new Notice(`Deleted workspace: ${workspaceName}`);
		};

		// Show confirmation dialog if enabled
		if (this.plugin.settings.showDeleteConfirmation) {
			createConfirmationDialog(this.app, {
				title:    'Delete Workspace',
				text:     `Are you sure you want to delete the workspace "${workspaceName}"?`,
				cta:      'Delete',
				onAccept: doDelete
			});
		} else {
			doDelete();
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace duplication
	// ─────────────────────────────────────────────────────────────────

	duplicateWorkspace(workspaceName?: string): void {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// If no workspace name provided, use the currently selected one
		if (!workspaceName) {
			const selectedItem = (this as any).chooser.selectedItem;
			const suggestions = (this as any).chooser.values;
			if (selectedItem >= 0 && selectedItem < suggestions.length) {
				workspaceName = suggestions[selectedItem].item;
			}
		}

		if (!workspaceName) return;

		// Generate a unique name for the duplicate
		let newName = `${workspaceName} (copy)`;
		let counter = 2;
		while (workspaceManager.hasWorkspace(newName)) {
			newName = `${workspaceName} (copy ${counter})`;
			counter++;
		}

		// Duplicate the workspace
		workspaceManager.duplicateWorkspace(workspaceName, newName);

		// Also duplicate navigation layout data if it exists
		const layout = this.plugin.navigationLayouts.get(workspaceName);
		if (layout) {
			this.plugin.navigationLayouts.set(newName, JSON.parse(JSON.stringify(layout)));
		}

		this.plugin.saveSettings();

		// Update the suggestions list
		(this as any).updateSuggestions();

		new Notice(`Duplicated workspace to: ${newName}`);
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle group rename click (inline editing)
	// ─────────────────────────────────────────────────────────────────

	onGroupRenameClick(header: HTMLElement, textSpan: HTMLElement, groupName: string): void {
		const isNoGroup = groupName === '\x00nogroup';
		const displayName = isNoGroup ? 'No Group' : groupName;

		// Already editing? Cancel it
		if (textSpan.contentEditable === 'true') {
			textSpan.textContent = displayName;
			textSpan.contentEditable = 'false';
			header.removeClass('is-renaming');
			return;
		}

		// Enter edit mode
		header.addClass('is-renaming');
		textSpan.contentEditable = 'true';

		// For "No Group", clear the text so user can type fresh
		if (isNoGroup) {
			textSpan.textContent = '';
		}

		// Place cursor at end (matching workspace rename behavior)
		const selection = window.getSelection();
		const range = document.createRange();
		if (selection) {
			selection.removeAllRanges();
			range.selectNodeContents(textSpan);
			range.collapse(false);
			selection.addRange(range);
		}
		textSpan.focus();

		// Handle blur - save the rename
		const handleBlur = async () => {
			textSpan.removeEventListener('blur', handleBlur);
			textSpan.removeEventListener('keydown', handleKeydown);

			const newName = textSpan.textContent?.trim();
			textSpan.contentEditable = 'false';
			header.removeClass('is-renaming');

			// Cancel if empty or same name
			if (!newName || (isNoGroup && newName === 'No Group') || (!isNoGroup && newName === groupName)) {
				textSpan.textContent = displayName;
				return;
			}

			const workspaceManager = this.plugin.getWorkspaceManager();

			if (isNoGroup) {
				// Naming "No Group" - assign all ungrouped workspaces to new group
				const ungrouped = workspaceManager.getWorkspacesByGroup(null);
				for (const workspace of ungrouped) {
					workspaceManager.setWorkspaceGroup(workspace, newName);
				}

				// Transfer any styling from '\x00nogroup' to the new group name
				const icon = workspaceManager.getGroupIcon('\x00nogroup');
				if (icon) {
					workspaceManager.setGroupIcon(newName, icon);
					workspaceManager.setGroupIcon('\x00nogroup', null);
				}
				const iconColor = workspaceManager.getGroupIconColor('\x00nogroup');
				if (iconColor) {
					workspaceManager.setGroupIconColor(newName, iconColor);
					workspaceManager.setGroupIconColor('\x00nogroup', null);
				}
				const textColor = workspaceManager.getGroupColor('\x00nogroup');
				if (textColor) {
					workspaceManager.setGroupColor(newName, textColor);
					workspaceManager.setGroupColor('\x00nogroup', null);
				}
				// Transfer collapsed state
				if (workspaceManager.isGroupCollapsed('\x00nogroup')) {
					workspaceManager.setGroupCollapsed(newName, true);
					workspaceManager.setGroupCollapsed('\x00nogroup', false);
				}

				new Notice(`Created group "${newName}" with ${ungrouped.length} workspace(s)`);
			} else {
				// Normal rename
				workspaceManager.renameGroup(groupName, newName);
				new Notice(`Renamed group to "${newName}"`);
			}

			await this.plugin.saveSettings();

			// Refresh
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();
		};

		// Handle keydown - Enter to save, Escape to cancel
		const handleKeydown = (evt: KeyboardEvent) => {
			if (evt.key === 'Enter') {
				evt.preventDefault();
				textSpan.blur();
			} else if (evt.key === 'Escape') {
				evt.preventDefault();
				textSpan.textContent = displayName;
				textSpan.blur();
			}
		};

		textSpan.addEventListener('blur', handleBlur);
		textSpan.addEventListener('keydown', handleKeydown);
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle group edit click (opens full editor modal)
	// ─────────────────────────────────────────────────────────────────

	onGroupEditClick(groupName: string): void {
		const modal = new GroupStylePickerModal(this.app, this.plugin, groupName, async (result) => {
			const workspaceManager = this.plugin.getWorkspaceManager();
			const isNoGroup = groupName === '\x00nogroup';
			let finalGroupName = groupName;

			// Handle rename / naming "No Group"
			if (result.newName) {
				// Check if new group name already exists (unless naming "No Group")
				if (!isNoGroup && workspaceManager.getGroups().includes(result.newName)) {
					new Notice(`Group "${result.newName}" already exists`);
					return;
				}

				if (isNoGroup) {
					// Naming "No Group" - assign all ungrouped workspaces to new group
					const ungrouped = workspaceManager.getWorkspacesByGroup(null);
					for (const workspace of ungrouped) {
						workspaceManager.setWorkspaceGroup(workspace, result.newName);
					}

					// Transfer any styling from '\x00nogroup' to the new group name
					const icon      = workspaceManager.getGroupIcon('\x00nogroup');
					const iconColor = workspaceManager.getGroupIconColor('\x00nogroup');
					const color     = workspaceManager.getGroupColor('\x00nogroup');
					const bold      = workspaceManager.getGroupBold('\x00nogroup');
					const italic    = workspaceManager.getGroupItalic('\x00nogroup');
					const collapsed = workspaceManager.isGroupCollapsed('\x00nogroup');

					// Clear old styling
					workspaceManager.setGroupIcon('\x00nogroup', null);
					workspaceManager.setGroupIconColor('\x00nogroup', null);
					workspaceManager.setGroupColor('\x00nogroup', null);
					workspaceManager.setGroupBold('\x00nogroup', false);
					workspaceManager.setGroupItalic('\x00nogroup', false);
					workspaceManager.setGroupCollapsed('\x00nogroup', false);

					// Apply to new name (will be overwritten by result values below)
					if (icon) workspaceManager.setGroupIcon(result.newName, icon);
					if (iconColor) workspaceManager.setGroupIconColor(result.newName, iconColor);
					if (color) workspaceManager.setGroupColor(result.newName, color);
					if (bold) workspaceManager.setGroupBold(result.newName, true);
					if (italic) workspaceManager.setGroupItalic(result.newName, true);
					if (collapsed) workspaceManager.setGroupCollapsed(result.newName, true);

					finalGroupName = result.newName;
					new Notice(`Created group "${result.newName}" with ${ungrouped.length} workspace(s)`);
				} else if (result.newName !== groupName) {
					// Normal rename
					const workspacesInGroup = workspaceManager.getWorkspacesByGroup(groupName);
					for (const workspace of workspacesInGroup) {
						workspaceManager.setWorkspaceGroup(workspace, result.newName);
					}

					// Migrate group styling to new name
					const icon      = workspaceManager.getGroupIcon(groupName);
					const iconColor = workspaceManager.getGroupIconColor(groupName);
					const color     = workspaceManager.getGroupColor(groupName);
					const bold      = workspaceManager.getGroupBold(groupName);
					const italic    = workspaceManager.getGroupItalic(groupName);
					const collapsed = workspaceManager.isGroupCollapsed(groupName);

					// Clear old group styling
					workspaceManager.setGroupIcon(groupName, null);
					workspaceManager.setGroupIconColor(groupName, null);
					workspaceManager.setGroupColor(groupName, null);
					workspaceManager.setGroupBold(groupName, false);
					workspaceManager.setGroupItalic(groupName, false);
					workspaceManager.setGroupCollapsed(groupName, false);

					// Apply to new name (will be overwritten by result values below)
					if (icon) workspaceManager.setGroupIcon(result.newName, icon);
					if (iconColor) workspaceManager.setGroupIconColor(result.newName, iconColor);
					if (color) workspaceManager.setGroupColor(result.newName, color);
					if (bold) workspaceManager.setGroupBold(result.newName, true);
					if (italic) workspaceManager.setGroupItalic(result.newName, true);
					if (collapsed) workspaceManager.setGroupCollapsed(result.newName, true);

					finalGroupName = result.newName;
				}
			}

			// Apply style updates
			workspaceManager.setGroupIcon(finalGroupName, result.icon);
			workspaceManager.setGroupIconColor(finalGroupName, result.iconColor);
			workspaceManager.setGroupColor(finalGroupName, result.textColor);
			workspaceManager.setGroupBold(finalGroupName, result.textBold);
			workspaceManager.setGroupItalic(finalGroupName, result.textItalic);
			await this.plugin.saveSettings();

			// Refresh the suggestions to show updated style
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();

			if (!isNoGroup || !result.newName) {
				new Notice(`Updated "${finalGroupName === '\x00nogroup' ? 'No Group' : finalGroupName}"`);
			}
		});
		modal.open();
	}

	// ─────────────────────────────────────────────────────────────────
	// Render group header (shared between normal and collapsed groups)
	// ─────────────────────────────────────────────────────────────────

	renderGroupHeaderElement(container: HTMLElement, groupName: string, isCollapsed: boolean): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const isNoGroup    = groupName === '\x00nogroup';
		const displayName  = isNoGroup ? 'No Group' : groupName;

		const config: GroupHeaderConfig = {
			groupName,
			isCollapsed,
			useManualOrder:   this.plugin.settings.manualSortOrder,
			workspaceManager,
			onToggleCollapse: (gn) => this.onGroupToggleCollapse(gn),
			onEditClick:      (gn) => this.onGroupEditClick(gn),
			onRenameClick:    (c, t, gn) => this.onGroupRenameClick(c, t, gn),
			onDeleteClick:    (gn) => this.onGroupDelete(gn),
			onDragStart:      (evt, gn, c) => {
				this.draggedGroup   = gn;
				this.draggedElement = c;
				setGroupDragging(c, true);
				document.body.addClass('workspace-dragging');
				this.createDragGhost(c, displayName);
				this.dragGhost!.style.left = `${evt.clientX + 10}px`;
				this.dragGhost!.style.top  = `${evt.clientY - 10}px`;
			},
		};

		renderGroupHeader(container, config);
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle group collapse toggle
	// ─────────────────────────────────────────────────────────────────

	async onGroupToggleCollapse(groupName: string): Promise<void> {
		const workspaceManager = this.plugin.getWorkspaceManager();
		workspaceManager.toggleGroupCollapsed(groupName);
		await this.plugin.saveSettings();

		// Refresh the suggestions
		this.lastRenderedGroup = undefined;
		(this as any).updateSuggestions();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle group delete (ungroup all workspaces in the group)
	// ─────────────────────────────────────────────────────────────────

	async onGroupDelete(groupName: string): Promise<void> {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const workspacesInGroup = workspaceManager.getWorkspacesByGroup(groupName);

		// Remove group assignment from all workspaces in this group
		for (const workspace of workspacesInGroup) {
			workspaceManager.setWorkspaceGroup(workspace, null);
		}

		// Clear any group-level styling
		workspaceManager.setGroupIcon(groupName, null);
		workspaceManager.setGroupIconColor(groupName, null);
		workspaceManager.setGroupColor(groupName, null);
		workspaceManager.setGroupCollapsed(groupName, false);

		await this.plugin.saveSettings();

		new Notice(`Deleted group "${groupName}" (${workspacesInGroup.length} workspace(s) ungrouped)`);

		// Refresh the suggestions
		this.lastRenderedGroup = undefined;
		(this as any).updateSuggestions();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle icon click
	// ─────────────────────────────────────────────────────────────────

	onIconClick(workspaceName: string): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const currentGroup = workspaceManager.getWorkspaceGroup(workspaceName) || '';
		const currentIcon  = workspaceManager.getWorkspaceIcon(workspaceName) || '';
		const currentColor = workspaceManager.getWorkspaceIconColor(workspaceName) || '';
		const nameStyle    = workspaceManager.getWorkspaceNameStyle(workspaceName);

		const currentStyle: WorkspaceStyleResult = {
			group:      currentGroup,
			icon:       currentIcon,
			iconColor:  currentColor,
			nameColor:  nameStyle.color || '',
			nameBold:   nameStyle.bold || false,
			nameItalic: nameStyle.italic || false,
		};

		const modal = new WorkspaceStyleModal(this.app, this.plugin, workspaceName, currentStyle, async (newStyle) => {
			let finalName = workspaceName;

			// Handle rename if name changed
			if (newStyle.newName && newStyle.newName !== workspaceName) {
				if (workspaceManager.hasWorkspace(newStyle.newName)) {
					new Notice(`Workspace "${newStyle.newName}" already exists`);
					return;
				}
				workspaceManager.renameWorkspace(workspaceName, newStyle.newName);

				// Migrate navigation layout data
				const layout = this.plugin.navigationLayouts.get(workspaceName);
				if (layout) {
					this.plugin.navigationLayouts.delete(workspaceName);
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

			// Update the suggestions list and status bar
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();
			this.plugin.updateStatusBar();

			new Notice(`Updated "${finalName}"`);
		});
		modal.open();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle empty state (no matches found)
	// ─────────────────────────────────────────────────────────────────

	onNoSuggestion(): void {
		// Clear suggestions
		(this as any).chooser.setSuggestions(null);
		(this as any).chooser.addMessage('No matching workspace found.');

		// Add "Create new workspace" button
		const el = (this as any).chooser.containerEl.querySelector('.suggestion-empty');
		if (el) {
			el.createEl('button', {
				text: 'Create new workspace',
				cls:  'mod-cta'
			}).addEventListener('click', () => {
				this.createNewWorkspace();
			});
		}
	}

	// ─────────────────────────────────────────────────────────────────
	// Create new workspace
	// ─────────────────────────────────────────────────────────────────

	async createNewWorkspace(): Promise<void> {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Get workspace name from input
		const inputEl = (this as any).inputEl as HTMLInputElement;
		const workspaceName = inputEl?.value?.trim();

		if (!workspaceName) {
			new Notice('Please enter a workspace name');
			return;
		}

		// Check if workspace already exists
		if (workspaceManager.hasWorkspace(workspaceName)) {
			new Notice(`Workspace "${workspaceName}" already exists`);
			return;
		}

		// Create the new workspace from current layout
		const saveFolderState = this.plugin.settings.rememberNavigationLayout;
		const isNew = await workspaceManager.saveWorkspace(workspaceName, saveFolderState);

		// Apply default group if configured and this is a new workspace
		if (isNew && this.plugin.settings.defaultGroup) {
			workspaceManager.setWorkspaceGroup(workspaceName, this.plugin.settings.defaultGroup);
		}

		await this.plugin.saveSettings();

		new Notice(`Created workspace: ${workspaceName}`);

		// Close the modal
		this.close();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	async onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
		// Check if this is a collapsed group placeholder - expand it instead
		const collapsedGroup = this.isCollapsedGroupPlaceholder(workspace);
		if (collapsedGroup) {
			await this.onGroupToggleCollapse(collapsedGroup);
			return;
		}

		const workspaceManager = this.plugin.getWorkspaceManager();

		// Check for modifier keys
		const shiftKey = evt.shiftKey && !evt.altKey;
		const altKey = evt.altKey && !evt.shiftKey;

		// Handle Shift+Enter: Save current, switch to selected, and close
		if (shiftKey) {
			const currentWorkspace = workspaceManager.getActiveWorkspace();
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				const saveFolderState = this.plugin.settings.rememberNavigationLayout;
				await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			await this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			this.close();
			return;
		}

		// Handle Alt+Enter: Save current AND switch
		if (altKey) {
			const currentWorkspace = workspaceManager.getActiveWorkspace();
			if (currentWorkspace) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
				const saveFolderState = this.plugin.settings.rememberNavigationLayout;
				await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
				new Notice(`Saved workspace: ${currentWorkspace}`);
			}

			// Switch to selected workspace
			await this.plugin.loadWorkspace(workspace);
			new Notice(`Switched to workspace: ${workspace}`);
			return;
		}

		// Handle regular Enter: Save current workspace first, then switch
		const currentWorkspace = workspaceManager.getActiveWorkspace();
		if (currentWorkspace) {
			// Always save folder state when switching (even if autoSaveOnSwitch is false)
			// Only save layout if autoSaveOnSwitch is enabled
			if (this.plugin.settings.autoSaveOnSwitch) {
				await this.plugin.saveNavigationLayout(currentWorkspace);
			}

			// Always save folder state to preserve folder expansion
			const saveFolderState = this.plugin.settings.rememberNavigationLayout;
			await workspaceManager.saveWorkspace(currentWorkspace, saveFolderState);
		}

		// Load the selected workspace
		await this.plugin.loadWorkspace(workspace);
		new Notice(`Switched to workspace: ${workspace}`);
	}
}
