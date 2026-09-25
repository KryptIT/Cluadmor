import { timingSafeEqual } from "crypto";
import { digest } from "@/lib/security";

const PREFIX = "LL1";

export function makeRewardClickId(sessionId: string) {
  const id = String(sessionId || "").trim();
  const signature = digest(`lootlabs:${id}`);
  return `${PREFIX}.${id}.${signature}`;
}

export function parseRewardClickId(value: string) {
  const raw = String(value || "").trim();
  const parts = raw.split(".");

  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return null;
  }

  const sessionId = parts[1];
  const supplied = parts[2];
  const expected = digest(`lootlabs:${sessionId}`);

  if (!/^[0-9a-f]{64}$/i.test(supplied)) {
    return null;
  }

  const a = Buffer.from(supplied.toLowerCase(), "hex");
  const b = Buffer.from(expected.toLowerCase(), "hex");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return sessionId;
}
