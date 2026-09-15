import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffAccessForm } from "./staff-access-form";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

function nextPath(sp: { next?: string | string[] }): string {
  const raw = sp.next;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/** PIN画面でも /remote 向けなら遠隔売上の名前・アイコンにする */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const next = nextPath(await searchParams);
  if (next.startsWith("/remote")) {
    return {
      title: "遠隔売上",
      manifest: "/manifest-remote.json",
      appleWebApp: {
        capable: true,
        title: "遠隔売上",
        statusBarStyle: "black-translucent",
      },
      icons: {
        apple: [{ url: "/icons/remote-icon-180.png", sizes: "180x180", type: "image/png" }],
        icon: [
          { url: "/icons/remote-icon-192.png", sizes: "192x192", type: "image/png" },
          { url: "/icons/remote-icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      other: { "mobile-web-app-capable": "yes" },
    };
  }

  return {
    title: "スタッフ認証",
    appleWebApp: { capable: true, title: "Cafe POS" },
  };
}

export default function StaffAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f1ea] px-6">
      <Suspense fallback={null}>
        <StaffAccessForm />
      </Suspense>
    </main>
  );
}
