import Link from "next/link";
import { Wrench } from "lucide-react";
import { createMaintenanceLog, updateMaintenanceLogStatus } from "@/lib/maintenance/actions";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateDrivers } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type MaintenancePageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type Truck = {
  id: string;
  status: string;
  unit_number: string;
};

type RepairLog = {
  actual_cost: number | string | null;
  completed_at: string | null;
  downtime_hours: number | string;
  estimated_cost: number | string | null;
  id: string;
  issue_type: string;
  next_follow_up_date: string | null;
  notes: string;
  opened_at: string;
  priority: string;
  scheduled_at: string | null;
  status: string;
  truck_id: string;
  trucks?: {
    unit_number: string;
  } | null;
  vendor: string | null;
};

const issueLabels: Record<string, string> = {
  body: "Body",
  brakes: "Brakes",
  engine: "Engine",
  inspection: "Inspection",
  lights: "Lights",
  oil_service: "Oil service",
  other: "Other",
  tires: "Tires"
};

function money(value: number | string | null) {
  const parsed = Number(value ?? 0);

  if (!parsed) {
    return "$0";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(parsed);
}

function statusNext(status: string) {
  if (status === "open") {
    return "scheduled";
  }

  if (status === "scheduled") {
    return "in_repair";
  }

  return "completed";
}

export default async function MaintenancePage({ searchParams }: MaintenancePageProps) {
  const params = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const canCreate = canCreateDrivers(context.activeMembership?.role);

  const [{ data: trucks }, { data: repairs }] = await Promise.all([
    supabase.rpc("get_trucks", {
      target_company_id: companyId
    }),
    supabase
      .from("maintenance_logs")
      .select("*, trucks(unit_number)")
      .eq("company_id", companyId)
      .order("opened_at", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  const truckRows = ((trucks as Truck[] | null) ?? []).filter((truck) => truck.status !== "inactive");
  const repairRows = (repairs as RepairLog[] | null) ?? [];
  const openRepairs = repairRows.filter((repair) => !["completed", "cancelled"].includes(repair.status));
  const completedRepairs = repairRows.filter((repair) => ["completed", "cancelled"].includes(repair.status));
  const openCost = openRepairs.reduce((total, repair) => total + Number(repair.estimated_cost ?? repair.actual_cost ?? 0), 0);
  const downtime = openRepairs.reduce((total, repair) => total + Number(repair.downtime_hours ?? 0), 0);

  return (
    <>
      <PageHeader
        description="Track repairs, vendors, downtime, cost, and follow-up work for every truck."
        title="Maintenance"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

      <div className="action-command-grid">
        <section className="detail-signal-card">
          <span>Open repairs</span>
          <strong>{openRepairs.length}</strong>
          <em>{openRepairs.filter((repair) => repair.priority === "critical" || repair.priority === "high").length} high priority</em>
        </section>
        <section className="detail-signal-card">
          <span>Open est. cost</span>
          <strong>{money(openCost)}</strong>
          <em>Estimated exposure</em>
        </section>
        <section className="detail-signal-card">
          <span>Downtime</span>
          <strong>{downtime.toFixed(1)}h</strong>
          <em>Open repair logs</em>
        </section>
      </div>

      {canCreate ? (
        <Panel action={<Wrench size={18} />} title="Add repair">
          <form action={createMaintenanceLog} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={companyId} />
            <input name="return_to" type="hidden" value="/maintenance" />
            <div className="grid grid-3">
              <label className="field">
                <span className="label">Truck</span>
                <select className="select" name="truck_id" required>
                  <option value="">Select truck</option>
                  {truckRows.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      Truck {truck.unit_number}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Issue type</span>
                <select className="select" defaultValue="other" name="issue_type">
                  {Object.entries(issueLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Priority</span>
                <select className="select" defaultValue="medium" name="priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Status</span>
                <select className="select" defaultValue="open" name="status">
                  <option value="open">Open</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_repair">In repair</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Vendor / shop</span>
                <input className="input" name="vendor" type="text" />
              </label>
              <label className="field">
                <span className="label">Next follow-up</span>
                <input className="input" name="next_follow_up_date" type="date" />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Estimated cost</span>
                <input className="input" min="0" name="estimated_cost" step="0.01" type="number" />
              </label>
              <label className="field">
                <span className="label">Actual cost</span>
                <input className="input" min="0" name="actual_cost" step="0.01" type="number" />
              </label>
              <label className="field">
                <span className="label">Downtime hours</span>
                <input className="input" min="0" name="downtime_hours" step="0.25" type="number" />
              </label>
            </div>

            <label className="field">
              <span className="label">Notes</span>
              <textarea className="textarea" name="notes" required />
            </label>

            <Button type="submit">Create repair</Button>
          </form>
        </Panel>
      ) : null}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Panel title="Open repairs">
          {openRepairs.length ? (
            <div className="action-page-list">
              {openRepairs.map((repair) => (
                <section className={`action-page-item action-page-${repair.priority}`} key={repair.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${repair.priority}`}>{repair.priority}</span>
                    <strong>Truck {repair.trucks?.unit_number ?? "Unknown"} · {issueLabels[repair.issue_type] ?? repair.issue_type}</strong>
                    <p>{repair.notes}</p>
                    <small>
                      {repair.status.replaceAll("_", " ")} · {repair.vendor || "No vendor"} · {money(repair.estimated_cost)} est. · {Number(repair.downtime_hours).toFixed(1)}h
                    </small>
                  </div>
                  <div className="action-page-controls">
                    <Link className="button button-secondary" href={`/trucks/${repair.truck_id}`}>Truck profile</Link>
                    <form action={updateMaintenanceLogStatus}>
                      <input name="repair_id" type="hidden" value={repair.id} />
                      <input name="truck_id" type="hidden" value={repair.truck_id} />
                      <input name="return_to" type="hidden" value="/maintenance" />
                      <input name="status" type="hidden" value={statusNext(repair.status)} />
                      <button className="button button-primary" type="submit">
                        {statusNext(repair.status).replaceAll("_", " ")}
                      </button>
                    </form>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="empty">No open repairs.</div>
          )}
        </Panel>

        <Panel title="Repair history">
          {completedRepairs.length ? (
            <div className="action-history-list">
              {completedRepairs.slice(0, 12).map((repair) => (
                <div className="action-history-item" key={repair.id}>
                  <span>
                    <strong>Truck {repair.trucks?.unit_number ?? "Unknown"} · {issueLabels[repair.issue_type] ?? repair.issue_type}</strong>
                    <small>{repair.completed_at ?? repair.opened_at} · {money(repair.actual_cost ?? repair.estimated_cost)} · {repair.vendor || "No vendor"}</small>
                    <em>{repair.notes}</em>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Completed repairs will appear here.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
