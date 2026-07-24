import { SignJWT, exportJWK, generateKeyPair } from "jose";
const BASE = "http://localhost:3737/api/auth";
const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
const jwk = await exportJWK(publicKey);
const kid = "poc-key-1";
async function proof(extra: any = {}) {
  return await new SignJWT({ name: "poc-agent", mode: "autonomous", capabilities: ["get_status"], ...extra })
    .setProtectedHeader({ alg: "EdDSA", typ: "agent-registration+jwt", kid, jwk })
    .setIssuedAt().setExpirationTime("5m").setIssuer("poc-agent").setAudience(BASE).setSubject("poc-agent").sign(privateKey);
}
async function post(body: any) {
  const r = await fetch(BASE + "/agent/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const t = await r.text();
  console.log(`HTTP ${r.status}: ${t.slice(0,300)}`);
  return { status: r.status, t };
}
console.log(">> 全字段 + proof");
await post({ name: "poc-agent", mode: "autonomous", publicKey: jwk, kid, capabilities: ["get_status"], proof: await proof() });
console.log(">> proof 里带 aud=register 端点");
await post({ name: "poc-agent", mode: "autonomous", publicKey: jwk, kid, capabilities: ["get_status"], proof: await proof({ aud: BASE + "/agent/register" }) });
console.log(">> publicKey 用 {kty,crv,x} 显式");
await post({ name: "poc-agent", mode: "autonomous", publicKey: { kty: "OKP", crv: "Ed25519", x: (jwk as any).x }, kid, capabilities: ["get_status"], proof: await proof() });
