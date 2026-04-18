# AGENTS.md

## Project Snapshot

This repository is no longer just a generic "paywalled landing page roast" MVP. The current application is a **Next.js 16 App Router gateway for paid APIs on Tempo**, with two main product surfaces:

1. A **seller dashboard** where providers register, sign in, attach a Tempo wallet, and create paid proxy routes.
2. A **demo / buyer flow** that generates a monetized endpoint, provisions a demo agent wallet, funds it on Tempo testnet, and invokes the route through an MPP-protected gateway.

There is still a featured internal demo route called `landing-page-roast`, but the broader product is now a **seller-owned paid API gateway**, not just a single paid content unlock flow.

When making product, UI, or architecture changes, treat the current code as the source of truth over any older PRD language.

## Stack

- Framework: `Next.js 16` with App Router
- Language: `TypeScript`
- UI: `React 19`, `Ant Design`
- Payments / protocol: `mppx`, Tempo testnet flow
- Database: optional `Postgres` via `pg`
- Local fallback storage: in-memory store in `src/lib/store.ts`
- Testing: Node test runner with `tsx`

## Main Product Flows

### 1. Seller dashboard flow

Entry points:

- `/dashboard`
- `/dashboard/routes/[routeId]`

What it does:

- Registers and authenticates providers
- Stores a provider wallet address
- Creates seller-owned paid routes for external upstream APIs
- Shows gateway contract details
- Shows example `curl` and `mppx` usage
- Displays recent invocation history and payment proof

Key files:

- `src/components/dashboard-app.tsx`
- `src/components/route-detail-app.tsx`
- `src/app/api/auth/*`
- `src/app/api/dashboard/routes/*`
- `src/lib/auth.ts`

### 2. Public demo / agent flow

Entry points:

- `/`
- `/demo/[slug]`

What it does:

- Creates a demo paid endpoint
- Creates a fresh demo agent wallet
- Funds the wallet on Tempo testnet
- Invokes the paid route
- Shows payment proof and unlocked response

Key files:

- `src/components/simple-demo-app.tsx`
- `src/components/route-demo-app.tsx`
- `src/app/api/demo/routes/*`
- `src/lib/tempo-agent.ts`

### 3. Featured buyer paywall flow

This still exists, but it is now a secondary demo surface rather than the whole app.

Key files:

- `src/components/paywall-app.tsx`
- `src/app/api/routes/[slug]/invocations/route.ts`
- `src/app/api/invocations/[invocationId]/*`
- `src/lib/execution.ts`
- `src/lib/landing-page-roast.ts`

## Route Types

The system supports two route kinds in `src/lib/types.ts`:

- `internal_demo`: built-in route execution, currently the landing-page roast
- `external_proxy`: paid proxying to an upstream API

Most new product work should assume `external_proxy` is the primary mode unless the change is explicitly about the featured demo.

## Payment Modes

Supported providers:

- `mock`
- `tempo_testnet`
- `stripe_mpp`

Current behavior:

- `mock` is the safest local and test mode.
- `tempo_testnet` is the primary product direction for agent-facing paid route execution.
- `stripe_mpp` is legacy browser deposit flow support and is not the main product surface anymore.

Important nuance:

- `src/lib/mpp.ts` contains the **real MPP-protected gateway behavior** for `/api/mpp/routes/[slug]/invoke`.
- `src/lib/payment-provider.ts` still backs the older browser-style payment session flow and currently treats `tempo_testnet` similarly to mock for that path.

Do not assume the browser payment session flow and the direct MPP gateway flow are the same system. They are related but distinct paths.

## Core API Surface

Authentication:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

Seller dashboard:

- `GET /api/dashboard/routes`
- `POST /api/dashboard/routes`
- `GET /api/dashboard/routes/:routeId`

Public route discovery:

- `GET /api/routes/:slug`

MPP-protected agent invocation:

- `GET|POST /api/mpp/routes/:slug/invoke`

Featured browser paywall flow:

- `POST /api/routes/:slug/invocations`
- `GET /api/invocations/:invocationId`
- `POST /api/invocations/:invocationId/execute`
- `GET /api/invocations/:invocationId/result`
- `GET /api/payments/:paymentId/status`
- `POST /api/payments/:paymentId/simulate`

