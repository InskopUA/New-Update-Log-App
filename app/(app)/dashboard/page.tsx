import Link from "next/link";
import type { CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  Gauge,
  ShieldCheck,
  TimerReset,
  Zap
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

function comparisonIcon(direction: string) {
  if (direction === "flat") {
    return <Activity size={14} />;
  }

  return direction === "better" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />;
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
  const activeDrivers = driverRows.filter(
    (driver) => driver.status === "active"
  ).length;
  const truckRows = (trucks as Array<{ id: string; status: string; unit_number: string }> | null) ?? [];
  const truckOptions = truckRows
    .filter((truck) => truck.status !== "inactive")
    .map((truck) => ({
      id: truck.id,
      label: `Truck ${truck.unit_number}`
    }));
  const activeTrucks = truckRows.filter(
    (truck) => truck.status === "active"
  ).length;
  const maxTrend = Math.max(
    1,
    ...analytics.byDay.map((point) => Math.max(point.problems, point.clean))
  );
  const recentTrend = analytics.byDay.slice(-14);
  const topIssue = analytics.byIssue[0];
  const topDriver = analytics.driverScores[0];
  const topTruck = analytics.truckScores[0];
  const severityTotal = analytics.bySeverity.reduce((total, [, value]) => total + value, 0);

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

      <section className="command-hero">
        <div className="health-orb" style={{ "--score": `${analytics.healthScore}%` } as CSSProperties}>
          <div className="health-orb-inner">
            <Gauge size={22} />
            <strong>{analytics.healthScore}</strong>
            <span>Fleet health</span>
          </div>
        </div>
        <div className="command-copy">
          <div className="eyebrow">Operations intelligence</div>
          <h2>Know what needs attention before it becomes expensive.</h2>
          <p>
            {analytics.totalReports
              ? `${analytics.problemReports} problem checks, ${analytics.highSeverity} high-risk signals, and ${analytics.totalDowntime.toFixed(1)}h downtime in ${dateRange.label.toLowerCase()}.`
              : "No operating signal yet. Add daily reports to build your fleet baseline."}
          </p>
          <div className="command-signal-row">
            <span className={comparisonClass(comparison.healthDirection)}>
              {comparisonIcon(comparison.healthDirection)}
              {formatDelta(comparison.healthDelta)} health vs previous period
            </span>
            <span className={comparisonClass(comparison.problemRateDirection)}>
              {comparisonIcon(comparison.problemRateDirection)}
              {formatDelta(comparison.problemRateDelta, "%")} problem rate
            </span>
          </div>
        </div>
        <div className="command-alert-stack">
          {analytics.alerts.length ? (
            analytics.alerts.map((alert) => (
              <Link className={`alert-plaque alert-${alert.severity}`} href={alert.href} key={`${alert.label}-${alert.title}`}>
                <span className="alert-icon"><AlertTriangle size={16} /></span>
                <span>
                  <small>{alert.label}</small>
                  <strong>{alert.title}</strong>
                  <em>{alert.impact}</em>
                </span>
              </Link>
            ))
          ) : (
            <div className="alert-plaque alert-calm">
              <span className="alert-icon"><ShieldCheck size={16} /></span>
              <span>
                <small>Clear</small>
                <strong>No priority alerts</strong>
                <em>Keep reports consistent to protect the trend.</em>
              </span>
            </div>
          )}
        </div>
      </section>

      <div className="ops-hero">
        <section className="neon-card neon-blue signal-card">
          <Activity size={18} />
          <div>
            <div className="stat-label">Problem rate</div>
            <div className="neon-value">{analytics.problemRate}%</div>
            <div className="stat-note">
              {analytics.problemReports} problems from {analytics.totalReports} checks
            </div>
          </div>
        </section>
        <section className="neon-card neon-green signal-card">
          <ShieldCheck size={18} />
          <div>
            <div className="stat-label">Clean checks</div>
            <div className="neon-value">{analytics.cleanRate}%</div>
            <div className="stat-note">{analytics.noProblemReports} no-problem checks</div>
          </div>
        </section>
        <section className="neon-card neon-orange signal-card">
          <TimerReset size={18} />
          <div>
            <div className="stat-label">Downtime</div>
            <div className="neon-value">{analytics.totalDowntime.toFixed(1)}h</div>
            <div className="stat-note">
              <span className={comparisonClass(comparison.downtimeDirection)}>
                {comparisonIcon(comparison.downtimeDirection)}
                {formatDelta(comparison.downtimeDelta, "h")}
              </span>
            </div>
          </div>
        </section>
        <section className="neon-card neon-red signal-card">
          <CircleDollarSign size={18} />
          <div>
            <div className="stat-label">Est. loss</div>
            <div className="neon-value neon-text-sm">{formatCurrency(analytics.estimatedLoss)}</div>
            <div className="stat-note">{topIssue?.[0] ?? "No pressure yet"}</div>
          </div>
        </section>
      </div>

      <div className="dashboard-grid-main">
        <section className="panel chart-panel">
          <div className="panel-header">
            <h2 className="panel-title">Daily operating trend</h2>
            <span className="stat-note">{dateRange.label}</span>
          </div>
          <div className="trend-chart">
            {recentTrend.length ? (
              recentTrend.map((point) => (
                <div className="trend-day" key={point.date}>
                  <div className="trend-bars">
                    <span
                      className="trend-bar trend-bar-problem"
                      style={{ height: `${Math.max(8, (point.problems / maxTrend) * 100)}%` }}
                    />
                    <span
                      className="trend-bar trend-bar-clean"
                      style={{ height: `${Math.max(8, (point.clean / maxTrend) * 100)}%` }}
                    />
                    <span
                      className="trend-bar trend-bar-downtime"
                      style={{ height: `${Math.max(8, (point.downtime / Math.max(1, analytics.totalDowntime)) * 100)}%` }}
                    />
                  </div>
                  <span className="trend-label">
                    {new Date(`${point.date}T00:00:00`).toLocaleDateString("en-US", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </span>
                </div>
              ))
            ) : (
              <div className="empty">No trend data yet.</div>
            )}
          </div>
          <div className="chart-legend">
            <span><i className="legend-problem" /> Problems</span>
            <span><i className="legend-clean" /> Clean</span>
            <span><i className="legend-downtime" /> Downtime</span>
          </div>
        </section>

        <section className="panel chart-panel">
          <div className="panel-header">
            <h2 className="panel-title">Fleet pulse</h2>
            <span className="stat-note">{activeDrivers} drivers / {activeTrucks} trucks</span>
          </div>
          <div className="pulse-grid">
            {analytics.byCategory.map(([label, value]) => (
              <div className="pulse-item" key={label}>
                <div
                  className="pulse-ring"
                  style={{ "--value": `${percent(value, analytics.totalReports)}%` } as CSSProperties}
                >
                  <span>{percent(value, analytics.totalReports)}%</span>
                </div>
                <div>
                  <div className="pulse-label">{label}</div>
                  <div className="stat-note">{value} checks</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="ops-insight-grid">
        <section className="insight-panel">
          <div>
            <span className="insight-kicker">Top pressure</span>
            <strong>{topIssue?.[0] ?? "No repeated issue"}</strong>
            <p>{topIssue ? `${topIssue[1]} reports need pattern review.` : "Clean signal so far."}</p>
          </div>
          <Zap size={26} />
        </section>
        <section className="insight-panel">
          <div>
            <span className="insight-kicker">Driver risk</span>
            <strong>{topDriver?.label ?? "No driver risk"}</strong>
            <p>{topDriver ? `${topDriver.problems} problems, ${topDriver.clean} clean checks.` : "No driver reports yet."}</p>
          </div>
          <Activity size={26} />
        </section>
        <section className="insight-panel">
          <div>
            <span className="insight-kicker">Truck risk</span>
            <strong>{topTruck?.label ?? "No truck risk"}</strong>
            <p>{topTruck ? `${topTruck.downtime.toFixed(1)}h downtime, score ${topTruck.score}.` : "No truck reports yet."}</p>
          </div>
          <TimerReset size={26} />
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel title="Repeated problems">
          {analytics.byIssue.length ? (
            analytics.byIssue.slice(0, 6).map(([label, value]) => (
              <div className="metric-row metric-row-modern" key={label}>
                <span className="metric-label">{label}</span>
                <span className="metric-bar">
                  <span
                    className="metric-bar-fill"
                    style={{ width: `${Math.max(8, (value / analytics.totalReports) * 100)}%` }}
                  />
                </span>
                <span>{value}</span>
              </div>
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
