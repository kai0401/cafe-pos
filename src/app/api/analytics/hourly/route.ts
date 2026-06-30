import { NextResponse } from "next/server";
import { getHourlySales, getWeekdaySales } from "@/domain/analytics/analytics-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const businessHoursOnly = searchParams.get("businessHoursOnly") !== "false";
  const businessDaysOnly = searchParams.get("businessDaysOnly") !== "false";

  if (type === "weekday") {
    const data = await getWeekdaySales({ businessDaysOnly });
    return NextResponse.json(data);
  }

  const data = await getHourlySales({ businessHoursOnly, businessDaysOnly });
  return NextResponse.json(data);
}
