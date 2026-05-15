"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reportIssueTypes, type ReportCategory } from "@/lib/reports/taxonomy";

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

function getDowntimeHours(formData: FormData) {
  const value = getString(formData, "downtime_hours");
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export async function createReport(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const category = getAllowedValue(
    getString(formData, "category"),
    Object.keys(reportIssueTypes),
    "truck_status"
  ) as ReportCategory;
  const allowedIssueTypes = reportIssueTypes[category].map((issueType) => issueType.value);
  const issueType = getAllowedValue(getString(formData, "issue_type"), allowedIssueTypes, allowedIssueTypes[0]);
  const severity = getAllowedValue(
    getString(formData, "severity"),
    ["low", "medium", "high", "critical"],
    "medium"
  );
  const explanation = getString(formData, "explanation");

  if (!companyId || explanation.length < 10) {
    encodedRedirect("/reports", "error", "Report explanation must be at least 10 characters.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("operational_reports").insert({
    company_id: companyId,
    report_date: getString(formData, "report_date") || new Date().toISOString().slice(0, 10),
    category,
    issue_type: issueType,
    severity,
    driver_id: getOptionalString(formData, "driver_id"),
    truck_id: getOptionalString(formData, "truck_id"),
    load_reference: getOptionalString(formData, "load_reference"),
    downtime_hours: getDowntimeHours(formData),
    explanation,
    created_by: user?.id
  });

  if (error) {
    encodedRedirect("/reports", "error", "Report could not be created.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  encodedRedirect("/reports", "message", "Report created.");
}
