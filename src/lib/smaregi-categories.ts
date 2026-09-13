/** スマレジ部門ID → ウェイター表示カテゴリ */
export const SMAREGI_DEPT_TO_CATEGORY: Record<string, string> = {
  "1": "あんみつ",
  "2": "ドリンク",
  "4": "ソフトクリーム",
  "6": "氷",
  "7": "シロップ",
  "8": "軽食",
  "8000001": "ソフトクリーム",
};

export const WAITER_CATEGORY_ORDER = [
  "あんみつ",
  "ソフトクリーム",
  "テイクアウト",
  "ドリンク",
  "氷",
  "シロップ",
  "軽食",
] as const;

export type WaiterCategoryName = (typeof WAITER_CATEGORY_ORDER)[number];

export function resolveCategoryName(deptId: string, productName: string): string {
  if (productName.includes("テイクアウト")) {
    return "テイクアウト";
  }
  if (SMAREGI_DEPT_TO_CATEGORY[deptId]) {
    return SMAREGI_DEPT_TO_CATEGORY[deptId]!;
  }
  if (productName.includes("ナポリタン") || productName.includes("オムライス")) {
    return "軽食";
  }
  return "あんみつ";
}

export function categorySortOrder(name: string): number {
  const idx = WAITER_CATEGORY_ORDER.indexOf(name as WaiterCategoryName);
  return idx >= 0 ? idx + 1 : 99;
}
