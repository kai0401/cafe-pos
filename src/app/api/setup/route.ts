import { NextResponse } from "next/server";
import { ensureWaiterSetup } from "@/lib/waiter-setup";
import { isCloudRuntime } from "@/lib/runtime-config";
import { prisma } from "@/lib/prisma";

/** クラウド初回セットアップ（テーブル・QRトークン・カテゴリ） */
export async function POST() {
  try {
    const store = await ensureWaiterSetup();
    const [products, tables, withQr] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id, qrToken: { not: null } } }),
    ]);

    return NextResponse.json({
      ok: true,
      cloud: isCloudRuntime(),
      store: { id: store.id, name: store.name },
      products,
      tables,
      qrTables: withQr,
      message:
        products > 0
          ? "セットアップ完了"
          : "テーブル準備完了。/admin/imports で商品CSVをインポートしてください",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "セットアップエラー" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const store = await prisma.store.findFirst();
    if (!store) {
      return NextResponse.json({
        ready: false,
        cloud: isCloudRuntime(),
        products: 0,
        tables: 0,
        qrTables: 0,
      });
    }

    const [products, tables, withQr] = await Promise.all([
      prisma.product.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id } }),
      prisma.table.count({ where: { storeId: store.id, qrToken: { not: null } } }),
    ]);

    return NextResponse.json({
      ready: tables >= 9 && products > 0,
      cloud: isCloudRuntime(),
      products,
      tables,
      qrTables: withQr,
      storeName: store.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "状態取得エラー" },
      { status: 500 },
    );
  }
}
