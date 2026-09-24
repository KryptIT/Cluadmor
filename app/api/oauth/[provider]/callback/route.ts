import {
  finishOAuth,
  isOAuthProvider,
  oauthConfig,
  readOAuthState,
  resolveOAuthUser
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginError(req: Request, code: string) {
  return Response.redirect(
    new URL("/login?error=" + encodeURIComponent(code), req.url),
    302
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;

  if (!isOAuthProvider(provider)) {
    return new Response("Unknown OAuth provider", { status: 404 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const storedState = readOAuthState(req, provider);

  if (!code || !state || !storedState || state !== storedState) {
    return loginError(req, "oauth_state_mismatch");
  }

  const config = oauthConfig(provider);
  if (!config.clientId || !config.clientSecret) {
    return loginError(req, provider + "_not_configured");
  }

  const origin = url.origin;
  const redirectUri = `${origin}/api/oauth/${provider}/callback`;

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      }),
      cache: "no-store"
    });

    const tokenData = await tokenRes.json() as any;
    const accessToken = String(tokenData.access_token || "");

    if (!tokenRes.ok || !accessToken) {
      return loginError(req, "oauth_token_exchange_failed");
    }

    const profileRes = await fetch(config.userUrl, {
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    const profile = await profileRes.json() as any;

    if (!profileRes.ok) {
      return loginError(req, "oauth_profile_failed");
    }

    let identity;

    if (provider === "google") {
      identity = {
        provider,
        providerUserId: String(profile.sub || ""),
        email: profile.email ? String(profile.email) : null,
        emailVerified: profile.email_verified === true,
        displayName: profile.name ? String(profile.name) : null,
        avatarUrl: profile.picture ? String(profile.picture) : null
      };
    } else {
      const avatarUrl = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=128`
        : null;

      identity = {
        provider,
        providerUserId: String(profile.id || ""),
        email: profile.email ? String(profile.email) : null,
        emailVerified: profile.verified === true,
        displayName: profile.global_name || profile.username || null,
        avatarUrl
      };
    }

    if (!identity.providerUserId) {
      return loginError(req, "oauth_profile_invalid");
    }

    const userId = await resolveOAuthUser(identity);
    return finishOAuth(userId, `${origin}/dashboard`, provider);
  } catch {
    return loginError(req, "oauth_failed");
  }
}
