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

function getOptionalYear(formData: FormData) {
  const value = getString(formData, "year");

  if (!value) {
    return null;
  }

  const year = Number(value);

  if (!Number.isInteger(year) || year < 1980 || year > 2100) {
    return null;
  }

  return year;
}

export async function createTruck(formData: FormData) {
  const supabase = await createClient();
  const companyId = getString(formData, "company_id");
  const unitNumber = getString(formData, "unit_number");
  const status = getAllowedValue(
    getString(formData, "status"),
    ["active", "maintenance"],
    "active"
  );

  if (!companyId || !unitNumber) {
    encodedRedirect("/trucks", "error", "Unit number is required.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("trucks").insert({
    company_id: companyId,
    unit_number: unitNumber,
    vin: getOptionalString(formData, "vin"),
    make: getOptionalString(formData, "make"),
    model: getOptionalString(formData, "model"),
    year: getOptionalYear(formData),
    plate_number: getOptionalString(formData, "plate_number"),
    status,
    current_driver_id: getOptionalString(formData, "current_driver_id"),
    notes: getOptionalString(formData, "notes"),
    created_by: user?.id
  });

  if (error) {
    const message = error.message.toLowerCase().includes("duplicate")
      ? "A truck with this unit number already exists."
      : "Truck could not be created.";

    encodedRedirect("/trucks", "error", message);
  }

  revalidatePath("/trucks");
  encodedRedirect("/trucks", "message", "Truck created.");
}

export async function updateTruck(formData: FormData) {
  const supabase = await createClient();
  const truckId = getString(formData, "truck_id");
  const unitNumber = getString(formData, "unit_number");
  const status = getAllowedValue(
    getString(formData, "status"),
    ["active", "maintenance", "inactive"],
    "active"
  );

  if (!truckId || !unitNumber) {
    encodedRedirect("/trucks", "error", "Truck could not be updated.");
  }

  const { error } = await supabase
    .from("trucks")
    .update({
      unit_number: unitNumber,
      vin: getOptionalString(formData, "vin"),
      make: getOptionalString(formData, "make"),
      model: getOptionalString(formData, "model"),
      year: getOptionalYear(formData),
      plate_number: getOptionalString(formData, "plate_number"),
      status,
      current_driver_id: getOptionalString(formData, "current_driver_id"),
      notes: getOptionalString(formData, "notes")
    })
    .eq("id", truckId);

  if (error) {
    const message = error.message.toLowerCase().includes("duplicate")
      ? "A truck with this unit number already exists."
      : "Truck could not be updated.";

    encodedRedirect(`/trucks/${truckId}`, "error", message);
  }

  revalidatePath("/trucks");
  revalidatePath(`/trucks/${truckId}`);
  encodedRedirect(`/trucks/${truckId}`, "message", "Truck updated.");
}

export async function deactivateTruck(formData: FormData) {
  const supabase = await createClient();
  const truckId = getString(formData, "truck_id");

  if (!truckId) {
    encodedRedirect("/trucks", "error", "Truck could not be found.");
  }

  const { error } = await supabase.rpc("deactivate_truck", {
    target_truck_id: truckId
  });

  if (error) {
    encodedRedirect("/trucks", "error", "Truck could not be deactivated.");
  }

  revalidatePath("/trucks");
  revalidatePath(`/trucks/${truckId}`);
  encodedRedirect("/trucks", "message", "Truck deactivated.");
}
