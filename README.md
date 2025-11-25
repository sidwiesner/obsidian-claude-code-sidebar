# Obsidian AI Agent

Embed Claude Code directly into Obsidian. This plugin runs the Claude Code CLI in a full terminal emulator inside your sidebar, giving you AI-powered file editing, bash commands, and agentic workflows without leaving your vault.

## Features

- **Full terminal emulator**: xterm.js-based terminal running Claude Code CLI directly in Obsidian
- **Native Claude Code experience**: All Claude Code features work as expected - tools, slash commands, session resume, etc.
- **Vault-aware**: Working directory is set to your vault root, so Claude can read/edit any file
- **File context chip**: Click to insert the current file's path into your prompt
- **Theme-matched**: Terminal colors adapt to Obsidian's light/dark mode
- **Keyboard shortcut**: `Cmd+Esc` (Mac) / `Ctrl+Esc` (Windows/Linux) to focus/unfocus Claude

## Installation

### Prerequisites
- **Claude Code CLI** installed and working (`claude --version` in terminal)
- **Python 3** for the PTY helper

### Setup

1. Download the latest release from the [releases page](../../releases)
2. Extract to `[your_vault]/.obsidian/plugins/obsidian-ai-agent`
3. Enable the plugin in Obsidian's Community Plugins settings
4. Click the terminal icon in your sidebar or use `Cmd+Esc` to open

> **Note**: Claude Code will prompt for permissions as needed. You can configure permission settings in Claude Code itself.

## Troubleshooting

### Claude CLI not found

1. Verify Claude Code is installed: `claude --version`
2. If auto-detection fails, set the path manually in plugin settings
3. Find your Claude path with: `which claude`

### Terminal not starting

1. Ensure Python 3 is installed: `python3 --version`
2. Check the Obsidian developer console (`Cmd+Opt+I`) for errors

## Credits

Forked from the original [obsidian-ai-agent](https://github.com/Luka-Hanzek/obsidian-ai-agent) by Luka Hanzek, which used a chat-based interface. This version takes a different approach by embedding the full Claude Code terminal experience.
