export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const current = new URL(req.url);
  const target = new URL("/api/v1/key-ui/claim", current.origin);
  const token = current.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return Response.redirect(target, 307);
}
