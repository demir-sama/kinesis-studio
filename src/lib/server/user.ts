import { cookies } from "next/headers";

export const UID_COOKIE = "kinesis_uid";

/** A stable, anonymous per-browser id. Sent to Otari as the end user (`user`) so each visitor has their own budget. */
export async function getUid(): Promise<{ uid: string; fresh: boolean }> {
  const jar = await cookies();
  const v = jar.get(UID_COOKIE)?.value;
  if (v && /^[a-z0-9-]{8,64}$/.test(v)) return { uid: v, fresh: false };
  return { uid: crypto.randomUUID(), fresh: true };
}
export const endUserId = (uid: string) => `kinesis:${uid}`;
export const uidCookie = (uid: string) => `${UID_COOKIE}=${uid}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

const hits = new Map<string, number[]>();
/** Best-effort per-instance throttle in front of Otari's own per-user budgets. */
export function throttle(uid: string, max = 12, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(uid) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(uid, arr); return false; }
  arr.push(now); hits.set(uid, arr); return true;
}
