"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  isNoProblemIssue,
  reportCategories,
  reportIssueTypes,
  type ReportCategory
} from "@/lib/reports/taxonomy";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function encodedRedirect(path: string, key: "error" | "message", value: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(value)}`);
}

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getAllowedValue(value: string, allowedValues: string[], fallback: string) {
  return allowedValues.includes(value) ? value : fallback;
}

function getDowntimeHours(formData: FormData, key: string) {
  const value = getString(formData, key);
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function createReport(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const reportDate = getString(formData, "report_date") || new Date().toISOString().slice(0, 10);
  const driverId = getOptionalString(formData, "driver_id");
  const loadReference = getOptionalString(formData, "load_reference");

  if (!companyId || !driverId) {
    encodedRedirect("/reports", "error", "Select a driver before saving the report.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: assignedTruck } = await supabase
    .from("trucks")
    .select("id")
    .eq("company_id", companyId)
    .eq("current_driver_id", driverId)
    .neq("status", "inactive")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const truckId = assignedTruck?.id ?? null;

  const rows = reportCategories.map((reportCategory) => {
    const category = reportCategory.value as ReportCategory;
    const allowedIssueTypes = reportIssueTypes[category].map((issueType) => issueType.value);
    const issueType = getAllowedValue(
      getString(formData, `${category}_issue_type`),
      allowedIssueTypes,
      allowedIssueTypes[0]
    );
    const noProblem = isNoProblemIssue(issueType);
    const severity = noProblem
      ? "low"
      : getAllowedValue(
          getString(formData, `${category}_severity`),
          ["low", "medium", "high", "critical"],
          "medium"
        );
    const explanation = noProblem
      ? "No problems reported."
      : getString(formData, `${category}_explanation`);

    if (!noProblem && explanation.length < 10) {
      encodedRedirect(
        "/reports",
        "error",
        "Each problem section needs an explanation of at least 10 characters."
      );
    }

    return {
      company_id: companyId,
      report_date: reportDate,
      category,
      issue_type: issueType,
      severity,
      driver_id: driverId,
      truck_id: truckId,
      load_reference: loadReference,
      downtime_hours: noProblem ? 0 : getDowntimeHours(formData, `${category}_downtime_hours`),
      explanation,
      created_by: user?.id
    };
  });

  const { error } = await supabase.from("operational_reports").insert(rows);

  if (error) {
    encodedRedirect("/reports", "error", "Report could not be created.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/today");
  encodedRedirect("/reports", "message", "Report created.");
}

export async function resolveReport(formData: FormData) {
  const supabase = await createClient();
  const reportId = getString(formData, "report_id");
  const status = getAllowedValue(
    getString(formData, "status"),
    ["in_progress", "resolved"],
    "resolved"
  );
  const resolutionNote = getOptionalString(formData, "resolution_note");

  if (!reportId) {
    encodedRedirect("/reports", "error", "Report could not be updated.");
  }

  const { error } = await supabase.rpc("set_operational_report_status", {
    new_status: status,
    resolution_note_input: resolutionNote,
    target_report_id: reportId
  });

  if (error) {
    encodedRedirect("/reports", "error", "Report status could not be updated.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/today");
  encodedRedirect("/reports", "message", "Report status updated.");
}
