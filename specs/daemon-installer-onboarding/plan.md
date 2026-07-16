# SeekDesk 本机 Daemon 安装包与配对引导实施计划

## 受影响模块

- `packages/shared`：配对请求、状态、领取响应和设备身份 schema。
- `apps/api`：配对服务、公开领取路由、设备 token 签发/验证、daemon owner 路由。
- `apps/daemon`：连接生命周期、桌面主进程、preload、renderer、配置存储和 Forge 构建。
- `apps/web`：新建对话弹窗中的安装/配对流程与轮询。
- 根脚本与文档：安装器构建、产物校验、README、CODE_MAP、PROJECT_PROGRESS。

## 架构与数据流

1. 已登录 Web 调用 `POST /api/coding/daemon-pairings` 创建一次性配对会话。
2. API 返回配对码、过期时间和 `seekdesk://pair` 深链，不返回 daemon 长期凭据。
3. 桌面端通过深链或手工输入调用公开的 `POST /api/coding/daemon-pairings/claim`。
4. API 原子消费配对码并返回 owner/daemon 绑定的 HMAC 设备 token。
5. 桌面端用 `safeStorage` 加密 token，选择工作区后启动现有 daemon client。
6. `/ws/daemon` 验证设备 token 与 daemonId，按 owner 注册 workspace。
7. Web 轮询配对状态和工作区列表，配对成功后直接选择新工作区。

## 数据模型

- 配对会话 v1 存于 API 内存，包含哈希后的 code、owner、API URL、状态、过期时间和领取设备摘要。
- 设备 token 为签名载荷，不写入 Postgres；API 重启后已签发 token 仍可验证。
- 桌面配置保存 API URL、daemonId、workspaceRoot、加密 token、自动启动与最近状态。

## 公共接口

- `POST /api/coding/daemon-pairings`
- `GET /api/coding/daemon-pairings/:pairingId`
- `POST /api/coding/daemon-pairings/claim`
- `seekdesk://pair?api=<url>&code=<code>`
- Electron preload API：state、claimPairing、selectWorkspace、saveSettings、disconnect、openExternal。

## 实施步骤

1. 完成 shared contract、配对服务和 API 测试。
2. 改造 DaemonRegistry 与 daemon client，支持设备身份和状态回调。
3. 创建 Electron 桌面壳、配置存储、向导、托盘和 Forge 配置。
4. 在 Web 工作区弹窗接入安装下载与配对轮询。
5. 构建 macOS 安装产物，校验 Windows 构建配置和平台限制。
6. 运行静态、单元、构建、API、browser smoke 与 daemon 安装器 smoke。

## 风险

- Electron 依赖和安装产物显著增大：桌面包独立构建，不进入 Web/API 生产镜像。
- 未签名安装器会触发系统警告：文档明确开发产物，正式发布需证书与公证。
- 内存配对会话在 API 重启后失效：配对码短期且可重新生成，已签发设备 token 不受影响。
- 自定义协议可能被恶意参数触发：仅接受 http/https API URL、固定 code 格式且领取为单次消费。

## 验证命令

- `npm run lint`
- `npm run test --workspaces --if-present`
- `npm run typecheck`
- `npm run build`
- `npm run make:daemon`
- `npm run test:browser-smoke`
- `npm run verify:secrets`

## 文档更新

- `README.md`
- `CODE_MAP.md`
- `PROJECT_PROGRESS.md`
- `docs/architecture/complete-flow-summary.md`
- `docs/architecture/runtime-security-boundary.md`
