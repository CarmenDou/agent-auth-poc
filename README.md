# Agent Auth POC

Two runnable proof-of-concepts for **agent authentication**, both proving the same
model: a human approves once at the front door, then the agent operates on its own.

- **Better Auth POC** — a self-hosted Agent Auth provider ([Better Auth](https://better-auth.com)
  + `@better-auth/agent-auth`, driven by the official `@auth/agent` client SDK).
  Fully local, SQLite, no external account needed.
- **Auth0 POC** — the agent runs Auth0's Device Authorization Flow; a human logs in
  via Auth0 Universal Login (real Google login) and approves. Needs your own Auth0 tenant.

Both backends are fake — neither mints a real credential nor touches any real
system. They prove the auth *flow*, not a production integration.

## Better Auth POC

```bash
npm install
npx @better-auth/cli migrate -y --config server.ts   # create the SQLite tables

npm run server     # terminal 1: the provider (http://localhost:3737)
npm run test-hitl  # terminal 2: full "blocked -> human approves -> allowed" demo
```

`npm run test-hitl` prints:

```
2. Self-registered (no human): status=active
3. Before the human approves:
   get_status      blocked -> capability_not_granted
   create_project  blocked -> capability_not_granted
4. Human approves get_status (simulating a click on 'approve')...
5. After approval:
   get_status      OK -> {"data":{"ok":true,"status":"healthy"}}
   create_project  blocked  <- high-risk, not approved, still blocked
```

What it shows:

- The agent self-registers with **no human and no upstream AI vendor**, and goes
  `active` on its own.
- But with an empty grant table it can do **nothing** — every capability is
  `capability_not_granted`. That empty grant table is the human-in-the-loop gate.
- A human claims the agent (becomes owner) and grants `get_status`, so it works;
  high-risk `create_project` stays blocked because it was never granted.
- Approval strength is one line of config: `approvalStrength: none / session /
  webauthn` (webauthn = physical confirmation, specifically to stop an AI from
  auto-approving).

`npm run agent` runs just the front half (discover -> self-register -> everything
blocked until granted).

Discovery is served dynamically — there is no static file. With the server running:

```bash
curl http://localhost:3737/.well-known/agent-configuration
```

## Auth0 POC

Here the provider is Auth0's cloud, so this needs your own tenant. Setup (see
`auth0.env.example`):

1. Auth0 -> create a **Native** Application -> enable the **Device Code** grant ->
   note Domain + Client ID.
2. Create an **API** -> its Identifier is the audience -> add permissions
   `read:status`, `create:project`.
3. Under the API's **Application Access** tab, authorize your Native app for
   **User-delegated Access** (`read:status`).
4. `cp auth0.env.example .env.auth0`, fill in the three values.

```bash
npm run auth0
```

It prints an activation link. Open it, log in with Google, and approve — then the
agent gets a real Auth0 JWT:

```
4. Got the access_token (JWT); verify signature + inspect scope
   sub: google-oauth2|...  | scopes: openid, profile, read:status
5. Call the 'fake InsForge' capabilities with the token (gated by scope)
   get_status      OK -> {ok:true, status:'healthy'}
   create_project  blocked -> missing create:project -> should trigger CIBA step-up
```

The front-door Google login is the identity check (and the anti-abuse gate).
`create_project` lacks its scope, so it is left to CIBA (phone-push) step-up —
documented in the script, not run here (CIBA needs Guardian set up).

## Key takeaway

Both POCs converge on the same shape: an agent can register on its own, but a
**human approves once at the front door** before it can act. Per-action step-up
(`create_project`) is an optional knob, not a requirement — request full scope up
front and there is no further prompt.

## Files

| File | What |
| --- | --- |
| `server.ts` | Better Auth agent-auth provider (discovery, capabilities, execute) |
| `agent.ts` | Agent client: discover -> self-register -> blocked until granted |
| `test-hitl.ts` | One-shot demo: blocked -> human approves -> allowed |
| `auth0-agent.ts` | Auth0 Device Flow agent + JWKS verify + scope-gated resource check |
| `auth0.env.example` | The three Auth0 values to fill in |
