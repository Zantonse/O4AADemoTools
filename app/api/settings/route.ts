import { store } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { legacyMode?: boolean; approvalThreshold?: number };
  if (typeof body.legacyMode === "boolean") store.settings.legacyMode = body.legacyMode;
  if (Number.isFinite(body.approvalThreshold) && Number(body.approvalThreshold) >= 0) {
    store.settings.approvalThreshold = Number(body.approvalThreshold);
  }
  return Response.json(store.settings);
}
