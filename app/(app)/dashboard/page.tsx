import Link from "next/link";
import type { CSSProperties } from "react";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getDateRange,
  getReportAnalytics,
  type OperationalReport
} from "@/lib/reports/analytics";
import { issueTypeLabel } from "@/lib/reports/taxonomy";
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
  const selectedDriverIds = getSelectedIds(params.driver_ids);
  const selectedTruckIds = getSelectedIds(params.truck_ids);
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;

  const [{ data: reports }, { data: drivers }, { data: trucks }] = await Promise.all([
    supabase.rpc("get_operational_reports", {
      end_date: dateRange.endDate,
      start_date: dateRange.startDate,
      target_company_id: companyId
    }),
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
  const analytics = getReportAnalytics(reportRows);
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
  const topCategory = analytics.byCategory[0];

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

      <div className="ops-hero">
        <section className="neon-card neon-blue">
          <div className="stat-label">Problem rate</div>
          <div className="neon-value">{analytics.problemRate}%</div>
          <div className="stat-note">
            {analytics.problemReports} problems from {analytics.totalReports} checks
          </div>
        </section>
        <section className="neon-card neon-green">
          <div className="stat-label">Clean checks</div>
          <div className="neon-value">{analytics.cleanRate}%</div>
          <div className="stat-note">{analytics.noProblemReports} no-problem checks</div>
        </section>
        <section className="neon-card neon-orange">
          <div className="stat-label">Downtime</div>
          <div className="neon-value">{analytics.totalDowntime.toFixed(1)}h</div>
          <div className="stat-note">{analytics.highSeverity} high or critical alerts</div>
        </section>
        <section className="neon-card neon-red">
          <div className="stat-label">Top pressure</div>
          <div className="neon-value neon-text-sm">{topIssue?.[0] ?? "No issues"}</div>
          <div className="stat-note">{topCategory ? `${topCategory[0]} leads volume` : dateRange.label}</div>
        </section>
      </div>

      <div className="dashboard-grid-main">
        <section className="panel chart-panel">
          <div className="panel-header">
            <h2 className="panel-title">Daily trend</h2>
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

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel title="Repeated problems">
          {analytics.byIssue.length ? (
            analytics.byIssue.slice(0, 6).map(([label, value]) => (
              <div className="metric-row" key={label}>
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
                  <small>{driver.problems} problems / {driver.clean} clean</small>
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
                  <small>{truck.problems} problems / {truck.downtime.toFixed(1)}h downtime</small>
                </span>
                <b>{truck.score}</b>
              </Link>
            ))
          ) : (
            <div className="empty">No truck reports yet.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Latest reports">
          {reportRows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
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
