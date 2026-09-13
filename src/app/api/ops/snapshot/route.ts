import { NextResponse } from "next/server";
import { isCloudRuntime } from "@/lib/runtime-config";
import {
  buildHeartbeatOpsSnapshot,
  buildLiveOpsSnapshot,
} from "@/domain/ops/ops-service";

/**
 * 遠隔モニター用スナップショット。
 * - 店舗（Pi）: ライブDBから集計
 * - クラウド: 店舗からの心拍が新しければそれを優先、なければクラウドDBのライブ
 */
export async function GET() {
  try {
    if (isCloudRuntime()) {
      const fromHb = await buildHeartbeatOpsSnapshot();
      if (fromHb && !fromHb.heartbeat?.stale) {
        return NextResponse.json(fromHb);
      }
      const live = await buildLiveOpsSnapshot();
      return NextResponse.json({
        ...live,
        note: fromHb
          ? "店舗心拍が古いためクラウドDBを表示しています"
          : "店舗心拍未受信のためクラウドDBを表示しています",
        heartbeat: fromHb?.heartbeat ?? null,
      });
    }

    const live = await buildLiveOpsSnapshot();
    return NextResponse.json(live);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ops snapshot error", ok: false },
      { status: 500 },
    );
  }
}
