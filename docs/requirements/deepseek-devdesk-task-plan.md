# DeepSeek DevDesk Task Plan

## 1. Product Goal

Build a DeepSeek-native web coding agent platform for developers.

The product should let users open a local or cloud workspace, chat with an AI coding agent, inspect and edit files, run commands, review diffs, and complete coding tasks with explicit permission controls.

Working name: **DeepSeek DevDesk**

Core positioning:

- Web-first Claude Code style coding agent
- Optimized for DeepSeek API and DeepSeek-compatible model routing
- Supports local daemon mode first, cloud workspace mode later
- Built around code modification, testing, Git workflow, and MCP/plugin integration

## 2. Target Users

- Individual developers who want a browser-based coding agent
- Chinese-speaking developers using DeepSeek as their primary model provider
- Small teams that want lower-cost AI code review, bug fixing, and PR automation
- Enterprises that may later need private deployment or self-hosted model routing

## 3. MVP Scope

The MVP goal is simple:

Users can open a project, ask the agent to perform a coding task, approve tool actions, inspect file changes, run tests, and accept or reject diffs.

MVP features:

- Web chat UI with streaming model output
- Local workspace daemon
- File tree and file viewer/editor
- Agent tool loop
- Built-in file and shell tools
- Permission confirmation UI
- Diff viewer
- Session persistence
- DeepSeek model configuration

Out of scope for MVP:

- Multi-user team collaboration
- Full plugin marketplace
- Cloud sandbox fleet
- Enterprise policy management
- Voice, mobile, desktop app
- Full IDE replacement

## 4. High-Level Architecture

```text
Browser Web UI
  Chat, file tree, editor, diff, permissions, task status
        |
        | WebSocket / SSE
        |
Backend API
  Auth, sessions, model routing, agent loop, tool orchestration
        |
        | WebSocket / local RPC
        |
Local Workspace Daemon
  File read/write, shell execution, git, grep, workspace metadata
        |
        |
User Project Directory
```

Recommended stack:

- Frontend: Next.js, React, Monaco Editor, Tailwind CSS, shadcn/ui
- Backend: Node.js, Fastify or NestJS, TypeScript
- Realtime: WebSocket for bidirectional control, SSE optional for streaming-only paths
- Storage: SQLite for local MVP, Postgres for hosted version
- Agent core: TypeScript
- Model API: DeepSeek OpenAI-compatible API
- Tool schemas: Zod
- Diff: unified diff plus side-by-side UI
- Search: ripgrep
- Local daemon: Node.js CLI service

## 5. Core Modules

### 5.1 Web Chat UI

Tasks:

- Build main workspace layout
- Add chat transcript panel
- Add streaming assistant message rendering
- Add tool call cards
- Add collapsible command output
- Add loading, retry, cancel states
- Add session title and session list

Acceptance criteria:

- User can send a prompt
- Assistant response streams live
- Tool calls appear as structured events
- User can cancel an in-progress task

### 5.2 File Workspace UI

Tasks:

- Build project file tree
- Add file open/read view
- Add Monaco editor
- Add tabs for open files
- Add dirty file indicators
- Add search panel
- Add refresh workspace action

Acceptance criteria:

- User can browse project files
- User can open and inspect source files
- User can search by filename and text
- File changes made by the agent appear without full page reload

### 5.3 Diff And Change Review

Tasks:

- Generate file-level diffs after edits
- Show side-by-side diff
- Show unified diff fallback
- Add accept/reject per file
- Add accept/reject all
- Add restore original content
- Track change history per session

Acceptance criteria:

- Every agent edit is reviewable
- User can reject unwanted changes
- User can see exactly what changed before committing

### 5.4 Agent Core

Tasks:

- Implement message model
- Implement DeepSeek streaming request
- Parse assistant tool calls
- Execute tools and append tool results
- Continue loop until final answer
- Add max turn limit
- Add abort handling
- Add retry for transient API errors
- Track token usage and estimated cost

