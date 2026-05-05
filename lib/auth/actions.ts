"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function encodedRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
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
  const next = getString(formData, "next") || "/dashboard";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      },
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding`
    }
  });

  if (error) {
    encodedRedirect("/signup", "error", getPublicAuthError(error.message));
  }

  revalidatePath("/", "layout");

  if (!data.session) {
    encodedRedirect(
      "/login",
      "message",
      "Account created. Check your email to confirm the account, then sign in."
    );
  }

  redirect("/onboarding");
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

  if (!companyId || !email) {
    encodedRedirect("/settings/team", "error", "Email is required.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("company_invites").insert({
    company_id: companyId,
    email,
    role,
    invited_by: user?.id
  });

  if (error) {
    encodedRedirect("/settings/team", "error", error.message);
  }

  revalidatePath("/settings/team");
  encodedRedirect("/settings/team", "message", "Invite created.");
}
