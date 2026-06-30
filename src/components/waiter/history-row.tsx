import Link from "next/link";
import { formatSmaregiYen } from "@/lib/format";

const BLUE = "#007aff";
const BORDER = "#e0e0e0";

function AmountBlock({
  count,
  total,
  muted,
}: {
  count: number;
  total: number;
  muted?: boolean;
}) {
  const color = muted ? "#a3a3a3" : BLUE;
  return (
    <div className="shrink-0 text-right" style={{ minWidth: "6.5rem" }}>
      <p className="text-[12px] leading-none" style={{ color }}>
        {count} 取引
      </p>
      <p
        className="mt-0.5 text-[18px] font-bold leading-none tabular-nums tracking-tight"
        style={{ color }}
      >
        {formatSmaregiYen(total)}
      </p>
    </div>
  );
}

export function HistoryMonthRow({
  month,
  count,
  total,
  href,
}: {
  month: string;
  count: number;
  total: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center gap-2 border-b bg-white px-4 py-2.5 active:bg-stone-50"
      style={{ borderColor: BORDER }}
    >
      <span className="min-w-0 flex-1 text-[16px] font-bold text-black">{month}</span>
      <AmountBlock count={count} total={total} />
      <span className="shrink-0 text-[16px] font-light text-[#c7c7cc]">›</span>
    </Link>
  );
}

export function HistoryDayRow({
  date,
  count,
  total,
  isClosedDay,
}: {
  date: string;
  count: number;
  total: number;
  isClosedDay?: boolean;
}) {
  const empty = count === 0;
  const muted = empty;

  return (
    <div
      className={`flex min-h-[44px] items-center gap-2 border-b px-4 py-2.5 ${muted ? "bg-[#fafafa]" : "bg-white"}`}
      style={{ borderColor: BORDER }}
    >
      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] font-bold leading-tight ${muted ? "text-stone-400" : "text-black"}`}
        >
          {date}
        </p>
        {isClosedDay && empty && (
          <p className="mt-0.5 text-[10px] text-stone-400">定休日</p>
        )}
      </div>
      <AmountBlock count={count} total={total} muted={muted} />
    </div>
  );
}
