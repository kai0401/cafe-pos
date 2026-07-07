import { ExpenseCategory, ExpenseSource } from "@prisma/client";
import { NextResponse } from "next/server";
import {
  createExpense,
  deleteExpense,
  getExpenseSummary,
  listExpenses,
  updateExpense,
} from "@/domain/expense/expense-service";
import { getDefaultStore } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const store = await getDefaultStore();
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  if (searchParams.get("summary") === "1") {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const start = startDate
      ? new Date(`${startDate}T00:00:00.000Z`)
      : new Date(Date.UTC(y, m, 1));
    const end = endDate
      ? new Date(`${endDate}T23:59:59.999Z`)
      : new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
    const summary = await getExpenseSummary(store.id, start, end);
    return NextResponse.json(summary);
  }

  const expenses = await listExpenses(store.id, { startDate, endDate });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const store = await getDefaultStore();
    const expense = await createExpense(store.id, {
      category: body.category as ExpenseCategory,
      amount: Number(body.amount),
      description: body.description,
      expenseDate: body.expenseDate,
      isRecurring: body.isRecurring,
      source: (body.source as ExpenseSource) ?? (body.receiptImagePath ? "RECEIPT_SCAN" : "MANUAL"),
      merchantName: body.merchantName,
      receiptImagePath: body.receiptImagePath,
      ocrText: body.ocrText,
      classifyConfidence: body.classifyConfidence,
    });
    return NextResponse.json(expense);
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
    const store = await getDefaultStore();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const expense = await updateExpense(body.id, store.id, body);
    return NextResponse.json(expense);
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
    await deleteExpense(id, store.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除エラー" },
      { status: 400 },
    );
  }
}
