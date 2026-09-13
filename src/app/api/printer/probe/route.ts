import { NextResponse } from "next/server";
import { probePrinter } from "@/lib/printer/discover";
import { loadPrinterConfig } from "@/lib/printer/printer-config";
import { isPrinterSupported } from "@/lib/runtime-config";

export async function POST(request: Request) {
  if (!isPrinterSupported()) {
    return NextResponse.json({ reachable: false, error: "クラウドでは接続できません" }, { status: 400 });
  }

  const config = loadPrinterConfig();
  let ip = config.ip;
  let port = config.port;
  try {
    const body = await request.json();
    if (typeof body.ip === "string" && body.ip.trim()) ip = body.ip.trim();
    if (body.port) port = Number(body.port);
  } catch {
    // body optional
  }

  if (!ip) {
    return NextResponse.json({ reachable: false, error: "IPアドレスが未設定です" }, { status: 400 });
  }

  const reachable = await probePrinter(ip, port, 1200);
  return NextResponse.json({
    reachable,
    ip,
    port,
    error: reachable ? null : `プリンター(${ip}:${port})に接続できません`,
  });
}
