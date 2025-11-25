import { Plugin } from 'obsidian';

export interface Session {
	id: string;
	timestamp: number;
	preview: string;  // First message or summary
}

export interface SessionData {
	sessions: Session[];
	currentSessionId: string | null;
}

/**
 * Manages Claude conversation sessions.
 * Tracks past conversations and enables resuming them.
 */
export class SessionManager {
	private plugin: Plugin;
	private data: SessionData;

	constructor(plugin: Plugin) {
		this.plugin = plugin;
		this.data = {
			sessions: [],
			currentSessionId: null
		};
	}

	/**
	 * Load session data from Obsidian's data store.
	 */
	async load(): Promise<void> {
		const saved = await this.plugin.loadData();
		if (saved?.sessions) {
			this.data = {
				sessions: saved.sessions || [],
				currentSessionId: saved.currentSessionId || null
			};
		}
	}

	/**
	 * Save session data to Obsidian's data store.
	 */
	async save(): Promise<void> {
		// Merge with existing settings data
		const existing = await this.plugin.loadData() || {};
		await this.plugin.saveData({
			...existing,
			sessions: this.data.sessions,
			currentSessionId: this.data.currentSessionId
		});
	}

	/**
	 * Get all saved sessions, sorted by most recent first.
	 */
	listSessions(): Session[] {
		return [...this.data.sessions].sort((a, b) => b.timestamp - a.timestamp);
	}

	/**
	 * Add or update a session.
	 */
	async saveSession(id: string, preview: string): Promise<void> {
		const existing = this.data.sessions.find(s => s.id === id);
		if (existing) {
			existing.timestamp = Date.now();
			existing.preview = preview;
		} else {
			this.data.sessions.push({
				id,
				timestamp: Date.now(),
				preview
			});
		}
		await this.save();
	}

	/**
	 * Delete a session.
	 */
	async deleteSession(id: string): Promise<void> {
		this.data.sessions = this.data.sessions.filter(s => s.id !== id);
		if (this.data.currentSessionId === id) {
			this.data.currentSessionId = null;
		}
		await this.save();
	}

	/**
	 * Set the current active session.
	 */
	async setCurrentSession(id: string | null): Promise<void> {
		this.data.currentSessionId = id;
		await this.save();
	}

	/**
	 * Get the current active session ID.
	 */
	getCurrentSessionId(): string | null {
		return this.data.currentSessionId;
	}

	/**
	 * Get a session by ID.
	 */
	getSession(id: string): Session | undefined {
		return this.data.sessions.find(s => s.id === id);
	}

	/**
	 * Clear all sessions.
	 */
	async clearAll(): Promise<void> {
		this.data.sessions = [];
		this.data.currentSessionId = null;
		await this.save();
	}

	/**
	 * Keep only the most recent N sessions.
	 */
	async pruneOldSessions(keepCount: number = 50): Promise<void> {
		const sorted = this.listSessions();
		if (sorted.length > keepCount) {
			this.data.sessions = sorted.slice(0, keepCount);
			await this.save();
		}
	}
}
