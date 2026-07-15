# Runtime Worker 容器启动边界

`runtime-worker.Dockerfile` 只提供 non-root image。cloud-runtime 创建容器时必须同时应用以下运行参数：

```console
docker run --detach \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=256m \
  --mount type=bind,src=<workspace>,dst=/workspace \
  --network none \
  --cap-drop ALL \
  --security-opt no-new-privileges=true \
  --pids-limit 256 \
  --cpus 2 \
  --memory 4g \
  --user 10001:10001 \
  --env SEEKDESK_RUNTIME_WORKSPACE_ID=<workspace-id> \
  seekdesk-runtime:node22
```

约束：

- 不挂载 Docker socket，不使用 `--privileged`，不添加 Linux capabilities。
- 普通 coding tool 容器使用 `--network none`；Git clone/bootstrap 由 cloud-runtime 在受控阶段完成。
- `/workspace` 是唯一持久化可写目录，`/tmp` 仅作为受限临时空间。
- cloud-runtime 必须使用参数数组调用 Docker，不得把用户输入拼接为 shell 命令。
