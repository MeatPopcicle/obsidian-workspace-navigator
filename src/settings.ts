// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import WorkspaceNavigator from './main';
import { createConfirmationDialog } from './confirm-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Settings Interface
// ───────────────────────────────────────────────────────────────────────────────

export interface WorkspaceNavigatorSettings {
	// Navigation layout memory behavior
	rememberNavigationLayout:        boolean;
	maintainLayoutAcrossWorkspaces:  boolean;

	// UI preferences
	showStatusBar:                   boolean;
	showInstructions:                boolean;
	showSearchBox:                   boolean;
	transparentModal:                boolean;

	// Workspace management
	showDeleteConfirmation:          boolean;
	defaultGroup:                    string;

	// Auto-save options
	autoSaveOnSwitch:                boolean;
	autoSaveOnLayoutChange:          boolean;

	// Sorting preferences
	manualSortOrder:                 boolean;

	// Backup settings
	autoBackupEnabled:               boolean;
	autoBackupPath:                  string;

	// Debug mode
	debugMode:                       boolean;
}

export const DEFAULT_SETTINGS: WorkspaceNavigatorSettings = {
	rememberNavigationLayout:        true,
	maintainLayoutAcrossWorkspaces:  false,
	showStatusBar:                   true,
	showInstructions:                true,
	showSearchBox:                   false,
	transparentModal:                false,
	showDeleteConfirmation:          true,
	defaultGroup:                    '',
	autoSaveOnSwitch:                false,
	autoSaveOnLayoutChange:          false,
	manualSortOrder:                 false,
	autoBackupEnabled:               false,
	autoBackupPath:                  '',
	debugMode:                       false,
};

// ───────────────────────────────────────────────────────────────────────────────
// Settings Tab
// ───────────────────────────────────────────────────────────────────────────────

export class WorkspaceNavigatorSettingTab extends PluginSettingTab {
	plugin: WorkspaceNavigator;

	constructor(app: App, plugin: WorkspaceNavigator) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ─────────────────────────────────────────────────────────────────
		// Layout Memory
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Layout Memory' });

