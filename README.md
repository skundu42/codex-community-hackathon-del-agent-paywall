# AgentPaywall

AgentPaywall is a Next.js app for publishing and consuming **paid API endpoints on Tempo**.

The current product has three visible surfaces:

- A **seller dashboard** for registering a provider account and creating paid proxy routes
- A **demo flow** that generates a monetized endpoint, spins up a demo agent wallet, funds it, and invokes the route
- A retained **featured buyer demo** for the built-in `landing-page-roast` route

## What The App Does

### Seller dashboard

At `/dashboard`, a seller can:

- register with email, password, and Tempo wallet address
- create a paid external proxy route
- inspect the generated gateway contract
- copy example `curl` and `mppx` commands
- review recent invocations and payment proof

### Agent-facing paid gateway

Agents call the paid endpoint at:

- `GET|POST /api/mpp/routes/:slug/invoke`

Behavior:

1. The gateway validates the route and request body.
2. If payment is missing, it returns `402 Payment Required`.
3. The caller retries with a valid Tempo / MPP payment credential.
4. After verification, the gateway executes the route and returns the result.
5. Successful responses include a `Payment-Receipt` header.

### Demo flow

At `/`, the app can:

- create a demo paid endpoint
- provision a fresh demo agent wallet
- fund that wallet on Tempo testnet
- invoke the paid route and show the unlocked response

This is the fastest way to see the full flow without manually wiring a seller account first.

## Route Types

The app supports two route kinds:

- `external_proxy`: seller-owned paid proxy to an upstream API
- `internal_demo`: built-in route execution, currently the featured `landing-page-roast`

The main product direction is `external_proxy`.

## Payment Modes

- `mock`: safest local mode and test mode
- `tempo_testnet`: direct Tempo testnet MPP flow
- `stripe_mpp`: older browser deposit flow retained for compatibility

Notes:

- The MPP-protected route gateway lives at `src/lib/mpp.ts`.
- The browser-oriented payment session flow still exists for the featured demo path and is handled separately in `src/lib/payment-provider.ts`.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local`.

Example variables:

```env
PAYMENTS_PROVIDER=mock
NEXT_PUBLIC_PAYMENTS_PROVIDER=mock
STRIPE_SECRET_KEY=
MPP_SECRET_KEY=
SESSION_SECRET=
DATABASE_URL=
APP_BASE_URL=http://localhost:3000
ADMIN_TOKEN=
```

Guidance:

- Use `PAYMENTS_PROVIDER=mock` for local development unless you are explicitly testing Tempo.
- `SESSION_SECRET` secures seller dashboard sessions.
- `MPP_SECRET_KEY` signs and verifies MPP challenges.
- `DATABASE_URL` enables Postgres persistence. Without it, the app falls back to in-memory storage.
- `APP_BASE_URL` is used for building absolute links and contracts.
- `ADMIN_TOKEN` only applies to the legacy admin bootstrap endpoint.

## Main Routes And APIs

Pages:

- `/`
- `/dashboard`
- `/dashboard/routes/[routeId]`
- `/demo/[slug]`

Auth APIs:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Seller APIs:

- `GET /api/dashboard/routes`
- `POST /api/dashboard/routes`
- `GET /api/dashboard/routes/:routeId`

Public route discovery:

- `GET /api/routes/:slug`

MPP gateway:

- `GET|POST /api/mpp/routes/:slug/invoke`

Featured browser paywall flow:

- `POST /api/routes/:slug/invocations`
- `GET /api/invocations/:invocationId`
- `POST /api/invocations/:invocationId/execute`
- `GET /api/invocations/:invocationId/result`
- `GET /api/payments/:paymentId/status`
- `POST /api/payments/:paymentId/simulate`

Demo helper APIs:

- `POST /api/demo/routes`
- `GET|POST /api/demo/upstream`
- `POST /api/demo/routes/:slug/agent`
- `POST /api/demo/routes/:slug/agent/fund`
- `POST /api/demo/routes/:slug/agent/invoke`

## Persistence

The app supports:

- Postgres persistence when `DATABASE_URL` is set
- in-memory storage when no database is configured

The data model includes:

- providers
- provider sessions
- API routes
- invocations
- payment sessions

The featured `landing-page-roast` route is seeded automatically.

## Verification

```bash
npm run typecheck
npm run test
npm run build
```

## Repo Pointers

- [`/Users/sk/dev/mpp-api-gateway/src/lib/mpp.ts`](/Users/sk/dev/mpp-api-gateway/src/lib/mpp.ts) contains the MPP-protected invoke flow
- [`/Users/sk/dev/mpp-api-gateway/src/lib/store.ts`](/Users/sk/dev/mpp-api-gateway/src/lib/store.ts) contains persistence and schema bootstrapping
- [`/Users/sk/dev/mpp-api-gateway/src/lib/gateway.ts`](/Users/sk/dev/mpp-api-gateway/src/lib/gateway.ts) contains route validation, SSRF protection, and proxy execution
- [`/Users/sk/dev/mpp-api-gateway/src/lib/tempo-agent.ts`](/Users/sk/dev/mpp-api-gateway/src/lib/tempo-agent.ts) contains the demo agent wallet flow
- [`/Users/sk/dev/mpp-api-gateway/src/components/dashboard-app.tsx`](/Users/sk/dev/mpp-api-gateway/src/components/dashboard-app.tsx) and [`/Users/sk/dev/mpp-api-gateway/src/components/route-detail-app.tsx`](/Users/sk/dev/mpp-api-gateway/src/components/route-detail-app.tsx) drive the seller experience
