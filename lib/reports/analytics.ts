import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";

export type OperationalReport = {
  category: string;
  created_at: string;
  created_by_name: string | null;
  downtime_hours: number | string;
  driver_id: string | null;
  driver_name: string | null;
  explanation: string;
  id: string;
  issue_type: string;
  load_reference: string | null;
  report_date: string;
  severity: string;
  truck_id: string | null;
  truck_unit_number: string | null;
};

type CountMap = Record<string, number>;

function increment(map: CountMap, key: string, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

function sortedEntries(map: CountMap) {
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function getReportAnalytics(reports: OperationalReport[]) {
  const byCategory: CountMap = {};
  const bySeverity: CountMap = {};
  const byIssue: CountMap = {};
  const byDriver: CountMap = {};
  const byTruck: CountMap = {};
  let totalDowntime = 0;
  let highSeverity = 0;

  for (const report of reports) {
    increment(byCategory, categoryLabel(report.category));
    increment(bySeverity, report.severity);
    increment(byIssue, issueTypeLabel(report.category, report.issue_type));

    if (report.driver_name) {
      increment(byDriver, report.driver_name);
    }

    if (report.truck_unit_number) {
      increment(byTruck, `Truck ${report.truck_unit_number}`);
    }

    if (["high", "critical"].includes(report.severity)) {
      highSeverity += 1;
    }

    totalDowntime += Number(report.downtime_hours ?? 0);
  }

  return {
    byCategory: sortedEntries(byCategory),
    byDriver: sortedEntries(byDriver),
    byIssue: sortedEntries(byIssue),
    bySeverity: sortedEntries(bySeverity),
    byTruck: sortedEntries(byTruck),
    highSeverity,
    totalDowntime,
    totalReports: reports.length
  };
}

export function getDateRange(range: string | undefined) {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  if (range === "all") {
    return {
      endDate: null,
      label: "All time",
      startDate: null
    };
  }

  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));

  return {
    endDate,
    label: days === 7 ? "Last 7 days" : days === 90 ? "Last 90 days" : "Last 30 days",
    startDate: start.toISOString().slice(0, 10)
  };
}
