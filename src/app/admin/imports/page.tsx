"use client";

import { useState } from "react";
import { FILE_TYPE_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

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

export default function ImportsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState("AUTO");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

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
      <PageHeader title="CSVインポート" description="スマレジ管理画面から出力したCSVを取り込みます" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700">CSV種別</label>
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              >
                <option value="AUTO">自動判別</option>
                <option value="PRODUCT_MASTER">商品マスター</option>
                <option value="TRANSACTION_DETAIL">取引明細</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">CSVファイル</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                }}
                className="mt-1 w-full text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handlePreview}
                disabled={!file || loading}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 disabled:opacity-50"
              >
                プレビュー
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                インポート実行
              </button>
              <button
                onClick={loadJobs}
                className="rounded-lg border border-stone-300 px-4 py-2 text-sm"
              >
                履歴更新
              </button>
            </div>
            {message && <p className="text-sm text-amber-800">{message}</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-stone-800">プレビュー</h2>
          {!preview ? (
            <p className="mt-4 text-sm text-stone-500">ファイルを選んでプレビューを実行してください</p>
          ) : (
            <div className="mt-4 space-y-2 text-sm">
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
                <ul className="mt-2 list-disc pl-5">
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

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">インポート履歴</h2>
        <button onClick={loadJobs} className="mb-4 text-sm text-amber-700 hover:underline">
          履歴を読み込む
        </button>
        {jobs.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-stone-50 text-left">
                <tr>
                  <th className="px-4 py-3">日時</th>
                  <th className="px-4 py-3">ファイル</th>
                  <th className="px-4 py-3">種別</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-4 py-3">成功</th>
                  <th className="px-4 py-3">スキップ</th>
                  <th className="px-4 py-3">失敗</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">{new Date(job.createdAt).toLocaleString("ja-JP")}</td>
                    <td className="px-4 py-3">{job.fileName}</td>
                    <td className="px-4 py-3">{FILE_TYPE_LABELS[job.fileType] ?? job.fileType}</td>
                    <td className="px-4 py-3">{job.status}</td>
                    <td className="px-4 py-3">{job.successRows}</td>
                    <td className="px-4 py-3">{job.skippedRows}</td>
                    <td className="px-4 py-3">{job.failedRows}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
