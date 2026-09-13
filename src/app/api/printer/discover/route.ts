import { NextResponse } from "next/server";
import { discoverEscPosPrinters } from "@/lib/printer/discover";
import { isPrinterSupported } from "@/lib/runtime-config";

export async function GET() {
  if (!isPrinterSupported()) {
    return NextResponse.json(
      { error: "クラウド運用ではプリンター検索はできません" },
      { status: 400 },
    );
  }

  const result = await discoverEscPosPrinters(9100);
  return NextResponse.json({
    selfIp: result.selfIp,
    port: 9100,
    printers: result.printers,
  });
}
