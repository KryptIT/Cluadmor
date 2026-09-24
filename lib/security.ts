import { createHmac, randomBytes, timingSafeEqual } from "crypto";

function secret() {
  const value = process.env.CLAUDMOR_MASTER_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CLAUDMOR_MASTER_SECRET must be at least 32 characters");
  }
  return value;
}

export function opaque(prefix: string, bytes = 24) {
  return prefix + "_" + randomBytes(bytes).toString("base64url");
}

export function digest(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function sameDigest(raw: string, storedHex: string) {
  const a = Buffer.from(digest(raw), "hex");
  const b = Buffer.from(storedHex, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function normalizeHwid(value: string) {
  return value.trim().slice(0, 512);
}

export function clientIp(headers: Headers) {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

export function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
