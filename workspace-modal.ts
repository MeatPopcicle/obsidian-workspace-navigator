// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE SWITCHER MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, FuzzySuggestModal, FuzzyMatch, Notice, Scope, Modal, Setting } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';
import { createPopper, Instance as PopperInstance } from '@popperjs/core';

// ───────────────────────────────────────────────────────────────────────────────
// Nerd Font Icons (requires a Nerd Font to be configured in Obsidian)
// ───────────────────────────────────────────────────────────────────────────────

// Common Nerd Font icons - using Unicode codepoints from nerdfonts.com
const NERD_FONT_ICONS: { icon: string; name: string }[] = [
	// Folders & Files
	{ icon: '\uf07b', name: 'folder' },
	{ icon: '\uf07c', name: 'folder-open' },
	{ icon: '\uf15b', name: 'file' },
	{ icon: '\uf15c', name: 'file-text' },
	{ icon: '\ue5fe', name: 'folder-config' },
	{ icon: '\uf0c5', name: 'copy' },
	{ icon: '\uf0c7', name: 'save' },
	{ icon: '\uf1c9', name: 'file-code' },

	// Development
	{ icon: '\ue796', name: 'typescript' },
	{ icon: '\ue781', name: 'javascript' },
	{ icon: '\ue73c', name: 'python' },
	{ icon: '\ue7a8', name: 'rust' },
	{ icon: '\ue626', name: 'golang' },
	{ icon: '\ue738', name: 'git' },
	{ icon: '\uf09b', name: 'github' },
	{ icon: '\uf296', name: 'gitlab' },

	// Editors & Tools
	{ icon: '\ue7c5', name: 'vim' },
	{ icon: '\ue70c', name: 'vscode' },
	{ icon: '\uf121', name: 'code' },
	{ icon: '\uf120', name: 'terminal' },
	{ icon: '\uf489', name: 'terminal-alt' },
	{ icon: '\uf7d9', name: 'console' },
	{ icon: '\uf085', name: 'cogs' },
	{ icon: '\uf013', name: 'cog' },

	// UI & Layout
	{ icon: '\uf009', name: 'th-large' },
	{ icon: '\uf00a', name: 'th' },
	{ icon: '\uf0db', name: 'columns' },
	{ icon: '\uf24d', name: 'clone' },
	{ icon: '\uf2d0', name: 'window' },
	{ icon: '\uf2d1', name: 'window-max' },
	{ icon: '\uf31c', name: 'layout' },
	{ icon: '\uf03a', name: 'list' },

	// Objects
	{ icon: '\uf015', name: 'home' },
	{ icon: '\uf19c', name: 'building' },
	{ icon: '\uf0b1', name: 'briefcase' },
	{ icon: '\uf0e0', name: 'envelope' },
	{ icon: '\uf02d', name: 'book' },
	{ icon: '\uf02e', name: 'bookmark' },
	{ icon: '\uf5fd', name: 'brain' },
	{ icon: '\uf0eb', name: 'lightbulb' },

	// Actions
	{ icon: '\uf002', name: 'search' },
	{ icon: '\uf044', name: 'edit' },
	{ icon: '\uf1fc', name: 'brush' },
	{ icon: '\uf0ad', name: 'wrench' },
	{ icon: '\uf0c3', name: 'flask' },
	{ icon: '\uf1b2', name: 'cube' },
	{ icon: '\uf1b3', name: 'cubes' },
	{ icon: '\uf21b', name: 'rocket' },

	// Symbols
	{ icon: '\uf005', name: 'star' },
	{ icon: '\uf004', name: 'heart' },
	{ icon: '\uf0e7', name: 'bolt' },
	{ icon: '\uf06d', name: 'fire' },
	{ icon: '\uf043', name: 'droplet' },
	{ icon: '\uf06e', name: 'eye' },
	{ icon: '\uf023', name: 'lock' },
	{ icon: '\uf3c1', name: 'key' },

	// Misc
	{ icon: '\uf11b', name: 'gamepad' },
	{ icon: '\uf001', name: 'music' },
	{ icon: '\uf03d', name: 'video' },
	{ icon: '\uf030', name: 'camera' },
	{ icon: '\uf0ac', name: 'globe' },
	{ icon: '\uf0c2', name: 'cloud' },
	{ icon: '\uf233', name: 'server' },
	{ icon: '\uf108', name: 'desktop' },
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
	icon:       string;
	iconColor:  string;
	iconSize:   number;
	nameColor:  string;
	nameBold:   boolean;
	nameItalic: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// Style Picker Modal
// ───────────────────────────────────────────────────────────────────────────────

export class StylePickerModal extends Modal {
	workspaceName: string;
	currentStyle:  WorkspaceStyleResult;
	onSubmit:      (style: WorkspaceStyleResult) => void;

	constructor(app: App, workspaceName: string, currentStyle: WorkspaceStyleResult, onSubmit: (style: WorkspaceStyleResult) => void) {
		super(app);
		this.workspaceName = workspaceName;
		this.currentStyle  = currentStyle;
		this.onSubmit      = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('workspace-style-picker');

		contentEl.createEl('h3', { text: 'Customize Workspace Appearance' });
		contentEl.createEl('p', {
			text: 'Icons require a Nerd Font configured in Obsidian',
			cls: 'workspace-icon-note'
		});

		// State
		let iconValue       = this.currentStyle.icon;
		let iconColorValue  = this.currentStyle.iconColor;
		let iconSizeValue   = this.currentStyle.iconSize || 1.1;
		let nameColorValue  = this.currentStyle.nameColor;
		let nameBoldValue   = this.currentStyle.nameBold;
		let nameItalicValue = this.currentStyle.nameItalic;

		// ─────────────────────────────────────────────────────────────
		// Preview
		// ─────────────────────────────────────────────────────────────
		const previewContainer = contentEl.createDiv('workspace-style-preview-container');
		const iconPreview = previewContainer.createSpan('workspace-style-preview-icon');
		iconPreview.textContent = iconValue || '';
		if (iconColorValue) iconPreview.style.color = iconColorValue;
		iconPreview.style.fontSize = `${iconSizeValue}em`;

		const namePreview = previewContainer.createSpan('workspace-style-preview-name');
		namePreview.textContent = this.workspaceName;
		if (nameColorValue) namePreview.style.color = nameColorValue;
		if (nameBoldValue) namePreview.style.fontWeight = 'bold';
		if (nameItalicValue) namePreview.style.fontStyle = 'italic';

		const updatePreview = () => {
			iconPreview.textContent = iconValue || '';
			iconPreview.style.color = iconColorValue || '';
			iconPreview.style.fontSize = `${iconSizeValue}em`;
			namePreview.style.color = nameColorValue || '';
			namePreview.style.fontWeight = nameBoldValue ? 'bold' : '';
			namePreview.style.fontStyle = nameItalicValue ? 'italic' : '';
		};

		// ─────────────────────────────────────────────────────────────
		// Icon Section
		// ─────────────────────────────────────────────────────────────
		contentEl.createEl('h4', { text: 'Icon', cls: 'workspace-style-section' });

		new Setting(contentEl)
			.setName('Custom icon')
			.setDesc('Paste any Nerd Font glyph')
			.addText(text => {
				text.setValue(iconValue)
					.setPlaceholder('\uf015')
					.onChange(value => {
						iconValue = value;
						updatePreview();
					});
				text.inputEl.addClass('workspace-icon-input');
			});

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

		// Icon size input
		new Setting(contentEl)
			.setName('Icon size')
			.setDesc('em')
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.min = '0.8';
				text.inputEl.max = '2.0';
				text.inputEl.step = '0.1';
				text.inputEl.style.width = '70px';
				text.setValue(iconSizeValue.toFixed(1));
				text.onChange(value => {
					const num = parseFloat(value);
					if (!isNaN(num) && num >= 0.8 && num <= 2.0) {
						iconSizeValue = num;
						updatePreview();
					}
				});
			});

		// Icon grid
		contentEl.createEl('p', { text: 'Common icons:', cls: 'workspace-icon-label' });
		const grid = contentEl.createDiv('workspace-icon-grid');
		for (const { icon, name } of NERD_FONT_ICONS) {
			const btn = grid.createEl('button', { cls: 'workspace-icon-btn-grid' });
			btn.textContent = icon;
			btn.setAttribute('title', name);
			if (icon === iconValue) btn.addClass('is-selected');
			btn.addEventListener('click', () => {
				iconValue = icon;
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
						icon: '', iconColor: '', iconSize: 1.1, nameColor: '',
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
						icon:       iconValue,
						iconColor:  iconColorValue,
						iconSize:   iconSizeValue,
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
// Workspace Modal Class
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceSwitcherModal extends FuzzySuggestModal<string> {
	plugin:        WorkspaceNavigator;
	workspaces:    string[];
	popper:        PopperInstance | null = null;

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
	// Get list of workspaces (sorted if enabled)
	// ─────────────────────────────────────────────────────────────────

	getItems(): string[] {
		const workspaceManager = this.plugin.getWorkspaceManager();

		// Workspace manager already sorts alphabetically with natural sort
		return workspaceManager.getWorkspaceNames();
	}

	// ─────────────────────────────────────────────────────────────────
	// Get display text for workspace
	// ─────────────────────────────────────────────────────────────────

	getItemText(workspace: string): string {
		return workspace;
	}

	// ─────────────────────────────────────────────────────────────────
	// Render suggestion with rename button
	// ─────────────────────────────────────────────────────────────────

	renderSuggestion(item: FuzzyMatch<string>, el: HTMLElement): void {
		super.renderSuggestion(item, el);

		const workspaceName = item.item;

		// Add data attribute for rename functionality
		el.dataset.workspaceName = workspaceName;
		el.addClass('workspace-suggestion-item');

		// Wrap the text content in a span for rename functionality
		const textContent = el.textContent || '';
		el.empty();

		// Add workspace icon column and styling if enabled
		const workspaceManager = this.plugin.getWorkspaceManager();
		const showStyles = this.plugin.settings.showStyleButton;

		// Always create icon column when styles enabled (for alignment)
		if (showStyles) {
			const icon      = workspaceManager.getWorkspaceIcon(workspaceName);
			const iconColor = workspaceManager.getWorkspaceIconColor(workspaceName);
			const iconSize  = workspaceManager.getWorkspaceIconSize(workspaceName);

			// Always create the column with icon or invisible placeholder
			const iconSpan = el.createSpan('workspace-icon-column');
			if (icon) {
				iconSpan.textContent = icon;
				if (iconColor) {
					iconSpan.style.color = iconColor;
				}
				if (iconSize && iconSize !== 1.1) {
					iconSpan.style.fontSize = `${iconSize}em`;
				}
			} else {
				// Transparent icon placeholder (takes up space but not visible)
				iconSpan.textContent = '\uf015';  // Home icon as placeholder
				iconSpan.style.color = 'transparent';
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

		// Add workspace description if it exists
		const workspace = workspaceManager.getWorkspace(workspaceName);
		if (workspace?.metadata?.description) {
			const descEl = el.createDiv('workspace-description');
			descEl.textContent = workspace.metadata.description;
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
	// Handle icon click
	// ─────────────────────────────────────────────────────────────────

	onIconClick(workspaceName: string): void {
		const workspaceManager = this.plugin.getWorkspaceManager();
		const currentIcon  = workspaceManager.getWorkspaceIcon(workspaceName) || '';
		const currentColor = workspaceManager.getWorkspaceIconColor(workspaceName) || '';
		const currentSize  = workspaceManager.getWorkspaceIconSize(workspaceName);
		const nameStyle    = workspaceManager.getWorkspaceNameStyle(workspaceName);

		const currentStyle: WorkspaceStyleResult = {
			icon:       currentIcon,
			iconColor:  currentColor,
			iconSize:   currentSize,
			nameColor:  nameStyle.color || '',
			nameBold:   nameStyle.bold || false,
			nameItalic: nameStyle.italic || false,
		};

		const modal = new StylePickerModal(this.app, workspaceName, currentStyle, async (newStyle) => {
			workspaceManager.setWorkspaceIcon(workspaceName, newStyle.icon || null, newStyle.iconColor || null, newStyle.iconSize);
			workspaceManager.setWorkspaceNameStyle(workspaceName, {
				color:  newStyle.nameColor || null,
				bold:   newStyle.nameBold,
				italic: newStyle.nameItalic,
			});
			await this.plugin.saveSettings();

			// Update the suggestions list and status bar
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
		await workspaceManager.saveWorkspace(workspaceName, saveFolderState);
		await this.plugin.saveSettings();

		new Notice(`Created workspace: ${workspaceName}`);

		// Close the modal
		this.close();
	}

	// ─────────────────────────────────────────────────────────────────
	// Handle workspace selection
	// ─────────────────────────────────────────────────────────────────

	async onChooseItem(workspace: string, evt: MouseEvent | KeyboardEvent): Promise<void> {
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
