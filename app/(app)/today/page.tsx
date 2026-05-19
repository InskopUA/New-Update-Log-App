import Link from "next/link";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Clock3, Wrench } from "lucide-react";
import { getAppContext } from "@/lib/auth/session";
import { getReportAnalytics, type OperationalReport } from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type Driver = {
  assigned_dispatcher_name: string | null;
  full_name: string;
  id: string;
  status: string;
};

type RepairAction = {
  downtime_hours: number | string;
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
  signal_type: string;
  tone: string;
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

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function isOpenReportAction(report: OperationalReport) {
  return (
    report.issue_type !== "no_problem" &&
    report.status !== "resolved" &&
    report.status !== "no_action"
  );
}

function riskLabel(score: number) {
  if (score >= 70) {
    return "High pressure";
  }

  if (score >= 35) {
    return "Watch closely";
  }

  return "Controlled";
}

export default async function TodayPage() {
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const today = todayString();

  const [{ data: drivers }, { data: todayReports }, { data: allReports }, { data: repairs }, { data: signals }] = await Promise.all([
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    }),
    supabase.rpc("get_operational_reports", {
      end_date: today,
      start_date: today,
      target_company_id: companyId
    }),
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
      .from("driver_signals")
      .select("*, drivers(full_name)")
      .eq("company_id", companyId)
      .eq("needs_follow_up", true)
      .is("resolved_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
  ]);

  const activeDrivers = ((drivers as Driver[] | null) ?? []).filter((driver) => driver.status === "active");
  const reportRows = (todayReports as OperationalReport[] | null) ?? [];
  const allReportRows = (allReports as OperationalReport[] | null) ?? [];
  const reportDriverIds = new Set(reportRows.map((report) => report.driver_id).filter(Boolean));
  const submittedDrivers = activeDrivers.filter((driver) => reportDriverIds.has(driver.id));
  const missingDrivers = activeDrivers.filter((driver) => !reportDriverIds.has(driver.id));
  const openReportActions = allReportRows.filter(isOpenReportAction);
  const openRepairs = (repairs as RepairAction[] | null) ?? [];
  const openSignals = (signals as DriverSignalAction[] | null) ?? [];
  const urgentSignals = openSignals.filter((signal) => signal.tone === "urgent" || signal.signal_type === "retention_risk");
  const todayAnalytics = getReportAnalytics(reportRows);
  const todayProblemReports = reportRows.filter((report) => report.issue_type !== "no_problem");
  const dueRepairCount = openRepairs.filter((repair) => !repair.next_follow_up_date || repair.next_follow_up_date <= today).length;
  const dueSignalCount = openSignals.filter((signal) => !signal.due_date || signal.due_date <= today).length;
  const todayRisk = Math.min(
    100,
    missingDrivers.length * 8 +
      todayAnalytics.highSeverity * 14 +
      todayProblemReports.length * 4 +
      dueRepairCount * 10 +
      dueSignalCount * 12 +
      urgentSignals.length * 12
  );

  return (
    <>
      <PageHeader
        description="Daily operating cockpit: missing reports, today’s risk, urgent follow-ups, and open maintenance pressure."
        title="Daily Control Room"
      />

      <div className="control-room-grid">
        <section className="detail-signal-card">
          <span>Today risk</span>
          <strong>{todayRisk}</strong>
          <em>{riskLabel(todayRisk)}</em>
        </section>
        <section className="detail-signal-card">
          <span>Report coverage</span>
          <strong>{submittedDrivers.length}/{activeDrivers.length}</strong>
          <em>{missingDrivers.length} missing today</em>
        </section>
        <section className="detail-signal-card">
          <span>Problems today</span>
          <strong>{todayProblemReports.length}</strong>
          <em>{todayAnalytics.highSeverity} high / critical</em>
        </section>
        <section className="detail-signal-card">
          <span>Due actions</span>
          <strong>{dueRepairCount + dueSignalCount + openReportActions.length}</strong>
          <em>{dueRepairCount} repairs · {dueSignalCount} driver signals</em>
        </section>
      </div>

      <div className="grid grid-2">
        <Panel action={<AlertTriangle size={18} />} title="Missing reports">
          {missingDrivers.length ? (
            <div className="today-list">
              {missingDrivers.map((driver) => (
                <Link className="today-row today-row-warning" href={`/drivers/${driver.id}`} key={driver.id}>
                  <span>
                    <strong>{driver.full_name}</strong>
                    <small>{driver.assigned_dispatcher_name || "No dispatcher"} · no report today</small>
                  </span>
                  <span className="badge badge-high">missing</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">All active drivers have reports today.</div>
          )}
        </Panel>

        <Panel action={<CheckCircle2 size={18} />} title="Submitted today">
          {submittedDrivers.length ? (
            <div className="today-list">
              {submittedDrivers.map((driver) => (
                <Link className="today-row" href={`/reports?range=custom&start_date=${today}&end_date=${today}&driver_ids=${driver.id}`} key={driver.id}>
                  <span>
                    <strong>{driver.full_name}</strong>
                    <small>{reportRows.filter((report) => report.driver_id === driver.id).length} checks submitted</small>
                  </span>
                  <span className="badge badge-low">done</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No driver reports submitted today yet.</div>
          )}
        </Panel>
      </div>

      <div className="grid grid-3" style={{ marginTop: 16 }}>
        <Panel action={<Clock3 size={18} />} title="Urgent follow-up">
          {urgentSignals.length ? (
            <div className="today-list">
              {urgentSignals.map((signal) => (
                <Link className="today-row today-row-critical" href={`/drivers/${signal.driver_id}`} key={signal.id}>
                  <span>
                    <strong>{signal.drivers?.full_name ?? "Driver"} · {signalTypeLabels[signal.signal_type] ?? signal.signal_type}</strong>
                    <small>{signal.note}</small>
                  </span>
                  <span className="badge badge-critical">{signal.tone}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No urgent driver follow-ups.</div>
          )}
        </Panel>

        <Panel action={<Wrench size={18} />} title="Maintenance pressure">
          {openRepairs.length ? (
            <div className="today-list">
              {openRepairs.slice(0, 6).map((repair) => (
                <Link className="today-row" href={`/trucks/${repair.truck_id}`} key={repair.id}>
                  <span>
                    <strong>Truck {repair.trucks?.unit_number ?? "Unknown"} · {repairIssueLabels[repair.issue_type] ?? repair.issue_type}</strong>
                    <small>{repair.status.replaceAll("_", " ")} · {Number(repair.downtime_hours).toFixed(1)}h downtime</small>
                  </span>
                  <span className={`badge badge-${repair.priority}`}>{repair.priority}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No open repairs.</div>
          )}
        </Panel>

        <Panel action={<CalendarCheck2 size={18} />} title="Today’s problem checks">
          {todayProblemReports.length ? (
            <div className="today-list">
              {todayProblemReports.slice(0, 6).map((report) => (
                <Link className="today-row" href={`/reports?range=custom&start_date=${today}&end_date=${today}`} key={report.id}>
                  <span>
                    <strong>{issueTypeLabel(report.category, report.issue_type)}</strong>
                    <small>{categoryLabel(report.category)} · {report.driver_name ?? "No driver"} · {report.truck_unit_number ? `Truck ${report.truck_unit_number}` : "No truck"}</small>
                  </span>
                  <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No problem checks today.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
