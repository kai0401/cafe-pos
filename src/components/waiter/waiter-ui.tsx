"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const ORANGE = "#e8912d";

export function WaiterHeader({
  title,
  backHref,
  onRefresh,
}: {
  title: string;
  backHref?: string;
  onRefresh?: () => void;
}) {
  const router = useRouter();

  return (
    <header
      className="pt-safe sticky top-0 z-20 flex h-11 shrink-0 items-center justify-between px-3 text-white"
      style={{ backgroundColor: ORANGE }}
    >
      {backHref ? (
        <Link href={backHref} className="min-w-[56px] text-[15px] leading-none">
          ‹ 戻る
        </Link>
      ) : (
        <div className="min-w-[56px]" />
      )}
      <h1 className="truncate text-[15px] font-semibold">{title}</h1>
      <button
        type="button"
        onClick={onRefresh ?? (() => router.refresh())}
        className="flex min-w-[56px] justify-end text-[18px] leading-none"
        aria-label="更新"
      >
        ↻
      </button>
    </header>
  );
}

export function WaiterRow({
  label,
  sub,
  badge,
  href,
  onClick,
}: {
  label: string;
  sub?: string;
  badge?: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    "flex min-h-[44px] w-full items-center justify-between border-b border-stone-200 bg-white px-4 py-2.5 text-left active:bg-stone-50";

  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] leading-tight text-stone-900">{label}</span>
          {badge && (
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {badge}
            </span>
          )}
        </div>
        {sub && <p className="mt-0.5 text-[12px] leading-tight text-stone-400">{sub}</p>}
      </div>
      <span className="ml-2 shrink-0 text-[16px] text-stone-300">›</span>
    </>
  );

  if (href) return <Link href={href} className={className}>{content}</Link>;
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#efefef] px-4 py-1.5 text-[12px] font-medium text-stone-500">{children}</div>
  );
}

export function WaiterBottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-safe fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-[var(--waiter-width)] border-t border-stone-200 bg-white p-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      {children}
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "danger" | "secondary";
}) {
  const colors = {
    primary: "bg-[#e8912d] text-white active:bg-[#d4821f]",
    danger: "bg-red-500 text-white active:bg-red-600",
    secondary: "border border-stone-300 bg-white text-stone-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full rounded-lg py-3 text-[16px] font-semibold disabled:opacity-40 ${colors[variant]}`}
    >
      {children}
    </button>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div
      className="fixed left-3 right-3 top-14 z-50 mx-auto max-w-[var(--waiter-width)] rounded-lg bg-stone-900/90 px-3 py-2.5 text-center text-[13px] text-white"
      onClick={onClose}
    >
      {message}
    </div>
  );
}

export function GuestCountDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: (count: number) => void;
  onCancel: () => void;
}) {
  const counts = [1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[320px] rounded-2xl bg-white p-5">
        <h2 className="mb-3 text-center text-[16px] font-bold">人数を選択</h2>
        <div className="grid grid-cols-4 gap-2">
          {counts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onConfirm(n)}
              className="rounded-xl border border-stone-200 py-3 text-[18px] font-semibold active:bg-amber-50"
            >
              {n}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="mt-3 w-full py-2.5 text-[15px] text-stone-500">
          キャンセル
        </button>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onCancel,
  confirmLabel = "OK",
}: {
  title: string;
  children: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[320px] rounded-2xl bg-white p-5">
        <h2 className="text-[16px] font-bold">{title}</h2>
        <div className="my-3">{children}</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-stone-300 py-2.5 text-[15px]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-[#e8912d] py-2.5 text-[15px] font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
