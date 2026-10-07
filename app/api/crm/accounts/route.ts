import { SCOPES } from "@/lib/config";
import { authorize } from "@/lib/crm/auth";
import { ACCOUNTS } from "@/lib/crm/data";

export async function GET(req: Request) {
  const auth = await authorize(req, SCOPES.read);
  if (!auth.ok) return auth.response;
  return Response.json({ accounts: ACCOUNTS });
}
