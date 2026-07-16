# SeekDesk 项目进度

## 当前功能

- 功能：`daemon-installer-onboarding`
- 开发分支：`codex/daemon-installer-onboarding`
- 任务范围：T001-T040
- 已完成：T001-T040
- 当前阶段：本机 Daemon 安装包与一次性配对引导已完成
- 强制验收阻塞：无

## 已完成能力

### 统一 Runtime 协议

- shared 定义 `local_daemon`、`cloud_runtime`、显式开发 fallback、workspace、session、grant、tool、operation 和错误协议。
- runtime-core 为 daemon 与 cloud worker 提供一致的文件、搜索、Git、写入、Shell 和测试实现。
- 路径越界、symlink、ignore、二进制、大文件、危险命令、timeout、cancel 和输出截断都有稳定错误。

### Local Daemon

- daemon 主动连接远程 API，支持注册、heartbeat、断线重连、稳定 workspaceId 和本机目录 browse/select/pick。
- Electron 桌面端支持 Windows/macOS 安装配置、`seekdesk://` 深链、单实例、系统目录选择器、托盘和开机启动。
- Web 可生成 10 分钟一次性配对码；领取后签发 owner/daemonId 绑定的 30 天设备 token，token 由 `safeStorage` 加密保存。
- 配对码哈希存储、单次消费；Web 只轮询设备摘要，不读取设备 token。
- 文件读取、搜索、Git、写入、Shell 和测试都在用户电脑执行。
- daemon 离线时返回 `runtime_unavailable`，不会降级到服务器目录。

### Cloud Runtime

- cloud workspace 支持 HTTPS Git、branch、`node22` image profile、可选加密 repository credential。
- lifecycle 支持 provision、clone、start、stop、retry、delete、reconcile、idle stop、service restart 恢复和清理。
- operation 终态先持久化再对外可见，避免 completed 与磁盘状态之间的竞态。
- worker 固定 `/workspace`，执行容器为 non-root、read-only rootfs、network none、cap-drop、no-new-privileges，并限制 CPU、内存、PID、tmpfs 和 workspace quota。
- 同一 workspace 支持并发读、串行写/命令和 request cancellation。

### 身份、数据与审批

- 开发 actor 来自服务端 env；生产 actor 使用 OIDC/JWT issuer、audience、JWKS。
- Postgres/Drizzle 持久化 owner-scoped workspace、operation、session、tool、grant、activity、artifact 和 usage。
- Git token 使用 owner-bound AES-256-GCM，支持 key version、previous key 和日志脱敏；浏览器只见 metadata。
- grant 绑定 `ownerId + sessionId + workspaceId + runtimeMode + action`，支持过期和撤销。
- tool call 使用稳定 requestId 与 repository 原子 claim，防止重复执行。
- 写入关联 artifact 与 Git diff；Shell/test trace 保存 command、cwd、stdout、stderr、exitCode、timeout 和 truncated。

### 前端工作台

- 新建对话提供“本机项目 / 云端工作区”选择，并记住最近成功 Runtime。
- local tab 提供安装包下载、一次性配对、深链打开、倒计时、在线状态和工作区自动发现；cloud tab 支持创建、启动、停止、重试、删除。
- session 固定绑定 workspace/runtime；历史按 workspace 分组，置顶优先且组内按 createdAt 倒序稳定。
- 文件、搜索、Diff、终端和运行详情使用当前 session 绑定，默认聊天页不保留空白右栏。
- daemon offline、cloud stopped、clone error、permission error 使用明确单一提示。
- 页面无旧邮箱请求、乱码、连续问号、无响应入口和选中态跳动。

## 最终验证证据

- `git diff --check`、lint、typecheck、build、secret hygiene：通过。
- workspace tests：232 项通过，4 项环境相关用例显式跳过；Postgres integration 另有 2 项通过。
- Postgres migration 与真实 repository integration：通过。
- `seekdesk-runtime:node22` 真实容器 9 工具与安全参数：通过。
- cloud lifecycle provision/execute/stop/restart/start/delete：通过，零残留容器与 workspace directory。
- remote API + cloud-runtime + local daemon 同时在线 browser smoke：通过。
- Playwright 官方 Chromium 访问远程 Web/API 的真实 UI smoke：通过。
- macOS arm64 DMG/ZIP 构建、asar、ad-hoc 签名、URL protocol、安全 fuses 与真实进程启动：通过。
- Windows Squirrel 构建配置与 GitHub Actions Windows runner：已接入，真实 Windows 产物由目标 runner 生成。
- smoke session、activity、usage、operation、cloud workspace 和测试文件清理：完成。

完整命令、结果和限制见 `specs/dual-runtime/verify.md`。

## 已知限制

- cloud runtime v1 为单机 Docker，不包含多节点调度和云计费控制面。
- 正式安装器仍需 Apple Developer ID/公证和 Windows Authenticode；当前本地产物为开发签名。
- 设备 token v1 默认 30 天，尚未提供设备撤销控制台和自动轮换。
- `jim-mac` 的 Chromite Browser 不兼容 Playwright 调试管道；验收使用 Playwright 官方 headless Chromium。
- Electron Forge 完整开发依赖仍有构建期传递告警；生产依赖无高危漏洞。
- public cloud fixture 需要 HTTPS Git egress。

## 下一步

1. 正式签名、公证、Release/CDN 发布与自动更新。
2. 设备管理、撤销、token 轮换和多设备策略。
3. 云 Runtime 多节点调度、配额、可观测性和计费控制面。

## 最后更新

2026-07-16
