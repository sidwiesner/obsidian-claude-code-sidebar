import { App, PluginSettingTab, Setting } from 'obsidian';
import type AIChatPlugin from './main';

export class AIChatSettingTab extends PluginSettingTab {
	plugin: AIChatPlugin;

	constructor(app: App, plugin: AIChatPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Claude Code Settings' });

		// === Executable Paths ===
		containerEl.createEl('h3', { text: 'Executable Paths' });

		new Setting(containerEl)
			.setName('Node.js location')
			.setDesc('Path to Node.js executable. Leave empty to auto-detect.')
			.addText(text => text
				.setPlaceholder('Auto-detect (e.g., /usr/local/bin/node)')
				.setValue(this.plugin.settings.nodeLocation || '')
				.onChange(async (value) => {
					this.plugin.settings.nodeLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Claude Code location')
			.setDesc('Path to Claude Code executable. Leave empty to auto-detect.')
			.addText(text => text
				.setPlaceholder('Auto-detect (e.g., ~/.claude/local/node_modules/.bin/claude)')
				.setValue(this.plugin.settings.claudeLocation || '')
				.onChange(async (value) => {
					this.plugin.settings.claudeLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Python path')
			.setDesc('Path to Python 3 executable for the PTY helper.')
			.addText(text => text
				.setPlaceholder('python3')
				.setValue(this.plugin.settings.pythonPath || 'python3')
				.onChange(async (value) => {
					this.plugin.settings.pythonPath = value || 'python3';
					await this.plugin.saveSettings();
				}));

		// === Terminal Appearance ===
		containerEl.createEl('h3', { text: 'Terminal Appearance' });

		new Setting(containerEl)
			.setName('Font size')
			.setDesc('Terminal font size in pixels.')
			.addText(text => text
				.setPlaceholder('13')
				.setValue(String(this.plugin.settings.terminalFontSize || 13))
				.onChange(async (value) => {
					const size = parseInt(value) || 13;
					this.plugin.settings.terminalFontSize = Math.max(8, Math.min(24, size));
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Font family')
			.setDesc('Terminal font family (monospace fonts recommended).')
			.addText(text => text
				.setPlaceholder('Menlo, Monaco, "Courier New", monospace')
				.setValue(this.plugin.settings.terminalFontFamily || '')
				.onChange(async (value) => {
					this.plugin.settings.terminalFontFamily = value || 'Menlo, Monaco, "Courier New", monospace';
					await this.plugin.saveSettings();
				}));

		// === Behavior ===
		containerEl.createEl('h3', { text: 'Behavior' });

		new Setting(containerEl)
			.setName('Ask before edits')
			.setDesc('When enabled, Claude will ask for confirmation before making file changes. Disable to allow automatic edits (uses --dangerously-skip-permissions).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.askBeforeEdits !== false)
				.onChange(async (value) => {
					this.plugin.settings.askBeforeEdits = value;
					await this.plugin.saveSettings();
				}));

		// === Debug ===
		containerEl.createEl('h3', { text: 'Debug' });

		new Setting(containerEl)
			.setName('Debug context')
			.setDesc('Enable debug logging for troubleshooting (logs to console).')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.debugContext === true)
				.onChange(async (value) => {
					this.plugin.settings.debugContext = value;
					await this.plugin.saveSettings();
				}));
	}
}
