"use client";

import Link from "next/link";
import { Layout } from "antd";
import type { PropsWithChildren, ReactNode } from "react";

const { Header, Content } = Layout;

type CurrentView = "home" | "demo" | "dashboard" | "admin";

export function AppShell({
  children,
  headerExtra,
}: PropsWithChildren<{
  current: CurrentView;
  headerExtra?: ReactNode;
}>) {
  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="app-header__inner">
          <Link className="app-brand" href="/">
            <div className="app-brand__name">AgentPaywall</div>
          </Link>

          {headerExtra}
        </div>
      </Header>
      <Content className="app-content">
        <div className="app-content__inner">{children}</div>
      </Content>
    </Layout>
  );
}
