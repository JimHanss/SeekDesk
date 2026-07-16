# SeekDesk 本机 Daemon 安装包与配对引导验证记录

## 当前状态

- 功能分支验收通过，待合并 `main` 后回归。

## 验收标准结果

- Windows/macOS Electron Forge 安装配置、图标、URL protocol、安全 fuse 和自动构建工作流已接入。
- macOS arm64 DMG/ZIP 开发产物已生成；app bundle、ASAR、ad-hoc 签名和真实进程启动已验证。
- Web 可创建 10 分钟一次性配对码，配对码只能领取一次；设备 token 绑定 owner 与 daemonId。
- 桌面端支持 `seekdesk://pair`、设备 token 安全保存、系统目录选择、托盘、开机启动和断线重连。
- 新建对话本机项目页提供安装、配对、倒计时、在线状态和工作区自动发现。
- 浏览器 smoke 已覆盖配对 API、local daemon 注册、工作区绑定和完整 UI 流程。

## 自动化验证

- `git diff --check`：通过。
- `npm run lint`：通过。
- `npm run test`：232 项通过，4 项环境相关用例跳过。
- Postgres repository integration：2 项通过。
- `npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run db:migrate`：通过；验收使用当前健康 Colima Postgres 映射端口。
- `npm run verify:secrets`：通过。
- `npm run test:daemon-installer -- --require-artifacts`：通过。
- `npm run test:browser-smoke`：通过，包含 daemon 一次性配对与真实浏览器 UI。
- `npm audit --omit=dev --audit-level=high`：通过，无生产依赖高危漏洞。

## 安装产物

- `apps/daemon/out/make/SeekDesk Daemon.dmg`，macOS arm64，约 115 MiB。
- `apps/daemon/out/make/zip/darwin/arm64/SeekDesk Daemon-darwin-arm64-0.1.0.zip`，约 116 MiB。
- Windows Squirrel 产物由 `.github/workflows/daemon-installers.yml` 在 Windows runner 生成。
- `apps/daemon/out` 已忽略，不进入 Git；正式产物由 Release/CDN 分发。

## 已知风险

- 正式发布前仍需 Apple Developer ID、公证和 Windows Authenticode 证书。
- 完整开发依赖审计仍有 32 个告警，其中 23 个高危来自 Electron Forge 的 `tar/tmp` 等构建期传递依赖；当前上游无非破坏性修复，生产依赖审计无高危。
- 配对状态 v1 保存在 API 进程内存中；已签发设备 token 可跨重启验证，但未领取的配对码会随 API 重启失效。
- Windows 安装器需在目标 Windows runner 上完成最终真实安装/卸载验收。
