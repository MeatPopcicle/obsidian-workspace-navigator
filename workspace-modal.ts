// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice, Scope, Modal, Setting, setIcon } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { createPopper, Instance as PopperInstance } from '@popperjs/core';

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
}

// ───────────────────────────────────────────────────────────────────────────────
// Style Picker Modal
// ───────────────────────────────────────────────────────────────────────────────

export class StylePickerModal extends Modal {
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

		contentEl.createEl('h3', { text: 'Customize Workspace Appearance' });

		// State
		let groupValue      = this.currentStyle.group;
		let iconValue       = this.currentStyle.icon;
		let iconColorValue  = this.currentStyle.iconColor;
		let nameColorValue  = this.currentStyle.nameColor;
		let nameBoldValue   = this.currentStyle.nameBold;
		let nameItalicValue = this.currentStyle.nameItalic;

		// ─────────────────────────────────────────────────────────────
		// Preview
		// ─────────────────────────────────────────────────────────────
		const previewContainer = contentEl.createDiv('workspace-style-preview-container');
		const iconPreview = previewContainer.createSpan('workspace-style-preview-icon');
		if (iconValue) {
			setIcon(iconPreview, iconValue);
			if (iconColorValue) iconPreview.style.color = iconColorValue;
		}

		const namePreview = previewContainer.createSpan('workspace-style-preview-name');
		namePreview.textContent = this.workspaceName;
		if (nameColorValue) namePreview.style.color = nameColorValue;
		if (nameBoldValue) namePreview.style.fontWeight = 'bold';
		if (nameItalicValue) namePreview.style.fontStyle = 'italic';

		const updatePreview = () => {
			iconPreview.empty();
			if (iconValue) {
				setIcon(iconPreview, iconValue);
				iconPreview.style.color = iconColorValue || '';
			}
			namePreview.style.color = nameColorValue || '';
			namePreview.style.fontWeight = nameBoldValue ? 'bold' : '';
			namePreview.style.fontStyle = nameItalicValue ? 'italic' : '';
		};

		// ─────────────────────────────────────────────────────────────
		// Group Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Group', cls: 'workspace-style-section' });

		const workspaceManager = this.plugin.getWorkspaceManager();
		const existingGroups = workspaceManager.getGroups();

		new Setting(contentEl)
			.setName('Assign to group')
			.setDesc('Type a new group name or select an existing one')
			.addDropdown(dropdown => {
				dropdown.addOption('', '(No group)');
				for (const group of existingGroups) {
					dropdown.addOption(group, group);
				}
				dropdown.setValue(groupValue || '');
				dropdown.onChange(value => {
					groupValue = value;
				});
			})
			.addText(text => {
				text.setPlaceholder('Or type new group...');
				text.onChange(value => {
					if (value.trim()) {
						groupValue = value.trim();
					}
				});
			});

		// ─────────────────────────────────────────────────────────────
		// Icon Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Icon', cls: 'workspace-style-section' });

		// Icon color
		contentEl.createEl('p', { text: 'Icon color:', cls: 'workspace-icon-label' });
		const iconColorRow = contentEl.createDiv('workspace-color-row');
		const iconSwatchContainer = iconColorRow.createDiv('workspace-color-swatches');

		for (const { color, name } of PRESET_COLORS) {
			const swatch = iconSwatchContainer.createEl('button', { cls: 'workspace-color-swatch' });
			swatch.style.backgroundColor = color;
			swatch.setAttribute('title', name);
			if (color === iconColorValue) swatch.addClass('is-selected');
			swatch.addEventListener('click', () => {
				iconSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				swatch.addClass('is-selected');
				iconColorValue = color;
				iconColorInput.value = color;
				updatePreview();
			});
		}

		const iconColorInput = iconColorRow.createEl('input', { cls: 'workspace-color-input' }) as HTMLInputElement;
		iconColorInput.type = 'color';
		iconColorInput.value = iconColorValue || '#ffffff';
		iconColorInput.addEventListener('input', () => {
			iconColorValue = iconColorInput.value;
			iconSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			updatePreview();
		});

		// Icon grid
		contentEl.createEl('p', { text: 'Select icon:', cls: 'workspace-icon-label' });
		const grid = contentEl.createDiv('workspace-icon-grid');
		for (const iconName of LUCIDE_ICONS) {
			const btn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
			setIcon(btn, iconName);
			btn.setAttribute('title', iconName);
			if (iconName === iconValue) btn.addClass('is-selected');
			btn.addEventListener('click', () => {
				iconValue = iconName;
				grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				btn.addClass('is-selected');
				updatePreview();
			});
		}

