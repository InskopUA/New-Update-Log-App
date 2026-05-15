import Link from "next/link";
import { notFound } from "next/navigation";
import { deactivateTruck, updateTruck } from "@/lib/trucks/actions";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { canManageTeam } from "@/lib/permissions";
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

function getStringValue(value: string | number | null) {
  return value === null ? "" : String(value);
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

  const [{ data: truckData }, { data: drivers }] = await Promise.all([
    supabase.rpc("get_truck_by_id", {
      target_truck_id: id
    }),
    supabase.rpc("get_drivers", {
      target_company_id: context.activeMembership?.company.id
    })
  ]);

  const truck = (Array.isArray(truckData) ? truckData[0] : null) as Truck | null;

  if (!truck) {
    notFound();
  }

  const activeDrivers = ((drivers as Driver[] | null) ?? []).filter(
    (driver) => driver.status === "active" || driver.id === truck.current_driver_id
  );

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
