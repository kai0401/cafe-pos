import { prisma } from "@/lib/prisma";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 8 && key.length <= 128;
}

/**
 * 同一キーの再送は保存済みレスポンスを返す（at-least-once オフラインキュー向け）
 */
export async function withIdempotency<T>(
  key: string | undefined,
  storeId: string,
  run: () => Promise<T>,
): Promise<T> {
  if (!isValidIdempotencyKey(key)) {
    return run();
  }

  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    try {
      return JSON.parse(existing.response) as T;
    } catch {
      /* fall through */
    }
  }

  // 先にプレースホルダを確保して同時実行を抑止
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        storeId,
        response: JSON.stringify({ __pending: true }),
        expiresAt,
      },
    });
  } catch {
    const raced = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (raced && raced.expiresAt.getTime() > Date.now()) {
      try {
        const parsed = JSON.parse(raced.response) as T & { __pending?: boolean };
        if (!parsed || (parsed as { __pending?: boolean }).__pending) {
          // 他リクエスト処理中 — 短時間待って再読込
          await new Promise((r) => setTimeout(r, 400));
          const again = await prisma.idempotencyKey.findUnique({ where: { key } });
          if (again) {
            const body = JSON.parse(again.response) as T & { __pending?: boolean };
            if (!body || (body as { __pending?: boolean }).__pending) {
              throw new Error("同じ操作が処理中です。しばらくしてから再試行してください");
            }
            return body;
          }
        } else {
          return parsed;
        }
      } catch (e) {
        if (e instanceof Error && e.message.includes("処理中")) throw e;
      }
    }
  }

  const result = await run();
  try {
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        response: JSON.stringify(result),
        expiresAt: new Date(Date.now() + DEFAULT_TTL_MS),
        storeId,
      },
    });
  } catch {
    /* ignore */
  }
  return result;
}