		// ─────────────────────────────────────────────────────────────
		// Name Style Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Name Style', cls: 'workspace-style-section' });

		// Name color
		contentEl.createEl('p', { text: 'Name color:', cls: 'workspace-icon-label' });
		const nameColorRow = contentEl.createDiv('workspace-color-row');
		const nameSwatchContainer = nameColorRow.createDiv('workspace-color-swatches');

		for (const { color, name } of PRESET_COLORS) {
			const swatch = nameSwatchContainer.createEl('button', { cls: 'workspace-color-swatch' });
			swatch.style.backgroundColor = color;
			swatch.setAttribute('title', name);
			if (color === nameColorValue) swatch.addClass('is-selected');
			swatch.addEventListener('click', () => {
				nameSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				swatch.addClass('is-selected');
				nameColorValue = color;
				nameColorInput.value = color;
				updatePreview();
			});
		}

		const nameColorInput = nameColorRow.createEl('input', { cls: 'workspace-color-input' }) as HTMLInputElement;
		nameColorInput.type = 'color';
		nameColorInput.value = nameColorValue || '#ffffff';
		nameColorInput.addEventListener('input', () => {
			nameColorValue = nameColorInput.value;
			nameSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			updatePreview();
		});

		// Bold & Italic toggles
		new Setting(contentEl)
			.setName('Bold')
			.addToggle(toggle => toggle
				.setValue(nameBoldValue)
				.onChange(value => {
					nameBoldValue = value;
					updatePreview();
				}));

		new Setting(contentEl)
			.setName('Italic')
			.addToggle(toggle => toggle
				.setValue(nameItalicValue)
				.onChange(value => {
					nameItalicValue = value;
					updatePreview();
				}));

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
						nameItalic: nameItalicValue
					});
					this.close();
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}

// ───────────────────────────────────────────────────────────────────────────────
// Group Style Picker Modal
// ───────────────────────────────────────────────────────────────────────────────

export class GroupStylePickerModal extends Modal {
	plugin:    WorkspaceNavigator;
	groupName: string;
	onSubmit:  (icon: string | null, iconColor: string | null, textColor: string | null) => void;

