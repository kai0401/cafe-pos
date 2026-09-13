import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { isCloudRuntime } from "@/lib/runtime-config";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "products");
const BLOB_PREFIX = "blob:";

function blobKey(productId: string) {
  return `${BLOB_PREFIX}${productId}`;
}

export function resolveProductPhotoPath(filename: string) {
  const full = path.join(UPLOAD_ROOT, filename);
  if (!full.startsWith(UPLOAD_ROOT)) throw new Error("Invalid path");
  return full;
}

async function toJpegBuffer(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/** クラウドは常に DB。ローカルも DB 優先（Mac不要運用と共通）。ファイルは後方互換のみ。 */
export async function saveProductPhoto(productId: string, buffer: Buffer) {
  const jpeg = await toJpegBuffer(buffer);

  await prisma.productImageBlob.upsert({
    where: { productId },
    create: {
      productId,
      data: new Uint8Array(jpeg),
      mimeType: "image/jpeg",
    },
    update: {
      data: new Uint8Array(jpeg),
      mimeType: "image/jpeg",
    },
  });

  // ローカル開発の古いファイル参照を掃除
  if (!isCloudRuntime()) {
    try {
      await fs.unlink(path.join(UPLOAD_ROOT, `${productId}.jpg`));
    } catch {
      // ignore
    }
  }

  return blobKey(productId);
}

export async function readProductPhoto(filename: string) {
  if (filename.startsWith(BLOB_PREFIX)) {
    const productId = filename.slice(BLOB_PREFIX.length);
    const blob = await prisma.productImageBlob.findUnique({ where: { productId } });
    if (!blob) throw new Error("Not found");
    return Buffer.from(blob.data);
  }

  // 後方互換: 昔のファイルパス / ファイル名
  try {
    return await fs.readFile(resolveProductPhotoPath(filename));
  } catch {
    const byProduct = await prisma.productImageBlob.findUnique({ where: { productId: filename.replace(/\.jpg$/, "") } });
    if (byProduct) return Buffer.from(byProduct.data);
    throw new Error("Not found");
  }
}

export async function deleteProductPhoto(filename: string) {
  if (filename.startsWith(BLOB_PREFIX)) {
    const productId = filename.slice(BLOB_PREFIX.length);
    await prisma.productImageBlob.deleteMany({ where: { productId } });
    return;
  }

  try {
    await fs.unlink(resolveProductPhotoPath(filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const productId = filename.replace(/\.jpg$/, "");
  await prisma.productImageBlob.deleteMany({ where: { productId } });
}
