import { ImportFileType, ImportSourceType } from "@prisma/client";
import { NextResponse } from "next/server";
import { buildPreviewSummary, runImportJob } from "@/domain/import/import-service";
import { detectCsvType } from "@/domain/import/smaregi-mapper";
import { hashBuffer, parseCsvBuffer } from "@/domain/import/csv-parser";
import { getDefaultStore, prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileTypeParam = formData.get("fileType") as string | null;
    const execute = formData.get("execute") === "true";

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseCsvBuffer(buffer);
    const detectedType = detectCsvType(parsed.headers);

    let fileType: ImportFileType;
    if (fileTypeParam === "PRODUCT_MASTER") fileType = ImportFileType.PRODUCT_MASTER;
    else if (fileTypeParam === "TRANSACTION_DETAIL") fileType = ImportFileType.TRANSACTION_DETAIL;
    else if (detectedType === "PRODUCT_MASTER") fileType = ImportFileType.PRODUCT_MASTER;
    else if (detectedType === "TRANSACTION_DETAIL") fileType = ImportFileType.TRANSACTION_DETAIL;
    else return NextResponse.json({ error: "CSV種別を判別できません" }, { status: 400 });

    const store = await getDefaultStore();
    const preview = buildPreviewSummary(fileType, parsed.rows);

    if (!execute) {
      return NextResponse.json({
        preview: true,
        fileType,
        encoding: parsed.encoding,
        headers: parsed.headers,
        rowCount: parsed.rows.length,
        summary: preview,
      });
    }

    const job = await prisma.smaregiImportJob.create({
      data: {
        storeId: store.id,
        sourceType: ImportSourceType.CSV,
        fileType,
        fileName: file.name,
        fileHash: hashBuffer(buffer),
        encoding: parsed.encoding,
        previewSummary: preview as object,
        totalRows: parsed.rows.length,
      },
    });

    await runImportJob(job.id, fileType, parsed.rows);
    const completed = await prisma.smaregiImportJob.findUnique({
      where: { id: job.id },
      include: { _count: { select: { errors: true } } },
    });

    return NextResponse.json({ job: completed, summary: preview });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "インポートに失敗しました" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const jobs = await prisma.smaregiImportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { _count: { select: { errors: true } } },
  });
  return NextResponse.json(jobs);
}
