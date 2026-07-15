# SeekDesk Cloud Runtime 运维手册

## 组件

- API：公共 workspace、chat、grant 和 tool execution API。
- cloud runtime：仅内部可访问的生命周期服务，持有 Docker socket。
- runtime worker image：`seekdesk-runtime:node22`，在容器内执行统一 coding tools。
- Postgres：持久化 workspace、operation、session、tool、grant 和审计。
- storage root：owner/workspace 隔离的 Git checkout 与持久卷目录。

## 部署前检查

1. Docker Engine 可用，daemon 有权限访问 socket。
2. Runtime storage 所在磁盘满足每 workspace 10 GB 配额及预留空间。
3. Postgres 已迁移，API 与 cloud service 使用同一可信数据环境。
4. 已配置强随机 service token 和 32-byte credential encryption key。
5. 生产 auth 使用 OIDC/JWT，未配置时不要开启 cloud runtime。
6. 仅 cloud runtime service 挂载 Docker socket；API、web 和 worker 不挂载。

构建与启动：

```bash
docker build -f docker/runtime-worker.Dockerfile -t seekdesk-runtime:node22 .
docker compose -f docker-compose.postgres.yml up -d
docker compose -f docker-compose.runtime.yml up -d
npm run db:migrate
```

## 健康检查

- API `GET /health`：关注 `postgresReady`、auth mode、cloud configured/internal ready、Docker ready。
- cloud `GET /internal/health`：必须带 service token；关注 `status`、`dockerReady` 和 `activeWorkspaces`。
- `GET /api/coding/workspaces/:workspaceId`：查看持久化状态、最新 operation 和脱敏错误。

建议监控：

- provision/clone/start/execute/delete 成功率和耗时。
- `runtime_unavailable`、`repository_clone_failed`、timeout 和 quota 错误数。
- active/stopped/error workspace 数、容器数和孤儿容器数。
- storage 使用率、inode、Postgres 连接和 operation backlog。
- idle stop、reconcile 和 cleanup 重试次数。

## 生命周期

### Provision

API 先写 workspace 与幂等 operation，再调用 internal service。cloud service 创建安全目录、clone/checkout、记录 revision、创建受限容器，并把状态更新为 ready。重复 idempotency key 返回原 operation，不重复建容器。

### Start/Stop

停止保留 checkout 与 workspace metadata。启动检查容器；容器缺失时按持久化 workspace 重新创建。普通工具只在 ready 状态执行。

### Retry

clone 或 provision 失败后使用新 idempotency key retry。服务先清理失败的受管资源，再重新进入 provision。错误信息必须脱敏。

### Delete

workspace 进入 deleting 后拒绝新请求，取消队列，停止并删除受管容器，清理 owner-scoped storage，最后标记 deleted。失败保持可重试状态，不能删除 workspace root 之外目录。

## Reconcile 与重启恢复

- cloud service 启动时读取持久化/本地状态并 inspect 受管容器。
- ready 但容器缺失或 crash 的 workspace 转为明确 error/stopped，不伪造在线。
- API 重启后从 Postgres恢复 session、operation 和审计；cloud client 重新拉取状态。
- daemon 与 cloud runtime 使用不同 adapter，任一故障不应影响另一 Runtime 的请求。
- reconcile 只能管理带 SeekDesk label 和已知 workspace ref 的容器，不处理无关 Docker 资源。

## 空闲停止

成功执行会更新 `lastActiveAt`。维护任务按 `SEEKDESK_RUNTIME_IDLE_TTL_MINUTES` 检查 ready workspace，默认 30 分钟无活动后停止容器。正在执行或排队的 workspace 不进入 idle stop。

## 备份与恢复

- Postgres 是 workspace/session/tool/grant/audit 的权威数据源，应按业务 RPO 做快照和 WAL 备份。
- cloud workspace 是 Git checkout 加未提交改动；删除前若需要保留，应先生成 artifact/diff 或由用户提交到远端 Git。
- 备份 storage 时必须保持 owner/workspace 路径和文件权限，凭据明文不应存在于 storage。
- 恢复后先运行 migration，再启动 cloud service reconcile，最后开放 API 流量。

## 事故处理

### Docker 不可用

1. 禁止新 provision，公共 API 返回 degraded/runtime unavailable。
2. 保留现有 workspace/operation 状态，不切换到 server-local。
3. 修复 Docker Engine 后运行 health 和 reconcile，再逐个 retry。

### 凭据疑似泄露

1. 撤销 repository credential 和上游 Git token。
2. 轮换 `SEEKDESK_CREDENTIAL_ENCRYPTION_KEY_VERSION`，保留 previous key 仅用于受控迁移。
3. 检查日志、operation error 和容器环境是否通过 secret hygiene。
4. 重新创建受影响 workspace。

### 存储耗尽

1. 停止新 provision，保留正在运行的写操作。
2. 列出已 deleted/stopped 且可清理的受管目录。
3. 只通过 workspace metadata 删除精确 owner-scoped 路径。
4. 扩容后执行 quota、目录 marker 和容器挂载检查。

### 容器异常或逃逸风险

1. 隔离 cloud runtime 主机并停止 public API 到 internal service 的流量。
2. 保存容器 metadata 和审计，不在受影响主机执行不必要命令。
3. 轮换 service token、Git token 和 encryption key。
4. 从可信 image 重建主机，恢复 Postgres 后重新 provision workspace。

## 清理验收

测试结束后只删除本次 fixture 的容器、网络和 workspace 目录。核对：

- 没有本次 workspace label 的残留容器。
- 没有临时 askpass/token 文件。
- owner storage 外的用户目录未变化。
- operation 最终状态与实际 Docker 状态一致。
- 无关 Docker 网络、volume 和容器未被删除。
