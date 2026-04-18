# AgentPaywall

Seller dashboard for creating paid API endpoints that agents can call through
MPP on Tempo testnet.

## Product flow

1. Register a seller account at `/dashboard` with an email, password, and Tempo wallet address.
2. Create an external proxy route with an upstream URL, HTTP method, and per-call price.
3. Copy the generated paid endpoint from the route detail page.
4. Let an agent call `POST /api/mpp/routes/:slug/invoke`.
5. The gateway returns `402 Payment Required` until the agent retries with a valid Tempo payment credential.
6. After payment verification, the gateway proxies the upstream API and returns the result with a `Payment-Receipt` header.

## Modes

- `mock`: local development and automated tests. The agent flow returns `402`, then accepts `x-mock-payment: paid` on retry.
- `tempo_testnet`: direct Tempo testnet MPP verification for seller-generated paid endpoints.
- `stripe_mpp`: retained for the older browser/deposit flow, but no longer the main product path.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local`.

- `PAYMENTS_PROVIDER=mock` is the safest local default.
- Use `PAYMENTS_PROVIDER=tempo_testnet` for the direct Tempo wallet flow.
- `SESSION_SECRET` secures the seller dashboard session cookie.
- `MPP_SECRET_KEY` signs and verifies MPP challenges.
- `DATABASE_URL` enables persistent Postgres storage. Without it, the app falls back to in-memory storage for local work and tests.
- `ADMIN_TOKEN` is optional legacy bootstrap access for the old admin route-creation endpoint.

## Main API surface

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/dashboard/routes`
- `POST /api/dashboard/routes`
- `GET /api/dashboard/routes/:id`
- `GET /api/routes/:slug`
- `POST /api/mpp/routes/:slug/invoke`

## Verification

```bash
npm run typecheck
npm run test
npm run build
```
