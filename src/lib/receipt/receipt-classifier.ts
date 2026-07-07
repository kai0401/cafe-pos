import { ExpenseCategory } from "@prisma/client";
import { parseYen } from "@/lib/money";

export type ReceiptClassification = {
  amount: number | null;
  expenseDate: string | null;
  merchantName: string | null;
  category: ExpenseCategory;
  confidence: number;
  matchedKeywords: string[];
  warnings?: string[];
};

const CATEGORY_PRIORITY: ExpenseCategory[] = [
  "RENT",
  "UTILITIES",
  "LABOR",
  "INSURANCE",
  "INGREDIENTS",
  "SUPPLIES",
  "MARKETING",
  "EQUIPMENT",
  "OTHER",
];

/** 店舗名からカテゴリを推定 */
const MERCHANT_CATEGORY: { pattern: RegExp; category: ExpenseCategory }[] = [
  { pattern: /業務スーパー|コストコ|イオン|西友|ライフ|マルエツ|オーケー|成城石井|紀ノ国屋/i, category: "INGREDIENTS" },
  { pattern: /ダイソー|セリア|キャンドゥ|ナフコ|カインズ|ニトリ|IKEA/i, category: "SUPPLIES" },
  { pattern: /東京電力|東電|TEPCO|大阪ガス|東京ガス|関西電力|中部電力/i, category: "UTILITIES" },
  { pattern: /Amazon|アマゾン|ヨドバシ|ビックカメラ/i, category: "SUPPLIES" },
  { pattern: /出前館|Uber|ウーバー|menu/i, category: "INGREDIENTS" },
];

/** カテゴリ別キーワード（日本のレシート・請求書向け） */
const CATEGORY_KEYWORDS: { category: ExpenseCategory; keywords: string[]; weight: number }[] = [
  { category: "RENT", keywords: ["家賃", "賃料", "地代", "共益費", "管理費", "賃貸"], weight: 3 },
  { category: "UTILITIES", keywords: ["電気料金", "電気代", "ガス料金", "ガス代", "水道料", "水道代", "東京電力", "東電", "TEPCO", "大阪ガス", "東京ガス", "光熱"], weight: 3 },
  { category: "INGREDIENTS", keywords: ["仕入", "食材", "青果", "問屋", "卸", "業務用", "食品", "小豆", "牛乳", "小麦粉", "業務スーパー", "コストコ", "スーパー"], weight: 2 },
  { category: "LABOR", keywords: ["給与", "賃金", "人件", "給料", "アルバイト", "日雇", "源泉"], weight: 3 },
  { category: "SUPPLIES", keywords: ["洗剤", "消耗品", "コピー", "文房具", "雑貨", "100均", "ダイソー", "セリア", "ラップ", "割り箸", "ナフコ", "カインズ", "ティッシュ"], weight: 2 },
  { category: "MARKETING", keywords: ["広告", "宣伝", "チラシ", "看板", "印刷物"], weight: 2 },
  { category: "EQUIPMENT", keywords: ["修理", "設備", "工事", "メンテナンス", "交換", "機器", "エスプレッソ", "レジ"], weight: 2 },
  { category: "INSURANCE", keywords: ["保険", "社会保険", "労働保険", "印紙"], weight: 3 },
];

const SKIP_AMOUNT_LINE = /小計|値引|割引|ポイント|お釣|釣銭|預り|預かり|消費税|税額|対象額|還元/i;
const TOTAL_LINE = /税込合計|税込み合計|合計|お支払|支払金額|ご請求|請求金額|領収金額|総額|現計|クレジット/i;

function normalizeReceiptText(text: string): string {
  return text.normalize("NFKC");
}

function parseAmountToken(raw: string): number | null {
  const n = parseYen(raw);
  return n > 0 && n < 10_000_000 ? n : null;
}

