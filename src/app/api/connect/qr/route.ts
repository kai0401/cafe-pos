import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = params.get("url");
  if (!url) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  const rawSize = Number(params.get("size") ?? "280");
  const width = Number.isFinite(rawSize) ? Math.min(Math.max(Math.round(rawSize), 120), 1200) : 280;

  const png = await QRCode.toBuffer(url, {
    width,
    margin: 2,
    color: { dark: "#1c1917", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}
