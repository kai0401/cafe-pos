/** カテゴリ別トッピンググループ定義 */
export const MODIFIER_GROUP_DEFS: Record<
  string,
  {
    label: string;
    sourceCategories: string[];
    crossCategory?: boolean;
    kind?: "topping" | "softcream" | "icecream" | "syrup" | "cup-flavor" | "vessel" | "takeout-flavor";
  }[]
> = {
  あんみつ: [
    { label: "トッピング", sourceCategories: ["あんみつ"], kind: "topping" },
    { label: "ソフトクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true, kind: "softcream" },
  ],
  氷: [
    { label: "シロップ", sourceCategories: ["シロップ"], crossCategory: true, kind: "syrup" },
    { label: "ソフトクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true, kind: "softcream" },
    // 白玉はあんみつ部門のSKUを流用
    { label: "トッピング", sourceCategories: ["あんみつ"], kind: "topping" },
  ],
  // 軽食: ソフトトッピングなし
  ドリンク: [
    { label: "オプション", sourceCategories: ["ドリンク"], kind: "topping" },
    { label: "アイスクリーム", sourceCategories: ["ソフトクリーム"], crossCategory: true, kind: "icecream" },
  ],
  /** 単品ソフトは一覧にベースのみ。味・容器はモーダル（容器は店内ソフトのみ） */
  ソフトクリーム: [
    { label: "味", sourceCategories: ["ソフトクリーム"], kind: "cup-flavor" },
    { label: "容器", sourceCategories: ["ソフトクリーム"], kind: "vessel" },
  ],
  /** テイクアウトは一旦ソフトクリームのみ。味選択 */
  テイクアウト: [
    { label: "味", sourceCategories: ["テイクアウト"], kind: "takeout-flavor" },
  ],
};

const TOPPING_NAME_PATTERN =
  /白玉|あんず|あんづ|あんこ|練乳|黒蜜|みつ|アイス→|増し|無し|トッピング/i;

/** あんこ抜きを出さない商品 */
const NO_ANKO_REMOVAL_PRODUCT = /まめかん|みつまめ|ぜんざい|しるこ/;
/** トッピング自体を出さない商品 */
const NO_TOPPING_PRODUCT = /パフェ/;
/** ソフト追加を出さない商品 */
const NO_SOFT_ADD_PRODUCT = /ぜんざい/;
/** あんずトッピングを出さない商品 */
const NO_ANZU_PRODUCT = /ぜんざい/;

function isDashPrefix(name: string): boolean {
  return name.startsWith("-") || name.startsWith("－") || name.startsWith("−");
}

/** 表記ゆれを吸収（あんず / あんづ、全角スペースなど） */
export function normalizeProductName(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[づヅ]/g, "ず")
    .replace(/[－−]/g, "-");
}

export function productDedupeKey(name: string, price: number): string {
  return `${normalizeProductName(name)}@${price}`;
}

/** 同じ見た目の商品が複数SKUあるとき、表示用に1件へまとめる */
export function uniqueProductsByNamePrice<T extends { name: string; price: number }>(items: T[]): T[] {
  const best = new Map<string, T>();
  for (const item of items) {
    const key = productDedupeKey(item.name, item.price);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, item);
      continue;
    }
    // 標準表記（ず）を優先。どちらも同じなら先に出た方
    const preferNew =
      item.name.includes("ず") && !item.name.includes("づ") && existing.name.includes("づ");
    if (preferNew) best.set(key, item);
  }
  return items.filter((item) => best.get(productDedupeKey(item.name, item.price)) === item);
}

/** 注文画面に出す本商品。トッピング・値引きSKUは除外する */
export function isMainProduct(name: string, price: number): boolean {
  if (price < 0 || isDashPrefix(name)) return false;
  if (isVesselOption(name)) return false;
  if (isSoftCreamFlavorOption(name, price)) return false;
  if (TOPPING_NAME_PATTERN.test(name) && price <= 400) return false;
  if (/→/.test(name) && price <= 400) return false;
  return true;
}

/** 同一カテゴリ内のトッピング判定 */
export function isSameCategoryModifier(name: string, price: number): boolean {
  // カップ/コーンはソフトクリーム専用（vessel）。他カテゴリのトッピングに混ぜない
  if (isVesselOption(name)) return false;
  if (isMainProduct(name, price)) return false;
  if (isDashPrefix(name) || price < 0) return true;
  if (TOPPING_NAME_PATTERN.test(name)) return true;
  if (/→|個|無し/.test(name)) return true;
  return !isMainProduct(name, price);
}

/** 他カテゴリから参照するトッピング（メイン商品を混ぜない） */
export function isCrossCategoryModifier(name: string, price: number): boolean {
  if (isDashPrefix(name) || price < 0) return true;
  if (TOPPING_NAME_PATTERN.test(name) && price <= 400) return true;
  return false;
}

