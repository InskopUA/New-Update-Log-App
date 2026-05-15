import Link from "next/link";
import { notFound } from "next/navigation";
import { deactivateDriver, updateDriver } from "@/lib/drivers/actions";
import { getAppContext } from "@/lib/auth/session";
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

  const [{ data: driverData }, { data: members }] = await Promise.all([
    supabase.rpc("get_driver_by_id", {
      target_driver_id: id
    }),
    supabase.rpc("get_company_members", {
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
