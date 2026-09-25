# Claudmor

Claudmor is the authentication/licensing control plane for Claudium.

## Security model

- Raw keys and HWIDs are never stored; Claudmor stores keyed HMAC digests.
- Service secrets are hashed before storage.
- Successful authentication issues a short-lived signed session.
- Bootstrap access uses one-time, HWID-bound tickets that expire after 45 seconds.
- There is deliberately no `public/loader.lua`, static bootstrapper, or browser-readable private loader endpoint.
- The bootstrap consume endpoint returns capabilities only; sensitive logic remains server-side.
- Claudium is called through an internal URL protected by a separate server-only secret.
- API responses are marked `no-store`.

### Important limitation

No system can make client-delivered code permanently invisible to an authorized client. If executable Lua source is sent to a client, that client can eventually capture it. Claudmor therefore keeps sensitive bootstrap behavior server-side and treats any client stub as non-secret.

## Setup

1. Create a Neon/Postgres database.
2. Run `db/schema.sql`.
3. Copy `.env.example` to `.env.local` and configure the values.
4. Install dependencies with `npm install`.
5. Run `npm run dev`.

Use random values of at least 32 bytes for all Claudmor secrets.

## Current API

- `POST /api/v1/auth`
- `POST /api/v1/bootstrap/ticket`
- `POST /api/v1/bootstrap/consume`
- `POST /api/v1/obfuscate`
- `POST /api/admin/services`
- `POST /api/admin/keys`

The admin routes are intended only for initial development. The dashboard/LootLabs workflow should replace direct admin usage for normal users.

<!-- redeploy trigger -->

<!-- deploy-trigger-lootlabs-credit-fix -->
