import fs from "fs/promises";
import path from "path";
import { DataSource } from "@prisma/client";
import {
  buildSmaregiProductCsv,
  buildSmaregiTransactionCsv,
} from "@/domain/export/smaregi-export";
import { formatJST, getBusinessDate } from "@/lib/datetime";
import { isCloudRuntime } from "@/lib/runtime-config";

/**
 * スマレジ互換CSVを backups/smaregi/YYYY-MM-DD/ に保管。
 * クラウド（読み取り専用FS）ではスキップし、APIダウンロードを利用。
 */
export async function archiveSmaregiCsvFiles(params: {
  storeId: string;
  businessDate?: Date;
}): Promise<{ ok: boolean; dir?: string; skipped?: string }> {
  if (isCloudRuntime()) {
    return { ok: false, skipped: "cloud-ephemeral-fs" };
  }

  const day = params.businessDate ?? getBusinessDate(new Date());
  const dayKey = formatJST(day, "yyyy-MM-dd");
  const dir = path.join(process.cwd(), "backups", "smaregi", dayKey);
  await fs.mkdir(dir, { recursive: true });

  const [txCsv, productCsv] = await Promise.all([
    buildSmaregiTransactionCsv({
      storeId: params.storeId,
      from: day,
      to: day,
      dataSource: "ALL",
    }),
    buildSmaregiProductCsv(params.storeId),
  ]);

  // OWN_POS のみも別ファイルで残す（切替後の純正データ）
  const ownCsv = await buildSmaregiTransactionCsv({
    storeId: params.storeId,
    from: day,
    to: day,
    dataSource: DataSource.OWN_POS,
  });

  await Promise.all([
    fs.writeFile(path.join(dir, "取引.csv"), txCsv, "utf8"),
    fs.writeFile(path.join(dir, "商品.csv"), productCsv, "utf8"),
    fs.writeFile(path.join(dir, "取引_OWN_POS.csv"), ownCsv, "utf8"),
  ]);

  return { ok: true, dir };
}
