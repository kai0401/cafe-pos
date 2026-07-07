import { ProductStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const { productId, status } = await request.json();
    if (!productId || !status) {
      return NextResponse.json({ error: "productId と status が必要です" }, { status: 400 });
    }
    if (!Object.values(ProductStatus).includes(status)) {
      return NextResponse.json({ error: "無効な状態です" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { status },
      include: { category: true, externalMapping: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}
