import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

export function saveOfflineOrder(tableId: string, items: unknown[]) {
  if (typeof window === "undefined") return;
  const key = `waiter-offline-${tableId}`;
  localStorage.setItem(key, JSON.stringify(items));
}

export function loadOfflineOrder(tableId: string): unknown[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(`waiter-offline-${tableId}`) ?? "[]");
  } catch {
    return [];
  }
}

export function clearOfflineOrder(tableId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`waiter-offline-${tableId}`);
}

export type OfflineAction = {
  tableId: string;
  items?: { productId: string; quantity: number; note?: string }[];
  action?: "send" | "addAndSend";
  orderId?: string;
  queuedAt?: number;
};

const QUEUE_KEY = "waiter-sync-queue";
const MAX_FLUSH_ITEMS = 5;
const FLUSH_TIMEOUT_MS = 8_000;

export function queueOfflineAction(action: OfflineAction) {
  if (typeof window === "undefined") return;
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as OfflineAction[];
  queue.push({ ...action, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getPendingQueueCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as OfflineAction[];
    return queue.length;
  } catch {
    return 0;
  }
}

export function clearOfflineQueue() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(QUEUE_KEY);
}

export async function flushOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (typeof window === "undefined" || !navigator.onLine) {
    return { synced: 0, remaining: getPendingQueueCount() };
  }
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as OfflineAction[];
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const remaining: OfflineAction[] = [];
  let synced = 0;
  const batch = queue.slice(0, MAX_FLUSH_ITEMS);
  const deferred = queue.slice(MAX_FLUSH_ITEMS);

  for (const action of batch) {
    try {
      const body =
        action.action === "addAndSend"
          ? { action: "addAndSend", tableId: action.tableId, items: action.items }
          : action.action === "send"
            ? { action: "send", orderId: action.orderId }
            : { tableId: action.tableId, items: action.items };

      const res = await fetchWithTimeout(
        "/api/waiter/orders",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        },
        FLUSH_TIMEOUT_MS,
      );
      if (!res.ok) remaining.push(action);
      else synced += 1;
    } catch {
      remaining.push(action);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify([...remaining, ...deferred]));
  return { synced, remaining: remaining.length + deferred.length };
}
