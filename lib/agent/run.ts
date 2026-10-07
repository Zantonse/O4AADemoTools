import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { store } from "../store";
import { runTool, TOOLS, type AgentContext } from "./tools";

export type SayFn = (text: string) => void;

const MAX_TURNS = 8;

function systemPrompt(ctx: AgentContext) {
  const user = ctx.session.user;
  return [
    `You are ${config.agent.name}, an AI agent that helps Acme's customer support team work in Acme CRM.`,
    `You act on behalf of the signed-in user${user ? `, ${user.name} (${user.email})` : ""}. Every tool call uses their delegated identity.`,
    "Use the tools to look up accounts and orders and to issue refunds. Look up an order before refunding it if you don't already know its amount.",
    `Refunds above ${store.settings.approvalThreshold} USD need the user's approval on their phone; the issue_refund tool handles that and waits for the decision.`,
    "If a refund is denied or not approved, say so plainly and don't retry unless asked. If an API call fails, explain the error briefly.",
    "This runs in a live customer demo: keep replies short (two to four sentences or a compact list) and format amounts as USD.",
  ].join("\n");
}

async function runClaude(ctx: AgentContext, say: SayFn) {
  const client = new Anthropic();
  const { session } = ctx;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.beta.messages.create({
      model: config.agent.model,
      max_tokens: 16000,
      system: systemPrompt(ctx),
      tools: TOOLS,
      messages: session.messages,
      output_config: { effort: config.agent.effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    session.messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) say(block.text);
    }
    if (response.stop_reason === "refusal") {
      say("I can't help with that request.");
      return;
    }
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") return;

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      try {
        const content = await runTool(ctx, block.name, block.input as Record<string, unknown>);
        results.push({ type: "tool_result", tool_use_id: block.id, content });
      } catch (err) {
        ctx.emit({ kind: "error", title: `Tool ${block.name} failed`, detail: (err as Error).message });
        results.push({ type: "tool_result", tool_use_id: block.id, content: (err as Error).message, is_error: true });
      }
    }
    session.messages.push({ role: "user", content: results });
  }
  say("I stopped after too many steps. Try a narrower request.");
}

/**
 * Deterministic fallback when no Anthropic API key is configured, so the
 * identity flows can still be demoed. Understands the suggested prompts.
 */
async function runScripted(ctx: AgentContext, text: string, say: SayFn) {
  const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const lower = text.toLowerCase();
  const orderId = text.match(/ord-\d+/i)?.[0].toUpperCase();
  const accountId = text.match(/acc-\d+/i)?.[0].toUpperCase();

  if (/refund/.test(lower) && orderId) {
    const amountMatch = text.replace(/ord-\d+/gi, "").match(/\$?\s*(\d[\d,]*(?:\.\d{1,2})?)/);
    if (!amountMatch) return say(`How much should I refund on ${orderId}?`);
    const amount = Number(amountMatch[1].replace(/,/g, ""));
    const reason = text.split(/—|–| - |because|reason:/i)[1]?.trim() || "Customer request";
    const result = JSON.parse(await runTool(ctx, "issue_refund", { order_id: orderId, amount, reason }));
    if (result.refund) return say(`Done: refunded ${usd(amount)} on ${orderId} (${result.refund.id}). Order status is now ${result.order.status.replace("_", " ")}.`);
    if (result.error === "approval_denied") return say(`The ${usd(amount)} refund on ${orderId} was not approved, so I didn't issue it.`);
    return say(`The refund failed: ${result.error_description ?? result.error}.`);
  }

  if (/order/.test(lower)) {
    const accounts = JSON.parse(await runTool(ctx, "list_accounts", {})).accounts as { id: string; name: string }[] | undefined;
    const match = accountId ?? accounts?.find((a) => lower.includes(a.name.toLowerCase().split(" ")[0]))?.id;
    if (!match) return say("Which account? For example: “What orders does Initech have?”");
    const result = JSON.parse(await runTool(ctx, "get_account_orders", { account_id: match }));
    if (!result.orders) return say(`I couldn't load orders: ${result.error_description ?? result.error}.`);
    const lines = (result.orders as { id: string; item: string; amount: number; status: string }[]).map(
      (o) => `- ${o.id}: ${o.item}, ${usd(o.amount)} (${o.status.replace("_", " ")})`,
    );
    return say(`Orders for ${result.account.name}:\n${lines.join("\n")}`);
  }

  const result = JSON.parse(await runTool(ctx, "list_accounts", {}));
  if (!result.accounts) return say(`I couldn't load accounts: ${result.error_description ?? result.error}.`);
  const lines = (result.accounts as { id: string; name: string; tier: string; arr: number }[]).map(
    (a) => `- ${a.name} (${a.id}): ${a.tier}, ${usd(a.arr)} ARR`,
  );
  say(`Here are your accounts:\n${lines.join("\n")}`);
}

export async function runAgent(ctx: AgentContext, text: string, say: SayFn) {
  ctx.session.messages.push({ role: "user", content: text });
  if (config.agent.engine === "claude") return runClaude(ctx, say);
  return runScripted(ctx, text, say);
}
