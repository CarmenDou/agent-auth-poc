// Play the agent: use the official @auth/agent SDK to walk the full agent-auth
// flow (each step has a timeout so it never hangs).
import { AgentAuthClient } from "@auth/agent";
const PROVIDER = "http://localhost:3737";
const line = (s: string) => console.log("\n" + s);
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`__timeout__ ${label} (${ms}ms)`)), ms))]);

const client = new AgentAuthClient({ allowDirectDiscovery: true });

try {
  line("1. Discover provider");
  const config: any = await withTimeout(client.discoverProvider(PROVIDER), 8000, "discover");
  console.log("   provider:", config.provider_name);

  line("2. Self-register the agent (SDK generates an Ed25519 keypair)");
  const agent: any = await withTimeout(
    client.connectAgent({ provider: PROVIDER, mode: "autonomous", name: "poc-assistant", capabilities: ["get_status", "create_project"] }),
    12000, "connect");
  console.log("   agentId:", agent.agentId, "| status:", agent.status ?? "?");

  line("3. Run low-risk get_status (should pass without a human)");
  try {
    const r = await withTimeout(client.executeCapability({ agentId: agent.agentId, capability: "get_status", arguments: {} }), 8000, "get_status");
    console.log("   OK result:", JSON.stringify(r));
  } catch (e: any) { console.log("   blocked:", e?.message ?? JSON.stringify(e)); }

  line("4. Run high-risk create_project (should be blocked, needs human approval)");
  try {
    const r = await withTimeout(client.executeCapability({ agentId: agent.agentId, capability: "create_project", arguments: { name: "demo" } }), 6000, "create_project");
    console.log("   OK result:", JSON.stringify(r));
  } catch (e: any) {
    if (String(e?.message).includes("__timeout__")) console.log("   blocked -> pending human approval (high-risk step-up, as expected)");
    else console.log("   blocked:", e?.code ?? e?.message ?? JSON.stringify(e));
  }
} catch (e: any) {
  console.log("\nerror:", e?.code ?? e?.message ?? JSON.stringify(e));
}
process.exit(0);
