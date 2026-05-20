import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getAppContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function ProtectedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await getAppContext();

  if (!context.activeMembership) {
    redirect("/onboarding");
  }

  const supabase = await createClient();
  const companyId = context.activeMembership.company.id;
  const [{ data: drivers }, { data: trucks }] = await Promise.all([
    supabase.rpc("get_drivers", {
      target_company_id: companyId
    }),
    supabase.rpc("get_trucks", {
      target_company_id: companyId
    })
  ]);

  const truckRows =
    (trucks as Array<{
      current_driver_id: string | null;
      id: string;
      status: string;
      unit_number: string;
    }> | null) ?? [];
  const truckByDriverId = new Map(
    truckRows
      .filter((truck) => truck.current_driver_id && truck.status !== "inactive")
      .map((truck) => [truck.current_driver_id as string, truck])
  );
  const reportDrivers = (
    (drivers as Array<{ full_name: string; id: string; status: string }> | null) ?? []
  )
    .filter((driver) => driver.status === "active")
    .map((driver) => {
      const assignedTruck = truckByDriverId.get(driver.id);

      return {
        assignedTruckLabel: assignedTruck?.unit_number ?? null,
        id: driver.id,
        label: driver.full_name,
        status: driver.status
      };
    });

  return (
    <AppShell
      activeMembership={context.activeMembership}
      memberships={context.memberships}
      reportDrivers={reportDrivers}
    >
      {children}
    </AppShell>
  );
}