function amountCandidatesFromLine(line: string): number[] {
  if (/tel|電話|登録番号|会員番号|伝票|レシート|領収書No|No\./i.test(line)) return [];

  const candidates: number[] = [];
  const re = /[¥￥]?\s*((?:\d{1,3}(?:,\d{3})+)|(?:\d{2,7}))(?:\s*円)?/g;
  for (const match of line.matchAll(re)) {
    const raw = match[1];
    if (!raw) continue;
    const start = match.index ?? 0;
    const before = line.slice(Math.max(0, start - 2), start);
    const after = line.slice(start + match[0].length, start + match[0].length + 2);
    if (/%|割/.test(after) || /年|\/|-|\./.test(before + after)) continue;
    const amount = parseAmountToken(raw);
    if (amount) candidates.push(amount);
  }
  return candidates;
}

function bestAmountOnTotalLine(line: string): number | null {
  const totalMatch = line.match(TOTAL_LINE);
  if (!totalMatch || totalMatch.index === undefined) return null;

  const afterTotal = line
    .slice(totalMatch.index)
    .split(/預り|預かり|お釣|釣銭/i)[0]!;
  const afterCandidates = amountCandidatesFromLine(afterTotal);
  if (afterCandidates.length > 0) return Math.max(...afterCandidates);

  const allCandidates = amountCandidatesFromLine(line);
  return allCandidates.length > 0 ? Math.max(...allCandidates) : null;
}

