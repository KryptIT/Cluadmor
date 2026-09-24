import { createHash, createHmac, timingSafeEqual } from "crypto";

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

export function verifyOwnerKey(value: string) {
  const configured = process.env.CLAUDMOR_OWNER_KEY || "";
  return configured.length >= 24 && safeEqualText(value, configured);
}

export function issueOwnerToken(ttlSeconds = 604800) {
  const payload = Buffer.from(JSON.stringify({
    role: "owner",
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyOwnerToken(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  if (!safeEqualText(sig, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.role === "owner" && Number(parsed.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function ownerFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)claudmor_owner=([^;]+)/);
  return !!match && verifyOwnerToken(decodeURIComponent(match[1]));
}

export function ownerCookie(token: string) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`;
}

export function clearOwnerCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
