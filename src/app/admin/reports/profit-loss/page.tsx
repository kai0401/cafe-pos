import { getProfitLossReport } from "@/domain/analytics/analytics-service";
import { ProfitLossReport } from "@/components/admin/profit-loss-report";
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

  return <ProfitLossReport report={report} />;
}
