import { ExpenseCategory } from "@prisma/client";
import type { ReceiptClassification } from "@/lib/receipt/receipt-classifier";

const VALID_CATEGORIES = new Set<ExpenseCategory>([
  "RENT",
  "UTILITIES",
  "INGREDIENTS",
  "LABOR",
  "SUPPLIES",
  "MARKETING",
  "EQUIPMENT",
  "INSURANCE",
  "OTHER",
]);

type VisionPayload = {
  merchantName?: string | null;
  amount?: number | null;
  expenseDate?: string | null;
  category?: string;
  confidence?: number;
  summary?: string | null;
  ocrText?: string | null;
  matchedKeywords?: string[];
};

const VISION_PROMPT = `あなたは日本のカフェ・飲食店向けの経費レシート解析AIです。
画像からレシート・領収書・請求書の情報を読み取り、JSONのみで返してください。推測で埋めず、読めない項目はnullにしてください。

{
  "merchantName": "店舗名または支払先（不明ならnull）",
  "amount": 税込合計金額の整数（円、不明ならnull）,
  "expenseDate": "YYYY-MM-DD（不明ならnull）",
  "category": "RENT|UTILITIES|INGREDIENTS|LABOR|SUPPLIES|MARKETING|EQUIPMENT|INSURANCE|OTHER",
  "confidence": 0.0〜1.0,
  "summary": "購入内容の短い要約",
  "ocrText": "画像から読み取った全文テキスト",
  "matchedKeywords": ["カテゴリ判断の根拠キーワード"]
}

合計金額の選び方:
1. 「税込合計」「合計」「お支払い金額」「ご請求金額」「領収金額」「クレジット支払」などの最終支払額を最優先。
2. 小計・値引き・割引・ポイント利用・お釣り・釣銭・預かり金・消費税・内税・税額・対象額はamountにしない。
3. 「合計 1,080 内税 80」のように同じ行に税額がある場合、amountは1,080であり80ではない。
4. 金額候補が複数ある場合は、レシート末尾付近の最終支払額を選ぶ。
日付はレシート上部の取引日時を優先し、有効期限や会員番号内の数字は無視してください。
merchantNameは住所・電話番号・登録番号・レシート番号ではなく、支払先名だけにしてください。

カテゴリの目安:
- INGREDIENTS: 食材・青果・仕入・業務スーパー・コストコ・スーパー
- SUPPLIES: 洗剤・ラップ・消耗品・100均・ダイソー・セリア・文房具
- UTILITIES: 電気・ガス・水道（光熱費請求）
- RENT: 家賃・賃料・共益費
- LABOR: 給与・人件費
- MARKETING: 広告・チラシ・SNS広告
- EQUIPMENT: 機器購入・修理・設備工事
- INSURANCE: 保険料（消費税行は含めない）
- OTHER: 上記に当てはまらない`;

function parseCategory(value: string | undefined): ExpenseCategory {
  const upper = (value ?? "OTHER").toUpperCase() as ExpenseCategory;
  return VALID_CATEGORIES.has(upper) ? upper : "OTHER";
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.5;
  return Math.max(0, Math.min(0.98, value));
}

export function isVisionAnalysisEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function analyzeWithVision(
  buffer: Buffer,
  mimeType: string,
): Promise<{ ocrText: string; classification: ReceiptClassification } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const base64 = buffer.toString("base64");
  const mediaType = mimeType.startsWith("image/") ? mimeType : "image/jpeg";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${base64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[receipt-vision] OpenAI error:", response.status, body);
    return null;
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  let parsed: VisionPayload;
  try {
    parsed = JSON.parse(content) as VisionPayload;
  } catch {
    console.error("[receipt-vision] Invalid JSON from model");
    return null;
  }

  const amount =
    typeof parsed.amount === "number" && parsed.amount > 0
      ? Math.round(parsed.amount)
      : null;

  const ocrText = (parsed.ocrText ?? "").trim();

  return {
    ocrText,
    classification: {
      amount,
      expenseDate: parsed.expenseDate ?? null,
      merchantName: parsed.merchantName?.trim() || null,
      category: parseCategory(parsed.category),
      confidence: clampConfidence(parsed.confidence),
      matchedKeywords: Array.isArray(parsed.matchedKeywords)
        ? parsed.matchedKeywords.filter((k) => typeof k === "string")
        : parsed.summary
          ? [parsed.summary]
          : [],
    },
  };
}
