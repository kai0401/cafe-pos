/**
 * お客様QRオーダー画面の多言語対応（日本語 / English / 中文）
 * - UI 文言は辞書
 * - 商品名・カテゴリ・トッピングは「完全一致 → 部分一致（長い語から）」で翻訳
 *   （商品データ自体は日本語のまま。注文・伝票は日本語で流れる）
 */
export type QrLang = "ja" | "en" | "zh";

export const QR_LANGS: { code: QrLang; label: string; short: string }[] = [
  { code: "ja", label: "日本語", short: "日本語" },
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "中文" },
];

export const QR_LANG_STORAGE_KEY = "qr-lang";

export function isQrLang(v: unknown): v is QrLang {
  return v === "ja" || v === "en" || v === "zh";
}

/** ブラウザ言語からの初期値 */
/** お客様向けQR画面に表示する店名（日本語）。他言語は NAME_DICT で訳す */
export const QR_STORE_TITLE = "甘味喫茶　あづま家";

export function detectQrLang(): QrLang {
  if (typeof navigator === "undefined") return "ja";
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const low = (l ?? "").toLowerCase();
    if (low.startsWith("ja")) return "ja";
    if (low.startsWith("zh")) return "zh";
    if (low.startsWith("en")) return "en";
  }
  return "ja";
}

/* ------------------------------------------------------------------ */
/* UI 文言                                                              */
/* ------------------------------------------------------------------ */

