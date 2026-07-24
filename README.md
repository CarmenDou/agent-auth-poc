# Agent Auth POC

用 [Better Auth](https://better-auth.com) + `@better-auth/agent-auth`（[Agent Auth Protocol](https://github.com/nicepkg/agent-auth-protocol) 的实现）搭的一个**能跑的** agent auth POC。纯本地、SQLite、不需要任何外部账号。

演示的核心：**agent 自注册 → 低风险动作直接过 → 高风险动作要人批准（step-up）**。

## 跑起来

```bash
npm install
npm run server   # 起 provider，http://localhost:3737
```

打开看：
- 发现文档：http://localhost:3737/api/auth/agent-configuration
- 能力清单：http://localhost:3737/api/auth/capability/list
  - `get_status` → approval_strength: **none**（低风险，不用人）
  - `create_project` → approval_strength: **session**（高风险 → 要人批准）

## 之后

`npm run agent` —— 扮演 agent 走一遍：发现 → 自注册 → 执行 get_status ✅ → 执行 create_project ⛔（要人批准）→ 人批准 → ✅（agent.ts 正在写）。
