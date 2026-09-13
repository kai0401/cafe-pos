"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { formatYen } from "@/lib/format";
import { includedSoftCreamFlavor } from "@/lib/menu-modifiers";
import {
  buildOrderItemsWithModifiers,
  formatOrderItemNote,
  groupOrderItemsForDisplay,
  isModifierChildLine,
} from "@/lib/order-modifiers";
import {
  QR_LANGS,
  QR_LANG_STORAGE_KEY,
  QR_STORE_TITLE,
  isQrLang,
  qrName,
  qrPrice,
  qrPriceTaxIn,
  qrStatusLabel,
  qrT,
  type QrLang,
  type QrUiKey,
} from "@/lib/qr-i18n";



type Category = { id: string; name: string; productCount: number; hasModifiers?: boolean };
type Product = {
  id: string;
  name: string;
  price: number;
  soldOut: boolean;
  displayName?: string;
  imageUrl?: string | null;
  categoryId?: string;
  hasModifiers?: boolean;
  included?: boolean;
};
type ModifierGroup = {
  name: string;
  selection?: "multiple" | "single";
  replacesMain?: boolean;
  flavorChoice?: boolean;
  items: Product[];
};
type CartItem = { productId: string; name: string; price: number; quantity: number; note?: string };
type OrderedItem = {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  status: string;
  note?: string | null;
  createdAt: string;
};
type Order = {
  id: string;
  customerCount: number;
  items: OrderedItem[];
  status: string;
};
type PaymentSession = {
  id: string;
  status: string;
  amount: number;
  paymentUrl?: string | null;
};

const QR_CTA = "#e25b45";
const QR_TEAL = "#5aa3ab";
const QR_TEAL_SOFT = "#d7eef1";
const QR_SIDEBAR_ORDER = ["甘味", "軽食", "氷", "お飲み物"];
const QTY_MAX = 99;

function QtyStepper({
  value,
  onChange,
  min = 1,
  max = QTY_MAX,
  labels = { dec: "減らす", inc: "増やす" },
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  labels?: { dec: string; inc: string };
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-[18px] leading-none text-stone-700 disabled:opacity-35"
        aria-label={labels.dec}
      >
        −
      </button>
      <span className="min-w-[28px] text-center text-[15px] font-medium tabular-nums">{value}</span>
      <button
        type="button"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-[18px] leading-none text-stone-700 disabled:opacity-35"
        aria-label={labels.inc}
      >
        ＋
      </button>
    </div>
  );
}

function qrCategoryLabel(name: string) {
  if (name === "あんみつ") return "甘味";
  if (name === "ドリンク") return "お飲み物";
  return name;
}

function visibleQrCategories(menu: Category[]) {
  return menu.filter((c) => c.productCount > 0 && c.name !== "シロップ" && c.name !== "ソフトクリーム");
}

function defaultCreamLabel(productName: string): string | null {
  const flavor = includedSoftCreamFlavor(productName);
  if (flavor === "matcha") return "抹茶";
  if (flavor === "mix") return "ミックス";
  if (flavor === "vanilla") return "ソフトクリーム";
  return null;
}

function groupRowLabel(group: ModifierGroup): string {
  if (group.name.includes("ソフトクリーム")) return "ソフトクリーム";
  if (group.name.includes("トッピング")) return "トッピング";
  return group.name;
}

