/** キッチン提供目標時間（分）— 注文受付からこの時間以内に提供 */
export const KITCHEN_SERVE_TARGET_MINUTES = 10;

export type ServeCountdown = {
  label: string;
  overdue: boolean;
  /** 0 = 期限切れ, 1 = 余裕あり */
  progress: number;
  urgency: "ok" | "warn" | "critical" | "overdue";
};

export function getServeCountdown(
  queuedAt: string | Date,
  now = Date.now(),
  targetMinutes = KITCHEN_SERVE_TARGET_MINUTES,
): ServeCountdown {
  const start = new Date(queuedAt).getTime();
  const targetMs = targetMinutes * 60_000;
  const remaining = start + targetMs - now;
  const abs = Math.abs(remaining);
  const mm = Math.floor(abs / 60_000);
  const ss = Math.floor((abs % 60_000) / 1000);
  const clock = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  if (remaining > 0) {
    const progress = remaining / targetMs;
    let urgency: ServeCountdown["urgency"] = "ok";
    if (remaining <= 2 * 60_000) urgency = "critical";
    else if (remaining <= 5 * 60_000) urgency = "warn";
    return { label: `あと ${clock}`, overdue: false, progress, urgency };
  }

  return {
    label: `超過 ${clock}`,
    overdue: true,
    progress: 0,
    urgency: "overdue",
  };
}

export function countdownBadgeClass(urgency: ServeCountdown["urgency"]): string {
  switch (urgency) {
    case "ok":
      return "bg-emerald-600 text-white";
    case "warn":
      return "bg-amber-500 text-stone-900";
    case "critical":
      return "bg-red-500 text-white";
    case "overdue":
      return "bg-red-700 text-white";
  }
}

export function countdownBarClass(urgency: ServeCountdown["urgency"]): string {
  switch (urgency) {
    case "ok":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "critical":
      return "bg-red-500";
    case "overdue":
      return "bg-red-700";
  }
}
