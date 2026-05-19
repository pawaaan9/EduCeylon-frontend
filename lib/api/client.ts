const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000/api";

type ApiEnvelope<T> = { data: T };

export type ApiRequestInit = RequestInit & {
  token?: string;
  json?: unknown;
};

async function apiRequest<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const { token, json, headers, ...rest } = init ?? {};
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string; detail?: string };
      message = errBody.error ?? errBody.detail ?? message;
    } catch {
      const text = await res.text().catch(() => "");
      if (text) message = text;
    }
    throw new Error(message);
  }

  const payload = (await res.json()) as ApiEnvelope<T>;
  return payload.data;
}

export function apiGet<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "GET" });
}

export function apiPost<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "POST" });
}

export function apiPatch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "PATCH" });
}
