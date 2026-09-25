import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type SessionPayload = {
  serviceId: string;
  keyId: string;
  ownerId: string;
  hwidHash: string;
  jti: string;
  // Hash of the loader's random per-run nonce; absent for loaders published before it existed.
  clientNonceHash?: string;
  exp: number;
};

function sessionSecret() {
  const value = process.env.CLAUDMOR_SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CLAUDMOR_SESSION_SECRET must be at least 32 characters");
  }
  return value;
}

function b64url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function sign(body: string) {
  return createHmac("sha256", sessionSecret()).update(body).digest("base64url");
}

export function issueSession(payload: Omit<SessionPayload, "exp" | "jti">, ttlSeconds = 300) {
  const full: SessionPayload = {
    ...payload,
    // Random per-session nonce so each token is unique and can be spent once.
    jti: randomBytes(18).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  };
  const body = b64url(JSON.stringify(full));
  return body + "." + sign(body);
}

export function verifySession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.jti !== "string" || payload.jti.length < 16) return null;
    return payload;
  } catch {
    return null;
  }
}

export function bearer(headers: Headers) {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}
