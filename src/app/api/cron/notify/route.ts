import { timingSafeEqual } from "node:crypto";
import { runNotify } from "@/server/notices";

/**
 * The notify cron (design §23), called every 30 min by .github/workflows/notify.yml
 * with `Authorization: Bearer $CRON_SECRET`. `?dry=1` lists what is due without
 * sending or recording anything.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const dry = new URL(request.url).searchParams.get("dry") === "1";
  const r = await runNotify(new Date(), dry);
  return Response.json({
    farms: r.farms,
    due: r.due.map((d) => ({ player: d.playerId, kind: d.notice.kind, key: d.notice.key, title: d.notice.title })),
    sent: r.sent,
    gone: r.gone,
    dry,
  });
}
