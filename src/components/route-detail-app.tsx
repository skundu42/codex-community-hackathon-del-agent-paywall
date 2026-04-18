"use client";

import {
  ArrowLeftOutlined,
  CopyOutlined,
  LinkOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button, Card, Descriptions, Result, Space, Statistic, Table, Tabs, Tag } from "antd";

import { AppShell } from "@/components/ui/app-shell";
import { formatStatusLabel, getStatusColor } from "@/lib/ui";
import type { ApiInvocation, PaymentSession, PublicApiRoute } from "@/lib/types";

type RouteInvocationEntry = {
  invocation: ApiInvocation;
  payment?: PaymentSession;
  explorerUrl?: string | null;
};

type Contract = {
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

export function RouteDetailApp({
  route,
  contract,
  discoveryUrl,
  providerWallet,
  invocations,
}: {
  route: PublicApiRoute;
  contract: Contract;
  discoveryUrl: string;
  providerWallet: string;
  invocations: RouteInvocationEntry[];
}) {
  const { message } = AntApp.useApp();

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`${label} copied.`);
    } catch {
      message.error(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  const invocationColumns = [
    {
      title: "Invocation",
      dataIndex: ["invocation", "id"],
      key: "invocation",
      render: (_value: string, record: RouteInvocationEntry) => (
        <Space orientation="vertical" size={2}>
          <strong>{record.invocation.id}</strong>
          <Tag color={getStatusColor(record.invocation.status)}>
            {formatStatusLabel(record.invocation.status)}
          </Tag>
        </Space>
      ),
    },
    {
      title: "Payment proof",
      key: "proof",
      render: (_value: unknown, record: RouteInvocationEntry) => (
        <span className="inline-code">
          {record.invocation.transactionReference ?? record.payment?.tempoTxHash ?? "Pending"}
        </span>
      ),
    },
    {
      title: "Price",
      key: "price",
      render: (_value: unknown, record: RouteInvocationEntry) => (
        <span>{record.invocation.priceAmount} {record.invocation.currency}</span>
      ),
    },
    {
      title: "Explorer",
      key: "explorer",
      render: (_value: unknown, record: RouteInvocationEntry) =>
        record.explorerUrl ? (
          <Button size="small" href={record.explorerUrl} target="_blank" icon={<LinkOutlined />}>
            Open
          </Button>
        ) : (
          <span className="muted">Unavailable</span>
        ),
    },
  ];

  return (
    <AppShell
      current="dashboard"
      headerExtra={
        <Button href="/dashboard" icon={<ArrowLeftOutlined />}>
          Back to dashboard
        </Button>
      }
    >
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }} className="hero-grid">
            <div className="page-stack">
              <div className="section-heading">
                <span className="section-kicker">Route detail</span>
                <h1 className="section-title">{route.routeName}</h1>
                <p className="section-copy">
                  {route.description ?? "Seller-owned endpoint with payment enforcement before execution."}
                </p>
              </div>

              <div className="metric-grid">
                <Card><Statistic title="Price" value={`${route.priceAmount} ${route.currency}`} /></Card>
                <Card><Statistic title="Method" value={route.httpMethod ?? "POST"} /></Card>
                <Card><Statistic title="Slug" value={route.slug} /></Card>
              </div>
            </div>

            <Card className="section-surface">
              <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                <Tag color="blue">Seller-owned route</Tag>
                <Descriptions
                  column={1}
                  items={[
                    {
                      key: "gateway",
                      label: "Gateway URL",
                      children: <span className="inline-code">{contract.gatewayUrl}</span>,
                    },
                    {
                      key: "wallet",
                      label: "Seller wallet",
                      children: (
                        <Space>
                          <WalletOutlined />
                          <span className="inline-code">{providerWallet}</span>
                        </Space>
                      ),
                    },
                    {
                      key: "network",
                      label: "Network",
                      children: `${contract.payment.network} · chain ${contract.payment.chainId}`,
                    },
                  ]}
                />
                <div className="card-actions">
                  <Button icon={<CopyOutlined />} onClick={() => void copy(contract.gatewayUrl, "Gateway URL")}>
                    Copy gateway URL
                  </Button>
                  <Button icon={<CopyOutlined />} onClick={() => void copy(discoveryUrl, "Discovery URL")}>
                    Copy discovery URL
                  </Button>
                </div>
              </Space>
            </Card>
          </div>
        </section>

        <Card className="section-surface">
          <Tabs
            items={[
              {
                key: "overview",
                label: "Overview",
                children: (
                  <div className="detail-grid">
                    <Card size="small">
                      <Descriptions
                        column={1}
                        items={[
                          { key: "provider", label: "Provider", children: route.providerName },
                          { key: "kind", label: "Route kind", children: route.routeKind },
                          { key: "featured", label: "Featured", children: route.featured ? "Yes" : "No" },
                        ]}
                      />
                    </Card>
                    <Card size="small">
                      <Descriptions
                        column={1}
                        items={[
                          { key: "rpc", label: "RPC URL", children: <span className="inline-code">{contract.payment.rpcUrl}</span> },
                          {
                            key: "token",
                            label: "Token contract",
                            children: <span className="inline-code">{contract.payment.currencyContract}</span>,
                          },
                          { key: "method", label: "Payment method", children: contract.payment.method },
                        ]}
                      />
                    </Card>
                  </div>
                ),
              },
              {
                key: "contract",
                label: "Endpoint contract",
                children: (
                  <Descriptions
                    column={1}
                    items={[
                      { key: "discovery", label: "Discovery", children: <span className="inline-code">{discoveryUrl}</span> },
                      { key: "gateway", label: "Gateway", children: <span className="inline-code">{contract.gatewayUrl}</span> },
                      { key: "network", label: "Network metadata", children: `${contract.payment.network} · chain ${contract.payment.chainId}` },
                      { key: "token", label: "Currency contract", children: <span className="inline-code">{contract.payment.currencyContract}</span> },
                    ]}
                  />
                ),
              },
              {
                key: "examples",
                label: "Example requests",
                children: (
                  <Space orientation="vertical" size={16} style={{ width: "100%" }}>
                    <Card size="small" title="curl">
                      <pre className="code-block">{contract.examples.curl}</pre>
                    </Card>
                    <Card size="small" title="mppx">
                      <pre className="code-block">{contract.examples.mppx}</pre>
                    </Card>
                    <Card size="small" title="Sample request body">
                      <pre className="code-block">{contract.examples.sampleBody}</pre>
                    </Card>
                  </Space>
                ),
              },
              {
                key: "invocations",
                label: "Recent invocations",
                children:
                  invocations.length > 0 ? (
                    <Table
                      rowKey={(record) => record.invocation.id}
                      columns={invocationColumns}
                      dataSource={invocations}
                      pagination={false}
                    />
                  ) : (
                    <Result status="info" title="No invocations yet" subTitle="Paid agent calls will appear here after the route is used." />
                  ),
              },
              {
                key: "metadata",
                label: "Public metadata",
                children: (
                  <pre className="code-block">{JSON.stringify(route, null, 2)}</pre>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </AppShell>
  );
}
