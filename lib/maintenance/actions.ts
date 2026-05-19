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

function getNumber(formData: FormData, key: string) {
  const parsed = Number(getString(formData, key) || 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function encodedRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

export async function createMaintenanceLog(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const truckId = getString(formData, "truck_id");
  const notes = getString(formData, "notes");
  const returnTo = getString(formData, "return_to") || "/maintenance";

  if (!companyId || !truckId || notes.length < 3) {
    encodedRedirect(returnTo, "error", "Repair log needs a truck and notes.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("maintenance_logs").insert({
    actual_cost: getNumber(formData, "actual_cost") || null,
    company_id: companyId,
    completed_at: getOptionalString(formData, "completed_at"),
    created_by: user?.id,
    downtime_hours: getNumber(formData, "downtime_hours"),
    estimated_cost: getNumber(formData, "estimated_cost") || null,
    issue_type: getString(formData, "issue_type") || "other",
    next_follow_up_date: getOptionalString(formData, "next_follow_up_date"),
    notes,
    opened_at: getOptionalString(formData, "opened_at") ?? new Date().toISOString().slice(0, 10),
    priority: getString(formData, "priority") || "medium",
    scheduled_at: getOptionalString(formData, "scheduled_at"),
    status: getString(formData, "status") || "open",
    truck_id: truckId,
    vendor: getOptionalString(formData, "vendor")
  });

  if (error) {
    encodedRedirect(returnTo, "error", "Repair log could not be created.");
  }

  revalidatePath("/maintenance");
  revalidatePath(`/trucks/${truckId}`);
  revalidatePath("/actions");
  encodedRedirect(returnTo, "message", "Repair log created.");
}

export async function updateMaintenanceLogStatus(formData: FormData) {
  const supabase = await createClient();
  const repairId = getString(formData, "repair_id");
  const truckId = getString(formData, "truck_id");
  const status = getString(formData, "status");
  const returnTo = getString(formData, "return_to") || "/maintenance";

  if (!repairId || !["scheduled", "in_repair", "completed", "cancelled"].includes(status)) {
    encodedRedirect(returnTo, "error", "Repair status could not be updated.");
  }

  const { error } = await supabase
    .from("maintenance_logs")
    .update({
      actual_cost: getNumber(formData, "actual_cost") || undefined,
      completed_at: status === "completed" ? new Date().toISOString().slice(0, 10) : undefined,
      next_follow_up_date: getOptionalString(formData, "next_follow_up_date") ?? undefined,
      notes: getOptionalString(formData, "notes") ?? undefined,
      status
    })
    .eq("id", repairId);

  if (error) {
    encodedRedirect(returnTo, "error", "Repair status could not be updated.");
  }

  revalidatePath("/maintenance");
  revalidatePath("/actions");
  if (truckId) {
    revalidatePath(`/trucks/${truckId}`);
  }
  encodedRedirect(returnTo, "message", "Repair status updated.");
}
