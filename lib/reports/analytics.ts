import { categoryLabel, isNoProblemIssue, issueTypeLabel } from "@/lib/reports/taxonomy";

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

type EntityScore = {
  clean: number;
  downtime: number;
  high: number;
  id: string;
  label: string;
  problems: number;
  score: number;
};

type TrendPoint = {
  clean: number;
  date: string;
  downtime: number;
  high: number;
  problems: number;
  total: number;
};

function getOrCreateEntity(map: Record<string, EntityScore>, id: string, label: string) {
  map[id] ??= {
    clean: 0,
    downtime: 0,
    high: 0,
    id,
    label,
    problems: 0,
    score: 0
  };

  return map[id];
}

function calculateScore(entity: EntityScore) {
  return Math.max(
    0,
    Math.round(entity.problems * 10 + entity.high * 18 + entity.downtime * 2 - entity.clean * 1.5)
  );
}

export function getReportAnalytics(reports: OperationalReport[]) {
  const byCategory: CountMap = {};
  const bySeverity: CountMap = {};
  const byIssue: CountMap = {};
  const byDriver: CountMap = {};
  const byTruck: CountMap = {};
  const byDay: Record<string, TrendPoint> = {};
  const driverScores: Record<string, EntityScore> = {};
  const truckScores: Record<string, EntityScore> = {};
  let totalDowntime = 0;
  let highSeverity = 0;
  let noProblemReports = 0;
  let problemReports = 0;

  for (const report of reports) {
    const noProblem = isNoProblemIssue(report.issue_type);
    const downtime = Number(report.downtime_hours ?? 0);
    const high = !noProblem && ["high", "critical"].includes(report.severity);
    byDay[report.report_date] ??= {
      clean: 0,
      date: report.report_date,
      downtime: 0,
      high: 0,
      problems: 0,
      total: 0
    };
    byDay[report.report_date].total += 1;
    byDay[report.report_date].downtime += downtime;
    increment(byCategory, categoryLabel(report.category));
    increment(bySeverity, report.severity);
    if (noProblem) {
      noProblemReports += 1;
      byDay[report.report_date].clean += 1;
    } else {
      problemReports += 1;
      byDay[report.report_date].problems += 1;
      increment(byIssue, issueTypeLabel(report.category, report.issue_type));
    }

    if (high) {
      byDay[report.report_date].high += 1;
      highSeverity += 1;
    }

    if (report.driver_id && report.driver_name) {
      const driver = getOrCreateEntity(driverScores, report.driver_id, report.driver_name);

      if (noProblem) {
        driver.clean += 1;
      } else {
        driver.problems += 1;
        increment(byDriver, report.driver_name);
      }

      if (high) {
        driver.high += 1;
      }

      driver.downtime += downtime;
    }

    if (report.truck_id && report.truck_unit_number) {
      const truck = getOrCreateEntity(truckScores, report.truck_id, `Truck ${report.truck_unit_number}`);

      if (noProblem) {
        truck.clean += 1;
      } else {
        truck.problems += 1;
        increment(byTruck, `Truck ${report.truck_unit_number}`);
      }

      if (high) {
        truck.high += 1;
      }

      truck.downtime += downtime;
    }

    totalDowntime += downtime;
  }

  const scoredDrivers = Object.values(driverScores)
    .map((entity) => ({
      ...entity,
      score: calculateScore(entity)
    }))
    .sort((a, b) => b.score - a.score || b.problems - a.problems);
  const scoredTrucks = Object.values(truckScores)
    .map((entity) => ({
      ...entity,
      score: calculateScore(entity)
    }))
    .sort((a, b) => b.score - a.score || b.problems - a.problems);

  return {
    byCategory: sortedEntries(byCategory),
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    byDriver: sortedEntries(byDriver),
    byIssue: sortedEntries(byIssue),
    bySeverity: sortedEntries(bySeverity),
    byTruck: sortedEntries(byTruck),
    driverScores: scoredDrivers,
    highSeverity,
    noProblemReports,
    problemReports,
    problemRate: reports.length ? Math.round((problemReports / reports.length) * 100) : 0,
    cleanRate: reports.length ? Math.round((noProblemReports / reports.length) * 100) : 0,
    totalDowntime,
    totalReports: reports.length,
    truckScores: scoredTrucks
  };
}

function isDateString(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getDateRange(
  range: string | undefined,
  customStartDate?: string,
  customEndDate?: string
) {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  if (range === "custom" && isDateString(customStartDate) && isDateString(customEndDate)) {
    return {
      endDate: customEndDate,
      label: `${customStartDate} to ${customEndDate}`,
      startDate: customStartDate
    };
  }

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
