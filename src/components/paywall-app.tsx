"use client";

import { useEffect, useMemo, useState } from "react";

import { parseInvocationBody } from "@/lib/gateway";
import type {
  ApiInvocation,
  ApiInvocationResult,
  ApiRoute,
  HttpMethod,
  InvocationStatus,
  PaymentSession,
} from "@/lib/types";

const METHOD_OPTIONS: HttpMethod[] = ["POST", "GET", "PUT", "PATCH", "DELETE"];

interface RouteResponse {
  route: ApiRoute;
}

interface InvocationResponse {
  invocation: ApiInvocation;
  route?: ApiRoute;
}

interface PaymentResponse {
  payment: PaymentSession;
}

interface ResultResponse {
  invocationId: string;
  result: ApiInvocationResult;
  transactionReference?: string;
}

export function PaywallApp({
  provider,
}: {
  provider: "mock" | "stripe_mpp";
}) {
  const [routeForm, setRouteForm] = useState({
    providerName: "Demo Provider",
    routeName: "Lead score endpoint",
    description: "Expose an existing JSON API behind per-call MPP payments.",
    upstreamUrl: "",
    httpMethod: "POST" as HttpMethod,
    priceAmount: "0.02",
    authHeaderName: "",
    authHeaderValue: "",
    sampleRequestBody: JSON.stringify(
      {
        customerSegment: "AI agent builders",
        action: "score",
        message: "Make this API payable with MPP.",
      },
      null,
      2,
    ),
  });
  const [invocationBody, setInvocationBody] = useState(routeForm.sampleRequestBody);
  const [route, setRoute] = useState<ApiRoute | null>(null);
  const [invocation, setInvocation] = useState<ApiInvocation | null>(null);
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [result, setResult] = useState<ApiInvocationResult | null>(null);
  const [transactionReference, setTransactionReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setRouteForm((current) => ({
      ...current,
      upstreamUrl: `${window.location.origin}/api/demo/upstream`,
    }));
  }, []);

  const gatewayUrl = useMemo(() => {
    if (!route) {
      return null;
    }

    if (typeof window === "undefined") {
      return `/api/mpp/routes/${route.id}/invoke`;
    }

    return `${window.location.origin}/api/mpp/routes/${route.id}/invoke`;
  }, [route]);

  const invocationBodyPreview = useMemo(() => {
    try {
      return JSON.stringify(parseInvocationBody(invocationBody) ?? {}, null, 2);
    } catch {
      return "{\n  \"error\": \"Invocation body is not valid JSON yet\"\n}";
    }
  }, [invocationBody]);

  async function parseOrThrow<T>(response: Response): Promise<T> {
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.error ?? "Request failed.");
    }

    return body as T;
  }

  async function registerRoute() {
    setBusyAction("register");
    setError(null);
    setInvocation(null);
    setPayment(null);
    setResult(null);
    setTransactionReference(null);

    try {
      const payload = await parseOrThrow<RouteResponse>(
        await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(routeForm),
        }),
      );

      setRoute(payload.route);
      setInvocationBody(payload.route.sampleRequestBody ?? routeForm.sampleRequestBody);
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Route creation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createInvocation() {
    if (!route) return;

    setBusyAction("invoke");
    setError(null);
    setPayment(null);
    setResult(null);
    setTransactionReference(null);

    try {
      const payload = await parseOrThrow<InvocationResponse>(
        await fetch("/api/invocations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            routeId: route.id,
            requestBody: parseInvocationBody(invocationBody),
          }),
        }),
      );

      setInvocation(payload.invocation);
    } catch (invocationError) {
      setError(
        invocationError instanceof Error ? invocationError.message : "Invocation creation failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function initiatePayment() {
    if (!invocation) return;

    setBusyAction("payment");
    setError(null);

    try {
      const payload = await parseOrThrow<PaymentResponse>(
        await fetch("/api/payments/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invocationId: invocation.id }),
        }),
      );

      setPayment(payload.payment);
      setInvocation((current) =>
        current ? { ...current, status: "awaiting_payment", paymentSessionId: payload.payment.id } : current,
      );
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Payment initiation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function simulatePayment() {
    if (!payment) return;

    setBusyAction("simulate");
    setError(null);

    try {
      const payload = await parseOrThrow<PaymentResponse>(
        await fetch(`/api/payments/${payment.id}/simulate`, { method: "POST" }),
      );

      setPayment(payload.payment);
      setInvocation((current) => (current ? { ...current, status: "paid" } : current));
    } catch (simulateError) {
      setError(simulateError instanceof Error ? simulateError.message : "Payment simulation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function executeInvocation() {
    if (!invocation) return;

    setBusyAction("execute");
    setError(null);

    try {
      const payload = await parseOrThrow<ResultResponse>(
        await fetch(`/api/invocations/${invocation.id}/execute`, { method: "POST" }),
      );

      setResult(payload.result);
      setTransactionReference(payload.transactionReference ?? null);
      setInvocation((current) => (current ? { ...current, status: "completed" } : current));
    } catch (executeError) {
      setError(executeError instanceof Error ? executeError.message : "Invocation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshPaymentStatus() {
    if (!payment) return;

    try {
      const payload = await parseOrThrow<PaymentResponse>(
        await fetch(`/api/payments/${payment.id}/status`),
      );

      setPayment(payload.payment);
      if (payload.payment.status === "paid") {
        setInvocation((current) => (current ? { ...current, status: "paid" } : current));
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Status refresh failed.");
    }
  }

  useEffect(() => {
    if (!payment || payment.status !== "pending") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshPaymentStatus();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [payment]);

  useEffect(() => {
    if (payment?.status === "paid" && invocation?.status === "paid" && !result && !busyAction) {
      void executeInvocation();
    }
  }, [payment?.status, invocation?.status, result, busyAction]);

  const invocationStatus: InvocationStatus | "idle" = invocation?.status ?? "idle";

  return (
    <div className="shell">
      <div className="page">
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">MPP compatibility layer for existing APIs</div>
            <h1>Turn any paid API into an MPP route.</h1>
            <p className="hero-subtitle">
              Existing API providers register an upstream endpoint once, assign a per-call
              price, and let this gateway enforce payment before forwarding the request.
              Human demos can use the mock payment path; agents can hit the MPP endpoint directly.
            </p>

            <div className="hero-grid">
              <div className="metric">
                <div className="metric-value">1 route</div>
                <div className="metric-label">maps one upstream API to one paid gateway endpoint</div>
              </div>
              <div className="metric">
                <div className="metric-value">0.02 USDC</div>
                <div className="metric-label">example per-call price, configurable per route</div>
              </div>
              <div className="metric">
                <div className="metric-value">{provider === "mock" ? "Demo" : "Live"}</div>
                <div className="metric-label">mock browser payments or real MPP agent payments</div>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="stack">
              <div className="pill">Use case: API monetization</div>
              <strong>Who this is for</strong>
              <p>Teams with an existing HTTP API that want to add per-call machine payments without rewriting their upstream service.</p>
            </div>
            <div className="stack" style={{ marginTop: 18 }}>
              <strong>What the gateway does</strong>
              <p>Registers route metadata, creates paid invocations, verifies payment, and proxies the request only after settlement.</p>
            </div>
            <div className="stack" style={{ marginTop: 18 }}>
              <strong>Demo default</strong>
              <p>The form below points to a built-in upstream endpoint so the whole payment-to-proxy flow works locally out of the box.</p>
            </div>
          </div>
        </section>

        <div className="content-grid">
          <section className="card">
            <h2 className="section-title">1. Register an upstream API route</h2>
            <p className="section-copy">
              Define the upstream endpoint, the HTTP method, the fixed price, and any server-side auth header this gateway should add before proxying.
            </p>

            <div className="form-grid">
              <div className="field-row">
                <div className="field">
                  <label htmlFor="providerName">Provider name</label>
                  <input
                    id="providerName"
                    value={routeForm.providerName}
                    onChange={(event) =>
                      setRouteForm((current) => ({ ...current, providerName: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="routeName">Route name</label>
                  <input
                    id="routeName"
                    value={routeForm.routeName}
                    onChange={(event) =>
                      setRouteForm((current) => ({ ...current, routeName: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="description">Description</label>
                <input
                  id="description"
                  value={routeForm.description}
                  onChange={(event) =>
                    setRouteForm((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="upstreamUrl">Upstream URL</label>
                <input
                  id="upstreamUrl"
                  value={routeForm.upstreamUrl}
                  onChange={(event) =>
                    setRouteForm((current) => ({ ...current, upstreamUrl: event.target.value }))
                  }
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="httpMethod">HTTP method</label>
                  <select
                    id="httpMethod"
                    className="field-select"
                    value={routeForm.httpMethod}
                    onChange={(event) =>
                      setRouteForm((current) => ({
                        ...current,
                        httpMethod: event.target.value as HttpMethod,
                      }))
                    }
                  >
                    {METHOD_OPTIONS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="priceAmount">Price per call (USDC)</label>
                  <input
                    id="priceAmount"
                    value={routeForm.priceAmount}
                    onChange={(event) =>
                      setRouteForm((current) => ({ ...current, priceAmount: event.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="authHeaderName">Optional upstream auth header</label>
                  <input
                    id="authHeaderName"
                    placeholder="x-api-key"
                    value={routeForm.authHeaderName}
                    onChange={(event) =>
                      setRouteForm((current) => ({
                        ...current,
                        authHeaderName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="authHeaderValue">Optional upstream auth value</label>
                  <input
                    id="authHeaderValue"
                    placeholder="provider-secret"
                    value={routeForm.authHeaderValue}
                    onChange={(event) =>
                      setRouteForm((current) => ({
                        ...current,
                        authHeaderValue: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="sampleRequestBody">Sample request body</label>
                <textarea
                  id="sampleRequestBody"
                  value={routeForm.sampleRequestBody}
                  onChange={(event) =>
                    setRouteForm((current) => ({
                      ...current,
                      sampleRequestBody: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="button-row">
                <button
                  className="button button-primary"
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => void registerRoute()}
                >
                  {busyAction === "register" ? "Registering..." : "Register route"}
                </button>
              </div>
            </div>

            {error ? <div className="banner error">{error}</div> : null}
          </section>

          <aside className="card">
            <h2 className="section-title">Route state</h2>
            <p className="section-copy">
              The gateway endpoint is what you hand to agents. The upstream URL remains private behind the gateway.
            </p>

            <div className="status-grid">
              <div className="status-item">
                <strong>Registered route</strong>
                <div className="mono">{route?.id ?? "No route registered yet"}</div>
                <div className="muted">{route ? `${route.providerName} · ${route.routeName}` : "Create a route first"}</div>
              </div>
              <div className="status-item">
                <strong>Gateway URL</strong>
                <div className="mono">{gatewayUrl ?? "Generated after route registration"}</div>
              </div>
              <div className="status-item">
                <strong>Invocation state</strong>
                <div className="muted">Status: {invocationStatus}</div>
              </div>
            </div>

            <div className="banner" style={{ marginTop: 18 }}>
              {provider === "mock"
                ? "Browser demo mode is active. Payment verification is simulated so you can demo the flow locally."
                : "Stripe MPP mode is active. Agents can pay directly against the gateway URL."}
            </div>
          </aside>
        </div>

        <section className="content-grid">
          <div className="card">
            <h2 className="section-title">2. Create a paid invocation</h2>
            <p className="section-copy">
              This simulates what a client would send to the gateway. For the MVP, invocation bodies are JSON only.
            </p>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="invocationBody">Invocation JSON body</label>
                <textarea
                  id="invocationBody"
                  value={invocationBody}
                  onChange={(event) => setInvocationBody(event.target.value)}
                />
              </div>

              <div className="button-row">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!route || busyAction !== null}
                  onClick={() => void createInvocation()}
                >
                  {busyAction === "invoke" ? "Creating..." : "Create invocation"}
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!invocation || busyAction !== null || result !== null}
                  onClick={() => void initiatePayment()}
                >
                  {busyAction === "payment" ? "Starting payment..." : "Pay and proxy"}
                </button>
                <button
                  className="button button-ghost"
                  type="button"
                  disabled={!payment || payment.status !== "pending" || busyAction !== null || provider !== "mock"}
                  onClick={() => void simulatePayment()}
                >
                  {busyAction === "simulate" ? "Verifying..." : "Simulate payment"}
                </button>
              </div>
            </div>

            {payment ? (
              <div className="banner">
                <div>Payment ref: <span className="mono">{payment.mppReference}</span></div>
                {payment.tempoTxHash ? (
                  <div>Tempo tx: <span className="mono">{payment.tempoTxHash}</span></div>
                ) : null}
                <div>{payment.statusMessage}</div>
              </div>
            ) : null}
          </div>

          <div className="card">
            <h2 className="section-title">3. Proxied result</h2>
            <p className="section-copy">
              Once payment verifies, the gateway forwards the request to the provider’s upstream API and returns the upstream response.
            </p>

            {result ? (
              <>
                <div className="status-grid">
                  <div className="status-item">
                    <strong>Upstream status</strong>
                    <div className="mono">{result.upstreamStatus}</div>
                  </div>
                  <div className="status-item">
                    <strong>Forwarded headers</strong>
                    <pre className="code">{JSON.stringify(result.upstreamHeaders, null, 2)}</pre>
                  </div>
                  <div className="status-item">
                    <strong>Response body</strong>
                    <pre className="code">{JSON.stringify(result.responseBody, null, 2)}</pre>
                  </div>
                </div>
                {transactionReference ? (
                  <div className="banner success">
                    Payment reference: <span className="mono">{transactionReference}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="banner">
                Result locked. Register a route, create an invocation, and pay before the proxy runs.
              </div>
            )}
          </div>
        </section>

        <section className="content-grid">
          <div className="card">
            <h2 className="section-title">Agent flow</h2>
            <p className="section-copy">
              Agents do not need the browser lifecycle. They call the gateway URL directly, handle the 402 challenge, pay, and then receive the upstream response.
            </p>

            <div className="how-grid">
              <div className="how-step">
                <strong>1. Register provider route once</strong>
                <p className="muted">This establishes pricing, method, upstream destination, and optional provider auth header.</p>
              </div>
              <div className="how-step">
                <strong>2. Give agents the MPP gateway URL</strong>
                <p className="muted">They pay this gateway, not the upstream API directly.</p>
              </div>
              <div className="how-step">
                <strong>3. Proxy only after settlement</strong>
                <p className="muted">The gateway releases the upstream result after the payment rail authorizes the request.</p>
              </div>
            </div>

            <div className="code">
              {gatewayUrl
                ? `curl -X POST ${gatewayUrl} \\\n  -H 'content-type: application/json' \\\n  -d '${invocationBodyPreview}'`
                : "Register a route to generate the MPP gateway URL."}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Current assumptions</h2>
            <p className="section-copy">
              This keeps the MVP small and avoids inventing provider-side complexity that is not needed for the first demo.
            </p>
            <ul className="result-list">
              <li>Each route has fixed per-call pricing.</li>
              <li>The MVP supports JSON request bodies and forwards a small safe subset of response headers.</li>
              <li>Upstream credentials are configured as a single server-side header pair per route.</li>
              <li>Production hardening still needs SSRF controls, provider auth storage, and persistent data storage.</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
