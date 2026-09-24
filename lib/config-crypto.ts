import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  const raw = process.env.CLAUDMOR_MASTER_SECRET;
  if (!raw || raw.length < 32) throw new Error("CLAUDMOR_MASTER_SECRET is not configured");
  return createHash("sha256").update(raw).digest();
}

export function encryptConfig(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptConfig(value: string) {
  const [ivRaw, tagRaw, dataRaw] = value.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) throw new Error("Invalid encrypted provider config");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final()
  ]);
  return JSON.parse(plain.toString("utf8"));
}
