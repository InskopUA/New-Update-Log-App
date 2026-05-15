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

function getOptionalString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value || null;
}

function getAllowedValue(value: string, allowedValues: string[], fallback: string) {
  return allowedValues.includes(value) ? value : fallback;
}

export async function createDriver(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const fullName = getString(formData, "full_name");
  const driverType = getAllowedValue(
    getString(formData, "driver_type"),
    ["company_driver", "owner_operator", "contractor"],
    "company_driver"
  );
  const status = getAllowedValue(getString(formData, "status"), ["active", "on_hold"], "active");

  if (!companyId || !fullName) {
    encodedRedirect("/drivers", "error", "Driver name is required.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("drivers").insert({
    company_id: companyId,
    full_name: fullName,
    phone: getOptionalString(formData, "phone"),
    email: getOptionalString(formData, "email"),
    status,
    driver_type: driverType,
    assigned_dispatcher_id: getOptionalString(formData, "assigned_dispatcher_id"),
    start_date: getOptionalString(formData, "start_date"),
    notes: getOptionalString(formData, "notes"),
    created_by: user?.id
  });

  if (error) {
    encodedRedirect("/drivers", "error", "Driver could not be created.");
  }

  revalidatePath("/drivers");
  encodedRedirect("/drivers", "message", "Driver created.");
}

export async function deactivateDriver(formData: FormData) {
  const supabase = await createClient();
  const driverId = getString(formData, "driver_id");

  if (!driverId) {
    encodedRedirect("/drivers", "error", "Driver could not be found.");
  }

  const { error } = await supabase.rpc("deactivate_driver", {
    target_driver_id: driverId
  });

  if (error) {
    encodedRedirect("/drivers", "error", "Driver could not be deactivated.");
  }

  revalidatePath("/drivers");
  encodedRedirect("/drivers", "message", "Driver deactivated.");
}
