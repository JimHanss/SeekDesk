# SeekDesk 前端代码总结

## App 入口
- `apps/web/src/app/page.tsx`：浏览器工作台入口，组合会话、聊天、右侧详情面板和设置入口；当前默认发送 `coding_agent` 请求。
- `apps/web/src/app/templates/page.tsx`：模板管理页入口，复用模板域和表单逻辑。
- `apps/web/src/app/globals.css`：全局布局、主题变量和基础视觉样式。

## Daily Work 目录的当前职责
当前目录名仍是 `features/daily-work`，但页面已承载编程 Agent 工作台。后续可以整体重命名为 `features/coding-agent`，当前先保持路径稳定减少一次性迁移风险。

## 主要组件
- `components/DailyWorkDashboardShell.tsx`：工作台外壳，负责左侧会话栏、中间对话区、右侧按需面板的整体布局。
- `components/DailyWorkAssistantView.tsx`：对话窗口主视图，展示当前会话标题、消息列表、输入框和运行详情开关。
- `chat/components/ChatThread.tsx`：消息流、工具计划、审批动作、执行结果和错误重试展示。
- `chat/components/ChatComposer.tsx`：输入框、发送按钮和键盘提交逻辑。
- `components/panels/*`：模板、上下文、工作流、产物、历史、活动、模型用量、持久化和设置等按需面板。
- `components/common/*`：复用的按钮、徽标、状态块、布局原语和格式化展示。

## Hooks
- `chat/hooks/useChatController.ts`：核心聊天状态机；发送请求、读取流、刷新 trace、处理授权和执行 tool call。
- `hooks/useDailySessions.ts`：会话列表、当前会话、排序、创建、重命名、删除、置顶。
- `hooks/useDailyContext.ts`：上下文列表、上传状态、选中上下文和 token 估算。
- `hooks/useArtifacts.ts`：产物列表、选中产物、产物详情刷新。
- `hooks/useActivityFeed.ts`：活动审计流读取和前端映射。
- `hooks/useModelUsagePanel.ts`：模型 token 汇总和明细展示。
- `hooks/usePersistencePanel.ts`：持久化和运行时健康状态。
- `hooks/useDailyWorkPanels.ts`：右侧面板开关、当前面板、详情面板选择状态。

## Domain 与 Mappers
- `domain/base.ts`：当前模式、基础常量、默认会话和 UI 文案基线。
- `domain/agent-trace.ts`：trace、权限边界、工具调用和运行详情映射。
- `domain/templates.ts`：模板列表、模板状态、模板表单数据和展示格式。
- `domain/context.ts`：上下文项、上传文件、token 估算、截断提示。
- `domain/artifacts.ts`：产物类型、来源、摘要和关联信息。
- `domain/activity.ts`：活动事件状态、风险级别和时间线格式。
- `domain/model-usage.ts`：token 汇总、模型快照和用量明细映射。

## 前端原则
- 默认聊天区保持简洁，不铺满全局配置。
- 详情信息通过按钮打开，避免右侧固定空白区。
- 选中状态使用稳定尺寸和透明边框，避免点击后布局跳动。
- 不再发起外部账号授权或连接状态请求。
