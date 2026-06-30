import { NextResponse } from "next/server";
import { getPaymentBreakdown, getProductSales } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";

  if (type === "payments") {
    const data = await getPaymentBreakdown({ businessDaysOnly });
    return NextResponse.json(data);
  }

  const data = await getProductSales({ businessDaysOnly }, limit);
  return NextResponse.json(data);
}
