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

  const reportDrivers = (
    (drivers as Array<{ full_name: string; id: string; status: string }> | null) ?? []
  )
    .filter((driver) => driver.status === "active")
    .map((driver) => ({
      id: driver.id,
      label: driver.full_name,
      status: driver.status
    }));
  const reportTrucks = (
    (trucks as Array<{ id: string; status: string; unit_number: string }> | null) ?? []
  )
    .filter((truck) => truck.status !== "inactive")
    .map((truck) => ({
      id: truck.id,
      label: truck.unit_number,
      status: truck.status
    }));

  return (
    <AppShell
      activeMembership={context.activeMembership}
      email={context.profile?.email ?? context.user.email ?? ""}
      reportDrivers={reportDrivers}
      reportTrucks={reportTrucks}
    >
      {children}
    </AppShell>
  );
}
