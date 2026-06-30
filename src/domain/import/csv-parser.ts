import iconv from "iconv-lite";
import Papa from "papaparse";

export type ParsedCsv = {
  encoding: string;
  headers: string[];
  rows: Record<string, string>[];
};

export function detectAndDecodeCsv(buffer: Buffer): { text: string; encoding: string } {
  const utf8 = buffer.toString("utf-8");
  if (!utf8.includes("\uFFFD") && /[\u3000-\u9FFF]/.test(utf8)) {
    return { text: utf8.replace(/^\uFEFF/, ""), encoding: "utf-8" };
  }

  const cp932 = iconv.decode(buffer, "cp932");
  return { text: cp932, encoding: "cp932" };
}

export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0 && result.data.length === 0) {
    throw new Error(`CSV parse error: ${result.errors[0]?.message}`);
  }

  return {
    encoding: "unknown",
    headers: result.meta.fields ?? [],
    rows: result.data.filter((row) =>
      Object.values(row).some((v) => v !== null && v !== undefined && String(v).trim() !== ""),
    ),
  };
}

export function parseCsvBuffer(buffer: Buffer): ParsedCsv & { encoding: string } {
  const { text, encoding } = detectAndDecodeCsv(buffer);
  const parsed = parseCsvText(text);
  return { ...parsed, encoding };
}

export function hashBuffer(buffer: Buffer): string {
  let hash = 0;
  for (let i = 0; i < buffer.length; i++) {
    hash = (hash * 31 + buffer[i]!) >>> 0;
  }
  return hash.toString(16);
}
