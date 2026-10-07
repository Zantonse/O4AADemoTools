export type DemoMode = "mock" | "okta";

const env = (name: string, fallback = "") => process.env[name]?.trim() || fallback;

export const SCOPES = {
  read: "crm:read",
  refund: "refunds:write",
  refundHighValue: "refunds:high_value",
} as const;

export const MOCK_ISSUER = "https://mock-okta.demo/oauth2/default";

export const config = {
  mode: (env("DEMO_MODE", "mock") === "okta" ? "okta" : "mock") as DemoMode,
  baseUrl: env("APP_BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
  okta: {
    issuer: env("OKTA_ISSUER").replace(/\/$/, ""),
    clientId: env("OKTA_CLIENT_ID"),
    clientSecret: env("OKTA_CLIENT_SECRET"),
    agentClientId: env("AGENT_CLIENT_ID") || env("OKTA_CLIENT_ID"),
    agentClientSecret: env("AGENT_CLIENT_SECRET") || env("OKTA_CLIENT_SECRET"),
    cibaHint: (env("CIBA_HINT", "id_token_hint") === "login_hint" ? "login_hint" : "id_token_hint") as
      | "login_hint"
      | "id_token_hint",
  },
  apiAudience: env("API_AUDIENCE", "api://acme-crm"),
  agent: {
    engine: (env("ANTHROPIC_API_KEY") ? "claude" : "scripted") as "claude" | "scripted",
    model: env("AGENT_MODEL", "claude-opus-5-5"),
    effort: env("AGENT_EFFORT", "low") as "low" | "medium" | "high" | "xhigh" | "max",
    name: "Acme Support Copilot",
    mockClientId: "0oa-ai-agent-support-copilot",
  },
  defaultApprovalThreshold: Number(env("APPROVAL_THRESHOLD", "500")) || 500,
  // The "before" picture: a long-lived, all-powerful key shared by every agent run.
  legacyApiKey: "sk_live_acme_crm_7Fq2xK9mZ4vL1nR8wT3bY6",
};

export function agentClientId() {
  return config.mode === "okta" ? config.okta.agentClientId : config.agent.mockClientId;
}

export function apiIssuer() {
  return config.mode === "okta" ? config.okta.issuer : MOCK_ISSUER;
}
