import { resetCrm } from "@/lib/crm/data";
import { getSession, resetConversation } from "@/lib/store";

/** Clears the chat, inspector (except sign-in events), token cache and CRM data. */
export async function POST() {
  resetConversation(await getSession());
  resetCrm();
  return Response.json({ ok: true });
}
