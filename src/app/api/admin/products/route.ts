import { ProductStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  createStoreProduct,
  hideStoreProduct,
  updateStoreProduct,
} from "@/domain/order/order-service";
import { getDefaultStore } from "@/lib/prisma";

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return Boolean(value);
}

function parseOptionalPrice(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Math.round(Number(value));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name : "";
    const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
    if (!name.trim() || !categoryId) {
      return NextResponse.json({ error: "商品名とカテゴリが必要です" }, { status: 400 });
    }

    const store = await getDefaultStore();
    const product = await createStoreProduct(store.id, {
      name,
      categoryId,
      priceDineIn: Math.round(Number(body.priceDineIn ?? 0)),
      priceTakeout: parseOptionalPrice(body.priceTakeout) ?? null,
      isTopping: Boolean(body.isTopping),
      showOnQr: body.showOnQr !== false,
      showOnWaiter: body.showOnWaiter !== false,
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登録エラー" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const productId = typeof body.productId === "string" ? body.productId : "";
    if (!productId) {
      return NextResponse.json({ error: "productId が必要です" }, { status: 400 });
    }

    if (body.status !== undefined && !Object.values(ProductStatus).includes(body.status)) {
      return NextResponse.json({ error: "無効な状態です" }, { status: 400 });
    }

    const store = await getDefaultStore();
    const product = await updateStoreProduct(store.id, productId, {
      name: typeof body.name === "string" ? body.name : undefined,
      categoryId: typeof body.categoryId === "string" ? body.categoryId : undefined,
      priceDineIn:
        body.priceDineIn !== undefined ? Math.round(Number(body.priceDineIn)) : undefined,
      priceTakeout: parseOptionalPrice(body.priceTakeout),
      status: body.status,
      isTopping: parseOptionalBool(body.isTopping),
      showOnQr: parseOptionalBool(body.showOnQr),
      showOnWaiter: parseOptionalBool(body.showOnWaiter),
    });
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const productId =
      (typeof body.productId === "string" && body.productId) || url.searchParams.get("productId") || "";
    if (!productId) {
      return NextResponse.json({ error: "productId が必要です" }, { status: 400 });
    }

    const store = await getDefaultStore();
    const product = await hideStoreProduct(store.id, productId);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除エラー" },
      { status: 400 },
    );
  }
}
