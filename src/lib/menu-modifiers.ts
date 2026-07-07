/** カテゴリ別トッピンググループ定義 */
export const MODIFIER_GROUP_DEFS: Record<
  string,
  { label: string; sourceCategories: string[]; crossCategory?: boolean }[]
> = {
  あんみつ: [
    { label: "トッピング", sourceCategories: ["あんみつ"] },
    { label: "ソフトクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true },
  ],
  氷: [
    { label: "シロップ", sourceCategories: ["シロップ"], crossCategory: true },
    { label: "ソフトクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true },
    { label: "トッピング", sourceCategories: ["氷"] },
  ],
  軽食: [
    { label: "ソフトクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true },
  ],
  ドリンク: [{ label: "オプション", sourceCategories: ["ドリンク"] }],
};

const TOPPING_NAME_PATTERN =
  /白玉|あんず|あんづ|あんこ|練乳|黒蜜|みつ|アイス→|増し|無し|トッピング/i;

export function isMainProduct(name: string, price: number): boolean {
  if (price < 0 || name.startsWith("-") || name.startsWith("－")) return false;
  if (TOPPING_NAME_PATTERN.test(name) && price <= 400) return false;
  if (/→/.test(name) && price <= 400) return false;
  if (price <= 350 && !name.includes("テイクアウト")) return false;
  if (name.includes("テイクアウト")) return false;
  return true;
}

/** 同一カテゴリ内のトッピング判定 */
export function isSameCategoryModifier(name: string, price: number): boolean {
  if (isMainProduct(name, price)) return false;
  if (name.startsWith("-") || name.startsWith("－")) return true;
  if (price < 0) return true;
  if (price <= 350 && !name.includes("テイクアウト")) return true;
  if (TOPPING_NAME_PATTERN.test(name)) return true;
  if (/→|個|無し/.test(name)) return true;
  return false;
}

/** 他カテゴリから参照するトッピング（メイン商品を混ぜない） */
export function isCrossCategoryModifier(name: string, price: number): boolean {
  if (name.startsWith("-") || name.startsWith("－")) return true;
  if (price < 0) return true;
  if (TOPPING_NAME_PATTERN.test(name) && price <= 400) return true;
  return false;
}

export function isModifierProduct(name: string, price: number): boolean {
  return !isMainProduct(name, price);
}

export function categoryHasModifiers(
  categoryName: string,
  products: { name: string; price: number }[],
): boolean {
  const defs = MODIFIER_GROUP_DEFS[categoryName];
  if (!defs?.length) return false;
  if (products.some((p) => isSameCategoryModifier(p.name, p.price))) return true;
  return defs.some((d) => d.crossCategory);
}
