import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";

import "@/app/globals.css";
import { UiProvider } from "@/components/ui/ui-provider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "AgentPaywall",
  description:
    "Tempo + MPP pay-per-call gateway for premium APIs and digital services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${plexMono.variable}`}>
        <AntdRegistry>
          <UiProvider>{children}</UiProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