/** OCRテキストから金額を抽出 */
export function extractAmount(text: string): number | null {
  const normalized = normalizeReceiptText(text);
  const lines = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const scored: { amount: number; score: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (TOTAL_LINE.test(line)) {
      const amount = bestAmountOnTotalLine(line);
      if (amount) scored.push({ amount, score: 100 - i });
      continue;
    }

    if (SKIP_AMOUNT_LINE.test(line)) continue;

    const explicitYen = /[¥￥]|\d\s*円/.test(line);
    if (explicitYen) {
      for (const amount of amountCandidatesFromLine(line)) {
        scored.push({ amount, score: 40 - i });
      }
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score || b.amount - a.amount);
  return scored[0]!.amount;
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** OCRテキストから日付を抽出 */
export function extractDate(text: string): string | null {
  const normalized = normalizeReceiptText(text);
  const lines = normalized.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const candidates: { date: string; score: number }[] = [];

  const patterns = [
    { re: /(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})/, base: 50 },
    { re: /(\d{2})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})/, base: 45 },
    { re: /(\d{4})\/(\d{2})\/(\d{2})/, base: 40 },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/有効|期限|会員番号/i.test(line)) continue;

    for (const { re, base } of patterns) {
      const m = line.match(re);
      if (!m) continue;
      let y = parseInt(m[1]!, 10);
      const mo = parseInt(m[2]!, 10);
      const d = parseInt(m[3]!, 10);
      if (y < 100) y += 2000;
      const date = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (!isValidDateString(date)) continue;
      let score = base - i;
      if (/日付|ご利用|取引|発行/i.test(line)) score += 20;
      candidates.push({ date, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]!.date;
}

/** 店名・支払先を推定 */
export function extractMerchant(text: string): string | null {
  const lines = normalizeReceiptText(text)
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && l.length <= 48);

  const scored: { line: string; score: number }[] = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i]!;
    if (/^\d+$/.test(line)) continue;
    if (/合計|小計|税|レシート|領収|ありがとう|〒|TEL|電話|登録番号|インボイス/i.test(line)) continue;
    if (/^\d{3}-?\d{4}$/.test(line)) continue;
    if (/様$/.test(line)) continue;
    if (!/[ぁ-んァ-ン一-龥a-zA-Z]/.test(line)) continue;

    let score = 30 - i + line.length;
    if (/店|株式会社|有限|カフェ|喫茶|スーパー|市場/i.test(line)) score += 10;
    if (/\d{2,}/.test(line)) score -= 5;
    scored.push({ line, score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.line;
}

function categoryFromMerchant(merchant: string | null): ExpenseCategory | null {
  if (!merchant) return null;
  for (const rule of MERCHANT_CATEGORY) {
    if (rule.pattern.test(merchant)) return rule.category;
  }
  return null;
}

/** キーワードスコアで経費カテゴリを分類 */
export function classifyReceipt(ocrText: string, merchantHint?: string | null): ReceiptClassification {
  const normalized = normalizeReceiptText(ocrText);
  const haystack = `${merchantHint ?? ""}\n${normalized}`.toLowerCase();
  const scores = new Map<ExpenseCategory, { score: number; keywords: string[] }>();

  for (const rule of CATEGORY_KEYWORDS) {
    const matched: string[] = [];
    let score = 0;
    for (const kw of rule.keywords) {
      if (haystack.includes(kw.toLowerCase())) {
        matched.push(kw);
        score += rule.weight;
      }
    }
    if (score > 0) scores.set(rule.category, { score, keywords: matched });
  }

  const merchantCategory = categoryFromMerchant(merchantHint ?? extractMerchant(normalized));
  if (merchantCategory) {
    const prev = scores.get(merchantCategory);
    scores.set(merchantCategory, {
      score: (prev?.score ?? 0) + 5,
      keywords: [...(prev?.keywords ?? []), "店舗名"],
    });
  }

  let best: ExpenseCategory = "OTHER";
  let bestScore = 0;
  let matchedKeywords: string[] = [];

  const ranked = [...scores.entries()].sort((a, b) => {
    if (b[1].score !== a[1].score) return b[1].score - a[1].score;
    return CATEGORY_PRIORITY.indexOf(a[0]) - CATEGORY_PRIORITY.indexOf(b[0]);
  });

  if (ranked[0]) {
    best = ranked[0][0];
    bestScore = ranked[0][1].score;
    matchedKeywords = ranked[0][1].keywords;
  }

  const amount = extractAmount(normalized);
  const expenseDate = extractDate(normalized);
  const merchantName = merchantHint ?? extractMerchant(normalized);

  let confidence = 0.3;
  if (bestScore > 0) confidence += Math.min(0.5, bestScore * 0.1);
  if (amount) confidence += 0.15;
  if (merchantName) confidence += 0.05;
  if (expenseDate) confidence += 0.05;
  confidence = Math.min(0.95, confidence);

  return {
    amount,
    expenseDate,
    merchantName,
    category: best,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords,
  };
}

/** Vision結果とルールベース結果を突合 */
export function mergeClassifications(
  vision: ReceiptClassification,
  ocrText: string,
): ReceiptClassification {
  const regex = classifyReceipt(ocrText, vision.merchantName);
  const warnings: string[] = [];
  let confidence = vision.confidence;
  let amount = vision.amount;
  let expenseDate = vision.expenseDate;
  let category = vision.category;
  const merchantName = vision.merchantName ?? regex.merchantName;

  if (regex.amount) {
    if (!amount) {
      amount = regex.amount;
      warnings.push("金額をOCRから補完しました");
    } else {
      const diff = Math.abs(regex.amount - amount) / Math.max(regex.amount, amount);
      if (diff > 0.1) {
        amount = regex.amount;
        confidence -= 0.2;
        warnings.push("金額をテキスト照合で修正しました");
      }
    }
  } else if (!amount) {
    confidence -= 0.15;
    warnings.push("金額を読み取れませんでした");
  }

  if (!expenseDate || !isValidDateString(expenseDate)) {
    expenseDate = regex.expenseDate;
    if (expenseDate) warnings.push("日付をOCRから補完しました");
  }

  if (category === "OTHER" && regex.category !== "OTHER" && regex.matchedKeywords.length > 0) {
    category = regex.category;
    confidence = Math.max(confidence - 0.05, regex.confidence);
  } else if (regex.matchedKeywords.length > 0 && regex.category !== category) {
    const regexScore = regex.matchedKeywords.length;
    const visionScore = vision.matchedKeywords.length;
    if (regexScore > visionScore) {
      category = regex.category;
      warnings.push("カテゴリをキーワード照合で調整しました");
    }
  }

  const matchedKeywords = [...new Set([...vision.matchedKeywords, ...regex.matchedKeywords])];

  confidence = Math.max(0.2, Math.min(0.98, Math.round(confidence * 100) / 100));

  return {
    amount,
    expenseDate,
    merchantName,
    category,
    confidence,
    matchedKeywords,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
