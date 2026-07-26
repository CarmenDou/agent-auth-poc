// 扮演 agent，用官方 SDK @auth/agent 走一遍 agent auth 流程（每步带超时，绝不挂死）
import { AgentAuthClient } from "@auth/agent";
const PROVIDER = "http://localhost:3737";
const line = (s: string) => console.log("\n" + s);
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`__timeout__ ${label} (${ms}ms)`)), ms))]);

const client = new AgentAuthClient({ allowDirectDiscovery: true });

try {
  line("① 发现 provider");
  const config: any = await withTimeout(client.discoverProvider(PROVIDER), 8000, "discover");
  console.log("   provider:", config.provider_name);

  line("② 自注册 agent（自动生成 Ed25519 密钥）");
  const agent: any = await withTimeout(
    client.connectAgent({ provider: PROVIDER, mode: "autonomous", name: "poc-assistant", capabilities: ["get_status", "create_project"] }),
    12000, "connect");
  console.log("   agentId:", agent.agentId, "| status:", agent.status ?? "?");

  line("③ 执行低风险 get_status（应直接过，不用人）");
  try {
    const r = await withTimeout(client.executeCapability({ agentId: agent.agentId, capability: "get_status", arguments: {} }), 8000, "get_status");
    console.log("   ✅ 结果:", JSON.stringify(r));
  } catch (e: any) { console.log("   ⛔", e?.message ?? JSON.stringify(e)); }

  line("④ 执行高风险 create_project（应被拦，要人批准）");
  try {
    const r = await withTimeout(client.executeCapability({ agentId: agent.agentId, capability: "create_project", arguments: { name: "demo" } }), 6000, "create_project");
    console.log("   ✅ 结果:", JSON.stringify(r));
  } catch (e: any) {
    if (String(e?.message).includes("__timeout__")) console.log("   ⛔ 被拦 → 挂起等待人批准（高风险 step-up，符合预期）");
    else console.log("   ⛔ 被拦:", e?.code ?? e?.message ?? JSON.stringify(e));
  }
} catch (e: any) {
  console.log("\n出错:", e?.code ?? e?.message ?? JSON.stringify(e));
}
process.exit(0);