const UI = {
  ja: {
    orderHistory: "注文履歴",
    loadingMenu: "メニューを読み込んでいます…",
    retry: "再試行",
    welcomeThanks: "ご来店ありがとうございます",
    choosePeople: "人数を選んでメニューを開いてください",
    people: "名",
    decreasePeople: "人数を減らす",
    increasePeople: "人数を増やす",
    preparing: "準備中…",
    openMenu: "メニューを開く",
    noProducts: "このカテゴリに商品がありません",
    soldOut: "売り切れ",
    inCartCount: "{n}点",
    yourOrder: "ご注文内容",
    cartEmpty: "カートは空です",
    remove: "削除",
    total: "合計金額",
    noOrdersYet: "まだ注文はありません",
    orderTotal: "ご注文合計",
    payByCard: "カードでお支払い（{amount}）",
    payAfterServed: "調理完了後にこの画面からお支払いできます",
    askStaffForBill: "お会計はスタッフにお声がけください",
    payment: "お支払い",
    payOnPaymentScreen: "決済画面でお支払いください",
    openPaymentScreen: "決済画面を開く",
    refreshPaymentStatus: "支払い状況を更新",
    paymentDone: "お支払い完了",
    thankYou: "ご利用ありがとうございました",
    qty: "数量",
    qtyLabel: "数量 {n}",
    alreadyOrdered: "ご注文済み {amount}",
    proceedToOrder: "注文に進む",
    backToMenu: "メニューへ",
    sending: "送信中…",
    placeOrder: "注文する",
    loading: "読み込み中…",
    change: "変更",
    addToCart: "＋ カートに追加",
    close: "閉じる",
    closeX: "× 閉じる",
    pleaseChoose: "お選びください",
    decrease: "減らす",
    increase: "増やす",
    addedToCart: "カートに追加しました",
    orderReceived: "ご注文を承りました",
    orderCompleteTitle: "注文完了",
    orderCompleteBody: "ご注文を受け付けました。追加のご注文もこちらからできます。",
    orderMore: "追加で注文する",
    viewOrderHistory: "注文内容を見る",
    orderFailed: "注文に失敗しました",
    paymentStartFailed: "決済を開始できません",
    optionsLoadFailed: "オプションを読み込めませんでした",
    menuLoadFailed: "メニューの取得に失敗しました",
    menuOpenFailed: "メニューを開けませんでした。もう一度お試しください",
    menuShowFailed: "メニューを表示できません。もう一度お試しください",
    invalidQr: "QRコードが無効です。スタッフをお呼びください",
    genericError: "エラーが発生しました",
    language: "言語",
    taxIncluded: "（税込）",
    chooseLanguage: "言語を選んでください",
    status_PENDING: "送信待ち",
    status_SENT: "受付しました",
    status_COOKING: "お作りしています",
    status_DONE: "まもなくお持ちします",
    status_SERVED: "提供済み",
  },
  en: {
    orderHistory: "My Orders",
    loadingMenu: "Loading menu…",
    retry: "Retry",
    welcomeThanks: "Welcome",
    choosePeople: "Select your party size to open the menu",
    people: "guests",
    decreasePeople: "Fewer guests",
    increasePeople: "More guests",
    preparing: "Preparing…",
    openMenu: "Open Menu",
    noProducts: "No items in this category",
    soldOut: "Sold out",
    inCartCount: "{n} in cart",
    yourOrder: "Your Order",
    cartEmpty: "Your cart is empty",
    remove: "Remove",
    total: "Total",
    noOrdersYet: "No orders yet",
    orderTotal: "Order Total",
    payByCard: "Pay by card ({amount})",
    payAfterServed: "You can pay from this screen once everything has been served",
    askStaffForBill: "Please ask a staff member when you're ready to pay",
    payment: "Payment",
    payOnPaymentScreen: "Please complete payment on the payment screen",
    openPaymentScreen: "Open payment screen",
    refreshPaymentStatus: "Refresh payment status",
    paymentDone: "Payment complete",
    thankYou: "Thank you for visiting!",
    qty: "Quantity",
    qtyLabel: "Items: {n}",
    alreadyOrdered: "Already ordered: {amount}",
    proceedToOrder: "Review Order",
    backToMenu: "Back to Menu",
    sending: "Sending…",
    placeOrder: "Place Order",
    loading: "Loading…",
    change: "Change",
    addToCart: "＋ Add to Cart",
    close: "Close",
    closeX: "× Close",
    pleaseChoose: "Please select",
    decrease: "Decrease",
    increase: "Increase",
    addedToCart: "Added to cart",
    orderReceived: "Your order has been received",
    orderCompleteTitle: "Order complete",
    orderCompleteBody: "We've received your order. You can add more items from here.",
    orderMore: "Order more",
    viewOrderHistory: "View my order",
    orderFailed: "Failed to place order",
    paymentStartFailed: "Could not start payment",
    optionsLoadFailed: "Could not load options",
    menuLoadFailed: "Could not load the menu",
    menuOpenFailed: "Could not open the menu. Please try again",
    menuShowFailed: "Could not display the menu. Please try again",
    invalidQr: "This QR code is invalid. Please call a staff member",
    genericError: "Something went wrong",
    language: "Language",
    taxIncluded: " (tax incl.)",
    chooseLanguage: "Please select your language",
    status_PENDING: "Not sent yet",
    status_SENT: "Order received",
    status_COOKING: "Being prepared",
    status_DONE: "Coming right up",
    status_SERVED: "Served",
  },
  zh: {
    orderHistory: "订单记录",
    loadingMenu: "正在加载菜单…",
    retry: "重试",
    welcomeThanks: "欢迎光临",
    choosePeople: "请选择用餐人数后打开菜单",
    people: "位",
    decreasePeople: "减少人数",
    increasePeople: "增加人数",
    preparing: "准备中…",
    openMenu: "打开菜单",
    noProducts: "此分类暂无商品",
    soldOut: "已售完",
    inCartCount: "已选{n}份",
    yourOrder: "订单内容",
    cartEmpty: "购物车是空的",
    remove: "删除",
    total: "合计金额",
    noOrdersYet: "还没有订单",
    orderTotal: "订单合计",
    payByCard: "刷卡支付（{amount}）",
    payAfterServed: "全部上齐后可在此页面支付",
    askStaffForBill: "结账请呼叫店员",
    payment: "支付",
    payOnPaymentScreen: "请在支付页面完成付款",
    openPaymentScreen: "打开支付页面",
    refreshPaymentStatus: "刷新支付状态",
    paymentDone: "支付完成",
    thankYou: "感谢您的光临",
    qty: "数量",
    qtyLabel: "数量 {n}",
    alreadyOrdered: "已下单 {amount}",
    proceedToOrder: "去下单",
    backToMenu: "返回菜单",
    sending: "发送中…",
    placeOrder: "确认下单",
    loading: "加载中…",
    change: "更改",
    addToCart: "＋ 加入购物车",
    close: "关闭",
    closeX: "× 关闭",
    pleaseChoose: "请选择",
    decrease: "减少",
    increase: "增加",
    addedToCart: "已加入购物车",
    orderReceived: "已收到您的订单",
    orderCompleteTitle: "下单完成",
    orderCompleteBody: "已收到您的订单。如需追加，可继续点餐。",
    orderMore: "继续点餐",
    viewOrderHistory: "查看订单",
    orderFailed: "下单失败",
    paymentStartFailed: "无法开始支付",
    optionsLoadFailed: "无法加载选项",
    menuLoadFailed: "无法获取菜单",
    menuOpenFailed: "无法打开菜单，请重试",
    menuShowFailed: "无法显示菜单，请重试",
    invalidQr: "二维码无效，请呼叫店员",
    genericError: "发生错误",
    language: "语言",
    taxIncluded: "（含税）",
    chooseLanguage: "请选择语言",
    status_PENDING: "待发送",
    status_SENT: "已接单",
    status_COOKING: "正在制作",
    status_DONE: "即将送达",
    status_SERVED: "已上桌",
  },
} as const;