Demo bootstrap / demo agent flow:

- `POST /api/demo/routes`
- `GET|POST /api/demo/upstream`
- `POST /api/demo/routes/:slug/agent`
- `POST /api/demo/routes/:slug/agent/fund`
- `POST /api/demo/routes/:slug/agent/invoke`

Legacy admin surface:

- `POST /api/admin/routes`

The admin route is bootstrap/legacy behavior. Prefer the authenticated seller dashboard flow for new work unless there is a strong reason not to.

## Data Model

Primary entities:

- `Provider`
- `ProviderSession`
- `ApiRoute`
- `ApiInvocation`
- `PaymentSession`

Definitions live in:

- `src/lib/types.ts`

Persistence behavior:

- If `DATABASE_URL` is set, the app uses Postgres and self-initializes schema in `src/lib/store.ts`.
- Without `DATABASE_URL`, the app falls back to in-memory storage.
- The featured `landing-page-roast` route is seeded automatically.

When adding new persisted fields, update both:

1. The TypeScript types
2. The Postgres row mapping and memory-store behavior in `src/lib/store.ts`

## Security / Correctness Constraints

These are already encoded in the app and should be preserved:

- Never return paid results before payment verification.
- Keep seller private upstream credentials server-side only.
- Preserve request-to-payment association.
- Preserve idempotency behavior for agent invocations where applicable.
- Maintain SSRF protections in `validateUpstreamUrl` in `src/lib/gateway.ts`.
- Do not weaken wallet address validation in `src/lib/auth.ts`.
- Keep session cookies `HttpOnly` and server-managed.

If you change external proxy behavior, review:

- upstream validation
- header forwarding
- body handling for `GET`
- error surfacing for upstream 4xx/5xx responses

## Important Files

UI and page entry points:

- `src/app/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/demo/[slug]/page.tsx`
- `src/components/simple-demo-app.tsx`
- `src/components/dashboard-app.tsx`
- `src/components/route-detail-app.tsx`
- `src/components/route-demo-app.tsx`
- `src/components/paywall-app.tsx`

Core domain logic:

- `src/lib/types.ts`
- `src/lib/store.ts`
- `src/lib/gateway.ts`
- `src/lib/execution.ts`
- `src/lib/payment-provider.ts`
- `src/lib/mpp.ts`
- `src/lib/tempo-agent.ts`
- `src/lib/route-contract.ts`
- `src/lib/auth.ts`

Tests:

- `src/lib/gateway.test.ts`
- `src/lib/flow.test.ts`
- `src/lib/agent-route-flow.test.ts`
- `src/lib/auth.test.ts`
- `src/lib/landing-page-roast.test.ts`

## Environment Variables

Defined/used today:

- `PAYMENTS_PROVIDER`
- `NEXT_PUBLIC_PAYMENTS_PROVIDER`
- `SESSION_SECRET`
- `MPP_SECRET_KEY`
- `DATABASE_URL`
- `APP_BASE_URL`
- `ADMIN_TOKEN`
- `STRIPE_SECRET_KEY`

Guidance:

- Prefer `PAYMENTS_PROVIDER=mock` for local development unless specifically testing Tempo behavior.
- Do not move secrets to the client.
- Be careful when changing provider defaults in `src/lib/env.ts`, because they affect both UI labels and backend behavior.

## Local Commands

Install:

```bash
npm install
```

Run:

```bash
npm run dev
```

Verify:

```bash
npm run typecheck
npm run test
npm run build
```

## Working Rules For Future Agents

- Match the current product: paid API gateway first, featured roast demo second.
- Prefer extending existing flows over creating parallel ones.
- Keep diffs tight and preserve the current Ant Design UI patterns unless intentionally redesigning a surface.
- Reuse helpers in `src/lib/*` instead of duplicating route/payment logic in handlers.
- Update tests when changing:
  - route validation
  - payment state transitions
  - auth/session behavior
  - invocation execution
  - MPP-protected gateway responses

## If You Need To Change Product Copy

Use language that reflects the current app:

- "seller dashboard"
- "paid endpoint"
- "paid proxy route"
- "agent pays, then retries"
- "Tempo testnet"
- "MPP-protected gateway"

Do not describe the app as only a "landing page roast" product unless the change is specifically about the featured demo route.
