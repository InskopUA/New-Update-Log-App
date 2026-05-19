import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { updateActionQueueItem } from "@/lib/action-queue/actions";
import { getAppContext } from "@/lib/auth/session";
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

const severityRank: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
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
  const { data } = await supabase.rpc("get_operational_reports", {
    end_date: null,
    start_date: null,
    target_company_id: companyId
  });
  const reports = ((data as OperationalReport[] | null) ?? []).sort((a, b) => {
    const severityDelta = (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);

    return severityDelta || b.report_date.localeCompare(a.report_date);
  });
  const openItems = reports.filter(isActionReport);
  const historyItems = reports
    .filter((report) => report.issue_type !== "no_problem" && report.status === "resolved")
    .slice(0, 12);
  const analytics = getReportAnalytics(openItems);

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
          <strong>{openItems.length}</strong>
          <em>{analytics.highSeverity} high / critical</em>
        </section>
        <section className="detail-signal-card">
          <span>Downtime at risk</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em>Open problem reports</em>
        </section>
        <section className="detail-signal-card">
          <span>Top pressure</span>
          <strong>{analytics.byIssue[0]?.[1] ?? 0}</strong>
          <em>{analytics.byIssue[0]?.[0] ?? "No pressure yet"}</em>
        </section>
      </div>

      <div className="grid grid-2">
        <Panel action={<Clock3 size={18} />} title="Needs action">
          {openItems.length ? (
            <div className="action-page-list">
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
          {historyItems.length ? (
            <div className="action-history-list">
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
