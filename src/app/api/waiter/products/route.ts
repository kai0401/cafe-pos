import { ProductStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { updateProductPricing } from "@/domain/order/order-service";
import { prisma } from "@/lib/prisma";

const WAITER_STATUSES = new Set<ProductStatus>([ProductStatus.ACTIVE, ProductStatus.SOLD_OUT]);

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { productId, status, priceDineIn, priceTakeout } = body;
    if (!productId) {
      return NextResponse.json({ error: "productId が必要です" }, { status: 400 });
    }

    const patch: {
      status?: ProductStatus;
      priceDineIn?: number;
      priceTakeout?: number | null;
    } = {};

    if (status !== undefined) {
      if (!WAITER_STATUSES.has(status)) {
        return NextResponse.json(
          { error: "販売中・売切のみ切り替えできます" },
          { status: 400 },
        );
      }
      patch.status = status;
    }

    if (priceDineIn !== undefined) {
      patch.priceDineIn = Number(priceDineIn);
    }

    if (priceTakeout !== undefined) {
      patch.priceTakeout =
        priceTakeout === null || priceTakeout === "" ? null : Number(priceTakeout);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "更新する項目がありません" }, { status: 400 });
    }

    const product = await updateProductPricing(productId, patch);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}
