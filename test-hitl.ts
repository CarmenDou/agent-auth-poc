// 一次跑完，演示 human-in-the-loop：拦住 → 人批准 → 放行
import { AgentAuthClient } from "@auth/agent";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const PROVIDER = "http://localhost:3737";
const client = new AgentAuthClient({ allowDirectDiscovery: true });
const run = (id: string, cap: string, args: any = {}) =>
  client.executeCapability({ agentId: id, capability: cap, arguments: args })
    .then((r) => `✅ 通过 → ${JSON.stringify(r)}`)
    .catch((e) => `⛔ 被拦 → ${e?.code ?? e?.message}`);

// 模拟“人批准”：直接往授予表写一行 active grant（真实里这是人在 /device 输码/点批准）
function humanApproves(agentId: string, capability: string) {
  const db = new Database("poc.sqlite");
  const now = new Date().toISOString();
  // 先确保有个真人用户（批准者）
  let user: any = db.prepare("SELECT id FROM user WHERE email = ?").get("carmen@insforge.dev");
  if (!user) {
    const uid = randomUUID();
    db.prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?,?,?,1,?,?)`)
      .run(uid, "Carmen", "carmen@insforge.dev", now, now);
    user = { id: uid };
  }
  // 人认领这个 autonomous agent（成为 owner）——autonomous 模式的人工闸门
  db.prepare(`UPDATE agent SET userId = ? WHERE id = ?`).run(user.id, agentId);
  db.prepare(
    `INSERT INTO agentCapabilityGrant (id, agentId, capability, status, grantedBy, createdAt, updatedAt)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  ).run(randomUUID(), agentId, capability, user.id, now, now);
  db.close();
}

await client.discoverProvider(PROVIDER);
const agent: any = await client.connectAgent({
  provider: PROVIDER, mode: "autonomous", name: "poc-assistant",
  capabilities: ["get_status", "create_project"],
});
console.log(`\n② 自注册完成（没有人）：status=${agent.status}\n`);

console.log("③ 人还没批准时：");
console.log("   get_status     ", await run(agent.agentId, "get_status"));
console.log("   create_project ", await run(agent.agentId, "create_project", { name: "demo" }));

console.log("\n④ 👤 人批准了 get_status（模拟点了‘同意’）……");
humanApproves(agent.agentId, "get_status");

console.log("\n⑤ 批准之后：");
console.log("   get_status     ", await run(agent.agentId, "get_status"));
console.log("   create_project ", await run(agent.agentId, "create_project", { name: "demo" }), " ← 高风险，人没批，仍被拦");
process.exit(0);