		new Setting(containerEl)
			.setName('Remember navigation layout per workspace')
			.setDesc('Each workspace remembers its own navigation panel state (sidebar, active tab, folder expansion). When disabled, navigation state carries over from the previous workspace.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rememberNavigationLayout)
				.onChange(async (value) => {
					this.plugin.settings.rememberNavigationLayout = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maintain layout across workspaces')
			.setDesc('Keep current navigation layout when switching instead of loading saved layout. Only works when "Remember navigation layout" is enabled.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.maintainLayoutAcrossWorkspaces)
				.onChange(async (value) => {
					this.plugin.settings.maintainLayoutAcrossWorkspaces = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-save on workspace switch')
			.setDesc('Automatically save the current workspace layout before switching to another.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveOnSwitch)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveOnSwitch = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-save on layout change')
			.setDesc('Automatically save whenever the layout changes (panels, panes, folders). Can result in frequent saves.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveOnLayoutChange)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveOnLayoutChange = value;
					await this.plugin.saveSettings();
				}));

		// ─────────────────────────────────────────────────────────────────
		// Switcher Appearance
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Switcher Appearance' });

		new Setting(containerEl)
			.setName('Show status bar indicator')
			.setDesc('Display the current workspace name in the status bar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
				}));

		new Setting(containerEl)
			.setName('Show keyboard shortcuts')
			.setDesc('Display keyboard shortcut hints at the bottom of the switcher modal.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInstructions)
				.onChange(async (value) => {
					this.plugin.settings.showInstructions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Transparent modal')
			.setDesc('Make the switcher modal transparent and borderless, showing workspace cards floating over the editor.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.transparentModal)
				.onChange(async (value) => {
					this.plugin.settings.transparentModal = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reset all workspace styles')
			.setDesc('Clear all icons, colors, and formatting from all workspaces.')
			.addButton(button => button
				.setButtonText('Reset Styles')
				.setWarning()
				.onClick(async () => {
					createConfirmationDialog(this.app, {
						title:   'Reset All Styles?',
						text:    'This will remove all icons, colors, and formatting from all workspaces. This cannot be undone.',
						cta:     'Reset All',
						onAccept: async () => {
							this.plugin.getWorkspaceManager().clearAllStyles();
							this.plugin.updateStatusBar();
							await this.plugin.saveSettings();
							new Notice('All workspace styles have been reset');
						}
					});
				}));

		// ─────────────────────────────────────────────────────────────────
		// Workspace Behavior
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Workspace Behavior' });

		// Dynamic description for sort order toggle
		const getSortDescription = (isManual: boolean) => {
			return isManual
				? 'Currently: Manual order — drag workspaces to reorder within groups.'
				: 'Currently: Alphabetical order (A-Z, 0-9).';
		};

		const sortSetting = new Setting(containerEl)
			.setName('Manual sort order')
			.setDesc(getSortDescription(this.plugin.settings.manualSortOrder))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.manualSortOrder)
				.onChange(async (value) => {
					this.plugin.settings.manualSortOrder = value;
					await this.plugin.saveSettings();
					// Update description dynamically
					sortSetting.setDesc(getSortDescription(value));
				}));

		new Setting(containerEl)
			.setName('Default group for new workspaces')
			.setDesc('Automatically assign new workspaces to this group.')
			.addDropdown(dropdown => {
				const groups = this.plugin.getWorkspaceManager().getGroups();
				dropdown.addOption('', '(None)');
				for (const group of groups) {
					dropdown.addOption(group, group);
				}
				// If the saved default points at a group that no longer exists,
				// reset to (None) instead of silently showing the first option while
				// still assigning new workspaces to the ghost group.
				if (this.plugin.settings.defaultGroup && !groups.includes(this.plugin.settings.defaultGroup)) {
					this.plugin.settings.defaultGroup = '';
					this.plugin.saveSettings();
				}
				dropdown.setValue(this.plugin.settings.defaultGroup);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultGroup = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Confirm before deleting')
			.setDesc('Show a confirmation dialog before deleting a workspace.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDeleteConfirmation)
				.onChange(async (value) => {
					this.plugin.settings.showDeleteConfirmation = value;
					await this.plugin.saveSettings();
				}));

		// ─────────────────────────────────────────────────────────────────
		// Import/Export Settings
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Import / Export' });

		new Setting(containerEl)
			.setName('Import from Obsidian core Workspaces plugin')
			.setDesc('Import all workspaces from the built-in Workspaces plugin (.obsidian/workspaces.json). Existing workspaces with the same name will be skipped.')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(async () => {
					const result = await this.plugin.getWorkspaceManager().importFromCorePlugin(false);
					await this.plugin.saveSettings();

					if (result.imported.length > 0) {
						new Notice(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`);
					}
					if (result.skipped.length > 0) {
						new Notice(`Skipped ${result.skipped.length} existing workspace(s)`);
					}
					if (result.imported.length === 0 && result.skipped.length === 0) {
						new Notice('No workspaces to import');
					}
				}));

		new Setting(containerEl)
			.setName('Import and overwrite')
			.setDesc('Import all workspaces from the core plugin. WARNING: This will DELETE all existing workspaces first!')
			.addButton(button => button
				.setButtonText('Import (Overwrite)')
				.setWarning()
				.onClick(async () => {
					const existingCount = this.plugin.getWorkspaceManager().getWorkspaceNames().length;

					createConfirmationDialog(this.app, {
						title:   'Overwrite All Workspaces?',
						text:    `This will DELETE all ${existingCount} existing workspace(s) and replace them with workspaces from the core plugin. This cannot be undone.`,
						cta:     'Delete & Import',
						onAccept: async () => {
							const result = await this.plugin.getWorkspaceManager().importFromCorePlugin(true);
							await this.plugin.saveSettings();

							if (result.imported.length > 0) {
								new Notice(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`);
							}
							if (result.imported.length === 0) {
								new Notice('No workspaces to import');
							}
						}
					});
				}));

		// ─────────────────────────────────────────────────────────────────
		// Backup Settings
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Backup' });

		new Setting(containerEl)
			.setName('Auto-backup on save')
			.setDesc('Automatically write a backup of all settings and workspaces whenever configuration changes.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoBackupEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoBackupEnabled = value;
					await this.plugin.saveSettings();
					if (value && !this.plugin.settings.autoBackupPath) {
						new Notice('Set a backup path below to enable auto-backup.');
					}
				}));

		new Setting(containerEl)
			.setName('Backup path')
			.setDesc('Directory path where backup file will be saved (e.g., /home/user/backups or C:\\backups). Leave empty to use vault root.')
			.addText(text => text
				.setPlaceholder('Enter absolute path...')
				.setValue(this.plugin.settings.autoBackupPath)
				.onChange(async (value) => {
					this.plugin.settings.autoBackupPath = value.trim();
					await this.plugin.saveSettings();
				}));

		// ─────────────────────────────────────────────────────────────────
		// Debug Settings
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Debug Settings' });

		new Setting(containerEl)
			.setName('Enable debug mode')
			.setDesc('Log detailed information about folder expansion state and workspace operations to the console (open Developer Tools to view)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
					if (value) {
						new Notice('Debug mode enabled. Open Developer Tools (Ctrl+Shift+I) to view logs.');
					}
				}));
	}
}
