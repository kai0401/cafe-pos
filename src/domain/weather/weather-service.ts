import { dateKey } from "@/lib/datetime";
import { prisma } from "@/lib/prisma";
import { STORE_LOCATION } from "@/lib/store-location";

export type WeatherSnapshot = {
  date: string;
  locationName: string;
  weatherCode: number;
  label: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number;
};

/** WMO weather code → 日本語 */
export function weatherCodeLabel(code: number): string {
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "薄曇り";
  if (code === 3) return "曇り";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 57) return "霧雨";
  if (code >= 61 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code >= 85 && code <= 86) return "にわか雪";
  if (code >= 95) return "雷雨";
  return "不明";
}

type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_sum: (number | null)[];
};

async function fetchOpenMeteoDaily(
  startDate: string,
  endDate: string,
): Promise<OpenMeteoDaily | null> {
  const { latitude, longitude } = STORE_LOCATION;
  const today = new Date().toISOString().slice(0, 10);
  const isHistorical = endDate < today;

  const base = isHistorical
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";

  const url = new URL(base);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", "Asia/Tokyo");
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
  );

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: OpenMeteoDaily };
    return json.daily ?? null;
  } catch {
    return null;
  }
}

export async function ensureWeatherForDates(storeId: string, dates: string[]) {
  const unique = [...new Set(dates)].sort();
  if (unique.length === 0) return;

  const existing = await prisma.dailyWeather.findMany({
    where: { storeId, businessDate: { in: unique.map((d) => new Date(d)) } },
    select: { businessDate: true },
  });
  const have = new Set(existing.map((r: { businessDate: Date }) => dateKey(r.businessDate)));
  const missing = unique.filter((d) => !have.has(d));
  if (missing.length === 0) return;

  const startDate = missing[0]!;
  const endDate = missing[missing.length - 1]!;
  const daily = await fetchOpenMeteoDaily(startDate, endDate);
  if (!daily) return;

  const byDate = new Map<string, number>();
  daily.time.forEach((t, i) => byDate.set(t, i));

  for (const d of missing) {
    const i = byDate.get(d);
    if (i === undefined) continue;

    await prisma.dailyWeather.upsert({
      where: {
        storeId_businessDate: { storeId, businessDate: new Date(d) },
      },
      create: {
        storeId,
        businessDate: new Date(d),
        locationName: STORE_LOCATION.name,
        latitude: STORE_LOCATION.latitude,
        longitude: STORE_LOCATION.longitude,
        weatherCode: daily.weather_code[i] ?? 0,
        tempMax: daily.temperature_2m_max[i] ?? null,
        tempMin: daily.temperature_2m_min[i] ?? null,
        precipitation: daily.precipitation_sum[i] ?? 0,
      },
      update: {
        weatherCode: daily.weather_code[i] ?? 0,
        tempMax: daily.temperature_2m_max[i] ?? null,
        tempMin: daily.temperature_2m_min[i] ?? null,
        precipitation: daily.precipitation_sum[i] ?? 0,
        fetchedAt: new Date(),
      },
    });
  }
}

export async function getWeatherForDates(
  storeId: string,
  dates: string[],
): Promise<Map<string, WeatherSnapshot>> {
  await ensureWeatherForDates(storeId, dates);

  const rows = await prisma.dailyWeather.findMany({
    where: { storeId, businessDate: { in: dates.map((d) => new Date(d)) } },
  });

  const map = new Map<string, WeatherSnapshot>();
  for (const row of rows) {
    const key = dateKey(row.businessDate);
    map.set(key, {
      date: key,
      locationName: row.locationName,
      weatherCode: row.weatherCode,
      label: weatherCodeLabel(row.weatherCode),
      tempMax: row.tempMax,
      tempMin: row.tempMin,
      precipitation: row.precipitation,
    });
  }
  return map;
}
