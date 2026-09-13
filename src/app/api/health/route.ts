import { NextResponse } from "next/server";
import { isCloudRuntime, isPrinterSupported } from "@/lib/runtime-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const cloud = isCloudRuntime();
  let setup = { ready: false, products: 0, tables: 0 };
  let db = "ok";

  try {
    const store = await prisma.store.findFirst();
    if (store) {
      const [products, tables] = await Promise.all([
        prisma.product.count({ where: { storeId: store.id } }),
        prisma.table.count({ where: { storeId: store.id } }),
      ]);
      setup = { ready: tables >= 9 && products > 0, products, tables };
    }
  } catch {
    db = "error";
  }

  const payload = {
    ok: true,
    service: "cafe-pos",
    cloud,
    mode: cloud ? "cloud" : "local",
    shopServerRequired: !cloud,
    printerSupported: isPrinterSupported(),
    publicBaseUrlConfigured: Boolean(
      process.env.PUBLIC_BASE_URL?.trim() || process.env.VERCEL_URL?.trim(),
    ),
    db,
    setup,
  };

  if (db === "error") {
    return NextResponse.json({ ...payload, ok: false }, { status: 503 });
  }

  return NextResponse.json(payload);
}
