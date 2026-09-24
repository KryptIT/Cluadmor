# Claudmor Security Notes

## Loader confidentiality

Do not put a proprietary Lua loader in `public/`, a static route, source maps, or client-side JavaScript.

Claudmor's intended model is:

1. Client authenticates with service ID, service secret, license key, HWID, and any enabled account bindings.
2. Claudmor returns a short-lived signed session.
3. The session can mint a one-time bootstrap ticket.
4. The ticket is bound to the authenticated HWID, expires quickly, and can be consumed once.
5. Consuming the ticket returns capabilities and API locations only. It does not return private loader source.

Any Lua stub shipped to users must be treated as public. Secrets and proprietary decision logic belong on the server.

## Secrets

Never expose these to browser code:

- `CLAUDMOR_MASTER_SECRET`
- `CLAUDMOR_SESSION_SECRET`
- `CLAUDMOR_ADMIN_TOKEN`
- `CLAUDIUM_INTERNAL_SECRET`
- LootLabs private credentials

Do not prefix them with `NEXT_PUBLIC_`.

## Key binding

Prefer immutable account IDs over usernames. HWIDs are HMACed before storage. First-use HWID binding is supported by the authentication route when a key has no HWID yet.
