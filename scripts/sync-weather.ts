/**
 * 日暮里駅周辺の天候データを同期
 * npx tsx scripts/sync-weather.ts [開始日] [終了日]
 */
import { ensureWeatherForDates } from "../src/domain/weather/weather-service";
import { getDefaultStore, prisma } from "../src/lib/prisma";

async function main() {
  const store = await getDefaultStore();
  const start = process.argv[2] ?? "2024-07-01";
  const end = process.argv[3] ?? new Date().toISOString().slice(0, 10);

  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  await ensureWeatherForDates(store.id, dates);
  const count = await prisma.dailyWeather.count({ where: { storeId: store.id } });
  console.log(`Synced weather for ${dates.length} days. Total stored: ${count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
