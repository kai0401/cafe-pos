export type SmaregiMemo = {
  tableNumber?: number;
  tableName?: string;
  guestCount?: number;
  entryTime?: Date;
  checkoutType?: "WAITER" | "REGISTER";
};

export function parseSmaregiMemo(memo: string): SmaregiMemo {
  const result: SmaregiMemo = {};

  if (memo.includes("Waiter")) {
    result.checkoutType = "WAITER";
  }

  const tableMatch = memo.match(/テーブル番号\s*[：:]\s*(\d+)/);
  if (tableMatch) result.tableNumber = parseInt(tableMatch[1]!, 10);

  const tableNameMatch = memo.match(/テーブル名\s*[：:]\s*(.+)/);
  if (tableNameMatch) result.tableName = tableNameMatch[1]!.trim();

  const guestMatch = memo.match(/人数\s*[：:]\s*(\d+)/);
  if (guestMatch) result.guestCount = parseInt(guestMatch[1]!, 10);

  const entryMatch = memo.match(/入店時間\s*[：:]\s*([\d-]+\s[\d:]+)/);
  if (entryMatch) {
    result.entryTime = new Date(entryMatch[1]!.trim());
  }

  return result;
}

export function detectCsvType(headers: string[]): "PRODUCT_MASTER" | "TRANSACTION_DETAIL" | "UNKNOWN" {
  const headerSet = new Set(headers);
  if (headerSet.has("商品ID") && headerSet.has("商品名") && headerSet.has("商品単価")) {
    return "PRODUCT_MASTER";
  }
  if (headerSet.has("取引ID") && headerSet.has("取引明細ID") && headerSet.has("商品名")) {
    return "TRANSACTION_DETAIL";
  }
  return "UNKNOWN";
}

export function getColumn(row: Record<string, string>, ...candidates: string[]): string {
  for (const key of candidates) {
    if (row[key] !== undefined) return String(row[key] ?? "").trim();
    const found = Object.keys(row).find((k) => k.startsWith(key));
    if (found && row[found] !== undefined) return String(row[found] ?? "").trim();
  }
  return "";
}
