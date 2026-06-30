import { getProfitLossReport } from "@/domain/analytics/analytics-service";
import { ProfitLossGameReport } from "@/components/admin/profit-loss-game-report";
import { EmptyState } from "@/components/admin/ui";

export default async function ProfitLossReportPage() {
  let report;
  try {
    report = await getProfitLossReport({ businessDaysOnly: true });
  } catch {
    return <EmptyState message="データがありません。CSVをインポートしてください。" />;
  }

  if (report.revenue === 0) {
    return <EmptyState message="データがありません。CSVをインポートしてください。" />;
  }

  return <ProfitLossGameReport report={report} />;
}
