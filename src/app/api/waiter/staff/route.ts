import { NextResponse } from "next/server";
import { getOnDutyStaffNames } from "@/domain/shift/shift-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  const store = await getDefaultStore();
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const names = await getOnDutyStaffNames(store.id, date);
  return NextResponse.json(names);
}
