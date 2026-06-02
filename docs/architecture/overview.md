# Architecture Overview

SeekDesk is organized as a web-first coding agent platform with three runtime layers:

1. Browser web UI for chat, workspace navigation, permissions, task status, and future diff review.
2. Backend API for sessions, model routing, realtime events, and agent orchestration.
3. Local workspace daemon for approved file and shell operations inside a user-selected workspace.

The browser never directly reads or writes the local file system. All local operations flow through the daemon and must be checked against workspace boundaries and permission rules.
