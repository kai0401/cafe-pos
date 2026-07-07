import { NextResponse } from "next/server";
import { buildTestPrint, sendToPrinter } from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";

export async function POST() {
  const config = loadPrinterConfig();
  try {
    await sendToPrinter(buildTestPrint(config.cols), config);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テスト印刷に失敗しました" },
      { status: 400 },
    );
  }
}
