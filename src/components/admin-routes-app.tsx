"use client";

import {
  ControlOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Button, Card, Form, Input, Result, Select, Space, Statistic, Switch, Table, Tag } from "antd";
import { useState } from "react";

import { AppShell } from "@/components/ui/app-shell";
import { formatStatusLabel, getStatusColor } from "@/lib/ui";
import type { PublicApiRoute, RouteKind } from "@/lib/types";

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body as T;
}

export function AdminRoutesApp({
  initialRoutes,
}: {
  initialRoutes: PublicApiRoute[];
}) {
  const [routes, setRoutes] = useState(initialRoutes);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    adminToken: "",
    providerName: "AgentPaywall Partner",
    routeName: "",
    slug: "",
    routeKind: "external_proxy" as RouteKind,
    description: "",
    upstreamUrl: "",
    httpMethod: "POST",
    priceAmount: "0.02",
    authHeaderName: "",
    authHeaderValue: "",
    featured: false,
  });

  async function submit() {
    setBusy(true);
    setError(null);
    setCreated(null);

    try {
      const payload = await parseOrThrow<{ route: PublicApiRoute }>(
        await fetch("/api/admin/routes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-token": form.adminToken,
          },
          body: JSON.stringify({
            providerName: form.providerName,
            routeName: form.routeName,
            slug: form.slug,
            routeKind: form.routeKind,
            description: form.description,
            upstreamUrl: form.upstreamUrl || undefined,
            httpMethod: form.routeKind === "external_proxy" ? form.httpMethod : undefined,
            priceAmount: form.priceAmount,
            authHeaderName: form.authHeaderName || undefined,
            authHeaderValue: form.authHeaderValue || undefined,
            featured: form.featured,
          }),
        }),
      );

      setRoutes((current) => [payload.route, ...current]);
      setCreated(payload.route.slug);
      setForm((current) => ({
        ...current,
        routeName: "",
        slug: "",
        description: "",
        upstreamUrl: "",
        authHeaderName: "",
        authHeaderValue: "",
      }));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Route creation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell current="admin">
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack">
              <div className="section-heading">
                <span className="section-kicker">Internal admin</span>
                <h1 className="section-title">Register paid APIs without exposing the setup flow publicly.</h1>
                <p className="section-copy">
                  This is the token-protected operator surface for bootstrapping routes, featured demos,
                  and internal partner APIs.
                </p>
              </div>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={16}>
                <Tag color="red">Internal only</Tag>
                <Statistic title="Registered routes" value={routes.length} prefix={<ControlOutlined />} />
                <Statistic title="Featured route support" value="Enabled" prefix={<SafetyCertificateOutlined />} />
              </Space>
            </Card>
          </div>
        </section>

        <div className="content-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading">
                <span className="section-kicker">Create route</span>
                <h3 style={{ margin: 0 }}>Admin route management</h3>
              </div>

              <Form layout="vertical">
                <Form.Item label="Admin token">
                  <Input.Password
                    value={form.adminToken}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        adminToken: event.target.value,
                      }))
                    }
                  />
                </Form.Item>

                <div className="detail-grid">
                  <Form.Item label="Provider name">
                    <Input
                      value={form.providerName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          providerName: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                  <Form.Item label="Route name">
                    <Input
                      value={form.routeName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          routeName: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                </div>

                <div className="detail-grid">
                  <Form.Item label="Slug">
                    <Input
                      value={form.slug}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          slug: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                  <Form.Item label="Route kind">
                    <Select
                      value={form.routeKind}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          routeKind: value as RouteKind,
                        }))
                      }
                      options={[
                        { label: "external_proxy", value: "external_proxy" },
                        { label: "internal_demo", value: "internal_demo" },
                      ]}
                    />
                  </Form.Item>
                </div>

                <Form.Item label="Description">
                  <Input
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </Form.Item>

                <div className="detail-grid">
                  <Form.Item label="Upstream URL">
                    <Input
                      value={form.upstreamUrl}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          upstreamUrl: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                  <Form.Item label="HTTP method">
                    <Select
                      value={form.httpMethod}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          httpMethod: value,
                        }))
                      }
                      disabled={form.routeKind === "internal_demo"}
                      options={[
                        { label: "POST", value: "POST" },
                        { label: "GET", value: "GET" },
                      ]}
                    />
                  </Form.Item>
                </div>

                <div className="detail-grid">
                  <Form.Item label="Price amount">
                    <Input
                      value={form.priceAmount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          priceAmount: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                  <Form.Item label="Featured route">
                    <div style={{ paddingTop: 8 }}>
                      <Switch
                        checked={form.featured}
                        onChange={(checked) =>
                          setForm((current) => ({
                            ...current,
                            featured: checked,
                          }))
                        }
                      />
                    </div>
                  </Form.Item>
                </div>

                <div className="detail-grid">
                  <Form.Item label="Auth header name">
                    <Input
                      value={form.authHeaderName}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          authHeaderName: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                  <Form.Item label="Auth header value">
                    <Input.Password
                      value={form.authHeaderValue}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          authHeaderValue: event.target.value,
                        }))
                      }
                    />
                  </Form.Item>
                </div>

                <Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={() => void submit()}>
                  Create admin route
                </Button>
              </Form>

              {error ? <Result status="error" title={error} /> : null}
              {created ? <Result status="success" title={`Created route ${created}.`} /> : null}
            </Space>
          </Card>

          <Card className="section-surface">
            <Space orientation="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading">
                <span className="section-kicker">Inventory</span>
                <h3 style={{ margin: 0 }}>Registered routes</h3>
              </div>

              {routes.length === 0 ? (
                <Result status="info" title="No routes registered" />
              ) : (
                <Table
                  rowKey="id"
                  pagination={false}
                  dataSource={routes}
                  columns={[
                    {
                      title: "Route",
                      key: "route",
                      render: (_value, route: PublicApiRoute) => (
                        <Space orientation="vertical" size={2}>
                          <strong>{route.routeName}</strong>
                          <span className="muted">{route.slug}</span>
                        </Space>
                      ),
                    },
                    {
                      title: "Kind",
                      key: "kind",
                      render: (_value, route: PublicApiRoute) => (
                        <Tag color="blue">{route.routeKind}</Tag>
                      ),
                    },
                    {
                      title: "Price",
                      key: "price",
                      render: (_value, route: PublicApiRoute) => (
                        <span>{route.priceAmount} {route.currency}</span>
                      ),
                    },
                    {
                      title: "Status",
                      key: "status",
                      render: () => <Tag color={getStatusColor("active")}>{formatStatusLabel("active")}</Tag>,
                    },
                  ]}
                />
              )}
            </Space>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
