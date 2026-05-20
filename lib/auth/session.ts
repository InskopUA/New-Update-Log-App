import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  name: string;
  slug: string | null;
};

export type Membership = {
  id: string;
  company_id: string;
  role: string;
  status: string;
  company: Company;
};

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

export async function getAppContext() {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const activeCompanyId = cookieStore.get("deeptruck:active-company-id")?.value;
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: memberships, error: membershipError } = await supabase
    .from("company_members")
    .select("id, company_id, role, status, company:companies(id, name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const normalizedMemberships = ((memberships ?? []) as unknown as Membership[]).filter(
    (membership) => membership.company
  );
  const activeMembership =
    normalizedMemberships.find((membership) => membership.company_id === activeCompanyId) ??
    normalizedMemberships[0] ??
    null;

  return {
    user,
    profile,
    memberships: normalizedMemberships,
    activeMembership
  };
}
