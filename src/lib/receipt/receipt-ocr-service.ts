import sharp from "sharp";

let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null = null;

async function getOcrWorker() {
  if (!ocrWorker) {
    const { createWorker } = await import("tesseract.js");
    ocrWorker = await createWorker("jpn+eng", 1, { logger: () => {} });
  }
  return ocrWorker;
}

/** サーバー側Tesseract OCR（Vision API未設定時のフォールバック） */
export async function runReceiptOcr(buffer: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(buffer);
  return data.text.trim();
}
