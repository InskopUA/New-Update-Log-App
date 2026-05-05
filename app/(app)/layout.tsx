import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { getAppContext } from "@/lib/auth/session";

export default async function ProtectedAppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const context = await getAppContext();

  if (!context.activeMembership) {
    redirect("/onboarding");
  }

  return (
    <AppShell
      activeMembership={context.activeMembership}
      email={context.profile?.email ?? context.user.email ?? ""}
    >
      {children}
    </AppShell>
  );
}