export function isModifierProduct(name: string, price: number): boolean {
  return !isMainProduct(name, price);
}

/** お客さまQRの一覧に出さないカテゴリ（中身は甘味へ寄せるか、トッピング専用） */
export const QR_HIDDEN_CATEGORY_NAMES = ["ソフトクリーム", "シロップ", "テイクアウト"] as const;

export function isTakeoutProduct(name: string): boolean {
  return name.includes("テイクアウト");
}

export function isVesselOption(name: string): boolean {
  const n = normalizeProductName(name);
  return n === "カップ" || n === "コーン";
}

export function isAnkoRemoval(name: string): boolean {
  return normalizeProductName(name).includes("あんこ無");
}

export function isAnzuTopping(name: string): boolean {
  const n = normalizeProductName(name);
  return n.includes("あんず") || n.includes("杏");
}

export function isShiratamaTopping(name: string, price = 150): boolean {
  if (!normalizeProductName(name).includes("白玉")) return false;
  return isModifierProduct(name, price);
}

export function isIceToSoftOption(name: string): boolean {
  return /アイス\s*→\s*ソフト|アイス→ソフト/.test(name);
}

export function isFloatDrink(productName: string): boolean {
  return productName.includes("フロート");
}

export function isIcedCafeAuLait(productName: string): boolean {
  const n = normalizeProductName(productName);
  return n.includes("アイスカフェオレ") || n.includes("アイスのカフェオレ");
}

export function isIceCreamTopping(name: string, price: number): boolean {
  return normalizeProductName(name) === "アイスクリーム" && price > 0 && price <= 350;
}

/**
 * 商品ごとにスタッフ運用ルールでトッピングを出し分ける。
 * false ならそのモディファイアはモーダルに出さない。
 */
export function allowModifierForProduct(
  categoryName: string,
  productName: string | null | undefined,
  modifierName: string,
  modifierPrice: number,
  kind?: string,
): boolean {
  if (!productName) return true;
  const product = normalizeProductName(productName);

  // パフェ: トッピング・ソフトすべて無し
  if (NO_TOPPING_PRODUCT.test(product)) return false;

  // カップ/コーンはあんみつ等のトッピングに出さない（ソフトクリームの容器のみ）
  if (isVesselOption(modifierName) && kind !== "vessel") return false;

  // ぜんざい: ソフト追加・変更・抜きなし
  if (kind === "softcream" && NO_SOFT_ADD_PRODUCT.test(product)) return false;

  // ドリンク: アイス→ソフトはフロートのみ
  if (categoryName === "ドリンク" && isIceToSoftOption(modifierName)) {
    return isFloatDrink(productName);
  }

  // アイスクリーム追加はアイスカフェオレのみ
  if (kind === "icecream") {
    return isIcedCafeAuLait(productName) && isIceCreamTopping(modifierName, modifierPrice);
  }

  // まめかん・みつまめ・ぜんざい・しるこ: あんこ抜きなし
  if (isAnkoRemoval(modifierName) && NO_ANKO_REMOVAL_PRODUCT.test(product)) {
    return false;
  }

  // ぜんざい: あんずトッピングなし
  if (isAnzuTopping(modifierName) && NO_ANZU_PRODUCT.test(product)) {
    return false;
  }

  // 氷のトッピング枠は白玉のみ（あんみつ部門SKU流用）
  if (categoryName === "氷" && kind === "topping") {
    return isShiratamaTopping(modifierName, modifierPrice);
  }

  return true;
}

/** QRの商品カードに出す本商品。テイクアウトSKU・トッピングは出さない */
export function isQrListedProduct(name: string, price: number): boolean {
  return isWaiterListedProduct(name, price);
}

/**
 * ウェイター一覧に出す本商品。
 * テイクアウトは一旦ソフトクリームのみ（味はモーダル）。ソフト店内は ¥550 ベースのみ。
 */
export function isWaiterListedProduct(
  name: string,
  price: number,
  categoryName?: string,
): boolean {
  if (categoryName === "テイクアウト") {
    return isTakeoutSoftCreamBase(name);
  }
  if (isTakeoutProduct(name)) return false;
  if (isSoftCreamFlavorOption(name, price)) return false;
  if (isSoftCreamCupFlavor(name)) return false;
  if (isVesselOption(name)) return false;
  // アイスクリームはトッピング／味選択肢。一覧のベースにはしない
  if (normalizeProductName(name) === "アイスクリーム") return false;
  return isMainProduct(name, price);
}

/** テイクアウトのソフトクリーム系（あんみつ系は除外） */
export function isTakeoutSoftCreamItem(name: string): boolean {
  if (!isTakeoutProduct(name) || name.includes("あんみつ")) return false;
  const n = normalizeProductName(name);
  return n.includes("ソフト") || n.includes("バニラ");
}

