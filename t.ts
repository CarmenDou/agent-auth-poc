import { AgentAuthClient } from "@auth/agent";
const PROVIDER = "http://localhost:3737";
const wt = <T,>(p:Promise<T>,ms:number)=>Promise.race([p,new Promise<T>((_,r)=>setTimeout(()=>r(new Error("__timeout__")),ms))]);
const client = new AgentAuthClient({ allowDirectDiscovery: true });
await wt(client.discoverProvider(PROVIDER), 8000);
console.log("=== connectAgent 只申请 get_status (approval=none) ===");
try {
  const a:any = await wt(client.connectAgent({ provider: PROVIDER, name: "poc-a1", capabilities: ["get_status"] }), 10000);
  console.log("返回:", JSON.stringify(a, null, 2).slice(0,800));
} catch(e:any){ console.log("挂起/超时 →", e?.message); 
  console.log("=> 说明连 none 能力的 agent 注册也要人批准（默认 pending）"); }
process.exit(0);
