# Tempo Gate

MPP compatibility gateway for existing API providers. Register an upstream API route, assign a per-call price, and expose an MPP-gated endpoint that proxies only after payment verification.

## Modes

- `mock`: browser-friendly demo flow with simulated Tempo settlement
- `stripe_mpp`: real agent-facing MPP route backed by Stripe + Tempo deposit mode

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy `.env.example` to `.env.local`.

- Leave `PAYMENTS_PROVIDER=mock` for the local UI demo.
- Set `PAYMENTS_PROVIDER=stripe_mpp` and `STRIPE_SECRET_KEY` to enable the MPP-protected route at `/api/mpp/routes/:routeId/invoke`.

## Implemented API surface

- `POST /api/routes`
- `POST /api/invocations`
- `POST /api/payments/initiate`
- `GET /api/payments/:id/status`
- `POST /api/payments/:id/simulate`
- `POST /api/invocations/:id/execute`
- `GET /api/invocations/:id/result`
- `POST /api/mpp/routes/:id/invoke`
