const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "/api";

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
    const url = `${API_BASE}${path}`;
    let message = `Request failed (${res.status})`;
    try {
      const errBody = (await res.json()) as { error?: string; detail?: string };
      if (errBody.error && errBody.detail) {
        message = `${errBody.error}: ${errBody.detail}`;
      } else {
        message = errBody.error ?? errBody.detail ?? message;
      }
    } catch {
      const text = await res.text().catch(() => "");
      if (res.status === 404) {
        message =
          "API route not found. Restart the Next.js dev server (npm run dev) to pick up new route handlers.";
      } else if (text) {
        message = text;
      }
    }
    throw new Error(`${message} (${url})`);
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

export function apiPut<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "PUT" });
}

export function apiDelete<T>(path: string, init?: ApiRequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, method: "DELETE" });
}
