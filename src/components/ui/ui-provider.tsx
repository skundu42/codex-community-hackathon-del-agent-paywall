"use client";

import { App, ConfigProvider } from "antd";
import type { PropsWithChildren } from "react";

const theme = {
  token: {
    colorPrimary: "#1256d6",
    colorInfo: "#1256d6",
    colorSuccess: "#1f8f58",
    colorWarning: "#b86a16",
    colorError: "#c93c37",
    colorText: "#111827",
    colorTextSecondary: "#4b5563",
    colorBgLayout: "#f4f7fb",
    colorBgContainer: "#ffffff",
    colorBorderSecondary: "#e6ebf2",
    borderRadius: 18,
    borderRadiusLG: 24,
    fontFamily: "var(--font-display), sans-serif",
    fontFamilyCode: "var(--font-mono), monospace",
    boxShadowSecondary: "0 20px 45px rgba(15, 23, 42, 0.08)",
  },
  components: {
    Layout: {
      bodyBg: "#f4f7fb",
      headerBg: "rgba(244, 247, 251, 0.82)",
      siderBg: "#ffffff",
    },
    Card: {
      headerBg: "transparent",
    },
    Button: {
      controlHeight: 42,
      fontWeight: 600,
    },
    Input: {
      controlHeight: 44,
    },
    Form: {
      itemMarginBottom: 18,
      labelColor: "#111827",
    },
    Tabs: {
      itemSelectedColor: "#1256d6",
      itemColor: "#4b5563",
    },
  },
} as const;

export function UiProvider({ children }: PropsWithChildren) {
  return (
    <ConfigProvider theme={theme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
