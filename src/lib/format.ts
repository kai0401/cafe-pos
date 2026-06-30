export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

/** スマレジ取引履歴形式: ¥ 689,350 */
export function formatSmaregiYen(amount: number): string {
  return `¥ ${amount.toLocaleString("ja-JP")}`;
}

export function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

export const PAYMENT_LABELS: Record<string, string> = {
  CASH: "現金",
  CREDIT_CARD: "クレジット",
  TRANSIT_IC: "交通系IC",
  QR: "QR決済",
  OTHER: "その他",
};

export const FILE_TYPE_LABELS: Record<string, string> = {
  PRODUCT_MASTER: "商品マスター",
  TRANSACTION_DETAIL: "取引明細",
  TRANSACTION_PAYMENT: "取引支払方法",
  DAILY_CLOSING: "日次締め",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "待機中",
  PARSING: "解析中",
  PREVIEW: "プレビュー",
  IMPORTING: "取込中",
  NORMALIZING: "正規化中",
  AGGREGATING: "集計中",
  COMPLETED: "完了",
  FAILED: "失敗",
};
