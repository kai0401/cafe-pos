import { fetchWithTimeout } from "./fetch-with-timeout";

type WaiterFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export async function waiterFetch(
  input: RequestInfo | URL,
  init: WaiterFetchOptions = {},
): Promise<Response> {
  const { timeoutMs = 12_000, ...rest } = init;

  return fetchWithTimeout(
    input,
    {
      credentials: "include",
      cache: "no-store",
      ...rest,
    },
    timeoutMs,
  );
}

export async function waiterJson<T = unknown>(
  input: RequestInfo | URL,
  init?: WaiterFetchOptions,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await waiterFetch(input, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
