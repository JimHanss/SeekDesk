# SeekDesk 本机 Daemon 安装包与配对引导任务

## 规格与基线

- [x] T001 创建 `codex/daemon-installer-onboarding` 分支。
- [x] T002 完成 spec、plan、tasks 和 verify 骨架。
- [x] T003 记录 daemon、API、Web、Node、Electron Forge 当前基线。

## 配对协议与 API

- [x] T004 新增 shared 配对 schema、状态和错误 contract。
- [x] T005 实现一次性配对码创建、查询、过期和原子领取。
- [x] T006 实现 owner/daemon 绑定的 HMAC 设备 token 签发与验证。
- [x] T007 新增创建、状态和公开领取 API。
- [x] T008 改造 DaemonRegistry，按设备 token owner 注册并校验 daemonId。
- [x] T009 增加配对服务、API、过期、重复领取和非法 token 测试。

## Daemon 连接生命周期

- [x] T010 为 daemon client 增加状态回调、AbortSignal 和可控重连。
- [x] T011 正确处理 ready、registered、error 与协议不匹配消息。
- [x] T012 保持 CLI start/health 兼容并补充测试。

## Electron 桌面端

- [x] T013 增加 Electron Forge、Vite、Squirrel、DMG 和安全 fuse 配置。
- [x] T014 实现桌面配置模型与原子文件写入。
- [x] T015 使用 Electron `safeStorage` 加密设备 token。
- [x] T016 实现单实例与 `seekdesk://pair` 深链解析。
- [x] T017 实现系统目录选择器和工作区校验。
- [x] T018 实现 daemon 启停、连接状态和自动重连编排。
- [x] T019 实现托盘菜单、显示/隐藏、重新配对与安全退出。
- [x] T020 实现开机启动设置。
- [x] T021 实现三步配对向导和错误恢复 UI。
- [x] T022 添加桌面图标与安装器资源。
- [x] T023 增加 config、deep-link、pairing client 与状态机单测。

## Web 配对引导

- [x] T024 新增 `useDaemonPairing` hook。
- [x] T025 在新建对话本机 tab 增加安装与配对入口。
- [x] T026 展示下载、配对码、复制、深链打开和过期状态。
- [x] T027 配对成功后刷新工作区并自动选中新 workspace。
- [x] T028 增加稳定 loading/error/disabled/focus 状态和响应式布局。
- [x] T029 增加 hook、mapper 与组件测试。

## 打包、文档与验收

- [x] T030 增加根目录 daemon package/make 脚本和产物忽略规则。
- [x] T031 生成并校验 macOS DMG/ZIP 开发安装产物。
- [x] T032 校验 Windows Squirrel 配置与目标平台构建指引。
- [x] T033 增加安装器/配对 smoke 脚本。
- [x] T034 更新 README 安装、配对、升级、卸载和故障排查。
- [x] T035 更新完整流程与 Runtime 安全边界文档。
- [x] T036 更新 CODE_MAP 和 PROJECT_PROGRESS。
- [x] T037 运行 diff、lint、test、typecheck、build 和 secret hygiene。
- [x] T038 运行 API 配对、daemon 重连和现有双 Runtime 回归。
- [x] T039 清理安装产物之外的临时文件并检查 Git 状态。
- [ ] T040 提交、push、合并 main 并在 main 回归。
