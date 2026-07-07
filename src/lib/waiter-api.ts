import { fetchWithTimeout } from "./fetch-with-timeout";

type WaiterFetchOptions = RequestInit & {
  timeoutMs?: number;
  /** 401 時にログインへ遷移（デフォルト: POST/PUT/PATCH のみ） */
  redirectOn401?: boolean;
};

export async function waiterFetch(
  input: RequestInfo | URL,
  init: WaiterFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 12_000, redirectOn401, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();
  const shouldRedirect =
    redirectOn401 ?? ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  const res = await fetchWithTimeout(
    input,
    {
      credentials: "include",
      cache: "no-store",
      ...rest,
    },
    timeoutMs,
  );

  if (res.status === 401 && shouldRedirect && typeof window !== "undefined") {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/waiter/login?next=${next}`;
  }

  return res;
}

export async function waiterJson<T = unknown>(
  input: RequestInfo | URL,
  init?: WaiterFetchOptions,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await waiterFetch(input, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
