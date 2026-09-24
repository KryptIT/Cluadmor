import {
  isOAuthProvider,
  oauthConfig,
  oauthState,
  oauthStateCookie
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ provider: string }> }
) {
  const { provider } = await context.params;

  if (!isOAuthProvider(provider)) {
    return new Response("Unknown OAuth provider", { status: 404 });
  }

  const config = oauthConfig(provider);

  if (!config.clientId || !config.clientSecret) {
    return Response.redirect(
      new URL(`/login?error=${provider}_not_configured`, req.url),
      302
    );
  }

  const state = oauthState();
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/oauth/${provider}/callback`;

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);

  if (provider === "google") {
    url.searchParams.set("prompt", "select_account");
  }

  const response = new Response(null, {
    status: 302,
    headers: {
      "Location": url.toString(),
      "Cache-Control": "no-store"
    }
  });
  response.headers.append("Set-Cookie", oauthStateCookie(provider, state));
  return response;
}
