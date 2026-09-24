import { createHash, timingSafeEqual } from "crypto";

export function isAdmin(headers: Headers) {
  const configured = process.env.CLAUDMOR_ADMIN_TOKEN;
  if (!configured) return false;
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;

  const got = auth.slice(7);
  const a = createHash("sha256").update(configured).digest();
  const b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}
