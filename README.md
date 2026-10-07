# O4AA Demo Tools

A sales engineering demo kit for **Okta for AI Agents**. One web app, three things customers remember:

1. **Delegated access.** An AI agent works in a business API *as the signed-in user*. It holds no API key: it exchanges the user's token for a short-lived token scoped to one API, carrying the user as `sub` and the agent as `act` (RFC 8693 token exchange).
2. **Human-in-the-loop approval.** When the agent tries something risky (a refund over $500), the API demands a scope Okta only issues after the user approves a push on their phone (OpenID CIBA). Approve and the action goes through. Deny and the agent stops.
3. **Token inspector.** Every identity step is shown live next to the chat: the requests to Okta, decoded JWTs with the important claims explained, and the API calls with their status codes.

A **"Without Okta"** toggle flips the agent to a shared static API key, so you can show the "before" picture: the same $9,000 refund goes through with no approval, and the audit log can't say who asked for it.

## Quick start (offline, no tenant needed)

```bash
npm install
cp .env.example .env.local     # defaults to DEMO_MODE=mock
npm run dev                    # http://localhost:3000
```

1. Click **Sign in with Okta (mock)** and pick a persona.
2. Click the suggested prompts in order. For the $4,800 refund, open **📱 Approver** (or `/approve` on your phone, same network) and approve or deny.
3. Toggle **Without Okta** and ask for another big refund to show the contrast.

Mock mode signs real RS256 JWTs shaped like Okta access tokens (`scp`, `cid`, `uid`, `act`), so the inspector looks the same as the live demo. Simulated Okta calls are labeled `SIMULATED`. Keep it as your no-Wi-Fi backup.

### The agent's brain

- **With `ANTHROPIC_API_KEY` set**, the agent is Claude (default `claude-opus-5-5`, effort `low` for snappy demos; override with `AGENT_MODEL` / `AGENT_EFFORT`). It decides which tools to call from free-form requests. Server-side refusal fallbacks (`fallbacks: "default"`) are enabled.
- **Without a key**, a scripted agent handles the suggested prompts (and close variations) deterministically. The identity flows are identical.

## Live mode against your Okta org

Set `DEMO_MODE=okta` and fill in the Okta section of `.env.local`. **[docs/OKTA_SETUP.md](docs/OKTA_SETUP.md)** walks through the authorization server, scopes, apps, access policies and Okta Verify setup. Everything is discovered from the authorization server's `/.well-known/openid-configuration`, and all calls are standard OAuth/OIDC:

| Step | Grant / endpoint |
|---|---|
| User signs in | Authorization code + PKCE → `/v1/token` |
| Agent gets API access | `urn:ietf:params:oauth:grant-type:token-exchange` → `/v1/token` |
| High-risk approval | `/v1/bc-authorize`, then poll `urn:openid:params:grant-type:ciba` → `/v1/token` |
| API validates tokens | JWKS signature, `iss`, `aud`, `exp`, then scope check |

## Demo script

See **[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** for a 10-minute talk track with the "aha" moments called out.

## How it fits together

```
 Browser ──chat──▶ /api/chat ──▶ Agent (Claude or scripted)
    ▲                                 │ tool call
    │ NDJSON stream                   ▼
    │ (inspector events)        lib/agent/tools.ts
    │                            │ 1. token exchange / CIBA ──▶ Okta (or mock IdP)
    │                            │ 2. Bearer <scoped token>  ──▶ /api/crm/* (demo "Acme CRM")
    └────────────────────────────┘                               validates JWT + scope
```

| Path | What it is |
|---|---|
| `app/page.tsx` | Chat + inspector UI, demo controls |
| `components/Inspector.tsx` | Token inspector (decoded claims, HTTP details) |
| `app/approve/page.tsx` | Mock Okta Verify push screen (mock mode) |
| `lib/agent/` | Agent loop (Claude / scripted) and tools: where the identity work happens |
| `lib/idp/okta.ts` | Real Okta adapter (discovery-based OAuth/OIDC) |
| `lib/idp/mock.ts` | Offline Okta simulator with personas and a CIBA queue |
| `app/api/crm/` + `lib/crm/` | The protected demo API and its token checks |

## Demo controls

- **Without Okta**: the agent uses a static `sk_live_…` key (no user, no scopes, no approval).
- **Approval over $**: the refund amount that needs human approval. The API enforces it, not the agent.
- **Reset demo**: clears the chat, inspector, cached tokens and CRM data. Sign-in is kept.

## Limitations

- State is in memory: one presenter, one server process. Restarting resets everything.
- Built for demos, not production: no CSRF protection on settings, and the mock IdP accepts any persona.

## Roadmap ideas

Fine-grained authorization on RAG results (Okta FGA), Cross App Access (ID-JAG) between two apps with admin revoke, an Okta-protected MCP server, an agent inventory and kill-switch view, a Terraform bootstrap for a fresh tenant, and per-customer branding presets.