export type QrUiKey = keyof (typeof UI)["ja"];

export function qrT(lang: QrLang, key: QrUiKey, vars?: Record<string, string | number>): string {
  let s: string = UI[lang][key] ?? UI.ja[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  }
  return s;
}

/** 金額表記 */
export function qrPrice(lang: QrLang, amount: number): string {
  const n = Math.abs(amount).toLocaleString("ja-JP");
  const sign = amount < 0 ? "−" : "";
  if (lang === "ja") return `${sign}${n}円`;
  return `${sign}¥${n}`;
}

export function qrPriceTaxIn(lang: QrLang, amount: number): string {
  return `${qrPrice(lang, amount)}${qrT(lang, "taxIncluded")}`;
}

/* ------------------------------------------------------------------ */
/* 商品名・カテゴリ・トッピング                                         */
/* ------------------------------------------------------------------ */

/** [日本語, English, 中文] — 完全一致優先、次に長い語から部分置換 */
const NAME_DICT: [string, string, string][] = [
  // 店名
  ["甘味喫茶　あづま家", "Azumaya – Japanese Sweets Café", "和风甜品店 Azumaya（あづま家）"],
  ["あづま家", "Azumaya", "Azumaya（あづま家）"],

  // カテゴリ（表示ラベル）
  ["甘味", "Sweets", "甜品"],
  ["軽食", "Light Meals", "轻食"],
  ["お飲み物", "Drinks", "饮品"],
  ["ドリンク", "Drinks", "饮品"],
  ["氷", "Shaved Ice", "刨冰"],
  ["テイクアウト", "Takeout", "外带"],
  ["シロップ", "Syrup", "糖浆"],
  ["トッピング", "Toppings", "配料"],
  ["オプション", "Options", "选项"],
  ["容器", "Cup / Cone", "容器"],
  ["味", "Flavor", "口味"],

  // あんみつ・甘味
  ["特選抹茶ソフト白玉あんみつ", "Premium Matcha Soft Serve Anmitsu with Shiratama", "特选抹茶霜淇淋白玉蜜豆"],
  ["ソフトクリーム白玉ぜんざい", "Zenzai with Soft Serve & Shiratama (warm sweet red bean soup)", "霜淇淋白玉善哉（红豆汤）"],
  ["ソフトクリームあんみつ", "Soft Serve Anmitsu", "霜淇淋蜜豆"],
  ["クリームあんみつ", "Cream Anmitsu (with ice cream)", "冰淇淋蜜豆"],
  ["白玉あんみつ", "Shiratama Anmitsu (with rice dumplings)", "白玉蜜豆（糯米团子）"],
  ["杏あんみつ", "Apricot Anmitsu", "杏子蜜豆"],
  ["宇治あんみつ", "Uji Matcha Anmitsu", "宇治抹茶蜜豆"],
  ["白玉しるこ", "Shiratama Shiruko (sweet red bean soup with rice dumplings)", "白玉红豆汤"],
  ["あんみつ", "Anmitsu (agar jelly & sweet red bean with syrup)", "蜜豆（寒天红豆甜品）"],
  ["まめかん", "Mamekan (agar jelly & peas with brown sugar syrup)", "豆寒天（寒天豌豆・黑糖蜜）"],
  ["みつまめ", "Mitsumame (agar jelly, peas & fruit with syrup)", "蜜豆寒天（寒天豌豆水果）"],
  ["パフェ", "Parfait", "芭菲"],
  ["ぜんざい", "Zenzai (sweet red bean soup)", "善哉（红豆汤）"],
  ["しるこ", "Shiruko (sweet red bean soup)", "红豆汤"],

  // ソフトクリーム
  ["ミックスソフトクリーム", "Mixed Soft Serve (vanilla & matcha)", "混合霜淇淋（香草＆抹茶）"],
  ["抹茶ソフトクリーム", "Matcha Soft Serve", "抹茶霜淇淋"],
  ["ソフトクリーム（追加）", "Soft Serve (add)", "霜淇淋（加购）"],
  ["ソフトクリーム（味・有無）", "Soft Serve (flavor / none)", "霜淇淋（口味・是否需要）"],
  ["ソフトクリーム", "Soft Serve", "霜淇淋"],
  ["アイスクリーム", "Ice Cream", "冰淇淋"],
  ["抹茶ソフト", "Matcha Soft Serve", "抹茶霜淇淋"],
  ["ソフトに変更", "Change to soft serve", "换成霜淇淋"],
  ["ミックス", "Mixed", "混合"],
  ["バニラ", "Vanilla", "香草"],
  ["抹茶", "Matcha", "抹茶"],
  ["カップ", "Cup", "杯装"],
  ["コーン", "Cone", "甜筒"],

  // 氷
  ["氷抹茶ソフトクリーム宇治金時", "Uji Kintoki Shaved Ice (matcha syrup, red bean & matcha soft serve)", "宇治金时刨冰（抹茶・红豆・抹茶霜淇淋）"],
  ["氷ソフトクリームいちご", "Strawberry Shaved Ice with Soft Serve", "草莓刨冰配霜淇淋"],
  ["氷小倉白玉", "Shaved Ice with Sweet Red Bean & Shiratama", "小仓红豆白玉刨冰"],
  ["宇治金時", "Uji Kintoki (matcha & red bean)", "宇治金时（抹茶红豆）"],
  ["小倉", "Sweet red bean", "小仓红豆"],
  ["いちご", "Strawberry", "草莓"],

  // ドリンク
  ["アイスカフェオレ", "Iced Café au Lait", "冰咖啡欧蕾"],
  ["アイスコーヒー", "Iced Coffee", "冰咖啡"],
  ["オレンジジュース", "Orange Juice", "橙汁"],
  ["カフェオレ", "Café au Lait", "咖啡欧蕾"],
  ["クリームソーダ", "Cream Soda (melon soda with soft serve)", "冰淇淋苏打（哈密瓜汽水）"],
  ["コーヒーフロート", "Coffee Float (with soft serve)", "咖啡漂浮（加霜淇淋）"],
  ["コーラフロート", "Cola Float (with soft serve)", "可乐漂浮（加霜淇淋）"],
  ["ブレンドコーヒー", "Blend Coffee", "综合咖啡"],
  ["コーヒー", "Coffee", "咖啡"],
  ["コーラ", "Cola", "可乐"],
  ["紅茶", "Tea", "红茶"],

  // 軽食
  ["オムライス", "Omurice (omelette over ketchup rice)", "蛋包饭"],
  ["ナポリタン", "Napolitan (Japanese-style ketchup spaghetti)", "拿波里意面（番茄酱意面）"],
  ["トースト", "Toast", "吐司"],

  // トッピング・オプション
  ["あんこ無し", "No sweet red bean paste", "不要红豆馅"],
  ["あんず2個", "Apricot ×2", "杏子2个"],
  ["白玉3個", "Shiratama ×3 (rice dumplings)", "白玉3个（糯米团子）"],
  ["白玉", "Shiratama", "白玉"],
  ["あんず", "Apricot", "杏子"],
  ["あんこ", "Sweet red bean paste", "红豆馅"],
  ["練乳", "Condensed milk", "炼乳"],
  ["黒蜜", "Kuromitsu (brown sugar syrup)", "黑糖蜜"],
  ["無し", "None", "不要"],
  ["追加", "Add", "加购"],
  ["変更", "Change", "更改"],
  ["増し", "Extra", "加量"],
  ["個", "pcs", "个"],
];

