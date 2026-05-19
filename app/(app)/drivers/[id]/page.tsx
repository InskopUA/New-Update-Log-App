import Link from "next/link";
import { notFound } from "next/navigation";
import { createDriverSignal, resolveDriverSignal } from "@/lib/driver-signals/actions";
import { deactivateDriver, updateDriver } from "@/lib/drivers/actions";
import { getAppContext } from "@/lib/auth/session";
import { getReportAnalytics, type OperationalReport } from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { canCreateDrivers, canManageTeam, roleLabel } from "@/lib/permissions";
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

type DriverSignal = {
  created_at: string;
  due_date: string | null;
  id: string;
  needs_follow_up: boolean;
  note: string;
  resolved_at: string | null;
  resolution_note: string | null;
  signal_type: string;
  tone: string;
};

const signalTypeLabels: Record<string, string> = {
  attitude: "Attitude",
  equipment: "Equipment",
  fatigue: "Fatigue",
  other: "Other",
  pay: "Pay",
  personal: "Personal",
  positive: "Positive",
  retention_risk: "Retention risk",
  schedule: "Schedule"
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
  const canAddSignal = canCreateDrivers(context.activeMembership?.role);

  const [{ data: driverData }, { data: members }, { data: reports }, { data: signals }] = await Promise.all([
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
    }),
    supabase
      .from("driver_signals")
      .select("*")
      .eq("driver_id", id)
      .order("created_at", { ascending: false })
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
  const signalRows = (signals as DriverSignal[] | null) ?? [];
  const openSignals = signalRows.filter((signal) => signal.needs_follow_up && !signal.resolved_at);
  const concernSignals = signalRows.filter((signal) => ["concern", "urgent"].includes(signal.tone));
  const driverSummary = openSignals.length
    ? `${driver.full_name} has ${openSignals.length} open follow-up signal${openSignals.length === 1 ? "" : "s"}.`
    : concernSignals.length
      ? `${driver.full_name} has recent concern signals, but no open follow-up.`
      : signalRows.length
        ? `${driver.full_name} has logged signals with no active concern.`
        : "No driver signals logged yet.";

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

      <div className="grid grid-2 detail-overview-grid">
        <Panel title="Driver Signals">
          <div className="driver-signal-summary">
            <strong>Manager summary</strong>
            <p>{driverSummary}</p>
          </div>
          {signalRows.length ? (
            <div className="action-page-list">
              {signalRows.slice(0, 6).map((signal) => (
                <section className={`driver-signal-item signal-${signal.tone}`} key={signal.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${signal.tone === "urgent" ? "critical" : signal.tone === "concern" ? "high" : "low"}`}>
                      {signal.tone}
                    </span>
                    <strong>{signalTypeLabels[signal.signal_type] ?? signal.signal_type}</strong>
                    <p>{signal.note}</p>
                    <small>
                      {new Date(signal.created_at).toLocaleDateString("en-US")} · {signal.needs_follow_up && !signal.resolved_at ? "Follow-up open" : "Logged"}
                      {signal.due_date ? ` · due ${signal.due_date}` : ""}
                    </small>
                  </div>
                  {signal.needs_follow_up && !signal.resolved_at ? (
                    <div className="action-page-controls">
                      <form action={resolveDriverSignal} className="action-done-form">
                        <input name="signal_id" type="hidden" value={signal.id} />
                        <input name="driver_id" type="hidden" value={driver.id} />
                        <input name="return_to" type="hidden" value={`/drivers/${driver.id}`} />
                        <input className="input" name="resolution_note" placeholder="Follow-up note" type="text" />
                        <button className="button button-primary" type="submit">Resolve</button>
                      </form>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <div className="empty">No driver signals yet.</div>
          )}
        </Panel>

        <Panel title="Add driver signal">
          {canAddSignal ? (
          <form action={createDriverSignal} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={driver.company_id} />
            <input name="driver_id" type="hidden" value={driver.id} />
            <input name="return_to" type="hidden" value={`/drivers/${driver.id}`} />
            <div className="grid grid-2">
              <label className="field">
                <span className="label">Signal type</span>
                <select className="select" defaultValue="other" name="signal_type">
                  {Object.entries(signalTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Tone</span>
                <select className="select" defaultValue="neutral" name="tone">
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="concern">Concern</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span className="label">Note</span>
              <textarea className="textarea" name="note" required />
            </label>
            <div className="grid grid-2">
              <label className="field">
                <span className="label">Due date</span>
                <input className="input" name="due_date" type="date" />
              </label>
              <label className="checkbox-row signal-checkbox">
                <input name="needs_follow_up" type="checkbox" />
                <span>Needs manager follow-up</span>
              </label>
            </div>
            <Button type="submit">Add signal</Button>
          </form>
          ) : (
            <div className="empty">You do not have permission to add driver signals.</div>
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
