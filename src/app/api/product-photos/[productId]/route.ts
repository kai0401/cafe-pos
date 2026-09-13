import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readProductPhoto } from "@/lib/product-photos";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  try {
    const { productId } = await params;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { imagePath: true },
    });
    if (!product?.imagePath) {
      return NextResponse.json({ error: "写真がありません" }, { status: 404 });
    }
    const buffer = await readProductPhoto(product.imagePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "写真を読めません" }, { status: 404 });
  }
}