const EXACT: Record<QrLang, Map<string, string>> = {
  ja: new Map(),
  en: new Map(NAME_DICT.map(([ja, en]) => [normalize(ja), en])),
  zh: new Map(NAME_DICT.map(([ja, , zh]) => [normalize(ja), zh])),
};
const PARTIAL = [...NAME_DICT].sort((a, b) => b[0].length - a[0].length);

function normalize(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "").replace(/[づヅ]/g, "ず").replace(/[－−]/g, "-");
}

function hasJapanese(s: string): boolean {
  return /[぀-ヿ一-鿿]/.test(s);
}

/** 商品名・カテゴリ・トッピング名などの翻訳 */
export function qrName(lang: QrLang, text: string | null | undefined): string {
  if (!text) return "";
  if (lang === "ja") return text;
  const raw = text.replace(/^[-－−]\s*/, "");
  const exact = EXACT[lang].get(normalize(raw));
  if (exact) return exact;

  // 「商品（トッピング・トッピング）」形式 → 中を分割して個別翻訳
  const m = raw.match(/^(.*?)[（(](.+)[）)]$/);
  if (m && hasJapanese(m[1])) {
    const inner = m[2]
      .split(/[・、,]/)
      .map((p) => qrName(lang, p.trim()))
      .join(lang === "en" ? ", " : "・");
    return `${qrName(lang, m[1])}${lang === "en" ? ` + ${inner}` : `＋${inner}`}`;
  }

  // 部分置換（長い語から）
  let out = normalize(raw);
  const idx = lang === "en" ? 1 : 2;
  for (const entry of PARTIAL) {
    const key = normalize(entry[0]);
    if (out.includes(key)) {
      out = out.split(key).join(lang === "en" ? ` ${entry[idx]} ` : entry[idx]);
    }
  }
  if (lang === "en") {
    out = out.replace(/\s+/g, " ").trim();
  }
  // 翻訳できず日本語のまま残る場合は原文を返す
  return hasJapanese(out) && out === normalize(raw) ? text : out;
}

export function qrStatusLabel(lang: QrLang, status: string): string {
  const key = `status_${status}` as QrUiKey;
  return (UI[lang] as Record<string, string>)[key] ?? (UI.ja as Record<string, string>)[key] ?? status;
}
