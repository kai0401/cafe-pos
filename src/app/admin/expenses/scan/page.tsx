"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { ADMIN_INPUT_CLASS, PageHeader, UploadIcon } from "@/components/admin/ui";
import { EXPENSE_CATEGORY_LABELS, formatYen } from "@/lib/format";

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS);

type Classification = {
  amount: number | null;
  expenseDate: string;
  merchantName: string | null;
  category: string;
  confidence: number;
  matchedKeywords: string[];
};

type ScanResult = {
  imagePath: string;
  imageUrl: string;
  ocrText: string;
  engine: "openai-vision" | "tesseract";
  warnings?: string[];
  classification: Classification;
};

type ReceiptItem = {
  id: string;
  preview: string;
  ocrText: string;
  scanResult: ScanResult;
  form: {
    category: string;
    amount: string;
    expenseDate: string;
    merchantName: string;
    description: string;
  };
  status: "ready" | "saving" | "saved" | "error";
  error?: string;
};

function formFromScan(data: ScanResult) {
  return {
    category: data.classification.category,
    amount: data.classification.amount ? String(data.classification.amount) : "",
    expenseDate: data.classification.expenseDate,
    merchantName: data.classification.merchantName ?? "",
    description: data.classification.merchantName
      ? `${data.classification.merchantName}（レシート）`
      : "レシート経費",
  };
}