Acceptance criteria:

- Agent can complete multi-step tasks
- Agent can call tools repeatedly
- Agent stops cleanly on completion, cancellation, or max turns

### 5.5 DeepSeek Model Router

Tasks:

- Add API key configuration
- Add base URL configuration
- Add model selector
- Add thinking mode selector when supported
- Route simple tasks to flash model
- Route complex planning/debug tasks to pro model
- Add fallback model configuration
- Record model usage per turn

Acceptance criteria:

- User can configure DeepSeek credentials
- User can choose model per session
- System can automatically choose fast/pro model for tasks

### 5.6 Built-In Tools

Initial tools:

- `read_file`
- `write_file`
- `edit_file`
- `list_files`
- `grep`
- `run_shell`
- `git_diff`
- `git_status`
- `run_tests`

Tasks:

- Define Zod input schemas
- Define output schemas
- Add tool descriptions for model prompt
- Add permission requirements per tool
- Add result truncation
- Add binary file guard
- Add path normalization

Acceptance criteria:

- Model can inspect files, edit files, search code, and run commands
- Tool errors are returned to the model in a structured way
- Large outputs do not overwhelm context

### 5.7 Permission System

Permission modes:

- Read-only
- Confirm writes and commands
- Auto approve safe actions

Tasks:

- Add permission decision engine
- Add frontend permission modal
- Add persistent allow/deny rules
- Add command risk classifier
- Block destructive shell commands by default
- Restrict file access to workspace root
- Add additional allowed directories
- Log all approved actions

Acceptance criteria:

- File writes require approval in default mode
- Shell commands require approval in default mode
- Dangerous commands are clearly flagged
- Agent cannot access paths outside approved directories

### 5.8 Local Daemon

Tasks:

- Create daemon CLI
- Add workspace registration
- Add WebSocket connection to backend/UI
- Add file system operations
- Add shell execution with streaming stdout/stderr
- Add process cancellation
- Add daemon health check
- Add auto-reconnect

Acceptance criteria:

- User can run local daemon in a project
- Web UI can connect to the local project
- Commands and file operations happen locally
- Broken connections recover gracefully

### 5.9 Session Persistence

Tasks:

- Store conversations
- Store tool calls
- Store file change snapshots
- Store permission decisions
- Add resume session
- Add session export
- Add usage summary

Acceptance criteria:

- User can leave and return to a task
- Session history remains inspectable
- Previous diffs remain available

### 5.10 MCP And Plugins

MVP-lite:

- Add MCP client support after built-in tools are stable

Tasks:

- Load MCP server config
- Connect stdio MCP servers
- List tools and resources
- Convert MCP tools into internal tool schema
- Add permission layer for MCP tools
- Add MCP result truncation

Acceptance criteria:

- User can attach an MCP server
- Agent can call MCP tools safely

## 6. Milestones

### Milestone 0: Prototype

Duration: 1 week

Tasks:

- Basic Next.js app
- Backend streaming endpoint
- DeepSeek API call
- Simple chat page
- Manual model configuration

Done when:

- User can send prompt and receive streaming DeepSeek response

### Milestone 1: Agent Loop

Duration: 1-2 weeks

Tasks:

- Tool schema system
- `read_file`, `grep`, `run_shell`
- Tool call parsing
- Tool result loop
- Basic permission prompt

Done when:

- User can ask the agent to inspect a project and run a safe command

### Milestone 2: File Editing

Duration: 2 weeks

Tasks:

- File tree
- Monaco viewer
- `edit_file`, `write_file`
- Diff generation
- Accept/reject changes
- File snapshot tracking

Done when:

- Agent can modify files and user can review/reject changes

### Milestone 3: Local Daemon

Duration: 2 weeks

Tasks:

- Daemon CLI
- WebSocket protocol
- Workspace registration
- Shell streaming
- File change events
- Reconnect logic

