# SeekDesk 前端代码总结

## 路由入口

- `apps/web/src/app/page.tsx`：编程工作台组合入口；连接会话、聊天、双 Runtime 工作区、右侧工具面板和设置，不承载底层业务实现。
- `apps/web/src/app/templates/page.tsx`：历史模板管理兼容入口。
- `apps/web/src/app/globals.css`：全局主题、全屏自适应布局、固定尺寸按钮和滚动区域。
- `apps/web/next.config.ts`：同源 API rewrite、远程 API proxy 和 Next dev `allowedDevOrigins`。

当前目录仍名为 `features/daily-work`，这是为降低大规模路径迁移风险保留的历史名称；产品页面和请求默认使用 `coding_agent`。

## 工作台组件

- `components/DailyWorkDashboardShell.tsx`：全屏外壳、左侧工作区/会话列表、顶部工具入口和按需右侧面板。
- `components/DailyWorkAssistantView.tsx`：当前会话标题、消息流、输入框、发送、流式状态与错误恢复。
- `components/NewConversationWorkspaceDialog.tsx`：新建对话；本机 tab 提供安装下载、一次性配对、工作区发现与选择，云端 tab 创建/管理 cloud workspace。
- `hooks/useDaemonPairing.ts`：创建配对会话、10 分钟倒计时、轮询 claimed/expired、网络错误收敛和成功刷新。
- `components/DailyWorkSettingsSection.tsx`：模型、持久化、Runtime、审批与安全策略设置；不负责工作区选择。
- `components/DailyWorkModuleStack.tsx`：兼容功能模块的组合容器。
- `components/DailyWorkPrimitives.tsx`：面板标题、状态标签、空状态等轻量展示原语。

## 聊天

- `chat/hooks/useChatController.ts`：发送 `coding_agent` 请求、消费模型流、绑定 session/workspace、加载 trace、批准或撤销 grant、执行 tool call；提供显式发送命令并兼容非安全 LAN 开发环境的 client id fallback。
- `chat/components/ChatThread.tsx`：用户/助手消息、工具计划、审批结果、失败与重试。
- `chat/mappers/message-content.ts`：把 API 消息内容转换为稳定的展示模型。

## 双 Runtime 与会话

- `hooks/useCodingWorkbench.ts`：读取工作区、文件树、文件、搜索、Git status/diff；提交 cloud create/start/stop/retry/delete；每个请求携带当前 `workspaceId/runtimeMode`。
- `hooks/useSessionHistory.ts`：会话加载、新建、选择、重命名、删除、置顶和按工作区分组。
- `domain/workspace-runtime.ts`：共享 workspace DTO 的 UI mapper、Runtime 状态文本、ready 判断、分组和错误归一化。
- `domain/workspace-runtime.test.ts`：local/cloud 状态、表单和错误映射测试。
- `domain/sessions.ts`：置顶优先、组内 `createdAt` 倒序的稳定排序，以及 workspace Runtime badge。
- `domain/agent-trace.ts`：trace、tool call、grant、activity、terminal、artifact 和 workspace 关联映射。

## 右侧工具面板

- `components/panels/CodingWorkbenchPanels.tsx`：文件、搜索、Diff、终端和运行详情；关闭时不保留空白栏。
- `components/panels/ActivityFeedPanel.tsx`：当前 workspace/session 的审计时间线。
- `components/panels/ArtifactPanel.tsx`：文件写入或模型产物及其 tool/session 引用。
- `components/panels/ModelUsagePanel.tsx`：当前会话、24 小时、7 天和总 token 聚合与明细。
- `components/panels/ApprovalLedgerPanel.tsx`：兼容审批记录展示；coding 执行以 permission grant 为主。
- `components/panels/SessionHistoryPanel.tsx`：历史会话详情兼容面板。
- `components/panels/ModeSnapshotPanel.tsx`：当前模型与模式快照。
- `components/panels/ContextPanel.tsx`、`TemplateLibraryPanel.tsx`、`WorkflowPreviewPanel.tsx`：历史 daily-work 兼容面板，不出现在默认 coding 主流程。

## 其他 Hooks 与 Domain

- `hooks/useDailyWorkPanels.ts`：统一控制唯一活动右侧面板，避免多个面板叠加。
- `hooks/useActivityFeed.ts`、`useArtifacts.ts`、`useModelUsagePanel.ts`、`usePersistencePanel.ts`：分别读取审计、产物、token 和数据层健康状态。
- `hooks/useDailyWorkSelectionState.ts`：集中保存当前 session、workspace、文件和详情项选择。
- `domain/runtime.ts`、`persistence.ts`、`model-usage.ts`、`activity.ts`、`artifacts.ts`：把后端 payload 映射为 UI 类型并提供明确降级文案。
- `types.ts`：前端组合类型；workspace/runtime 公共类型优先复用 `@seekdesk/shared`。

## 页面联动

1. 新建对话弹窗选择 ready workspace，创建 session 并固定 runtime binding。
2. 聊天控制器发送消息，trace 返回 tool calls 和 grant。
3. 只读结果可定位到文件、搜索或 Diff；待授权工具显示在运行详情。
4. 批准执行后刷新 trace、activity、artifact、terminal、Git diff 和 model usage。
5. 切换历史会话时，所有右侧请求切换到该 session 的 workspace，不使用设置页全局目录。

## UI 质量约束

- 默认只显示会话与聊天，右侧面板按需打开。
- 选中态使用固定边框和尺寸，不因 border 变化跳动。
- Runtime 错误只显示一次明确提示，不循环重试刷屏。
- 页面不出现邮箱/日历/连接器入口、乱码、连续问号、调试占位或无响应按钮。
