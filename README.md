# Agent Auth POC

用 [Better Auth](https://better-auth.com) + `@better-auth/agent-auth`（[Agent Auth Protocol](https://github.com/better-auth/agent-auth) 的实现）+ 官方客户端 SDK `@auth/agent` 搭的一个**能跑的** agent auth POC。纯本地、SQLite、不需要任何外部账号。

## 跑起来

```bash
npm install
npm run server   # 起 provider（http://localhost:3737）
npm run agent    # 另开一个终端，扮演 agent 走流程
```

## 你能看到什么（已验证）

**服务端（provider）** —— `npm run server` 后浏览器打开：
- 发现文档：http://localhost:3737/api/auth/agent-configuration
- 能力清单：http://localhost:3737/api/auth/capability/list
  - `get_status` → approval_strength **none**（低风险，不用人）
  - `create_project` → approval_strength **session**（高风险 → 要人批准）

**客户端（agent）** —— `npm run agent`：
1. ① 发现 provider ✅
2. ② agent 自注册（SDK 自动生成 Ed25519 密钥）→ **进入 PENDING：必须有人批准这个 agent，它才能干活**

## 关键结论（这就是 POC 想验的）

这套（Better Auth Agent Auth Protocol）**默认就是"人在环"**：
- **agent 能自注册（不用人、不用上游 AI 厂商），但注册后是 PENDING** —— 一个人（用户）必须批准这个 agent，它才激活。批准走 device-authorization 式（给个 code，人去 `/device/capabilities` 输码批准）。
- **能力分级**：`approvalStrength: none / session / webauthn` 一行配置，决定"要不要人批准"（webauthn = 要物理确认，专门防 AI 自动批准）。
- **不依赖上游**：全程只要 你（provider）+ agent + 人，Anthropic/OpenAI 不用做任何事。

→ 对应我们讨论的"铁三角"：想要真实身份 + 不被薅，就得有人批准那一下；这套把那一下做成了 agent 注册时的审批。

## 现状 / TODO

- `server.ts` 服务端 + 发现/能力：✅ 完整可跑。
- `agent.ts` 客户端：走到"注册 → PENDING 等批准"这一步（人在环的核心）。
- TODO：脚本化"人批准"那一步（建个用户 + 批准 pending agent），让 `npm run agent` 一条命令跑完整条（注册 → 批准 → 执行 get_status ✅ → 执行 create_project 需再批准）。
