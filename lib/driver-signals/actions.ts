"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(formData: FormData, key: string) {
  return getString(formData, key) || null;
}

function encodedRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

export async function createDriverSignal(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const driverId = getString(formData, "driver_id");
  const note = getString(formData, "note");
  const returnTo = getString(formData, "return_to") || `/drivers/${driverId}`;

  if (!companyId || !driverId || note.length < 3) {
    encodedRedirect(returnTo, "error", "Driver signal needs a driver and note.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("driver_signals").insert({
    company_id: companyId,
    created_by: user?.id,
    driver_id: driverId,
    due_date: getOptionalString(formData, "due_date"),
    needs_follow_up: getString(formData, "needs_follow_up") === "on",
    note,
    signal_type: getString(formData, "signal_type") || "other",
    tone: getString(formData, "tone") || "neutral"
  });

  if (error) {
    encodedRedirect(returnTo, "error", "Driver signal could not be created.");
  }

  revalidatePath(`/drivers/${driverId}`);
  revalidatePath("/actions");
  revalidatePath("/today");
  encodedRedirect(returnTo, "message", "Driver signal created.");
}

export async function resolveDriverSignal(formData: FormData) {
  const supabase = await createClient();
  const signalId = getString(formData, "signal_id");
  const driverId = getString(formData, "driver_id");
  const returnTo = getString(formData, "return_to") || `/drivers/${driverId}`;

  if (!signalId) {
    encodedRedirect(returnTo, "error", "Driver signal could not be updated.");
  }

  const { error } = await supabase
    .from("driver_signals")
    .update({
      needs_follow_up: false,
      resolution_note: getOptionalString(formData, "resolution_note"),
      resolved_at: new Date().toISOString()
    })
    .eq("id", signalId);

  if (error) {
    encodedRedirect(returnTo, "error", "Driver signal could not be updated.");
  }

  if (driverId) {
    revalidatePath(`/drivers/${driverId}`);
  }
  revalidatePath("/actions");
  revalidatePath("/today");
  encodedRedirect(returnTo, "message", "Driver signal resolved.");
}
