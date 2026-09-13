/**
 * 店内DB → クラウドDB（Neon）へ全データをコピー
 *   SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npx tsx scripts/copy-db.ts
 * 先に TARGET 側で `prisma migrate deploy` を済ませておくこと。
 * 既存行は id 重複をスキップ（skipDuplicates）するので再実行しても安全。
 */
import { Prisma, PrismaClient } from "@prisma/client";

const sourceUrl = process.env.SOURCE_DATABASE_URL;
const targetUrl = process.env.TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl) {
  console.error("SOURCE_DATABASE_URL と TARGET_DATABASE_URL を指定してください");
  process.exit(1);
}
if (sourceUrl === targetUrl) {
  console.error("SOURCE と TARGET が同じです");
  process.exit(1);
}

const src = new PrismaClient({ datasourceUrl: sourceUrl });
const dst = new PrismaClient({ datasourceUrl: targetUrl });

type ModelInfo = { name: string; deps: string[]; selfRef: boolean };

function modelGraph(): ModelInfo[] {
  return Prisma.dmmf.datamodel.models.map((m) => {
    const deps = new Set<string>();
    let selfRef = false;
    for (const f of m.fields) {
      if (f.kind === "object" && f.relationFromFields && f.relationFromFields.length > 0) {
        if (f.type === m.name) selfRef = true;
        else deps.add(f.type);
      }
    }
    return { name: m.name, deps: [...deps], selfRef };
  });
}

function topoSort(models: ModelInfo[]): ModelInfo[] {
  const byName = new Map(models.map((m) => [m.name, m]));
  const visited = new Set<string>();
  const out: ModelInfo[] = [];
  const visit = (name: string, stack: string[]) => {
    if (visited.has(name)) return;
    if (stack.includes(name)) return; // 循環は無視（後段の行単位リトライで吸収）
    const m = byName.get(name);
    if (!m) return;
    for (const d of m.deps) visit(d, [...stack, name]);
    visited.add(name);
    out.push(m);
  };
  for (const m of models) visit(m.name, []);
  return out;
}

function lcFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

async function copyModel(m: ModelInfo) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (src as any)[lcFirst(m.name)];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (dst as any)[lcFirst(m.name)];
  if (!s || !d) return;

  const total: number = await s.count();
  if (total === 0) {
    console.log(`  ${m.name}: 0`);
    return;
  }

  const BATCH = 500;
  let copied = 0;
  let skipped = 0;
  let cursor: string | undefined;
  const orderBy = m.selfRef ? [{ createdAt: "asc" as const }, { id: "asc" as const }] : { id: "asc" as const };

  for (;;) {
    const rows: Record<string, unknown>[] = await s.findMany({
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy,
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id as string;

    try {
      const r = await d.createMany({ data: rows, skipDuplicates: true });
      copied += r.count;
      skipped += rows.length - r.count;
    } catch {
      // FK 順序や自己参照などで失敗した場合は行単位でリトライ
      const pending = [...rows];
      for (let pass = 0; pass < 5 && pending.length > 0; pass++) {
        for (let i = pending.length - 1; i >= 0; i--) {
          try {
            await d.create({ data: pending[i] });
            copied++;
            pending.splice(i, 1);
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
              skipped++;
              pending.splice(i, 1);
            }
            // それ以外は次パスで再試行
          }
        }
      }
      if (pending.length > 0) {
        console.error(`  ✗ ${m.name}: ${pending.length} 行をコピーできませんでした`);
      }
    }
    if (rows.length < BATCH) break;
  }
  console.log(`  ${m.name}: ${copied} コピー${skipped ? ` / ${skipped} 既存` : ""} (元 ${total})`);
}

async function main() {
  console.log("店内DB → クラウドDB コピー開始");
  const order = topoSort(modelGraph());
  console.log("順序:", order.map((m) => m.name).join(" → "));
  for (const m of order) {
    await copyModel(m);
  }
  console.log("完了");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await src.$disconnect();
    await dst.$disconnect();
  });
