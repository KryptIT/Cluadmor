import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const COOKIE = "claudmor_account";

function sessionSecret() {
  const value = process.env.CLAUDMOR_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("CLAUDMOR_SESSION_SECRET is not configured");
  return value;
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("base64url") + "$" + hash.toString("base64url");
}

export function verifyPassword(password: string, stored: string) {
  const [kind, saltRaw, hashRaw] = stored.split("$");
  if (kind !== "scrypt" || !saltRaw || !hashRaw) return false;
  try {
    const salt = Buffer.from(saltRaw, "base64url");
    const expected = Buffer.from(hashRaw, "base64url");
    const got = scryptSync(password, salt, expected.length);
    return safeEqual(got, expected);
  } catch {
    return false;
  }
}

export function issueAccountToken(userId: string, ttlSeconds = 60 * 60 * 24 * 30) {
  const payload = Buffer.from(JSON.stringify({
    userId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  })).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyAccountToken(token: string): { userId: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = Buffer.from(createHmac("sha256", sessionSecret()).update(payload).digest("base64url"));
  const supplied = Buffer.from(sig);
  if (!safeEqual(expected, supplied)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.userId || Number(parsed.exp) <= Math.floor(Date.now() / 1000)) return null;
    return { userId: String(parsed.userId) };
  } catch {
    return null;
  }
}

export function accountFromRequest(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)claudmor_account=([^;]+)/);
  return match ? verifyAccountToken(decodeURIComponent(match[1])) : null;
}

export function accountCookie(token: string) {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;
}

export function clearAccountCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
