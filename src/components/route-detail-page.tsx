"use client";

import { Result } from "antd";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RouteDetailApp } from "@/components/route-detail-app";

type RouteDetailPayload = Parameters<typeof RouteDetailApp>[0] & {
  gatewayUrl: Parameters<typeof RouteDetailApp>[0]["contract"]["gatewayUrl"];
  payment: Parameters<typeof RouteDetailApp>[0]["contract"]["payment"];
  examples: Parameters<typeof RouteDetailApp>[0]["contract"]["examples"];
  providerWallet: string;
};

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "Request failed.");
  }

  return body as T;
}

export function RouteDetailPage({ routeId }: { routeId: string }) {
  const router = useRouter();
  const [payload, setPayload] = useState<RouteDetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextPayload = await parseOrThrow<RouteDetailPayload>(
          await fetch(`/api/dashboard/routes/${routeId}`, {
            cache: "no-store",
          }),
        );

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (routeError) {
        const message =
          routeError instanceof Error ? routeError.message : "Unable to load route detail.";

        if (/authentication required|route not found/i.test(message)) {
          router.replace("/dashboard");
          return;
        }

        if (!cancelled) {
          setError(message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeId, router]);

  if (error) {
    return <Result status="error" title={error} />;
  }

  if (!payload) {
    return <Result status="info" title="Loading route detail..." />;
  }

  return (
    <RouteDetailApp
      route={payload.route}
      contract={{
        gatewayUrl: payload.gatewayUrl,
        payment: payload.payment,
        examples: payload.examples,
      }}
      discoveryUrl={payload.discoveryUrl}
      providerWallet={payload.providerWallet}
      invocations={payload.invocations}
    />
  );
}