	constructor(app: App, plugin: WorkspaceNavigator, groupName: string, onSubmit: (icon: string | null, iconColor: string | null, textColor: string | null) => void) {
		super(app);
		this.plugin    = plugin;
		this.groupName = groupName;
		this.onSubmit  = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const displayName = this.groupName === '\x00nogroup' ? 'No Group' : this.groupName;
		contentEl.createEl('h3', { text: `Style for "${displayName}"` });

		const workspaceManager = this.plugin.getWorkspaceManager();
		let iconValue      = workspaceManager.getGroupIcon(this.groupName) || '';
		let iconColorValue = workspaceManager.getGroupIconColor(this.groupName) || '';
		let textColorValue = workspaceManager.getGroupColor(this.groupName) || '';

		// ─────────────────────────────────────────────────────────────
		// Icon Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Icon', cls: 'workspace-style-section' });

		// Icon color
		contentEl.createEl('p', { text: 'Icon color:', cls: 'workspace-icon-label' });
		const iconColorRow = contentEl.createDiv('workspace-color-row');
		const iconSwatchContainer = iconColorRow.createDiv('workspace-color-swatches');

		for (const { color, name } of PRESET_COLORS) {
			const swatch = iconSwatchContainer.createEl('button', { cls: 'workspace-color-swatch' });
			swatch.style.backgroundColor = color;
			swatch.setAttribute('title', name);
			if (color === iconColorValue) swatch.addClass('is-selected');
			swatch.addEventListener('click', () => {
				iconSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				swatch.addClass('is-selected');
				iconColorValue = color;
				iconColorInput.value = color;
			});
		}

		const noIconColorSwatch = iconSwatchContainer.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
		noIconColorSwatch.textContent = '✕';
		noIconColorSwatch.setAttribute('title', 'No color');
		if (!iconColorValue) noIconColorSwatch.addClass('is-selected');
		noIconColorSwatch.addEventListener('click', () => {
			iconSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			noIconColorSwatch.addClass('is-selected');
			iconColorValue = '';
		});

		const iconColorInput = iconColorRow.createEl('input', { cls: 'workspace-color-input' }) as HTMLInputElement;
		iconColorInput.type = 'color';
		iconColorInput.value = iconColorValue || '#ffffff';
		iconColorInput.addEventListener('input', () => {
			iconColorValue = iconColorInput.value;
			iconSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
		});

		// Icon grid
		contentEl.createEl('p', { text: 'Select icon:', cls: 'workspace-icon-label' });
		const grid = contentEl.createDiv('workspace-icon-grid');

		const noIconBtn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
		noIconBtn.textContent = '✕';
		noIconBtn.setAttribute('title', 'No icon');
		if (!iconValue) noIconBtn.addClass('is-selected');
		noIconBtn.addEventListener('click', () => {
			grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			noIconBtn.addClass('is-selected');
			iconValue = '';
		});

		for (const iconName of LUCIDE_ICONS) {
			const btn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
			setIcon(btn, iconName);
			btn.setAttribute('title', iconName);
			if (iconName === iconValue) btn.addClass('is-selected');
			btn.addEventListener('click', () => {
				grid.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				btn.addClass('is-selected');
				iconValue = iconName;
			});
		}

		// ─────────────────────────────────────────────────────────────
		// Text Color Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Text Color', cls: 'workspace-style-section' });

		const textColorRow = contentEl.createDiv('workspace-color-row');
		const textSwatchContainer = textColorRow.createDiv('workspace-color-swatches');

		for (const { color, name } of PRESET_COLORS) {
			const swatch = textSwatchContainer.createEl('button', { cls: 'workspace-color-swatch' });
			swatch.style.backgroundColor = color;
			swatch.setAttribute('title', name);
			if (color === textColorValue) swatch.addClass('is-selected');
			swatch.addEventListener('click', () => {
				textSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
				swatch.addClass('is-selected');
				textColorValue = color;
				textColorInput.value = color;
			});
		}

		const noTextColorSwatch = textSwatchContainer.createEl('button', { cls: 'workspace-color-swatch workspace-color-none' });
		noTextColorSwatch.textContent = '✕';
		noTextColorSwatch.setAttribute('title', 'No color');
		if (!textColorValue) noTextColorSwatch.addClass('is-selected');
		noTextColorSwatch.addEventListener('click', () => {
			textSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
			noTextColorSwatch.addClass('is-selected');
			textColorValue = '';
		});

		const textColorInput = textColorRow.createEl('input', { cls: 'workspace-color-input' }) as HTMLInputElement;
		textColorInput.type = 'color';
		textColorInput.value = textColorValue || '#ffffff';
		textColorInput.addEventListener('input', () => {
			textColorValue = textColorInput.value;
			textSwatchContainer.querySelectorAll('.is-selected').forEach(el => el.removeClass('is-selected'));
		});

		// ─────────────────────────────────────────────────────────────
		// Action buttons
		// ─────────────────────────────────────────────────────────────
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Clear All')
				.onClick(() => {
					this.onSubmit(null, null, null);
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					this.onSubmit(iconValue || null, iconColorValue || null, textColorValue || null);
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
			indicator.setAttribute('title', 'File already open in this workspace');
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

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app);
		this.plugin = plugin;

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

		console.log('[useSelectedItem] targetEl:', targetEl?.tagName, 'contentEditable:', targetEl?.contentEditable);

		// If we're editing a contentEditable element, handle rename
		if (targetEl && targetEl.contentEditable === 'true') {
			console.log('[useSelectedItem] Calling handleRename');
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
	}

	onClose(): void {
		// Pop custom scope
		(this.app as any).keymap.popScope(this.scope);

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
		const groups = workspaceManager.getGroups();
		const result: string[] = [];
		const hasNamedGroups = groups.length > 0;

		// Add workspaces by group (groups sorted alphabetically)
		for (const group of groups) {
			if (workspaceManager.isGroupCollapsed(group)) {
				// Add a placeholder for collapsed group (will render header only)
				result.push(`\x00collapsed:${group}`);
			} else {
				const workspaces = workspaceManager.getWorkspacesByGroup(group);
				result.push(...workspaces);
			}
		}

		// Add ungrouped workspaces at the end
		const ungrouped = workspaceManager.getWorkspacesByGroup(null);
		if (ungrouped.length > 0) {
			// Only show "No Group" header/placeholder if there are named groups
			if (hasNamedGroups && workspaceManager.isGroupCollapsed('\x00nogroup')) {
				// Add placeholder for collapsed "No Group"
				result.push('\x00collapsed:\x00nogroup');
			} else {
				result.push(...ungrouped);
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
			this.renderGroupHeader(el, collapsedGroup, true);
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
				this.renderGroupHeader(header, groupKey, false);

				el.parentElement?.insertBefore(header, el);
			}
		}

		// Add data attribute for rename functionality
		el.dataset.workspaceName = workspaceName;
		el.addClass('workspace-suggestion-item');

		// Wrap the text content in a span for rename functionality
		const textContent = el.textContent || '';
		el.empty();

		// Add workspace icon column (with custom icon or default)
		const showStyles = this.plugin.settings.showStyleButton;

		if (showStyles) {
			const icon      = workspaceManager.getWorkspaceIcon(workspaceName);
			const iconColor = workspaceManager.getWorkspaceIconColor(workspaceName);

			const iconSpan = el.createSpan('workspace-icon-column');
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
		}

		const textSpan = el.createSpan('workspace-name-text');
		textSpan.textContent = textContent;

		// Apply name styling only if enabled
		if (showStyles) {
			const nameStyle = workspaceManager.getWorkspaceNameStyle(workspaceName);
			if (nameStyle.color) textSpan.style.color = nameStyle.color;
			if (nameStyle.bold) textSpan.style.fontWeight = 'bold';
			if (nameStyle.italic) textSpan.style.fontStyle = 'italic';
		}

		// Add active workspace indicator (checkmark)
		const activeWorkspace = workspaceManager.getActiveWorkspace();
		if (activeWorkspace && workspaceName === activeWorkspace) {
			const activeIndicator = el.createDiv('workspace-active-indicator');
			activeIndicator.setAttribute('aria-label', 'Active workspace');
			activeIndicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M10 15.172l9.192-9.193 1.415 1.414L10 18l-6.364-6.364 1.414-1.414z"/></svg>`;
			el.addClass('is-active');
		}

		// Create delete button
		const deleteBtn = el.createDiv('workspace-delete-btn');
		deleteBtn.setAttribute('aria-label', 'Delete workspace');
		deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 4V2h10v2h5v2h-2v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6H2V4h5zM6 6v14h12V6H6zm3 3h2v8H9V9zm4 0h2v8h-2V9z"/></svg>`;
		deleteBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.deleteWorkspace(workspaceName);
		});

		// Create duplicate button
		const duplicateBtn = el.createDiv('workspace-duplicate-btn');
		duplicateBtn.setAttribute('aria-label', 'Duplicate workspace');
		duplicateBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 6V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3c0 .552-.45 1-1.007 1H4.007A1.001 1.001 0 0 1 3 21l.003-14c0-.552.45-1 1.007-1H7zM5.003 8L5 20h10V8H5.003zM9 6h8v10h2V4H9v2z"/></svg>`;
		duplicateBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.duplicateWorkspace(workspaceName);
		});

		// Create rename button
		const renameBtn = el.createDiv('workspace-rename-btn');
		renameBtn.setAttribute('aria-label', 'Rename workspace');
		renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
		renameBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onRenameClick(evt, el);
		});

		// Create style button (only if enabled in settings)
		if (this.plugin.settings.showStyleButton) {
			const iconBtn = el.createDiv('workspace-icon-btn');
			iconBtn.setAttribute('aria-label', 'Style workspace');
			iconBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 2c5.522 0 10 3.978 10 8.889a5.558 5.558 0 0 1-5.556 5.555h-1.966c-.922 0-1.667.745-1.667 1.667 0 .422.167.811.422 1.1.267.3.434.689.434 1.122C13.667 21.256 12.9 22 12 22 6.478 22 2 17.522 2 12S6.478 2 12 2zM7.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`;
			iconBtn.addEventListener('click', (evt) => {
				evt.stopPropagation();
				this.onIconClick(workspaceName);
			});
		}
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

		// Toggle contentEditable - just like original plugin
		if (textSpan.contentEditable === 'true') {
			// Cancel rename
			textSpan.textContent = el.dataset.workspaceName || '';
			textSpan.contentEditable = 'false';
			el.removeClass('is-renaming');
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

		// Handle blur - cancel rename
		textSpan.onblur = () => {
			textSpan.contentEditable = 'false';
			el.removeClass('is-renaming');
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

		console.log('[Rename] oldName:', oldName, 'newName:', newName);

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
	// Handle group style click
	// ─────────────────────────────────────────────────────────────────

	onGroupStyleClick(groupName: string): void {
		const modal = new GroupStylePickerModal(this.app, this.plugin, groupName, async (icon, iconColor, textColor) => {
			const workspaceManager = this.plugin.getWorkspaceManager();
			workspaceManager.setGroupIcon(groupName, icon);
			workspaceManager.setGroupIconColor(groupName, iconColor);
			workspaceManager.setGroupColor(groupName, textColor);
			await this.plugin.saveSettings();

			// Refresh the suggestions to show updated style
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();
		});
		modal.open();
	}

	// ─────────────────────────────────────────────────────────────────
	// Render group header (shared between normal and collapsed groups)
	// ─────────────────────────────────────────────────────────────────

	renderGroupHeader(container: HTMLElement, groupName: string, isCollapsed: boolean): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const isNoGroup = groupName === '\x00nogroup';
		const displayName = isNoGroup ? 'No Group' : groupName;

		// Collapse/expand chevron
		const chevron = document.createElement('span');
		chevron.addClass('workspace-group-chevron');
		chevron.innerHTML = isCollapsed
			? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M13.172 12l-4.95-4.95 1.414-1.414L16 12l-6.364 6.364-1.414-1.414z"/></svg>`
			: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z"/></svg>`;
		chevron.setAttribute('title', isCollapsed ? 'Expand group' : 'Collapse group');
		chevron.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onGroupToggleCollapse(groupName);
		});
		container.appendChild(chevron);

		// Add group icon if set
		const groupIcon = isNoGroup
			? workspaceManager.getGroupIcon('\x00nogroup')
			: workspaceManager.getGroupIcon(groupName);
		if (groupIcon) {
			const iconSpan = document.createElement('span');
			iconSpan.addClass('workspace-group-icon');
			setIcon(iconSpan, groupIcon);
			const iconColor = isNoGroup
				? workspaceManager.getGroupIconColor('\x00nogroup')
				: workspaceManager.getGroupIconColor(groupName);
			if (iconColor) {
				iconSpan.style.color = iconColor;
			}
			container.appendChild(iconSpan);
		}

		// Group name text
		const textSpan = document.createElement('span');
		textSpan.addClass('workspace-group-text');
		textSpan.textContent = displayName;
		textSpan.dataset.groupName = groupName;
		const groupColor = isNoGroup
			? workspaceManager.getGroupColor('\x00nogroup')
			: workspaceManager.getGroupColor(groupName);
		if (groupColor) {
			textSpan.style.color = groupColor;
		}
		container.appendChild(textSpan);

		// Workspace count for collapsed groups
		if (isCollapsed) {
			const count = isNoGroup
				? workspaceManager.getWorkspacesByGroup(null).length
				: workspaceManager.getWorkspacesByGroup(groupName).length;
			const countSpan = document.createElement('span');
			countSpan.addClass('workspace-group-count');
			countSpan.textContent = `(${count})`;
			container.appendChild(countSpan);
		}

		// Style button (palette)
		const styleBtn = document.createElement('span');
		styleBtn.addClass('workspace-group-edit-btn');
		styleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12 2c5.522 0 10 3.978 10 8.889a5.558 5.558 0 0 1-5.556 5.555h-1.966c-.922 0-1.667.745-1.667 1.667 0 .422.167.811.422 1.1.267.3.434.689.434 1.122C13.667 21.256 12.9 22 12 22 6.478 22 2 17.522 2 12S6.478 2 12 2zM7.5 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM12 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`;
		styleBtn.setAttribute('title', 'Edit group style');
		styleBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onGroupStyleClick(groupName);
		});
		container.appendChild(styleBtn);

		// Rename button (pencil)
		const renameBtn = document.createElement('span');
		renameBtn.addClass('workspace-group-edit-btn');
		renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><path fill="none" d="M0 0h24v24H0z"/><path d="M12.9 6.858l4.242 4.243L7.242 21H3v-4.243l9.9-9.9zm1.414-1.414l2.121-2.122a1 1 0 0 1 1.414 0l2.829 2.829a1 1 0 0 1 0 1.414l-2.122 2.121-4.242-4.242z"/></svg>`;
		renameBtn.setAttribute('title', isNoGroup ? 'Name this group' : 'Rename group');
		renameBtn.addEventListener('click', (evt) => {
			evt.stopPropagation();
			this.onGroupRenameClick(container, textSpan, groupName);
		});
		container.appendChild(renameBtn);
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

		const modal = new StylePickerModal(this.app, this.plugin, workspaceName, currentStyle, async (newStyle) => {
			workspaceManager.setWorkspaceGroup(workspaceName, newStyle.group || null);
			workspaceManager.setWorkspaceIcon(workspaceName, newStyle.icon || null, newStyle.iconColor || null);
			workspaceManager.setWorkspaceNameStyle(workspaceName, {
				color:  newStyle.nameColor || null,
				bold:   newStyle.nameBold,
				italic: newStyle.nameItalic,
			});
			await this.plugin.saveSettings();

			// Update the suggestions list and status bar
			this.lastRenderedGroup = undefined;
			(this as any).updateSuggestions();
			this.plugin.updateStatusBar();

			new Notice(`Updated style for "${workspaceName}"`);
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
