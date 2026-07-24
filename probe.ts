import { generateKeyPairSync } from "node:crypto";
const BASE = "http://localhost:3737/api/auth";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const jwk = publicKey.export({ format: "jwk" });
const kid = "poc-key-1";
async function post(path: string, body: any) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  console.log(`\n[POST ${path}] HTTP ${r.status}`);
  try { console.log(JSON.stringify(JSON.parse(t), null, 2)); } catch { console.log(t.slice(0, 500)); }
  return { status: r.status, text: t };
}
// 试几种注册体，看服务器认哪个
console.log("公钥 JWK:", JSON.stringify(jwk));
await post("/agent/register", { name: "poc-agent", mode: "autonomous", publicKey: jwk, kid, capabilities: ["get_status"] });
await post("/agent/register", { name: "poc-agent", mode: "autonomous", public_key: jwk, kid, capabilities: ["get_status"] });
