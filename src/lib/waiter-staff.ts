const STAFF_STORAGE_KEY = "waiter-staff-names";

/** シフト登録スタッフ + 端末の履歴をマージ */
export async function loadStaffSuggestions(): Promise<string[]> {
  const local: string[] =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) ?? "[]");
          } catch {
            return [];
          }
        })()
      : [];

  try {
    const res = await fetch("/api/waiter/staff");
    if (!res.ok) return local;
    const remote: string[] = await res.json();
    return [...new Set([...remote, ...local])].slice(0, 12);
  } catch {
    return local;
  }
}

export function saveStaffToHistory(name: string) {
  if (typeof window === "undefined" || !name.trim()) return;
  const trimmed = name.trim();
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) ?? "[]");
    const next = [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 8);
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
