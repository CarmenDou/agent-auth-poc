import { SignJWT, exportJWK, generateKeyPair } from "jose";
const BASE = "http://localhost:3737/api/auth";
const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
const jwk = await exportJWK(publicKey);
const kid = "poc-key-1";
async function mkJwt(typ: string) {
  return await new SignJWT({ name: "poc-agent", mode: "autonomous", capabilities: ["get_status"] })
    .setProtectedHeader({ alg: "EdDSA", typ, kid, jwk })
    .setIssuedAt().setExpirationTime("5m").setIssuer("poc-agent").setAudience(BASE).setSubject("poc-agent")
    .sign(privateKey);
}
async function post(path: string, body: any, headers: any = {}) {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const t = await r.text();
  console.log(`\n[${path}] ${JSON.stringify(headers).slice(0,40)} HTTP ${r.status}: ${t.slice(0,220)}`);
}
const jwt = await mkJwt("agent-registration+jwt");
// 试各种放法
await post("/agent/register", { proof: jwt });
await post("/agent/register", { registration: jwt });
await post("/agent/register", { assertion: jwt });
await post("/agent/register", jwt);                          // 裸 JWT 当 body
await post("/agent/register", {}, { authorization: `Bearer ${jwt}` });
// 换 typ
await post("/agent/register", { proof: await mkJwt("agent-auth-registration+jwt") });
await post("/agent/register", { proof: await mkJwt("JWT") });
