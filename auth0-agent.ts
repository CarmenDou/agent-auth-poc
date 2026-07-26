// Play the agent using Auth0's Device Authorization Flow.
// Difference vs the Better Auth POC: the provider is Auth0's cloud (hosted), not
// self-run; login/approval happens on Auth0's Universal Login. This script is
// only the agent side + a resource check.
//
// Before running: copy auth0.env.example to .env.auth0, fill it in, then `npm run auth0`.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { readFileSync } from "node:fs";

// --- load env (simple .env.auth0 parser, to avoid a dependency) ---
try {
  for (const line of readFileSync(".env.auth0", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.auth0 -> rely on real environment variables */ }

const DOMAIN = process.env.AUTH0_DOMAIN;          // e.g. dev-xxxx.us.auth0.com
const CLIENT_ID = process.env.AUTH0_CLIENT_ID;    // the Native app's client_id
const AUDIENCE = process.env.AUTH0_AUDIENCE;      // the identifier of the API you created
if (!DOMAIN || !CLIENT_ID || !AUDIENCE) {
  console.error("Missing env: AUTH0_DOMAIN / AUTH0_CLIENT_ID / AUTH0_AUDIENCE, see auth0.env.example");
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

// Low risk only needs read:status; create:project is deliberately left out here
// to demonstrate that high-risk actions require step-up.
const SCOPE = "openid profile read:status";

async function main() {
  console.log("\n1. Start a Device Authorization request with Auth0");
  const dev = await post("/oauth/device/code", { client_id: CLIENT_ID!, scope: SCOPE, audience: AUDIENCE! });
  if (dev.status !== 200) { console.error("   failed:", dev.json); process.exit(1); }
  const { device_code, user_code, verification_uri_complete, interval, expires_in } = dev.json;

  console.log("\n2. Human approves (this is the front-door human-in-the-loop)");
  console.log("   Open this link, log in and approve:");
  console.log("   " + (verification_uri_complete));
  console.log(`   (code ${user_code}, valid for ${expires_in}s)`);

  console.log("\n3. Agent polls, waiting for approval...");
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
    console.error("\n   failed:", t.json); process.exit(1);
  }
  if (!token) { console.error("\n   timed out, nobody approved"); process.exit(1); }

  console.log("\n\n4. Got the access_token (JWT); verify signature + inspect scope");
  const JWKS = createRemoteJWKSet(new URL(`https://${DOMAIN}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://${DOMAIN}/`, audience: AUDIENCE });
  const scopes = String(payload.scope ?? "").split(" ").filter(Boolean);
  console.log("   sub:", payload.sub, "| scopes:", scopes.join(", ") || "(none)");

  console.log("\n5. Call the 'fake InsForge' capabilities with the token (gated by scope)");
  const can = (s: string) => scopes.includes(s);
  console.log("   get_status     ", can("read:status")
    ? "OK -> {ok:true,status:'healthy'}"
    : "blocked -> missing read:status");
  console.log("   create_project ", can("create:project")
    ? "OK"
    : "blocked -> missing create:project -> should trigger CIBA step-up (see below)");

  if (!can("create:project")) {
    console.log("\n6. Step-up for high-risk create_project (CIBA / async authorization) -- shape:");
    console.log("   POST /bc-authorize {scope:'create:project', binding_message:'create project demo', login_hint:<user>}");
    console.log("   -> Auth0 pushes an approval to the user's phone -> poll /oauth/token (grant_type=...:ciba), then execute.");
    console.log("   (CIBA needs Guardian push set up for the user; this POC does not run that step automatically.)");
  }
  process.exit(0);
}
main().catch((e) => { console.error("error:", e?.message ?? e); process.exit(1); });
