import sharp from "sharp";
import {
  classifyReceipt,
  mergeClassifications,
  type ReceiptClassification,
} from "@/lib/receipt/receipt-classifier";
import { runReceiptOcr } from "@/lib/receipt/receipt-ocr-service";
import { analyzeWithVision, isVisionAnalysisEnabled } from "@/lib/receipt/receipt-vision-service";

export type ReceiptAnalysisEngine = "openai-vision" | "tesseract";

export type ReceiptAnalysisResult = {
  ocrText: string;
  classification: ReceiptClassification;
  engine: ReceiptAnalysisEngine;
  warnings?: string[];
};

/** Vision向け: 文字色やロゴを残したまま、長辺だけ整える */
async function prepareVisionImage(buffer: Buffer): Promise<Buffer> {
  const rotated = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await rotated.metadata();
  const width = meta.width ?? 0;

  let pipeline = rotated;
  if (width > 2400) {
    pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
  } else if (width > 0 && width < 1600) {
    pipeline = pipeline.resize({ width: Math.min(2200, width * 1.5), withoutEnlargement: false });
  }

  return pipeline.jpeg({ quality: 94, mozjpeg: true }).toBuffer();
}

/** Tesseract向け: 薄いレシート文字を読みやすくする */
async function prepareOcrImage(buffer: Buffer): Promise<Buffer> {
  const rotated = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await rotated.metadata();
  const width = meta.width ?? 0;

  let pipeline = rotated;
  if (width > 2200) {
    pipeline = pipeline.resize({ width: 2200, withoutEnlargement: true });
  } else if (width > 0 && width < 1200) {
    pipeline = pipeline.resize({ width: Math.min(1800, width * 1.8), withoutEnlargement: false });
  }

  return pipeline
    .greyscale()
    .normalize()
    .linear(1.12, -8)
    .sharpen({ sigma: 1 })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function analyzeReceiptImage(
  buffer: Buffer,
  mimeType: string,
): Promise<ReceiptAnalysisResult> {
  const [visionImage, ocrImage] = await Promise.all([
    prepareVisionImage(buffer),
    prepareOcrImage(buffer),
  ]);

  if (isVisionAnalysisEnabled()) {
    const [vision, ocrText] = await Promise.all([
      analyzeWithVision(visionImage, "image/jpeg"),
      runReceiptOcr(ocrImage).catch((error) => {
        console.error("[receipt-ocr] OCR cross-check failed:", error);
        return "";
      }),
    ]);
    if (vision) {
      const combinedText = [vision.ocrText, ocrText].filter(Boolean).join("\n--- OCR CROSS CHECK ---\n");
      const merged = mergeClassifications(vision.classification, combinedText);
      return {
        ocrText: combinedText,
        classification: merged,
        engine: "openai-vision",
        warnings: merged.warnings,
      };
    }

    const classification = classifyReceipt(ocrText);
    return {
      ocrText,
      classification,
      engine: "tesseract",
      warnings: [
        ...(classification.warnings ?? []),
        "Vision解析に失敗したためOCRのみで読み取りました",
      ],
    };
  }

  const ocrText = await runReceiptOcr(ocrImage);
  const classification = classifyReceipt(ocrText);

  return {
    ocrText,
    classification,
    engine: "tesseract",
    warnings: classification.warnings,
  };
}