Done when:

- Web UI controls a local project safely through daemon

### Milestone 4: MVP Beta

Duration: 2-3 weeks

Tasks:

- Session persistence
- Model routing
- Git status/diff tools
- Test runner tool
- Better permission rules
- Settings page
- Usage/cost display
- Error handling polish

Done when:

- A developer can use the product for real bug fixing and small feature tasks

### Milestone 5: Ecosystem Expansion

Duration: 3-5 weeks

Tasks:

- MCP client
- GitHub/Gitee integration
- PR review workflow
- Agent templates
- Plugin config
- Cloud workspace proof of concept

Done when:

- Product supports external tools and repository workflows

## 7. Security Requirements

Must-have:

- Browser never directly accesses local file system
- Daemon restricts access to approved workspace directories
- Shell commands require explicit approval by default
- Destructive command patterns are blocked or escalated
- All tool calls are logged
- Secrets are redacted from logs where possible
- API keys are stored securely
- File edits are reversible

High-risk areas:

- Shell execution
- Arbitrary MCP tools
- Path traversal
- Symlink escape
- Workspace trust
- Prompt injection from repo files
- Model-requested credential access

## 8. DeepSeek-Specific Differentiation

Product features to emphasize:

- Low-cost long-running coding tasks
- Chinese-first developer UX
- DeepSeek model routing between fast and pro models
- Thinking/non-thinking mode visibility
- Compatibility with OpenAI-style tools
- Compatibility with Claude Code/OpenCode style workflows
- Support for private deployment and self-hosted models later

Suggested future features:

- DeepSeek prompt and tool template marketplace
- Chinese error-message explanation and fix mode
- Gitee and domestic DevOps integrations
- Team knowledge base summarization
- DeepSeek OCR-powered document/code asset ingestion

## 9. MVP Data Model

Suggested tables:

- `users`
- `workspaces`
- `sessions`
- `messages`
- `tool_calls`
- `file_snapshots`
- `file_changes`
- `permission_rules`
- `model_usage`

For local-only MVP, use SQLite.

For hosted version, use Postgres.

## 10. Realtime Event Types

Suggested WebSocket events:

- `session.created`
- `message.user`
- `message.assistant.delta`
- `message.assistant.done`
- `tool.requested`
- `tool.permission_required`
- `tool.permission_granted`
- `tool.permission_denied`
- `tool.started`
- `tool.output.delta`
- `tool.completed`
- `tool.failed`
- `file.changed`
- `diff.updated`
- `agent.cancelled`
- `agent.completed`

## 11. First Implementation Checklist

- [ ] Create monorepo
- [ ] Add frontend app
- [ ] Add backend app
- [ ] Add shared schema package
- [ ] Add DeepSeek client
- [ ] Add streaming chat endpoint
- [ ] Add WebSocket event protocol
- [ ] Add agent loop
- [ ] Add tool registry
- [ ] Add file read tool
- [ ] Add grep tool
- [ ] Add shell tool
- [ ] Add permission modal
- [ ] Add local daemon
- [ ] Add file tree
- [ ] Add editor
- [ ] Add edit tool
- [ ] Add diff viewer
- [ ] Add session persistence
- [ ] Add Git tools
- [ ] Add model routing
- [ ] Add MVP beta polish

## 12. Recommended First Sprint

Sprint goal:

Build a working web chat that can call DeepSeek and execute a safe read-only tool against a local project.

Tasks:

- Scaffold Next.js frontend
- Scaffold Node.js backend
- Define shared message and event schemas
- Add DeepSeek streaming client
- Build chat UI
- Implement local daemon skeleton
- Implement daemon `list_files` and `read_file`
- Add backend-to-daemon WebSocket
- Add model tool call loop
- Display tool result in UI

Sprint demo:

User opens the web UI, connects a local project, asks "summarize this repository", the agent lists files, reads selected files, and streams a summary.

