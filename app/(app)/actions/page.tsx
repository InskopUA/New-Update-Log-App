import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { updateActionQueueItem } from "@/lib/action-queue/actions";
import { getAppContext } from "@/lib/auth/session";
import { resolveDriverSignal } from "@/lib/driver-signals/actions";
import { updateMaintenanceLogStatus } from "@/lib/maintenance/actions";
import { getReportAnalytics, type OperationalReport } from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type ActionsPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type RepairAction = {
  actual_cost: number | string | null;
  completed_at: string | null;
  downtime_hours: number | string;
  estimated_cost: number | string | null;
  id: string;
  issue_type: string;
  next_follow_up_date: string | null;
  notes: string;
  priority: string;
  status: string;
  truck_id: string;
  trucks?: {
    unit_number: string;
  } | null;
  vendor: string | null;
};

type DriverSignalAction = {
  driver_id: string;
  drivers?: {
    full_name: string;
  } | null;
  due_date: string | null;
  id: string;
  note: string;
  resolution_note: string | null;
  resolved_at: string | null;
  signal_type: string;
  tone: string;
};

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const repairIssueLabels: Record<string, string> = {
  body: "Body",
  brakes: "Brakes",
  engine: "Engine",
  inspection: "Inspection",
  lights: "Lights",
  oil_service: "Oil service",
  other: "Other",
  tires: "Tires"
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

function isActionReport(report: OperationalReport) {
  return (
    report.issue_type !== "no_problem" &&
    report.status !== "resolved" &&
    report.status !== "no_action"
  );
}

function reportPriority(report: OperationalReport) {
  if (report.severity === "critical") {
    return "critical";
  }

  if (report.severity === "high" || report.follow_up_required) {
    return "high";
  }

  return "medium";
}

export default async function ActionsPage({ searchParams }: ActionsPageProps) {
  const query = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const [{ data }, { data: repairs }, { data: repairHistory }, { data: signals }, { data: signalHistory }] = await Promise.all([
    supabase.rpc("get_operational_reports", {
      end_date: null,
      start_date: null,
      target_company_id: companyId
    }),
    supabase
      .from("maintenance_logs")
      .select("*, trucks(unit_number)")
      .eq("company_id", companyId)
      .in("status", ["open", "scheduled", "in_repair"])
      .order("next_follow_up_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("maintenance_logs")
      .select("*, trucks(unit_number)")
      .eq("company_id", companyId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(8),
    supabase
      .from("driver_signals")
      .select("*, drivers(full_name)")
      .eq("company_id", companyId)
      .eq("needs_follow_up", true)
      .is("resolved_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("driver_signals")
      .select("*, drivers(full_name)")
      .eq("company_id", companyId)
      .not("resolved_at", "is", null)
      .order("resolved_at", { ascending: false })
      .limit(8)
  ]);
  const reports = ((data as OperationalReport[] | null) ?? []).sort((a, b) => {
    const severityDelta = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);

    return severityDelta || b.report_date.localeCompare(a.report_date);
  });
  const openItems = reports.filter(isActionReport);
  const openRepairs = (repairs as RepairAction[] | null) ?? [];
  const openSignals = (signals as DriverSignalAction[] | null) ?? [];
  const completedRepairs = (repairHistory as RepairAction[] | null) ?? [];
  const completedSignals = (signalHistory as DriverSignalAction[] | null) ?? [];
  const historyItems = reports
    .filter((report) => report.issue_type !== "no_problem" && report.status === "resolved")
    .slice(0, 12);
  const analytics = getReportAnalytics(openItems);
  const totalOpenActions = openItems.length + openRepairs.length + openSignals.length;

  return (
    <>
      <PageHeader
        description="Open operating issues that need follow-up, plus completed action history."
        title="Action Queue"
      />

      <Notice message={query.error} type="error" />
      <Notice message={query.message} />

      <div className="action-command-grid">
        <section className="detail-signal-card">
          <span>Open actions</span>
          <strong>{totalOpenActions}</strong>
          <em>{analytics.highSeverity} report high / critical</em>
        </section>
        <section className="detail-signal-card">
          <span>Downtime at risk</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em>Open problem reports</em>
        </section>
        <section className="detail-signal-card">
          <span>Repair / driver</span>
          <strong>{openRepairs.length + openSignals.length}</strong>
          <em>{openRepairs.length} repairs · {openSignals.length} driver signals</em>
        </section>
      </div>

      <div className="grid grid-2">
        <Panel action={<Clock3 size={18} />} title="Needs action">
          {totalOpenActions ? (
            <div className="action-page-list">
              {openRepairs.map((repair) => (
                <section className={`action-page-item action-page-${repair.priority}`} key={repair.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${repair.priority}`}>repair</span>
                    <strong>Truck {repair.trucks?.unit_number ?? "Unknown"} · {repairIssueLabels[repair.issue_type] ?? repair.issue_type}</strong>
                    <p>{repair.notes}</p>
                    <small>
                      {repair.status.replaceAll("_", " ")} · {repair.vendor || "No vendor"} · {Number(repair.downtime_hours).toFixed(1)}h downtime
                      {repair.next_follow_up_date ? ` · follow-up ${repair.next_follow_up_date}` : ""}
                    </small>
                  </div>
                  <div className="action-page-controls">
                    <Link className="button button-secondary" href={`/trucks/${repair.truck_id}`}>Truck</Link>
                    <form action={updateMaintenanceLogStatus}>
                      <input name="repair_id" type="hidden" value={repair.id} />
                      <input name="truck_id" type="hidden" value={repair.truck_id} />
                      <input name="return_to" type="hidden" value="/actions" />
                      <input name="status" type="hidden" value="completed" />
                      <button className="button button-primary" type="submit">Done</button>
                    </form>
                  </div>
                </section>
              ))}
              {openSignals.map((signal) => (
                <section className={`action-page-item action-page-${signal.tone === "urgent" ? "critical" : "high"}`} key={signal.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${signal.tone === "urgent" ? "critical" : "high"}`}>driver</span>
                    <strong>{signal.drivers?.full_name ?? "Driver"} · {signalTypeLabels[signal.signal_type] ?? signal.signal_type}</strong>
                    <p>{signal.note}</p>
                    <small>{signal.tone}{signal.due_date ? ` · due ${signal.due_date}` : ""}</small>
                  </div>
                  <div className="action-page-controls">
                    <Link className="button button-secondary" href={`/drivers/${signal.driver_id}`}>Driver</Link>
                    <form action={resolveDriverSignal} className="action-done-form">
                      <input name="signal_id" type="hidden" value={signal.id} />
                      <input name="driver_id" type="hidden" value={signal.driver_id} />
                      <input name="return_to" type="hidden" value="/actions" />
                      <input className="input" name="resolution_note" placeholder="Follow-up note" type="text" />
                      <button className="button button-primary" type="submit">Done</button>
                    </form>
                  </div>
                </section>
              ))}
              {openItems.map((report) => (
                <section className={`action-page-item action-page-${reportPriority(report)}`} key={report.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                    <strong>{issueTypeLabel(report.category, report.issue_type)}</strong>
                    <p>{report.explanation}</p>
                    <small>
                      {categoryLabel(report.category)} · {report.report_date} · {report.driver_name ?? "No driver"} ·{" "}
                      {report.truck_unit_number ? `Truck ${report.truck_unit_number}` : "No truck"}
                    </small>
                  </div>
                  <div className="action-page-controls">
                    <Link className="button button-secondary" href={`/reports?range=all&q=${encodeURIComponent(issueTypeLabel(report.category, report.issue_type))}`}>
                      View
                    </Link>
                    {report.status !== "in_progress" ? (
                      <form action={updateActionQueueItem}>
                        <input name="report_id" type="hidden" value={report.id} />
                        <input name="status" type="hidden" value="in_progress" />
                        <button className="button button-secondary" type="submit">Start</button>
                      </form>
                    ) : null}
                    <form action={updateActionQueueItem} className="action-done-form">
                      <input name="report_id" type="hidden" value={report.id} />
                      <input name="status" type="hidden" value="resolved" />
                      <input className="input" name="resolution_note" placeholder="Done note" type="text" />
                      <button className="button button-primary" type="submit">Done</button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty">No open action items.</div>
          )}
        </Panel>

        <Panel action={<CheckCircle2 size={18} />} title="Action history">
          {historyItems.length || completedRepairs.length || completedSignals.length ? (
            <div className="action-history-list">
              {completedRepairs.map((repair) => (
                <div className="action-history-item" key={repair.id}>
                  <span>
                    <strong>Repair completed · Truck {repair.trucks?.unit_number ?? "Unknown"}</strong>
                    <small>{repair.completed_at ?? "Completed"} · {repairIssueLabels[repair.issue_type] ?? repair.issue_type}</small>
                    <em>{repair.notes}</em>
                  </span>
                  <CheckCircle2 size={15} />
                </div>
              ))}
              {completedSignals.map((signal) => (
                <div className="action-history-item" key={signal.id}>
                  <span>
                    <strong>Driver follow-up · {signal.drivers?.full_name ?? "Driver"}</strong>
                    <small>{signal.resolved_at ? new Date(signal.resolved_at).toLocaleDateString("en-US") : "Resolved"} · {signalTypeLabels[signal.signal_type] ?? signal.signal_type}</small>
                    <em>{signal.resolution_note || signal.note}</em>
                  </span>
                  <CheckCircle2 size={15} />
                </div>
              ))}
              {historyItems.map((report) => (
                <div className="action-history-item" key={report.id}>
                  <span>
                    <strong>{issueTypeLabel(report.category, report.issue_type)}</strong>
                    <small>
                      {report.report_date} · {report.driver_name ?? "No driver"} ·{" "}
                      {report.truck_unit_number ? `Truck ${report.truck_unit_number}` : "No truck"}
                    </small>
                    {report.resolution_note ? <em>{report.resolution_note}</em> : null}
                  </span>
                  <AlertTriangle size={15} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Completed action history will appear here.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
