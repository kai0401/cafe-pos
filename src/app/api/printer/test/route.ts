import { NextResponse } from "next/server";
import { buildTestPrint, sendToPrinter } from "@/lib/printer/print-service";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { isPrinterSupported } from "@/lib/runtime-config";

export async function POST(request: Request) {
  const saved = loadPrinterConfig();
  if (!isPrinterSupported() && !saved.ip) {
    return NextResponse.json({ error: "印刷エージェントが無効です（PRINT_AGENT_ENABLED=0）" }, { status: 400 });
  }
  let ip = saved.ip;
  let port = saved.port;
  let cols = saved.cols;
  try {
    const body = await request.json();
    if (isPrinterSupported() && typeof body.ip === "string" && body.ip.trim()) ip = body.ip.trim();
    if (body.port) port = Number(body.port);
    if (body.cols) cols = Number(body.cols);
  } catch {
    // body optional
  }

  try {
    await sendToPrinter(buildTestPrint(cols), { ...saved, ip, port, cols }, "test");
    return NextResponse.json({ ok: true, ip, port });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テスト印刷に失敗しました" },
      { status: 400 },
    );
  }
}
