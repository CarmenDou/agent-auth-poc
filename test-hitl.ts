// Runs end-to-end in one shot to demonstrate human-in-the-loop:
// blocked -> human approves -> allowed.
import { AgentAuthClient } from "@auth/agent";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

const PROVIDER = "http://localhost:3737";
const client = new AgentAuthClient({ allowDirectDiscovery: true });
const run = (id: string, cap: string, args: any = {}) =>
  client.executeCapability({ agentId: id, capability: cap, arguments: args })
    .then((r) => `OK -> ${JSON.stringify(r)}`)
    .catch((e) => `blocked -> ${e?.code ?? e?.message}`);

// Simulate "a human approves": write an active grant row directly. In the real
// world this is a person entering a code / clicking approve at /device.
function humanApproves(agentId: string, capability: string) {
  const db = new Database("poc.sqlite");
  const now = new Date().toISOString();
  // Make sure there is a real user (the approver) first.
  let user: any = db.prepare("SELECT id FROM user WHERE email = ?").get("carmen@insforge.dev");
  if (!user) {
    const uid = randomUUID();
    db.prepare(`INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?,?,?,1,?,?)`)
      .run(uid, "Carmen", "carmen@insforge.dev", now, now);
    user = { id: uid };
  }
  // The human claims this autonomous agent (becomes owner) -- the gate for autonomous mode.
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
console.log(`\n2. Self-registered (no human): status=${agent.status}\n`);

console.log("3. Before the human approves:");
console.log("   get_status     ", await run(agent.agentId, "get_status"));
console.log("   create_project ", await run(agent.agentId, "create_project", { name: "demo" }));

console.log("\n4. Human approves get_status (simulating a click on 'approve')...");
humanApproves(agent.agentId, "get_status");

console.log("\n5. After approval:");
console.log("   get_status     ", await run(agent.agentId, "get_status"));
console.log("   create_project ", await run(agent.agentId, "create_project", { name: "demo" }), " <- high-risk, not approved, still blocked");
process.exit(0);
