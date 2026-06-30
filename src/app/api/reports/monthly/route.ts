import { NextResponse } from "next/server";
import { getMonthlyReport } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";
  const data = await getMonthlyReport({ businessDaysOnly });
  return NextResponse.json(data);
}
