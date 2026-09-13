import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrintAgentEnabled, loadPrinterConfig, isPrintAgentMode } from "@/lib/printer/printer-config";
import { isPrinterSupported } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/** 管理画面向け：印刷キューの状態（認証不要・件数のみ） */
export async function GET() {
  const agentMode = !isPrinterSupported() && isPrintAgentEnabled() && isPrintAgentMode(loadPrinterConfig());
  if (!agentMode) {
    return NextResponse.json({ agentMode: false });
  }
  const [pending, printing, lastDone, failed24h] = await Promise.all([
    prisma.printJob.count({ where: { status: "PENDING" } }),
    prisma.printJob.count({ where: { status: "PRINTING" } }),
    prisma.printJob.findFirst({
      where: { status: "DONE" },
      orderBy: { printedAt: "desc" },
      select: { printedAt: true },
    }),
    prisma.printJob.count({
      where: { status: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    }),
  ]);
  const lastPrintedAt = lastDone?.printedAt ?? null;
  const agentOnline = lastPrintedAt ? Date.now() - lastPrintedAt.getTime() < 6 * 3600 * 1000 : null;
  return NextResponse.json({
    agentMode: true,
    pending,
    printing,
    failed24h,
    lastPrintedAt,
    agentOnline,
    keyConfigured: Boolean(process.env.PRINT_AGENT_KEY),
  });
}
