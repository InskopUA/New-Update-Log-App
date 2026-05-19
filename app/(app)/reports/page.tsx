import Link from "next/link";
import { AlertTriangle, CircleDollarSign, Search, ShieldCheck, TimerReset } from "lucide-react";
import { getAppContext } from "@/lib/auth/session";
import { resolveReport } from "@/lib/reports/actions";
import { createClient } from "@/lib/supabase/server";
import {
  getDateRange,
  getReportAnalytics,
  type OperationalReport
} from "@/lib/reports/analytics";
import {
  categoryLabel,
  issueTypeLabel,
  reportCategories,
  reportSeverities
} from "@/lib/reports/taxonomy";
import { ReportRangeFilters } from "@/components/reports/report-range-filters";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type ReportsPageProps = {
  searchParams: Promise<{
    driver_ids?: string;
    end_date?: string;
    error?: string;
    message?: string;
    category?: string;
    q?: string;
    range?: string;
    severity?: string;
    start_date?: string;
    truck_ids?: string;
  }>;
};

function severityClass(severity: string) {
  return `badge badge-${severity}`;
}

function statusClass(status: string | null | undefined) {
  return `badge status-${status ?? "workflow_pending"}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function getSelectedIds(value: string | undefined) {
  return value ? value.split(",").filter(Boolean) : [];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

function getFilterHref(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  return `/reports?${search.toString()}`;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const range = params.range ?? "30d";
  const dateRange = getDateRange(range, params.start_date, params.end_date);
  const selectedDriverIds = getSelectedIds(params.driver_ids);
  const selectedTruckIds = getSelectedIds(params.truck_ids);
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const canResolveReports = ["owner", "admin", "dispatcher"].includes(
    context.activeMembership?.role ?? ""
  );

  const [{ data }, { data: drivers }, { data: trucks }] = await Promise.all([
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

  const reports = ((data as OperationalReport[] | null) ?? []).filter(
    (report) =>
      (!selectedDriverIds.length || selectedDriverIds.includes(report.driver_id ?? "")) &&
      (!selectedTruckIds.length || selectedTruckIds.includes(report.truck_id ?? "")) &&
      (!params.category || report.category === params.category) &&
      (!params.severity || report.severity === params.severity) &&
      (!params.q ||
        [
          report.driver_name,
          report.truck_unit_number,
          report.load_reference,
          report.explanation,
          issueTypeLabel(report.category, report.issue_type),
          categoryLabel(report.category)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(params.q.toLowerCase()))
  );
  const analytics = getReportAnalytics(reports);
  const criticalHref = getFilterHref({ range, severity: "critical" });
  const highHref = getFilterHref({ range, severity: "high" });
  const truckPressure = analytics.truckScores[0];
  const driverPressure = analytics.driverScores[0];
  const driverOptions = (
    (drivers as Array<{ full_name: string; id: string; status: string }> | null) ?? []
  )
    .filter((driver) => driver.status === "active")
    .map((driver) => ({
      id: driver.id,
      label: driver.full_name
    }));
  const truckOptions = (
    (trucks as Array<{ id: string; status: string; unit_number: string }> | null) ?? []
  )
    .filter((truck) => truck.status !== "inactive")
    .map((truck) => ({
      id: truck.id,
      label: `Truck ${truck.unit_number}`
    }));

  return (
    <>
      <PageHeader
        action={
          <ReportRangeFilters
            activeRange={range}
            basePath="/reports"
            drivers={driverOptions}
            endDate={dateRange.endDate}
            selectedDriverIds={selectedDriverIds}
            selectedTruckIds={selectedTruckIds}
            startDate={dateRange.startDate}
            trucks={truckOptions}
          />
        }
        description="Explore every category check, problem, clean report, driver, truck, and explanation."
        title="Report Explorer"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

      <div className="report-command-strip">
        <section className="report-command-card">
          <ShieldCheck size={18} />
          <span>Checks</span>
          <strong>{analytics.totalReports}</strong>
          <em>{analytics.cleanRate}% clean</em>
        </section>
        <section className="report-command-card">
          <AlertTriangle size={18} />
          <span>Problems</span>
          <strong>{analytics.problemReports}</strong>
          <em>{analytics.problemRate}% problem rate</em>
        </section>
        <section className="report-command-card">
          <TimerReset size={18} />
          <span>Downtime</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em>{analytics.highSeverity} high-risk signals</em>
        </section>
        <section className="report-command-card">
          <CircleDollarSign size={18} />
          <span>Est. loss</span>
          <strong>{formatCurrency(analytics.estimatedLoss)}</strong>
          <em>based on downtime impact</em>
        </section>
      </div>

      <section className="report-workbench">
        <div className="quick-view-rail">
          <Link className="quick-view-pill" href={getFilterHref({ range })}>All reports</Link>
          <Link className="quick-view-pill quick-view-critical" href={criticalHref}>Critical only</Link>
          <Link className="quick-view-pill quick-view-high" href={highHref}>High severity</Link>
          {driverPressure ? (
            <Link className="quick-view-pill" href={getFilterHref({ driver_ids: driverPressure.id, range })}>
              Top driver risk
            </Link>
          ) : null}
          {truckPressure ? (
            <Link className="quick-view-pill" href={getFilterHref({ range, truck_ids: truckPressure.id })}>
              Top truck risk
            </Link>
          ) : null}
        </div>

        <form action="/reports" className="report-search-form">
          <input name="range" type="hidden" value={range} />
          {dateRange.startDate ? <input name="start_date" type="hidden" value={dateRange.startDate} /> : null}
          {dateRange.endDate ? <input name="end_date" type="hidden" value={dateRange.endDate} /> : null}
          {selectedDriverIds.length ? <input name="driver_ids" type="hidden" value={selectedDriverIds.join(",")} /> : null}
          {selectedTruckIds.length ? <input name="truck_ids" type="hidden" value={selectedTruckIds.join(",")} /> : null}

          <label className="search-field">
            <Search size={16} />
            <input
              defaultValue={params.q ?? ""}
              name="q"
              placeholder="Search driver, truck, load, issue, explanation..."
              type="search"
            />
          </label>
          <select defaultValue={params.category ?? ""} name="category">
            <option value="">All categories</option>
            {reportCategories.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
          </select>
          <select defaultValue={params.severity ?? ""} name="severity">
            <option value="">All severities</option>
            {reportSeverities.map((severity) => (
              <option key={severity.value} value={severity.value}>{severity.label}</option>
            ))}
          </select>
          <button className="button button-primary" type="submit">Apply</button>
        </form>
      </section>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel title="Problem categories">
          {analytics.byCategory.length ? (
            analytics.byCategory.map(([label, value]) => (
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
            <div className="empty">No category data yet.</div>
          )}
        </Panel>

        <Panel title="Top driver issues">
          {analytics.byDriver.length ? (
            analytics.byDriver.slice(0, 5).map(([label, value]) => (
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
            <div className="empty">No driver issue data yet.</div>
          )}
        </Panel>

        <Panel title="Top truck issues">
          {analytics.byTruck.length ? (
            analytics.byTruck.slice(0, 5).map(([label, value]) => (
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
            <div className="empty">No truck issue data yet.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Report history">
          {reports.length ? (
            <table className="table modern-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Problem</th>
                  <th>Severity</th>
                  <th>Impact</th>
                  <th>Status</th>
                  <th>Driver / Truck</th>
                  <th>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  (() => {
                    const workflowReady = typeof report.status === "string";
                    const status = report.status ?? "workflow pending";

                    return (
                      <tr key={report.id}>
                        <td>{formatDate(report.report_date)}</td>
                        <td>{categoryLabel(report.category)}</td>
                        <td>{issueTypeLabel(report.category, report.issue_type)}</td>
                        <td>
                          <span className={severityClass(report.severity)}>{report.severity}</span>
                        </td>
                        <td>
                          <strong>{Number(report.downtime_hours ?? 0).toFixed(1)}h</strong>
                          <div className="stat-note">
                            {formatCurrency(Number(report.downtime_hours ?? 0) * 180)}
                          </div>
                        </td>
                        <td>
                          <span className={statusClass(report.status)}>{status}</span>
                          {workflowReady && canResolveReports && report.status !== "resolved" ? (
                            <form action={resolveReport} className="status-action-form">
                              <input name="report_id" type="hidden" value={report.id} />
                              <input name="status" type="hidden" value="resolved" />
                              <button type="submit">Resolve</button>
                            </form>
                          ) : null}
                        </td>
                        <td>
                          {report.driver_id ? (
                            <Link
                              className="table-link"
                              href={`/reports?range=${range}&driver_ids=${report.driver_id}`}
                            >
                              {report.driver_name || "No driver"}
                            </Link>
                          ) : (
                            <div>{report.driver_name || "No driver"}</div>
                          )}
                          <div className="stat-note">
                            {report.truck_id ? (
                              <Link
                                className="table-link"
                                href={`/reports?range=${range}&truck_ids=${report.truck_id}`}
                              >
                                Truck {report.truck_unit_number}
                              </Link>
                            ) : (
                              "No truck"
                            )}
                          </div>
                        </td>
                        <td>{report.explanation}</td>
                      </tr>
                    );
                  })()
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
