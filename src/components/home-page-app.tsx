"use client";

import {
  ApiOutlined,
  ArrowRightOutlined,
  DollarCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Statistic, Tag } from "antd";

import { PaywallApp } from "@/components/paywall-app";
import { AppShell } from "@/components/ui/app-shell";
import { getProviderLabel } from "@/lib/ui";
import type { PaymentProvider, PublicApiRoute } from "@/lib/types";

export function HomePageApp({
  provider,
  route,
}: {
  provider: PaymentProvider;
  route: PublicApiRoute;
}) {
  return (
    <AppShell current="home">
      <div className="page-stack">
        <section className="hero-surface">
          <div style={{ padding: 32 }}>
            <div className="hero-grid">
              <div className="page-stack">
                <div className="section-heading">
                  <span className="section-kicker">Machine-native monetization</span>
                  <h1 className="section-title">
                    Let humans and agents pay per call, then unlock the result instantly.
                  </h1>
                  <p className="section-copy">
                    AgentPaywall combines a buyer-facing paid demo with a seller console for
                    publishing premium endpoints. The same platform shows the business value,
                    the payment proof, and the API contract in one place.
                  </p>
                </div>

                <div className="metric-grid">
                  <Card className="wide-card">
                    <Statistic title="Featured service" value={route.routeName} prefix={<RobotOutlined />} />
                  </Card>
                  <Card className="wide-card">
                    <Statistic
                      title="Price per run"
                      value={`${route.priceAmount} ${route.currency}`}
                      prefix={<DollarCircleOutlined />}
                    />
                  </Card>
                  <Card className="wide-card">
                    <Statistic
                      title="Payment rail"
                      value={getProviderLabel(provider)}
                      prefix={<WalletOutlined />}
                    />
                  </Card>
                </div>
              </div>

              <Card bordered={false} className="section-surface">
                <Space orientation="vertical" size={20} style={{ width: "100%" }}>
                  <Tag color="blue">Dual audience homepage</Tag>
                  <div>
                    <h2 style={{ marginTop: 0, marginBottom: 8 }}>Buyer path</h2>
                    <p className="section-copy">
                      Run the featured landing page roast, pay through the generated Tempo flow,
                      and reveal the premium output only after payment verification.
                    </p>
                  </div>
                  <Button type="primary" size="large" href="#buyer-demo" icon={<ArrowRightOutlined />}>
                    Run paid roast
                  </Button>

                  <div>
                    <h2 style={{ marginTop: 0, marginBottom: 8 }}>Seller path</h2>
                    <p className="section-copy">
                      Register a seller account, create a paid route, and hand an agent-ready
                      endpoint to your customer or autonomous workflow.
                    </p>
                  </div>
                  <Button size="large" href="/dashboard" icon={<ApiOutlined />}>
                    Create paid endpoint
                  </Button>
                </Space>
              </Card>
            </div>
          </div>
        </section>

        <section className="detail-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={14}>
              <Tag color="gold">How buyers experience it</Tag>
              <h3 style={{ margin: 0 }}>Submit, pay, unlock</h3>
              <p className="section-copy">
                The featured route keeps the demo concrete: buyers submit a URL or copy, see
                the exact price, then unlock structured feedback once settlement completes.
              </p>
              <ul className="bullet-list">
                <li>Clear fixed pricing for the premium result</li>
                <li>Visible payment session, explorer proof, and settlement state</li>
                <li>Fast enough for a live demo without subscription friction</li>
              </ul>
            </Space>
          </Card>

          <Card className="section-surface">
            <Space orientation="vertical" size={14}>
              <Tag color="cyan">How sellers operate it</Tag>
              <h3 style={{ margin: 0 }}>Publish a paid endpoint</h3>
              <p className="section-copy">
                Sellers create a route once, receive a stable gateway URL, and let agents pay
                on demand before the upstream API executes.
              </p>
              <ul className="bullet-list">
                <li>Tempo-aware endpoint contract with payment metadata</li>
                <li>Per-route pricing, optional upstream auth header, and recent call history</li>
                <li>Operator-friendly dashboard instead of a raw hackathon admin page</li>
              </ul>
            </Space>
          </Card>
        </section>

        <section className="detail-grid">
          <Card className="section-surface">
            <Space orientation="vertical" size={14}>
              <Tag color="green">Why this matters</Tag>
              <h3 style={{ margin: 0 }}>A better fit for agents than subscriptions</h3>
              <p className="section-copy">
                Agents do not want prepaid wallets and monthly plans for one-off API work.
                This model makes payment intent, settlement, and service delivery machine-readable.
              </p>
            </Space>
          </Card>

          <Card className="section-surface">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card size="small" bordered={false}>
                  <Statistic title="Trust" value="Proof on Tempo" prefix={<SafetyCertificateOutlined />} />
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card size="small" bordered={false}>
                  <Statistic title="Speed" value="< 10 sec target" prefix={<ThunderboltOutlined />} />
                </Card>
              </Col>
            </Row>
          </Card>
        </section>

        <div id="buyer-demo">
          <PaywallApp provider={provider} route={route} />
        </div>
      </div>
    </AppShell>
  );
}
