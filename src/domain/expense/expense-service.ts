import { ExpenseCategory, ExpenseSource, Prisma } from "@prisma/client";
import { parseExpenseDate } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";

export type ExpenseInput = {
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  expenseDate: string;
  isRecurring?: boolean;
  source?: ExpenseSource;
  merchantName?: string | null;
  receiptImagePath?: string | null;
  ocrText?: string | null;
  classifyConfidence?: number | null;
};

export async function listExpenses(
  storeId: string,
  opts?: { startDate?: string; endDate?: string; limit?: number },
) {
  const where: Prisma.ExpenseWhereInput = { storeId };
  if (opts?.startDate || opts?.endDate) {
    where.expenseDate = {};
    if (opts.startDate) where.expenseDate.gte = parseExpenseDate(opts.startDate);
    if (opts.endDate) where.expenseDate.lte = parseExpenseDate(opts.endDate);
  }

  return prisma.expense.findMany({
    where,
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    take: opts?.limit,
  });
}

export async function createExpense(storeId: string, input: ExpenseInput) {
  if (input.amount <= 0) throw new Error("金額は1円以上で入力してください");
  return prisma.expense.create({
    data: {
      storeId,
      category: input.category,
      amount: Math.floor(input.amount),
      description: input.description?.trim() || null,
      expenseDate: parseExpenseDate(input.expenseDate),
      isRecurring: input.isRecurring ?? false,
      source: input.source ?? "MANUAL",
      merchantName: input.merchantName?.trim() || null,
      receiptImagePath: input.receiptImagePath ?? null,
      ocrText: input.ocrText ?? null,
      classifyConfidence: input.classifyConfidence ?? null,
    },
  });
}

export async function updateExpense(id: string, storeId: string, input: Partial<ExpenseInput>) {
  const existing = await prisma.expense.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("経費が見つかりません");

  return prisma.expense.update({
    where: { id },
    data: {
      category: input.category,
      amount: input.amount !== undefined ? Math.floor(input.amount) : undefined,
      description: input.description !== undefined ? input.description?.trim() || null : undefined,
      expenseDate: input.expenseDate ? parseExpenseDate(input.expenseDate) : undefined,
      isRecurring: input.isRecurring,
    },
  });
}

export async function deleteExpense(id: string, storeId: string) {
  const existing = await prisma.expense.findFirst({ where: { id, storeId } });
  if (!existing) throw new Error("経費が見つかりません");
  await prisma.expense.delete({ where: { id } });
}

/** 期間内の経費合計・カテゴリ別内訳 */
export async function getExpenseSummary(storeId: string, startDate: Date, endDate: Date) {
  const expenses = await prisma.expense.findMany({
    where: { storeId, expenseDate: { gte: startDate, lte: endDate } },
  });

  const byCategory = new Map<ExpenseCategory, number>();
  let total = 0;
  for (const e of expenses) {
    total += e.amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
  }

  return {
    total,
    count: expenses.length,
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    recent: expenses
      .sort((a, b) => b.expenseDate.getTime() - a.expenseDate.getTime())
      .slice(0, 8),
  };
}
