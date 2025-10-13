// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import WorkspaceNavigator from './main';

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

	// Workspace management
	showDeleteConfirmation:          boolean;

	// Auto-save options
	autoSaveOnSwitch:                boolean;

	// Sorting preferences
	sortWorkspacesAlphabetically:    boolean;

	// Debug mode
	debugMode:                       boolean;
}

export const DEFAULT_SETTINGS: WorkspaceNavigatorSettings = {
	rememberNavigationLayout:        true,
	maintainLayoutAcrossWorkspaces:  false,
	showStatusBar:                   true,
	showInstructions:                true,
	showDeleteConfirmation:          true,
	autoSaveOnSwitch:                false,
	sortWorkspacesAlphabetically:    true,
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
		// Navigation Layout Settings
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'Navigation Layout Settings' });

		new Setting(containerEl)
			.setName('Remember navigation layout per workspace')
			.setDesc('When enabled, each workspace remembers its own navigation panel state including: sidebar open/closed, active tab, and folder expansion state (which directories are expanded/collapsed in the file explorer). When disabled, navigation state is maintained from the previous workspace.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.rememberNavigationLayout)
				.onChange(async (value) => {
					this.plugin.settings.rememberNavigationLayout = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Maintain layout across workspaces')
			.setDesc('Keep the current navigation layout when switching workspaces instead of loading the saved layout. This option only works when "Remember navigation layout" is enabled.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.maintainLayoutAcrossWorkspaces)
				.onChange(async (value) => {
					this.plugin.settings.maintainLayoutAcrossWorkspaces = value;
					await this.plugin.saveSettings();
				}));

		// ─────────────────────────────────────────────────────────────────
		// General Settings
		// ─────────────────────────────────────────────────────────────────

		containerEl.createEl('h2', { text: 'General Settings' });

		new Setting(containerEl)
			.setName('Show status bar indicator')
			.setDesc('Display the current workspace name in the status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					this.plugin.updateStatusBar();
				}));

		new Setting(containerEl)
			.setName('Show instructions in modal')
			.setDesc('Display keyboard shortcuts at the bottom of the workspace switcher modal')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInstructions)
				.onChange(async (value) => {
					this.plugin.settings.showInstructions = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show workspace delete confirmation')
			.setDesc('Display a confirmation dialog before deleting a workspace')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showDeleteConfirmation)
				.onChange(async (value) => {
					this.plugin.settings.showDeleteConfirmation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sort workspaces alphabetically')
			.setDesc('Display workspaces in alphabetical/numerical order in the switcher modal')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.sortWorkspacesAlphabetically)
				.onChange(async (value) => {
					this.plugin.settings.sortWorkspacesAlphabetically = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-save on workspace switch')
			.setDesc('Automatically save the current workspace before switching to another')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveOnSwitch)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveOnSwitch = value;
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