function ProductPhoto({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={`object-cover ${className ?? ""}`} />
    );
  }
  return (
    <div className={`flex items-center justify-center bg-[#ececec] ${className ?? ""}`} aria-hidden>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[#c5c5c5]">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="8.5" cy="10" r="1.6" fill="currentColor" />
        <path d="M7 17l4.2-4.2a1 1 0 011.3 0L17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}

async function qrFetch(
  tableId: string,
  token: string,
  body: Record<string, unknown>,
) {
  const res = await fetch("/api/qr/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tableId, token, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "__generic__");
  return data;
}

export default function QrOrderClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tableId = params.tableId as string;
  const token = searchParams.get("t") ?? "";

  const [storeName, setStoreName] = useState(QR_STORE_TITLE);
  // デフォルトは日本語。URL指定(?lang=)か、以前この端末で選んだ言語があればそれを使う
  const [lang, setLang] = useState<QrLang>("ja");
  const [langOpen, setLangOpen] = useState(false);
  const langParam = searchParams.get("lang");
  useEffect(() => {
    try {
      if (isQrLang(langParam)) {
        setLang(langParam);
        localStorage.setItem(QR_LANG_STORAGE_KEY, langParam);
        return;
      }
      const saved = localStorage.getItem(QR_LANG_STORAGE_KEY);
      if (isQrLang(saved)) setLang(saved);
    } catch {
      if (isQrLang(langParam)) setLang(langParam);
    }
  }, [langParam]);
  function changeLang(next: QrLang) {
    setLang(next);
    try {
      localStorage.setItem(QR_LANG_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }
  function pickLang(next: QrLang) {
    changeLang(next);
    setLangOpen(false);
  }
  const t = useCallback((key: QrUiKey, vars?: Record<string, string | number>) => qrT(lang, key, vars), [lang]);
  const yenTaxIn = (amount: number) => qrPriceTaxIn(lang, amount);
  const tn = (name: string | null | undefined) => qrName(lang, name);
  const errMsg = useCallback(
    (e: unknown, fallback: QrUiKey) => {
      const m = e instanceof Error ? e.message : "";
      return !m || m === "__generic__" ? t(fallback) : m;
    },
    [t],
  );
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);

  const [screen, setScreen] = useState<"welcome" | "menu" | "cart" | "history" | "ordered" | "pay" | "paid">("welcome");
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const cartReady = useRef(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`qr-cart:${tableId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) setCart(parsed);
      }
    } catch {
      // ignore
    }
    cartReady.current = true;
  }, [tableId]);
  useEffect(() => {
    if (!cartReady.current) return;
    sessionStorage.setItem(`qr-cart:${tableId}`, JSON.stringify(cart));
  }, [cart, tableId]);
  const [toast, setToast] = useState("");
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [guestCount, setGuestCount] = useState(1);

  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [modifiersLoading, setModifiersLoading] = useState(false);
  const [selectedModifiers, setSelectedModifiers] = useState<Set<string>>(new Set());
  const [modalQty, setModalQty] = useState(1);
  const [pickerGroup, setPickerGroup] = useState<ModifierGroup | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(""), 2000);
  };
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // シート表示中は背景スクロールを固定
  useEffect(() => {
    if (!modalProduct) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalProduct]);

  const refreshSession = useCallback(
    async (opts?: { syncPayment?: boolean }) => {
      if (!tableId || !token) return;
      const params = new URLSearchParams({ tableId, token });
      if (opts?.syncPayment) params.set("syncPayment", "1");
      const res = await fetch(`/api/qr/orders?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("invalidQr"));
        return "error";
      }
      setError("");
      setRefreshError("");
      if (typeof data.storeName === "string" && data.storeName.trim()) {
        const n = data.storeName.trim();
        setStoreName(n === "あづま家" ? QR_STORE_TITLE : n);
      }
      setOrder(data.order);
      setPaymentSession(data.paymentSession);

      if (data.paymentSession?.status === "PAID") {
        setScreen("paid");
        return "paid";
      }

      if (data.order) {
        setScreen((s) => (s === "welcome" || s === "paid" ? "menu" : s));
        if (categories.length === 0) {
          try {
            const menu: Category[] = await qrFetch(tableId, token, { action: "menu" });
            const visible = visibleQrCategories(menu);
            setCategories(visible);
            setActiveCategory((prev) => {
              if (prev && visible.some((c) => c.id === prev)) return prev;
              return visible[0]?.id ?? null;
            });
          } catch {
            setRefreshError(t("menuShowFailed"));
          }
        }
        return "order";
      }

      setScreen("welcome");
      setCategories([]);
      setActiveCategory(null);
      return "none";
    },
    [categories.length, tableId, token, t],
  );

  const refreshSessionRef = useRef(refreshSession);
  refreshSessionRef.current = refreshSession;

  useEffect(() => {
    if (!token) {
      setError(qrT("ja", "invalidQr"));
      setBooting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      await refreshSessionRef.current();
    })().finally(() => {
      if (!cancelled) setBooting(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token, tableId]);

  useEffect(() => {
    if (!order?.id) return;
    const refresh = () => void refreshSession({ syncPayment: screen === "pay" });
    const t = setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [order?.id, screen, refreshSession]);

  useEffect(() => {
    const categoryId = activeCategory;
    if (!categoryId || screen !== "menu") return;
    let cancelled = false;

    async function loadProducts(silent: boolean) {
      if (!silent) {
        setProducts([]);
        setProductsLoading(true);
      }
      try {
        const rows = await qrFetch(tableId, token, { action: "menu", categoryId });
        if (cancelled) return;
        setProducts(rows);
        setRefreshError("");
      } catch (e) {
        if (cancelled) return;
        if (!silent) {
          setRefreshError(errMsg(e, "menuLoadFailed"));
        }
      } finally {
        if (!cancelled && !silent) setProductsLoading(false);
      }
    }

    void loadProducts(false);
    const t = setInterval(() => {
      if (document.hidden) return;
      void loadProducts(true);
    }, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeCategory, screen, tableId, token, errMsg]);

  const orderedItems = useMemo(
    () => (order?.items ?? []).filter((i) => i.status !== "PENDING" && i.status !== "CANCELLED"),
    [order],
  );
  const pendingItems = useMemo(
    () => (order?.items ?? []).filter((i) => i.status === "PENDING"),
    [order],
  );

  const cartMains = useMemo(
    () => cart.filter((i) => !isModifierChildLine(i.productId, i.note ?? null)),
    [cart],
  );
  const cartCount = useMemo(() => cartMains.reduce((s, i) => s + i.quantity, 0), [cartMains]);
  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.quantity, 0), [cart]);
  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartMains) {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
    return map;
  }, [cartMains]);
  const sidebarCategories = useMemo(
    () =>
      [...categories].sort((a, b) => {
        const ai = QR_SIDEBAR_ORDER.indexOf(qrCategoryLabel(a.name));
        const bi = QR_SIDEBAR_ORDER.indexOf(qrCategoryLabel(b.name));
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      }),
    [categories],
  );
  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name ?? "";
  const modalUnitPrice = useMemo(() => {
    if (!modalProduct) return 0;
    const flavor = modifierGroups.find((g) => g.replacesMain)?.items.find((m) => selectedModifiers.has(m.id));
    const extra = modifierGroups
      .filter((g) => !g.replacesMain && !g.flavorChoice)
      .flatMap((g) => g.items)
      .filter((m) => selectedModifiers.has(m.id) && !m.included)
      .reduce((s, m) => s + m.price, 0);
    return (flavor?.price ?? modalProduct.price) + extra;
  }, [modalProduct, modifierGroups, selectedModifiers]);
  const displayOrderedItems = useMemo(
    () =>
      groupOrderItemsForDisplay(
        orderedItems.map((i) => ({
          id: i.id,
          productId: i.productId,
          productName: i.productName,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          status: i.status,
          note: i.note ?? null,
          createdAt: i.createdAt,
        })),
      ),
    [orderedItems],
  );

  const orderedTotal = useMemo(
    () => displayOrderedItems.reduce((s, i) => s + i.lineTotal, 0),
    [displayOrderedItems],
  );

  function groupChoiceLabel(group: ModifierGroup): string {
    const selected = group.items.filter((item) => selectedModifiers.has(item.id));
    if (selected.length > 0) {
      return selected.map((item) => tn(item.displayName ?? item.name)).join(lang === "en" ? ", " : "、");
    }
    if (group.name.includes("ソフトクリーム") && modalProduct) {
      const d = defaultCreamLabel(modalProduct.name);
      return d ? tn(d) : t("pleaseChoose");
    }
    return t("pleaseChoose");
  }

  async function startOrder() {
    setLoading(true);
    try {
      const data = await qrFetch(tableId, token, {
        action: "start",
        customerCount: guestCount,
      });
      setOrder(data.order);
      const menu: Category[] = await qrFetch(tableId, token, { action: "menu" });
      const visible = visibleQrCategories(menu);
      setCategories(visible);
      if (visible[0]) setActiveCategory(visible[0].id);
      setError("");
      setRefreshError("");
      setScreen("menu");
    } catch (e) {
      setRefreshError(errMsg(e, "menuOpenFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function openProduct(product: Product) {
    if (product.soldOut) return;
    setModalProduct(product);
    setModalQty(1);
    setSelectedModifiers(new Set());
    setModifierGroups([]);
    setPickerGroup(null);
    const modifierCategoryId = product.categoryId || activeCategory;
    const useModifiers = product.hasModifiers !== false && Boolean(modifierCategoryId);
    if (!useModifiers) return;
    setModifiersLoading(true);
    try {
      const groups = await qrFetch(tableId, token, {
        action: "menu",
        categoryId: modifierCategoryId,
        modifiers: true,
        productName: product.name,
      });
      const nextGroups: ModifierGroup[] = Array.isArray(groups) ? groups : [];
      setModifierGroups(nextGroups);
      const defaults = new Set<string>();
      const flavorGroup = nextGroups.find((g) => g.replacesMain);
      if (flavorGroup) {
        const current =
          flavorGroup.items.find((item) => item.id === product.id) ?? flavorGroup.items[0];
        if (current) defaults.add(current.id);
      }
      for (const group of nextGroups) {
        const included = group.items.find((item) => item.included);
        if (included) defaults.add(included.id);
      }
      setSelectedModifiers(defaults);
    } catch (e) {
      setModifierGroups([]);
      showToast(errMsg(e, "optionsLoadFailed"));
    } finally {
      setModifiersLoading(false);
    }
  }

  function closeModal() {
    setModalProduct(null);
    setPickerGroup(null);
  }

  function pickModifier(group: ModifierGroup, item: Product) {
    setSelectedModifiers((prev) => {
      const next = new Set(prev);
      if (group.selection === "single") {
        for (const option of group.items) next.delete(option.id);
        next.add(item.id);
        return next;
      }
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
    if (group.selection === "single") setPickerGroup(null);
  }

  function addLinesToCart(lines: { id: string; name: string; price: number; quantity: number; note?: string }[]) {
    setCart((prev) => {
      let next = [...prev];
      for (const line of lines) {
        const key = `${line.id}:${line.note ?? ""}`;
        const idx = next.findIndex((i) => `${i.productId}:${i.note ?? ""}` === key);
        if (idx >= 0) {
          next = next.map((i, j) => (j === idx ? { ...i, quantity: i.quantity + line.quantity } : i));
        } else {
          next.push({
            productId: line.id,
            name: line.name,
            price: line.price,
            quantity: line.quantity,
            note: line.note,
          });
        }
      }
      return next;
    });
  }

  function addToCart() {
    if (!modalProduct) return;
    if (modifiersLoading) return;
    const flavorGroup = modifierGroups.find((g) => g.replacesMain);
    const flavor = flavorGroup?.items.find((item) => selectedModifiers.has(item.id));
    if (flavorGroup && !flavor) {
      showToast(t("pleaseChoose"));
      return;
    }
    const main = flavor
      ? { id: flavor.id, name: flavor.name, price: flavor.price }
      : { id: modalProduct.id, name: modalProduct.name, price: modalProduct.price };
    const mods: { id: string; name: string; price: number; bill?: boolean }[] = [];
    // イートイン／テイクアウトの味は注記のみ（本体IDと衝突させない）
    if (flavor) {
      const label = flavor.displayName ?? flavor.name;
      mods.push({
        id: `__flavor__:${label}`,
        name: label,
        price: 0,
        bill: false,
      });
    }
    for (const group of modifierGroups) {
      if (group.replacesMain) continue;
      for (const m of group.items) {
        if (!selectedModifiers.has(m.id)) continue;
        if (group.flavorChoice) {
          const label = m.displayName ?? m.name;
          mods.push({
            id: m.id === main.id ? `__flavor__:${label}` : m.id,
            name: label,
            price: 0,
            bill: false,
          });
          continue;
        }
        if (m.included) continue;
        mods.push({ id: m.id, name: m.displayName ?? m.name, price: m.price });
      }
    }
    const apiItems = buildOrderItemsWithModifiers({ id: main.id, quantity: modalQty }, mods);
    const billedMeta = new Map(
      mods.filter((m) => m.bill !== false).map((m) => [m.id, { name: m.name, price: m.price }] as const),
    );
    addLinesToCart(
      apiItems.map((item) => {
        if (item.productId === main.id) {
          return {
            id: main.id,
            name: main.name,
            price: main.price,
            quantity: item.quantity,
            note: item.note,
          };
        }
        const meta = billedMeta.get(item.productId);
        return {
          id: item.productId,
          name: meta?.name ?? main.name,
          price: meta?.price ?? 0,
          quantity: item.quantity,
          note: item.note,
        };
      }),
    );
    setModalProduct(null);
    setPickerGroup(null);
    showToast(t("addedToCart"));
  }

  function addToCartAndGo() {
    addToCart();
    setScreen("cart");
  }

  function setCartLineQty(productId: string, note: string | undefined, quantity: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          `${i.productId}:${i.note ?? ""}` === `${productId}:${note ?? ""}` ? { ...i, quantity } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  }

  async function submitOrder() {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const sent = await qrFetch(tableId, token, {
        action: "addAndSend",
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          note: i.note,
        })),
      });
      setOrder(sent);
      setCart([]);
      setScreen("ordered");
      showToast(t("orderReceived"));
    } catch (e) {
      showToast(errMsg(e, "orderFailed"));
    } finally {
      setLoading(false);
    }
  }

  const header = (
    <header className="sticky top-0 z-20 flex h-11 items-center gap-1 border-b border-[#e6e6e6] bg-white px-2">
      <h1 className="min-w-0 flex-1 truncate px-1 text-[16px] font-medium text-stone-900">{tn(storeName)}</h1>
      <select
        aria-label={t("language")}
        value={lang}
        onChange={(e) => changeLang(e.target.value as QrLang)}
        className="shrink-0 appearance-none rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[12px] text-stone-600"
      >
        {QR_LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.short}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          void refreshSession();
          setScreen("history");
        }}
        className="shrink-0 rounded-full px-3 py-1 text-[13px]"
        style={{ backgroundColor: QR_TEAL_SOFT, color: QR_TEAL }}
      >
        {t("orderHistory")}
      </button>
    </header>
  );

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white p-6">
        <div className="max-w-sm text-center">
          <p className="text-[17px] font-medium text-stone-800">{tn(storeName)}</p>
          <p className="mt-4 text-[15px] text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (booting) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8e8e8] border-t-[#888]" />
        <p className="mt-4 text-[14px] text-stone-400">{t("loadingMenu")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col bg-white pb-[env(safe-area-inset-bottom)] text-stone-900">
      {header}

      {refreshError && !error && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          {refreshError}
          <button type="button" onClick={() => void refreshSession()} className="ml-2 underline">
            {t("retry")}
          </button>
        </div>
      )}

      {screen === "welcome" && (
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <p className="mb-2 text-[22px] font-semibold text-stone-800">{tn(storeName) || t("welcomeThanks")}</p>
          <div className="mb-6 w-full max-w-xs">
            <button
              type="button"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>🌐</span>
                {QR_LANGS.find((l) => l.code === lang)?.label ?? "日本語"}
              </span>
              <span className={`text-[12px] text-stone-400 transition-transform ${langOpen ? "rotate-180" : ""}`}>▼</span>
            </button>
            {langOpen && (
              <div className="mt-2 overflow-hidden rounded-lg border border-stone-200 bg-white">
                {QR_LANGS.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => pickLang(l.code)}
                    className={`flex w-full items-center justify-between border-b border-stone-100 px-4 py-3.5 text-left text-[16px] last:border-b-0 ${
                      lang === l.code ? "bg-stone-50 font-medium text-stone-900" : "text-stone-700"
                    }`}
                  >
                    {l.label}
                    {lang === l.code && <span className="text-stone-900">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mb-6 text-center text-[14px] text-stone-500">{t("choosePeople")}</p>
          <div className="mb-8 flex items-center gap-4">
            <button
              type="button"
              aria-label={t("decreasePeople")}
              disabled={guestCount <= 1}
              onClick={() => setGuestCount((n) => Math.max(1, n - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 text-[22px] text-stone-700 disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[4.5rem] text-center text-[28px] font-semibold tabular-nums text-stone-900">
              {guestCount}
              <span className="ml-1 text-[16px] font-medium text-stone-500">{t("people")}</span>
            </span>
            <button
              type="button"
              aria-label={t("increasePeople")}
              disabled={guestCount >= 20}
              onClick={() => setGuestCount((n) => Math.min(20, n + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-stone-200 text-[22px] text-stone-700 disabled:opacity-40"
            >
              ＋
            </button>
          </div>
          {refreshError && (
            <p className="mb-4 max-w-xs text-center text-[13px] text-red-600">{refreshError}</p>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={() => void startOrder()}
            className="w-full max-w-xs rounded-md py-3.5 text-[16px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: QR_CTA }}
          >
            {loading ? t("preparing") : t("openMenu")}
          </button>
        </div>
      )}

      {screen === "menu" && (
        <div className="flex min-h-0 flex-1 bg-[#f7f7f7]">
          <nav className="w-[76px] shrink-0 overflow-y-auto border-r border-[#ececec] bg-white">
            {sidebarCategories.map((cat) => {
              const selected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex min-h-[58px] w-full items-center justify-center border-b border-[#eee] px-1 py-3 text-center text-[13px] leading-snug ${
                    selected ? "bg-[#f3f3f3] font-semibold text-stone-900" : "bg-white text-stone-600"
                  }`}
                >
                  {tn(qrCategoryLabel(cat.name))}
                </button>
              );
            })}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto bg-[#f7f7f7] pb-2">
            {activeCategoryName && (
              <p className="px-3 py-2 text-[13px] text-stone-600">■ {tn(qrCategoryLabel(activeCategoryName))}</p>
            )}
            {productsLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="mx-2 mb-2 flex rounded-md border border-[#ececec] bg-white p-2">
                  <div className="h-[78px] w-[78px] shrink-0 animate-pulse bg-[#ececec]" />
                  <div className="ml-3 flex flex-1 flex-col justify-between py-1">
                    <div className="h-4 w-40 animate-pulse rounded bg-[#ececec]" />
                    <div className="ml-auto h-4 w-24 animate-pulse rounded bg-[#ececec]" />
                  </div>
                </div>
              ))
            ) : products.length === 0 ? (
              <p className="py-14 text-center text-[14px] text-stone-400">{t("noProducts")}</p>
            ) : (
              products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={product.soldOut}
                  onClick={() => void openProduct(product)}
                  className="mx-2 mb-2 flex w-[calc(100%-16px)] items-stretch rounded-md border border-[#e8e8e8] bg-white text-left disabled:opacity-50"
                >
                  <ProductPhoto
                    src={product.imageUrl}
                    alt=""
                    className="m-2 h-[78px] w-[78px] shrink-0 rounded-sm"
                  />
                  <div className="flex min-h-[94px] min-w-0 flex-1 flex-col justify-between py-2 pr-3">
                    <p className="text-[15px] leading-snug text-stone-900">
                      {tn(product.name)}
                      {product.soldOut && (
                        <span className="ml-2 text-[11px] font-medium text-red-500">{t("soldOut")}</span>
                      )}
                      {(cartQtyByProduct.get(product.id) ?? 0) > 0 && (
                        <span className="ml-2 text-[11px] font-medium" style={{ color: QR_TEAL }}>
                          {t("inCartCount", { n: cartQtyByProduct.get(product.id) ?? 0 })}
                        </span>
                      )}
                    </p>
                    <p className="text-right text-[14px] tabular-nums text-stone-800">{yenTaxIn(product.price)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {screen === "cart" && (
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 text-[16px] font-medium text-stone-800">{t("yourOrder")}</h2>
          {cart.length === 0 ? (
            <p className="py-12 text-center text-stone-400">{t("cartEmpty")}</p>
          ) : (
            <div className="border-t border-[#eee]">
              {cart.map((item) => (
                <div key={`${item.productId}:${item.note ?? ""}`} className="border-b border-[#eee] py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] text-stone-900">{tn(item.name)}</p>
                      {formatOrderItemNote(item.note) && (
                        <p className="text-[12px] text-stone-500">{tn(formatOrderItemNote(item.note))}</p>
                      )}
                      <p className="mt-1 text-[13px] text-stone-500">{yenTaxIn(item.price)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <QtyStepper
                        value={item.quantity}
                        onChange={(n) => setCartLineQty(item.productId, item.note, n)}
                        labels={{ dec: t("decrease"), inc: t("increase") }}
                      />
                      <button
                        type="button"
                        onClick={() => setCartLineQty(item.productId, item.note, 0)}
                        className="text-[12px] text-stone-400"
                      >
                        {t("remove")}
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-right text-[14px] tabular-nums">{yenTaxIn(item.price * item.quantity)}</p>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-[15px]">{t("total")}</span>
                <span className="text-[16px] font-medium tabular-nums">{yenTaxIn(cartTotal)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {screen === "history" && (
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 text-[16px] font-medium text-stone-800">{t("orderHistory")}</h2>
          {displayOrderedItems.length === 0 && pendingItems.length === 0 ? (
            <p className="py-12 text-center text-stone-400">{t("noOrdersYet")}</p>
          ) : (
            <div className="border-t border-[#eee]">
              {displayOrderedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-[#eee] py-3">
                  <div>
                    <p className="text-[15px] text-stone-900">
                      {tn(item.displayName)}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                    </p>
                    <p className="text-[12px]" style={{ color: item.status === "SERVED" ? "#059669" : QR_CTA }}>
                      {qrStatusLabel(lang, item.status)}
                    </p>
                  </div>
                  <span className="text-[14px] tabular-nums text-stone-600">{yenTaxIn(item.lineTotal)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between py-3">
                <span className="text-[15px]">{t("orderTotal")}</span>
                <span className="text-[16px] font-medium tabular-nums">{yenTaxIn(orderedTotal)}</span>
              </div>
            </div>
          )}

          {orderedTotal > 0 && (
            <p className="mt-4 text-center text-[13px] text-stone-400">{t("askStaffForBill")}</p>
          )}
        </div>
      )}

      {screen === "ordered" && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-[32px] font-bold text-white">
            ✓
          </div>
          <p className="mt-4 text-[22px] font-semibold text-stone-800">{t("orderCompleteTitle")}</p>
          <p className="mt-3 max-w-xs text-[14px] leading-relaxed text-stone-500">{t("orderCompleteBody")}</p>
          {orderedTotal > 0 && (
            <p className="mt-4 text-[20px] font-medium tabular-nums" style={{ color: QR_CTA }}>
              {yenTaxIn(orderedTotal)}
            </p>
          )}
          <button
            type="button"
            onClick={() => setScreen("menu")}
            className="mt-8 w-full max-w-xs rounded-md py-3.5 text-[16px] font-semibold text-white"
            style={{ backgroundColor: QR_CTA }}
          >
            {t("orderMore")}
          </button>
          <button
            type="button"
            onClick={() => {
              void refreshSession();
              setScreen("history");
            }}
            className="mt-3 w-full max-w-xs rounded-md border border-stone-300 bg-white py-3 text-[15px] text-stone-700"
          >
            {t("viewOrderHistory")}
          </button>
          <p className="mt-6 text-[13px] text-stone-400">{t("askStaffForBill")}</p>
        </div>
      )}

      {screen === "pay" && paymentSession && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-[17px] font-medium text-stone-800">{t("payment")}</p>
          <p className="mt-2 text-[32px] font-medium" style={{ color: QR_CTA }}>{formatYen(paymentSession.amount)}</p>
          <p className="mt-4 text-[14px] text-stone-500">{t("payOnPaymentScreen")}</p>
          {paymentSession.paymentUrl && (
            <a
              href={paymentSession.paymentUrl}
              className="mt-6 w-full max-w-xs rounded-md py-3.5 text-[15px] font-semibold text-white"
              style={{ backgroundColor: QR_CTA }}
            >
              {t("openPaymentScreen")}
            </a>
          )}
          <button
            type="button"
            onClick={() => void refreshSession({ syncPayment: true })}
            className="mt-4 text-[14px] text-stone-500 underline"
          >
            {t("refreshPaymentStatus")}
          </button>
        </div>
      )}

      {screen === "paid" && (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-[32px] font-bold text-white">
            ✓
          </div>
          <p className="mt-4 text-[20px] font-medium text-stone-800">{t("paymentDone")}</p>
          {paymentSession && (
            <p className="mt-2 text-[24px] font-medium" style={{ color: QR_CTA }}>
              {formatYen(paymentSession.amount)}
            </p>
          )}
          <p className="mt-4 text-[14px] text-stone-500">{t("thankYou")}</p>
        </div>
      )}

      {screen === "menu" && (
        <div className="sticky bottom-0 z-20 border-t border-[#e8e8e8] bg-white px-3 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-stone-700">
              <p>{t("qtyLabel", { n: cartCount })}</p>
              <p>{t("total")} {yenTaxIn(cartTotal)}</p>
              {orderedTotal > 0 && cartCount === 0 && (
                <p className="text-[12px] text-stone-400">{t("alreadyOrdered", { amount: yenTaxIn(orderedTotal) })}</p>
              )}
            </div>
            <button
              type="button"
              disabled={cartCount === 0}
              onClick={() => setScreen("cart")}
              className="h-11 min-w-[128px] rounded-md px-4 text-[15px] font-semibold text-white disabled:bg-[#cfcfcf]"
              style={cartCount > 0 ? { backgroundColor: QR_CTA } : undefined}
            >
              {t("proceedToOrder")}
            </button>
          </div>
        </div>
      )}

      {(screen === "history" || screen === "cart") && (
        <div className="border-t border-[#e8e8e8] bg-white px-3 py-2.5">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setScreen("menu")}
              className="flex-1 rounded-md border border-stone-300 py-3 text-[15px] text-stone-700"
            >
              {t("backToMenu")}
            </button>
            {screen === "cart" && (
              <button
                type="button"
                disabled={cart.length === 0 || loading}
                onClick={() => void submitOrder()}
                className="flex-[1.4] rounded-md py-3 text-[15px] font-semibold text-white disabled:bg-[#cfcfcf]"
                style={cart.length > 0 ? { backgroundColor: QR_CTA } : undefined}
              >
                {loading ? t("sending") : t("placeOrder")}
              </button>
            )}
          </div>
        </div>
      )}

      {modalProduct && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/45">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
            <div
              className="relative w-full max-w-[360px] overflow-hidden rounded-2xl bg-white"
              role="dialog"
              aria-modal="true"
              aria-label={tn(modalProduct.name)}
            >
              <ProductPhoto src={modalProduct.imageUrl} alt="" className="h-[210px] w-full" />
              <div className="px-4 pb-4 pt-3">
                <p className="text-[17px] font-bold leading-snug">{tn(modalProduct.name)}</p>
                {modifiersLoading ? (
                  <p className="py-6 text-center text-[13px] text-stone-400">{t("loading")}</p>
                ) : (
                  modifierGroups.map((group) => (
                    <div
                      key={group.name}
                      className="mt-3 flex items-start border-b border-dotted border-[#ccc] py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] text-stone-500">{tn(groupRowLabel(group))}</p>
                        <p className="mt-0.5 text-[14px] text-stone-800">{groupChoiceLabel(group)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerGroup(group)}
                        className="mt-0.5 shrink-0 rounded-md border px-3 py-1 text-[13px]"
                        style={{ color: QR_TEAL, borderColor: QR_TEAL }}
                      >
                        {t("change")}
                      </button>
                    </div>
                  ))
                )}
                <div className="mt-3 flex items-center justify-between border-b border-dotted border-[#ccc] py-2.5">
                  <p className="text-[13px] text-stone-500">{t("qty")}</p>
                  <QtyStepper value={modalQty} onChange={setModalQty} labels={{ dec: t("decrease"), inc: t("increase") }} />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-[15px] font-medium tabular-nums">
                    {yenTaxIn(modalUnitPrice * modalQty)}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={addToCart}
                    disabled={modifiersLoading}
                    className="flex-1 rounded-lg border py-2.5 text-[14px] font-medium disabled:opacity-40"
                    style={{ color: QR_TEAL, borderColor: QR_TEAL }}
                  >
                    {t("addToCart")}
                  </button>
                  <button
                    type="button"
                    onClick={addToCartAndGo}
                    disabled={modifiersLoading}
                    className="flex-1 rounded-lg py-2.5 text-[14px] font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: QR_CTA }}
                  >
                    {t("proceedToOrder")}
                  </button>
                </div>
              </div>
              {pickerGroup && (
                <div className="absolute inset-0 z-10 flex flex-col bg-black/35">
                  <div className="mt-auto max-h-[70%] overflow-y-auto rounded-t-2xl bg-white">
                    <p className="border-b border-[#eee] px-4 py-3 text-[15px] font-medium">
                      {tn(groupRowLabel(pickerGroup))}
                    </p>
                    {pickerGroup.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={item.soldOut}
                        onClick={() => pickModifier(pickerGroup, item)}
                        className={`flex w-full items-center justify-between border-b border-[#f0f0f0] px-4 py-3 text-left disabled:opacity-40 ${
                          selectedModifiers.has(item.id) ? "bg-[#f3fbfb]" : "bg-white"
                        }`}
                      >
                        <span className="text-[15px]">
                          {tn(item.displayName ?? item.name)}
                          {item.soldOut && <span className="ml-2 text-[11px] text-red-500">{t("soldOut")}</span>}
                        </span>
                        <span className="text-[13px] tabular-nums text-stone-500">
                          {pickerGroup.replacesMain
                            ? yenTaxIn(item.price)
                            : item.price === 0
                              ? ""
                              : `${item.price > 0 ? "+" : "−"}${qrPrice(lang, Math.abs(item.price))}`}
                        </span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPickerGroup(null)}
                      className="w-full py-3 text-[14px] text-stone-600"
                    >
                      {t("close")}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="mt-5 text-[16px] text-white"
            >
              {t("closeX")}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-[400px] rounded-lg bg-stone-900/90 px-4 py-3 text-center text-[14px] text-white">{toast}</div>
      )}
    </div>
  );
}
