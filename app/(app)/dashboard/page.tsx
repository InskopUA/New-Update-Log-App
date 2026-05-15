import Link from "next/link";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getDateRange,
  getReportAnalytics,
  type OperationalReport
} from "@/lib/reports/analytics";
import { issueTypeLabel } from "@/lib/reports/taxonomy";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type DashboardPageProps = {
  searchParams: Promise<{
    range?: string;
  }>;
};

function RangeFilters({ activeRange }: { activeRange: string }) {
  const filters = [
    ["7d", "7 days"],
    ["30d", "30 days"],
    ["90d", "90 days"],
    ["all", "All time"]
  ];

  return (
    <div className="filters">
      {filters.map(([value, label]) => (
        <Link
          className={`filter-link ${activeRange === value ? "filter-link-active" : ""}`}
          href={`/dashboard?range=${value}`}
          key={value}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const range = params.range ?? "30d";
  const dateRange = getDateRange(range);
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

  const reportRows = ((reports as OperationalReport[] | null) ?? []);
  const analytics = getReportAnalytics(reportRows);
  const activeDrivers = ((drivers as Array<{ status: string }> | null) ?? []).filter(
    (driver) => driver.status === "active"
  ).length;
  const activeTrucks = ((trucks as Array<{ status: string }> | null) ?? []).filter(
    (truck) => truck.status === "active"
  ).length;

  return (
    <>
      <PageHeader
        action={<RangeFilters activeRange={range} />}
        description="Operational pulse built from reports submitted by dispatchers and admins."
        title="Dashboard"
      />

      <div className="grid grid-3">
        <section className="panel stat stat-accent">
          <div className="stat-label">Category checks</div>
          <div className="stat-value">{analytics.totalReports}</div>
          <div className="stat-note">{dateRange.label}</div>
        </section>
        <section className="panel stat stat-warning">
          <div className="stat-label">Problem reports</div>
          <div className="stat-value">{analytics.problemReports}</div>
          <div className="stat-note">{analytics.highSeverity} high or critical</div>
        </section>
        <section className="panel stat stat-success">
          <div className="stat-label">No problem checks</div>
          <div className="stat-value">{analytics.noProblemReports}</div>
          <div className="stat-note">Clean category reports</div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <section className="panel stat">
          <div className="stat-label">Active drivers</div>
          <div className="stat-value">{activeDrivers}</div>
          <div className="stat-note">Available for report assignment</div>
        </section>
        <section className="panel stat">
          <div className="stat-label">Active trucks</div>
          <div className="stat-value">{activeTrucks}</div>
          <div className="stat-note">Current working units</div>
        </section>
        <section className="panel stat">
          <div className="stat-label">Downtime</div>
          <div className="stat-value">{analytics.totalDowntime.toFixed(1)}h</div>
          <div className="stat-note">Reported downtime hours</div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <section className="panel stat">
          <div className="stat-label">Problem density</div>
          <div className="stat-value">
            {activeTrucks ? (analytics.problemReports / activeTrucks).toFixed(1) : "0.0"}
          </div>
          <div className="stat-note">Problems per active truck</div>
        </section>
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
          {analytics.byDriver.length ? (
            analytics.byDriver.slice(0, 6).map(([label, value]) => (
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
            <div className="empty">No driver reports yet.</div>
          )}
        </Panel>

        <Panel title="Trucks to watch">
          {analytics.byTruck.length ? (
            analytics.byTruck.slice(0, 6).map(([label, value]) => (
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
