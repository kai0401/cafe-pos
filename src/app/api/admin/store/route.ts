import { NextResponse } from "next/server";
import { getDefaultStore, prisma } from "@/lib/prisma";
import { getClosedDays } from "@/lib/store-config";

export async function GET() {
  const store = await getDefaultStore();
  return NextResponse.json({
    name: store.name,
    invoiceRegNumber: store.invoiceRegNumber,
    openTime: store.openTime,
    closeTime: store.closeTime,
    regularClosedDays: getClosedDays(store.regularClosedDays),
    storesEnabled: store.storesEnabled,
    storesApiConfigured: Boolean(process.env.STORES_API_KEY?.trim()),
  });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const store = await getDefaultStore();

    const timePattern = /^\d{2}:\d{2}$/;
    if (body.openTime && !timePattern.test(body.openTime)) {
      return NextResponse.json({ error: "開店時間は HH:MM 形式で入力してください" }, { status: 400 });
    }
    if (body.closeTime && !timePattern.test(body.closeTime)) {
      return NextResponse.json({ error: "閉店時間は HH:MM 形式で入力してください" }, { status: 400 });
    }

    const updated = await prisma.store.update({
      where: { id: store.id },
      data: {
        name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : undefined,
        invoiceRegNumber:
          body.invoiceRegNumber !== undefined ? body.invoiceRegNumber?.trim() || null : undefined,
        openTime: body.openTime || undefined,
        closeTime: body.closeTime || undefined,
        regularClosedDays: Array.isArray(body.regularClosedDays)
          ? body.regularClosedDays
          : undefined,
        storesEnabled:
          typeof body.storesEnabled === "boolean" ? body.storesEnabled : undefined,
      },
    });

    return NextResponse.json({
      name: updated.name,
      invoiceRegNumber: updated.invoiceRegNumber,
      openTime: updated.openTime,
      closeTime: updated.closeTime,
      regularClosedDays: getClosedDays(updated.regularClosedDays),
      storesEnabled: updated.storesEnabled,
      storesApiConfigured: Boolean(process.env.STORES_API_KEY?.trim()),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存エラー" },
      { status: 400 },
    );
  }
}
