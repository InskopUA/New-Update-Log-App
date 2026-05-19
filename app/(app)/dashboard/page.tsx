import Link from "next/link";
import {
  Activity,
  CircleDollarSign,
  Gauge,
  TimerReset
} from "lucide-react";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getAnalyticsComparison,
  getDateRange,
  getPreviousDateRange,
  getReportAnalytics,
  type OperationalReport
} from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { ReportRangeFilters } from "@/components/reports/report-range-filters";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type DashboardPageProps = {
  searchParams: Promise<{
    driver_ids?: string;
    end_date?: string;
    range?: string;
    start_date?: string;
    truck_ids?: string;
  }>;
};

function getSelectedIds(value: string | undefined) {
  return value ? value.split(",").filter(Boolean) : [];
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function formatDelta(value: number, suffix = "") {
  if (!value) {
    return `0${suffix}`;
  }

  return `${value > 0 ? "+" : ""}${Math.round(value * 10) / 10}${suffix}`;
}

function comparisonClass(direction: string) {
  return `signal-delta signal-${direction}`;
}

function buildReportsHref({
  driverId,
  endDate,
  range,
  startDate,
  truckId
}: {
  driverId?: string;
  endDate?: string | null;
  range: string;
  startDate?: string | null;
  truckId?: string;
}) {
  const params = new URLSearchParams({ range });

  if (startDate) {
    params.set("start_date", startDate);
  }

  if (endDate) {
    params.set("end_date", endDate);
  }

  if (driverId) {
    params.set("driver_ids", driverId);
  }

  if (truckId) {
    params.set("truck_ids", truckId);
  }

  return `/reports?${params.toString()}`;
}

type TrendMetric = "clean" | "low" | "medium" | "severe";

type TrendPoint = ReturnType<typeof getReportAnalytics>["byDay"][number];

const trendSeries: Array<{
  color: string;
  key: TrendMetric;
  label: string;
}> = [
  { color: "#10b981", key: "clean", label: "No problems" },
  { color: "#facc15", key: "low", label: "Low" },
  { color: "#f97316", key: "medium", label: "Medium" },
  { color: "#f43f5e", key: "severe", label: "High / Critical" }
];

function trendValue(point: TrendPoint, key: TrendMetric) {
  return Number(point[key] ?? 0);
}

function buildLinePoints(points: TrendPoint[], key: TrendMetric, maxValue: number) {
  const left = 54;
  const top = 32;
  const width = 880;
  const height = 226;

  return points
    .map((point, index) => {
      const x = points.length === 1 ? left + width / 2 : left + (index / (points.length - 1)) * width;
      const y = top + height - (trendValue(point, key) / maxValue) * height;

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function formatTrendDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short"
  });
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const range = params.range ?? "30d";
  const dateRange = getDateRange(range, params.start_date, params.end_date);
  const previousDateRange = getPreviousDateRange(dateRange);
  const selectedDriverIds = getSelectedIds(params.driver_ids);
  const selectedTruckIds = getSelectedIds(params.truck_ids);
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;

  const [{ data: reports }, { data: previousReports }, { data: drivers }, { data: trucks }] = await Promise.all([
    supabase.rpc("get_operational_reports", {
      end_date: dateRange.endDate,
      start_date: dateRange.startDate,
      target_company_id: companyId
    }),
    previousDateRange.startDate
      ? supabase.rpc("get_operational_reports", {
          end_date: previousDateRange.endDate,
          start_date: previousDateRange.startDate,
          target_company_id: companyId
        })
      : Promise.resolve({ data: [] }),
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    }),
    supabase.rpc("get_trucks", {
      target_company_id: companyId
    })
  ]);

  const reportRows = ((reports as OperationalReport[] | null) ?? []).filter(
    (report) =>
      (!selectedDriverIds.length || selectedDriverIds.includes(report.driver_id ?? "")) &&
      (!selectedTruckIds.length || selectedTruckIds.includes(report.truck_id ?? ""))
  );
  const previousReportRows = ((previousReports as OperationalReport[] | null) ?? []).filter(
    (report) =>
      (!selectedDriverIds.length || selectedDriverIds.includes(report.driver_id ?? "")) &&
      (!selectedTruckIds.length || selectedTruckIds.includes(report.truck_id ?? ""))
  );
  const analytics = getReportAnalytics(reportRows);
  const previousAnalytics = getReportAnalytics(previousReportRows);
  const comparison = getAnalyticsComparison(analytics, previousAnalytics);
  const driverRows = (drivers as Array<{ full_name: string; id: string; status: string }> | null) ?? [];
  const driverOptions = driverRows
    .filter((driver) => driver.status === "active")
    .map((driver) => ({
      id: driver.id,
      label: driver.full_name
    }));
  const truckRows = (trucks as Array<{ id: string; status: string; unit_number: string }> | null) ?? [];
  const truckOptions = truckRows
    .filter((truck) => truck.status !== "inactive")
    .map((truck) => ({
      id: truck.id,
      label: `Truck ${truck.unit_number}`
    }));
  const recentTrend = analytics.byDay.slice(-14);
  const maxTrend = Math.max(
    1,
    ...recentTrend.flatMap((point) => [
      point.clean,
      point.low,
      point.medium,
      point.severe
    ])
  );
  const topIssue = analytics.byIssue[0];
  const severityTotal = analytics.bySeverity.reduce((total, [, value]) => total + value, 0);
  const chartDates = recentTrend.filter((_, index) => {
    if (recentTrend.length <= 7) {
      return true;
    }

    return index === 0 || index === recentTrend.length - 1 || index % 3 === 0;
  });

  return (
    <>
      <PageHeader
        action={
          <ReportRangeFilters
            activeRange={range}
            basePath="/dashboard"
            drivers={driverOptions}
            endDate={dateRange.endDate}
            selectedDriverIds={selectedDriverIds}
            selectedTruckIds={selectedTruckIds}
            startDate={dateRange.startDate}
            trucks={truckOptions}
          />
        }
        description="Live operating signal from daily reports, clean checks, downtime, and repeated problems."
        title="Command Center"
      />

      <div className="modern-kpi-grid">
        <section className="modern-kpi-card kpi-health">
          <div className="modern-kpi-icon">
            <Gauge size={22} />
          </div>
          <span>Fleet Health</span>
          <strong>{analytics.healthScore}</strong>
          <em>{formatDelta(comparison.healthDelta)} vs previous period</em>
          <div className="kpi-progress">
            <span style={{ width: `${analytics.healthScore}%` }} />
          </div>
        </section>
        <section className="modern-kpi-card">
          <div className="modern-kpi-icon icon-cyan">
            <Activity size={22} />
          </div>
          <span>Problem Rate</span>
          <strong>{analytics.problemRate}%</strong>
          <em>{analytics.problemReports} problems from {analytics.totalReports} checks</em>
        </section>
        <section className="modern-kpi-card">
          <div className="modern-kpi-icon icon-orange">
            <TimerReset size={22} />
          </div>
          <span>Downtime</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em className={comparisonClass(comparison.downtimeDirection)}>
            {formatDelta(comparison.downtimeDelta, "h")} vs previous
          </em>
        </section>
        <section className="modern-kpi-card">
          <div className="modern-kpi-icon icon-green">
            <CircleDollarSign size={22} />
          </div>
          <span>Est. Loss</span>
          <strong>{formatCurrency(analytics.estimatedLoss)}</strong>
          <em>{topIssue?.[0] ?? "No pressure yet"}</em>
        </section>
      </div>

      <div className="dashboard-trend-main">
        <section className="panel chart-panel">
          <div className="panel-header">
            <h2 className="panel-title">Daily operating trend</h2>
            <span className="stat-note">{dateRange.label}</span>
          </div>
          <div className="line-trend-wrap">
            {recentTrend.length ? (
              <svg aria-label="Daily operating trend" className="line-trend-chart" role="img" viewBox="0 0 1000 320">
                <defs>
                  <filter id="trendGlow" x="-20%" y="-40%" width="140%" height="180%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {[0, 1, 2, 3].map((line) => (
                  <line
                    className="chart-grid-line"
                    key={line}
                    x1="54"
                    x2="934"
                    y1={32 + line * 75}
                    y2={32 + line * 75}
                  />
                ))}
                {trendSeries.map((series) => (
                  <polyline
                    className="animated-trend-line"
                    fill="none"
                    filter="url(#trendGlow)"
                    key={series.key}
                    points={buildLinePoints(recentTrend, series.key, maxTrend)}
                    stroke={series.color}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="5"
                  />
                ))}
                {recentTrend.map((point, index) =>
                  trendSeries.map((series) => {
                    const left = 54;
                    const top = 32;
                    const width = 880;
                    const height = 226;
                    const x = recentTrend.length === 1 ? left + width / 2 : left + (index / (recentTrend.length - 1)) * width;
                    const y = top + height - (trendValue(point, series.key) / maxTrend) * height;

                    return (
                      <circle
                        cx={x}
                        cy={y}
                        fill={series.color}
                        key={`${point.date}-${series.key}`}
                        r="4.5"
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                    );
                  })
                )}
                {chartDates.map((point) => {
                  const index = recentTrend.findIndex((trendPoint) => trendPoint.date === point.date);
                  const x = recentTrend.length === 1 ? 494 : 54 + (index / (recentTrend.length - 1)) * 880;

                  return (
                    <text className="chart-date-label" key={point.date} textAnchor="middle" x={x} y="300">
                      {formatTrendDate(point.date)}
                    </text>
                  );
                })}
              </svg>
            ) : (
              <div className="empty">No trend data yet.</div>
            )}
          </div>
          <div className="chart-legend">
            {trendSeries.map((series) => (
              <span key={series.key}>
                <i style={{ background: series.color }} />
                {series.label}
              </span>
            ))}
          </div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel title="Repeated problems">
          {analytics.byIssue.length ? (
            analytics.byIssue.slice(0, 6).map(([label, value]) => (
              <Link
                className="metric-row metric-row-modern metric-row-link"
                href={buildReportsHref({
                  endDate: dateRange.endDate,
                  range,
                  startDate: dateRange.startDate
                }) + `&q=${encodeURIComponent(label)}`}
                key={label}
              >
                <span className="metric-label">{label}</span>
                <span className="metric-bar">
                  <span
                    className="metric-bar-fill"
                    style={{ width: `${Math.max(8, (value / analytics.totalReports) * 100)}%` }}
                  />
                </span>
                <span>{value}</span>
              </Link>
            ))
          ) : (
            <div className="empty">No problems reported yet.</div>
          )}
        </Panel>

        <Panel title="Drivers to watch">
          {analytics.driverScores.length ? (
            analytics.driverScores.slice(0, 6).map((driver) => (
              <Link
                className="entity-score-row"
                href={buildReportsHref({
                  driverId: driver.id,
                  endDate: dateRange.endDate,
                  range,
                  startDate: dateRange.startDate
                })}
                key={driver.id}
              >
                <span>
                  <strong>{driver.label}</strong>
                  <small>{driver.problems} problems · {driver.high} high risk · {driver.clean} clean</small>
                </span>
                <b>{driver.score}</b>
              </Link>
            ))
          ) : (
            <div className="empty">No driver reports yet.</div>
          )}
        </Panel>

        <Panel title="Trucks to watch">
          {analytics.truckScores.length ? (
            analytics.truckScores.slice(0, 6).map((truck) => (
              <Link
                className="entity-score-row"
                href={buildReportsHref({
                  endDate: dateRange.endDate,
                  range,
                  startDate: dateRange.startDate,
                  truckId: truck.id
                })}
                key={truck.id}
              >
                <span>
                  <strong>{truck.label}</strong>
                  <small>{truck.problems} problems · {truck.high} high risk · {truck.downtime.toFixed(1)}h downtime</small>
                </span>
                <b>{truck.score}</b>
              </Link>
            ))
          ) : (
            <div className="empty">No truck reports yet.</div>
          )}
        </Panel>
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Panel title="Severity mix">
          {analytics.bySeverity.length ? (
            <div className="severity-mix">
              {analytics.bySeverity.map(([label, value]) => (
                <div className="severity-mix-row" key={label}>
                  <span className={`badge badge-${label}`}>{label}</span>
                  <span className="metric-bar">
                    <span
                      className={`metric-bar-fill metric-fill-${label}`}
                      style={{ width: `${Math.max(8, (value / severityTotal) * 100)}%` }}
                    />
                  </span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No severity data yet.</div>
          )}
        </Panel>

        <Panel title="Category breakdown">
          {analytics.byCategory.length ? (
            <div className="category-breakdown">
              {analytics.byCategory.map(([label, value]) => (
                <div className="category-breakdown-item" key={label}>
                  <strong>{label}</strong>
                  <span>{value} checks</span>
                  <em>{percent(value, analytics.totalReports)}%</em>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No category data yet.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Latest reports">
          {reportRows.length ? (
            <table className="table modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Problem</th>
                  <th>Severity</th>
                  <th>Driver / Truck</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.slice(0, 8).map((report) => (
                  <tr key={report.id}>
                    <td>{report.report_date}</td>
                    <td>{categoryLabel(report.category)}</td>
                    <td>{issueTypeLabel(report.category, report.issue_type)}</td>
                    <td>
                      <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                    </td>
                    <td>
                      <div>{report.driver_name || "No driver"}</div>
                      <div className="stat-note">
                        {report.truck_unit_number ? `Truck ${report.truck_unit_number}` : "No truck"}
                      </div>
                    </td>
                    <td>{report.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No reports yet. Use Add report in the header.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
