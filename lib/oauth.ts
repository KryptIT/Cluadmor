import { randomBytes } from "crypto";
import { accountCookie, issueAccountToken } from "@/lib/account";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";

export type OAuthProvider = "google" | "discord";

export function isOAuthProvider(value: string): value is OAuthProvider {
  return value === "google" || value === "discord";
}

export function oauthState() {
  return randomBytes(24).toString("base64url");
}

export function oauthStateCookie(provider: OAuthProvider, state: string) {
  return `claudmor_oauth_${provider}=${encodeURIComponent(state)}; Path=/api/oauth/${provider}/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

export function clearOAuthStateCookie(provider: OAuthProvider) {
  return `claudmor_oauth_${provider}=; Path=/api/oauth/${provider}/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readOAuthState(req: Request, provider: OAuthProvider) {
  const cookie = req.headers.get("cookie") || "";
  const re = new RegExp(`(?:^|;\\s*)claudmor_oauth_${provider}=([^;]+)`);
  const match = cookie.match(re);
  return match ? decodeURIComponent(match[1]) : "";
}

export function oauthConfig(provider: OAuthProvider) {
  if (provider === "google") {
    return {
      clientId: (process.env.GOOGLE_CLIENT_ID || "").trim(),
      clientSecret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile"
    };
  }

  return {
    clientId: (process.env.DISCORD_CLIENT_ID || "").trim(),
    clientSecret: (process.env.DISCORD_CLIENT_SECRET || "").trim(),
    authorizeUrl: "https://discord.com/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userUrl: "https://discord.com/api/users/@me",
    scope: "identify email"
  };
}

type OAuthIdentity = {
  provider: OAuthProvider;
  providerUserId: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export async function resolveOAuthUser(identity: OAuthIdentity) {
  await ensureWorkspaceSchema();

  const verified = identity.emailVerified === true;

  const existing = await sql`
    SELECT user_id
    FROM oauth_accounts
    WHERE provider = ${identity.provider}
      AND provider_user_id = ${identity.providerUserId}
    LIMIT 1
  `;

  let userId = existing[0] ? String((existing[0] as any).user_id) : "";

  if (!userId && identity.email && verified) {
    const byEmail = await sql`
      SELECT id
      FROM users
      WHERE lower(email) = lower(${identity.email})
      LIMIT 1
    `;
    if (byEmail[0]) userId = String((byEmail[0] as any).id);
  }

  if (!userId) {
    const generatedUsername = `${identity.provider}_${identity.providerUserId}`.slice(0, 80);

    const rows = await sql`
      INSERT INTO users(
        username,
        email,
        display_name,
        avatar_url
      )
      VALUES (
        ${generatedUsername},
        ${verified ? identity.email || null : null},
        ${identity.displayName || null},
        ${identity.avatarUrl || null}
      )
      RETURNING id
    `;

    userId = String((rows[0] as any).id);
  }

  await sql`
    INSERT INTO oauth_accounts(
      user_id,
      provider,
      provider_user_id,
      email,
      display_name,
      avatar_url,
      updated_at
    )
    VALUES (
      ${userId},
      ${identity.provider},
      ${identity.providerUserId},
      ${identity.email || null},
      ${identity.displayName || null},
      ${identity.avatarUrl || null},
      now()
    )
    ON CONFLICT(provider, provider_user_id)
    DO UPDATE SET
      user_id = EXCLUDED.user_id,
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = now()
  `;

  await sql`
    UPDATE users
    SET
      display_name = COALESCE(${identity.displayName || null}, display_name),
      avatar_url = COALESCE(${identity.avatarUrl || null}, avatar_url),
      email = CASE
        WHEN email IS NULL AND ${verified} THEN ${identity.email || null}
        ELSE email
      END
    WHERE id = ${userId}
  `;

  return userId;
}

export function finishOAuth(userId: string, redirectTo: string, provider: OAuthProvider) {
  const response = Response.redirect(redirectTo, 302);
  response.headers.append("Set-Cookie", accountCookie(issueAccountToken(userId)));
  response.headers.append("Set-Cookie", clearOAuthStateCookie(provider));
  return response;
}
