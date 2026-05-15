import { createDriver, deactivateDriver } from "@/lib/drivers/actions";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateDrivers, canManageTeam, roleLabel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type DriversPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type Driver = {
  assigned_dispatcher_id: string | null;
  assigned_dispatcher_name: string | null;
  company_id: string;
  created_at: string;
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
  id: string;
  role: string;
  status: string;
  user_id: string;
};

const driverTypeLabels: Record<string, string> = {
  company_driver: "Company driver",
  contractor: "Contractor",
  owner_operator: "Owner operator"
};

function driverTypeLabel(value: string) {
  return driverTypeLabels[value] ?? value;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}

export default async function DriversPage({ searchParams }: DriversPageProps) {
  const params = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const canCreate = canCreateDrivers(context.activeMembership?.role);
  const canDeactivate = canManageTeam(context.activeMembership?.role);

  const [{ data: drivers }, { data: members }] = await Promise.all([
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    }),
    supabase.rpc("get_company_members", {
      target_company_id: companyId
    })
  ]);

  const driverRows = (drivers as Driver[] | null) ?? [];
  const dispatcherOptions = ((members as TeamMember[] | null) ?? []).filter(
    (member) =>
      member.status === "active" && ["admin", "dispatcher"].includes(member.role)
  );

  return (
    <>
      <PageHeader
        description="Create and manage the drivers that will be used in daily updates, loads, and performance analytics."
        title="Drivers"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

      {canCreate ? (
        <Panel title="Add driver">
          <form action={createDriver} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={companyId} />
            <div className="grid grid-3">
              <label className="field">
                <span className="label">Full name</span>
                <input className="input" name="full_name" required type="text" />
              </label>
              <label className="field">
                <span className="label">Phone</span>
                <input className="input" name="phone" type="tel" />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input className="input" name="email" type="email" />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Driver type</span>
                <select className="select" defaultValue="company_driver" name="driver_type">
                  <option value="company_driver">Company driver</option>
                  <option value="owner_operator">Owner operator</option>
                  <option value="contractor">Contractor</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Status</span>
                <select className="select" defaultValue="active" name="status">
                  <option value="active">Active</option>
                  <option value="on_hold">On hold</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Start date</span>
                <input className="input" name="start_date" type="date" />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Assigned dispatcher</span>
                <select className="select" defaultValue="" name="assigned_dispatcher_id">
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
                <input className="input" name="notes" type="text" />
              </label>
            </div>

            <div>
              <Button type="submit">Create driver</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Panel title="Drivers">
          {driverRows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Dispatcher</th>
                  <th>Start date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {driverRows.map((driver) => (
                  <tr key={driver.id}>
                    <td>
                      <div>{driver.full_name}</div>
                      {driver.notes ? <div className="stat-note">{driver.notes}</div> : null}
                    </td>
                    <td>
                      <div>{driver.phone || "No phone"}</div>
                      <div className="stat-note">{driver.email || "No email"}</div>
                    </td>
                    <td>{driverTypeLabel(driver.driver_type)}</td>
                    <td>
                      <span className="badge">{driver.status.replaceAll("_", " ")}</span>
                    </td>
                    <td>{driver.assigned_dispatcher_name || "Unassigned"}</td>
                    <td>{formatDate(driver.start_date)}</td>
                    <td>
                      {canDeactivate && driver.status !== "inactive" ? (
                        <form action={deactivateDriver}>
                          <input name="driver_id" type="hidden" value={driver.id} />
                          <Button type="submit" variant="secondary">
                            Deactivate
                          </Button>
                        </form>
                      ) : (
                        <span className="stat-note">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty">No drivers yet.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
