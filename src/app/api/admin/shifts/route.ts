import { ShiftRole, ShiftStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  createShift,
  deleteShift,
  getShiftMonthBundle,
  getShiftWeekBundle,
  updateShift,
} from "@/domain/shift/shift-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const store = await getDefaultStore();
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "week";

    if (view === "month") {
      const month = url.searchParams.get("month") ?? undefined;
      const bundle = await getShiftMonthBundle(store.id, month);
      return NextResponse.json(bundle);
    }

    const week = url.searchParams.get("week") ?? undefined;
    const bundle = await getShiftWeekBundle(store.id, week);
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("[shifts] GET failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "シフトの読み込みに失敗しました" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = await getDefaultStore();
    const shift = await createShift(store.id, {
      staffId: body.staffId,
      shiftDate: body.shiftDate,
      startTime: body.startTime,
      endTime: body.endTime,
      role: body.role as ShiftRole,
      status: body.status as ShiftStatus,
      note: body.note,
    });
    return NextResponse.json(shift);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登録エラー" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const store = await getDefaultStore();
    const shift = await updateShift(body.id, store.id, {
      staffId: body.staffId,
      shiftDate: body.shiftDate,
      startTime: body.startTime,
      endTime: body.endTime,
      role: body.role as ShiftRole,
      status: body.status as ShiftStatus,
      note: body.note,
    });
    return NextResponse.json(shift);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新エラー" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const store = await getDefaultStore();
    await deleteShift(id, store.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除エラー" },
      { status: 400 },
    );
  }
}
