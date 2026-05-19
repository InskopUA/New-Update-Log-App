import Link from "next/link";
import { notFound } from "next/navigation";
import { deactivateDriver, updateDriver } from "@/lib/drivers/actions";
import { getAppContext } from "@/lib/auth/session";
import { getReportAnalytics, type OperationalReport } from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam, roleLabel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type DriverDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type Driver = {
  assigned_dispatcher_id: string | null;
  assigned_dispatcher_name: string | null;
  company_id: string;
  driver_type: string;
  email: string | null;
  full_name: string;
  id: string;
  notes: string | null;
  phone: string | null;
  start_date: string | null;
  status: string;
};

type TeamMember = {
  email: string | null;
  full_name: string | null;
  role: string;
  status: string;
  user_id: string;
};

function getStringValue(value: string | null) {
  return value ?? "";
}

export default async function DriverDetailPage({
  params,
  searchParams
}: DriverDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const canEdit = canManageTeam(context.activeMembership?.role);

  const [{ data: driverData }, { data: members }, { data: reports }] = await Promise.all([
    supabase.rpc("get_driver_by_id", {
      target_driver_id: id
    }),
    supabase.rpc("get_company_members", {
      target_company_id: context.activeMembership?.company.id
    }),
    supabase.rpc("get_operational_reports", {
      end_date: null,
      start_date: null,
      target_company_id: context.activeMembership?.company.id
    })
  ]);

  const driver = (Array.isArray(driverData) ? driverData[0] : null) as Driver | null;

  if (!driver) {
    notFound();
  }

  const dispatcherOptions = ((members as TeamMember[] | null) ?? []).filter(
    (member) =>
      member.status === "active" &&
      ["admin", "dispatcher"].includes(member.role) &&
      (member.user_id === driver.assigned_dispatcher_id || member.status === "active")
  );
  const reportRows = ((reports as OperationalReport[] | null) ?? [])
    .filter((report) => report.driver_id === driver.id)
    .sort((a, b) => b.report_date.localeCompare(a.report_date));
  const analytics = getReportAnalytics(reportRows);
  const driverScore = analytics.driverScores.find((score) => score.id === driver.id);
  const topIssue = driverScore?.topIssue?.[0] ?? analytics.byIssue[0]?.[0] ?? "No pressure yet";

  return (
    <>
      <PageHeader
        action={
          <Link className="button button-secondary" href="/drivers">
            Back to drivers
          </Link>
        }
        description="Update contact details, operational status, type, and dispatcher assignment."
        title={driver.full_name}
      />

      <Notice message={query.error} type="error" />
      <Notice message={query.message} />

      <div className="detail-command-grid">
        <section className="detail-signal-card">
          <span>Risk score</span>
          <strong>{driverScore?.score ?? 0}</strong>
          <em>{topIssue}</em>
        </section>
        <section className="detail-signal-card">
          <span>Problem checks</span>
          <strong>{analytics.problemReports}</strong>
          <em>{analytics.cleanRate}% clean checks</em>
        </section>
        <section className="detail-signal-card">
          <span>High risk</span>
          <strong>{driverScore?.high ?? 0}</strong>
          <em>High / critical reports</em>
        </section>
        <section className="detail-signal-card">
          <span>Downtime</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em>All reports</em>
        </section>
      </div>

      <div className="grid grid-2 detail-overview-grid">
        <Panel title="Top driver issues">
          {analytics.byIssue.length ? (
            analytics.byIssue.slice(0, 5).map(([label, value]) => (
              <div className="metric-row metric-row-modern" key={label}>
                <span className="metric-label">{label}</span>
                <span className="metric-bar">
                  <span
                    className="metric-bar-fill"
                    style={{ width: `${Math.max(8, (value / Math.max(1, analytics.problemReports)) * 100)}%` }}
                  />
                </span>
                <span>{value}</span>
              </div>
            ))
          ) : (
            <div className="empty">No driver issues yet.</div>
          )}
        </Panel>

        <Panel
          action={
            <Link className="panel-link" href={`/reports?range=all&driver_ids=${driver.id}`}>
              View reports
            </Link>
          }
          title="Recent driver reports"
        >
          {reportRows.length ? (
            <div className="compact-report-list">
              {reportRows.slice(0, 5).map((report) => (
                <Link className="compact-report-row" href={`/reports?range=all&driver_ids=${driver.id}`} key={report.id}>
                  <span>
                    <strong>{issueTypeLabel(report.category, report.issue_type)}</strong>
                    <small>{categoryLabel(report.category)} · {report.report_date}</small>
                  </span>
                  <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No reports for this driver yet.</div>
          )}
        </Panel>
      </div>

      <Panel title="Driver details">
        <form action={updateDriver} className="form" style={{ marginTop: 0 }}>
          <input name="driver_id" type="hidden" value={driver.id} />

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Full name</span>
              <input
                className="input"
                defaultValue={driver.full_name}
                disabled={!canEdit}
                name="full_name"
                required
                type="text"
              />
            </label>
            <label className="field">
              <span className="label">Phone</span>
              <input
                className="input"
                defaultValue={getStringValue(driver.phone)}
                disabled={!canEdit}
                name="phone"
                type="tel"
              />
            </label>
            <label className="field">
              <span className="label">Email</span>
              <input
                className="input"
                defaultValue={getStringValue(driver.email)}
                disabled={!canEdit}
                name="email"
                type="email"
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Driver type</span>
              <select
                className="select"
                defaultValue={driver.driver_type}
                disabled={!canEdit}
                name="driver_type"
              >
                <option value="company_driver">Company driver</option>
                <option value="owner_operator">Owner operator</option>
                <option value="contractor">Contractor</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Status</span>
              <select
                className="select"
                defaultValue={driver.status}
                disabled={!canEdit}
                name="status"
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Start date</span>
              <input
                className="input"
                defaultValue={getStringValue(driver.start_date)}
                disabled={!canEdit}
                name="start_date"
                type="date"
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Assigned dispatcher</span>
              <select
                className="select"
                defaultValue={driver.assigned_dispatcher_id ?? ""}
                disabled={!canEdit}
                name="assigned_dispatcher_id"
              >
                <option value="">Unassigned</option>
                {dispatcherOptions.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name || member.email || roleLabel(member.role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Notes</span>
              <input
                className="input"
                defaultValue={getStringValue(driver.notes)}
                disabled={!canEdit}
                name="notes"
                type="text"
              />
            </label>
          </div>

          {canEdit ? <Button type="submit">Save changes</Button> : null}
        </form>
        {canEdit && driver.status !== "inactive" ? (
          <form action={deactivateDriver} className="form">
            <input name="driver_id" type="hidden" value={driver.id} />
            <Button type="submit" variant="secondary">
              Deactivate
            </Button>
          </form>
        ) : null}
      </Panel>
    </>
  );
}
