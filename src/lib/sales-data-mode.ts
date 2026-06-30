import { DataSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** True when real Smaregi CSV products are in the database. */
export async function hasImportedSmaregiData(storeId: string): Promise<boolean> {
  const smaregiProducts = await prisma.product.count({
    where: { storeId, dataSource: DataSource.SMAREGI },
  });
  return smaregiProducts > 0;
}

export async function buildSalesTransactionWhere(
  storeId: string,
  dataSources: DataSource[],
) {
  const base = {
    storeId,
    dataSource: { in: dataSources },
    transactionType: TransactionType.SALE,
  } as const;

  if (await hasImportedSmaregiData(storeId)) {
    return { ...base, NOT: { externalId: { startsWith: "demo-" } } } as const;
  }

  return base;
}
