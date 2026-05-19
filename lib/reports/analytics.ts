import { categoryLabel, isNoProblemIssue, issueTypeLabel } from "@/lib/reports/taxonomy";

export type OperationalReport = {
  category: string;
  created_at: string;
  created_by_name: string | null;
  downtime_hours: number | string;
  driver_id: string | null;
  driver_name: string | null;
  explanation: string;
  estimated_cost?: number | string | null;
  follow_up_required?: boolean | null;
  id: string;
  issue_type: string;
  load_reference: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  report_date: string;
  severity: string;
  status?: string | null;
  truck_id: string | null;
  truck_unit_number: string | null;
};

type CountMap = Record<string, number>;

const ESTIMATED_DOWNTIME_COST_PER_HOUR = 180;

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
  low: number;
  medium: number;
  problems: number;
  severe: number;
  total: number;
};

export type OperationalAlert = {
  href: string;
  impact: string;
  label: string;
  severity: "critical" | "high" | "medium";
  title: string;
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

function calculateHealthScore({
  highSeverity,
  problemReports,
  totalDowntime,
  totalReports
}: {
  highSeverity: number;
  problemReports: number;
  totalDowntime: number;
  totalReports: number;
}) {
  if (!totalReports) {
    return 100;
  }

  const problemPenalty = (problemReports / totalReports) * 42;
  const highPenalty = (highSeverity / totalReports) * 28;
  const downtimePenalty = Math.min(25, totalDowntime * 0.8);

  return Math.max(0, Math.round(100 - problemPenalty - highPenalty - downtimePenalty));
}

function getTrendDirection(current: number, previous: number, lowerIsBetter = true) {
  const delta = current - previous;

  if (Math.abs(delta) < 0.5) {
    return "flat";
  }

  return lowerIsBetter ? (delta < 0 ? "better" : "worse") : delta > 0 ? "better" : "worse";
}

export function getAnalyticsComparison(
  current: ReturnType<typeof getReportAnalytics>,
  previous: ReturnType<typeof getReportAnalytics>
) {
  const problemRateDelta = current.problemRate - previous.problemRate;
  const downtimeDelta = current.totalDowntime - previous.totalDowntime;
  const healthDelta = current.healthScore - previous.healthScore;

  return {
    downtimeDelta,
    healthDelta,
    problemRateDelta,
    downtimeDirection: getTrendDirection(current.totalDowntime, previous.totalDowntime),
    healthDirection: getTrendDirection(current.healthScore, previous.healthScore, false),
    problemRateDirection: getTrendDirection(current.problemRate, previous.problemRate)
  };
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
      low: 0,
      medium: 0,
      problems: 0,
      severe: 0,
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

      if (report.severity === "low") {
        byDay[report.report_date].low += 1;
      } else if (report.severity === "medium") {
        byDay[report.report_date].medium += 1;
      } else {
        byDay[report.report_date].severe += 1;
      }
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
  const healthScore = calculateHealthScore({
    highSeverity,
    problemReports,
    totalDowntime,
    totalReports: reports.length
  });
  const estimatedLoss = Math.round(totalDowntime * ESTIMATED_DOWNTIME_COST_PER_HOUR);
  const criticalReports = bySeverity.critical ?? 0;
  const alerts: OperationalAlert[] = [];
  const topDriver = scoredDrivers[0];
  const topTruck = scoredTrucks[0];
  const topIssue = sortedEntries(byIssue)[0];

  if (criticalReports) {
    alerts.push({
      href: "/reports?range=30d",
      impact: `${criticalReports} critical report${criticalReports === 1 ? "" : "s"} in range`,
      label: "Critical",
      severity: "critical",
      title: "Critical operating risk needs review"
    });
  }

  if (topTruck && topTruck.score >= 35) {
    alerts.push({
      href: `/reports?range=30d&truck_ids=${topTruck.id}`,
      impact: `${topTruck.problems} problems · ${topTruck.downtime.toFixed(1)}h downtime`,
      label: "Truck risk",
      severity: topTruck.high ? "high" : "medium",
      title: topTruck.label
    });
  }

  if (topDriver && topDriver.score >= 30) {
    alerts.push({
      href: `/reports?range=30d&driver_ids=${topDriver.id}`,
      impact: `${topDriver.problems} problems · ${topDriver.high} high/critical`,
      label: "Driver risk",
      severity: topDriver.high ? "high" : "medium",
      title: topDriver.label
    });
  }

  if (topIssue) {
    alerts.push({
      href: "/reports?range=30d",
      impact: `${topIssue[1]} repeated occurrence${topIssue[1] === 1 ? "" : "s"}`,
      label: "Repeated",
      severity: topIssue[1] >= 5 ? "high" : "medium",
      title: topIssue[0]
    });
  }

  return {
    alerts: alerts.slice(0, 4),
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
    criticalReports,
    estimatedLoss,
    healthScore,
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
      endDate: customEndDate ?? null,
      label: `${customStartDate} to ${customEndDate}`,
      startDate: customStartDate ?? null
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

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getDaySpan(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();

  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function getPreviousDateRange(dateRange: {
  endDate: string | null;
  startDate: string | null;
}) {
  if (!dateRange.startDate || !dateRange.endDate) {
    return {
      endDate: null,
      startDate: null
    };
  }

  const daySpan = getDaySpan(dateRange.startDate, dateRange.endDate);
  const previousEndDate = addDays(dateRange.startDate, -1);

  return {
    endDate: previousEndDate,
    startDate: addDays(previousEndDate, -(daySpan - 1))
  };
}
