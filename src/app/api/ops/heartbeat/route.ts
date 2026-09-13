import { NextResponse } from "next/server";
import { upsertOpsHeartbeat, type OpsSnapshot } from "@/domain/ops/ops-service";

function authorized(request: Request) {
  const expected = process.env.OPS_HEARTBEAT_KEY?.trim();
  if (!expected || expected.length < 8) return false;
  const key = request.headers.get("x-ops-key") ?? "";
  return key === expected;
}

/** 店舗 Pi からクラウドへ心拍を送る */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<OpsSnapshot> & {
      source?: string;
    };
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const payload = body as OpsSnapshot;
    await upsertOpsHeartbeat({
      source: body.source ?? "pi",
      hostname: body.hostname ?? null,
      lanIp: body.lanIp ?? null,
      payload,
    });

    return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "heartbeat error" },
      { status: 500 },
    );
  }
}
