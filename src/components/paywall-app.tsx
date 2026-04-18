"use client";

import {
  CopyOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  QrcodeOutlined,
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
  List,
  Result,
  Space,
  Statistic,
  Steps,
  Tabs,
  Tag,
} from "antd";
import { useEffect, useMemo, useState } from "react";

import QRCode from "qrcode";

import { getExplorerTransactionUrl } from "@/lib/tempo";
import { Form, FormItem, TextArea } from "@/components/ui/antd";
import { formatStatusLabel, getInvocationStep, getProviderLabel, getStatusColor } from "@/lib/ui";
import type {
  ApiInvocation,
  ApiInvocationResult,
  PaymentSession,
  PaymentProvider,
  PublicApiRoute,
} from "@/lib/types";

interface CreateInvocationResponse {
  route: PublicApiRoute;
  invocation: ApiInvocation;
  payment: PaymentSession;
}

interface InvocationStateResponse {
  route: PublicApiRoute;
  invocation: ApiInvocation;
  payment?: PaymentSession;
  explorerUrl?: string | null;
}

interface ExecuteResponse {
  invocationId: string;
  result: ApiInvocationResult;
  transactionReference?: string;
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
}

export function PaywallApp({
  provider,
  route,
}: {
  provider: PaymentProvider;
  route: PublicApiRoute;
}) {
  const { message } = AntApp.useApp();
  const [form, setForm] = useState({
    url: "",
    marketingCopy: "",
    brandName: "",
    targetAudience: "",
  });
  const [invocation, setInvocation] = useState<ApiInvocation | null>(null);
  const [payment, setPayment] = useState<PaymentSession | null>(null);
  const [result, setResult] = useState<ApiInvocationResult | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const gatewayUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `/api/mpp/routes/${route.slug}/invoke`;
    }

    return `${window.location.origin}/api/mpp/routes/${route.slug}/invoke`;
  }, [route.slug]);

  useEffect(() => {
    if (!payment?.payToAddress) {
      setQrCodeDataUrl(null);
      return;
    }

    let cancelled = false;

    void QRCode.toDataURL(payment.payToAddress, {
      width: 220,
      margin: 1,
      color: {
        dark: "#0f1720",
        light: "#fffdf8",
      },
    }).then((dataUrl) => {
      if (!cancelled) {
        setQrCodeDataUrl(dataUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [payment?.payToAddress]);

  async function createInvocation() {
    setBusyAction("create");
    setError(null);
    setResult(null);
    setExplorerUrl(null);

    try {
      const payload = await parseOrThrow<CreateInvocationResponse>(
        await fetch(`/api/routes/${route.slug}/invocations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestBody: {
              url: form.url,
              marketingCopy: form.marketingCopy,
              brandName: form.brandName,
              targetAudience: form.targetAudience,
            },
          }),
        }),
      );

      setInvocation(payload.invocation);
      setPayment(payload.payment);
      setExplorerUrl(getExplorerTransactionUrl(payload.payment.tempoTxHash));
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Invocation creation failed.",
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
        refreshError instanceof Error ? refreshError.message : "State refresh failed.",
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
      setInvocation((current) =>
        current ? { ...current, status: "paid" } : current,
      );
      setExplorerUrl(getExplorerTransactionUrl(payload.payment.tempoTxHash));
    } catch (simulateError) {
      setError(
        simulateError instanceof Error ? simulateError.message : "Payment simulation failed.",
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
        await fetch(`/api/invocations/${invocation.id}/execute`, { method: "POST" }),
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
      setExplorerUrl(getExplorerTransactionUrl(payload.transactionReference));
    } catch (executeError) {
      setError(
        executeError instanceof Error ? executeError.message : "Invocation failed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      message.success(`${label} copied.`);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
      message.error(`Unable to copy ${label.toLowerCase()}.`);
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

  const isMock = provider === "mock";
  const landingPageRoastResult =
    result?.kind === "landing_page_roast" ? result : null;
  const proxyResult = result?.kind === "proxy" ? result : null;
  const currentStep = getInvocationStep(invocation?.status, payment?.status, Boolean(result));

  return (
    <div className="page-stack">
      <section className="hero-surface">
        <div style={{ padding: 32 }} className="hero-grid">
          <div className="page-stack">
            <div className="section-heading">
              <span className="section-kicker">Buyer demo</span>
              <h2 className="section-title">Pay once, unlock the roast immediately after verification.</h2>
              <p className="section-copy">
                Submit a landing page URL or a block of marketing copy, then watch the request
                move through creation, payment, and unlock. The service result stays gated until
                the payment session is verified.
              </p>
            </div>

            <div className="metric-grid">
              <Card><Statistic title="Service" value={route.routeName} /></Card>
              <Card><Statistic title="Price" value={`${route.priceAmount} ${route.currency}`} /></Card>
              <Card><Statistic title="Provider" value={getProviderLabel(provider)} /></Card>
            </div>
          </div>

          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <Tag color="blue">Three-stage flow</Tag>
              <Steps
                current={currentStep}
                items={[
                  { title: "Submit request", description: "Create the invocation" },
                  { title: "Pay and verify", description: "Confirm the payment session" },
                  { title: "Unlock output", description: "Receive the premium result" },
                ]}
              />
              <Descriptions
                column={1}
                items={[
                  { key: "route", label: "Featured route", children: route.routeName },
                  { key: "rail", label: "Payment rail", children: getProviderLabel(provider) },
                  {
                    key: "proof",
                    label: "Payment proof",
                    children: payment?.tempoTxHash ?? payment?.receiptPayload?.reference ?? "Available after settlement",
                  },
                ]}
              />
            </Space>
          </Card>
        </div>
      </section>

      {error ? <Alert type="error" message={error} showIcon /> : null}

      <div className="content-grid">
        <Card className="section-surface">
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <div className="section-heading">
              <span className="section-kicker">1. Submit request</span>
              <h3 style={{ margin: 0 }}>Create the paid invocation</h3>
              <p className="section-copy">
                Provide a URL or marketing copy. Optional brand and audience context helps the
                roast become more specific.
              </p>
            </div>

            <Form layout="vertical">
              <FormItem label="Landing page URL">
                <Input
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, url: event.target.value }))
                  }
                />
              </FormItem>

              <FormItem label="Or paste the marketing copy">
                <TextArea
                  rows={5}
                  placeholder="Paste the hero section, promise, and CTA copy here..."
                  value={form.marketingCopy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      marketingCopy: event.target.value,
                    }))
                  }
                />
              </FormItem>

              <div className="detail-grid">
                <FormItem label="Brand name">
                  <Input
                    placeholder="AgentPaywall"
                    value={form.brandName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        brandName: event.target.value,
                      }))
                    }
                  />
                </FormItem>

                <FormItem label="Target audience">
                  <Input
                    placeholder="API providers selling to AI agents"
                    value={form.targetAudience}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        targetAudience: event.target.value,
                      }))
                    }
                  />
                </FormItem>
              </div>

              <div className="card-actions">
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={busyAction === "create"}
                  disabled={busyAction !== null}
                  onClick={() => void createInvocation()}
                >
                  Pay {route.priceAmount} {route.currency} and run
                </Button>

                {payment ? (
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void refreshInvocationState()}
                    disabled={busyAction !== null}
                  >
                    Refresh status
                  </Button>
                ) : null}

                {payment && isMock ? (
                  <Button
                    icon={<SafetyCertificateOutlined />}
                    loading={busyAction === "simulate"}
                    disabled={busyAction !== null || payment.status === "paid"}
                    onClick={() => void simulatePayment()}
                  >
                    Simulate payment
                  </Button>
                ) : null}
              </div>
            </Form>
          </Space>
        </Card>

        <Card className="section-surface status-card">
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <div className="section-heading">
              <span className="section-kicker">2. Pay and verify</span>
              <h3 style={{ margin: 0 }}>Track the payment session</h3>
            </div>

            <Descriptions
              column={1}
              items={[
                {
                  key: "invocation",
                  label: "Invocation",
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
                  label: "Payment session",
                  children: payment ? (
                    <Space>
                      <span className="inline-code">{payment.id}</span>
                      <Tag color={getStatusColor(payment.status)}>
                        {formatStatusLabel(payment.status)}
                      </Tag>
                    </Space>
                  ) : (
                    "Waiting for invocation"
                  ),
                },
                {
                  key: "proof",
                  label: "Proof",
                  children:
                    payment?.tempoTxHash ??
                    payment?.receiptPayload?.reference ??
                    payment?.mppReference ??
                    "Available after payment",
                },
              ]}
            />

            {payment ? (
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Alert
                  type={payment.status === "paid" ? "success" : payment.status === "failed" ? "error" : "info"}
                  showIcon
                  message={payment.statusMessage}
                />

                <Descriptions
                  column={1}
                  items={[
                    {
                      key: "amount",
                      label: "Amount",
                      children: `${payment.amount} ${payment.currency}`,
                    },
                    {
                      key: "token",
                      label: "Token contract",
                      children: (
                        <span className="inline-code">
                          {payment.supportedTokenContract ?? "Tempo test token"}
                        </span>
                      ),
                    },
                    {
                      key: "address",
                      label: "Pay-to address",
                      children: (
                        <span className="inline-code">
                          {payment.payToAddress ?? "Generated after session creation"}
                        </span>
                      ),
                    },
                  ]}
                />

                <div className="card-actions">
                  {payment.payToAddress ? (
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() =>
                        void copyToClipboard(payment.payToAddress ?? "", "Address")
                      }
                    >
                      {copied === "Address" ? "Copied address" : "Copy address"}
                    </Button>
                  ) : null}

                  {explorerUrl ? (
                    <Button href={explorerUrl} target="_blank" icon={<LinkOutlined />}>
                      Open explorer
                    </Button>
                  ) : null}
                </div>

                {qrCodeDataUrl ? (
                  <div className="qr-frame">
                    <Space orientation="vertical" size={12} style={{ width: "100%" }}>
                      <Tag icon={<QrcodeOutlined />} color="blue">
                        Wallet scan
                      </Tag>
                      <img src={qrCodeDataUrl} alt="Tempo payment QR code" />
                    </Space>
                  </div>
                ) : null}
              </Space>
            ) : (
              <Result
                status="info"
                title="No payment session yet"
                subTitle="Create the invocation first to generate a unique payment session."
              />
            )}
          </Space>
        </Card>
      </div>

      <div className="content-grid">
        <Card className="section-surface">
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <div className="section-heading">
              <span className="section-kicker">3. Unlock result</span>
              <h3 style={{ margin: 0 }}>Premium output</h3>
              <p className="section-copy">
                The result appears only after the payment session has moved to a paid state.
              </p>
            </div>

            {landingPageRoastResult ? (
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <Card size="small">
                  <Statistic title="Clarity score" value={landingPageRoastResult.clarityScore} suffix="/100" />
                  <p className="section-copy" style={{ marginTop: 12 }}>{landingPageRoastResult.summary}</p>
                </Card>

                <Tabs
                  items={[
                    {
                      key: "feedback",
                      label: "Core feedback",
                      children: (
                        <div className="detail-grid">
                          <Card size="small" title="Headline feedback">
                            <p className="section-copy">{landingPageRoastResult.headlineFeedback}</p>
                          </Card>
                          <Card size="small" title="CTA feedback">
                            <p className="section-copy">{landingPageRoastResult.ctaFeedback}</p>
                          </Card>
                        </div>
                      ),
                    },
                    {
                      key: "conversion",
                      label: "Conversion suggestions",
                      children: (
                        <List
                          size="small"
                          dataSource={landingPageRoastResult.conversionSuggestions}
                          renderItem={(item) => <List.Item>{item}</List.Item>}
                        />
                      ),
                    },
                    {
                      key: "quickwins",
                      label: "Quick wins",
                      children: (
                        <List
                          size="small"
                          dataSource={landingPageRoastResult.quickWins}
                          renderItem={(item) => <List.Item>{item}</List.Item>}
                        />
                      ),
                    },
                  ]}
                />
              </Space>
            ) : proxyResult ? (
              <pre className="code-block">{JSON.stringify(proxyResult.responseBody, null, 2)}</pre>
            ) : (
              <Result
                status={payment?.status === "paid" ? "warning" : "info"}
                title={payment?.status === "paid" ? "Payment received, result pending" : "Result still locked"}
                subTitle={
                  payment?.status === "paid"
                    ? "The service is processing the paid invocation."
                    : "Create an invocation and settle the payment to reveal the output."
                }
              />
            )}
          </Space>
        </Card>

        <Card className="section-surface">
          <Space orientation="vertical" size={18} style={{ width: "100%" }}>
            <div className="section-heading">
              <span className="section-kicker">Agent entrypoint</span>
              <h3 style={{ margin: 0 }}>The same route can be bought programmatically</h3>
              <p className="section-copy">
                Agents call this endpoint, receive a payment challenge, pay, and retry the same request.
              </p>
            </div>

            <Descriptions
              column={1}
              items={[
                {
                  key: "gateway",
                  label: "Gateway URL",
                  children: <span className="inline-code">{gatewayUrl}</span>,
                },
              ]}
            />

            <Card size="small" title="Try the challenge with curl">
              <pre className="code-block">{`curl -i ${gatewayUrl} \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com","brandName":"Demo","targetAudience":"Judges"}'`}</pre>
            </Card>

            <Card size="small" title="Pay with mppx">
              <pre className="code-block">{`npx mppx ${gatewayUrl} \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -d '{"url":"https://example.com","brandName":"Demo","targetAudience":"Judges"}'`}</pre>
            </Card>

            <Button icon={<CopyOutlined />} onClick={() => void copyToClipboard(gatewayUrl, "Gateway URL")}>
              {copied === "Gateway URL" ? "Copied gateway URL" : "Copy gateway URL"}
            </Button>
          </Space>
        </Card>
      </div>
    </div>
  );
}
