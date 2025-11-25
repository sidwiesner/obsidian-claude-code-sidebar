#!/usr/bin/env python3
"""
PTY Helper for Obsidian AI Agent Plugin

Spawns a pseudo-terminal and bridges I/O between Obsidian and the Claude CLI.
Adapted from clevcode/obsidian-terminal-plugin (MIT License).

Usage: python3 pty-helper.py <command> [args...]

Communication:
- fd 0 (stdin): Input from Obsidian → PTY
- fd 1 (stdout): PTY output → Obsidian
- fd 2 (stderr): PTY errors → Obsidian
- fd 3 (optional): Resize signals (8 bytes: rows[2], cols[2], 0[4])
"""

import os
import sys
import pty
import select
import errno
import fcntl
import struct
import termios

BUFFER_SIZE = 32768


def set_window_size(fd, rows, cols):
    """Set the terminal window size."""
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)


def main():
    if len(sys.argv) < 2:
        print("Usage: pty-helper.py <command> [args...]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[1:]  # argv[0] for execvp is the command itself

    # Set up environment
    env = os.environ.copy()
    env['TERM'] = 'xterm-256color'

    # Fork a pseudo-terminal
    pid, pty_fd = pty.fork()

    if pid == 0:
        # Child process - execute the command
        try:
            os.execvpe(command, args, env)
        except Exception as e:
            print(f"Failed to execute {command}: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        # Parent process - bridge I/O
        try:
            bridge_io(pty_fd)
        except Exception as e:
            print(f"PTY bridge error: {e}", file=sys.stderr)
        finally:
            os.close(pty_fd)
            # Wait for child to prevent zombie
            try:
                os.waitpid(pid, 0)
            except:
                pass


def bridge_io(pty_fd):
    """Bridge I/O between stdin/fd3 and the PTY."""
    # File descriptors to monitor
    fds = [0, pty_fd]  # stdin, pty

    # Check if fd 3 (resize channel) is available
    has_resize_fd = False
    try:
        os.fstat(3)
        fds.append(3)
        has_resize_fd = True
    except:
        pass

    while True:
        try:
            readable, _, _ = select.select(fds, [], [])
        except select.error as e:
            if e.args[0] == errno.EINTR:
                continue
            raise

        for fd in readable:
            if fd == 0:
                # stdin → PTY
                try:
                    data = os.read(0, BUFFER_SIZE)
                    if not data:
                        return  # EOF on stdin
                    os.write(pty_fd, data)
                except OSError as e:
                    if e.errno in (errno.EIO, errno.EBADF):
                        return
                    if e.errno not in (errno.EINTR, errno.EAGAIN):
                        raise

            elif fd == pty_fd:
                # PTY → stdout
                try:
                    data = os.read(pty_fd, BUFFER_SIZE)
                    if not data:
                        return  # EOF on PTY
                    os.write(1, data)
                    sys.stdout.flush()
                except OSError as e:
                    if e.errno in (errno.EIO, errno.EBADF):
                        return
                    if e.errno not in (errno.EINTR, errno.EAGAIN):
                        raise

            elif fd == 3 and has_resize_fd:
                # Resize signal (8 bytes: rows, cols as uint16, plus 4 bytes padding)
                try:
                    data = os.read(3, 8)
                    if not data:
                        # fd 3 closed, remove from monitoring but continue
                        fds.remove(3)
                        has_resize_fd = False
                        continue
                    if len(data) >= 4:
                        rows, cols = struct.unpack('HH', data[:4])
                        set_window_size(pty_fd, rows, cols)
                except OSError as e:
                    if e.errno in (errno.EIO, errno.EBADF):
                        fds.remove(3)
                        has_resize_fd = False
                    elif e.errno not in (errno.EINTR, errno.EAGAIN):
                        raise


if __name__ == '__main__':
    main()
