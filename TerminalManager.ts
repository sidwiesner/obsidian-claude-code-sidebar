import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface TerminalManagerOptions {
	cwd: string;
	pythonPath?: string;
	onData: (data: string) => void;
	onExit: (code: number | null) => void;
}

/**
 * Manages a PTY process for terminal emulation.
 * Uses a Python helper to create a real pseudo-terminal.
 */
export class TerminalManager {
	private process: ChildProcess | null = null;
	private options: TerminalManagerOptions;
	private pluginPath: string;

	constructor(pluginPath: string, options: TerminalManagerOptions) {
		this.pluginPath = pluginPath;
		this.options = options;
	}

	/**
	 * Spawn a new PTY process running the specified command.
	 */
	spawn(command: string, args: string[] = []): void {
		if (this.process) {
			this.kill();
		}

		const helperPath = path.join(this.pluginPath, 'resources', 'pty-helper.py');
		const pythonPath = this.options.pythonPath || 'python3';

		// Build environment with proper PATH for node
		const env = { ...process.env };
		// Ensure common paths are in PATH for finding node
		const additionalPaths = [
			'/usr/local/bin',
			'/opt/homebrew/bin',
			'/usr/bin',
			'/bin',
			process.env.HOME + '/.nvm/current/bin',
			process.env.HOME + '/.volta/bin',
			process.env.HOME + '/.local/bin'
		].filter(Boolean);

		if (env.PATH) {
			env.PATH = additionalPaths.join(':') + ':' + env.PATH;
		} else {
			env.PATH = additionalPaths.join(':');
		}

		// Spawn with 4 stdio pipes: stdin, stdout, stderr, and fd3 for resize
		this.process = spawn(pythonPath, [helperPath, command, ...args], {
			cwd: this.options.cwd,
			stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
			env
		});

		// Handle stdout
		if (this.process.stdout) {
			this.process.stdout.on('data', (chunk: Buffer) => {
				this.options.onData(chunk.toString());
			});
		}

		// Handle stderr (also send to terminal)
		if (this.process.stderr) {
			this.process.stderr.on('data', (chunk: Buffer) => {
				this.options.onData(chunk.toString());
			});
		}

		// Handle process exit
		this.process.on('exit', (code) => {
			this.process = null;
			this.options.onExit(code);
		});

		this.process.on('error', (err) => {
			console.error('PTY process error:', err);
			this.process = null;
			this.options.onExit(1);
		});
	}

	/**
	 * Write data to the PTY stdin.
	 */
	write(data: string): void {
		if (this.process?.stdin && !this.process.stdin.destroyed) {
			this.process.stdin.write(data);
		}
	}

	/**
	 * Send a resize signal to the PTY via fd3.
	 */
	resize(cols: number, rows: number): void {
		if (!this.process) return;

		// Get fd3 (the 4th stdio, index 3)
		const resizeFd = (this.process.stdio as any)[3];
		if (resizeFd && typeof resizeFd.write === 'function') {
			// Pack rows and cols as uint16 (2 bytes each), plus 4 bytes padding
			const buffer = Buffer.alloc(8);
			buffer.writeUInt16LE(rows, 0);
			buffer.writeUInt16LE(cols, 2);
			resizeFd.write(buffer);
		}
	}

	/**
	 * Kill the PTY process.
	 */
	kill(): void {
		if (this.process) {
			this.process.kill('SIGTERM');
			this.process = null;
		}
	}

	/**
	 * Check if a PTY process is currently running.
	 */
	isRunning(): boolean {
		return this.process !== null;
	}
}
