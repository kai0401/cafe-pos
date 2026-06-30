import { NextResponse } from "next/server";
import { getProfitLossReport } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";
  const data = await getProfitLossReport({ businessDaysOnly });
  return NextResponse.json(data);
}
