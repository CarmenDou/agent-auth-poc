// 一个真实的 Agent Auth provider（Better Auth + @better-auth/agent-auth）
// 跑起来后：agent 可以发现它、注册、请求能力、执行；高风险能力要人批准。
import { betterAuth } from "better-auth";
import { agentAuth } from "@better-auth/agent-auth";
import { toNodeHandler } from "better-auth/node";
import Database from "better-sqlite3";
import http from "node:http";

const PORT = 3737;

export const auth = betterAuth({
  baseURL: `http://localhost:${PORT}`,
  secret: "poc-demo-secret-please-change-32chars-min",
  database: new Database("poc.sqlite"),
  emailAndPassword: { enabled: true }, // 让"人"能有账号来批准
  plugins: [
    agentAuth({
      allowDynamicHostRegistration: true,
      providerName: "InsForge POC",
      providerDescription: "Agent auth 流程 POC（这是个假的后端）",
      capabilities: [
        {
          name: "get_status",
          description: "读一下项目状态（低风险，不用人）",
          approvalStrength: "none",
          input: { type: "object", properties: {} },
        },
        {
          name: "create_project",
          description: "建一个项目（高风险 → 要人批准）",
          approvalStrength: "session",
          input: { type: "object", properties: { name: { type: "string" } } },
        },
      ],
      onExecute: async ({ capability, arguments: args }) => {
        if (capability === "get_status") return { ok: true, status: "healthy" };
        if (capability === "create_project")
          return { ok: true, projectId: "proj_" + Math.random().toString(36).slice(2, 8), name: (args as any)?.name };
        return { ok: false };
      },
    }),
  ],
});

const handler = toNodeHandler(auth);
http
  .createServer((req, res) => {
    // 顺手加个根路径提示
    if (req.url === "/.well-known/agent-configuration") { (req as any).url = "/api/auth/agent-configuration"; return handler(req, res); }
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        "InsForge Agent-Auth POC 在跑。\n" +
          `发现文档: http://localhost:${PORT}/api/auth/agent-configuration\n` +
          `能力清单: http://localhost:${PORT}/api/auth/capability/list\n`
      );
      return;
    }
    handler(req, res);
  })
  .listen(PORT, () => console.log(`✅ POC server 在跑: http://localhost:${PORT}`));
