import { NextResponse } from "next/server";
import { getDailySales, getSalesTrend } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";
  const trend = searchParams.get("trend") === "true";

  if (trend) {
    const data = await getSalesTrend({ businessDaysOnly });
    return NextResponse.json(data);
  }

  const data = await getDailySales({ businessDaysOnly });
  return NextResponse.json(data);
}