export default function ReceiptScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [phase, setPhase] = useState<"idle" | "processing" | "ready">("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState("");

  const processOne = useCallback(async (file: File): Promise<ReceiptItem | null> => {
    const preview = URL.createObjectURL(file);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/receipts/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        URL.revokeObjectURL(preview);
        return null;
      }
      const scanResult = data as ScanResult;
      return {
        id: crypto.randomUUID(),
        preview,
        ocrText: scanResult.ocrText,
        scanResult,
        form: formFromScan(scanResult),
        status: "ready",
      };
    } catch {
      URL.revokeObjectURL(preview);
      return null;
    }
  }, []);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;

    setPhase("processing");
    setProgress({ current: 0, total: files.length });
    setMessage("");

    const newItems: ReceiptItem[] = [];
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const item = await processOne(files[i]!);
      if (item) newItems.push(item);
      else failed++;
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
    }

    setPhase("ready");
    if (failed > 0) {
      setMessage(`${newItems.length}枚を読み取りました（${failed}枚は失敗）`);
    } else if (newItems.length > 0) {
      setMessage(`${newItems.length}枚を読み取りました`);
    }
  }

  function updateItem(id: string, patch: Partial<ReceiptItem["form"]>) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, form: { ...item.form, ...patch } } : item,
      ),
    );
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((i) => i.id !== id);
    });
  }

  async function saveAll() {
    const pending = items.filter((i) => i.status === "ready" && Number(i.form.amount) > 0);
    if (pending.length === 0) {
      setMessage("金額が入っている経費がありません");
      return;
    }

    setPhase("processing");
    let saved = 0;
    let errors = 0;

    for (const item of pending) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "saving" } : i)),
      );

      const res = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: item.form.category,
          amount: Number(item.form.amount),
          expenseDate: item.form.expenseDate,
          description: item.form.description,
          merchantName: item.form.merchantName || null,
          source: "RECEIPT_SCAN",
          receiptImagePath: item.scanResult.imagePath,
          ocrText: item.ocrText,
          classifyConfidence: item.scanResult.classification.confidence,
        }),
      });

      if (res.ok) {
        saved++;
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: "saved" } : i)),
        );
      } else {
        const data = await res.json();
        errors++;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: "error", error: data.error ?? "登録失敗" }
              : i,
          ),
        );
      }
    }

    setPhase("ready");
    setMessage(`${saved}件を登録しました${errors > 0 ? `（${errors}件失敗）` : ""}`);

    if (saved > 0 && errors === 0) {
      setTimeout(() => {
        window.location.href = "/admin/expenses";
      }, 1200);
    }
  }

  const readyCount = items.filter((i) => i.status === "ready" && Number(i.form.amount) > 0).length;
  const totalAmount = items
    .filter((i) => i.status === "ready")
    .reduce((s, i) => s + (Number(i.form.amount) || 0), 0);

  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="経費"
        title="レシート登録"
        description="写真を選ぶだけ。金額・店名・カテゴリを自動で読み取ります。"
      >
        <Link href="/admin/expenses" className="admin-btn admin-btn--ghost">
          一覧へ戻る
        </Link>
      </PageHeader>

      <section className="admin-card mb-8 overflow-hidden">
        {phase === "processing" && progress.total > 0 && (
          <div className="admin-progress">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={phase === "processing"}
          className="group flex w-full flex-col items-center px-6 py-14 transition disabled:opacity-50"
        >
          <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--admin-line)] bg-[var(--admin-paper)] text-[var(--admin-muted)] transition group-hover:border-[var(--admin-accent)] group-hover:text-[var(--admin-accent)]">
            <UploadIcon />
          </span>
          <span className="admin-brand-serif text-lg text-[var(--admin-ink)]">
            {items.length > 0 ? "レシートを追加" : "写真を選ぶ"}
          </span>
          <span className="mt-2 text-xs tracking-wide text-[var(--admin-muted)]">
            複数枚まとめて選択可 · JPEG / PNG
          </span>
        </button>
      </section>

      {phase === "processing" && progress.total > 0 && (
        <p className="mb-6 text-center text-xs tracking-widest text-[var(--admin-muted)]">
          {progress.current} / {progress.total} 枚を読み取り中
        </p>
      )}

      {items.length > 0 && (
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--admin-line)] pb-6">
          <div>
            <p className="admin-label">登録予定</p>
            <p className="admin-brand-serif mt-1 text-2xl text-[var(--admin-ink)]">
              {readyCount}
              <span className="ml-1 text-base text-[var(--admin-muted)]">件</span>
              <span className="mx-3 text-[var(--admin-line)]">|</span>
              {formatYen(totalAmount)}
            </p>
          </div>
          <button
            type="button"
            onClick={saveAll}
            disabled={phase === "processing" || readyCount === 0}
            className="admin-btn admin-btn--primary px-6 py-2.5"
          >
            {readyCount}件を登録
          </button>
        </div>
      )}

      <div className="space-y-6">
        {items.map((item, index) => (
          <article
            key={item.id}
            className={`admin-card overflow-hidden ${
              item.status === "saved"
                ? "border-[var(--admin-sage)]/40 bg-[var(--admin-sage-soft)]/30"
                : item.status === "error"
                  ? "border-[var(--admin-vermillion)]/30"
                  : ""
            }`}
          >
            <div className="flex flex-col sm:flex-row">
              <div className="relative shrink-0 border-b border-[var(--admin-line)] bg-[var(--admin-paper)] sm:w-36 sm:border-b-0 sm:border-r">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.preview}
                  alt={`レシート ${index + 1}`}
                  className="aspect-[3/4] w-full object-cover sm:aspect-auto sm:h-full sm:min-h-[11rem]"
                />
                <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center bg-[var(--admin-paper-raised)]/90 text-[11px] tabular-nums text-[var(--admin-muted)] backdrop-blur-sm">
                  {index + 1}
                </span>
              </div>

              <div className="min-w-0 flex-1 p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-[var(--admin-ink)]">
                      {item.form.merchantName || "店名未検出"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="admin-tag">
                        {EXPENSE_CATEGORY_LABELS[item.form.category]}
                      </span>
                      {item.scanResult.engine === "openai-vision" && (
                        <span className="admin-tag admin-tag--sage">自動読取</span>
                      )}
                      {item.status === "saved" && (
                        <span className="text-xs text-[var(--admin-sage)]">登録済</span>
                      )}
                      {item.status === "saving" && (
                        <span className="text-xs text-[var(--admin-muted)]">登録中…</span>
                      )}
                    </div>
                  </div>
                  {item.status !== "saved" && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 p-1 text-xs text-[var(--admin-muted)] hover:text-[var(--admin-vermillion)]"
                      aria-label="削除"
                    >
                      削除
                    </button>
                  )}
                </div>

                {item.error && (
                  <p className="mb-3 text-xs text-[var(--admin-vermillion)]">{item.error}</p>
                )}
                {item.scanResult.warnings?.map((w) => (
                  <p key={w} className="mb-1 text-xs text-[var(--admin-accent)]">
                    {w}
                  </p>
                ))}
                {item.scanResult.classification.confidence < 0.6 && (
                  <p className="mb-3 text-xs text-[var(--admin-accent)]">
                    読み取り精度が低いです。内容を確認してください
                  </p>
                )}

                {item.status !== "saved" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="admin-label">カテゴリ</label>
                      <select
                        value={item.form.category}
                        onChange={(e) => updateItem(item.id, { category: e.target.value })}
                        className={ADMIN_INPUT_CLASS}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {EXPENSE_CATEGORY_LABELS[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="admin-label">金額</label>
                      <input
                        type="number"
                        value={item.form.amount}
                        onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                        className={ADMIN_INPUT_CLASS}
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="admin-label">計上日</label>
                      <input
                        type="date"
                        value={item.form.expenseDate}
                        onChange={(e) => updateItem(item.id, { expenseDate: e.target.value })}
                        className={ADMIN_INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className="admin-label">店名</label>
                      <input
                        value={item.form.merchantName}
                        onChange={(e) => updateItem(item.id, { merchantName: e.target.value })}
                        className={ADMIN_INPUT_CLASS}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="admin-label">メモ</label>
                      <input
                        value={item.form.description}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                        className={ADMIN_INPUT_CLASS}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {message && phase === "ready" && (
        <p className="mt-8 text-center text-sm text-[var(--admin-sage)]">{message}</p>
      )}
    </div>
  );
}
