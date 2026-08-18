// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { notify } from './notify';
import WorkspaceNavigator from './main';
import { createConfirmationDialog, createTypedConfirmationDialog } from './confirm-modal';

// ───────────────────────────────────────────────────────────────────────────────
// Settings Interface
// ───────────────────────────────────────────────────────────────────────────────

export interface WorkspaceNavigatorSettings {
	// Navigation layout memory behavior
	rememberNavigationLayout:        boolean;
	maintainLayoutAcrossWorkspaces:  boolean;

	// UI preferences
	showStatusBar:                   boolean;
	showGroupInStatusBar:            boolean;
	highlightActiveWorkspace:        boolean;
	showStyleSettingsInSidebar:      boolean;
	showStyleSettingsInModal:        boolean;
	showInstructions:                boolean;
	showSearchBox:                   boolean;
	transparentModal:                boolean;

	// Workspace management
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
	showGroupInStatusBar:            true,
	highlightActiveWorkspace:        true,
	showStyleSettingsInSidebar:      true,
	showStyleSettingsInModal:        true,
	showInstructions:                false,
	showSearchBox:                   false,
	transparentModal:                true,
	defaultGroup:                    '',
	autoSaveOnSwitch:                true,
	autoSaveOnLayoutChange:          true,
	manualSortOrder:                 true,
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
		containerEl.addClass('wn-root');

		// A collapsible section (native <details>); returns the body element to
		// append Settings into. Top sections start open; advanced ones collapsed.
		const section = (title: string, collapsed = false): HTMLElement => {
			const details = containerEl.createEl('details', { cls: 'wn-settings-section' });
			if (!collapsed) details.setAttribute('open', '');
			details.createEl('summary', { cls: 'wn-settings-summary', text: title });
			return details.createDiv('wn-settings-body');
		};
		// Mark a setting as an indented dependent (sub-option) and set its
		// initial visibility. Toggle .settingEl.style.display to show/hide later.
		const dependent = (setting: Setting, visible: boolean): Setting => {
			setting.settingEl.addClass('wn-setting-indent');
			setting.settingEl.style.display = visible ? '' : 'none';
			return setting;
		};

		// ── Saving & layout ──────────────────────────────────────────────
		const saving = section('Saving & layout');

		new Setting(saving)
			.setName('Remember navigation layout per workspace')
			.setDesc('Each workspace remembers its own navigation panel state (sidebar, active tab, folder expansion). When off, navigation state carries over from the previous workspace.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rememberNavigationLayout)
				.onChange(async (value) => {
					this.plugin.settings.rememberNavigationLayout = value;
					await this.plugin.saveSettings();
					maintainSetting.settingEl.style.display = value ? '' : 'none';
				}));

		const maintainSetting = dependent(
			new Setting(saving)
				.setName('Maintain layout across workspaces')
				.setDesc('Keep the current navigation layout when switching, instead of loading each workspace\'s saved layout.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.maintainLayoutAcrossWorkspaces)
					.onChange(async (value) => {
						this.plugin.settings.maintainLayoutAcrossWorkspaces = value;
						await this.plugin.saveSettings();
					})),
			this.plugin.settings.rememberNavigationLayout
		);

