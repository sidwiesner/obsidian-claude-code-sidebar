# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run dev` - Development mode with watch (esbuild, inline sourcemaps)
- `npm run build` - Production build with TypeScript type checking and minification
- `npm run version` - Bump version in manifest.json and versions.json

## Architecture

This is an Obsidian plugin that embeds Claude Code CLI in a full terminal emulator (xterm.js) inside the Obsidian sidebar.

### Core Components

**main.ts** - Plugin entry point. Handles lifecycle (`onload`/`onunload`), registers the custom view type `claude-terminal-view`, manages settings, and activates the view in the right sidebar. Registers `Cmd+Esc` hotkey for focus toggling.

**ClaudeTerminalView.ts** - Primary UI component. Manages:
- xterm.js terminal emulator with WebGL rendering
- PTY process management via TerminalManager
- Terminal theming (adapts to Obsidian light/dark mode)
- File chip UI for inserting current file path
- Session ID extraction from Claude output

**TerminalManager.ts** - Manages PTY subprocess. Uses a Python helper script to create a real pseudo-terminal, handling stdin/stdout/stderr and terminal resize signals.

**SessionManager.ts** - Persists session IDs to enable Claude's `--resume` functionality.

**commandDetector.ts** - Cross-platform path detection for Node.js and Claude CLI. Checks NVM, Homebrew, system paths, and supports user overrides via settings.

**SettingsTab.ts** - Plugin settings UI for configuring Node.js/Claude/Python paths.

**types.ts** - TypeScript interfaces including `AIChatSettings`.

### Claude Code Integration

The plugin spawns Claude CLI via a PTY with:
- `--verbose` flag
- Working directory set to vault root

User interacts directly with the terminal - keystrokes go to Claude's stdin, output displays in xterm.js.

### Key Patterns

- **PTY-based**: Real terminal emulation, not simulated chat
- **Python helper**: `resources/pty-helper.py` creates the pseudo-terminal
- **Theme sync**: Watches `document.body` class changes to update terminal colors
- **File context**: Click file chip to insert relative path at cursor

## TypeScript Configuration

- Target: ES6 (transpiled to ES2018 by esbuild)
- Strict mode enabled (`strictNullChecks`, `noImplicitAny`)
- Output: CommonJS bundle (`main.js`)
