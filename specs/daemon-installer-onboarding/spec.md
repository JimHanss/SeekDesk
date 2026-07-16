# SeekDesk 本机 Daemon 安装包与配对引导规格

## 目标

把现有命令行 daemon 产品化为可安装、可配对、可自动重连的 Windows/macOS 桌面组件，让用户无需手工配置长期 token 即可把本机项目接入 SeekDesk。

## 用户

- 希望让 SeekDesk 直接操作本机项目的 Windows 和 macOS 用户。
- 需要部署、支持或排查本机 Runtime 的管理员与开发者。

## 用户场景

1. 用户在“新建对话”中选择“本机项目”，下载并安装 SeekDesk Daemon。
2. Web 端生成 10 分钟有效的一次性配对码，并通过 `seekdesk://` 深链打开桌面端。
3. 桌面端领取设备凭据，安全保存后让用户选择本机工作区。
4. daemon 在后台连接 API，Web 自动发现工作区并允许创建对话。
5. 用户可从托盘查看连接状态、切换工作区、控制开机启动、重新配对或退出。

## 范围内

- Electron Forge 桌面应用。
- Windows Squirrel 安装器与 macOS DMG/ZIP 构建配置。
- 一次性配对码、短期领取、单次消费和设备 token。
- Electron `safeStorage` 加密保存设备 token。
- 单实例、`seekdesk://` 深链、系统目录选择器、托盘和开机启动。
- daemon 连接状态、取消、重连和配对完成事件。
- Web 新建对话弹窗中的安装、配对、轮询和错误恢复引导。
- CLI 继续可用，便于开发和无桌面环境部署。

## 范围外

- Apple Developer ID、Windows Authenticode 正式证书采购与公证账号配置。
- 自动更新服务、发布 CDN 和 GitHub Release 自动上传。
- 多设备撤销控制台、企业设备策略和 MDM。
- 修改 coding tool 或审批安全策略。

## 验收标准

- **AC-01**：Web 可创建 10 分钟有效的一次性配对码，并显示状态、复制按钮和深链打开按钮。
- **AC-02**：配对码只能成功领取一次；错误、过期和重复领取均返回稳定错误码。
- **AC-03**：设备 token 带 owner、daemon、签发/过期信息并通过 HMAC 验证；daemonId 不匹配时拒绝注册。
- **AC-04**：桌面端能通过深链或手工输入完成配对，使用系统目录选择器选择工作区并连接远程 API。
- **AC-05**：桌面端单实例运行，支持托盘、连接状态、开机启动、重新配对和安全退出。
- **AC-06**：设备 token 不以明文写入配置；日志、API 状态和 Web 页面不回显 token。
- **AC-07**：Windows/macOS 构建脚本可生成对应平台安装产物；未签名构建明确标注为开发产物。
- **AC-08**：现有 `seekdesk-daemon start` CLI、local daemon 工具执行和双 Runtime smoke 不回归。
- **AC-09**：页面在桌面与移动视口无乱码、问号占位、布局跳动和无效按钮。

## 边界情况

- API URL 非法、生产环境使用非 HTTPS、配对码过期或已使用。
- Electron `safeStorage` 不可用、配置损坏或工作区被移动。
- daemon 断网、API 重启、WebSocket 协议不匹配或设备 token 过期。
- 用户重复点击深链、同时启动多个桌面进程或取消目录选择。

## 假设

- 开发环境允许 `http://localhost` 和内网调试地址；生产配对必须使用 HTTPS。
- v1 设备 token 默认有效 30 天，可重新配对更新；设备级撤销控制台留到下一阶段。
- 安装产物按目标平台构建，不承诺从 macOS 交叉生成 Windows Squirrel 安装器。
