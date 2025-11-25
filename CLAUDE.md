# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

- `npm run dev` - Development mode with watch (esbuild, inline sourcemaps)
- `npm run build` - Production build with TypeScript type checking and minification
- `npm run version` - Bump version in manifest.json and versions.json

## Architecture

This is an Obsidian plugin that embeds Claude Code CLI in a full terminal emulator (xterm.js) inside the Obsidian sidebar.

### Core Components

**main.ts** - Plugin entry point. Handles:
- Lifecycle (`onload`/`onunload`) and view registration (`claude-terminal-view`)
- Settings management and plugin path resolution
- `Cmd+Esc` hotkey for terminal focus toggling
- Auto-opens terminal in right sidebar on layout ready

**ClaudeTerminalView.ts** - Primary UI component managing the terminal experience:
- xterm.js terminal with WebGL rendering (canvas fallback)
- PTY process lifecycle via TerminalManager
- Dynamic theming via MutationObserver on `document.body` class changes
- File chip UI that inserts current file path on click
- Session ID extraction from Claude CLI output
- Empty state UI with click-to-start interaction
- ResizeObserver for terminal fitting

**TerminalManager.ts** - PTY process wrapper:
- Spawns Python helper script with command and args
- Manages stdin/stdout/stderr pipes
- Handles terminal resize via dedicated fd3 pipe (8-byte protocol: rows[2], cols[2], padding[4])
- Augments PATH environment for Node.js detection (NVM, Homebrew, Volta, etc.)

**SessionManager.ts** - Persists Claude session IDs to Obsidian's data store, enabling `--resume` functionality. Supports session listing, pruning, and deletion.

**commandDetector.ts** - Cross-platform CLI path detection with caching:
- Detects Node.js and Claude CLI paths
- Supports macOS (Homebrew, NVM), Linux, and Windows WSL
- Checks common installation locations and global npm prefix
- Respects user overrides from settings

**SettingsTab.ts** - Plugin settings UI for configuring Node.js/Claude/Python paths and terminal appearance.

**types.ts** - TypeScript interfaces (`AIChatSettings`, etc.)

### PTY Communication

The Python helper (`resources/pty-helper.py`) bridges Obsidian and Claude CLI:
- **fd 0 (stdin)**: User input from xterm.js → Claude CLI
- **fd 1 (stdout)**: Claude output → xterm.js
- **fd 2 (stderr)**: Errors → xterm.js
- **fd 3 (resize)**: 8-byte resize signals (rows, cols as uint16, plus padding)

Sets `TERM=xterm-256color` and uses `pty.fork()` for real pseudo-terminal behavior.

### Claude Code Integration

The plugin spawns Claude CLI via:
```bash
claude --verbose
```
Working directory is set to vault root, so Claude can access all vault files.

User interacts directly with the terminal—keystrokes go to Claude's stdin, output renders in xterm.js. No API wrapper or custom protocol.

### Key Implementation Patterns

- **Real terminal, not simulated chat**: Full PTY emulation preserves all Claude Code features (colors, interactive prompts, etc.)
- **Empty state → terminal**: Click empty state to spawn Claude process and show terminal
- **Theme synchronization**: MutationObserver watches for Obsidian theme class changes on `document.body`
- **File context insertion**: Footer file chip inserts `activeFile.path` into terminal on click
- **Path detection with fallbacks**: `commandDetector.ts` checks multiple locations, caches results, respects overrides

## Build Configuration

- **esbuild**: Bundles TypeScript to CommonJS (`main.js`)
- **Target**: ES2018 (TypeScript compiles to ES6, esbuild transpiles to ES2018)
- **External**: Obsidian API, Electron, CodeMirror, and all Node.js builtins
- **Dev mode**: Watch mode with inline sourcemaps
- **Production**: Minified, no sourcemaps, includes `tsc -noEmit` type checking

## Platform Support

- **macOS/Linux**: Native PTY support via Python
- **Windows**: Requires WSL; plugin detects WSL availability and spawns Claude inside WSL environment
