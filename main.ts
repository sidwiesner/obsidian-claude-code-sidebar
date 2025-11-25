import { Plugin, WorkspaceLeaf } from 'obsidian';
import { ClaudeTerminalView, VIEW_TYPE_CLAUDE_TERMINAL } from './ClaudeTerminalView';
import { SessionManager } from './SessionManager';
import { AIChatSettingTab } from './SettingsTab';
import { AIChatSettings, DEFAULT_SETTINGS } from './types';

export default class AIChatPlugin extends Plugin {
	settings: AIChatSettings;
	sessionManager: SessionManager;

	async onload() {
		await this.loadSettings();

		// Initialize session manager
		this.sessionManager = new SessionManager(this);
		await this.sessionManager.load();

		// Get plugin path for resources (must be absolute)
		const vaultBasePath = (this.app.vault.adapter as any).basePath;
		const relativePluginPath = (this.manifest as any).dir || this.app.vault.configDir + '/plugins/' + this.manifest.id;
		const pluginPath = relativePluginPath.startsWith('/')
			? relativePluginPath
			: vaultBasePath + '/' + relativePluginPath;

		// Register the Claude terminal view
		this.registerView(
			VIEW_TYPE_CLAUDE_TERMINAL,
			(leaf) => new ClaudeTerminalView(leaf, this.settings, this.sessionManager, pluginPath)
		);

		// Add command to open Claude terminal
		this.addCommand({
			id: 'open-claude-terminal',
			name: 'Open Claude Code terminal',
			callback: () => this.activateView()
		});

		// Add command to focus/unfocus terminal (Cmd+Esc)
		this.addCommand({
			id: 'toggle-claude-focus',
			name: 'Toggle focus on Claude terminal',
			hotkeys: [{ modifiers: ['Mod'], key: 'Escape' }],
			callback: () => this.toggleTerminalFocus()
		});

		// Open the view in the right sidebar by default
		if (this.app.workspace.layoutReady) {
			await this.activateView();
		} else {
			this.app.workspace.onLayoutReady(async () => {
				await this.activateView();
			});
		}

		// Add settings tab
		this.addSettingTab(new AIChatSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CLAUDE_TERMINAL);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CLAUDE_TERMINAL);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: VIEW_TYPE_CLAUDE_TERMINAL, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	toggleTerminalFocus() {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CLAUDE_TERMINAL);
		if (leaves.length > 0) {
			const view = leaves[0].view as ClaudeTerminalView;
			// Check if terminal is focused by checking document.activeElement
			const terminalContainer = leaves[0].view.containerEl;
			const isTerminalFocused = terminalContainer.contains(document.activeElement);

			if (isTerminalFocused) {
				// Blur terminal, focus on last active leaf
				view.blurTerminal();
				// Try to focus the most recent non-terminal leaf
				const allLeaves = this.app.workspace.getLeavesOfType('markdown');
				if (allLeaves.length > 0) {
					this.app.workspace.setActiveLeaf(allLeaves[0], { focus: true });
				}
			} else {
				// Focus terminal
				this.app.workspace.revealLeaf(leaves[0]);
				view.focusTerminal();
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