		new Setting(saving)
			.setName('Auto-save on workspace switch')
			.setDesc('Automatically save the current workspace layout before switching to another.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveOnSwitch)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveOnSwitch = value;
					await this.plugin.saveSettings();
				}));

		new Setting(saving)
			.setName('Auto-save on layout change')
			.setDesc('Automatically save whenever the layout changes (panels, panes, folders). Can result in frequent saves.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveOnLayoutChange)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveOnLayoutChange = value;
					await this.plugin.saveSettings();
				}));

		// ── Workspaces ───────────────────────────────────────────────────
		const workspaces = section('Workspaces');

		const getSortDescription = (isManual: boolean) =>
			isManual
				? 'Currently: Manual order — drag workspaces to reorder within groups.'
				: 'Currently: Alphabetical order (A-Z, 0-9).';

		const sortSetting = new Setting(workspaces)
			.setName('Manual sort order')
			.setDesc(getSortDescription(this.plugin.settings.manualSortOrder))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.manualSortOrder)
				.onChange(async (value) => {
					this.plugin.settings.manualSortOrder = value;
					await this.plugin.saveSettings();
					sortSetting.setDesc(getSortDescription(value));
				}));

		new Setting(workspaces)
			.setName('Default group for new workspaces')
			.setDesc('Automatically assign new workspaces to this group.')
			.addDropdown(dropdown => {
				const groups = this.plugin.getWorkspaceManager().getGroups();
				dropdown.addOption('', '(None)');
				for (const group of groups) {
					dropdown.addOption(group, group);
				}
				// If the saved default points at a group that no longer exists,
				// reset to (None) instead of silently assigning to a ghost group.
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

		// ── Appearance ───────────────────────────────────────────────────
		const appearance = section('Appearance');

		new Setting(appearance)
			.setName('Highlight active workspace')
			.setDesc('Emphasize the current workspace in the sidebar and switcher with an accent bar and tinted background. Leaves your custom name colors untouched; the checkmark shows regardless.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.highlightActiveWorkspace)
				.onChange(async (value) => {
					this.plugin.settings.highlightActiveWorkspace = value;
					await this.plugin.saveSettings();
					this.plugin.refreshSidebarView();
				}));

		new Setting(appearance)
			.setName('Transparent switcher modal')
			.setDesc('Make the switcher modal transparent and borderless, showing workspace cards floating over the editor.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.transparentModal)
				.onChange(async (value) => {
					this.plugin.settings.transparentModal = value;
					await this.plugin.saveSettings();
				}));

		new Setting(appearance)
			.setName('Keyboard-shortcut hints in switcher')
			.setDesc('Display keyboard shortcut hints at the bottom of the switcher modal.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInstructions)
				.onChange(async (value) => {
					this.plugin.settings.showInstructions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(appearance)
			.setName('Show status-bar indicator')
			.setDesc('Display the current workspace name in the status bar.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
					statusGroupSetting.settingEl.style.display = value ? '' : 'none';
				}));

		const statusGroupSetting = dependent(
			new Setting(appearance)
				.setName('Show group in status bar')
				.setDesc('Also show the active workspace\'s group (e.g. "Group › Workspace").')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.showGroupInStatusBar)
					.onChange(async (value) => {
						this.plugin.settings.showGroupInStatusBar = value;
						await this.plugin.saveSettings();
						this.plugin.updateStatusBar();
					})),
			this.plugin.settings.showStatusBar
		);

		// ── Theming (Style Settings) ─────────────────────────────────────
		const theming = section('Theming (Style Settings)');
		const ssRow = new Setting(theming).setName('Style Settings');
		if (this.plugin.isStyleSettingsEnabled()) {
			ssRow
				.setDesc('Theme the active highlight, guide lines, density, and sizing.')
				.addButton(button => button
					.setButtonText('Open Style Settings')
					.setCta()
					.onClick(() => this.plugin.openStyleSettings()));

			dependent(
				new Setting(theming)
					.setName('Show shortcut button in sidebar')
					.setDesc('Add a button to the sidebar header that opens Style Settings.')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.showStyleSettingsInSidebar)
						.onChange(async (value) => {
							this.plugin.settings.showStyleSettingsInSidebar = value;
							await this.plugin.saveSettings();
							this.plugin.refreshSidebarView();
						})),
				true
			);

			dependent(
				new Setting(theming)
					.setName('Show shortcut button in switcher')
					.setDesc('Add a button to the switcher modal that opens Style Settings.')
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.showStyleSettingsInModal)
						.onChange(async (value) => {
							this.plugin.settings.showStyleSettingsInModal = value;
							await this.plugin.saveSettings();
						})),
				true
			);
		} else {
			ssRow.setDesc('Install the community plugin "Style Settings" to theme Workspace Navigator (active highlight, guide lines, density, sizing).');
		}

		// ── Import & backup (advanced, collapsed) ────────────────────────
		const importBackup = section('Import & backup', true);

		new Setting(importBackup)
			.setName('Import from Obsidian core Workspaces plugin')
			.setDesc('Import all workspaces from the built-in Workspaces plugin (.obsidian/workspaces.json). Existing workspaces with the same name are skipped.')
			.addButton(button => button
				.setButtonText('Import')
				.onClick(async () => {
					const result = await this.plugin.getWorkspaceManager().importFromCorePlugin(false);
					await this.plugin.saveSettings();

					if (result.imported.length > 0) {
						notify(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`, 'success');
					}
					if (result.skipped.length > 0) {
						notify(`Skipped ${result.skipped.length} existing workspace(s)`);
					}
					if (result.imported.length === 0 && result.skipped.length === 0) {
						notify('No workspaces to import', 'error');
					}
				}));

		new Setting(importBackup)
			.setName('Import and overwrite')
			.setDesc('Import all workspaces from the core plugin. WARNING: deletes all existing workspaces first.')
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
								notify(`Imported ${result.imported.length} workspace(s): ${result.imported.join(', ')}`, 'success');
							}
							if (result.imported.length === 0) {
								notify('No workspaces to import', 'error');
							}
						}
					});
				}));

		new Setting(importBackup)
			.setName('Auto-backup on save')
			.setDesc('Automatically write a backup of all settings and workspaces whenever configuration changes. (Desktop only.)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoBackupEnabled)
				.onChange(async (value) => {
					this.plugin.settings.autoBackupEnabled = value;
					await this.plugin.saveSettings();
					backupPathSetting.settingEl.style.display = value ? '' : 'none';
					if (value && !this.plugin.settings.autoBackupPath) {
						notify('Set a backup folder below to enable auto-backup.');
					}
				}));

		const backupPathSetting = dependent(
			new Setting(importBackup)
				.setName('Backup folder')
				.setDesc('Absolute path where the backup file is saved (e.g. /home/user/backups or C:\\backups). Leave empty to use the vault root.')
				.addText(text => text
					.setPlaceholder('Enter absolute path...')
					.setValue(this.plugin.settings.autoBackupPath)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupPath = value.trim();
						await this.plugin.saveSettings();
					})),
			this.plugin.settings.autoBackupEnabled
		);

		// ── Maintenance (advanced, collapsed) ────────────────────────────
		const maintenance = section('Maintenance', true);

		new Setting(maintenance)
			.setName('Debug mode')
			.setDesc('Log detailed information about folder expansion state and workspace operations to the console (open Developer Tools to view).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugMode)
				.onChange(async (value) => {
					this.plugin.settings.debugMode = value;
					await this.plugin.saveSettings();
					if (value) {
						notify('Debug mode enabled. Open Developer Tools (Ctrl+Shift+I) to view logs.');
					}
				}));

		// ── Danger zone (destructive actions, bordered, always last) ─────
		const danger = maintenance.createDiv('wn-danger-zone');
		danger.createEl('div', { cls: 'wn-danger-zone-heading', text: 'Danger zone' });

		new Setting(danger)
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
							notify('All workspace styles have been reset', 'success');
						}
					});
				}));

		new Setting(danger)
			.setName('Reset settings to defaults')
			.setDesc('Restore every plugin setting to its shipped default. Workspaces, groups, and styles are not touched.')
			.addButton(button => button
				.setButtonText('Reset Settings')
				.setWarning()
				.onClick(async () => {
					createConfirmationDialog(this.app, {
						title:   'Reset Settings?',
						text:    'This will restore all plugin settings to their defaults. Your workspaces, groups, and styles are kept. This cannot be undone.',
						cta:     'Reset',
						onAccept: async () => {
							Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
							await this.plugin.saveSettings();
							this.plugin.updateStatusBar();
							this.plugin.refreshSidebarView();
							this.display();  // re-render the tab with default values
							notify('Settings reset to defaults', 'success');
						}
					});
				}));

		new Setting(danger)
			.setName('Delete all workspaces')
			.setDesc('Remove every workspace and group. The plugin returns to a fresh, empty state. Settings are kept.')
			.addButton(button => button
				.setButtonText('Delete All')
				.setWarning()
				.onClick(async () => {
					createTypedConfirmationDialog(this.app, {
						title:        'Delete All Workspaces?',
						text:         'This permanently removes every workspace, group, and style. This cannot be undone.',
						requiredText: 'DELETE',
						cta:          'Delete All',
						onAccept: async () => {
							this.plugin.getWorkspaceManager().resetAllWorkspaces();
							this.plugin.navigationLayouts.clear();
							// The default group no longer exists; mirror the ghost-group guard above.
							this.plugin.settings.defaultGroup = '';
							await this.plugin.saveSettings();
							this.plugin.refreshWorkspaceCommands();
							this.plugin.updateStatusBar();
							this.plugin.refreshSidebarView();
							this.display();
							notify('All workspaces deleted', 'success');
						}
					});
				}));
	}
}
