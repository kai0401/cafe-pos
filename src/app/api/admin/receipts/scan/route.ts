import { ExpenseCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { analyzeReceiptImage } from "@/lib/receipt/receipt-analyzer";
import { saveReceiptImage } from "@/lib/receipt/receipt-storage";
import { formatJSTToday } from "@/lib/datetime";
import { getDefaultStore } from "@/lib/prisma";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "画像ファイルが必要です" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "画像ファイルのみ対応しています" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "画像は12MB以下にしてください" }, { status: 400 });
    }

    const store = await getDefaultStore();
    const mimeType = file.type || "image/jpeg";
    const imagePath = await saveReceiptImage(store.id, buffer, mimeType);

    const analysis = await analyzeReceiptImage(buffer, mimeType);

    return NextResponse.json({
      imagePath,
      imageUrl: `/api/admin/receipts/image?path=${encodeURIComponent(imagePath)}`,
      ocrText: analysis.ocrText,
      engine: analysis.engine,
      warnings: analysis.warnings,
      classification: {
        amount: analysis.classification.amount,
        expenseDate: analysis.classification.expenseDate ?? formatJSTToday(),
        merchantName: analysis.classification.merchantName,
        category: analysis.classification.category as ExpenseCategory,
        confidence: analysis.classification.confidence,
        matchedKeywords: analysis.classification.matchedKeywords,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "解析に失敗しました" },
      { status: 500 },
    );
  }
}
