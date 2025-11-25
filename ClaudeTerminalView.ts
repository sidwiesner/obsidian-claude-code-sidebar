import { ItemView, WorkspaceLeaf, setIcon, Menu } from 'obsidian';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TerminalManager } from './TerminalManager';
import { SessionManager, Session } from './SessionManager';
import { CommandDetector } from './commandDetector';
import type { AIChatSettings } from './types';

export const VIEW_TYPE_CLAUDE_TERMINAL = 'claude-terminal-view';

export class ClaudeTerminalView extends ItemView {
	private settings: AIChatSettings;
	private sessionManager: SessionManager;
	private terminalManager: TerminalManager | null = null;
	private terminal: Terminal | null = null;
	private fitAddon: FitAddon | null = null;
	private pluginPath: string;

	// UI Elements
	private headerEl: HTMLElement;
	private terminalContainerEl: HTMLElement;
	private emptyStateEl: HTMLElement;
	private footerEl: HTMLElement;
	private sessionDropdown: HTMLElement;
	private timerEl: HTMLElement;
	private fileChipEl: HTMLElement;
	private askBeforeEditsToggle: HTMLElement;

	// State
	private isSessionActive: boolean = false;
	private sessionStartTime: number = 0;
	private timerInterval: number | null = null;
	private currentSessionId: string | null = null;
	private resizeObserver: ResizeObserver | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		settings: AIChatSettings,
		sessionManager: SessionManager,
		pluginPath: string
	) {
		super(leaf);
		this.settings = settings;
		this.sessionManager = sessionManager;
		this.pluginPath = pluginPath;
	}

	getViewType(): string {
		return VIEW_TYPE_CLAUDE_TERMINAL;
	}

	getDisplayText(): string {
		return 'Claude Code';
	}

	getIcon(): string {
		return 'terminal';
	}

	async onOpen(): Promise<void> {
		this.contentEl.empty();
		this.contentEl.addClass('claude-terminal-container');

		this.createHeader();
		this.createTerminalArea();
		this.createFooter();

		// Load sessions
		await this.sessionManager.load();
	}

	async onClose(): Promise<void> {
		this.stopTimer();
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		if (this.terminalManager) {
			this.terminalManager.kill();
		}
		if (this.terminal) {
			this.terminal.dispose();
		}
	}

	// ==================== Header ====================

	private createHeader(): void {
		this.headerEl = this.contentEl.createEl('div', { cls: 'claude-header' });

		// Past Conversations dropdown
		this.sessionDropdown = this.headerEl.createEl('div', { cls: 'claude-session-dropdown' });
		const dropdownBtn = this.sessionDropdown.createEl('button', { cls: 'claude-dropdown-btn' });
		dropdownBtn.createEl('span', { text: 'Past Conversations', cls: 'claude-dropdown-text' });
		const chevron = dropdownBtn.createEl('span', { cls: 'claude-dropdown-chevron' });
		setIcon(chevron, 'chevron-down');

		dropdownBtn.addEventListener('click', (e) => this.showSessionMenu(e));

		// New conversation button
		const newBtn = this.headerEl.createEl('button', { cls: 'claude-new-btn' });
		setIcon(newBtn, 'plus');
		newBtn.setAttribute('aria-label', 'New conversation');
		newBtn.addEventListener('click', () => this.startNewSession());
	}

	private showSessionMenu(e: MouseEvent): void {
		const menu = new Menu();
		const sessions = this.sessionManager.listSessions();

		if (sessions.length === 0) {
			menu.addItem((item) => {
				item.setTitle('No past conversations');
				item.setDisabled(true);
			});
		} else {
			sessions.slice(0, 20).forEach((session) => {
				menu.addItem((item) => {
					const date = new Date(session.timestamp);
					const preview = session.preview.length > 40
						? session.preview.substring(0, 40) + '...'
						: session.preview;
					item.setTitle(`${preview}`);
					item.onClick(() => this.resumeSession(session.id));
				});
			});
		}

		menu.showAtMouseEvent(e);
	}

	// ==================== Terminal Area ====================

	private createTerminalArea(): void {
		const mainArea = this.contentEl.createEl('div', { cls: 'claude-main-area' });

		// Empty state
		this.emptyStateEl = mainArea.createEl('div', { cls: 'claude-empty-state' });
		this.createEmptyState();

		// Terminal container (hidden initially)
		this.terminalContainerEl = mainArea.createEl('div', { cls: 'claude-terminal-wrapper hidden' });
	}

	private createEmptyState(): void {
		const logo = this.emptyStateEl.createEl('div', { cls: 'claude-logo' });
		logo.innerHTML = `<span class="claude-logo-icon">✴</span> Claude Code`;

		const mascot = this.emptyStateEl.createEl('div', { cls: 'claude-mascot' });
		mascot.textContent = '🐷';

		const hint = this.emptyStateEl.createEl('div', { cls: 'claude-hint' });
		hint.textContent = "// TODO: Everything. Let's start.";

		// Click to start
		this.emptyStateEl.addEventListener('click', () => this.startNewSession());
		this.emptyStateEl.style.cursor = 'pointer';
	}

	private initializeTerminal(): void {
		if (this.terminal) {
			this.terminal.dispose();
		}

		this.terminal = new Terminal({
			cursorBlink: true,
			fontSize: this.settings.terminalFontSize || 13,
			fontFamily: this.settings.terminalFontFamily || 'Menlo, Monaco, "Courier New", monospace',
			theme: {
				background: '#1e1e1e',
				foreground: '#d4d4d4',
				cursor: '#d4d4d4',
				cursorAccent: '#1e1e1e',
				selectionBackground: '#264f78',
			},
			allowProposedApi: true,
		});

		this.fitAddon = new FitAddon();
		this.terminal.loadAddon(this.fitAddon);
		this.terminal.loadAddon(new WebLinksAddon());

		// Try WebGL addon, fallback to canvas if not supported
		try {
			const webgl = new WebglAddon();
			webgl.onContextLoss(() => {
				webgl.dispose();
			});
			this.terminal.loadAddon(webgl);
		} catch (e) {
			// Canvas renderer will be used as fallback
		}

		this.terminal.open(this.terminalContainerEl);

		// Initial fit after a short delay to ensure DOM is ready
		setTimeout(() => {
			this.fitTerminal();
		}, 50);

		// Set up resize observer for the terminal container
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
		}
		this.resizeObserver = new ResizeObserver(() => {
			// Debounce resize events
			if (this.terminal) {
				this.fitTerminal();
			}
		});
		this.resizeObserver.observe(this.terminalContainerEl);

		// Handle terminal input
		this.terminal.onData((data) => {
			if (this.terminalManager) {
				this.terminalManager.write(data);
			}
		});

		// Handle terminal resize
		this.terminal.onResize(({ cols, rows }) => {
			if (this.terminalManager) {
				this.terminalManager.resize(cols, rows);
			}
		});
	}

	private fitTerminal(): void {
		if (this.fitAddon && this.terminal) {
			try {
				this.fitAddon.fit();
			} catch (e) {
				// Ignore fit errors during initialization
			}
		}
	}

	// ==================== Footer ====================

	private createFooter(): void {
		this.footerEl = this.contentEl.createEl('div', { cls: 'claude-footer' });

		// Focus hint
		const hintEl = this.footerEl.createEl('div', { cls: 'claude-focus-hint' });
		hintEl.textContent = '⌘ Esc to focus or unfocus Claude';

		// Status bar
		const statusBar = this.footerEl.createEl('div', { cls: 'claude-status-bar' });

		// Ask before edits toggle
		this.askBeforeEditsToggle = statusBar.createEl('div', { cls: 'claude-toggle' });
		const toggleIcon = this.askBeforeEditsToggle.createEl('span', { cls: 'claude-toggle-icon' });
		setIcon(toggleIcon, 'pencil');
		this.askBeforeEditsToggle.createEl('span', { text: 'Ask before edits', cls: 'claude-toggle-text' });
		this.askBeforeEditsToggle.classList.toggle('active', this.settings.askBeforeEdits !== false);
		this.askBeforeEditsToggle.addEventListener('click', () => this.toggleAskBeforeEdits());

		// Current file chip
		this.fileChipEl = statusBar.createEl('div', { cls: 'claude-file-chip' });
		const fileIcon = this.fileChipEl.createEl('span', { cls: 'claude-file-icon' });
		setIcon(fileIcon, 'file-text');
		const fileName = this.fileChipEl.createEl('span', { cls: 'claude-file-name' });
		this.updateFileChip();
		this.fileChipEl.addEventListener('click', () => this.insertCurrentFilePath());

		// Register for active file changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => this.updateFileChip())
		);

		// Spacer
		statusBar.createEl('div', { cls: 'claude-spacer' });

		// Timer
		this.timerEl = statusBar.createEl('div', { cls: 'claude-timer' });
		const timerIcon = this.timerEl.createEl('span', { cls: 'claude-timer-icon' });
		setIcon(timerIcon, 'clock');
		this.timerEl.createEl('span', { text: '0:00', cls: 'claude-timer-text' });
	}

	private updateFileChip(): void {
		const activeFile = this.app.workspace.getActiveFile();
		const nameEl = this.fileChipEl.querySelector('.claude-file-name');
		if (nameEl) {
			nameEl.textContent = activeFile ? activeFile.basename : 'No file';
		}
	}

	private toggleAskBeforeEdits(): void {
		const newValue = !this.askBeforeEditsToggle.classList.contains('active');
		this.askBeforeEditsToggle.classList.toggle('active', newValue);
		this.settings.askBeforeEdits = newValue;
		// Note: Settings will be saved by the plugin
	}

	private insertCurrentFilePath(): void {
		if (!this.terminal || !this.terminalManager) return;

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			const vaultPath = (this.app.vault.adapter as any).basePath;
			const fullPath = `${vaultPath}/${activeFile.path}`;
			this.terminalManager.write(fullPath);
		}
	}

	// ==================== Session Management ====================

	private async startNewSession(): Promise<void> {
		// Hide empty state, show terminal
		this.emptyStateEl.addClass('hidden');
		this.terminalContainerEl.removeClass('hidden');

		// Initialize terminal if needed
		if (!this.terminal) {
			this.initializeTerminal();
		} else {
			this.terminal.clear();
		}

		// Get vault path
		const vaultPath = (this.app.vault.adapter as any).basePath;

		// Detect Claude CLI path
		const commands = CommandDetector.detectCommands(
			this.settings?.nodeLocation,
			this.settings?.claudeLocation
		);

		// Build Claude args
		const claudeArgs: string[] = ['--verbose'];
		if (!this.settings.askBeforeEdits) {
			claudeArgs.push('--dangerously-skip-permissions');
		}

		// Create terminal manager
		this.terminalManager = new TerminalManager(this.pluginPath, {
			cwd: vaultPath,
			pythonPath: this.settings.pythonPath,
			onData: (data) => {
				if (this.terminal) {
					this.terminal.write(data);
				}
				// Try to extract session ID from output
				this.extractSessionId(data);
			},
			onExit: (code) => {
				if (this.terminal) {
					this.terminal.writeln(`\r\n[Process exited with code ${code}]`);
				}
				this.stopTimer();
			}
		});

		// Spawn Claude CLI directly (it has its own shebang)
		if (commands.isWSL) {
			this.terminalManager.spawn('wsl', [...(commands.wslPrefix || []), '--', commands.claude, ...claudeArgs]);
		} else {
			this.terminalManager.spawn(commands.claude, claudeArgs);
		}

		// Start timer
		this.startTimer();
		this.isSessionActive = true;

		// Focus terminal
		this.terminal?.focus();

		// Initial resize
		setTimeout(() => {
			this.fitTerminal();
			if (this.terminal && this.terminalManager) {
				this.terminalManager.resize(this.terminal.cols, this.terminal.rows);
			}
		}, 100);
	}

	private async resumeSession(sessionId: string): Promise<void> {
		// Hide empty state, show terminal
		this.emptyStateEl.addClass('hidden');
		this.terminalContainerEl.removeClass('hidden');

		// Initialize terminal if needed
		if (!this.terminal) {
			this.initializeTerminal();
		} else {
			this.terminal.clear();
		}

		// Get vault path
		const vaultPath = (this.app.vault.adapter as any).basePath;

		// Detect Claude CLI path
		const commands = CommandDetector.detectCommands(
			this.settings?.nodeLocation,
			this.settings?.claudeLocation
		);

		// Build Claude args with resume
		const claudeArgs: string[] = ['--verbose', '--resume', sessionId];
		if (!this.settings.askBeforeEdits) {
			claudeArgs.push('--dangerously-skip-permissions');
		}

		// Create terminal manager
		this.terminalManager = new TerminalManager(this.pluginPath, {
			cwd: vaultPath,
			pythonPath: this.settings.pythonPath,
			onData: (data) => {
				if (this.terminal) {
					this.terminal.write(data);
				}
			},
			onExit: (code) => {
				if (this.terminal) {
					this.terminal.writeln(`\r\n[Process exited with code ${code}]`);
				}
				this.stopTimer();
			}
		});

		// Spawn Claude CLI directly (it has its own shebang)
		if (commands.isWSL) {
			this.terminalManager.spawn('wsl', [...(commands.wslPrefix || []), '--', commands.claude, ...claudeArgs]);
		} else {
			this.terminalManager.spawn(commands.claude, claudeArgs);
		}

		this.currentSessionId = sessionId;
		this.startTimer();
		this.isSessionActive = true;

		// Focus terminal
		this.terminal?.focus();

		// Initial resize
		setTimeout(() => {
			this.fitTerminal();
			if (this.terminal && this.terminalManager) {
				this.terminalManager.resize(this.terminal.cols, this.terminal.rows);
			}
		}, 100);
	}

	private extractSessionId(data: string): void {
		// Try to extract session ID from Claude output
		// Claude typically outputs session info at startup
		const sessionMatch = data.match(/session[:\s]+([a-f0-9-]{36})/i);
		if (sessionMatch && !this.currentSessionId) {
			this.currentSessionId = sessionMatch[1];
			// Save session
			this.sessionManager.saveSession(this.currentSessionId, 'New conversation');
		}
	}

	// ==================== Timer ====================

	private startTimer(): void {
		this.sessionStartTime = Date.now();
		this.updateTimerDisplay();
		this.timerInterval = window.setInterval(() => {
			this.updateTimerDisplay();
		}, 1000);
	}

	private stopTimer(): void {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private updateTimerDisplay(): void {
		const elapsed = Math.floor((Date.now() - this.sessionStartTime) / 1000);
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		const timerText = this.timerEl.querySelector('.claude-timer-text');
		if (timerText) {
			timerText.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
		}
	}

	// ==================== Public API ====================

	updateSettings(settings: AIChatSettings): void {
		this.settings = settings;
	}

	focusTerminal(): void {
		this.terminal?.focus();
	}

	blurTerminal(): void {
		this.terminal?.blur();
	}
}
