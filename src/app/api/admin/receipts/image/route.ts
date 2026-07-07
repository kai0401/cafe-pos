import { NextResponse } from "next/server";
import { getReceiptMimeType, readReceiptImage, resolveReceiptPath } from "@/lib/receipt/receipt-storage";
import { getDefaultStore } from "@/lib/prisma";
import fs from "fs/promises";

export async function GET(request: Request) {
  const pathParam = new URL(request.url).searchParams.get("path");
  if (!pathParam) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  const store = await getDefaultStore();

  if (pathParam.startsWith("blob:")) {
    try {
      const buffer = await readReceiptImage(pathParam);
      const mime = await getReceiptMimeType(pathParam);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=3600",
        },
      });
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  if (!pathParam.startsWith(`${store.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const full = resolveReceiptPath(pathParam);
    await fs.access(full);
    const buffer = await readReceiptImage(pathParam);
    const mime = await getReceiptMimeType(pathParam);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
