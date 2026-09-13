import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPrintAgentAuthorized } from "@/lib/printer/print-agent-auth";

export const dynamic = "force-dynamic";

const MAX_BATCH = 10;
/** 取り出されたまま結果が来ないジョブは、この時間で PENDING に戻す */
const STALE_CLAIM_MS = 2 * 60 * 1000;
/** これより古い未印刷ジョブは印刷しない（長時間停止後に古い伝票が大量に出るのを防ぐ） */
const EXPIRE_MS = 60 * 60 * 1000;

/** GET: 未印刷ジョブを取り出す（PRINTING に更新して返す） */
export async function GET(request: Request) {
  if (!isPrintAgentAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = Date.now();

  // 取り出し後に応答がないジョブを戻す
  await prisma.printJob.updateMany({
    where: { status: "PRINTING", claimedAt: { lt: new Date(now - STALE_CLAIM_MS) } },
    data: { status: "PENDING", claimedAt: null },
  });
  // 古すぎるジョブは失効
  await prisma.printJob.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(now - EXPIRE_MS) } },
    data: { status: "FAILED", error: "expired" },
  });

  const pending = await prisma.printJob.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: MAX_BATCH,
    select: { id: true, kind: true, data: true, createdAt: true, attempts: true },
  });
  if (pending.length === 0) return NextResponse.json({ jobs: [] });

  const ids = pending.map((j) => j.id);
  await prisma.printJob.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "PRINTING", claimedAt: new Date(now), attempts: { increment: 1 } },
  });

  return NextResponse.json({
    jobs: pending.map((j) => ({
      id: j.id,
      kind: j.kind,
      createdAt: j.createdAt.toISOString(),
      attempts: j.attempts + 1,
      data: Buffer.from(j.data).toString("base64"),
    })),
  });
}

/** POST: 印刷結果を報告 { id, ok, error? } */
export async function POST(request: Request) {
  if (!isPrintAgentAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as
    | { id?: string; ok?: boolean; error?: string }
    | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const job = await prisma.printJob.findUnique({ where: { id: body.id } });
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (body.ok) {
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "DONE", printedAt: new Date(), error: null },
    });
  } else {
    const giveUp = job.attempts >= 3;
    await prisma.printJob.update({
      where: { id: job.id },
      data: {
        status: giveUp ? "FAILED" : "PENDING",
        claimedAt: null,
        error: (body.error ?? "print failed").slice(0, 500),
      },
    });
  }
  return NextResponse.json({ ok: true });
}
