"use client";

import {
  ApiOutlined,
  CopyOutlined,
  DollarCircleOutlined,
  LogoutOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Grid,
  Input,
  Result,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
} from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordInput, Form, FormItem, TextArea } from "@/components/ui/antd";
import { AppShell } from "@/components/ui/app-shell";
import { getStatusColor } from "@/lib/ui";
import type { PublicApiRoute, PublicProvider } from "@/lib/types";

type DashboardRouteCard = {
  route: PublicApiRoute;
  gatewayUrl: string;
  payment: {
    network: string;
    chainId: number;
    currencyContract: string;
  };
};

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
}

export function DashboardApp({
  initialProvider,
  initialRoutes,
}: {
  initialProvider: PublicProvider | null;
  initialRoutes: DashboardRouteCard[];
}) {
  const { message } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider);
  const [routes, setRoutes] = useState(initialRoutes);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");
  const [authForm, setAuthForm] = useState({
    providerName: "",
    email: "",
    password: "",
    walletAddress: "",
  });
  const [routeForm, setRouteForm] = useState({
    routeName: "",
    slug: "",
    description: "",
    upstreamUrl: "",
    httpMethod: "POST",
    priceAmount: "0.02",
    authHeaderName: "",
    authHeaderValue: "",
  });

  async function submitAuth() {
    setBusyAction("auth");
    setError(null);

    try {
      const payload = await parseOrThrow<{ provider: PublicProvider }>(
        await fetch(`/api/auth/${authMode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authMode === "register" ? authForm : {
            email: authForm.email,
            password: authForm.password,
          }),
        }),
      );

      setProvider(payload.provider);
      setRoutes([]);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function logout() {
    setBusyAction("logout");
    setError(null);

    try {
      await parseOrThrow(await fetch("/api/auth/logout", { method: "POST" }));
      setProvider(null);
      setRoutes([]);
      router.refresh();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Sign out failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function createRoute() {
    setBusyAction("create-route");
    setError(null);

    try {
      const payload = await parseOrThrow<DashboardRouteCard>(
        await fetch("/api/dashboard/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(routeForm),
        }),
      );

      setRoutes((current) => [payload, ...current]);
      setRouteForm({
        routeName: "",
        slug: "",
        description: "",
        upstreamUrl: "",
        httpMethod: "POST",
        priceAmount: "0.02",
        authHeaderName: "",
        authHeaderValue: "",
      });
      router.refresh();
    } catch (routeError) {
      setError(routeError instanceof Error ? routeError.message : "Route creation failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function copyGatewayUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      message.success("Gateway URL copied.");
    } catch {
      message.error("Unable to copy the gateway URL.");
    }
  }

  const routeColumns = [
    {
      title: "Route",
      key: "route",
      render: (_value: unknown, entry: DashboardRouteCard) => (
        <Space orientation="vertical" size={2}>
          <strong>{entry.route.routeName}</strong>
          <span className="muted">{entry.route.description ?? "Paid proxy route"}</span>
        </Space>
      ),
    },
    {
      title: "Price",
      key: "price",
      render: (_value: unknown, entry: DashboardRouteCard) => (
        <Tag color="blue">{entry.route.priceAmount} {entry.route.currency}</Tag>
      ),
    },
    {
      title: "Gateway",
      key: "gateway",
      render: (_value: unknown, entry: DashboardRouteCard) => (
        <span className="inline-code">{entry.gatewayUrl}</span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_value: unknown, entry: DashboardRouteCard) => (
        <Space wrap>
          <Button size="small" icon={<CopyOutlined />} onClick={() => void copyGatewayUrl(entry.gatewayUrl)}>
            Copy
          </Button>
          <Button size="small" href={`/dashboard/routes/${entry.route.id}`}>
            Details
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <AppShell current="dashboard">
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack">
              <div className="section-heading">
                <span className="section-kicker">Seller console</span>
                <h1 className="section-title">Create paid endpoints for agents without exposing your upstream API.</h1>
                <p className="section-copy">
                  Register a seller account, attach a Tempo wallet, configure a route once,
                  then share a stable paid endpoint that enforces settlement before execution.
                </p>
              </div>

              <div className="metric-grid">
                <Card><Statistic title="Network" value="Tempo Moderato" prefix={<SafetyCertificateOutlined />} /></Card>
                <Card><Statistic title="Owned routes" value={provider ? routes.length : 0} prefix={<ApiOutlined />} /></Card>
                <Card><Statistic title="Flow" value="402 → pay → retry" prefix={<DollarCircleOutlined />} /></Card>
              </div>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Tag color="blue">{provider ? "Signed in seller" : "Inline onboarding"}</Tag>
                <p className="section-copy">
                  This dashboard is optimized for operators: create a route, copy the gateway URL,
                  and inspect recent paid invocations without leaving the seller surface.
                </p>
                {provider ? (
                  <Descriptions
                    column={1}
                    items={[
                      { key: "provider", label: "Provider", children: provider.providerName },
                      { key: "email", label: "Email", children: provider.email },
                      {
                        key: "wallet",
                        label: "Wallet",
                        children: <span className="inline-code">{provider.walletAddress}</span>,
                      },
                    ]}
                  />
                ) : (
                  <Result
                    status="info"
                    title="Register or sign in"
                    subTitle="The auth flow stays inline so sellers can onboard without leaving the dashboard."
                  />
                )}
              </Space>
            </Card>
          </div>
        </section>

        {error ? <Card><Result status="error" title={error} /></Card> : null}

        {!provider ? (
          <div className="content-grid">
            <Card className="section-surface">
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <div className="section-heading">
                  <span className="section-kicker">Authentication</span>
                  <h3 style={{ margin: 0 }}>Create seller account or sign in</h3>
                  <p className="section-copy">
                    Registration captures the payout wallet and provider identity. Login reuses the
                    same dashboard surface instead of bouncing sellers to a separate auth route.
                  </p>
                </div>

                <Tabs
                  activeKey={authMode}
                  onChange={(key) => setAuthMode(key as "login" | "register")}
                  items={[
                    {
                      key: "register",
                      label: "Register",
                      children: (
                        <Form layout="vertical">
                          <FormItem label="Provider name">
                            <Input
                              value={authForm.providerName}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, providerName: event.target.value }))
                              }
                            />
                          </FormItem>
                          <FormItem label="Email">
                            <Input
                              type="email"
                              value={authForm.email}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, email: event.target.value }))
                              }
                            />
                          </FormItem>
                          <FormItem label="Password">
                            <PasswordInput
                              value={authForm.password}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, password: event.target.value }))
                              }
                            />
                          </FormItem>
                          <FormItem label="Tempo wallet address">
                            <Input
                              value={authForm.walletAddress}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, walletAddress: event.target.value }))
                              }
                              placeholder="0x..."
                            />
                          </FormItem>
                          <Button type="primary" icon={<UserOutlined />} loading={busyAction === "auth"} onClick={() => void submitAuth()}>
                            Create seller account
                          </Button>
                        </Form>
                      ),
                    },
                    {
                      key: "login",
                      label: "Login",
                      children: (
                        <Form layout="vertical">
                          <FormItem label="Email">
                            <Input
                              type="email"
                              value={authForm.email}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, email: event.target.value }))
                              }
                            />
                          </FormItem>
                          <FormItem label="Password">
                            <PasswordInput
                              value={authForm.password}
                              onChange={(event) =>
                                setAuthForm((current) => ({ ...current, password: event.target.value }))
                              }
                            />
                          </FormItem>
                          <Button type="primary" loading={busyAction === "auth"} onClick={() => void submitAuth()}>
                            Sign in
                          </Button>
                        </Form>
                      ),
                    },
                  ]}
                />
              </Space>
            </Card>

            <Card className="section-surface">
                <Space orientation="vertical" size={16}>
                <Tag color="cyan">Seller workflow</Tag>
                <ul className="bullet-list">
                  <li>Register once with a Tempo wallet that receives payments</li>
                  <li>Create one paid route per premium upstream capability</li>
                  <li>Share the generated endpoint with MPP-aware agents</li>
                  <li>Use route details to inspect examples and recent invocation history</li>
                </ul>
              </Space>
            </Card>
          </div>
        ) : (
          <div className="page-stack">
            <div className="content-grid">
              <Card className="section-surface">
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                  <div className="section-heading">
                    <span className="section-kicker">Create route</span>
                    <h3 style={{ margin: 0 }}>Publish a new paid endpoint</h3>
                    <p className="section-copy">
                      Configure the route contract, fixed price, and optional upstream secret header.
                    </p>
                  </div>

                  <Form layout="vertical">
                    <div className="detail-grid">
                      <FormItem label="Route name">
                        <Input
                          value={routeForm.routeName}
                          onChange={(event) =>
                            setRouteForm((current) => ({ ...current, routeName: event.target.value }))
                          }
                        />
                      </FormItem>
                      <FormItem label="Slug">
                        <Input
                          value={routeForm.slug}
                          onChange={(event) =>
                            setRouteForm((current) => ({ ...current, slug: event.target.value }))
                          }
                        />
                      </FormItem>
                    </div>

                    <FormItem label="Description">
                      <TextArea
                        rows={3}
                        value={routeForm.description}
                        onChange={(event) =>
                          setRouteForm((current) => ({ ...current, description: event.target.value }))
                        }
                      />
                    </FormItem>

                    <FormItem label="Upstream URL">
                      <Input
                        value={routeForm.upstreamUrl}
                        onChange={(event) =>
                          setRouteForm((current) => ({ ...current, upstreamUrl: event.target.value }))
                        }
                        placeholder="https://example.com/api/paid"
                      />
                    </FormItem>

                    <div className="detail-grid">
                      <FormItem label="HTTP method">
                        <Select
                          value={routeForm.httpMethod}
                          onChange={(value) =>
                            setRouteForm((current) => ({ ...current, httpMethod: value }))
                          }
                          options={[
                            { label: "POST", value: "POST" },
                            { label: "GET", value: "GET" },
                          ]}
                        />
                      </FormItem>
                      <FormItem label="Price (USDC)">
                        <Input
                          value={routeForm.priceAmount}
                          onChange={(event) =>
                            setRouteForm((current) => ({ ...current, priceAmount: event.target.value }))
                          }
                        />
                      </FormItem>
                    </div>

                    <div className="detail-grid">
                      <FormItem label="Optional upstream auth header">
                        <Input
                          value={routeForm.authHeaderName}
                          onChange={(event) =>
                            setRouteForm((current) => ({ ...current, authHeaderName: event.target.value }))
                          }
                          placeholder="x-api-key"
                        />
                      </FormItem>
                      <FormItem label="Header value">
                        <PasswordInput
                          value={routeForm.authHeaderValue}
                          onChange={(event) =>
                            setRouteForm((current) => ({ ...current, authHeaderValue: event.target.value }))
                          }
                        />
                      </FormItem>
                    </div>

                    <div className="card-actions">
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        loading={busyAction === "create-route"}
                        onClick={() => void createRoute()}
                      >
                        Create paid endpoint
                      </Button>
                      <Button icon={<LogoutOutlined />} loading={busyAction === "logout"} onClick={() => void logout()}>
                        Sign out
                      </Button>
                    </div>
                  </Form>
                </Space>
              </Card>

              <Card className="section-surface">
                <Space orientation="vertical" size={16}>
                  <Tag color="green">Seller summary</Tag>
                  <Card size="small">
                    <Statistic title="Routes configured" value={routes.length} prefix={<ApiOutlined />} />
                  </Card>
                  <Card size="small">
                    <Statistic title="Payout wallet" value={provider.walletAddress} prefix={<WalletOutlined />} />
                  </Card>
                  <Card size="small">
                    <Statistic title="Provider" value={provider.providerName} prefix={<UserOutlined />} />
                  </Card>
                </Space>
              </Card>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={18} style={{ width: "100%" }}>
                <div className="section-heading">
                  <span className="section-kicker">Route inventory</span>
                  <h3 style={{ margin: 0 }}>Generated paid endpoints</h3>
                </div>

                {routes.length === 0 ? (
                  <Result
                    status="info"
                    title="No paid routes yet"
                    subTitle="Create a route to generate an MPP-ready gateway endpoint."
                  />
                ) : screens.md ? (
                  <Table
                    rowKey={(entry) => entry.route.id}
                    columns={routeColumns}
                    dataSource={routes}
                    pagination={false}
                  />
                ) : (
                  <div className="page-stack">
                    {routes.map((entry) => (
                      <Card key={entry.route.id} size="small">
                        <Space orientation="vertical" size={10} style={{ width: "100%" }}>
                          <Space wrap>
                            <strong>{entry.route.routeName}</strong>
                            <Tag color={getStatusColor("active")}>Active</Tag>
                            <Tag color="blue">{entry.route.priceAmount} {entry.route.currency}</Tag>
                          </Space>
                          <p className="section-copy">{entry.route.description ?? "Paid proxy route"}</p>
                          <span className="inline-code">{entry.gatewayUrl}</span>
                          <div className="card-actions">
                            <Button size="small" icon={<CopyOutlined />} onClick={() => void copyGatewayUrl(entry.gatewayUrl)}>
                              Copy gateway URL
                            </Button>
                            <Button size="small" href={`/dashboard/routes/${entry.route.id}`}>
                              Open details
                            </Button>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </div>
                )}
              </Space>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
