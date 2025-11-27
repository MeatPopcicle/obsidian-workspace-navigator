// ═══════════════════════════════════════════════════════════════════════════════
// WORKSPACE EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════════

import { App, Modal, Setting, Notice, TextComponent } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Workspace Editor Modal
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceEditorModal extends Modal {
	plugin: WorkspaceNavigator;

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
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
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

		for (const name of workspaces) {
			this.renderWorkspaceItem(listEl, name, name === activeWorkspace);
		}
	}

	renderWorkspaceItem(containerEl: HTMLElement, name: string, isActive: boolean) {
		const setting = new Setting(containerEl);

		// Name with active indicator
		if (isActive) {
			setting.setName(`${name} ✓`);
			setting.setDesc('Currently active');
		} else {
			setting.setName(name);
		}

		// Load button
		setting.addExtraButton(button => button
			.setIcon('upload')
			.setTooltip('Load workspace')
			.onClick(async () => {
				await this.plugin.loadWorkspace(name);
				new Notice(`Loaded workspace: ${name}`);
				this.close();
			}));

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
