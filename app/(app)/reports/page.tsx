import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  getDateRange,
  getReportAnalytics,
  type OperationalReport
} from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
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
    range?: string;
    start_date?: string;
  }>;
};

function severityClass(severity: string) {
  return `badge badge-${severity}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

function getSelectedDriverIds(value: string | undefined) {
  return value ? value.split(",").filter(Boolean) : [];
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const params = await searchParams;
  const range = params.range ?? "30d";
  const dateRange = getDateRange(range, params.start_date, params.end_date);
  const selectedDriverIds = getSelectedDriverIds(params.driver_ids);
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;

  const [{ data }, { data: drivers }] = await Promise.all([
    supabase.rpc("get_operational_reports", {
      end_date: dateRange.endDate,
      start_date: dateRange.startDate,
      target_company_id: companyId
    }),
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    })
  ]);

  const reports = ((data as OperationalReport[] | null) ?? []).filter(
    (report) => !selectedDriverIds.length || selectedDriverIds.includes(report.driver_id ?? "")
  );
  const analytics = getReportAnalytics(reports);
  const driverOptions = (
    (drivers as Array<{ full_name: string; id: string; status: string }> | null) ?? []
  )
    .filter((driver) => driver.status === "active")
    .map((driver) => ({
      id: driver.id,
      label: driver.full_name
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
            startDate={dateRange.startDate}
          />
        }
        description="Operational reports created by dispatchers and admins. This is the raw event history behind future scoring and AI summaries."
        title="Reports"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

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
          <div className="stat-note">{analytics.totalDowntime.toFixed(1)}h downtime</div>
        </section>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel title="Problem categories">
          {analytics.byCategory.length ? (
            analytics.byCategory.map(([label, value]) => (
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
            <div className="empty">No category data yet.</div>
          )}
        </Panel>

        <Panel title="Top driver issues">
          {analytics.byDriver.length ? (
            analytics.byDriver.slice(0, 5).map(([label, value]) => (
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
            <div className="empty">No driver issue data yet.</div>
          )}
        </Panel>

        <Panel title="Top truck issues">
          {analytics.byTruck.length ? (
            analytics.byTruck.slice(0, 5).map(([label, value]) => (
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
            <div className="empty">No truck issue data yet.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel title="Report history">
          {reports.length ? (
            <table className="table">
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
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>{formatDate(report.report_date)}</td>
                    <td>{categoryLabel(report.category)}</td>
                    <td>{issueTypeLabel(report.category, report.issue_type)}</td>
                    <td>
                      <span className={severityClass(report.severity)}>{report.severity}</span>
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
