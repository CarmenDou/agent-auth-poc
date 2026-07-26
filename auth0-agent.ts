// 扮演 agent，用 Auth0 的 Device Authorization Flow 走一遍 agent auth。
// 和 Better Auth POC 的区别：provider 是 Auth0 云（托管），不自建；
// 登录/批准页面是 Auth0 现成的 Universal Login；这里只演 agent 侧 + 资源校验。
//
// 跑之前：把 auth0.env.example 复制成 .env.auth0 并填好，然后 `npm run auth0`。
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";
import { readFileSync } from "node:fs";

// --- 读 env（简单解析 .env.auth0，避免加依赖）---
try {
  for (const line of readFileSync(".env.auth0", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* 没有 .env.auth0 就靠真实环境变量 */ }

const DOMAIN = process.env.AUTH0_DOMAIN;          // e.g. dev-xxxx.us.auth0.com
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;    // Native 应用的 client_id
const AUDIENCE = process.env.AUTH0_AUDIENCE;      // 你建的 API 的 identifier
if (!DOMAIN || !CLIENT_ID || !AUDIENCE) {
  console.error("缺 env：AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_AUDIENCE，见 auth0.env.example");
  process.exit(1);
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
const post = (path: string, body: Record<string, string>) =>
  fetch(`https://${DOMAIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form(body),
  }).then(async (r) => ({ status: r.status, json: await r.json().catch(() => ({})) as any }));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 低风险只要 read:status；create:project 故意不在这批里 —— 用来演示高风险要 step-up
const SCOPE = "openid profile read:status";

async function main() {
  console.log("\n① 向 Auth0 发起 Device 授权");
  const dev = await post("/oauth/device/code", { client_id: CLIENT_ID!, scope: SCOPE, audience: AUDIENCE! });
  if (dev.status !== 200) { console.error("   失败：", dev.json); process.exit(1); }
  const { device_code, user_code, verification_uri_complete, interval, expires_in } = dev.json;

  console.log("\n② 👤 人来批准（这就是 human-in-the-loop 的前门）");
  console.log("   打开这个链接，登录并批准：");
  console.log("   " + (verification_uri_complete));
  console.log(`   (确认码 ${user_code}，${expires_in}s 内有效)`);

  console.log("\n③ agent 轮询等待人批准……");
  let token: string | null = null;
  const deadline = Date.now() + expires_in * 1000;
  let wait = (interval || 5) * 1000;
  while (Date.now() < deadline) {
    await sleep(wait);
    const t = await post("/oauth/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code, client_id: CLIENT_ID!,
    });
    if (t.status === 200) { token = t.json.access_token; break; }
    if (t.json.error === "authorization_pending") { process.stdout.write("."); continue; }
    if (t.json.error === "slow_down") { wait += 2000; continue; }
    console.error("\n   失败：", t.json); process.exit(1);
  }
  if (!token) { console.error("\n   超时，没人批准"); process.exit(1); }

  console.log("\n\n④ 拿到 access_token（JWT），验签 + 看 scope");
  const JWKS = createRemoteJWKSet(new URL(`https://${DOMAIN}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${DOMAIN}/`, audience: AUDIENCE });
  const scopes = String(payload.scope ?? "").split(" ").filter(Boolean);
  console.log("   sub:", payload.sub, "| scopes:", scopes.join(", ") || "(无)");

  console.log("\n⑤ 用 token 调「假 InsForge」能力（按 scope 放行）");
  const can = (s: string) => scopes.includes(s);
  console.log("   get_status     ", can("read:status")
    ? "✅ 通过 → {ok:true,status:'healthy'}"
    : "⛔ 缺 read:status");
  console.log("   create_project ", can("create:project")
    ? "✅ 通过"
    : "⛔ 缺 create:project → 应触发 CIBA step-up（见下）");

  if (!can("create:project")) {
    console.log("\n⑥ 高风险 create_project 的 step-up（CIBA / 异步授权）——形状如下：");
    console.log("   POST /bc-authorize {scope:'create:project', binding_message:'建项目 demo', login_hint:<user>}");
    console.log("   → Auth0 给这个用户的手机推送批准 → 轮询 /oauth/token (grant_type=…:ciba) 拿到授权后执行。");
    console.log("   （CIBA 需要给用户装 Guardian 并配好推送，本 POC 不自动跑那步。）");
  }
  process.exit(0);
}
main().catch((e) => { console.error("出错:", e?.message ?? e); process.exit(1); });
