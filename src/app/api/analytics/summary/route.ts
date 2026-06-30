import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";
  const businessHoursOnly = searchParams.get("businessHoursOnly") === "true";

  const data = await getAnalyticsSummary({ businessDaysOnly, businessHoursOnly });
  return NextResponse.json(data);
}
