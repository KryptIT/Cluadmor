import { createHash, createHmac, timingSafeEqual } from "crypto";
import { accountFromRequest } from "@/lib/account";

const COOKIE = "claudmor_owner";

function sessionSecret() {
  const value = process.env.CLAUDMOR_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("CLAUDMOR_SESSION_SECRET is not configured");
  return value;
}

function safeEqualText(a: string, b: string) {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

function normalizeOwnerKey(value: string) {
  let out = String(value || "").trim();

  if (
    out.length >= 2 &&
    ((out.startsWith('"') && out.endsWith('"')) ||
      (out.startsWith("'") && out.endsWith("'")))
  ) {
    out = out.slice(1, -1);
  }

  return out;
}

export function ownerKeyConfigured() {
  return normalizeOwnerKey(process.env.CLAUDMOR_OWNER_KEY || "").length > 0;
}

export function verifyOwnerKey(value: string) {
  const configured = normalizeOwnerKey(process.env.CLAUDMOR_OWNER_KEY || "");
  const supplied = normalizeOwnerKey(value);

  return (
    configured.length > 0 &&
    supplied.length > 0 &&
    safeEqualText(supplied, configured)
  );
}

export function issueOwnerToken(userId: string, ttlSeconds = 604800) {
  const payload = Buffer.from(JSON.stringify({
    role: "owner",
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString("base64url");

  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyOwnerToken(token: string): { userId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!safeEqualText(sig, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      parsed.role !== "owner" ||
      !parsed.userId ||
      Number(parsed.exp) <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { userId: String(parsed.userId) };
  } catch {
    return null;
  }
}

export function ownerFromRequest(req: Request) {
  const account = accountFromRequest(req);
  if (!account) return false;

  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)claudmor_owner=([^;]+)/);
  if (!match) return false;

  const owner = verifyOwnerToken(decodeURIComponent(match[1]));
  return !!owner && owner.userId === account.userId;
}

export function ownerCookie(token: string) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}

export function clearOwnerCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
