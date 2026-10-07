import { config } from "@/lib/config";
import { idp } from "@/lib/idp";
import { getSession, store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  return Response.json({
    mode: config.mode,
    idpLabel: idp.label,
    engine: config.agent.engine,
    model: config.agent.engine === "claude" ? config.agent.model : null,
    agentName: config.agent.name,
    user: session.user ?? null,
    settings: store.settings,
    transcript: session.transcript,
    events: session.events,
  });
}
