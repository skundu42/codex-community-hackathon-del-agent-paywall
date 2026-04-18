"use client";

import {
  ArrowLeftOutlined,
  CopyOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Input,
  Result,
  Space,
  Spin,
  Statistic,
  Steps,
  Tag,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/ui/app-shell";
import { formatStatusLabel, getInvocationStep, getStatusColor } from "@/lib/ui";
import type {
  ApiInvocation,
  ApiInvocationResult,
  PaymentSession,
  PublicApiRoute,
} from "@/lib/types";

const BODYLESS_METHODS = new Set(["GET", "DELETE"]);

type RouteContractPayload = {
  route: PublicApiRoute;
  gatewayUrl: string;
  payment: {
    method: string;
    network: string;
    chainId: number;
    currencyContract: string;
    explorerBaseUrl: string;
    rpcUrl: string;
  };
  examples: {
    curl: string;
    mppx: string;
    sampleBody: string;
  };
};

type CreateInvocationResponse = {
  route: PublicApiRoute;
  invocation: ApiInvocation;
  payment: PaymentSession;
};

type InvocationStateResponse = {
  route: PublicApiRoute;
  invocation: ApiInvocation;
  payment?: PaymentSession;
  explorerUrl?: string | null;
};

type ExecuteResponse = {
  invocationId: string;
  result: ApiInvocationResult;
  transactionReference?: string;
};

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function prettyResult(result: ApiInvocationResult | null) {
  if (!result) {
    return "";
  }

  if (result.kind === "proxy") {
    return formatJson({
      upstreamStatus: result.upstreamStatus,
      upstreamHeaders: result.upstreamHeaders,
      responseBody: result.responseBody,
    });
  }

  return formatJson(result);
}

export function RouteDemoApp({ slug }: { slug: string }) {
  const { message } = AntApp.useApp();
  const [details, setDetails] = useState<RouteContractPayload | null>(null);
  const [requestBodyText, setRequestBodyText] = useState("{\n  \"prompt\": \"Summarize the billing event\"\n}");
  const [invocation, setInvocation] = useState<ApiInvocation | null>(null);
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [result, setResult] = useState<ApiInvocationResult | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const isBodylessMethod = BODYLESS_METHODS.has(details?.route.httpMethod ?? "POST");
  const currentStep = getInvocationStep(invocation?.status, payment?.status, Boolean(result));
  const formattedResponse = useMemo(() => prettyResult(result), [result]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`${label} copied.`);
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const payload = await parseOrThrow<RouteContractPayload>(
          await fetch(`/api/routes/${slug}`, { cache: "no-store" }),
        );

        if (cancelled) {
          return;
        }

        setDetails(payload);

        if (!BODYLESS_METHODS.has(payload.route.httpMethod ?? "POST")) {
          setRequestBodyText(payload.examples.sampleBody);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load route.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRoute(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function parseRequestBody() {
    if (isBodylessMethod) {
      return undefined;
    }

    const trimmed = requestBodyText.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new Error("Request body must be valid JSON.");
    }
  }

  async function createInvocation() {
    setBusyAction("create");
    setError(null);
    setResult(null);
    setExplorerUrl(null);

    try {
      const payload = await parseOrThrow<CreateInvocationResponse>(
        await fetch(`/api/routes/${slug}/invocations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestBody: parseRequestBody(),
          }),
        }),
      );

      setInvocation(payload.invocation);
      setPayment(payload.payment);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Unable to create invocation.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshInvocationState() {
    if (!invocation) {
      return;
    }

    try {
      const payload = await parseOrThrow<InvocationStateResponse>(
        await fetch(`/api/invocations/${invocation.id}`),
      );

      setInvocation(payload.invocation);
      setPayment(payload.payment ?? null);
      setExplorerUrl(payload.explorerUrl ?? null);

      if (payload.invocation.resultPayload) {
        setResult(payload.invocation.resultPayload);
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error ? refreshError.message : "Unable to refresh status.",
      );
    }
  }

  async function simulatePayment() {
    if (!payment) {
      return;
    }

    setBusyAction("simulate");
    setError(null);

    try {
      const payload = await parseOrThrow<{ payment: PaymentSession }>(
        await fetch(`/api/payments/${payment.id}/simulate`, { method: "POST" }),
      );

      setPayment(payload.payment);
      setInvocation((current) => (current ? { ...current, status: "paid" } : current));
    } catch (simulateError) {
      setError(
        simulateError instanceof Error ? simulateError.message : "Unable to complete payment.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function executeInvocation() {
    if (!invocation) {
      return;
    }

    setBusyAction("execute");
    setError(null);

    try {
      const payload = await parseOrThrow<ExecuteResponse>(
        await fetch(`/api/invocations/${invocation.id}/execute`, {
          method: "POST",
        }),
      );

      setResult(payload.result);
      setInvocation((current) =>
        current
          ? {
              ...current,
              status: "completed",
              transactionReference: payload.transactionReference,
            }
          : current,
      );
    } catch (executeError) {
      setError(
        executeError instanceof Error ? executeError.message : "Unable to execute invocation.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!invocation) {
      return;
    }

    const shouldPoll =
      invocation.status === "awaiting_payment" ||
      invocation.status === "paid" ||
      invocation.status === "processing";

    if (!shouldPoll) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshInvocationState();
    }, 2000);

    return () => window.clearInterval(interval);
  }, [invocation?.id, invocation?.status]);

  useEffect(() => {
    if (!invocation || !payment || result || busyAction) {
      return;
    }

    if (payment.status === "paid" && invocation.status === "paid") {
      void executeInvocation();
    }
  }, [busyAction, invocation, payment, result]);

  if (loadingRoute) {
    return (
      <AppShell current="demo">
        <Result icon={<Spin size="large" />} title="Loading live demo..." />
      </AppShell>
    );
  }

  if (!details) {
    return (
      <AppShell current="demo">
        <Result status="error" title={error ?? "Route not found."} />
      </AppShell>
    );
  }

  const paymentReference =
    invocation?.transactionReference ??
    payment?.tempoTxHash ??
    payment?.receiptPayload?.reference ??
    payment?.mppReference;
  const canMarkPaid = payment?.provider === "mock";

  return (
    <AppShell
      current="demo"
      headerExtra={
        <Button href="/" icon={<ArrowLeftOutlined />}>
          Create another endpoint
        </Button>
      }
    >
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack">
              <div className="section-heading">
                <span className="section-kicker">Page 2 of 2</span>
                <h1 className="section-title">Call the endpoint and unlock the paid response.</h1>
                <p className="section-copy">
                  This page creates the invocation, completes payment, and reveals the
                  final API response once the payment state is verified.
                </p>
              </div>

              <div className="metric-grid">
                <Card>
                  <Statistic title="Endpoint" value={details.route.routeName} />
                </Card>
                <Card>
                  <Statistic
                    title="Price"
                    value={`${details.route.priceAmount} ${details.route.currency}`}
                  />
                </Card>
                <Card>
                  <Statistic title="Method" value={details.route.httpMethod ?? "POST"} />
                </Card>
              </div>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <Tag color="blue">Live flow</Tag>
                <Steps
                  current={currentStep}
                  items={[
                    { title: "Create request", content: "Build the paid invocation" },
                    { title: "Complete payment", content: "Verify payment on Tempo" },
                    { title: "Reveal response", content: "Unlock the API result" },
                  ]}
                />
                <Descriptions
                  column={1}
                  items={[
                    {
                      key: "gateway",
                      label: "Gateway URL",
                      children: <span className="inline-code">{details.gatewayUrl}</span>,
                    },
                    {
                      key: "network",
                      label: "Network",
                      children: `${details.payment.network} · chain ${details.payment.chainId}`,
                    },
                    {
                      key: "reference",
                      label: "Payment reference",
                      children: paymentReference ?? "Shown after payment starts",
                    },
                  ]}
                />
                <div className="card-actions">
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => void copy(details.gatewayUrl, "Gateway URL")}
                  >
                    Copy endpoint
                  </Button>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => void copy(details.examples.mppx, "mppx example")}
                  >
                    Copy mppx example
                  </Button>
                </div>
              </Space>
            </Card>
          </div>
        </section>

        {error ? <Alert type="error" title={error} showIcon /> : null}

        <div className="content-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading">
                <span className="section-kicker">Request</span>
                <h2 style={{ margin: 0 }}>Create the paid API call</h2>
                <p className="section-copy">
                  Submit the request body that should stay locked until payment is complete.
                </p>
              </div>

              {isBodylessMethod ? (
                <Alert
                  type="info"
                  showIcon
                  title={`${details.route.httpMethod} requests do not send a request body.`}
                />
              ) : (
                <div>
                  <div className="muted" style={{ marginBottom: 8 }}>
                    JSON request body
                  </div>
                  <Input.TextArea
                    rows={12}
                    value={requestBodyText}
                    onChange={(event) => setRequestBodyText(event.target.value)}
                    spellCheck={false}
                  />
                </div>
              )}

              <div className="card-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<PlayCircleOutlined />}
                  loading={busyAction === "create"}
                  disabled={busyAction !== null}
                  onClick={() => void createInvocation()}
                >
                  Create paid request
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => void copy(details.examples.sampleBody, "Sample request body")}
                  disabled={isBodylessMethod}
                >
                  Copy sample body
                </Button>
              </div>
            </Space>
          </Card>

          <Card className="section-surface status-card">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading">
                <span className="section-kicker">Payment</span>
                <h2 style={{ margin: 0 }}>Complete the payment</h2>
                <p className="section-copy">
                  Once the payment is confirmed, the invocation is executed automatically.
                </p>
              </div>

              <Descriptions
                column={1}
                items={[
                  {
                    key: "invocation",
                    label: "Invocation status",
                    children: invocation ? (
                      <Space>
                        <span className="inline-code">{invocation.id}</span>
                        <Tag color={getStatusColor(invocation.status)}>
                          {formatStatusLabel(invocation.status)}
                        </Tag>
                      </Space>
                    ) : (
                      "Not created yet"
                    ),
                  },
                  {
                    key: "payment",
                    label: "Payment status",
                    children: payment ? (
                      <Space>
                        <span className="inline-code">{payment.id}</span>
                        <Tag color={getStatusColor(payment.status)}>
                          {formatStatusLabel(payment.status)}
                        </Tag>
                      </Space>
                    ) : (
                      "Waiting for request creation"
                    ),
                  },
                  {
                    key: "amount",
                    label: "Amount",
                    children: payment
                      ? `${payment.amount} ${payment.currency}`
                      : `${details.route.priceAmount} ${details.route.currency}`,
                  },
                  {
                    key: "address",
                    label: "Pay-to address",
                    children: payment?.payToAddress ? (
                      <span className="inline-code">{payment.payToAddress}</span>
                    ) : (
                      "Shown after request creation"
                    ),
                  },
                ]}
              />

              {payment ? (
                <Alert
                  type={
                    payment.status === "paid"
                      ? "success"
                      : payment.status === "failed" || payment.status === "expired"
                        ? "error"
                        : "info"
                  }
                  showIcon
                  title={payment.statusMessage}
                />
              ) : null}

              <div className="card-actions">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => void refreshInvocationState()}
                  disabled={!invocation || busyAction !== null}
                >
                  Refresh status
                </Button>
                <Button
                  icon={<SafetyCertificateOutlined />}
                  loading={busyAction === "simulate"}
                  disabled={!canMarkPaid || busyAction !== null || payment?.status === "paid"}
                  onClick={() => void simulatePayment()}
                >
                  Mark payment complete
                </Button>
                {explorerUrl ? (
                  <Button icon={<LinkOutlined />} href={explorerUrl} target="_blank">
                    Open explorer
                  </Button>
                ) : null}
              </div>
            </Space>
          </Card>
        </div>

        <Card className="section-surface">
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <div className="section-heading">
              <span className="section-kicker">Unlocked response</span>
              <h2 style={{ margin: 0 }}>Final API output</h2>
            </div>

            {result ? (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Alert
                  type="success"
                  showIcon
                  title="Payment complete. Premium response unlocked."
                  description={
                    paymentReference
                      ? `Payment reference: ${paymentReference}`
                      : "The invocation finished successfully."
                  }
                />

                <div className="response-shell">
                  <pre className="code-block">{formattedResponse}</pre>
                </div>
              </Space>
            ) : (
              <Result
                status="info"
                title="Response is still locked"
                subTitle="Create the request and complete payment to reveal the final API response here."
              />
            )}
          </Space>
        </Card>
      </div>
    </AppShell>
  );
}
