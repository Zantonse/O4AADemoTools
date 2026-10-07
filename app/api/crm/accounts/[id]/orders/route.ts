import { SCOPES } from "@/lib/config";
import { authorize } from "@/lib/crm/auth";
import { ACCOUNTS, crm } from "@/lib/crm/data";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize(req, SCOPES.read);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const account = ACCOUNTS.find((a) => a.id === id.toUpperCase());
  if (!account) return Response.json({ error: "not_found", error_description: `No account ${id}` }, { status: 404 });
  return Response.json({ account, orders: crm.orders.filter((o) => o.accountId === account.id) });
}
