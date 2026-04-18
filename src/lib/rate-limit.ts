const counters = new Map<string, { count: number; resetAt: number }>();

export function enforceRateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const current = Date.now();
  const record = counters.get(options.key);

  if (!record || record.resetAt <= current) {
    counters.set(options.key, {
      count: 1,
      resetAt: current + options.windowMs,
    });
    return;
  }

  if (record.count >= options.limit) {
    throw new Error("Rate limit exceeded. Please wait and try again.");
  }

  record.count += 1;
  counters.set(options.key, record);
}

export function getClientIpAddress(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip") ?? "unknown";
}

