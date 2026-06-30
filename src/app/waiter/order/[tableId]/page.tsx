import { Suspense } from "react";
import { TableOrderApp } from "@/components/waiter/table-order-app";

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-stone-500">読み込み中…</div>}>
      <TableOrderApp tableId={tableId} />
    </Suspense>
  );
}
