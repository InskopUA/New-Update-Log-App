"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendInviteEmail } from "@/lib/email/resend";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function encodedRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function getSafeNext(value: string, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

function redirectWithMessage(path: string, params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);
  redirect(`${path}?${searchParams.toString()}`);
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "https";

  if (host) {
    return `${protocol}://${host}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL ?? "";
}

function getPublicAuthError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit")) {
    return "Too many email requests. Wait a few minutes, then try again. If your account already exists, sign in instead.";
  }

  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("email not confirmed")
  ) {
    return "Email or password is incorrect, or the account has not been confirmed yet.";
  }

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account with this email already exists. Sign in instead.";
  }

  if (normalized.includes("expired") || normalized.includes("invalid")) {
    return "This confirmation link is invalid or expired. Request a new email and try again.";
  }

  return "We could not complete this request. Check the details and try again.";
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const next = getSafeNext(getString(formData, "next"));

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    encodedRedirect("/login", "error", getPublicAuthError(error.message));
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const fullName = getString(formData, "full_name");
  const origin = getString(formData, "origin");
  const next = getSafeNext(getString(formData, "next"), "/onboarding");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    encodedRedirect("/signup", "error", getPublicAuthError(error.message));
  }

  revalidatePath("/", "layout");

  if (!data.session) {
    redirectWithMessage("/check-email", {
      email,
      message: "Account created. Check your email to confirm the account.",
      next
    });
  }

  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function createCompany(formData: FormData) {
  const supabase = await createClient();
  const companyName = getString(formData, "company_name");

  if (!companyName) {
    encodedRedirect("/onboarding", "error", "Company name is required.");
  }

  const { error } = await supabase.rpc("create_company", {
    company_name: companyName
  });

  if (error) {
    encodedRedirect("/onboarding", "error", error.message);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function createTeamInvite(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const email = getString(formData, "email").toLowerCase();
  const role = getString(formData, "role") || "dispatcher";
  const origin = await getRequestOrigin();

  if (!companyId || !email) {
    encodedRedirect("/settings/team", "error", "Email is required.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: invite, error } = await supabase
    .from("company_invites")
    .insert({
      company_id: companyId,
      email,
      role,
      invited_by: user?.id
    })
    .select("id, email, role, token, company:companies(name)")
    .single();

  if (error) {
    const message = error.message.toLowerCase().includes("duplicate")
      ? "A pending invite already exists for this email."
      : "Invite could not be created. Check the email and try again.";

    encodedRedirect("/settings/team", "error", message);
  }

  const normalizedInvite = invite as unknown as {
    email: string;
    role: string;
    token: string;
    company: { name: string } | null;
  };

  const inviteUrl = `${origin}/invite/${normalizedInvite.token}`;

  try {
    await sendInviteEmail({
      companyName: normalizedInvite.company?.name ?? "Update Log",
      email: normalizedInvite.email,
      inviteUrl,
      role: normalizedInvite.role
    });
  } catch (sendError) {
    console.error("Invite email send failed", sendError);
    revalidatePath("/settings/team");
    encodedRedirect(
      "/settings/team",
      "error",
      "Invite was created, but the email could not be sent. Check Resend settings and use the pending invite link manually."
    );
  }

  revalidatePath("/settings/team");
  encodedRedirect("/settings/team", "message", "Invite email sent.");
}

export async function acceptInvite(formData: FormData) {
  const supabase = await createClient();
  const token = getString(formData, "token");

  if (!token) {
    encodedRedirect("/login", "error", "Invite token is missing.");
  }

  const { error } = await supabase.rpc("accept_company_invite", {
    invite_token: token
  });

  if (error) {
    encodedRedirect(
      `/invite/${token}`,
      "error",
      "Invite could not be accepted. Check that you are signed in with the invited email and that the invite is still active."
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function revokeTeamInvite(formData: FormData) {
  const supabase = await createClient();
  const inviteId = getString(formData, "invite_id");
  const companyId = getString(formData, "company_id");

  if (!inviteId || !companyId) {
    encodedRedirect("/settings/team", "error", "Invite could not be found.");
  }

  const { error } = await supabase
    .from("company_invites")
    .update({
      status: "revoked"
    })
    .eq("id", inviteId)
    .eq("company_id", companyId)
    .eq("status", "pending");

  if (error) {
    encodedRedirect("/settings/team", "error", "Invite could not be cancelled.");
  }

  revalidatePath("/settings/team");
  encodedRedirect("/settings/team", "message", "Invite cancelled.");
}

export async function removeTeamMember(formData: FormData) {
  const supabase = await createClient();
  const membershipId = getString(formData, "membership_id");
  const companyId = getString(formData, "company_id");
  const role = getString(formData, "role");

  if (!membershipId || !companyId) {
    encodedRedirect("/settings/team", "error", "Member could not be found.");
  }

  if (role === "owner") {
    encodedRedirect("/settings/team", "error", "Owner cannot be removed from the workspace.");
  }

  const { error } = await supabase
    .from("company_members")
    .update({
      status: "inactive"
    })
    .eq("id", membershipId)
    .eq("company_id", companyId)
    .neq("role", "owner");

  if (error) {
    encodedRedirect("/settings/team", "error", "Member could not be removed.");
  }

  revalidatePath("/settings/team");
  encodedRedirect("/settings/team", "message", "Member removed.");
}
