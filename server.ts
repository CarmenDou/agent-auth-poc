// A real Agent Auth provider (Better Auth + @better-auth/agent-auth).
// Once running: an agent can discover it, register, request capabilities, and
// execute them; high-risk capabilities require human approval.
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
  emailAndPassword: { enabled: true }, // so a human can have an account to approve with
  plugins: [
    agentAuth({
      allowDynamicHostRegistration: true,
      modes: ["autonomous"],
      providerName: "InsForge POC",
      providerDescription: "Agent auth flow POC (this is a fake backend)",
      capabilities: [
        {
          name: "get_status",
          description: "Read project status (low risk, no human needed)",
          approvalStrength: "none",
          input: { type: "object", properties: {} },
        },
        {
          name: "create_project",
          description: "Create a project (high risk -> requires human approval)",
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
    if (req.url === "/.well-known/agent-configuration") { (req as any).url = "/api/auth/agent-configuration"; return handler(req, res); }
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        "InsForge Agent-Auth POC is running.\n" +
          `Discovery:    http://localhost:${PORT}/api/auth/agent-configuration\n` +
          `Capabilities: http://localhost:${PORT}/api/auth/capability/list\n`
      );
      return;
    }
    handler(req, res);
  })
  .listen(PORT, () => console.log(`POC server running: http://localhost:${PORT}`));
