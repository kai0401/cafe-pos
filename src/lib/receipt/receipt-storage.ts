import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { isCloudRuntime } from "@/lib/runtime-config";
import { prisma } from "@/lib/prisma";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "receipts");
const BLOB_PREFIX = "blob:";

export async function saveReceiptImage(storeId: string, buffer: Buffer, mimeType: string) {
  if (isCloudRuntime()) {
    const blob = await prisma.receiptBlob.create({
      data: {
        storeId,
        data: new Uint8Array(buffer),
        mimeType: mimeType || "image/jpeg",
      },
    });
    return `${BLOB_PREFIX}${blob.id}`;
  }

  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const dir = path.join(UPLOAD_ROOT, storeId);
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const fullPath = path.join(dir, filename);
  await fs.writeFile(fullPath, buffer);
  return path.join(storeId, filename);
}

export function resolveReceiptPath(relativePath: string) {
  const full = path.join(UPLOAD_ROOT, relativePath);
  if (!full.startsWith(UPLOAD_ROOT)) throw new Error("Invalid path");
  return full;
}

export async function readReceiptImage(relativePath: string) {
  if (relativePath.startsWith(BLOB_PREFIX)) {
    const id = relativePath.slice(BLOB_PREFIX.length);
    const blob = await prisma.receiptBlob.findUnique({ where: { id } });
    if (!blob) throw new Error("Not found");
    return Buffer.from(blob.data);
  }
  return fs.readFile(resolveReceiptPath(relativePath));
}

export function guessMimeType(relativePath: string) {
  if (relativePath.startsWith(BLOB_PREFIX)) return "image/jpeg";
  if (relativePath.endsWith(".png")) return "image/png";
  if (relativePath.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function getReceiptMimeType(relativePath: string) {
  if (relativePath.startsWith(BLOB_PREFIX)) {
    const id = relativePath.slice(BLOB_PREFIX.length);
    const blob = await prisma.receiptBlob.findUnique({ where: { id } });
    return blob?.mimeType ?? "image/jpeg";
  }
  return guessMimeType(relativePath);
}
