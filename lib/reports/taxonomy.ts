export const reportCategories = [
  { label: "Truck status", value: "truck_status" },
  { label: "Driver", value: "driver" },
  { label: "Load", value: "load" },
  { label: "Other", value: "other" }
] as const;

export const reportSeverities = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Critical", value: "critical" }
] as const;

export const reportIssueTypes = {
  truck_status: [
    { label: "Engine / drivetrain", value: "engine" },
    { label: "Transmission", value: "transmission" },
    { label: "Brakes", value: "brakes" },
    { label: "Tires", value: "tires" },
    { label: "Electrical", value: "electrical" },
    { label: "DEF / emissions", value: "def_emissions" },
    { label: "Trailer issue", value: "trailer_issue" },
    { label: "Accident / damage", value: "truck_accident_damage" },
    { label: "Scheduled service", value: "scheduled_service" },
    { label: "Other truck issue", value: "other_truck_issue" }
  ],
  driver: [
    { label: "No answer", value: "no_answer" },
    { label: "Overslept", value: "overslept" },
    { label: "Sick / not feeling well", value: "sick" },
    { label: "Late pickup / delivery", value: "late" },
    { label: "Did not follow plan", value: "missed_plan" },
    { label: "Hours issue", value: "hours_issue" },
    { label: "Accident / damage", value: "driver_accident_damage" },
    { label: "Behavior / communication", value: "behavior_communication" },
    { label: "Other driver issue", value: "other_driver_issue" }
  ],
  load: [
    { label: "Load cancelled", value: "cancelled" },
    { label: "No loads / bad area", value: "bad_area_no_loads" },
    { label: "Cheap load", value: "cheap_load" },
    { label: "Late arrival lowered rate", value: "late_arrival_low_rate" },
    { label: "Detention / waiting", value: "detention_waiting" },
    { label: "Broker issue", value: "broker_issue" },
    { label: "Facility issue", value: "facility_issue" },
    { label: "Other load issue", value: "other_load_issue" }
  ],
  other: [
    { label: "Road inspection", value: "road_inspection" },
    { label: "Weather", value: "weather" },
    { label: "Road closure / traffic", value: "road_closure_traffic" },
    { label: "Paperwork / documents", value: "paperwork_documents" },
    { label: "Dispatcher issue", value: "dispatcher_issue" },
    { label: "Customer issue", value: "customer_issue" },
    { label: "Other", value: "other" }
  ]
} as const;

export type ReportCategory = keyof typeof reportIssueTypes;

export function categoryLabel(value: string) {
  return reportCategories.find((category) => category.value === value)?.label ?? value;
}

export function issueTypeLabel(category: string, value: string) {
  const issueTypes = reportIssueTypes[category as ReportCategory] ?? [];
  return issueTypes.find((issueType) => issueType.value === value)?.label ?? value;
}
