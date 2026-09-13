/** トッピング付き注文のマージキー（同一セットのみ統合） */
export function encodeModifierBundle(
  mainProductId: string,
  modifiers: { id: string; name: string }[],
): string | undefined {
  if (modifiers.length === 0) return undefined;
  const ids = modifiers
    .map((m) => m.id)
    .sort()
    .join(",");
  const names = modifiers.map((m) => m.name).join("・");
  return `${names}|__b:${mainProductId}:${ids}`;
}

const BUNDLE_RE = /^(.+)\|__b:([^:]+):(.+)$/;

export function parseModifierBundle(note: string | null | undefined): {
  label: string;
  mainProductId: string;
  modifierIds: string[];
} | null {
  if (!note) return null;
  const m = note.match(BUNDLE_RE);
  if (!m) return null;
  return {
    label: m[1].trim(),
    mainProductId: m[2],
    modifierIds: m[3].split(",").filter(Boolean),
  };
}

/** トッピング行（キッチン伝票・表示から除外する子行） */
export function isModifierChildLine(
  productId: string,
  note: string | null | undefined,
): boolean {
  const bundle = parseModifierBundle(note);
  if (!bundle) return false;
  return productId !== bundle.mainProductId;
}

type OrderItemLike = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  status: string;
  note: string | null;
  createdAt: string;
};

/** ウェイター表示用 — トッピング子行をまとめた1行リスト */
export function groupOrderItemsForDisplay<T extends OrderItemLike>(
  items: T[],
): (T & { lineTotal: number; displayName: string })[] {
  const addonByNote = new Map<string, number>();
  for (const child of items) {
    if (!isModifierChildLine(child.productId, child.note) || !child.note) continue;
    addonByNote.set(
      child.note,
      (addonByNote.get(child.note) ?? 0) + child.unitPrice * child.quantity,
    );
  }

  return items
    .filter((i) => !isModifierChildLine(i.productId, i.note))
    .map((main) => {
      const addon = main.note ? (addonByNote.get(main.note) ?? 0) : 0;
      const lineTotal = main.unitPrice * main.quantity + addon;
      const topping = formatOrderItemNote(main.note);
      const displayName = topping ? `${main.productName}（${topping}）` : main.productName;
      return { ...main, lineTotal, displayName };
    });
}

/** 点数カウント（トッピング子行を除く） */
export function countDisplayOrderItems<T extends { quantity: number; productId: string; note: string | null }>(
  items: T[],
): number {
  return items
    .filter((i) => !isModifierChildLine(i.productId, i.note))
    .reduce((s, i) => s + i.quantity, 0);
}

/** 注文履歴・キッチン表示用（内部キーを除去） */
export function formatOrderItemNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const bundle = parseModifierBundle(note);
  if (bundle) return bundle.label || null;
  const label = note.split("|")[0]?.trim();
  if (!label || label.startsWith("__b:")) return null;
  return label;
}

export type OrderModifierInput = {
  id: string;
  name: string;
  /** false なら注記（伝票）のみ。課金行は作らない（ソフト味など） */
  bill?: boolean;
};

export function buildOrderItemsWithModifiers(
  main: { id: string; quantity: number },
  modifiers: OrderModifierInput[],
): { productId: string; quantity: number; note?: string }[] {
  const note = encodeModifierBundle(
    main.id,
    modifiers.map((m) => ({ id: m.id, name: m.name })),
  );
  const items: { productId: string; quantity: number; note?: string }[] = [
    { productId: main.id, quantity: main.quantity, note },
  ];
  for (const mod of modifiers) {
    if (mod.bill === false) continue;
    items.push({ productId: mod.id, quantity: main.quantity, note });
  }
  return items;
}
