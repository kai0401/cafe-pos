"use client";

import { Fragment, useState } from "react";
import { FILE_TYPE_LABELS } from "@/lib/format";
import { ADMIN_INPUT_CLASS, PageHeader } from "@/components/admin/ui";

type PreviewResult = {
  fileType: string;
  encoding: string;
  rowCount: number;
  summary: {
    rowCount?: number;
    transactionCount?: number;
    totalAmount?: number;
    dateRange?: { from: string; to: string };
    sampleProducts?: { id: string; name: string; price: number }[];
  };
};

type Job = {
  id: string;
  fileName: string | null;
  fileType: string;
  status: string;
  successRows: number;
  failedRows: number;
  skippedRows: number;
  createdAt: string;
  resultSummary: Record<string, number> | null;
  _count: { errors: number };
};

type JobError = {
  id: string;
  rowNumber: number;
  errorCode: string;
  errorMessage: string;
};

export default function ImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("AUTO");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobErrors, setJobErrors] = useState<JobError[]>([]);

  async function toggleErrors(job: Job) {
    if (expandedJobId === job.id) {
      setExpandedJobId(null);
      return;
    }
    const res = await fetch(`/api/imports/${job.id}`);
    const data = await res.json();
    setJobErrors(data.errors ?? []);
    setExpandedJobId(job.id);
  }

  async function loadJobs() {
    const res = await fetch("/api/imports");
    setJobs(await res.json());
  }

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setMessage("");
    const fd = new FormData();
    fd.append("file", file);
    if (fileType !== "AUTO") fd.append("fileType", fileType);
    const res = await fetch("/api/imports", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "プレビュー失敗");
      return;
    }
    setPreview(data);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setMessage("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("execute", "true");
    if (fileType !== "AUTO") fd.append("fileType", fileType);
    const res = await fetch("/api/imports", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "インポート失敗");
      return;
    }
    setMessage(`インポート完了: 成功 ${data.job.successRows} / スキップ ${data.job.skippedRows} / 失敗 ${data.job.failedRows}`);
    setPreview(null);
    await loadJobs();
  }

  return (
    <>
      <PageHeader
        eyebrow="IMPORT"
        title="CSVインポート"
        description="スマレジの過去売上を同じ形式で取り込み、経営データとしてダッシュボードで見られます"
      />

      <section className="admin-card mb-6 space-y-3 p-6 text-sm">
        <p className="font-medium text-[var(--admin-ink)]">スマレジからの出し方（パソコンで）</p>
        <ol className="list-decimal space-y-2 pl-5 text-[var(--admin-muted)]">
          <li>スマレジ管理画面にログインする</li>
          <li>
            <strong className="text-[var(--admin-ink)]">商品マスター</strong>
            をCSVでダウンロードする（初回だけ）
          </li>
          <li>
            <strong className="text-[var(--admin-ink)]">取引明細</strong>
            を期間指定でCSVダウンロードする（過去分はできるだけ長く。分割でも可）
          </li>
          <li>下でファイルを選び、「プレビュー」→問題なければ「インポート実行」</li>
          <li>
            取り込んだあとは
            <a href="/admin/dashboard" className="mx-1 text-[var(--admin-accent)] underline-offset-2 hover:underline">
              ダッシュボード
            </a>
            ・日別売上などで確認できます
          </li>
        </ol>
        <p className="text-xs text-[var(--admin-muted)]">
          同じ取引は二重に入りません。追加で出したCSVも安全に足せます。元のCSVはパソコンに保管しておいてください。
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="admin-card p-6">
          <div className="space-y-5">
            <div>
              <label className="admin-label">CSV種別</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className={ADMIN_INPUT_CLASS}
              >
                <option value="AUTO">自動判別</option>
                <option value="PRODUCT_MASTER">商品マスター</option>
                <option value="TRANSACTION_DETAIL">取引明細</option>
              </select>
            </div>
            <div>
              <label className="admin-label">CSVファイル</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="w-full text-sm text-[var(--admin-ink)] file:mr-3 file:cursor-pointer file:rounded-full file:border file:border-[var(--admin-line)] file:bg-[var(--admin-paper-raised)] file:px-4 file:py-2 file:text-sm file:font-medium file:text-[var(--admin-ink)]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="admin-btn admin-btn--ghost disabled:opacity-50"
              >
                プレビュー
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="admin-btn admin-btn--accent disabled:opacity-50"
              >
                インポート実行
              </button>
              <button onClick={loadJobs} className="admin-btn admin-btn--ghost">
                履歴更新
              </button>
            </div>
            {message && (
              <p className="rounded-lg bg-[var(--admin-accent-soft)] px-4 py-2.5 text-sm text-[var(--admin-ink)]">
                {message}
              </p>
            )}
          </div>
        </section>

        <section className="admin-card p-6">
          <h2 className="admin-title admin-brand-serif text-base">プレビュー</h2>
          {!preview ? (
            <p className="mt-4 text-sm text-[var(--admin-muted)]">
              ファイルを選んでプレビューを実行してください
            </p>
          ) : (
            <div className="mt-4 space-y-2 text-sm text-[var(--admin-ink)]">
              <p>種別: {FILE_TYPE_LABELS[preview.fileType] ?? preview.fileType}</p>
              <p>文字コード: {preview.encoding}</p>
              <p>行数: {preview.rowCount.toLocaleString()}</p>
              {preview.summary.transactionCount !== undefined && (
                <>
                  <p>取引数: {preview.summary.transactionCount.toLocaleString()}</p>
                  <p>合計金額: ¥{preview.summary.totalAmount?.toLocaleString()}</p>
                  <p>
                    期間: {preview.summary.dateRange?.from} 〜 {preview.summary.dateRange?.to}
                  </p>
                </>
              )}
              {preview.summary.sampleProducts && (
                <ul className="mt-2 list-disc pl-5 text-[var(--admin-muted)]">
                  {preview.summary.sampleProducts.map((p) => (
                    <li key={p.id}>
                      {p.name} (¥{p.price.toLocaleString()})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="admin-title admin-brand-serif text-base">インポート履歴</h2>
          <button
            onClick={loadJobs}
            className="text-sm text-[var(--admin-accent)] underline-offset-4 hover:underline"
          >
            履歴を読み込む
          </button>
        </div>
        {jobs.length === 0 ? (
          <div className="admin-card border-dashed p-10 text-center">
            <p className="text-sm text-[var(--admin-muted)]">
              「履歴を読み込む」を押すと過去のインポートが表示されます
            </p>
          </div>
        ) : (
          <div className="admin-card overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--admin-line)] text-left text-[var(--admin-muted)]">
                <tr>
                  {["日時", "ファイル", "種別", "状態", "成功", "スキップ", "失敗"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-medium tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <Fragment key={job.id}>
                    <tr className="border-t border-[var(--admin-line)]/60">
                      <td className="px-4 py-3 text-[var(--admin-muted)]">
                        {new Date(job.createdAt).toLocaleString("ja-JP")}
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-ink)]">{job.fileName}</td>
                      <td className="px-4 py-3 text-[var(--admin-ink)]">
                        {FILE_TYPE_LABELS[job.fileType] ?? job.fileType}
                      </td>
                      <td className="px-4 py-3 text-[var(--admin-muted)]">{job.status}</td>
                      <td className="px-4 py-3 tabular-nums text-[var(--admin-ink)]">{job.successRows}</td>
                      <td className="px-4 py-3 tabular-nums text-[var(--admin-muted)]">{job.skippedRows}</td>
                      <td className="px-4 py-3 tabular-nums">
                        {job.failedRows > 0 || job._count.errors > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleErrors(job)}
                            className="font-medium text-[var(--admin-vermillion)] underline underline-offset-4"
                          >
                            {job.failedRows}件 {expandedJobId === job.id ? "▲" : "▼"}
                          </button>
                        ) : (
                          job.failedRows
                        )}
                      </td>
                    </tr>
                    {expandedJobId === job.id && (
                      <tr className="border-t border-[var(--admin-line)]/60 bg-[var(--admin-accent-soft)]/50">
                        <td colSpan={7} className="px-4 py-3">
                          {jobErrors.length === 0 ? (
                            <p className="text-[var(--admin-muted)]">エラー詳細はありません</p>
                          ) : (
                            <ul className="max-h-64 space-y-1 overflow-y-auto text-xs">
                              {jobErrors.map((err) => (
                                <li key={err.id}>
                                  <span className="font-mono text-[var(--admin-vermillion)]">
                                    行{err.rowNumber}
                                  </span>{" "}
                                  <span className="text-[var(--admin-muted)]">[{err.errorCode}]</span>{" "}
                                  {err.errorMessage}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