/** テイクアウト一覧に出すソフトクリームのベース1品 */
export function isTakeoutSoftCreamBase(name: string): boolean {
  return normalizeProductName(name) === "テイクアウトソフトクリーム";
}

/** テイクアウトソフトの味違いSKU */
export function isTakeoutSoftCreamFlavor(name: string): boolean {
  if (!isTakeoutSoftCreamItem(name)) return false;
  const n = normalizeProductName(name);
  return (
    n === "テイクアウトソフトクリーム" ||
    n === "バニラテイクアウト" ||
    n.includes("ミックスソフト") ||
    n.includes("抹茶ソフト")
  );
}

export function takeoutSoftFlavorDisplayName(name: string): string {
  const n = normalizeProductName(name);
  if (n.includes("抹茶")) return "抹茶";
  if (n.includes("ミックス")) return "ミックス";
  if (n.includes("バニラ") || n === "テイクアウトソフトクリーム") return "バニラ";
  return name;
}

const SOFT_CREAM_FLAVOR_NAMES = new Set([
  "ソフトクリーム",
  "ミックスソフトクリーム",
  "抹茶ソフトクリーム",
  "アイスクリーム",
]);

/** 単品カップの味違い。一覧には出さず、ソフトクリームの選択にする */
export function isSoftCreamCupFlavor(name: string): boolean {
  if (isTakeoutProduct(name) || name.includes("あんみつ") || name.includes("氷")) return false;
  const n = normalizeProductName(name);
  return n === "抹茶ソフトクリーム" || n === "ミックスソフトクリーム";
}

export function isVanillaSoftCreamCup(name: string, price: number): boolean {
  if (price < 400 || isTakeoutProduct(name) || isDashPrefix(name)) return false;
  return normalizeProductName(name) === "ソフトクリーム";
}

export function cupFlavorDisplayName(name: string): string {
  const n = normalizeProductName(name);
  if (n === "抹茶ソフトクリーム") return "抹茶";
  if (n === "ミックスソフトクリーム") return "ミックス";
  if (n === "ソフトクリーム") return "バニラ";
  return name;
}

export function isSoftCreamRemoval(name: string, price: number): boolean {
  return (isDashPrefix(name) || price < 0) && name.replace(/[－−]/g, "-").includes("ソフトクリーム");
}

/** トッピング用のソフトクリーム味（単品カップは除外） */
export function isSoftCreamFlavorOption(name: string, price: number): boolean {
  if (price < 0 || price > 350) return false;
  if (name.includes("テイクアウト") || name.includes("あんみつ") || name.includes("氷")) return false;
  return SOFT_CREAM_FLAVOR_NAMES.has(normalizeProductName(name));
}

/** 単品ソフトと同じ味3種（バニラ / 抹茶 / ミックス）。アイス・無しは含まない */
export function isVanillaMatchaMixFlavor(name: string): boolean {
  const n = normalizeProductName(name);
  return n === "ソフトクリーム" || n === "抹茶ソフトクリーム" || n === "ミックスソフトクリーム";
}

export type IncludedSoftCream = "vanilla" | "matcha" | "mix" | null;

/** メニュー本体にソフトクリームが乗っているか（「クリーム」だけでは判定しない） */
export function includedSoftCreamFlavor(productName: string): IncludedSoftCream {
  const n = normalizeProductName(productName);
  if (isDashPrefix(n) || isSoftCreamFlavorOption(n, 0)) return null;
  if (!n.includes("ソフト")) return null;
  if (n.includes("抹茶")) return "matcha";
  if (n.includes("ミックス")) return "mix";
  return "vanilla";
}

export function matchesIncludedFlavor(name: string, included: IncludedSoftCream): boolean {
  const n = normalizeProductName(name);
  if (included === "vanilla") return n === "ソフトクリーム";
  if (included === "matcha") return n === "抹茶ソフトクリーム";
  if (included === "mix") return n === "ミックスソフトクリーム";
  return false;
}

export function modifierDisplayName(name: string): string {
  const normalized = name.replace(/[－−]/g, "-");
  if (normalized.startsWith("-") && normalized.includes("ソフトクリーム")) return "無し";
  if (isIceToSoftOption(name)) return "ソフトに変更";
  return name;
}

export function categoryHasModifiers(
  categoryName: string,
  products: { name: string; price: number; isTopping?: boolean }[],
): boolean {
  const defs = MODIFIER_GROUP_DEFS[categoryName];
  if (!defs?.length) return false;
  if (defs.some((d) => d.kind === "cup-flavor" || d.kind === "softcream" || d.kind === "icecream" || d.kind === "vessel" || d.kind === "takeout-flavor" || d.crossCategory)) {
    return true;
  }
  return products.some((p) => p.isTopping || isSameCategoryModifier(p.name, p.price));
}
