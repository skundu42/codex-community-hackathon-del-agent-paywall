"use client";

import {
  ApiOutlined,
  CopyOutlined,
  LinkOutlined,
  LockOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Input,
  Result,
  Select,
  Space,
  Statistic,
  Tag,
} from "antd";
import { useState } from "react";

import { AppShell } from "@/components/ui/app-shell";

type GeneratedRouteResponse = {
  route: {
    id: string;
    slug: string;
    routeName: string;
    priceAmount: string;
    currency: string;
    description?: string;
    httpMethod?: string;
  };
  upstreamUrl?: string;
  gatewayUrl: string;
  payment: {
    network: string;
    chainId: number;
    currencyContract: string;
  };
  examples: {
    curl: string;
    mppx: string;
    sampleBody: string;
  };
};

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
}

export function SimpleDemoApp() {
  const { message } = AntApp.useApp();
  const [form, setForm] = useState({
    upstreamUrl: "",
    routeName: "",
    httpMethod: "POST",
  });
  const [generated, setGenerated] = useState<GeneratedRouteResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`${label} copied.`);
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function createPaidEndpoint() {
    setBusy(true);
    setError(null);

    try {
      const payload = await parseOrThrow<GeneratedRouteResponse>(
        await fetch("/api/demo/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }),
      );

      setGenerated(payload);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create the paid endpoint.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell current="home">
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack">
              <div className="section-heading">
                <span className="section-kicker">Simple demo</span>
                <h1 className="section-title">
                  Paste an API endpoint. Generate a paid endpoint instantly.
                </h1>
                <p className="section-copy">
                  The generated endpoint keeps the original API response locked until
                  payment is received. No seller auth, no dashboard, no setup ceremony.
                </p>
              </div>

              <div className="metric-grid">
                <Card>
                  <Statistic title="Input" value="Original API URL" prefix={<ApiOutlined />} />
                </Card>
                <Card>
                  <Statistic title="Output" value="Paid gateway endpoint" prefix={<LockOutlined />} />
                </Card>
                <Card>
                  <Statistic title="Price" value="0.02 USDC" prefix={<WalletOutlined />} />
                </Card>
              </div>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <Tag color="blue">How it works</Tag>
                <ul className="bullet-list">
                  <li>Paste the upstream API endpoint you want to monetize.</li>
                  <li>Get a new paid endpoint generated on the spot.</li>
                  <li>Agents call the paid endpoint, receive a payment challenge, pay, and retry.</li>
                  <li>The original response unlocks only after payment verification.</li>
                </ul>
              </Space>
            </Card>
          </div>
        </section>

        <div className="content-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading">
                <span className="section-kicker">Create paid endpoint</span>
                <h2 style={{ margin: 0 }}>One form. One endpoint. Ready for demo.</h2>
              </div>

              <Space orientation="vertical" size={14} style={{ width: "100%" }}>
                <div>
                  <div className="muted" style={{ marginBottom: 8 }}>Original API endpoint</div>
                  <Input
                    size="large"
                    placeholder="https://api.example.com/v1/premium"
                    value={form.upstreamUrl}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, upstreamUrl: event.target.value }))
                    }
                  />
                </div>

                <div className="detail-grid">
                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>Route label (optional)</div>
                    <Input
                      size="large"
                      placeholder="Premium sentiment API"
                      value={form.routeName}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, routeName: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <div className="muted" style={{ marginBottom: 8 }}>HTTP method</div>
                    <Select
                      size="large"
                      value={form.httpMethod}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, httpMethod: value }))
                      }
                      options={[
                        { label: "POST", value: "POST" },
                        { label: "GET", value: "GET" },
                        { label: "PUT", value: "PUT" },
                        { label: "PATCH", value: "PATCH" },
                        { label: "DELETE", value: "DELETE" },
                      ]}
                    />
                  </div>
                </div>

                <Button
                  type="primary"
                  size="large"
                  icon={<ThunderboltOutlined />}
                  loading={busy}
                  onClick={() => void createPaidEndpoint()}
                >
                  Generate paid endpoint
                </Button>

                {error ? <Result status="error" title={error} /> : null}
              </Space>
            </Space>
          </Card>

          <Card className="section-surface">
            {generated ? (
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <div className="section-heading">
                  <span className="section-kicker">Generated endpoint</span>
                  <h2 style={{ margin: 0 }}>{generated.route.routeName}</h2>
                  <p className="section-copy">
                    Your new paid endpoint is live. The upstream response will stay locked
                    until the payment flow succeeds.
                  </p>
                </div>

                <Descriptions
                  column={1}
                  items={[
                    {
                      key: "upstream",
                      label: "Original endpoint",
                      children: <span className="inline-code">{generated.upstreamUrl}</span>,
                    },
                    {
                      key: "paid",
                      label: "Paid endpoint",
                      children: <span className="inline-code">{generated.gatewayUrl}</span>,
                    },
                    {
                      key: "price",
                      label: "Price",
                      children: `${generated.route.priceAmount} ${generated.route.currency}`,
                    },
                    {
                      key: "network",
                      label: "Payment network",
                      children: `${generated.payment.network} · chain ${generated.payment.chainId}`,
                    },
                  ]}
                />

                <div className="card-actions">
                  <Button icon={<CopyOutlined />} onClick={() => void copy(generated.gatewayUrl, "Paid endpoint")}>
                    Copy paid endpoint
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={() => void copy(generated.examples.mppx, "mppx command")}>
                    Copy mppx command
                  </Button>
                </div>
              </Space>
            ) : (
              <Result
                status="info"
                title="No paid endpoint yet"
                subTitle="Generate one from an upstream API URL and the contract will appear here."
              />
            )}
          </Card>
        </div>

        {generated ? (
          <div className="detail-grid">
            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <span className="section-kicker">Challenge request</span>
                <pre className="code-block">{generated.examples.curl}</pre>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => void copy(generated.examples.curl, "curl command")}
                >
                  Copy curl command
                </Button>
              </Space>
            </Card>

            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <span className="section-kicker">Paid request</span>
                <pre className="code-block">{generated.examples.mppx}</pre>
                <Button
                  icon={<LinkOutlined />}
                  onClick={() => void copy(generated.examples.sampleBody, "sample request body")}
                >
                  Copy sample body
                </Button>
              </Space>
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
