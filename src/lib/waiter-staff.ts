const STAFF_STORAGE_KEY = "waiter-staff-names";
const CURRENT_STAFF_KEY = "waiter-current-staff";

/** シフトの役割名（個人名ではない） */
const ROLE_PLACEHOLDERS = new Set(["店長", "ホール", "キッチン"]);

function isPersonName(name: string) {
  return Boolean(name.trim()) && !ROLE_PLACEHOLDERS.has(name.trim());
}

/** この端末の担当スタッフ（初回入力後は再利用） */
export function getCurrentStaffName(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const current = localStorage.getItem(CURRENT_STAFF_KEY)?.trim();
    if (current && isPersonName(current)) return current;
    const hist: string[] = JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) ?? "[]");
    const person = hist.find((n) => isPersonName(n));
    return person?.trim() || null;
  } catch {
    return null;
  }
}

export function setCurrentStaffName(name: string) {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (!trimmed || !isPersonName(trimmed)) return;
  localStorage.setItem(CURRENT_STAFF_KEY, trimmed);
  saveStaffToHistory(trimmed);
}

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
    if (!res.ok) return local.filter(isPersonName);
    const remote: string[] = await res.json();
    return [...new Set([...remote, ...local])].filter(isPersonName).slice(0, 12);
  } catch {
    return local.filter(isPersonName);
  }
}

export function saveStaffToHistory(name: string) {
  if (typeof window === "undefined" || !name.trim()) return;
  const trimmed = name.trim();
  if (!isPersonName(trimmed)) return;
  try {
    const prev: string[] = JSON.parse(localStorage.getItem(STAFF_STORAGE_KEY) ?? "[]");
    const next = [trimmed, ...prev.filter((s) => s !== trimmed && isPersonName(s))].slice(0, 8);
    localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
