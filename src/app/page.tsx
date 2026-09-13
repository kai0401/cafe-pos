import Link from "next/link";

const LINKS = [
  {
    href: "/waiter/tables",
    title: "ウェイター",
    desc: "テーブル一覧・注文・会計",
    tone: "bg-[#e8912d] text-white",
  },
  {
    href: "/kitchen",
    title: "キッチンモニター",
    desc: "調理伝票・提供状況",
    tone: "bg-stone-900 text-white",
  },
  {
    href: "/admin/dashboard",
    title: "管理画面",
    desc: "売上・締め・CSV・設定",
    tone: "bg-white text-stone-900 border border-stone-200",
  },
  {
    href: "/admin/qr",
    title: "QRオーダー",
    desc: "テーブルQRシール印刷",
    tone: "bg-white text-stone-900 border border-stone-200",
  },
  {
    href: "/waiter/connect",
    title: "接続ガイド",
    desc: "スタッフ端末のセットアップ",
    tone: "bg-white text-stone-900 border border-stone-200",
  },
  {
    href: "/admin/closing",
    title: "レジ締め",
    desc: "日次締め・スマレジ形式CSV",
    tone: "bg-white text-stone-900 border border-stone-200",
  },
] as const;

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f1ea] px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-[12px] font-medium tracking-[0.22em] text-stone-500">CAFE POS</p>
        <h1 className="mt-2 text-[32px] font-semibold tracking-tight text-stone-900">あづま家</h1>
        <p className="mt-2 text-[15px] text-stone-600">使う画面を選んでください（別タブで開きます）</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`rounded-2xl px-5 py-5 shadow-sm transition active:scale-[0.99] ${link.tone}`}
            >
              <p className="text-[18px] font-semibold">{link.title}</p>
              <p className={`mt-1 text-[13px] ${link.tone.includes("text-white") ? "text-white/80" : "text-stone-500"}`}>
                {link.desc}
              </p>
            </a>
          ))}
        </div>

        <p className="mt-8 text-[12px] text-stone-400">
          同じタブで開く場合は{" "}
          <Link href="/waiter/tables" className="underline">
            こちら
          </Link>
        </p>
      </div>
    </main>
  );
}
