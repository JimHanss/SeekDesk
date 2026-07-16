# Scripts

- `daemon-installer-smoke.mjs`：校验 Forge makers、图标、asar、macOS 签名、`seekdesk://` 协议和 Electron 安全 fuses；目标平台构建后传入 `--require-artifacts`。

Project-level automation scripts live here. The current helpers focus on coding-agent verification, secret hygiene, smoke cleanup, and browser smoke coverage.

Useful commands:

- `npm run verify:secrets`
- `npm run cleanup:smoke-data`
- `npm run test:browser-smoke`
- `npm run db:migrate`

Daemon workflow:

```bash
npm run dev:daemon -- start --api http://127.0.0.1:4000 --token seekdesk-local-dev --workspace /path/to/project
```

The browser smoke starts the API and web app when needed, selects an available web port if `3000` is occupied, verifies the coding workbench UI, and exercises workspace, file, search, Git, chat trace, approval, and shell/test execution paths through the safe runtime boundary.
