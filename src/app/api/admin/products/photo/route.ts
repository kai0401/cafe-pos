import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteProductPhoto, saveProductPhoto } from "@/lib/product-photos";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const productId = String(form.get("productId") ?? "");
    const file = form.get("file");
    if (!productId || !(file instanceof File)) {
      return NextResponse.json({ error: "商品と写真を指定してください" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "写真は12MB以下にしてください" }, { status: 400 });
    }
    const mime = file.type || "image/jpeg";
    if (mime && !ALLOWED.has(mime) && !mime.startsWith("image/")) {
      return NextResponse.json({ error: "JPEG / PNG / HEIC の写真を選んでください" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (product.imagePath) await deleteProductPhoto(product.imagePath);
    const imagePath = await saveProductPhoto(productId, buffer);
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { imagePath },
    });
    return NextResponse.json({ ok: true, productId, updatedAt: updated.updatedAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "アップロードに失敗しました" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: "productId が必要です" }, { status: 400 });
    }
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
    }
    if (product.imagePath) await deleteProductPhoto(product.imagePath);
    await prisma.product.update({
      where: { id: productId },
      data: { imagePath: null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除に失敗しました" },
      { status: 400 },
    );
  }
}
