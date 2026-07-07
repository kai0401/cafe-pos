import { ShiftRole } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  createStaff,
  deleteStaff,
  listStaff,
  updateStaff,
} from "@/domain/shift/shift-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET() {
  const store = await getDefaultStore();
  const staff = await listStaff(store.id);
  return NextResponse.json(staff);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = await getDefaultStore();
    const staff = await createStaff(store.id, {
      name: body.name,
      hourlyWage: body.hourlyWage != null ? Number(body.hourlyWage) : null,
      role: body.role as ShiftRole,
      color: body.color,
    });
    return NextResponse.json(staff);
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
    const staff = await updateStaff(body.id, store.id, {
      name: body.name,
      hourlyWage: body.hourlyWage != null ? Number(body.hourlyWage) : body.hourlyWage,
      role: body.role as ShiftRole,
      color: body.color,
      isActive: body.isActive,
    });
    return NextResponse.json(staff);
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
    await deleteStaff(id, store.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除エラー" },
      { status: 400 },
    );
  }
}
