import { createTruck, deactivateTruck } from "@/lib/trucks/actions";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canCreateDrivers, canManageTeam } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

type TrucksPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

type Truck = {
  company_id: string;
  created_at: string;
  current_driver_id: string | null;
  current_driver_name: string | null;
  id: string;
  make: string | null;
  model: string | null;
  notes: string | null;
  plate_number: string | null;
  status: string;
  unit_number: string;
  vin: string | null;
  year: number | null;
};

type Driver = {
  full_name: string;
  id: string;
  status: string;
};

function truckName(truck: Truck) {
  const parts = [truck.year, truck.make, truck.model].filter(Boolean);
  return parts.length ? parts.join(" ") : "Details not set";
}

export default async function TrucksPage({ searchParams }: TrucksPageProps) {
  const params = await searchParams;
  const context = await getAppContext();
  const supabase = await createClient();
  const companyId = context.activeMembership?.company.id;
  const canCreate = canCreateDrivers(context.activeMembership?.role);
  const canDeactivate = canManageTeam(context.activeMembership?.role);

  const [{ data: trucks }, { data: drivers }] = await Promise.all([
    supabase.rpc("get_trucks", {
      target_company_id: companyId
    }),
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    })
  ]);

  const truckRows = (trucks as Truck[] | null) ?? [];
  const activeDrivers = ((drivers as Driver[] | null) ?? []).filter(
    (driver) => driver.status === "active"
  );

  return (
    <>
      <PageHeader
        description="Track units, status, current driver assignment, and the basic vehicle details needed for daily operations."
        title="Trucks"
      />

      <Notice message={params.error} type="error" />
      <Notice message={params.message} />

      {canCreate ? (
        <Panel title="Add truck">
          <form action={createTruck} className="form" style={{ marginTop: 0 }}>
            <input name="company_id" type="hidden" value={companyId} />

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Unit number</span>
                <input className="input" name="unit_number" required type="text" />
              </label>
              <label className="field">
                <span className="label">VIN</span>
                <input className="input" name="vin" type="text" />
              </label>
              <label className="field">
                <span className="label">Plate number</span>
                <input className="input" name="plate_number" type="text" />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Make</span>
                <input className="input" name="make" type="text" />
              </label>
              <label className="field">
                <span className="label">Model</span>
                <input className="input" name="model" type="text" />
              </label>
              <label className="field">
                <span className="label">Year</span>
                <input className="input" max="2100" min="1980" name="year" type="number" />
              </label>
            </div>

            <div className="grid grid-3">
              <label className="field">
                <span className="label">Status</span>
                <select className="select" defaultValue="active" name="status">
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </label>
              <label className="field">
                <span className="label">Current driver</span>
                <select className="select" defaultValue="" name="current_driver_id">
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
                <input className="input" name="notes" type="text" />
              </label>
            </div>

            <div>
              <Button type="submit">Create truck</Button>
            </div>
          </form>
        </Panel>
      ) : null}

      <div style={{ marginTop: 16 }}>
        <Panel title="Trucks">
          {truckRows.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Vehicle</th>
                  <th>VIN / Plate</th>
                  <th>Status</th>
                  <th>Current driver</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {truckRows.map((truck) => (
                  <tr key={truck.id}>
                    <td>
                      <div>{truck.unit_number}</div>
                      {truck.notes ? <div className="stat-note">{truck.notes}</div> : null}
                    </td>
                    <td>{truckName(truck)}</td>
                    <td>
                      <div>{truck.vin || "No VIN"}</div>
                      <div className="stat-note">{truck.plate_number || "No plate"}</div>
                    </td>
                    <td>
                      <span className="badge">{truck.status}</span>
                    </td>
                    <td>{truck.current_driver_name || "Unassigned"}</td>
                    <td>
                      {canDeactivate && truck.status !== "inactive" ? (
                        <form action={deactivateTruck}>
                          <input name="truck_id" type="hidden" value={truck.id} />
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
            <div className="empty">No trucks yet.</div>
          )}
        </Panel>
      </div>
    </>
  );
}
