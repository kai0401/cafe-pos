import { Suspense } from "react";
import MenuPageClient from "./menu-page-client";

export default function MenuPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-stone-500">読み込み中…</div>}>
      <MenuPageClient />
    </Suspense>
  );
}
