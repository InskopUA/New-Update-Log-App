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

export async function updateActionQueueItem(formData: FormData) {
  const supabase = await createClient();
  const reportId = getString(formData, "report_id");
  const status = getString(formData, "status");
  const resolutionNote = getString(formData, "resolution_note") || null;

  if (!reportId || !["in_progress", "resolved"].includes(status)) {
    encodedRedirect("/actions", "error", "Action item could not be updated.");
  }

  const { error } = await supabase.rpc("set_operational_report_status", {
    new_status: status,
    resolution_note_input: resolutionNote,
    target_report_id: reportId
  });

  if (error) {
    encodedRedirect("/actions", "error", "Action item could not be updated.");
  }

  revalidatePath("/actions");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  encodedRedirect("/actions", "message", "Action item updated.");
}
