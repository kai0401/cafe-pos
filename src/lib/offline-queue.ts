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

export function queueOfflineAction(action: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const key = "waiter-sync-queue";
  const queue = JSON.parse(localStorage.getItem(key) ?? "[]") as Record<string, unknown>[];
  queue.push({ ...action, queuedAt: Date.now() });
  localStorage.setItem(key, JSON.stringify(queue));
}

export async function flushOfflineQueue() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  const key = "waiter-sync-queue";
  const queue = JSON.parse(localStorage.getItem(key) ?? "[]") as Record<string, unknown>[];
  if (queue.length === 0) return;

  const remaining: Record<string, unknown>[] = [];
  for (const action of queue) {
    try {
      const res = await fetch("/api/waiter/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action),
      });
      if (!res.ok) remaining.push(action);
    } catch {
      remaining.push(action);
    }
  }
  localStorage.setItem(key, JSON.stringify(remaining));
}
