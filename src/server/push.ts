import "server-only";
import webpush from "web-push";

/**
 * Web Push sender (design §23). Needs the VAPID keys in the environment
 * (see .env.example). Without them, nothing is sent and `pushEnabled()` is false.
 */

let configured: boolean | null = null;

export function pushEnabled(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(pub && priv && subject);
  if (configured) webpush.setVapidDetails(subject!, pub!, priv!);
  return configured;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces an older notice of the same kind on the phone. */
  tag: string;
}

/** Sends one notice. Returns "gone" when the subscription no longer exists (to delete it). */
export async function sendPush(to: PushTarget, msg: PushMessage): Promise<"sent" | "gone" | "failed"> {
  if (!pushEnabled()) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } },
      JSON.stringify(msg),
      { TTL: 6 * 3600, urgency: "normal" },
    );
    return "sent";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}
