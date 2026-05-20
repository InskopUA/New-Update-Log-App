import Link from "next/link";
import { notFound } from "next/navigation";
import { createMaintenanceLog, updateMaintenanceLogStatus } from "@/lib/maintenance/actions";
import { deactivateTruck, updateTruck } from "@/lib/trucks/actions";
import { getAppContext } from "@/lib/auth/session";
import { getReportAnalytics, type OperationalReport } from "@/lib/reports/analytics";
import { categoryLabel, issueTypeLabel } from "@/lib/reports/taxonomy";
import { createClient } from "@/lib/supabase/server";
import { canCreateDrivers, canManageTeam } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type TruckDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type Truck = {
  company_id: string;
  current_driver_id: string | null;
  current_driver_name: string | null;
  id: string;
  make: string | null;
  model: string | null;
  notes: string | null;
  plate_number: string | null;
  status: string;
  unit_number: string;
  updated_at: string;
  vin: string | null;
  year: number | null;
};

type Driver = {
  full_name: string;
  id: string;
  status: string;
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
  status: string;
  truck_id: string;
  vendor: string | null;
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

const diagramZoneLabels: Record<string, string> = {
  body: "Trailer / body",
  brakes: "Axles / brakes",
  engine: "Engine bay",
  inspection: "Inspection",
  lights: "Lighting",
  oil_service: "Engine service",
  other: "General",
  tires: "Tires"
};

function getStringValue(value: string | number | null) {
  return value === null ? "" : String(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value);
}

export default async function TruckDetailPage({
  params,
  searchParams
}: TruckDetailPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const canEdit = canManageTeam(context.activeMembership?.role);
  const canAddRepair = canCreateDrivers(context.activeMembership?.role);

  const [{ data: truckData }, { data: drivers }, { data: reports }, { data: repairs }] = await Promise.all([
    supabase.rpc("get_truck_by_id", {
      target_truck_id: id
    }),
    supabase.rpc("get_drivers", {
      target_company_id: context.activeMembership?.company.id
    }),
    supabase.rpc("get_operational_reports", {
      end_date: null,
      start_date: null,
      target_company_id: context.activeMembership?.company.id
    }),
    supabase
      .from("maintenance_logs")
      .select("*")
      .eq("truck_id", id)
      .order("opened_at", { ascending: false })
      .order("created_at", { ascending: false })
  ]);

  const truck = (Array.isArray(truckData) ? truckData[0] : null) as Truck | null;

  if (!truck) {
    notFound();
  }

  const activeDrivers = ((drivers as Driver[] | null) ?? []).filter(
    (driver) => driver.status === "active" || driver.id === truck.current_driver_id
  );
  const reportRows = ((reports as OperationalReport[] | null) ?? [])
    .filter((report) => report.truck_id === truck.id)
    .sort((a, b) => b.report_date.localeCompare(a.report_date));
  const analytics = getReportAnalytics(reportRows);
  const truckScore = analytics.truckScores.find((score) => score.id === truck.id);
  const topIssue = truckScore?.topIssue?.[0] ?? analytics.byIssue[0]?.[0] ?? "No pressure yet";
  const repairRows = (repairs as RepairLog[] | null) ?? [];
  const openRepairs = repairRows.filter((repair) => !["completed", "cancelled"].includes(repair.status));
  const repairSpend = repairRows.reduce(
    (total, repair) => total + Number(repair.actual_cost ?? repair.estimated_cost ?? 0),
    0
  );
  const repairDowntime = repairRows.reduce((total, repair) => total + Number(repair.downtime_hours ?? 0), 0);
  const repairIssueCounts = repairRows.reduce<Record<string, number>>((counts, repair) => {
    counts[repair.issue_type] = (counts[repair.issue_type] ?? 0) + 1;
    return counts;
  }, {});
  const hotZones = new Set(
    Object.entries(repairIssueCounts)
      .filter(([, count]) => count > 0)
      .map(([issueType]) => issueType)
  );
  const hasEnginePressure = hotZones.has("engine") || hotZones.has("oil_service");
  const hasTirePressure = hotZones.has("tires");
  const hasBrakePressure = hotZones.has("brakes");
  const hasBodyPressure = hotZones.has("body") || hotZones.has("other") || hotZones.has("inspection");
  const hasLightPressure = hotZones.has("lights");

  return (
    <>
      <PageHeader
        action={
          <Link className="button button-secondary" href="/trucks">
            Back to trucks
          </Link>
        }
        description="Update vehicle details, operational status, and current driver assignment."
        title={`Truck ${truck.unit_number}`}
      />

      <Notice message={query.error} type="error" />
      <Notice message={query.message} />

      <div className="detail-command-grid">
        <section className="detail-signal-card">
          <span>Risk score</span>
          <strong>{truckScore?.score ?? 0}</strong>
          <em>{topIssue}</em>
        </section>
        <section className="detail-signal-card">
          <span>Problem checks</span>
          <strong>{analytics.problemReports}</strong>
          <em>{analytics.cleanRate}% clean checks</em>
        </section>
        <section className="detail-signal-card">
          <span>High risk</span>
          <strong>{truckScore?.high ?? 0}</strong>
          <em>High / critical reports</em>
        </section>
        <section className="detail-signal-card">
          <span>Downtime</span>
          <strong>{analytics.totalDowntime.toFixed(1)}h</strong>
          <em>All reports</em>
        </section>
        <section className="detail-signal-card">
          <span>Repair spend</span>
          <strong>{formatCurrency(repairSpend)}</strong>
          <em>{repairRows.length} repair logs</em>
        </section>
        <section className="detail-signal-card">
          <span>Repair downtime</span>
          <strong>{repairDowntime.toFixed(1)}h</strong>
          <em>{openRepairs.length} open repairs</em>
        </section>
      </div>

      <div className="grid grid-2 detail-overview-grid">
        <Panel title="Truck health map">
          <div className="truck-health-map">
            <svg aria-label="Truck health map" viewBox="0 0 720 260" role="img">
              <rect className={`truck-map-zone ${hasBodyPressure ? "zone-hot" : ""}`} x="252" y="74" width="342" height="92" rx="8" />
              <rect className={`truck-map-zone ${hasEnginePressure ? "zone-hot" : ""}`} x="104" y="98" width="134" height="68" rx="10" />
              <path className="truck-map-shell" d="M105 98h132l25 68h350v42H98a22 22 0 0 1-22-22v-42a46 46 0 0 1 29-46Z" />
              <path className="truck-map-window" d="M126 112h54l13 36h-67Z" />
              <rect className={`truck-map-zone ${hasLightPressure ? "zone-hot" : ""}`} x="86" y="162" width="28" height="16" rx="5" />
              <circle className={`truck-map-wheel ${hasTirePressure || hasBrakePressure ? "zone-hot" : ""}`} cx="176" cy="208" r="28" />
              <circle className={`truck-map-wheel ${hasTirePressure || hasBrakePressure ? "zone-hot" : ""}`} cx="448" cy="208" r="28" />
              <circle className={`truck-map-wheel ${hasTirePressure || hasBrakePressure ? "zone-hot" : ""}`} cx="548" cy="208" r="28" />
              <circle className="truck-map-hub" cx="176" cy="208" r="10" />
              <circle className="truck-map-hub" cx="448" cy="208" r="10" />
              <circle className="truck-map-hub" cx="548" cy="208" r="10" />
            </svg>
            <div className="truck-map-legend">
              {Object.entries(repairIssueCounts).length ? (
                Object.entries(repairIssueCounts).map(([issueType, count]) => (
                  <span key={issueType}>
                    <i />
                    {diagramZoneLabels[issueType] ?? issueType}: {count}
                  </span>
                ))
              ) : (
                <span><i className="calm" />No repair pressure mapped yet</span>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Top truck issues">
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
            <div className="empty">No truck issues yet.</div>
          )}
        </Panel>

        <Panel
          action={
            <Link className="panel-link" href={`/reports?range=all&truck_ids=${truck.id}`}>
              View reports
            </Link>
          }
          title="Recent truck reports"
        >
          {reportRows.length ? (
            <div className="compact-report-list">
              {reportRows.slice(0, 5).map((report) => (
                <Link className="compact-report-row" href={`/reports?range=all&truck_ids=${truck.id}`} key={report.id}>
                  <span>
                    <strong>{issueTypeLabel(report.category, report.issue_type)}</strong>
                    <small>{categoryLabel(report.category)} · {report.report_date}</small>
                  </span>
                  <span className={`badge badge-${report.severity}`}>{report.severity}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty">No reports for this truck yet.</div>
          )}
        </Panel>
      </div>

      <div className="grid grid-2 detail-overview-grid">
        <Panel title="Repair log">
          {repairRows.length ? (
            <div className="action-page-list">
              {repairRows.slice(0, 6).map((repair) => (
                <section className={`action-page-item action-page-${repair.priority}`} key={repair.id}>
                  <div className="action-page-main">
                    <span className={`badge badge-${repair.priority}`}>{repair.priority}</span>
                    <strong>{repairIssueLabels[repair.issue_type] ?? repair.issue_type}</strong>
                    <p>{repair.notes}</p>
                    <small>
                      {repair.status.replaceAll("_", " ")} · {repair.vendor || "No vendor"} · {Number(repair.downtime_hours).toFixed(1)}h downtime
                    </small>
                  </div>
                  {!["completed", "cancelled"].includes(repair.status) ? (
                    <div className="action-page-controls">
                      <form action={updateMaintenanceLogStatus}>
                        <input name="repair_id" type="hidden" value={repair.id} />
                        <input name="truck_id" type="hidden" value={truck.id} />
                        <input name="return_to" type="hidden" value={`/trucks/${truck.id}`} />
                        <input name="status" type="hidden" value="completed" />
                        <button className="button button-primary" type="submit">Complete</button>
                      </form>
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          ) : (
            <div className="empty">No repair logs for this truck yet.</div>
          )}
        </Panel>

        <Panel title="Add repair">
          {canAddRepair ? (
          <form action={createMaintenanceLog} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={truck.company_id} />
            <input name="truck_id" type="hidden" value={truck.id} />
            <input name="return_to" type="hidden" value={`/trucks/${truck.id}`} />
            <div className="grid grid-2">
              <label className="field">
                <span className="label">Issue type</span>
                <select className="select" defaultValue="other" name="issue_type">
                  {Object.entries(repairIssueLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">Priority</span>
                <select className="select" defaultValue={openRepairs.length ? "high" : "medium"} name="priority">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
            </div>
            <div className="grid grid-2">
              <label className="field">
                <span className="label">Vendor / shop</span>
                <input className="input" name="vendor" type="text" />
              </label>
              <label className="field">
                <span className="label">Estimated cost</span>
                <input className="input" min="0" name="estimated_cost" step="0.01" type="number" />
              </label>
            </div>
            <label className="field">
              <span className="label">Notes</span>
              <textarea className="textarea" name="notes" required />
            </label>
            <Button type="submit">Add repair</Button>
          </form>
          ) : (
            <div className="empty">You do not have permission to add repairs.</div>
          )}
        </Panel>
      </div>

      <Panel title="Truck details">
        <form action={updateTruck} className="form" style={{ marginTop: 0 }}>
          <input name="truck_id" type="hidden" value={truck.id} />

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Unit number</span>
              <input
                className="input"
                defaultValue={truck.unit_number}
                disabled={!canEdit}
                name="unit_number"
                required
                type="text"
              />
            </label>
            <label className="field">
              <span className="label">VIN</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.vin)}
                disabled={!canEdit}
                name="vin"
                type="text"
              />
            </label>
            <label className="field">
              <span className="label">Plate number</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.plate_number)}
                disabled={!canEdit}
                name="plate_number"
                type="text"
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Make</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.make)}
                disabled={!canEdit}
                name="make"
                type="text"
              />
            </label>
            <label className="field">
              <span className="label">Model</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.model)}
                disabled={!canEdit}
                name="model"
                type="text"
              />
            </label>
            <label className="field">
              <span className="label">Year</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.year)}
                disabled={!canEdit}
                max="2100"
                min="1980"
                name="year"
                type="number"
              />
            </label>
          </div>

          <div className="grid grid-3">
            <label className="field">
              <span className="label">Status</span>
              <select
                className="select"
                defaultValue={truck.status}
                disabled={!canEdit}
                name="status"
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="field">
              <span className="label">Current driver</span>
              <select
                className="select"
                defaultValue={truck.current_driver_id ?? ""}
                disabled={!canEdit}
                name="current_driver_id"
              >
                <option value="">Unassigned</option>
                {activeDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Notes</span>
              <input
                className="input"
                defaultValue={getStringValue(truck.notes)}
                disabled={!canEdit}
                name="notes"
                type="text"
              />
            </label>
          </div>

          {canEdit ? <Button type="submit">Save changes</Button> : null}
        </form>
        {canEdit && truck.status !== "inactive" ? (
          <form action={deactivateTruck} className="form">
            <input name="truck_id" type="hidden" value={truck.id} />
            <Button type="submit" variant="secondary">
              Deactivate
            </Button>
          </form>
        ) : null}
      </Panel>
    </>
  );
}
